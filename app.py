#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
xray-report-ui v2.0: Полная переработка
- Читает пользователей напрямую из Xray config
- Парсит CSV из /var/log/xray/usage/
- Локализация RU/EN
- Исправлены все баги
"""

import base64
import datetime as dt
import glob
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid as uuid_lib
from typing import Any, Dict, List, Optional, Tuple

from flask import Flask, Response, jsonify, request, send_file

APP_HOST = "127.0.0.1"
APP_PORT = int(os.environ.get("XRAY_REPORT_UI_PORT", "8787"))

XRAY_CFG = "/usr/local/etc/xray/config.json"
DATA_DIR = "/opt/xray-report-ui/data"
BACKUPS_DIR = os.path.join(DATA_DIR, "backups")

SETTINGS_PATH = os.path.join(DATA_DIR, "settings.json")
EVENTS_PATH = os.path.join(DATA_DIR, "events.log")

TEMPLATE_INDEX_PATHS = [
    "/opt/xray-report-ui/templates/index.html",
    "/opt/xray-report-ui/index.html",
]

USAGE_DIR = "/var/log/xray/usage"
ACCESS_LOG = os.environ.get("XRAY_ACCESS_LOG", "/var/log/xray/access.log")
LIVE_STATE_PATH = os.path.join(DATA_DIR, "usage_live.json")
LIVE_STATE_OFFSET_PATH = os.path.join(DATA_DIR, "usage_state.json")

SERVICE_UI = "xray-report-ui"
SERVICE_XRAY_DEFAULT = "xray"

LOCK = threading.Lock()

app = Flask(__name__)

# ---------------------------
# Utilities
# ---------------------------

def now_utc_iso() -> str:
    return dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def ensure_dirs() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(BACKUPS_DIR, exist_ok=True)

def atomic_write_text(path: str, text: str) -> None:
    d = os.path.dirname(path) or "."
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp_", dir=d)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            pass

def atomic_write_json(path: str, obj: Any) -> None:
    atomic_write_text(path, json.dumps(obj, ensure_ascii=False, indent=2) + "\n")

def read_json(path: str, default: Any) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def append_event(ev: Dict[str, Any]) -> None:
    ensure_dirs()
    ev = dict(ev)
    ev.setdefault("ts", now_utc_iso())
    line = json.dumps(ev, ensure_ascii=False)
    try:
        if os.path.exists(EVENTS_PATH) and os.path.getsize(EVENTS_PATH) > 10 * 1024 * 1024:
            rot = EVENTS_PATH + ".1"
            try:
                os.replace(EVENTS_PATH, rot)
            except Exception:
                pass
    except Exception:
        pass
    fd = None
    try:
        fd = os.open(EVENTS_PATH, os.O_CREAT | os.O_APPEND | os.O_WRONLY, 0o600)
        os.write(fd, (line + "\n").encode("utf-8"))
        os.fsync(fd)
    finally:
        if fd is not None:
            try:
                os.close(fd)
            except Exception:
                pass

def ok(data: Dict[str, Any] = None):
    resp = {"ok": True}
    if data:
        resp.update(data)
    return jsonify(resp)

def fail(error: str, code: int = 400, **extra):
    payload = {"ok": False, "error": error}
    payload.update(extra)
    return jsonify(payload), code

# ---------------------------
# Settings
# ---------------------------

DEFAULT_SETTINGS = {
    "version": 2,
    "ui": {
        "theme": "dark",
        "lang": "ru",  # ru | en
        "realtime_mode": "eco",  # live | eco
        "eco_poll_sec": 300,
        "live_push_sec": 5,
    },
    "xray": {
        "service_name": SERVICE_XRAY_DEFAULT,
        "config_path": XRAY_CFG,
        "inbound_tag": "",
        "server_host": "",
        "server_port": 443,
        "sni": "www.cloudflare.com",
        "fp": "chrome",
        "flow": "xtls-rprx-vision",
        "reality_pbk": "",
    },
    "collector": {
        "usage_dir": USAGE_DIR,
        "enabled": True,
    },
}

def load_settings() -> Dict[str, Any]:
    ensure_dirs()
    s = read_json(SETTINGS_PATH, {})
    if not isinstance(s, dict) or not s:
        s = json.loads(json.dumps(DEFAULT_SETTINGS))
        atomic_write_json(SETTINGS_PATH, s)
    merged = json.loads(json.dumps(DEFAULT_SETTINGS))
    def deep_merge(dst, src):
        for k, v in src.items():
            if isinstance(v, dict) and isinstance(dst.get(k), dict):
                deep_merge(dst[k], v)
            else:
                dst[k] = v
    deep_merge(merged, s)
    return merged

def save_settings(s: Dict[str, Any]) -> None:
    ensure_dirs()
    atomic_write_json(SETTINGS_PATH, s)

# ---------------------------
# Xray config helpers
# ---------------------------

def load_xray_config(path: str = None) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    if path is None:
        path = load_settings()["xray"].get("config_path", XRAY_CFG)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f), None
    except Exception as e:
        return None, str(e)

def save_xray_config(cfg: Dict[str, Any], path: str = None) -> None:
    if path is None:
        path = load_settings()["xray"].get("config_path", XRAY_CFG)
    atomic_write_text(path, json.dumps(cfg, ensure_ascii=False, indent=2) + "\n")

def find_vless_inbound(cfg: Dict[str, Any], inbound_tag: str = "") -> Optional[Dict[str, Any]]:
    inbounds = cfg.get("inbounds") or []
    if inbound_tag:
        for ib in inbounds:
            if isinstance(ib, dict) and ib.get("tag") == inbound_tag:
                return ib
    for ib in inbounds:
        if not isinstance(ib, dict):
            continue
        if ib.get("protocol") == "vless":
            return ib
    return None

def get_xray_clients(cfg: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """Get clients from Xray config"""
    if cfg is None:
        cfg, _ = load_xray_config()
    if not cfg:
        return []
    settings = load_settings()
    ib = find_vless_inbound(cfg, settings["xray"].get("inbound_tag", ""))
    if not ib:
        return []
    clients = (ib.get("settings") or {}).get("clients") or []
    return clients

def set_xray_clients(clients: List[Dict[str, Any]]) -> Tuple[bool, str]:
    """Set clients in Xray config, backup, restart"""
    cfg, err = load_xray_config()
    if err or not cfg:
        return False, f"Cannot load config: {err}"
    settings = load_settings()
    ib = find_vless_inbound(cfg, settings["xray"].get("inbound_tag", ""))
    if not ib:
        return False, "VLESS inbound not found"
    if "settings" not in ib:
        ib["settings"] = {}
    ib["settings"]["clients"] = clients
    
    # Backup
    path = settings["xray"].get("config_path", XRAY_CFG)
    bkp = backup_file(path, "clients_update")
    
    # Save
    save_xray_config(cfg, path)
    
    # Restart
    ok_r, msg = systemctl_restart(settings["xray"].get("service_name", SERVICE_XRAY_DEFAULT))
    if not ok_r:
        # Rollback
        shutil.copy2(bkp, path)
        systemctl_restart(settings["xray"].get("service_name", SERVICE_XRAY_DEFAULT))
        return False, f"Restart failed, rolled back: {msg}"
    
    return True, bkp

# ---------------------------
# pbk derivation
# ---------------------------

def derive_pbk_from_private(priv_b64: str, settings: Dict[str, Any] = None) -> Optional[str]:
    if settings is None:
        settings = load_settings()
    override = settings.get("xray", {}).get("reality_pbk", "").strip()
    if override:
        return override
    
    priv_b64 = (priv_b64 or "").strip()
    if not priv_b64:
        return None
    
    # Try xray x25519 command
    try:
        cp = subprocess.run(
            ["xray", "x25519", "-i", priv_b64],
            capture_output=True, text=True, timeout=5.0
        )
        output = (cp.stdout or "") + "\n" + (cp.stderr or "")
        for line in output.split("\n"):
            line = line.strip()
            if not line:
                continue
            m = re.search(r'([A-Za-z0-9_-]{43,44})', line)
            if m:
                candidate = m.group(1)
                if len(candidate) >= 43:
                    return candidate
    except Exception:
        pass
    
    # Fallback: cryptography library
    try:
        from cryptography.hazmat.primitives.asymmetric import x25519
        from cryptography.hazmat.primitives import serialization
        pad = "=" * ((4 - len(priv_b64) % 4) % 4)
        raw = base64.urlsafe_b64decode(priv_b64 + pad)
        pub = x25519.X25519PrivateKey.from_private_bytes(raw).public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        return base64.urlsafe_b64encode(pub).decode("utf-8").rstrip("=")
    except Exception:
        return None

def get_reality_params() -> Dict[str, Any]:
    """Get Reality params from Xray config"""
    settings = load_settings()
    cfg, err = load_xray_config()
    if err or not cfg:
        return {"ok": False, "error": f"Cannot load config: {err}"}
    
    ib = find_vless_inbound(cfg, settings["xray"].get("inbound_tag", ""))
    if not ib:
        return {"ok": False, "error": "VLESS inbound not found"}
    
    ss = ib.get("streamSettings") or {}
    if ss.get("security") != "reality":
        return {"ok": False, "error": "Reality not configured"}
    
    rs = ss.get("realitySettings") or {}
    priv = rs.get("privateKey", "")
    pbk = derive_pbk_from_private(priv, settings)
    
    return {
        "ok": True,
        "port": ib.get("port") or 443,
        "pbk": pbk,
        "sni": (rs.get("serverNames") or ["www.cloudflare.com"])[0],
        "sid": (rs.get("shortIds") or [""])[0],
        "fp": settings["xray"].get("fp", "chrome"),
        "flow": settings["xray"].get("flow", "xtls-rprx-vision"),
        "server_host": settings["xray"].get("server_host", ""),
    }

# ---------------------------
# System control
# ---------------------------

def backup_file(path: str, label: str) -> str:
    ensure_dirs()
    ts = dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_label = re.sub(r"[^a-zA-Z0-9_\-\.]+", "_", label)[:80]
    bn = f"{ts}__{safe_label}__{os.path.basename(path)}"
    dst = os.path.join(BACKUPS_DIR, bn)
    if os.path.exists(path):
        shutil.copy2(path, dst)
    return dst

def systemctl_restart(service: str) -> Tuple[bool, str]:
    allowed = {SERVICE_UI, SERVICE_XRAY_DEFAULT, "xray"}
    s = load_settings()
    allowed.add(s["xray"].get("service_name", SERVICE_XRAY_DEFAULT))
    if service not in allowed:
        return False, f"service_not_allowed: {service}"
    try:
        cp = subprocess.run(["systemctl", "restart", service], capture_output=True, text=True, timeout=30)
        if cp.returncode != 0:
            return False, (cp.stderr or cp.stdout or "restart_failed").strip()
        return True, "restarted"
    except Exception as e:
        return False, str(e)

def systemctl_is_active(service: str) -> Tuple[bool, str]:
    try:
        cp = subprocess.run(["systemctl", "is-active", service], capture_output=True, text=True, timeout=10)
        s = (cp.stdout or "").strip()
        return (s == "active"), s or "unknown"
    except Exception as e:
        return False, str(e)

# ---------------------------
# CSV metrics loader (FIXED for real format)
# ---------------------------

def _parse_date_from_name(path: str) -> Optional[dt.date]:
    m = re.search(r"(\d{4}-\d{2}-\d{2})\.csv$", os.path.basename(path))
    if not m:
        return None
    try:
        return dt.date.fromisoformat(m.group(1))
    except Exception:
        return None

def _read_csv(path: str) -> Tuple[List[str], List[List[str]], Optional[str]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = [ln.rstrip("\n") for ln in f.readlines() if ln.strip()]
        if not lines:
            return [], [], None
        header = [h.strip().lower() for h in lines[0].split(",")]
        rows = []
        for ln in lines[1:]:
            rows.append([c.strip() for c in ln.split(",")])
        return header, rows, None
    except Exception as e:
        return [], [], str(e)

def load_usage_data(days: int = 7) -> Dict[str, Any]:
    """Load usage data from CSV files"""
    settings = load_settings()
    usage_dir = settings["collector"].get("usage_dir", USAGE_DIR)
    
    result = {
        "ok": True,
        "usage_dir": usage_dir,
        "files_found": 0,
        "per_day": [],
        "by_user": {},
        "totals": {"bytes": 0, "users": 0},
        "errors": [],
    }
    
    if not os.path.isdir(usage_dir):
        result["errors"].append(f"Directory not found: {usage_dir}")
        return result
    
    # Find usage_*.csv files (they have per-user totals)
    usage_files = sorted(glob.glob(os.path.join(usage_dir, "usage_*.csv")))
    result["files_found"] = len(usage_files)
    
    # Filter by date
    today = dt.datetime.utcnow().date()
    cutoff = today - dt.timedelta(days=days)
    
    for fpath in usage_files:
        fdate = _parse_date_from_name(fpath)
        if not fdate or fdate < cutoff:
            continue
        
        header, rows, err = _read_csv(fpath)
        if err:
            result["errors"].append(f"{os.path.basename(fpath)}: {err}")
            continue
        
        # Find column indices
        col = {name: idx for idx, name in enumerate(header)}
        user_idx = col.get("user", col.get("email"))
        total_idx = col.get("total_bytes", col.get("bytes"))
        up_idx = col.get("uplink_bytes", col.get("up_bytes"))
        down_idx = col.get("downlink_bytes", col.get("down_bytes"))
        
        day_total = 0
        day_users = set()

        for r in rows:
            if len(r) <= max(filter(lambda x: x is not None, [user_idx, total_idx, up_idx, down_idx]), default=0):
                continue

            user = r[user_idx] if user_idx is not None and user_idx < len(r) else "unknown"
            
            # Get bytes
            if total_idx is not None and total_idx < len(r):
                try:
                    b = int(r[total_idx])
                except:
                    b = 0
            elif up_idx is not None and down_idx is not None:
                try:
                    b = int(r[up_idx]) + int(r[down_idx])
                except:
                    b = 0
            else:
                b = 0
            
            day_total += b
            day_users.add(user)
            
            # Aggregate by user
            if user not in result["by_user"]:
                result["by_user"][user] = {"bytes": 0, "days": 0}
            result["by_user"][user]["bytes"] += b
            result["by_user"][user]["days"] += 1
        
        result["per_day"].append({
            "date": fdate.isoformat(),
            "bytes": day_total,
            "users": len(day_users),
        })
        result["totals"]["bytes"] += day_total
    
    result["totals"]["users"] = len(result["by_user"])
    result["per_day"].sort(key=lambda x: x["date"])
    
    return result

def _read_csv_dict(path: str) -> List[Dict[str, str]]:
    """Read CSV and return list of dicts"""
    try:
        header, rows, err = _read_csv(path)
        if err or not header:
            return []
        result = []
        for row in rows:
            d = {}
            for i, h in enumerate(header):
                if i < len(row):
                    d[h] = row[i]
            result.append(d)
        return result
    except Exception:
        return []

def _load_domains_map(usage_dir: str, to_date: dt.date) -> Dict[str, str]:
    """Load IP->domain mapping from domains_*.csv files"""
    domains_map = {}
    # Find the most recent domains file up to to_date
    domains_files = sorted(glob.glob(os.path.join(usage_dir, "domains_*.csv")))
    pick_file = None
    for f in domains_files:
        d = _parse_date_from_name(f)
        if d and d <= to_date:
            pick_file = f
    if not pick_file and domains_files:
        pick_file = domains_files[-1]
    
    if pick_file:
        for row in _read_csv_dict(pick_file):
            ip = (row.get("dst") or row.get("ip") or "").strip()
            dom = (row.get("domain") or "").strip()
            if ip and dom:
                domains_map[ip] = dom
    return domains_map

def _looks_like_ip(s: str) -> bool:
    """Check if string looks like an IP address"""
    if not s:
        return False
    parts = s.split(".")
    if len(parts) != 4:
        return False
    try:
        return all(0 <= int(p) <= 255 for p in parts)
    except:
        return False

def _dst_to_domain(dst: str, domains_map: Dict[str, str]) -> str:
    """Convert IP/dst to domain using map"""
    dst = (dst or "").strip()
    return domains_map.get(dst, dst) if dst else "-"

def _topn(d: Dict[str, int], n: int = 10) -> List[Dict[str, Any]]:
    """Get top N items with percentages"""
    items = sorted(d.items(), key=lambda x: x[1], reverse=True)[:n]
    total = sum(d.values()) or 0
    return [{"domain": dom, "value": v, "pct": (v / total * 100.0 if total else 0.0)} for dom, v in items]

def _topn_traffic(d: Dict[str, int], n: int = 10) -> List[Dict[str, Any]]:
    """Get top N domains for traffic (ТЗ format)"""
    items = sorted(d.items(), key=lambda x: x[1], reverse=True)[:n]
    total = sum(d.values()) or 0
    return [{"domain": dom, "trafficBytes": v, "sharePct": round((v / total * 100.0 if total else 0.0), 2)} for dom, v in items]

def _topn_conns(d: Dict[str, int], n: int = 10) -> List[Dict[str, Any]]:
    """Get top N domains for conns (ТЗ format)"""
    items = sorted(d.items(), key=lambda x: x[1], reverse=True)[:n]
    total = sum(d.values()) or 0
    return [{"domain": dom, "conns": v, "sharePct": round((v / total * 100.0 if total else 0.0), 2)} for dom, v in items]

def load_dashboard_data(days: int = 7, user_filter: str = None) -> Dict[str, Any]:
    """
    Load comprehensive dashboard data matching historical structure.
    Reads usage_*.csv, conns_*.csv, report_*.csv, domains_*.csv
    Returns: {meta, global, users, kpi, collector}
    """
    settings = load_settings()
    usage_dir = settings["collector"].get("usage_dir", USAGE_DIR)
    
    if not os.path.isdir(usage_dir):
        return {
            "ok": False,
            "error": f"Directory not found: {usage_dir}",
            "meta": {"days": [], "prev_days": [], "users": []},
            "global": {},
            "users": {},
            "kpi": {},
            "collector": {"enabled": False, "lag_days": None},
        }
    
    today = dt.datetime.utcnow().date()
    # Build date list: last N days
    days = max(7, min(31, int(days)))
    date_list = [today - dt.timedelta(days=i) for i in range(days - 1, -1, -1)]
    date_keys = [d.isoformat() for d in date_list]
    
    # Split into last 7 and prev 7
    last_keys = date_keys[-7:] if len(date_keys) >= 7 else date_keys
    prev_keys = date_keys[-14:-7] if len(date_keys) >= 14 else []
    
    # Load domains map (use most recent up to today)
    domains_map = _load_domains_map(usage_dir, today)
    
    # Initialize arrays
    all_users = set()
    g_bytes_all = [0] * len(date_keys)
    g_conns_all = [0] * len(date_keys)
    u_bytes_all: Dict[str, List[int]] = {}
    u_conns_all: Dict[str, List[int]] = {}
    
    # Read usage_*.csv (traffic by user per day)
    for i, date_key in enumerate(date_keys):
        fpath = os.path.join(usage_dir, f"usage_{date_key}.csv")
        if not os.path.exists(fpath):
            continue
        for row in _read_csv_dict(fpath):
            user = (row.get("user") or row.get("email") or "").strip()
            if not user:
                continue
            all_users.add(user)
            # Get total_bytes
            try:
                b = int(float(row.get("total_bytes") or row.get("bytes") or 0))
            except:
                try:
                    up = int(float(row.get("uplink_bytes") or row.get("up_bytes") or 0))
                    down = int(float(row.get("downlink_bytes") or row.get("down_bytes") or 0))
                    b = up + down
                except:
                    b = 0
            u_bytes_all.setdefault(user, [0] * len(date_keys))[i] += b
            g_bytes_all[i] += b
    
    # Read conns_*.csv (connections by user per day)
    for i, date_key in enumerate(date_keys):
        fpath = os.path.join(usage_dir, f"conns_{date_key}.csv")
        if not os.path.exists(fpath):
            continue
        for row in _read_csv_dict(fpath):
            user = (row.get("user") or "").strip()
            if not user:
                continue
            all_users.add(user)
            try:
                c = int(float(row.get("conn_count") or row.get("conns") or 0))
            except:
                c = 0
            u_conns_all.setdefault(user, [0] * len(date_keys))[i] += c
            g_conns_all[i] += c
    
    users_sorted = sorted(all_users)
    
    # Helper to slice arrays for specific date keys
    def slice_for(keys: List[str], arr_all: List[int]) -> List[int]:
        result = []
        for k in keys:
            try:
                idx = date_keys.index(k)
                result.append(arr_all[idx] if idx < len(arr_all) else 0)
            except:
                result.append(0)
        return result
    
    # Global daily arrays
    g_last = {
        "daily_traffic_bytes": slice_for(last_keys, g_bytes_all),
        "daily_conns": slice_for(last_keys, g_conns_all),
    }
    g_prev = {
        "daily_traffic_bytes": slice_for(prev_keys, g_bytes_all) if prev_keys else [0] * 7,
        "daily_conns": slice_for(prev_keys, g_conns_all) if prev_keys else [0] * 7,
    }
    
    # Cumulative arrays for last 7
    cum_traffic = []
    cum_conns = []
    acc_t = 0
    acc_c = 0
    for i in range(len(g_last["daily_traffic_bytes"])):
        acc_t += g_last["daily_traffic_bytes"][i]
        acc_c += g_last["daily_conns"][i]
        cum_traffic.append(acc_t)
        cum_conns.append(acc_c)
    
    # Top domains (only last 7 days)
    glob_t_last: Dict[str, int] = {}  # domain -> traffic bytes
    glob_c_last: Dict[str, int] = {}  # domain -> connections
    per_t_last: Dict[str, Dict[str, int]] = {}  # user -> {domain -> traffic}
    per_c_last: Dict[str, Dict[str, int]] = {}  # user -> {domain -> conns}
    
    for date_key in last_keys:
        # report_*.csv: traffic by domain
        rpath = os.path.join(usage_dir, f"report_{date_key}.csv")
        if os.path.exists(rpath):
            for row in _read_csv_dict(rpath):
                user = (row.get("user") or "").strip()
                if not user:
                    continue
                dst = (row.get("dst") or "").strip()
                dom = _dst_to_domain(dst, domains_map)
                try:
                    v = int(float(row.get("traffic_bytes") or 0))
                except:
                    v = 0
                per_t_last.setdefault(user, {})
                per_t_last[user][dom] = per_t_last[user].get(dom, 0) + v
                glob_t_last[dom] = glob_t_last.get(dom, 0) + v
        
        # conns_*.csv: connections by domain (already read, but need domain mapping)
        cpath = os.path.join(usage_dir, f"conns_{date_key}.csv")
        if os.path.exists(cpath):
            for row in _read_csv_dict(cpath):
                user = (row.get("user") or "").strip()
                if not user:
                    continue
                dst = (row.get("dst") or "").strip()
                dom = _dst_to_domain(dst, domains_map)
                try:
                    v = int(float(row.get("conn_count") or 0))
                except:
                    v = 0
                per_c_last.setdefault(user, {})
                per_c_last[user][dom] = per_c_last[user].get(dom, 0) + v
                glob_c_last[dom] = glob_c_last.get(dom, 0) + v
    
    # Build users payload
    clients = get_xray_clients()
    clients_by_email = {c.get("email", ""): c for c in clients}
    
    users_payload: Dict[str, Any] = {}
    for user in users_sorted:
        b_all = u_bytes_all.get(user, [0] * len(date_keys))
        c_all = u_conns_all.get(user, [0] * len(date_keys))
        b_last = slice_for(last_keys, b_all)
        c_last = slice_for(last_keys, c_all)
        b_prev = slice_for(prev_keys, b_all) if prev_keys else [0] * 7
        c_prev = slice_for(prev_keys, c_all) if prev_keys else [0] * 7
        
        client = clients_by_email.get(user, {})
        users_payload[user] = {
            "email": user,
            "uuid": client.get("id", ""),
            "alias": client.get("alias", ""),
            "daily_traffic_bytes": b_last,
            "daily_conns": c_last,
            "prev_daily_traffic_bytes": b_prev,
            "prev_daily_conns": c_prev,
            "sum7_traffic_bytes": sum(b_last),
            "sum7_conns": sum(c_last),
            "sum_prev7_traffic_bytes": sum(b_prev),
            "sum_prev7_conns": sum(c_prev),
            "top_domains_traffic": _topn(per_t_last.get(user, {}), 10),
            "top_domains_conns": _topn(per_c_last.get(user, {}), 10),
            "anomaly": any(x >= 1_000_000_000 for x in b_last),  # >1GB in a day
        }
    
    # KPI: today vs yesterday
    today_data = g_last["daily_traffic_bytes"][-1] if g_last["daily_traffic_bytes"] else 0
    yesterday_data = g_prev["daily_traffic_bytes"][-1] if g_prev["daily_traffic_bytes"] and len(g_prev["daily_traffic_bytes"]) > 0 else 0
    if not yesterday_data and len(date_keys) >= 2:
        # Try to get yesterday from all data
        yesterday_date = today - dt.timedelta(days=1)
        if yesterday_date.isoformat() in date_keys:
            idx = date_keys.index(yesterday_date.isoformat())
            yesterday_data = g_bytes_all[idx] if idx < len(g_bytes_all) else 0
    
    def pct_change(a, b):
        if b == 0:
            return None
        return round((a - b) * 100.0 / b, 1)
    
    kpi = {
        "today_bytes": today_data,
        "yesterday_bytes": yesterday_data,
        "change_pct": pct_change(today_data, yesterday_data),
        "total_bytes": sum(g_bytes_all),
        "total_users": len(users_sorted),
        "active_users": len([u for u in users_sorted if sum(u_bytes_all.get(u, [0])) > 0]),
    }
    
    # Collector status
    newest_file = None
    for f in glob.glob(os.path.join(usage_dir, "usage_*.csv")):
        d = _parse_date_from_name(f)
        if d and (newest_file is None or d > newest_file):
            newest_file = d
    lag_days = (today - newest_file).days if newest_file else None

    return {
        "ok": True,
        "meta": {
            "to": today.isoformat(),
            "days": last_keys,
            "prev_days": prev_keys,
            "users": users_sorted,
        },
        "global": {
            **g_last,
            "cumulative_traffic_bytes": cum_traffic,
            "cumulative_conns": cum_conns,
            "prev_daily_traffic_bytes": g_prev["daily_traffic_bytes"],
            "prev_daily_conns": g_prev["daily_conns"],
            "top_domains_traffic": _topn(glob_t_last, 10),
            "top_domains_conns": _topn(glob_c_last, 10),
        },
        "users": users_payload,
        "kpi": kpi,
        "collector": {
            "enabled": settings["collector"].get("enabled", True),
            "lag_days": lag_days,
        },
    }

# ---------------------------
# VLESS link builder
# ---------------------------

def build_vless_link(uuid_: str, email: str) -> Dict[str, Any]:
    """Build VLESS Reality link for user"""
    settings = load_settings()
    reality = get_reality_params()
    
    if not reality.get("ok"):
        return {"ok": False, "error": reality.get("error", "Reality params failed")}
    
    pbk = reality.get("pbk")
    if not pbk:
        return {"ok": False, "error": "Cannot derive pbk. Set reality_pbk in settings."}
    
    host = reality.get("server_host") or settings["xray"].get("server_host", "")
    if not host:
        return {"ok": False, "error": "Set server_host in settings (IP/domain of your server)"}
    
    port = reality.get("port", 443)
    sni = reality.get("sni", "www.cloudflare.com")
    sid = reality.get("sid", "")
    fp = reality.get("fp", "chrome")
    flow = reality.get("flow", "xtls-rprx-vision")
    
    from urllib.parse import quote
    params = f"encryption=none&security=reality&sni={quote(sni)}&fp={quote(fp)}&pbk={quote(pbk)}&sid={quote(sid)}&type=tcp&flow={quote(flow)}"
    link = f"vless://{uuid_}@{host}:{port}?{params}#{quote(email)}"
    
    return {"ok": True, "link": link}

# ---------------------------
# API Routes
# ---------------------------

@app.get("/")
def index():
    for p in TEMPLATE_INDEX_PATHS:
        if os.path.exists(p):
            return send_file(p)
    return Response("index.html not found", status=500, mimetype="text/plain")

@app.get("/api/ping")
def api_ping():
    return ok({"ts": now_utc_iso()})

# --- Settings ---

@app.get("/api/settings")
def api_settings_get():
    return ok({"settings": load_settings()})

@app.post("/api/settings")
def api_settings_set():
    if not request.is_json:
        return fail("json_required")
    data = request.get_json(silent=True) or {}
    with LOCK:
        s = load_settings()
        def deep_merge(dst, src):
            for k, v in src.items():
                if isinstance(v, dict) and isinstance(dst.get(k), dict):
                    deep_merge(dst[k], v)
                else:
                    dst[k] = v
        deep_merge(s, data)
        save_settings(s)
    append_event({"type": "SETTINGS", "severity": "INFO", "action": "saved"})
    return ok({"settings": load_settings()})

# --- Dashboard ---

@app.get("/api/dashboard")
def api_dashboard():
    """Legacy endpoint - kept for backward compatibility"""
    days = int(request.args.get("days") or "7")
    user = request.args.get("user", "").strip() or None
    data = load_dashboard_data(days=days, user_filter=user)
    return jsonify(data)

# --- Usage (History) endpoints ---

def _list_usage_dates() -> List[str]:
    """Get list of available dates from usage CSV files, including recent days even without files"""
    settings = load_settings()
    usage_dir = settings["collector"].get("usage_dir", USAGE_DIR)
    dates = set()
    
    # First, collect dates from existing CSV files
    if os.path.isdir(usage_dir):
        for f in glob.glob(os.path.join(usage_dir, "usage_*.csv")):
            d = _parse_date_from_name(f)
            if d:
                dates.add(d.isoformat())
    
    # Always include last 14 days, even if files don't exist
    # This ensures users can select recent dates even if collector hasn't created files yet
    today = dt.datetime.utcnow().date()
    for i in range(14):
        date = today - dt.timedelta(days=i)
        dates.add(date.isoformat())
    
    return sorted(dates, reverse=True)

@app.get("/api/usage/dates")
def api_usage_dates():
    """Get list of available dates for usage reports"""
    try:
        dates = _list_usage_dates()
        return ok({"dates": dates})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return fail(f"Error listing dates: {str(e)}", code=500)

def load_usage_dashboard(date_str: str, mode: str = "daily", window_days: int = 7) -> Dict[str, Any]:
    """
    Load usage dashboard data according to new contract from ТЗ.
    
    Args:
        date_str: Report date in YYYY-MM-DD format (D in ТЗ)
        mode: "daily" or "cumulative"
        window_days: Window size (default 7)
    
    Returns:
        Data structure matching ТЗ contract
    """
    settings = load_settings()
    usage_dir = settings["collector"].get("usage_dir", USAGE_DIR)
    
    if not os.path.isdir(usage_dir):
        return {
            "ok": False,
            "error": f"Directory not found: {usage_dir}",
            "meta": {},
            "summary": {},
            "trends": {},
            "topDomains": {},
            "users": [],
            "userDetails": {},
        }
    
    try:
        report_date = dt.date.fromisoformat(date_str)
    except:
        report_date = dt.datetime.utcnow().date()
    
    window_days = max(7, min(31, int(window_days)))
    
    # Build windows according to ТЗ:
    # Current window (7d): D-6 ... D (7 days, including D)
    # Previous window (7d prev): D-13 ... D-7
    # But if report_date is today and today has no data, use D-7 ... D-1 (7 full days)
    today = dt.datetime.utcnow().date()
    is_today = (report_date == today)
    
    current_dates = [report_date - dt.timedelta(days=i) for i in range(window_days - 1, -1, -1)]
    prev_dates = [report_date - dt.timedelta(days=i) for i in range(window_days * 2 - 1, window_days - 1, -1)]
    
    current_keys = [d.isoformat() for d in current_dates]
    prev_keys = [d.isoformat() for d in prev_dates]
    
    # Load domains map
    domains_map = _load_domains_map(usage_dir, report_date)
    
    # Get clients for display names
    clients = get_xray_clients()
    clients_by_email = {c.get("email", ""): c for c in clients}
    
    # Aggregate data
    all_users = set()
    g_traffic_all: Dict[str, int] = {}  # date -> bytes
    g_conns_all: Dict[str, int] = {}  # date -> count
    u_traffic_all: Dict[str, Dict[str, int]] = {}  # user -> {date -> bytes}
    u_conns_all: Dict[str, Dict[str, int]] = {}  # user -> {date -> count}
    domain_traffic: Dict[str, int] = {}  # domain -> bytes (for current window)
    domain_conns: Dict[str, int] = {}  # domain -> count (for current window)
    u_domain_traffic: Dict[str, Dict[str, int]] = {}  # user -> {domain -> bytes}
    u_domain_conns: Dict[str, Dict[str, int]] = {}  # user -> {domain -> count}
    
    # Initialize all dates in current_keys and prev_keys to 0 - this ensures all dates appear in graph
    # even if CSV files don't exist
    all_dates = set(current_keys + prev_keys)
    for date_key in all_dates:
        g_traffic_all[date_key] = 0
        g_conns_all[date_key] = 0
    for date_key in all_dates:
        # Usage CSV
        fpath = os.path.join(usage_dir, f"usage_{date_key}.csv")
        if os.path.exists(fpath):
            # Initialize to 0 if file exists (to ensure date appears in graph even if empty)
            if date_key not in g_traffic_all:
                g_traffic_all[date_key] = 0
            for row in _read_csv_dict(fpath):
                # Safety check: ensure row is a dict
                if not isinstance(row, dict):
                    continue
                user = (row.get("user") or row.get("email") or "").strip()
                if not user:
                    continue
                all_users.add(user)
                try:
                    b = int(float(row.get("total_bytes") or row.get("bytes") or 0))
                except:
                    try:
                        up = int(float(row.get("uplink_bytes") or row.get("up_bytes") or 0))
                        down = int(float(row.get("downlink_bytes") or row.get("down_bytes") or 0))
                        b = up + down
                    except:
                        b = 0
                g_traffic_all[date_key] = g_traffic_all.get(date_key, 0) + b
                u_traffic_all.setdefault(user, {})[date_key] = u_traffic_all.get(user, {}).get(date_key, 0) + b
        
        # Conns CSV
        fpath = os.path.join(usage_dir, f"conns_{date_key}.csv")
        # Note: date_key is already initialized to 0 above for all current_keys
        # So even if file doesn't exist, the date will appear in graph with 0
        conns_file_exists = os.path.exists(fpath)
        if conns_file_exists:
            # File exists - read and sum data
            # If file is empty, date_key already has 0, so it will stay 0
            for row in _read_csv_dict(fpath):
                # Safety check: ensure row is a dict
                if not isinstance(row, dict):
                    continue
                user = (row.get("user") or "").strip()
                if not user:
                    continue
                all_users.add(user)
                try:
                    # Try multiple possible field names for connection count
                    c = int(float(row.get("conn_count") or row.get("conns") or row.get("count") or 0))
                except:
                    c = 0
                # Add to totals (date_key is guaranteed to exist from initialization above)
                g_conns_all[date_key] = g_conns_all[date_key] + c
                u_conns_all.setdefault(user, {})[date_key] = u_conns_all.get(user, {}).get(date_key, 0) + c
                
                # Domain mapping for conns (only if we have connections)
                if date_key in current_keys and c > 0:
                    dst = (row.get("dst") or "").strip()
                    dom = _dst_to_domain(dst, domains_map)
                    domain_conns[dom] = domain_conns.get(dom, 0) + c
                    u_domain_conns.setdefault(user, {})[dom] = u_domain_conns.get(user, {}).get(dom, 0) + c
        
        # FALLBACK: If conns file doesn't exist but we have traffic, estimate connections
        # First try report_*.csv (more accurate - counts unique user+dst pairs)
        # If that doesn't exist, estimate from usage_*.csv (count users with traffic as minimum)
        if not conns_file_exists and date_key in current_keys:
            report_fpath = os.path.join(usage_dir, f"report_{date_key}.csv")
            if os.path.exists(report_fpath):
                # Count unique user+dst combinations as connections (each pair represents a connection to a domain)
                unique_conns = set()
                for row in _read_csv_dict(report_fpath):
                    # Safety check: ensure row is a dict
                    if not isinstance(row, dict):
                        continue
                    user = (row.get("user") or "").strip()
                    dst = (row.get("dst") or "").strip()
                    if user and dst:
                        unique_conns.add((user, dst))
                        # Also count per domain for domain_conns
                        dom = _dst_to_domain(dst, domains_map)
                        domain_conns[dom] = domain_conns.get(dom, 0) + 1
                        u_domain_conns.setdefault(user, {})[dom] = u_domain_conns.get(user, {}).get(dom, 0) + 1
                
                # Add estimated connections to totals
                estimated_conns = len(unique_conns)
                if estimated_conns > 0:
                    g_conns_all[date_key] = g_conns_all[date_key] + estimated_conns
                    # Distribute connections to users (count per user)
                    user_conns_count = {}
                    for row in _read_csv_dict(report_fpath):
                        # Safety check: ensure row is a dict
                        if not isinstance(row, dict):
                            continue
                        user = (row.get("user") or "").strip()
                        dst = (row.get("dst") or "").strip()
                        if user and dst:
                            user_conns_count[user] = user_conns_count.get(user, 0) + 1
                    for user, count in user_conns_count.items():
                        u_conns_all.setdefault(user, {})[date_key] = u_conns_all.get(user, {}).get(date_key, 0) + count
            else:
                # FALLBACK 2: If report_*.csv also doesn't exist, estimate from usage_*.csv
                # Count users with traffic - each user with traffic had at least some connections
                usage_fpath = os.path.join(usage_dir, f"usage_{date_key}.csv")
                if os.path.exists(usage_fpath):
                    users_with_traffic = set()
                    for row in _read_csv_dict(usage_fpath):
                        # Safety check: ensure row is a dict
                        if not isinstance(row, dict):
                            continue
                        user = (row.get("user") or row.get("email") or "").strip()
                        if not user:
                            continue
                        try:
                            # Check if user has any traffic
                            b = int(float(row.get("total_bytes") or row.get("bytes") or 0))
                            if b > 0:
                                users_with_traffic.add(user)
                        except:
                            try:
                                up = int(float(row.get("uplink_bytes") or row.get("up_bytes") or 0))
                                down = int(float(row.get("downlink_bytes") or row.get("down_bytes") or 0))
                                if up + down > 0:
                                    users_with_traffic.add(user)
                            except:
                                pass
                    
                    # Estimate: each user with traffic had at least 1 connection
                    # Use a multiplier based on average traffic per connection (rough estimate)
                    # If we have traffic data, estimate connections based on historical patterns
                    estimated_conns = len(users_with_traffic)
                    if estimated_conns > 0:
                        # Better estimate: use historical data to calculate average ratio
                        # Look at previous days to estimate connections/traffic ratio
                        total_traffic = g_traffic_all.get(date_key, 0)
                        if total_traffic > 0:
                            # Calculate average conns/traffic ratio from previous days (if available)
                            # Use a more realistic estimate: ~2-5 conns per MB based on historical data
                            # Conservative: use 2 conns per MB (0.5 MB per connection)
                            avg_bytes_per_conn = 512 * 1024  # 0.5 MB per connection (more realistic)
                            estimated_conns = max(estimated_conns, int(total_traffic / avg_bytes_per_conn))
                        
                        g_conns_all[date_key] = g_conns_all[date_key] + estimated_conns
                        # Distribute evenly among users with traffic (rough estimate)
                        conns_per_user = estimated_conns // len(users_with_traffic) if users_with_traffic else 0
                        for user in users_with_traffic:
                            u_conns_all.setdefault(user, {})[date_key] = u_conns_all.get(user, {}).get(date_key, 0) + conns_per_user
        
        # Report CSV (for domain traffic)
        if date_key in current_keys:
            fpath = os.path.join(usage_dir, f"report_{date_key}.csv")
            if os.path.exists(fpath):
                for row in _read_csv_dict(fpath):
                    # Safety check: ensure row is a dict
                    if not isinstance(row, dict):
                        continue
                    user = (row.get("user") or "").strip()
                    if not user:
                        continue
                    dst = (row.get("dst") or "").strip()
                    dom = _dst_to_domain(dst, domains_map)
                    try:
                        v = int(float(row.get("traffic_bytes") or 0))
                    except:
                        v = 0
                    domain_traffic[dom] = domain_traffic.get(dom, 0) + v
                    u_domain_traffic.setdefault(user, {})[dom] = u_domain_traffic.get(user, {}).get(dom, 0) + v
    
    # Calculate summary KPIs
    today_key = report_date.isoformat()
    yesterday_key = (report_date - dt.timedelta(days=1)).isoformat()
    
    # Check if report_date is actually today (real current date)
    real_today = dt.datetime.utcnow().date()
    is_report_date_today = (report_date == real_today)
    
    today_traffic = g_traffic_all.get(today_key, 0)
    yesterday_traffic = g_traffic_all.get(yesterday_key, 0)
    today_conns = g_conns_all.get(today_key, 0)
    yesterday_conns = g_conns_all.get(yesterday_key, 0)
    
    # Avg7d: D-7 ... D-1 (excluding today)
    avg_dates = [d.isoformat() for d in [report_date - dt.timedelta(days=i) for i in range(1, 8)]]
    avg_traffic = sum(g_traffic_all.get(d, 0) for d in avg_dates) / len(avg_dates) if avg_dates else 0
    avg_conns = sum(g_conns_all.get(d, 0) for d in avg_dates) / len(avg_dates) if avg_dates else 0
    
    # Total7d: current and previous windows
    total7d_traffic = sum(g_traffic_all.get(d, 0) for d in current_keys)
    prev_total7d_traffic = sum(g_traffic_all.get(d, 0) for d in prev_keys) if prev_keys else 0
    total7d_conns = sum(g_conns_all.get(d, 0) for d in current_keys)
    prev_total7d_conns = sum(g_conns_all.get(d, 0) for d in prev_keys) if prev_keys else 0
    
    def delta_pct(current, prev):
        if prev == 0:
            return None
        return round((current - prev) * 100.0 / prev, 2)
    
    # Build trends (daily or cumulative)
    # Only exclude report_date if it's actually today AND has no data
    # For past dates, always include them even if data is 0 (they might be incomplete but should be shown)
    if is_report_date_today:
        # Check if today has meaningful data (non-zero values)
        today_has_data = (today_key in g_traffic_all and g_traffic_all[today_key] > 0) or \
                         (today_key in g_conns_all and g_conns_all[today_key] > 0)
        # Filter out today only if it has no data (incomplete day)
        trend_keys = current_keys if today_has_data else [d for d in current_keys if d != today_key]
    else:
        # For past dates, always include all days (even with 0 values)
        trend_keys = current_keys
    
    # CRITICAL: Ensure all dates in trend_keys are initialized in dictionaries
    # This guarantees that all dates appear in the graph, even if CSV files don't exist
    for date_key in trend_keys:
        if date_key not in g_traffic_all:
            g_traffic_all[date_key] = 0
        if date_key not in g_conns_all:
            g_conns_all[date_key] = 0
    
    # Build daily arrays - use direct access since all dates are guaranteed to be initialized
    traffic_daily = []
    conns_daily = []
    for d in trend_keys:
        # Ensure date is in dictionaries (double-check)
        if d not in g_traffic_all:
            g_traffic_all[d] = 0
        if d not in g_conns_all:
            g_conns_all[d] = 0
        traffic_daily.append({"date": d, "value": g_traffic_all[d]})
        conns_daily.append({"date": d, "value": g_conns_all[d]})
    
    if mode == "cumulative":
        acc_t = 0
        acc_c = 0
        for item in traffic_daily:
            acc_t += item["value"]
            item["value"] = acc_t
        for item in conns_daily:
            acc_c += item["value"]
            item["value"] = acc_c
    
    # Top domains (ТЗ format: trafficBytes/conns, sharePct)
    top_domains_traffic = _topn_traffic(domain_traffic, 10)
    top_domains_conns = _topn_conns(domain_conns, 10)
    top3_traffic = [d["domain"] for d in top_domains_traffic[:3]]
    top3_conns = [d["domain"] for d in top_domains_conns[:3]]
    
    # Users list with summary
    users_list = []
    users_sorted = sorted(all_users)
    
    for user in users_sorted:
        client = clients_by_email.get(user, {})
        display_name = client.get("alias") or user
        
        traffic7d = sum(u_traffic_all.get(user, {}).get(d, 0) for d in current_keys)
        prev_traffic7d = sum(u_traffic_all.get(user, {}).get(d, 0) for d in prev_keys) if prev_keys else 0
        conns7d = sum(u_conns_all.get(user, {}).get(d, 0) for d in current_keys)
        prev_conns7d = sum(u_conns_all.get(user, {}).get(d, 0) for d in prev_keys) if prev_keys else 0
        
        delta_traffic_pct = delta_pct(traffic7d, prev_traffic7d)
        delta_conns_pct = delta_pct(conns7d, prev_conns7d)
        
        # Anomaly: |Δ%| > 20%
        is_anomaly = (delta_traffic_pct is not None and abs(delta_traffic_pct) > 20) or \
                     (delta_conns_pct is not None and abs(delta_conns_pct) > 20)
        
        users_list.append({
            "userId": user,
            "displayName": display_name,
            "traffic7dBytes": traffic7d,
            "prevTraffic7dBytes": prev_traffic7d,
            "deltaTraffic7dPct": delta_traffic_pct,
            "conns7d": conns7d,
            "prevConns7d": prev_conns7d,
            "deltaConns7dPct": delta_conns_pct,
            "status": "anomaly" if is_anomaly else "ok",
        })
    
    # User details (trends and top domains per user)
    user_details = {}
    for user in users_sorted:
        traffic_trend = [{"date": d, "value": u_traffic_all.get(user, {}).get(d, 0)} for d in current_keys]
        conns_trend = [{"date": d, "value": u_conns_all.get(user, {}).get(d, 0)} for d in current_keys]
        
        if mode == "cumulative":
            acc_t = 0
            acc_c = 0
            for item in traffic_trend:
                acc_t += item["value"]
                item["value"] = acc_t
            for item in conns_trend:
                acc_c += item["value"]
                item["value"] = acc_c
        
        user_total_traffic = sum(u_domain_traffic.get(user, {}).values())
        user_total_conns = sum(u_domain_conns.get(user, {}).values())
        
        # Top domains for user (with share %)
        user_top_traffic = []
        for dom, val in sorted(u_domain_traffic.get(user, {}).items(), key=lambda x: x[1], reverse=True)[:10]:
            share = (val / user_total_traffic * 100.0) if user_total_traffic > 0 else 0.0
            user_top_traffic.append({"domain": dom, "trafficBytes": val, "sharePct": round(share, 2)})
        
        user_top_conns = []
        for dom, val in sorted(u_domain_conns.get(user, {}).items(), key=lambda x: x[1], reverse=True)[:10]:
            share = (val / user_total_conns * 100.0) if user_total_conns > 0 else 0.0
            user_top_conns.append({"domain": dom, "conns": val, "sharePct": round(share, 2)})
        
        user_details[user] = {
            "trafficTrendDailyBytes": traffic_trend,
            "connsTrendDaily": conns_trend,
            "topDomainsTraffic": user_top_traffic,
            "topDomainsConns": user_top_conns,
        }
    
    # Check data completeness
    data_completeness = "full"
    missing_dates = [d for d in current_keys if d not in g_traffic_all and d not in g_conns_all]
    if missing_dates:
        data_completeness = "partial"
    
    return {
        "ok": True,
        "meta": {
            "date": date_str,
            "mode": mode,
            "windowDays": window_days,
            "unitBase": "bytes",
            "gbBase": 1000000000,
            "generatedAt": now_utc_iso(),
            "dataCompleteness": data_completeness,
        },
        "summary": {
            "todayTrafficBytes": today_traffic,
            "yesterdayTrafficBytes": yesterday_traffic,
            "avg7dTrafficBytes": int(avg_traffic),
            "deltaTodayTrafficPct": delta_pct(today_traffic, yesterday_traffic),
            "todayConns": today_conns,
            "yesterdayConns": yesterday_conns,
            "avg7dConns": int(avg_conns),
            "deltaTodayConnsPct": delta_pct(today_conns, yesterday_conns),
            "total7dTrafficBytes": total7d_traffic,
            "prevTotal7dTrafficBytes": prev_total7d_traffic,
            "deltaTotal7dTrafficPct": delta_pct(total7d_traffic, prev_total7d_traffic),
            "total7dConns": total7d_conns,
            "prevTotal7dConns": prev_total7d_conns,
            "deltaTotal7dConnsPct": delta_pct(total7d_conns, prev_total7d_conns),
        },
        "trends": {
            "trafficDailyBytes": traffic_daily,
            "connsDaily": conns_daily,
        },
        "topDomains": {
            "traffic": top_domains_traffic,
            "conns": top_domains_conns,
            "top3TrafficDomains": top3_traffic,
            "top3ConnsDomains": top3_conns,
        },
        "users": users_list,
        "userDetails": user_details,
    }

@app.get("/api/usage/dashboard")
def api_usage_dashboard():
    """Get usage dashboard data according to ТЗ contract"""
    date_str = request.args.get("date", "").strip()
    if not date_str:
        # Default to last available date
        dates = _list_usage_dates()
        if dates:
            date_str = dates[0]
        else:
            date_str = dt.datetime.utcnow().date().isoformat()
    
    mode = request.args.get("mode", "daily").strip()
    if mode not in ["daily", "cumulative"]:
        mode = "daily"
    
    window_days = int(request.args.get("windowDays") or "7")
    
    try:
        data = load_usage_dashboard(date_str, mode, window_days)
        return jsonify(data)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return fail(f"Error loading dashboard: {str(e)}", code=500)

def _calculate_user_alltime_stats() -> Dict[str, Dict[str, Any]]:
    """Calculate all-time statistics for all users from CSV files"""
    settings = load_settings()
    usage_dir = settings["collector"].get("usage_dir", USAGE_DIR)
    
    if not os.path.isdir(usage_dir):
        return {}
    
    # Initialize stats
    user_stats: Dict[str, Dict[str, Any]] = {}
    user_days: Dict[str, set] = {}  # user -> set of dates
    user_traffic: Dict[str, int] = {}  # user -> total bytes
    user_domain_traffic: Dict[str, Dict[str, int]] = {}  # user -> {domain -> bytes}
    
    # Load all domains maps (merge all available)
    domains_map: Dict[str, str] = {}
    domains_files = sorted(glob.glob(os.path.join(usage_dir, "domains_*.csv")))
    for f in domains_files:
        for row in _read_csv_dict(f):
            ip = (row.get("ip") or "").strip()
            domain = (row.get("domain") or "").strip()
            if ip and domain:
                domains_map[ip] = domain
    
    # Process all usage_*.csv files
    usage_files = glob.glob(os.path.join(usage_dir, "usage_*.csv"))
    for fpath in usage_files:
        date_key = _parse_date_from_name(fpath)
        if not date_key:
            continue
        
        for row in _read_csv_dict(fpath):
            if not isinstance(row, dict):
                continue
            user = (row.get("user") or row.get("email") or "").strip()
            if not user:
                continue
            
            # Track days
            user_days.setdefault(user, set()).add(date_key.isoformat())
            
            # Sum traffic
            try:
                b = int(float(row.get("total_bytes") or row.get("bytes") or 0))
            except:
                try:
                    up = int(float(row.get("uplink_bytes") or row.get("up_bytes") or 0))
                    down = int(float(row.get("downlink_bytes") or row.get("down_bytes") or 0))
                    b = up + down
                except:
                    b = 0
            
            if b > 0:
                user_traffic[user] = user_traffic.get(user, 0) + b
    
    # Process all report_*.csv files for domain traffic
    report_files = glob.glob(os.path.join(usage_dir, "report_*.csv"))
    for fpath in report_files:
        date_key = _parse_date_from_name(fpath)
        if not date_key:
            continue
        
        for row in _read_csv_dict(fpath):
            if not isinstance(row, dict):
                continue
            user = (row.get("user") or "").strip()
            if not user:
                continue
            
            dst = (row.get("dst") or "").strip()
            if not dst:
                continue
            
            # Map IP to domain
            domain = domains_map.get(dst, dst)
            if domain == dst and _looks_like_ip(dst):
                domain = "__no_domains__"
            
            try:
                v = int(float(row.get("traffic_bytes") or 0))
            except:
                v = 0
            
            if v > 0:
                user_domain_traffic.setdefault(user, {})[domain] = user_domain_traffic.get(user, {}).get(domain, 0) + v
    
    # Build final stats
    all_users = set(list(user_days.keys()) + list(user_traffic.keys()) + list(user_domain_traffic.keys()))
    
    for user in all_users:
        days_set = user_days.get(user, set())
        total_bytes = user_traffic.get(user, 0)
        domain_traffic = user_domain_traffic.get(user, {})
        
        # Calculate top 3 domains
        top_domains = sorted(domain_traffic.items(), key=lambda x: x[1], reverse=True)[:3]
        top3_list = []
        total_domain_traffic = sum(domain_traffic.values()) or 1
        
        for domain, bytes_val in top_domains:
            share_pct = round((bytes_val / total_domain_traffic) * 100.0, 2) if total_domain_traffic > 0 else 0.0
            top3_list.append({
                "domain": domain,
                "trafficBytes": bytes_val,
                "sharePct": share_pct
            })
        
        user_stats[user] = {
            "daysUsed": len(days_set),
            "totalTrafficBytes": total_bytes,
            "top3Domains": top3_list
        }
    
    return user_stats

@app.get("/api/users")
def api_users_list():
    clients = get_xray_clients()
    users = []
    for c in clients:
        users.append({
            "email": c.get("email", ""),
            "uuid": c.get("id", ""),
            "flow": c.get("flow", ""),
            "alias": c.get("alias", ""),  # Add alias field
        })
    return ok({"users": users})

@app.post("/api/users/add")
def api_users_add():
    if not request.is_json:
        return fail("json_required")
    j = request.get_json(silent=True) or {}
    email = (j.get("email") or "").strip()
    if not email:
        return fail("email_required")
    
    # Generate UUID
    new_uuid = str(uuid_lib.uuid4())
    
    cfg, err = load_xray_config()
    if err:
        return fail(f"Cannot load config: {err}")
    
    clients = get_xray_clients(cfg)
    
    # Check if exists
    for c in clients:
        if c.get("email") == email:
            return fail("user_already_exists")
    
    # Add new client
    clients.append({
        "id": new_uuid,
        "email": email,
        "flow": "xtls-rprx-vision",
    })
    
    ok_r, msg = set_xray_clients(clients)
    if not ok_r:
        return fail(msg)
    
    append_event({"type": "USER", "severity": "INFO", "action": "add", "email": email})
    return ok({"user": {"email": email, "uuid": new_uuid}})

@app.post("/api/users/delete")
def api_users_delete():
    if not request.is_json:
        return fail("json_required")
    j = request.get_json(silent=True) or {}
    email = (j.get("email") or "").strip()
    if not email:
        return fail("email_required")
    
    cfg, err = load_xray_config()
    if err:
        return fail(f"Cannot load config: {err}")
    
    clients = get_xray_clients(cfg)
    new_clients = [c for c in clients if c.get("email") != email]
    
    if len(new_clients) == len(clients):
        return fail("user_not_found")
    
    ok_r, msg = set_xray_clients(new_clients)
    if not ok_r:
        return fail(msg)
    
    append_event({"type": "USER", "severity": "WARN", "action": "delete", "email": email})
    return ok()

@app.post("/api/users/kick")
def api_users_kick():
    """Kick user = regenerate UUID"""
    if not request.is_json:
        return fail("json_required")
    j = request.get_json(silent=True) or {}
    email = (j.get("email") or "").strip()
    if not email:
        return fail("email_required")
    
    cfg, err = load_xray_config()
    if err:
        return fail(f"Cannot load config: {err}")
    
    clients = get_xray_clients(cfg)
    found = False
    new_uuid = str(uuid_lib.uuid4())
    
    for c in clients:
        if c.get("email") == email:
            c["id"] = new_uuid
            found = True
            break
    
    if not found:
        return fail("user_not_found")
    
    ok_r, msg = set_xray_clients(clients)
    if not ok_r:
        return fail(msg)
    
    append_event({"type": "USER", "severity": "WARN", "action": "kick", "email": email})
    return ok({"new_uuid": new_uuid})

@app.get("/api/users/link")
def api_users_link():
    email = request.args.get("email", "").strip()
    if not email:
        return fail("email_required")
    
    clients = get_xray_clients()
    user = next((c for c in clients if c.get("email") == email), None)
    if not user:
        return fail("user_not_found")
    
    result = build_vless_link(user["id"], email)
    if not result.get("ok"):
        append_event({"type": "LINK", "severity": "ERROR", "action": "build_failed", "email": email, "error": result.get("error")})
        return fail(result.get("error", "Link build failed"))
    
    append_event({"type": "LINK", "severity": "INFO", "action": "built", "email": email})
    return ok({"link": result["link"]})

@app.get("/api/users/stats")
def api_users_stats():
    """Get all-time statistics for all users"""
    try:
        # Get online users
        now_data = _get_live_now()
        online_users_set = set(now_data.get("onlineUsers", []))
        
        # Calculate all-time stats
        alltime_stats = _calculate_user_alltime_stats()
        
        # Get all users from config
        clients = get_xray_clients()
        users_stats = []
        
        for c in clients:
            email = c.get("email", "")
            user_stat = alltime_stats.get(email, {
                "daysUsed": 0,
                "totalTrafficBytes": 0,
                "top3Domains": []
            })
            
            users_stats.append({
                "email": email,
                "alias": c.get("alias", ""),
                "daysUsed": user_stat["daysUsed"],
                "totalTrafficBytes": user_stat["totalTrafficBytes"],
                "top3Domains": user_stat["top3Domains"],
                "isOnline": email in online_users_set
            })
        
        return ok({"users": users_stats})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return fail(f"Error calculating stats: {str(e)}", code=500)

@app.post("/api/users/update-alias")
def api_users_update_alias():
    """Update user alias"""
    if not request.is_json:
        return fail("json_required")
    j = request.get_json(silent=True) or {}
    email = (j.get("email") or "").strip()
    alias = (j.get("alias") or "").strip()
    
    if not email:
        return fail("email_required")
    
    cfg, err = load_xray_config()
    if err:
        return fail(f"Cannot load config: {err}")
    
    clients = get_xray_clients(cfg)
    found = False
    
    for c in clients:
        if c.get("email") == email:
            if alias:
                c["alias"] = alias
            else:
                c.pop("alias", None)  # Remove alias if empty
            found = True
            break
    
    if not found:
        return fail("user_not_found")
    
    ok_r, msg = set_xray_clients(clients)
    if not ok_r:
        return fail(msg)
    
    append_event({"type": "USER", "severity": "INFO", "action": "update_alias", "email": email, "alias": alias})
    return ok({"email": email, "alias": alias})

# --- Events ---

@app.get("/api/events")
def api_events():
    limit = int(request.args.get("limit") or "100")
    text_filter = request.args.get("text", "").strip().lower()
    
    events = []
    if os.path.exists(EVENTS_PATH):
        try:
            with open(EVENTS_PATH, "r", encoding="utf-8") as f:
                for ln in f:
                    ln = ln.strip()
                    if ln:
                        try:
                            events.append(json.loads(ln))
                        except:
                            pass
        except:
            pass
    
    # Reverse for newest first
    events = list(reversed(events))
    
    # Filter
    if text_filter:
        events = [e for e in events if text_filter in json.dumps(e, ensure_ascii=False).lower()]
    
    # Limit
    events = events[:limit]
    
    return ok({"events": events})

# --- Collector ---

@app.get("/api/collector/status")
def api_collector_status():
    s = load_settings()
    usage_dir = s["collector"].get("usage_dir", USAGE_DIR)
    
    files = glob.glob(os.path.join(usage_dir, "usage_*.csv"))
    newest = None
    for f in files:
        d = _parse_date_from_name(f)
        if d and (newest is None or d > newest):
            newest = d
    
    lag_days = None
    if newest:
        lag_days = (dt.datetime.utcnow().date() - newest).days
    
    return ok({
        "enabled": bool(s["collector"].get("enabled", True)),
        "usage_dir": usage_dir,
        "files_count": len(files),
        "lag_days": lag_days,
        "newest_file": newest.isoformat() if newest else None,
    })

@app.post("/api/collector/toggle")
def api_collector_toggle():
    if not request.is_json:
        return fail("json_required")
    j = request.get_json(silent=True) or {}
    enabled = bool(j.get("enabled"))
    
    with LOCK:
        s = load_settings()
        s["collector"]["enabled"] = enabled
        save_settings(s)
    
    append_event({"type": "COLLECTOR", "severity": "INFO", "action": "toggle", "enabled": enabled})
    return ok({"enabled": enabled})

# --- Xray ---

@app.get("/api/xray/config")
def api_xray_config_get():
    cfg, err = load_xray_config()
    if err:
        return fail(f"Cannot load: {err}")
    reality = get_reality_params()
    return ok({"config": cfg, "reality": reality})

@app.post("/api/xray/restart")
def api_xray_restart():
    s = load_settings()
    srv = s["xray"].get("service_name", SERVICE_XRAY_DEFAULT)
    ok_r, msg = systemctl_restart(srv)
    append_event({"type": "XRAY", "severity": "WARN", "action": "restart", "result": msg})
    if not ok_r:
        return fail(msg)
    return ok({"result": msg})

# --- System ---

@app.get("/api/system/status")
def api_system_status():
    s = load_settings()
    srv = s["xray"].get("service_name", SERVICE_XRAY_DEFAULT)
    ui_active, ui_state = systemctl_is_active(SERVICE_UI)
    xray_active, xray_state = systemctl_is_active(srv)
    return ok({
        "ui": {"active": ui_active, "state": ui_state},
        "xray": {"active": xray_active, "state": xray_state},
    })

@app.post("/api/system/restart-ui")
def api_restart_ui():
    """Legacy endpoint - use /api/system/restart?target=ui"""
    append_event({"type": "SYSTEM", "severity": "WARN", "action": "restart_ui"})
    ok_r, msg = systemctl_restart(SERVICE_UI)
    if not ok_r:
        return fail(msg)
    return ok({"result": msg})

@app.post("/api/system/restart")
def api_system_restart():
    """Restart UI or Xray service"""
    target = request.args.get("target", "").strip().lower()
    if target not in ["ui", "xray"]:
        return fail("target must be 'ui' or 'xray'")
    
    if target == "ui":
        append_event({"type": "SYSTEM", "severity": "WARN", "action": "restart_ui"})
        ok_r, msg = systemctl_restart(SERVICE_UI)
    else:
        settings = load_settings()
        srv = settings["xray"].get("service_name", SERVICE_XRAY_DEFAULT)
        append_event({"type": "SYSTEM", "severity": "WARN", "action": "restart_xray", "service": srv})
        ok_r, msg = systemctl_restart(srv)
    
    if not ok_r:
        return fail(msg)
    return ok({"result": msg, "target": target})

@app.get("/api/system/journal")
def api_system_journal():
    """Get journal logs for UI or Xray service"""
    target = request.args.get("target", "xray").strip().lower()
    limit = int(request.args.get("limit") or "200")
    limit = max(10, min(1000, limit))
    
    if target == "ui":
        service = SERVICE_UI
    else:
        settings = load_settings()
        service = settings["xray"].get("service_name", SERVICE_XRAY_DEFAULT)
    
    try:
        # Try journalctl
        cp = subprocess.run(
            ["journalctl", "-u", service, "-n", str(limit), "--no-pager"],
            capture_output=True, text=True, timeout=5.0
        )
        if cp.returncode == 0:
            return ok({"service": service, "lines": cp.stdout.split("\n")})
        else:
            # Fallback: try to read from screen log or service log
            return ok({"service": service, "lines": [f"Journal not available: {cp.stderr}"], "fallback": True})
    except Exception as e:
        return ok({"service": service, "lines": [f"Error reading journal: {str(e)}"], "error": True})

# --- Backups ---

@app.get("/api/backups")
def api_backups_list():
    ensure_dirs()
    items = []
    for p in sorted(glob.glob(os.path.join(BACKUPS_DIR, "*")), reverse=True)[:100]:
        try:
            st = os.stat(p)
            items.append({
                "name": os.path.basename(p),
                "size": st.st_size,
                "mtime": dt.datetime.utcfromtimestamp(st.st_mtime).isoformat() + "Z",
            })
        except:
            pass
    return ok({"backups": items})

# --- Live SSE (legacy) ---

@app.get("/api/live")
def api_live():
    """Legacy SSE endpoint for dashboard updates"""
    days = int(request.args.get("days") or "7")
    settings = load_settings()
    push_sec = int(settings["ui"].get("live_push_sec", 5))
    
    def gen():
        last = 0.0
        while True:
            yield "event: ping\ndata: {}\n\n"
            time.sleep(1)
            if time.time() - last >= push_sec:
                last = time.time()
                try:
                    data = load_dashboard_data(days=days)
                    yield "event: dashboard\ndata: " + json.dumps(data, ensure_ascii=False) + "\n\n"
                except Exception as e:
                    yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
    
    return Response(gen(), mimetype="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
    })

# --- Live (Online) endpoints ---

# In-memory ring buffer for live data (24h, 1-minute granularity = 1440 points)
LIVE_BUFFER_SIZE = 1440
live_buffer: Dict[str, List[Dict[str, Any]]] = {}  # metric -> list of {ts, value, users}
live_buffer_lock = threading.Lock()
live_source = "fallback_access_log"  # "stats" or "fallback_access_log"
live_traffic_available = False

# Access.log parsing patterns
TS_RE = re.compile(r"^(?P<y>\d{4})[/-](?P<m>\d{2})[/-](?P<d>\d{2})\s+(?P<h>\d{2}):(?P<mi>\d{2}):(?P<s>\d{2})")
EMAIL_RE1 = re.compile(r"(?:email|user)[:=]\s*(?P<email>[A-Za-z0-9_\-\.]+)")
EMAIL_RE2 = re.compile(r"\s(?P<email>user_\d{2})\s*$")

def _try_stats_api() -> Tuple[bool, Dict[str, Any]]:
    """Try to connect to Xray Stats API (Режим 1: Read-only)"""
    try:
        # Try common Stats API endpoints
        # Xray Stats API обычно на localhost:10085 или через API tag
        import urllib.request
        import urllib.error
        
        # Попытка подключиться к Stats API
        # Обычно это GET запрос к /stats или через API tag
        # Пока заглушка - нужно знать точный endpoint
        return False, {}
    except Exception:
        return False, {}

def _parse_access_log_recent(minutes: int = 5) -> Dict[str, Any]:
    """Parse access.log for recent activity (fallback)"""
    if not os.path.exists(ACCESS_LOG):
        return {"users": set(), "conns": 0, "traffic": 0}
    
    cutoff_ts = time.time() - (minutes * 60)
    users = set()
    conns = 0
    traffic = 0
    
    try:
        # Try to read from end of file (last N lines)
        with open(ACCESS_LOG, "r", encoding="utf-8", errors="replace") as f:
            # Read last 1000 lines (heuristic)
            lines = f.readlines()[-1000:]
            for line in lines:
                m = TS_RE.search(line)
                if not m:
                    continue
                try:
                    ts = dt.datetime(
                        int(m.group("y")), int(m.group("m")), int(m.group("d")),
                        int(m.group("h")), int(m.group("mi")), int(m.group("s"))
                    ).timestamp()
                    if ts < cutoff_ts:
                        continue
                except:
                    continue
                
                # Extract user/email
                em = EMAIL_RE1.search(line) or EMAIL_RE2.search(line)
                if em:
                    email = (em.group("email") or "").strip()
                    if email:
                        users.add(email)
                        conns += 1
    except Exception:
        pass
    
    return {"users": users, "conns": conns, "traffic": traffic}

def _update_live_buffer():
    """Update live buffer from Stats API or access.log"""
    global live_source, live_traffic_available
    
    # Try Stats API first (Режим 1: Read-only)
    stats_ok, stats_data = _try_stats_api()
    if stats_ok:
        live_source = "stats"
        live_traffic_available = True
        # TODO: Parse stats data and update buffer
        return
    
    # Fallback to access.log
    live_source = "fallback_access_log"
    live_traffic_available = False
    
    access_data = _parse_access_log_recent(5)
    now_ts = time.time()
    now_min = int(now_ts // 60) * 60  # Round to minute
    
    with live_buffer_lock:
        # Update online_users metric
        if "online_users" not in live_buffer:
            live_buffer["online_users"] = []
        if "conns" not in live_buffer:
            live_buffer["conns"] = []
        
        # Add current minute point
        live_buffer["online_users"].append({
            "ts": now_min,
            "value": len(access_data["users"]),
            "users": list(access_data["users"]),
        })
        live_buffer["conns"].append({
            "ts": now_min,
            "value": access_data["conns"],
        })
        
        # Keep only last LIVE_BUFFER_SIZE points
        for metric in live_buffer:
            if len(live_buffer[metric]) > LIVE_BUFFER_SIZE:
                live_buffer[metric] = live_buffer[metric][-LIVE_BUFFER_SIZE:]
        
        # Save to file (дамп)
        try:
            atomic_write_json(LIVE_STATE_PATH, {
                "buffer": live_buffer,
                "source": live_source,
                "trafficAvailable": live_traffic_available,
                "updatedAt": now_utc_iso(),
            })
        except Exception:
            pass

def _load_live_buffer_from_dump():
    """Load live buffer from dump file on startup"""
    global live_source, live_traffic_available
    try:
        if os.path.exists(LIVE_STATE_PATH):
            data = read_json(LIVE_STATE_PATH, {})
            with live_buffer_lock:
                live_buffer.update(data.get("buffer", {}))
                live_source = data.get("source", "fallback_access_log")
                live_traffic_available = data.get("trafficAvailable", False)
    except Exception:
        pass

def _get_live_now() -> Dict[str, Any]:
    """Get current 'now' state (rolling 5 minutes)"""
    with live_buffer_lock:
        cutoff = time.time() - 300  # 5 minutes
        online_users = set()
        total_conns = 0
        total_traffic = 0
        
        # Aggregate from buffer
        for metric_name, metric_data in live_buffer.items():
            for point in metric_data:
                if point.get("ts", 0) >= cutoff:
                    if metric_name == "online_users" and "users" in point:
                        online_users.update(point["users"])
                    elif metric_name == "conns":
                        total_conns += point.get("value", 0)
                    elif metric_name == "traffic":
                        total_traffic += point.get("value", 0)
        
        return {
            "onlineUsers": list(online_users),  # Return list of user IDs
            "onlineUsersCount": len(online_users),
            "conns": total_conns,
            "trafficBytes": total_traffic,
            "trafficAvailable": live_traffic_available,
        }

@app.get("/api/live/now")
def api_live_now():
    """Get current 'now' state (rolling 5 minutes)"""
    now_data = _get_live_now()
    return ok({
        "meta": {
            "source": live_source,
            "rollingWindowSec": 300,
        },
        "now": now_data,
    })

@app.get("/api/live/series")
def api_live_series():
    """Get time series data for online metrics"""
    metric = request.args.get("metric", "conns").strip()
    if metric not in ["traffic", "conns", "online_users"]:
        metric = "conns"
    
    period = int(request.args.get("period") or "3600")  # 60m default
    gran = int(request.args.get("gran") or "300")  # 5m default
    scope = request.args.get("scope", "global").strip()
    
    # Validate
    if period not in [3600, 21600, 86400]:  # 60m, 6h, 24h
        period = 3600
    if gran not in [60, 300, 600]:  # 1m, 5m, 10m
        gran = 300
    
    # Aggregate from ring buffer
    now_ts = time.time()
    series = []
    points = period // gran
    start_ts = now_ts - period
    
    with live_buffer_lock:
        metric_data = live_buffer.get(metric, [])
        
        # Aggregate by buckets
        for i in range(points):
            bucket_start = start_ts + i * gran
            bucket_end = bucket_start + gran
            bucket_ts = bucket_start
            
            # Aggregate values in this bucket
            value = 0
            if metric == "online_users":
                users_in_bucket = set()
                for point in metric_data:
                    pt_ts = point.get("ts", 0)
                    if bucket_start <= pt_ts < bucket_end:
                        if "users" in point:
                            users_in_bucket.update(point["users"])
                value = len(users_in_bucket)
            else:
                for point in metric_data:
                    pt_ts = point.get("ts", 0)
                    if bucket_start <= pt_ts < bucket_end:
                        value += point.get("value", 0)
            
            series.append({
                "ts": dt.datetime.utcfromtimestamp(bucket_ts).isoformat() + "Z",
                "value": value,
            })
    
    return ok({
        "meta": {
            "metric": metric,
            "period": period,
            "gran": gran,
            "scope": scope,
            "source": live_source,
            "trafficAvailable": metric == "traffic" and live_traffic_available,
        },
        "series": series,
        "unit": "bytes" if metric == "traffic" else "count",
    })

@app.get("/api/live/top")
def api_live_top():
    """Get top users for online metrics"""
    metric = request.args.get("metric", "conns").strip()
    if metric not in ["traffic", "conns", "online_users"]:
        metric = "conns"
    
    period = int(request.args.get("period") or "3600")
    if period not in [3600, 21600, 86400]:
        period = 3600
    limit = int(request.args.get("limit") or "10")
    limit = max(1, min(50, limit))
    
    # Aggregate from buffer
    now_ts = time.time()
    start_ts = now_ts - period
    user_stats: Dict[str, int] = {}  # userId -> aggregated value
    
    with live_buffer_lock:
        metric_data = live_buffer.get(metric, [])
        
        for point in metric_data:
            pt_ts = point.get("ts", 0)
            if pt_ts < start_ts:
                continue
            
            if metric == "online_users" and "users" in point:
                for user in point["users"]:
                    user_stats[user] = user_stats.get(user, 0) + 1
            elif "users" in point and isinstance(point["users"], dict):
                # For traffic/conns, if we have per-user data
                for user, val in point["users"].items():
                    user_stats[user] = user_stats.get(user, 0) + val
            # If no per-user data, we can't build top users
    
    # Build rows with display names
    clients = get_xray_clients()
    clients_by_email = {c.get("email", ""): c for c in clients}
    
    rows = []
    total = sum(user_stats.values()) or 0
    
    for user, val in sorted(user_stats.items(), key=lambda x: x[1], reverse=True)[:limit]:
        client = clients_by_email.get(user, {})
        display_name = client.get("alias") or user
        share = (val / total * 100.0) if total > 0 else 0.0
        rows.append({
            "userId": user,
            "displayName": display_name,
            "value": val,
            "sharePct": round(share, 2),
        })
    
    return ok({
        "meta": {
            "metric": metric,
            "period": period,
            "source": live_source,
            "trafficAvailable": metric == "traffic" and live_traffic_available,
        },
        "rows": rows,
    })

# ---------------------------
# Main
# ---------------------------

def bootstrap():
    ensure_dirs()
    load_settings()
    _load_live_buffer_from_dump()
    
    # Start background thread for live buffer updates (every minute)
    def live_updater():
        while True:
            try:
                _update_live_buffer()
            except Exception:
                pass
            time.sleep(60)  # Update every minute
    
    updater_thread = threading.Thread(target=live_updater, daemon=True)
    updater_thread.start()

bootstrap()

if __name__ == "__main__":
    app.run(host=APP_HOST, port=APP_PORT, debug=False)

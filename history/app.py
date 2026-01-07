from __future__ import annotations

import base64
import csv
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from flask import Flask, jsonify, redirect, request, send_file

# ===================== Paths / Settings =====================

XRAY_CFG = os.environ.get("XRAY_CFG", "/usr/local/etc/xray/config.json")
XRAY_BIN = os.environ.get("XRAY_BIN", "/usr/local/bin/xray")

USAGE_DIR = os.environ.get("XRAY_USAGE_DIR", "/var/log/xray/usage")
ACCESS_LOG = os.environ.get("XRAY_ACCESS_LOG", "/var/log/xray/access.log")

XRAY_UI_INDEX = os.environ.get("XRAY_UI_INDEX", "/opt/xray-report-ui/index.html")
XRAY_REALITY_PBK = os.environ.get("XRAY_REALITY_PBK", "").strip()
XRAY_PUBLIC_HOST = os.environ.get("XRAY_PUBLIC_HOST", "").strip()

# if set, try deriving pbk using xray x25519 from Reality privateKey inside config
XRAY_REALITY_DERIVE_PBK = os.environ.get("XRAY_REALITY_DERIVE_PBK", "1").strip() not in ("0", "false", "False")

# ===================== App =====================

app = Flask(__name__)

# ===================== Helpers =====================

def _read_json(path: str) -> Dict[str, Any]:
    return json.load(open(path, "r", encoding="utf-8"))

def _write_json_atomic(path: str, data: Dict[str, Any]) -> None:
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

def _backup_file(path: str) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = f"{path}.{ts}.bak"
    shutil.copy2(path, dst)
    return dst

def _run_cmd(cmd: List[str]) -> Tuple[int, str, str]:
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    out, err = p.communicate()
    return p.returncode, out.strip(), err.strip()

def _xray_reload() -> Optional[str]:
    # Try common service names
    for svc in ("xray", "xray.service"):
        rc, out, err = _run_cmd(["systemctl", "restart", svc])
        if rc == 0:
            return None
    # fallback to reload
    for svc in ("xray", "xray.service"):
        rc, out, err = _run_cmd(["systemctl", "reload", svc])
        if rc == 0:
            return None
    return "systemctl restart/reload xray failed"

def _find_reality_inbound(cfg: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    inbounds = cfg.get("inbounds", [])
    for ib in inbounds:
        if ib.get("protocol") != "vless":
            continue
        st = ib.get("streamSettings") or {}
        if (st.get("security") or "").lower() != "reality":
            continue
        return ib
    return None

def _get_clients(cfg: Dict[str, Any]) -> List[Dict[str, Any]]:
    ib = _find_reality_inbound(cfg)
    if not ib:
        return []
    settings = ib.get("settings") or {}
    clients = settings.get("clients") or []
    return clients

def _set_clients(cfg: Dict[str, Any], clients: List[Dict[str, Any]]) -> None:
    ib = _find_reality_inbound(cfg)
    if not ib:
        raise RuntimeError("Reality VLESS inbound not found")
    ib.setdefault("settings", {})["clients"] = clients

def _get_reality_params(cfg: Dict[str, Any]) -> Tuple[str, str, str, List[str]]:
    """Return (sni, sid, fp, serverNames list)."""
    ib = _find_reality_inbound(cfg)
    if not ib:
        return ("", "", "", [])
    st = ib.get("streamSettings") or {}
    reality = st.get("realitySettings") or {}
    server_names = reality.get("serverNames") or []
    # take first server name as sni
    sni = server_names[0] if server_names else ""
    # shortId: take first from shortIds
    short_ids = reality.get("shortIds") or []
    sid = short_ids[0] if short_ids else ""
    # fingerprint might be in streamSettings
    fp = (st.get("tlsSettings") or {}).get("fingerprint") or st.get("fingerprint") or "chrome"
    return (sni, sid, fp, server_names)

def _get_reality_private_key(cfg: Dict[str, Any]) -> str:
    ib = _find_reality_inbound(cfg)
    if not ib:
        return ""
    st = ib.get("streamSettings") or {}
    reality = st.get("realitySettings") or {}
    return reality.get("privateKey") or ""

def _derive_pbk_from_private(private_key_b64: str) -> Optional[str]:
    # Try xray binary first:
    if not private_key_b64:
        return None
    if os.path.exists(XRAY_BIN):
        rc, out, err = _run_cmd([XRAY_BIN, "x25519", "-i", private_key_b64])
        if rc == 0:
            # xray prints something like:
            # Private key: ...
            # Public key:  ...
            m = re.search(r"Public key:\s*([A-Za-z0-9_\-]+)", out)
            if m:
                return m.group(1).strip()
            # Sometimes just second line
            lines = out.splitlines()
            for line in lines:
                if "Public key" in line:
                    return line.split(":", 1)[1].strip()
    # Fallback: cryptography
    try:
        from cryptography.hazmat.primitives.asymmetric import x25519
        from cryptography.hazmat.primitives import serialization
        raw = base64.urlsafe_b64decode(private_key_b64 + "==")
        priv = x25519.X25519PrivateKey.from_private_bytes(raw)
        pub = priv.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        return base64.urlsafe_b64encode(pub).decode().rstrip("=")
    except Exception:
        return None

def _get_pbk(cfg: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """Return (pbk, error)."""
    if XRAY_REALITY_PBK:
        return XRAY_REALITY_PBK, None
    if not XRAY_REALITY_DERIVE_PBK:
        return None, "XRAY_REALITY_PBK env not set and derive disabled"
    priv = _get_reality_private_key(cfg)
    pbk = _derive_pbk_from_private(priv)
    if pbk:
        return pbk, None
    return None, "Cannot derive pbk: install 'cryptography' or set XRAY_REALITY_PBK env"

def _get_listen_host_port(cfg: Dict[str, Any]) -> Tuple[str, int]:
    ib = _find_reality_inbound(cfg)
    if not ib:
        return ("", 0)
    host = ib.get("listen") or ""
    port = ib.get("port") or 0
    return host, int(port)

def _make_share_link(cfg: Dict[str, Any], email: str, uid: str) -> Tuple[Optional[str], Optional[str]]:
    pbk, err = _get_pbk(cfg)
    if not pbk:
        return None, err or "pbk missing"
    sni, sid, fp, _ = _get_reality_params(cfg)
    _, port = _get_listen_host_port(cfg)

    host = XRAY_PUBLIC_HOST
    if not host:
        # try infer from listen/port? fallback to empty
        host = ""

    # Compose VLESS Reality link
    # vless://UUID@HOST:PORT?encryption=none&security=reality&sni=...&fp=chrome&pbk=...&sid=...&type=tcp&flow=xtls-rprx-vision#email
    if not host:
        return None, "public_host not set"
    if not port:
        return None, "port not found"

    q = {
        "encryption": "none",
        "security": "reality",
        "sni": sni,
        "fp": fp or "chrome",
        "pbk": pbk,
        "sid": sid,
        "type": "tcp",
        "flow": "xtls-rprx-vision",
    }
    qs = "&".join([f"{k}={_urlenc(str(v))}" for k, v in q.items() if v])
    link = f"vless://{uid}@{host}:{port}?{qs}#{_urlenc(email)}"
    return link, None

def _urlenc(s: str) -> str:
    from urllib.parse import quote
    return quote(s, safe="")

# ===================== Usage files =====================

def _list_days() -> List[str]:
    p = Path(USAGE_DIR)
    if not p.exists():
        return []
    days = set()
    for f in p.glob("usage_*.csv"):
        m = re.match(r"usage_(\d{4}-\d{2}-\d{2})\.csv", f.name)
        if m:
            days.add(m.group(1))
    return sorted(days)

def _read_csv(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))

def _load_day(day: str) -> Dict[str, Any]:
    p = Path(USAGE_DIR)
    usage = _read_csv(p / f"usage_{day}.csv")
    conns = _read_csv(p / f"conns_{day}.csv")
    rep = _read_csv(p / f"report_{day}.csv")
    dom = _read_csv(p / f"domains_{day}.csv")

    return {"day": day, "usage": usage, "conns": conns, "report": rep, "domains": dom}

def _dst_to_domain(dom_map: Dict[str, str], dst: str) -> str:
    # dst could be ip or domain already
    if dst in dom_map:
        return dom_map[dst]
    return dst

def _dom_map_for_day(dom_rows: List[Dict[str, str]]) -> Dict[str, str]:
    # expecting rows: ip,domain
    out: Dict[str, str] = {}
    for r in dom_rows:
        ip = (r.get("ip") or "").strip()
        d = (r.get("domain") or "").strip()
        if ip and d:
            out[ip] = d
    return out

def _build_dashboard(days: List[str]) -> Dict[str, Any]:
    # days = last 14 days typically, split into prev7 and cur7
    data = {d: _load_day(d) for d in days}
    all_users = set()

    # dom map: merged last 2 days (small cache)
    dom_map: Dict[str, str] = {}
    for d in days[-2:]:
        dom_map.update(_dom_map_for_day(data[d]["domains"]))

    # build per-day per-user metrics
    per_user_daily_traffic: Dict[str, List[int]] = {}
    per_user_daily_conns: Dict[str, List[int]] = {}

    for d in days:
        # usage.csv: user,date,uplink_bytes,downlink_bytes,total_bytes
        urows = data[d]["usage"]
        um: Dict[str, int] = {}
        for r in urows:
            user = (r.get("user") or "").strip()
            if not user:
                continue
            all_users.add(user)
            tb = int(float(r.get("total_bytes") or 0))
            um[user] = um.get(user, 0) + tb
        # conns.csv: user,date,dst,conn_count
        crows = data[d]["conns"]
        cm: Dict[str, int] = {}
        for r in crows:
            user = (r.get("user") or "").strip()
            if not user:
                continue
            all_users.add(user)
            cc = int(float(r.get("conn_count") or 0))
            cm[user] = cm.get(user, 0) + cc

        for u in all_users:
            per_user_daily_traffic.setdefault(u, []).append(um.get(u, 0))
            per_user_daily_conns.setdefault(u, []).append(cm.get(u, 0))

    # global daily
    daily_traffic = [0] * len(days)
    daily_conns = [0] * len(days)
    for i, d in enumerate(days):
        daily_traffic[i] = sum(per_user_daily_traffic.get(u, [0]*len(days))[i] for u in all_users)
        daily_conns[i] = sum(per_user_daily_conns.get(u, [0]*len(days))[i] for u in all_users)

    # split prev7/current7 for 14 days input
    cur = days[-7:] if len(days) >= 7 else days
    prev = days[-14:-7] if len(days) >= 14 else []
    # indices
    cur_idx = list(range(len(days)-len(cur), len(days)))
    prev_idx = list(range(len(prev)))

    # sums
    per_user_sum7_traffic: Dict[str, int] = {}
    per_user_sum_prev7_traffic: Dict[str, int] = {}
    per_user_sum7_conns: Dict[str, int] = {}
    per_user_sum_prev7_conns: Dict[str, int] = {}

    for u in all_users:
        t = per_user_daily_traffic.get(u, [0]*len(days))
        c = per_user_daily_conns.get(u, [0]*len(days))
        per_user_sum7_traffic[u] = sum(t[i] for i in cur_idx)
        per_user_sum_prev7_traffic[u] = sum(t[i] for i in prev_idx)
        per_user_sum7_conns[u] = sum(c[i] for i in cur_idx)
        per_user_sum_prev7_conns[u] = sum(c[i] for i in prev_idx)

    # top domains (current 7 days)
    dom_traffic: Dict[str, int] = {}
    dom_conns: Dict[str, int] = {}

    for d in cur:
        # report.csv: user,date,dst,traffic_bytes
        for r in data[d]["report"]:
            dst = (r.get("dst") or "").strip()
            if not dst:
                continue
            dst = _dst_to_domain(dom_map, dst)
            dom_traffic[dst] = dom_traffic.get(dst, 0) + int(float(r.get("traffic_bytes") or 0))

        # conns.csv per dst
        for r in data[d]["conns"]:
            dst = (r.get("dst") or "").strip()
            if not dst:
                continue
            dst = _dst_to_domain(dom_map, dst)
            dom_conns[dst] = dom_conns.get(dst, 0) + int(float(r.get("conn_count") or 0))

    def top10(m: Dict[str, int]) -> List[Dict[str, Any]]:
        items = sorted(m.items(), key=lambda x: x[1], reverse=True)[:10]
        total = sum(m.values()) or 1
        out = []
        for k, v in items:
            out.append({"domain": k, "value": v, "pct": v * 100.0 / total})
        return out

    # anomalies: any day where traffic==0 but conns>0, or vice versa
    anomalies: List[Dict[str, Any]] = []
    for u in all_users:
        t = per_user_daily_traffic.get(u, [])
        c = per_user_daily_conns.get(u, [])
        for i, d in enumerate(days):
            if i >= len(t) or i >= len(c):
                continue
            if (t[i] == 0 and c[i] > 0) or (t[i] > 0 and c[i] == 0):
                anomalies.append({"user": u, "day": d, "traffic_bytes": t[i], "conns": c[i]})

    users_obj: Dict[str, Any] = {}
    for u in sorted(all_users):
        users_obj[u] = {
            "daily_traffic_bytes": per_user_daily_traffic.get(u, [0]*len(days)),
            "daily_conns": per_user_daily_conns.get(u, [0]*len(days)),
            "sum7_traffic_bytes": per_user_sum7_traffic.get(u, 0),
            "sum_prev7_traffic_bytes": per_user_sum_prev7_traffic.get(u, 0),
            "sum7_conns": per_user_sum7_conns.get(u, 0),
            "sum_prev7_conns": per_user_sum_prev7_conns.get(u, 0),
        }

    return {
        "meta": {"days": days, "cur_days": cur, "prev_days": prev, "users": sorted(all_users)},
        "global": {
            "daily_traffic_bytes": daily_traffic,
            "daily_conns": daily_conns,
            "prev_daily_traffic_bytes": daily_traffic[:len(prev)],
            "prev_daily_conns": daily_conns[:len(prev)],
            "top_domains_traffic": top10(dom_traffic),
            "top_domains_conns": top10(dom_conns),
            "anomalies": anomalies,
        },
        "users": users_obj,
    }

# ===================== API =====================

@app.get("/")
def ui():
    return send_file(XRAY_UI_INDEX)

@app.get("/api/days")
def api_days():
    return jsonify({"days": _list_days()})

@app.get("/api/dashboard")
def api_dashboard():
    day = request.args.get("day", "").strip()
    days = _list_days()
    if day and day in days:
        # want last 14 ending with day
        idx = days.index(day)
        start = max(0, idx - 13)
        sel = days[start : idx + 1]
    else:
        sel = days[-14:]
    dash = _build_dashboard(sel)
    return jsonify(dash)

@app.get("/api/admin/clients")
def api_clients():
    cfg = _read_json(XRAY_CFG)
    clients = _get_clients(cfg)
    # include share links status
    out = []
    for c in clients:
        email = c.get("email") or ""
        uid = c.get("id") or ""
        link, err = _make_share_link(cfg, email, uid)
        out.append({"email": email, "id": uid, "link": link, "link_error": err})
    return jsonify({"clients": out})

@app.post("/api/admin/clients")
def api_add_client():
    cfg = _read_json(XRAY_CFG)
    clients = _get_clients(cfg)
    new_id = str(uuid.uuid4())
    email = f"user_{len(clients)+1}"
    clients.append({"id": new_id, "email": email})
    _backup_file(XRAY_CFG)
    _set_clients(cfg, clients)
    _write_json_atomic(XRAY_CFG, cfg)
    err = _xray_reload()
    if err:
        return jsonify({"error": err}), 500
    link, lerr = _make_share_link(cfg, email, new_id)
    return jsonify({"email": email, "id": new_id, "share_link": link, "share_link_error": lerr})

@app.delete("/api/admin/clients/<email>")
def api_del_client(email: str):
    cfg = _read_json(XRAY_CFG)
    clients = _get_clients(cfg)
    before = len(clients)
    clients = [c for c in clients if (c.get("email") or "") != email]
    if len(clients) == before:
        return jsonify({"error": "not found"}), 404
    _backup_file(XRAY_CFG)
    _set_clients(cfg, clients)
    _write_json_atomic(XRAY_CFG, cfg)
    err = _xray_reload()
    if err:
        return jsonify({"error": err}), 500
    return jsonify({"ok": True})

@app.post("/api/admin/reset_uuid/<email>")
def api_reset_uuid(email: str):
    cfg = _read_json(XRAY_CFG)
    clients = _get_clients(cfg)
    found = None
    for c in clients:
        if (c.get("email") or "") == email:
            found = c
            break
    if not found:
        return jsonify({"error": "not found"}), 404
    found["id"] = str(uuid.uuid4())
    _backup_file(XRAY_CFG)
    _set_clients(cfg, clients)
    _write_json_atomic(XRAY_CFG, cfg)
    err = _xray_reload()
    if err:
        return jsonify({"error": err}), 500
    link, lerr = _make_share_link(cfg, email, found["id"])
    return jsonify({"ok": True, "id": found["id"], "share_link": link, "share_link_error": lerr})

@app.post("/api/admin/set_alias/<email>")
def api_set_alias(email: str):
    alias = (request.json or {}).get("alias", "")
    cfg = _read_json(XRAY_CFG)
    clients = _get_clients(cfg)
    found = None
    for c in clients:
        if (c.get("email") or "") == email:
            found = c
            break
    if not found:
        return jsonify({"error": "not found"}), 404
    found["email"] = alias
    _backup_file(XRAY_CFG)
    _set_clients(cfg, clients)
    _write_json_atomic(XRAY_CFG, cfg)
    err = _xray_reload()
    if err:
        return jsonify({"error": err}), 500
    link, lerr = _make_share_link(cfg, alias, found["id"])
    return jsonify({"ok": True, "email": alias, "share_link": link, "share_link_error": lerr})

@app.get("/api/sys/reality")
def api_reality():
    cfg = _read_json(XRAY_CFG)
    pbk, err = _get_pbk(cfg)
    sni, sid, fp, names = _get_reality_params(cfg)
    host, port = _get_listen_host_port(cfg)
    return jsonify({
        "pbk": pbk,
        "pbk_error": err,
        "sni": sni,
        "sid": sid,
        "fp": fp,
        "serverNames": names,
        "listen": host,
        "port": port,
        "public_host": XRAY_PUBLIC_HOST,
        "derive_pbk": XRAY_REALITY_DERIVE_PBK,
    })

@app.post("/api/sys/set_public_host")
def api_set_public_host():
    global XRAY_PUBLIC_HOST
    host = (request.json or {}).get("public_host", "")
    XRAY_PUBLIC_HOST = (host or "").strip()
    return jsonify({"ok": True, "public_host": XRAY_PUBLIC_HOST})

@app.post("/api/sys/set_pbk")
def api_set_pbk():
    global XRAY_REALITY_PBK
    pbk = (request.json or {}).get("pbk", "")
    XRAY_REALITY_PBK = (pbk or "").strip()
    return jsonify({"ok": True, "pbk": XRAY_REALITY_PBK})

@app.post("/api/admin/import_link")
def api_import_link():
    cfg = _read_json(XRAY_CFG)
    link = (request.json or {}).get("link", "")
    if not link:
        return jsonify({"error": "empty link"}), 400

    # parse vless link: vless://UUID@host:port?...#email
    m = re.match(r"^vless://([^@]+)@[^#]+#(.+)$", link)
    if not m:
        return jsonify({"error": "bad link"}), 400
    uid = m.group(1)
    email = _urldec(m.group(2))
    clients = _get_clients(cfg)
    clients.append({"id": uid, "email": email})
    _backup_file(XRAY_CFG)
    _set_clients(cfg, clients)
    _write_json_atomic(XRAY_CFG, cfg)
    err = _xray_reload()
    if err:
        return jsonify({"error": err}), 500
    return jsonify({"ok": True})

def _urldec(s: str) -> str:
    from urllib.parse import unquote
    return unquote(s)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8090)

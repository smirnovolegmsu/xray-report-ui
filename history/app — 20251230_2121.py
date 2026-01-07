from __future__ import annotations

import base64
import csv
import glob
import hashlib
import json
import os
import socket
import subprocess
import time
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from flask import Flask, Response, jsonify, request, send_file

APP_HOST = os.getenv("XRAY_UI_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("XRAY_UI_PORT", "8090"))

DATA_DIR = os.getenv("XRAY_USAGE_DIR", "/var/log/xray/usage")
XRAY_CFG = os.getenv("XRAY_CFG", "/usr/local/etc/xray/config.json")
XRAY_SERVICE_NAME = os.getenv("XRAY_SERVICE_NAME", "xray")

ALIASES_PATH = os.getenv(
    "XRAY_UI_ALIASES",
    str(Path(__file__).resolve().with_name("user_aliases.json")),
)

UI_PATH = os.getenv(
    "XRAY_UI_INDEX",
    str(Path(__file__).resolve().with_name("index.html")),
)

CACHE_TTL_SEC = int(os.getenv("XRAY_UI_CACHE_TTL_SEC", "15"))
ANOMALY_GB_PER_DAY = float(os.getenv("XRAY_UI_ANOMALY_GB_PER_DAY", "1.0"))

ADMIN_TOKEN = os.getenv("XRAY_UI_ADMIN_TOKEN", "").strip()

app = Flask(__name__)


@app.after_request
def _no_cache(resp):
    if request.path == "/" or request.path.endswith(".html"):
        resp.headers["Cache-Control"] = "no-store"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
    return resp


def _safe_int(x: Any, default: int = 0) -> int:
    try:
        if x is None:
            return default
        return int(float(x))
    except Exception:
        return default


def _parse_day(s: str) -> Optional[date]:
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None


def _fmt_day(d: date) -> str:
    return d.strftime("%Y-%m-%d")


def _looks_like_ip(s: str) -> bool:
    parts = s.split(".")
    if len(parts) != 4:
        return False
    for p in parts:
        if not p.isdigit():
            return False
        n = int(p)
        if n < 0 or n > 255:
            return False
    return True


def _read_csv_rows(path: str) -> Iterable[Dict[str, str]]:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8", errors="replace", newline="") as f:
        first = f.readline()
        if not first:
            return []
        f.seek(0)
        has_header = any(ch.isalpha() for ch in first.split(",")[0])
        if has_header:
            reader = csv.DictReader(f)
            for row in reader:
                yield {k: (v or "") for k, v in row.items()}
        else:
            reader = csv.reader(f)
            for row in reader:
                yield {f"col{i}": (row[i] if i < len(row) else "") for i in range(len(row))}


def _scan_dates() -> List[date]:
    dates: List[date] = []
    for prefix in ("usage", "report", "conns", "domains"):
        for p in glob.glob(os.path.join(DATA_DIR, f"{prefix}_????-??-??.csv")):
            base = os.path.basename(p)
            ds = base.replace(prefix + "_", "").replace(".csv", "")
            d = _parse_day(ds)
            if d:
                dates.append(d)
    return sorted(set(dates))


def _end_date_or_max(to_day: Optional[str]) -> date:
    dates = _scan_dates()
    if not dates:
        return date.today()
    mx = max(dates)
    if not to_day:
        return mx
    d = _parse_day(to_day)
    if not d:
        return mx
    return min(d, mx)


def _calendar_days_ending_at(end: date, n: int) -> List[str]:
    n = max(1, min(30, n))
    days = [end - timedelta(days=i) for i in reversed(range(n))]
    return [_fmt_day(d) for d in days]


def _load_json(path: str, default: Any) -> Any:
    try:
        if not os.path.exists(path):
            return default
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return json.load(f)
    except Exception:
        return default


def _save_json(path: str, obj: Any) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def _load_aliases() -> Dict[str, str]:
    d = _load_json(ALIASES_PATH, {})
    if isinstance(d, dict):
        out = {}
        for k, v in d.items():
            if isinstance(k, str) and isinstance(v, str) and k.strip():
                out[k.strip()] = v.strip()
        return out
    return {}


def _set_alias(email: str, alias: str) -> None:
    email = (email or "").strip()
    alias = (alias or "").strip()
    if not email:
        return
    d = _load_aliases()
    if alias:
        d[email] = alias
    else:
        d.pop(email, None)
    _save_json(ALIASES_PATH, d)


def _display_name(email: str, aliases: Dict[str, str]) -> str:
    a = (aliases.get(email) or "").strip()
    return a if a else email


def _load_xray_cfg() -> Dict[str, Any]:
    if not os.path.exists(XRAY_CFG):
        return {}
    with open(XRAY_CFG, "r", encoding="utf-8", errors="replace") as f:
        return json.load(f)


def _backup_xray_cfg() -> Optional[str]:
    if not os.path.exists(XRAY_CFG):
        return None
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    dst = XRAY_CFG + f".bak.{ts}"
    try:
        with open(XRAY_CFG, "rb") as srcf, open(dst, "wb") as dstf:
            dstf.write(srcf.read())
        return dst
    except Exception:
        return None


def _save_xray_cfg(cfg: Dict[str, Any]) -> None:
    tmp = XRAY_CFG + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    os.replace(tmp, XRAY_CFG)


def _find_vless_inbound(cfg: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[List[Dict[str, Any]]]]:
    inbounds = cfg.get("inbounds") or []
    if not isinstance(inbounds, list):
        return None, None
    for ib in inbounds:
        if not isinstance(ib, dict):
            continue
        if (ib.get("protocol") or "").lower() != "vless":
            continue
        settings = ib.get("settings") or {}
        clients = settings.get("clients") or []
        if isinstance(clients, list):
            return ib, clients
    for ib in inbounds:
        if not isinstance(ib, dict):
            continue
        settings = ib.get("settings") or {}
        clients = settings.get("clients") or []
        if isinstance(clients, list):
            return ib, clients
    return None, None


def _list_cfg_users(cfg: Dict[str, Any]) -> List[Dict[str, str]]:
    _ib, clients = _find_vless_inbound(cfg)
    if not clients:
        return []
    out = []
    for c in clients:
        if not isinstance(c, dict):
            continue
        email = (c.get("email") or "").strip()
        cid = (c.get("id") or "").strip()
        if email and cid:
            out.append({"email": email, "id": cid})
    return sorted(out, key=lambda x: x["email"])


def _restart_xray() -> Dict[str, Any]:
    try:
        p = subprocess.run(
            ["systemctl", "restart", XRAY_SERVICE_NAME],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        return {"ok": p.returncode == 0, "rc": p.returncode, "stdout": p.stdout[-400:], "stderr": p.stderr[-400:]}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _admin_guard() -> Optional[Response]:
    if not ADMIN_TOKEN:
        return None
    tok = (request.headers.get("X-Admin-Token") or "").strip()
    if tok != ADMIN_TOKEN:
        return jsonify({"ok": False, "error": "unauthorized"}), 401
    return None


def _try_load_ip_domain_map_latest() -> Dict[str, str]:
    dates = _scan_dates()
    if not dates:
        return {}
    for d in sorted(dates, reverse=True):
        path = os.path.join(DATA_DIR, f"domains_{_fmt_day(d)}.csv")
        if not os.path.exists(path):
            continue
        rows = list(_read_csv_rows(path))
        if not rows:
            continue
        header = set(rows[0].keys())
        if "ip" in header and "domain" in header:
            m: Dict[str, str] = {}
            for r in rows:
                ip = (r.get("ip") or "").strip()
                dom = (r.get("domain") or "").strip()
                if ip and dom:
                    m[ip] = dom
            return m
        return {}
    return {}


def _detect_public_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "SET_PUBLIC_HOST"


def _b64pad(s: str) -> str:
    s = s.strip()
    return s + "=" * ((4 - len(s) % 4) % 4)


def _derive_reality_public_key_b64(private_key_b64: str) -> Optional[str]:
    try:
        from cryptography.hazmat.primitives.asymmetric import x25519
        from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    except Exception:
        return None
    try:
        raw = base64.b64decode(_b64pad(private_key_b64))
        if len(raw) != 32:
            return None
        pk = x25519.X25519PrivateKey.from_private_bytes(raw).public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
        out = base64.b64encode(pk).decode("ascii")
        return out.rstrip("=")
    except Exception:
        return None


def _build_vless_reality_link(cfg: Dict[str, Any], email: str, cid: str) -> Dict[str, Any]:
    ib, _clients = _find_vless_inbound(cfg)
    host = os.getenv("XRAY_PUBLIC_HOST", "").strip() or _detect_public_ip()
    port = 443
    if ib is not None:
        try:
            port = int(ib.get("port"))
        except Exception:
            pass

    stream = (ib.get("streamSettings") or {}) if ib else {}
    reality = (stream.get("realitySettings") or {}) if isinstance(stream, dict) else {}
    server_names = reality.get("serverNames") or []
    short_ids = reality.get("shortIds") or []
    private_key = (reality.get("privateKey") or "").strip()

    sni = (server_names[0] if isinstance(server_names, list) and server_names else "") or os.getenv("XRAY_REALITY_SNI", "").strip()
    sid = (short_ids[0] if isinstance(short_ids, list) and short_ids else "") or os.getenv("XRAY_REALITY_SID", "").strip()

    pbk = os.getenv("XRAY_REALITY_PBK", "").strip()
    if not pbk and private_key:
        pbk = _derive_reality_public_key_b64(private_key) or ""

    fp = os.getenv("XRAY_REALITY_FP", "chrome").strip()
    spx = os.getenv("XRAY_REALITY_SPX", "/").strip()
    flow = os.getenv("XRAY_VLESS_FLOW", "").strip() or "xtls-rprx-vision"
    net = (stream.get("network") or "tcp").strip()

    from urllib.parse import quote

    q = []
    q.append("encryption=none")
    q.append("security=reality")
    if sni:
        q.append("sni=" + quote(sni))
    if fp:
        q.append("fp=" + quote(fp))
    if pbk:
        q.append("pbk=" + quote(pbk))
    if sid:
        q.append("sid=" + quote(sid))
    if spx:
        q.append("spx=" + quote(spx))
    if net:
        q.append("type=" + quote(net))
    if flow:
        q.append("flow=" + quote(flow))

    link = f"vless://{cid}@{host}:{port}?{'&'.join(q)}#{quote(email)}"
    return {"link": link, "host": host, "port": port, "pbk": pbk, "sni": sni, "sid": sid, "fp": fp, "flow": flow, "net": net}


def _aggregate_last_n(days: List[str]) -> Dict[str, Any]:
    ip_map = _try_load_ip_domain_map_latest()
    aliases = _load_aliases()

    traffic_daily_user: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    conns_daily_user: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    traffic_user_domain: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    conns_user_domain: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    report_sum_user_day: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    users_seen: set[str] = set()

    for day in days:
        path = os.path.join(DATA_DIR, f"usage_{day}.csv")
        if not os.path.exists(path):
            continue
        for r in _read_csv_rows(path):
            u = (r.get("user") or "").strip()
            if not u:
                continue
            users_seen.add(u)
            total = r.get("total_bytes")
            if total is None or total == "":
                up = _safe_int(r.get("uplink_bytes"), 0)
                down = _safe_int(r.get("downlink_bytes"), 0)
                total_bytes = up + down
            else:
                total_bytes = _safe_int(total, 0)
            traffic_daily_user[u][day] = max(int(total_bytes), int(traffic_daily_user[u].get(day, 0)))

    for day in days:
        path = os.path.join(DATA_DIR, f"report_{day}.csv")
        if not os.path.exists(path):
            continue
        for r in _read_csv_rows(path):
            u = (r.get("user") or "").strip()
            dst = (r.get("dst") or "").strip()
            b = _safe_int(r.get("traffic_bytes"), 0)
            if not u or not dst:
                continue
            users_seen.add(u)
            if _looks_like_ip(dst) and dst in ip_map:
                dst = ip_map[dst]
            traffic_user_domain[u][dst] += b
            report_sum_user_day[u][day] += b

    for u, by_day in report_sum_user_day.items():
        for d, s in by_day.items():
            if s > 0:
                traffic_daily_user[u][d] = s

    for day in days:
        path = os.path.join(DATA_DIR, f"conns_{day}.csv")
        if not os.path.exists(path):
            continue
        for r in _read_csv_rows(path):
            u = (r.get("user") or "").strip()
            dst = (r.get("dst") or "").strip()
            c = _safe_int(r.get("conn_count"), 0)
            if not u or not dst:
                continue
            users_seen.add(u)
            if _looks_like_ip(dst) and dst in ip_map:
                dst = ip_map[dst]
            conns_user_domain[u][dst] += c
            conns_daily_user[u][day] += c

    try:
        cfg = _load_xray_cfg()
        for u in [x["email"] for x in _list_cfg_users(cfg)]:
            users_seen.add(u)
    except Exception:
        pass

    users = sorted(users_seen)

    global_daily_traffic = {d: 0 for d in days}
    global_daily_conns = {d: 0 for d in days}
    for u in users:
        for d in days:
            global_daily_traffic[d] += int(traffic_daily_user[u].get(d, 0))
            global_daily_conns[d] += int(conns_daily_user[u].get(d, 0))

    total_traffic_7d = sum(global_daily_traffic.values())
    total_conns_7d = sum(global_daily_conns.values())

    g_dom_t: Dict[str, int] = defaultdict(int)
    g_dom_c: Dict[str, int] = defaultdict(int)
    for u in users:
        for dom, b in traffic_user_domain.get(u, {}).items():
            g_dom_t[dom] += int(b)
        for dom, c in conns_user_domain.get(u, {}).items():
            g_dom_c[dom] += int(c)

    g_top_t = []
    for dom, b in sorted(g_dom_t.items(), key=lambda kv: kv[1], reverse=True)[:10]:
        pct = (b / total_traffic_7d * 100.0) if total_traffic_7d > 0 else 0.0
        g_top_t.append({"domain": dom, "bytes": int(b), "pct": pct})

    g_top_c = []
    for dom, c in sorted(g_dom_c.items(), key=lambda kv: kv[1], reverse=True)[:10]:
        pct = (c / total_conns_7d * 100.0) if total_conns_7d > 0 else 0.0
        g_top_c.append({"domain": dom, "count": int(c), "pct": pct})

    cum_traffic = []
    cum_conns = []
    run_t = 0
    run_c = 0
    for d in days:
        run_t += global_daily_traffic[d]
        run_c += global_daily_conns[d]
        cum_traffic.append(run_t)
        cum_conns.append(run_c)

    per_user: Dict[str, Any] = {}
    for u in users:
        t_by_day = {d: int(traffic_daily_user[u].get(d, 0)) for d in days}
        c_by_day = {d: int(conns_daily_user[u].get(d, 0)) for d in days}
        traffic_total = sum(t_by_day.values())
        conns_total = sum(c_by_day.values())

        anomaly_days = [d for d in days if t_by_day[d] >= int(ANOMALY_GB_PER_DAY * 1_000_000_000)]

        td = traffic_user_domain.get(u, {})
        cd = conns_user_domain.get(u, {})

        td_sorted = sorted(td.items(), key=lambda kv: kv[1], reverse=True)[:10]
        cd_sorted = sorted(cd.items(), key=lambda kv: kv[1], reverse=True)[:10]

        top_t = []
        for dom, b in td_sorted:
            pct = (b / traffic_total * 100.0) if traffic_total > 0 else 0.0
            top_t.append({"domain": dom, "bytes": int(b), "pct": pct})

        top_c = []
        for dom, c in cd_sorted:
            pct = (c / conns_total * 100.0) if conns_total > 0 else 0.0
            top_c.append({"domain": dom, "count": int(c), "pct": pct})

        per_user[u] = {
            "display": _display_name(u, aliases),
            "traffic_by_day_bytes": t_by_day,
            "conns_by_day": c_by_day,
            "top_domains_traffic": top_t,
            "top_domains_conns": top_c,
            "totals": {
                "traffic_7d_bytes": int(traffic_total),
                "conns_7d": int(conns_total),
                "anomaly_days": anomaly_days,
            },
        }

    # Matrix: users × top-domains (traffic)
    doms = []
    seen = set()
    for x in g_top_t[:8]:
        if x["domain"] not in seen:
            doms.append(x["domain"])
            seen.add(x["domain"])
    for x in g_top_c[:8]:
        if len(doms) >= 8:
            break
        if x["domain"] not in seen:
            doms.append(x["domain"])
            seen.add(x["domain"])

    matrix = {"domains": doms, "traffic": {}, "conns": {}}
    for u in users:
        matrix["traffic"][u] = {d: int(traffic_user_domain.get(u, {}).get(d, 0)) for d in doms}
        matrix["conns"][u] = {d: int(conns_user_domain.get(u, {}).get(d, 0)) for d in doms}

    state_path = os.path.join(DATA_DIR, "usage_state.json")
    usage_state = _load_json(state_path, None)

    return {
        "meta": {
            "days": days,
            "data_dir": DATA_DIR,
            "anomaly_gb_per_day": ANOMALY_GB_PER_DAY,
            "generated_at_utc": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        },
        "users": users,
        "aliases": aliases,
        "per_user": per_user,
        "global": {
            "daily_traffic_bytes": global_daily_traffic,
            "daily_conns": global_daily_conns,
            "cumulative_traffic_bytes": cum_traffic,
            "cumulative_conns": cum_conns,
            "totals_7d": {"traffic_bytes": int(total_traffic_7d), "conns": int(total_conns_7d)},
            "top_domains_traffic": g_top_t,
            "top_domains_conns": g_top_c,
        },
        "matrix": matrix,
        "usage_state": usage_state,
    }


_CACHE: Dict[str, Any] = {"ts": 0.0, "data": None, "etag": None, "days_n": None}


def _get_dashboard(days_n: int) -> Tuple[Dict[str, Any], str]:
    now = time.time()
    if (
        _CACHE["data"] is not None
        and (now - _CACHE["ts"]) < CACHE_TTL_SEC
        and _CACHE.get("days_n") == days_n
    ):
        return _CACHE["data"], _CACHE["etag"]

    end = _end_date_or_max(None)
    days = _calendar_days_ending_at(end, days_n)
    data = _aggregate_last_n(days)

    payload = json.dumps(data, sort_keys=True, ensure_ascii=False).encode("utf-8")
    etag = hashlib.sha256(payload).hexdigest()

    _CACHE.update({"ts": now, "data": data, "etag": etag, "days_n": days_n})
    return data, etag


_ALLTIME_CACHE: Dict[str, Any] = {"stamp": None, "ts": 0.0, "data": None}


def _files_stamp() -> Tuple[int, int]:
    newest = 0
    cnt = 0
    for pref in ("report", "conns", "domains"):
        for p in glob.glob(os.path.join(DATA_DIR, f"{pref}_????-??-??.csv")):
            cnt += 1
            try:
                newest = max(newest, int(os.path.getmtime(p)))
            except Exception:
                pass
    return (cnt, newest)


def _alltime_stats() -> Dict[str, Any]:
    now = time.time()
    stamp = _files_stamp()
    if _ALLTIME_CACHE["data"] is not None and _ALLTIME_CACHE["stamp"] == stamp and (now - _ALLTIME_CACHE["ts"]) < 60:
        return _ALLTIME_CACHE["data"]

    ip_map = _try_load_ip_domain_map_latest()

    used_days: Dict[str, set] = defaultdict(set)
    total_traffic: Dict[str, int] = defaultdict(int)
    total_conns: Dict[str, int] = defaultdict(int)
    dom_traffic: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for p in glob.glob(os.path.join(DATA_DIR, "report_????-??-??.csv")):
        base = os.path.basename(p)
        day = base.replace("report_", "").replace(".csv", "")
        if not _parse_day(day):
            continue
        for r in _read_csv_rows(p):
            u = (r.get("user") or "").strip()
            dst = (r.get("dst") or "").strip()
            b = _safe_int(r.get("traffic_bytes"), 0)
            if not u or not dst or b <= 0:
                continue
            if _looks_like_ip(dst) and dst in ip_map:
                dst = ip_map[dst]
            total_traffic[u] += b
            dom_traffic[u][dst] += b
            used_days[u].add(day)

    for p in glob.glob(os.path.join(DATA_DIR, "conns_????-??-??.csv")):
        base = os.path.basename(p)
        day = base.replace("conns_", "").replace(".csv", "")
        if not _parse_day(day):
            continue
        for r in _read_csv_rows(p):
            u = (r.get("user") or "").strip()
            c = _safe_int(r.get("conn_count"), 0)
            if not u or c <= 0:
                continue
            total_conns[u] += c
            used_days[u].add(day)

    users = sorted(set(list(total_traffic.keys()) + list(total_conns.keys()) + list(used_days.keys())))

    out = {}
    for u in users:
        top3 = sorted(dom_traffic.get(u, {}).items(), key=lambda kv: kv[1], reverse=True)[:3]
        out[u] = {
            "days_used": len(used_days.get(u, set())),
            "total_traffic_bytes": int(total_traffic.get(u, 0)),
            "total_conns": int(total_conns.get(u, 0)),
            "top3_traffic": [{"domain": d, "bytes": int(b)} for d, b in top3],
        }

    res = {"users": users, "per_user": out, "stamp": {"count": stamp[0], "newest_mtime": stamp[1]}}
    _ALLTIME_CACHE.update({"stamp": stamp, "ts": now, "data": res})
    return res


@app.get("/")
def index():
    return send_file(UI_PATH)


@app.get("/__ui")
def ui_debug():
    st = os.stat(UI_PATH)
    with open(UI_PATH, "rb") as f:
        sha = hashlib.sha256(f.read()).hexdigest()[:12]
    return jsonify({"ui_path": UI_PATH, "sha12": sha, "mtime": st.st_mtime})


@app.get("/health")
def health():
    ok = os.path.isdir(DATA_DIR)
    return jsonify({"ok": ok, "data_dir": DATA_DIR})


@app.get("/api/dashboard")
def api_dashboard():
    days_n = _safe_int(request.args.get("days") or 7, 7)
    days_n = max(1, min(30, days_n))

    data, etag = _get_dashboard(days_n)

    inm = request.headers.get("If-None-Match")
    if inm and inm.strip('"') == etag:
        return Response(status=304)

    resp = jsonify(data)
    resp.headers["ETag"] = f'"{etag}"'
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.get("/api/admin/users")
def api_admin_users():
    g = _admin_guard()
    if g:
        return g

    aliases = _load_aliases()
    cfg = _load_xray_cfg()
    cfg_users = _list_cfg_users(cfg)
    cfg_map = {x["email"]: x["id"] for x in cfg_users}

    alltime = _alltime_stats()
    alltime_map = alltime["per_user"]

    users = sorted(set(list(cfg_map.keys()) + list(alltime_map.keys()) + list(aliases.keys())))

    rows = []
    for u in users:
        st = alltime_map.get(u, {"days_used": 0, "total_traffic_bytes": 0, "total_conns": 0, "top3_traffic": []})
        rows.append({
            "email": u,
            "id": cfg_map.get(u, ""),
            "alias": aliases.get(u, ""),
            "display": _display_name(u, aliases),
            "stats": st,
        })

    return jsonify({"ok": True, "users": rows, "token_required": bool(ADMIN_TOKEN)})


@app.get("/api/admin/user/link")
def api_admin_user_link():
    g = _admin_guard()
    if g:
        return g

    email = (request.args.get("email") or "").strip()
    if not email:
        return jsonify({"ok": False, "error": "email_required"}), 400

    cfg = _load_xray_cfg()
    cfg_map = {x["email"]: x["id"] for x in _list_cfg_users(cfg)}
    cid = cfg_map.get(email, "")
    if not cid:
        return jsonify({"ok": False, "error": "user_not_found"}), 404

    link_meta = _build_vless_reality_link(cfg, email, cid)
    return jsonify({"ok": True, **link_meta})


@app.post("/api/admin/user/add")
def api_admin_user_add():
    g = _admin_guard()
    if g:
        return g

    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip()
    alias = (body.get("alias") or "").strip()

    cfg = _load_xray_cfg()
    ib, clients = _find_vless_inbound(cfg)
    if not ib or clients is None:
        return jsonify({"ok": False, "error": "vless_inbound_not_found"}), 500

    existing_emails = {(c.get("email") or "").strip() for c in clients if isinstance(c, dict)}

    if not email:
        mx = 0
        for e in existing_emails:
            if e.startswith("user_"):
                tail = e.replace("user_", "")
                if tail.isdigit():
                    mx = max(mx, int(tail))
        email = f"user_{mx+1:02d}"

    if email in existing_emails:
        return jsonify({"ok": False, "error": "email_exists"}), 409

    flow = ""
    for c in clients:
        if isinstance(c, dict) and (c.get("flow") or "").strip():
            flow = (c.get("flow") or "").strip()
            break
    if not flow:
        flow = "xtls-rprx-vision"

    cid = str(uuid.uuid4())
    clients.append({"id": cid, "email": email, "flow": flow})

    bak = _backup_xray_cfg()
    _save_xray_cfg(cfg)

    if alias:
        _set_alias(email, alias)

    restart = _restart_xray()
    link_meta = _build_vless_reality_link(cfg, email, cid)

    return jsonify({
        "ok": True,
        "email": email,
        "id": cid,
        "backup": bak,
        "xray_restart": restart,
        **link_meta
    })


@app.post("/api/admin/user/delete")
def api_admin_user_delete():
    g = _admin_guard()
    if g:
        return g

    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip()
    if not email:
        return jsonify({"ok": False, "error": "email_required"}), 400

    cfg = _load_xray_cfg()
    ib, clients = _find_vless_inbound(cfg)
    if not ib or clients is None:
        return jsonify({"ok": False, "error": "vless_inbound_not_found"}), 500

    before = len(clients)
    clients[:] = [c for c in clients if not (isinstance(c, dict) and (c.get("email") or "").strip() == email)]
    after = len(clients)

    if before == after:
        return jsonify({"ok": False, "error": "user_not_found"}), 404

    bak = _backup_xray_cfg()
    _save_xray_cfg(cfg)
    _set_alias(email, "")
    restart = _restart_xray()

    return jsonify({"ok": True, "email": email, "backup": bak, "xray_restart": restart})


@app.post("/api/admin/user/rename")
def api_admin_user_rename():
    g = _admin_guard()
    if g:
        return g

    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip()
    alias = (body.get("alias") or "").strip()
    if not email:
        return jsonify({"ok": False, "error": "email_required"}), 400

    _set_alias(email, alias)
    return jsonify({"ok": True, "email": email, "alias": alias})


if __name__ == "__main__":
    app.run(host=APP_HOST, port=APP_PORT, debug=False)

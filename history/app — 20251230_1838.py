from __future__ import annotations

import csv
import glob
import hashlib
import json
import os
import time
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from flask import Flask, Response, jsonify, request, send_file

APP_HOST = os.getenv("XRAY_UI_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("XRAY_UI_PORT", "8090"))

DATA_DIR = os.getenv("XRAY_USAGE_DIR", "/var/log/xray/usage")
XRAY_CFG = os.getenv("XRAY_CFG", "/usr/local/etc/xray/config.json")

DAYS_DEFAULT = 7
CACHE_TTL_SEC = int(os.getenv("XRAY_UI_CACHE_TTL_SEC", "15"))
ANOMALY_GB_PER_DAY = float(os.getenv("XRAY_UI_ANOMALY_GB_PER_DAY", "1.0"))

# всегда отдаём index.html рядом с app.py (или переопределяй XRAY_UI_INDEX)
UI_PATH = os.getenv(
    "XRAY_UI_INDEX",
    str(Path(__file__).resolve().with_name("index.html")),
)

app = Flask(__name__)

# ---------------------------
# No-cache для UI
# ---------------------------

@app.after_request
def _no_cache(resp):
    if request.path == "/" or request.path.endswith(".html"):
        resp.headers["Cache-Control"] = "no-store"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
    return resp


# ---------------------------
# Utils
# ---------------------------

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


def _load_xray_users() -> List[str]:
    if not os.path.exists(XRAY_CFG):
        return []
    try:
        with open(XRAY_CFG, "r", encoding="utf-8", errors="replace") as f:
            cfg = json.load(f)
        users: List[str] = []
        for inbound in cfg.get("inbounds", []) or []:
            settings = inbound.get("settings") or {}
            clients = settings.get("clients") or []
            for c in clients:
                email = (c.get("email") or "").strip()
                if email:
                    users.append(email)
        return sorted(set(users))
    except Exception:
        return []


def _try_load_ip_domain_map() -> Dict[str, str]:
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


# ---------------------------
# Aggregation (не удваиваем трафик)
# ---------------------------

def _aggregate(days: List[str]) -> Dict[str, Any]:
    ip_map = _try_load_ip_domain_map()

    traffic_daily_user: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    conns_daily_user: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    traffic_user_domain: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    conns_user_domain: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    report_sum_user_day: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    users_seen: set[str] = set()

    # usage: daily totals (fallback)
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

    # report: domain traffic + sums (has priority)
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

    # conns: domain connections
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

    for u in _load_xray_users():
        users_seen.add(u)

    users = sorted(users_seen)

    global_daily_traffic = {d: 0 for d in days}
    global_daily_conns = {d: 0 for d in days}

    for u in users:
        for d in days:
            global_daily_traffic[d] += int(traffic_daily_user[u].get(d, 0))
            global_daily_conns[d] += int(conns_daily_user[u].get(d, 0))

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

        anomaly_days = [
            d for d in days
            if t_by_day[d] >= int(ANOMALY_GB_PER_DAY * 1_000_000_000)
        ]

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

    state_path = os.path.join(DATA_DIR, "usage_state.json")
    usage_state = None
    if os.path.exists(state_path):
        try:
            with open(state_path, "r", encoding="utf-8", errors="replace") as f:
                usage_state = json.load(f)
        except Exception:
            usage_state = None

    return {
        "meta": {
            "days": days,
            "data_dir": DATA_DIR,
            "anomaly_gb_per_day": ANOMALY_GB_PER_DAY,
            "generated_at_utc": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        },
        "users": users,
        "per_user": per_user,
        "global": {
            "daily_traffic_bytes": global_daily_traffic,
            "daily_conns": global_daily_conns,
            "cumulative_traffic_bytes": cum_traffic,
            "cumulative_conns": cum_conns,
        },
        "usage_state": usage_state,
    }


def _users_for_date(day: str) -> List[str]:
    users: set[str] = set()
    for prefix in ("usage", "report", "conns"):
        path = os.path.join(DATA_DIR, f"{prefix}_{day}.csv")
        if not os.path.exists(path):
            continue
        for r in _read_csv_rows(path):
            u = (r.get("user") or "").strip()
            if u:
                users.add(u)
    for u in _load_xray_users():
        users.add(u)
    return sorted(users)


def _summary_pack(days: List[str], kind: str) -> Dict[str, Any]:
    data = _aggregate(days)
    users = data["users"]
    rows = []
    if kind == "traffic":
        for u in users:
            m = data["per_user"][u]["traffic_by_day_bytes"]
            for d in days:
                rows.append({"user": u, "date": d, "value": int(m.get(d, 0))})
    else:
        for u in users:
            m = data["per_user"][u]["conns_by_day"]
            for d in days:
                rows.append({"user": u, "date": d, "value": int(m.get(d, 0))})
    return {"days": days, "users": users, "data": rows}


# ---------------------------
# Cache for /api/dashboard
# ---------------------------

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
    data = _aggregate(days)

    payload = json.dumps(data, sort_keys=True, ensure_ascii=False).encode("utf-8")
    etag = hashlib.sha256(payload).hexdigest()

    _CACHE.update({"ts": now, "data": data, "etag": etag, "days_n": days_n})
    return data, etag


# ---------------------------
# Routes
# ---------------------------

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
    days_n = _safe_int(request.args.get("days") or DAYS_DEFAULT, DAYS_DEFAULT)
    days_n = max(1, min(30, days_n))

    data, etag = _get_dashboard(days_n)

    inm = request.headers.get("If-None-Match")
    if inm and inm.strip('"') == etag:
        return Response(status=304)

    resp = jsonify(data)
    resp.headers["ETag"] = f'"{etag}"'
    resp.headers["Cache-Control"] = "no-store"
    return resp


# Compatibility endpoints (если старый UI дергает)
@app.get("/api/days")
def api_days():
    return jsonify([_fmt_day(d) for d in _scan_dates()])


@app.get("/api/users")
def api_users():
    day = (request.args.get("date") or "").strip()
    if not day:
        day = _fmt_day(_end_date_or_max(None))
    return jsonify(_users_for_date(day))


@app.get("/api/summary")
def api_summary():
    days_n = _safe_int(request.args.get("days") or 7, 7)
    to_day = (request.args.get("to") or "").strip()
    end = _end_date_or_max(to_day)
    days = _calendar_days_ending_at(end, days_n)
    return jsonify(_summary_pack(days, "traffic"))


@app.get("/api/summary_conns")
def api_summary_conns():
    days_n = _safe_int(request.args.get("days") or 7, 7)
    to_day = (request.args.get("to") or "").strip()
    end = _end_date_or_max(to_day)
    days = _calendar_days_ending_at(end, days_n)
    return jsonify(_summary_pack(days, "conns"))


if __name__ == "__main__":
    app.run(host=APP_HOST, port=APP_PORT, debug=False)

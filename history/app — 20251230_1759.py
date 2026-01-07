from __future__ import annotations

import csv
import glob
import hashlib
import json
import os
import time
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple

from flask import Flask, Response, jsonify, request

APP_HOST = os.getenv("XRAY_UI_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("XRAY_UI_PORT", "8090"))

DATA_DIR = os.getenv("XRAY_USAGE_DIR", "/var/log/xray/usage")
XRAY_CFG = os.getenv("XRAY_CFG", "/usr/local/etc/xray/config.json")

DAYS_DEFAULT = 7
CACHE_TTL_SEC = int(os.getenv("XRAY_UI_CACHE_TTL_SEC", "15"))
ANOMALY_GB_PER_DAY = float(os.getenv("XRAY_UI_ANOMALY_GB_PER_DAY", "1.0"))

app = Flask(__name__)

# ---------------------------
# Utilities
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
    # если requested to больше максимума — режем до максимума
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
    """
    Поддержка "правильного" domains_YYYY-MM-DD.csv: ip,domain.
    Если лежит старый "битый" формат (дубликат conns) — игнорируем.
    """
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
# Aggregation (NO double-count of traffic)
# ---------------------------

def _aggregate(days: List[str]) -> Dict[str, Any]:
    ip_map = _try_load_ip_domain_map()

    traffic_daily_user: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    conns_daily_user: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    traffic_user_domain: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    conns_user_domain: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    # report sums (to override usage totals when report has real data)
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
            # important: set (not +=)
            traffic_daily_user[u][day] = max(int(total_bytes), int(traffic_daily_user[u].get(day, 0)))

    # report: domain traffic + report sums
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

    # override daily totals by report sum if report has >0
    for u, by_day in report_sum_user_day.items():
        for d, s in by_day.items():
            if s > 0:
                traffic_daily_user[u][d] = s

    # conns: domain connections (only source)
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
        max_daily = max(t_by_day.values()) if days else 0
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
            "traffic_by_day_bytes": t_by_day,
            "conns_by_day": c_by_day,
            "top_domains_traffic": top_t,
            "top_domains_conns": top_c,
            "totals": {
                "traffic_7d_bytes": int(traffic_total),
                "conns_7d": int(conns_total),
                "max_daily_bytes": int(max_daily),
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

def _top_for_user_day_traffic(day: str, user: str, top: int) -> List[Dict[str, Any]]:
    ip_map = _try_load_ip_domain_map()
    agg: Dict[str, int] = defaultdict(int)
    path = os.path.join(DATA_DIR, f"report_{day}.csv")
    if not os.path.exists(path):
        return []
    for r in _read_csv_rows(path):
        u = (r.get("user") or "").strip()
        if u != user:
            continue
        dst = (r.get("dst") or "").strip()
        b = _safe_int(r.get("traffic_bytes"), 0)
        if not dst:
            continue
        if _looks_like_ip(dst) and dst in ip_map:
            dst = ip_map[dst]
        agg[dst] += b
    items = sorted(agg.items(), key=lambda kv: kv[1], reverse=True)[:max(1, min(5000, top))]
    return [{"dst": k, "bytes": int(v)} for k, v in items]

def _top_for_user_day_conns(day: str, user: str, top: int) -> List[Dict[str, Any]]:
    ip_map = _try_load_ip_domain_map()
    agg: Dict[str, int] = defaultdict(int)
    path = os.path.join(DATA_DIR, f"conns_{day}.csv")
    if not os.path.exists(path):
        return []
    for r in _read_csv_rows(path):
        u = (r.get("user") or "").strip()
        if u != user:
            continue
        dst = (r.get("dst") or "").strip()
        c = _safe_int(r.get("conn_count"), 0)
        if not dst:
            continue
        if _looks_like_ip(dst) and dst in ip_map:
            dst = ip_map[dst]
        agg[dst] += c
    items = sorted(agg.items(), key=lambda kv: kv[1], reverse=True)[:max(1, min(5000, top))]
    return [{"dst": k, "count": int(v)} for k, v in items]

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
# Cache layer (for /api/dashboard)
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

# -------- Compatibility endpoints (old UI) --------

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

@app.get("/api/user_day")
def api_user_day():
    day = (request.args.get("date") or "").strip()
    user = (request.args.get("user") or "").strip()
    top = _safe_int(request.args.get("top") or 100, 100)
    if not day or not user:
        return jsonify([])
    return jsonify(_top_for_user_day_traffic(day, user, top))

@app.get("/api/user_day_conns")
def api_user_day_conns():
    day = (request.args.get("date") or "").strip()
    user = (request.args.get("user") or "").strip()
    top = _safe_int(request.args.get("top") or 100, 100)
    if not day or not user:
        return jsonify([])
    return jsonify(_top_for_user_day_conns(day, user, top))

@app.get("/health")
def health():
    ok = os.path.isdir(DATA_DIR)
    return jsonify({"ok": ok, "data_dir": DATA_DIR})

@app.get("/")
def index():
    return Response(_INDEX_HTML, mimetype="text/html; charset=utf-8")

# ---------------------------
# Frontend (new UI, uses /api/dashboard)
# ---------------------------

_INDEX_HTML = r"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Xray Usage Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0"></script>

  <style>
    :root{
      --w: 2240px;
      --h: 1260px;

      --bg: #0b1020;
      --panel: rgba(255,255,255,.06);
      --text: rgba(255,255,255,.92);
      --muted: rgba(255,255,255,.62);
      --line: rgba(255,255,255,.14);

      --radius: 16px;
      --radius2: 22px;
      --gap: 16px;

      --topbar-h: 54px;
      --filter-h: 48px;
      --cards-h: 900px;
      --bottom-h: calc(var(--h) - var(--topbar-h) - var(--filter-h) - var(--cards-h));

      --shadow: 0 10px 30px rgba(0,0,0,.35);

      --ok: #60d394;
      --warn: #ffb703;
      --bad: #ef476f;
    }

    *{ box-sizing: border-box; }
    html, body { height: 100%; }
    body{
      margin: 0;
      background: radial-gradient(1200px 700px at 20% 0%, rgba(86, 104, 255, .18), transparent 60%),
                  radial-gradient(1000px 600px at 80% 10%, rgba(96, 211, 148, .14), transparent 55%),
                  var(--bg);
      color: var(--text);
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      overflow: hidden;
    }

    .frame{
      width: var(--w);
      height: var(--h);
      margin: 0 auto;
      position: relative;
      transform-origin: top left;
      border-radius: 28px;
      overflow: hidden;
      box-shadow: var(--shadow);
      outline: 1px solid rgba(255,255,255,.08);
      background: rgba(0,0,0,.10);
      backdrop-filter: blur(10px);
    }

    .topbar{
      height: var(--topbar-h);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--line);
      background: rgba(0,0,0,.18);
    }

    .brand{
      display: flex;
      align-items: baseline;
      gap: 10px;
      font-weight: 700;
      letter-spacing: .2px;
    }
    .range{
      font-size: 12px;
      color: var(--muted);
      font-weight: 500;
    }

    .controls{
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .chip{
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.04);
      font-size: 12px;
      color: var(--muted);
      user-select: none;
    }

    .btn{
      padding: 8px 10px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.05);
      color: var(--text);
      cursor: pointer;
      font-weight: 600;
      font-size: 12px;
      user-select: none;
      transition: transform .08s ease, background .15s ease, border-color .15s ease;
    }
    .btn:hover{ background: rgba(255,255,255,.08); }
    .btn:active{ transform: translateY(1px); }
    .btn.primary{
      border-color: rgba(96,211,148,.35);
      background: rgba(96,211,148,.10);
    }

    .seg{
      display: inline-flex;
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      background: rgba(255,255,255,.04);
    }
    .seg button{
      all: unset;
      cursor: pointer;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      border-right: 1px solid var(--line);
    }
    .seg button:last-child{ border-right: none; }
    .seg button.active{
      color: var(--text);
      background: rgba(255,255,255,.08);
    }

    .user-filter{
      height: var(--filter-h);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--line);
      background: rgba(255,255,255,.02);
      overflow: hidden;
    }
    .user-filter .wrap{
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,.20) transparent;
    }
    .user-filter .wrap::-webkit-scrollbar{ height: 8px; }
    .user-filter .wrap::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.18); border-radius: 999px; }

    .toggle{
      padding: 7px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.04);
      color: var(--muted);
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    .toggle.on{
      background: rgba(96,211,148,.12);
      border-color: rgba(96,211,148,.35);
      color: var(--text);
      box-shadow: 0 0 0 4px rgba(96,211,148,.08);
    }
    .toggle.warn.on{
      background: rgba(255,183,3,.12);
      border-color: rgba(255,183,3,.35);
      box-shadow: 0 0 0 4px rgba(255,183,3,.08);
    }

    .main{
      height: calc(var(--h) - var(--topbar-h) - var(--filter-h));
      display: grid;
      grid-template-rows: var(--cards-h) var(--bottom-h);
    }

    .cards-panel{
      padding: 14px 16px;
      overflow-x: auto;
      overflow-y: hidden;
      display: flex;
      gap: var(--gap);
      align-items: flex-start;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,.20) transparent;
    }
    .cards-panel::-webkit-scrollbar{ height: 10px; }
    .cards-panel::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.18); border-radius: 999px; }

    .user-card{
      width: 480px;
      height: 900px;
      border-radius: var(--radius2);
      border: 1px solid rgba(255,255,255,.10);
      background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.03));
      box-shadow: 0 14px 40px rgba(0,0,0,.35);
      overflow: hidden;
      display: grid;
      grid-template-rows: 62px 300px 300px 180px 120px;
    }

    .card-head{
      padding: 12px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,.10);
      background: rgba(0,0,0,.10);
    }

    .u-title{ display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .u-name{
      font-size: 14px;
      font-weight: 800;
      letter-spacing: .2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 320px;
    }
    .u-sub{
      font-size: 12px;
      color: var(--muted);
      font-weight: 600;
      display: flex;
      gap: 8px;
    }
    .badge{
      font-size: 11px;
      font-weight: 800;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.04);
      color: var(--muted);
      white-space: nowrap;
    }
    .badge.bad{ border-color: rgba(239,71,111,.45); background: rgba(239,71,111,.10); color: rgba(255,255,255,.92); }

    .blk{
      padding: 10px 10px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      position: relative;
    }
    .blk:last-child{ border-bottom: none; }

    .blk-title{
      position: absolute;
      left: 12px;
      top: 10px;
      font-size: 12px;
      font-weight: 800;
      color: rgba(255,255,255,.86);
      letter-spacing: .1px;
      z-index: 2;
      text-shadow: 0 2px 8px rgba(0,0,0,.45);
    }

    canvas{ width: 100% !important; height: 100% !important; }

    .placeholder{
      width: 100%;
      height: 100%;
      border-radius: 14px;
      border: 1px dashed rgba(255,255,255,.18);
      background: rgba(0,0,0,.12);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      font-weight: 800;
      font-size: 12px;
      text-align: center;
      padding: 0 12px;
    }

    .table-wrap{
      height: 100%;
      padding-top: 20px;
      display: flex;
      align-items: stretch;
      justify-content: center;
    }
    table{
      width: 330px;
      border-collapse: collapse;
      font-size: 12px;
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 14px;
      overflow: hidden;
      background: rgba(0,0,0,.10);
    }
    thead th{
      position: sticky;
      top: 0;
      background: rgba(255,255,255,.06);
      color: rgba(255,255,255,.86);
      font-weight: 900;
      text-align: left;
      padding: 8px 8px;
      border-bottom: 1px solid rgba(255,255,255,.12);
      cursor: pointer;
      user-select: none;
    }
    tbody td{
      padding: 7px 8px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      color: rgba(255,255,255,.86);
      vertical-align: top;
    }
    tbody tr:last-child td{ border-bottom: none; }

    .right{ text-align: right; }
    .tiny{ font-size: 11px; color: var(--muted); font-weight: 700; }

    .bottom-panel{
      padding: 12px 16px;
      border-top: 1px solid var(--line);
      background: rgba(255,255,255,.02);
      overflow: hidden;
    }
    .bottom-grid{
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 12px;
      height: 100%;
    }
    .bcard{
      border-radius: var(--radius);
      border: 1px solid rgba(255,255,255,.10);
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      overflow: hidden;
      position: relative;
      padding: 10px;
    }
    .btitle{
      position: absolute;
      left: 12px;
      top: 10px;
      font-size: 12px;
      font-weight: 900;
      color: rgba(255,255,255,.86);
      z-index: 2;
      text-shadow: 0 2px 8px rgba(0,0,0,.45);
    }

    .toast{
      position: absolute;
      right: 16px;
      bottom: 16px;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(0,0,0,.55);
      border: 1px solid rgba(255,255,255,.12);
      color: rgba(255,255,255,.86);
      font-size: 12px;
      font-weight: 700;
      display: none;
      max-width: 520px;
    }
    .toast.show{ display: block; }
  </style>
</head>

<body>
  <div class="frame" id="frame">
    <div class="topbar">
      <div class="brand">
        <div>Xray Usage</div>
        <div class="range" id="range">—</div>
      </div>

      <div class="controls">
        <div class="seg" id="unitSeg">
          <button data-unit="GB" class="active">GB</button>
          <button data-unit="MB">MB</button>
        </div>
        <button class="btn primary" id="refreshBtn">Обновить</button>
        <div class="chip" id="statusChip">loading…</div>
      </div>
    </div>

    <div class="user-filter">
      <div class="wrap" id="userFilter"></div>
      <div class="chip">клик по заголовку таблицы → сортировка</div>
    </div>

    <div class="main">
      <div class="cards-panel" id="cardsPanel"></div>
      <div class="bottom-panel">
        <div class="bottom-grid" id="bottomGrid"></div>
      </div>
    </div>

    <div class="toast" id="toast"></div>
  </div>

<script>
  Chart.register(ChartDataLabels);

  function applyScale(){
    const frame = document.getElementById('frame');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / 2240, vh / 1260, 1);
    frame.style.transform = `scale(${scale})`;
  }
  window.addEventListener('resize', applyScale);
  applyScale();

  const state = {
    unit: "GB",
    data: null,
    charts: new Map(),
    selectedUsers: new Set(),
    etag: null
  };

  function fmtNum(x, digits=2){
    if (!isFinite(x)) return "0";
    return Number(x).toFixed(digits);
  }
  function bytesTo(unit, bytes){
    return unit === "MB" ? (bytes / 1_000_000.0) : (bytes / 1_000_000_000.0);
  }
  function formatTraffic(unit, bytes){
    const v = bytesTo(unit, bytes);
    const d = unit === "MB" ? 1 : 2;
    return `${fmtNum(v, d)} ${unit}`;
  }

  function showToast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._tm);
    showToast._tm = setTimeout(()=>t.classList.remove('show'), 2400);
  }

  function makeBarGradient(ctx, isWarn=false){
    const {chart} = ctx;
    const {ctx: c, chartArea} = chart;
    if (!chartArea) return 'rgba(255,255,255,.25)';
    const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    if (isWarn){
      g.addColorStop(0, 'rgba(255,183,3,.85)');
      g.addColorStop(1, 'rgba(255,183,3,.12)');
    } else {
      g.addColorStop(0, 'rgba(96,211,148,.85)');
      g.addColorStop(1, 'rgba(96,211,148,.10)');
    }
    return g;
  }

  function makeLineGradient(chart, isWarn=false){
    const {ctx: c, chartArea} = chart;
    if (!chartArea) return 'rgba(255,255,255,.25)';
    const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    if (isWarn){
      g.addColorStop(0, 'rgba(239,71,111,.55)');
      g.addColorStop(1, 'rgba(239,71,111,.05)');
    } else {
      g.addColorStop(0, 'rgba(86,104,255,.55)');
      g.addColorStop(1, 'rgba(86,104,255,.05)');
    }
    return g;
  }

  function baseChartOptions(){
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0,0,0,.75)',
          borderColor: 'rgba(255,255,255,.14)',
          borderWidth: 1,
          titleColor: 'rgba(255,255,255,.92)',
          bodyColor: 'rgba(255,255,255,.86)'
        },
        datalabels: {
          color: 'rgba(255,255,255,.92)',
          font: { weight: '800', size: 11 },
          anchor: 'center',
          align: 'center',
          clamp: true
        }
      },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,.68)', font: {weight: '700', size: 11 } },
          grid: { color: 'rgba(255,255,255,.07)' }
        },
        y: {
          ticks: { color: 'rgba(255,255,255,.60)', font: {weight: '700', size: 11 } },
          grid: { color: 'rgba(255,255,255,.07)' }
        }
      }
    }
  }

  function buildTrafficBar(canvas, labels, bytesArr, anomalyDaysSet){
    const unit = state.unit;
    const data = bytesArr.map(b => bytesTo(unit, b));
    const opts = baseChartOptions();
    opts.plugins.datalabels.formatter = (v)=> (v === 0 ? '' : fmtNum(v, unit === "MB" ? 1 : 2));
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: (ctx)=>{
            const idx = ctx.dataIndex ?? 0;
            const day = labels[idx];
            return makeBarGradient(ctx, anomalyDaysSet.has(day));
          },
          borderRadius: 10,
          maxBarThickness: 42
        }]
      },
      options: opts
    });
  }

  function buildConnsBar(canvas, labels, countsArr){
    const opts = baseChartOptions();
    opts.plugins.datalabels.formatter = (v)=> (v === 0 ? '' : String(Math.round(v)));
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: countsArr,
          backgroundColor: (ctx)=> makeBarGradient(ctx, false),
          borderRadius: 10,
          maxBarThickness: 42
        }]
      },
      options: opts
    });
  }

  function buildLine(canvas, labels, values, isTraffic=false){
    const opts = baseChartOptions();
    opts.plugins.datalabels.align = 'top';
    opts.plugins.datalabels.anchor = 'end';
    opts.plugins.datalabels.formatter = (v)=>{
      if (!v) return '';
      if (isTraffic) return fmtNum(v, state.unit === "MB" ? 1 : 2);
      return String(Math.round(v));
    };
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          fill: true,
          backgroundColor: (ctx)=> makeLineGradient(ctx.chart, false),
          borderColor: 'rgba(255,255,255,.55)',
          pointRadius: 3,
          pointHoverRadius: 4,
          tension: .32
        }]
      },
      options: opts
    });
  }

  function clearNode(el){ while (el.firstChild) el.removeChild(el.firstChild); }

  function createToggle(label, onClick, classes=''){
    const b = document.createElement('div');
    b.className = `toggle ${classes}`.trim();
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function escapeHtml(s){
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  }
  function shorten(s, n){
    s = String(s);
    if (s.length <= n) return s;
    return s.slice(0, n-1) + '…';
  }

  function buildUserFilter(users){
    const wrap = document.getElementById('userFilter');
    clearNode(wrap);

    const allBtn = createToggle('Все', ()=>{
      const allOn = state.selectedUsers.size !== users.length;
      state.selectedUsers = new Set(allOn ? users : []);
      syncToggles();
      syncCardsVisibility();
    }, 'warn');
    allBtn.dataset.user = '__ALL__';
    wrap.appendChild(allBtn);

    users.forEach(u=>{
      const btn = createToggle(u, ()=>{
        if (state.selectedUsers.has(u)) state.selectedUsers.delete(u);
        else state.selectedUsers.add(u);
        syncToggles();
        syncCardsVisibility();
      });
      btn.dataset.user = u;
      wrap.appendChild(btn);
    });

    state.selectedUsers = new Set(users);
    syncToggles();
  }

  function syncToggles(){
    document.querySelectorAll('.toggle').forEach(el=>{
      const u = el.dataset.user;
      if (u === '__ALL__'){
        const users = state.data?.users || [];
        el.classList.toggle('on', state.selectedUsers.size === users.length);
        return;
      }
      el.classList.toggle('on', state.selectedUsers.has(u));
    });
  }

  function syncCardsVisibility(){
    document.querySelectorAll('.user-card').forEach(card=>{
      const u = card.dataset.user;
      card.style.display = state.selectedUsers.has(u) ? 'grid' : 'none';
    });
  }

  function enableSort(table, rows, mode){
    table.querySelector('thead').addEventListener('click', (e)=>{
      const th = e.target.closest('th');
      if (!th) return;
      const key = th.dataset.key;
      if (!key) return;

      const dir = (table.dataset.sort === key && table.dataset.dir === 'desc') ? 'asc' : 'desc';
      table.dataset.sort = key;
      table.dataset.dir = dir;

      let sorted = [...rows];
      sorted.sort((a,b)=>{
        let av, bv;
        if (mode === 'traffic'){
          if (key === 'domain'){ av = a.domain; bv = b.domain; }
          else { av = a.bytes; bv = b.bytes; }
        } else {
          if (key === 'domain'){ av = a.domain; bv = b.domain; }
          else { av = a.count; bv = b.count; }
        }
        if (typeof av === 'string'){
          const res = av.localeCompare(bv);
          return dir === 'asc' ? res : -res;
        }
        const res = av - bv;
        return dir === 'asc' ? res : -res;
      });

      const tbody = table.querySelector('tbody');
      clearNode(tbody);

      if (mode === 'traffic'){
        sorted.forEach(r=>{
          const gb = r.bytes / 1_000_000_000;
          const mb = r.bytes / 1_000_000;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td title="${r.domain}">${escapeHtml(shorten(r.domain, 34))}</td>
            <td class="right">${fmtNum(gb, 3)}<div class="tiny">${fmtNum(r.pct, 1)}%</div></td>
            <td class="right">${fmtNum(mb, 1)}<div class="tiny">${fmtNum(r.pct, 1)}%</div></td>
          `;
          tbody.appendChild(tr);
        });
      } else {
        sorted.forEach(r=>{
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td title="${r.domain}">${escapeHtml(shorten(r.domain, 34))}</td>
            <td class="right">${r.count}<div class="tiny">${fmtNum(r.pct, 1)}%</div></td>
          `;
          tbody.appendChild(tr);
        });
      }
    });
  }

  function buildTableTraffic(rows){
    const table = document.createElement('table');
    table.dataset.sort = 'bytes';
    table.dataset.dir = 'desc';
    table.innerHTML = `
      <thead>
        <tr>
          <th data-key="domain">Domain</th>
          <th data-key="gb" class="right">GB</th>
          <th data-key="mb" class="right">MB</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    rows.forEach(r=>{
      const gb = r.bytes / 1_000_000_000;
      const mb = r.bytes / 1_000_000;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td title="${r.domain}">${escapeHtml(shorten(r.domain, 34))}</td>
        <td class="right">${fmtNum(gb, 3)}<div class="tiny">${fmtNum(r.pct, 1)}%</div></td>
        <td class="right">${fmtNum(mb, 1)}<div class="tiny">${fmtNum(r.pct, 1)}%</div></td>
      `;
      tbody.appendChild(tr);
    });
    enableSort(table, rows, 'traffic');
    return table;
  }

  function buildTableConns(rows){
    const table = document.createElement('table');
    table.dataset.sort = 'count';
    table.dataset.dir = 'desc';
    table.innerHTML = `
      <thead>
        <tr>
          <th data-key="domain">Domain</th>
          <th data-key="count" class="right">Count</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td title="${r.domain}">${escapeHtml(shorten(r.domain, 34))}</td>
        <td class="right">${r.count}<div class="tiny">${fmtNum(r.pct, 1)}%</div></td>
      `;
      tbody.appendChild(tr);
    });
    enableSort(table, rows, 'conns');
    return table;
  }

  function userSubtitle(uobj){
    const tot = uobj.totals || {};
    const t = tot.traffic_7d_bytes || 0;
    const c = tot.conns_7d || 0;
    return `7д: ${formatTraffic(state.unit, t)} • conns: ${c}`;
  }

  function buildUserCards(payload){
    const panel = document.getElementById('cardsPanel');
    clearNode(panel);
    state.charts.forEach(ch => ch.destroy());
    state.charts.clear();

    const days = payload.meta.days;

    payload.users.forEach(u=>{
      const uobj = payload.per_user[u];
      const anomalyDays = (uobj.totals?.anomaly_days || []);
      const anomalySet = new Set(anomalyDays);

      const card = document.createElement('div');
      card.className = 'user-card';
      card.dataset.user = u;

      const head = document.createElement('div');
      head.className = 'card-head';
      head.innerHTML = `
        <div class="u-title">
          <div class="u-name">${escapeHtml(u)}</div>
          <div class="u-sub"><span>${escapeHtml(userSubtitle(uobj))}</span></div>
        </div>
        <div>${anomalyDays.length ? `<span class="badge bad">аномалий: ${anomalyDays.length}</span>` : `<span class="badge">ok</span>`}</div>
      `;
      card.appendChild(head);

      const blk1 = document.createElement('div');
      blk1.className = 'blk';
      blk1.innerHTML = `<div class="blk-title">Трафик по дням (7 дней)</div>`;
      const trafficCanvas = document.createElement('canvas');
      blk1.appendChild(trafficCanvas);
      card.appendChild(blk1);

      const blk2 = document.createElement('div');
      blk2.className = 'blk';
      blk2.innerHTML = `<div class="blk-title">Подключения по дням (7 дней)</div>`;
      const connsCanvas = document.createElement('canvas');
      blk2.appendChild(connsCanvas);
      card.appendChild(blk2);

      const blk3 = document.createElement('div');
      blk3.className = 'blk';
      blk3.innerHTML = `<div class="blk-title">ТОП-10 доменов по трафику</div>`;
      const tw1 = document.createElement('div');
      tw1.className = 'table-wrap';
      blk3.appendChild(tw1);
      card.appendChild(blk3);

      const blk4 = document.createElement('div');
      blk4.className = 'blk';
      blk4.innerHTML = `<div class="blk-title">ТОП-10 доменов по подключениям</div>`;
      const tw2 = document.createElement('div');
      tw2.className = 'table-wrap';
      blk4.appendChild(tw2);
      card.appendChild(blk4);

      panel.appendChild(card);

      const tByDay = uobj.traffic_by_day_bytes || {};
      const cByDay = uobj.conns_by_day || {};
      const trafficArr = days.map(d => tByDay[d] || 0);
      const connsArr = days.map(d => cByDay[d] || 0);

      if (!trafficArr.some(v => v > 0)){
        blk1.innerHTML = `<div class="blk-title">Трафик по дням (7 дней)</div><div class="placeholder">Нет данных за последние 7 дней</div>`;
      } else {
        state.charts.set(`u:${u}:t`, buildTrafficBar(trafficCanvas, days, trafficArr, anomalySet));
      }

      if (!connsArr.some(v => v > 0)){
        blk2.innerHTML = `<div class="blk-title">Подключения по дням (7 дней)</div><div class="placeholder">Нет данных за последние 7 дней</div>`;
      } else {
        state.charts.set(`u:${u}:c`, buildConnsBar(connsCanvas, days, connsArr));
      }

      const tRows = uobj.top_domains_traffic || [];
      const cRows = uobj.top_domains_conns || [];

      tw1.innerHTML = '';
      tw1.appendChild(tRows.length ? buildTableTraffic(tRows) : Object.assign(document.createElement('div'), {className:'placeholder', textContent:'Нет данных за последние 7 дней'}));

      tw2.innerHTML = '';
      tw2.appendChild(cRows.length ? buildTableConns(cRows) : Object.assign(document.createElement('div'), {className:'placeholder', textContent:'Нет данных за последние 7 дней'}));
    });

    syncCardsVisibility();
  }

  function buildBottom(payload){
    const grid = document.getElementById('bottomGrid');
    grid.innerHTML = '';

    const days = payload.meta.days;
    const dailyTrafficBytes = payload.global.daily_traffic_bytes || {};
    const dailyConns = payload.global.daily_conns || {};

    const dailyTraffic = days.map(d => bytesTo(state.unit, dailyTrafficBytes[d] || 0));
    const dailyConnArr = days.map(d => dailyConns[d] || 0);

    const cumTrafficBytes = payload.global.cumulative_traffic_bytes || [];
    const cumConns = payload.global.cumulative_conns || [];
    const cumTraffic = cumTrafficBytes.map(b => bytesTo(state.unit, b || 0));

    const hasAny = dailyTraffic.some(v => v > 0) || dailyConnArr.some(v => v > 0);

    const cards = [
      {title:`Кумулятивный трафик (${state.unit})`, key:'cum_t', values:cumTraffic, isTraffic:true},
      {title:'Кумулятивные подключения', key:'cum_c', values:cumConns, isTraffic:false},
      {title:`Ежедневный трафик (${state.unit})`, key:'day_t', values:dailyTraffic, isTraffic:true, bar:true},
      {title:'Ежедневные подключения', key:'day_c', values:dailyConnArr, isTraffic:false, bar:true}
    ];

    cards.forEach((c)=>{
      const bc = document.createElement('div');
      bc.className = 'bcard';
      bc.innerHTML = `<div class="btitle">${c.title}</div>`;
      const canvas = document.createElement('canvas');
      bc.appendChild(canvas);
      grid.appendChild(bc);

      if (!hasAny){
        bc.innerHTML = `<div class="btitle">${c.title}</div><div class="placeholder" style="position:absolute;inset:10px;">Нет данных за последние 7 дней</div>`;
        return;
      }

      let ch;
      if (!c.bar){
        ch = buildLine(canvas, days, c.values, c.isTraffic);
      } else {
        const opts = baseChartOptions();
        if (c.key === 'day_t'){
          opts.plugins.datalabels.formatter = (v)=> (v === 0 ? '' : fmtNum(v, state.unit === "MB" ? 1 : 2));
          const thresholdBytes = (payload.meta.anomaly_gb_per_day || 1.0) * 1_000_000_000;
          const anomalySet = new Set();
          days.forEach(d=>{ if ((dailyTrafficBytes[d] || 0) >= thresholdBytes) anomalySet.add(d); });

          ch = new Chart(canvas, {
            type:'bar',
            data:{ labels: days, datasets:[{
              data: c.values,
              backgroundColor: (ctx)=> makeBarGradient(ctx, anomalySet.has(days[ctx.dataIndex ?? 0])),
              borderRadius: 10,
              maxBarThickness: 42
            }]},
            options: opts
          });
        } else {
          opts.plugins.datalabels.formatter = (v)=> (v === 0 ? '' : String(Math.round(v)));
          ch = new Chart(canvas, {
            type:'bar',
            data:{ labels: days, datasets:[{
              data: c.values,
              backgroundColor: (ctx)=> makeBarGradient(ctx, false),
              borderRadius: 10,
              maxBarThickness: 42
            }]},
            options: opts
          });
        }
      }
      state.charts.set(`bottom:${c.key}`, ch);
    });
  }

  function updateRangeText(payload){
    const days = payload.meta.days || [];
    const el = document.getElementById('range');
    if (!days.length){ el.textContent = 'нет данных'; return; }
    el.textContent = `${days[0]} → ${days[days.length-1]} • ${payload.meta.generated_at_utc || ''}`;
  }

  function updateStatus(ok, msg){
    const chip = document.getElementById('statusChip');
    chip.textContent = msg;
    chip.style.borderColor = ok ? 'rgba(96,211,148,.35)' : 'rgba(239,71,111,.35)';
    chip.style.background = ok ? 'rgba(96,211,148,.10)' : 'rgba(239,71,111,.10)';
    chip.style.color = 'rgba(255,255,255,.86)';
  }

  document.getElementById('unitSeg').addEventListener('click', (e)=>{
    const b = e.target.closest('button');
    if (!b) return;
    const unit = b.dataset.unit;
    if (!unit || unit === state.unit) return;

    state.unit = unit;
    document.querySelectorAll('#unitSeg button').forEach(x=>x.classList.toggle('active', x.dataset.unit === unit));

    if (state.data){
      buildUserCards(state.data);
      buildBottom(state.data);
      showToast(`Единицы: ${unit}`);
    }
  });

  async function loadDashboard(){
    try{
      updateStatus(true, 'loading…');
      const headers = {};
      if (state.etag) headers['If-None-Match'] = state.etag;

      const res = await fetch('/api/dashboard?days=7', {headers});
      if (res.status === 304){ updateStatus(true, 'up-to-date'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const etag = res.headers.get('ETag');
      if (etag) state.etag = etag.replaceAll('"','');

      const payload = await res.json();
      state.data = payload;

      updateRangeText(payload);
      buildUserFilter(payload.users || []);
      buildUserCards(payload);
      buildBottom(payload);

      updateStatus(true, 'ok');
    } catch(err){
      console.error(err);
      updateStatus(false, 'error');
      showToast('Ошибка загрузки данных (см. консоль)');
    }
  }

  document.getElementById('refreshBtn').addEventListener('click', ()=>{
    state.etag = null;
    loadDashboard();
  });

  loadDashboard();
  setInterval(loadDashboard, 60_000);

  document.getElementById('cardsPanel').addEventListener('wheel', (e)=>{
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)){
      e.currentTarget.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, {passive:false});
</script>
</body>
</html>
"""

if __name__ == "__main__":
    app.run(host=APP_HOST, port=APP_PORT, debug=False)

from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from typing import Any, Dict, List, Tuple

import config
import core
import re

TS1 = re.compile(r"^(?P<y>\d{4})[/-](?P<m>\d{2})[/-](?P<d>\d{2})\s+(?P<h>\d{2}):(?P<mi>\d{2}):(?P<s>\d{2})")
EMAIL1 = re.compile(r"(?:email|user)[:=]\s*(?P<email>[A-Za-z0-9_\-\.]+)")
EMAIL2 = re.compile(r"\s(?P<email>user_\d{2})\s*$")

def _slice_for(keys: List[str], all_keys: List[str], arr: List[int]) -> List[int]:
    idx = {k:i for i,k in enumerate(all_keys)}
    out = []
    for k in keys:
        out.append(arr[idx[k]] if k in idx else 0)
    return out

def aggregate(to_ymd: str, days: int = 14) -> Dict[str, Any]:
    """
    payload compatible with old UI:
      meta: keys_all, last7, prev7
      global: daily_traffic_bytes, daily_conns, cumulative_*, prev_*
      users: {user: {alias, daily_..., prev_daily_..., sum7_..., top_domains_*}}
    """
    to_day = core.parse_ymd(to_ymd)
    days = core.clamp(int(days), 7, 31)
    ds = [to_day - timedelta(days=i) for i in range(days - 1, -1, -1)]
    keys_all = [core.fmt_ymd(d) for d in ds]
    last_keys = keys_all[-7:]
    prev_keys = keys_all[-14:-7] if len(keys_all) >= 14 else []

    aliases = core.get_aliases()

    # prepare accumulators (all days range)
    users_set = set()
    u_bytes_all: Dict[str, List[int]] = {}
    u_conns_all: Dict[str, List[int]] = {}
    g_bytes_all = [0]*len(keys_all)
    g_conns_all = [0]*len(keys_all)

    # usage_*.csv
    for i,k in enumerate(keys_all):
        p = config.DATA_DIR / f"usage_{k}.csv"
        if not p.exists():
            continue
        for r in core.read_csv(p):
            u = (r.get("user") or "").strip()
            if not u:
                continue
            b = core.safe_bytes(r.get("total_bytes") or 0)
            users_set.add(u)
            u_bytes_all.setdefault(u, [0]*len(keys_all))[i] += b
            g_bytes_all[i] += b

    # conns_*.csv
    for i,k in enumerate(keys_all):
        p = config.DATA_DIR / f"conns_{k}.csv"
        if not p.exists():
            continue
        for r in core.read_csv(p):
            u = (r.get("user") or "").strip()
            if not u:
                continue
            c = core.safe_int(r.get("conn_count") or 0)
            users_set.add(u)
            u_conns_all.setdefault(u, [0]*len(keys_all))[i] += c
            g_conns_all[i] += c

    # top domains from report / conns for last 7 days only
    per_t_last: Dict[str, Dict[str, int]] = {}
    per_c_last: Dict[str, Dict[str, int]] = {}
    glob_t_last: Dict[str, int] = {}
    glob_c_last: Dict[str, int] = {}

    for k in last_keys:
        rp = config.DATA_DIR / f"report_{k}.csv"
        if rp.exists():
            for r in core.read_csv(rp):
                u = (r.get("user") or "").strip()
                dst = (r.get("dst") or "").strip()
                if not u or not dst:
                    continue
                b = core.safe_bytes(r.get("traffic_bytes") or 0)
                per_t_last.setdefault(u, {}).setdefault(dst, 0)
                per_t_last[u][dst] += b
                glob_t_last[dst] = glob_t_last.get(dst, 0) + b

        cp = config.DATA_DIR / f"conns_{k}.csv"
        if cp.exists():
            for r in core.read_csv(cp):
                u = (r.get("user") or "").strip()
                dst = (r.get("dst") or "").strip()
                if not u or not dst:
                    continue
                c = core.safe_int(r.get("conn_count") or 0)
                per_c_last.setdefault(u, {}).setdefault(dst, 0)
                per_c_last[u][dst] += c
                glob_c_last[dst] = glob_c_last.get(dst, 0) + c

    # cumulative global
    cum_b=[]; cum_c=[]
    acc_b=0; acc_c=0
    for b,c in zip(g_bytes_all, g_conns_all):
        acc_b += b; acc_c += c
        cum_b.append(acc_b); cum_c.append(acc_c)

    users_sorted = sorted(users_set)

    users_payload: Dict[str, Any] = {}
    for u in users_sorted:
        b_all = u_bytes_all.get(u, [0]*len(keys_all))
        c_all = u_conns_all.get(u, [0]*len(keys_all))

        b_last = _slice_for(last_keys, keys_all, b_all)
        c_last = _slice_for(last_keys, keys_all, c_all)
        b_prev = _slice_for(prev_keys, keys_all, b_all) if prev_keys else [0]*7
        c_prev = _slice_for(prev_keys, keys_all, c_all) if prev_keys else [0]*7

        users_payload[u] = {
            "alias": (aliases.get(u) or "").strip(),
            "daily_traffic_bytes": b_last,
            "daily_conns": c_last,
            "prev_daily_traffic_bytes": b_prev,
            "prev_daily_conns": c_prev,
            "sum7_traffic_bytes": sum(b_last),
            "sum7_conns": sum(c_last),
            "sum_prev7_traffic_bytes": sum(b_prev),
            "sum_prev7_conns": sum(c_prev),
            "top_domains_traffic": core.topn(per_t_last.get(u, {}), 10),
            "top_domains_conns": core.topn(per_c_last.get(u, {}), 10),
            "anomaly": any(x >= 1_000_000_000 for x in b_last),
        }

    # global prev window
    g_last = {
        "daily_traffic_bytes": _slice_for(last_keys, keys_all, g_bytes_all),
        "daily_conns": _slice_for(last_keys, keys_all, g_conns_all),
    }
    g_prev = {
        "daily_traffic_bytes": _slice_for(prev_keys, keys_all, g_bytes_all) if prev_keys else [0]*7,
        "daily_conns": _slice_for(prev_keys, keys_all, g_conns_all) if prev_keys else [0]*7,
    }

    return {
        "meta": {
            "to": to_ymd,
            "days": days,
            "keys_all": keys_all,
            "last7": last_keys,
            "prev7": prev_keys if prev_keys else [],
        },
        "global": {
            "daily_traffic_bytes": g_last["daily_traffic_bytes"],
            "daily_conns": g_last["daily_conns"],
            "cumulative_traffic_bytes": cum_b,
            "cumulative_conns": cum_c,
            "prev_daily_traffic_bytes": g_prev["daily_traffic_bytes"],
            "prev_daily_conns": g_prev["daily_conns"],
            "top_domains_traffic": core.topn(glob_t_last, 10),
            "top_domains_conns": core.topn(glob_c_last, 10),
        },
        "users": users_payload,
    }

def all_time_stats() -> Dict[str, Any]:
    # all users known in xray config (so stats match admin list)
    import xray
    clients = xray.list_clients(with_links=False)
    users = [c["email"] for c in clients if c.get("email")]

    traffic_total: Dict[str, int] = {u: 0 for u in users}
    conns_total: Dict[str, int] = {u: 0 for u in users}
    days_used: Dict[str, set] = {u: set() for u in users}
    top_dom: Dict[str, Dict[str, int]] = {u: {} for u in users}

    for ymd in core.list_dates("usage"):
        up = config.DATA_DIR / f"usage_{ymd}.csv"
        if up.exists():
            for r in core.read_csv(up):
                u = (r.get("user") or "").strip()
                if u in traffic_total:
                    traffic_total[u] += core.safe_bytes(r.get("total_bytes") or 0)
                    days_used[u].add(ymd)

        cp = config.DATA_DIR / f"conns_{ymd}.csv"
        if cp.exists():
            for r in core.read_csv(cp):
                u = (r.get("user") or "").strip()
                if u in conns_total:
                    conns_total[u] += core.safe_int(r.get("conn_count") or 0)

        rp = config.DATA_DIR / f"report_{ymd}.csv"
        if rp.exists():
            for r in core.read_csv(rp):
                u = (r.get("user") or "").strip()
                dst = (r.get("dst") or "").strip()
                if u in top_dom and dst:
                    top_dom[u][dst] = top_dom[u].get(dst, 0) + core.safe_bytes(r.get("traffic_bytes") or 0)

    out=[]
    for u in users:
        out.append({
            "user": u,
            "traffic_bytes": traffic_total.get(u,0),
            "conns": conns_total.get(u,0),
            "days": len(days_used.get(u,set())),
            "top_domains_traffic": core.topn(top_dom.get(u,{}), 5),
        })
    out = sorted(out, key=lambda x: x["traffic_bytes"], reverse=True)
    return {"users": out}

def _parse_access_events(target_ymd: str) -> List[Tuple[str,int]]:
    p = config.ACCESS_LOG
    if not p.exists():
        return []
    events=[]
    with p.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            m = TS1.search(line)
            if not m:
                continue
            ymd = f"{m.group('y')}-{m.group('m')}-{m.group('d')}"
            if ymd != target_ymd:
                continue
            h=int(m.group("h")); mi=int(m.group("mi"))
            mm=h*60+mi
            em = EMAIL1.search(line) or EMAIL2.search(line)
            if not em:
                continue
            email = (em.group("email") or "").strip()
            if email:
                events.append((email, mm))
    return events

def sessions_day(target_ymd: str, gran_min: int = 5) -> Dict[str, Any]:
    gran_min = core.clamp(int(gran_min), 1, 60)
    slots = (24*60)//gran_min

    import xray
    users = [c["email"] for c in xray.list_clients(with_links=False) if c.get("email")]
    active: Dict[str, List[int]] = {u:[0]*slots for u in users}

    for email, mm in _parse_access_events(target_ymd):
        if email not in active:
            continue
        idx = min(slots-1, mm//gran_min)
        active[email][idx] = 1

    durations = {u: sum(active[u])*gran_min for u in users}
    top = sorted(durations.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "date": target_ymd,
        "gran_min": gran_min,
        "slots": slots,
        "users": users,
        "active": active,
        "top": [{"user": u, "minutes": m} for u,m in top],
    }

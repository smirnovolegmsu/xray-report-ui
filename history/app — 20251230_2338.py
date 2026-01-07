from __future__ import annotations

import base64
import csv
import glob
import json
import os
import re
import shlex
import subprocess
import time
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional
from urllib.parse import urlparse, parse_qs

from flask import Flask, Response, jsonify, request, send_file

APP_HOST = os.environ.get("XRAY_UI_HOST", "127.0.0.1")
APP_PORT = int(os.environ.get("XRAY_UI_PORT", "8090"))

DATA_DIR = os.environ.get("XRAY_USAGE_DIR", "/var/log/xray/usage")
XRAY_CFG = os.environ.get("XRAY_CFG", "/usr/local/etc/xray/config.json")
XRAY_SERVICE = os.environ.get("XRAY_SERVICE", "xray")

# если хочешь жёстко зафиксировать inbound:
# export XRAY_REALITY_INBOUND_TAG="inbound-tag"
XRAY_REALITY_INBOUND_TAG = os.environ.get("XRAY_REALITY_INBOUND_TAG", "").strip()

UI_PATH = Path(os.environ.get("XRAY_UI_INDEX", "/opt/xray-report-ui/index.html"))

STATE_DIR = Path(os.environ.get("XRAY_UI_STATE_DIR", "/opt/xray-report-ui/state"))
STATE_DIR.mkdir(parents=True, exist_ok=True)

ALIASES_PATH = STATE_DIR / "user_aliases.json"
SETTINGS_PATH = STATE_DIR / "ui_settings.json"

ACCESS_LOG = os.environ.get("XRAY_ACCESS_LOG", "/var/log/xray/access.log")

PBK_ENV = os.environ.get("XRAY_REALITY_PBK", "").strip()
PUBLIC_HOST_ENV = os.environ.get("XRAY_PUBLIC_HOST", "").strip()

DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")

app = Flask(__name__)


@app.after_request
def no_cache(resp: Response):
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


def _jload(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _jsave(path: Path, obj: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def get_settings() -> Dict[str, Any]:
    s = _jload(SETTINGS_PATH, {})
    if not isinstance(s, dict):
        s = {}
    if PUBLIC_HOST_ENV:
        s["public_host"] = PUBLIC_HOST_ENV
    if PBK_ENV:
        tmpl = s.get("reality_template") or {}
        if not isinstance(tmpl, dict):
            tmpl = {}
        tmpl["pbk"] = PBK_ENV
        s["reality_template"] = tmpl
    if XRAY_REALITY_INBOUND_TAG:
        s["inbound_tag"] = XRAY_REALITY_INBOUND_TAG
    return s


def save_settings(patch: Dict[str, Any]) -> Dict[str, Any]:
    cur = get_settings()
    for k, v in patch.items():
        cur[k] = v
    _jsave(SETTINGS_PATH, cur)
    return cur


def _read_csv(path: Path):
    with path.open("r", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            yield row


def _safe_int(x: Any) -> int:
    try:
        return int(x)
    except Exception:
        return 0


def _safe_bytes(x: Any) -> int:
    try:
        return int(x)
    except Exception:
        return 0


def _parse_ymd(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def _fmt_ymd(d: date) -> str:
    return d.strftime("%Y-%m-%d")


def list_dates(prefix: str) -> List[str]:
    out: List[str] = []
    for p in glob.glob(str(Path(DATA_DIR) / f"{prefix}_*.csv")):
        m = DATE_RE.search(Path(p).name)
        if m:
            out.append(m.group(1))
    return sorted(set(out))


def _load_xray_cfg() -> Dict[str, Any]:
    return json.loads(Path(XRAY_CFG).read_text(encoding="utf-8"))


def _save_xray_cfg(cfg: Dict[str, Any]) -> None:
    Path(XRAY_CFG).write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")


def _is_reality_vless(ib: Dict[str, Any]) -> bool:
    if (ib.get("protocol") or "").lower() != "vless":
        return False
    ss = ib.get("streamSettings") or {}
    if (ss.get("security") or "").lower() != "reality":
        return False
    return True


def _get_reality_inbound(cfg: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    """
    Важно: если несколько vless+reality — выбираем самый вероятный:
    1) по inbound_tag (settings/env) если задан
    2) иначе inbound с port=443
    3) иначе первый подходящий
    """
    inbounds = cfg.get("inbounds", []) or []
    cand: List[Tuple[int, Dict[str, Any]]] = [(i, ib) for i, ib in enumerate(inbounds) if isinstance(ib, dict) and _is_reality_vless(ib)]
    if not cand:
        raise RuntimeError("VLESS+Reality inbound not found in xray config")

    s = get_settings()
    prefer_tag = (s.get("inbound_tag") or "").strip()
    if prefer_tag:
        for i, ib in cand:
            if (ib.get("tag") or "").strip() == prefer_tag:
                return i, ib

    for i, ib in cand:
        try:
            if int(ib.get("port") or 0) == 443:
                return i, ib
        except Exception:
            pass

    return cand[0]


PBK_RE = re.compile(r"Public\s*key:\s*([A-Za-z0-9_\-]{20,})", re.IGNORECASE)


def _screen_has(name: str) -> bool:
    p = subprocess.run(["screen", "-ls"], capture_output=True, text=True)
    return name in (p.stdout or "")


def _ensure_screen(name: str) -> None:
    if _screen_has(name):
        return
    subprocess.run(["screen", "-dmS", name, "bash"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _run_in_vpn_screen(tag: str, cmd: str, timeout_s: float = 4.0) -> Dict[str, Any]:
    """
    Выполняет команду внутри screen -S vpn (НЕ убивая сессию).
    Пишет вывод в /tmp/xui_*.
    """
    _ensure_screen("vpn")
    outp = Path(f"/tmp/xui_{tag}.out")
    rcp = Path(f"/tmp/xui_{tag}.rc")
    for p in (outp, rcp):
        try:
            p.unlink()
        except FileNotFoundError:
            pass
        except Exception:
            pass

    bash_cmd = f"{cmd} >{outp} 2>&1; echo $? >{rcp}"
    payload = "bash -lc " + shlex.quote(bash_cmd) + "\n"
    subprocess.run(["screen", "-S", "vpn", "-X", "stuff", payload], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    t0 = time.time()
    while time.time() - t0 < timeout_s and not rcp.exists():
        time.sleep(0.05)

    out = outp.read_text(encoding="utf-8", errors="replace") if outp.exists() else ""
    rc = None
    if rcp.exists():
        try:
            rc = int((rcp.read_text(encoding="utf-8", errors="replace") or "0").strip() or "0")
        except Exception:
            rc = None
    out = out[-20000:]
    return {"ok": (rc == 0), "rc": rc, "output": out}


def _derive_pbk_from_private(private_b64: str) -> str:
    private_b64 = (private_b64 or "").strip()
    if not private_b64:
        raise RuntimeError("realitySettings.privateKey is empty")

    # 1) Пытаемся напрямую
    try:
        p = subprocess.run(["xray", "x25519", "-i", private_b64], capture_output=True, text=True, timeout=2.0)
        txt = (p.stdout or "") + "\n" + (p.stderr or "")
        m = PBK_RE.search(txt)
        if m:
            return m.group(1).strip()
    except Exception:
        pass

    # 2) Пытаемся через screen vpn (по твоему требованию)
    try:
        res = _run_in_vpn_screen("x25519", f"xray x25519 -i {shlex.quote(private_b64)}", timeout_s=2.0)
        txt = res.get("output") or ""
        m = PBK_RE.search(txt)
        if m:
            return m.group(1).strip()
    except Exception:
        pass

    # 3) Fallback: cryptography
    try:
        from cryptography.hazmat.primitives.asymmetric import x25519
        from cryptography.hazmat.primitives import serialization
    except Exception as e:
        raise RuntimeError(
            "Cannot derive pbk.\n"
            "Решения:\n"
            "1) В «Управление → Импорт» вставь любую РАБОЧУЮ vless:// ссылку (где есть pbk)\n"
            "2) или поставь python3-cryptography\n"
            "3) или задай XRAY_REALITY_PBK env"
        ) from e

    pad = "=" * ((4 - len(private_b64) % 4) % 4)
    raw = base64.urlsafe_b64decode(private_b64 + pad)

    pub = x25519.X25519PrivateKey.from_private_bytes(raw).public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return base64.urlsafe_b64encode(pub).decode("utf-8").rstrip("=")


def reality_template() -> Dict[str, Any]:
    s = get_settings()
    tmpl = s.get("reality_template") if isinstance(s.get("reality_template"), dict) else {}

    needed = ["pbk", "sni", "sid", "fp", "port", "type", "flow"]
    if all((tmpl.get(k) or "").strip() if isinstance(tmpl.get(k), str) else tmpl.get(k) for k in needed):
        return tmpl

    cfg = _load_xray_cfg()
    _, ib = _get_reality_inbound(cfg)

    ss = ib.get("streamSettings") or {}
    rs = ss.get("realitySettings") or {}

    port = int(ib.get("port") or 443)
    sni = (rs.get("serverNames") or [""])[0]
    sid = (rs.get("shortIds") or [""])[0]
    fp = rs.get("fingerprint") or "chrome"

    flow = "xtls-rprx-vision"
    clients = ((ib.get("settings") or {}).get("clients") or [])
    if clients and isinstance(clients[0], dict) and (clients[0].get("flow") or "").strip():
        flow = (clients[0].get("flow") or flow).strip()

    pbk = PBK_ENV or (tmpl.get("pbk") or "").strip()
    if not pbk:
        pbk = _derive_pbk_from_private((rs.get("privateKey") or ""))

    eff = {"pbk": pbk, "sni": sni, "sid": sid, "fp": fp, "port": port, "type": "tcp", "flow": flow}
    save_settings({"reality_template": eff})
    return eff


def make_vless_link(user_email: str, user_uuid: str, host: Optional[str] = None) -> str:
    tmpl = reality_template()
    s = get_settings()
    public_host = (host or "").strip() or (s.get("public_host") or "").strip()
    if not public_host:
        # не используем request.host по умолчанию — через ssh-tunnel он будет 127.0.0.1 и ты опять получишь мёртвую ссылку
        raise RuntimeError("public_host is empty. Set it in Управление.")
    return (
        f"vless://{user_uuid}@{public_host}:{tmpl['port']}"
        f"?encryption=none&security=reality"
        f"&sni={tmpl['sni']}&fp={tmpl['fp']}&pbk={tmpl['pbk']}&sid={tmpl['sid']}"
        f"&type={tmpl['type']}&flow={tmpl['flow']}#{user_email}"
    )


def restart_xray() -> Tuple[bool, str]:
    try:
        p = subprocess.run(["systemctl", "restart", XRAY_SERVICE], capture_output=True, text=True)
        ok = (p.returncode == 0)
        msg = (p.stdout or "") + (p.stderr or "")
        return ok, msg.strip()
    except Exception as e:
        return False, str(e)


def load_domains_map(to_ymd: str) -> Dict[str, str]:
    dates = list_dates("domains")
    if not dates:
        return {}
    pick = None
    for d in dates:
        if d <= to_ymd:
            pick = d
    pick = pick or dates[-1]
    p = Path(DATA_DIR) / f"domains_{pick}.csv"
    if not p.exists():
        return {}
    mp: Dict[str, str] = {}
    for r in _read_csv(p):
        ip = (r.get("ip") or "").strip()
        dom = (r.get("domain") or "").strip()
        if ip and dom:
            mp[ip] = dom
    return mp


def dst_to_domain(dst: str, mp: Dict[str, str]) -> str:
    dst = (dst or "").strip()
    return mp.get(dst, dst) if dst else "-"


def _topn(d: Dict[str, int], n: int = 10) -> List[Dict[str, Any]]:
    items = sorted(d.items(), key=lambda x: x[1], reverse=True)[:n]
    total = sum(d.values()) or 0
    return [{"domain": dom, "value": v, "pct": (v / total * 100.0 if total else 0.0)} for dom, v in items]


def aggregate(to_ymd: str, days: int = 14) -> Dict[str, Any]:
    """
    Возвращаем ВСЕ для UI:
    - meta.days = last 7 (для оси)
    - meta.prev_days = prev 7 (для сравнения)
    - global/users: daily массивы по last 7 и prev 7
    - top domains: только по last 7 (как ты хотел)
    """
    to_day = _parse_ymd(to_ymd)
    days = max(7, min(31, int(days)))
    ds = [to_day - timedelta(days=i) for i in range(days - 1, -1, -1)]
    keys_all = [_fmt_ymd(d) for d in ds]
    last_keys = keys_all[-7:]
    prev_keys = keys_all[-14:-7] if len(keys_all) >= 14 else []

    domains = load_domains_map(to_ymd)
    aliases = _jload(ALIASES_PATH, {})
    if not isinstance(aliases, dict):
        aliases = {}

    users: set[str] = set()

    # массивы на весь период (потом порежем)
    g_bytes_all = [0] * len(keys_all)
    g_conns_all = [0] * len(keys_all)
    u_bytes_all: Dict[str, List[int]] = {}
    u_conns_all: Dict[str, List[int]] = {}

    # usage
    for i, k in enumerate(keys_all):
        p = Path(DATA_DIR) / f"usage_{k}.csv"
        if not p.exists():
            continue
        for r in _read_csv(p):
            u = (r.get("user") or "").strip()
            if not u:
                continue
            b = _safe_bytes(r.get("total_bytes") or 0)
            users.add(u)
            u_bytes_all.setdefault(u, [0] * len(keys_all))[i] += b
            g_bytes_all[i] += b

    # conns
    for i, k in enumerate(keys_all):
        p = Path(DATA_DIR) / f"conns_{k}.csv"
        if not p.exists():
            continue
        for r in _read_csv(p):
            u = (r.get("user") or "").strip()
            if not u:
                continue
            c = _safe_int(r.get("conn_count") or 0)
            users.add(u)
            u_conns_all.setdefault(u, [0] * len(keys_all))[i] += c
            g_conns_all[i] += c

    users_sorted = sorted(users)

    # top domains — только last 7
    per_t_last: Dict[str, Dict[str, int]] = {u: {} for u in users_sorted}
    per_c_last: Dict[str, Dict[str, int]] = {u: {} for u in users_sorted}
    glob_t_last: Dict[str, int] = {}
    glob_c_last: Dict[str, int] = {}

    for k in last_keys:
        rp = Path(DATA_DIR) / f"report_{k}.csv"
        if rp.exists():
            for r in _read_csv(rp):
                u = (r.get("user") or "").strip()
                if not u:
                    continue
                dom = dst_to_domain(r.get("dst") or "", domains)
                v = _safe_bytes(r.get("traffic_bytes") or 0)
                per_t_last.setdefault(u, {})
                per_t_last[u][dom] = per_t_last[u].get(dom, 0) + v
                glob_t_last[dom] = glob_t_last.get(dom, 0) + v

        cp = Path(DATA_DIR) / f"conns_{k}.csv"
        if cp.exists():
            for r in _read_csv(cp):
                u = (r.get("user") or "").strip()
                if not u:
                    continue
                dom = dst_to_domain(r.get("dst") or "", domains)
                v = _safe_int(r.get("conn_count") or 0)
                per_c_last.setdefault(u, {})
                per_c_last[u][dom] = per_c_last[u].get(dom, 0) + v
                glob_c_last[dom] = glob_c_last.get(dom, 0) + v

    def slice_for(keys: List[str], arr_all: List[int]) -> List[int]:
        idx = [keys_all.index(k) for k in keys]
        return [arr_all[i] for i in idx]

    g_last = {
        "daily_traffic_bytes": slice_for(last_keys, g_bytes_all),
        "daily_conns": slice_for(last_keys, g_conns_all),
    }
    g_prev = {
        "daily_traffic_bytes": slice_for(prev_keys, g_bytes_all) if prev_keys else [0]*7,
        "daily_conns": slice_for(prev_keys, g_conns_all) if prev_keys else [0]*7,
    }

    # cumulative по last7
    cum_b: List[int] = []
    cum_c: List[int] = []
    acc_b = 0
    acc_c = 0
    for i in range(7):
        acc_b += g_last["daily_traffic_bytes"][i]
        acc_c += g_last["daily_conns"][i]
        cum_b.append(acc_b)
        cum_c.append(acc_c)

    users_payload: Dict[str, Any] = {}
    for u in users_sorted:
        b_all = u_bytes_all.get(u, [0] * len(keys_all))
        c_all = u_conns_all.get(u, [0] * len(keys_all))
        b_last = slice_for(last_keys, b_all)
        c_last = slice_for(last_keys, c_all)
        b_prev = slice_for(prev_keys, b_all) if prev_keys else [0]*7
        c_prev = slice_for(prev_keys, c_all) if prev_keys else [0]*7

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
            "top_domains_traffic": _topn(per_t_last.get(u, {}), 10),
            "top_domains_conns": _topn(per_c_last.get(u, {}), 10),
            "anomaly": any(x >= 1_000_000_000 for x in b_last),
        }

    return {
        "meta": {"to": to_ymd, "days": last_keys, "prev_days": prev_keys, "users": users_sorted},
        "global": {
            **g_last,
            "cumulative_traffic_bytes": cum_b,
            "cumulative_conns": cum_c,
            "prev_daily_traffic_bytes": g_prev["daily_traffic_bytes"],
            "prev_daily_conns": g_prev["daily_conns"],
            "top_domains_traffic": _topn(glob_t_last, 10),
            "top_domains_conns": _topn(glob_c_last, 10),
        },
        "users": users_payload,
    }


def _next_user_email(cfg: Dict[str, Any]) -> str:
    _, ib = _get_reality_inbound(cfg)
    clients = ((ib.get("settings") or {}).get("clients") or [])
    used = {(c.get("email") or "").strip() for c in clients if isinstance(c, dict)}
    for i in range(1, 1000):
        e = f"user_{i:02d}"
        if e not in used:
            return e
    return f"user_{int(time.time())}"


def list_clients() -> List[Dict[str, Any]]:
    cfg = _load_xray_cfg()
    _, ib = _get_reality_inbound(cfg)
    clients = ((ib.get("settings") or {}).get("clients") or [])
    aliases = _jload(ALIASES_PATH, {})
    if not isinstance(aliases, dict):
        aliases = {}
    out = []
    for c in clients:
        if not isinstance(c, dict):
            continue
        email = (c.get("email") or "").strip()
        uid = (c.get("id") or "").strip()
        flow = (c.get("flow") or "").strip()
        out.append({"email": email, "id": uid, "flow": flow, "alias": aliases.get(email, "")})
    out.sort(key=lambda x: x["email"])
    return out


def add_client() -> Dict[str, Any]:
    cfg = _load_xray_cfg()
    idx, ib = _get_reality_inbound(cfg)

    settings = ib.get("settings") or {}
    clients = (settings.get("clients") or [])
    if not isinstance(clients, list):
        clients = []

    email = _next_user_email(cfg)
    uid = str(uuid.uuid4())

    flow = "xtls-rprx-vision"
    if clients and isinstance(clients[0], dict) and (clients[0].get("flow") or "").strip():
        flow = (clients[0].get("flow") or flow).strip()

    clients.append({"id": uid, "email": email, "flow": flow})
    settings["clients"] = clients
    ib["settings"] = settings
    cfg["inbounds"][idx] = ib
    _save_xray_cfg(cfg)

    ok, msg = restart_xray()
    return {"email": email, "id": uid, "flow": flow, "restarted": ok, "restart_msg": msg[:2000]}


def remove_client(email: str) -> Dict[str, Any]:
    cfg = _load_xray_cfg()
    idx, ib = _get_reality_inbound(cfg)

    settings = ib.get("settings") or {}
    clients = (settings.get("clients") or [])
    if not isinstance(clients, list):
        clients = []

    before = len(clients)
    clients = [c for c in clients if (c.get("email") or "").strip() != email]
    settings["clients"] = clients
    ib["settings"] = settings
    cfg["inbounds"][idx] = ib
    _save_xray_cfg(cfg)

    ok, msg = restart_xray()

    aliases = _jload(ALIASES_PATH, {})
    if isinstance(aliases, dict):
        aliases.pop(email, None)
        _jsave(ALIASES_PATH, aliases)

    return {"email": email, "removed": before - len(clients), "restarted": ok, "restart_msg": msg[:2000]}


def reset_uuid(email: str) -> Dict[str, Any]:
    cfg = _load_xray_cfg()
    idx, ib = _get_reality_inbound(cfg)
    settings = ib.get("settings") or {}
    clients = (settings.get("clients") or [])
    if not isinstance(clients, list):
        clients = []

    new_id = str(uuid.uuid4())
    changed = 0
    for c in clients:
        if not isinstance(c, dict):
            continue
        if (c.get("email") or "").strip() == email:
            c["id"] = new_id
            changed = 1
            break

    settings["clients"] = clients
    ib["settings"] = settings
    cfg["inbounds"][idx] = ib
    _save_xray_cfg(cfg)

    # HARD KICK: рестарт xray => рвёт TCP, иначе “не выбивает”
    ok, msg = restart_xray()
    return {"email": email, "new_id": new_id, "changed": changed, "restarted": ok, "restart_msg": msg[:2000], "kick_mode": "hard_restart"}


def all_time_stats() -> Dict[str, Any]:
    domains_latest = load_domains_map("9999-12-31")
    clients = list_clients()
    users = [c["email"] for c in clients if c.get("email")]

    traffic_total: Dict[str, int] = {u: 0 for u in users}
    conns_total: Dict[str, int] = {u: 0 for u in users}
    days_used: Dict[str, set] = {u: set() for u in users}
    top_dom: Dict[str, Dict[str, int]] = {u: {} for u in users}

    for ymd in list_dates("usage"):
        p = Path(DATA_DIR) / f"usage_{ymd}.csv"
        if not p.exists():
            continue
        for r in _read_csv(p):
            u = (r.get("user") or "").strip()
            if u not in traffic_total:
                continue
            b = _safe_bytes(r.get("total_bytes") or 0)
            if b > 0:
                days_used[u].add(ymd)
            traffic_total[u] += b

    for ymd in list_dates("conns"):
        p = Path(DATA_DIR) / f"conns_{ymd}.csv"
        if not p.exists():
            continue
        for r in _read_csv(p):
            u = (r.get("user") or "").strip()
            if u not in conns_total:
                continue
            c = _safe_int(r.get("conn_count") or 0)
            if c > 0:
                days_used[u].add(ymd)
            conns_total[u] += c

    for ymd in list_dates("report"):
        p = Path(DATA_DIR) / f"report_{ymd}.csv"
        if not p.exists():
            continue
        for r in _read_csv(p):
            u = (r.get("user") or "").strip()
            if u not in top_dom:
                continue
            dom = dst_to_domain(r.get("dst") or "", domains_latest)
            b = _safe_bytes(r.get("traffic_bytes") or 0)
            top_dom[u][dom] = top_dom[u].get(dom, 0) + b

    out = {}
    for u in users:
        td = sorted(top_dom[u].items(), key=lambda x: x[1], reverse=True)[:3]
        out[u] = {
            "days_used": len(days_used[u]),
            "total_traffic_bytes": traffic_total[u],
            "total_conns": conns_total[u],
            "top3_domains": [{"domain": d, "bytes": b} for d, b in td],
        }
    return out


TS1 = re.compile(r"^(?P<y>\d{4})[/-](?P<m>\d{2})[/-](?P<d>\d{2})\s+(?P<h>\d{2}):(?P<mi>\d{2}):(?P<s>\d{2})")
EMAIL1 = re.compile(r"(?:email|user)[:=]\s*(?P<email>[A-Za-z0-9_\-\.]+)")
EMAIL2 = re.compile(r"\s(?P<email>user_\d{2})\s*$")


def _parse_access_events(target_ymd: str) -> List[Tuple[str, int]]:
    p = Path(ACCESS_LOG)
    if not p.exists():
        return []

    events: List[Tuple[str, int]] = []
    with p.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            m = TS1.search(line)
            if not m:
                continue
            ymd = f"{m.group('y')}-{m.group('m')}-{m.group('d')}"
            if ymd != target_ymd:
                continue
            h = int(m.group("h")); mi = int(m.group("mi"))
            mm = h * 60 + mi

            em = EMAIL1.search(line) or EMAIL2.search(line)
            if not em:
                continue
            email = (em.group("email") or "").strip()
            if email:
                events.append((email, mm))
    return events


def sessions_day(target_ymd: str, gran_min: int = 5) -> Dict[str, Any]:
    gran_min = max(1, min(60, gran_min))
    slots = (24 * 60) // gran_min

    events = _parse_access_events(target_ymd)
    users = [c["email"] for c in list_clients() if c.get("email")]
    active: Dict[str, List[int]] = {u: [0] * slots for u in users}

    for email, mm in events:
        if email not in active:
            continue
        idx = min(slots - 1, mm // gran_min)
        active[email][idx] = 1

    durations = {u: sum(active[u]) * gran_min for u in users}
    top = sorted(durations.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "date": target_ymd,
        "gran_min": gran_min,
        "slots": slots,
        "users": users,
        "active": active,
        "durations_min": durations,
        "top": [{"user": u, "min": m} for u, m in top],
        "has_log": Path(ACCESS_LOG).exists(),
        "note": "Онлайн оценивается по access.log: «был трафик в интервале / не было». Это не идеальные сессии, но наглядно.",
    }


@app.get("/")
def index():
    return send_file(UI_PATH)


@app.get("/health")
def health():
    return jsonify({"ok": True, "data_dir": DATA_DIR})


@app.get("/__ui")
def ui_meta():
    p = UI_PATH
    sha12 = __import__("hashlib").sha256(p.read_bytes()).hexdigest()[:12]
    return jsonify({"ui_path": str(p), "mtime": p.stat().st_mtime, "sha12": sha12})


@app.get("/api/days")
def api_days():
    return jsonify(list_dates("usage"))


@app.get("/api/dashboard")
def api_dashboard():
    days = max(7, min(31, _safe_int(request.args.get("days", 14))))
    to_ymd = (request.args.get("to") or "").strip()
    if not to_ymd:
        avail = list_dates("usage")
        to_ymd = avail[-1] if avail else _fmt_ymd(date.today())
    return jsonify(aggregate(to_ymd, days))


@app.get("/api/reality_template")
def api_reality_template():
    try:
        s = get_settings()
        tmpl = reality_template()
        return jsonify({"template": tmpl, "public_host": (s.get("public_host") or "").strip(), "inbound_tag": (s.get("inbound_tag") or "").strip()})
    except Exception as e:
        s = get_settings()
        return jsonify({"error": str(e), "public_host": (s.get("public_host") or "").strip(), "inbound_tag": (s.get("inbound_tag") or "").strip()}), 500


@app.post("/api/admin/import_link")
def api_admin_import_link():
    data = request.get_json(silent=True) or {}
    link = (data.get("link") or "").strip()
    if not link.startswith("vless://"):
        return jsonify({"error": "link must start with vless://"}), 400
    try:
        u = urlparse(link)
        qs = parse_qs(u.query)
        tmpl = {
            "pbk": (qs.get("pbk", [""])[0] or "").strip(),
            "sni": (qs.get("sni", [""])[0] or "").strip(),
            "sid": (qs.get("sid", [""])[0] or "").strip(),
            "fp": (qs.get("fp", ["chrome"])[0] or "chrome").strip(),
            "port": int(u.port or 443),
            "type": (qs.get("type", ["tcp"])[0] or "tcp").strip(),
            "flow": (qs.get("flow", ["xtls-rprx-vision"])[0] or "xtls-rprx-vision").strip(),
        }
        if not tmpl["pbk"]:
            return jsonify({"error": "pbk missing in link"}), 400
        save_settings({"reality_template": tmpl, "public_host": (u.hostname or "").strip()})
        return jsonify({"ok": True, "template": tmpl, "public_host": (u.hostname or "").strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/api/admin/public_host")
def api_admin_public_host():
    data = request.get_json(silent=True) or {}
    host = (data.get("public_host") or "").strip()
    save_settings({"public_host": host})
    return jsonify({"ok": True, "public_host": host})


@app.get("/api/admin/clients")
def api_admin_clients():
    s = get_settings()
    host = (request.args.get("host") or "").strip() or (s.get("public_host") or "").strip()
    clients = list_clients()
    for c in clients:
        c["share_link"] = ""
        if c.get("email") and c.get("id"):
            try:
                c["share_link"] = make_vless_link(c["email"], c["id"], host=host)
            except Exception as e:
                c["share_link_error"] = str(e)
    return jsonify(clients)


@app.get("/api/admin/stats")
def api_admin_stats():
    return jsonify(all_time_stats())


@app.post("/api/admin/clients")
def api_admin_add_client():
    try:
        s = get_settings()
        host = (request.args.get("host") or "").strip() or (s.get("public_host") or "").strip()
        res = add_client()
        res["share_link"] = make_vless_link(res["email"], res["id"], host=host)
        return jsonify(res)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.delete("/api/admin/clients/<email>")
def api_admin_del_client(email: str):
    try:
        return jsonify(remove_client(email))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/api/admin/reset_uuid/<email>")
def api_admin_reset_uuid(email: str):
    try:
        s = get_settings()
        host = (request.args.get("host") or "").strip() or (s.get("public_host") or "").strip()
        res = reset_uuid(email)
        if res.get("changed"):
            res["share_link"] = make_vless_link(email, res["new_id"], host=host)
        else:
            res["share_link"] = ""
        return jsonify(res)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/api/admin/alias")
def api_admin_alias():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    alias = (data.get("alias") or "").strip()
    if not email:
        return jsonify({"error": "email required"}), 400
    aliases = _jload(ALIASES_PATH, {})
    if not isinstance(aliases, dict):
        aliases = {}
    if alias:
        aliases[email] = alias
    else:
        aliases.pop(email, None)
    _jsave(ALIASES_PATH, aliases)
    return jsonify({"ok": True, "email": email, "alias": aliases.get(email, "")})


# sys buttons — через screen vpn, как ты просил
@app.get("/api/sys/xray_status")
def api_sys_xray_status():
    return jsonify(_run_in_vpn_screen("xray_status", "systemctl status xray --no-pager -l"))


@app.post("/api/sys/xray_restart")
def api_sys_xray_restart():
    cmd = "systemctl restart xray; systemctl is-active xray; echo '---'; systemctl status xray --no-pager -l | head -n 60"
    return jsonify(_run_in_vpn_screen("xray_restart", cmd))


@app.get("/api/sys/xray_journal")
def api_sys_xray_journal():
    return jsonify(_run_in_vpn_screen("xray_journal", "journalctl -u xray -n 30 --no-pager"))


@app.get("/api/sessions/day")
def api_sessions_day():
    ymd = (request.args.get("date") or "").strip()
    if not ymd:
        avail = list_dates("usage")
        ymd = avail[-1] if avail else _fmt_ymd(date.today())
    gran = _safe_int(request.args.get("gran", 5))
    try:
        return jsonify(sessions_day(ymd, gran))
    except Exception as e:
        return jsonify({"error": str(e), "date": ymd, "gran_min": gran}), 500


if __name__ == "__main__":
    app.run(host=APP_HOST, port=APP_PORT, debug=False)

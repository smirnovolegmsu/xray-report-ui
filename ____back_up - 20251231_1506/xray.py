from __future__ import annotations

import base64
import json
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs

import config
import core

def _load_xray_cfg() -> Dict[str, Any]:
    if not config.XRAY_CFG.exists():
        raise FileNotFoundError(f"XRAY config not found: {config.XRAY_CFG}")
    return json.loads(config.XRAY_CFG.read_text(encoding="utf-8", errors="replace"))

def _save_xray_cfg(cfg: Dict[str, Any]) -> None:
    tmp = config.XRAY_CFG.with_suffix(".tmp")
    tmp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(config.XRAY_CFG)

def _get_reality_inbound(cfg: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    returns (full_cfg, inbound)
    """
    inbounds = cfg.get("inbounds") or []
    if not isinstance(inbounds, list):
        inbounds = []
    tag_need = (core.get_settings().get("inbound_tag") or "").strip() or config.XRAY_REALITY_INBOUND_TAG

    # 1) by tag
    if tag_need:
        for ib in inbounds:
            if isinstance(ib, dict) and (ib.get("tag") or "").strip() == tag_need:
                return cfg, ib

    # 2) by reality settings
    for ib in inbounds:
        if not isinstance(ib, dict):
            continue
        ss = ib.get("streamSettings") or {}
        if not isinstance(ss, dict):
            continue
        rs = ss.get("realitySettings") or {}
        if isinstance(rs, dict) and rs:
            return cfg, ib

    raise RuntimeError("Reality inbound not found in xray config. Set inbound_tag in settings.")

def _derive_pbk(private_b64: str) -> str:
    # XRAY privateKey is base64url without padding
    if config.PBK_ENV:
        return config.PBK_ENV

    try:
        from cryptography.hazmat.primitives.asymmetric import x25519
        from cryptography.hazmat.primitives import serialization
    except Exception as e:
        raise RuntimeError(
            "Cannot derive pbk: install 'cryptography' or set XRAY_REALITY_PBK env"
        ) from e

    pad = "=" * ((4 - len(private_b64) % 4) % 4)
    raw = base64.urlsafe_b64decode(private_b64 + pad)

    pub = x25519.X25519PrivateKey.from_private_bytes(raw).public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return base64.urlsafe_b64encode(pub).decode("utf-8").rstrip("=")

def reality_template() -> Dict[str, Any]:
    s = core.get_settings()
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
    fp = (rs.get("fingerprint") or "chrome")
    typ = (ss.get("network") or "tcp")
    flow = "xtls-rprx-vision"

    pbk = config.PBK_ENV
    if not pbk:
        priv = (rs.get("privateKey") or "").strip()
        if not priv:
            raise RuntimeError("No realitySettings.privateKey in xray config and no XRAY_REALITY_PBK env.")
        pbk = _derive_pbk(priv)

    eff = {
        "pbk": pbk,
        "sni": sni,
        "sid": sid,
        "fp": fp,
        "port": port,
        "type": typ,
        "flow": flow,
    }

    # cache to settings so UI keeps working even if config changes
    s["reality_template"] = eff
    core.save_settings(s)
    return eff

def make_vless_link(user_email: str, user_uuid: str, host: Optional[str] = None) -> str:
    tmpl = reality_template()
    s = core.get_settings()
    public_host = (host or "").strip() or (s.get("public_host") or "").strip()
    if not public_host:
        raise RuntimeError("public_host is empty. Set it in Управление.")
    return (
        f"vless://{user_uuid}@{public_host}:{tmpl['port']}"
        f"?encryption=none&security=reality"
        f"&sni={tmpl['sni']}&fp={tmpl['fp']}&pbk={tmpl['pbk']}&sid={tmpl['sid']}"
        f"&type={tmpl['type']}&flow={tmpl['flow']}#{user_email}"
    )

def import_reality_link(link: str) -> Tuple[bool, str]:
    # parse vless link and store template + public_host if present
    try:
        if not link.startswith("vless://"):
            return False, "Not a vless:// link"
        u = urlparse(link.replace("vless://", "vless://dummy@", 1))  # urlparse needs scheme://
        # we replaced user@host; so host is in netloc after dummy@
        netloc = u.netloc.split("@", 1)[-1]
        host, port = netloc.split(":") if ":" in netloc else (netloc, "443")
        q = parse_qs(u.query)
        tmpl = {
            "pbk": (q.get("pbk", [""])[0] or "").strip(),
            "sni": (q.get("sni", [""])[0] or "").strip(),
            "sid": (q.get("sid", [""])[0] or "").strip(),
            "fp": (q.get("fp", [""])[0] or "").strip() or "chrome",
            "port": int(port),
            "type": (q.get("type", ["tcp"])[0] or "tcp").strip(),
            "flow": (q.get("flow", ["xtls-rprx-vision"])[0] or "xtls-rprx-vision").strip(),
        }
        if not tmpl["pbk"] or not tmpl["sni"] or not tmpl["sid"]:
            return False, "Link misses pbk/sni/sid"
        s = core.get_settings()
        s["reality_template"] = tmpl
        if host:
            s["public_host"] = host
        core.save_settings(s)
        return True, "Imported"
    except Exception as e:
        return False, str(e)

def list_clients(with_links: bool = True) -> List[Dict[str, Any]]:
    cfg = _load_xray_cfg()
    _, ib = _get_reality_inbound(cfg)
    clients = ((ib.get("settings") or {}).get("clients") or [])
    aliases = core.get_aliases()

    out=[]
    for c in clients:
        if not isinstance(c, dict):
            continue
        email = (c.get("email") or "").strip()
        uid = (c.get("id") or "").strip()
        if not email or not uid:
            continue
        item = {
            "email": email,
            "id": uid,
            "alias": (aliases.get(email) or "").strip(),
        }
        if with_links:
            try:
                item["share_link"] = make_vless_link(email, uid)
            except Exception as e:
                item["share_link_error"] = str(e)
        out.append(item)

    out = sorted(out, key=lambda x: x["email"])
    return out

def set_alias(email: str, alias: str) -> None:
    a = core.get_aliases()
    if alias:
        a[email] = alias
    else:
        a.pop(email, None)
    core.save_aliases(a)

def add_client(email: str, alias: str = "", host: str = "") -> Dict[str, Any]:
    try:
        cfg = _load_xray_cfg()
        _, ib = _get_reality_inbound(cfg)
        clients = (ib.get("settings") or {}).get("clients") or []
        if not isinstance(clients, list):
            return {"ok": False, "msg": "xray config inbound.settings.clients is not a list"}

        for c in clients:
            if isinstance(c, dict) and (c.get("email") or "").strip() == email:
                return {"ok": False, "msg": "client already exists"}

        uid = str(uuid.uuid4())
        clients.append({"id": uid, "email": email})
        (ib.setdefault("settings", {})["clients"]) = clients
        _save_xray_cfg(cfg)

        if alias:
            set_alias(email, alias)

        ok, msg = restart_xray()
        link = None
        if ok:
            try:
                link = make_vless_link(email, uid, host=host)
            except Exception as e:
                return {"ok": True, "msg": "client added, but link error: " + str(e), "email": email, "id": uid}
        return {"ok": ok, "msg": msg or "ok", "email": email, "id": uid, "share_link": link}
    except Exception as e:
        return {"ok": False, "msg": str(e)}

def delete_client(email: str) -> Dict[str, Any]:
    try:
        cfg = _load_xray_cfg()
        _, ib = _get_reality_inbound(cfg)
        clients = (ib.get("settings") or {}).get("clients") or []
        if not isinstance(clients, list):
            return {"ok": False, "msg": "clients is not a list"}
        before = len(clients)
        clients = [c for c in clients if not (isinstance(c, dict) and (c.get("email") or "").strip() == email)]
        if len(clients) == before:
            return {"ok": False, "msg": "client not found"}
        (ib.setdefault("settings", {})["clients"]) = clients
        _save_xray_cfg(cfg)

        a = core.get_aliases()
        a.pop(email, None)
        core.save_aliases(a)

        ok, msg = restart_xray()
        return {"ok": ok, "msg": msg or "ok"}
    except Exception as e:
        return {"ok": False, "msg": str(e)}

def reset_uuid(email: str) -> Dict[str, Any]:
    try:
        cfg = _load_xray_cfg()
        _, ib = _get_reality_inbound(cfg)
        clients = (ib.get("settings") or {}).get("clients") or []
        if not isinstance(clients, list):
            return {"ok": False, "msg": "clients is not a list"}

        found=None
        for c in clients:
            if isinstance(c, dict) and (c.get("email") or "").strip() == email:
                found=c
                break
        if not found:
            return {"ok": False, "msg": "client not found"}

        new_uid = str(uuid.uuid4())
        found["id"] = new_uid
        _save_xray_cfg(cfg)

        ok, msg = restart_xray()
        out={"ok": ok, "msg": msg or "ok", "email": email, "id": new_uid}
        if ok:
            try:
                out["share_link"] = make_vless_link(email, new_uid)
            except Exception as e:
                out["share_link_error"] = str(e)
        return out
    except Exception as e:
        return {"ok": False, "msg": str(e)}

def restart_xray() -> Tuple[bool, str]:
    rc, out = core.run(["systemctl", "restart", config.XRAY_SERVICE], timeout=60)
    return (rc == 0), out

def xray_status() -> Dict[str, Any]:
    rc, out = core.run(["systemctl", "is-active", config.XRAY_SERVICE])
    return {"ok": rc == 0, "status": out or "unknown"}

def xray_journal(lines: int = 80) -> str:
    lines = core.clamp(int(lines), 20, 500)
    rc, out = core.run(["journalctl", "-u", config.XRAY_SERVICE, "-n", str(lines), "--no-pager"], timeout=15)
    return out

from __future__ import annotations

from flask import Flask, Response, jsonify, request, render_template
from typing import Any, Dict
import os

import config
import core
import usage
import xray
import updates

app = Flask(__name__, template_folder="templates", static_folder="static")

@app.after_request
def _no_cache(resp: Response):
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/health")
def health():
    return jsonify({"ok": True})

@app.get("/__ui")
def ui_meta():
    return jsonify({
        "host": config.APP_HOST,
        "port": config.APP_PORT,
        "data_dir": str(config.DATA_DIR),
        "state_dir": str(config.STATE_DIR),
        "xray_cfg": str(config.XRAY_CFG),
        "xray_service": config.XRAY_SERVICE,
        "ui_service": config.UI_SERVICE,
        "version": "v4-modular-10files",
    })

@app.get("/api/days")
def api_days():
    return jsonify({"days": core.list_dates("usage")})

@app.get("/api/dashboard")
def api_dashboard():
    days = core.safe_int(request.args.get("days", 14), 14)
    to_ymd = (request.args.get("to") or "").strip()
    if not to_ymd:
        avail = core.list_dates("usage")
        to_ymd = avail[-1] if avail else core.fmt_ymd(core.today())
    payload = usage.aggregate(to_ymd, days=days)
    return jsonify(payload)

@app.get("/api/reality_template")
def api_reality_template():
    s = core.get_settings()
    tmpl = xray.reality_template()
    return jsonify({
        "template": tmpl,
        "public_host": (s.get("public_host") or "").strip(),
        "inbound_tag": (s.get("inbound_tag") or "").strip(),
    })

@app.post("/api/admin/import_link")
def api_admin_import_link():
    link = (request.get_json(silent=True) or {}).get("link", "")
    ok, msg = xray.import_reality_link(str(link))
    core.log_event("admin.import_link", {"ok": ok, "msg": msg})
    return jsonify({"ok": ok, "msg": msg})

@app.post("/api/admin/public_host")
def api_admin_public_host():
    body = request.get_json(silent=True) or {}
    host = (body.get("host") or "").strip()
    if not host:
        return jsonify({"ok": False, "msg": "host is empty"}), 400
    s = core.get_settings()
    s["public_host"] = host
    core.save_settings(s)
    core.log_event("admin.public_host", {"host": host})
    return jsonify({"ok": True, "host": host})

@app.get("/api/admin/clients")
def api_admin_clients():
    clients = xray.list_clients(with_links=True)
    return jsonify(clients)

@app.get("/api/admin/stats")
def api_admin_stats():
    return jsonify(usage.all_time_stats())

@app.post("/api/admin/clients")
def api_admin_add_client():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip()
    alias = (body.get("alias") or "").strip()
    host = (body.get("host") or "").strip()
    if not email:
        return jsonify({"ok": False, "msg": "email is empty"}), 400
    res = xray.add_client(email=email, alias=alias, host=host)
    core.log_event("admin.add_client", {"email": email, "ok": res.get("ok"), "msg": res.get("msg", "")})
    return jsonify(res), (200 if res.get("ok") else 400)

@app.delete("/api/admin/clients/<email>")
def api_admin_del_client(email: str):
    res = xray.delete_client(email=email)
    core.log_event("admin.delete_client", {"email": email, "ok": res.get("ok"), "msg": res.get("msg", "")})
    return jsonify(res), (200 if res.get("ok") else 400)

@app.post("/api/admin/reset_uuid/<email>")
def api_admin_reset_uuid(email: str):
    # "Kick": меняем UUID -> старые сессии отваливаются, но пользователь может подключиться снова (по новой ссылке)
    res = xray.reset_uuid(email=email)
    core.log_event("admin.kick_reset_uuid", {"email": email, "ok": res.get("ok"), "msg": res.get("msg", "")})
    return jsonify(res), (200 if res.get("ok") else 400)

@app.post("/api/admin/alias")
def api_admin_alias():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip()
    alias = (body.get("alias") or "").strip()
    if not email:
        return jsonify({"ok": False, "msg": "email is empty"}), 400
    xray.set_alias(email, alias)
    core.log_event("admin.alias", {"email": email, "alias": alias})
    return jsonify({"ok": True})

@app.get("/api/sys/xray_status")
def api_sys_xray_status():
    return jsonify(xray.xray_status())

@app.post("/api/sys/xray_restart")
def api_sys_xray_restart():
    ok, msg = xray.restart_xray()
    core.log_event("sys.xray_restart", {"ok": ok, "msg": msg})
    return jsonify({"ok": ok, "msg": msg})

@app.get("/api/sys/xray_journal")
def api_sys_xray_journal():
    lines = core.safe_int(request.args.get("lines", 80), 80)
    return jsonify({"ok": True, "text": xray.xray_journal(lines=lines)})

@app.get("/api/sys/packages")
def api_sys_packages():
    pkgs = ["flask", "cryptography"]
    versions = {p: core.pkg_version(p) for p in pkgs}
    rc, pyv = core.run(["python3", "-V"])
    return jsonify({"ok": True, "python": pyv, "packages": versions})

@app.post("/api/sys/pip_install")
def api_sys_pip_install():
    body = request.get_json(silent=True) or {}
    pkg = (body.get("pkg") or "").strip()
    if pkg not in {"cryptography"}:
        return jsonify({"ok": False, "msg": "only cryptography allowed"}), 400
    rc, out = core.run(["pip3", "install", "-U", pkg], timeout=300)
    ok = (rc == 0)
    core.log_event("sys.pip_install", {"pkg": pkg, "ok": ok})
    return jsonify({"ok": ok, "output": out, "version": core.pkg_version(pkg)})

@app.get("/api/sessions/day")
def api_sessions_day():
    ymd = (request.args.get("date") or "").strip() or core.fmt_ymd(core.today())
    gran = core.safe_int(request.args.get("gran", 5), 5)
    return jsonify(usage.sessions_day(ymd, gran_min=gran))

@app.post("/api/updates/manifest/validate")
def api_manifest_validate():
    body = request.get_json(silent=True) or {}
    text = str(body.get("manifest") or "")
    res = updates.validate_manifest(text)
    return jsonify(res), (200 if res.get("ok") else 400)

@app.post("/api/updates/manifest/apply")
def api_manifest_apply():
    body = request.get_json(silent=True) or {}
    text = str(body.get("manifest") or "")
    res = updates.apply_manifest(text)
    core.log_event("updates.apply", {"ok": res.get("ok"), "backup_id": res.get("backup_id"), "msg": res.get("msg", "")})
    return jsonify(res), (200 if res.get("ok") else 400)

@app.get("/api/updates/backups")
def api_updates_backups():
    return jsonify({"ok": True, "backups": updates.list_backups()})

@app.post("/api/updates/rollback")
def api_updates_rollback():
    body = request.get_json(silent=True) or {}
    backup_id = (body.get("backup_id") or "").strip()
    res = updates.rollback(backup_id)
    core.log_event("updates.rollback", {"ok": res.get("ok"), "backup_id": backup_id, "msg": res.get("msg", "")})
    return jsonify(res), (200 if res.get("ok") else 400)

@app.get("/api/events")
def api_events():
    lines = core.safe_int(request.args.get("lines", 200), 200)
    raw = core.tail(config.EVENTS_PATH, lines=lines)
    return jsonify({"ok": True, "lines": raw})

if __name__ == "__main__":
    app.run(host=config.APP_HOST, port=config.APP_PORT, debug=False)

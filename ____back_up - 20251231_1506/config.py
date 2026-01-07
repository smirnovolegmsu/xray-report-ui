from __future__ import annotations

import os
from pathlib import Path

APP_HOST = os.environ.get("XRAY_UI_HOST", "127.0.0.1")
APP_PORT = int(os.environ.get("XRAY_UI_PORT", "8090"))

# data produced by your cron/parser
DATA_DIR = Path(os.environ.get("XRAY_USAGE_DIR", "/var/log/xray/usage"))

XRAY_CFG = Path(os.environ.get("XRAY_CFG", "/usr/local/etc/xray/config.json"))
XRAY_SERVICE = os.environ.get("XRAY_SERVICE", "xray")
UI_SERVICE = os.environ.get("XRAY_UI_SERVICE", "xray-report-ui")

XRAY_REALITY_INBOUND_TAG = os.environ.get("XRAY_REALITY_INBOUND_TAG", "").strip()

ACCESS_LOG = Path(os.environ.get("XRAY_ACCESS_LOG", "/var/log/xray/access.log"))

STATE_DIR = Path(os.environ.get("XRAY_UI_STATE_DIR", "/opt/xray-report-ui/state"))
STATE_DIR.mkdir(parents=True, exist_ok=True)

ALIASES_PATH = STATE_DIR / "user_aliases.json"
SETTINGS_PATH = STATE_DIR / "ui_settings.json"
EVENTS_PATH = STATE_DIR / "events.log"

PBK_ENV = os.environ.get("XRAY_REALITY_PBK", "").strip()
PUBLIC_HOST_ENV = os.environ.get("XRAY_PUBLIC_HOST", "").strip()

BASE_DIR = Path(os.environ.get("XRAY_UI_BASE_DIR", "/opt/xray-report-ui"))
BACKUP_DIR = Path(os.environ.get("XRAY_UI_BACKUP_DIR", str(BASE_DIR / "data/backups")))
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

# security: allow updates only in these roots
UPDATE_ALLOW_ROOTS = [
    BASE_DIR,                         # app.py, *.py
    BASE_DIR / "templates",
    BASE_DIR / "static",
]

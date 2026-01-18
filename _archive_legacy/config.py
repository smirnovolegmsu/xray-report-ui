#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuration module for xray-report-ui
Centralized configuration and constants
"""

import os

# Application settings
APP_HOST = "127.0.0.1"
APP_PORT = int(os.environ.get("XRAY_REPORT_UI_PORT", "8787"))

# Paths
XRAY_CFG = "/usr/local/etc/xray/config.json"
DATA_DIR = "/opt/xray-report-ui/data"
BACKUPS_DIR = os.path.join(DATA_DIR, "backups")

SETTINGS_PATH = os.path.join(DATA_DIR, "settings.json")
EVENTS_PATH = os.path.join(DATA_DIR, "events.log")

TEMPLATE_INDEX_PATHS = [
    "/opt/xray-report-ui/templates/index.html",
    "/opt/xray-report-ui/index.html",  # legacy fallback
]

# Usage data paths
USAGE_DIR = "/var/log/xray/usage"
ACCESS_LOG = os.environ.get("XRAY_ACCESS_LOG", "/var/log/xray/access.log")
LIVE_STATE_PATH = os.path.join(DATA_DIR, "usage_live.json")
LIVE_STATE_OFFSET_PATH = os.path.join(DATA_DIR, "usage_state.json")

# Service names
SERVICE_UI = "xray-report-ui"
SERVICE_XRAY_DEFAULT = "xray"

# Default settings
DEFAULT_SETTINGS = {
    "lang": "ru",
    "xray": {
        "config_path": XRAY_CFG,
        "service_name": SERVICE_XRAY_DEFAULT,
        "server_host": "",
        "reality_pbk": "",
        "inbound_tag": "",
    },
    "collector": {
        "enabled": True,
        "usage_dir": USAGE_DIR,
        "access_log": ACCESS_LOG,
        "schedule": "*/5 * * * *",
    }
}

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Centralized configuration and settings management for xray-report-ui
"""
import os
import json
from typing import Any, Dict

from backend.core.helpers import atomic_write_json, read_json

# Service names
SERVICE_UI = "xray-report-ui"
SERVICE_XRAY_DEFAULT = "xray"
SERVICE_NEXTJS = "xray-nextjs-ui"
NEXTJS_PORT = 3000
NEXTJS_URL = os.environ.get("NEXTJS_URL", f"http://127.0.0.1:{NEXTJS_PORT}")

# Server configuration
APP_HOST = "127.0.0.1"
APP_PORT = int(os.environ.get("XRAY_REPORT_UI_PORT", "8787"))

# Default paths (can be overridden via environment variables or settings.json)
XRAY_CFG_DEFAULT = os.environ.get("XRAY_CONFIG_PATH", "/usr/local/etc/xray/config.json")
DATA_DIR_DEFAULT = os.environ.get("XRAY_DATA_DIR", "/opt/xray-report-ui/data")
USAGE_DIR_DEFAULT = os.environ.get("XRAY_USAGE_DIR", "/var/log/xray/usage")
ACCESS_LOG_DEFAULT = os.environ.get("XRAY_ACCESS_LOG", "/var/log/xray/access.log")

# Cache configuration
CACHE_TTL = {
    "dashboard": 60.0,  # 60 seconds - balance between freshness and CPU
    "usage": 60.0,      # 60 seconds
    "live": 5.0,        # 5 seconds for live data
    "users": 120.0,     # 2 minutes - users rarely change
    "user_stats": 300.0, # 5 minutes - heavy calculation
}

# Live buffer configuration
LIVE_BUFFER_SIZE = 1440  # 24 hours * 60 minutes

# Time constants (in seconds)
LIVE_ROLLING_WINDOW_SEC = 300  # 5 minutes rolling window for "now" status
CACHE_MAX_SIZE = 500  # Maximum cache entries before cleanup
CACHE_CLEANUP_THRESHOLD = 50  # Minimum entries to remove during cleanup
TRACE_LENGTH_LIMIT = 500  # Maximum length of error traceback in events

# Global paths (initialized by load_settings)
XRAY_CFG = XRAY_CFG_DEFAULT
DATA_DIR = DATA_DIR_DEFAULT
BACKUPS_DIR = None
SETTINGS_PATH = None
EVENTS_PATH = None
USAGE_DIR = USAGE_DIR_DEFAULT
ACCESS_LOG = ACCESS_LOG_DEFAULT
LIVE_STATE_PATH = None
LIVE_STATE_OFFSET_PATH = None

DEFAULT_SETTINGS = {
    "version": 2,
    "ui": {
        "theme": "dark",
        "lang": "ru",
        "realtime_mode": "eco",
        "eco_poll_sec": 300,
        "live_push_sec": 5,
    },
    "xray": {
        "service_name": SERVICE_XRAY_DEFAULT,
        "config_path": XRAY_CFG_DEFAULT,
        "inbound_tag": "",
        "server_host": "",
        "server_port": 443,
        "sni": "www.cloudflare.com",
        "fp": "chrome",
        "flow": "xtls-rprx-vision",
        "reality_pbk": "",
    },
    "paths": {
        "data_dir": DATA_DIR_DEFAULT,
        "usage_dir": USAGE_DIR_DEFAULT,
        "access_log": ACCESS_LOG_DEFAULT,
    },
    "collector": {
        "usage_dir": USAGE_DIR_DEFAULT,
        "enabled": True,
    },
}


def ensure_dirs() -> None:
    """Ensure data directories exist"""
    global BACKUPS_DIR
    # Убеждаемся, что BACKUPS_DIR установлен
    if BACKUPS_DIR is None:
        load_settings()
    os.makedirs(DATA_DIR, exist_ok=True)
    if BACKUPS_DIR:
        os.makedirs(BACKUPS_DIR, exist_ok=True)


def load_settings() -> Dict[str, Any]:
    """Load settings from file, merge with defaults, update global paths"""
    global DATA_DIR, BACKUPS_DIR, SETTINGS_PATH, EVENTS_PATH, USAGE_DIR, ACCESS_LOG
    global LIVE_STATE_PATH, LIVE_STATE_OFFSET_PATH, XRAY_CFG
    
    # Initialize paths from defaults first
    DATA_DIR = DATA_DIR_DEFAULT
    BACKUPS_DIR = os.path.join(DATA_DIR, "backups")
    SETTINGS_PATH = os.path.join(DATA_DIR, "settings.json")
    EVENTS_PATH = os.path.join(DATA_DIR, "events.log")
    LIVE_STATE_PATH = os.path.join(DATA_DIR, "usage_live.json")
    LIVE_STATE_OFFSET_PATH = os.path.join(DATA_DIR, "usage_state.json")
    USAGE_DIR = USAGE_DIR_DEFAULT
    ACCESS_LOG = ACCESS_LOG_DEFAULT
    XRAY_CFG = XRAY_CFG_DEFAULT
    
    # Ensure data dir exists before reading settings
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(BACKUPS_DIR, exist_ok=True)
    
    s = read_json(SETTINGS_PATH, {})
    if not isinstance(s, dict) or not s:
        s = json.loads(json.dumps(DEFAULT_SETTINGS))
        atomic_write_json(SETTINGS_PATH, s)
    
    merged = json.loads(json.dumps(DEFAULT_SETTINGS))
    
    def deep_merge(dst, src):
        for k, v in src.items():
            if isinstance(v, dict) and isinstance(dst.get(k), dict):
                deep_merge(dst[k], v)
            else:
                dst[k] = v
    
    deep_merge(merged, s)
    
    # Update global paths from settings if present
    if "paths" in merged:
        paths = merged["paths"]
        if "data_dir" in paths:
            DATA_DIR = paths["data_dir"]
            BACKUPS_DIR = os.path.join(DATA_DIR, "backups")
            SETTINGS_PATH = os.path.join(DATA_DIR, "settings.json")
            EVENTS_PATH = os.path.join(DATA_DIR, "events.log")
            LIVE_STATE_PATH = os.path.join(DATA_DIR, "usage_live.json")
            LIVE_STATE_OFFSET_PATH = os.path.join(DATA_DIR, "usage_state.json")
        if "usage_dir" in paths:
            USAGE_DIR = paths["usage_dir"]
        if "access_log" in paths:
            ACCESS_LOG = paths["access_log"]
    
    # Update Xray config path from settings
    if "xray" in merged and "config_path" in merged["xray"]:
        XRAY_CFG = merged["xray"]["config_path"]
    
    # Update collector usage_dir from settings
    if "collector" in merged and "usage_dir" in merged["collector"]:
        USAGE_DIR = merged["collector"]["usage_dir"]
    
    ensure_dirs()  # Ensure dirs exist after path updates
    return merged


def save_settings(s: Dict[str, Any]) -> None:
    """Save settings to file"""
    ensure_dirs()
    atomic_write_json(SETTINGS_PATH, s)

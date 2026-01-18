#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Settings management
"""

from typing import Dict, Any

from config import SETTINGS_PATH, DEFAULT_SETTINGS, DATA_DIR
from utils.file_ops import atomic_write_json, read_json, ensure_dirs


def load_settings() -> Dict[str, Any]:
    """Load settings from file, merge with defaults"""
    ensure_dirs(DATA_DIR)
    saved = read_json(SETTINGS_PATH, {})
    
    # Deep merge with defaults
    settings = dict(DEFAULT_SETTINGS)
    for key, value in saved.items():
        if isinstance(value, dict) and isinstance(settings.get(key), dict):
            settings[key].update(value)
        else:
            settings[key] = value
    
    return settings


def save_settings(settings: Dict[str, Any]) -> None:
    """Save settings to file"""
    ensure_dirs(DATA_DIR)
    atomic_write_json(SETTINGS_PATH, settings)

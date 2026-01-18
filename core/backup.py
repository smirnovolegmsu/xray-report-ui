#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backup utilities
"""

import os
import shutil

from config import BACKUPS_DIR
from utils.date_utils import now_utc_iso
from utils.file_ops import ensure_dirs


def backup_file(path: str, label: str) -> str:
    """Create backup of file with timestamp"""
    ensure_dirs(BACKUPS_DIR)
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    
    ts = now_utc_iso().replace(":", "").replace("-", "").split(".")[0].replace("T", "_")
    filename = os.path.basename(path)
    backup_path = os.path.join(BACKUPS_DIR, f"{ts}__{label}__{filename}")
    
    shutil.copy2(path, backup_path)
    return backup_path

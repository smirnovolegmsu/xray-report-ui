#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Utility functions for xray-report-ui
"""
import datetime as dt
import json
import os
import re
import tempfile
from typing import Any, Dict, Optional


def now_utc_iso() -> str:
    """Get current UTC time as ISO string"""
    return dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def atomic_write_text(path: str, text: str) -> None:
    """Atomically write text to file"""
    d = os.path.dirname(path) or "."
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp_", dir=d)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            pass


def atomic_write_json(path: str, obj: Any) -> None:
    """Atomically write JSON object to file"""
    atomic_write_text(path, json.dumps(obj, ensure_ascii=False, indent=2) + "\n")


def read_json(path: str, default: Any) -> Any:
    """Read JSON file, return default if file doesn't exist or is invalid"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def parse_date_from_filename(path: str) -> Optional[dt.date]:
    """
    Parse date from filename like usage_2024-01-15.csv or 2024-01-15.csv
    
    Args:
        path: File path or filename
        
    Returns:
        date object or None if date not found
    """
    try:
        basename = os.path.basename(path)
        # Try format: YYYY-MM-DD.csv
        m = re.search(r'(\d{4})-(\d{2})-(\d{2})', basename)
        if m:
            return dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except Exception:
        pass
    return None

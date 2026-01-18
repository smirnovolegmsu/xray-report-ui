#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File operations utilities
Atomic writes, JSON operations, etc.
"""

import json
import os
import tempfile
from typing import Any


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


def read_json(path: str, default: Any = None) -> Any:
    """Read JSON from file, return default if fails"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def ensure_dirs(*paths: str) -> None:
    """Ensure directories exist"""
    for path in paths:
        os.makedirs(path, exist_ok=True)

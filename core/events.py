#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Event logging module
"""

import json
from typing import Any, Dict

from config import DATA_DIR, EVENTS_PATH
from utils.date_utils import now_utc_iso
from utils.file_ops import ensure_dirs


def append_event(ev: Dict[str, Any]) -> None:
    """Append event to events log"""
    ensure_dirs(DATA_DIR)
    ev = dict(ev)
    ev.setdefault("ts", now_utc_iso())
    line = json.dumps(ev, ensure_ascii=False)
    try:
        with open(EVENTS_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def read_events(limit: int = 100) -> list:
    """Read recent events from log"""
    try:
        with open(EVENTS_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        events = []
        for line in reversed(lines[-limit:]):
            line = line.strip()
            if line:
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
        
        return events
    except FileNotFoundError:
        return []
    except Exception:
        return []

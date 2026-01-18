#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Date and time utilities
"""

import datetime as dt
import re
from typing import Optional


def now_utc_iso() -> str:
    """Return current UTC time as ISO string"""
    return dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def parse_date_from_filename(path: str) -> Optional[dt.date]:
    """Extract date from usage_YYYYMMDD.csv filename"""
    m = re.search(r"usage_(\d{8})\.csv$", path)
    if m:
        try:
            return dt.datetime.strptime(m.group(1), "%Y%m%d").date()
        except ValueError:
            pass
    return None

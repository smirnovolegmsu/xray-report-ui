from __future__ import annotations

import csv
import json
import os
import re
import subprocess
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import config

DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")

def today() -> date:
    return date.today()

def fmt_ymd(d: date) -> str:
    return d.strftime("%Y-%m-%d")

def parse_ymd(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()

def safe_int(v: Any, default: int = 0) -> int:
    try:
        return int(float(v))
    except Exception:
        return default

def safe_bytes(v: Any) -> int:
    try:
        return int(v)
    except Exception:
        return 0

def read_csv(p: Path) -> Iterable[Dict[str, Any]]:
    with p.open("r", encoding="utf-8", errors="replace", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            yield row

def jload(p: Path, default: Any) -> Any:
    try:
        if not p.exists():
            return default
        return json.loads(p.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return default

def jsave(p: Path, obj: Any) -> None:
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(p)

def get_settings() -> Dict[str, Any]:
    s = jload(config.SETTINGS_PATH, {})
    if not isinstance(s, dict):
        s = {}
    # env overrides
    if config.PUBLIC_HOST_ENV and not s.get("public_host"):
        s["public_host"] = config.PUBLIC_HOST_ENV
    if config.XRAY_REALITY_INBOUND_TAG and not s.get("inbound_tag"):
        s["inbound_tag"] = config.XRAY_REALITY_INBOUND_TAG
    return s

def save_settings(s: Dict[str, Any]) -> None:
    jsave(config.SETTINGS_PATH, s)

def get_aliases() -> Dict[str, str]:
    a = jload(config.ALIASES_PATH, {})
    return a if isinstance(a, dict) else {}

def save_aliases(a: Dict[str, str]) -> None:
    jsave(config.ALIASES_PATH, a)

def list_dates(prefix: str) -> List[str]:
    # files like usage_YYYY-MM-DD.csv
    out: List[str] = []
    if not config.DATA_DIR.exists():
        return out
    for p in config.DATA_DIR.glob(f"{prefix}_*.csv"):
        m = DATE_RE.search(p.name)
        if m:
            out.append(m.group(1))
    out = sorted(set(out))
    return out

def run(cmd: List[str], timeout: int = 30) -> Tuple[int, str]:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        out = (p.stdout or "") + (p.stderr or "")
        return p.returncode, out.strip()
    except Exception as e:
        return 1, str(e)

def log_event(kind: str, data: Dict[str, Any]) -> None:
    try:
        rec = {"ts": int(time.time()), "kind": kind, "data": data}
        line = json.dumps(rec, ensure_ascii=False)
        with config.EVENTS_PATH.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

def clamp(n: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, n))

def topn(m: Dict[str, int], n: int = 10) -> List[Dict[str, Any]]:
    items = sorted(m.items(), key=lambda x: x[1], reverse=True)[:n]
    return [{"dst": k, "v": int(v)} for k, v in items]

def tail(p: Path, lines: int = 200) -> List[str]:
    try:
        lines = clamp(int(lines), 10, 2000)
        if not p.exists():
            return []
        with p.open('r', encoding='utf-8', errors='replace') as f:
            data = f.read().splitlines()
        return data[-lines:]
    except Exception:
        return []

def pkg_version(name: str) -> str:
    try:
        import importlib.metadata as md
        return md.version(name)
    except Exception:
        return ''

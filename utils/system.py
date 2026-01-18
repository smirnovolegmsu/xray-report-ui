#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System utilities
systemctl operations, etc.
"""

import subprocess
from typing import Tuple


def systemctl_is_active(service: str) -> Tuple[bool, str]:
    """Check if systemd service is active"""
    try:
        result = subprocess.run(
            ["systemctl", "is-active", service],
            capture_output=True,
            text=True,
            timeout=10
        )
        status = result.stdout.strip()
        is_active = status == "active"
        return is_active, status
    except Exception as e:
        return False, str(e)


def systemctl_restart(service: str) -> Tuple[bool, str]:
    """Restart systemd service"""
    try:
        result = subprocess.run(
            ["systemctl", "restart", service],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            return True, "OK"
        else:
            error = result.stderr.strip() or result.stdout.strip() or "Unknown error"
            return False, error
    except subprocess.TimeoutExpired:
        return False, "Timeout"
    except Exception as e:
        return False, str(e)


def systemctl_journal(service: str, lines: int = 100) -> Tuple[bool, str]:
    """Get systemd journal logs for service"""
    try:
        result = subprocess.run(
            ["journalctl", "-u", service, "-n", str(lines), "--no-pager"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return True, result.stdout
        else:
            return False, result.stderr or "Failed to get logs"
    except Exception as e:
        return False, str(e)

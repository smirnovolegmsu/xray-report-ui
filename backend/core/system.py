#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System service - бизнес-логика для работы с системой
"""
import datetime as dt
import os
import socket
import subprocess
import urllib.request
from typing import Dict, Tuple

from backend.core.config import SERVICE_UI, SERVICE_XRAY_DEFAULT, SERVICE_NEXTJS, NEXTJS_PORT, NEXTJS_URL, load_settings


def save_xray_stats_before_restart() -> None:
    """Save Xray statistics before restart to prevent data loss"""
    try:
        script_path = "/usr/local/bin/xray_daily_usage.sh"
        if os.path.exists(script_path):
            subprocess.run(
                [script_path],
                capture_output=True,
                timeout=30,
                env={**os.environ, "LABEL_DATE": dt.datetime.now().strftime("%Y-%m-%d")}
            )
    except Exception:
        pass  # Don't fail on stats save


def systemctl_restart(service: str) -> Tuple[bool, str]:
    """Restart systemd service"""
    allowed = {SERVICE_UI, SERVICE_XRAY_DEFAULT, "xray", SERVICE_NEXTJS}
    s = load_settings()
    xray_service = s["xray"].get("service_name", SERVICE_XRAY_DEFAULT)
    allowed.add(xray_service)
    
    if service not in allowed:
        return False, f"service_not_allowed: {service}"
    
    # Save Xray statistics BEFORE restart
    if service in {SERVICE_XRAY_DEFAULT, "xray", xray_service}:
        save_xray_stats_before_restart()
    
    try:
        cp = subprocess.run(["systemctl", "restart", service], capture_output=True, text=True, timeout=30)
        if cp.returncode != 0:
            return False, (cp.stderr or cp.stdout or "restart_failed").strip()
        return True, "restarted"
    except subprocess.TimeoutExpired:
        return False, "restart_timeout"
    except (OSError, PermissionError) as e:
        return False, f"system_error: {str(e)}"
    except Exception as e:
        return False, str(e)


def systemctl_is_active(service: str) -> Tuple[bool, str]:
    """Check if systemd service is active"""
    try:
        cp = subprocess.run(["systemctl", "is-active", service], capture_output=True, text=True, timeout=10)
        s = (cp.stdout or "").strip()
        return (s == "active"), s or "unknown"
    except subprocess.TimeoutExpired:
        return False, "timeout"
    except (OSError, PermissionError) as e:
        return False, f"system_error: {str(e)}"
    except Exception as e:
        return False, str(e)


def check_nextjs_status() -> dict:
    """Check Next.js dev server status"""
    try:
        # Check if port is listening
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex(('127.0.0.1', NEXTJS_PORT))
        sock.close()
        
        if result != 0:
            return {"active": False, "state": "inactive", "port": NEXTJS_PORT}
        
        # Try HTTP request
        try:
            req = urllib.request.Request(f"{NEXTJS_URL}/api/ping")
            with urllib.request.urlopen(req, timeout=3) as response:
                status_code = response.getcode()
                return {
                    "active": True,
                    "state": "active",
                    "port": NEXTJS_PORT,
                    "url": NEXTJS_URL,
                    "status_code": status_code
                }
        except Exception as e:
            return {
                "active": True,
                "state": "active",
                "port": NEXTJS_PORT,
                "url": NEXTJS_URL,
                "error": str(e)
            }
    except Exception as e:
        return {"active": False, "state": "error", "error": str(e)}

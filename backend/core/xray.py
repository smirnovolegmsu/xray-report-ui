#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Xray configuration repository - работа с конфигурацией Xray
"""
import base64
import json
import os
import re
import subprocess
from typing import Any, Dict, List, Optional, Tuple

from backend.core.helpers import atomic_write_text
from backend.core.config import load_settings, XRAY_CFG


def load_xray_config(path: str = None) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Load Xray config from file"""
    if path is None:
        path = load_settings()["xray"].get("config_path", XRAY_CFG)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f), None
    except Exception as e:
        return None, str(e)


def save_xray_config(cfg: Dict[str, Any], path: str = None) -> None:
    """Save Xray config to file"""
    if path is None:
        path = load_settings()["xray"].get("config_path", XRAY_CFG)
    atomic_write_text(path, json.dumps(cfg, ensure_ascii=False, indent=2) + "\n")


def find_vless_inbound(cfg: Dict[str, Any], inbound_tag: str = "") -> Optional[Dict[str, Any]]:
    """Find VLESS inbound in config"""
    inbounds = cfg.get("inbounds") or []
    if inbound_tag:
        for ib in inbounds:
            if isinstance(ib, dict) and ib.get("tag") == inbound_tag:
                return ib
    for ib in inbounds:
        if not isinstance(ib, dict):
            continue
        if ib.get("protocol") == "vless":
            return ib
    return None


def get_xray_clients(cfg: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """Get clients from Xray config"""
    if cfg is None:
        cfg, _ = load_xray_config()
    if not cfg:
        return []
    settings = load_settings()
    ib = find_vless_inbound(cfg, settings["xray"].get("inbound_tag", ""))
    if not ib:
        return []
    clients = (ib.get("settings") or {}).get("clients") or []
    return clients


def derive_pbk_from_private(priv_b64: str, settings: Dict[str, Any] = None) -> Optional[str]:
    """Derive public key from private key using xray CLI or cryptography"""
    if settings is None:
        settings = load_settings()
    override = settings.get("xray", {}).get("reality_pbk", "").strip()
    if override:
        return override
    
    priv_b64 = (priv_b64 or "").strip()
    if not priv_b64:
        return None
    
    # Try xray x25519 command
    try:
        cp = subprocess.run(
            ["xray", "x25519", "-i", priv_b64],
            capture_output=True, text=True, timeout=5.0
        )
        output = (cp.stdout or "") + "\n" + (cp.stderr or "")
        
        # Parse output - look for "Password:" line
        for line in output.split("\n"):
            line = line.strip()
            if line.startswith("Password:"):
                pbk = line.split(":", 1)[1].strip()
                if len(pbk) >= 43:
                    return pbk
        
        # Fallback: try to find any base64-like string
        for line in output.split("\n"):
            line = line.strip()
            if not line or line.startswith("PrivateKey:"):
                continue
            m = re.search(r'([A-Za-z0-9_-]{43,44})', line)
            if m:
                candidate = m.group(1)
                if len(candidate) >= 43 and candidate != priv_b64:
                    return candidate
    except Exception:
        pass
    
    # Fallback: cryptography library
    try:
        from cryptography.hazmat.primitives.asymmetric import x25519
        from cryptography.hazmat.primitives import serialization
        pad = "=" * ((4 - len(priv_b64) % 4) % 4)
        raw = base64.urlsafe_b64decode(priv_b64 + pad)
        pub = x25519.X25519PrivateKey.from_private_bytes(raw).public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        return base64.urlsafe_b64encode(pub).decode("utf-8").rstrip("=")
    except Exception:
        return None

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Common API utilities and response helpers
"""
from flask import Blueprint, jsonify
from typing import Any, Dict, Tuple

from backend.core.helpers import now_utc_iso

common_bp = Blueprint('common', __name__)


def ok(data: Dict[str, Any] = None):
    """Return success JSON response"""
    resp = {"ok": True}
    if data:
        resp.update(data)
    return jsonify(resp)


def fail(error: str, code: int = 400, **extra):
    """Return error JSON response"""
    payload = {"ok": False, "error": error}
    payload.update(extra)
    return jsonify(payload), code


@common_bp.get("/api/ping")
def ping():
    """Health check endpoint"""
    return ok({"message": "pong", "ts": now_utc_iso()})


def validate_email(email: str) -> Tuple[bool, str]:
    """Validate email format"""
    if not email:
        return False, "email_required"
    if "@" not in email or len(email) < 3:
        return False, "invalid_email_format"
    # Check that there's content before and after @
    parts = email.split("@", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return False, "invalid_email_format"
    if len(email) > 255:
        return False, "email_too_long"
    return True, ""


def validate_uuid(uuid: str) -> Tuple[bool, str]:
    """Validate UUID v4 format"""
    if not uuid:
        return False, "uuid_required"
    import re
    uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    if not re.match(uuid_pattern, uuid, re.IGNORECASE):
        return False, "invalid_uuid_format"
    return True, ""


def validate_filename(filename: str) -> Tuple[bool, str]:
    """Validate filename (prevent path traversal)"""
    if not filename:
        return False, "filename_required"
    if ".." in filename or "/" in filename or "\\" in filename:
        return False, "invalid_filename"
    return True, ""

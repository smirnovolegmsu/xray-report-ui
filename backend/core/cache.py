#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
In-memory cache with TTL support
"""
import time
from typing import Any, Dict, Optional

from backend.core.config import (
    CACHE_MAX_SIZE,
    CACHE_CLEANUP_THRESHOLD,
    CACHE_TTL,
)

_cache: Dict[str, Dict[str, Any]] = {}


def get_cached(key: str, ttl: Optional[float] = None) -> Optional[Any]:
    """
    Get cached value if exists and not expired
    
    Args:
        key: Cache key
        ttl: Time to live in seconds (overrides default TTL)
        
    Returns:
        Cached value or None if not found/expired
    """
    if key not in _cache:
        return None
    
    entry = _cache[key]
    now = time.time()
    
    # Check expiration
    if now >= entry["expires"]:
        del _cache[key]
        return None
    
    return entry["value"]


def set_cached(key: str, value: Any, ttl: Optional[float] = None) -> None:
    """
    Set cached value with TTL
    
    Args:
        key: Cache key
        value: Value to cache
        ttl: Time to live in seconds (uses default TTL if not specified)
    """
    now = time.time()
    
    # Determine TTL
    if ttl is None:
        # Try to get TTL from cache type (e.g., "dashboard", "users")
        cache_type = key.split("_")[0] if "_" in key else None
        ttl = CACHE_TTL.get(cache_type, 60.0)
    
    expires = now + ttl
    
    _cache[key] = {
        "value": value,
        "expires": expires,
        "created": now,
    }
    
    # Cleanup if cache is too large
    if len(_cache) > CACHE_MAX_SIZE:
        _cleanup_cache()


def _cleanup_cache() -> None:
    """Remove oldest entries from cache"""
    # Sort by creation time
    sorted_entries = sorted(_cache.items(), key=lambda x: x[1]["created"])
    
    # Remove oldest entries
    to_remove = min(CACHE_CLEANUP_THRESHOLD, len(sorted_entries))
    for i in range(to_remove):
        del _cache[sorted_entries[i][0]]


def clear_cache() -> None:
    """Clear all cache entries"""
    _cache.clear()

"""
AgriFusion Backend — Mandi Market Price Bounded In-Memory Cache
Provides thread-safe, async-compatible caching for market price predictions
to prevent cache stampede and handle upstream API / calculation timeouts cleanly.
"""

import asyncio
import logging
import time
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# Bounded in-memory store
_MARKET_CACHE: Dict[str, Dict[str, Any]] = {}
_MAX_CACHE_SIZE = 1000
_DEFAULT_TTL_SECONDS = 600  # 10 minutes TTL

_CACHE_LOCK: Optional[asyncio.Lock] = None

def get_cache_lock() -> asyncio.Lock:
    """Get or create asyncio Lock bound to the active running loop."""
    global _CACHE_LOCK
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if _CACHE_LOCK is None or (_CACHE_LOCK._loop is not None and _CACHE_LOCK._loop != loop):
        _CACHE_LOCK = asyncio.Lock()
    return _CACHE_LOCK


def make_market_cache_key(
    state: str,
    district: str,
    commodity: str,
    market_date: str,
    area: float,
    season: str,
    year: int,
) -> str:
    """Generate normalized, deterministic cache key for market price lookup."""
    st = str(state or "").strip().lower()
    dt = str(district or "").strip().lower()
    cm = str(commodity or "").strip().lower()
    md = str(market_date or "").strip()
    ar = round(float(area or 1.0), 2)
    sn = str(season or "").strip().lower()
    yr = int(year or 2026)
    return f"{st}:{dt}:{cm}:{md}:{ar}:{sn}:{yr}"


def get_cached_market_price(cache_key: str, ttl_seconds: float = _DEFAULT_TTL_SECONDS) -> Tuple[Optional[Dict[str, Any]], bool]:
    """
    Retrieve market price from cache.
    Returns (data, is_stale).
    - If hit and fresh: (data, False)
    - If hit and expired: (data, True)  <-- allows stale fallback when upstream fails
    - If miss: (None, True)
    """
    entry = _MARKET_CACHE.get(cache_key)
    if not entry:
        return None, True

    age = time.time() - entry.get("timestamp", 0)
    is_stale = age > ttl_seconds
    return entry.get("data"), is_stale


def set_cached_market_price(cache_key: str, data: Dict[str, Any]) -> None:
    """Store fresh market price result in cache with bounded size cleanup."""
    if len(_MARKET_CACHE) >= _MAX_CACHE_SIZE:
        # Evict oldest 100 entries
        sorted_keys = sorted(_MARKET_CACHE.keys(), key=lambda k: _MARKET_CACHE[k].get("timestamp", 0))
        for k in sorted_keys[:100]:
            _MARKET_CACHE.pop(k, None)

    _MARKET_CACHE[cache_key] = {
        "data": data,
        "timestamp": time.time(),
    }

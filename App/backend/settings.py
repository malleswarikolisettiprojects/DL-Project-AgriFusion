"""
AgriFusion — Central Settings Module
=====================================
All secrets are read exclusively from environment variables (os.environ).
A local .env file is loaded ONLY when running in development mode
(i.e., when a .env file exists next to this file).

SECURITY CONTRACT
-----------------
* Never print, log, or return any secret value.
* Never include fallback credentials in this file.
* If Supabase is not configured, set the client to None and continue.
* Report configuration status without exposing any values.
"""

import os
import sys
from pathlib import Path
from typing import Optional

# ──────────────────────────────────────────────────────────────────────────────
# Optional dev-only .env loading
# ──────────────────────────────────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent

def _load_dotenv_if_dev() -> None:
    """Load .env only during local development. Never used in production."""
    env_file = _BACKEND_DIR / ".env"
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file, override=False)  # env vars already set take precedence
        except ImportError:
            pass  # python-dotenv not installed — that's fine in production


_load_dotenv_if_dev()

# ──────────────────────────────────────────────────────────────────────────────
# Secret resolver — tries Streamlit secrets first, then os.environ
# ──────────────────────────────────────────────────────────────────────────────
def _get_env(key: str) -> Optional[str]:
    """
    Resolve a configuration value from:
    1. Streamlit secrets (st.secrets) — available when running via Streamlit
    2. os.environ — standard environment variables

    Returns None (never raises) if not configured.
    Never prints or returns secret values.
    """
    # Try Streamlit secrets first (when running inside Streamlit)
    try:
        import streamlit as st
        if hasattr(st, "secrets") and key in st.secrets:
            value = str(st.secrets[key]).strip()
            return value if value else None
    except Exception:
        pass

    value = os.environ.get(key, "").strip()
    return value if value else None


# ──────────────────────────────────────────────────────────────────────────────
# Public configuration constants (safe to import anywhere)
# ──────────────────────────────────────────────────────────────────────────────

# Database
SUPABASE_URL: Optional[str] = _get_env("SUPABASE_URL")
SUPABASE_KEY: Optional[str] = _get_env("SUPABASE_KEY")

# External AI providers
ROBOFLOW_API_KEY: Optional[str] = _get_env("ROBOFLOW_API_KEY")
HF_TOKEN: Optional[str] = _get_env("HF_TOKEN")

# Admin authentication — NO DEFAULTS. Must be set explicitly in production.
ADMIN_USERNAME: Optional[str] = _get_env("ADMIN_USERNAME")
ADMIN_PASSWORD: Optional[str] = _get_env("ADMIN_PASSWORD")

# Service URLs
BACKEND_URL: str = _get_env("BACKEND_URL") or "http://localhost:8000"
FRONTEND_URL: str = _get_env("FRONTEND_URL") or "http://localhost:8501"

# External API endpoints (public, non-secret defaults are acceptable)
OPENMETEO_BASE_URL: str = (
    _get_env("OPENMETEO_BASE_URL") or "https://api.open-meteo.com/v1/forecast"
)
SOILGRIDS_BASE_URL: str = (
    _get_env("SOILGRIDS_BASE_URL")
    or "https://rest.isric.org/soilgrids/v2.0/properties/query"
)

# Storage
SUPABASE_BUCKET: str = _get_env("SUPABASE_BUCKET") or "crop-images"

# ──────────────────────────────────────────────────────────────────────────────
# Supabase client factory — returns None if not configured; never crashes
# ──────────────────────────────────────────────────────────────────────────────
def create_supabase_client():
    """
    Build and return a Supabase client, or None if credentials are absent.
    Never logs or exposes credential values.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        from supabase import create_client
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return client
    except Exception as exc:
        # Log only that initialization failed, never the values
        print(f"[settings] Supabase client initialization failed: {type(exc).__name__}")
        return None


# ──────────────────────────────────────────────────────────────────────────────
# Configuration status report (safe — no values shown)
# ──────────────────────────────────────────────────────────────────────────────
def get_config_status() -> dict:
    """
    Returns a safe dictionary showing which integrations are configured.
    Never includes actual credential values.
    """
    return {
        "supabase_configured": bool(SUPABASE_URL and SUPABASE_KEY),
        "roboflow_configured": bool(ROBOFLOW_API_KEY),
        "hf_token_configured": bool(HF_TOKEN),
        "admin_configured": bool(ADMIN_USERNAME and ADMIN_PASSWORD),
        "backend_url_set": bool(_get_env("BACKEND_URL")),
        "frontend_url_set": bool(_get_env("FRONTEND_URL")),
    }

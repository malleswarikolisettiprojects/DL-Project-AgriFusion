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
    Resolve a configuration value from os.environ (or st.secrets if already in Streamlit).
    Returns None (never raises) if not configured.
    Never prints or returns secret values.
    """
    if "streamlit" in sys.modules:
        try:
            st = sys.modules["streamlit"]
            if hasattr(st, "secrets") and key in st.secrets:
                value = str(st.secrets[key]).strip()
                if value:
                    return value
        except Exception:
            pass

    value = os.environ.get(key, "").strip()
    return value if value else None


# ──────────────────────────────────────────────────────────────────────────────
# Public configuration constants (safe to import anywhere)
# ──────────────────────────────────────────────────────────────────────────────

# Database
SUPABASE_URL: Optional[str] = _get_env("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY: Optional[str] = _get_env("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY: Optional[str] = _get_env("SUPABASE_ANON_KEY")

# Standard key defaults to SERVICE_ROLE_KEY if set, otherwise ANON_KEY or SUPABASE_KEY
SUPABASE_KEY: Optional[str] = (
    SUPABASE_SERVICE_ROLE_KEY
    or _get_env("SUPABASE_KEY")
    or SUPABASE_ANON_KEY
)


# External AI providers
ROBOFLOW_API_KEY: Optional[str] = _get_env("ROBOFLOW_API_KEY")
HF_TOKEN: Optional[str] = _get_env("HF_TOKEN")

# Admin authentication — defaults to standard admin credentials if env vars absent
ADMIN_USERNAME: Optional[str] = _get_env("ADMIN_USERNAME") or "Admin@1"
ADMIN_PASSWORD: Optional[str] = _get_env("ADMIN_PASSWORD") or "Admin@123"

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
# Supabase client factories — returns None if not configured; never crashes
# ──────────────────────────────────────────────────────────────────────────────
def create_supabase_client():
    """
    Build and return standard Supabase client for general requests.
    Never logs or exposes credential values.
    """
    key = SUPABASE_ANON_KEY or SUPABASE_KEY
    if not SUPABASE_URL or not key:
        return None
    try:
        from supabase import create_client
        client = create_client(SUPABASE_URL, key)
        return client
    except Exception as exc:
        print(f"[settings] Supabase client initialization failed: {type(exc).__name__}")
        return None


def create_supabase_admin_client():
    """
    Build and return privileged server-only Supabase Admin client (using SUPABASE_SERVICE_ROLE_KEY).
    Used exclusively on the backend for Auth Admin operations and admin directory queries.
    Never exposed to frontend/browser clients.
    """
    admin_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY
    if not SUPABASE_URL or not admin_key:
        return None
    try:
        from supabase import create_client
        client = create_client(SUPABASE_URL, admin_key)
        return client
    except Exception as exc:
        print(f"[settings] Supabase admin client initialization failed: {type(exc).__name__}")
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
        "supabase_admin_configured": bool(SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY)),
        "roboflow_configured": bool(ROBOFLOW_API_KEY),
        "hf_token_configured": bool(HF_TOKEN),
        "admin_configured": bool(ADMIN_USERNAME and ADMIN_PASSWORD),
        "backend_url_set": bool(_get_env("BACKEND_URL")),
        "frontend_url_set": bool(_get_env("FRONTEND_URL")),
    }

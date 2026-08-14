import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

# Load local .env if present
env_file = BASE_DIR / ".env"
if env_file.exists():
    load_dotenv(env_file)

def _get_secret(key: str, default: str = None) -> str:
    try:
        import streamlit as st
        if hasattr(st, "secrets") and key in st.secrets:
            return str(st.secrets[key]).strip()
    except Exception:
        pass
    val = os.getenv(key, default)
    return str(val).strip() if val is not None else default

SUPABASE_URL = _get_secret("SUPABASE_URL", "https://xeuaiuomugigagktsybn.supabase.co")
SUPABASE_KEY = _get_secret("SUPABASE_KEY")
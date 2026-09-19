import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

# Optional dev-only .env loading (production reads from os.environ directly)
_env_file = BASE_DIR / ".env"
if _env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_file, override=False)
    except ImportError:
        pass

# Import from central settings — no hardcoded fallback values
from App.backend.settings import SUPABASE_URL, SUPABASE_KEY

__all__ = ["SUPABASE_URL", "SUPABASE_KEY"]
from pathlib import Path
from dotenv import load_dotenv
import os

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

PICKLES_DIR = BASE_DIR / "pickles"

OPENMETEO_BASE_URL = os.getenv(
    "OPENMETEO_BASE_URL",
    "https://api.open-meteo.com/v1/forecast"
)
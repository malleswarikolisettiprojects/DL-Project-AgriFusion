import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
from App.backend.database.database import supabase

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "data" / "crop_growth_stages.csv"

def get_crop_stage_details(crop_name: str):
    """
    Retrieve stage days, Kc coefficients, root depths for a given crop.
    First tries Supabase 'crop_growth_stages' table, then falls back to local CSV.
    """
    if not crop_name:
        crop_name = "Rice"

    # 1. Try fetching from Supabase
    if supabase is not None:
        try:
            res = supabase.table("crop_growth_stages").select("*").ilike("crop_name", f"%{crop_name}%").execute()
            if res and res.data and len(res.data) > 0:
                return res.data[0]
        except Exception:
            pass

    # 2. Fallback to local CSV
    if CSV_PATH.exists():
        try:
            df = pd.read_csv(CSV_PATH)
            match = df[df["crop_name"].str.lower() == str(crop_name).lower()]
            if match.empty:
                # Partial match search
                match = df[df["crop_name"].str.lower().str.contains(str(crop_name).lower())]
            
            if not match.empty:
                row = match.iloc[0].to_dict()
                return row
        except Exception as e:
            print("Error reading crop_growth_stages.csv:", e)

    # 3. Default fallback values
    return {
        "crop_name": crop_name,
        "initial_stage_days": 30,
        "development_stage_days": 30,
        "mid_season_stage_days": 40,
        "late_season_stage_days": 20,
        "total_growth_days": 120,
        "kc_ini": 0.40,
        "kc_mid": 1.15,
        "kc_end": 0.50,
        "root_depth_min_m": 0.30,
        "root_depth_max_m": 1.20
    }

def calculate_crop_dates(crop_name: str, start_date_str: str):
    """
    Given a crop name and start_date string (YYYY-MM-DD),
    calculates end_date, total growth days, and stage breakdowns.
    """
    details = get_crop_stage_details(crop_name)
    total_days = int(details.get("total_growth_days", 120))

    try:
        s_date = pd.to_datetime(start_date_str)
    except Exception:
        s_date = pd.Timestamp.today()

    e_date = s_date + pd.Timedelta(days=total_days)

    details["start_date"] = s_date.strftime("%Y-%m-%d")
    details["calculated_end_date"] = e_date.strftime("%Y-%m-%d")

    return details

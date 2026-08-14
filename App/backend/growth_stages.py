"""
Crop growth-stage lookup, backed by the Supabase `crop_growth_stages` table.

Shared across every prediction module that needs a crop's FAO-56 stage
lengths, Kc values, root depth, or a computed start/end date window
(Climate Risk, Irrigation, Yield, Market all pull from here instead of
each hardcoding their own date logic).
"""

from datetime import date, timedelta
from functools import lru_cache

from App.backend.database.database import supabase


@lru_cache(maxsize=64)
def get_growth_stage(crop_name: str):
    """
    Fetch the FAO-56 growth-stage row for a crop from Supabase.
    Returns a dict, or None if the crop isn't in the table.
    Cached in-process since this reference table changes rarely.
    """
    if not crop_name:
        return None

    response = (
        supabase
        .table("crop_growth_stages")
        .select("*")
        .ilike("crop_name", crop_name.strip())
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


@lru_cache(maxsize=1)
def get_all_crop_names():
    """All crop names available in crop_growth_stages, sorted A-Z."""
    response = supabase.table("crop_growth_stages").select("crop_name").execute()
    rows = response.data or []
    return tuple(sorted(r["crop_name"] for r in rows))


def compute_date_range(crop_name: str, start_date: date = None):
    """
    (start_date, end_date, stage_row) for a crop.

    end_date = start_date + total_growth_days, pulled from Supabase.
    Falls back to a 120-day generic window if the crop has no row
    (e.g. the Crop Recommendation tab, run before a crop is known).
    """
    start_date = start_date or date.today()
    stage = get_growth_stage(crop_name)
    total_days = stage["total_growth_days"] if stage else 120
    end_date = start_date + timedelta(days=total_days)
    return start_date, end_date, stage


def compute_stage_boundaries(crop_name: str, start_date: date = None):
    """
    Break a crop's growth window into its four FAO-56 stages, each with
    its own date range and Kc value. Used by the Irrigation module so
    the Growth Stage dropdown and Kc value come straight from Supabase
    instead of being typed in by hand.

    Returns a list of dicts: [{stage, days, kc, start, end}, ...],
    or [] if the crop has no Supabase row.
    """
    start_date = start_date or date.today()
    stage = get_growth_stage(crop_name)
    if not stage:
        return []

    segments = [
        ("Initial", stage["initial_stage_days"], stage["kc_ini"]),
        ("Development", stage["development_stage_days"], stage["kc_ini"]),
        ("Mid-season", stage["mid_season_stage_days"], stage["kc_mid"]),
        ("Late season", stage["late_season_stage_days"], stage["kc_end"]),
    ]

    boundaries = []
    cursor = start_date
    for name, days, kc in segments:
        seg_start, seg_end = cursor, cursor + timedelta(days=days)
        boundaries.append({
            "stage": name, "days": days, "kc": float(kc),
            "start": seg_start, "end": seg_end,
        })
        cursor = seg_end
    return boundaries
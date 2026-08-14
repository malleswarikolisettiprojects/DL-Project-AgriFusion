"""
Indian cropping-season lookup, derived from the calendar date rather
than typed in by hand.

Kharif  : sown with the monsoon, roughly June - October
Rabi    : sown after monsoon withdrawal, roughly November - March
Whole Year : April - May window, and the catch-all for perennial /
             continuously-grown crops (sugarcane, banana, etc.)
"""

from datetime import date

_KHARIF_MONTHS = {6, 7, 8, 9, 10}
_RABI_MONTHS = {11, 12, 1, 2, 3}


def get_season(d: date) -> str:
    """Map a date to Kharif / Rabi / Whole Year."""
    if d.month in _KHARIF_MONTHS:
        return "Kharif"
    if d.month in _RABI_MONTHS:
        return "Rabi"
    return "Whole Year"
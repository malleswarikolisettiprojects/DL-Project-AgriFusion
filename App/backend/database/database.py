"""
AgriFusion — Supabase database client.

The client is initialised lazily and returns None if credentials
are not present in the environment.  Import errors at module level
will NOT crash the application.
"""

from App.backend.settings import create_supabase_client

# ── Supabase client (None if not configured) ──────────────────────────────────
supabase = create_supabase_client()


# ── Generic prediction saver (used by legacy code) ──────────────────────────
def save_prediction(prediction_type: str, input_data: dict, prediction):
    """Save a generic prediction record to Supabase. No-ops if client is None."""
    if supabase is None:
        return None

    data = {
        "prediction_type": prediction_type,
        "input_data": input_data,
        "prediction": str(prediction),
    }

    try:
        response = (
            supabase
            .table("predictions")
            .insert(data)
            .execute()
        )
        return response
    except Exception:
        return None
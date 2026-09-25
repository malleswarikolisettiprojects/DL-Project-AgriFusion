"""
AgriFusion — Admin Filtered Farm Count Test Suite
==================================================
Tests requirements for GET /api/v1/admin/farms:
  1. Farms present matching filters and exceeding privacy_threshold (returns exact count).
  2. Farms present matching filters but suppressed by privacy_threshold (returns count: null, suppressed: true).
  3. No farms matching filters (returns count: 0, suppressed: false).
  4. Server-side filtering by state, district, crop, area_range, and irrigation_type.
  5. Database query failure (raises exception, 500 status).
  6. Privacy verification: Proof that farm rows, IDs, names, villages, and coordinates are NEVER returned.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi import FastAPI
from fastapi.testclient import TestClient

from App.backend.auth.dependencies import CurrentUser, get_current_user, require_admin
from App.backend.admin.router import admin_router
from App.backend.database.auth_db import (
    _convert_to_acres,
    _map_area_range,
    fetch_filtered_farm_count,
)

app = FastAPI()
app.include_router(admin_router)

client = TestClient(app)

def mock_admin_user():
    return CurrentUser(
        user_id="99999999-9999-9999-9999-999999999999",
        email="admin@agrifusion.test",
        role="admin",
        status="active",
        claims={"sub": "99999999-9999-9999-9999-999999999999", "app_metadata": {"role": "admin"}},
    )


# -----------------------------------------------------------------------------
# 1. Unit Conversion Tests
# -----------------------------------------------------------------------------
def test_unit_conversion_to_acres():
    """Verify area values in ha, cents, sq_m, guntha, and acres convert accurately."""
    assert round(_convert_to_acres(1.0, "ha"), 2) == 2.47
    assert round(_convert_to_acres(100.0, "cents"), 2) == 1.0
    assert round(_convert_to_acres(4046.86, "sq_m"), 2) == 1.0
    assert round(_convert_to_acres(40.0, "guntha"), 2) == 1.0
    assert round(_convert_to_acres(5.0, "acres"), 2) == 5.0
    assert _convert_to_acres(None, "acres") is None
    assert _convert_to_acres(-5.0, "acres") is None


def test_area_range_bucket_mapping():
    """Verify numeric area maps into standardized range buckets."""
    assert _map_area_range(0.5, "acres") == "<1 acre"
    assert _map_area_range(1.5, "acres") == "1–2 acres"
    assert _map_area_range(3.0, "acres") == "2–5 acres"
    assert _map_area_range(7.5, "acres") == "5–10 acres"
    assert _map_area_range(12.0, "acres") == ">10 acres"
    assert _map_area_range(1.0, "ha") == "2–5 acres"  # 1 ha = 2.47 acres -> 2-5 acres


# -----------------------------------------------------------------------------
# 2. Filtered Count Meeting Threshold
# -----------------------------------------------------------------------------
def test_farms_present_count_meets_threshold():
    """Verify exact count is returned when matching count >= privacy_threshold."""
    mock_supabase = MagicMock()
    mock_farms_table = MagicMock()
    mock_supabase.table.return_value = mock_farms_table
    mock_select = MagicMock()
    mock_farms_table.select.return_value = mock_select

    # 6 farm plots in Visakhapatnam
    mock_select.execute.return_value = MagicMock(data=[
        {"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Paddy", "land_area": 5.0, "land_area_unit": "acres", "irrigation_type": "Drip", "id": f"farm-{i}", "user_id": f"user-{i}"}
        for i in range(6)
    ])

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        res = fetch_filtered_farm_count(state="Andhra Pradesh", district="Visakhapatnam", privacy_threshold=5)
        assert res["count"] == 6
        assert res["suppressed"] is False
        assert res["privacy_threshold"] == 5
        assert res["filters_applied"]["state"] == "Andhra Pradesh"
        assert res["filters_applied"]["district"] == "Visakhapatnam"


# -----------------------------------------------------------------------------
# 3. Small Cohort Suppressed by Privacy Threshold
# -----------------------------------------------------------------------------
def test_farms_present_but_suppressed():
    """Verify matching count < privacy_threshold returns count: null, suppressed: true."""
    mock_supabase = MagicMock()
    mock_farms_table = MagicMock()
    mock_supabase.table.return_value = mock_farms_table
    mock_select = MagicMock()
    mock_farms_table.select.return_value = mock_select

    # 3 farm plots in Visakhapatnam (threshold = 5)
    mock_select.execute.return_value = MagicMock(data=[
        {"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Paddy", "land_area": 5.0, "land_area_unit": "acres", "irrigation_type": "Drip", "id": f"farm-{i}"}
        for i in range(3)
    ])

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        res = fetch_filtered_farm_count(state="Andhra Pradesh", district="Visakhapatnam", privacy_threshold=5)
        assert res["count"] is None
        assert res["suppressed"] is True
        assert res["privacy_threshold"] == 5
        assert "suppressed for privacy" in res["privacy_note"]


# -----------------------------------------------------------------------------
# 4. Zero Matches (No Matching Farms)
# -----------------------------------------------------------------------------
def test_no_farms_match_filters():
    """Verify zero matching farms returns count: 0, suppressed: false."""
    mock_supabase = MagicMock()
    mock_farms_table = MagicMock()
    mock_supabase.table.return_value = mock_farms_table
    mock_select = MagicMock()
    mock_farms_table.select.return_value = mock_select

    # 2 farms in Gujarat (doesn't match Andhra Pradesh)
    mock_select.execute.return_value = MagicMock(data=[
        {"state": "Gujarat", "district": "Anand", "crop": "Cotton", "land_area": 2.0, "land_area_unit": "acres", "irrigation_type": "Canal"},
    ])

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        res = fetch_filtered_farm_count(state="Andhra Pradesh", privacy_threshold=5)
        assert res["count"] == 0
        assert res["suppressed"] is False
        assert "No farms match" in res["privacy_note"]


# -----------------------------------------------------------------------------
# 5. Database Query Failure (Fails Closed 500 Error)
# -----------------------------------------------------------------------------
def test_database_query_failure_raises_500():
    """Verify database query failure raises RuntimeError resulting in HTTP 500 error."""
    mock_supabase = MagicMock()
    mock_farms_table = MagicMock()
    mock_supabase.table.return_value = mock_farms_table
    mock_farms_table.select.side_effect = Exception("Supabase DB Connection Failed")

    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        res = client.get("/api/v1/admin/farms")
        assert res.status_code == 500
        assert res.json()["detail"] == "The backend encountered an internal error."

    app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 6. Proof that Farm Rows & Identifying Fields are NEVER Returned
# -----------------------------------------------------------------------------
def test_identifying_fields_and_rows_never_returned():
    """Verify response contains count summary only and zero farm rows/PII."""
    mock_supabase = MagicMock()
    mock_farms_table = MagicMock()
    mock_supabase.table.return_value = mock_farms_table
    mock_select = MagicMock()
    mock_farms_table.select.return_value = mock_select

    # Raw rows with identifying metadata
    mock_select.execute.return_value = MagicMock(data=[
        {
            "id": f"11111111-2222-3333-4444-55555555555{i}",
            "user_id": f"user-uuid-{i}",
            "name": f"Secret Farm Plot {i}",
            "village": "Private Village Alpha",
            "latitude": 17.6868,
            "longitude": 83.2185,
            "state": "Andhra Pradesh",
            "district": "Visakhapatnam",
            "crop": "Chilli",
            "land_area": 2.5,
            "land_area_unit": "acres",
            "irrigation_type": "Sprinkler",
        }
        for i in range(8)
    ])

    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        res = client.get("/api/v1/admin/farms?state=Andhra+Pradesh&privacy_threshold=5")
        assert res.status_code == 200
        data = res.json()
        
        # Verify count-oriented keys only
        assert set(data.keys()) == {"count", "filters_applied", "suppressed", "privacy_threshold", "privacy_note"}
        assert data["count"] == 8
        assert data["suppressed"] is False
        assert "items" not in data
        assert "farms" not in data

        # Explicit assertion that identifying fields are absent
        for forbidden in ("id", "user_id", "name", "village", "latitude", "longitude"):
            assert forbidden not in data

    app.dependency_overrides.clear()


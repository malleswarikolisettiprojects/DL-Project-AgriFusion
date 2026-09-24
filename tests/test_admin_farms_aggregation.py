"""
AgriFusion — Admin Regional Farm Profiles Aggregation Test Suite
===============================================================
Tests requirements for GET /api/v1/admin/farms:
  1. Farms present and group meeting threshold
  2. Farms present but suppressed by min_group_threshold
  3. No farms present (empty database)
  4. Unit conversions (ha, cents, sq_m, guntha -> acres and area range buckets)
  5. Database query failure (raises exception, 500 status)
  6. Privacy verification: Proof that identifying fields (id, user_id, name, village, coordinates) are NEVER returned.
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
    fetch_regional_farm_profiles,
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
    # Unit conversion integration
    assert _map_area_range(1.0, "ha") == "2–5 acres"  # 1 ha = 2.47 acres -> 2-5 acres


# -----------------------------------------------------------------------------
# 2. Farms Present & Group Meeting Threshold
# -----------------------------------------------------------------------------
def test_farms_present_group_meets_threshold():
    """Verify farms matching or exceeding threshold are grouped and returned."""
    mock_supabase = MagicMock()
    mock_farms_table = MagicMock()
    mock_supabase.table.return_value = mock_farms_table
    mock_select = MagicMock()
    mock_farms_table.select.return_value = mock_select

    # 3 identical farm plots in Visakhapatnam
    mock_select.execute.return_value = MagicMock(data=[
        {"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "land_area": 5.0, "land_area_unit": "acres", "irrigation_type": "Drip", "id": "secret-farm-1", "user_id": "secret-user-1", "name": "Private Plot A", "village": "Anakapalle"},
        {"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "land_area": 5.0, "land_area_unit": "acres", "irrigation_type": "Drip", "id": "secret-farm-2", "user_id": "secret-user-2", "name": "Private Plot B", "village": "Anakapalle"},
        {"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "land_area": 5.0, "land_area_unit": "acres", "irrigation_type": "Drip", "id": "secret-farm-3", "user_id": "secret-user-3", "name": "Private Plot C", "village": "Anakapalle"},
    ])

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        res = fetch_regional_farm_profiles(min_group_threshold=2)
        assert res["total"] == 1
        assert res["suppressed_groups"] == 0
        assert "Only minimized" in res["privacy_note"]
        item = res["items"][0]
        assert item["state"] == "Andhra Pradesh"
        assert item["district"] == "Visakhapatnam"
        assert item["crop"] == "Rice"
        assert item["area_range"] == "5–10 acres"
        assert item["irrigation_type"] == "Drip"


# -----------------------------------------------------------------------------
# 3. Farms Present but Suppressed by Threshold
# -----------------------------------------------------------------------------
def test_farms_present_but_suppressed():
    """Verify groups below min_group_threshold are suppressed with privacy notice."""
    mock_supabase = MagicMock()
    mock_farms_table = MagicMock()
    mock_supabase.table.return_value = mock_farms_table
    mock_select = MagicMock()
    mock_farms_table.select.return_value = mock_select

    # Single farm plot in Visakhapatnam
    mock_select.execute.return_value = MagicMock(data=[
        {"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "land_area": 5.0, "land_area_unit": "acres", "irrigation_type": "Drip"},
    ])

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        # Threshold = 5
        res = fetch_regional_farm_profiles(min_group_threshold=5)
        assert res["total"] == 0
        assert res["suppressed_groups"] == 1
        assert "suppressed" in res["privacy_note"]


# -----------------------------------------------------------------------------
# 4. No Farms Present (Empty Database)
# -----------------------------------------------------------------------------
def test_no_farms_present():
    """Verify empty database returns total 0, suppressed_groups 0, and clear privacy note."""
    mock_supabase = MagicMock()
    mock_farms_table = MagicMock()
    mock_supabase.table.return_value = mock_farms_table
    mock_select = MagicMock()
    mock_farms_table.select.return_value = mock_select

    mock_select.execute.return_value = MagicMock(data=[])

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        res = fetch_regional_farm_profiles(min_group_threshold=1)
        assert res["total"] == 0
        assert res["suppressed_groups"] == 0
        assert "No farm records match" in res["privacy_note"]


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
# 6. Proof that Identifying Fields are NEVER Returned
# -----------------------------------------------------------------------------
def test_identifying_fields_never_returned():
    """Verify identifying fields (id, user_id, name, village, coordinates) are stripped."""
    mock_supabase = MagicMock()
    mock_farms_table = MagicMock()
    mock_supabase.table.return_value = mock_farms_table
    mock_select = MagicMock()
    mock_farms_table.select.return_value = mock_select

    # Raw row with identifying metadata
    mock_select.execute.return_value = MagicMock(data=[
        {
            "id": "11111111-2222-3333-4444-555555555555",
            "user_id": "user-uuid-999",
            "name": "Secret Family Farm Plot",
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
    ])

    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        res = client.get("/api/v1/admin/farms?min_group_threshold=1")
        assert res.status_code == 200
        data = res.json()
        assert len(data["items"]) == 1
        item = data["items"][0]

        # Allowed aggregate fields
        assert set(item.keys()) == {"state", "district", "crop", "area_range", "irrigation_type"}

        # Explicit assertion that identifying fields are absent
        for forbidden in ("id", "user_id", "name", "village", "latitude", "longitude"):
            assert forbidden not in item

    app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 7. Missing State or District Handling
# -----------------------------------------------------------------------------
def test_farms_missing_state_district():
    """Verify farms missing state or district are excluded from groups without failing."""
    mock_supabase = MagicMock()
    mock_farms_table = MagicMock()
    mock_supabase.table.return_value = mock_farms_table
    mock_select = MagicMock()
    mock_farms_table.select.return_value = mock_select

    # 1 valid farm, 2 incomplete farms missing state or district
    mock_select.execute.return_value = MagicMock(data=[
        {"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Paddy", "land_area": 2.0, "land_area_unit": "acres", "irrigation_type": "Drip"},
        {"state": "", "district": "Visakhapatnam", "crop": "Paddy", "land_area": 2.0, "land_area_unit": "acres", "irrigation_type": "Drip"},
        {"state": "Andhra Pradesh", "district": None, "crop": "Paddy", "land_area": 2.0, "land_area_unit": "acres", "irrigation_type": "Drip"},
    ])

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        res = fetch_regional_farm_profiles(min_group_threshold=1)
        assert res["total"] == 1
        assert res["items"][0]["state"] == "Andhra Pradesh"
        assert res["items"][0]["district"] == "Visakhapatnam"


# -----------------------------------------------------------------------------
# 8. Pagination Verification
# -----------------------------------------------------------------------------
def test_pagination_regional_farm_profiles():
    """Verify pagination correctly slices groups across pages."""
    mock_supabase = MagicMock()
    mock_farms_table = MagicMock()
    mock_supabase.table.return_value = mock_farms_table
    mock_select = MagicMock()
    mock_farms_table.select.return_value = mock_select

    mock_select.execute.return_value = MagicMock(data=[
        {"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Paddy", "land_area": 2.0, "land_area_unit": "acres", "irrigation_type": "Drip"},
        {"state": "Andhra Pradesh", "district": "Guntur", "crop": "Chilli", "land_area": 3.0, "land_area_unit": "acres", "irrigation_type": "Canal"},
        {"state": "Telangana", "district": "Warangal", "crop": "Cotton", "land_area": 4.0, "land_area_unit": "acres", "irrigation_type": "Rainfed"},
    ])

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        # Page 1 with page_size 2
        p1 = fetch_regional_farm_profiles(page=1, page_size=2, min_group_threshold=1)
        assert p1["total"] == 3
        assert len(p1["items"]) == 2
        assert p1["page"] == 1
        assert p1["page_size"] == 2

        # Page 2 with page_size 2
        p2 = fetch_regional_farm_profiles(page=2, page_size=2, min_group_threshold=1)
        assert p2["total"] == 3
        assert len(p2["items"]) == 1
        assert p2["page"] == 2


if __name__ == "__main__":
    print("Running Admin Regional Farm Profiles Aggregation Test Suite...")
    test_unit_conversion_to_acres()
    print(" [1/8] test_unit_conversion_to_acres passed")
    test_area_range_bucket_mapping()
    print(" [2/8] test_area_range_bucket_mapping passed")
    test_farms_present_group_meets_threshold()
    print(" [3/8] test_farms_present_group_meets_threshold passed")
    test_farms_present_but_suppressed()
    print(" [4/8] test_farms_present_but_suppressed passed")
    test_no_farms_present()
    print(" [5/8] test_no_farms_present passed")
    test_database_query_failure_raises_500()
    print(" [6/8] test_database_query_failure_raises_500 passed")
    test_identifying_fields_never_returned()
    print(" [7/8] test_identifying_fields_never_returned passed")
    test_farms_missing_state_district()
    print(" [8/8] test_farms_missing_state_district passed")

    print("\nALL ADMIN REGIONAL FARMS AGGREGATION TESTS PASSED SUCCESSFULLY!")


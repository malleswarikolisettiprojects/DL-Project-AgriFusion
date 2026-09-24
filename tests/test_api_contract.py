"""
AgriFusion — Authoritative API Contract Test Suite
===================================================
Validates response envelopes, field names, error status codes, empty list behaviors,
and authorization controls across base, auth, farmer, and admin API endpoints.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from App.backend.server import app
from App.backend.auth.dependencies import CurrentUser, get_current_user, require_admin

client = TestClient(app)


def mock_farmer_user():
    return CurrentUser(
        user_id="c1f7a4e2-8b9a-4c2d-9e1f-8a2b3c4d5e6f",
        email="farmer@agrifusion.test",
        role="farmer",
        status="active",
        claims={"sub": "c1f7a4e2-8b9a-4c2d-9e1f-8a2b3c4d5e6f"},
    )


def mock_admin_user():
    return CurrentUser(
        user_id="a9b8c7d6-e5f4-3210-fedc-ba9876543210",
        email="admin@agrifusion.test",
        role="admin",
        status="active",
        claims={"sub": "a9b8c7d6-e5f4-3210-fedc-ba9876543210", "app_metadata": {"role": "admin"}},
    )


# -----------------------------------------------------------------------------
# 1. Base / Health Contract Tests
# -----------------------------------------------------------------------------
def test_contract_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "timestamp" in data
    assert "supabase_connected" in data


def test_contract_ready_endpoint():
    res = client.get("/ready")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "services" in data
    assert set(data["services"].keys()) == {"backend", "database", "rag_documents", "models"}


# -----------------------------------------------------------------------------
# 2. Auth & Identity Contract Tests
# -----------------------------------------------------------------------------
def test_contract_unauthorized_user_profile():
    res = client.get("/api/v1/profile")
    assert res.status_code == 401


def test_contract_forbidden_admin_farms_for_farmer():
    app.dependency_overrides[get_current_user] = mock_farmer_user
    res = client.get("/api/v1/admin/farms")
    assert res.status_code == 403
    app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 3. Farmer Operations Contract Tests
# -----------------------------------------------------------------------------
def test_contract_farmer_farms_empty_list():
    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_select = MagicMock()
    mock_table.select.return_value = mock_select
    mock_eq = MagicMock()
    mock_select.eq.return_value = mock_eq
    mock_order = MagicMock()
    mock_eq.order.return_value = mock_order
    mock_order.execute.return_value = MagicMock(data=[])

    app.dependency_overrides[get_current_user] = mock_farmer_user

    with patch("App.backend.database.farmer_db.supabase", mock_supabase):
        res = client.get("/api/v1/farms")
        assert res.status_code == 200
        data = res.json()
        assert "farms" in data
        assert "total" in data
        assert data["farms"] == []
        assert data["total"] == 0

    app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 4. Admin Aggregation Contract Tests
# -----------------------------------------------------------------------------
def test_contract_admin_farms_aggregate():
    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_select = MagicMock()
    mock_table.select.return_value = mock_select

    # 5 identical farms in Visakhapatnam to meet min_group_threshold=5
    records = [
        {"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "land_area": 3.0, "land_area_unit": "acres", "irrigation_type": "Drip"}
        for _ in range(5)
    ]
    mock_select.execute.return_value = MagicMock(data=records)

    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        res = client.get("/api/v1/admin/farms")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert "total" in data
        assert "suppressed_groups" in data
        assert "privacy_note" in data
        assert data["total"] == 1
        item = data["items"][0]
        assert set(item.keys()) == {"state", "district", "crop", "area_range", "irrigation_type"}

    app.dependency_overrides.clear()


def test_contract_validation_error_422():
    res = client.post("/api/v1/predict/crop", json={"state": "Andhra Pradesh"})  # missing district
    assert res.status_code == 422


if __name__ == "__main__":
    print("Running API Contract Test Suite...")
    test_contract_health_endpoint()
    test_contract_ready_endpoint()
    test_contract_unauthorized_user_profile()
    test_contract_forbidden_admin_farms_for_farmer()
    test_contract_farmer_farms_empty_list()
    test_contract_admin_farms_aggregate()
    test_contract_validation_error_422()
    print("ALL API CONTRACT TESTS PASSED!")

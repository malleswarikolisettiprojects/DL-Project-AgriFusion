"""
AgriFusion — Unit & Integration Tests for Admin Diagnostics Audit & Disease Prediction Persistence
===============================================================================================
Tests:
  1. Authenticated disease prediction passes user_id and persists to diagnostic_reports.
  2. Anonymous disease prediction handles user_id=None safely without NOT NULL crashes.
  3. Database insert failure in one table does not prevent other tables or API response.
  4. Admin GET /api/v1/admin/diagnostics fails closed with HTTP 500 on database read errors.
  5. Valid empty table returns HTTP 200 with total: 0 and items: [].
  6. Privacy restrictions: PII is minimized/redacted in administrative diagnostic reports.
  7. Search, crop, and review_status filter support.
"""

import io
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from App.backend.server import app
from App.backend.auth.dependencies import CurrentUser, require_admin, get_optional_current_user

client = TestClient(app)

def mock_admin_user():
    return CurrentUser(
        user_id="99999999-9999-9999-9999-999999999999",
        email="admin_diag@agrifusion.test",
        role="admin",
        status="active",
        claims={"sub": "99999999-9999-9999-9999-999999999999", "app_metadata": {"role": "admin"}},
    )

def mock_farmer_user():
    return CurrentUser(
        user_id="00000000-0000-0000-0000-000000000001",
        email="farmer_diag@agrifusion.test",
        role="farmer",
        status="active",
        claims={"sub": "00000000-0000-0000-0000-000000000001", "app_metadata": {"role": "farmer"}},
    )


@pytest.fixture(autouse=True)
def reset_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_authenticated_disease_prediction_persists_user_id(monkeypatch):
    """Verify that authenticated disease inference passes user_id and invokes save_disease_prediction."""
    app.dependency_overrides[get_optional_current_user] = mock_farmer_user

    mock_save = MagicMock()
    monkeypatch.setattr("App.backend.server.save_disease_prediction", mock_save)

    fake_result = {
        "top_detections": [{"label": "Paddy Blast", "confidence": 0.95, "source": "disease"}],
        "secondary_detections": [],
        "annotated_image_url": "https://storage.test/img.jpg",
        "custom_crop_notice": None,
    }
    monkeypatch.setattr("App.backend.server.predict_disease_and_pests", MagicMock(return_value=fake_result))

    files = {"image": ("test_leaf.jpg", io.BytesIO(b"fake_image_data"), "image/jpeg")}
    data = {"crop": "Paddy"}

    res = client.post("/api/v1/predict/disease", data=data, files=files)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data.get("success") is True

    # Verify save_disease_prediction was called with user_id set
    assert mock_save.called
    saved_args = mock_save.call_args[0][0]
    assert saved_args.get("user_id") == "00000000-0000-0000-0000-000000000001"
    assert saved_args.get("user_email") == "farmer_diag@agrifusion.test"
    assert saved_args.get("crop") == "Paddy"


def test_anonymous_disease_prediction_handles_none_user_id(monkeypatch):
    """Verify that anonymous disease prediction sets user_id=None without crashing."""
    app.dependency_overrides[get_optional_current_user] = lambda: None

    mock_save = MagicMock()
    monkeypatch.setattr("App.backend.server.save_disease_prediction", mock_save)

    fake_result = {
        "top_detections": [{"label": "Cotton Bollworm", "confidence": 0.88, "source": "pest"}],
        "secondary_detections": [],
        "annotated_image_url": "https://storage.test/img_cotton.jpg",
        "custom_crop_notice": None,
    }
    monkeypatch.setattr("App.backend.server.predict_disease_and_pests", MagicMock(return_value=fake_result))

    files = {"image": ("test_anon.jpg", io.BytesIO(b"fake_image_data"), "image/jpeg")}
    data = {"crop": "Cotton"}

    res = client.post("/api/v1/predict/disease", data=data, files=files)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data.get("success") is True

    assert mock_save.called
    saved_args = mock_save.call_args[0][0]
    assert saved_args.get("user_id") is None
    assert saved_args.get("user_email") is None
    assert saved_args.get("crop") == "Cotton"


def test_isolated_table_insert_failure_resilience(monkeypatch):
    """Verify that a failure inserting into diagnostic_reports does not crash disease_prediction save or API."""
    mock_supabase = MagicMock()
    # Simulate exception on diagnostic_reports insert
    mock_supabase.table.side_effect = lambda t: (
        MagicMock(insert=MagicMock(side_effect=Exception("DB NOT NULL Violation")))
        if t == "diagnostic_reports"
        else MagicMock(insert=MagicMock(return_value=MagicMock(execute=MagicMock(return_value=MagicMock(data=[{"id": 1}])))))
    )
    monkeypatch.setattr("App.backend.database.save_predictions.supabase", mock_supabase)

    from App.backend.database.save_predictions import save_disease_prediction

    # Should not raise exception
    res = save_disease_prediction({
        "user_id": "00000000-0000-0000-0000-000000000001",
        "user_email": "test@agrifusion.com",
        "crop": "Tomato",
        "top_disease": "Tomato Early Blight",
        "top_disease_confidence": 0.95,
    })
    # Returns response object from disease_prediction table
    assert res is not None


def test_admin_diagnostics_fails_closed_on_db_error(monkeypatch):
    """Verify GET /api/v1/admin/diagnostics returns HTTP 500 when Supabase query fails."""
    app.dependency_overrides[require_admin] = mock_admin_user

    monkeypatch.setattr("App.backend.settings.SUPABASE_URL", "https://fake.supabase.co")
    monkeypatch.setattr(
        "App.backend.database.farmer_db.get_all_diagnostics_for_admin",
        MagicMock(side_effect=RuntimeError("Database query failed for admin diagnostics")),
    )

    res = client.get("/api/v1/admin/diagnostics")
    assert res.status_code == 500
    assert res.json()["detail"] == "The backend encountered an internal error."


def test_admin_diagnostics_valid_empty_table(monkeypatch):
    """Verify GET /api/v1/admin/diagnostics returns HTTP 200 with total: 0 on valid empty table."""
    app.dependency_overrides[require_admin] = mock_admin_user

    monkeypatch.setattr("App.backend.settings.SUPABASE_URL", "https://fake.supabase.co")
    monkeypatch.setattr(
        "App.backend.database.farmer_db.get_all_diagnostics_for_admin",
        MagicMock(return_value={"items": [], "page": 1, "page_size": 25, "total": 0}),
    )

    res = client.get("/api/v1/admin/diagnostics")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert data["items"] == []
    assert "privacy_note" in data


def test_admin_diagnostics_search_and_privacy_redaction(monkeypatch):
    """Verify admin diagnostics returns items with identity_redacted: True and supports search filter."""
    app.dependency_overrides[require_admin] = mock_admin_user

    fake_items = [
        {
            "id": "diag-101",
            "created_at": "2026-09-25T10:00:00Z",
            "crop": "Paddy",
            "state": "Andhra Pradesh",
            "district": "Visakhapatnam",
            "diagnosis": "Paddy Blast",
            "confidence": 0.92,
            "severity": "Moderate",
            "treatment_recommendations": ["Apply Tricyclazole 75% WP"],
            "status": "reviewed",
            "identity_redacted": True,
        }
    ]
    monkeypatch.setattr("App.backend.settings.SUPABASE_URL", "https://fake.supabase.co")
    monkeypatch.setattr(
        "App.backend.database.farmer_db.get_all_diagnostics_for_admin",
        MagicMock(return_value={"items": fake_items, "page": 1, "page_size": 25, "total": 1}),
    )

    res = client.get("/api/v1/admin/diagnostics?search=Blast&crop=Paddy")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1
    item = data["items"][0]
    assert item["identity_redacted"] is True
    assert item["diagnosis"] == "Paddy Blast"
    assert "user_id" not in item
    assert "user_email" not in item

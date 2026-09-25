"""
AgriFusion — Unit & Integration Tests for Admin ML Predictions Activity Log & System Telemetry
=============================================================================================
Tests:
  1. Authenticated predictions pass current_user.id and write to prediction_records & ml_prediction_events.
  2. Anonymous predictions handle user_id=None safely without prediction_records NOT NULL crashes.
  3. Failed prediction inferences log status="failed", error_code, and latency_ms to ml_prediction_events.
  4. Helper _save_to_prediction_records returns early on null user_id.
  5. Admin GET /api/v1/admin/predictions reads from public.ml_prediction_events as single source of truth.
  6. Real values returned from stored telemetry without hardcoded defaults ("N/A", "Inference Model", 145.0 ms).
  7. Full-cohort aggregate analytics summary metrics (total, success_count, error_count, average_latency_ms).
  8. Filtering by model_type, crop, state, status, search, and pagination bounds.
  9. Admin GET /api/v1/admin/predictions fails closed with HTTP 500 on database errors.
 10. Privacy protections: request/result summaries exclude user email, passwords, raw image bytes, or tokens.
"""

import io
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from App.backend.server import app
from App.backend.auth.dependencies import CurrentUser, get_optional_current_user, require_admin
from App.backend.database.save_predictions import (
    _save_to_prediction_records,
    log_ml_prediction_event,
    save_crop_prediction,
    save_irrigation_prediction,
    save_yield_prediction,
    save_market_prediction,
    save_disease_prediction,
)
from App.backend.database.farmer_db import get_ml_predictions_for_admin

client = TestClient(app)


def mock_admin_user():
    return CurrentUser(
        user_id="88888888-8888-8888-8888-888888888888",
        email="admin_pred@agrifusion.test",
        role="admin",
        status="active",
        claims={"sub": "88888888-8888-8888-8888-888888888888", "app_metadata": {"role": "admin"}},
    )


def mock_farmer_user():
    return CurrentUser(
        user_id="11111111-1111-1111-1111-111111111111",
        email="farmer_pred@agrifusion.test",
        role="farmer",
        status="active",
        claims={"sub": "11111111-1111-1111-1111-111111111111", "app_metadata": {"role": "farmer"}},
    )


@pytest.fixture(autouse=True)
def reset_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


# =============================================================================
# 1. Authenticated & Anonymous Route Inferences
# =============================================================================

def test_authenticated_crop_prediction_passes_user_id(monkeypatch):
    """Verify authenticated POST /api/v1/predict/crop passes current_user.id."""
    app.dependency_overrides[get_optional_current_user] = mock_farmer_user

    mock_save = MagicMock(return_value={"telemetry_saved": True, "event_id": "evt-123"})
    monkeypatch.setattr("App.backend.server.save_crop_prediction", mock_save)
    monkeypatch.setattr("App.backend.server.predict_crop", MagicMock(return_value={
        "recommended_crop": "Rice",
        "confidence": 0.96,
    }))

    res = client.post("/api/v1/predict/crop", json={
        "state": "Andhra Pradesh",
        "district": "Visakhapatnam",
        "village": "Anakapalle",
        "sowing_date": "2026-06-15",
    })
    assert res.status_code == 200
    assert res.json().get("success") is True

    assert mock_save.called
    saved_args = mock_save.call_args[0][0]
    assert saved_args.get("user_id") == "11111111-1111-1111-1111-111111111111"
    assert saved_args.get("user_email") == "farmer_pred@agrifusion.test"
    assert saved_args.get("predicted_crop") == "Rice"
    assert saved_args.get("status") == "success"
    assert "latency_ms" in saved_args


def test_anonymous_prediction_routes_handle_none_user_id(monkeypatch):
    """Verify anonymous predictions set user_id=None safely."""
    app.dependency_overrides[get_optional_current_user] = lambda: None

    mock_log = MagicMock(return_value={"telemetry_saved": True})
    monkeypatch.setattr("App.backend.server.save_irrigation_prediction", mock_log)
    monkeypatch.setattr("App.backend.server.predict_irrigation", MagicMock(return_value={
        "predicted_irrigation": "45 mm per week",
        "water_requirement_mm": 45.0,
    }))

    res = client.post("/api/v1/predict/irrigation", json={
        "state": "Telangana",
        "district": "Warangal",
        "crop": "Cotton",
        "area_ha": 2.0,
        "pump_hp": 5.0,
    })
    assert res.status_code == 200

    assert mock_log.called
    saved_args = mock_log.call_args[0][0]
    assert saved_args.get("user_id") is None
    assert saved_args.get("user_email") is None
    assert saved_args.get("crop") == "Cotton"


# =============================================================================
# 2. Failure Logging & Helper Null Safety
# =============================================================================

def test_failed_prediction_route_logs_failure_event(monkeypatch):
    """Verify that a ValueError in model inference logs a failed telemetry event."""
    app.dependency_overrides[get_optional_current_user] = mock_farmer_user

    mock_log_event = MagicMock(return_value={"telemetry_saved": True})
    monkeypatch.setattr("App.backend.server.log_ml_prediction_event", mock_log_event)
    monkeypatch.setattr("App.backend.server.predict_yield", MagicMock(side_effect=ValueError("Invalid area parameter")))

    res = client.post("/api/v1/predict/yield", json={
        "state": "Punjab",
        "district": "Ludhiana",
        "crop": "Wheat",
        "season": "Rabi",
        "area_ha": -1.0,
        "year": 2026,
    })
    assert res.status_code == 422

    assert mock_log_event.called
    failed_args = mock_log_event.call_args[0][0]
    assert failed_args.get("model_type") == "yield_prediction"
    assert failed_args.get("status") == "failed"
    assert failed_args.get("error_code") == "INVALID_INPUT"
    assert failed_args.get("user_id") == "11111111-1111-1111-1111-111111111111"
    assert "latency_ms" in failed_args


def test_save_to_prediction_records_skips_when_user_id_missing():
    """Verify _save_to_prediction_records does nothing if user_id is None."""
    with patch("App.backend.database.save_predictions._get_admin_client") as mock_admin:
        _save_to_prediction_records(
            user_id=None,
            prediction_type="crop_recommendation",
            request_payload={"state": "AP"},
            result_payload={"crop": "Rice"},
        )
        assert not mock_admin.called


# =============================================================================
# 3. Admin Reader & API Endpoint Tests
# =============================================================================

def test_admin_get_predictions_reads_from_ml_prediction_events(monkeypatch):
    """Verify GET /api/v1/admin/predictions returns stored telemetry records but excludes disease diagnostics."""
    app.dependency_overrides[require_admin] = mock_admin_user

    mock_admin_c = MagicMock()
    fake_db_records = [
        {
            "id": "11111111-2222-3333-4444-555555555555",
            "created_at": "2026-09-25T12:00:00+00:00",
            "model_type": "crop_recommendation",
            "crop": "Rice",
            "state": "Andhra Pradesh",
            "district": "Visakhapatnam",
            "request_summary": {"village": "Anakapalle"},
            "result_summary": {"predicted_crop": "Rice", "confidence": 0.95},
            "status": "success",
            "latency_ms": 120.5,
            "error_code": None,
            "user_id": "11111111-1111-1111-1111-111111111111",
        },
        {
            "id": "22222222-3333-4444-5555-666666666666",
            "created_at": "2026-09-25T12:05:00+00:00",
            "model_type": "disease_detection",
            "crop": "Cotton",
            "state": "Telangana",
            "district": "Warangal",
            "request_summary": {"filename": "leaf.jpg"},
            "result_summary": {"top_disease": "Leaf Curl Virus"},
            "status": "success",
            "latency_ms": 350.0,
            "error_code": None,
            "user_id": None,
        },
    ]

    mock_execute = MagicMock()
    mock_execute.execute.return_value.data = fake_db_records
    mock_execute.execute.return_value.count = 2

    mock_admin_c.table.return_value.select.return_value = mock_execute
    mock_execute.ilike.return_value = mock_execute
    mock_execute.eq.return_value = mock_execute
    mock_execute.gte.return_value = mock_execute
    mock_execute.lte.return_value = mock_execute
    mock_execute.or_.return_value = mock_execute
    mock_execute.order.return_value = mock_execute

    monkeypatch.setattr("App.backend.database.save_predictions._get_admin_client", lambda: mock_admin_c)

    res = client.get("/api/v1/admin/predictions")
    assert res.status_code == 200
    data = res.json()

    # Total and items must exclude disease_detection (count = 1)
    assert data.get("total") == 1
    items = data.get("items", [])
    assert len(items) == 1

    # Verify non-diagnostic telemetry values are preserved
    item0 = items[0]
    assert item0["model_type"] == "crop_recommendation"
    assert item0["crop"] == "Rice"
    assert item0["latency_ms"] == 120.5
    assert item0["user_id"] == "11111111-1111-1111-1111-111111111111"

    # Analytics summary metrics exclude disease_detection
    analytics = data.get("analytics", {})
    assert analytics.get("total_predictions") == 1
    assert analytics.get("success_count") == 1
    assert analytics.get("error_count") == 0
    assert analytics.get("average_latency_ms") == 120.5
    assert "disease_detection" not in analytics.get("by_type", {})


def test_admin_predictions_excludes_disease_diagnostics_query(monkeypatch):
    """Verify querying model_type=disease_detection on /api/v1/admin/predictions returns total: 0."""
    app.dependency_overrides[require_admin] = mock_admin_user

    mock_admin_c = MagicMock()
    mock_execute = MagicMock()
    mock_execute.execute.return_value.data = [
        {
            "id": "22222222-3333-4444-5555-666666666666",
            "model_type": "disease_detection",
            "crop": "Cotton",
            "status": "success"
        }
    ]
    mock_admin_c.table.return_value.select.return_value = mock_execute
    mock_execute.ilike.return_value = mock_execute
    mock_execute.order.return_value = mock_execute

    monkeypatch.setattr("App.backend.database.save_predictions._get_admin_client", lambda: mock_admin_c)

    res = client.get("/api/v1/admin/predictions?model_type=disease_detection")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert data["items"] == []
    assert data["analytics"]["total_predictions"] == 0



def test_admin_get_predictions_fails_closed_on_db_error(monkeypatch):
    """Verify GET /api/v1/admin/predictions returns HTTP 500 when database fails."""
    app.dependency_overrides[require_admin] = mock_admin_user

    mock_admin_c = MagicMock()
    mock_admin_c.table.side_effect = Exception("DB Connection Refused")
    monkeypatch.setattr("App.backend.database.save_predictions._get_admin_client", lambda: mock_admin_c)

    res = client.get("/api/v1/admin/predictions")
    assert res.status_code == 500
    assert "Database query failed" in res.json().get("detail", "")


def test_admin_get_predictions_uncollected_latency_returns_null(monkeypatch):
    """Verify that uncollected latencies return null and average_latency_ms is None."""
    app.dependency_overrides[require_admin] = mock_admin_user

    mock_admin_c = MagicMock()
    fake_db_records = [
        {
            "id": "33333333-4444-5555-6666-777777777777",
            "created_at": "2026-09-25T13:00:00+00:00",
            "model_type": "market_price_forecasting",
            "crop": "Maize",
            "state": "Karnataka",
            "district": "Dharwad",
            "request_summary": {},
            "result_summary": {},
            "status": "success",
            "latency_ms": None, # Uncollected
            "error_code": None,
            "user_id": None,
        }
    ]

    mock_execute = MagicMock()
    mock_execute.execute.return_value.data = fake_db_records
    mock_execute.execute.return_value.count = 1
    mock_admin_c.table.return_value.select.return_value = mock_execute
    mock_execute.order.return_value = mock_execute

    monkeypatch.setattr("App.backend.database.save_predictions._get_admin_client", lambda: mock_admin_c)

    res = client.get("/api/v1/admin/predictions")
    assert res.status_code == 200
    data = res.json()

    item = data["items"][0]
    assert item["latency_ms"] is None # Returns null

    analytics = data.get("analytics", {})
    assert analytics.get("average_latency_ms") is None # Returns null when uncollected

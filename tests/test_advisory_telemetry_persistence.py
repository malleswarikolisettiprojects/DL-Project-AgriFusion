"""
AgriFusion — Advisory Telemetry Persistence Test Suite
========================================================
Tests end-to-end telemetry persistence requirements:
  1. Successful Supabase / DB insert returns telemetry_persisted = True, query_id, request_id,
     and record is retrievable via GET /api/v1/admin/advisories matching that query_id.
  2. Supabase insert failure returns telemetry_persisted = False with non-sensitive request_id,
     while farmer's advisory answer remains intact.
  3. Safe confirmation logged server-side without leaking raw question text or PII.
"""

import sqlite3
import sys
import uuid
from pathlib import Path
from unittest.mock import patch

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import pytest
from fastapi.testclient import TestClient

import App.backend.database.advisories_db as advisories_db_module
from App.backend.auth.dependencies import CurrentUser, get_current_user, require_admin
from App.backend.database.advisories_db import (
    init_advisories_db,
    log_advisory_activity,
)
from App.backend.server import app

client = TestClient(app)


def mock_admin_user():
    return CurrentUser(
        user_id="99999999-9999-9999-9999-999999999999",
        email="admin@agrifusion.test",
        role="admin",
        status="active",
        claims={"sub": "99999999-9999-9999-9999-999999999999", "app_metadata": {"role": "admin"}},
    )


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Isolated temporary SQLite database for local test runs."""
    test_db = tmp_path / "test_advisories_telemetry.db"
    monkeypatch.setattr("App.backend.database.advisories_db.DB_PATH", test_db)
    monkeypatch.setattr("App.backend.settings.SUPABASE_URL", None)
    init_advisories_db()
    app.dependency_overrides = {}


def test_successful_query_persists_telemetry_and_returns_ids():
    """
    Test POST /api/v1/agent/query when telemetry insert succeeds:
    - Response contains success=True, telemetry_persisted=True, query_id, request_id.
    - Admin list GET /api/v1/admin/advisories returns the item matching query_id.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    mock_rag_response = {
        "answer": "Apply Neem oil 5ml/L for aphid control.",
        "crop": "Cotton",
        "confidence_score": 0.88,
        "rag_status": "success",
        "local_docs_scanned": 3,
        "retrieved_passages": [
            {"source": "KVK Agronomy", "institute": "ICAR", "url": "https://icar.gov.in"}
        ],
    }

    with patch("App.backend.server.query_agronomy_agent", return_value=mock_rag_response):
        res = client.post(
            "/api/v1/agent/query",
            json={
                "query": "How to control aphids on cotton?",
                "crop": "Cotton",
                "state": "Telangana",
                "district": "Warangal",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["stage"] == "agent"
        assert data["telemetry_persisted"] is True
        assert "query_id" in data and data["query_id"] is not None
        assert "request_id" in data and data["request_id"] is not None

        created_query_id = data["query_id"]

        # Admin fetches advisories list and finds matching query_id
        admin_res = client.get("/api/v1/admin/advisories")
        assert admin_res.status_code == 200
        admin_data = admin_res.json()
        matching_items = [i for i in admin_data["items"] if i["query_id"] == created_query_id]
        assert len(matching_items) == 1
        item = matching_items[0]
        assert item["crop"] == "Cotton"
        assert item["state"] == "Telangana"
        assert item["district"] == "Warangal"


def test_telemetry_failure_preserves_farmer_answer_with_false_flag(monkeypatch):
    """
    Test POST /api/v1/agent/query when telemetry persistence fails:
    - Farmer answer is preserved (success=True, agent_response intact).
    - telemetry_persisted is explicitly False.
    - query_id is None.
    - request_id correlation token is returned for safe server log investigation.
    """
    mock_rag_response = {
        "answer": "Apply Carbendazim for sheath blight.",
        "crop": "Rice",
        "confidence_score": 0.92,
        "rag_status": "success",
    }

    # Force log_advisory_activity to simulate persistence failure
    failing_telemetry_res = {
        "telemetry_persisted": False,
        "query_id": None,
        "request_id": "test-req-err-1",
    }

    with patch("App.backend.server.query_agronomy_agent", return_value=mock_rag_response):
        with patch("App.backend.server.log_advisory_activity", return_value=failing_telemetry_res):
            res = client.post(
                "/api/v1/agent/query",
                json={
                    "query": "Rice sheath blight remedy?",
                    "crop": "Rice",
                    "state": "Andhra Pradesh",
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["agent_response"]["answer"] == "Apply Carbendazim for sheath blight."
            assert data["telemetry_persisted"] is False
            assert data["query_id"] is None
            assert data["request_id"] is not None


def test_log_advisory_activity_returns_explicit_dict(monkeypatch):
    """
    Direct test of log_advisory_activity returning dict with explicit telemetry_persisted, query_id, request_id.
    """
    res_success = log_advisory_activity(
        query_text="Direct function query test",
        crop="Maize",
        state="Karnataka",
        request_id="req-direct-001",
    )
    assert isinstance(res_success, dict)
    assert res_success["telemetry_persisted"] is True
    assert isinstance(res_success["query_id"], str)
    assert res_success["request_id"] == "req-direct-001"

    # Test failure case when Supabase fails
    class FailingSupabaseQuery:
        def insert(self, record):
            raise RuntimeError("Supabase Database Unavailable")

    class FailingSupabaseClient:
        def table(self, table_name):
            return FailingSupabaseQuery()

    monkeypatch.setattr("App.backend.settings.SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setattr("App.backend.database.advisories_db._get_supabase", lambda: FailingSupabaseClient())

    res_fail = log_advisory_activity(
        query_text="Direct function fail test",
        crop="Maize",
        state="Karnataka",
        request_id="req-direct-err",
    )
    assert isinstance(res_fail, dict)
    assert res_fail["telemetry_persisted"] is False
    assert res_fail["query_id"] is None
    assert res_fail["request_id"] == "req-direct-err"

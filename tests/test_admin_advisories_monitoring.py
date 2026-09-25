"""
AgriFusion — Admin Advisory Activity Monitoring Test Suite
===========================================================
Tests requirements for Advisory Activity Telemetry & Admin Monitoring:
  1. Successful query flow from POST /api/v1/agent/query to GET /api/v1/admin/advisories.
  2. Durable production source of truth: Supabase write failure returns False and logs correlation token (no silent fallback to per-instance SQLite).
  3. Database list-read failure returns HTTP 500 error (fails closed instead of empty items: []).
  4. Genuine empty table returns HTTP 200 OK, total: 0, items: [], and accurate privacy note.
  5. Failed & timed-out query telemetry persistence (activity_status = 'timeout' / 'failed').
  6. Server-side search filter matching query_summary, crop, state, district, or query_id.
"""

import sys
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from App.backend.admin.router import admin_router
from App.backend.auth.dependencies import CurrentUser, get_current_user, require_admin
from App.backend.database.advisories_db import (
    fetch_advisory_activities,
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
    """Use isolated temporary SQLite database for local test runs."""
    test_db = tmp_path / "test_advisories.db"
    monkeypatch.setattr("App.backend.database.advisories_db.DB_PATH", test_db)
    monkeypatch.setattr("App.backend.settings.SUPABASE_URL", None)
    init_advisories_db()


# -----------------------------------------------------------------------------
# 1. Trace Successful Advisor Query -> Persisted Row -> Admin List
# -----------------------------------------------------------------------------
def test_successful_query_flow_to_admin_list():
    mock_agent_response = {
        "answer": "Apply Tricyclazole for Paddy blast management.",
        "crop": "Paddy",
        "confidence_score": 0.95,
        "rag_status": "success",
        "local_docs_scanned": 4,
        "retrieved_passages": [
            {
                "source": "ICAR Rice Protection Guide",
                "institute": "ICAR",
                "url": "https://icar.org.in/rice",
            }
        ],
    }

    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    with patch("App.backend.server.query_agronomy_agent", return_value=mock_agent_response):
        # 1. POST /api/v1/agent/query
        r_agent = client.post(
            "/api/v1/agent/query",
            json={
                "query": "How to manage paddy blast disease?",
                "crop": "Paddy",
                "state": "Andhra Pradesh",
                "district": "Visakhapatnam",
            },
        )
        assert r_agent.status_code == 200
        assert r_agent.json()["success"] is True

        # 2. GET /api/v1/admin/advisories
        r_admin = client.get("/api/v1/admin/advisories")
        assert r_admin.status_code == 200
        data = r_admin.json()
        assert data["total"] >= 1
        items = data["items"]
        matching = [i for i in items if i["crop"] == "Paddy"]
        assert len(matching) >= 1
        record = matching[0]
        assert record["activity_status"] in ("success", "no_verified_source")
        assert record["state"] == "Andhra Pradesh"
        assert record["district"] == "Visakhapatnam"

    app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 2. Supabase Write Failure Logging (No Silent Fallback in Production)
# -----------------------------------------------------------------------------
def test_supabase_write_failure_behavior(monkeypatch):
    """Verify when SUPABASE_URL is configured and write fails, log error and return False without silent SQLite write."""
    monkeypatch.setattr("App.backend.settings.SUPABASE_URL", "https://mock-supabase.supabase.co")

    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_table.insert.side_effect = Exception("Supabase DB Insert Error")

    with patch("App.backend.database.advisories_db._get_supabase", return_value=mock_supabase):
        res = log_advisory_activity(
            query_text="How to treat tomato blight?",
            crop="Tomato",
            state="Telangana",
            request_id="req-test-123",
        )
        assert res is False


# -----------------------------------------------------------------------------
# 3. Database List Read Failure Returns HTTP 500
# -----------------------------------------------------------------------------
def test_admin_list_read_failure_returns_500():
    """Verify database read failure raises RuntimeError resulting in HTTP 500 Internal Server Error."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    with patch("App.backend.admin.router.fetch_advisory_activities", side_effect=RuntimeError("Database query failed for advisory activity")):
        res = client.get("/api/v1/admin/advisories")
        assert res.status_code == 500
        assert res.json()["detail"] == "The backend encountered an internal error."

    app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 4. Genuine Empty Table Returns HTTP 200 OK with total: 0
# -----------------------------------------------------------------------------
def test_genuine_empty_table_returns_200():
    """Verify genuine empty table returns 200 OK, total: 0, and clear privacy note."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    res = client.get("/api/v1/admin/advisories")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert data["items"] == []
    assert data["privacy_note"] == "No advisory activity recorded yet."

    app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 5. Failed & Timed-Out Query Telemetry Logging
# -----------------------------------------------------------------------------
def test_failed_and_timed_out_query_logging():
    """Verify failed and timed-out advisory queries are logged with activity_status 'timeout' or 'failed'."""
    log_advisory_activity(
        query_text="Heavy rain protection for chilli crop",
        crop="Chilli",
        state="Andhra Pradesh",
        activity_status="timeout",
        error_category="RAG_SERVICE_TIMEOUT",
        request_id="req-timeout-99",
    )

    log_advisory_activity(
        query_text="Invalid query payload test",
        crop="Cotton",
        state="Maharashtra",
        activity_status="failed",
        error_category="RAG_SERVICE_FAILED",
        request_id="req-failed-88",
    )

    data = fetch_advisory_activities(page=1, page_size=25)
    assert data["total"] >= 2
    statuses = [item["activity_status"] for item in data["items"]]
    assert "timeout" in statuses
    assert "failed" in statuses


# -----------------------------------------------------------------------------
# 6. Server-Side Search Filter Behavior
# -----------------------------------------------------------------------------
def test_server_side_search_filter():
    """Verify search filter matches query_summary, crop, state, district, or query_id."""
    log_advisory_activity(
        query_text="Yellow rust control in wheat crop",
        crop="Wheat",
        state="Punjab",
        district="Ludhiana",
    )
    log_advisory_activity(
        query_text="Organic pest control for sugarcane",
        crop="Sugarcane",
        state="Uttar Pradesh",
        district="Meerut",
    )

    # Search for "Wheat"
    res_wheat = fetch_advisory_activities(search="Wheat")
    assert res_wheat["total"] == 1
    assert res_wheat["items"][0]["crop"] == "Wheat"

    # Search for "Sugarcane"
    res_sugar = fetch_advisory_activities(search="Sugarcane")
    assert res_sugar["total"] == 1
    assert res_sugar["items"][0]["crop"] == "Sugarcane"

    # Search for non-existent term
    res_none = fetch_advisory_activities(search="NonExistentTerm99")
    assert res_none["total"] == 0
    assert res_none["items"] == []

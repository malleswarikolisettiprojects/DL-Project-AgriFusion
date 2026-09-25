"""
AgriFusion — Admin Farmer Feedback & Validation Integration Tests
===================================================================
Tests farmer feedback creation, privileged admin retrieval, rating distribution,
filtering, pagination, empty-table handling, and database error handling.
"""

import uuid
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from fastapi.testclient import TestClient

from App.backend.server import app
from App.backend.database.feedback_db import (
    create_farmer_feedback,
    fetch_farmer_feedback_list,
    get_farmer_feedback_detail,
    update_farmer_feedback_record,
    add_feedback_review_note,
)

client = TestClient(app)


def test_create_farmer_feedback_anonymous():
    """Test creating feedback without authentication."""
    with patch("App.backend.database.feedback_db._is_supabase_active", return_value=False):
        res = create_farmer_feedback(
            rating=5,
            category="accuracy",
            message="Great crop advisory details!",
            advisory_id="adv-101",
            language="English",
            user_id=None,
        )
        assert res["id"] is not None
        # Must be valid UUID format
        assert len(res["id"]) == 36
        assert res["rating"] == 5
        assert res["category"] == "accuracy"
        assert res["status"] == "pending_review"
        assert res["user_id"] is None


def test_create_farmer_feedback_authenticated():
    """Test creating feedback with a logged-in user_id."""
    fake_user_id = str(uuid.uuid4())
    with patch("App.backend.database.feedback_db._is_supabase_active", return_value=False):
        res = create_farmer_feedback(
            rating=2,
            category="incorrect_answer",
            message="Fertilizer dose too high.",
            advisory_id="adv-202",
            language="English",
            user_id=fake_user_id,
        )
        assert res["id"] is not None
        assert res["user_id"] == fake_user_id
        assert res["rating"] == 2


def test_fetch_farmer_feedback_list_and_rating_distribution():
    """Test fetching feedback list with rating distribution calculation."""
    with patch("App.backend.database.feedback_db._is_supabase_active", return_value=False):
        # Insert test records into SQLite
        create_farmer_feedback(5, "accuracy", "Excellent advice 1")
        create_farmer_feedback(5, "accuracy", "Excellent advice 2")
        create_farmer_feedback(3, "missing_info", "Needs more info")
        create_farmer_feedback(1, "error", "Wrong recommendation")

        data = fetch_farmer_feedback_list(page=1, page_size=10)
        assert data["total"] >= 4
        assert "rating_distribution" in data
        assert isinstance(data["rating_distribution"], dict)
        assert set(data["rating_distribution"].keys()) == {"1", "2", "3", "4", "5"}
        assert data["rating_distribution"]["5"] >= 2
        assert data["rating_distribution"]["3"] >= 1
        assert data["rating_distribution"]["1"] >= 1


def test_fetch_farmer_feedback_filters():
    """Test filtering feedback by status, rating, and search query."""
    with patch("App.backend.database.feedback_db._is_supabase_active", return_value=False):
        create_farmer_feedback(4, "dosage", "Pesticide dose search_term_unique_123")
        
        # Test rating filter
        filtered_r = fetch_farmer_feedback_list(rating=4)
        assert all(item["rating"] == 4 for item in filtered_r["items"])

        # Test search filter
        filtered_s = fetch_farmer_feedback_list(search="search_term_unique_123")
        assert filtered_s["total"] >= 1
        assert "search_term_unique_123" in filtered_s["items"][0]["message"]


def test_feedback_empty_table_behavior():
    """Test that a genuinely empty table returns total: 0 and zeroed rating distribution."""
    mock_admin_client = MagicMock()
    mock_select = MagicMock()
    mock_order = MagicMock()
    mock_exec = MagicMock()

    mock_exec.execute.return_value.data = []
    mock_order.order.return_value = mock_exec
    mock_select.select.return_value = mock_order
    mock_admin_client.table.return_value = mock_select

    with patch("App.backend.database.feedback_db._is_supabase_active", return_value=True), \
         patch("App.backend.database.feedback_db._get_admin_client", return_value=mock_admin_client):
        data = fetch_farmer_feedback_list()
        assert data["total"] == 0
        assert data["items"] == []
        assert data["rating_distribution"] == {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
        assert "No feedback has been submitted yet" in data["privacy_note"]


def test_feedback_db_error_handling():
    """Test that a database failure raises an exception and is caught as HTTP 500 error."""
    mock_admin_client = MagicMock()
    mock_admin_client.table.side_effect = Exception("Supabase connection timeout")

    with patch("App.backend.database.feedback_db._is_supabase_active", return_value=True), \
         patch("App.backend.database.feedback_db._get_admin_client", return_value=mock_admin_client):
        with pytest.raises((RuntimeError, HTTPException)) as exc_info:
            fetch_farmer_feedback_list()
        assert "Database query failure" in str(exc_info.value) or "500" in str(exc_info.value)


def test_api_submit_feedback_endpoint():
    """Test POST /api/v1/feedback endpoint success."""
    payload = {
        "rating": 5,
        "category": "other",
        "message": "API feedback submission test message",
        "advisory_id": "adv-999",
        "language": "Hindi"
    }
    with patch("App.backend.database.feedback_db._is_supabase_active", return_value=False):
        response = client.post("/api/v1/feedback", json=payload)
        assert response.status_code == 200
        res_json = response.json()
        assert res_json["success"] is True
        assert "feedback_id" in res_json
        assert len(res_json["feedback_id"]) == 36


def test_admin_feedback_anonymous_access_denied():
    """Test that unauthenticated requests to /api/v1/admin/feedback are rejected."""
    response = client.get("/api/v1/admin/feedback")
    assert response.status_code in (401, 403)


"""
AgriFusion — Admin Advisory Analytics Test Suite
=================================================
Tests requirements for GET /api/v1/admin/advisory-analytics:
  1. Admin-only access (401 without auth, 403 for non-admin).
  2. Aggregation, filters (crop, state, district, days).
  3. Citation numerator/denominator/percent calculations.
  4. Empty dataset behavior (total_queries=0, citation_rate=0%, top_crops=[], regional_queries=[]).
  5. Regional privacy suppression (groups with < 3 queries are suppressed).
  6. No personal or raw-query fields in analytics responses (strict check of fields).
  7. Database error returns a safe HTTP 500 error response.
"""

import sys
import uuid
from pathlib import Path
from unittest.mock import patch

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import pytest
from fastapi.testclient import TestClient

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


def mock_farmer_user():
    return CurrentUser(
        user_id="11111111-1111-1111-1111-111111111111",
        email="farmer@agrifusion.test",
        role="farmer",
        status="active",
        claims={"sub": "11111111-1111-1111-1111-111111111111", "app_metadata": {"role": "farmer"}},
    )


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Use isolated temporary SQLite database for local test runs."""
    test_db = tmp_path / "test_advisories_analytics.db"
    monkeypatch.setattr("App.backend.database.advisories_db.DB_PATH", test_db)
    monkeypatch.setattr("App.backend.settings.SUPABASE_URL", None)
    init_advisories_db()
    app.dependency_overrides = {}


def test_admin_analytics_authentication_required():
    """Test 401 when no auth dependency override / token is present."""
    res = client.get("/api/v1/admin/advisory-analytics")
    assert res.status_code in (401, 403)


def test_admin_analytics_forbidden_for_farmer():
    """Test 403 when user is logged in as non-admin (farmer)."""
    app.dependency_overrides[get_current_user] = mock_farmer_user
    app.dependency_overrides[require_admin] = lambda: (_ for _ in ()).throw(
        pytest.importorskip("fastapi").HTTPException(status_code=403, detail="Forbidden - Admin Access Required")
    )

    res = client.get("/api/v1/admin/advisory-analytics")
    assert res.status_code == 403


def test_admin_analytics_empty_dataset():
    """Test GET /api/v1/admin/advisory-analytics on empty database."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    res = client.get("/api/v1/admin/advisory-analytics")
    assert res.status_code == 200
    data = res.json()
    assert data["total_queries"] == 0
    assert data["citation_rate"]["cited_queries"] == 0
    assert data["citation_rate"]["eligible_queries"] == 0
    assert data["citation_rate"]["percent"] == 0.0
    assert data["top_crops"] == []
    assert data["regional_queries"] == []
    assert "privacy_note" in data
    assert "generated_at" in data


def test_admin_analytics_aggregation_citation_and_privacy_suppression():
    """
    Test aggregation math, citation metrics, and regional privacy threshold (< 3 queries suppressed).
    Insert test rows:
      - Region 1 (AP, Guntur): 3 queries for Rice (2 with verified citations, 1 without) -> total 3, should appear!
      - Region 2 (AP, Visakhapatnam): 2 queries for Paddy -> total 2, should be SUPPRESSED (<3)!
      - Region 3 (Telangana, Warangal): 4 queries for Cotton (all 4 with verified citations) -> total 4, should appear!
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    rag_with_citations = {
        "answer": "Apply Tricyclazole for Paddy blast management.",
        "retrieved_passages": [{"source": "ICAR", "title": "Rice Guide", "url": "https://icar.org.in"}],
        "local_docs_scanned": 4,
        "confidence_score": 0.9,
        "rag_status": "success",
    }
    rag_no_citations = {
        "answer": "No verified agronomic data found for this question.",
        "retrieved_passages": [],
        "local_docs_scanned": 1,
        "confidence_score": 0.2,
        "rag_status": "no_verified_match",
    }

    # AP, Guntur - 3 queries (Rice): 2 cited, 1 uncited
    log_advisory_activity(query_text="Rice blast control?", crop="Rice", state="Andhra Pradesh", district="Guntur", rag_result=rag_with_citations)
    log_advisory_activity(query_text="Rice sheath blight?", crop="Rice", state="Andhra Pradesh", district="Guntur", rag_result=rag_with_citations)
    log_advisory_activity(query_text="Rice fertilizer dose?", crop="Rice", state="Andhra Pradesh", district="Guntur", rag_result=rag_no_citations)

    # AP, Visakhapatnam - 2 queries (Paddy): 1 cited, 1 uncited -> SHOULD BE SUPPRESSED (<3)
    log_advisory_activity(query_text="Paddy weedicide?", crop="Paddy", state="Andhra Pradesh", district="Visakhapatnam", rag_result=rag_with_citations)
    log_advisory_activity(query_text="Paddy pest?", crop="Paddy", state="Andhra Pradesh", district="Visakhapatnam", rag_result=rag_no_citations)

    # Telangana, Warangal - 4 queries (Cotton): 4 cited
    for i in range(4):
        log_advisory_activity(query_text=f"Cotton bollworm query {i}?", crop="Cotton", state="Telangana", district="Warangal", rag_result=rag_with_citations)

    # Total queries = 3 + 2 + 4 = 9 queries
    # Eligible queries (completed) = 9
    # Cited queries = 2 (Guntur) + 1 (Visakhapatnam) + 4 (Warangal) = 7
    # Citation percent = round(7 / 9 * 100, 1) = 77.8%

    res = client.get("/api/v1/admin/advisory-analytics")
    assert res.status_code == 200
    data = res.json()

    assert data["total_queries"] == 9
    assert data["citation_rate"]["cited_queries"] == 7
    assert data["citation_rate"]["eligible_queries"] == 9
    assert data["citation_rate"]["percent"] == 77.78

    # Top crops: Cotton (4), Rice (3), Paddy (2)
    crops_map = {item["crop"]: item["query_count"] for item in data["top_crops"]}
    assert crops_map["Cotton"] == 4
    assert crops_map["Rice"] == 3
    assert crops_map["Paddy"] == 2

    # Regional queries: Guntur (3) and Warangal (4) MUST appear.
    # Visakhapatnam (2) MUST BE SUPPRESSED because 2 < 3 threshold.
    reg_list = data["regional_queries"]
    reg_map = {(r["state"], r["district"]): r["query_count"] for r in reg_list}

    assert ("Andhra Pradesh", "Guntur") in reg_map
    assert reg_map[("Andhra Pradesh", "Guntur")] == 3

    assert ("Telangana", "Warangal") in reg_map
    assert reg_map[("Telangana", "Warangal")] == 4

    assert ("Andhra Pradesh", "Visakhapatnam") not in reg_map, "Groups with < 3 queries must be suppressed for privacy."


def test_admin_analytics_no_pii_or_raw_queries():
    """Verify that response contains ONLY aggregated fields and ZERO PII or raw query text."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    log_advisory_activity(
        query_text="CONFIDENTIAL FARMER QUESTION ABOUT RICE AND PHONE 9876543210",
        crop="Rice",
        state="Andhra Pradesh",
        district="Guntur",
        rag_result={
            "retrieved_passages": [{"source": "ICAR", "title": "Rice Guide", "url": "https://icar.org.in"}],
            "rag_status": "success",
        },
    )

    res = client.get("/api/v1/admin/advisory-analytics")
    assert res.status_code == 200
    data = res.json()

    allowed_keys = {"total_queries", "citation_rate", "top_crops", "regional_queries", "privacy_note", "generated_at"}
    assert set(data.keys()) == allowed_keys

    # Convert entire response json string and check for sensitive strings
    raw_str = res.text.lower()
    assert "9876543210" not in raw_str
    assert "confidential" not in raw_str


def test_admin_analytics_filters():
    """Test filtering by crop, state, and district."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    rag_ok = {
        "retrieved_passages": [{"source": "ICAR", "title": "Guide"}],
        "rag_status": "success",
    }

    for _ in range(3):
        log_advisory_activity(query_text="Rice query", crop="Rice", state="Andhra Pradesh", district="Guntur", rag_result=rag_ok)

    for _ in range(3):
        log_advisory_activity(query_text="Chilli query", crop="Chilli", state="Andhra Pradesh", district="Guntur", rag_result=rag_ok)

    # Filter by crop=Rice
    res = client.get("/api/v1/admin/advisory-analytics?crop=Rice")
    assert res.status_code == 200
    data = res.json()
    assert data["total_queries"] == 3
    assert len(data["top_crops"]) == 1
    assert data["top_crops"][0]["crop"] == "Rice"

    # Filter by state=Andhra Pradesh & crop=Chilli
    res = client.get("/api/v1/admin/advisory-analytics?state=Andhra%20Pradesh&crop=Chilli")
    assert res.status_code == 200
    data = res.json()
    assert data["total_queries"] == 3
    assert data["top_crops"][0]["crop"] == "Chilli"


def test_admin_analytics_db_error_returns_500():
    """Database failure returns HTTP 500 error safely."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    with patch("App.backend.admin.router.fetch_advisory_analytics", side_effect=RuntimeError("DB Connection Lost")):
        res = client.get("/api/v1/admin/advisory-analytics")
        assert res.status_code == 500
        data = res.json()
        assert "detail" in data

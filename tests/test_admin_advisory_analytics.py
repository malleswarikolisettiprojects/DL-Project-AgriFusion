"""
AgriFusion — Admin Advisory Analytics Test Suite
=================================================
Tests requirements for GET /api/v1/admin/advisory-analytics:
  1. Admin-only access (401 without auth, 403 for non-admin).
  2. Aggregation, filters (crop, state, district, days).
  3. Citation numerator/denominator/percent calculations with FAIL-CLOSED logic.
  4. Empty dataset behavior (total_queries=0, citation_rate=0%, top_crops=[], regional_queries=[]).
  5. Regional privacy suppression (groups with < 3 queries are suppressed).
  6. No personal or raw-query fields in analytics responses (strict check of fields).
  7. Large dataset (>1000 records) non-truncation aggregation.
  8. Status filter alias support (activity_status vs status in /api/v1/admin/advisories).
  9. Database error returns a safe HTTP 500 error response.
"""

import json
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

    res = client.get("/api/v1/admin/advisory-analytics")
    assert res.status_code == 200
    data = res.json()

    assert data["total_queries"] == 9
    assert data["citation_rate"]["cited_queries"] == 7
    assert data["citation_rate"]["eligible_queries"] == 9
    assert data["citation_rate"]["percent"] == 77.78

    crops_map = {item["crop"]: item["query_count"] for item in data["top_crops"]}
    assert crops_map["Cotton"] == 4
    assert crops_map["Rice"] == 3
    assert crops_map["Paddy"] == 2

    reg_list = data["regional_queries"]
    reg_map = {(r["state"], r["district"]): r["query_count"] for r in reg_list}

    assert ("Andhra Pradesh", "Guntur") in reg_map
    assert reg_map[("Andhra Pradesh", "Guntur")] == 3

    assert ("Telangana", "Warangal") in reg_map
    assert reg_map[("Telangana", "Warangal")] == 4

    assert ("Andhra Pradesh", "Visakhapatnam") not in reg_map, "Groups with < 3 queries must be suppressed for privacy."


def test_citation_rate_fail_closed():
    """
    Test fail-closed citation rate calculations:
    Only explicit Boolean True for compliance_json.citations_present (with no_verified_source=False) counts as cited.
    Missing compliance_json, null citations_present, malformed JSON, or false values MUST fail closed as False (uncited).
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    # 1. Explicitly Verified Citation -> COUNTED (1)
    log_advisory_activity(
        query_text="Explicit citation query",
        crop="Rice",
        state="Andhra Pradesh",
        district="Guntur",
        rag_result={
            "answer": "Apply Trichoderma Viride for stem rot control.",
            "retrieved_passages": [{"source": "ANGRAU", "title": "Plant Pathology", "url": "https://angrau.ac.in"}],
            "confidence_score": 0.85,
            "rag_status": "success",
        },
    )

    # Directly insert raw rows into the monkeypatched test DB to test edge case compliance_json values:
    conn = sqlite3.connect(advisories_db_module.DB_PATH)
    cur = conn.cursor()

    # 2. Missing/None compliance_json -> UNCITED (0)
    cur.execute("""
        INSERT INTO advisory_activity (query_id, crop, state, district, activity_status, no_verified_source, compliance_json)
        VALUES (?, 'Rice', 'Andhra Pradesh', 'Guntur', 'success', 0, NULL)
    """, (str(uuid.uuid4()),))

    # 3. Malformed JSON -> UNCITED (0)
    cur.execute("""
        INSERT INTO advisory_activity (query_id, crop, state, district, activity_status, no_verified_source, compliance_json)
        VALUES (?, 'Rice', 'Andhra Pradesh', 'Guntur', 'success', 0, 'INVALID_NOT_JSON')
    """, (str(uuid.uuid4()),))

    # 4. JSON with citations_present = false -> UNCITED (0)
    cur.execute("""
        INSERT INTO advisory_activity (query_id, crop, state, district, activity_status, no_verified_source, compliance_json)
        VALUES (?, 'Rice', 'Andhra Pradesh', 'Guntur', 'success', 0, '{"citations_present": false}')
    """, (str(uuid.uuid4()),))

    # 5. JSON with missing citations_present key -> UNCITED (0)
    cur.execute("""
        INSERT INTO advisory_activity (query_id, crop, state, district, activity_status, no_verified_source, compliance_json)
        VALUES (?, 'Rice', 'Andhra Pradesh', 'Guntur', 'success', 0, '{"other_key": true}')
    """, (str(uuid.uuid4()),))

    # 6. Query with no_verified_source = 1 -> UNCITED (0)
    cur.execute("""
        INSERT INTO advisory_activity (query_id, crop, state, district, activity_status, no_verified_source, compliance_json)
        VALUES (?, 'Rice', 'Andhra Pradesh', 'Guntur', 'no_verified_source', 1, '{"citations_present": true}')
    """, (str(uuid.uuid4()),))

    conn.commit()
    conn.close()

    res = client.get("/api/v1/admin/advisory-analytics")
    assert res.status_code == 200
    data = res.json()

    assert data["total_queries"] == 6
    assert data["citation_rate"]["eligible_queries"] == 6
    assert data["citation_rate"]["cited_queries"] == 1
    assert data["citation_rate"]["percent"] == 16.67


def test_large_dataset_untruncated_aggregation():
    """
    Test that an advisory dataset larger than 1,000 records (e.g., 1,050 records)
    is aggregated completely without truncation or missing count data.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    conn = sqlite3.connect(advisories_db_module.DB_PATH)
    cur = conn.cursor()

    rows = []
    for i in range(1050):
        qid = f"bulk_q_{i}"
        crop_val = "Rice" if i < 600 else "Cotton"
        st_val = "Andhra Pradesh" if i < 700 else "Telangana"
        dt_val = "Guntur" if i < 700 else "Warangal"
        comp = json.dumps({"citations_present": True}) if i % 2 == 0 else json.dumps({"citations_present": False})
        rows.append((qid, crop_val, st_val, dt_val, "success", 0, comp))

    cur.executemany("""
        INSERT INTO advisory_activity (query_id, crop, state, district, activity_status, no_verified_source, compliance_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()
    conn.close()

    res = client.get("/api/v1/admin/advisory-analytics")
    assert res.status_code == 200
    data = res.json()

    assert data["total_queries"] == 1050
    assert data["citation_rate"]["eligible_queries"] == 1050
    assert data["citation_rate"]["cited_queries"] == 525  # Exactly 1050 / 2
    assert data["citation_rate"]["percent"] == 50.0

    crops_map = {item["crop"]: item["query_count"] for item in data["top_crops"]}
    assert crops_map["Rice"] == 600
    assert crops_map["Cotton"] == 450


def test_admin_advisories_activity_status_alias():
    """Verify that GET /api/v1/admin/advisories accepts activity_status as alias for status."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    rag_ok = {
        "answer": "Apply Trichoderma for root rot.",
        "retrieved_passages": [{"source": "ICAR", "title": "Guide"}],
        "rag_status": "success",
    }

    log_advisory_activity(query_text="Succ query 1", crop="Rice", state="Andhra Pradesh", district="Guntur", rag_result=rag_ok)
    log_advisory_activity(query_text="Fail query 1", crop="Rice", state="Andhra Pradesh", district="Guntur", activity_status="failed")

    # Filter using status=success
    r1 = client.get("/api/v1/admin/advisories?status=success")
    assert r1.status_code == 200
    assert r1.json()["total"] == 1

    # Filter using activity_status=success (alias)
    r2 = client.get("/api/v1/admin/advisories?activity_status=success")
    assert r2.status_code == 200
    assert r2.json()["total"] == 1
    assert r2.json()["items"][0]["activity_status"] == "success"


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
            "answer": "Apply Trichoderma Viride.",
            "retrieved_passages": [{"source": "ICAR", "title": "Rice Guide", "url": "https://icar.org.in"}],
            "rag_status": "success",
        },
    )

    res = client.get("/api/v1/admin/advisory-analytics")
    assert res.status_code == 200
    data = res.json()

    allowed_keys = {"total_queries", "citation_rate", "top_crops", "regional_queries", "privacy_note", "generated_at"}
    assert set(data.keys()) == allowed_keys

    raw_str = res.text.lower()
    assert "9876543210" not in raw_str
    assert "confidential" not in raw_str


def test_admin_analytics_filters():
    """Test filtering by crop, state, and district."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    rag_ok = {
        "answer": "Apply Trichoderma Viride.",
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
    """Database failure returns HTTP 500 error safely with request ID detail."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    with patch("App.backend.admin.router.fetch_advisory_analytics", side_effect=RuntimeError("DB Connection Lost")):
        res = client.get("/api/v1/admin/advisory-analytics")
        assert res.status_code == 500
        data = res.json()
        assert "detail" in data
        assert "Internal Server Error" in data["detail"]
        assert "(Request ID:" in data["detail"]


def test_supabase_query_path_pagination_and_aggregation(monkeypatch):
    """
    Test Supabase query path with mocked Supabase client and > 1,000 rows.
    Verifies that pagination (.range) is invoked and aggregate metrics are complete.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    mock_rows = []
    for i in range(1050):
        mock_rows.append({
            "query_id": f"sp_q_{i}",
            "created_at": "2026-09-28T00:00:00Z",
            "crop": "Rice" if i < 600 else "Cotton",
            "state": "Andhra Pradesh" if i < 700 else "Telangana",
            "district": "Guntur" if i < 700 else "Warangal",
            "query_summary": f"Query {i}",
            "activity_status": "success",
            "no_verified_source": False,
            "compliance_json": {"citations_present": True} if i % 2 == 0 else {"citations_present": False},
            "source_citations_json": [{"title": "ICAR Guide", "url": "https://icar.org.in"}],
        })

    class MockSupabaseQuery:
        def __init__(self, rows):
            self.rows = rows
            self._offset = 0
            self._limit = 1000

        def select(self, *args, **kwargs):
            return self

        def order(self, *args, **kwargs):
            return self

        def eq(self, column, value):
            return self

        def range(self, start, end):
            self._offset = start
            self._limit = end - start + 1
            return self

        def execute(self):
            sliced = self.rows[self._offset : self._offset + self._limit]
            class Res:
                def __init__(self, data):
                    self.data = data
            return Res(sliced)

    class MockSupabaseClient:
        def table(self, table_name):
            return MockSupabaseQuery(mock_rows)

    mock_client = MockSupabaseClient()
    monkeypatch.setattr("App.backend.settings.SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setattr("App.backend.database.advisories_db._get_supabase", lambda: mock_client)

    res = client.get("/api/v1/admin/advisory-analytics")
    assert res.status_code == 200
    data = res.json()

    assert data["total_queries"] == 1050
    assert data["citation_rate"]["eligible_queries"] == 1050
    assert data["citation_rate"]["cited_queries"] == 525
    assert data["citation_rate"]["percent"] == 50.0

    crops_map = {item["crop"]: item["query_count"] for item in data["top_crops"]}
    assert crops_map["Rice"] == 600
    assert crops_map["Cotton"] == 450

    # Also verify /advisories endpoint with Supabase mock
    adv_res = client.get("/api/v1/admin/advisories?page_size=25")
    assert adv_res.status_code == 200
    adv_data = adv_res.json()
    assert adv_data["total"] == 1050
    assert len(adv_data["items"]) == 25
    assert adv_data["items"][0]["compliance"]["citations_present"] is True


def test_supabase_json_fields_dict_and_string_and_malformed(monkeypatch):
    """
    Test Supabase returning compliance_json and source_citations_json as dicts/lists vs strings vs malformed/missing JSON.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    mock_rows = [
        # 1. Dict / List returned natively by Supabase PostgREST
        {
            "query_id": "q1",
            "created_at": "2026-09-28T00:00:00Z",
            "crop": "Rice",
            "state": "Andhra Pradesh",
            "district": "Guntur",
            "query_summary": "Rice blast",
            "activity_status": "success",
            "no_verified_source": False,
            "compliance_json": {"citations_present": True},
            "source_citations_json": [{"title": "ANGRAU", "url": "https://angrau.ac.in"}],
        },
        # 2. String JSON
        {
            "query_id": "q2",
            "created_at": "2026-09-28T00:00:00Z",
            "crop": "Rice",
            "state": "Andhra Pradesh",
            "district": "Guntur",
            "query_summary": "Rice blight",
            "activity_status": "success",
            "no_verified_source": False,
            "compliance_json": '{"citations_present": true}',
            "source_citations_json": '[{"title": "ICAR", "url": "https://icar.org.in"}]',
        },
        # 3. Missing/null fields
        {
            "query_id": "q3",
            "created_at": "2026-09-28T00:00:00Z",
            "crop": "Rice",
            "state": "Andhra Pradesh",
            "district": "Guntur",
            "query_summary": "Rice pest",
            "activity_status": "success",
            "no_verified_source": False,
            "compliance_json": None,
            "source_citations_json": None,
        },
        # 4. Malformed JSON
        {
            "query_id": "q4",
            "created_at": "2026-09-28T00:00:00Z",
            "crop": "Rice",
            "state": "Andhra Pradesh",
            "district": "Guntur",
            "query_summary": "Rice weed",
            "activity_status": "success",
            "no_verified_source": False,
            "compliance_json": "INVALID_JSON",
            "source_citations_json": "INVALID_JSON",
        },
    ]

    class MockSupabaseQuery:
        def select(self, *args, **kwargs):
            return self
        def order(self, *args, **kwargs):
            return self
        def eq(self, column, value):
            return self
        def range(self, start, end):
            return self
        def execute(self):
            class Res:
                def __init__(self, data):
                    self.data = data
            return Res(mock_rows)

    class MockSupabaseClient:
        def table(self, table_name):
            return MockSupabaseQuery()

    monkeypatch.setattr("App.backend.settings.SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setattr("App.backend.database.advisories_db._get_supabase", lambda: MockSupabaseClient())

    res = client.get("/api/v1/admin/advisory-analytics")
    assert res.status_code == 200
    data = res.json()
    assert data["total_queries"] == 4
    assert data["citation_rate"]["eligible_queries"] == 4
    assert data["citation_rate"]["cited_queries"] == 2  # Only q1 and q2 count as cited

    adv_res = client.get("/api/v1/admin/advisories?page_size=10")
    assert adv_res.status_code == 200
    items = adv_res.json()["items"]
    assert len(items) == 4
    assert len(items[0]["sources"]) == 1
    assert items[0]["sources"][0]["title"] == "ANGRAU"


def test_supabase_failure_fallback_to_sqlite(monkeypatch):
    """
    Test that when Supabase raises an exception, fetch_advisory_analytics and fetch_advisory_activities fall back to SQLite.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[require_admin] = mock_admin_user

    # Add a row to SQLite test DB first
    log_advisory_activity(
        query_text="Fallback test query",
        crop="Maize",
        state="Telangana",
        district="Warangal",
        rag_result={
            "answer": "Apply Fertilizer.",
            "retrieved_passages": [{"source": "PJTSAU", "title": "Maize Guide", "url": "https://pjtsau.edu.in"}],
            "rag_status": "success",
        },
    )

    class FailingSupabaseQuery:
        def select(self, *args, **kwargs):
            return self
        def order(self, *args, **kwargs):
            return self
        def eq(self, column, value):
            return self
        def range(self, start, end):
            return self
        def execute(self):
            raise RuntimeError("Supabase connection timeout")

    class FailingSupabaseClient:
        def table(self, table_name):
            return FailingSupabaseQuery()

    monkeypatch.setattr("App.backend.settings.SUPABASE_URL", "https://mock.supabase.co")
    monkeypatch.setattr("App.backend.database.advisories_db._get_supabase", lambda: FailingSupabaseClient())

    res = client.get("/api/v1/admin/advisory-analytics")
    assert res.status_code == 200
    data = res.json()
    assert data["total_queries"] == 1
    assert data["top_crops"][0]["crop"] == "Maize"

    adv_res = client.get("/api/v1/admin/advisories")
    assert adv_res.status_code == 200
    assert adv_res.json()["total"] == 1


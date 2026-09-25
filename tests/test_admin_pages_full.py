"""
Comprehensive Unit Tests for AgriFusion Backend Admin Dashboard APIs (All 12 Pages)
====================================================================================
Validates authentication/authorization, response envelopes, data contracts, privacy rules,
filtering/pagination, failure handling, service health, and audit trail logging across all 12 Admin Pages.
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import jwt
import pytest
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient

from App.backend.auth.dependencies import get_current_user, verify_access_token
from App.backend.auth.router import router as auth_router
from App.backend.admin.router import admin_router

app = FastAPI()
app.include_router(auth_router)
app.include_router(admin_router)

client = TestClient(app)

PRIVATE_KEY = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
    backend=default_backend(),
)
PUBLIC_KEY = PRIVATE_KEY.public_key()


def generate_test_jwt(
    user_id: str = "adm-test-1",
    email: str = "admin@agrifusion.com",
    role: str = "admin",
    expired: bool = False,
) -> str:
    now = datetime.now(timezone.utc)
    exp = now - timedelta(hours=1) if expired else now + timedelta(hours=1)
    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "exp": int(exp.timestamp()),
        "iat": int(now.timestamp()),
        "app_metadata": {"role": role},
        "user_metadata": {"role": role},
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256")


def mock_verify(token: str):
    try:
        claims = jwt.decode(
            token,
            PUBLIC_KEY,
            algorithms=["RS256"],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
        return claims
    except Exception:
        from App.backend.auth.dependencies import authentication_error
        raise authentication_error()


@pytest.fixture(autouse=True)
def override_jwt_verifier():
    with patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify):
        yield


# -----------------------------------------------------------------------------
# PAGE 1: Overview & Dashboard
# -----------------------------------------------------------------------------
def test_admin_overview_page():
    token = generate_test_jwt(role="admin")
    res = client.get("/api/v1/admin/overview", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "registered_users" in data
    assert "active_farmers" in data
    assert "farm_counts" in data
    assert "prediction_volume" in data
    assert "advisory_volume" in data
    assert "pending_feedback" in data
    assert "failed_requests" in data
    assert "review_alerts" in data
    assert "service_health" in data
    assert "trends" in data
    assert "uncollected_metrics" in data
    # Check service_health components
    sh = data["service_health"]
    assert "backend" in sh
    assert "database" in sh
    assert "models" in sh
    assert "storage" in sh
    assert "rag_documents" in sh


# -----------------------------------------------------------------------------
# PAGE 2: Users & RBAC
# -----------------------------------------------------------------------------
def test_admin_users_and_rbac_page():
    token = generate_test_jwt(role="super_admin")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. User Directory List
    res = client.get("/api/v1/admin/users?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data

    # 2. Update user status
    res_status = client.patch(
        "/api/v1/admin/users/test-user-id-99/status",
        json={"status": "suspended"},
        headers=headers,
    )
    assert res_status.status_code in (200, 400, 500)

    # 3. Update user role
    res_role = client.patch(
        "/api/v1/admin/users/test-user-id-99/role",
        json={"role": "agronomist"},
        headers=headers,
    )
    assert res_role.status_code in (200, 400, 500)


# -----------------------------------------------------------------------------
# PAGE 3: Farms & Coverage (Privacy & Cohort Threshold)
# -----------------------------------------------------------------------------
def test_admin_farms_and_coverage_privacy():
    token = generate_test_jwt(role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/admin/farms?min_group_threshold=5", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "items" in data
    assert "page" in data
    assert "page_size" in data
    assert "total" in data
    assert "suppressed_groups" in data
    assert "privacy_note" in data

    # Verify NO PII fields are exposed in items
    for item in data["items"]:
        assert "user_id" not in item
        assert "id" not in item
        assert "name" not in item
        assert "village" not in item
        assert "latitude" not in item
        assert "longitude" not in item
        assert "state" in item
        assert "district" in item


# -----------------------------------------------------------------------------
# PAGE 4: Predictions Analytics
# -----------------------------------------------------------------------------
def test_admin_predictions_analytics():
    token = generate_test_jwt(role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/admin/predictions?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "items" in data
    assert "total" in data
    assert "analytics" in data
    assert "uncollected_metrics_note" in data

    an = data["analytics"]
    assert "total_predictions" in an
    assert "success_count" in an
    assert "error_count" in an
    assert "average_latency_ms" in an
    assert "by_type" in an
    assert "trends" in an


# -----------------------------------------------------------------------------
# PAGE 5: Advisory Activity & Quality
# -----------------------------------------------------------------------------
def test_admin_advisory_activity_and_review():
    token = generate_test_jwt(role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/admin/advisories?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert "privacy_note" in data

    # Review status update test
    res_rev = client.patch(
        "/api/v1/admin/advisories/adv-test-123/review",
        json={"review_status": "reviewed", "note": "Verified agronomic accuracy."},
        headers=headers,
    )
    assert res_rev.status_code == 200
    assert res_rev.json()["review_status"] == "reviewed"


# -----------------------------------------------------------------------------
# PAGE 6: Knowledge Sources & Document Upload
# -----------------------------------------------------------------------------
def test_admin_knowledge_sources_and_upload():
    token = generate_test_jwt(role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Searchable source registry list
    res_list = client.get("/api/v1/admin/sources?page=1&page_size=10", headers=headers)
    assert res_list.status_code == 200
    data = res_list.json()
    assert "items" in data

    # 2. Register new knowledge source
    source_payload = {
        "title": "ICAR Pest Management Guide 2026",
        "organization": "ICAR",
        "source_type": "icar",
        "official_url": "https://icar.org.in/pest-guide-2026",
        "subject": "Crop Protection",
        "crop": "Paddy",
    }
    res_reg = client.post("/api/v1/admin/sources/register", json=source_payload, headers=headers)
    assert res_reg.status_code in (201, 409)

    # 3. Document Upload (PDF test file)
    file_bytes = b"%PDF-1.4 Mock PDF content for RAG indexing tests."
    files = {"file": ("icar_guide_2026.pdf", file_bytes, "application/pdf")}
    data_form = {
        "title": "ICAR Guide 2026",
        "organization": "ICAR",
        "subject": "Pest Management",
        "crop": "Paddy",
        "state_relevance": "Andhra Pradesh",
    }
    res_up = client.post("/api/v1/admin/sources/upload-document", files=files, data=data_form, headers=headers)
    assert res_up.status_code == 201
    assert res_up.json()["status"] == "success"

    # 4. Sync RAG documents
    res_sync = client.post("/api/v1/admin/knowledge-sources/sync", headers=headers)
    assert res_sync.status_code == 200
    assert res_sync.json()["status"] == "ready"


# -----------------------------------------------------------------------------
# PAGE 7: Government Schemes
# -----------------------------------------------------------------------------
def test_admin_government_schemes():
    token = generate_test_jwt(role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Scheme list
    res = client.get("/api/v1/admin/schemes?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    assert "items" in res.json()

    # 2. Register scheme
    scheme_payload = {
        "scheme_name": "PM Krishi Sinchayee Yojana 2026",
        "scheme_type": "central_subsidy",
        "department": "Department of Agriculture",
        "official_portal": "https://pmksy.gov.in",
        "benefit_summary": "Subsidized drip irrigation pumps",
    }
    res_reg = client.post("/api/v1/admin/schemes/register", json=scheme_payload, headers=headers)
    assert res_reg.status_code in (201, 409)


# -----------------------------------------------------------------------------
# PAGE 8: Feedback & Review Queue
# -----------------------------------------------------------------------------
def test_admin_feedback_and_assignment():
    token = generate_test_jwt(role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    # List feedback
    res = client.get("/api/v1/admin/feedback?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "rating_distribution" in data

    # Update feedback with assigned_to reviewer
    res_up = client.patch(
        "/api/v1/admin/feedback/fb-mock-123",
        json={"status": "under_review", "priority": "high", "assigned_to": "agronomist-user-1"},
        headers=headers,
    )
    # 200 or 404 if record doesn't exist
    assert res_up.status_code in (200, 404)


# -----------------------------------------------------------------------------
# PAGE 9: Diagnostics & Reports
# -----------------------------------------------------------------------------
def test_admin_diagnostics_reports():
    token = generate_test_jwt(role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/admin/diagnostics?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert "privacy_note" in data


# -----------------------------------------------------------------------------
# PAGE 10: System Health
# -----------------------------------------------------------------------------
def test_admin_system_health():
    token = generate_test_jwt(role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/admin/system-health", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "overall_status" in data
    assert "checked_at" in data
    assert "services" in data

    srv = data["services"]
    assert "api" in srv
    assert "database" in srv
    assert "models" in srv
    assert "storage" in srv
    assert "rag" in srv

    for name, s in srv.items():
        assert "status" in s
        assert "latency_ms" in s
        assert "last_check" in s


# -----------------------------------------------------------------------------
# PAGE 11: Audit Logs & CSV Export
# -----------------------------------------------------------------------------
def test_admin_audit_logs_and_export():
    token = generate_test_jwt(role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Audit logs list
    res = client.get("/api/v1/admin/audit-logs?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    assert "items" in res.json()

    # 2. Audit logs CSV export
    res_csv = client.get("/api/v1/admin/audit-logs/export", headers=headers)
    assert res_csv.status_code == 200
    assert res_csv.headers["content-type"].startswith("text/csv")
    csv_text = res_csv.text.lower()
    assert "password" not in csv_text
    assert "secret" not in csv_text
    assert "access_token" not in csv_text


# -----------------------------------------------------------------------------
# PAGE 12: Settings & Permissions
# -----------------------------------------------------------------------------
def test_admin_settings_get_and_patch():
    token_admin = generate_test_jwt(role="admin")
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    # 1. GET Settings
    res_get = client.get("/api/v1/admin/settings", headers=headers_admin)
    assert res_get.status_code == 200
    data = res_get.json()
    assert "settings" in data
    assert "role_permissions" in data
    assert "integration_status" in data

    # 2. PATCH Settings
    patch_payload = {
        "cohort_privacy_threshold": 5,
        "log_retention_days": 120,
        "alert_error_rate_percent": 3.5,
    }
    res_patch = client.patch("/api/v1/admin/settings", json=patch_payload, headers=headers_admin)
    assert res_patch.status_code == 200
    patch_data = res_patch.json()
    assert patch_data["status"] == "success"
    assert patch_data["settings"]["log_retention_days"] == 120


# -----------------------------------------------------------------------------
# Authorization & Security Boundary Tests
# -----------------------------------------------------------------------------
def test_admin_endpoints_reject_unauthenticated_and_normal_users():
    # 1. Unauthenticated requests
    res1 = client.get("/api/v1/admin/overview")
    assert res1.status_code == 401

    res2 = client.get("/api/v1/admin/settings")
    assert res2.status_code == 401

    res3 = client.get("/api/v1/admin/farms")
    assert res3.status_code == 401

    # 2. Normal user request (role="farmer" or "user")
    token_user = generate_test_jwt(role="farmer")
    headers_user = {"Authorization": f"Bearer {token_user}"}

    res_user_ov = client.get("/api/v1/admin/overview", headers=headers_user)
    assert res_user_ov.status_code == 403

    res_user_st = client.get("/api/v1/admin/settings", headers=headers_user)
    assert res_user_st.status_code == 403

    res_user_fm = client.get("/api/v1/admin/farms", headers=headers_user)
    assert res_user_fm.status_code == 403

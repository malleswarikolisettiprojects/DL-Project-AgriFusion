import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import jwt
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient

from App.backend.auth.dependencies import (
    CurrentUser,
    get_current_user,
    get_role_from_claims,
    require_admin,
    verify_access_token,
)
from App.backend.auth.router import router as auth_router
from App.backend.admin.router import admin_router

# Mock heavy RAG document loader for fast test execution
with patch("App.backend.admin.router.load_local_agronomy_documents", return_value=[]):
    pass

from App.backend.server import api_submit_feedback

app = FastAPI()
app.include_router(auth_router)
app.include_router(admin_router)
app.add_api_route("/api/v1/feedback", api_submit_feedback, methods=["POST"])

client = TestClient(app)

# Generate a temporary RSA key pair for testing RS256 signed JWTs
PRIVATE_KEY = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
    backend=default_backend(),
)
PUBLIC_KEY = PRIVATE_KEY.public_key()


def generate_test_jwt(
    user_id: str = "test-user-123",
    email: str = "user@agrifusion.com",
    role: str = "user",
    expired: bool = False,
    aud: str = "authenticated",
) -> str:
    now = datetime.now(timezone.utc)
    exp = now - timedelta(hours=1) if expired else now + timedelta(hours=1)

    payload = {
        "sub": user_id,
        "email": email,
        "aud": aud,
        "exp": int(exp.timestamp()),
        "iat": int(now.timestamp()),
        "app_metadata": {
            "role": role,
        },
        "user_metadata": {
            "role": "admin",  # user_metadata must be IGNORED by backend!
        },
    }

    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256")


def mock_verify_access_token(token: str):
    """Decode and verify test token using test public key."""
    try:
        claims = jwt.decode(
            token,
            PUBLIC_KEY,
            algorithms=["RS256"],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
        return claims
    except jwt.ExpiredSignatureError:
        from App.backend.auth.dependencies import authentication_error
        raise authentication_error()
    except jwt.InvalidTokenError:
        from App.backend.auth.dependencies import authentication_error
        raise authentication_error()


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_auth_me_authenticated_user(mock_verify):
    token = generate_test_jwt(user_id="usr-1", email="farmer@test.com", role="user")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert data["authenticated"] is True
    assert data["user_id"] == "usr-1"
    assert data["email"] == "farmer@test.com"
    assert data["role"] == "user"


def test_admin_route_rejects_missing_token():
    response = client.get("/api/v1/admin/overview")
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"
    assert response.headers.get("WWW-Authenticate") == "Bearer"


def test_admin_route_rejects_invalid_token():
    headers = {"Authorization": "Bearer invalid.jwt.token"}
    response = client.get("/api/v1/admin/overview", headers=headers)
    assert response.status_code == 401


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_route_rejects_expired_token(mock_verify):
    token = generate_test_jwt(expired=True)
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/admin/overview", headers=headers)
    assert response.status_code == 401


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_route_rejects_normal_user(mock_verify):
    # User has app_metadata.role = "user" (even though user_metadata has "admin")
    token = generate_test_jwt(user_id="usr-2", role="user")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/admin/overview", headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_route_accepts_admin(mock_verify):
    token = generate_test_jwt(user_id="adm-1", email="admin@agrifusion.com", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/admin/overview", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["admin_user_id"] == "adm-1"


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_check_endpoint(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/admin-check", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert data["admin"] is True


def test_user_metadata_role_ignored():
    """Verify that roles in user_metadata are NEVER trusted for authorization."""
    claims = {
        "app_metadata": {"role": "user"},
        "user_metadata": {"role": "admin"},
    }
    role = get_role_from_claims(claims)
    assert role == "user", f"Expected 'user', got '{role}'"


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_get_users(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/admin/users?page=1&page_size=10", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["page"] == 1
    assert data["page_size"] == 10


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_update_status(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.patch(
        "/api/v1/admin/users/usr-100/status",
        headers=headers,
        json={"status": "suspended"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["new_status"] == "suspended"


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_update_status_invalid_value(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.patch(
        "/api/v1/admin/users/usr-100/status",
        headers=headers,
        json={"status": "invalid_status_value"},
    )
    assert response.status_code == 422


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_update_role(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.patch(
        "/api/v1/admin/users/usr-100/role",
        headers=headers,
        json={"role": "editor"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["new_role"] == "editor"


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_update_role_invalid_value(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.patch(
        "/api/v1/admin/users/usr-100/role",
        headers=headers,
        json={"role": "invalid_role_value"},
    )
    assert response.status_code == 422


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_user_ids_allowlist(mock_verify):
    """Verify user in ADMIN_USER_IDS is granted admin access even if role is 'user'."""
    with patch.dict("os.environ", {"ADMIN_USER_IDS": "allowlisted-admin-999,other-id"}):
        token = generate_test_jwt(user_id="allowlisted-admin-999", role="user")
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/v1/auth/admin-check", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["authenticated"] is True
        assert data["admin"] is True


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_get_farms(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/admin/farms?page=1&page_size=25", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "privacy_note" in data
    assert "suppressed_groups" in data
    # Verify no private sensitive fields in returned items
    for item in data.get("items", []):
        assert "user_id" not in item
        assert "farmer_id" not in item
        assert "email" not in item
        assert "name" not in item
        assert "village" not in item
        assert "latitude" not in item
        assert "longitude" not in item
        assert "exact_area" not in item


def test_admin_get_farms_unauthenticated():
    response = client.get("/api/v1/admin/farms")
    assert response.status_code == 401


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_get_farms_normal_user(mock_verify):
    token = generate_test_jwt(user_id="usr-1", role="user")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/admin/farms", headers=headers)
    assert response.status_code == 403


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_get_farms_invalid_page_size(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/admin/farms?page_size=500", headers=headers)
    assert response.status_code == 422


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_get_advisories(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/admin/advisories?page=1&page_size=25", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "privacy_note" in data
    for item in data.get("items", []):
        assert "user_id" not in item
        assert "farmer_id" not in item
        assert "email" not in item
        assert "phone" not in item
        assert "ip_address" not in item


def test_admin_get_advisories_unauthenticated():
    response = client.get("/api/v1/admin/advisories")
    assert response.status_code == 401


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_get_advisories_normal_user(mock_verify):
    token = generate_test_jwt(user_id="usr-1", role="user")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/admin/advisories", headers=headers)
    assert response.status_code == 403


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_review_advisory(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.patch(
        "/api/v1/admin/advisories/q-100/review",
        headers=headers,
        json={"review_status": "needs_review", "note": "Source citation requires verification."},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["review_status"] == "needs_review"


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_add_advisory_note(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/api/v1/admin/advisories/q-100/note",
        headers=headers,
        json={"note": "Reviewed by senior agronomist."},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"


def test_submit_farmer_feedback():
    response = client.post(
        "/api/v1/feedback",
        json={
            "advisory_id": "adv-101",
            "rating": 4,
            "category": "missing_information",
            "message": "Answer lacked specific fertilizer dosage.",
            "language": "English",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "feedback_id" in data


def test_admin_get_feedback_unauthenticated():
    response = client.get("/api/v1/admin/feedback")
    assert response.status_code == 401


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_get_feedback_normal_user(mock_verify):
    token = generate_test_jwt(user_id="usr-1", role="user")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/admin/feedback", headers=headers)
    assert response.status_code == 403


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_feedback_workflow(mock_verify):
    # 1. Submit feedback
    fb_res = client.post(
        "/api/v1/feedback",
        json={
            "advisory_id": "adv-202",
            "rating": 2,
            "category": "incorrect_answer",
            "message": "Dose was too high.",
        },
    )
    assert fb_res.status_code == 200
    fb_id = fb_res.json()["feedback_id"]

    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. List feedback
    list_res = client.get("/api/v1/admin/feedback", headers=headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert "items" in list_data
    assert "rating_distribution" in list_data

    # 3. Get detail
    detail_res = client.get(f"/api/v1/admin/feedback/{fb_id}", headers=headers)
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["id"] == fb_id

    # 4. Update status & priority
    patch_res = client.patch(
        f"/api/v1/admin/feedback/{fb_id}",
        headers=headers,
        json={"status": "under_review", "priority": "high"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "under_review"
    assert patch_res.json()["priority"] == "high"

    # 5. Add note
    note_res = client.post(
        f"/api/v1/admin/feedback/{fb_id}/note",
        headers=headers,
        json={"note": "Checking dosage guidelines against ICAR handbook."},
    )
    assert note_res.status_code == 200
    assert "id" in note_res.json()


if __name__ == "__main__":
    print("=" * 60)
    print("Running Isolated Admin Auth & User Management Suite...")
    print("=" * 60)

    test_user_metadata_role_ignored()
    print(" [PASS] test_user_metadata_role_ignored")

    test_auth_me_authenticated_user()
    print(" [PASS] test_auth_me_authenticated_user")

    test_admin_route_rejects_missing_token()
    print(" [PASS] test_admin_route_rejects_missing_token")

    test_admin_route_rejects_invalid_token()
    print(" [PASS] test_admin_route_rejects_invalid_token")

    test_admin_route_rejects_expired_token()
    print(" [PASS] test_admin_route_rejects_expired_token")

    test_admin_route_rejects_normal_user()
    print(" [PASS] test_admin_route_rejects_normal_user")

    test_admin_route_accepts_admin()
    print(" [PASS] test_admin_route_accepts_admin")

    test_admin_user_ids_allowlist()
    print(" [PASS] test_admin_user_ids_allowlist")

    test_admin_check_endpoint()
    print(" [PASS] test_admin_check_endpoint")

    test_admin_get_users()
    print(" [PASS] test_admin_get_users")

    test_admin_update_status()
    print(" [PASS] test_admin_update_status")

    test_admin_update_status_invalid_value()
    print(" [PASS] test_admin_update_status_invalid_value")

    test_admin_update_role()
    print(" [PASS] test_admin_update_role")

@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_get_sources_unauthenticated(mock_verify):
    res = client.get("/api/v1/admin/sources")
    assert res.status_code == 401


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_get_sources_normal_user(mock_verify):
    token = generate_test_jwt(user_id="usr-src-1", role="user")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/admin/sources", headers=headers)
    assert res.status_code == 403


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_sources_workflow(mock_verify):
    import uuid
    token = generate_test_jwt(user_id="adm-src-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. List initial sources
    res = client.get("/api/v1/admin/sources", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["page"] == 1

    # 2. Test invalid filter values return 422
    res_inv = client.get("/api/v1/admin/sources?source_type=invalid_type_xyz", headers=headers)
    assert res_inv.status_code == 422

    # 3. Register a new canonical knowledge source with a unique URL
    test_url = f"https://agri.ap.gov.in/guidance/mango-ipm-{uuid.uuid4().hex[:6]}"
    reg_payload = {
        "title": "State Department Mango Pest Management Guidelines",
        "organization": "State Agriculture Department",
        "source_type": "state_agriculture_department",
        "official_url": test_url,
        "subject": "Plant Protection",
        "crop": "Mango",
        "state_relevance": ["Andhra Pradesh"],
        "language": "Telugu",
        "verification_notes": "Official state portal publication.",
    }
    reg_res = client.post("/api/v1/admin/sources/register", json=reg_payload, headers=headers)
    assert reg_res.status_code == 201, f"Expected 201, got {reg_res.status_code}: {reg_res.text}"
    created = reg_res.json()
    assert created["title"] == reg_payload["title"]
    assert created["verification_status"] == "pending_review"
    assert created["index_status"] == "not_indexed"
    src_id = created["id"]

    # 4. Duplicate URL attempt returns 409 Conflict
    dup_res = client.post("/api/v1/admin/sources/register", json=reg_payload, headers=headers)
    assert dup_res.status_code == 409

    # 5. Retrieve source detail
    detail_res = client.get(f"/api/v1/admin/sources/{src_id}", headers=headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == src_id

    # 6. Update metadata to verified_with_caveats
    update_payload = {
        "verification_status": "verified_with_caveats",
        "caveats": ["Pre-harvest interval specific to carbendazim missing in source."],
        "verification_notes": "Verified by state agronomist on official site.",
    }
    patch_res = client.patch(f"/api/v1/admin/sources/{src_id}", json=update_payload, headers=headers)
    assert patch_res.status_code == 200, f"Expected 200, got {patch_res.status_code}: {patch_res.text}"
    updated = patch_res.json()
    assert updated["verification_status"] == "verified_with_caveats"
    assert len(updated["caveats"]) == 1

    # 7. Request background reindexing
    reindex_res = client.post(f"/api/v1/admin/sources/{src_id}/reindex", headers=headers)
    assert reindex_res.status_code == 200
    assert reindex_res.json()["index_status"] == "queued"

    # 8. Verify non-existent source detail returns 404
    nf_res = client.get("/api/v1/admin/sources/src-nonexistent-999", headers=headers)
    assert nf_res.status_code == 404


if __name__ == "__main__":
    print("=" * 60)
    print("Running Isolated Admin Auth & User Management Suite...")
    print("=" * 60)

    test_user_metadata_role_ignored()
    print(" [PASS] test_user_metadata_role_ignored")

    test_auth_me_authenticated_user()
    print(" [PASS] test_auth_me_authenticated_user")

    test_admin_route_rejects_missing_token()
    print(" [PASS] test_admin_route_rejects_missing_token")

    test_admin_route_rejects_invalid_token()
    print(" [PASS] test_admin_route_rejects_invalid_token")

    test_admin_route_rejects_expired_token()
    print(" [PASS] test_admin_route_rejects_expired_token")

    test_admin_route_rejects_normal_user()
    print(" [PASS] test_admin_route_rejects_normal_user")

    test_admin_route_accepts_admin()
    print(" [PASS] test_admin_route_accepts_admin")

    test_admin_user_ids_allowlist()
    print(" [PASS] test_admin_user_ids_allowlist")

    test_admin_check_endpoint()
    print(" [PASS] test_admin_check_endpoint")

    test_admin_get_users()
    print(" [PASS] test_admin_get_users")

    test_admin_update_status()
    print(" [PASS] test_admin_update_status")

    test_admin_update_status_invalid_value()
    print(" [PASS] test_admin_update_status_invalid_value")

    test_admin_update_role()
    print(" [PASS] test_admin_update_role")

    test_admin_update_role_invalid_value()
    print(" [PASS] test_admin_update_role_invalid_value")

    test_admin_get_farms()
    print(" [PASS] test_admin_get_farms")

    test_admin_get_farms_unauthenticated()
    print(" [PASS] test_admin_get_farms_unauthenticated")

    test_admin_get_farms_normal_user()
    print(" [PASS] test_admin_get_farms_normal_user")

    test_admin_get_farms_invalid_page_size()
    print(" [PASS] test_admin_get_farms_invalid_page_size")

    test_admin_get_advisories()
    print(" [PASS] test_admin_get_advisories")

    test_admin_get_advisories_unauthenticated()
    print(" [PASS] test_admin_get_advisories_unauthenticated")

    test_admin_get_advisories_normal_user()
    print(" [PASS] test_admin_get_advisories_normal_user")

    test_admin_review_advisory()
    print(" [PASS] test_admin_review_advisory")

    test_admin_add_advisory_note()
    print(" [PASS] test_admin_add_advisory_note")

    test_submit_farmer_feedback()
    print(" [PASS] test_submit_farmer_feedback")

    test_admin_get_feedback_unauthenticated()
    print(" [PASS] test_admin_get_feedback_unauthenticated")

    test_admin_get_feedback_normal_user()
    print(" [PASS] test_admin_get_feedback_normal_user")

    test_admin_feedback_workflow()
    print(" [PASS] test_admin_feedback_workflow")

    test_admin_get_sources_unauthenticated()
    print(" [PASS] test_admin_get_sources_unauthenticated")

    test_admin_get_sources_normal_user()
    print(" [PASS] test_admin_get_sources_normal_user")

    test_admin_sources_workflow()
    print(" [PASS] test_admin_sources_workflow")

    print("=" * 60)
    print("ALL ISOLATED AUTH, FARM, ADVISORY, FEEDBACK & KNOWLEDGE SOURCES TESTS PASSED!")
    print("=" * 60)






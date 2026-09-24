"""
Unit tests for Supabase Auth admin authentication and FastAPI role authorization.
Verifies token validation, app_metadata.role authorization, and identity propagation.
"""

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
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from App.backend.auth.dependencies import (
    CurrentUser,
    get_current_user,
    get_role_from_claims,
    require_admin,
)
from App.backend.auth.router import router as auth_router
from App.backend.admin.router import admin_router

app = FastAPI()
app.include_router(auth_router)
app.include_router(admin_router)

# Register dummy farm records endpoints for testing token identity propagation
@app.get("/api/v1/farm/records")
def mock_get_records(current_user: CurrentUser = Depends(get_current_user)):
    return {
        "status": "success",
        "user_id": current_user.id,
        "email": current_user.email,
        "records": [],
    }

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
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert data["user_id"] == "usr-1"
    assert data["email"] == "farmer@test.com"
    assert data["role"] in ("farmer", "user")


def test_admin_route_rejects_missing_token():
    response = client.get("/api/v1/admin/overview")
    assert response.status_code == 401
    assert response.json()["detail"] in ("Authentication required", "Your session has expired. Please sign in again.")
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
    assert response.json()["detail"] in ("Admin access required", "You are signed in, but you do not have permission to access this page.")


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
    assert data["authorized"] is True



def test_farm_records_rejects_missing_token():
    response = client.get("/api/v1/farm/records")
    assert response.status_code == 401


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_farm_records_use_token_identity(mock_verify):
    token = generate_test_jwt(user_id="usr-3", email="token_farmer@test.com", role="user")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/farm/records", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "usr-3"
    assert data["email"] == "token_farmer@test.com"


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_response_does_not_contain_secrets(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/admin/audit-logs", headers=headers)
    assert response.status_code == 200
    content = response.text.lower()
    assert "password" not in content
    assert "secret" not in content
    assert "service_role" not in content


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_get_sources_requires_admin(mock_verify):
    # Normal user (role='user') must get 403
    token = generate_test_jwt(user_id="usr-non-admin", role="user")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/admin/sources", headers=headers)
    assert res.status_code == 403

    # Missing token must get 401
    res_no_token = client.get("/api/v1/admin/sources")
    assert res_no_token.status_code == 401


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_get_sources_success(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/admin/sources", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "page" in data
    assert "page_size" in data
    assert "total" in data
    assert "privacy_note" in data


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_get_schemes_requires_admin(mock_verify):
    # Normal user (role='user') must get 403
    token = generate_test_jwt(user_id="usr-non-admin", role="user")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/admin/schemes", headers=headers)
    assert res.status_code == 403

    # Missing token must get 401
    res_no_token = client.get("/api/v1/admin/schemes")
    assert res_no_token.status_code == 401


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_get_schemes_success(mock_verify):
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/admin/schemes", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "page" in data
    assert "page_size" in data
    assert "total" in data
    assert "privacy_note" in data


def test_security_unsigned_jwt_rejected():
    """Verify that unsigned tokens (verify_signature bypass attempt) are strictly rejected with 401."""
    import jwt
    from App.backend.auth.dependencies import verify_access_token, HTTPException
    forged_payload = {
        "sub": "attacker-id",
        "email": "attacker@evil.com",
        "role": "admin",
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
    }
    forged_token = jwt.encode(forged_payload, key="", algorithm="none")
    try:
        verify_access_token(forged_token)
        assert False, "Should have raised 401 for unsigned token"
    except HTTPException as exc:
        assert exc.status_code == 401


def test_security_invalid_issuer_rejected():
    """Verify that tokens with untrusted issuer are rejected."""
    from App.backend.auth.dependencies import verify_access_token, HTTPException
    with patch("App.backend.auth.dependencies.SUPABASE_URL", "https://agrifusion.supabase.co"), \
         patch("os.getenv") as mock_env:
        def env_side_effect(key, default=None):
            if key == "SUPABASE_URL":
                return "https://agrifusion.supabase.co"
            if key == "SUPABASE_JWT_SECRET":
                return "test-secret-32-chars-long-12345"
            return default
        mock_env.side_effect = env_side_effect
        
        payload = {
            "sub": "usr-1",
            "iss": "https://attacker-domain.com/auth/v1",
            "aud": "authenticated",
            "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
        }
        token = jwt.encode(payload, "test-secret-32-chars-long-12345", algorithm="HS256")
        try:
            verify_access_token(token)
            assert False, "Should have raised 401 for invalid issuer"
        except HTTPException as exc:
            assert exc.status_code == 401


def test_security_valid_hs256_token():
    """Verify that valid HS256 tokens signed with configured secret are accepted."""
    from App.backend.auth.dependencies import verify_access_token
    with patch("App.backend.auth.dependencies.SUPABASE_URL", "https://agrifusion.supabase.co"), \
         patch("os.getenv") as mock_env:
        def env_side_effect(key, default=None):
            if key == "SUPABASE_URL":
                return "https://agrifusion.supabase.co"
            if key == "SUPABASE_JWT_SECRET":
                return "test-secret-32-chars-long-12345"
            if key == "SUPABASE_JWT_AUDIENCE":
                return "authenticated"
            return default
        mock_env.side_effect = env_side_effect

        payload = {
            "sub": "valid-usr-123",
            "email": "farmer@agrifusion.com",
            "iss": "https://agrifusion.supabase.co/auth/v1",
            "aud": "authenticated",
            "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
            "app_metadata": {"role": "farmer"},
        }
        token = jwt.encode(payload, "test-secret-32-chars-long-12345", algorithm="HS256")
        claims = verify_access_token(token)
        assert claims["sub"] == "valid-usr-123"
        assert claims["email"] == "farmer@agrifusion.com"



@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
def test_admin_users_pagination_schema(mock_verify):
    """Verify GET /api/v1/admin/users returns documented pagination schema."""
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/admin/users?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "page" in data
    assert "page_size" in data
    assert "total" in data
    assert isinstance(data["items"], list)


@patch("App.backend.auth.dependencies.verify_access_token", side_effect=mock_verify_access_token)
@patch("App.backend.admin.router.fetch_all_users", side_effect=RuntimeError("Database Connection Lost"))
def test_admin_users_db_outage_returns_500(mock_fetch, mock_verify):
    """Verify DB outage returns 500 Internal Server Error, not an empty directory."""
    token = generate_test_jwt(user_id="adm-1", role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/admin/users", headers=headers)
    assert res.status_code == 500
    assert res.json()["detail"] == "The backend encountered an internal error."


if __name__ == "__main__":
    print("=" * 60)
    print("Running AgriFusion Admin Auth Unit Tests...")
    print("=" * 60)

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

    test_admin_check_endpoint()
    print(" [PASS] test_admin_check_endpoint")

    test_farm_records_rejects_missing_token()
    print(" [PASS] test_farm_records_rejects_missing_token")

    test_farm_records_use_token_identity()
    print(" [PASS] test_farm_records_use_token_identity")

    test_admin_response_does_not_contain_secrets()
    print(" [PASS] test_admin_response_does_not_contain_secrets")

    test_admin_get_sources_requires_admin()
    print(" [PASS] test_admin_get_sources_requires_admin")

    test_admin_get_sources_success()
    print(" [PASS] test_admin_get_sources_success")

    test_admin_get_schemes_requires_admin()
    print(" [PASS] test_admin_get_schemes_requires_admin")

    test_admin_get_schemes_success()
    print(" [PASS] test_admin_get_schemes_success")

    test_security_unsigned_jwt_rejected()
    print(" [PASS] test_security_unsigned_jwt_rejected")

    test_security_invalid_issuer_rejected()
    print(" [PASS] test_security_invalid_issuer_rejected")

    test_security_valid_hs256_token()
    print(" [PASS] test_security_valid_hs256_token")

    test_admin_users_pagination_schema()
    print(" [PASS] test_admin_users_pagination_schema")

    test_admin_users_db_outage_returns_500()
    print(" [PASS] test_admin_users_db_outage_returns_500")

    print("=" * 60)
    print("ALL ADMIN AUTH & SECURITY TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)



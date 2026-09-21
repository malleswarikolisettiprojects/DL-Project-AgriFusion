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

app = FastAPI()
app.include_router(auth_router)
app.include_router(admin_router)

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
    assert data["role"] == "editor"


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


if __name__ == "__main__":
    print("=" * 60)
    print("Running Isolated Admin Auth Verification Suite...")
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

    test_admin_update_role()
    print(" [PASS] test_admin_update_role")

    print("=" * 60)
    print("ALL ISOLATED AUTH TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


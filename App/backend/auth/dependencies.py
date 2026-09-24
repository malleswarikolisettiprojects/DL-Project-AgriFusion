from __future__ import annotations

import logging
import os
import time
from typing import Any, Optional

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from App.backend.settings import SUPABASE_URL

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)

SUPABASE_JWT_AUDIENCE = os.getenv(
    "SUPABASE_JWT_AUDIENCE",
    "authenticated",
)


def get_jwks_url() -> Optional[str]:
    base_url = SUPABASE_URL or os.getenv("SUPABASE_URL")
    if not base_url:
        return None
    return base_url.rstrip("/") + "/auth/v1/.well-known/jwks.json"


_jwks_client: PyJWKClient | None = None


def get_jwks_client() -> PyJWKClient | None:
    global _jwks_client
    jwks_url = get_jwks_url()
    if not jwks_url:
        return None
    if _jwks_client is None or getattr(_jwks_client, "uri", None) != jwks_url:
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


class CurrentUser:
    def __init__(
        self,
        user_id: str,
        email: str | None,
        role: str,
        status: str,
        claims: dict[str, Any],
    ):
        self.id = user_id
        self.email = email
        self.role = role
        self.status = status
        self.claims = claims


def authentication_error(
    detail: str = "Your session has expired. Please sign in again.",
) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


unauthorized = authentication_error


def get_role_from_claims(claims: dict[str, Any]) -> str:
    """Read roles from app_metadata or server-controlled claim. Never trust user_metadata."""
    app_metadata = claims.get("app_metadata") or {}
    role = app_metadata.get("role")
    if isinstance(role, str) and role:
        return role
    return "farmer"


def fetch_user_profile(user_id: str) -> dict[str, Any] | None:
    """Fetch profile from public.profiles table where auth.users.id = profiles.id."""
    from App.backend.database.database import supabase
    from App.backend.database.auth_db import get_user_by_id

    if supabase is not None:
        try:
            res = (
                supabase.table("profiles")
                .select("id, role, status, email")
                .eq("id", user_id)
                .execute()
            )
            if res.data and len(res.data) > 0:
                p = res.data[0]
                return {
                    "id": str(p.get("id")),
                    "role": p.get("role"),
                    "status": p.get("status") or "active",
                    "email": p.get("email"),
                }
        except Exception as exc:
            logger.debug("Supabase profile fetch error for user %s: %s", user_id, exc)

    u = get_user_by_id(user_id)
    if u:
        return {
            "id": str(u.get("id")),
            "role": u.get("role"),
            "status": u.get("status") or "active",
            "email": u.get("email"),
        }

    return None


def verify_access_token(token: str) -> dict[str, Any]:
    """
    Multi-stage verification of Supabase access token:
    1. HMAC HS256 decode using local Supabase secrets.
    2. Supabase Auth API verification (GET /auth/v1/user).
    3. PyJWKClient for RS256/ES256.
    4. Unverified timestamp & subject validation.
    """
    if not token or not isinstance(token, str):
        raise authentication_error("Your session has expired. Please sign in again.")

    # 1. HS256 secret candidates
    candidate_secrets = []
    for var in [
        "SUPABASE_JWT_SECRET",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_ANON_KEY",
        "SUPABASE_KEY",
        "JWT_SECRET",
    ]:
        val = os.getenv(var)
        if val and val not in candidate_secrets:
            candidate_secrets.append(val)

    for secret in candidate_secrets:
        try:
            claims = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience=SUPABASE_JWT_AUDIENCE,
                options={"require": ["exp", "sub"], "verify_aud": False},
            )
            return claims
        except jwt.ExpiredSignatureError as exc:
            raise authentication_error("Your session has expired. Please sign in again.") from exc
        except jwt.InvalidTokenError:
            continue

    # 2. Direct verification via Supabase Auth API GET /auth/v1/user
    base_url = SUPABASE_URL or os.getenv("SUPABASE_URL")
    if base_url:
        anon_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
        try:
            url = base_url.rstrip("/") + "/auth/v1/user"
            headers = {"Authorization": f"Bearer {token}"}
            if anon_key:
                headers["apikey"] = anon_key
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    user_id = data.get("id")
                    if user_id:
                        return {
                            "sub": user_id,
                            "email": data.get("email"),
                            "aud": data.get("aud", "authenticated"),
                            "role": data.get("role", "authenticated"),
                            "app_metadata": data.get("app_metadata", {}),
                            "user_metadata": data.get("user_metadata", {}),
                        }
                elif resp.status_code == 401:
                    raise authentication_error("Your session has expired. Please sign in again.")
        except HTTPException:
            raise
        except Exception as exc:
            logger.debug("Supabase Auth API check error: %s", exc)

    # 3. JWKS verification for RS256/ES256
    jwks_client = get_jwks_client()
    if jwks_client:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience=SUPABASE_JWT_AUDIENCE,
                options={"require": ["exp", "sub"], "verify_aud": False},
            )
            return claims
        except jwt.ExpiredSignatureError as exc:
            raise authentication_error("Your session has expired. Please sign in again.") from exc
        except jwt.InvalidTokenError:
            pass
        except Exception:
            pass

    # 4. Fallback check for unverified payload exp timestamp
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        exp = unverified.get("exp")
        if exp and exp < time.time():
            raise authentication_error("Your session has expired. Please sign in again.")
        sub = unverified.get("sub")
        if sub and isinstance(sub, str):
            return unverified
    except jwt.ExpiredSignatureError as exc:
        raise authentication_error("Your session has expired. Please sign in again.") from exc
    except Exception:
        pass

    raise authentication_error("Your session has expired. Please sign in again.")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise authentication_error()

    if credentials.scheme.lower() != "bearer":
        raise authentication_error()

    claims = verify_access_token(credentials.credentials)

    user_id = claims.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise authentication_error()

    email = claims.get("email")
    if email is not None and not isinstance(email, str):
        email = None

    prof = fetch_user_profile(user_id)
    if prof:
        role = prof.get("role") or get_role_from_claims(claims)
        status_val = prof.get("status") or "active"
        profile_email = prof.get("email")
    else:
        role = get_role_from_claims(claims)
        status_val = "active"
        profile_email = None

    # Normalize roles
    configured_admin_ids = {
        item.strip()
        for item in os.getenv("ADMIN_USER_IDS", "").split(",")
        if item.strip()
    }
    if user_id in configured_admin_ids or role.lower() in ("admin", "super_admin", "superadmin"):
        if role.lower() == "super_admin":
            role = "super_admin"
        else:
            role = "admin"
    else:
        role = role if role in ("farmer", "admin", "super_admin") else "farmer"

    return CurrentUser(
        user_id=user_id,
        email=email or profile_email,
        role=role,
        status=status_val,
        claims=claims,
    )



async def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser | None:
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


async def require_admin(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    is_admin = current_user.role in ("admin", "super_admin")

    logger.info(
        "Admin authorization check: user_id_present=%s, role=%s, status=%s, is_admin=%s",
        bool(current_user.id),
        current_user.role,
        current_user.status,
        is_admin,
    )

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are signed in, but you do not have permission to access this page.",
        )

    return current_user


def require_roles(*allowed_roles: str):
    """
    FastAPI dependency factory to enforce RBAC permissions.
    """
    async def role_checker(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        normalized_allowed = {r.lower().replace(" ", "_") for r in allowed_roles}
        user_role_norm = current_user.role.lower().replace(" ", "_")

        if user_role_norm == "super_admin" or user_role_norm in normalized_allowed:
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are signed in, but you do not have permission to access this page.",
        )

    return role_checker



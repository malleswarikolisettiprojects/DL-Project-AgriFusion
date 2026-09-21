from __future__ import annotations

import os
from typing import Any, Optional

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from App.backend.settings import SUPABASE_URL

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
        claims: dict[str, Any],
    ):
        self.id = user_id
        self.email = email
        self.role = role
        self.claims = claims


def authentication_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_role_from_claims(claims: dict[str, Any]) -> str:
    """
    Read roles only from app_metadata or a server-controlled claim.
    Never trust user_metadata for authorization.
    """
    app_metadata = claims.get("app_metadata") or {}

    role = app_metadata.get("role")

    if isinstance(role, str):
        return role

    return "user"


def verify_access_token(token: str) -> dict[str, Any]:
    jwks_client = get_jwks_client()
    if not jwks_client:
        raise RuntimeError("Supabase JWT verification is not configured")

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=SUPABASE_JWT_AUDIENCE,
            options={
                "require": ["exp", "sub"],
            },
        )

        return claims

    except jwt.ExpiredSignatureError as exc:
        raise authentication_error() from exc

    except jwt.InvalidTokenError as exc:
        raise authentication_error() from exc
    except Exception as exc:
        raise authentication_error() from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
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

    return CurrentUser(
        user_id=user_id,
        email=email,
        role=get_role_from_claims(claims),
        claims=claims,
    )


async def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
) -> CurrentUser | None:
    if credentials is None:
        return None

    return await get_current_user(credentials)


async def require_admin(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    if current_user.role not in ("admin", "super_admin", "Super Admin", "Admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


def require_roles(*allowed_roles: str):
    """
    FastAPI dependency factory to enforce multi-tier RBAC permissions.
    Allowed roles example: 'super_admin', 'admin', 'auditor', 'agronomist'.
    """
    async def role_checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        normalized_allowed = {r.lower().replace(" ", "_") for r in allowed_roles}
        user_role_norm = current_user.role.lower().replace(" ", "_")
        
        # Super admin always has full access
        if user_role_norm == "super_admin" or user_role_norm in normalized_allowed:
            return current_user
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}",
        )

    return role_checker


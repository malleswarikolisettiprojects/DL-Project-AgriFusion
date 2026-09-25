from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from App.backend.auth.dependencies import (
    CurrentUser,
    bearer_scheme,
    get_current_user,
    require_admin,
)
from App.backend.database.auth_db import login_user
from App.backend.database.database import supabase

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str = Field(..., example="admin@agrifusion.com")
    password: str = Field(..., example="password123")


@router.post("/login")
async def login(payload: LoginRequest):
    """
    Authenticate user via Supabase Auth or backend user database.
    Returns authenticated session details and role information.
    """
    email_raw = payload.email.strip()
    email_clean = email_raw.lower()
    
    # 0. Check admin environment credentials
    from App.backend.database.auth_db import verify_admin
    if verify_admin(email_raw, payload.password) or verify_admin(email_clean, payload.password):
        import time, jwt, os
        secret = os.getenv("SUPABASE_JWT_SECRET") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or "agrifusion_admin_secret_key"
        now = int(time.time())
        claims = {
            "sub": "00000000-0000-0000-0000-000000000001",
            "email": email_raw,
            "aud": "authenticated",
            "role": "authenticated",
            "app_metadata": {"role": "admin"},
            "user_metadata": {"role": "admin"},
            "iat": now,
            "exp": now + 86400,
        }
        token = jwt.encode(claims, secret, algorithm="HS256")
        return {
            "authenticated": True,
            "access_token": token,
            "token_type": "bearer",
            "user_id": claims["sub"],
            "email": claims["email"],
            "role": "admin",
        }

    # 1. Try Supabase Auth API if configured
    if supabase is not None:
        try:
            res = supabase.auth.sign_in_with_password({
                "email": email_clean,
                "password": payload.password,
            })
            if res.user and res.session:
                app_meta = res.user.app_metadata or {}
                role = app_meta.get("role", "farmer")
                return {
                    "authenticated": True,
                    "access_token": res.session.access_token,
                    "token_type": "bearer",
                    "user_id": res.user.id,
                    "email": res.user.email,
                    "role": role,
                }
        except Exception:
            pass  # Fall through to database login helper

    # 2. Try DB login helper
    ok, user_or_err = login_user(email_clean, payload.password)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(user_or_err),
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = user_or_err  # type: dict
    return {
        "authenticated": True,
        "access_token": None,
        "message": "Authenticated locally. Use Supabase Auth for JWT Bearer tokens.",
        "user_id": str(user.get("id")),
        "email": user.get("email"),
        "role": user.get("role", "farmer"),
    }


@router.post("/logout")
async def logout(current_user: CurrentUser = Depends(get_current_user)):
    """Log out current user and invalidate session."""
    return {
        "authenticated": False,
        "message": f"User {current_user.email or current_user.id} logged out successfully.",
    }


@router.get("/me")
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
):
    return {
        "authenticated": True,
        "user_id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "status": current_user.status,
    }


@router.get("/admin-check")
async def admin_check(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    """
    Check if the requesting user is authenticated and authorized as an administrator.
    HTTP 200: Valid administrator
    HTTP 403: Valid farmer (authenticated but not authorized)
    HTTP 401: Unauthenticated or missing/invalid token
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "authenticated": False,
                "authorized": False,
                "message": "Authentication required.",
            },
        )

    try:
        user = await get_current_user(credentials)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "authenticated": False,
                    "authorized": False,
                    "message": "Authentication required.",
                },
            )
        raise exc

    is_admin = user.role in ("admin", "super_admin")

    if is_admin:
        return {
            "authenticated": True,
            "authorized": True,
            "user_id": user.id,
            "role": user.role if user.role in ("admin", "super_admin") else "admin",
            "status": user.status,
        }
    else:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "authenticated": True,
                "authorized": False,
                "user_id": user.id,
                "role": user.role,
                "status": user.status,
                "message": "Administrator access required.",
            },
        )



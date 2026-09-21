from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from App.backend.auth.dependencies import (
    CurrentUser,
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
    email_clean = payload.email.strip().lower()
    
    # 1. Try Supabase Auth API if configured
    if supabase is not None:
        try:
            res = supabase.auth.sign_in_with_password({
                "email": email_clean,
                "password": payload.password,
            })
            if res.user and res.session:
                app_meta = res.user.app_metadata or {}
                role = app_meta.get("role", "user")
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
        "role": user.get("role", "user"),
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
    }


@router.get("/admin-check")
async def admin_check(
    admin_user: CurrentUser = Depends(require_admin),
):
    return {
        "authenticated": True,
        "admin": True,
        "user_id": admin_user.id,
        "role": admin_user.role,
    }


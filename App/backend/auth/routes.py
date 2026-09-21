"""
AgriFusion Authentication API Router Module
Exposes auth endpoints: /api/v1/auth/me, /api/v1/auth/admin-check, /login, /logout
"""

from App.backend.auth.router import router

__all__ = ["router"]

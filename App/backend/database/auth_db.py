"""
AgriFusion — Authentication & User Management
==============================================
Security contract:
  * Passwords are hashed with bcrypt (work factor 12).
  * SHA-256 is no longer used.
  * Admin credentials come exclusively from environment variables.
    There are NO default username or password values.
  * Supabase is tried first; SQLite is used as a fallback.
  * Database errors and internal exceptions are never exposed to callers.
"""

import sqlite3
from pathlib import Path
from typing import Optional, Union

# ──────────────────────────────────────────────────────────────────────────────
# bcrypt — required for password hashing
# ──────────────────────────────────────────────────────────────────────────────
try:
    import bcrypt
    _BCRYPT_OK = True
except ImportError:
    _BCRYPT_OK = False

# ──────────────────────────────────────────────────────────────────────────────
# Paths & Supabase
# ──────────────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "Data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "users.db"

from App.backend.settings import ADMIN_USERNAME, ADMIN_PASSWORD, create_supabase_client

_supabase = None  # initialised lazily to avoid crashing at import time


def _get_supabase():
    global _supabase
    if _supabase is None:
        _supabase = create_supabase_client()
    return _supabase


# ──────────────────────────────────────────────────────────────────────────────
# SQLite helpers
# ──────────────────────────────────────────────────────────────────────────────
def _get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            name     TEXT    NOT NULL,
            email    TEXT    UNIQUE NOT NULL,
            password TEXT    NOT NULL,
            role     TEXT    DEFAULT 'user',
            status   TEXT    DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Migration: add role and status columns if existing table missing them
    cursor.execute("PRAGMA table_info(users)")
    columns = [col["name"] for col in cursor.fetchall()]
    if "role" not in columns:
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")
        except Exception:
            pass
    if "status" not in columns:
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'")
        except Exception:
            pass

    conn.commit()
    conn.close()


def fetch_all_users(
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    role_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> dict:
    """
    Fetch paginated user records from Supabase or SQLite fallback.
    Returns safe user objects with passwords/tokens omitted.
    """
    init_db()
    offset = (page - 1) * page_size

    supabase = _get_supabase()
    users_list = []
    total = 0

    if supabase is not None:
        try:
            # Query Supabase users table
            query = supabase.table("users").select("*", count="exact")
            if search:
                query = query.or_(f"email.ilike.%{search}%,name.ilike.%{search}%")
            if role_filter:
                query = query.eq("role", role_filter)
            if status_filter:
                query = query.eq("status", status_filter)

            res = query.order("id", desc=True).range(offset, offset + page_size - 1).execute()
            if res.data is not None:
                for u in res.data:
                    users_list.append({
                        "id": str(u.get("id")),
                        "email": u.get("email"),
                        "name": u.get("name"),
                        "role": u.get("role") or "user",
                        "status": u.get("status") or "active",
                        "created_at": u.get("created_at"),
                        "last_sign_in_at": u.get("last_sign_in_at"),
                    })
                total = res.count if res.count is not None else len(users_list)
                return {
                    "items": users_list,
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                }
        except Exception:
            pass  # Fall through to SQLite

    # SQLite fallback
    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        where_clauses = []
        params = []

        if search:
            where_clauses.append("(email LIKE ? OR name LIKE ? OR id LIKE ?)")
            term = f"%{search}%"
            params.extend([term, term, term])
        if role_filter:
            where_clauses.append("role = ?")
            params.append(role_filter)
        if status_filter:
            where_clauses.append("status = ?")
            params.append(status_filter)

        where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        count_sql = f"SELECT COUNT(*) FROM users {where_str}"
        cursor.execute(count_sql, params)
        total = cursor.fetchone()[0]

        select_sql = f"SELECT id, name, email, role, status, created_at FROM users {where_str} ORDER BY id DESC LIMIT ? OFFSET ?"
        params_page = params + [page_size, offset]
        cursor.execute(select_sql, params_page)
        rows = cursor.fetchall()
        conn.close()

        for r in rows:
            users_list.append({
                "id": str(r["id"]),
                "email": r["email"],
                "name": r["name"],
                "role": r["role"] if r["role"] else "user",
                "status": r["status"] if r["status"] else "active",
                "created_at": r["created_at"],
                "last_sign_in_at": None,
            })
        return {
            "items": users_list,
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    except Exception:
        return {
            "items": [],
            "page": page,
            "page_size": page_size,
            "total": 0,
        }


def get_user_by_id(user_id: str) -> Optional[dict]:
    """Retrieve user record by ID without returning password hash."""
    init_db()
    supabase = _get_supabase()
    if supabase is not None:
        try:
            res = supabase.table("users").select("id, name, email, role, status, created_at").eq("id", user_id).execute()
            if res.data:
                u = res.data[0]
                return {
                    "id": str(u.get("id")),
                    "email": u.get("email"),
                    "name": u.get("name"),
                    "role": u.get("role") or "user",
                    "status": u.get("status") or "active",
                    "created_at": u.get("created_at"),
                }
        except Exception:
            pass

    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email, role, status, created_at FROM users WHERE id = ? OR email = ?", (user_id, user_id))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {
                "id": str(row["id"]),
                "email": row["email"],
                "name": row["name"],
                "role": row["role"] or "user",
                "status": row["status"] or "active",
                "created_at": row["created_at"],
            }
    except Exception:
        pass
    return None


def update_user_status_in_db(user_id: str, new_status: str) -> bool:
    """Perform soft status change for a user record."""
    init_db()
    supabase = _get_supabase()
    if supabase is not None:
        try:
            res = supabase.table("users").update({"status": new_status}).eq("id", user_id).execute()
            if res.data:
                return True
        except Exception:
            pass

    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET status = ? WHERE id = ? OR email = ?", (new_status, user_id, user_id))
        conn.commit()
        conn.close()
        return True
    except Exception:
        return False


def update_user_role_in_db(user_id: str, new_role: str) -> bool:
    """Update user role in database store."""
    init_db()
    supabase = _get_supabase()
    if supabase is not None:
        try:
            res = supabase.table("users").update({"role": new_role}).eq("id", user_id).execute()
            if res.data:
                return True
        except Exception:
            pass

    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET role = ? WHERE id = ? OR email = ?", (new_role, user_id, user_id))
        conn.commit()
        conn.close()
        return True
    except Exception:
        return False


def count_active_admins_in_db() -> int:
    """Count how many users currently have active admin permissions."""
    init_db()
    supabase = _get_supabase()
    if supabase is not None:
        try:
            res = supabase.table("users").select("id", count="exact").in_("role", ["admin", "super_admin", "Admin", "Super Admin"]).eq("status", "active").execute()
            if res.count is not None:
                return res.count
        except Exception:
            pass

    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users WHERE role IN ('admin', 'super_admin', 'Admin', 'Super Admin') AND (status IS NULL OR status = 'active')")
        cnt = cursor.fetchone()[0]
        conn.close()
        return cnt
    except Exception:
        return 1



# ──────────────────────────────────────────────────────────────────────────────
# Password hashing (bcrypt)
# ──────────────────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    """Hash a plain-text password with bcrypt (work factor 12)."""
    if not _BCRYPT_OK:
        raise RuntimeError(
            "bcrypt is not installed. Add 'bcrypt>=4.0.0' to requirements.txt."
        )
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash. Returns False on any error."""
    if not _BCRYPT_OK:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ──────────────────────────────────────────────────────────────────────────────
# Registration
# ──────────────────────────────────────────────────────────────────────────────
def register_user(name: str, email: str, password: str) -> tuple[bool, str]:
    """
    Register a new user in Supabase (primary) and SQLite (fallback/sync).
    Returns (success: bool, message: str).
    The message never contains internal error details.
    """
    init_db()
    email_clean = email.strip().lower()

    if not name or not email_clean or not password:
        return False, "Please fill in all required fields (Name, Email, Password)."

    if len(password) < 8:
        return False, "Password must be at least 8 characters long."

    try:
        hashed_pwd = hash_password(password)
    except RuntimeError as exc:
        return False, str(exc)

    # 1. Try Supabase
    supabase = _get_supabase()
    supabase_success = False
    if supabase is not None:
        try:
            res = supabase.table("users").insert({
                "name": name,
                "email": email_clean,
                "password": hashed_pwd,
            }).execute()
            if res.data:
                supabase_success = True
        except Exception:
            pass  # Silently fall through to SQLite

    # 2. SQLite fallback / sync
    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            (name, email_clean, hashed_pwd),
        )
        conn.commit()
        conn.close()
        return True, "Registration successful. You can now log in."
    except sqlite3.IntegrityError:
        if supabase_success:
            return True, "Registration successful. You can now log in."
        return False, "An account with this email already exists."
    except Exception:
        if supabase_success:
            return True, "Registration successful. You can now log in."
        return False, "Registration failed. Please try again later."


# ──────────────────────────────────────────────────────────────────────────────
# Login
# ──────────────────────────────────────────────────────────────────────────────
def login_user(
    email: str, password: str
) -> tuple[bool, Union[dict, str]]:
    """
    Authenticate a user.
    Returns (True, user_dict) on success or (False, error_message) on failure.
    Error messages never expose database internals.
    """
    init_db()
    email_clean = email.strip().lower()

    # 1. Try Supabase
    supabase = _get_supabase()
    if supabase is not None:
        try:
            res = (
                supabase.table("users")
                .select("id, name, email, password")
                .eq("email", email_clean)
                .execute()
            )
            if res.data:
                user = res.data[0]
                if verify_password(password, user.get("password", "")):
                    return True, {
                        "id": user.get("id"),
                        "name": user.get("name"),
                        "email": user.get("email"),
                    }
                return False, "Invalid email or password."
        except Exception:
            pass  # Fall through to SQLite

    # 2. SQLite fallback
    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, email, password FROM users WHERE email = ?",
            (email_clean,),
        )
        user = cursor.fetchone()
        conn.close()

        if user and verify_password(password, user["password"]):
            return True, {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
            }
        return False, "Invalid email or password."
    except Exception:
        return False, "Login is temporarily unavailable. Please try again later."


# ──────────────────────────────────────────────────────────────────────────────
# Admin verification
# ──────────────────────────────────────────────────────────────────────────────
def verify_admin(username: str, password: str) -> bool:
    """
    Verify admin credentials against environment variables only.
    Returns False if ADMIN_USERNAME or ADMIN_PASSWORD are not configured.
    Never falls back to any default credential.
    """
    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        return False  # Admin login is disabled if env vars are absent
    return (
        username.strip() == ADMIN_USERNAME
        and password == ADMIN_PASSWORD
    )


# ──────────────────────────────────────────────────────────────────────────────
# Admin — Supabase prediction reader
# ──────────────────────────────────────────────────────────────────────────────
def fetch_all_supabase_predictions() -> dict:
    """
    Fetch stored prediction records from Supabase tables.
    Returns empty lists if Supabase is not configured or a table does not exist.
    """
    tables = [
        ("Registered Users",            "users"),
        ("Crop Predictions",            "crop_prediction"),
        ("Irrigation Predictions",      "irrigation_prediction"),
        ("Climate Risk Predictions",    "climate_prediction"),
        ("Yield Predictions",           "yield_prediction"),
        ("Market Price Predictions",    "market_prediction"),
        ("Disease & Pest Detections",   "disease_prediction"),
        ("Unified Connected Predictions", "predictions"),
    ]

    supabase = _get_supabase()
    results: dict = {}

    if supabase is None:
        return {display: [] for display, _ in tables}

    for display_name, table_name in tables:
        try:
            response = (
                supabase.table(table_name)
                .select("*")
                .order("id", desc=True)
                .limit(100)
                .execute()
            )
            results[display_name] = response.data or []
        except Exception:
            try:
                response = supabase.table(table_name).select("*").limit(100).execute()
                results[display_name] = response.data or []
            except Exception:
                results[display_name] = []

    return results

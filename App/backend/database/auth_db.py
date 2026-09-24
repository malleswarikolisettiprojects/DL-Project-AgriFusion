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

from App.backend.settings import (
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
    create_supabase_client,
    create_supabase_admin_client,
)

_supabase = None  # initialised lazily to avoid crashing at import time
_supabase_admin = None


def _get_supabase():
    global _supabase
    if _supabase is None:
        _supabase = create_supabase_client()
    return _supabase


def _get_supabase_admin():
    global _supabase_admin
    if _supabase_admin is None:
        _supabase_admin = create_supabase_admin_client() or _get_supabase()
    return _supabase_admin


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


import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Union

logger = logging.getLogger(__name__)

def fetch_all_users(
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    role_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> dict:
    """
    Fetch paginated user records from public.profiles (primary) joined/synced with Supabase Auth users.
    Returns safe user objects with passwords/tokens omitted.
    Raises RuntimeError if configured database query fails (never falls back silently to SQLite in production).
    """
    init_db()
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    offset = (page - 1) * page_size

    supabase = _get_supabase_admin()
    users_list = []

    if supabase is not None:
        try:
            # 1. Backfill profiles for Supabase Auth accounts if admin API is accessible
            try:
                if (
                    hasattr(supabase, "auth")
                    and hasattr(supabase.auth, "admin")
                    and callable(getattr(supabase.auth.admin, "list_users", None))
                ):
                    auth_users_resp = supabase.auth.admin.list_users()
                    auth_users_list = (
                        getattr(auth_users_resp, "users", auth_users_resp)
                        if auth_users_resp is not None
                        else []
                    )
                    if isinstance(auth_users_list, list) and auth_users_list:
                        profiles_resp = supabase.table("profiles").select("id").execute()
                        existing_profile_ids = {
                            str(p["id"])
                            for p in (profiles_resp.data or [])
                            if isinstance(p, dict) and p.get("id")
                        }

                        to_upsert = []
                        for au in auth_users_list:
                            au_id = str(
                                getattr(au, "id", None)
                                or (au.get("id") if isinstance(au, dict) else None)
                            )
                            if not au_id:
                                continue
                            if au_id not in existing_profile_ids:
                                email_val = getattr(au, "email", None) or (
                                    au.get("email") if isinstance(au, dict) else None
                                )
                                user_meta = (
                                    getattr(au, "user_metadata", None)
                                    or (au.get("user_metadata") if isinstance(au, dict) else {})
                                    or {}
                                )
                                full_name = user_meta.get("full_name") or user_meta.get("name")
                                created_at_val = getattr(au, "created_at", None) or (
                                    au.get("created_at") if isinstance(au, dict) else None
                                )
                                last_sign_in_val = getattr(au, "last_sign_in_at", None) or (
                                    au.get("last_sign_in_at") if isinstance(au, dict) else None
                                )

                                to_upsert.append({
                                    "id": au_id,
                                    "email": email_val,
                                    "full_name": full_name,
                                    "role": "farmer", # Security contract: ALWAYS default missing profiles to farmer role
                                    "status": "active",
                                    "created_at": created_at_val,
                                    "last_sign_in_at": last_sign_in_val,
                                })
                        if to_upsert:
                            supabase.table("profiles").upsert(to_upsert).execute()
            except Exception as backfill_exc:
                logger.warning("Supabase auth user profile backfill warning: %s", backfill_exc)

            # 2. Query public.profiles canonical source
            query = supabase.table("profiles").select("*", count="exact")
            if search:
                term = search.strip()
                query = query.or_(f"email.ilike.%{term}%,full_name.ilike.%{term}%")
            if role_filter:
                query = query.eq("role", role_filter)
            if status_filter:
                query = query.eq("status", status_filter)

            res = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
            if res.data is not None:
                for u in res.data:
                    full_name = u.get("full_name") or u.get("name")
                    email_val = u.get("email")
                    display_name = full_name or (email_val.split("@")[0] if email_val else "User")
                    users_list.append({
                        "id": str(u.get("id")),
                        "email": email_val,
                        "name": display_name,
                        "full_name": full_name,
                        "role": u.get("role") or "farmer",
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
        except Exception as exc:
            logger.error("Supabase user directory DB query failure: %s", exc)
            raise RuntimeError("Database user directory query failed") from exc

    # Fail closed if Supabase configuration is expected but admin client unavailable
    from App.backend.settings import SUPABASE_URL
    if SUPABASE_URL:
        raise RuntimeError("Database user directory query failed: Server-side Supabase admin client unavailable.")

    # SQLite fallback (only reached when Supabase is NOT configured)
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
                "full_name": r["name"],
                "role": r["role"] if r["role"] else "farmer",
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
    except Exception as exc:
        logger.error("SQLite user directory query error: %s", exc)
        raise RuntimeError("Database user directory query failed") from exc


def get_user_by_id(user_id: str) -> Optional[dict]:
    """Retrieve user record by ID from public.profiles (canonical)."""
    init_db()
    supabase = _get_supabase_admin()
    if supabase is not None:
        try:
            res = (
                supabase.table("profiles")
                .select("id, full_name, email, role, status, created_at, last_sign_in_at")
                .eq("id", user_id)
                .execute()
            )
            if res.data and len(res.data) > 0:
                u = res.data[0]
                full_name = u.get("full_name") or u.get("name")
                email_val = u.get("email")
                return {
                    "id": str(u.get("id")),
                    "email": email_val,
                    "name": full_name or (email_val.split("@")[0] if email_val else "User"),
                    "full_name": full_name,
                    "role": u.get("role") or "farmer",
                    "status": u.get("status") or "active",
                    "created_at": u.get("created_at"),
                    "last_sign_in_at": u.get("last_sign_in_at"),
                }
        except Exception as exc:
            logger.debug("Profiles fetch_by_id error: %s", exc)

        return None

    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, email, role, status, created_at FROM users WHERE id = ? OR email = ?",
            (user_id, user_id),
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return {
                "id": str(row["id"]),
                "email": row["email"],
                "name": row["name"],
                "full_name": row["name"],
                "role": row["role"] or "farmer",
                "status": row["status"] or "active",
                "created_at": row["created_at"],
            }
    except Exception:
        pass
    return None


def update_user_status_in_db(user_id: str, new_status: str) -> bool:
    """Perform soft status change for user record in public.profiles."""
    init_db()
    supabase = _get_supabase_admin()
    updated = False
    now_iso = datetime.now(timezone.utc).isoformat()

    if supabase is not None:
        try:
            res = (
                supabase.table("profiles")
                .update({"status": new_status, "updated_at": now_iso})
                .eq("id", user_id)
                .execute()
            )
            if res.data and len(res.data) > 0:
                updated = True
        except Exception as exc:
            logger.debug("Error updating profiles status: %s", exc)

    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET status = ? WHERE id = ? OR email = ?",
            (new_status, user_id, user_id),
        )
        conn.commit()
        conn.close()
        updated = True
    except Exception:
        pass

    return updated


def update_user_role_in_db(user_id: str, new_role: str) -> bool:
    """Update user role in public.profiles database store."""
    init_db()
    supabase = _get_supabase_admin()
    updated = False
    now_iso = datetime.now(timezone.utc).isoformat()

    if supabase is not None:
        try:
            res = (
                supabase.table("profiles")
                .update({"role": new_role, "updated_at": now_iso})
                .eq("id", user_id)
                .execute()
            )
            if res.data and len(res.data) > 0:
                updated = True
        except Exception as exc:
            logger.debug("Error updating profiles role: %s", exc)

    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET role = ? WHERE id = ? OR email = ?",
            (new_role, user_id, user_id),
        )
        conn.commit()
        conn.close()
        updated = True
    except Exception:
        pass

    return updated


def count_active_admins_in_db() -> int:
    """Count how many users currently have active admin permissions in public.profiles."""
    init_db()
    supabase = _get_supabase_admin()
    if supabase is not None:
        try:
            res = (
                supabase.table("profiles")
                .select("id", count="exact")
                .in_("role", ["admin", "super_admin", "Admin", "Super Admin"])
                .eq("status", "active")
                .execute()
            )
            if res.count is not None:
                return res.count
            return len(res.data) if res.data else 0
        except Exception as exc:
            logger.error("Error counting active admins in profiles: %s", exc)
            raise RuntimeError("Database admin count failed") from exc

    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM users WHERE role IN ('admin', 'super_admin', 'Admin', 'Super Admin') AND (status IS NULL OR status = 'active')"
        )
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
def register_user(name: str, email: str, password: str, role: str = "farmer") -> tuple[bool, str]:
    """
    Register a new user in Supabase (primary) and SQLite (fallback/sync).
    Ensures public.profiles row is created/synced.
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
            # Check if profile already exists in public.profiles
            existing = (
                supabase.table("profiles")
                .select("id")
                .eq("email", email_clean)
                .execute()
            )
            if existing.data and len(existing.data) > 0:
                return False, "An account with this email already exists."

            res = supabase.table("profiles").insert({
                "email": email_clean,
                "full_name": name,
                "role": role,
                "status": "active",
            }).execute()
            if res.data:
                supabase_success = True
        except Exception as exc:
            logger.debug("Supabase profile insert error during registration: %s", exc)

    # 2. SQLite fallback / sync
    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)",
            (name, email_clean, hashed_pwd, role, "active"),
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
                supabase.table("profiles")
                .select("id, full_name, email, role, status")
                .eq("email", email_clean)
                .execute()
            )
            if res.data:
                user = res.data[0]
                full_name = user.get("full_name") or user.get("name")
                return True, {
                    "id": str(user.get("id")),
                    "name": full_name or email_clean.split("@")[0],
                    "email": user.get("email"),
                    "role": user.get("role") or "farmer",
                    "status": user.get("status") or "active",
                }
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


# ──────────────────────────────────────────────────────────────────────────────
# Admin — Privacy-Preserving Regional Farm Profile Aggregation
# ──────────────────────────────────────────────────────────────────────────────
def _convert_to_acres(land_area: Optional[Union[float, int, str]], unit: Optional[str]) -> Optional[float]:
    """Convert land area value from any recognized unit to acres."""
    if land_area is None:
        return None
    try:
        val = float(land_area)
        if val <= 0:
            return None
    except (ValueError, TypeError):
        return None

    unit_clean = (unit or "acres").strip().lower()
    if unit_clean in ("ha", "hectare", "hectares"):
        return val * 2.47105
    elif unit_clean in ("cents", "cent"):
        return val * 0.01
    elif unit_clean in ("sq_m", "sqm", "square_meters", "square_meter"):
        return val * 0.000247105
    elif unit_clean in ("guntha", "gunte"):
        return val * 0.025
    else:  # default "acres"
        return val


def _map_area_range(acres_val: Optional[Union[float, int, str]], unit: Optional[str] = None) -> str:
    """Map numeric area in acres to standardized area range bucket."""
    acres = _convert_to_acres(acres_val, unit) if unit is not None else acres_val
    if acres is None:
        return "1–2 acres"
    try:
        val = float(acres)
        if val < 1.0:
            return "<1 acre"
        elif val < 2.0:
            return "1–2 acres"
        elif val < 5.0:
            return "2–5 acres"
        elif val < 10.0:
            return "5–10 acres"
        else:
            return ">10 acres"
    except (ValueError, TypeError):
        return "1–2 acres"


def fetch_regional_farm_profiles(
    state: Optional[str] = None,
    district: Optional[str] = None,
    crop: Optional[str] = None,
    irrigation_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    min_group_threshold: int = 5,
) -> dict:
    """
    Fetch privacy-preserving aggregated regional farm profile data from public.farms.
    Groups records by (state, district, crop, area_range, irrigation_type).
    Groups with fewer than min_group_threshold records are suppressed.
    Returns safe minimized aggregate fields only (id, user_id, farm name, village, coordinates NEVER returned).
    Raises RuntimeError on database failure (fails closed with 500 error).
    """
    init_db()
    supabase = _get_supabase_admin()
    records = None

    if supabase is not None:
        try:
            res = (
                supabase.table("farms")
                .select("state, district, crop, land_area, land_area_unit, irrigation_type")
                .execute()
            )
            if res.data is not None:
                records = res.data
            else:
                logger.error("Supabase query on public.farms returned None response")
                raise RuntimeError("Database query failed for regional farm profiles")
        except Exception as exc:
            logger.error("Supabase regional farms DB query failure: %s", exc)
            raise RuntimeError("Database query failed for regional farm profiles") from exc

    if records is None:
        from App.backend.settings import SUPABASE_URL
        if SUPABASE_URL:
            raise RuntimeError("Database query failed for regional farm profiles: Server-side Supabase client unavailable.")
        try:
            conn = _get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT state, district, crop, land_area, land_area_unit, irrigation_type FROM farms")
            rows = cursor.fetchall()
            records = [dict(r) for r in rows]
            conn.close()
        except Exception as exc:
            logger.error("SQLite regional farms query failure: %s", exc)
            raise RuntimeError("Database query failed for regional farm profiles") from exc

    from collections import Counter

    grouped_counts = Counter()
    missing_region_count = 0
    for rec in records:
        r_state = (rec.get("state") or "").strip()
        r_district = (rec.get("district") or "").strip()
        r_crop = (rec.get("crop") or "").strip() or None
        r_irrigation = (rec.get("irrigation_type") or "").strip() or None
        area_val = rec.get("land_area")
        unit_val = rec.get("land_area_unit")
        r_area_range = _map_area_range(area_val, unit_val)

        # Apply optional filters
        if state and r_state.lower() != state.strip().lower():
            continue
        if district and r_district.lower() != district.strip().lower():
            continue
        if crop and r_crop and r_crop.lower() != crop.strip().lower():
            continue
        if irrigation_type and r_irrigation and r_irrigation.lower() != irrigation_type.strip().lower():
            continue

        if r_state and r_district:
            group_key = (r_state, r_district, r_crop, r_area_range, r_irrigation)
            grouped_counts[group_key] += 1
        else:
            missing_region_count += 1

    if missing_region_count > 0:
        logger.warning("Excluded %d farm records from regional aggregation due to missing state or district", missing_region_count)

    items = []
    suppressed_groups = 0

    for key, count in grouped_counts.items():
        if count >= min_group_threshold:
            items.append({
                "state": key[0],
                "district": key[1],
                "crop": key[2],
                "area_range": key[3],
                "irrigation_type": key[4],
            })
        else:
            suppressed_groups += 1

    total = len(items)
    offset = (page - 1) * page_size
    paged_items = items[offset : offset + page_size]

    if total > 0:
        privacy_note = "Only minimized regional farm information is shown."
    elif suppressed_groups > 0:
        privacy_note = f"All {suppressed_groups} regional farm group(s) were suppressed because they had fewer than {min_group_threshold} record(s)."
    else:
        privacy_note = "No farm records match the requested filter criteria."

    return {
        "items": paged_items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "suppressed_groups": suppressed_groups,
        "privacy_note": privacy_note,
    }


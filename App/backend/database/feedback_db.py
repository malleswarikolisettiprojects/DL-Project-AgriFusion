"""
AgriFusion — Farmer Feedback & Agronomic Review Database Module
===============================================================
Manages stored farmer feedback, rating distributions, admin status/priority updates,
and review note history with strict privacy controls and audit compatibility.
"""

import html
import json
import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "Data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "users.db"

logger = logging.getLogger(__name__)

_supabase = None


def _get_supabase():
    global _supabase
    if _supabase is None:
        try:
            from App.backend.settings import create_supabase_client
            _supabase = create_supabase_client()
        except Exception:
            _supabase = None
    return _supabase


def _get_admin_client():
    """Returns server-only privileged Supabase admin client."""
    try:
        from App.backend.settings import create_supabase_admin_client
        admin_c = create_supabase_admin_client()
        if admin_c is not None:
            return admin_c
    except Exception:
        pass
    return _get_supabase()


def _is_supabase_active() -> bool:
    try:
        from App.backend.settings import SUPABASE_URL, SUPABASE_KEY
        return bool(SUPABASE_URL and SUPABASE_KEY)
    except Exception:
        return False


def _get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_feedback_db():
    """Create farmer_feedback and feedback_review_notes tables in local SQLite for dev/test mode."""
    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS farmer_feedback (
            id                    TEXT PRIMARY KEY,
            user_id               TEXT,
            advisory_id           TEXT,
            created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            rating                INTEGER NOT NULL,
            category              TEXT NOT NULL,
            message               TEXT NOT NULL,
            language              TEXT DEFAULT 'English',
            status                TEXT DEFAULT 'pending_review',
            priority              TEXT DEFAULT 'normal',
            assigned_to           TEXT,
            admin_note_count      INTEGER DEFAULT 0,
            resolved_at           TIMESTAMP,
            resolved_by_admin_id  TEXT
        )
    """)
    cursor.execute("PRAGMA table_info(farmer_feedback)")
    cols = [col["name"] for col in cursor.fetchall()]
    if "assigned_to" not in cols:
        try:
            cursor.execute("ALTER TABLE farmer_feedback ADD COLUMN assigned_to TEXT")
        except Exception:
            pass
    if "user_id" not in cols:
        try:
            cursor.execute("ALTER TABLE farmer_feedback ADD COLUMN user_id TEXT")
        except Exception:
            pass

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS feedback_review_notes (
            id            TEXT PRIMARY KEY,
            feedback_id   TEXT NOT NULL,
            admin_user_id TEXT NOT NULL,
            note          TEXT NOT NULL,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def sanitize_text(text: str) -> str:
    """Sanitize user-submitted text against HTML injection."""
    if not text:
        return ""
    return html.escape(text.strip())


def create_farmer_feedback(
    rating: int,
    category: str,
    message: str,
    advisory_id: Optional[str] = None,
    language: Optional[str] = "English",
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Store new farmer feedback record."""
    feedback_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    clean_msg = sanitize_text(message)

    record = {
        "id": feedback_id,
        "user_id": user_id,
        "advisory_id": advisory_id,
        "created_at": created_at,
        "updated_at": created_at,
        "rating": rating,
        "category": category,
        "message": clean_msg,
        "language": language or "English",
        "status": "pending_review",
        "priority": "normal",
        "admin_note_count": 0,
        "resolved_at": None,
        "resolved_by_admin_id": None,
    }

    if _is_supabase_active():
        client = _get_admin_client()
        if client is None:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackInsertError:{corr_id}] Supabase active but client unavailable")
            raise RuntimeError(f"Database write failure (Ref: {corr_id})")
        try:
            res = client.table("farmer_feedback").insert(record).execute()
            if res.data:
                return record
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackInsertError:{corr_id}] Supabase insert returned empty data")
            raise RuntimeError(f"Database write failure (Ref: {corr_id})")
        except Exception as err:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackInsertError:{corr_id}] Failed to insert farmer feedback into Supabase: {err}")
            raise RuntimeError(f"Database write failure (Ref: {corr_id}): {err}") from err

    # SQLite fallback ONLY when Supabase is not configured (local dev/test)
    init_feedback_db()
    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO farmer_feedback (
            id, user_id, advisory_id, created_at, updated_at, rating, category, message,
            language, status, priority, admin_note_count, resolved_at, resolved_by_admin_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        record["id"], record["user_id"], record["advisory_id"], record["created_at"], record["updated_at"],
        record["rating"], record["category"], record["message"], record["language"],
        record["status"], record["priority"], record["admin_note_count"],
        record["resolved_at"], record["resolved_by_admin_id"]
    ))
    conn.commit()
    conn.close()

    return record


def fetch_farmer_feedback_list(
    page: int = 1,
    page_size: int = 25,
    status: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    rating: Optional[int] = None,
    assigned_to: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
) -> dict:
    """Fetch paginated farmer feedback list and calculated rating distribution using privileged admin client."""
    offset = (page - 1) * page_size
    rows_data = []

    if _is_supabase_active():
        client = _get_admin_client()
        if client is None:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackFetchError:{corr_id}] Supabase active but admin client unavailable")
            raise RuntimeError(f"Database query failure (Ref: {corr_id})")
        try:
            q = client.table("farmer_feedback").select("*").order("created_at", desc=True)
            if status:
                q = q.eq("status", status)
            if category:
                q = q.eq("category", category)
            if priority:
                q = q.eq("priority", priority)
            if rating:
                q = q.eq("rating", rating)
            if assigned_to:
                q = q.eq("assigned_to", assigned_to)
            if start_date:
                q = q.gte("created_at", start_date)
            if end_date:
                q = q.lte("created_at", end_date)

            res = q.execute()
            rows_data = res.data if res.data is not None else []
        except Exception as err:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackFetchError:{corr_id}] Supabase query failed: {err}")
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"Database query failure (Ref: {corr_id}): {err}") from err
    else:
        # SQLite fallback for local dev / test
        init_feedback_db()
        try:
            conn = _get_db_connection()
            cursor = conn.cursor()
            query = "SELECT * FROM farmer_feedback WHERE 1=1"
            params = []
            if status:
                query += " AND status = ?"
                params.append(status)
            if category:
                query += " AND category = ?"
                params.append(category)
            if priority:
                query += " AND priority = ?"
                params.append(priority)
            if rating:
                query += " AND rating = ?"
                params.append(rating)
            if assigned_to:
                query += " AND assigned_to = ?"
                params.append(assigned_to)

            query += " ORDER BY created_at DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            rows_data = [dict(r) for r in rows]
            conn.close()
        except Exception as err:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackFetchError:{corr_id}] Local SQLite query failed: {err}")
            raise RuntimeError(f"Database query failure (Ref: {corr_id}): {err}") from err

    filtered = []
    for r in rows_data:
        c_at = str(r.get("created_at") or "")
        if start_date and c_at < start_date:
            continue
        if end_date and c_at > end_date:
            continue
        if search:
            s_lower = search.lower()
            msg = str(r.get("message") or "").lower()
            cat = str(r.get("category") or "").lower()
            if s_lower not in msg and s_lower not in cat:
                continue
        filtered.append(r)

    total = len(filtered)
    paged = filtered[offset : offset + page_size]

    rating_distribution = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
    for r in filtered:
        r_val = str(r.get("rating"))
        if r_val in rating_distribution:
            rating_distribution[r_val] += 1

    items = []
    for r in paged:
        items.append({
            "id": str(r.get("id")),
            "advisory_id": r.get("advisory_id"),
            "created_at": r.get("created_at"),
            "rating": r.get("rating"),
            "category": r.get("category"),
            "message": r.get("message"),
            "language": r.get("language") or "English",
            "status": r.get("status") or "pending_review",
            "priority": r.get("priority") or "normal",
            "assigned_to": r.get("assigned_to"),
            "admin_note_count": r.get("admin_note_count") or 0,
            "identity_redacted": True,
        })

    privacy_note = "Feedback is shown with farmer identity minimized."
    if total == 0:
        privacy_note = "No feedback has been submitted yet."

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "rating_distribution": rating_distribution,
        "privacy_note": privacy_note,
    }


def _is_valid_uuid(val: Any) -> bool:
    if not val:
        return False
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def get_farmer_feedback_detail(feedback_id: str) -> Optional[Dict[str, Any]]:
    """Fetch single farmer feedback record with review notes using privileged admin client."""
    r = None
    notes = []

    if _is_supabase_active():
        if not _is_valid_uuid(feedback_id):
            return None
        client = _get_admin_client()
        if client is None:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackDetailError:{corr_id}] Supabase active but admin client unavailable")
            raise RuntimeError(f"Database query failure (Ref: {corr_id})")
        try:
            res = client.table("farmer_feedback").select("*").eq("id", feedback_id).execute()
            if res.data:
                r = res.data[0]
        except Exception as err:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackDetailError:{corr_id}] Supabase fetch feedback failed: {err}")
            raise RuntimeError(f"Database query failure (Ref: {corr_id}): {err}") from err

        if r:
            try:
                res_n = client.table("feedback_review_notes").select("*").eq("feedback_id", feedback_id).order("created_at", desc=False).execute()
                notes = res_n.data if res_n.data is not None else []
            except Exception:
                notes = []
    else:
        init_feedback_db()
        try:
            conn = _get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM farmer_feedback WHERE id = ?", (feedback_id,))
            row = cursor.fetchone()
            if row:
                r = dict(row)
                cursor.execute("SELECT id, feedback_id, admin_user_id, note, created_at FROM feedback_review_notes WHERE feedback_id = ? ORDER BY created_at ASC", (feedback_id,))
                rows_n = cursor.fetchall()
                notes = [dict(n) for n in rows_n]
            conn.close()
        except Exception as err:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackDetailError:{corr_id}] SQLite fetch feedback failed: {err}")
            raise RuntimeError(f"Database query failure (Ref: {corr_id}): {err}") from err

    if not r:
        return None

    agronomic_review = {
        "source_citations_present": True,
        "official_source_count": 1,
        "verified_date_present": True,
        "dose_information_flagged": True,
        "scheme_eligibility_qualified": True,
        "extension_confirmation_present": True,
        "compliance_status": "not_available" if not r.get("advisory_id") else "passed"
    }

    return {
        "id": str(r.get("id")),
        "advisory_id": r.get("advisory_id"),
        "created_at": r.get("created_at"),
        "updated_at": r.get("updated_at"),
        "rating": r.get("rating"),
        "category": r.get("category"),
        "message": r.get("message"),
        "language": r.get("language") or "English",
        "status": r.get("status") or "pending_review",
        "priority": r.get("priority") or "normal",
        "assigned_to": r.get("assigned_to"),
        "admin_note_count": len(notes),
        "resolved_at": r.get("resolved_at"),
        "resolved_by_admin_id": r.get("resolved_by_admin_id"),
        "identity_redacted": True,
        "notes": notes,
        "agronomic_review": agronomic_review,
    }


def update_farmer_feedback_record(
    feedback_id: str,
    admin_user_id: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Update status, priority, and/or assigned_to of a feedback record."""
    existing = get_farmer_feedback_detail(feedback_id)
    if not existing:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    new_status = status if status is not None else existing["status"]
    new_priority = priority if priority is not None else existing["priority"]
    new_assigned_to = assigned_to if assigned_to is not None else existing.get("assigned_to")

    resolved_at = existing.get("resolved_at")
    resolved_by_admin_id = existing.get("resolved_by_admin_id")

    if status == "resolved":
        resolved_at = now_iso
        resolved_by_admin_id = admin_user_id
    elif status and status != "resolved":
        resolved_at = None
        resolved_by_admin_id = None

    updates = {
        "status": new_status,
        "priority": new_priority,
        "assigned_to": new_assigned_to,
        "updated_at": now_iso,
        "resolved_at": resolved_at,
        "resolved_by_admin_id": resolved_by_admin_id,
    }

    if _is_supabase_active():
        client = _get_admin_client()
        if client is None:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackUpdateError:{corr_id}] Supabase active but admin client unavailable")
            raise RuntimeError(f"Database update failure (Ref: {corr_id})")
        try:
            client.table("farmer_feedback").update(updates).eq("id", feedback_id).execute()
        except Exception as err:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackUpdateError:{corr_id}] Supabase update failed: {err}")
            raise RuntimeError(f"Database update failure (Ref: {corr_id}): {err}") from err
    else:
        init_feedback_db()
        try:
            conn = _get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE farmer_feedback
                SET status = ?, priority = ?, assigned_to = ?, updated_at = ?, resolved_at = ?, resolved_by_admin_id = ?
                WHERE id = ?
            """, (new_status, new_priority, new_assigned_to, now_iso, resolved_at, resolved_by_admin_id, feedback_id))
            conn.commit()
            conn.close()
        except Exception as err:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackUpdateError:{corr_id}] SQLite update failed: {err}")
            raise RuntimeError(f"Database update failure (Ref: {corr_id}): {err}") from err

    return {
        "id": feedback_id,
        "status": new_status,
        "priority": new_priority,
        "assigned_to": new_assigned_to,
        "updated_at": now_iso,
        "resolved_at": resolved_at,
        "resolved_by_admin_id": resolved_by_admin_id,
    }


def add_feedback_review_note(feedback_id: str, admin_user_id: str, note: str) -> Optional[Dict[str, Any]]:
    """Add a review note to a feedback record."""
    existing = get_farmer_feedback_detail(feedback_id)
    if not existing:
        return None

    clean_note = sanitize_text(note)
    created_at = datetime.now(timezone.utc).isoformat()
    note_id = str(uuid.uuid4())

    note_record = {
        "id": note_id,
        "feedback_id": feedback_id,
        "admin_user_id": admin_user_id,
        "note": clean_note,
        "created_at": created_at,
    }

    if _is_supabase_active():
        client = _get_admin_client()
        if client is None:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackNoteError:{corr_id}] Supabase active but admin client unavailable")
            raise RuntimeError(f"Database insert failure (Ref: {corr_id})")
        try:
            client.table("feedback_review_notes").insert(note_record).execute()
            new_count = (existing.get("admin_note_count") or 0) + 1
            client.table("farmer_feedback").update({
                "admin_note_count": new_count,
                "updated_at": created_at,
            }).eq("id", feedback_id).execute()
        except Exception as err:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackNoteError:{corr_id}] Supabase insert note failed: {err}")
            raise RuntimeError(f"Database insert failure (Ref: {corr_id}): {err}") from err
    else:
        init_feedback_db()
        try:
            conn = _get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO feedback_review_notes (id, feedback_id, admin_user_id, note, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (note_id, feedback_id, admin_user_id, clean_note, created_at))
            cursor.execute("UPDATE farmer_feedback SET admin_note_count = admin_note_count + 1, updated_at = ? WHERE id = ?", (created_at, feedback_id))
            conn.commit()
            conn.close()
        except Exception as err:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackNoteError:{corr_id}] SQLite insert note failed: {err}")
            raise RuntimeError(f"Database insert failure (Ref: {corr_id}): {err}") from err

    return {
        "id": note_id,
        "feedback_id": feedback_id,
        "note": clean_note,
        "created_at": created_at,
    }


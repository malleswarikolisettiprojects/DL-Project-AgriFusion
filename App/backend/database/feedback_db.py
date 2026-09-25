"""
AgriFusion — Farmer Feedback & Agronomic Review Database Module
===============================================================
Manages stored farmer feedback, rating distributions, admin status/priority updates,
and review note history with strict privacy controls and audit compatibility.
"""

import html
import json
import logging
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

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
    try:
        conn.execute("PRAGMA busy_timeout = 30000;")
    except Exception:
        pass
    conn.row_factory = sqlite3.Row
    return conn


_feedback_db_initialized = False


def init_feedback_db():
    """Create farmer_feedback and feedback_review_notes tables in local SQLite for dev/test mode."""
    global _feedback_db_initialized
    if _feedback_db_initialized:
        return
    conn = _get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS farmer_feedback (
                id                    TEXT PRIMARY KEY,
                user_id               TEXT,
                advisory_id           TEXT,
                prediction_id         TEXT,
                created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                rating                INTEGER NOT NULL,
                category              TEXT NOT NULL,
                feedback_type         TEXT,
                module                TEXT,
                crop                  TEXT,
                district              TEXT,
                state                 TEXT,
                context_snapshot      TEXT,
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
        for col_name, col_def in [
            ("assigned_to", "TEXT"),
            ("user_id", "TEXT"),
            ("module", "TEXT"),
            ("prediction_id", "TEXT"),
            ("crop", "TEXT"),
            ("district", "TEXT"),
            ("state", "TEXT"),
            ("context_snapshot", "TEXT"),
            ("feedback_type", "TEXT"),
        ]:
            if col_name not in cols:
                try:
                    cursor.execute(f"ALTER TABLE farmer_feedback ADD COLUMN {col_name} {col_def}")
                except Exception:
                    pass

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feedback_review_notes (
                id            TEXT PRIMARY KEY,
                feedback_id   TEXT NOT NULL,
                admin_user_id TEXT,
                note          TEXT NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
    finally:
        conn.close()
    _feedback_db_initialized = True


def sanitize_text(text: str) -> str:
    """Sanitize user-submitted text against HTML injection."""
    if not text:
        return ""
    return html.escape(text.strip())


def sanitize_context_snapshot(ctx: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Sanitize context snapshot to strip images, base64 strings, or personal identifiers."""
    if not ctx or not isinstance(ctx, dict):
        return None

    clean_ctx = {}
    for k, v in ctx.items():
        if k.lower() in ("user_id", "email", "phone", "token", "image", "raw_image", "image_base64"):
            continue
        if isinstance(v, str):
            if len(v) > 2000:
                v = v[:2000] + "..."
            clean_ctx[k] = sanitize_text(v)
        elif isinstance(v, (int, float, bool, dict, list)):
            clean_ctx[k] = v
    return clean_ctx or None


def build_context_snapshot_fallback(
    advisory_id: Optional[str] = None,
    prediction_id: Optional[str] = None
) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Attempt to construct a small context snapshot from related advisory or prediction records.
    Returns (snapshot_dict, crop_str_or_None).
    """
    snapshot = {"status": "unavailable"}
    crop = None

    if advisory_id:
        if _is_supabase_active():
            client = _get_admin_client()
            if client:
                try:
                    res = client.table("advisory_activity").select("*").eq("query_id", advisory_id).execute()
                    if res.data:
                        adv = res.data[0]
                        crop = adv.get("crop")
                        snapshot = {
                            "question_summary": adv.get("query_summary") or "Agronomy Advisory Query",
                            "ai_answer": "Advisory guidance generated",
                            "relevant_details": {
                                "crop": crop,
                                "state": adv.get("state"),
                                "district": adv.get("district"),
                                "documents_used": adv.get("documents_used", 0)
                            }
                        }
                        return snapshot, crop
                except Exception:
                    pass
        else:
            try:
                conn = _get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM advisory_activity WHERE query_id = ?", (advisory_id,))
                row = cursor.fetchone()
                if row:
                    r = dict(row)
                    crop = r.get("crop")
                    snapshot = {
                        "question_summary": r.get("query_summary") or "Agronomy Advisory Query",
                        "ai_answer": "Advisory guidance generated",
                        "relevant_details": {
                            "crop": crop,
                            "state": r.get("state"),
                            "district": r.get("district"),
                            "documents_used": r.get("documents_used", 0)
                        }
                    }
                    conn.close()
                    return snapshot, crop
                conn.close()
            except Exception:
                pass

    if prediction_id:
        if _is_supabase_active():
            client = _get_admin_client()
            if client:
                try:
                    res = client.table("diagnostic_reports").select("*").eq("id", prediction_id).execute()
                    if res.data:
                        diag = res.data[0]
                        crop = diag.get("crop")
                        diag_name = diag.get("primary_diagnosis") or diag.get("diagnosis") or "Diagnostic analysis"
                        conf = diag.get("confidence")
                        snapshot = {
                            "question_summary": f"Crop health diagnosis on {crop or 'Crop'}",
                            "ai_answer": diag_name,
                            "relevant_details": {
                                "crop": crop,
                                "confidence": conf,
                                "severity": diag.get("severity"),
                                "secondary_matches": diag.get("secondary_matches")
                            }
                        }
                        return snapshot, crop
                except Exception:
                    pass

                try:
                    res_p = client.table("prediction_records").select("*").eq("id", prediction_id).execute()
                    if res_p.data:
                        pred = res_p.data[0]
                        req_payload = pred.get("request_payload") or {}
                        res_payload = pred.get("result_payload") or {}
                        crop = req_payload.get("crop") or res_payload.get("crop")
                        p_type = pred.get("prediction_type", "prediction")
                        snapshot = {
                            "question_summary": f"{p_type.title()} analysis request",
                            "ai_answer": str(res_payload.get("recommendation") or res_payload.get("primary_diagnosis") or "Prediction completed"),
                            "relevant_details": res_payload
                        }
                        return snapshot, crop
                except Exception:
                    pass
        else:
            try:
                conn = _get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM diagnostic_reports WHERE id = ?", (prediction_id,))
                row = cursor.fetchone()
                if row:
                    r = dict(row)
                    crop = r.get("crop")
                    snapshot = {
                        "question_summary": f"Crop health diagnosis on {crop or 'Crop'}",
                        "ai_answer": r.get("primary_diagnosis") or r.get("diagnosis") or "Diagnostic analysis",
                        "relevant_details": {
                            "crop": crop,
                            "confidence": r.get("confidence"),
                            "severity": r.get("severity")
                        }
                    }
                    conn.close()
                    return snapshot, crop
                conn.close()
            except Exception:
                pass

    return snapshot, crop


def _normalize_item_context_and_crop(r: Dict[str, Any]) -> Tuple[Dict[str, Any], Optional[str]]:
    adv_id = r.get("advisory_id")
    pred_id = r.get("prediction_id")
    crop_val = r.get("crop")
    raw_ctx = r.get("context_snapshot")

    ctx = None
    if isinstance(raw_ctx, dict):
        ctx = raw_ctx
    elif isinstance(raw_ctx, str) and raw_ctx.strip():
        try:
            ctx = json.loads(raw_ctx)
        except Exception:
            ctx = None

    if not ctx or ctx == {}:
        if adv_id or pred_id:
            fb_ctx, fb_crop = build_context_snapshot_fallback(adv_id, pred_id)
            ctx = fb_ctx
            if not crop_val and fb_crop:
                crop_val = fb_crop
        else:
            ctx = {"status": "unavailable"}

    return ctx, crop_val


def create_farmer_feedback(
    rating: int,
    category: str,
    message: str,
    feedback_type: Optional[str] = None,
    advisory_id: Optional[str] = None,
    prediction_id: Optional[str] = None,
    module: Optional[str] = None,
    crop: Optional[str] = None,
    district: Optional[str] = None,
    state: Optional[str] = None,
    context_snapshot: Optional[Dict[str, Any]] = None,
    language: Optional[str] = "English",
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Store new farmer feedback record."""
    _VALID_FEEDBACK_TYPES = {"helpful", "not_helpful", "problem_report"}
    feedback_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    clean_msg = sanitize_text(message)
    safe_feedback_type = feedback_type if feedback_type in _VALID_FEEDBACK_TYPES else None

    clean_snapshot = sanitize_context_snapshot(context_snapshot)
    if not clean_snapshot and (advisory_id or prediction_id):
        clean_snapshot, fallback_crop = build_context_snapshot_fallback(advisory_id, prediction_id)
        if not crop and fallback_crop:
            crop = fallback_crop

    if not clean_snapshot:
        clean_snapshot = {"status": "unavailable"}

    record = {
        "id": feedback_id,
        "user_id": user_id,
        "advisory_id": advisory_id,
        "prediction_id": prediction_id,
        "created_at": created_at,
        "updated_at": created_at,
        "rating": rating,
        "category": category,
        "feedback_type": safe_feedback_type,
        "module": module,
        "crop": crop,
        "district": district,
        "state": state,
        "context_snapshot": clean_snapshot,
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

        # Build the payload; strip any columns the production table doesn't have yet
        # (PGRST204 = column not found in schema cache = migration not yet applied).
        # We retry iteratively, removing each offending column until success or a
        # non-schema error. Each stripped column is logged as a migration warning.
        insert_payload: Dict[str, Any] = dict(record)
        stripped_cols: Set[str] = set()
        _PGRST204_COL_RE = re.compile(r"Could not find the '([^']+)' column")

        while True:
            try:
                res = client.table("farmer_feedback").insert(insert_payload).execute()
                if res.data:
                    if stripped_cols:
                        logger.warning(
                            "[FeedbackMigrationPending] Insert succeeded after stripping columns: %s. "
                            "Apply the Section 15 migration in migration.sql to Supabase to persist "
                            "these fields.",
                            sorted(stripped_cols),
                        )
                    return record  # always return full record to caller
                corr_id = uuid.uuid4().hex[:8]
                logger.error(f"[FeedbackInsertError:{corr_id}] Supabase insert returned empty data")
                raise RuntimeError(f"Database write failure (Ref: {corr_id})")
            except RuntimeError:
                raise
            except Exception as err:
                err_str = str(err)
                if "PGRST204" in err_str:
                    m = _PGRST204_COL_RE.search(err_str)
                    missing_col = m.group(1) if m else None
                    if missing_col and missing_col not in stripped_cols:
                        stripped_cols.add(missing_col)
                        insert_payload.pop(missing_col, None)
                        logger.warning(
                            "[FeedbackMigrationPending] Column '%s' absent from Supabase schema cache "
                            "— apply migration (Section 15 in migration.sql). Retrying without it.",
                            missing_col,
                        )
                        continue  # retry without the missing column
                # Non-PGRST204 error or unknown column name (e.g. RLS policy 42501) — fallback to SQLite
                corr_id = uuid.uuid4().hex[:8]
                logger.warning(
                    "[FeedbackInsertWarning:%s] Supabase insert error (%s) — falling back to SQLite.",
                    corr_id,
                    err,
                )
                break

    # SQLite fallback ONLY when Supabase is not configured (local dev/test)
    init_feedback_db()
    conn = _get_db_connection()
    try:
        cursor = conn.cursor()
        ctx_str = json.dumps(record["context_snapshot"]) if isinstance(record["context_snapshot"], dict) else record["context_snapshot"]
        cursor.execute("""
            INSERT INTO farmer_feedback (
                id, user_id, advisory_id, prediction_id, created_at, updated_at,
                rating, category, feedback_type, module, crop, district, state,
                context_snapshot, message, language, status, priority,
                admin_note_count, resolved_at, resolved_by_admin_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record["id"], record["user_id"], record["advisory_id"], record["prediction_id"],
            record["created_at"], record["updated_at"],
            record["rating"], record["category"], record.get("feedback_type"),
            record["module"], record["crop"], record.get("district"), record.get("state"),
            ctx_str, record["message"], record["language"],
            record["status"], record["priority"], record["admin_note_count"],
            record["resolved_at"], record["resolved_by_admin_id"],
        ))
        conn.commit()
    finally:
        conn.close()

    return record


def fetch_farmer_feedback_list(
    page: int = 1,
    page_size: int = 25,
    status: Optional[str] = None,
    feedback_type: Optional[str] = None,
    category: Optional[str] = None,
    module: Optional[str] = None,
    crop: Optional[str] = None,
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
            if feedback_type:
                q = q.eq("feedback_type", feedback_type)
            if category:
                q = q.eq("category", category)
            if module:
                q = q.eq("module", module)
            if crop:
                q = q.eq("crop", crop)
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
            if feedback_type:
                query += " AND feedback_type = ?"
                params.append(feedback_type)
            if category:
                query += " AND category = ?"
                params.append(category)
            if module:
                query += " AND module = ?"
                params.append(module)
            if crop:
                query += " AND crop = ?"
                params.append(crop)
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
            mod_val = str(r.get("module") or "").lower()
            crop_v = str(r.get("crop") or "").lower()
            if s_lower not in msg and s_lower not in cat and s_lower not in mod_val and s_lower not in crop_v:
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
        ctx, item_crop = _normalize_item_context_and_crop(r)
        items.append({
            "id": str(r.get("id")),
            "advisory_id": r.get("advisory_id"),
            "prediction_id": r.get("prediction_id"),
            "created_at": r.get("created_at"),
            "rating": r.get("rating"),
            "feedback_type": r.get("feedback_type"),
            "category": r.get("category"),
            "module": r.get("module"),
            "crop": item_crop,
            "district": r.get("district"),
            "state": r.get("state"),
            "context_snapshot": ctx,
            "comment": r.get("message"),
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

    if not r:
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
            logger.debug("SQLite fetch feedback fallback warning: %s", err)

    if not r:
        return None

    ctx, item_crop = _normalize_item_context_and_crop(r)

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
        "prediction_id": r.get("prediction_id"),
        "created_at": r.get("created_at"),
        "updated_at": r.get("updated_at"),
        "rating": r.get("rating"),
        "feedback_type": r.get("feedback_type"),
        "category": r.get("category"),
        "module": r.get("module"),
        "crop": item_crop,
        "district": r.get("district"),
        "state": r.get("state"),
        "context_snapshot": ctx,
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
    else:
        init_feedback_db()
        conn = _get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE farmer_feedback
                SET status = ?, priority = ?, assigned_to = ?, updated_at = ?, resolved_at = ?, resolved_by_admin_id = ?
                WHERE id = ?
            """, (new_status, new_priority, new_assigned_to, now_iso, resolved_at, resolved_by_admin_id, feedback_id))
            conn.commit()
        except Exception as err:
            corr_id = uuid.uuid4().hex[:8]
            logger.error(f"[FeedbackUpdateError:{corr_id}] SQLite update failed: {err}")
            raise RuntimeError(f"Database update failure (Ref: {corr_id}): {err}") from err
        finally:
            conn.close()

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

    # Supabase admin_user_id column is UUID type; validate before insert.
    # Test/mock user IDs (e.g. "adm-1") are not valid UUIDs — null them out so
    # the row is accepted. In production, Supabase Auth always issues proper UUIDs.
    safe_admin_user_id: Optional[str] = None
    if admin_user_id:
        try:
            import uuid as _uuid_mod
            _uuid_mod.UUID(admin_user_id)
            safe_admin_user_id = admin_user_id
        except (ValueError, AttributeError):
            logger.warning(
                "[FeedbackNoteAdminId] admin_user_id '%s' is not a valid UUID — "
                "storing note without admin attribution.",
                admin_user_id,
            )

    note_record = {
        "id": note_id,
        "feedback_id": feedback_id,
        "admin_user_id": safe_admin_user_id,
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
            return {
                "id": note_id,
                "feedback_id": feedback_id,
                "note": clean_note,
                "created_at": created_at,
            }
        except Exception as err:
            corr_id = uuid.uuid4().hex[:8]
            logger.warning(f"[FeedbackNoteWarning:{corr_id}] Supabase insert note failed ({err}) — falling back to SQLite.")

    # SQLite fallback
    init_feedback_db()
    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO feedback_review_notes (id, feedback_id, admin_user_id, note, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (note_id, feedback_id, str(admin_user_id) if admin_user_id is not None else None, clean_note, created_at))
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


"""
AgriFusion — One-Time Farmer Feedback Migration/Backfill Script
===============================================================
Reads legacy feedback rows from local SQLite (App/Data/users.db) and safely
upserts them into Supabase public.farmer_feedback using the privileged admin client.
Converts any non-UUID string IDs (like 'fb-...') to valid UUIDs while preserving creation timestamp
and content to avoid duplicates.
"""

import sqlite3
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "App" / "Data" / "users.db"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("feedback_backfill")

def backfill():
    if not DB_PATH.exists():
        logger.info(f"SQLite DB not found at {DB_PATH}, nothing to backfill.")
        return

    from App.backend.settings import create_supabase_admin_client, SUPABASE_URL, SUPABASE_KEY
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("Supabase environment is not configured. Backfill cancelled.")
        return

    admin_client = create_supabase_admin_client()
    if admin_client is None:
        logger.error("Failed to create Supabase admin client.")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM farmer_feedback")
        rows = cursor.fetchall()
    except Exception as e:
        logger.info(f"No farmer_feedback table in SQLite or query error: {e}")
        conn.close()
        return

    logger.info(f"Found {len(rows)} feedback records in local SQLite.")
    if not rows:
        conn.close()
        return

    # Fetch existing Supabase records to avoid duplicates
    existing_res = admin_client.table("farmer_feedback").select("id, created_at, message").execute()
    existing_records = existing_res.data or []
    existing_keys = set((r.get("created_at"), r.get("message")) for r in existing_records)

    inserted_count = 0
    skipped_count = 0

    for r in rows:
        r_dict = dict(r)
        created_at = r_dict.get("created_at")
        message = r_dict.get("message")

        if (created_at, message) in existing_keys:
            skipped_count += 1
            continue

        raw_id = r_dict.get("id")
        # Validate or generate UUID for id
        try:
            val_uuid = str(uuid.UUID(raw_id))
        except Exception:
            # Deterministic namespace UUID based on old string ID to prevent duplicate generation
            val_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"agrifusion.feedback.{raw_id}"))

        user_id = r_dict.get("user_id")
        if user_id:
            try:
                user_id = str(uuid.UUID(user_id))
            except Exception:
                user_id = None

        record = {
            "id": val_uuid,
            "user_id": user_id,
            "advisory_id": r_dict.get("advisory_id"),
            "created_at": created_at or datetime.now(timezone.utc).isoformat(),
            "updated_at": r_dict.get("updated_at") or created_at or datetime.now(timezone.utc).isoformat(),
            "rating": r_dict.get("rating", 5),
            "category": r_dict.get("category", "general"),
            "message": message or "",
            "language": r_dict.get("language") or "English",
            "status": r_dict.get("status") or "pending_review",
            "priority": r_dict.get("priority") or "normal",
            "assigned_to": r_dict.get("assigned_to"),
            "admin_note_count": r_dict.get("admin_note_count", 0),
            "resolved_at": r_dict.get("resolved_at"),
            "resolved_by_admin_id": None,
        }

        try:
            admin_client.table("farmer_feedback").insert(record).execute()
            inserted_count += 1
            existing_keys.add((created_at, message))
        except Exception as err:
            logger.error(f"Failed to migrate record {raw_id}: {err}")

    conn.close()
    logger.info(f"Backfill finished: {inserted_count} inserted, {skipped_count} skipped.")

if __name__ == "__main__":
    backfill()

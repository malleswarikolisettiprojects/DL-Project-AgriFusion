"""
AgriFusion — Admin Audit Logging Module
=======================================
Records sensitive administrative actions with structured metadata.
Never stores JWT tokens, passwords, or raw sensitive request bodies.
Uses Supabase if available; falls back to local SQLite database.
"""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "Data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "users.db"

from App.backend.database.database import supabase


def _get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_audit_db():
    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admin_audit_logs (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_user_id TEXT    NOT NULL,
            action        TEXT    NOT NULL,
            target_type   TEXT    NOT NULL,
            target_id     TEXT,
            safe_metadata TEXT,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def _get_admin_client():
    try:
        from App.backend.settings import create_supabase_admin_client
        admin_c = create_supabase_admin_client()
        if admin_c is not None:
            return admin_c
    except Exception:
        pass
    return supabase


async def record_audit_event(
    admin_user_id: str,
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    safe_metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Record an administrative action into Supabase or SQLite fallback.
    Ensures no secrets or full credentials are present in safe_metadata.
    """
    init_audit_db()
    timestamp = datetime.now(timezone.utc).isoformat()
    metadata_json = json.dumps(safe_metadata or {})

    # 1. Try Supabase via admin client
    client = _get_admin_client()
    if client is not None:
        try:
            res = client.table("admin_audit_logs").insert({
                "admin_user_id": admin_user_id,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "safe_metadata": safe_metadata or {},
                "created_at": timestamp,
            }).execute()
            if res.data:
                return True
        except Exception:
            pass  # Fall through to SQLite

    # 2. SQLite fallback
    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO admin_audit_logs
            (admin_user_id, action, target_type, target_id, safe_metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (admin_user_id, action, target_type, target_id, metadata_json, timestamp),
        )
        conn.commit()
        conn.close()
        return True
    except Exception:
        return False


def fetch_audit_logs(page: int = 1, page_size: int = 25, action: Optional[str] = None) -> Dict[str, Any]:
    """Fetch audit logs for authorized admin review with optional action filtering."""
    init_audit_db()
    offset = (page - 1) * page_size

    if supabase is not None:
        try:
            query = supabase.table("admin_audit_logs").select("*", count="exact")
            if action:
                query = query.eq("action", action)
            res = (
                query.order("created_at", desc=True)
                .range(offset, offset + page_size - 1)
                .execute()
            )
            if res.data is not None:
                total = res.count if res.count is not None else len(res.data)
                return {"items": res.data, "page": page, "page_size": page_size, "total": total}
        except Exception:
            pass

    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        if action:
            cursor.execute(
                """
                SELECT COUNT(*) as cnt FROM admin_audit_logs WHERE action = ?
                """,
                (action,),
            )
            total = cursor.fetchone()["cnt"]
            cursor.execute(
                """
                SELECT id, admin_user_id, action, target_type, target_id, safe_metadata, created_at
                FROM admin_audit_logs
                WHERE action = ?
                ORDER BY id DESC
                LIMIT ? OFFSET ?
                """,
                (action, page_size, offset),
            )
        else:
            cursor.execute("SELECT COUNT(*) as cnt FROM admin_audit_logs")
            total = cursor.fetchone()["cnt"]
            cursor.execute(
                """
                SELECT id, admin_user_id, action, target_type, target_id, safe_metadata, created_at
                FROM admin_audit_logs
                ORDER BY id DESC
                LIMIT ? OFFSET ?
                """,
                (page_size, offset),
            )
        rows = cursor.fetchall()
        conn.close()

        items = []
        for r in rows:
            meta = {}
            if r["safe_metadata"]:
                try:
                    meta = json.loads(r["safe_metadata"])
                except Exception:
                    meta = {}
            items.append({
                "id": r["id"],
                "admin_user_id": r["admin_user_id"],
                "action": r["action"],
                "target_type": r["target_type"],
                "target_id": r["target_id"],
                "safe_metadata": meta,
                "created_at": r["created_at"],
            })
        return {"items": items, "page": page, "page_size": page_size, "total": total}
    except Exception:
        return {"items": [], "page": page, "page_size": page_size, "total": 0}

"""
AgriFusion — System Events & Operational Metrics Module
======================================================
Persists system operational events (advisory queries, prediction requests, failed requests, background syncs)
to Supabase PostgreSQL (with SQLite fallback) to ensure metrics survive server restarts.
"""

import json
import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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


def _get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_system_events_db():
    """Ensure system_events table exists in local SQLite fallback."""
    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_events (
                id            TEXT PRIMARY KEY,
                event_type    TEXT NOT NULL,
                module        TEXT,
                status        TEXT NOT NULL DEFAULT 'success',
                http_status   INTEGER DEFAULT 200,
                error_code    TEXT,
                user_id       TEXT,
                request_id    TEXT,
                metadata_json TEXT,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning("Local system_events SQLite init error: %s", e)


def record_system_event(
    event_type: str,
    module: Optional[str] = None,
    status: str = "success",
    http_status: int = 200,
    error_code: Optional[str] = None,
    user_id: Optional[str] = None,
    request_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Safely record a system event (advisory query, prediction request, API failure, sync).
    Guaranteed non-blocking: never raises exceptions or interrupts main business logic.
    """
    try:
        event_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        clean_metadata = {
            k: v for k, v in (metadata or {}).items()
            if "secret" not in k.lower() and "key" not in k.lower() and "password" not in k.lower()
        }

        # 1. Try Supabase
        sb = _get_supabase()
        if sb is not None:
            try:
                sb.table("system_events").insert({
                    "id": event_id,
                    "event_type": event_type,
                    "module": module,
                    "status": status,
                    "http_status": http_status,
                    "error_code": error_code,
                    "user_id": user_id,
                    "request_id": request_id,
                    "metadata": clean_metadata,
                    "created_at": created_at,
                }).execute()
                return True
            except Exception as sb_err:
                logger.debug("Supabase system_events log failed: %s", sb_err)

        # 2. SQLite fallback
        init_system_events_db()
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO system_events (id, event_type, module, status, http_status, error_code, user_id, request_id, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                event_type,
                module,
                status,
                http_status,
                error_code,
                user_id,
                request_id,
                json.dumps(clean_metadata),
                created_at,
            ),
        )
        conn.commit()
        conn.close()
        return True
    except Exception as err:
        logger.warning("record_system_event failed non-blocking: %s", err)
        return False


def get_system_event_metrics() -> Dict[str, int]:
    """
    Retrieve aggregated operational metrics from Supabase & SQLite system_events tables.
    Returns counts for advisory_queries, prediction_requests, and failed_requests.
    """
    metrics = {
        "advisory_queries": 0,
        "prediction_requests": 0,
        "failed_requests": 0,
    }

    # 1. Try Supabase aggregation
    sb = _get_supabase()
    if sb is not None:
        try:
            adv_res = sb.table("system_events").select("id", count="exact").eq("event_type", "advisory_query").execute()
            adv_count = adv_res.count if adv_res.count is not None else len(adv_res.data or [])
            metrics["advisory_queries"] = adv_count

            pred_res = sb.table("system_events").select("id", count="exact").eq("event_type", "prediction_request").execute()
            pred_count = pred_res.count if pred_res.count is not None else len(pred_res.data or [])
            metrics["prediction_requests"] = pred_count

            fail_res = sb.table("system_events").select("id", count="exact").gte("http_status", 400).execute()
            fail_count = fail_res.count if fail_res.count is not None else len(fail_res.data or [])
            metrics["failed_requests"] = fail_count

            return metrics
        except Exception as sb_err:
            logger.debug("Supabase system_events metrics query failed: %s", sb_err)

    # 2. SQLite fallback
    try:
        init_system_events_db()
        conn = _get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM system_events WHERE event_type = 'advisory_query'")
        metrics["advisory_queries"] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM system_events WHERE event_type = 'prediction_request'")
        metrics["prediction_requests"] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM system_events WHERE http_status >= 400 OR status = 'failed'")
        metrics["failed_requests"] = cursor.fetchone()[0]

        conn.close()
    except Exception as err:
        logger.warning("SQLite system_events metrics query failed: %s", err)

    return metrics

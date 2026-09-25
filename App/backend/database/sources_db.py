"""
AgriFusion — Canonical Knowledge Sources Registry Module
=========================================================
Manages authoritative agricultural RAG knowledge sources (ANGRAU, PJTSAU, ICAR, KVK, Govt Portals).
Tracks verification status, indexing state, state relevance, and caveats.
"""

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


_sources_db_initialized = False


def init_sources_db():
    """Create knowledge_sources table and seed default verified sources if empty."""
    global _sources_db_initialized
    if _sources_db_initialized:
        return
    conn = _get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_sources (
            id                     TEXT PRIMARY KEY,
            title                  TEXT NOT NULL,
            organization           TEXT NOT NULL,
            source_type            TEXT NOT NULL,
            subject                TEXT,
            crop                   TEXT,
            state_relevance_json   TEXT,
            official_url           TEXT UNIQUE NOT NULL,
            document_format        TEXT DEFAULT 'PDF',
            language               TEXT DEFAULT 'English',
            verification_status    TEXT DEFAULT 'pending_review',
            verified_date          TEXT,
            verified_by_admin_id   TEXT,
            verification_notes     TEXT,
            last_indexed_at        TIMESTAMP,
            index_status           TEXT DEFAULT 'not_indexed',
            index_error_category   TEXT,
            is_active              BOOLEAN DEFAULT 1,
            needs_review           BOOLEAN DEFAULT 0,
            caveats_json           TEXT,
            created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        conn.commit()

        # Check if empty; seed canonical government sources if table is fresh
        cursor.execute("SELECT COUNT(*) FROM knowledge_sources")
        count = cursor.fetchone()[0]
        if count == 0:
            seed_sources = [
            {
                "id": "src-icar-01",
                "title": "ICAR Crop Protection & Pest Management Handbook",
                "organization": "ICAR",
                "source_type": "icar",
                "subject": "Crop Protection & IPM",
                "crop": "All Crops",
                "state_relevance": ["Andhra Pradesh", "Telangana", "All India"],
                "official_url": "https://icar.org.in/",
                "document_format": "Web/PDF",
                "language": "English",
                "verification_status": "verified",
                "verified_date": "2026-09-18",
                "verified_by_admin_id": "system_admin",
                "verification_notes": "Verified ICAR central publication for Integrated Pest Management.",
                "last_indexed_at": datetime.now(timezone.utc).isoformat(),
                "index_status": "indexed",
                "is_active": 1,
                "needs_review": 0,
                "caveats": [],
            },
            {
                "id": "src-angrau-01",
                "title": "ANGRAU Package of Practices for Kharif Crops",
                "organization": "ANGRAU",
                "source_type": "agricultural_university",
                "subject": "Agronomy & Package of Practices",
                "crop": "Rice",
                "state_relevance": ["Andhra Pradesh"],
                "official_url": "https://angrau.ac.in/",
                "document_format": "PDF",
                "language": "Telugu",
                "verification_status": "verified_with_caveats",
                "verified_date": "2026-09-18",
                "verified_by_admin_id": "system_admin",
                "verification_notes": "Official university recommendation for Andhra Pradesh agro-climatic zones.",
                "last_indexed_at": datetime.now(timezone.utc).isoformat(),
                "index_status": "indexed",
                "is_active": 1,
                "needs_review": 0,
                "caveats": ["Dose information subject to local soil testing recommendations."],
            },
            {
                "id": "src-pjtsau-01",
                "title": "PJTSAU Telangana Agricultural Advisory & Crop Guide",
                "organization": "PJTSAU",
                "source_type": "agricultural_university",
                "subject": "Crop Production & Telangana Advisory",
                "crop": "Cotton",
                "state_relevance": ["Telangana"],
                "official_url": "https://pjtsau.edu.in/",
                "document_format": "PDF",
                "language": "Telugu",
                "verification_status": "verified",
                "verified_date": "2026-09-18",
                "verified_by_admin_id": "system_admin",
                "verification_notes": "Professor Jayashankar Telangana State Agricultural University official portal.",
                "last_indexed_at": datetime.now(timezone.utc).isoformat(),
                "index_status": "indexed",
                "is_active": 1,
                "needs_review": 0,
                "caveats": [],
            },
            {
                "id": "src-pmkisan-01",
                "title": "PM-KISAN Direct Benefit Transfer Official Portal",
                "organization": "Ministry of Agriculture",
                "source_type": "official_scheme_portal",
                "subject": "Farmer Income Support Scheme",
                "crop": "All Crops",
                "state_relevance": ["All India"],
                "official_url": "https://pmkisan.gov.in/",
                "document_format": "Portal",
                "language": "English",
                "verification_status": "verified",
                "verified_date": "2026-09-18",
                "verified_by_admin_id": "system_admin",
                "verification_notes": "Official Direct Benefit Transfer portal for ₹6000 annual income support.",
                "last_indexed_at": datetime.now(timezone.utc).isoformat(),
                "index_status": "indexed",
                "is_active": 1,
                "needs_review": 0,
                "caveats": [],
            },
        ]

        for s in seed_sources:
            cursor.execute("""
                INSERT INTO knowledge_sources (
                    id, title, organization, source_type, subject, crop, state_relevance_json,
                    official_url, document_format, language, verification_status, verified_date,
                    verified_by_admin_id, verification_notes, last_indexed_at, index_status,
                    is_active, needs_review, caveats_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                s["id"], s["title"], s["organization"], s["source_type"], s["subject"], s["crop"],
                json.dumps(s["state_relevance"]), s["official_url"], s["document_format"],
                s["language"], s["verification_status"], s["verified_date"], s["verified_by_admin_id"],
                s["verification_notes"], s["last_indexed_at"], s["index_status"], s["is_active"],
                s["needs_review"], json.dumps(s["caveats"])
            ))
        conn.commit()
    finally:
        conn.close()
    _sources_db_initialized = True


def fetch_knowledge_sources_list(
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    organization: Optional[str] = None,
    source_type: Optional[str] = None,
    crop: Optional[str] = None,
    state: Optional[str] = None,
    status: Optional[str] = None,
    verification_status: Optional[str] = None,
) -> dict:
    """Fetch paginated knowledge sources list with filtering support."""
    init_sources_db()
    offset = (page - 1) * page_size

    rows_data = []
    supabase = _get_supabase()
    if supabase is not None:
        try:
            q = supabase.table("knowledge_sources").select("*").order("created_at", desc=True)
            if organization:
                q = q.eq("organization", organization)
            if source_type:
                q = q.eq("source_type", source_type)
            if crop:
                q = q.eq("crop", crop)
            if status:
                q = q.eq("index_status", status)
            if verification_status:
                q = q.eq("verification_status", verification_status)
            res = q.execute()
            if res.data:
                rows_data = res.data
        except Exception:
            rows_data = []

    if not rows_data:
        try:
            conn = _get_db_connection()
            cursor = conn.cursor()
            query = "SELECT * FROM knowledge_sources WHERE 1=1"
            params = []
            if organization:
                query += " AND LOWER(organization) = LOWER(?)"
                params.append(organization)
            if source_type:
                query += " AND source_type = ?"
                params.append(source_type)
            if crop:
                query += " AND LOWER(crop) = LOWER(?)"
                params.append(crop)
            if status:
                query += " AND index_status = ?"
                params.append(status)
            if verification_status:
                query += " AND verification_status = ?"
                params.append(verification_status)

            query += " ORDER BY created_at DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            rows_data = [dict(r) for r in rows]
            conn.close()
        except Exception:
            rows_data = []

    # In-memory search and state filters
    filtered = []
    for r in rows_data:
        if state:
            st_rel = []
            try:
                st_rel = json.loads(r.get("state_relevance_json") or "[]")
            except Exception:
                st_rel = []
            if state.lower() not in [s.lower() for s in st_rel] and "all india" not in [s.lower() for s in st_rel]:
                continue

        if search:
            s_lower = search.lower()
            title = (r.get("title") or "").lower()
            org = (r.get("organization") or "").lower()
            subj = (r.get("subject") or "").lower()
            url = (r.get("official_url") or "").lower()
            if s_lower not in title and s_lower not in org and s_lower not in subj and s_lower not in url:
                continue

        filtered.append(r)

    total = len(filtered)
    paged = filtered[offset : offset + page_size]

    items = []
    for r in paged:
        try:
            st_list = json.loads(r.get("state_relevance_json") or "[]")
        except Exception:
            st_list = []
        try:
            caveats = json.loads(r.get("caveats_json") or "[]")
        except Exception:
            caveats = []

        items.append({
            "id": str(r.get("id")),
            "title": r.get("title"),
            "organization": r.get("organization"),
            "source_type": r.get("source_type"),
            "subject": r.get("subject"),
            "crop": r.get("crop"),
            "state_relevance": st_list,
            "official_url": r.get("official_url"),
            "document_format": r.get("document_format") or "PDF",
            "language": r.get("language") or "English",
            "verification_status": r.get("verification_status") or "pending_review",
            "verified_date": r.get("verified_date"),
            "verified_by": r.get("verified_by_admin_id"),
            "last_indexed_at": r.get("last_indexed_at"),
            "index_status": r.get("index_status") or "not_indexed",
            "is_active": bool(r.get("is_active")),
            "needs_review": bool(r.get("needs_review")),
            "caveats": caveats,
        })

    privacy_note = "Only registered canonical agricultural sources are shown."
    if total == 0:
        privacy_note = "No canonical knowledge sources have been registered yet."

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "privacy_note": privacy_note,
    }


def get_knowledge_source_detail(source_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve single knowledge source details."""
    init_sources_db()
    r = None

    supabase = _get_supabase()
    if supabase is not None:
        try:
            res = supabase.table("knowledge_sources").select("*").eq("id", source_id).execute()
            if res.data:
                r = res.data[0]
        except Exception:
            pass

    if not r:
        try:
            conn = _get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM knowledge_sources WHERE id = ?", (source_id,))
            row = cursor.fetchone()
            conn.close()
            if row:
                r = dict(row)
        except Exception:
            pass

    if not r:
        return None

    try:
        st_list = json.loads(r.get("state_relevance_json") or "[]")
    except Exception:
        st_list = []
    try:
        caveats = json.loads(r.get("caveats_json") or "[]")
    except Exception:
        caveats = []

    return {
        "id": str(r.get("id")),
        "title": r.get("title"),
        "organization": r.get("organization"),
        "source_type": r.get("source_type"),
        "subject": r.get("subject"),
        "crop": r.get("crop"),
        "state_relevance": st_list,
        "official_url": r.get("official_url"),
        "document_format": r.get("document_format") or "PDF",
        "language": r.get("language") or "English",
        "verification_status": r.get("verification_status") or "pending_review",
        "verified_date": r.get("verified_date"),
        "verified_by": r.get("verified_by_admin_id"),
        "verification_notes": r.get("verification_notes"),
        "last_indexed_at": r.get("last_indexed_at"),
        "index_status": r.get("index_status") or "not_indexed",
        "is_active": bool(r.get("is_active")),
        "needs_review": bool(r.get("needs_review")),
        "caveats": caveats,
    }


def register_knowledge_source(
    title: str,
    organization: str,
    source_type: str,
    official_url: str,
    subject: Optional[str] = None,
    crop: Optional[str] = None,
    state_relevance: Optional[List[str]] = None,
    language: Optional[str] = "English",
    verification_notes: Optional[str] = None,
    initial_verification_status: Optional[str] = "pending_review",
    initial_index_status: Optional[str] = "not_indexed",
    admin_user_id: Optional[str] = None,
) -> Tuple[bool, Union[Dict[str, Any], str]]:
    """
    Register a new official website or document for RAG indexing.
    Supports direct admin verification and immediate queuing from frontend UI.
    """
    init_sources_db()

    # Check for duplicate URL
    conn = _get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM knowledge_sources WHERE official_url = ?", (official_url,))
        row = cursor.fetchone()
    finally:
        conn.close()
    if row:
        return False, "Duplicate official source URL already exists in registry."

    source_id = f"src-{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    st_list = state_relevance or ["All India"]

    ver_status = initial_verification_status or "pending_review"
    idx_status = initial_index_status or "not_indexed"
    verified_date = today_date if ver_status in ("verified", "verified_with_caveats") else None
    verified_by = admin_user_id if ver_status in ("verified", "verified_with_caveats") else None

    record = {
        "id": source_id,
        "title": title.strip(),
        "organization": organization.strip(),
        "source_type": source_type,
        "subject": subject.strip() if subject else None,
        "crop": crop.strip() if crop else None,
        "state_relevance_json": json.dumps(st_list),
        "official_url": official_url.strip(),
        "document_format": "Web/PDF",
        "language": language or "English",
        "verification_status": ver_status,
        "verified_date": verified_date,
        "verified_by_admin_id": verified_by,
        "verification_notes": verification_notes.strip() if verification_notes else None,
        "last_indexed_at": now_iso if idx_status == "queued" else None,
        "index_status": idx_status,
        "is_active": True,
        "needs_review": ver_status == "pending_review",
        "caveats_json": json.dumps([]),
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    supabase = _get_supabase()
    if supabase is not None:
        try:
            supabase.table("knowledge_sources").insert(record).execute()
        except Exception:
            pass

    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO knowledge_sources (
            id, title, organization, source_type, subject, crop, state_relevance_json,
            official_url, document_format, language, verification_status, verified_date,
            verified_by_admin_id, verification_notes, last_indexed_at, index_status,
            is_active, needs_review, caveats_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        record["id"], record["title"], record["organization"], record["source_type"],
        record["subject"], record["crop"], record["state_relevance_json"],
        record["official_url"], record["document_format"], record["language"],
        record["verification_status"], record["verified_date"], record["verified_by_admin_id"],
        record["verification_notes"], record["last_indexed_at"], record["index_status"],
        1 if record["is_active"] else 0, 1 if record["needs_review"] else 0,
        record["caveats_json"], record["created_at"], record["updated_at"]
    ))
    conn.commit()
    conn.close()

    res_obj = get_knowledge_source_detail(source_id)
    return True, res_obj or record


def update_knowledge_source_metadata(
    source_id: str,
    admin_user_id: str,
    verification_status: Optional[str] = None,
    verification_notes: Optional[str] = None,
    is_active: Optional[bool] = None,
    needs_review: Optional[bool] = None,
    caveats: Optional[List[str]] = None,
) -> Tuple[bool, Union[Dict[str, Any], str]]:
    """Update source verification status, notes, active status, or caveats."""
    existing = get_knowledge_source_detail(source_id)
    if not existing:
        return False, "Source not found."

    now_iso = datetime.now(timezone.utc).isoformat()
    today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    new_ver_status = verification_status if verification_status is not None else existing["verification_status"]
    new_ver_notes = verification_notes if verification_notes is not None else existing.get("verification_notes")
    new_active = is_active if is_active is not None else existing["is_active"]
    new_needs_review = needs_review if needs_review is not None else existing["needs_review"]
    new_caveats = caveats if caveats is not None else existing.get("caveats", [])

    # Validation rules
    if verification_status == "verified":
        if not existing.get("official_url") or not existing.get("organization"):
            return False, "Verified status requires valid official URL and organization."
    if verification_status == "verified_with_caveats" and not new_caveats:
        return False, "verified_with_caveats status requires at least one written caveat."
    if verification_status in ("stale", "unavailable") and not new_ver_notes:
        return False, "Stale or unavailable status requires verification notes/reason."

    verified_date = existing.get("verified_date")
    verified_by = existing.get("verified_by")
    if verification_status in ("verified", "verified_with_caveats"):
        verified_date = today_date
        verified_by = admin_user_id

    updates = {
        "verification_status": new_ver_status,
        "verification_notes": new_ver_notes,
        "is_active": new_active,
        "needs_review": new_needs_review,
        "caveats_json": json.dumps(new_caveats),
        "verified_date": verified_date,
        "verified_by_admin_id": verified_by,
        "updated_at": now_iso,
    }

    supabase = _get_supabase()
    if supabase is not None:
        try:
            supabase.table("knowledge_sources").update(updates).eq("id", source_id).execute()
        except Exception:
            pass

    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE knowledge_sources
        SET verification_status = ?, verification_notes = ?, is_active = ?,
            needs_review = ?, caveats_json = ?, verified_date = ?,
            verified_by_admin_id = ?, updated_at = ?
        WHERE id = ?
    """, (
        new_ver_status, new_ver_notes, 1 if new_active else 0,
        1 if new_needs_review else 0, json.dumps(new_caveats),
        verified_date, verified_by, now_iso, source_id
    ))
    conn.commit()
    conn.close()

    updated_obj = get_knowledge_source_detail(source_id)
    return True, updated_obj


def reindex_knowledge_source(source_id: str, admin_user_id: str) -> Tuple[bool, Union[Dict[str, Any], str]]:
    """Queue a source for RAG reindexing."""
    existing = get_knowledge_source_detail(source_id)
    if not existing:
        return False, "Source not found."
    if existing["verification_status"] == "rejected":
        return False, "Cannot reindex a rejected source."

    now_iso = datetime.now(timezone.utc).isoformat()
    updates = {
        "index_status": "queued",
        "last_indexed_at": now_iso,
        "updated_at": now_iso,
    }

    supabase = _get_supabase()
    if supabase is not None:
        try:
            supabase.table("knowledge_sources").update(updates).eq("id", source_id).execute()
        except Exception:
            pass

    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE knowledge_sources SET index_status = 'queued', last_indexed_at = ?, updated_at = ? WHERE id = ?", (now_iso, now_iso, source_id))
    conn.commit()
    conn.close()

    return True, {
        "source_id": source_id,
        "index_status": "queued",
        "message": "Source reindex requested. Completion status will be updated separately.",
    }


def delete_knowledge_source(source_id: str) -> bool:
    """Delete a knowledge source entry by ID from Supabase / SQLite."""
    init_sources_db()
    supabase = _get_supabase()
    if supabase is not None:
        try:
            supabase.table("knowledge_sources").delete().eq("id", source_id).execute()
        except Exception:
            pass

    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM knowledge_sources WHERE id = ?", (source_id,))
        conn.commit()
        conn.close()
        return True
    except Exception:
        return False


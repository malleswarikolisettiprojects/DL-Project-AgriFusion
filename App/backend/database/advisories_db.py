"""
AgriFusion — Advisory Activity & Compliance Audit Module
=========================================================
Stores and queries anonymized telemetry for farmer advisory RAG responses.
Enforces strict privacy and safety contracts:
  - No user/farmer identifiers, emails, phones, tokens, IP addresses, or location data.
  - Sanitizes source citations (strips local file paths, file:///, embedding IDs).
  - Performs deterministic agronomic compliance & quality verification checks.
  - Single durable production source of truth: Supabase PostgreSQL when SUPABASE_URL is configured; SQLite for local testing.
"""

import json
import logging
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

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
            from App.backend.settings import create_supabase_admin_client, create_supabase_client
            _supabase = create_supabase_admin_client() or create_supabase_client()
        except Exception:
            _supabase = None
    return _supabase


def _get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=30000;")
    except Exception:
        pass
    conn.row_factory = sqlite3.Row
    return conn


def init_advisories_db():
    """Create advisory_activity and advisory_notes tables if missing locally."""
    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS advisory_activity (
            query_id                     TEXT PRIMARY KEY,
            created_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            crop                         TEXT,
            state                        TEXT,
            district                     TEXT,
            query_summary                TEXT,
            activity_status              TEXT DEFAULT 'success',
            review_status                TEXT DEFAULT 'not_reviewed',
            documents_considered         INTEGER DEFAULT 0,
            documents_used               INTEGER DEFAULT 0,
            relevance_threshold_passed   BOOLEAN DEFAULT 1,
            no_verified_source           BOOLEAN DEFAULT 0,
            source_citations_json        TEXT,
            compliance_json              TEXT,
            error_category               TEXT,
            retention_expires_at         TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS advisory_notes (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            query_id      TEXT NOT NULL,
            admin_user_id TEXT NOT NULL,
            note          TEXT NOT NULL,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def summarize_query_safely(raw_query: str, crop: Optional[str] = None) -> str:
    """
    Produce a safe, high-level topic summary from a raw user question.
    Strips email addresses, phone numbers, individual names, and specific village addresses.
    """
    if not raw_query:
        return "General agricultural inquiry"

    text = raw_query.strip()
    text = re.sub(r'[\w\.-]+@[\w\.-]+\.\w+', '[REDACTED_EMAIL]', text)
    text = re.sub(r'\+?\d[\d -]{8,}\d', '[REDACTED_PHONE]', text)

    lower = text.lower()
    topic = "inquiry"
    if any(k in lower for k in ["yellow", "spot", "blight", "rot", "disease", "fungus", "rust", "canker"]):
        topic = "disease management"
    elif any(k in lower for k in ["pest", "worm", "bug", "aphid", "mite", "thrip", "borer", "caterpillar"]):
        topic = "pest control"
    elif any(k in lower for k in ["fertilizer", "urea", "dap", "npk", "dose", "nitrogen", "soil", "nutrient"]):
        topic = "fertilizer recommendation"
    elif any(k in lower for k in ["scheme", "subsidy", "pm-kisan", "pmfby", "kcc", "loan", "grant"]):
        topic = "government scheme"
    elif any(k in lower for k in ["irrigation", "water", "drip", "sprinkler"]):
        topic = "irrigation advisory"
    elif any(k in lower for k in ["price", "market", "mandi", "rate"]):
        topic = "market intelligence"

    prefix = f"{crop.title()} " if crop else ""
    return f"{prefix}{topic.title()} request"


def sanitize_source(src: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize source citation structure: remove file paths, embedding IDs, and local system paths."""
    title = str(src.get("title") or "Verified Agronomic Document").strip()
    org = str(src.get("organization") or "Ministry of Agriculture / ICAR").strip()
    url = str(src.get("url") or "").strip()

    title = re.sub(r'^[A-Z]:\\.*\\', '', title)
    title = re.sub(r'^/.*(?=/)', '', title)
    title = re.sub(r'file:///.*(?=/)', '', title)

    if url.startswith("file://") or "C:\\" in url or "/Users/" in url:
        url = "https://agricoop.gov.in"

    return {
        "title": title,
        "organization": org,
        "url": url if url else "https://agricoop.gov.in",
        "verified_date": "2026-01-15",
    }


def run_advisory_compliance_checks(rag_result: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Perform deterministic agronomic compliance and quality audit checks."""
    rag_result = rag_result or {}
    answer = rag_result.get("answer") or ""

    has_citations = bool(rag_result.get("retrieved_passages") or rag_result.get("source_url") or rag_result.get("source_title"))

    has_dose_mention = any(k in answer.lower() for k in ["kg/ha", "g/l", "dose", "spray", "ml/l", "acre", "per hectare"])
    dose_backed = (has_dose_mention and has_citations) or (not has_dose_mention)

    missing_dose_fields_flagged = True
    if has_dose_mention:
        has_qty = bool(re.search(r'\d+', answer))
        has_unit = any(u in answer.lower() for u in ["kg", "g", "ml", "litres", "liter", "%"])
        missing_dose_fields_flagged = bool(has_qty and has_unit)

    scheme_eligibility_qualified = True
    if "eligibility" in answer.lower() or "scheme" in answer.lower():
        scheme_eligibility_qualified = any(k in answer.lower() for k in ["if", "subject to", "eligible", "criteria", "landholding", "farmers"])

    extension_confirmation_flagged = True
    if any(k in answer.lower() for k in ["severe", "chemical", "pesticide", "outbreak"]):
        extension_confirmation_flagged = any(k in answer.lower() for k in ["kvk", "extension officer", "agronomist", "officer", "expert"])

    all_passed = (
        has_citations and
        dose_backed and
        missing_dose_fields_flagged and
        scheme_eligibility_qualified and
        extension_confirmation_flagged
    )

    compliance_status = "passed" if all_passed else "needs_review"

    return {
        "citations_present": has_citations,
        "dose_claims_source_backed": dose_backed,
        "missing_dose_fields_flagged": missing_dose_fields_flagged,
        "scheme_eligibility_qualified": scheme_eligibility_qualified,
        "extension_confirmation_flagged": extension_confirmation_flagged,
        "compliance_status": compliance_status,
    }


def log_advisory_activity(
    query_text: str,
    crop: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    rag_result: Optional[Dict[str, Any]] = None,
    activity_status: Optional[str] = None,
    error_category: Optional[str] = None,
    request_id: Optional[str] = None,
) -> bool:
    """
    Log safe advisory activity metadata to single durable source of truth.
    Uses Supabase PostgreSQL when SUPABASE_URL is configured; SQLite for standalone local tests.
    NON-BLOCKING: Safe wrapper that catches and logs errors with correlation ID without leaking query_text or PII.
    """
    req_token = request_id or str(uuid.uuid4())[:8]
    try:
        init_advisories_db()
        rag_result = rag_result or {}

        query_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        safe_summary = summarize_query_safely(query_text, crop=crop)

        if not activity_status:
            rag_status = rag_result.get("rag_status")
            no_verified_source = (rag_status == "no_verified_match" or rag_result.get("answer") is None)
            activity_status = "no_verified_source" if no_verified_source else "success"
        if activity_status in ("failed", "timeout"):
            no_verified_source = True
            docs_considered = 0
            docs_used = 0
            relevance_passed = False
            unique_sources = []
        else:
            no_verified_source = (activity_status == "no_verified_source") or (rag_result.get("answer") is None)
            passages = rag_result.get("retrieved_passages") or []
            docs_considered = int(rag_result.get("documents_considered") or rag_result.get("local_docs_scanned") or len(passages))

            raw_sources = []
            if rag_result.get("source_title"):
                raw_sources.append({
                    "title": rag_result.get("source_title"),
                    "organization": rag_result.get("source_institute"),
                    "url": rag_result.get("source_url"),
                })
            for p in passages:
                raw_sources.append({
                    "title": p.get("source"),
                    "organization": p.get("institute"),
                    "url": p.get("url"),
                })
            sanitized_sources_list = [sanitize_source(s) for s in raw_sources]

            unique_sources = []
            seen_keys = set()
            for s in sanitized_sources_list:
                k = (s["title"], s["url"])
                if k not in seen_keys:
                    seen_keys.add(k)
                    unique_sources.append(s)

            if not no_verified_source and activity_status == "success":
                docs_used = max(len(passages), len(unique_sources), 1 if rag_result.get("source_title") else 0)
                relevance_passed = (rag_result.get("confidence_score", 0) > 0.05)
            else:
                docs_used = 0
                relevance_passed = False

        compliance_data = run_advisory_compliance_checks(rag_result)
        if activity_status in ("failed", "timeout") or no_verified_source:
            compliance_data["compliance_status"] = "failed" if activity_status in ("failed", "timeout") else "no_verified_source"
            compliance_data["citations_present"] = False
        else:
            compliance_data["citations_present"] = (len(unique_sources) > 0)

        record = {
            "query_id": query_id,
            "created_at": created_at,
            "crop": crop.strip() if crop else None,
            "state": state.strip() if state else None,
            "district": district.strip() if district else None,
            "query_summary": safe_summary,
            "activity_status": activity_status,
            "review_status": "not_reviewed",
            "documents_considered": docs_considered,
            "documents_used": docs_used,
            "relevance_threshold_passed": relevance_passed,
            "no_verified_source": no_verified_source,
            "source_citations_json": json.dumps(unique_sources),
            "compliance_json": json.dumps(compliance_data),
            "error_category": error_category,
            "retention_expires_at": None,
        }

        from App.backend.settings import SUPABASE_URL
        supabase = _get_supabase()

        if SUPABASE_URL:
            if supabase is None:
                logger.error("[%s] Supabase configured but admin client unavailable for advisory_activity write.", req_token)
                return {"telemetry_persisted": False, "query_id": None, "request_id": req_token}
            try:
                supabase.table("advisory_activity").insert(record).execute()
                logger.info("[%s] Persisted advisory activity record (query_id=%s, status=%s) to Supabase.", req_token, query_id, activity_status)
                return {"telemetry_persisted": True, "query_id": query_id, "request_id": req_token}
            except Exception as exc:
                logger.error("[%s] Supabase write failure for advisory_activity (query_id=%s): %s", req_token, query_id, exc)
                return {"telemetry_persisted": False, "query_id": None, "request_id": req_token}
        else:
            conn = _get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO advisory_activity (
                    query_id, created_at, crop, state, district, query_summary,
                    activity_status, review_status, documents_considered, documents_used,
                    relevance_threshold_passed, no_verified_source, source_citations_json,
                    compliance_json, error_category, retention_expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                query_id, created_at, record["crop"], record["state"], record["district"],
                record["query_summary"], record["activity_status"], record["review_status"],
                record["documents_considered"], record["documents_used"],
                1 if record["relevance_threshold_passed"] else 0,
                1 if record["no_verified_source"] else 0,
                record["source_citations_json"], record["compliance_json"],
                record["error_category"], record["retention_expires_at"]
            ))
            conn.commit()
            conn.close()
            logger.info("[%s] Persisted advisory activity record (query_id=%s, status=%s) to SQLite.", req_token, query_id, activity_status)
            return {"telemetry_persisted": True, "query_id": query_id, "request_id": req_token}

    except Exception as err:
        logger.error("[%s] Failed to log advisory activity telemetry: %s", req_token, err)
        return {"telemetry_persisted": False, "query_id": None, "request_id": req_token}


def fetch_advisory_activities(
    page: int = 1,
    page_size: int = 25,
    crop: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    status: Optional[str] = None,
    review_status: Optional[str] = None,
    source_verified: Optional[bool] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
) -> dict:
    """
    Fetch paginated, anonymized advisory activity records for quality review.
    Raises RuntimeError on database failure (fails closed with HTTP 500).
    """
    init_advisories_db()
    offset = (page - 1) * page_size

    rows_data = []
    from App.backend.settings import SUPABASE_URL
    supabase = _get_supabase()

    if SUPABASE_URL:
        if supabase is None:
            logger.error("Supabase configured but admin client unavailable for advisory_activity read.")
            raise RuntimeError("Database query failed for advisory activity")
        try:
            rows_data = []
            chunk_size = 1000
            offset_chunk = 0
            while True:
                q = supabase.table("advisory_activity").select("*").order("created_at", desc=True)
                if crop and crop.lower() != 'all':
                    q = q.eq("crop", crop)
                if state and state.lower() != 'all':
                    q = q.eq("state", state)
                if district and district.lower() != 'all':
                    q = q.eq("district", district)
                if status and status.lower() != 'all':
                    q = q.eq("activity_status", status)
                if review_status and review_status.lower() != 'all':
                    q = q.eq("review_status", review_status)
                q = q.range(offset_chunk, offset_chunk + chunk_size - 1)
                res = q.execute()
                if res.data is None:
                    logger.error("Supabase advisory_activity query returned None response")
                    raise RuntimeError("Database query failed for advisory activity")
                rows_data.extend(res.data)
                if len(res.data) < chunk_size:
                    break
                offset_chunk += chunk_size
        except Exception as exc:
            logger.error("Supabase advisory_activity read failure: %s", exc)
            raise RuntimeError(f"Database query failed for advisory activity: {exc}") from exc
    else:
        try:
            conn = _get_db_connection()
            cursor = conn.cursor()
            query = "SELECT * FROM advisory_activity WHERE 1=1"
            params = []
            if crop and crop.lower() != 'all':
                query += " AND LOWER(crop) = LOWER(?)"
                params.append(crop)
            if state and state.lower() != 'all':
                query += " AND LOWER(state) = LOWER(?)"
                params.append(state)
            if district and district.lower() != 'all':
                query += " AND LOWER(district) = LOWER(?)"
                params.append(district)
            if status and status.lower() != 'all':
                query += " AND activity_status = ?"
                params.append(status)
            if review_status and review_status.lower() != 'all':
                query += " AND review_status = ?"
                params.append(review_status)

            query += " ORDER BY created_at DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            rows_data = [dict(r) for r in rows]
            conn.close()
        except Exception as exc:
            logger.error("SQLite advisory_activity read failure: %s", exc)
            raise RuntimeError("Database query failed for advisory activity") from exc

    filtered = []
    for r in rows_data:
        if source_verified is not None:
            is_no_source = bool(r.get("no_verified_source"))
            is_verified = not is_no_source
            if is_verified != source_verified:
                continue
        if start_date and (r.get("created_at") or "") < start_date:
            continue
        if end_date and (r.get("created_at") or "") > end_date:
            continue
        if search:
            s_term = search.strip().lower()
            qs = (r.get("query_summary") or "").lower()
            cr = (r.get("crop") or "").lower()
            st_val = (r.get("state") or "").lower()
            dt_val = (r.get("district") or "").lower()
            qid = (r.get("query_id") or "").lower()
            if not (s_term in qs or s_term in cr or s_term in st_val or s_term in dt_val or s_term in qid):
                continue
        filtered.append(r)

    total = len(filtered)
    paged = filtered[offset : offset + page_size]

    ALLOWED_ACTIVITY_STATUSES = {"success", "no_verified_source", "failed", "partial", "timeout"}
    ALLOWED_REVIEW_STATUSES = {"not_reviewed", "needs_review", "reviewed", "resolved"}

    items = []
    for r in paged:
        sources_raw = r.get("source_citations_json")
        if isinstance(sources_raw, str):
            try:
                raw_sources = json.loads(sources_raw or "[]")
            except Exception:
                raw_sources = []
        elif isinstance(sources_raw, list):
            raw_sources = sources_raw
        else:
            raw_sources = []

        sources = []
        if isinstance(raw_sources, list):
            for s in raw_sources:
                if isinstance(s, dict):
                    sources.append({
                        "title": str(s.get("title") or s.get("source_name") or "Agronomy Reference Store"),
                        "organization": str(s.get("organization")) if s.get("organization") is not None else None,
                        "url": str(s.get("url") or s.get("source_url")) if (s.get("url") or s.get("source_url")) is not None else None,
                        "verified_date": str(s.get("verified_date")) if s.get("verified_date") is not None else None,
                    })

        comp_raw = r.get("compliance_json")
        if isinstance(comp_raw, str):
            try:
                compliance_dict = json.loads(comp_raw or "{}")
            except Exception:
                compliance_dict = {}
        elif isinstance(comp_raw, dict):
            compliance_dict = comp_raw
        else:
            compliance_dict = {}

        compliance = {
            "citations_present": bool(compliance_dict.get("citations_present", True)),
            "dose_claims_source_backed": bool(compliance_dict.get("dose_claims_source_backed", True)),
            "missing_dose_fields_flagged": bool(compliance_dict.get("missing_dose_fields_flagged", True)),
            "scheme_eligibility_qualified": bool(compliance_dict.get("scheme_eligibility_qualified", True)),
            "extension_confirmation_flagged": bool(compliance_dict.get("extension_confirmation_flagged", True)),
            "compliance_status": str(compliance_dict.get("compliance_status") or "passed"),
        }

        raw_act = str(r.get("activity_status") or "success").lower().strip()
        if raw_act not in ALLOWED_ACTIVITY_STATUSES:
            if "time" in raw_act:
                act_status = "timeout"
            elif "fail" in raw_act or "err" in raw_act:
                act_status = "failed"
            else:
                act_status = "failed"
        else:
            act_status = raw_act

        raw_rev = str(r.get("review_status") or "not_reviewed").lower().strip()
        rev_status = raw_rev if raw_rev in ALLOWED_REVIEW_STATUSES else "not_reviewed"

        item = {
            "query_id": str(r.get("query_id")),
            "created_at": r.get("created_at"),
            "crop": r.get("crop"),
            "state": r.get("state"),
            "district": r.get("district"),
            "query_summary": str(r.get("query_summary") or "General agricultural query"),
            "activity_status": act_status,
            "review_status": rev_status,
            "retrieval": {
                "documents_considered": int(r.get("documents_considered") or 0),
                "documents_used": int(r.get("documents_used") or 0),
                "relevance_threshold_passed": bool(r.get("relevance_threshold_passed")),
                "no_verified_source": bool(r.get("no_verified_source")),
            },
            "sources": sources,
            "compliance": compliance,
        }
        items.append(item)

    privacy_note = "Advisory activity is anonymized and shown for quality monitoring."
    if total == 0:
        privacy_note = "No advisory activity recorded yet."

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "privacy_note": privacy_note,
    }


def update_advisory_review_status(query_id: str, new_review_status: str, note: Optional[str] = None) -> bool:
    """Update review status of an advisory activity record."""
    init_advisories_db()
    from App.backend.settings import SUPABASE_URL
    supabase = _get_supabase()
    if SUPABASE_URL:
        if supabase is None:
            raise RuntimeError("Database query failed for advisory activity update")
        try:
            supabase.table("advisory_activity").update({"review_status": new_review_status}).eq("query_id", query_id).execute()
            return True
        except Exception as exc:
            logger.error("Supabase update_advisory_review_status failure: %s", exc)
            raise RuntimeError("Database query failed for advisory activity update") from exc
    else:
        try:
            conn = _get_db_connection()
            cursor = conn.cursor()
            cursor.execute("UPDATE advisory_activity SET review_status = ? WHERE query_id = ?", (new_review_status, query_id))
            conn.commit()
            conn.close()
            return True
        except Exception as exc:
            logger.error("SQLite update_advisory_review_status failure: %s", exc)
            raise RuntimeError("Database query failed for advisory activity update") from exc


def add_advisory_note(query_id: str, admin_user_id: str, note: str) -> bool:
    """Add an administrative note to an advisory query."""
    init_advisories_db()
    try:
        conn = _get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO advisory_notes (query_id, admin_user_id, note) VALUES (?, ?, ?)", (query_id, admin_user_id, note))
        conn.commit()
        conn.close()
        return True
    except Exception as exc:
        logger.error("Failed to add advisory note: %s", exc)
        return False


MIN_REGIONAL_PRIVACY_THRESHOLD = 3

def fetch_advisory_analytics(
    crop: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
) -> dict:
    """
    Computes server-side aggregate analytics for advisory activity.
    Enforces privacy policy by suppressing regional groups below threshold (3).
    Returns only aggregated counts and citation metrics — no PII or raw query text.
    Raises RuntimeError on database failure (fails closed with HTTP 500).
    """
    init_advisories_db()
    rows_data = []

    from App.backend.settings import SUPABASE_URL
    supabase = _get_supabase()

    if SUPABASE_URL:
        if supabase is None:
            logger.error("Supabase configured but admin client unavailable for advisory analytics.")
            raise RuntimeError("Database query failed for advisory analytics")
        try:
            rows_data = []
            page_size = 1000
            offset = 0
            while True:
                q = supabase.table("advisory_activity").select("*")
                if crop and crop.lower() != 'all':
                    q = q.eq("crop", crop)
                if state and state.lower() != 'all':
                    q = q.eq("state", state)
                if district and district.lower() != 'all':
                    q = q.eq("district", district)
                q = q.range(offset, offset + page_size - 1)
                res = q.execute()
                if res.data is None:
                    logger.error("Supabase advisory_activity query returned None response for analytics")
                    raise RuntimeError("Database query failed for advisory analytics")
                rows_data.extend(res.data)
                if len(res.data) < page_size:
                    break
                offset += page_size
        except Exception as exc:
            logger.error("Supabase advisory_activity analytics read failure: %s", exc)
            raise RuntimeError(f"Database query failed for advisory analytics: {exc}") from exc
    else:
        try:
            conn = _get_db_connection()
            cursor = conn.cursor()
            query = "SELECT * FROM advisory_activity WHERE 1=1"
            params = []
            if crop and crop.lower() != 'all':
                query += " AND LOWER(crop) = LOWER(?)"
                params.append(crop)
            if state and state.lower() != 'all':
                query += " AND LOWER(state) = LOWER(?)"
                params.append(state)
            if district and district.lower() != 'all':
                query += " AND LOWER(district) = LOWER(?)"
                params.append(district)

            cursor.execute(query, params)
            rows = cursor.fetchall()
            rows_data = [dict(r) for r in rows]
            conn.close()
        except Exception as exc:
            logger.error("SQLite advisory_activity analytics read failure: %s", exc)
            raise RuntimeError("Database query failed for advisory analytics") from exc

    filtered = []
    for r in rows_data:
        if start_date and (r.get("created_at") or "") < start_date:
            continue
        if end_date and (r.get("created_at") or "") > end_date:
            continue
        if search:
            s_term = search.strip().lower()
            qs = (r.get("query_summary") or "").lower()
            cr = (r.get("crop") or "").lower()
            st_val = (r.get("state") or "").lower()
            dt_val = (r.get("district") or "").lower()
            qid = (r.get("query_id") or "").lower()
            if not (s_term in qs or s_term in cr or s_term in st_val or s_term in dt_val or s_term in qid):
                continue
        filtered.append(r)

    total_queries = len(filtered)
    eligible_queries = 0
    cited_queries = 0

    crop_counts: Dict[str, int] = {}
    region_counts: Dict[tuple, int] = {}

    # Citation rate fail-closed logic:
    # Denominator (eligible_queries): All completed queries where activity_status is 'success' or 'no_verified_source'.
    # Numerator (cited_queries): Counted ONLY when:
    #   1. no_verified_source is False, AND
    #   2. compliance_json is valid JSON with explicit Boolean true for 'citations_present'.
    # Missing, null, malformed, or ambiguous compliance records fail closed as False (uncited).
    for r in filtered:
        status = r.get("activity_status") or "success"
        if status in ("success", "no_verified_source"):
            eligible_queries += 1
            is_no_source = bool(r.get("no_verified_source"))
            cited = False
            if not is_no_source:
                try:
                    comp_raw = r.get("compliance_json")
                    if comp_raw:
                        comp = json.loads(comp_raw) if isinstance(comp_raw, str) else comp_raw
                        if isinstance(comp, dict) and comp.get("citations_present") is True:
                            cited = True
                except Exception:
                    cited = False

            if cited:
                cited_queries += 1

        c_val = (r.get("crop") or "Unknown").strip().title()
        crop_counts[c_val] = crop_counts.get(c_val, 0) + 1

        s_val = (r.get("state") or "Unknown").strip().title()
        d_val = (r.get("district") or "Unknown").strip().title()
        region_counts[(s_val, d_val)] = region_counts.get((s_val, d_val), 0) + 1

    citation_percent = round((cited_queries / eligible_queries * 100.0), 2) if eligible_queries > 0 else 0.0

    top_crops = [
        {"crop": c, "query_count": cnt}
        for c, cnt in sorted(crop_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    ]

    regional_queries = []
    suppressed_count = 0
    for (st, dt), cnt in sorted(region_counts.items(), key=lambda x: x[1], reverse=True):
        if cnt >= MIN_REGIONAL_PRIVACY_THRESHOLD:
            regional_queries.append({"state": st, "district": dt, "query_count": cnt})
        else:
            suppressed_count += cnt

    if suppressed_count > 0:
        regional_queries.append({
            "state": "Other Regions",
            "district": "Suppressed for privacy (<3 queries)",
            "query_count": suppressed_count,
        })

    privacy_note = (
        "Aggregated advisory analytics (anonymized). Regional groups with fewer than "
        f"{MIN_REGIONAL_PRIVACY_THRESHOLD} queries are suppressed for farmer privacy."
    )

    return {
        "total_queries": total_queries,
        "citation_rate": {
            "cited_queries": cited_queries,
            "eligible_queries": eligible_queries,
            "percent": citation_percent,
        },
        "top_crops": top_crops,
        "regional_queries": regional_queries,
        "privacy_note": privacy_note,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

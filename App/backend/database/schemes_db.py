"""
AgriFusion — Government Schemes Verification Registry Module
==============================================================
Manages authoritative central & state government agricultural schemes
(PM-KISAN, PMFBY, KCC, Soil Health Card, Rythu Bharosa, Rythu Bandhu, SMAM).
Tracks verification status, official portals, state/district relevance, benefits, caveats.
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


_schemes_db_initialized = False


def init_schemes_db():
    """Create government_schemes table and seed default verified schemes if empty."""
    global _schemes_db_initialized
    if _schemes_db_initialized:
        return
    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS government_schemes (
            id                      TEXT PRIMARY KEY,
            scheme_name             TEXT NOT NULL,
            scheme_type             TEXT NOT NULL,
            state_relevance_json    TEXT,
            district_relevance_json TEXT,
            department              TEXT NOT NULL,
            official_portal         TEXT NOT NULL,
            source_title            TEXT,
            source_organization     TEXT,
            source_url              TEXT,
            verification_status     TEXT DEFAULT 'pending_review',
            current_status          TEXT DEFAULT 'requires_current_verification',
            verified_date           TEXT,
            last_checked_at         TIMESTAMP,
            verified_by_admin_id    TEXT,
            verification_notes      TEXT,
            benefit_summary         TEXT,
            eligibility_summary     TEXT,
            required_documents_json TEXT,
            application_route       TEXT,
            deadline                TEXT,
            caveats_json            TEXT,
            is_active              BOOLEAN DEFAULT 1,
            needs_review            BOOLEAN DEFAULT 0,
            created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()

    # Seed canonical schemes if empty
    cursor.execute("SELECT COUNT(*) FROM government_schemes")
    count = cursor.fetchone()[0]
    if count == 0:
        now_iso = datetime.now(timezone.utc).isoformat()
        today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        seed_schemes = [
            {
                "id": "sch-pmkisan-01",
                "scheme_name": "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)",
                "scheme_type": "farmer_income_support",
                "state_relevance": ["All India", "Andhra Pradesh", "Telangana"],
                "district_relevance": [],
                "department": "Ministry of Agriculture & Farmers Welfare",
                "official_portal": "https://pmkisan.gov.in/",
                "source_title": "PM-KISAN Official Scheme Operational Guidelines",
                "source_organization": "Department of Agriculture & Farmers Welfare, GoI",
                "source_url": "https://pmkisan.gov.in/",
                "verification_status": "verified",
                "current_status": "active",
                "verified_date": today_date,
                "last_checked_at": now_iso,
                "verified_by_admin_id": "system_admin",
                "verification_notes": "Verified from official GoI portal operational guidelines.",
                "benefit_summary": "₹6,000 per year paid in three equal installments of ₹2,000 directly into bank accounts.",
                "eligibility_summary": "Possible match; official verification required. Landholding farmer families with cultivable land, subject to institutional landholder exclusion criteria.",
                "required_documents": ["Aadhaar Card", "Land ownership document (7/12 or Khatauni)", "Bank Account Details"],
                "application_route": "PM-KISAN portal or CSC Centers",
                "deadline": None,
                "caveats": ["e-KYC and Aadhaar seeding of bank account mandatory for installment release."],
                "is_active": 1,
                "needs_review": 0,
            },
            {
                "id": "sch-pmfby-01",
                "scheme_name": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
                "scheme_type": "crop_insurance",
                "state_relevance": ["All India", "Andhra Pradesh", "Telangana"],
                "district_relevance": [],
                "department": "Ministry of Agriculture & Farmers Welfare",
                "official_portal": "https://pmfby.gov.in/",
                "source_title": "PMFBY Official Crop Insurance Guidelines",
                "source_organization": "Department of Agriculture & Farmers Welfare, GoI",
                "source_url": "https://pmfby.gov.in/",
                "verification_status": "verified_with_caveats",
                "current_status": "requires_current_verification",
                "verified_date": today_date,
                "last_checked_at": now_iso,
                "verified_by_admin_id": "system_admin",
                "verification_notes": "Official crop insurance portal. State participation and cut-off dates vary by season.",
                "benefit_summary": "Comprehensive risk cover for yield losses due to non-preventable natural risks.",
                "eligibility_summary": "Possible match; official verification required. All farmers including sharecroppers and tenant farmers growing notified crops in notified areas.",
                "required_documents": ["Land records / tenancy certificate", "Aadhaar Card", "Bank passbook"],
                "application_route": "National Crop Insurance Portal (NCIP), banks, or CSC",
                "deadline": None,
                "caveats": ["Cut-off dates and notified crops vary by state and district each season."],
                "is_active": 1,
                "needs_review": 0,
            },
            {
                "id": "sch-kcc-01",
                "scheme_name": "Kisan Credit Card (KCC) Scheme",
                "scheme_type": "agricultural_credit",
                "state_relevance": ["All India", "Andhra Pradesh", "Telangana"],
                "district_relevance": [],
                "department": "Department of Agriculture / Reserve Bank of India",
                "official_portal": "https://agriwelfare.gov.in/",
                "source_title": "KCC Official Credit Limit & Interest Subvention Guidelines",
                "source_organization": "NABARD / Ministry of Agriculture",
                "source_url": "https://agriwelfare.gov.in/",
                "verification_status": "verified",
                "current_status": "active",
                "verified_date": today_date,
                "last_checked_at": now_iso,
                "verified_by_admin_id": "system_admin",
                "verification_notes": "Official credit scheme providing concessional short-term agricultural credit.",
                "benefit_summary": "Concessional short-term crop loans up to ₹3 lakh with 2% interest subvention and 3% prompt repayment incentive.",
                "eligibility_summary": "Possible match; official verification required. Individual/joint borrowers, tenant farmers, oral lessees, and SHGs.",
                "required_documents": ["Application form", "Land records", "Aadhaar Card", "PAN / Form 60"],
                "application_route": "Commercial Banks, RRBs, Cooperative Banks",
                "deadline": None,
                "caveats": ["Prompt repayment incentive applies only if loans are repaid within specified due date."],
                "is_active": 1,
                "needs_review": 0,
            },
            {
                "id": "sch-shc-01",
                "scheme_name": "Soil Health Card Scheme",
                "scheme_type": "soil_health",
                "state_relevance": ["All India", "Andhra Pradesh", "Telangana"],
                "district_relevance": [],
                "department": "Department of Agriculture & Farmers Welfare",
                "official_portal": "https://soilhealth.dac.gov.in/",
                "source_title": "Soil Health Card Portal & Testing Guidelines",
                "source_organization": "Department of Agriculture & Farmers Welfare, GoI",
                "source_url": "https://soilhealth.dac.gov.in/",
                "verification_status": "verified",
                "current_status": "active",
                "verified_date": today_date,
                "last_checked_at": now_iso,
                "verified_by_admin_id": "system_admin",
                "verification_notes": "Official portal providing soil nutrient status and crop-wise fertilizer dosage recommendations.",
                "benefit_summary": "Customized soil nutrient status report and crop-specific nutrient recommendations once every 3 years.",
                "eligibility_summary": "Possible match; official verification required. All landholding farmers across participating states.",
                "required_documents": ["Land identification number / Survey number"],
                "application_route": "Local District Agriculture Officer / Soil Testing Laboratory",
                "deadline": None,
                "caveats": ["Soil sampling cycles depend on local district agriculture department schedules."],
                "is_active": 1,
                "needs_review": 0,
            },
        ]

        for s in seed_schemes:
            cursor.execute("""
                INSERT INTO government_schemes (
                    id, scheme_name, scheme_type, state_relevance_json, district_relevance_json,
                    department, official_portal, source_title, source_organization, source_url,
                    verification_status, current_status, verified_date, last_checked_at,
                    verified_by_admin_id, verification_notes, benefit_summary, eligibility_summary,
                    required_documents_json, application_route, deadline, caveats_json, is_active, needs_review
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                s["id"], s["scheme_name"], s["scheme_type"], json.dumps(s["state_relevance"]),
                json.dumps(s["district_relevance"]), s["department"], s["official_portal"],
                s["source_title"], s["source_organization"], s["source_url"],
                s["verification_status"], s["current_status"], s["verified_date"],
                s["last_checked_at"], s["verified_by_admin_id"], s["verification_notes"],
                s["benefit_summary"], s["eligibility_summary"], json.dumps(s["required_documents"]),
                s["application_route"], s["deadline"], json.dumps(s["caveats"]),
                s["is_active"], s["needs_review"]
            ))
        conn.commit()

    conn.close()
    _schemes_db_initialized = True


def fetch_government_schemes_list(
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    department: Optional[str] = None,
    scheme_type: Optional[str] = None,
    verification_status: Optional[str] = None,
    current_status: Optional[str] = None,
) -> dict:
    """Fetch paginated government schemes with filtering support."""
    init_schemes_db()
    offset = (page - 1) * page_size

    rows_data = []
    supabase = _get_supabase()
    if supabase is not None:
        try:
            q = supabase.table("government_schemes").select("*").order("created_at", desc=True)
            if department:
                q = q.eq("department", department)
            if scheme_type:
                q = q.eq("scheme_type", scheme_type)
            if verification_status:
                q = q.eq("verification_status", verification_status)
            if current_status:
                q = q.eq("current_status", current_status)
            res = q.execute()
            if res.data:
                rows_data = res.data
        except Exception:
            rows_data = []

    if not rows_data:
        try:
            conn = _get_db_connection()
            cursor = conn.cursor()
            query = "SELECT * FROM government_schemes WHERE 1=1"
            params = []
            if department:
                query += " AND LOWER(department) = LOWER(?)"
                params.append(department)
            if scheme_type:
                query += " AND scheme_type = ?"
                params.append(scheme_type)
            if verification_status:
                query += " AND verification_status = ?"
                params.append(verification_status)
            if current_status:
                query += " AND current_status = ?"
                params.append(current_status)

            query += " ORDER BY created_at DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            rows_data = [dict(r) for r in rows]
            conn.close()
        except Exception:
            rows_data = []

    # In-memory search, state, district filters
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

        if district:
            dist_rel = []
            try:
                dist_rel = json.loads(r.get("district_relevance_json") or "[]")
            except Exception:
                dist_rel = []
            if dist_rel and district.lower() not in [d.lower() for d in dist_rel]:
                continue

        if search:
            s_lower = search.lower()
            name = (r.get("scheme_name") or "").lower()
            dept = (r.get("department") or "").lower()
            ben = (r.get("benefit_summary") or "").lower()
            elig = (r.get("eligibility_summary") or "").lower()
            if s_lower not in name and s_lower not in dept and s_lower not in ben and s_lower not in elig:
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
            dist_list = json.loads(r.get("district_relevance_json") or "[]")
        except Exception:
            dist_list = []
        try:
            docs = json.loads(r.get("required_documents_json") or "[]")
        except Exception:
            docs = []
        try:
            caveats = json.loads(r.get("caveats_json") or "[]")
        except Exception:
            caveats = []

        items.append({
            "id": str(r.get("id")),
            "scheme_name": r.get("scheme_name"),
            "scheme_type": r.get("scheme_type"),
            "state_relevance": st_list,
            "district_relevance": dist_list,
            "department": r.get("department"),
            "official_portal": r.get("official_portal"),
            "source_title": r.get("source_title") or "Official scheme notification",
            "source_organization": r.get("source_organization") or "Government organization",
            "verification_status": r.get("verification_status") or "pending_review",
            "current_status": r.get("current_status") or "requires_current_verification",
            "verified_date": r.get("verified_date"),
            "verified_by": r.get("verified_by_admin_id"),
            "last_checked_at": r.get("last_checked_at"),
            "benefit_summary": r.get("benefit_summary") or "Benefit stated in the verified official source.",
            "eligibility_summary": r.get("eligibility_summary") or "Possible match; official verification required.",
            "required_documents": docs,
            "application_route": r.get("application_route") or "",
            "deadline": r.get("deadline"),
            "caveats": caveats,
            "is_active": bool(r.get("is_active")),
            "needs_review": bool(r.get("needs_review")),
        })

    privacy_note = "Scheme information is source-backed and may require current official verification."
    if total == 0:
        privacy_note = "No government schemes have been registered for verification yet."

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "privacy_note": privacy_note,
    }


def get_government_scheme_detail(scheme_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve single scheme detail."""
    init_schemes_db()
    r = None

    supabase = _get_supabase()
    if supabase is not None:
        try:
            res = supabase.table("government_schemes").select("*").eq("id", scheme_id).execute()
            if res.data:
                r = res.data[0]
        except Exception:
            pass

    if not r:
        try:
            conn = _get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM government_schemes WHERE id = ?", (scheme_id,))
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
        dist_list = json.loads(r.get("district_relevance_json") or "[]")
    except Exception:
        dist_list = []
    try:
        docs = json.loads(r.get("required_documents_json") or "[]")
    except Exception:
        docs = []
    try:
        caveats = json.loads(r.get("caveats_json") or "[]")
    except Exception:
        caveats = []

    return {
        "id": str(r.get("id")),
        "scheme_name": r.get("scheme_name"),
        "scheme_type": r.get("scheme_type"),
        "state_relevance": st_list,
        "district_relevance": dist_list,
        "department": r.get("department"),
        "official_portal": r.get("official_portal"),
        "source_title": r.get("source_title") or "Official scheme notification",
        "source_organization": r.get("source_organization") or "Government organization",
        "source_url": r.get("source_url"),
        "verification_status": r.get("verification_status") or "pending_review",
        "current_status": r.get("current_status") or "requires_current_verification",
        "verified_date": r.get("verified_date"),
        "last_checked_at": r.get("last_checked_at"),
        "verified_by": r.get("verified_by_admin_id"),
        "verification_notes": r.get("verification_notes"),
        "benefit_summary": r.get("benefit_summary") or "Benefit stated in the verified official source.",
        "eligibility_summary": r.get("eligibility_summary") or "Possible match; official verification required.",
        "required_documents": docs,
        "application_route": r.get("application_route") or "",
        "deadline": r.get("deadline"),
        "caveats": caveats,
        "is_active": bool(r.get("is_active")),
        "needs_review": bool(r.get("needs_review")),
    }


def register_government_scheme(
    scheme_name: str,
    scheme_type: str,
    department: str,
    official_portal: str,
    state_relevance: Optional[List[str]] = None,
    district_relevance: Optional[List[str]] = None,
    source_title: Optional[str] = None,
    source_organization: Optional[str] = None,
    benefit_summary: Optional[str] = None,
    eligibility_summary: Optional[str] = None,
    required_documents: Optional[List[str]] = None,
    application_route: Optional[str] = None,
    deadline: Optional[str] = None,
    caveats: Optional[List[str]] = None,
) -> Tuple[bool, Union[Dict[str, Any], str]]:
    """Register a new government scheme for verification. Initial status: pending_review."""
    init_schemes_db()

    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM government_schemes WHERE official_portal = ?", (official_portal,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return False, "Duplicate official portal URL already registered in scheme registry."

    scheme_id = f"sch-{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    st_list = state_relevance or ["All India"]
    dist_list = district_relevance or []
    docs = required_documents or []
    cav_list = caveats or ["Current eligibility and deadlines must be confirmed on official portal."]

    ben_text = benefit_summary.strip() if benefit_summary else "Benefit stated in the verified official source."
    elig_text = eligibility_summary.strip() if eligibility_summary else "Possible match; official verification required."

    record = {
        "id": scheme_id,
        "scheme_name": scheme_name.strip(),
        "scheme_type": scheme_type,
        "state_relevance_json": json.dumps(st_list),
        "district_relevance_json": json.dumps(dist_list),
        "department": department.strip(),
        "official_portal": official_portal.strip(),
        "source_title": source_title.strip() if source_title else "Official scheme notification",
        "source_organization": source_organization.strip() if source_organization else department.strip(),
        "source_url": official_portal.strip(),
        "verification_status": "pending_review",
        "current_status": "requires_current_verification",
        "verified_date": None,
        "last_checked_at": now_iso,
        "verified_by_admin_id": None,
        "verification_notes": None,
        "benefit_summary": ben_text,
        "eligibility_summary": elig_text,
        "required_documents_json": json.dumps(docs),
        "application_route": application_route.strip() if application_route else "",
        "deadline": deadline.strip() if deadline else None,
        "caveats_json": json.dumps(cav_list),
        "is_active": True,
        "needs_review": True,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    supabase = _get_supabase()
    if supabase is not None:
        try:
            supabase.table("government_schemes").insert(record).execute()
        except Exception:
            pass

    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO government_schemes (
            id, scheme_name, scheme_type, state_relevance_json, district_relevance_json,
            department, official_portal, source_title, source_organization, source_url,
            verification_status, current_status, verified_date, last_checked_at,
            verified_by_admin_id, verification_notes, benefit_summary, eligibility_summary,
            required_documents_json, application_route, deadline, caveats_json,
            is_active, needs_review, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        record["id"], record["scheme_name"], record["scheme_type"], record["state_relevance_json"],
        record["district_relevance_json"], record["department"], record["official_portal"],
        record["source_title"], record["source_organization"], record["source_url"],
        record["verification_status"], record["current_status"], record["verified_date"],
        record["last_checked_at"], record["verified_by_admin_id"], record["verification_notes"],
        record["benefit_summary"], record["eligibility_summary"], record["required_documents_json"],
        record["application_route"], record["deadline"], record["caveats_json"],
        1 if record["is_active"] else 0, 1 if record["needs_review"] else 0,
        record["created_at"], record["updated_at"]
    ))
    conn.commit()
    conn.close()

    res_obj = get_government_scheme_detail(scheme_id)
    return True, res_obj or record


def update_government_scheme_record(
    scheme_id: str,
    admin_user_id: str,
    verification_status: Optional[str] = None,
    current_status: Optional[str] = None,
    verification_notes: Optional[str] = None,
    is_active: Optional[bool] = None,
    needs_review: Optional[bool] = None,
    caveats: Optional[List[str]] = None,
) -> Tuple[bool, Union[Dict[str, Any], str]]:
    """Update government scheme verification metadata, notes, or caveats."""
    existing = get_government_scheme_detail(scheme_id)
    if not existing:
        return False, "Scheme record not found."

    now_iso = datetime.now(timezone.utc).isoformat()
    today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    new_ver = verification_status if verification_status is not None else existing["verification_status"]
    new_curr = current_status if current_status is not None else existing["current_status"]
    new_notes = verification_notes if verification_notes is not None else existing.get("verification_notes")
    new_active = is_active if is_active is not None else existing["is_active"]
    new_review = needs_review if needs_review is not None else existing["needs_review"]
    new_caveats = caveats if caveats is not None else existing.get("caveats", [])

    # Validation rules
    if verification_status == "verified":
        if not existing.get("official_portal"):
            return False, "Verified status requires a valid official portal URL."
    if verification_status == "verified_with_caveats" and not new_caveats:
        return False, "verified_with_caveats status requires at least one written caveat."
    if verification_status in ("stale", "unavailable", "rejected") and not new_notes:
        return False, f"Status '{verification_status}' requires verification notes/reason."

    verified_date = existing.get("verified_date")
    verified_by = existing.get("verified_by")
    if verification_status in ("verified", "verified_with_caveats"):
        verified_date = today_date
        verified_by = admin_user_id

    updates = {
        "verification_status": new_ver,
        "current_status": new_curr,
        "verification_notes": new_notes,
        "is_active": new_active,
        "needs_review": new_review,
        "caveats_json": json.dumps(new_caveats),
        "verified_date": verified_date,
        "verified_by_admin_id": verified_by,
        "last_checked_at": now_iso,
        "updated_at": now_iso,
    }

    supabase = _get_supabase()
    if supabase is not None:
        try:
            supabase.table("government_schemes").update(updates).eq("id", scheme_id).execute()
        except Exception:
            pass

    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE government_schemes
        SET verification_status = ?, current_status = ?, verification_notes = ?,
            is_active = ?, needs_review = ?, caveats_json = ?, verified_date = ?,
            verified_by_admin_id = ?, last_checked_at = ?, updated_at = ?
        WHERE id = ?
    """, (
        new_ver, new_curr, new_notes, 1 if new_active else 0,
        1 if new_review else 0, json.dumps(new_caveats),
        verified_date, verified_by, now_iso, now_iso, scheme_id
    ))
    conn.commit()
    conn.close()

    res_obj = get_government_scheme_detail(scheme_id)
    return True, res_obj


def verify_government_scheme(
    scheme_id: str,
    admin_user_id: str,
    official_source_url: str,
    verification_notes: str,
    current_status: Optional[str] = "requires_current_verification",
    caveats: Optional[List[str]] = None,
) -> Tuple[bool, Union[Dict[str, Any], str]]:
    """Mark a scheme as officially verified by an authorized administrator."""
    existing = get_government_scheme_detail(scheme_id)
    if not existing:
        return False, "Scheme record not found."

    if not official_source_url or not (official_source_url.startswith("http://") or official_source_url.startswith("https://")):
        return False, "Official source URL must be a valid http:// or https:// link."

    if not verification_notes or not verification_notes.strip():
        return False, "Verification notes cannot be empty."

    now_iso = datetime.now(timezone.utc).isoformat()
    today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cav_list = caveats or existing.get("caveats", [])
    ver_status = "verified_with_caveats" if cav_list else "verified"

    updates = {
        "source_url": official_source_url.strip(),
        "verification_status": ver_status,
        "current_status": current_status or "requires_current_verification",
        "verification_notes": verification_notes.strip(),
        "verified_by_admin_id": admin_user_id,
        "verified_date": today_date,
        "last_checked_at": now_iso,
        "needs_review": False,
        "caveats_json": json.dumps(cav_list),
        "updated_at": now_iso,
    }

    supabase = _get_supabase()
    if supabase is not None:
        try:
            supabase.table("government_schemes").update(updates).eq("id", scheme_id).execute()
        except Exception:
            pass

    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE government_schemes
        SET source_url = ?, verification_status = ?, current_status = ?,
            verification_notes = ?, verified_by_admin_id = ?, verified_date = ?,
            last_checked_at = ?, needs_review = 0, caveats_json = ?, updated_at = ?
        WHERE id = ?
    """, (
        official_source_url.strip(), ver_status, current_status or "requires_current_verification",
        verification_notes.strip(), admin_user_id, today_date, now_iso,
        json.dumps(cav_list), now_iso, scheme_id
    ))
    conn.commit()
    conn.close()

    res_obj = get_government_scheme_detail(scheme_id)
    return True, res_obj


def recheck_government_scheme(
    scheme_id: str,
    admin_user_id: str,
) -> Tuple[bool, Union[Dict[str, Any], str]]:
    """Flag a scheme for official re-verification review."""
    existing = get_government_scheme_detail(scheme_id)
    if not existing:
        return False, "Scheme record not found."

    now_iso = datetime.now(timezone.utc).isoformat()
    updates = {
        "needs_review": True,
        "verification_status": "needs_review",
        "updated_at": now_iso,
    }

    supabase = _get_supabase()
    if supabase is not None:
        try:
            supabase.table("government_schemes").update(updates).eq("id", scheme_id).execute()
        except Exception:
            pass

    conn = _get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE government_schemes
        SET needs_review = 1, verification_status = 'needs_review', updated_at = ?
        WHERE id = ?
    """, (now_iso, scheme_id))
    conn.commit()
    conn.close()

    return True, {
        "scheme_id": scheme_id,
        "verification_status": "needs_review",
        "needs_review": True,
        "message": "Scheme queued for re-verification review.",
    }

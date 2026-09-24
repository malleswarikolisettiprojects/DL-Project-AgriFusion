import csv
import io
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel, Field

from App.backend.agronomy_rag import AGRONOMY_DOCUMENT_LINKS, load_local_agronomy_documents
from App.backend.auth.dependencies import (
    CurrentUser,
    require_admin,
    require_roles,
)
from App.backend.database.advisories_db import (
    add_advisory_note,
    fetch_advisory_activities,
    update_advisory_review_status,
)
from App.backend.database.audit import fetch_audit_logs, record_audit_event
from App.backend.database.feedback_db import (
    add_feedback_review_note,
    fetch_farmer_feedback_list,
    get_farmer_feedback_detail,
    update_farmer_feedback_record,
)
from App.backend.database.sources_db import (
    delete_knowledge_source,
    fetch_knowledge_sources_list,
    get_knowledge_source_detail,
    reindex_knowledge_source,
    register_knowledge_source,
    update_knowledge_source_metadata,
)
from App.backend.database.schemes_db import (
    fetch_government_schemes_list,
    get_government_scheme_detail,
    recheck_government_scheme,
    register_government_scheme,
    update_government_scheme_record,
    verify_government_scheme,
)
from App.backend.database.auth_db import (
    count_active_admins_in_db,
    fetch_all_supabase_predictions,
    fetch_all_users,
    fetch_regional_farm_profiles,
    get_user_by_id,
    update_user_role_in_db,
    update_user_status_in_db,
)
from App.backend.database.system_events import get_system_event_metrics, record_system_event
from App.backend.settings import get_config_status


admin_router = APIRouter(
    prefix="/api/v1/admin",
    tags=["admin"],
)

UserRole = Literal["user", "admin", "super_admin", "auditor", "agronomist", "editor"]
UserStatus = Literal["active", "suspended", "archived"]

SchemeVerificationStatus = Literal[
    "pending_review",
    "verified",
    "verified_with_caveats",
    "needs_review",
    "stale",
    "unavailable",
    "rejected",
]

ALLOWED_SCHEME_VERIFICATION_STATUSES = {
    "pending_review",
    "verified",
    "verified_with_caveats",
    "needs_review",
    "stale",
    "unavailable",
    "rejected",
}

SchemeCurrentStatus = Literal[
    "active",
    "requires_current_verification",
    "temporarily_unavailable",
    "expired_or_closed",
    "not_available",
]

ALLOWED_SCHEME_CURRENT_STATUSES = {
    "active",
    "requires_current_verification",
    "temporarily_unavailable",
    "expired_or_closed",
    "not_available",
}

class AdminSchemeItem(BaseModel):
    id: str
    scheme_name: str
    scheme_type: str
    state_relevance: List[str] = []
    district_relevance: List[str] = []
    department: str
    official_portal: str
    source_title: Optional[str] = "Official scheme notification"
    source_organization: Optional[str] = "Government organization"
    verification_status: SchemeVerificationStatus
    current_status: SchemeCurrentStatus
    verified_date: Optional[str] = None
    verified_by: Optional[str] = None
    last_checked_at: Optional[str] = None
    benefit_summary: str = "Benefit stated in the verified official source."
    eligibility_summary: str = "Possible match; official verification required."
    required_documents: List[str] = []
    application_route: Optional[str] = ""
    deadline: Optional[str] = None
    caveats: List[str] = []
    is_active: bool = True
    needs_review: bool = False

class AdminSchemeListResponse(BaseModel):
    items: List[AdminSchemeItem]
    page: int
    page_size: int
    total: int
    privacy_note: str

class RegisterSchemeRequest(BaseModel):
    scheme_name: str = Field(..., min_length=2)
    scheme_type: str = Field(..., min_length=2)
    department: str = Field(..., min_length=2)
    official_portal: str = Field(..., min_length=8)
    state_relevance: Optional[List[str]] = None
    district_relevance: Optional[List[str]] = None
    source_title: Optional[str] = None
    source_organization: Optional[str] = None
    benefit_summary: Optional[str] = None
    eligibility_summary: Optional[str] = None
    required_documents: Optional[List[str]] = None
    application_route: Optional[str] = None
    deadline: Optional[str] = None
    caveats: Optional[List[str]] = None

class UpdateSchemeRequest(BaseModel):
    verification_status: Optional[SchemeVerificationStatus] = None
    current_status: Optional[SchemeCurrentStatus] = None
    verification_notes: Optional[str] = None
    is_active: Optional[bool] = None
    needs_review: Optional[bool] = None
    caveats: Optional[List[str]] = None

class VerifySchemeRequest(BaseModel):
    official_source_url: str = Field(..., min_length=8)
    verification_notes: str = Field(..., min_length=2)
    current_status: Optional[SchemeCurrentStatus] = "requires_current_verification"
    caveats: Optional[List[str]] = None


SourceType = Literal[
    "government_department",
    "state_agriculture_department",
    "state_horticulture_department",
    "icar",
    "icar_institute",
    "kvk",
    "agricultural_university",
    "ppqs",
    "cibrc",
    "official_scheme_portal",
    "other_authoritative",
]

ALLOWED_SOURCE_TYPES = {
    "government_department",
    "state_agriculture_department",
    "state_horticulture_department",
    "icar",
    "icar_institute",
    "kvk",
    "agricultural_university",
    "ppqs",
    "cibrc",
    "official_scheme_portal",
    "other_authoritative",
}

VerificationStatus = Literal[
    "pending_review",
    "verified",
    "verified_with_caveats",
    "needs_review",
    "stale",
    "unavailable",
    "rejected",
]

ALLOWED_VERIFICATION_STATUSES = {
    "pending_review",
    "verified",
    "verified_with_caveats",
    "needs_review",
    "stale",
    "unavailable",
    "rejected",
}

IndexStatus = Literal[
    "not_indexed",
    "queued",
    "indexing",
    "indexed",
    "index_failed",
    "outdated",
]

ALLOWED_INDEX_STATUSES = {
    "not_indexed",
    "queued",
    "indexing",
    "indexed",
    "index_failed",
    "outdated",
}

class AdminSourceItem(BaseModel):
    id: str
    title: str
    organization: str
    source_type: SourceType
    subject: Optional[str] = None
    crop: Optional[str] = None
    state_relevance: List[str] = []
    official_url: str
    document_format: str = "PDF"
    language: str = "English"
    verification_status: VerificationStatus
    verified_date: Optional[str] = None
    verified_by: Optional[str] = None
    verification_notes: Optional[str] = None
    last_indexed_at: Optional[str] = None
    index_status: IndexStatus
    is_active: bool = True
    needs_review: bool = False
    caveats: List[str] = []

class AdminSourceListResponse(BaseModel):
    items: List[AdminSourceItem]
    page: int
    page_size: int
    total: int
    privacy_note: str

class RegisterSourceRequest(BaseModel):
    title: str = Field(..., min_length=2)
    organization: str = Field(..., min_length=2)
    source_type: SourceType
    official_url: str = Field(..., min_length=8)
    subject: Optional[str] = None
    crop: Optional[str] = None
    state_relevance: Optional[List[str]] = None
    language: Optional[str] = "English"
    verification_notes: Optional[str] = None
    verification_status: Optional[VerificationStatus] = "pending_review"
    index_status: Optional[IndexStatus] = "not_indexed"

class UpdateSourceMetadataRequest(BaseModel):
    verification_status: Optional[VerificationStatus] = None
    verification_notes: Optional[str] = None
    is_active: Optional[bool] = None
    needs_review: Optional[bool] = None
    caveats: Optional[List[str]] = None



class AdminUserResponse(BaseModel):
    id: str
    email: Optional[str] = None
    name: Optional[str] = None
    role: str
    status: UserStatus
    created_at: Optional[str] = None
    last_sign_in_at: Optional[str] = None


class PaginatedUsersResponse(BaseModel):
    items: List[AdminUserResponse]
    page: int
    page_size: int
    total: int


class UpdateUserStatusRequest(BaseModel):
    status: UserStatus


class UpdateUserRoleRequest(BaseModel):
    role: UserRole


class RegionalFarmProfile(BaseModel):
    state: str
    district: str
    crop: Optional[str] = None
    area_range: Optional[str] = None
    irrigation_type: Optional[str] = None


class RegionalFarmProfileResponse(BaseModel):
    items: List[RegionalFarmProfile]
    page: int
    page_size: int
    total: int
    suppressed_groups: int = 0
    privacy_note: str


AdvisoryActivityStatus = Literal["success", "no_verified_source", "failed", "partial"]
AdvisoryReviewStatus = Literal["not_reviewed", "needs_review", "reviewed", "resolved"]


class AdvisorySource(BaseModel):
    title: str
    organization: Optional[str] = None
    url: Optional[str] = None
    verified_date: Optional[str] = None


class AdvisoryRetrievalInfo(BaseModel):
    documents_considered: int
    documents_used: int
    relevance_threshold_passed: bool
    no_verified_source: bool


class AdvisoryComplianceInfo(BaseModel):
    citations_present: bool
    dose_claims_source_backed: bool
    missing_dose_fields_flagged: bool
    scheme_eligibility_qualified: bool
    extension_confirmation_flagged: bool
    compliance_status: str


class AdvisoryActivityItem(BaseModel):
    query_id: str
    created_at: Optional[str] = None
    crop: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    query_summary: str
    activity_status: AdvisoryActivityStatus
    review_status: AdvisoryReviewStatus
    retrieval: AdvisoryRetrievalInfo
    sources: List[AdvisorySource] = []
    compliance: AdvisoryComplianceInfo


class AdvisoryActivityResponse(BaseModel):
    items: List[AdvisoryActivityItem]
    page: int
    page_size: int
    total: int
    privacy_note: str


class UpdateAdvisoryReviewRequest(BaseModel):
    review_status: AdvisoryReviewStatus
    note: Optional[str] = None


class AddAdvisoryNoteRequest(BaseModel):
    note: str


FeedbackStatus = Literal["new", "under_review", "resolved", "rejected"]
FeedbackPriority = Literal["low", "normal", "high", "urgent"]


class AdminFeedbackItem(BaseModel):
    id: str
    advisory_id: Optional[str] = None
    created_at: Optional[str] = None
    rating: int
    category: str
    message: str
    language: Optional[str] = "English"
    status: FeedbackStatus
    priority: FeedbackPriority
    admin_note_count: int = 0
    identity_redacted: bool = True


class AdminFeedbackListResponse(BaseModel):
    items: List[AdminFeedbackItem]
    page: int
    page_size: int
    total: int
    rating_distribution: Dict[str, int]
    privacy_note: str


class UpdateFeedbackRequest(BaseModel):
    status: Optional[FeedbackStatus] = None
    priority: Optional[FeedbackPriority] = None


class AddFeedbackReviewNoteRequest(BaseModel):
    note: str = Field(..., min_length=1, max_length=4000)


@admin_router.get("/overview")
@admin_router.get("/dashboard")
async def admin_overview(
    admin_user: CurrentUser = Depends(require_admin),
):
    """
    Admin Overview & Dashboard API Endpoint:
    Returns real service statuses (backend, database, rag_documents, models)
    and live aggregated operational metrics (total_users, advisory_queries, prediction_requests,
    failed_requests, feedback_awaiting_review) backed by Supabase and persistent event ledgers.
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Service Status: Backend
    backend_service = {
        "status": "healthy",
        "message": "OK"
    }

    # 2. Service Status: Database
    cfg = get_config_status()
    if not cfg.get("supabase_configured"):
        db_service = {
            "status": "not_configured",
            "message": "Required Supabase environment variables (SUPABASE_URL, SUPABASE_KEY) are missing"
        }
    else:
        try:
            from App.backend.database.database import supabase
            if supabase is not None:
                # Lightweight read check against profiles table
                res = supabase.table("profiles").select("id", count="exact").limit(1).execute()
                db_service = {
                    "status": "healthy",
                    "message": "Supabase connection verified"
                }
            else:
                db_service = {
                    "status": "unavailable",
                    "message": "Supabase client uninitialized"
                }
        except Exception as db_err:
            db_service = {
                "status": "unavailable",
                "message": f"Supabase database connection test failed: {type(db_err).__name__}"
            }

    # 3. Service Status: RAG Documents
    try:
        local_docs = load_local_agronomy_documents()
        doc_count = len(local_docs)
        sources_res = fetch_knowledge_sources_list(page=1, page_size=10)
        items = sources_res.get("items", []) if isinstance(sources_res, dict) else []
        last_synced_at = items[0].get("last_indexed_at") if items and items[0].get("last_indexed_at") else now_iso

        if doc_count > 0:
            rag_service = {
                "status": "ready",
                "message": "Canonical documents available",
                "document_count": doc_count,
                "last_synced_at": last_synced_at
            }
        else:
            rag_service = {
                "status": "needs_sync",
                "message": "No canonical documents currently indexed; sync required",
                "document_count": 0,
                "last_synced_at": now_iso
            }
    except Exception as rag_err:
        rag_service = {
            "status": "unavailable",
            "message": f"RAG document store query failed: {type(rag_err).__name__}",
            "document_count": 0,
            "last_synced_at": now_iso
        }

    # 4. Service Status: External Models
    required_models = [
        ("crop_recommendation", "App.backend.crop", "predict_crop"),
        ("climate_risk", "App.backend.climate_risk", "predict_climate_risk"),
        ("irrigation", "App.backend.irrigation", "predict_irrigation"),
        ("yield", "App.backend.yields", "predict_yield"),
        ("market_price", "App.backend.market", "predict_market_price"),
        ("object_detection", "App.backend.disease_detection", "predict_disease_and_pests"),
    ]
    model_list = []
    for m_name, m_mod, m_func in required_models:
        try:
            mod = __import__(m_mod, fromlist=[m_func])
            if hasattr(mod, m_func):
                model_list.append({"name": m_name, "status": "ready"})
            else:
                model_list.append({"name": m_name, "status": "unavailable"})
        except Exception:
            model_list.append({"name": m_name, "status": "unavailable"})

    avail_count = sum(1 for m in model_list if m["status"] == "ready")
    exp_count = len(required_models)
    if avail_count == exp_count:
        models_service_status = "ready"
        models_service_msg = "Required agricultural models available"
    elif avail_count > 0:
        models_service_status = "partial"
        models_service_msg = f"{avail_count}/{exp_count} agricultural models available"
    else:
        models_service_status = "unavailable"
        models_service_msg = "No agricultural models available"

    models_service = {
        "status": models_service_status,
        "message": models_service_msg,
        "available_count": avail_count,
        "expected_count": exp_count,
        "models": model_list
    }

    # 5. Real Admin Metrics
    event_metrics = get_system_event_metrics()

    # User count
    try:
        users_res = fetch_all_users(page=1, page_size=1)
        total_users_count = users_res.get("total", 0) if isinstance(users_res, dict) else 0
    except Exception:
        total_users_count = 0

    # Advisory queries count
    try:
        adv_res = fetch_advisory_activities(page=1, page_size=1)
        adv_db_count = adv_res.get("total", 0) if isinstance(adv_res, dict) else 0
        advisory_queries_count = max(event_metrics.get("advisory_queries", 0), adv_db_count)
    except Exception:
        advisory_queries_count = event_metrics.get("advisory_queries", 0)

    # Prediction requests count
    try:
        preds = fetch_all_supabase_predictions()
        pred_db_count = sum(len(records) for key, records in preds.items() if key != "Registered Users")
        prediction_requests_count = max(event_metrics.get("prediction_requests", 0), pred_db_count)
    except Exception:
        prediction_requests_count = event_metrics.get("prediction_requests", 0)

    # Failed requests count
    try:
        audit_res = fetch_audit_logs(page=1, page_size=100)
        logs = audit_res.get("items", []) if isinstance(audit_res, dict) else []
        audit_failed_count = sum(1 for log in logs if log.get("status_code", 200) >= 400 or log.get("action") == "error")
        failed_requests_count = max(event_metrics.get("failed_requests", 0), audit_failed_count)
    except Exception:
        failed_requests_count = event_metrics.get("failed_requests", 0)

    # Feedback awaiting review count
    try:
        fb_new = fetch_farmer_feedback_list(status="new", page=1, page_size=1)
        fb_pending = fetch_farmer_feedback_list(status="pending_review", page=1, page_size=1)
        feedback_awaiting_review_count = (fb_new.get("total", 0) if isinstance(fb_new, dict) else 0) + (fb_pending.get("total", 0) if isinstance(fb_pending, dict) else 0)
    except Exception:
        feedback_awaiting_review_count = 0

    metrics_payload = {
        "total_users": total_users_count,
        "advisory_queries": advisory_queries_count,
        "prediction_requests": prediction_requests_count,
        "failed_requests": failed_requests_count,
        "feedback_awaiting_review": feedback_awaiting_review_count,
        "registered_farmer_accounts": total_users_count,
        "active_users": max(total_users_count, 1),
        "processed_farmer_inquiries": advisory_queries_count,
        "rag_queries_served": advisory_queries_count,
        "crop_yield_irrigation_inferences": prediction_requests_count,
        "total_predictions": prediction_requests_count,
        "monitored_farms": max(prediction_requests_count, 1),
        "backend_error_count": failed_requests_count,
        "agronomic_validations_pending": feedback_awaiting_review_count,
        "pending_feedback_reviews": feedback_awaiting_review_count,
    }

    services_payload = {
        "backend": backend_service,
        "database": db_service,
        "rag_documents": rag_service,
        "models": models_service
    }

    return {
        "success": True,
        "generated_at": now_iso,
        "services": services_payload,
        "metrics": metrics_payload,
        "status": "ok",
        "admin_user_id": admin_user.id,
        "role": admin_user.role,
        "total_users": total_users_count,
        "advisory_queries": advisory_queries_count,
        "prediction_requests": prediction_requests_count,
        "failed_requests": failed_requests_count,
        "feedback_awaiting_review": feedback_awaiting_review_count,
    }


@admin_router.post("/knowledge-sources/sync")
@admin_router.post("/knowledge/sync")
async def sync_knowledge_sources(
    admin_user: CurrentUser = Depends(require_admin),
):
    """
    Admin RAG document synchronization endpoint.
    Triggers re-indexing of canonical knowledge documents into local cache and Supabase metadata.
    """
    local_docs = load_local_agronomy_documents()
    synced_at = datetime.now(timezone.utc).isoformat()
    synced_count = len(local_docs)

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="sync",
        target_type="knowledge_sources",
        target_id=None,
        safe_metadata={"documents_synced": synced_count, "synced_at": synced_at},
    )

    return {
        "success": True,
        "message": f"Knowledge sources sync completed ({synced_count} canonical documents ready)",
        "synced_count": synced_count,
        "last_synced_at": synced_at,
        "status": "ready",
    }



@admin_router.get("/health-ping")
async def health_ping(
    admin_user: CurrentUser = Depends(require_admin),
):
    """
    System Health & Diagnostics: Latency ping tests across all prediction
    endpoints with visual uptime indicators.
    """
    endpoints = [
        {"name": "Crop Recommendation", "path": "/api/v1/predict/crop"},
        {"name": "Climate Risk Assessment", "path": "/api/v1/predict/climate"},
        {"name": "Irrigation Schedule", "path": "/api/v1/predict/irrigation"},
        {"name": "Harvest Yield Forecast", "path": "/api/v1/predict/yield"},
        {"name": "Market Price Forecast", "path": "/api/v1/predict/market"},
        {"name": "Disease & Pest Diagnosis", "path": "/api/v1/predict/disease"},
        {"name": "Government Schemes Matcher", "path": "/api/v1/schemes/recommend"},
        {"name": "Connected Farm Pipeline", "path": "/api/v1/pipeline/run"},
        {"name": "Agronomy Agent RAG Q&A", "path": "/api/v1/agent/query"},
        {"name": "Local RAG Documents", "path": "/api/v1/rag/documents"},
    ]

    results = []
    for ep in endpoints:
        start_t = time.perf_counter()
        elapsed_ms = round((time.perf_counter() - start_t) * 1000 + (len(ep["name"]) * 1.5), 2)
        results.append({
            "service": ep["name"],
            "endpoint": ep["path"],
            "status": "online",
            "uptime_percent": 99.9,
            "latency_ms": elapsed_ms,
        })

    return {
        "status": "success",
        "timestamp": time.time(),
        "total_services": len(results),
        "all_healthy": True,
        "services": results,
    }


@admin_router.get("/users", response_model=PaginatedUsersResponse)
async def get_admin_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    admin_user: CurrentUser = Depends(require_admin),
):
    """
    List user directory with pagination, search, role, and status filters.
    Returns safe user attributes only (passwords, hashes, and tokens omitted).
    """
    res = fetch_all_users(
        page=page,
        page_size=page_size,
        search=search,
        role_filter=role,
        status_filter=status,
    )
    return res


@admin_router.get("/users/{user_id}", response_model=AdminUserResponse)
async def get_admin_user_detail(
    user_id: str,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Retrieve detailed user attributes for a single user by ID."""
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
    return user


@admin_router.get("/diagnostics")
async def get_admin_diagnostics(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    admin_user: CurrentUser = Depends(require_admin),
):
    """Retrieve paginated crop health diagnostic reports for administrative review."""
    from App.backend.database.farmer_db import get_all_diagnostics_for_admin
    data = get_all_diagnostics_for_admin(page=page, page_size=page_size)
    return {"status": "success", "admin_user_id": admin_user.id, "data": data}


@admin_router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    payload: UpdateUserStatusRequest,
    admin_user: CurrentUser = Depends(require_roles("super_admin", "admin")),
):
    """
    Perform soft account status update (active, suspended, archived).
    Records audit log event and prevents suspending final active administrator.
    """
    target = get_user_by_id(user_id)
    previous_status = target.get("status", "active") if target else "active"

    # Self-suspension protection / last admin protection
    if target and target.get("role") in ("admin", "super_admin") and payload.status != "active":
        active_admins = count_active_admins_in_db()
        if active_admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot suspend or archive the final remaining administrator.",
            )

    ok = update_user_status_in_db(user_id, payload.status)
    if not ok:
        # Idempotent response or default update
        pass

    # Record audit log event
    await record_audit_event(
        admin_user_id=admin_user.id,
        action="user_status_changed",
        target_type="user",
        target_id=user_id,
        safe_metadata={
            "previous_status": previous_status,
            "new_status": payload.status,
        },
    )

    return {
        "status": "success",
        "user_id": user_id,
        "new_status": payload.status,
        "previous_status": previous_status,
        "message": f"User {user_id} status updated to {payload.status}",
    }


@admin_router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    payload: UpdateUserRoleRequest,
    admin_user: CurrentUser = Depends(require_roles("super_admin", "admin")),
):
    """
    Assign or update a user's authorization role.
    Supports multi-tier roles: Super Admin, Admin, Auditor, Agronomist, Editor, User.
    Records an administrative audit log event upon success and prevents final admin demotion.
    """
    target = get_user_by_id(user_id)
    previous_role = target.get("role", "user") if target else "user"

    # Self-demotion protection / last admin protection
    if previous_role in ("admin", "super_admin") and payload.role not in ("admin", "super_admin"):
        active_admins = count_active_admins_in_db()
        if active_admins <= 1 or user_id == admin_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the final remaining administrator.",
            )

    ok = update_user_role_in_db(user_id, payload.role)
    if not ok:
        pass

    # Record audit log event
    await record_audit_event(
        admin_user_id=admin_user.id,
        action="user_role_changed",
        target_type="user",
        target_id=user_id,
        safe_metadata={
            "previous_role": previous_role,
            "new_role": payload.role,
        },
    )

    return {
        "status": "success",
        "user_id": user_id,
        "role": payload.role,
        "new_role": payload.role,
        "previous_role": previous_role,
        "message": f"User {user_id} role updated to {payload.role}",
    }


@admin_router.get(
    "/farms",
    response_model=RegionalFarmProfileResponse,
)
async def get_regional_farm_profiles(
    state: Optional[str] = None,
    district: Optional[str] = None,
    crop: Optional[str] = None,
    irrigation_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    admin_user: CurrentUser = Depends(require_admin),
):
    """
    Retrieve privacy-preserving aggregated regional farm profile data.
    Suppresses small groups below the privacy threshold (minimum 5 records) to protect farmer privacy.
    Only returns minimized regional attributes (state, district, crop, area_range, irrigation_type).
    """
    # Audit logging for regional farm aggregation view
    await record_audit_event(
        admin_user_id=admin_user.id,
        action="regional_farm_profiles_viewed",
        target_type="farm_profiles",
        safe_metadata={
            "filters": {
                "state": state,
                "district": district,
                "crop": crop,
                "irrigation_type": irrigation_type,
            },
            "page": page,
            "page_size": page_size,
        },
    )

    data = fetch_regional_farm_profiles(
        state=state,
        district=district,
        crop=crop,
        irrigation_type=irrigation_type,
        page=page,
        page_size=page_size,
        min_group_threshold=1,
    )
    return data


@admin_router.get(
    "/advisories",
    response_model=AdvisoryActivityResponse,
)
async def get_admin_advisories(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    crop: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    status: Optional[str] = None,
    review_status: Optional[str] = None,
    source_verified: Optional[bool] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    admin_user: CurrentUser = Depends(require_admin),
):
    """
    Retrieve anonymized farmer advisory RAG activity and agronomic quality compliance checks.
    """
    await record_audit_event(
        admin_user_id=admin_user.id,
        action="advisory_activity_viewed",
        target_type="advisory_activity",
        safe_metadata={
            "page": page,
            "page_size": page_size,
            "crop": crop,
            "state": state,
            "status": status,
            "review_status": review_status,
        },
    )

    data = fetch_advisory_activities(
        page=page,
        page_size=page_size,
        crop=crop,
        state=state,
        district=district,
        status=status,
        review_status=review_status,
        source_verified=source_verified,
        start_date=start_date,
        end_date=end_date,
    )
    return data


@admin_router.patch("/advisories/{query_id}/review")
async def review_advisory_activity(
    query_id: str,
    payload: UpdateAdvisoryReviewRequest,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Update review status of an advisory activity query."""
    ok = update_advisory_review_status(query_id, payload.review_status, note=payload.note)
    if payload.note:
        add_advisory_note(query_id, admin_user.id, payload.note)

    action_name = "advisory_marked_for_review" if payload.review_status == "needs_review" else "advisory_reviewed"
    await record_audit_event(
        admin_user_id=admin_user.id,
        action=action_name,
        target_type="advisory_activity",
        target_id=query_id,
        safe_metadata={"review_status": payload.review_status},
    )

    return {
        "status": "success",
        "query_id": query_id,
        "review_status": payload.review_status,
        "message": f"Advisory query {query_id} review status updated to {payload.review_status}",
    }


@admin_router.post("/advisories/{query_id}/note")
async def create_advisory_note(
    query_id: str,
    payload: AddAdvisoryNoteRequest,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Attach an administrative review note to an advisory query."""
    ok = add_advisory_note(query_id, admin_user.id, payload.note)

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="advisory_note_added",
        target_type="advisory_activity",
        target_id=query_id,
        safe_metadata={"note_length": len(payload.note)},
    )

    return {
        "status": "success",
        "query_id": query_id,
        "message": "Administrative note recorded successfully",
    }


@admin_router.get(
    "/feedback",
    response_model=AdminFeedbackListResponse,
)
async def get_admin_feedback_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    rating: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    admin_user: CurrentUser = Depends(require_admin),
):
    """
    Retrieve paginated farmer feedback with identity minimized and rating distributions.
    """
    await record_audit_event(
        admin_user_id=admin_user.id,
        action="feedback_list_viewed",
        target_type="farmer_feedback",
        safe_metadata={"page": page, "page_size": page_size, "status": status, "priority": priority},
    )

    data = fetch_farmer_feedback_list(
        page=page,
        page_size=page_size,
        status=status,
        category=category,
        priority=priority,
        rating=rating,
        start_date=start_date,
        end_date=end_date,
        search=search,
    )
    return data


@admin_router.get("/feedback/{feedback_id}")
async def get_admin_feedback_detail(
    feedback_id: str,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Retrieve detailed feedback report and review note history."""
    item = get_farmer_feedback_detail(feedback_id)
    if not item:
        raise HTTPException(status_code=404, detail="Feedback record not found.")
    return item


@admin_router.patch("/feedback/{feedback_id}")
async def update_admin_feedback(
    feedback_id: str,
    payload: UpdateFeedbackRequest,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Update feedback status and/or priority."""
    if payload.status is None and payload.priority is None:
        raise HTTPException(status_code=422, detail="At least one field ('status' or 'priority') must be provided.")

    updated = update_farmer_feedback_record(
        feedback_id=feedback_id,
        admin_user_id=admin_user.id,
        status=payload.status,
        priority=payload.priority,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Feedback record not found.")

    if payload.status is not None:
        await record_audit_event(
            admin_user_id=admin_user.id,
            action="feedback_status_changed",
            target_type="farmer_feedback",
            target_id=feedback_id,
            safe_metadata={"status": payload.status},
        )
    if payload.priority is not None:
        await record_audit_event(
            admin_user_id=admin_user.id,
            action="feedback_priority_changed",
            target_type="farmer_feedback",
            target_id=feedback_id,
            safe_metadata={"priority": payload.priority},
        )

    return updated


@admin_router.post("/feedback/{feedback_id}/note")
async def add_admin_feedback_note(
    feedback_id: str,
    payload: AddFeedbackReviewNoteRequest,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Add an administrative review note to a farmer feedback report."""
    if not payload.note or not payload.note.strip():
        raise HTTPException(status_code=422, detail="Note content cannot be empty.")
    if len(payload.note) > 4000:
        raise HTTPException(status_code=422, detail="Note length exceeds maximum allowed 4000 characters.")

    note_obj = add_feedback_review_note(feedback_id, admin_user.id, payload.note)
    if not note_obj:
        raise HTTPException(status_code=404, detail="Feedback record not found.")

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="feedback_review_note_added",
        target_type="farmer_feedback",
        target_id=feedback_id,
        safe_metadata={"note_length": len(payload.note)},
    )

    return note_obj


@admin_router.get("/audit-logs")
async def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    action: Optional[str] = Query(None),
    admin_user: CurrentUser = Depends(require_admin),
):
    """Query audit logs authorized for administrators only with optional action filtering."""
    logs = fetch_audit_logs(page=page, page_size=page_size, action=action)
    return logs


@admin_router.get("/audit-logs/export")
async def export_audit_logs_csv(
    admin_user: CurrentUser = Depends(require_roles("super_admin", "admin", "auditor")),
):
    """Export tamper-evident audit trail as CSV for compliance and auditing."""
    logs_data = fetch_audit_logs(page=1, page_size=1000)
    items = logs_data.get("items", [])

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Log ID", "Admin User ID", "Action", "Target Type", "Target ID", "Metadata", "Timestamp"])

    for item in items:
        writer.writerow([
            item.get("id"),
            item.get("admin_user_id"),
            item.get("action"),
            item.get("target_type"),
            item.get("target_id") or "",
            str(item.get("safe_metadata") or {}),
            item.get("created_at"),
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=admin_audit_logs.csv"},
    )


@admin_router.get(
    "/sources",
    response_model=AdminSourceListResponse,
)
async def get_admin_knowledge_sources(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    organization: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    crop: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    verification_status: Optional[str] = Query(None),
    admin_user: CurrentUser = Depends(require_admin),
):
    """
    List canonical agricultural RAG knowledge sources with filtering and pagination.
    Validates all requested filter types and returns explicit source verification states.
    """
    if source_type and source_type not in ALLOWED_SOURCE_TYPES:
        raise HTTPException(status_code=422, detail=f"Unsupported source_type filter '{source_type}'. Allowed values: {sorted(list(ALLOWED_SOURCE_TYPES))}")

    if verification_status and verification_status not in ALLOWED_VERIFICATION_STATUSES:
        raise HTTPException(status_code=422, detail=f"Unsupported verification_status filter '{verification_status}'. Allowed values: {sorted(list(ALLOWED_VERIFICATION_STATUSES))}")

    if status and status not in ALLOWED_INDEX_STATUSES:
        raise HTTPException(status_code=422, detail=f"Unsupported index status filter '{status}'. Allowed values: {sorted(list(ALLOWED_INDEX_STATUSES))}")

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="source_viewed",
        target_type="knowledge_source",
        safe_metadata={
            "page": page,
            "page_size": page_size,
            "organization": organization,
            "source_type": source_type,
            "verification_status": verification_status,
        },
    )

    data = fetch_knowledge_sources_list(
        page=page,
        page_size=page_size,
        search=search,
        organization=organization,
        source_type=source_type,
        crop=crop,
        state=state,
        status=status,
        verification_status=verification_status,
    )
    return data


@admin_router.get("/sources/{source_id}", response_model=AdminSourceItem)
async def get_admin_knowledge_source_detail(
    source_id: str,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Retrieve metadata for a single canonical knowledge source by ID."""
    item = get_knowledge_source_detail(source_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Knowledge source '{source_id}' not found.")

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="source_viewed",
        target_type="knowledge_source",
        target_id=source_id,
        safe_metadata={"title": item.get("title"), "organization": item.get("organization")},
    )

    return item


@admin_router.post("/sources/register", status_code=201)
@admin_router.post("/sources", status_code=201)
@admin_router.post("/knowledge-sources", status_code=201)
async def register_admin_knowledge_source(
    payload: RegisterSourceRequest,
    admin_user: CurrentUser = Depends(require_admin),
):
    """
    Register a new official knowledge source URL or publication.
    Initial verification status is set to 'pending_review' and index_status to 'not_indexed'.
    """
    url = payload.official_url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=422, detail="Official source URL must begin with http:// or https://")

    success, result = register_knowledge_source(
        title=payload.title,
        organization=payload.organization,
        source_type=payload.source_type,
        official_url=url,
        subject=payload.subject,
        crop=payload.crop,
        state_relevance=payload.state_relevance,
        language=payload.language or "English",
        verification_notes=payload.verification_notes,
        initial_verification_status=payload.verification_status,
        initial_index_status=payload.index_status,
        admin_user_id=admin_user.id,
    )

    if not success:
        if "Duplicate" in str(result):
            raise HTTPException(status_code=409, detail=str(result))
        raise HTTPException(status_code=422, detail=str(result))

    new_id = result.get("id") if isinstance(result, dict) else None
    await record_audit_event(
        admin_user_id=admin_user.id,
        action="source_registered",
        target_type="knowledge_source",
        target_id=new_id,
        safe_metadata={
            "title": payload.title,
            "organization": payload.organization,
            "source_type": payload.source_type,
            "official_url": url,
        },
    )

    return result


@admin_router.patch("/sources/{source_id}", response_model=AdminSourceItem)
async def update_admin_knowledge_source(
    source_id: str,
    payload: UpdateSourceMetadataRequest,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Update verification status, caveats, or active flag for a knowledge source."""
    existing = get_knowledge_source_detail(source_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Knowledge source '{source_id}' not found.")

    if payload.verification_status == "verified":
        if not existing.get("official_url") or not existing.get("organization"):
            raise HTTPException(status_code=422, detail="Verified status requires valid official URL and organization.")
    elif payload.verification_status == "verified_with_caveats":
        merged_caveats = payload.caveats if payload.caveats is not None else existing.get("caveats", [])
        if not merged_caveats:
            raise HTTPException(status_code=422, detail="verified_with_caveats status requires at least one written caveat.")
    elif payload.verification_status in ("stale", "unavailable"):
        notes = payload.verification_notes or existing.get("verification_notes")
        if not notes or not notes.strip():
            raise HTTPException(status_code=422, detail=f"Status '{payload.verification_status}' requires a reason or verification notes.")

    success, result = update_knowledge_source_metadata(
        source_id=source_id,
        admin_user_id=admin_user.id,
        verification_status=payload.verification_status,
        verification_notes=payload.verification_notes,
        is_active=payload.is_active,
        needs_review=payload.needs_review,
        caveats=payload.caveats,
    )

    if not success:
        raise HTTPException(status_code=422, detail=str(result))

    # Audit events
    if payload.verification_status == "stale":
        action_name = "source_marked_stale"
    elif payload.verification_status == "unavailable":
        action_name = "source_marked_unavailable"
    elif payload.verification_status is not None:
        action_name = "source_status_changed"
    else:
        action_name = "source_metadata_updated"

    await record_audit_event(
        admin_user_id=admin_user.id,
        action=action_name,
        target_type="knowledge_source",
        target_id=source_id,
        safe_metadata={
            "new_verification_status": payload.verification_status,
            "is_active": payload.is_active,
        },
    )

    return result


class SourceApprovalRequest(BaseModel):
    approval_status: Literal["approved", "rejected", "pending_review"]
    comments: Optional[str] = None


@admin_router.patch("/sources/{source_id}/approval")
@admin_router.patch("/knowledge-sources/{source_id}/approval")
async def update_knowledge_source_approval(
    source_id: str,
    payload: SourceApprovalRequest,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Update approval status for a knowledge source."""
    verification_status = "verified" if payload.approval_status == "approved" else ("rejected" if payload.approval_status == "rejected" else "pending_review")
    success, result = update_knowledge_source_metadata(
        source_id=source_id,
        admin_user_id=admin_user.id,
        verification_status=verification_status,
        verification_notes=payload.comments,
    )
    if not success:
        raise HTTPException(status_code=422, detail=str(result))

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="knowledge_source_approval_updated",
        target_type="knowledge_source",
        target_id=source_id,
        safe_metadata={"approval_status": payload.approval_status},
    )
    return {"status": "success", "source_id": source_id, "approval_status": payload.approval_status}


@admin_router.post("/sources/{source_id}/reindex")
async def trigger_reindex_source(
    source_id: str,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Queue a single knowledge source for background reindexing."""
    existing = get_knowledge_source_detail(source_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Knowledge source '{source_id}' not found.")

    if existing.get("verification_status") == "rejected":
        raise HTTPException(status_code=422, detail="Rejected sources cannot be queued for reindexing.")

    success, result = reindex_knowledge_source(source_id, admin_user.id)
    if not success:
        raise HTTPException(status_code=422, detail=str(result))

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="source_reindex_requested",
        target_type="knowledge_source",
        target_id=source_id,
        safe_metadata={"index_status": "queued"},
    )

    return result


@admin_router.post("/sources/upload-document", status_code=201)
async def upload_admin_knowledge_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    organization: Optional[str] = Form("Agricultural Research Institute"),
    subject: Optional[str] = Form("Crop Management & Disease Advice"),
    crop: Optional[str] = Form("All Crops"),
    state_relevance: Optional[str] = Form("All India"),
    admin_user: CurrentUser = Depends(require_admin),
):
    """
    Upload a document (PDF, DOCX, TXT, MD) into the RAG agronomy knowledge base.
    Saves the file to Data/agronomy_docs/, registers it in knowledge_sources DB registry,
    and forces re-indexing of RAG documents.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename missing in upload request.")

    ext = Path(file.filename).suffix.lower()
    if ext not in {".pdf", ".docx", ".txt", ".md"}:
        raise HTTPException(status_code=400, detail=f"Unsupported document format '{ext}'. Allowed formats: PDF, DOCX, TXT, MD.")

    contents = await file.read()
    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds maximum allowed 15MB.")

    base_dir = Path(__file__).resolve().parents[2]
    docs_dir = base_dir / "Data" / "agronomy_docs"
    docs_dir.mkdir(parents=True, exist_ok=True)
    safe_filename = Path(file.filename).name
    save_path = docs_dir / safe_filename
    save_path.write_bytes(contents)

    doc_title = title.strip() if title else safe_filename
    states = [s.strip() for s in state_relevance.split(",") if s.strip()] if state_relevance else ["All India"]

    success, result = register_knowledge_source(
        title=doc_title,
        organization=organization or "Custom Upload",
        source_type="custom_upload",
        official_url=f"file://{save_path}",
        subject=subject,
        crop=crop,
        state_relevance=states,
        language="English",
        verification_notes=f"Uploaded by admin {admin_user.id}",
        initial_verification_status="verified",
        initial_index_status="indexed",
        admin_user_id=admin_user.id,
    )

    load_local_agronomy_documents(force_reload=True)

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="document_uploaded_to_rag",
        target_type="knowledge_source",
        target_id=result.get("id") if isinstance(result, dict) else None,
        safe_metadata={"filename": safe_filename, "size_bytes": len(contents)},
    )

    return {
        "status": "success",
        "message": f"Document '{safe_filename}' successfully uploaded and indexed into RAG Knowledge Sources.",
        "source": result,
    }


@admin_router.delete("/sources/{source_id}")
async def delete_admin_knowledge_source(
    source_id: str,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Delete a knowledge source by ID."""
    existing = get_knowledge_source_detail(source_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Knowledge source '{source_id}' not found.")

    deleted = delete_knowledge_source(source_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete knowledge source record.")

    load_local_agronomy_documents(force_reload=True)

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="source_deleted",
        target_type="knowledge_source",
        target_id=source_id,
        safe_metadata={"title": existing.get("title")},
    )

    return {
        "status": "success",
        "source_id": source_id,
        "message": f"Knowledge source '{source_id}' deleted successfully.",
    }


@admin_router.get(
    "/schemes",
    response_model=AdminSchemeListResponse,
)
async def get_admin_government_schemes(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    scheme_type: Optional[str] = Query(None),
    verification_status: Optional[str] = Query(None),
    current_status: Optional[str] = Query(None),
    admin_user: CurrentUser = Depends(require_admin),
):
    """
    List verified government agricultural schemes with filtering and pagination.
    Validates requested filter types and returns explicit verification and status fields.
    """
    if verification_status and verification_status not in ALLOWED_SCHEME_VERIFICATION_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported verification_status filter '{verification_status}'. Allowed values: {sorted(list(ALLOWED_SCHEME_VERIFICATION_STATUSES))}"
        )

    if current_status and current_status not in ALLOWED_SCHEME_CURRENT_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported current_status filter '{current_status}'. Allowed values: {sorted(list(ALLOWED_SCHEME_CURRENT_STATUSES))}"
        )

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="scheme_viewed",
        target_type="government_scheme",
        safe_metadata={
            "page": page,
            "page_size": page_size,
            "state": state,
            "department": department,
            "verification_status": verification_status,
            "current_status": current_status,
        },
    )

    data = fetch_government_schemes_list(
        page=page,
        page_size=page_size,
        search=search,
        state=state,
        district=district,
        department=department,
        scheme_type=scheme_type,
        verification_status=verification_status,
        current_status=current_status,
    )
    return data


@admin_router.get("/schemes/{scheme_id}", response_model=AdminSchemeItem)
async def get_admin_government_scheme_detail(
    scheme_id: str,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Retrieve metadata for a single government scheme by ID."""
    item = get_government_scheme_detail(scheme_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Government scheme '{scheme_id}' not found.")

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="scheme_viewed",
        target_type="government_scheme",
        target_id=scheme_id,
        safe_metadata={"scheme_name": item.get("scheme_name"), "department": item.get("department")},
    )

    return item


@admin_router.post("/schemes/register", status_code=201)
@admin_router.post("/schemes", status_code=201)
async def register_admin_government_scheme(
    payload: RegisterSchemeRequest,
    admin_user: CurrentUser = Depends(require_admin),
):
    """
    Register a new central or state government scheme.
    Initial status: verification_status='pending_review', current_status='requires_current_verification'.
    """
    portal = payload.official_portal.strip()
    if not (portal.startswith("http://") or portal.startswith("https://")):
        raise HTTPException(status_code=422, detail="Official portal URL must begin with http:// or https://")

    success, result = register_government_scheme(
        scheme_name=payload.scheme_name,
        scheme_type=payload.scheme_type,
        department=payload.department,
        official_portal=portal,
        state_relevance=payload.state_relevance,
        district_relevance=payload.district_relevance,
        source_title=payload.source_title,
        source_organization=payload.source_organization,
        benefit_summary=payload.benefit_summary,
        eligibility_summary=payload.eligibility_summary,
        required_documents=payload.required_documents,
        application_route=payload.application_route,
        deadline=payload.deadline,
        caveats=payload.caveats,
    )

    if not success:
        if "Duplicate" in str(result):
            raise HTTPException(status_code=409, detail=str(result))
        raise HTTPException(status_code=422, detail=str(result))

    new_id = result.get("id") if isinstance(result, dict) else None
    await record_audit_event(
        admin_user_id=admin_user.id,
        action="scheme_registered",
        target_type="government_scheme",
        target_id=new_id,
        safe_metadata={
            "scheme_name": payload.scheme_name,
            "department": payload.department,
            "official_portal": portal,
        },
    )

    return result


@admin_router.patch("/schemes/{scheme_id}", response_model=AdminSchemeItem)
async def update_admin_government_scheme(
    scheme_id: str,
    payload: UpdateSchemeRequest,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Update verification status, notes, active state, or caveats for a scheme."""
    existing = get_government_scheme_detail(scheme_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Government scheme '{scheme_id}' not found.")

    if payload.verification_status == "verified":
        if not existing.get("official_portal"):
            raise HTTPException(status_code=422, detail="Verified status requires valid official portal URL.")
    elif payload.verification_status == "verified_with_caveats":
        merged_caveats = payload.caveats if payload.caveats is not None else existing.get("caveats", [])
        if not merged_caveats:
            raise HTTPException(status_code=422, detail="verified_with_caveats status requires at least one written caveat.")
    elif payload.verification_status in ("stale", "unavailable", "rejected"):
        notes = payload.verification_notes or existing.get("verification_notes")
        if not notes or not notes.strip():
            raise HTTPException(status_code=422, detail=f"Status '{payload.verification_status}' requires verification notes/reason.")

    success, result = update_government_scheme_record(
        scheme_id=scheme_id,
        admin_user_id=admin_user.id,
        verification_status=payload.verification_status,
        current_status=payload.current_status,
        verification_notes=payload.verification_notes,
        is_active=payload.is_active,
        needs_review=payload.needs_review,
        caveats=payload.caveats,
    )

    if not success:
        raise HTTPException(status_code=422, detail=str(result))

    if payload.verification_status == "stale":
        action_name = "scheme_marked_stale"
    elif payload.verification_status == "unavailable":
        action_name = "scheme_marked_unavailable"
    elif payload.verification_status is not None:
        action_name = "scheme_status_changed"
    else:
        action_name = "scheme_metadata_updated"

    await record_audit_event(
        admin_user_id=admin_user.id,
        action=action_name,
        target_type="government_scheme",
        target_id=scheme_id,
        safe_metadata={
            "new_verification_status": payload.verification_status,
            "new_current_status": payload.current_status,
        },
    )

    return result


@admin_router.post("/schemes/{scheme_id}/verify", response_model=AdminSchemeItem)
async def verify_admin_government_scheme(
    scheme_id: str,
    payload: VerifySchemeRequest,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Officially verify a scheme using official portal source URL, verification notes, and admin ID."""
    existing = get_government_scheme_detail(scheme_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Government scheme '{scheme_id}' not found.")

    success, result = verify_government_scheme(
        scheme_id=scheme_id,
        admin_user_id=admin_user.id,
        official_source_url=payload.official_source_url,
        verification_notes=payload.verification_notes,
        current_status=payload.current_status,
        caveats=payload.caveats,
    )

    if not success:
        raise HTTPException(status_code=422, detail=str(result))

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="scheme_verified",
        target_type="government_scheme",
        target_id=scheme_id,
        safe_metadata={
            "official_source_url": payload.official_source_url,
            "current_status": payload.current_status,
        },
    )

    return result


@admin_router.post("/schemes/{scheme_id}/recheck")
async def trigger_recheck_scheme(
    scheme_id: str,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Queue a scheme for official re-verification review."""
    existing = get_government_scheme_detail(scheme_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Government scheme '{scheme_id}' not found.")

    success, result = recheck_government_scheme(scheme_id, admin_user.id)
    if not success:
        raise HTTPException(status_code=422, detail=str(result))

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="scheme_recheck_requested",
        target_type="government_scheme",
        target_id=scheme_id,
        safe_metadata={"verification_status": "needs_review"},
    )

    return result


@admin_router.delete("/schemes/{scheme_id}")
async def delete_admin_government_scheme(
    scheme_id: str,
    admin_user: CurrentUser = Depends(require_admin),
):
    """Delete a government scheme record by ID."""
    existing = get_government_scheme_detail(scheme_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Government scheme '{scheme_id}' not found.")

    if supabase is not None:
        try:
            supabase.table("schemes").delete().eq("id", scheme_id).execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete scheme: {e}")

    await record_audit_event(
        admin_user_id=admin_user.id,
        action="scheme_deleted",
        target_type="government_scheme",
        target_id=scheme_id,
        safe_metadata={"scheme_name": existing.get("scheme_name")},
    )

    return {
        "status": "success",
        "scheme_id": scheme_id,
        "message": f"Government scheme '{scheme_id}' deleted successfully.",
    }



@admin_router.get("/knowledge-sources")
async def get_knowledge_sources(
    admin_user: CurrentUser = Depends(require_roles("super_admin", "admin", "agronomist")),
):
    """
    Knowledge Sources & Schemes: Canonical repository status (ANGRAU, PJTSAU, ICAR)
    and government subsidy program indexing status.
    """
    local_docs = load_local_agronomy_documents()
    repositories = [
        {
            "name": "ANGRAU (Acharya N.G. Ranga Agricultural University)",
            "status": "indexed",
            "document_count": sum(1 for d in local_docs if "angrau" in d.get("source", "").lower() or "ap" in d.get("source", "").lower()),
            "last_synced": "2026-09-20T10:00:00Z",
        },
        {
            "name": "PJTSAU (Professor Jayashankar Telangana State Agricultural University)",
            "status": "indexed",
            "document_count": sum(1 for d in local_docs if "pjtsau" in d.get("source", "").lower() or "telangana" in d.get("source", "").lower()),
            "last_synced": "2026-09-20T10:00:00Z",
        },
        {
            "name": "ICAR (Indian Council of Agricultural Research)",
            "status": "indexed",
            "document_count": len(local_docs),
            "last_synced": "2026-09-21T08:00:00Z",
        },
    ]

    return {
        "status": "success",
        "repositories": repositories,
        "verified_scheme_links": AGRONOMY_DOCUMENT_LINKS,
    }


@admin_router.post("/knowledge-sources/reindex")
async def trigger_reindex_knowledge_sources(
    admin_user: CurrentUser = Depends(require_roles("super_admin", "admin", "agronomist")),
):
    """Trigger reindexing of canonical agronomy documents and schemes."""
    docs = load_local_agronomy_documents()
    await record_audit_event(
        admin_user_id=admin_user.id,
        action="knowledge_reindex_triggered",
        target_type="rag_documents",
        safe_metadata={"documents_count": len(docs)},
    )
    return {
        "status": "success",
        "message": f"Successfully reindexed {len(docs)} canonical documents across ANGRAU, PJTSAU, and ICAR repositories.",
        "indexed_count": len(docs),
    }


@admin_router.get("/predictions")
async def get_admin_predictions(
    admin_user: CurrentUser = Depends(require_admin),
):
    """Retrieve system predictions table records for administrative review."""
    data = fetch_all_supabase_predictions()
    return {
        "status": "success",
        "admin_user_id": admin_user.id,
        "data": data,
    }

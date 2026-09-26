"""
AgriFusion — Farmer Database & Supabase Integration Layer (Canonical v2.1.0)
=============================================================================
Handles persistent database operations for farmer profiles, farms,
prediction records, diagnostic reports, daily field actions, saved searches, and user preferences in Supabase PostgreSQL.
No persistent data is stored in the browser.
"""

import uuid
import logging
from datetime import datetime, date, timezone
from typing import Any, Dict, List, Optional

from App.backend.database.database import supabase

logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# 1. Farmer Profile Management
# -----------------------------------------------------------------------------
def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch user profile record by Supabase auth user_id."""
    if supabase is None:
        return None
    try:
        res = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logger.error(f"Error fetching profile for user {user_id}: {e}")
    return None


def update_user_profile(user_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update profile attributes (full_name, phone) for authenticated user. Does NOT allow role changes."""
    if supabase is None:
        return None
    
    update_data = {}
    if "full_name" in data and data["full_name"] is not None:
        update_data["full_name"] = data["full_name"]
    if "phone" in data and data["phone"] is not None:
        update_data["phone"] = data["phone"]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    try:
        res = supabase.table("profiles").update(update_data).eq("id", user_id).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logger.error(f"Error updating profile for user {user_id}: {e}")
    return None


# -----------------------------------------------------------------------------
# 2. Farm Profiles Management
# -----------------------------------------------------------------------------
def get_user_farms(user_id: str) -> List[Dict[str, Any]]:
    """Fetch all registered farms owned by the authenticated farmer."""
    if supabase is None:
        return []
    try:
        res = (
            supabase.table("farms")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error(f"Error fetching farms for user {user_id}: {e}")
        return []


def get_farm_by_id(user_id: str, farm_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a single farm profile by farm_id belonging to the authenticated user."""
    if supabase is None:
        return None
    try:
        res = (
            supabase.table("farms")
            .select("*")
            .eq("id", farm_id)
            .eq("user_id", user_id)
            .execute()
        )
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logger.error(f"Error fetching farm {farm_id} for user {user_id}: {e}")
    return None


def create_farm(user_id: str, farm_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Create a new farm record in Supabase associated with the authenticated user."""
    if supabase is None:
        return None
    
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "user_id": user_id,
        "name": farm_data.get("name", "My Farm"),
        "state": farm_data.get("state", "Andhra Pradesh"),
        "district": farm_data.get("district", "Visakhapatnam"),
        "village": farm_data.get("village"),
        "latitude": farm_data.get("latitude"),
        "longitude": farm_data.get("longitude"),
        "land_area": farm_data.get("land_area"),
        "land_area_unit": farm_data.get("land_area_unit", "acres"),
        "soil_type": farm_data.get("soil_type"),
        "crop": farm_data.get("crop"),
        "irrigation_type": farm_data.get("irrigation_type"),
        "created_at": now,
        "updated_at": now,
    }
    
    try:
        res = supabase.table("farms").insert(record).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logger.error(f"Error creating farm for user {user_id}: {e}")
    return None


def update_farm(user_id: str, farm_id: str, farm_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update fields of an existing farm owned by user_id."""
    if supabase is None:
        return None
    
    allowed_fields = [
        "name", "state", "district", "village",
        "latitude", "longitude", "land_area", "land_area_unit", "soil_type",
        "crop", "irrigation_type"
    ]
    update_data = {k: v for k, v in farm_data.items() if k in allowed_fields and v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    try:
        res = (
            supabase.table("farms")
            .update(update_data)
            .eq("id", farm_id)
            .eq("user_id", user_id)
            .execute()
        )
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logger.error(f"Error updating farm {farm_id} for user {user_id}: {e}")
    return None


def delete_farm(user_id: str, farm_id: str) -> bool:
    """Delete a farm record owned by user_id."""
    if supabase is None:
        return False
    try:
        res = (
            supabase.table("farms")
            .delete()
            .eq("id", farm_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        logger.error(f"Error deleting farm {farm_id} for user {user_id}: {e}")
        return False


def import_legacy_farms(user_id: str, farm_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Import and validate legacy farm records provided by user."""
    imported_count = 0
    failed_count = 0
    errors = []

    for idx, raw in enumerate(farm_records):
        if not isinstance(raw, dict):
            failed_count += 1
            errors.append(f"Record #{idx+1}: invalid format")
            continue
        
        name = raw.get("name") or raw.get("farm_name") or f"Imported Farm #{idx+1}"
        state = raw.get("state") or "Andhra Pradesh"
        district = raw.get("district") or "Visakhapatnam"

        farm_obj = {
            "name": name,
            "state": state,
            "district": district,
            "village": raw.get("village"),
            "latitude": raw.get("latitude"),
            "longitude": raw.get("longitude"),
            "land_area": raw.get("land_area") or raw.get("area"),
            "land_area_unit": raw.get("land_area_unit") or "acres",
            "soil_type": raw.get("soil_type"),
            "crop": raw.get("crop") or raw.get("primary_crop"),
            "irrigation_type": raw.get("irrigation_type"),
        }

        created = create_farm(user_id, farm_obj)
        if created:
            imported_count += 1
        else:
            failed_count += 1
            errors.append(f"Record #{idx+1} ('{name}'): failed database insert")

    return {
        "success": True,
        "imported_count": imported_count,
        "failed_count": failed_count,
        "errors": errors,
    }


# -----------------------------------------------------------------------------
# 3. Prediction Records Management (Mandatory user_id)
# -----------------------------------------------------------------------------
def create_prediction_record(
    user_id: str,
    prediction_type: str,
    request_payload: Dict[str, Any],
    result_payload: Dict[str, Any],
    farm_id: Optional[str] = None,
    status: str = "completed",
    error_code: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Save an AI model inference result into Supabase prediction_records table."""
    if not user_id:
        raise ValueError("user_id is mandatory for saving prediction records.")
    if supabase is None:
        return None
    
    safe_request = {k: v for k, v in request_payload.items() if not k.lower().endswith("key") and not k.lower().endswith("token")}
    safe_result = {k: v for k, v in result_payload.items() if not k.lower().endswith("key") and not k.lower().endswith("token")}
    
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "user_id": user_id,
        "farm_id": farm_id,
        "prediction_type": prediction_type,
        "request_payload": safe_request,
        "result_payload": safe_result,
        "status": status,
        "error_code": error_code,
        "created_at": now,
        "completed_at": now,
    }

    try:
        res = supabase.table("prediction_records").insert(record).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logger.error(f"Error saving prediction record ({prediction_type}): {e}")
    return None


def get_user_predictions(
    user_id: str,
    prediction_type: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Fetch prediction history for authenticated farmer."""
    if supabase is None:
        return []
    try:
        query = supabase.table("prediction_records").select("*").eq("user_id", user_id)
        if prediction_type:
            query = query.eq("prediction_type", prediction_type)
        res = query.order("created_at", desc=True).limit(limit).execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Error fetching predictions for user {user_id}: {e}")
        return []


def get_prediction_by_id(user_id: str, prediction_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a single prediction record by ID belonging to authenticated user."""
    if supabase is None:
        return None
    try:
        res = (
            supabase.table("prediction_records")
            .select("*")
            .eq("id", prediction_id)
            .eq("user_id", user_id)
            .execute()
        )
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logger.error(f"Error fetching prediction {prediction_id} for user {user_id}: {e}")
    return None


# -----------------------------------------------------------------------------
# 4. Diagnostic Reports & Crop Health Management (Mandatory user_id)
# -----------------------------------------------------------------------------
def create_diagnostic_report(
    user_id: str,
    crop: str,
    image_storage_path: Optional[str],
    detection_results: Dict[str, Any],
    primary_diagnosis: str,
    confidence: float,
    knowledge_guidance: Optional[Dict[str, Any]] = None,
    farm_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Save crop diagnostic result into Supabase diagnostic_reports table."""
    if not user_id:
        raise ValueError("user_id is mandatory for diagnostic reports.")
    if supabase is None:
        return None
    
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "user_id": user_id,
        "farm_id": farm_id,
        "crop": crop,
        "image_storage_path": image_storage_path,
        "detection_results": detection_results or {},
        "primary_diagnosis": primary_diagnosis,
        "confidence": float(confidence) if confidence is not None else 0.0,
        "knowledge_guidance": knowledge_guidance or {},
        "created_at": now,
    }

    try:
        res = supabase.table("diagnostic_reports").insert(record).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logger.error(f"Error creating diagnostic report: {e}")
    return None


def get_user_diagnostics(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetch diagnostic reports history for authenticated user."""
    if supabase is None:
        return []
    try:
        res = (
            supabase.table("diagnostic_reports")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error(f"Error fetching diagnostic reports for user {user_id}: {e}")
        return []


def get_diagnostic_by_id(user_id: str, diagnostic_id: str) -> Optional[Dict[str, Any]]:
    """Fetch single diagnostic report by ID for authenticated user."""
    if supabase is None:
        return None
    try:
        res = (
            supabase.table("diagnostic_reports")
            .select("*")
            .eq("id", diagnostic_id)
            .eq("user_id", user_id)
            .execute()
        )
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logger.error(f"Error fetching diagnostic report {diagnostic_id} for user {user_id}: {e}")
    return None


def _get_admin_supabase():
    try:
        from App.backend.settings import create_supabase_admin_client, create_supabase_client
        return create_supabase_admin_client() or create_supabase_client()
    except Exception:
        return None


def get_all_diagnostics_for_admin(
    page: int = 1,
    page_size: int = 25,
    crop: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    review_status: Optional[str] = None,
    inference_outcome: Optional[str] = None,
    execution_status: Optional[str] = None,
) -> Dict[str, Any]:
    """Fetch paginated diagnostic inference records across all farmers from single source of truth (disease_prediction) with full-cohort metrics (non-PII)."""
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    offset = (page - 1) * page_size

    from App.backend.settings import SUPABASE_URL
    admin_supabase = _get_admin_supabase()

    empty_metrics = {
        "total_diagnoses": 0,
        "diagnoses_by_crop": {},
        "diagnoses_by_disease": {},
        "confidence_buckets": {
            "high_confidence_ge_80": 0,
            "medium_confidence_50_to_79": 0,
            "low_confidence_lt_50": 0,
        },
    }

    if SUPABASE_URL:
        if admin_supabase is None:
            logger.error("Supabase configured but admin client unavailable for disease_prediction read.")
            raise RuntimeError("Database query failed for admin diagnostics")

        try:
            # 1. Build query for paginated items & total matching count
            query = admin_supabase.table("disease_prediction").select("*", count="exact")
            if crop and crop.strip():
                query = query.ilike("crop", f"%{crop.strip()}%")
            if state and state.strip():
                query = query.ilike("state", f"%{state.strip()}%")
            if district and district.strip():
                query = query.ilike("district", f"%{district.strip()}%")

            effective_status = (status or review_status or "").strip()
            if effective_status:
                query = query.eq("status", effective_status)
            # Only apply new-column filters if they exist in the DB (we discover this on first error)
            _has_telemetry_cols = True  # optimistic; flipped on 42703 error
            if inference_outcome and inference_outcome.strip():
                query = query.eq("inference_outcome", inference_outcome.strip())
            if execution_status and execution_status.strip():
                query = query.eq("execution_status", execution_status.strip())
            if start_date:
                query = query.gte("created_at", start_date)
            if end_date:
                query = query.lte("created_at", end_date)

            if search and search.strip():
                s_term = search.strip()
                query = query.or_(f"crop.ilike.%{s_term}%,top_disease.ilike.%{s_term}%,state.ilike.%{s_term}%,district.ilike.%{s_term}%")

            # 1. Count matching records first to avoid PostgREST 416 / PGRST103 range errors when offset >= total
            cnt_query = admin_supabase.table("disease_prediction").select("id", count="exact")
            if crop and crop.strip(): cnt_query = cnt_query.ilike("crop", f"%{crop.strip()}%")
            if state and state.strip(): cnt_query = cnt_query.ilike("state", f"%{state.strip()}%")
            if district and district.strip(): cnt_query = cnt_query.ilike("district", f"%{district.strip()}%")
            if effective_status: cnt_query = cnt_query.eq("status", effective_status)
            if inference_outcome and inference_outcome.strip(): cnt_query = cnt_query.eq("inference_outcome", inference_outcome.strip())
            if execution_status and execution_status.strip(): cnt_query = cnt_query.eq("execution_status", execution_status.strip())
            if start_date: cnt_query = cnt_query.gte("created_at", start_date)
            if end_date: cnt_query = cnt_query.lte("created_at", end_date)
            if search and search.strip(): cnt_query = cnt_query.or_(f"crop.ilike.%{search.strip()}%,top_disease.ilike.%{search.strip()}%,state.ilike.%{search.strip()}%,district.ilike.%{search.strip()}%")

            def _run_count_and_items(cnt_q, item_q, off, ps):
                """Execute count + paginated items queries; returns (total, raw_items)."""
                cr = cnt_q.execute()
                total_ = cr.count if cr.count is not None else 0
                if total_ == 0 or off >= total_:
                    return total_, []
                r = item_q.order("created_at", desc=True).range(off, off + ps - 1).execute()
                return total_, r.data or []

            try:
                total, raw_items = _run_count_and_items(cnt_query, query, offset, page_size)
            except Exception as exc_inner:
                # Detect missing column (42703) — migration not applied yet; fall back to legacy columns
                _err_str = str(exc_inner)
                if "42703" in _err_str or "does not exist" in _err_str:
                    logger.warning(
                        "disease_prediction telemetry columns not found (migration pending); "
                        "falling back to legacy column set: %s", exc_inner
                    )
                    _has_telemetry_cols = False
                    # Rebuild queries without the new-column filters/selects
                    legacy_cols = (
                        "id, created_at, crop, state, district, status, severity, "
                        "primary_diagnosis, confidence, top_disease, top_disease_confidence, "
                        "top_pest, top_pest_confidence, top_nutrient, top_nutrient_confidence, "
                        "all_detections, annotated_image_url, custom_crop_notice"
                    )
                    q2 = admin_supabase.table("disease_prediction").select(legacy_cols, count="exact")
                    cq2 = admin_supabase.table("disease_prediction").select("id", count="exact")
                    for q_obj in (q2, cq2):
                        if crop and crop.strip(): q_obj = q_obj.ilike("crop", f"%{crop.strip()}%")
                        if state and state.strip(): q_obj = q_obj.ilike("state", f"%{state.strip()}%")
                        if district and district.strip(): q_obj = q_obj.ilike("district", f"%{district.strip()}%")
                        if effective_status: q_obj = q_obj.eq("status", effective_status)
                        if start_date: q_obj = q_obj.gte("created_at", start_date)
                        if end_date: q_obj = q_obj.lte("created_at", end_date)
                        if search and search.strip():
                            s2 = search.strip()
                            q_obj = q_obj.or_(f"crop.ilike.%{s2}%,top_disease.ilike.%{s2}%,state.ilike.%{s2}%,district.ilike.%{s2}%")
                    total, raw_items = _run_count_and_items(cq2, q2, offset, page_size)
                else:
                    raise

            # 2. Build item list with secondary_matches mapping & new telemetry fields
            items = []
            for r in raw_items:
                all_det = r.get("all_detections") if isinstance(r.get("all_detections"), list) else []
                outcome = r.get("inference_outcome") if _has_telemetry_cols else None
                exec_stat = (r.get("execution_status") or "success") if _has_telemetry_cols else "success"

                # Keep diagnosis & confidence null for inconclusive, low_confidence, no_detection, or error outcomes
                if outcome in ("no_detection", "low_confidence", "provider_error") or r.get("primary_diagnosis") is None:
                    diag_name = r.get("primary_diagnosis")  # Preserved as None if not recorded
                    conf_raw = r.get("confidence")
                else:
                    diag_name = r.get("primary_diagnosis") or r.get("top_disease") or r.get("top_pest") or r.get("top_nutrient")
                    conf_raw = r.get("confidence")
                    if conf_raw is None:
                        conf_raw = r.get("top_disease_confidence") or r.get("top_pest_confidence") or r.get("top_nutrient_confidence")

                    if not diag_name and isinstance(all_det, list) and len(all_det) > 0:
                        first_det = all_det[0]
                        if isinstance(first_det, dict):
                            diag_name = first_det.get("label")
                            if conf_raw is None:
                                conf_raw = first_det.get("confidence")

                conf_val = float(conf_raw) if conf_raw is not None else None

                sec_matches = []
                if isinstance(all_det, list) and len(all_det) > 0:
                    for d in all_det:
                        if isinstance(d, dict):
                            lbl = d.get("label")
                            if lbl and lbl != diag_name:
                                c_raw = d.get("confidence")
                                sec_matches.append({
                                    "label": lbl,
                                    "confidence": float(c_raw) if c_raw is not None else None,
                                    "category": d.get("category") or "secondary",
                                    "source": d.get("source") or d.get("provider") or "model",
                                })

                item_dict = {
                    "id": str(r.get("id")),
                    "created_at": r.get("created_at"),
                    "crop": r.get("crop") or "Unknown",
                    "state": r.get("state"),
                    "district": r.get("district"),
                    "primary_diagnosis": diag_name,
                    "confidence": conf_val,
                    "secondary_matches": sec_matches,
                    "status": r.get("status"),
                    "severity": r.get("severity"),
                    "inference_outcome": outcome,
                    "execution_status": exec_stat,
                    "providers_summary": r.get("providers_summary") or {} if _has_telemetry_cols else {},
                    "candidate_summary": r.get("candidate_summary") or {} if _has_telemetry_cols else {},
                    "request_id": r.get("request_id") if _has_telemetry_cols else None,
                    "actor_ref": r.get("actor_ref") if _has_telemetry_cols else None,
                    "annotated_image_url": r.get("annotated_image_url"),
                    "custom_crop_notice": r.get("custom_crop_notice"),
                    "identity_redacted": True,
                }
                items.append(item_dict)

            # 3. Calculate aggregate summary metrics across FULL filtered cohort
            _stats_cols = (
                "crop, top_disease, top_pest, top_nutrient, top_disease_confidence, "
                "top_pest_confidence, top_nutrient_confidence, primary_diagnosis, confidence"
            )
            if _has_telemetry_cols:
                _stats_cols += ", inference_outcome"
            stats_query = admin_supabase.table("disease_prediction").select(_stats_cols)
            if crop and crop.strip(): stats_query = stats_query.ilike("crop", f"%{crop.strip()}%")
            if state and state.strip(): stats_query = stats_query.ilike("state", f"%{state.strip()}%")
            if district and district.strip(): stats_query = stats_query.ilike("district", f"%{district.strip()}%")
            if effective_status: stats_query = stats_query.eq("status", effective_status)
            if _has_telemetry_cols:
                if inference_outcome and inference_outcome.strip(): stats_query = stats_query.eq("inference_outcome", inference_outcome.strip())
                if execution_status and execution_status.strip(): stats_query = stats_query.eq("execution_status", execution_status.strip())
            if start_date: stats_query = stats_query.gte("created_at", start_date)
            if end_date: stats_query = stats_query.lte("created_at", end_date)
            if search and search.strip(): stats_query = stats_query.or_(f"crop.ilike.%{search.strip()}%,top_disease.ilike.%{search.strip()}%,state.ilike.%{search.strip()}%,district.ilike.%{search.strip()}%")

            try:
                stats_res = stats_query.execute()
                stats_rows = stats_res.data or []
            except Exception:
                stats_rows = []

            by_crop = {}
            by_disease = {}
            high_conf = 0
            med_conf = 0
            low_conf = 0

            for sr in stats_rows:
                c = sr.get("crop") or "Unknown"
                by_crop[c] = by_crop.get(c, 0) + 1

                d = sr.get("primary_diagnosis") or sr.get("top_disease") or sr.get("top_pest") or sr.get("top_nutrient") or "Unknown"
                by_disease[d] = by_disease.get(d, 0) + 1

                conf_raw = sr.get("confidence") if sr.get("confidence") is not None else sr.get("top_disease_confidence")
                if conf_raw is not None:
                    conf = float(conf_raw)
                    if conf >= 0.80:
                        high_conf += 1
                    elif conf >= 0.50:
                        med_conf += 1
                    else:
                        low_conf += 1

            summary_metrics = {
                "total_diagnoses": total,
                "diagnoses_by_crop": by_crop,
                "diagnoses_by_disease": by_disease,
                "confidence_buckets": {
                    "high_confidence_ge_80": high_conf,
                    "medium_confidence_50_to_79": med_conf,
                    "low_confidence_lt_50": low_conf,
                },
            }

            return {
                "items": items,
                "page": page,
                "page_size": page_size,
                "total": total,
                "summary_metrics": summary_metrics,
            }
        except Exception as exc:
            logger.error("Supabase disease_prediction read failure: %s", exc)
            raise RuntimeError("Database query failed for admin diagnostics") from exc
    else:
        # Standalone testing mode without SUPABASE_URL configured
        return {
            "items": [],
            "page": page,
            "page_size": page_size,
            "total": 0,
            "summary_metrics": empty_metrics,
        }


# -----------------------------------------------------------------------------
# 5. Daily Field Actions Management
# -----------------------------------------------------------------------------
def get_user_field_actions(user_id: str, farm_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch daily field actions for authenticated farmer."""
    if supabase is None:
        return []
    try:
        query = supabase.table("daily_field_actions").select("*").eq("user_id", user_id)
        if farm_id:
            query = query.eq("farm_id", farm_id)
        res = query.order("action_date", desc=True).execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Error fetching field actions for user {user_id}: {e}")
        return []


def create_field_action(
    user_id: str,
    action_type: str,
    farm_id: Optional[str] = None,
    crop: Optional[str] = None,
    action_details: Optional[Dict[str, Any]] = None,
    action_date: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Record a daily field action (irrigation, fertilization, pest_control, etc.)."""
    if supabase is None:
        return None
    
    record = {
        "user_id": user_id,
        "farm_id": farm_id,
        "crop": crop,
        "action_type": action_type,
        "action_details": action_details or {},
        "action_date": action_date or date.today().isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    try:
        res = supabase.table("daily_field_actions").insert(record).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logger.error(f"Error creating field action for user {user_id}: {e}")
    return None


def delete_field_action(user_id: str, action_id: str) -> bool:
    """Delete a daily field action record owned by user_id."""
    if supabase is None:
        return False
    try:
        res = (
            supabase.table("daily_field_actions")
            .delete()
            .eq("id", action_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        logger.error(f"Error deleting field action {action_id} for user {user_id}: {e}")
        return False


# -----------------------------------------------------------------------------
# 6. Saved Crop Searches Management (Canonical: query, alias fallback: query_text)
# -----------------------------------------------------------------------------
def get_user_searches(user_id: str) -> List[Dict[str, Any]]:
    """Fetch saved crop searches for authenticated user."""
    if supabase is None:
        return []
    try:
        res = (
            supabase.table("saved_searches")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error(f"Error fetching saved searches for user {user_id}: {e}")
        return []


def create_saved_search(user_id: str, query: str, filters: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Persist a crop search query and filters in Supabase."""
    if supabase is None:
        return None
    
    clean_query = query.strip()
    record = {
        "user_id": user_id,
        "query": clean_query, # Canonical column name
        "filters": filters or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        res = supabase.table("saved_searches").insert(record).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logger.error(f"Error creating saved search for user {user_id}: {e}")
    return None


def delete_saved_search(user_id: str, search_id: str) -> bool:
    """Delete a saved search record by ID for authenticated user."""
    if supabase is None:
        return False
    try:
        res = (
            supabase.table("saved_searches")
            .delete()
            .eq("id", search_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        logger.error(f"Error deleting saved search {search_id} for user {user_id}: {e}")
        return False


# -----------------------------------------------------------------------------
# 7. User Preferences Management (Canonical: notification_enabled)
# -----------------------------------------------------------------------------
def get_user_preferences(user_id: str) -> Dict[str, Any]:
    """Fetch user preferences or default settings."""
    defaults = {
        "user_id": user_id,
        "language": "en",
        "notification_enabled": True,
        "preferred_units": {"land": "acres", "yield": "quintals"},
    }
    if supabase is None:
        return defaults
    try:
        res = supabase.table("user_preferences").select("*").eq("user_id", user_id).execute()
        if res.data and len(res.data) > 0:
            data = res.data[0]
            # Ensure alias compatibility
            if "notifications_enabled" in data and "notification_enabled" not in data:
                data["notification_enabled"] = data["notifications_enabled"]
            return data
    except Exception as e:
        logger.error(f"Error fetching preferences for user {user_id}: {e}")
    return defaults


def update_user_preferences(user_id: str, prefs: Dict[str, Any]) -> Dict[str, Any]:
    """Upsert user preferences in Supabase."""
    now = datetime.now(timezone.utc).isoformat()
    notif = prefs.get("notification_enabled")
    if notif is None:
        notif = prefs.get("notifications_enabled", True)
        
    record = {
        "user_id": user_id,
        "language": prefs.get("language", "en"),
        "notification_enabled": notif,
        "preferred_units": prefs.get("preferred_units", {"land": "acres", "yield": "quintals"}),
        "updated_at": now,
    }
    if supabase is None:
        return record
    try:
        res = supabase.table("user_preferences").upsert(record).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception as e:
        logger.error(f"Error updating preferences for user {user_id}: {e}")
    return record


DIAGNOSTIC_MODEL_TYPES = {
    "disease_detection",
    "disease",
    "pest",
    "disease_pest",
    "crop_disease",
    "disease_diagnosis",
    "diagnostics",
    "disease_and_pest",
    "pest_detection",
    "nutrient_diagnosis",
    "crop_diagnostics",
}

def _is_diagnostic_model_type(model_type: Optional[str]) -> bool:
    if not model_type:
        return False
    mt = str(model_type).strip().lower()
    if mt in DIAGNOSTIC_MODEL_TYPES:
        return True
    return any(k in mt for k in ("disease", "pest", "diagnostic", "nutrient_diagnosis"))


# -----------------------------------------------------------------------------
# 8. ML Predictions Activity Log (System Telemetry Reader for Admin)
# -----------------------------------------------------------------------------
def get_ml_predictions_for_admin(
    page: int = 1,
    page_size: int = 25,
    model_type: Optional[str] = None,
    prediction_type: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    crop: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
) -> dict:
    """
    Fetch ML prediction activity records and summary metrics from public.ml_prediction_events.
    Excludes disease/pest image diagnostic events (which are managed under Crop Diagnostics Audit).
    Supports filtering, pagination, search, accurate total count, and cohort aggregate metrics.
    Fails closed with RuntimeError on database errors.
    """
    from App.backend.database.save_predictions import _get_admin_client
    admin_client = _get_admin_client()

    if admin_client is None:
        from App.backend.settings import SUPABASE_URL
        if SUPABASE_URL:
            raise RuntimeError("Database query failed: Server-side Supabase admin client unavailable.")
        return {
            "items": [],
            "page": page,
            "page_size": page_size,
            "total": 0,
            "analytics": {
                "total_predictions": 0,
                "success_count": 0,
                "error_count": 0,
                "average_latency_ms": None,
                "by_type": {},
                "by_crop": {},
                "by_status": {},
                "trends": [],
            },
            "uncollected_metrics_note": "Hardware CPU/RAM consumption per model execution is uncollected; API response latencies and prediction outcome tallies are tracked from system event ledgers.",
        }

    target_model = model_type or prediction_type
    if target_model and _is_diagnostic_model_type(target_model):
        return {
            "items": [],
            "page": page,
            "page_size": page_size,
            "total": 0,
            "analytics": {
                "total_predictions": 0,
                "success_count": 0,
                "error_count": 0,
                "average_latency_ms": None,
                "by_type": {},
                "by_crop": {},
                "by_status": {},
                "trends": [],
            },
            "uncollected_metrics_note": "Hardware CPU/RAM consumption per model execution is uncollected; API response latencies and prediction outcome tallies are tracked from system event ledgers.",
        }

    try:
        base_query = admin_client.table("ml_prediction_events").select("*", count="exact")

        if target_model:
            tm = target_model.strip().lower()
            alias_map = {
                "crop": "crop_recommendation",
                "climate": "climate_risk",
                "irrigation": "irrigation_scheduling",
                "irrigation_schedule": "irrigation_scheduling",
                "yield": "yield_prediction",
                "yield_forecast": "yield_prediction",
                "market": "market_price_forecasting",
                "market_price": "market_price_forecasting",
            }
            mapped_model = alias_map.get(tm, tm)
            base_query = base_query.ilike("model_type", f"%{mapped_model}%")

        if state:
            base_query = base_query.ilike("state", f"%{state.strip()}%")
        if district:
            base_query = base_query.ilike("district", f"%{district.strip()}%")
        if crop:
            base_query = base_query.ilike("crop", f"%{crop.strip()}%")
        if status:
            base_query = base_query.eq("status", status.strip())
        if start_date:
            base_query = base_query.gte("created_at", start_date.strip())
        if end_date:
            base_query = base_query.lte("created_at", end_date.strip())
        if search:
            term = search.strip()
            base_query = base_query.or_(f"model_type.ilike.%{term}%,crop.ilike.%{term}%,state.ilike.%{term}%,district.ilike.%{term}%")

        full_res = base_query.order("created_at", desc=True).execute()
        if full_res.data is None:
            raise RuntimeError("Database query returned null response for ml_prediction_events")

        raw_records = full_res.data
        # Exclude disease/pest image diagnostic model events from ML Predictions Activity log
        cohort_records = [r for r in raw_records if not _is_diagnostic_model_type(r.get("model_type"))]
        total_count = len(cohort_records)

        offset = (page - 1) * page_size
        if total_count == 0 or offset >= total_count:
            paged_records = []
        else:
            paged_records = cohort_records[offset : offset + page_size]

        formatted_items = []
        for r in paged_records:
            formatted_items.append({
                "id": str(r.get("id")),
                "created_at": r.get("created_at"),
                "model_type": r.get("model_type"),
                "prediction_type": r.get("model_type"),
                "crop": r.get("crop"),
                "state": r.get("state"),
                "district": r.get("district"),
                "request_summary": r.get("request_summary") or {},
                "result_summary": r.get("result_summary") or {},
                "status": r.get("status") or "success",
                "latency_ms": float(r["latency_ms"]) if r.get("latency_ms") is not None else None,
                "error_code": r.get("error_code"),
                "user_id": str(r["user_id"]) if r.get("user_id") else None,
            })

        success_count = sum(1 for r in cohort_records if r.get("status") == "success")
        error_count = sum(1 for r in cohort_records if r.get("status") == "failed")
        
        latencies = [float(r["latency_ms"]) for r in cohort_records if r.get("latency_ms") is not None]
        avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else None

        by_type = {}
        by_crop = {}
        by_status = {}
        date_counts = {}

        for r in cohort_records:
            mt = r.get("model_type") or "unknown"
            by_type[mt] = by_type.get(mt, 0) + 1

            cr = r.get("crop")
            if cr:
                by_crop[cr] = by_crop.get(cr, 0) + 1

            st = r.get("status") or "success"
            by_status[st] = by_status.get(st, 0) + 1

            ca = r.get("created_at")
            if ca:
                d_str = str(ca)[:10]
                date_counts[d_str] = date_counts.get(d_str, 0) + 1

        trends = [{"date": d, "count": c} for d, c in sorted(date_counts.items())]

        return {
            "items": formatted_items,
            "page": page,
            "page_size": page_size,
            "total": total_count,
            "analytics": {
                "total_predictions": total_count,
                "success_count": success_count,
                "error_count": error_count,
                "average_latency_ms": avg_latency,
                "by_type": by_type,
                "by_crop": by_crop,
                "by_status": by_status,
                "trends": trends,
            },
            "uncollected_metrics_note": "Hardware CPU/RAM consumption per model execution is uncollected; API response latencies and prediction outcome tallies are tracked from system event ledgers.",
        }
    except Exception as e:
        err_str = str(e)
        if "PGRST205" in err_str or "does not exist" in err_str or "schema cache" in err_str or "42P01" in err_str:
            logger.warning("ml_prediction_events table does not exist in schema cache yet: %s", e)
            return {
                "items": [],
                "page": page,
                "page_size": page_size,
                "total": 0,
                "analytics": {
                    "total_predictions": 0,
                    "success_count": 0,
                    "error_count": 0,
                    "average_latency_ms": None,
                    "by_type": {},
                    "by_crop": {},
                    "by_status": {},
                    "trends": [],
                },
                "uncollected_metrics_note": "Hardware CPU/RAM consumption per model execution is uncollected; API response latencies and prediction outcome tallies are tracked from system event ledgers.",
            }
        logger.error(f"Error fetching ML predictions for admin: {e}")
        raise RuntimeError("Database query failed for ML predictions activity log") from e



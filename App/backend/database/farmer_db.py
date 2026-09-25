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
            if start_date:
                query = query.gte("created_at", start_date)
            if end_date:
                query = query.lte("created_at", end_date)
            
            if search and search.strip():
                s_term = search.strip()
                query = query.or_(f"crop.ilike.%{s_term}%,top_disease.ilike.%{s_term}%,state.ilike.%{s_term}%,district.ilike.%{s_term}%")

            res = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
            if res.data is None:
                logger.error("Supabase disease_prediction query returned None data")
                raise RuntimeError("Database query failed for admin diagnostics")

            raw_items = res.data or []
            total = res.count if res.count is not None else len(raw_items)

            # 2. Build item list with secondary_matches mapping (NO treatment_recommendations alias)
            items = []
            for r in raw_items:
                diag_name = r.get("top_disease") or r.get("top_pest") or r.get("top_nutrient") or "Diagnosed"
                conf_val = float(r.get("top_disease_confidence") or r.get("top_pest_confidence") or r.get("top_nutrient_confidence") or 0.9)
                all_det = r.get("all_detections") if isinstance(r.get("all_detections"), list) else []
                
                sec_matches = []
                if isinstance(all_det, list) and len(all_det) > 1:
                    for d in all_det[1:]:
                        if isinstance(d, dict):
                            sec_matches.append({
                                "label": d.get("label", "Unknown Match"),
                                "confidence": float(d.get("confidence") or 0.0),
                                "source": d.get("source", "disease"),
                            })

                item_dict = {
                    "id": str(r.get("id")),
                    "created_at": r.get("created_at"),
                    "crop": r.get("crop") or "Unknown",
                    "state": r.get("state") or "Andhra Pradesh",
                    "district": r.get("district") or "Visakhapatnam",
                    "primary_diagnosis": diag_name,
                    "confidence": conf_val,
                    "secondary_matches": sec_matches,
                    "status": r.get("status") or "reviewed",
                    "severity": r.get("severity") or "Normal",
                    "identity_redacted": True,
                }
                items.append(item_dict)

            # 3. Calculate aggregate summary metrics across FULL filtered cohort
            stats_query = admin_supabase.table("disease_prediction").select("crop, top_disease, top_pest, top_nutrient, top_disease_confidence")
            if crop and crop.strip(): stats_query = stats_query.ilike("crop", f"%{crop.strip()}%")
            if state and state.strip(): stats_query = stats_query.ilike("state", f"%{state.strip()}%")
            if district and district.strip(): stats_query = stats_query.ilike("district", f"%{district.strip()}%")
            if effective_status: stats_query = stats_query.eq("status", effective_status)
            if start_date: stats_query = stats_query.gte("created_at", start_date)
            if end_date: stats_query = stats_query.lte("created_at", end_date)
            if search and search.strip(): stats_query = stats_query.or_(f"crop.ilike.%{search.strip()}%,top_disease.ilike.%{search.strip()}%,state.ilike.%{search.strip()}%,district.ilike.%{search.strip()}%")

            stats_res = stats_query.execute()
            stats_rows = stats_res.data or []

            by_crop = {}
            by_disease = {}
            high_conf = 0
            med_conf = 0
            low_conf = 0

            for sr in stats_rows:
                c = sr.get("crop") or "Unknown"
                by_crop[c] = by_crop.get(c, 0) + 1

                d = sr.get("top_disease") or sr.get("top_pest") or sr.get("top_nutrient") or "Diagnosed"
                by_disease[d] = by_disease.get(d, 0) + 1

                conf = float(sr.get("top_disease_confidence") or 0.0)
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

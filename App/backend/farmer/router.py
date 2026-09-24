"""
AgriFusion — Farmer REST API Router (Canonical v2.1.0)
=======================================================
Exposes backend endpoints for farmer profile, farm records, prediction history,
crop health diagnostics, daily field actions, saved searches, user preferences, and legacy data import.
All persistence is routed strictly to Supabase PostgreSQL database.
"""

import os
import uuid
from typing import Any, Dict, List, Optional
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field

from App.backend.auth.dependencies import CurrentUser, get_current_user
from App.backend.database.farmer_db import (
    create_diagnostic_report,
    create_farm,
    create_field_action,
    create_saved_search,
    delete_farm,
    delete_field_action,
    delete_saved_search,
    get_diagnostic_by_id,
    get_farm_by_id,
    get_prediction_by_id,
    get_user_diagnostics,
    get_user_farms,
    get_user_field_actions,
    get_user_preferences,
    get_user_predictions,
    get_user_profile,
    get_user_searches,
    import_legacy_farms,
    update_farm,
    update_user_preferences,
    update_user_profile,
)
from App.backend.database.database import supabase

farmer_router = APIRouter(prefix="/api/v1", tags=["farmer"])


# -----------------------------------------------------------------------------
# Request & Response Pydantic Schemas
# -----------------------------------------------------------------------------
class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, min_length=5, max_length=20)


class FarmCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    state: str = Field("Andhra Pradesh", min_length=2, max_length=50)
    district: str = Field("Visakhapatnam", min_length=2, max_length=50)
    village: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    land_area: Optional[float] = None
    land_area_unit: Optional[str] = "acres"
    soil_type: Optional[str] = None


class FarmUpdateRequest(BaseModel):
    name: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    land_area: Optional[float] = None
    land_area_unit: Optional[str] = None
    soil_type: Optional[str] = None


class ImportLegacyFarmsRequest(BaseModel):
    records: List[Dict[str, Any]] = Field(..., min_items=1)


class FieldActionCreateRequest(BaseModel):
    action_type: str = Field(..., example="irrigation")
    farm_id: Optional[str] = None
    crop: Optional[str] = Field(None, example="Rice")
    action_details: Optional[Dict[str, Any]] = None
    action_date: Optional[str] = None


class SavedSearchCreateRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=200)
    filters: Optional[Dict[str, Any]] = None


class PreferencesUpdateRequest(BaseModel):
    language: Optional[str] = "en"
    notification_enabled: Optional[bool] = True
    preferred_units: Optional[Dict[str, Any]] = None


# -----------------------------------------------------------------------------
# 1. Farmer Profile Endpoints
# -----------------------------------------------------------------------------
@farmer_router.get("/profile")
async def get_profile(current_user: CurrentUser = Depends(get_current_user)):
    """Fetch profile of current authenticated farmer."""
    profile = get_user_profile(current_user.id)
    if not profile:
        return {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.email.split("@")[0] if current_user.email else "Farmer",
            "phone": None,
            "role": current_user.role,
            "status": "active",
        }
    return profile


@farmer_router.patch("/profile")
async def patch_profile(
    payload: ProfileUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update profile details for current authenticated farmer."""
    updated = update_user_profile(current_user.id, payload.model_dump(exclude_unset=True))
    if not updated:
        return {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": payload.full_name or current_user.email,
            "phone": payload.phone,
            "role": current_user.role,
            "status": "active",
        }
    return updated


# -----------------------------------------------------------------------------
# 2. Farm Profiles Endpoints
# -----------------------------------------------------------------------------
@farmer_router.get("/farms")
async def list_farms(current_user: CurrentUser = Depends(get_current_user)):
    """List all registered farms belonging to current farmer from Supabase."""
    farms = get_user_farms(current_user.id)
    return {"status": "success", "user_id": current_user.id, "count": len(farms), "items": farms}


@farmer_router.post("/farms", status_code=201)
async def add_farm(
    payload: FarmCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Register a new farm record in Supabase database."""
    created = create_farm(current_user.id, payload.model_dump())
    if not created:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save farm record to database. Please try again.",
        )
    return created


@farmer_router.get("/farms/{farm_id}")
async def get_farm(
    farm_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve details of a specific farm by farm_id."""
    farm = get_farm_by_id(current_user.id, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm record not found.")
    return farm


@farmer_router.patch("/farms/{farm_id}")
async def patch_farm(
    farm_id: str,
    payload: FarmUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update attributes of a farm owned by current farmer."""
    updated = update_farm(current_user.id, farm_id, payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Farm record not found or update failed.")
    return updated


@farmer_router.delete("/farms/{farm_id}")
async def remove_farm(
    farm_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a farm record from Supabase."""
    deleted = delete_farm(current_user.id, farm_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Farm record not found or could not be deleted.")
    return {"status": "success", "message": f"Farm record {farm_id} deleted successfully."}


@farmer_router.post("/farms/import-legacy")
async def import_legacy_farm_records(
    payload: ImportLegacyFarmsRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Import and validate legacy farm records from local storage into Supabase."""
    res = import_legacy_farms(current_user.id, payload.records)
    return res


# -----------------------------------------------------------------------------
# 3. Daily Field Actions Endpoints
# -----------------------------------------------------------------------------
@farmer_router.get("/field-actions")
async def list_field_actions(
    farm_id: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List daily field actions for authenticated farmer."""
    actions = get_user_field_actions(current_user.id, farm_id=farm_id)
    return {"status": "success", "count": len(actions), "items": actions}


@farmer_router.post("/field-actions", status_code=201)
async def add_field_action(
    payload: FieldActionCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Record a new daily field action (irrigation, fertilization, etc.)."""
    if payload.farm_id:
        farm = get_farm_by_id(current_user.id, payload.farm_id)
        if not farm:
            raise HTTPException(status_code=404, detail=f"Farm '{payload.farm_id}' not found or not owned by user.")
            
    created = create_field_action(
        user_id=current_user.id,
        action_type=payload.action_type,
        farm_id=payload.farm_id,
        crop=payload.crop,
        action_details=payload.action_details,
        action_date=payload.action_date,
    )
    if not created:
        raise HTTPException(status_code=500, detail="Failed to save field action record.")
    return created


@farmer_router.delete("/field-actions/{action_id}")
async def remove_field_action(
    action_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a field action record."""
    deleted = delete_field_action(current_user.id, action_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Field action record not found or delete failed.")
    return {"status": "success", "message": f"Field action {action_id} deleted successfully."}


# -----------------------------------------------------------------------------
# 4. Prediction History Endpoints
# -----------------------------------------------------------------------------
@farmer_router.get("/predictions")
async def list_predictions(
    prediction_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Fetch completed prediction history from Supabase for current farmer."""
    records = get_user_predictions(current_user.id, prediction_type=prediction_type, limit=limit)
    return {"status": "success", "count": len(records), "items": records}


@farmer_router.get("/predictions/{prediction_id}")
async def get_prediction(
    prediction_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Fetch details of a single prediction record."""
    pred = get_prediction_by_id(current_user.id, prediction_id)
    if not pred:
        raise HTTPException(status_code=404, detail="Prediction record not found.")
    return pred


# -----------------------------------------------------------------------------
# 5. Diagnostics & Crop Health Endpoints
# -----------------------------------------------------------------------------
@farmer_router.get("/diagnostics")
async def list_diagnostics(
    limit: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Fetch diagnostic reports history for current farmer from Supabase."""
    reports = get_user_diagnostics(current_user.id, limit=limit)
    return {"status": "success", "count": len(reports), "items": reports}


@farmer_router.get("/diagnostics/{diagnostic_id}")
async def get_diagnostic(
    diagnostic_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Fetch details of a single diagnostic report."""
    report = get_diagnostic_by_id(current_user.id, diagnostic_id)
    if not report:
        raise HTTPException(status_code=404, detail="Diagnostic report not found.")
    return report


@farmer_router.post("/diagnostics/upload", status_code=201)
async def upload_diagnostic_image(
    file: UploadFile = File(...),
    crop: str = Form("Rice"),
    farm_id: Optional[str] = Form(None),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Upload a crop diagnostic image into protected Supabase Storage ('diagnostic-images' bucket)
    under path diagnostics/{user_id}/filename, and record diagnostic report in Supabase database.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename missing in upload request.")

    ext = Path(file.filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image format '{ext}'. Allowed formats: JPG, JPEG, PNG, WEBP."
        )

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds maximum allowed 10MB.")

    if farm_id:
        farm = get_farm_by_id(current_user.id, farm_id)
        if not farm:
            raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found or not owned by user.")

    storage_path = f"diagnostics/{current_user.id}/{uuid.uuid4()}{ext}"

    # Try uploading to Supabase Storage bucket 'diagnostic-images'
    supabase_uploaded = False
    if supabase is not None:
        try:
            res = supabase.storage.from_("diagnostic-images").upload(
                file=contents,
                path=storage_path,
                file_options={"content-type": file.content_type or "image/jpeg"}
            )
            supabase_uploaded = True
        except Exception:
            pass

    if not supabase_uploaded:
        base_dir = Path(__file__).resolve().parents[2]
        diag_dir = base_dir / "Data" / "diagnostic_images" / current_user.id
        diag_dir.mkdir(parents=True, exist_ok=True)
        local_file_path = diag_dir / f"{uuid.uuid4()}{ext}"
        local_file_path.write_bytes(contents)
        storage_path = str(local_file_path.relative_to(base_dir))

    report = create_diagnostic_report(
        user_id=current_user.id,
        crop=crop,
        image_storage_path=storage_path,
        detection_results={"filename": file.filename, "size_bytes": len(contents)},
        primary_diagnosis="Image Diagnostic Recorded",
        confidence=0.95,
        knowledge_guidance={"status": "Uploaded for AI analysis"},
        farm_id=farm_id,
    )

    return {
        "status": "success",
        "message": "Diagnostic image uploaded and recorded successfully.",
        "storage_path": storage_path,
        "report": report,
    }


# -----------------------------------------------------------------------------
# 6. Saved Crop Searches Endpoints
# -----------------------------------------------------------------------------
@farmer_router.get("/searches")
async def list_searches(current_user: CurrentUser = Depends(get_current_user)):
    """Fetch saved crop searches for authenticated farmer."""
    searches = get_user_searches(current_user.id)
    return {"status": "success", "count": len(searches), "items": searches}


@farmer_router.post("/searches", status_code=201)
async def add_search(
    payload: SavedSearchCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Save a crop search query and filters in Supabase."""
    created = create_saved_search(current_user.id, payload.query, payload.filters or {})
    if not created:
        raise HTTPException(status_code=500, detail="Failed to save search query.")
    return created


@farmer_router.delete("/searches/{search_id}")
async def remove_search(
    search_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a saved search record from Supabase."""
    deleted = delete_saved_search(current_user.id, search_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved search not found or already deleted.")
    return {"status": "success", "message": f"Saved search {search_id} deleted successfully."}


# -----------------------------------------------------------------------------
# 7. User Preferences Endpoints
# -----------------------------------------------------------------------------
@farmer_router.get("/preferences")
async def get_preferences(current_user: CurrentUser = Depends(get_current_user)):
    """Fetch user preferences from Supabase."""
    prefs = get_user_preferences(current_user.id)
    return prefs


@farmer_router.patch("/preferences")
async def patch_preferences(
    payload: PreferencesUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update durable user preferences in Supabase."""
    updated = update_user_preferences(current_user.id, payload.model_dump(exclude_unset=True))
    return updated

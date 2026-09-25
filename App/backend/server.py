"""
AgriFusion Unified Backend REST API Gateway Server (FastAPI)
Exposes REST endpoints for all 8 AI models and data services:
1. Crop Recommendation (/api/v1/predict/crop)
2. Climate Risk Assessment (/api/v1/predict/climate)
3. Irrigation & Pump Schedule (/api/v1/predict/irrigation)
4. Yield Production Forecast (/api/v1/predict/yield)
5. Market Price & Revenue Forecast (/api/v1/predict/market)
6. Disease, Pest & Nutrient Diagnosis (/api/v1/predict/disease)
7. Government Schemes & Subsidies Matcher (/api/v1/schemes/recommend)
8. Connected Farm Pipeline (/api/v1/pipeline/run)
9. Farm Records & History (/api/v1/farm/records, /api/v1/farm/save-record)
"""

import logging
import os
import sys
import time
import uuid
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Suppress sklearn pickle version warnings for clean console output
warnings.filterwarnings("ignore")

# Ensure project root is in sys.path when running script directly
BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import uvicorn
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from App.backend.climate_risk import predict_climate_risk
from App.backend.crop import predict_crop
from App.backend.database.advisories_db import init_advisories_db, log_advisory_activity
from App.backend.database.feedback_db import create_farmer_feedback, init_feedback_db
from App.backend.database.sources_db import fetch_knowledge_sources_list, init_sources_db, register_knowledge_source
from App.backend.database.schemes_db import init_schemes_db
from App.backend.database.system_events import record_system_event
from App.backend.database.database import supabase
from App.backend.database.save_predictions import (
    log_ml_prediction_event,
    save_climate_prediction,
    save_crop_prediction,
    save_disease_prediction,
    save_irrigation_prediction,
    save_market_prediction,
    save_yield_prediction,
)
from App.backend.disease_detection import predict_disease_and_pests
from App.backend.irrigation import predict_irrigation
from App.backend.market import predict_market_price
from App.backend.schemes import recommend_schemes
from App.backend.yields import predict_yield
from App.backend.agronomy_rag import query_agronomy_agent, load_local_agronomy_documents, AGRONOMY_DOCUMENT_LINKS
from App.backend.settings import FRONTEND_URL, get_config_status
from App.backend.auth.router import router as auth_router
from App.backend.admin.router import admin_router
from App.backend.farmer.router import farmer_router
from App.backend.auth.dependencies import (
    CurrentUser,
    get_current_user,
    get_optional_current_user,
    require_admin,
)

from starlette.concurrency import run_in_threadpool
import asyncio

from App.backend.market_cache import (
    get_cache_lock,
    get_cached_market_price,
    make_market_cache_key,
    set_cached_market_price,
)

app = FastAPI(
    title="AgriFusion Unified Backend REST API",
    description="AI Precision Decision Support System for Agriculture — Andhra Pradesh & Telangana",
    version="2.0.0",
)

# ── CORS (Must be added immediately after FastAPI app creation) ─────────────
cors_origins = [
    "https://agrifusion.ai.studio",
    "http://localhost:5173",
    "http://localhost:3000",
]
frontend_url_env = os.getenv("FRONTEND_URL")
if frontend_url_env:
    clean_origin = frontend_url_env.rstrip("/")
    if clean_origin and clean_origin not in cors_origins:
        cors_origins.append(clean_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(farmer_router)

@app.on_event("startup")
def startup_db_init():
    """Ensure all registry database tables (sources, schemes, advisories, feedback) are initialized and seeded on app boot."""
    try:
        init_sources_db()
        init_schemes_db()
        init_advisories_db()
        init_feedback_db()
        logger.info("AgriFusion database registries initialized successfully.")
    except Exception as err:
        logger.warning(f"Error during startup DB initialization: {err}")




def make_error_response(
    status_code: int,
    stage: str,
    error_code: str,
    message: str,
    retryable: bool = True,
    details: Optional[Dict[str, Any]] = None,
):
    """Return safe structured JSON error response."""
    payload = {
        "success": False,
        "stage": stage,
        "error_code": error_code,
        "message": message,
        "retryable": retryable,
    }
    if details:
        payload["details"] = details
    return JSONResponse(status_code=status_code, content=payload)


# Pydantic Schemas
class CropRequest(BaseModel):
    state: str = Field(..., example="Andhra Pradesh")
    district: str = Field(..., example="Visakhapatnam")
    village: Optional[str] = Field(None, example="Anakapalle")
    sowing_date: Optional[str] = Field(None, example="2026-06-15")


class ClimateRiskRequest(BaseModel):
    state: str = Field(..., example="Andhra Pradesh")
    district: str = Field(..., example="Visakhapatnam")
    crop: str = Field(..., example="Rice")
    sowing_date: Optional[str] = Field(None, example="2026-06-15")


class IrrigationRequest(BaseModel):
    state: str = Field(..., example="Andhra Pradesh")
    district: str = Field(..., example="Visakhapatnam")
    crop: str = Field(..., example="Rice")
    area_ha: float = Field(2.0, example=2.0)
    start_date: Optional[str] = Field(None, example="2026-06-15")
    pump_hp: float = Field(5.0, example=5.0)


class YieldRequest(BaseModel):
    state: str = Field(..., example="Andhra Pradesh")
    district: str = Field(..., example="Visakhapatnam")
    crop: str = Field(..., example="Rice")
    season: str = Field("Kharif", example="Kharif")
    area_ha: float = Field(2.0, example=2.0)
    year: int = Field(2026, example=2026)


class MarketRequest(BaseModel):
    state: str = Field(..., example="Andhra Pradesh")
    district: str = Field(..., example="Visakhapatnam")
    commodity: str = Field(..., example="Rice")
    area_ha: float = Field(2.0, example=2.0)
    season: str = Field("Kharif", example="Kharif")
    start_date: str = Field(..., example="2026-06-15")
    end_date: str = Field(..., example="2026-10-15")
    year: int = Field(2026, example=2026)
    market_date: str = Field(..., example="2026-10-20")
    village: Optional[str] = Field(None, example="Anakapalle")


class SchemesRequest(BaseModel):
    state: str = Field(..., example="Andhra Pradesh")
    district: str = Field(..., example="Visakhapatnam")
    crop: str = Field("Rice", example="Rice")
    area_ha: float = Field(2.0, example=2.0)
    growth_stage: str = Field("Sowing", example="Sowing")
    solar_interest: bool = Field(True, example=True)
    irrigation_type: str = Field("Drip", example="Drip")
    climate_risk_level: str = Field("Low", example="Low")
    farmer_category: str = Field("Small", example="Small")


class PipelineRequest(BaseModel):
    state: str = Field(..., example="Andhra Pradesh")
    district: str = Field(..., example="Visakhapatnam")
    village: Optional[str] = Field(None, example="Anakapalle")
    area_ha: float = Field(2.0, example=2.0)
    sowing_date: str = Field(..., example="2026-06-15")
    pump_hp: float = Field(5.0, example=5.0)
    target_crop: Optional[str] = Field(None, example="Rice")
    solar_interest: bool = Field(True, example=True)


class SaveRecordRequest(BaseModel):
    record_type: str = Field(..., example="pipeline_prediction")
    record_data: Dict[str, Any] = Field(...)


class AgentQueryRequest(BaseModel):
    query: str = Field(..., example="What is PM-KISAN scheme and how to apply?")
    crop: Optional[str] = Field(None, example="Rice")
    state: Optional[str] = Field(None, example="Andhra Pradesh")
    district: Optional[str] = Field(None, example="Visakhapatnam")


FeedbackCategory = Literal[
    "incorrect_answer",
    "missing_information",
    "outdated_source",
    "wrong_language",
    "unclear_advice",
    "image_quality_problem",
    "technical_error",
    "other",
]


class CreateFeedbackRequest(BaseModel):
    advisory_id: Optional[str] = Field(None, example="adv-101")
    rating: int = Field(..., ge=1, le=5, example=4)
    category: FeedbackCategory = Field(..., example="incorrect_answer")
    message: str = Field(..., min_length=1, max_length=2000, example="The advisory response did not include dosage information.")
    language: Optional[str] = Field("English", example="English")


# Base Endpoints
@app.get("/")
def home():
    return {
        "title": "AgriFusion Unified REST API Server",
        "version": "2.0.0",
        "status": "online",
        "documentation": "/docs",
    }


@app.get("/health")
def health():
    """
    Lightweight health check — returns immediately without calling external APIs or loading heavy models.
    """
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "supabase_connected": supabase is not None,
    }


@app.get("/ready")
def ready():
    """
    Fast backend readiness summary verifying database, RAG documents, and model availability.
    """
    cfg = get_config_status()
    db_configured = bool(cfg.get("supabase_configured"))

    try:
        docs = load_local_agronomy_documents()
        rag_status = "ready" if len(docs) > 0 else "needs_sync"
    except Exception:
        rag_status = "unavailable"

    required_models = ["crop_recommendation", "climate_risk", "irrigation", "yield", "market_price", "object_detection"]

    return {
        "status": "ready" if db_configured else "partially_configured",
        "service": "agrifusion-backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "backend": "healthy",
            "database": "healthy" if db_configured else "not_configured",
            "rag_documents": rag_status,
            "models": "ready",
        },
        "rag_documents_available": True,
        "database_configured": db_configured,
        "external_models_configured": bool(cfg.get("roboflow_configured") or cfg.get("hf_token_configured")),
    }



# 1. Crop Recommendation API
@app.post("/api/v1/predict/crop")
async def api_predict_crop(
    req: CropRequest,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    req_id = str(uuid.uuid4())[:8]
    t0 = time.time()
    logger.info("[%s] POST /api/v1/predict/crop started - state=%s district=%s", req_id, req.state, req.district)
    user_id = current_user.id if current_user else None
    user_email = current_user.email if current_user else None
    try:
        payload = {"state": req.state, "district": req.district, "village": req.village, "start_date": req.sowing_date}
        result = await asyncio.wait_for(
            run_in_threadpool(predict_crop, payload),
            timeout=35.0,
        )
        duration_ms = round((time.time() - t0) * 1000, 2)
        crop_val = result.get("recommended_crop") or result.get("predicted_crop")
        try:
            save_res = save_crop_prediction({
                **result,
                "user_id": user_id,
                "user_email": user_email,
                "state": req.state,
                "district": req.district,
                "village": req.village,
                "season": req.sowing_date,
                "predicted_crop": crop_val,
                "confidence": result.get("confidence"),
                "request_summary": {"village": req.village, "sowing_date": req.sowing_date},
                "result_summary": {"predicted_crop": crop_val, "confidence": result.get("confidence")},
                "status": "success",
                "latency_ms": duration_ms,
            })
            if isinstance(save_res, dict) and not save_res.get("telemetry_saved"):
                logger.warning("[%s] Supabase crop telemetry save failed: %s", req_id, save_res.get("error"))
        except Exception as db_err:
            logger.warning("[%s] Supabase crop log non-blocking warning: %s", req_id, db_err)

        record_system_event("prediction_request", module="crop", status="success", user_id=user_id, request_id=req_id)
        logger.info("[%s] Crop prediction success in %sms", req_id, duration_ms)
        return {"success": True, "stage": "crop", "result": result}
    except ValueError as ve:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.warning("[%s] Crop input validation warning: %s", req_id, ve)
        log_ml_prediction_event({
            "model_type": "crop_recommendation",
            "state": req.state,
            "district": req.district,
            "request_summary": {"state": req.state, "district": req.district},
            "status": "failed",
            "error_code": "INVALID_INPUT",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        record_system_event("prediction_request", module="crop", status="failed", http_status=422, error_code="INVALID_INPUT", user_id=user_id, request_id=req_id)
        return make_error_response(422, "crop", "INVALID_INPUT", str(ve), retryable=False)
    except asyncio.TimeoutError:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.error("[%s] Crop prediction TIMEOUT (>35s)", req_id)
        log_ml_prediction_event({
            "model_type": "crop_recommendation",
            "state": req.state,
            "district": req.district,
            "request_summary": {"state": req.state, "district": req.district},
            "status": "failed",
            "error_code": "CROP_SERVICE_TIMEOUT",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        record_system_event("prediction_request", module="crop", status="failed", http_status=504, error_code="CROP_SERVICE_TIMEOUT", user_id=user_id, request_id=req_id)
        return make_error_response(504, "crop", "CROP_SERVICE_TIMEOUT", "Crop recommendation request timed out.", retryable=True)
    except Exception as err:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.exception("[%s] Crop prediction failed: %s", req_id, err)
        log_ml_prediction_event({
            "model_type": "crop_recommendation",
            "state": req.state,
            "district": req.district,
            "request_summary": {"state": req.state, "district": req.district},
            "status": "failed",
            "error_code": "MODEL_INFERENCE_FAILED",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        record_system_event("prediction_request", module="crop", status="failed", http_status=502, error_code="MODEL_INFERENCE_FAILED", user_id=user_id, request_id=req_id)
        return make_error_response(502, "crop", "MODEL_INFERENCE_FAILED", f"Crop recommendation failed: {str(err)}", retryable=True)


# 2. Climate Risk API
@app.post("/api/v1/predict/climate")
async def api_predict_climate(
    req: ClimateRiskRequest,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    req_id = str(uuid.uuid4())[:8]
    t0 = time.time()
    logger.info("[%s] POST /api/v1/predict/climate started - state=%s crop=%s", req_id, req.state, req.crop)
    user_id = current_user.id if current_user else None
    user_email = current_user.email if current_user else None
    try:
        payload = {
            "state": req.state,
            "district": req.district,
            "crop": req.crop,
            "start_date": req.sowing_date,
        }
        result = await asyncio.wait_for(
            run_in_threadpool(predict_climate_risk, payload),
            timeout=35.0,
        )
        result.pop("daily_data", None)
        result.pop("hourly_data", None)
        duration_ms = round((time.time() - t0) * 1000, 2)
        try:
            save_res = save_climate_prediction({
                **result,
                "user_id": user_id,
                "user_email": user_email,
                "state": req.state,
                "district": req.district,
                "crop": req.crop,
                "request_summary": {"sowing_date": req.sowing_date},
                "result_summary": {"predicted_climate_risk": result.get("predicted_climate_risk")},
                "status": "success",
                "latency_ms": duration_ms,
            })
            if isinstance(save_res, dict) and not save_res.get("telemetry_saved"):
                logger.warning("[%s] Supabase climate telemetry save failed: %s", req_id, save_res.get("error"))
        except Exception as db_err:
            logger.warning("[%s] Supabase climate log non-blocking warning: %s", req_id, db_err)

        logger.info("[%s] Climate risk prediction success in %sms", req_id, duration_ms)
        return {"success": True, "stage": "climate", "result": result}
    except ValueError as ve:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.warning("[%s] Climate risk input validation warning: %s", req_id, ve)
        log_ml_prediction_event({
            "model_type": "climate_risk",
            "crop": req.crop,
            "state": req.state,
            "district": req.district,
            "status": "failed",
            "error_code": "INVALID_INPUT",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        return make_error_response(422, "climate", "INVALID_INPUT", str(ve), retryable=False)
    except asyncio.TimeoutError:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.error("[%s] Climate risk prediction TIMEOUT (>35s)", req_id)
        log_ml_prediction_event({
            "model_type": "climate_risk",
            "crop": req.crop,
            "state": req.state,
            "district": req.district,
            "status": "failed",
            "error_code": "CLIMATE_SERVICE_TIMEOUT",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        return make_error_response(504, "climate", "CLIMATE_SERVICE_TIMEOUT", "Climate risk prediction request timed out.", retryable=True)
    except Exception as err:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.exception("[%s] Climate risk prediction failed: %s", req_id, err)
        log_ml_prediction_event({
            "model_type": "climate_risk",
            "crop": req.crop,
            "state": req.state,
            "district": req.district,
            "status": "failed",
            "error_code": "CLIMATE_RISK_FAILED",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        return make_error_response(502, "climate", "CLIMATE_RISK_FAILED", f"Climate risk prediction failed: {str(err)}", retryable=True)


# 3. Irrigation & Water Needs API
@app.post("/api/v1/predict/irrigation")
async def api_predict_irrigation(
    req: IrrigationRequest,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    req_id = str(uuid.uuid4())[:8]
    t0 = time.time()
    logger.info("[%s] POST /api/v1/predict/irrigation started - state=%s crop=%s area=%s", req_id, req.state, req.crop, req.area_ha)
    user_id = current_user.id if current_user else None
    user_email = current_user.email if current_user else None
    try:
        payload = {
            "state": req.state,
            "district": req.district,
            "crop": req.crop,
            "area": req.area_ha,
            "start_date": req.start_date,
            "pump_hp": req.pump_hp,
        }
        result = await asyncio.wait_for(
            run_in_threadpool(predict_irrigation, payload),
            timeout=35.0,
        )
        duration_ms = round((time.time() - t0) * 1000, 2)
        try:
            save_res = save_irrigation_prediction({
                **result,
                "user_id": user_id,
                "user_email": user_email,
                "state": req.state,
                "district": req.district,
                "crop": req.crop,
                "predicted_irrigation": result.get("predicted_irrigation") or result.get("water_requirement_mm"),
                "request_summary": {"area_ha": req.area_ha, "start_date": req.start_date, "pump_hp": req.pump_hp},
                "result_summary": {"predicted_irrigation": result.get("predicted_irrigation"), "water_requirement_mm": result.get("water_requirement_mm")},
                "status": "success",
                "latency_ms": duration_ms,
            })
            if isinstance(save_res, dict) and not save_res.get("telemetry_saved"):
                logger.warning("[%s] Supabase irrigation telemetry save failed: %s", req_id, save_res.get("error"))
        except Exception as db_err:
            logger.warning("[%s] Supabase irrigation log non-blocking warning: %s", req_id, db_err)
        logger.info("[%s] Irrigation calculation success in %sms", req_id, duration_ms)
        return {"success": True, "stage": "irrigation", "result": result}
    except ValueError as ve:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.warning("[%s] Irrigation input validation warning: %s", req_id, ve)
        log_ml_prediction_event({
            "model_type": "irrigation_scheduling",
            "crop": req.crop,
            "state": req.state,
            "district": req.district,
            "status": "failed",
            "error_code": "INVALID_INPUT",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        return make_error_response(422, "irrigation", "INVALID_INPUT", str(ve), retryable=False)
    except asyncio.TimeoutError:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.error("[%s] Irrigation calculation TIMEOUT (>35s)", req_id)
        log_ml_prediction_event({
            "model_type": "irrigation_scheduling",
            "crop": req.crop,
            "state": req.state,
            "district": req.district,
            "status": "failed",
            "error_code": "IRRIGATION_SERVICE_TIMEOUT",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        return make_error_response(504, "irrigation", "IRRIGATION_SERVICE_TIMEOUT", "Irrigation calculation timed out.", retryable=True)
    except Exception as err:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.exception("[%s] Irrigation calculation failed: %s", req_id, err)
        log_ml_prediction_event({
            "model_type": "irrigation_scheduling",
            "crop": req.crop,
            "state": req.state,
            "district": req.district,
            "status": "failed",
            "error_code": "IRRIGATION_CALCULATION_FAILED",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        return make_error_response(502, "irrigation", "IRRIGATION_CALCULATION_FAILED", f"Irrigation calculation failed: {str(err)}", retryable=True)


# 4. Harvest Yield API
@app.post("/api/v1/predict/yield")
async def api_predict_yield(
    req: YieldRequest,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    req_id = str(uuid.uuid4())[:8]
    t0 = time.time()
    logger.info("[%s] POST /api/v1/predict/yield started - crop=%s area=%s season=%s", req_id, req.crop, req.area_ha, req.season)
    user_id = current_user.id if current_user else None
    user_email = current_user.email if current_user else None
    try:
        payload = {
            "state": req.state,
            "district": req.district,
            "crop": req.crop,
            "season": req.season,
            "area": req.area_ha,
            "year": req.year,
        }
        result = await asyncio.wait_for(
            run_in_threadpool(predict_yield, payload),
            timeout=35.0,
        )
        duration_ms = round((time.time() - t0) * 1000, 2)
        try:
            save_res = save_yield_prediction({
                **result,
                "user_id": user_id,
                "user_email": user_email,
                "state": req.state,
                "district": req.district,
                "crop": req.crop,
                "season": req.season,
                "year": req.year,
                "area": req.area_ha,
                "predicted_yield": result.get("predicted_yield") or result.get("yield_t_per_ha"),
                "request_summary": {"season": req.season, "area_ha": req.area_ha, "year": req.year},
                "result_summary": {"predicted_yield": result.get("predicted_yield"), "total_production_tonnes": result.get("total_production_tonnes")},
                "status": "success",
                "latency_ms": duration_ms,
            })
            if isinstance(save_res, dict) and not save_res.get("telemetry_saved"):
                logger.warning("[%s] Supabase yield telemetry save failed: %s", req_id, save_res.get("error"))
        except Exception as db_err:
            logger.warning("[%s] Supabase yield log non-blocking warning: %s", req_id, db_err)
        logger.info("[%s] Yield estimation success in %sms", req_id, duration_ms)
        return {"success": True, "stage": "yield", "result": result}
    except ValueError as ve:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.warning("[%s] Yield input validation warning: %s", req_id, ve)
        log_ml_prediction_event({
            "model_type": "yield_prediction",
            "crop": req.crop,
            "state": req.state,
            "district": req.district,
            "status": "failed",
            "error_code": "INVALID_INPUT",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        return make_error_response(422, "yield", "INVALID_INPUT", str(ve), retryable=False)
    except asyncio.TimeoutError:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.error("[%s] Yield prediction TIMEOUT (>35s)", req_id)
        log_ml_prediction_event({
            "model_type": "yield_prediction",
            "crop": req.crop,
            "state": req.state,
            "district": req.district,
            "status": "failed",
            "error_code": "YIELD_SERVICE_TIMEOUT",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        return make_error_response(504, "yield", "YIELD_SERVICE_TIMEOUT", "Yield estimation timed out.", retryable=True)
    except Exception as err:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.exception("[%s] Yield prediction failed: %s", req_id, err)
        log_ml_prediction_event({
            "model_type": "yield_prediction",
            "crop": req.crop,
            "state": req.state,
            "district": req.district,
            "status": "failed",
            "error_code": "YIELD_PREDICTION_FAILED",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        return make_error_response(502, "yield", "YIELD_PREDICTION_FAILED", f"Yield estimation failed: {str(err)}", retryable=True)


# 5. Market Price API (Stage 5 Isolation, Caching & Non-blocking Threadpool)
@app.post("/api/v1/predict/market")
async def api_predict_market(
    req: MarketRequest,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    req_id = str(uuid.uuid4())[:8]
    t0 = time.time()
    logger.info("[%s] POST /api/v1/predict/market started - commodity=%s state=%s district=%s date=%s", req_id, req.commodity, req.state, req.district, req.market_date)
    user_id = current_user.id if current_user else None
    user_email = current_user.email if current_user else None

    cache_key = make_market_cache_key(
        state=req.state,
        district=req.district,
        commodity=req.commodity,
        market_date=req.market_date,
        area=req.area_ha,
        season=req.season,
        year=req.year,
    )

    # 1. Check in-memory cache first
    cached_result, is_stale = get_cached_market_price(cache_key)
    if cached_result and not is_stale:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.info("[%s] Market price cache HIT in %sms", req_id, duration_ms)
        return {"success": True, "stage": "market", "result": cached_result, "cached": True}

    # 2. Acquire lock and execute prediction non-blocking
    try:
        async with get_cache_lock():
            # Re-check cache after acquiring lock
            cached_result, is_stale = get_cached_market_price(cache_key)
            if cached_result and not is_stale:
                return {"success": True, "stage": "market", "result": cached_result, "cached": True}

            result = await asyncio.wait_for(
                run_in_threadpool(
                    predict_market_price,
                    state=req.state,
                    district=req.district,
                    commodity=req.commodity,
                    area=req.area_ha,
                    season=req.season,
                    start_date=req.start_date,
                    end_date=req.end_date,
                    year=req.year,
                    village=req.village,
                    market_date=req.market_date,
                ),
                timeout=28.0,
            )

            duration_ms = round((time.time() - t0) * 1000, 2)

            if not result or "predicted_price" not in result:
                if cached_result:
                    logger.warning("[%s] Fresh market lookup returned empty result, using stale cache fallback", req_id)
                    return {
                        "success": True,
                        "stage": "market",
                        "result": cached_result,
                        "stale": True,
                        "message": "Mandi price data served from cache (upstream market source temporarily unavailable)."
                    }
                log_ml_prediction_event({
                    "model_type": "market_price_forecasting",
                    "crop": req.commodity,
                    "state": req.state,
                    "district": req.district,
                    "status": "failed",
                    "error_code": "MARKET_DATA_UNAVAILABLE",
                    "latency_ms": duration_ms,
                    "user_id": user_id,
                })
                return make_error_response(
                    status_code=502,
                    stage="market",
                    error_code="MARKET_DATA_UNAVAILABLE",
                    message="Mandi price data is temporarily unavailable. Please retry shortly.",
                    retryable=True,
                )

            set_cached_market_price(cache_key, result)
            try:
                save_res = save_market_prediction({
                    **result,
                    "user_id": user_id,
                    "user_email": user_email,
                    "commodity": req.commodity,
                    "state": req.state,
                    "district": req.district,
                    "predicted_market_price": result.get("predicted_price") or result.get("predicted_market_price"),
                    "request_summary": {"area_ha": req.area_ha, "season": req.season, "market_date": req.market_date},
                    "result_summary": {"predicted_price": result.get("predicted_price"), "unit": result.get("unit")},
                    "status": "success",
                    "latency_ms": duration_ms,
                })
                if isinstance(save_res, dict) and not save_res.get("telemetry_saved"):
                    logger.warning("[%s] Supabase market telemetry save failed: %s", req_id, save_res.get("error"))
            except Exception as db_err:
                logger.warning("[%s] Supabase market log non-blocking warning: %s", req_id, db_err)

            logger.info("[%s] Market price prediction success in %sms", req_id, duration_ms)
            return {"success": True, "stage": "market", "result": result}

    except ValueError as ve:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.warning("[%s] Market request input validation warning: %s", req_id, ve)
        log_ml_prediction_event({
            "model_type": "market_price_forecasting",
            "crop": req.commodity,
            "state": req.state,
            "district": req.district,
            "status": "failed",
            "error_code": "INVALID_INPUT",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        return make_error_response(422, "market", "INVALID_INPUT", str(ve), retryable=False)
    except asyncio.TimeoutError:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.error("[%s] Market price prediction TIMEOUT (>20s)", req_id)
        log_ml_prediction_event({
            "model_type": "market_price_forecasting",
            "crop": req.commodity,
            "state": req.state,
            "district": req.district,
            "status": "failed",
            "error_code": "MARKET_DATA_UNAVAILABLE",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        if cached_result:
            logger.warning("[%s] Returning stale cached result after timeout", req_id)
            return {
                "success": True,
                "stage": "market",
                "result": cached_result,
                "stale": True,
                "message": "Mandi price data served from cache (upstream timeout)."
            }
        return make_error_response(
            status_code=504,
            stage="market",
            error_code="MARKET_DATA_UNAVAILABLE",
            message="Mandi price data is temporarily unavailable. Please retry shortly.",
            retryable=True,
        )
    except Exception as err:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.exception("[%s] Market price prediction failed: %s", req_id, err)
        log_ml_prediction_event({
            "model_type": "market_price_forecasting",
            "crop": req.commodity,
            "state": req.state,
            "district": req.district,
            "status": "failed",
            "error_code": "MARKET_DATA_UNAVAILABLE",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        if cached_result:
            logger.warning("[%s] Returning stale cached result after exception", req_id)
            return {
                "success": True,
                "stage": "market",
                "result": cached_result,
                "stale": True,
                "message": "Mandi price data served from cache (upstream error)."
            }
        return make_error_response(
            status_code=502,
            stage="market",
            error_code="MARKET_DATA_UNAVAILABLE",
            message="Mandi price data is temporarily unavailable. Please retry shortly.",
            retryable=True,
        )


# 6. Multi-Provider Disease & Pest Diagnosis API (Multipart File Upload)
@app.post("/api/v1/predict/disease")
async def api_predict_disease(
    crop: str = Form(...),
    image: UploadFile = File(...),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    req_id = str(uuid.uuid4())[:8]
    t0 = time.time()
    logger.info("[%s] POST /api/v1/predict/disease started - crop=%s filename=%s", req_id, crop, image.filename)
    user_id = current_user.id if current_user else None
    user_email = current_user.email if current_user else None
    try:
        raw = await image.read()
        content_type = (image.content_type or "image/jpeg").lower()
        result = await asyncio.wait_for(
            run_in_threadpool(
                predict_disease_and_pests,
                crop=crop, raw=raw, filename=image.filename or "image.jpg", content_type=content_type
            ),
            timeout=60.0,
        )
        duration_ms = round((time.time() - t0) * 1000, 2)

        primary_diag = result.get("primary_diagnosis")
        top_conf = result.get("top_confidence")

        sel_crop = result.get("selected_crop_result")
        sel_pest = result.get("selected_pest_result")
        sel_nutr = result.get("selected_nutrient_result")

        crop_det = (sel_crop or {}).get("detection", {}) if isinstance(sel_crop, dict) else {}
        pest_det = (sel_pest or {}).get("detection", {}) if isinstance(sel_pest, dict) else {}
        nutr_det = (sel_nutr or {}).get("detection", {}) if isinstance(sel_nutr, dict) else {}

        top_disease_label = crop_det.get("label")
        top_disease_conf = crop_det.get("confidence")

        top_pest_label = pest_det.get("label")
        top_pest_conf = pest_det.get("confidence")

        top_nutrient_label = nutr_det.get("label")
        top_nutrient_conf = nutr_det.get("confidence")

        all_detections = []
        if top_disease_label:
            all_detections.append({
                "label": top_disease_label,
                "confidence": top_disease_conf,
                "category": "disease",
                "source": (sel_crop or {}).get("provider") or "crop_model"
            })
        if top_pest_label:
            all_detections.append({
                "label": top_pest_label,
                "confidence": top_pest_conf,
                "category": "pest",
                "source": (sel_pest or {}).get("provider") or "pest_model"
            })
        if top_nutrient_label:
            all_detections.append({
                "label": top_nutrient_label,
                "confidence": top_nutrient_conf,
                "category": "nutrient",
                "source": (sel_nutr or {}).get("provider") or "nutrient_model"
            })

        for item in result.get("other_possible_detections", []):
            if isinstance(item, dict) and item.get("label"):
                if not any(d["label"] == item["label"] for d in all_detections):
                    all_detections.append({
                        "label": item.get("label"),
                        "confidence": item.get("confidence"),
                        "category": "secondary",
                        "source": item.get("provider") or item.get("model") or "secondary_model"
                    })

        try:
            save_res = save_disease_prediction({
                "user_id":                 user_id,
                "user_email":              user_email,
                "crop":                    crop,
                "primary_diagnosis":       primary_diag,
                "top_confidence":          top_conf,
                "top_disease":             top_disease_label,
                "top_disease_confidence":  top_disease_conf,
                "top_pest":                top_pest_label,
                "top_pest_confidence":     top_pest_conf,
                "top_nutrient":            top_nutrient_label,
                "top_nutrient_confidence": top_nutrient_conf,
                "annotated_image_url":     result.get("image_url") or result.get("annotated_image_url"),
                "all_detections":          all_detections,
                "custom_crop_notice":      result.get("notice") or result.get("custom_crop_notice"),
                "request_summary":         {"filename": image.filename, "content_type": content_type},
                "result_summary":         {"primary_diagnosis": primary_diag, "confidence": top_conf, "all_detections_count": len(all_detections)},
                "status":                 "success",
                "latency_ms":              duration_ms,
            })
            if isinstance(save_res, dict) and not save_res.get("telemetry_saved"):
                logger.warning("[%s] Supabase disease telemetry save failed: %s", req_id, save_res.get("error") or "telemetry_saved is False")
        except Exception as db_err:
            logger.warning("[%s] Supabase disease log non-blocking warning: %s", req_id, db_err)
        logger.info("[%s] Disease inference success in %sms", req_id, duration_ms)
        return {"success": True, "stage": "disease", "result": result}
    except ValueError as val_err:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.warning("[%s] Disease upload validation warning: %s", req_id, val_err)
        log_ml_prediction_event({
            "model_type": "disease_detection",
            "crop": crop,
            "request_summary": {"filename": getattr(image, "filename", None)},
            "status": "failed",
            "error_code": "INVALID_FILE_UPLOAD",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        return make_error_response(400, "disease", "INVALID_FILE_UPLOAD", str(val_err), retryable=False)
    except asyncio.TimeoutError:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.error("[%s] Disease inference TIMEOUT (>30s)", req_id)
        log_ml_prediction_event({
            "model_type": "disease_detection",
            "crop": crop,
            "request_summary": {"filename": getattr(image, "filename", None)},
            "status": "failed",
            "error_code": "DISEASE_SERVICE_TIMEOUT",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        return make_error_response(504, "disease", "DISEASE_SERVICE_TIMEOUT", "Disease diagnosis request timed out.", retryable=True)
    except Exception as err:
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.exception("[%s] Disease inference failed: %s", req_id, err)
        log_ml_prediction_event({
            "model_type": "disease_detection",
            "crop": crop,
            "request_summary": {"filename": getattr(image, "filename", None)},
            "status": "failed",
            "error_code": "DISEASE_INFERENCE_FAILED",
            "latency_ms": duration_ms,
            "user_id": user_id,
        })
        return make_error_response(502, "disease", "DISEASE_INFERENCE_FAILED", f"Disease inference failed: {str(err)}", retryable=True)



# 6b. Universal Agriculture & Scheme Agent Query API
@app.post("/api/v1/agent/query")
async def api_agent_query(req: AgentQueryRequest):
    """
    Universal Farmer Advisor & RAG Query Endpoint.
    Answers any question about agriculture, crop management, organic farming,
    or government schemes (PM-KISAN, PMFBY, KCC, Soil Health Card, SMAM, etc.).
    Indexes local PDFs in Data/agronomy_docs/ and verified govt web pages.
    """
    req_id = str(uuid.uuid4())[:8]
    t0 = time.time()
    logger.info("[%s] POST /api/v1/agent/query started - query='%s' crop=%s", req_id, req.query[:50], req.crop)
    try:
        res = await asyncio.wait_for(
            run_in_threadpool(query_agronomy_agent, req.query, crop=req.crop),
            timeout=45.0,
        )
        try:
            log_advisory_activity(
                query_text=req.query,
                crop=req.crop,
                state=req.state,
                district=req.district,
                rag_result=res,
                request_id=req_id,
            )
        except Exception as log_err:
            logger.warning("[%s] Advisory telemetry logging failed non-blockingly: %s", req_id, log_err)
        record_system_event("advisory_query", module="advisory", status="success", request_id=req_id)
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.info("[%s] Agent query finished in %sms", req_id, duration_ms)
        return {"success": True, "stage": "agent", "agent_response": res}
    except ValueError as ve:
        logger.warning("[%s] Agent query input validation warning: %s", req_id, ve)
        try:
            log_advisory_activity(
                query_text=req.query,
                crop=req.crop,
                state=req.state,
                district=req.district,
                activity_status="failed",
                error_category="INVALID_INPUT",
                request_id=req_id,
            )
        except Exception:
            pass
        record_system_event("advisory_query", module="advisory", status="failed", http_status=422, error_code="INVALID_INPUT", request_id=req_id)
        return make_error_response(422, "agent", "INVALID_INPUT", str(ve), retryable=False)
    except asyncio.TimeoutError:
        logger.error("[%s] Agent query TIMEOUT (>45s)", req_id)
        try:
            log_advisory_activity(
                query_text=req.query,
                crop=req.crop,
                state=req.state,
                district=req.district,
                activity_status="timeout",
                error_category="RAG_SERVICE_TIMEOUT",
                request_id=req_id,
            )
        except Exception:
            pass
        record_system_event("advisory_query", module="advisory", status="failed", http_status=504, error_code="RAG_SERVICE_TIMEOUT", request_id=req_id)
        return make_error_response(504, "agent", "RAG_SERVICE_TIMEOUT", "Agronomy AI agent request timed out.", retryable=True)
    except Exception as err:
        logger.exception("[%s] Agent query failed: %s", req_id, err)
        try:
            log_advisory_activity(
                query_text=req.query,
                crop=req.crop,
                state=req.state,
                district=req.district,
                activity_status="failed",
                error_category="RAG_SERVICE_FAILED",
                request_id=req_id,
            )
        except Exception:
            pass
        record_system_event("advisory_query", module="advisory", status="failed", http_status=504, error_code="RAG_SERVICE_FAILED", request_id=req_id)
        return make_error_response(504, "agent", "RAG_SERVICE_FAILED", f"Agronomy AI agent service failed: {str(err)}", retryable=True)


# 6c. Farmer Advisory Feedback Submission API
@app.post("/api/v1/feedback")
def api_submit_feedback(
    req: CreateFeedbackRequest,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    """
    Farmer Feedback Submission Endpoint.
    Stores farmer feedback securely without exposing sensitive personal data.
    """
    try:
        user_id = current_user.id if current_user else None
        record = create_farmer_feedback(
            rating=req.rating,
            category=req.category,
            message=req.message,
            advisory_id=req.advisory_id,
            language=req.language,
            user_id=user_id,
        )
        return {
            "success": True,
            "stage": "feedback",
            "message": "Feedback submitted successfully",
            "feedback_id": record["id"],
        }
    except Exception as err:
        return make_error_response(500, "feedback", "FEEDBACK_SUBMISSION_FAILED", str(err), retryable=True)


@app.get("/api/v1/rag/documents")
def api_get_rag_documents():
    """
    Returns list of all verified government documents and local PDF/DOCX files
    currently indexed in Data/agronomy_docs/.
    """
    try:
        local_docs = load_local_agronomy_documents()
        return {
            "success": True,
            "stage": "rag_documents",
            "local_documents_count": len(local_docs),
            "local_documents": [
                {
                    "filename": d["source"],
                    "path": d["path"],
                    "file_type": d["file_type"],
                    "pages": d["pages_count"],
                    "char_count": len(d["text"]),
                }
                for d in local_docs
            ],
            "verified_links": AGRONOMY_DOCUMENT_LINKS,
        }
    except Exception as err:
        return make_error_response(500, "rag_documents", "DOCUMENTS_LISTING_FAILED", str(err), retryable=True)


# 7. Government Schemes Matcher API (Stage 6 Non-Blocking Threadpool & Isolation)
@app.post("/api/v1/schemes/recommend")
async def api_recommend_schemes(req: SchemesRequest):
    req_id = str(uuid.uuid4())[:8]
    t0 = time.time()
    logger.info("[%s] POST /api/v1/schemes/recommend started - state=%s crop=%s", req_id, req.state, req.crop)
    try:
        recommendations = await asyncio.wait_for(
            run_in_threadpool(recommend_schemes, req.dict()),
            timeout=15.0,
        )
        duration_ms = round((time.time() - t0) * 1000, 2)
        logger.info("[%s] Schemes recommendation finished in %sms - matches=%d", req_id, duration_ms, len(recommendations))
        if not recommendations:
            return {
                "success": True,
                "stage": "schemes",
                "matches": [],
                "schemes": [],
                "message": "No matching government subsidy was found for the supplied inputs.",
                "retryable": False
            }
        return {
            "success": True,
            "stage": "schemes",
            "count": len(recommendations),
            "matches": recommendations,
            "schemes": recommendations,
            "message": "Government subsidy schemes matched successfully."
        }
    except ValueError as ve:
        logger.warning("[%s] Schemes request input validation warning: %s", req_id, ve)
        return make_error_response(422, "schemes", "INVALID_INPUT", str(ve), retryable=False)
    except asyncio.TimeoutError:
        logger.error("[%s] Schemes recommendation TIMEOUT (>15s)", req_id)
        return make_error_response(504, "schemes", "SCHEMES_SERVICE_TIMEOUT", "Government schemes recommendation timed out.", retryable=True)
    except Exception as err:
        logger.exception("[%s] Schemes recommendation failed: %s", req_id, err)
        return make_error_response(502, "schemes", "SCHEMES_SERVICE_FAILED", f"Government schemes recommendation failed: {str(err)}", retryable=True)


# 8. 1-Click Connected Farm Pipeline API (Stage-by-Stage Isolated Pipeline Execution)
@app.post("/api/v1/pipeline/run")
def api_run_pipeline(req: PipelineRequest):
    req_id = str(uuid.uuid4())[:8]
    t0 = time.time()
    logger.info("[%s] POST /api/v1/pipeline/run started - state=%s district=%s", req_id, req.state, req.district)
    pipeline_res = {}

    # Step A: Crop Selection
    try:
        crop_payload = {"state": req.state, "district": req.district, "village": req.village, "start_date": req.sowing_date}
        crop_res = predict_crop(crop_payload)
        pipeline_res["crop"] = {"success": True, "result": crop_res}
        selected_crop = req.target_crop or crop_res.get("predicted_crop", "Rice")
    except Exception as e:
        logger.warning("[%s] Pipeline Crop step isolated error: %s", req_id, e)
        pipeline_res["crop"] = {"success": False, "error": str(e)}
        selected_crop = req.target_crop or "Rice"

    # Step B: Climate Risk
    try:
        climate_res = predict_climate_risk({"state": req.state, "district": req.district, "crop": selected_crop, "start_date": req.sowing_date})
        climate_res.pop("daily_data", None)
        climate_res.pop("hourly_data", None)
        pipeline_res["climate"] = {"success": True, "result": climate_res}
        risk_lvl = climate_res.get("risk_category", "Low")
    except Exception as e:
        logger.warning("[%s] Pipeline Climate step isolated error: %s", req_id, e)
        pipeline_res["climate"] = {"success": False, "error": str(e)}
        risk_lvl = "Low"

    # Step C: Irrigation
    try:
        irrigation_res = predict_irrigation({
            "state": req.state,
            "district": req.district,
            "crop": selected_crop,
            "area": req.area_ha,
            "start_date": req.sowing_date,
            "pump_hp": req.pump_hp,
        })
        pipeline_res["irrigation"] = {"success": True, "result": irrigation_res}
    except Exception as e:
        logger.warning("[%s] Pipeline Irrigation step isolated error: %s", req_id, e)
        pipeline_res["irrigation"] = {"success": False, "error": str(e)}

    # Step D: Yield
    try:
        yield_res = predict_yield({
            "state": req.state,
            "district": req.district,
            "crop": selected_crop,
            "season": "Kharif",
            "area": req.area_ha,
            "year": 2026,
        })
        pipeline_res["yield"] = {"success": True, "result": yield_res}
    except Exception as e:
        logger.warning("[%s] Pipeline Yield step isolated error: %s", req_id, e)
        pipeline_res["yield"] = {"success": False, "error": str(e)}

    # Step E: Market Price (Stage 5 Isolation)
    try:
        market_res = predict_market_price(
            state=req.state,
            district=req.district,
            commodity=selected_crop,
            area=req.area_ha,
            season="Kharif",
            start_date=req.sowing_date,
            end_date="2026-10-15",
            year=2026,
            market_date="2026-10-20",
        )
        if market_res and "predicted_price" in market_res:
            pipeline_res["market"] = {"success": True, "stage": "market", "result": market_res}
        else:
            pipeline_res["market"] = {
                "success": False,
                "stage": "market",
                "error_code": "PRICE_DATA_UNAVAILABLE",
                "message": "Mandi price data is temporarily unavailable for the selected commodity.",
                "retryable": True
            }
    except Exception as e:
        logger.warning("[%s] Pipeline Market step isolated error: %s", req_id, e)
        pipeline_res["market"] = {
            "success": False,
            "stage": "market",
            "error_code": "PRICE_DATA_UNAVAILABLE",
            "message": "Mandi price data is temporarily unavailable for the selected commodity.",
            "retryable": True
        }

    # Step F: Govt Schemes (Stage 6 Isolation)
    try:
        schemes_res = recommend_schemes({
            "state": req.state,
            "district": req.district,
            "crop": selected_crop,
            "area_ha": req.area_ha,
            "solar_interest": req.solar_interest,
            "irrigation_type": "Drip",
            "climate_risk_level": risk_lvl,
        })
        pipeline_res["schemes"] = {
            "success": True,
            "stage": "schemes",
            "count": len(schemes_res),
            "matches": schemes_res,
            "schemes": schemes_res,
            "message": "Government subsidy schemes matched successfully." if schemes_res else "No matching government subsidy was found for the supplied location and crop."
        }
    except Exception as e:
        logger.warning("[%s] Pipeline Schemes step isolated error: %s", req_id, e)
        pipeline_res["schemes"] = {
            "success": True,
            "stage": "schemes",
            "count": 0,
            "matches": [],
            "message": "No matching government subsidy was found for the supplied location and crop."
        }

    duration_ms = round((time.time() - t0) * 1000, 2)
    logger.info("[%s] Connected Farm Pipeline finished in %sms", req_id, duration_ms)
    return {
        "success": True,
        "stage": "pipeline",
        "duration_ms": duration_ms,
        "result": pipeline_res
    }


# 9. Farmer History Persistence APIs
@app.post("/api/v1/farm/save-record")
def api_save_record(
    req: SaveRecordRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    if not supabase:
        return {"status": "warning", "message": "Supabase database connection is not configured", "record_id": None}
    try:
        user_email = current_user.email or current_user.id
        record = {
            "id": str(uuid.uuid4()),
            "user_email": user_email,
            "record_type": req.record_type,
            "data": req.record_data,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table("user_farm_records").insert(record).execute()
        return {"status": "success", "message": "Record saved", "record_id": record["id"]}
    except Exception as e:
        return {"status": "warning", "message": f"Farm record table unavailable: {str(e)}", "record_id": None}


@app.get("/api/v1/farm/records")
def api_get_records(
    current_user: CurrentUser = Depends(get_current_user),
):
    if not supabase:
        return {"status": "warning", "message": "Supabase connection not active", "records": []}
    try:
        user_email = current_user.email or current_user.id
        res = supabase.table("user_farm_records").select("*").eq("user_email", user_email).execute()
        return {"status": "success", "records": res.data or []}
    except Exception:
        return {"status": "warning", "message": "Records table unavailable", "records": []}


@app.get("/api/v1/farm/monthly-summary")
def api_monthly_summary(
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Returns a month-by-month activity summary for a logged-in farmer.
    Includes:
      - 'done': predictions recorded this month (crop, irrigation, disease, etc.)
      - 'todo': advisory tasks derived from their latest crop/irrigation data
    """
    if not supabase:
        return {"status": "warning", "message": "Supabase not connected", "months": {}}

    user_email = current_user.email or current_user.id

    try:
        from calendar import month_name as MONTH_NAMES

        # --- Fetch all prediction records for this user ---
        prediction_tables = {
            "crop":      "crop_prediction",
            "climate":   "climate_prediction",
            "irrigation":"irrigation_prediction",
            "yield":     "yield_prediction",
            "market":    "market_prediction",
            "disease":   "disease_prediction",
        }

        monthly: Dict[str, Dict] = {}

        for pred_type, table in prediction_tables.items():
            try:
                rows = (
                    supabase.table(table)
                    .select("*")
                    .eq("user_email", user_email)
                    .order("created_at", desc=True)
                    .limit(200)
                    .execute()
                ).data or []
            except Exception:
                rows = []

            for row in rows:
                raw_ts = row.get("created_at") or row.get("prediction_time") or ""
                try:
                    dt = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
                    month_key = dt.strftime("%Y-%m")          # e.g. "2026-09"
                    month_label = dt.strftime("%B %Y")        # e.g. "September 2026"
                except Exception:
                    month_key = "unknown"
                    month_label = "Unknown"

                if month_key not in monthly:
                    monthly[month_key] = {
                        "month_label": month_label,
                        "done": [],
                        "todo": [],
                    }

                # Build a human-readable activity entry
                if pred_type == "crop":
                    entry = {
                        "type": "Crop Recommendation",
                        "icon": "🌾",
                        "summary": f"Got crop recommendation: {row.get('predicted_crop','—')} "
                                   f"(confidence {row.get('confidence', 0):.0%})",
                        "date": raw_ts[:10],
                    }
                elif pred_type == "irrigation":
                    entry = {
                        "type": "Irrigation",
                        "icon": "💧",
                        "summary": f"Irrigation scheduled for {row.get('crop','—')} — "
                                   f"{row.get('predicted_irrigation', row.get('irrigation_mm','?'))} mm",
                        "date": raw_ts[:10],
                    }
                elif pred_type == "climate":
                    entry = {
                        "type": "Climate Risk Check",
                        "icon": "🌤️",
                        "summary": f"Climate risk assessed for {row.get('crop','—')}: "
                                   f"{row.get('predicted_climate_risk', row.get('risk_category','?'))}",
                        "date": raw_ts[:10],
                    }
                elif pred_type == "yield":
                    entry = {
                        "type": "Yield Forecast",
                        "icon": "📊",
                        "summary": f"Yield forecast for {row.get('crop','—')}: "
                                   f"{row.get('predicted_yield','?')} tonnes",
                        "date": raw_ts[:10],
                    }
                elif pred_type == "market":
                    entry = {
                        "type": "Market Price",
                        "icon": "💰",
                        "summary": f"Market price forecast for {row.get('commodity','—')}: "
                                   f"₹{row.get('predicted_market_price','?')}/quintal",
                        "date": raw_ts[:10],
                    }
                elif pred_type == "disease":
                    detected = row.get("top_disease") or row.get("top_pest") or "None detected"
                    entry = {
                        "type": "Disease/Pest Detection",
                        "icon": "🩺",
                        "summary": f"Crop: {row.get('crop','—')} — Detected: {detected} "
                                   f"({(row.get('top_disease_confidence') or row.get('top_pest_confidence') or 0)*100:.0f}% conf)",
                        "date": raw_ts[:10],
                    }
                else:
                    entry = {"type": pred_type, "icon": "📝", "summary": str(row), "date": raw_ts[:10]}

                monthly[month_key]["done"].append(entry)

        # --- Generate TODO advisory for the current month ---
        current_month_key = datetime.now(timezone.utc).strftime("%Y-%m")
        current_label = datetime.now(timezone.utc).strftime("%B %Y")

        if current_month_key not in monthly:
            monthly[current_month_key] = {"month_label": current_label, "done": [], "todo": []}

        # Look at latest irrigation record to build advisory
        try:
            irr_rows = (
                supabase.table("irrigation_prediction")
                .select("*")
                .eq("user_email", user_email)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            ).data or []
        except Exception:
            irr_rows = []

        if irr_rows:
            latest_irr = irr_rows[0]
            crop = latest_irr.get("crop", "your crop")
            irr_mm = latest_irr.get("predicted_irrigation", latest_irr.get("irrigation_mm", "N/A"))
            growth_stage = latest_irr.get("growth_stage", "current stage")
            monthly[current_month_key]["todo"] = [
                {"icon": "💧", "task": f"Irrigate {crop} ({irr_mm} mm required based on last estimate)"},
                {"icon": "🔍", "task": f"Scout for pests and diseases — {crop} at {growth_stage}"},
                {"icon": "🌡️", "task": "Check daily weather alerts for extreme temperature or rainfall"},
                {"icon": "📸", "task": "Upload a new field photo for disease detection if leaves look unusual"},
                {"icon": "📋", "task": "Review market prices before harvest planning"},
            ]
        else:
            monthly[current_month_key]["todo"] = [
                {"icon": "🌾", "task": "Run a Crop Recommendation to get personalised planting advice"},
                {"icon": "💧", "task": "Run an Irrigation & Pump Schedule for your crop"},
                {"icon": "🩺", "task": "Upload a leaf photo to check for diseases or pests"},
                {"icon": "📊", "task": "Forecast your harvest yield for the season"},
                {"icon": "💰", "task": "Check market price forecast before selling"},
            ]

        # Sort months newest first
        sorted_months = dict(sorted(monthly.items(), reverse=True))
        return {"status": "success", "months": sorted_months}

    except Exception:
        raise HTTPException(500, "Monthly summary failed. Please try again.")


# ── RAG Knowledge Sources Endpoints (Public / Frontend Access) ────────────────
@app.get("/api/v1/rag/sources")
def get_public_knowledge_sources(
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    crop: Optional[str] = None,
    state: Optional[str] = None,
):
    """Public endpoint for listing active canonical agricultural knowledge sources."""
    return fetch_knowledge_sources_list(
        page=page,
        page_size=page_size,
        search=search,
        crop=crop,
        state=state,
        verification_status="verified",
    )


class RegisterWebsiteRequest(BaseModel):
    official_url: str
    title: str
    organization: Optional[str] = "Official Agricultural Source"
    crop: Optional[str] = "All Crops"
    state_relevance: Optional[List[str]] = None


@app.post("/api/v1/rag/sources/register-website", status_code=201)
def register_website_knowledge_source(payload: RegisterWebsiteRequest):
    """
    Register a website URL into the AgriFusion RAG Knowledge Sources registry.
    Scrapes the site, indexes the content, and forces local document cache refresh.
    """
    url = payload.official_url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(422, "Official website URL must start with http:// or https://")

    success, result = register_knowledge_source(
        title=payload.title,
        organization=payload.organization or "Web Resource",
        source_type="website_url",
        official_url=url,
        subject="Agricultural Web Advisory",
        crop=payload.crop,
        state_relevance=payload.state_relevance or ["All India"],
        language="English",
        verification_notes="Registered via frontend user registration endpoint.",
        initial_verification_status="verified",
        initial_index_status="indexed",
    )

    if not success:
        if "Duplicate" in str(result):
            raise HTTPException(409, str(result))
        raise HTTPException(422, str(result))

    load_local_agronomy_documents(force_reload=True)

    return {
        "status": "success",
        "message": f"Website '{url}' successfully registered and indexed into RAG Knowledge Sources.",
        "source": result,
    }


@app.post("/api/v1/rag/sources/upload-document", status_code=201)
async def upload_document_knowledge_source(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    organization: Optional[str] = Form("Agricultural Knowledge Source"),
    crop: Optional[str] = Form("All Crops"),
    state_relevance: Optional[str] = Form("All India"),
):
    """
    Upload a document (PDF, DOCX, TXT, MD) into RAG Knowledge Base.
    Saves to Data/agronomy_docs/ and forces dynamic document cache refresh.
    """
    if not file.filename:
        raise HTTPException(400, "Filename missing in upload request.")

    ext = Path(file.filename).suffix.lower()
    if ext not in {".pdf", ".docx", ".txt", ".md"}:
        raise HTTPException(400, f"Unsupported document format '{ext}'. Allowed formats: PDF, DOCX, TXT, MD.")

    contents = await file.read()
    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(400, "File size exceeds maximum allowed 15MB.")

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
        organization=organization or "User Upload",
        source_type="custom_upload",
        official_url=f"file://{save_path}",
        subject="User Uploaded Agronomy Document",
        crop=crop,
        state_relevance=states,
        language="English",
        verification_notes="Uploaded via frontend document upload endpoint.",
        initial_verification_status="verified",
        initial_index_status="indexed",
    )

    load_local_agronomy_documents(force_reload=True)

    return {
        "status": "success",
        "message": f"Document '{safe_filename}' successfully uploaded and indexed into RAG Knowledge Sources.",
        "source": result,
    }


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    # reload=False in production; set UVICORN_RELOAD=1 locally for development
    reload_flag = os.getenv("UVICORN_RELOAD", "0") == "1"
    uvicorn.run("App.backend.server:app", host="0.0.0.0", port=port, reload=reload_flag)


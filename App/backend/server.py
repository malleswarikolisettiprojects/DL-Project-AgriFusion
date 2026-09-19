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

import os
import sys
import uuid
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

# Suppress sklearn pickle version warnings for clean console output
warnings.filterwarnings("ignore")

# Ensure project root is in sys.path when running script directly
BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import uvicorn
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from App.backend.climate_risk import predict_climate_risk
from App.backend.crop import predict_crop
from App.backend.database.database import supabase
from App.backend.database.save_predictions import (
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

app = FastAPI(
    title="AgriFusion Unified Backend REST API",
    description="AI Precision Decision Support System for Agriculture — Andhra Pradesh & Telangana",
    version="2.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
frontend_url = os.getenv("FRONTEND_URL", "")

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if frontend_url:
    allowed_origins.append(frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-User-Email"],
)


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
    user_email: str = Field(..., example="farmer@agrifusion.com")
    record_type: str = Field(..., example="pipeline_prediction")
    record_data: Dict[str, Any] = Field(...)


class AgentQueryRequest(BaseModel):
    query: str = Field(..., example="What is PM-KISAN scheme and how to apply?")
    crop: Optional[str] = Field(None, example="Rice")


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
    Safe health check — returns boolean status flags only.
    Never returns credentials, URLs, or connection strings.
    """
    cfg = get_config_status()
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "rag_documents_available": True,
        "database_configured": cfg["supabase_configured"],
        "external_models_configured": cfg["roboflow_configured"] or cfg["hf_token_configured"],
    }


# 1. Crop Recommendation API
@app.post("/api/v1/predict/crop")
def api_predict_crop(req: CropRequest, x_user_email: Optional[str] = Header(None)):
    try:
        payload = {"state": req.state, "district": req.district, "village": req.village, "start_date": req.sowing_date}
        result = predict_crop(payload)
        # Persist prediction (not recommendations)
        save_crop_prediction({**result, "user_email": x_user_email})
        return {"status": "success", "result": result}
    except Exception:
        raise HTTPException(500, "Crop prediction failed. Please try again.")


# 2. Climate Risk API
@app.post("/api/v1/predict/climate")
def api_predict_climate(req: ClimateRiskRequest, x_user_email: Optional[str] = Header(None)):
    try:
        payload = {"state": req.state, "district": req.district, "crop": req.crop, "start_date": req.sowing_date}
        result = predict_climate_risk(payload)
        save_climate_prediction({**result, "user_email": x_user_email})
        return {"status": "success", "result": result}
    except Exception:
        raise HTTPException(500, "Climate risk prediction failed. Please try again.")


# 3. Irrigation & Water Needs API
@app.post("/api/v1/predict/irrigation")
def api_predict_irrigation(req: IrrigationRequest, x_user_email: Optional[str] = Header(None)):
    try:
        payload = {
            "state": req.state,
            "district": req.district,
            "crop": req.crop,
            "area": req.area_ha,
            "start_date": req.start_date,
            "pump_hp": req.pump_hp,
        }
        result = predict_irrigation(payload)
        save_irrigation_prediction({**result, "user_email": x_user_email})
        return {"status": "success", "result": result}
    except Exception:
        raise HTTPException(500, "Irrigation prediction failed. Please try again.")


# 4. Harvest Yield API
@app.post("/api/v1/predict/yield")
def api_predict_yield(req: YieldRequest, x_user_email: Optional[str] = Header(None)):
    try:
        payload = {
            "state": req.state,
            "district": req.district,
            "crop": req.crop,
            "season": req.season,
            "area": req.area_ha,
            "year": req.year,
        }
        result = predict_yield(payload)
        save_yield_prediction({**result, "user_email": x_user_email})
        return {"status": "success", "result": result}
    except Exception:
        raise HTTPException(500, "Yield prediction failed. Please try again.")


# 5. Market Price API
@app.post("/api/v1/predict/market")
def api_predict_market(req: MarketRequest, x_user_email: Optional[str] = Header(None)):
    try:
        result = predict_market_price(
            state=req.state,
            district=req.district,
            commodity=req.commodity,
            area=req.area_ha,
            season=req.season,
            start_date=req.start_date,
            end_date=req.end_date,
            year=req.year,
            market_date=req.market_date,
        )
        save_market_prediction({**result, "user_email": x_user_email})
        return {"status": "success", "result": result}
    except Exception:
        raise HTTPException(500, "Market price prediction failed. Please try again.")


# 6. Multi-Provider Disease & Pest Diagnosis API (Multipart File Upload)
@app.post("/api/v1/predict/disease")
async def api_predict_disease(
    crop: str = Form(...),
    image: UploadFile = File(...),
    x_user_email: Optional[str] = Header(None),
):
    try:
        raw = await image.read()
        content_type = (image.content_type or "image/jpeg").lower()
        result = predict_disease_and_pests(
            crop=crop, raw=raw, filename=image.filename or "image.jpg", content_type=content_type
        )
        # Extract key prediction fields — do NOT save remedies or schemes
        top_detections = result.get("top_detections", [])
        secondary = result.get("secondary_detections", [])
        top_disease = next((d for d in top_detections if "disease" in d.get("source", "").lower()), {})
        top_pest = next((d for d in top_detections if "pest" in d.get("source", "").lower()), {})
        top_nutrient = next((d for d in top_detections if "nutrient" in d.get("source", "").lower()), {})
        all_detections = [
            {"label": d.get("label"), "confidence": d.get("confidence"), "source": d.get("source")}
            for d in (top_detections + secondary)
        ]
        save_disease_prediction({
            "user_email":              x_user_email,
            "crop":                    crop,
            "top_disease":             top_disease.get("label"),
            "top_disease_confidence":  top_disease.get("confidence"),
            "top_pest":                top_pest.get("label"),
            "top_pest_confidence":     top_pest.get("confidence"),
            "top_nutrient":            top_nutrient.get("label"),
            "top_nutrient_confidence": top_nutrient.get("confidence"),
            "annotated_image_url":     result.get("annotated_image_url"),
            "all_detections":          all_detections,
            "custom_crop_notice":      result.get("custom_crop_notice"),
        })
        return {"status": "success", "result": result}
    except ValueError as val_err:
        raise HTTPException(400, str(val_err))
    except Exception:
        raise HTTPException(500, "Disease inference failed. Please try again.")


# 6b. Universal Agriculture & Scheme Agent Query API
@app.post("/api/v1/agent/query")
def api_agent_query(req: AgentQueryRequest):
    """
    Universal Farmer Advisor & RAG Query Endpoint.
    Answers any question about agriculture, crop management, organic farming,
    or government schemes (PM-KISAN, PMFBY, KCC, Soil Health Card, SMAM, etc.).
    Indexes local PDFs in Data/agronomy_docs/ and verified govt web pages.
    """
    try:
        res = query_agronomy_agent(req.query, crop=req.crop)
        return {"status": "success", "agent_response": res}
    except Exception:
        raise HTTPException(500, "Agent query failed. Please try again.")


@app.get("/api/v1/rag/documents")
def api_get_rag_documents():
    """
    Returns list of all verified government documents and local PDF/DOCX files
    currently indexed in Data/agronomy_docs/.
    """
    try:
        local_docs = load_local_agronomy_documents()
        return {
            "status": "success",
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
    except Exception:
        raise HTTPException(500, "RAG documents listing failed. Please try again.")


# 7. Government Schemes Matcher API
@app.post("/api/v1/schemes/recommend")
def api_recommend_schemes(req: SchemesRequest):
    try:
        recommendations = recommend_schemes(req.dict())
        return {"status": "success", "count": len(recommendations), "schemes": recommendations}
    except Exception:
        raise HTTPException(500, "Schemes recommendation failed. Please try again.")


# 8. 1-Click Connected Farm Pipeline API
@app.post("/api/v1/pipeline/run")
def api_run_pipeline(req: PipelineRequest):
    try:
        # Step A: Crop Selection
        crop_payload = {"state": req.state, "district": req.district, "village": req.village, "start_date": req.sowing_date}
        crop_res = predict_crop(crop_payload)
        selected_crop = req.target_crop or crop_res.get("predicted_crop", "Rice")

        # Step B: Climate Risk
        climate_res = predict_climate_risk({"state": req.state, "district": req.district, "crop": selected_crop, "start_date": req.sowing_date})

        # Step C: Irrigation & Pump Hours
        irrigation_res = predict_irrigation({
            "state": req.state,
            "district": req.district,
            "crop": selected_crop,
            "area": req.area_ha,
            "start_date": req.sowing_date,
            "pump_hp": req.pump_hp,
        })

        # Step D: Harvest Yield
        yield_res = predict_yield({
            "state": req.state,
            "district": req.district,
            "crop": selected_crop,
            "season": "Kharif",
            "area": req.area_ha,
            "year": 2026,
        })

        # Step E: Market Price
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

        # Step F: Govt Schemes
        risk_lvl = climate_res.get("risk_category", "Low")
        schemes_res = recommend_schemes({
            "state": req.state,
            "district": req.district,
            "crop": selected_crop,
            "area_ha": req.area_ha,
            "solar_interest": req.solar_interest,
            "irrigation_type": "Drip",
            "climate_risk_level": risk_lvl,
        })

        output = {
            "crop_recommendation": crop_res,
            "selected_crop": selected_crop,
            "climate_risk": climate_res,
            "irrigation_schedule": irrigation_res,
            "harvest_yield": yield_res,
            "market_price": market_res,
            "eligible_schemes": schemes_res,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        return {"status": "success", "pipeline_result": output}

    except Exception:
        raise HTTPException(500, "Pipeline execution failed. Please try again.")


# 9. Farmer History Persistence APIs
@app.post("/api/v1/farm/save-record")
def api_save_record(req: SaveRecordRequest):
    if not supabase:
        return {"status": "warning", "message": "Supabase database connection is not configured", "record_id": None}
    try:
        record = {
            "id": str(uuid.uuid4()),
            "user_email": req.user_email,
            "record_type": req.record_type,
            "data": req.record_data,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table("user_farm_records").insert(record).execute()
        return {"status": "success", "message": "Record saved", "record_id": record["id"]}
    except Exception as e:
        return {"status": "warning", "message": f"Farm record table unavailable: {str(e)}", "record_id": None}


@app.get("/api/v1/farm/records")
def api_get_records(user_email: str):
    if not supabase:
        return {"status": "warning", "message": "Supabase connection not active", "records": []}
    try:
        res = supabase.table("user_farm_records").select("*").eq("user_email", user_email).execute()
        return {"status": "success", "records": res.data or []}
    except Exception:
        return {"status": "warning", "message": "Records table unavailable", "records": []}


@app.get("/api/v1/farm/monthly-summary")
def api_monthly_summary(user_email: str):
    """
    Returns a month-by-month activity summary for a logged-in farmer.
    Includes:
      - 'done': predictions recorded this month (crop, irrigation, disease, etc.)
      - 'todo': advisory tasks derived from their latest crop/irrigation data
    """
    if not supabase:
        return {"status": "warning", "message": "Supabase not connected", "months": {}}

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


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    # reload=False in production; set UVICORN_RELOAD=1 locally for development
    reload_flag = os.getenv("UVICORN_RELOAD", "0") == "1"
    uvicorn.run("App.backend.server:app", host="0.0.0.0", port=port, reload=reload_flag)


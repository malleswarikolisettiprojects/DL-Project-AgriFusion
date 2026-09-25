from datetime import datetime, timezone
from App.backend.database.database import supabase


def _save_to_prediction_records(user_id, prediction_type, request_payload, result_payload):
    if supabase is None:
        return
    try:
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("prediction_records").insert({
            "user_id": user_id,
            "prediction_type": prediction_type,
            "request_payload": request_payload or {},
            "result_payload": result_payload or {},
            "status": "completed",
            "created_at": now,
            "completed_at": now,
        }).execute()
    except Exception as e:
        print(f"Warning: Could not save to prediction_records: {e}")


# ============================================================
# 1. SAVE CROP PREDICTION
# ============================================================

def save_crop_prediction(data):
    try:
        _save_to_prediction_records(
            user_id=data.get("user_id"),
            prediction_type="crop_recommendation",
            request_payload={"state": data.get("state"), "district": data.get("district"), "season": data.get("season")},
            result_payload={"predicted_crop": data.get("predicted_crop"), "confidence": data.get("confidence")},
        )
        response = (
            supabase
            .table("crop_prediction")
            .insert({
                "state": data.get("state"),
                "district": data.get("district"),
                "season": data.get("season"),
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "temperature": data.get("temperature"),
                "humidity": data.get("humidity"),
                "rainfall": data.get("rainfall"),
                "wind_speed": data.get("wind_speed"),
                "soil_ph": data.get("soil_ph"),
                "nitrogen": data.get("nitrogen"),
                "organic_carbon": data.get("organic_carbon"),
                "clay": data.get("clay"),
                "sand": data.get("sand"),
                "silt": data.get("silt"),
                "cec": data.get("cec"),
                "predicted_crop": data.get("predicted_crop"),
                "confidence": data.get("confidence"),
            })
            .execute()
        )
        return response
    except Exception as e:
        print(f"Warning: Could not save crop prediction to Supabase: {e}")
        return None


# ============================================================
# 2. SAVE IRRIGATION PREDICTION
# ============================================================

def save_irrigation_prediction(data):
    try:
        _save_to_prediction_records(
            user_id=data.get("user_id"),
            prediction_type="irrigation_schedule",
            request_payload={"crop": data.get("crop"), "state": data.get("state"), "soil_type": data.get("soil_type")},
            result_payload={"predicted_irrigation": data.get("predicted_irrigation")},
        )
        response = (
            supabase
            .table("irrigation_prediction")
            .insert({
                "state": data.get("state"),
                "city": data.get("city"),
                "crop": data.get("crop"),
                "growth_stage": data.get("growth_stage"),
                "temperature": data.get("temperature"),
                "relative_humidity": data.get("relative_humidity"),
                "rainfall": data.get("rainfall"),
                "wind_speed": data.get("wind_speed"),
                "solar_radiation": data.get("solar_radiation"),
                "et0": data.get("et0"),
                "climate_risk": data.get("climate_risk"),
                "soil_ph": data.get("soil_ph"),
                "organic_carbon": data.get("organic_carbon"),
                "sand_percentage": data.get("sand_percentage"),
                "silt_percentage": data.get("silt_percentage"),
                "clay_percentage": data.get("clay_percentage"),
                "cec": data.get("cec"),
                "bulk_density": data.get("bulk_density"),
                "field_capacity": data.get("field_capacity"),
                "wilting_point": data.get("wilting_point"),
                "available_water": data.get("available_water"),
                "nitrogen": data.get("nitrogen"),
                "soil_type": data.get("soil_type"),
                "root_depth_m": data.get("root_depth_m"),
                "predicted_irrigation": data.get("predicted_irrigation"),
            })
            .execute()
        )
        return response
    except Exception as e:
        print(f"Warning: Could not save irrigation prediction to Supabase: {e}")
        return None


# ============================================================
# 3. SAVE CLIMATE PREDICTION
# ============================================================

def save_climate_prediction(data):
    try:
        _save_to_prediction_records(
            user_id=data.get("user_id"),
            prediction_type="climate_risk",
            request_payload={"city": data.get("city"), "state": data.get("state"), "crop": data.get("crop")},
            result_payload={"predicted_climate_risk": data.get("predicted_climate_risk")},
        )
        response = (
            supabase
            .table("climate_prediction")
            .insert({
                "city": data.get("city"),
                "state": data.get("state"),
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "temperature": data.get("temperature"),
                "relative_humidity": data.get("relative_humidity"),
                "precipitation": data.get("precipitation"),
                "surface_pressure": data.get("surface_pressure"),
                "cloud_cover": data.get("cloud_cover"),
                "wind_speed": data.get("wind_speed"),
                "wind_direction": data.get("wind_direction"),
                "wind_gust": data.get("wind_gust"),
                "shortwave_radiation": data.get("shortwave_radiation"),
                "et0": data.get("et0"),
                "soil_moisture": data.get("soil_moisture"),
                "soil_temperature": data.get("soil_temperature"),
                "soil_ph": data.get("soil_ph"),
                "organic_carbon": data.get("organic_carbon"),
                "clay": data.get("clay"),
                "sand": data.get("sand"),
                "silt": data.get("silt"),
                "elevation": data.get("elevation"),
                "heat_index": data.get("heat_index"),
                "rainfall_last_7_days": data.get("rainfall_last_7_days"),
                "rainfall_last_30_days": data.get("rainfall_last_30_days"),
                "consecutive_dry_days": data.get("consecutive_dry_days"),
                "growing_degree_days": data.get("growing_degree_days"),
                "crop": data.get("crop"),
                "predicted_climate_risk": data.get("predicted_climate_risk"),
            })
            .execute()
        )
        return response
    except Exception as e:
        print(f"Warning: Could not save climate prediction to Supabase: {e}")
        return None


# ============================================================
# 4. SAVE YIELD PREDICTION
# ============================================================

def save_yield_prediction(data):
    try:
        _save_to_prediction_records(
            user_id=data.get("user_id"),
            prediction_type="yield_forecast",
            request_payload={"state": data.get("state"), "district": data.get("district"), "crop": data.get("crop")},
            result_payload={"predicted_yield": data.get("predicted_yield")},
        )
        response = (
            supabase
            .table("yield_prediction")
            .insert({
                "state": data.get("state"),
                "district": data.get("district"),
                "village": data.get("village"),
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "crop": data.get("crop"),
                "season": data.get("season"),
                "year": data.get("year"),
                "area": data.get("area"),
                "mean_temperature": data.get("mean_temperature"),
                "max_temperature": data.get("max_temperature"),
                "min_temperature": data.get("min_temperature"),
                "precipitation": data.get("precipitation"),
                "shortwave_radiation": data.get("shortwave_radiation"),
                "wind_speed": data.get("wind_speed"),
                "relative_humidity": data.get("relative_humidity"),
                "et0": data.get("et0"),
                "soil_moisture": data.get("soil_moisture"),
                "soil_temperature": data.get("soil_temperature"),
                "soil_ph": data.get("soil_ph"),
                "organic_carbon": data.get("organic_carbon"),
                "clay": data.get("clay"),
                "sand": data.get("sand"),
                "silt": data.get("silt"),
                "elevation": data.get("elevation"),
                "predicted_yield": data.get("predicted_yield"),
            })
            .execute()
        )
        return response
    except Exception as e:
        print(f"Warning: Could not save yield prediction to Supabase: {e}")
        return None


# ============================================================
# 5. SAVE MARKET PRICE PREDICTION
# ============================================================

def save_market_prediction(data):
    try:
        _save_to_prediction_records(
            user_id=data.get("user_id"),
            prediction_type="market_price",
            request_payload={"commodity": data.get("commodity"), "state": data.get("state"), "district": data.get("district")},
            result_payload={"predicted_market_price": data.get("predicted_market_price")},
        )
        response = (
            supabase
            .table("market_prediction")
            .insert({
                "commodity": data.get("commodity"),
                "state": data.get("state"),
                "district": data.get("district"),
                "day": data.get("day"),
                "month": data.get("month"),
                "year": data.get("year"),
                "quarter": data.get("quarter"),
                "arrival_quantity": data.get("arrival_quantity"),
                "predicted_market_price": data.get("predicted_market_price"),
            })
            .execute()
        )
        return response
    except Exception as e:
        print(f"Warning: Could not save market prediction to Supabase: {e}")
        return None


def _get_admin_client():
    try:
        from App.backend.settings import create_supabase_admin_client
        admin_c = create_supabase_admin_client()
        if admin_c is not None:
            return admin_c
    except Exception:
        pass
    return supabase


# ============================================================
# 6. SAVE DISEASE / PEST / NUTRIENT DETECTION RESULT
# ============================================================

def save_disease_prediction(data):
    admin_client = _get_admin_client()
    if admin_client is None:
        return {"telemetry_saved": False, "error": "No Supabase client available"}

    now = datetime.now(timezone.utc).isoformat()
    user_id = data.get("user_id")

    # 1. Save to user personal history (diagnostic_reports) if authenticated user_id present
    if user_id:
        try:
            admin_client.table("diagnostic_reports").insert({
                "user_id": user_id,
                "crop": data.get("crop") or "Unknown",
                "image_storage_path": data.get("annotated_image_url"),
                "detection_results": data.get("all_detections") or {},
                "primary_diagnosis": data.get("top_disease") or data.get("top_pest") or data.get("top_nutrient") or "Diagnosed",
                "confidence": data.get("top_disease_confidence") or 0.9,
                "created_at": now,
            }).execute()
        except Exception as e:
            print(f"Warning: Could not save to diagnostic_reports: {e}")

        try:
            _save_to_prediction_records(
                user_id=user_id,
                prediction_type="disease_detection",
                request_payload={"crop": data.get("crop")},
                result_payload={
                    "top_disease": data.get("top_disease"),
                    "top_pest": data.get("top_pest"),
                    "top_nutrient": data.get("top_nutrient"),
                    "confidence": data.get("top_disease_confidence") or 0.9,
                },
            )
        except Exception as e:
            print(f"Warning: Could not save disease prediction to prediction_records: {e}")

    # 2. Save to disease_prediction telemetry table using server-only privileged admin client
    telemetry_saved = False
    try:
        insert_payload = {
            "user_email":              data.get("user_email"),
            "crop":                    data.get("crop"),
            "top_disease":             data.get("top_disease"),
            "top_disease_confidence":  data.get("top_disease_confidence"),
            "top_pest":                data.get("top_pest"),
            "top_pest_confidence":     data.get("top_pest_confidence"),
            "top_nutrient":            data.get("top_nutrient"),
            "top_nutrient_confidence": data.get("top_nutrient_confidence"),
            "annotated_image_url":     data.get("annotated_image_url"),
            "all_detections":          data.get("all_detections"),
            "custom_crop_notice":      data.get("custom_crop_notice"),
        }
        # Only set state/district if explicitly provided (do not invent default values)
        if data.get("state"):
            insert_payload["state"] = data.get("state")
        if data.get("district"):
            insert_payload["district"] = data.get("district")
        if data.get("status"):
            insert_payload["status"] = data.get("status")

        response = (
            admin_client
            .table("disease_prediction")
            .insert(insert_payload)
            .execute()
        )
        if response and response.data:
            telemetry_saved = True
            print(f"Info: Successfully persisted disease prediction telemetry record for crop={data.get('crop')}")
        return {"telemetry_saved": telemetry_saved, "response": response}
    except Exception as e:
        print(f"Warning: Could not save disease prediction to disease_prediction table: {e}")
        return {"telemetry_saved": False, "error": str(e)}
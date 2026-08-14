from App.backend.database.database import supabase


# ============================================================
# 1. SAVE CROP PREDICTION
# ============================================================

def save_crop_prediction(data):
    try:
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
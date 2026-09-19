import joblib
import pandas as pd
from pathlib import Path

from App.backend.api.weather import get_future_weather
from App.backend.climate_features import calculate_climate_features
from App.backend.api.soil import get_soil
from App.backend.api.location import get_location

from App.backend.database.save_predictions import save_climate_prediction


# =========================================================
# PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parents[1]

CLIMATE_DIR = BASE_DIR / "pickles" / "climate"


# =========================================================
# LAZY MODEL AND ENCODER LOADING
# =========================================================

_CLIMATE_MODEL = None
_CLIMATE_ENCODERS = None

def get_climate_artifacts():
    global _CLIMATE_MODEL, _CLIMATE_ENCODERS
    if _CLIMATE_MODEL is None or _CLIMATE_ENCODERS is None:
        _CLIMATE_MODEL = joblib.load(CLIMATE_DIR / "model.pkl")
        _CLIMATE_ENCODERS = joblib.load(CLIMATE_DIR / "encoder.pkl")
    return _CLIMATE_MODEL, _CLIMATE_ENCODERS


# =========================================================
# CLIMATE RISK PREDICTION
# =========================================================

def predict_climate_risk(data):
    model, encoders = get_climate_artifacts()

    # =====================================================
    # 1. GET LOCATION
    # =====================================================

    state_name = data["state"]
    district = data["district"]

    # If the caller (predictions.py) already resolved this state+district
    # to coordinates once, reuse it instead of geocoding again here.
    location = data.get("location")
    if not location:
        location = get_location(
            state=state_name,
            district=district,
            village=data.get("village")
        )

    latitude = location["latitude"]
    longitude = location["longitude"]

    print("\nLOCATION:")
    print(location)

    print("\nLATITUDE:", latitude)
    print("LONGITUDE:", longitude)


    # =====================================================
    # 2. GET FUTURE WEATHER
    # =====================================================

    start_date = data.get("start_date")
    end_date = data.get("end_date")
    if not start_date or not end_date:
        from App.backend.growth_stages import compute_date_range
        def_start, def_end, _ = compute_date_range(start_date)
        start_date = start_date or str(def_start)
        end_date = end_date or str(def_end)

    weather = get_future_weather(
        latitude=latitude,
        longitude=longitude,
        start_date=start_date,
        end_date=end_date
    )

    print("\nWEATHER:")
    print(weather)


    # =====================================================
    # 3. CALCULATE CLIMATE FEATURES
    # =====================================================

    climate_features = calculate_climate_features(
        weather
    )

    print("\nCLIMATE FEATURES:")
    print(climate_features)


    # =====================================================
    # 4. GET SOIL DATA
    # =====================================================

    soil = get_soil(
        latitude,
        longitude
    )

    print("\nSOIL DATA:")
    print(soil)


    # =====================================================
    # 5. CHECK SOIL DATA
    # =====================================================

    # Check only the soil keys the climate risk model actually uses.
    # Some locations return None for optional fields (bulk_density,
    # wilting_point, etc.) that aren't part of this model's feature set.
    _required_soil_keys = ["Soil_pH", "Organic_Carbon", "Clay", "Sand", "Silt"]
    missing_soil = [k for k in _required_soil_keys if soil.get(k) is None]
    if missing_soil:
        raise ValueError(
            f"Required soil data missing for this location: {missing_soil}"
        )


    # =====================================================
    # 6. GET CROP AND SEASON
    # =====================================================

    # Support both:
    # data["Crop"] / data["Season"]
    # and:
    # data["crop"] / data["season"]

    crop = data.get(
        "Crop",
        data.get("crop")
    )

    season = data.get("Season", data.get("season"))
    if not season and start_date:
        try:
            from App.backend.seasons import get_season
            season = get_season(start_date)
        except Exception:
            season = "Kharif"
    if not season:
        season = "Kharif"

    if crop is None:
        raise ValueError(
            "Crop is required for climate prediction."
        )


    # =====================================================
    # 7. CREATE MODEL INPUT
    # =====================================================

    risk_data = {

        "city": location["name"],

        "state": location["state"],

        "latitude": latitude,

        "longitude": longitude,

        "temperature_2m":
            weather["mean_temperature"],

        "relative_humidity_2m":
            weather["relative_humidity"],

        "precipitation":
            weather["precipitation"],

        "surface_pressure":
            weather["surface_pressure"],

        "cloud_cover":
            weather["cloud_cover"],

        "wind_speed_10m":
            weather["wind_speed"],

        "wind_direction_10m":
            weather["wind_direction"],

        "wind_gusts_10m":
            weather["wind_gusts"],

        "shortwave_radiation":
            weather["shortwave_radiation"],

        "et0_fao_evapotranspiration":
            weather["et0"],

        "Season":
            season,

        "Soil_Moisture":
            weather["soil_moisture"],

        "Soil_Temperature":
            weather["soil_temperature"],

        "Soil_pH":
            soil["Soil_pH"],

        "Organic_Carbon":
            soil["Organic_Carbon"],

        "Clay":
            soil["Clay"],

        "Sand":
            soil["Sand"],

        "Silt":
            soil["Silt"],

        "Elevation":
            weather["elevation"],

        "Heat_Index":
            climate_features["Heat_Index"],

        "Rainfall_Last_7_Days":
            climate_features["Rainfall_Last_7_Days"],

        "Rainfall_Last_30_Days":
            climate_features["Rainfall_Last_30_Days"],

        "Consecutive_Dry_Days":
            climate_features["Consecutive_Dry_Days"],

        "Growing_Degree_Days":
            climate_features["Growing_Degree_Days"],

        "Crop":
            crop
    }


    # =====================================================
    # 8. CREATE DATAFRAME
    # =====================================================

    df = pd.DataFrame(
        [risk_data]
    )

    print("\nRAW MODEL INPUT:")
    print(df)


    # =====================================================
    # 9. ENCODE CATEGORICAL FEATURES
    # =====================================================

    categorical_cols = [
        "city",
        "state",
        "Crop",
        "Season"
    ]

    for col in categorical_cols:
        val = df[col].iloc[0]
        known_cats = list(encoders[col].categories_[0])
        if str(val) not in known_cats:
            # Fall back to the first known category so the model
            # can still run instead of crashing on an unknown value.
            df[col] = known_cats[0]

        encoded = encoders[col].transform(
            df[[col]]
        )

        encoded_df = pd.DataFrame(
            encoded,
            columns=encoders[col].get_feature_names_out(
                [col]
            ),
            index=df.index
        )

        df = pd.concat(
            [
                df.drop(
                    columns=[col]
                ),
                encoded_df
            ],
            axis=1
        )


    # =====================================================
    # 10. MODEL PREDICTION
    # =====================================================

    prediction = model.predict(
        df
    )[0]

    predicted_climate_risk = str(
        prediction
    )

    print("\nRAW PREDICTION:")
    print(predicted_climate_risk)


    # =====================================================
    # 11. SAVE CLIMATE PREDICTION TO SUPABASE
    # =====================================================

    save_climate_prediction({

        "city":
            location["name"],

        "state":
            location["state"],

        "latitude":
            latitude,

        "longitude":
            longitude,

        "temperature":
            weather["mean_temperature"],

        "relative_humidity":
            weather["relative_humidity"],

        "precipitation":
            weather["precipitation"],

        "surface_pressure":
            weather["surface_pressure"],

        "cloud_cover":
            weather["cloud_cover"],

        "wind_speed":
            weather["wind_speed"],

        "wind_direction":
            weather["wind_direction"],

        "wind_gust":
            weather["wind_gusts"],

        "shortwave_radiation":
            weather["shortwave_radiation"],

        "et0":
            weather["et0"],

        "soil_moisture":
            weather["soil_moisture"],

        "soil_temperature":
            weather["soil_temperature"],

        "soil_ph":
            soil["Soil_pH"],

        "organic_carbon":
            soil["Organic_Carbon"],

        "clay":
            soil["Clay"],

        "sand":
            soil["Sand"],

        "silt":
            soil["Silt"],

        "elevation":
            weather["elevation"],

        "heat_index":
            climate_features["Heat_Index"],

        "rainfall_last_7_days":
            climate_features["Rainfall_Last_7_Days"],

        "rainfall_last_30_days":
            climate_features["Rainfall_Last_30_Days"],

        "consecutive_dry_days":
            climate_features["Consecutive_Dry_Days"],

        "growing_degree_days":
            climate_features["Growing_Degree_Days"],

        "crop":
            crop,

        "predicted_climate_risk":
            predicted_climate_risk
    })


    print("\nCLIMATE PREDICTION SAVED TO SUPABASE")


    # =====================================================
    # 12. RETURN PREDICTION
    # =====================================================

    def _safe(v):
        """Convert numpy scalars to JSON-safe Python primitives."""
        import numpy as np
        if isinstance(v, (np.integer,)):
            return int(v)
        if isinstance(v, (np.floating,)):
            return float(v)
        return v

    return {
        "predicted_climate_risk": predicted_climate_risk,
        "climate_risk": predicted_climate_risk,
        "risk_category": str(predicted_climate_risk).title(),
        "temperature": _safe(weather["mean_temperature"]),
        "relative_humidity": _safe(weather["relative_humidity"]),
        "precipitation": _safe(weather["precipitation"]),
        "wind_speed": _safe(weather["wind_speed"]),
        "et0": _safe(weather["et0"]),
        "elevation": _safe(weather.get("elevation")),
        "heat_index": _safe(climate_features["Heat_Index"]),
        "growing_degree_days": _safe(climate_features["Growing_Degree_Days"]),
        "rainfall_last_7_days": _safe(climate_features["Rainfall_Last_7_Days"]),
        "rainfall_last_30_days": _safe(climate_features["Rainfall_Last_30_Days"]),
        "consecutive_dry_days": _safe(climate_features["Consecutive_Dry_Days"]),
        "soil_ph": _safe(soil["Soil_pH"]),
        "organic_carbon": _safe(soil["Organic_Carbon"]),
        "city": location["name"],
        "state": location["state"],
        "latitude": _safe(latitude),
        "longitude": _safe(longitude),
        # daily_data intentionally omitted — stripped in server.py before JSON response
    }
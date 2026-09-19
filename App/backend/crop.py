import joblib
import numpy as np
import pandas as pd
from pathlib import Path

from .config import PICKLES_DIR
from .api.weather import get_future_weather
from .api.soil import get_soil
from .api.location import get_location

from .database.save_predictions import save_crop_prediction


# ============================================================
# MODEL FILES
# ============================================================

CROP_DIR = PICKLES_DIR / "crop"

MODEL_PATH = CROP_DIR / "model.pkl"
SCALER_PATH = CROP_DIR / "scaler.pkl"
SEASON_ENCODER_PATH = CROP_DIR / "season_encoder.pkl"
LABEL_ENCODER_PATH = CROP_DIR / "label_encoder.pkl"
FEATURE_COLUMNS_PATH = CROP_DIR / "feature_columns.pkl"


# ============================================================
# CHECK MODEL FILES
# ============================================================

required_files = [
    MODEL_PATH,
    SCALER_PATH,
    SEASON_ENCODER_PATH,
    LABEL_ENCODER_PATH,
    FEATURE_COLUMNS_PATH
]

for file_path in required_files:

    if not file_path.exists():

        raise FileNotFoundError(
            f"Required crop model file not found: {file_path}"
        )


# ============================================================
# LAZY MODEL LOADING
# ============================================================

_CROP_MODEL = None
_CROP_SCALER = None
_CROP_SEASON_ENCODER = None
_CROP_LABEL_ENCODER = None
_CROP_MODEL_FEATURES = None

def get_crop_model_artifacts():
    global _CROP_MODEL, _CROP_SCALER, _CROP_SEASON_ENCODER, _CROP_LABEL_ENCODER, _CROP_MODEL_FEATURES
    if _CROP_MODEL is None:
        _CROP_MODEL = joblib.load(MODEL_PATH)
        _CROP_SCALER = joblib.load(SCALER_PATH)
        _CROP_SEASON_ENCODER = joblib.load(SEASON_ENCODER_PATH)
        _CROP_LABEL_ENCODER = joblib.load(LABEL_ENCODER_PATH)
        _CROP_MODEL_FEATURES = joblib.load(FEATURE_COLUMNS_PATH)
    return _CROP_MODEL, _CROP_SCALER, _CROP_SEASON_ENCODER, _CROP_LABEL_ENCODER, _CROP_MODEL_FEATURES


# ============================================================
# NUMERIC FEATURES
# ============================================================

NUMERIC_FEATURES = [
    "temperature",
    "humidity",
    "rainfall",
    "wind_speed",
    "soil_ph",
    "nitrogen",
    "organic_carbon",
    "clay",
    "sand",
    "silt",
    "cec"
]


# ============================================================
# SEASON FEATURES
# ============================================================

SEASON_FEATURES = [
    "season_Kharif",
    "season_Rabi",
    "season_Whole Year"
]


# ============================================================
# SOIL VALUE HELPER
# ============================================================

def get_soil_value(soil, *keys):

    for key in keys:

        if key not in soil:
            continue

        value = soil[key]

        if value is None:
            continue

        try:

            value = float(value)

            if np.isfinite(value):
                return value

        except (
            TypeError,
            ValueError
        ):

            continue

    raise ValueError(
        f"Could not find a valid soil value. "
        f"Checked: {keys}"
    )


# ============================================================
# MAIN CROP PREDICTION
# ============================================================

def predict_crop(input_data):
    model, scaler, season_encoder, label_encoder, MODEL_FEATURES = get_crop_model_artifacts()

    # ========================================================
    # 1. USER INPUT
    # ========================================================

    state = input_data["state"]

    district = input_data["district"]

    season = input_data.get("season")
    if not season and "start_date" in input_data:
        try:
            from App.backend.seasons import get_season
            season = get_season(input_data["start_date"])
        except Exception:
            season = "Kharif"
    if not season:
        season = "Kharif"


    try:
        expected_seasons = list(season_encoder.categories_[0])
    except Exception:
        expected_seasons = ["Kharif", "Rabi", "Whole Year"]

    season_map = {
        "monsoon": "Kharif",
        "post-monsoon": "Rabi",
        "summer": "Whole Year",
        "winter": "Rabi",
        "kharif": "Kharif",
        "rabi": "Rabi",
        "whole year": "Whole Year"
    }
    season_key = str(season).strip().lower()
    if season_key in season_map:
        season = season_map[season_key]

    if season not in expected_seasons:
        season = "Kharif" if "Kharif" in expected_seasons else expected_seasons[0]


    # ========================================================
    # 3. GET LOCATION
    # ========================================================

    # If the caller (predictions.py) already resolved this state+district
    # to coordinates once, reuse it instead of geocoding again here.
    location = input_data.get("location")

    if not location:

        location = get_location(

            state=state,

            district=district,

            village=input_data.get("village")
        )


    if not location:

        raise ValueError(
            "Could not retrieve location data."
        )


    latitude = float(
        location["latitude"]
    )

    longitude = float(
        location["longitude"]
    )


    # ========================================================
    # 4. GET WEATHER
    # ========================================================

    start_date = input_data.get(

        "start_date",

        pd.Timestamp.today().strftime(
            "%Y-%m-%d"
        )
    )


    end_date = input_data.get(

        "end_date",

        start_date
    )


    weather = get_future_weather(

        latitude=latitude,

        longitude=longitude,

        start_date=start_date,

        end_date=end_date
    )


    if not weather:

        raise ValueError(
            "Could not retrieve weather data."
        )


    # ========================================================
    # 5. EXTRACT WEATHER VALUES
    # ========================================================

    try:

        temperature = float(
            weather["mean_temperature"]
        )

        humidity = float(
            weather["relative_humidity"]
        )

        raw_precip = float(weather["precipitation"])
        # OpenMeteo provides 1-7 day precipitation (~10-40mm). The crop recommendation model
        # was trained on total seasonal growth cycle rainfall (100mm to 1000mm+).
        if raw_precip < 100.0:
            rainfall = max(raw_precip * 12.0, 180.0 if str(season).strip().lower() == "kharif" else 90.0)
        else:
            rainfall = raw_precip

        wind_speed = float(weather["wind_speed"])

    except KeyError as e:

        raise ValueError(
            f"Missing weather value: {e}"
        )


    # ========================================================
    # 6. GET SOIL
    # ========================================================

    soil = get_soil(

        latitude,

        longitude
    )


    if not soil:

        raise ValueError(
            "Could not retrieve soil data."
        )


    # ========================================================
    # 7. EXTRACT SOIL VALUES
    # ========================================================

    soil_ph = get_soil_value(

        soil,

        "soil_ph",

        "Soil_pH"
    )


    nitrogen = get_soil_value(
        soil,
        "nitrogen",
        "Nitrogen"
    )
    # SoilGrids returns nitrogen in g/kg (~0.8 to 1.5). The crop recommendation
    # model was trained on Nitrogen in kg/ha (~40 to 120, mean 60.66).
    if nitrogen is not None and nitrogen < 10.0:
        nitrogen = nitrogen * 50.0


    organic_carbon = get_soil_value(

        soil,

        "organic_carbon",

        "Organic_Carbon"
    )


    clay = get_soil_value(

        soil,

        "clay",

        "Clay"
    )


    sand = get_soil_value(

        soil,

        "sand",

        "Sand"
    )


    silt = get_soil_value(

        soil,

        "silt",

        "Silt"
    )


    cec = get_soil_value(

        soil,

        "cec",

        "CEC"
    )


    # ========================================================
    # 8. CREATE NUMERIC DATA
    # ========================================================

    numeric_df = pd.DataFrame([{

        "temperature":
            temperature,

        "humidity":
            humidity,

        "rainfall":
            rainfall,

        "wind_speed":
            wind_speed,

        "soil_ph":
            soil_ph,

        "nitrogen":
            nitrogen,

        "organic_carbon":
            organic_carbon,

        "clay":
            clay,

        "sand":
            sand,

        "silt":
            silt,

        "cec":
            cec

    }])


    # ========================================================
    # 9. CHECK NUMERIC FEATURES
    # ========================================================

    missing_numeric = [

        feature

        for feature in NUMERIC_FEATURES

        if feature not in numeric_df.columns

    ]


    if missing_numeric:

        raise ValueError(

            f"Missing numeric features: "
            f"{missing_numeric}"

        )


    # ========================================================
    # 10. SEASON ENCODING
    # ========================================================

    season_df = pd.DataFrame({

        "season": [season]

    })


    season_encoded = season_encoder.transform(

        season_df

    )


    season_feature_names = (

        season_encoder
        .get_feature_names_out(
            ["season"]
        )

    )


    season_encoded_df = pd.DataFrame(

        season_encoded,

        columns=season_feature_names

    )


    # ========================================================
    # 11. CHECK SEASON FEATURES
    # ========================================================

    missing_season_features = [

        feature

        for feature in SEASON_FEATURES

        if feature not in season_encoded_df.columns

    ]


    if missing_season_features:

        raise ValueError(

            "Season encoder did not generate "
            "the expected features: "
            f"{missing_season_features}"

        )


    # Combine raw numeric features and encoded season features
    model_input = pd.concat(
        [
            numeric_df,
            season_encoded_df
        ],
        axis=1
    )


    # ========================================================
    # 13. FORCE EXACT FEATURE ORDER
    # ========================================================

    missing_features = [

        feature

        for feature in MODEL_FEATURES

        if feature not in model_input.columns

    ]


    if missing_features:

        raise ValueError(

            f"Missing model features: "
            f"{missing_features}"

        )


    model_input = model_input[
        MODEL_FEATURES
    ]


    # ========================================================
    # 14. CHECK VALUES
    # ========================================================

    if model_input.isnull().any().any():

        raise ValueError(
            "NaN values found in model input."
        )


    model_values = model_input.to_numpy(
        dtype=float
    )


    if not np.isfinite(
        model_values
    ).all():

        raise ValueError(
            "Infinite or invalid numeric "
            "values found in model input."
        )


    # ========================================================
    # 16. PREDICT
    # ========================================================

    prediction = model.predict(model_input)[0]


    # ========================================================
    # 17. DECODE CROP
    # ========================================================

    predicted_crop = label_encoder.inverse_transform([prediction])[0]
    predicted_crop = str(predicted_crop)


    # ========================================================
    # 18. CONFIDENCE
    # ========================================================

    confidence = None
    top_crops = []

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(model_input)[0]


        # ----------------------------------------------------
        # Decode model classes safely
        # ----------------------------------------------------

        try:

            class_labels = (

                label_encoder
                .inverse_transform(
                    model.classes_
                )

            )

        except Exception:

            class_labels = (

                label_encoder
                .inverse_transform(
                    np.arange(
                        len(probabilities)
                    )
                )

            )


        probability_pairs = list(

            zip(
                class_labels,
                probabilities
            )

        )


        # ----------------------------------------------------
        # Sort highest probability first
        # ----------------------------------------------------

        probability_pairs.sort(

            key=lambda x: x[1],

            reverse=True

        )


        # ----------------------------------------------------
        # Top 5 crops
        # ----------------------------------------------------

        top_crops = [

            {
                "crop":
                    str(crop_name),

                "confidence":
                    round(
                        float(
                            probability * 100
                        ),
                        2
                    )
            }

            for crop_name, probability

            in probability_pairs[:5]

        ]


        # ----------------------------------------------------
        # Main confidence
        # ----------------------------------------------------

        confidence = round(

            float(
                max(probabilities) * 100
            ),

            2

        )


    # ========================================================
    # 19. SAVE CROP PREDICTION TO SUPABASE
    # ========================================================

    save_data = {

        "state":
            state,

        "district":
            district,

        "season":
            season,

        "latitude":
            latitude,

        "longitude":
            longitude,

        "temperature":
            temperature,

        "humidity":
            humidity,

        "rainfall":
            rainfall,

        "wind_speed":
            wind_speed,

        "soil_ph":
            soil_ph,

        "nitrogen":
            nitrogen,

        "organic_carbon":
            organic_carbon,

        "clay":
            clay,

        "sand":
            sand,

        "silt":
            silt,

        "cec":
            cec,

        "predicted_crop":
            predicted_crop,

        "confidence":
            confidence

    }


    try:

        save_crop_prediction(
            save_data
        )

        print(
            "\nCrop prediction "
            "saved to Supabase."
        )

    except Exception as e:

        # Do not hide the actual error.
        # Streamlit/backend can see it.

        print(
            "\nWARNING: Could not save "
            "crop prediction to Supabase:"
        )

        print(e)


    # ========================================================
    # 20. RETURN RESULT
    # ========================================================

    return {

        "predicted_crop":
            predicted_crop,

        "confidence":
            confidence,

        "top_5_crops":
            top_crops,

        "location": {

            "state":
                state,

            "district":
                district,

            "latitude":
                latitude,

            "longitude":
                longitude

        },

        "season":
            season,

        "weather": {

            "temperature":
                temperature,

            "humidity":
                humidity,

            "rainfall":
                rainfall,

            "wind_speed":
                wind_speed

        },

        "soil": {

            "soil_ph":
                soil_ph,

            "nitrogen":
                nitrogen,

            "organic_carbon":
                organic_carbon,

            "clay":
                clay,

            "sand":
                sand,

            "silt":
                silt,

            "cec":
                cec

        }

    }
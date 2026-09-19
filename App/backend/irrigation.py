import joblib
import numpy as np
import pandas as pd

from .config import PICKLES_DIR

from .api.weather import get_future_weather
from .api.soil import get_soil
from .api.location import get_location

from .database.save_predictions import (
    save_irrigation_prediction
)


# =========================================================
# IRRIGATION MODEL FILES
# =========================================================

IRRIGATION_DIR = PICKLES_DIR / "irrigation"

MODEL_PATH = IRRIGATION_DIR / "model.pkl"
ENCODER_PATH = IRRIGATION_DIR / "encoder.pkl"
FEATURES_PATH = IRRIGATION_DIR / "irrigation_features.pkl"
PREPROCESSING_PATH = (
    IRRIGATION_DIR / "irrigation_preprocessing.pkl"
)


# =========================================================
# CHECK REQUIRED FILES
# =========================================================

required_files = [
    MODEL_PATH,
    ENCODER_PATH,
    FEATURES_PATH,
    PREPROCESSING_PATH
]

for file_path in required_files:

    if not file_path.exists():

        raise FileNotFoundError(
            f"Required irrigation model file "
            f"not found: {file_path}"
        )


# =========================================================
# LOAD MODEL
# =========================================================

model = joblib.load(MODEL_PATH)


# =========================================================
# LOAD ENCODER
# =========================================================

encoder = joblib.load(ENCODER_PATH)


# =========================================================
# LOAD PREPROCESSING
# =========================================================

preprocessing = joblib.load(PREPROCESSING_PATH)


# =========================================================
# GET EXACT MODEL FEATURES
# =========================================================

if hasattr(model, "feature_names_in_"):

    model_features = list(
        model.feature_names_in_
    )

else:

    model_features = list(
        joblib.load(FEATURES_PATH)
    )


# =========================================================
# Irrigation model configuration loaded successfully.



# =========================================================
# MAIN IRRIGATION FUNCTION
# =========================================================

def predict_irrigation(
    input_data,
    climate_result=None
):
    if climate_result is None:
        try:
            from App.backend.climate_risk import predict_climate_risk
            climate_result = predict_climate_risk(input_data)
        except Exception:
            climate_result = {"predicted_climate_risk": "low"}

    """
    Predict irrigation requirement.

    IMPORTANT:

    climate_result MUST come from:

        predict_climate_risk()

    Execution flow:

        climate_risk.py
              ↓
        predict_climate_risk()
              ↓
        climate_result
              ↓
        predict_irrigation()
              ↓
        irrigation prediction


    Example:

        climate_result = predict_climate_risk(
            climate_input
        )

        irrigation_result = predict_irrigation(
            irrigation_input,
            climate_result
        )
    """


    if isinstance(climate_result, str):
        climate_result = {"predicted_climate_risk": climate_result, "climate_risk": climate_result}
    elif climate_result is None or not isinstance(climate_result, dict):
        climate_result = {}

    climate_risk = climate_result.get("predicted_climate_risk") or climate_result.get("climate_risk") or "Low Risk"
    climate_risk = str(climate_risk).strip()


    print("\n" + "=" * 60)
    print("CLIMATE -> IRRIGATION")
    print("=" * 60)

    print(
        "Climate risk received:",
        climate_risk
    )


    # =====================================================
    # 3. GET CLIMATE RISK SCORE
    # =====================================================

    climate_risk_score = climate_result.get(
        "climate_risk_score",
        0
    )


    try:

        climate_risk_score = float(
            climate_risk_score
        )

    except (
        TypeError,
        ValueError
    ):

        climate_risk_score = 0.0


    print(
        "Climate risk score:",
        climate_risk_score
    )


    # =====================================================
    # 4. USER INPUT
    # =====================================================

    state_name = input_data["state"]

    district = input_data["district"]

    city = input_data.get(
        "city",
        district
    )

    crop = input_data["crop"]

    season = input_data.get(
        "season",
        input_data.get("Season")
    )

    growth_stage_name = input_data.get("growth_stage", "Development Stage")
    root_depth_m = float(input_data.get("root_depth_m", 0.50))
    kc = float(input_data.get("kc", 1.15))
    start_date = input_data.get("start_date", pd.Timestamp.today().strftime("%Y-%m-%d"))
    end_date = input_data.get("end_date", start_date)


    # =====================================================
    # 5. VALIDATE INPUT
    # =====================================================

    if not season:
        season = "Kharif"


    if root_depth_m <= 0:

        raise ValueError(
            "root_depth_m must be greater than 0."
        )


    if kc <= 0:

        raise ValueError(
            "Kc must be greater than 0."
        )


    # =====================================================
    # 6. GET LOCATION
    # =====================================================

    # If the caller (predictions.py) already resolved this state+district
    # to coordinates once, reuse it instead of geocoding again here.
    location = input_data.get("location")

    if not location:

        location = get_location(

            state=state_name,

            district=district,

            village=input_data.get(
                "village"
            )
        )


    if not location:

        raise ValueError(
            "Could not retrieve location."
        )


    latitude = float(
        location["latitude"]
    )

    longitude = float(
        location["longitude"]
    )


    print("\nLOCATION:")
    print(location)

    print(
        "Latitude:",
        latitude
    )

    print(
        "Longitude:",
        longitude
    )


    # =====================================================
    # 7. GET FUTURE WEATHER
    # =====================================================

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


    print("\nFUTURE WEATHER:")
    print(weather)


    # =====================================================
    # 8. GET SOIL DATA
    # =====================================================

    soil = get_soil(

        latitude,

        longitude
    )


    if not soil:

        raise ValueError(
            "Could not retrieve soil data."
        )


    print("\nSOIL DATA:")
    print(soil)


    # =====================================================
    # 9. ENCODE STATE
    # =====================================================

    state_mapping = preprocessing.get("state_mapping", {})
    state_keys = {str(k).lower(): k for k in state_mapping.keys()}
    if str(state_name).lower() in state_keys:
        matched_state = state_keys[str(state_name).lower()]
        state_encoded = state_mapping[matched_state]
    elif state_mapping:
        state_encoded = list(state_mapping.values())[0]
    else:
        state_encoded = 0

    # =====================================================
    # 10. ENCODE GROWTH STAGE
    # =====================================================
    growth_stage_mapping = preprocessing.get("growth_stage_mapping", {})
    gs_keys = {str(k).lower(): k for k in growth_stage_mapping.keys()}
    gs_lower = str(growth_stage_name).lower()
    
    if gs_lower in gs_keys:
        growth_stage_encoded = growth_stage_mapping[gs_keys[gs_lower]]
    else:
        # Partial match attempt
        matched_gs = None
        for k in growth_stage_mapping.keys():
            if gs_lower in k.lower() or k.lower() in gs_lower:
                matched_gs = k
                break
        if matched_gs:
            growth_stage_encoded = growth_stage_mapping[matched_gs]
        elif growth_stage_mapping:
            growth_stage_encoded = list(growth_stage_mapping.values())[0]
        else:
            growth_stage_encoded = 0


    # =====================================================
    # 11. WEATHER VALUES
    # =====================================================

    try:

        temperature = float(
            weather["mean_temperature"]
        )

        relative_humidity = float(
            weather["relative_humidity"]
        )

        rainfall = float(
            weather["precipitation"]
        )

        wind_speed = float(
            weather["wind_speed"]
        )

        solar_radiation = float(
            weather["shortwave_radiation"]
        )

        et0 = float(
            weather["et0"]
        )

    except KeyError as e:

        raise ValueError(
            f"Missing weather value: {e}"
        )

    except (
        TypeError,
        ValueError
    ) as e:

        raise ValueError(
            f"Invalid weather value: {e}"
        )


    # =====================================================
    # 12. CLIMATE RISK MAPPING
    # =====================================================

    climate_mapping = preprocessing.get(
        "climate_mapping"
    )


    if not climate_mapping:

        raise ValueError(
            "climate_mapping not found in "
            "irrigation_preprocessing.pkl"
        )


    # The climate model outputs: 'low', 'moderate', 'high', 'extreme'
    # The irrigation preprocessing only has 'Low'/'Medium' from training.
    # Map all possible values defensively:
    _climate_fallback_map = {
        "low": "Low",
        "moderate": "Medium",
        "medium": "Medium",
        "high": "Medium",   # nearest available bucket
        "extreme": "Medium",
        "medium risk": "Medium",
        "low risk": "Low",
        "high risk": "Medium",
    }

    matched_risk = None

    # 1. Try exact case-insensitive match against the training mapping
    for known_risk in climate_mapping.keys():
        if (
            str(known_risk).strip().lower()
            ==
            climate_risk.lower()
        ):
            matched_risk = known_risk
            break

    # 2. Fall back to the defensive map
    if matched_risk is None:
        fallback_key = climate_risk.strip().lower()
        if fallback_key in _climate_fallback_map:
            matched_risk = _climate_fallback_map[fallback_key]
            if matched_risk not in climate_mapping:
                matched_risk = list(climate_mapping.keys())[0]
        else:
            # Last resort: use first available bucket
            matched_risk = list(climate_mapping.keys())[0]
            print(
                f"WARNING: Climate risk '{climate_risk}' not in mapping "
                f"{list(climate_mapping.keys())}. Defaulting to '{matched_risk}'."
            )


    climate_risk = matched_risk


    climate_risk_encoded = (
        climate_mapping[
            climate_risk
        ]
    )


    print(
        "\nCLIMATE RISK:",
        climate_risk
    )

    print(
        "CLIMATE RISK ENCODED:",
        climate_risk_encoded
    )


    # =====================================================
    # 13. SOIL VALUES
    # =====================================================

    try:

        soil_ph = float(
            soil["soil_ph"]
        )

        organic_carbon = float(
            soil["organic_carbon"]
        )

        sand_percentage = float(
            soil["sand"]
        )

        silt_percentage = float(
            soil["silt"]
        )

        clay_percentage = float(
            soil["clay"]
        )

        cec = float(
            soil["cec"]
        )

        bulk_density = float(
            soil["bulk_density"]
        )

        field_capacity = float(
            soil["field_capacity"]
        )

        wilting_point = float(
            soil["wilting_point"]
        )

        available_water = float(
            soil["available_water"]
        )

        nitrogen = float(
            soil["nitrogen"]
        )

        soil_type = soil[
            "soil_type"
        ]

    except KeyError as e:

        raise ValueError(
            f"Missing soil value: {e}"
        )

    except (
        TypeError,
        ValueError
    ) as e:

        raise ValueError(
            f"Invalid soil value: {e}"
        )


    # =====================================================
    # 14. CROP WATER REQUIREMENT
    # =====================================================

    # ETc = Kc × ET0

    water_requirement = (
        kc * et0
    )


    water_requirement = round(
        float(
            water_requirement
        ),
        2
    )


    print(
        "\nCROP WATER REQUIREMENT:"
    )

    print(
        f"Kc × ET0 = {kc} × {et0}"
    )

    print(
        "Water Requirement:",
        water_requirement,
        "mm/day"
    )


    # =====================================================
    # 15. KC BAND
    # =====================================================

    kc_bins = preprocessing.get(
        "kc_bins"
    )

    kc_labels = preprocessing.get(
        "kc_labels"
    )


    if kc_bins is None:

        raise ValueError(
            "kc_bins not found in preprocessing."
        )


    if kc_labels is None:

        raise ValueError(
            "kc_labels not found in preprocessing."
        )


    # The encoder only knows 'low', 'medium', 'high' — cap any label
    # not in the encoder's vocabulary (e.g. 'very_high') to 'high'.
    encoder_kc_cats = list(encoder["kc_band"].categories_[0])
    safe_kc_labels = [
        lbl if lbl in encoder_kc_cats else encoder_kc_cats[-1]
        for lbl in kc_labels
    ]

    kc_band_idx = pd.cut(

        [kc],

        bins=kc_bins,

        labels=False,

        include_lowest=True

    )[0]


    if pd.isna(kc_band_idx):

        raise ValueError(

            f"Kc value {kc} is outside "
            f"supported range: {kc_bins}"

        )

    kc_band = safe_kc_labels[int(kc_band_idx)]


    print(
        "\nKC BAND:",
        kc_band
    )


    # =====================================================
    # 16. CREATE BASE INPUT DATAFRAME
    # =====================================================

    input_df = pd.DataFrame([{

        "state":
            state_encoded,

        "city":
            city,

        "temperature":
            temperature,

        "relative_humidity":
            relative_humidity,

        "rainfall":
            rainfall,

        "wind_speed":
            wind_speed,

        "solar_radiation":
            solar_radiation,

        "et0":
            et0,

        "climate_risk_score":
            climate_risk_score,

        "climate_risk":
            climate_risk_encoded,

        "soil_ph":
            soil_ph,

        "organic_carbon":
            organic_carbon,

        "sand_percentage":
            sand_percentage,

        "silt_percentage":
            silt_percentage,

        "clay_percentage":
            clay_percentage,

        "cec":
            cec,

        "bulk_density":
            bulk_density,

        "field_capacity":
            field_capacity,

        "wilting_point":
            wilting_point,

        "available_water":
            available_water,

        "nitrogen":
            nitrogen,

        "soil_type":
            soil_type,

        "crop":
            crop,

        "growth_stage":
            growth_stage_encoded,

        "root_depth_m":
            root_depth_m

    }])


    # =====================================================
    # 17. ENCODE CATEGORICAL FEATURES
    # =====================================================

    encoded_parts = []


    categorical_columns = [
        "city",
        "crop",
        "soil_type"
    ]


    for column in categorical_columns:

        if column not in encoder:

            raise ValueError(
                f"Encoder for '{column}' "
                f"not found."
            )


        column_encoder = encoder[
            column
        ]


        try:

            encoded = (
                column_encoder.transform(
                    input_df[[column]]
                )
            )

        except Exception as e:

            raise ValueError(

                f"Could not encode "
                f"'{column}' value "
                f"'{input_df[column].iloc[0]}'. "
                f"Encoder error: {e}"

            )


        encoded_df = pd.DataFrame(

            encoded,

            columns=(
                column_encoder
                .get_feature_names_out(
                    [column]
                )
            ),

            index=input_df.index

        )


        encoded_parts.append(
            encoded_df
        )


    # =====================================================
    # 18. ENCODE KC BAND
    # =====================================================

    if "kc_band" not in encoder:

        raise ValueError(
            "Encoder for 'kc_band' not found."
        )


    kc_band_input = pd.DataFrame({

        "kc_band": [
            kc_band
        ]

    })


    try:

        kc_band_encoded = (
            encoder["kc_band"].transform(
                kc_band_input
            )
        )

    except Exception as e:

        raise ValueError(
            f"Could not encode kc_band "
            f"'{kc_band}': {e}"
        )


    kc_band_df = pd.DataFrame(

        kc_band_encoded,

        columns=(
            encoder["kc_band"]
            .get_feature_names_out(
                ["kc_band"]
            )
        ),

        index=input_df.index

    )


    encoded_parts.append(
        kc_band_df
    )


    # =====================================================
    # 19. REMOVE ORIGINAL CATEGORICAL COLUMNS
    # =====================================================

    numeric_df = input_df.drop(

        columns=[
            "city",
            "crop",
            "soil_type"
        ]

    )


    # =====================================================
    # 20. COMBINE FEATURES
    # =====================================================

    final_df = pd.concat(

        [
            numeric_df,
            *encoded_parts
        ],

        axis=1

    )


    # =====================================================
    # 21. CHECK MODEL FEATURES
    # =====================================================

    missing_features = [

        feature

        for feature in model_features

        if feature not in final_df.columns

    ]


    extra_features = [

        feature

        for feature in final_df.columns

        if feature not in model_features

    ]


    print(
        "\n" + "=" * 60
    )

    print(
        "MODEL FEATURE COUNT:",
        len(model_features)
    )

    print(
        "FINAL DATAFRAME FEATURE COUNT:",
        len(final_df.columns)
    )

    print(
        "MISSING FEATURES:",
        missing_features
    )

    print(
        "EXTRA FEATURES:",
        extra_features
    )


    if missing_features:

        raise ValueError(

            f"Missing model features: "
            f"{missing_features}"

        )


    if extra_features:

        print(
            f"WARNING: Extra features dropped before prediction: "
            f"{extra_features}"
        )


    # =====================================================
    # 22. EXACT MODEL FEATURE ORDER
    # =====================================================

    final_df = final_df[
        model_features
    ]


    # =====================================================
    # 23. CHECK NUMERIC VALUES
    # =====================================================

    non_numeric_columns = (

        final_df
        .select_dtypes(
            exclude=["number"]
        )
        .columns
        .tolist()

    )


    if non_numeric_columns:

        raise ValueError(

            "Non-numeric features found "
            "before prediction: "
            f"{non_numeric_columns}"

        )


    # =====================================================
    # 24. CHECK NaN
    # =====================================================

    if final_df.isnull().any().any():

        null_columns = (
            final_df.columns[
                final_df.isnull().any()
            ].tolist()
        )

        raise ValueError(

            "NaN values found in model input: "
            f"{null_columns}"

        )


    # =====================================================
    # 25. CHECK INFINITE VALUES
    # =====================================================

    numeric_values = (
        final_df.to_numpy(
            dtype=float
        )
    )


    if not np.isfinite(
        numeric_values
    ).all():

        raise ValueError(
            "Infinite or invalid numeric "
            "values found in irrigation "
            "model input."
        )


    # =====================================================
    # 26. PREDICT IRRIGATION
    # =====================================================

    prediction = model.predict(
        final_df
    )[0]


    prediction = round(
        float(prediction),
        2
    )


    print(
        "\nPREDICTED IRRIGATION:",
        prediction,
        "mm/day"
    )


    # =====================================================
    # 27. PREPARE SUPABASE DATA
    # =====================================================

    prediction_data = {

        "state":
            state_name,

        "city":
            city,

        "crop":
            crop,

        "growth_stage":
            growth_stage_name,

        "temperature":
            temperature,

        "relative_humidity":
            relative_humidity,

        "rainfall":
            rainfall,

        "wind_speed":
            wind_speed,

        "solar_radiation":
            solar_radiation,

        "et0":
            et0,

        "climate_risk":
            climate_risk,

        "soil_ph":
            soil_ph,

        "organic_carbon":
            organic_carbon,

        "sand_percentage":
            sand_percentage,

        "silt_percentage":
            silt_percentage,

        "clay_percentage":
            clay_percentage,

        "cec":
            cec,

        "bulk_density":
            bulk_density,

        "field_capacity":
            field_capacity,

        "wilting_point":
            wilting_point,

        "available_water":
            available_water,

        "nitrogen":
            nitrogen,

        "soil_type":
            soil_type,

        "root_depth_m":
            root_depth_m,

        "predicted_irrigation":
            prediction

    }


    # =====================================================
    # 28. SAVE TO SUPABASE
    # =====================================================

    try:

        save_result = (
            save_irrigation_prediction(
                prediction_data
            )
        )


        print(
            "\nIrrigation prediction "
            "saved to Supabase."
        )


        print(
            "Supabase response:",
            save_result
        )


    except Exception as e:

        print(
            "\nWARNING: Could not save "
            "irrigation prediction."
        )

        print(
            "Supabase error:",
            e
        )

        # Database failure does not
        # stop the ML prediction.


    # =====================================================
    # 29. FINAL RESULT
    # =====================================================

    result = {

        "predicted_irrigation":
            prediction,

        "crop_water_requirement":
            water_requirement,

        "et0":
            et0,

        "kc":
            kc,

        "kc_band":
            str(kc_band),

        "root_depth_m":
            root_depth_m,

        "rainfall":
            rainfall,

        "soil_moisture":
            weather.get(
                "soil_moisture",
                None
            ),

        "climate_risk":
            climate_risk,

        "climate_risk_score":
            climate_risk_score,

        "location":
            location,

        "soil": {

            "soil_ph":
                soil_ph,

            "organic_carbon":
                organic_carbon,

            "sand_percentage":
                sand_percentage,

            "silt_percentage":
                silt_percentage,

            "clay_percentage":
                clay_percentage,

            "cec":
                cec,

            "bulk_density":
                bulk_density,

            "field_capacity":
                field_capacity,

            "wilting_point":
                wilting_point,

            "available_water":
                available_water,

            "nitrogen":
                nitrogen,

            "soil_type":
                soil_type

        }

    }


    # =====================================================
    # 30. DEBUG OUTPUT
    # =====================================================

    print(
        "\n" + "=" * 60
    )

    print(
        "IRRIGATION PREDICTION COMPLETE"
    )

    print(
        "Climate Risk:",
        climate_risk
    )

    print(
        "Climate Risk Score:",
        climate_risk_score
    )

    print(
        "Predicted Irrigation:",
        prediction,
        "mm/day"
    )

    print(
        "=" * 60
    )


    return result
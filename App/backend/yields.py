import joblib
import numpy as np
import pandas as pd

from App.backend.config import PICKLES_DIR
from App.backend.api.weather import get_future_weather
from App.backend.api.soil import get_soil
from App.backend.api.location import get_location

from App.backend.database.save_predictions import (
    save_yield_prediction
)


# ============================================================
# YIELD MODEL FILES
# ============================================================

YIELD_DIR = PICKLES_DIR / "yield"

MODEL_PATH = YIELD_DIR / "model.pkl"
ENCODER_PATH = YIELD_DIR / "encoder.pkl"
FEATURES_PATH = YIELD_DIR / "yield_features.pkl"
STATE_MAPPING_PATH = YIELD_DIR / "state_maping.pkl"


# ============================================================
# CHECK REQUIRED FILES
# ============================================================

required_files = [
    MODEL_PATH,
    ENCODER_PATH,
    FEATURES_PATH,
    STATE_MAPPING_PATH
]

for file_path in required_files:

    if not file_path.exists():

        raise FileNotFoundError(
            f"Required yield model file not found: "
            f"{file_path}"
        )


# ============================================================
# LAZY MODEL LOADING
# ============================================================

_YIELD_MODEL = None
_YIELD_ENCODER = None
_YIELD_FEATURES = None
_YIELD_STATE_MAPPING = None

def get_yield_model_artifacts():
    global _YIELD_MODEL, _YIELD_ENCODER, _YIELD_FEATURES, _YIELD_STATE_MAPPING
    if _YIELD_MODEL is None:
        _YIELD_MODEL = joblib.load(MODEL_PATH)
        _YIELD_ENCODER = joblib.load(ENCODER_PATH)
        _YIELD_FEATURES = joblib.load(FEATURES_PATH)
        _YIELD_STATE_MAPPING = joblib.load(STATE_MAPPING_PATH)
    return _YIELD_MODEL, _YIELD_ENCODER, _YIELD_FEATURES, _YIELD_STATE_MAPPING


# ============================================================
# Yield model configurations loaded successfully.



# ============================================================
# SOIL VALUE HELPER
# ============================================================

def get_soil_value(soil, *keys):

    """
    Safely retrieve a soil value using multiple
    possible key names.

    Example:

        get_soil_value(
            soil,
            "soil_ph",
            "Soil_pH"
        )
    """

    for key in keys:

        if key not in soil:
            continue

        value = soil[key]

        if value is None:
            continue

        try:

            return float(value)

        except (
            TypeError,
            ValueError
        ):

            continue

    raise ValueError(
        f"Could not find a valid soil value. "
        f"Checked keys: {keys}"
    )


# ============================================================
# MAIN YIELD PREDICTION FUNCTION
# ============================================================

def predict_yield(input_data):

    """
    Predict future crop yield.

    Expected input:

    {
        "state": "Andhra Pradesh",
        "district": "Visakhapatnam",
        "village": None,

        "crop": "Rice",
        "season": "Kharif",

        "area": 100,

        "start_date": "2026-08-10",
        "end_date": "2026-08-16",

        "year": 2026
    }

    Returns:

    {
        "predicted_yield": ...,
        "total_yield": ...,
        "arrival_quantity": ...,
        "location": ...,
        "weather": ...,
        "soil": ...
    """
    model, encoder, model_features, state_mapping = get_yield_model_artifacts()

    # ========================================================
    # 1. GET FARMER INPUT
    # ========================================================

    try:

        state = input_data["state"]

        district = input_data["district"]

        village = input_data.get(
            "village"
        )

        crop = input_data["crop"]

        season = input_data["season"]

        area = float(
            input_data["area"]
        )

        today_str = pd.Timestamp.today().strftime("%Y-%m-%d")
        start_date = input_data.get("start_date", today_str)
        end_date = input_data.get("end_date", start_date)
        year = int(input_data.get("year", pd.Timestamp.today().year))

    except KeyError as e:

        raise ValueError(
            f"Missing required yield input: {e}"
        )


    # ========================================================
    # 2. VALIDATE INPUT
    # ========================================================

    if area <= 0:

        raise ValueError(
            "Area must be greater than 0 hectares."
        )


    if year < 1900 or year > 2100:

        raise ValueError(
            f"Invalid year: {year}"
        )


    if not crop:

        raise ValueError(
            "Crop cannot be empty."
        )


    if not season:

        raise ValueError(
            "Season cannot be empty."
        )


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

            village=village
        )


    if not location:

        raise ValueError(
            "Could not retrieve location information."
        )


    try:

        latitude = float(
            location["latitude"]
        )

        longitude = float(
            location["longitude"]
        )

    except (
        KeyError,
        TypeError,
        ValueError
    ) as e:

        raise ValueError(
            f"Invalid location information: {e}"
        )


    print("\nLOCATION:")
    print(location)

    print(
        "\nLATITUDE:",
        latitude
    )

    print(
        "LONGITUDE:",
        longitude
    )


    # ========================================================
    # 4. GET FUTURE WEATHER
    # ========================================================

    weather = get_future_weather(

        latitude=latitude,

        longitude=longitude,

        start_date=start_date,

        end_date=end_date
    )


    if not weather:

        raise ValueError(
            "Could not retrieve future weather data."
        )


    print(
        "\nFUTURE WEATHER:"
    )

    print(
        weather
    )


    # ========================================================
    # 5. GET SOIL DATA
    # ========================================================

    soil = get_soil(

        latitude,

        longitude
    )


    if not soil:

        raise ValueError(
            "Could not retrieve soil data."
        )


    print(
        "\nSOIL DATA:"
    )

    print(
        soil
    )


    # ========================================================
    # 6. STATE ENCODING
    # ========================================================

    state_key = (
        str(state)
        .lower()
        .strip()
    )


    # Handle mappings where keys may not be lowercase

    if state_key not in state_mapping:

        normalized_mapping = {

            str(key)
            .lower()
            .strip(): value

            for key, value
            in state_mapping.items()

        }

        if state_key not in normalized_mapping:

            raise ValueError(

                f"Unknown state: {state}. "

                f"Available states: "
                f"{list(state_mapping.keys())}"

            )

        state_encoded = (
            normalized_mapping[state_key]
        )

    else:

        state_encoded = (
            state_mapping[state_key]
        )


    # ========================================================
    # 7. GET WEATHER VALUES
    # ========================================================

    required_weather_fields = [

        "mean_temperature",

        "max_temperature",

        "min_temperature",

        "precipitation",

        "shortwave_radiation",

        "wind_speed",

        "relative_humidity",

        "et0",

        "soil_moisture",

        "soil_temperature"

    ]


    missing_weather = [

        field

        for field in required_weather_fields

        if field not in weather
        or weather[field] is None

    ]


    if missing_weather:

        raise ValueError(

            "Missing weather values: "
            f"{missing_weather}"

        )


    try:

        mean_temperature = float(
            weather["mean_temperature"]
        )

        max_temperature = float(
            weather["max_temperature"]
        )

        min_temperature = float(
            weather["min_temperature"]
        )

        precipitation = float(
            weather["precipitation"]
        )

        shortwave_radiation = float(
            weather["shortwave_radiation"]
        )

        wind_speed = float(
            weather["wind_speed"]
        )

        relative_humidity = float(
            weather["relative_humidity"]
        )

        et0 = float(
            weather["et0"]
        )

        soil_moisture = float(
            weather["soil_moisture"]
        )

        soil_temperature = float(
            weather["soil_temperature"]
        )

    except (
        TypeError,
        ValueError
    ) as e:

        raise ValueError(
            f"Invalid weather value: {e}"
        )


    # ========================================================
    # 8. GET SOIL VALUES
    # ========================================================

    soil_ph = get_soil_value(
        soil,
        "soil_ph",
        "Soil_pH"
    )


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


    # ========================================================
    # 9. GET ELEVATION
    # ========================================================

    elevation = weather.get(
        "elevation",
        0
    )


    if elevation is None:

        elevation = 0


    elevation = float(
        elevation
    )


    print(
        "\nELEVATION:",
        elevation
    )


    # ========================================================
    # 10. CREATE BASE DATAFRAME
    # ========================================================

    input_df = pd.DataFrame([{

        "state":
            state_encoded,

        "latitude":
            latitude,

        "longitude":
            longitude,

        "year":
            year,

        "area":
            area,

        "mean_temperature":
            mean_temperature,

        "max_temperature":
            max_temperature,

        "min_temperature":
            min_temperature,

        "precipitation":
            precipitation,

        "shortwave_radiation":
            shortwave_radiation,

        "wind_speed":
            wind_speed,

        "relative_humidity":
            relative_humidity,

        "et0":
            et0,

        "soil_moisture":
            soil_moisture,

        "soil_temperature":
            soil_temperature,

        "soil_ph":
            soil_ph,

        "organic_carbon":
            organic_carbon,

        "clay":
            clay,

        "sand":
            sand,

        "silt":
            silt,

        "elevation":
            elevation,

        # The yield encoder was trained on lowercase strings;
        # normalise here so 'Rice'/'Kharif'/'Visakhapatnam' resolve correctly.
        "season":
            str(season).strip().lower(),

        "district":
            str(district).strip().lower(),

        "crop":
            str(crop).strip().lower()

    }])


    # ========================================================
    # 11. ENCODE CATEGORICAL FEATURES
    # ========================================================

    categorical_columns = [

        "season",

        "district",

        "crop"

    ]


    # Make sure the encoder supports these columns

    try:

        encoded = encoder.transform(

            input_df[
                categorical_columns
            ]

        )

    except Exception as e:

        raise ValueError(

            "Failed to encode yield "
            f"categorical features: {e}"

        )


    # ========================================================
    # 12. CREATE ENCODED DATAFRAME
    # ========================================================

    try:

        encoded_feature_names = (
            encoder
            .get_feature_names_out(
                categorical_columns
            )
        )

    except Exception as e:

        raise ValueError(

            "Could not retrieve encoded "
            f"feature names: {e}"

        )


    encoded_df = pd.DataFrame(

        encoded,

        columns=encoded_feature_names,

        index=input_df.index

    )


    # ========================================================
    # 13. REMOVE ORIGINAL CATEGORICAL COLUMNS
    # ========================================================

    input_df = input_df.drop(

        columns=categorical_columns

    )


    # ========================================================
    # 14. COMBINE FEATURES
    # ========================================================

    final_df = pd.concat(

        [

            input_df,

            encoded_df

        ],

        axis=1

    )


    # ========================================================
    # 15. GET TRAINED FEATURE LIST
    # ========================================================

    if hasattr(
        model,
        "feature_names_in_"
    ):

        trained_features = list(
            model.feature_names_in_
        )

    else:

        trained_features = list(
            model_features
        )


    print(
        "\nMODEL FEATURE COUNT:",
        len(trained_features)
    )


    print(
        "GENERATED FEATURE COUNT:",
        len(final_df.columns)
    )


    # ========================================================
    # 16. CHECK MISSING FEATURES
    # ========================================================

    missing_features = [

        feature

        for feature in trained_features

        if feature not in final_df.columns

    ]


    if missing_features:

        raise ValueError(

            "Missing model features: "
            f"{missing_features}"

        )


    # ========================================================
    # 17. CHECK EXTRA FEATURES
    # ========================================================

    extra_features = [

        feature

        for feature in final_df.columns

        if feature not in trained_features

    ]


    if extra_features:

        print(
            "\nWARNING: Extra features:"
        )

        print(
            extra_features
        )


        # Only keep features that the model expects

    final_df = final_df[
        trained_features
    ]


    # ========================================================
    # 18. CHECK NUMERIC DATA
    # ========================================================

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

            "Non-numeric columns found "
            "before prediction: "
            f"{non_numeric_columns}"

        )


    # ========================================================
    # 19. CHECK NaN
    # ========================================================

    if final_df.isnull().any().any():

        null_columns = (

            final_df.columns[
                final_df.isnull().any()
            ]
            .tolist()

        )


        raise ValueError(

            "NaN values found in model input: "
            f"{null_columns}"

        )


    # ========================================================
    # 20. CHECK INFINITE VALUES
    # ========================================================

    if not np.isfinite(
        final_df.to_numpy(
            dtype=float
        )
    ).all():

        raise ValueError(
            "Infinite or invalid numeric "
            "values found in model input."
        )


    # ========================================================
    # 21. DISPLAY FINAL MODEL INPUT
    # ========================================================

    print(
        "\nFINAL MODEL INPUT:"
    )

    print(
        final_df
    )


    print(
        "\nFINAL FEATURE COUNT:",
        len(final_df.columns)
    )


    # ========================================================
    # 22. PREDICTION
    # ========================================================

    try:

        prediction = model.predict(
            final_df
        )[0]

    except Exception as e:

        raise ValueError(

            "Yield model prediction failed: "
            f"{e}"

        )


    predicted_yield = round(
        float(prediction),
        2
    )


    # ========================================================
    # 23. CALCULATE TOTAL YIELD
    # ========================================================

    # predicted_yield = tons/hectare
    # area = hectares

    total_yield = round(

        predicted_yield * area,

        2

    )


    # ========================================================
    # 24. CONVERT TO QUINTALS
    # ========================================================

    # 1 ton = 10 quintals

    arrival_quantity = round(

        total_yield * 10,

        2

    )


    # ========================================================
    # 25. DISPLAY PREDICTION
    # ========================================================

    print(
        "\n" + "=" * 60
    )

    print(
        "YIELD PREDICTION"
    )

    print(
        "=" * 60
    )

    print(
        "Predicted Yield:",
        predicted_yield,
        "ton/hectare"
    )

    print(
        "Total Yield:",
        total_yield,
        "tons"
    )

    print(
        "Arrival Quantity:",
        arrival_quantity,
        "quintals"
    )

    print(
        "=" * 60
    )


    # ========================================================
    # 26. SAVE TO SUPABASE
    # ========================================================

    save_result = None

    try:

        save_data = {
            "state": input_data.get("state"),
            "district": input_data.get("district"),
            "village": input_data.get("village"),
            "latitude": location.get("latitude") if location else None,
            "longitude": location.get("longitude") if location else None,
            "crop": input_data.get("crop"),
            "season": input_data.get("season"),
            "year": input_data.get("year"),
            "area": input_data.get("area"),
            "mean_temperature": weather.get("mean_temperature") if weather else None,
            "max_temperature": weather.get("max_temperature") if weather else None,
            "min_temperature": weather.get("min_temperature") if weather else None,
            "precipitation": weather.get("precipitation") if weather else None,
            "shortwave_radiation": weather.get("shortwave_radiation") if weather else None,
            "wind_speed": weather.get("wind_speed") if weather else None,
            "relative_humidity": weather.get("relative_humidity") if weather else None,
            "et0": weather.get("et0") if weather else None,
            "soil_moisture": weather.get("soil_moisture") if weather else None,
            "soil_temperature": weather.get("soil_temperature") if weather else None,
            "soil_ph": soil.get("soil_ph") or soil.get("Soil_pH") if soil else None,
            "organic_carbon": soil.get("organic_carbon") or soil.get("Organic_Carbon") if soil else None,
            "clay": soil.get("clay") or soil.get("Clay") if soil else None,
            "sand": soil.get("sand") or soil.get("Sand") if soil else None,
            "silt": soil.get("silt") or soil.get("Silt") if soil else None,
            "elevation": weather.get("elevation") if weather else None,
            "predicted_yield": predicted_yield,
        }
        save_result = save_yield_prediction(save_data)


        print(
            "\nYield prediction saved to Supabase."
        )

        print(
            "Supabase response:"
        )

        print(
            save_result
        )


    except Exception as e:

        print(
            "\nWARNING: Could not save "
            "yield prediction to Supabase."
        )

        print(
            "Supabase error:",
            e
        )


    # ========================================================
    # 27. RETURN RESULT
    # ========================================================

    return {

        "predicted_yield":
            predicted_yield,

        "total_yield":
            total_yield,

        "arrival_quantity":
            arrival_quantity,

        "area":
            area,

        "crop":
            crop,

        "season":
            season,

        "year":
            year,

        "location": {

            "state":
                state,

            "district":
                district,

            "village":
                village,

            "latitude":
                latitude,

            "longitude":
                longitude

        },

        "weather": {

            "mean_temperature":
                mean_temperature,

            "max_temperature":
                max_temperature,

            "min_temperature":
                min_temperature,

            "precipitation":
                precipitation,

            "shortwave_radiation":
                shortwave_radiation,

            "wind_speed":
                wind_speed,

            "relative_humidity":
                relative_humidity,

            "et0":
                et0,

            "soil_moisture":
                soil_moisture,

            "soil_temperature":
                soil_temperature,

            "elevation":
                elevation

        },

        "soil": {

            "soil_ph":
                soil_ph,

            "organic_carbon":
                organic_carbon,

            "clay":
                clay,

            "sand":
                sand,

            "silt":
                silt

        },

        "supabase_save":
            save_result

    }
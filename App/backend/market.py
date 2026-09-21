import joblib
import pandas as pd

from App.backend.yields import predict_yield
from App.backend.config import PICKLES_DIR

from App.backend.database.save_predictions import (
    save_market_prediction
)


# =========================================================
# MARKET MODEL PATH
# =========================================================

MARKET_DIR = PICKLES_DIR / "market"

MODEL_PATH = MARKET_DIR / "model.pkl"

MAPPINGS_PATH = (
    MARKET_DIR / "Label_Mappings.pkl"
)


# =========================================================
# LAZY MODEL LOADING
# =========================================================

_MARKET_MODEL = None
_MARKET_MAPPINGS = None

def get_market_model_and_mappings():
    global _MARKET_MODEL, _MARKET_MAPPINGS
    if _MARKET_MODEL is None or _MARKET_MAPPINGS is None:
        _MARKET_MODEL = joblib.load(MODEL_PATH)
        _MARKET_MAPPINGS = joblib.load(MAPPINGS_PATH)
    return _MARKET_MODEL, _MARKET_MAPPINGS



# =========================================================
# MARKET PRICE PREDICTION
# =========================================================

def predict_market_price(
    state,
    district,
    commodity,
    area,
    season,
    start_date,
    end_date,
    year,
    village=None,
    market_date=None
):

    # =====================================================
    # 1. VALIDATE MARKET DATE
    # =====================================================

    if market_date is None:

        raise ValueError(
            "market_date is required for "
            "market price prediction."
        )


    # =====================================================
    # 2. VALIDATE YEAR
    # =====================================================

    try:

        year = int(year)

    except (
        TypeError,
        ValueError
    ):

        raise ValueError(
            f"Invalid year: {year}"
        )


    # =====================================================
    # 3. GET YIELD PREDICTION
    # =====================================================

    yield_input = {

        "state":
            state,

        "district":
            district,

        "village":
            village,

        "crop":
            commodity,

        "season":
            season,

        "area":
            area,

        "start_date":
            start_date,

        "end_date":
            end_date,

        "year":
            year

    }


    yield_result = predict_yield(
        yield_input
    )


    # =====================================================
    # 4. GET ARRIVAL QUANTITY
    # =====================================================

    if "arrival_quantity" not in yield_result:

        raise ValueError(
            "Yield prediction did not return "
            "'arrival_quantity'."
        )


    arrival_quantity = float(
        yield_result[
            "arrival_quantity"
        ]
    )


    predicted_yield = float(
        yield_result[
            "predicted_yield"
        ]
    )


    total_yield = float(
        yield_result[
            "total_yield"
        ]
    )


    print(
        "\n" + "=" * 40
    )

    print(
        "YIELD INFORMATION"
    )

    print(
        "=" * 40
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


    # =====================================================
    # 5. CONVERT MARKET DATE
    # =====================================================

    try:

        date = pd.to_datetime(
            market_date
        )

    except Exception as e:

        raise ValueError(
            f"Invalid market_date: "
            f"{market_date}"
        ) from e


    # =====================================================
    # 6. DATE FEATURES
    # =====================================================

    day = int(
        date.day
    )

    month = int(
        date.month
    )

    market_year = int(
        date.year
    )

    quarter = int(
        date.quarter
    )
    model, mappings = get_market_model_and_mappings()
    commodity_mapping = mappings["commodity_mapping"]
    state_mapping = mappings["state_mapping"]
    district_mapping = mappings["district_mapping"]

    # Case-insensitive mapping & fallbacks for state
    state_keys = {str(k).lower(): k for k in state_mapping.keys()}
    if str(state).lower() in state_keys:
        state = state_keys[str(state).lower()]
    else:
        state = list(state_mapping.keys())[0]

    # Case-insensitive mapping & fallbacks for district
    district_keys = {str(k).lower(): k for k in district_mapping.keys()}
    if str(district).lower() in district_keys:
        district = district_keys[str(district).lower()]
    else:
        matching = [k for k in district_mapping.keys() if str(district).lower() in k.lower() or k.lower() in str(district).lower()]
        district = matching[0] if matching else list(district_mapping.keys())[0]

    # Case-insensitive mapping & fallbacks for commodity
    commodity_keys = {str(k).lower(): k for k in commodity_mapping.keys()}
    if str(commodity).lower() in commodity_keys:
        commodity = commodity_keys[str(commodity).lower()]
    else:
        matching_c = [k for k in commodity_mapping.keys() if str(commodity).lower() in k.lower() or k.lower() in str(commodity).lower()]
        commodity = matching_c[0] if matching_c else "Rice"


    # =====================================================
    # 8. ENCODE INPUT
    # =====================================================

    state_encoded = (
        state_mapping[state]
    )

    district_encoded = (
        district_mapping[district]
    )

    commodity_encoded = (
        commodity_mapping[commodity]
    )


    # =====================================================
    # 9. CREATE MARKET MODEL INPUT
    # =====================================================

    input_df = pd.DataFrame([{

        "Commodity":
            commodity_encoded,

        "State":
            state_encoded,

        "District":
            district_encoded,

        "Day":
            day,

        "Month":
            month,

        "Year":
            market_year,

        "Quarter":
            quarter,

        "Arrival_Quantity":
            arrival_quantity

    }])


    print(
        "\n" + "=" * 40
    )

    print(
        "MARKET MODEL INPUT"
    )

    print(
        "=" * 40
    )

    print(
        input_df
    )


    # =====================================================
    # 10. MATCH EXACT MODEL FEATURES
    # =====================================================

    if hasattr(
        model,
        "feature_names_in_"
    ):

        model_features = list(
            model.feature_names_in_
        )


        # Check missing features

        missing_features = [

            feature

            for feature in model_features

            if feature not in input_df.columns

        ]


        if missing_features:

            raise ValueError(

                "Market model is expecting "
                f"missing features: "
                f"{missing_features}"

            )


        # Check extra features

        extra_features = [

            feature

            for feature in input_df.columns

            if feature not in model_features

        ]


        if extra_features:

            print(
                "Extra input features ignored:"
            )

            print(
                extra_features
            )


        # Force exact feature order

        input_df = input_df[
            model_features
        ]


    # =====================================================
    # 11. CHECK FOR NULL VALUES
    # =====================================================

    if input_df.isnull().any().any():

        null_columns = (
            input_df.columns[
                input_df.isnull().any()
            ].tolist()
        )

        raise ValueError(

            "Null values found in "
            f"market model input: "
            f"{null_columns}"

        )


    # =====================================================
    # 12. CHECK NUMERIC VALUES
    # =====================================================

    non_numeric_columns = (

        input_df
        .select_dtypes(
            exclude=["number"]
        )
        .columns
        .tolist()

    )


    if non_numeric_columns:

        raise ValueError(

            "Non-numeric columns found "
            "in market model input: "
            f"{non_numeric_columns}"

        )


    # =====================================================
    # 13. MARKET PRICE PREDICTION
    # =====================================================

    prediction = model.predict(
        input_df
    )[0]


    predicted_market_price = round(
        float(prediction),
        2
    )


    # =====================================================
    # 14. PRINT PREDICTION
    # =====================================================

    print(
        "\n" + "=" * 40
    )

    print(
        "MARKET PREDICTION"
    )

    print(
        "=" * 40
    )

    print(
        "Commodity:",
        commodity
    )

    print(
        "State:",
        state
    )

    print(
        "District:",
        district
    )

    print(
        "Market Date:",
        market_date
    )

    print(
        "Arrival Quantity:",
        arrival_quantity
    )

    print(
        "Predicted Market Price:",
        predicted_market_price
    )

    print(
        "=" * 40
    )


    # =====================================================
    # 15. PREPARE SUPABASE DATA
    # =====================================================

    # IMPORTANT:
    #
    # Save the original readable values.
    #
    # Do NOT save commodity_encoded,
    # state_encoded, or district_encoded.
    #
    # The database should contain:
    #
    # Rice
    # Andhra Pradesh
    # Visakhapatnam
    #
    # rather than:
    #
    # 12
    # 4
    # 37

    prediction_data = {

        "commodity":
            commodity,

        "state":
            state,

        "district":
            district,

        "day":
            day,

        "month":
            month,

        "year":
            market_year,

        "quarter":
            quarter,

        "arrival_quantity":
            arrival_quantity,

        "predicted_market_price":
            predicted_market_price

    }


    # =====================================================
    # 16. SAVE TO SUPABASE
    # =====================================================

    try:

        save_result = (
            save_market_prediction(
                prediction_data
            )
        )


        print(
            "\nMarket prediction "
            "saved to Supabase."
        )


        print(
            "Supabase response:"
        )


        print(
            save_result
        )


    except Exception as e:

        # Database failure should not
        # destroy the ML prediction.

        print(
            "\nWARNING: Could not save "
            "market prediction to Supabase."
        )

        print(
            "Supabase error:",
            e
        )


    # =====================================================
    # 17. RETURN RESULT
    # =====================================================

    total_tonnes = round(float(total_yield), 2)
    total_quintals = round(total_tonnes * 10, 2)
    bags_50kg = int(round(total_quintals * 2))
    yield_q_per_ha = round(float(predicted_yield) * 10, 2)
    yield_q_per_acre = round((float(predicted_yield) * 10) / 2.47105, 2)
    gross_revenue_inr = round(total_quintals * float(predicted_market_price), 2)

    return {

        "predicted_price":
            predicted_market_price,

        "predicted_market_price":
            predicted_market_price,

        "gross_revenue_inr":
            gross_revenue_inr,

        "predicted_yield":
            predicted_yield,

        "yield_q_per_ha":
            yield_q_per_ha,

        "yield_q_per_acre":
            yield_q_per_acre,

        "total_yield":
            total_yield,

        "total_tonnes":
            total_tonnes,

        "total_quintals":
            total_quintals,

        "bags_50kg":
            bags_50kg,

        "area_ha":
            area,

        "area_acre":
            round(float(area) * 2.47105, 2),

        "arrival_quantity":
            arrival_quantity,

        "commodity":
            commodity,

        "state":
            state,

        "district":
            district,

        "market_date":
            market_date,

        "day":
            day,

        "month":
            month,

        "year":
            market_year,

        "quarter":
            quarter

    }
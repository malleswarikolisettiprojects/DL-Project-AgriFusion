from .database import supabase


def save_prediction(
    state,
    district,
    season,
    recommended_crop,
    crop_confidence,
    climate_risk,
    irrigation_recommendation,
    predicted_yield,
    predicted_market_price,
    user_id=None
):
    """
    Save the complete prediction result
    into the `predictions` Supabase table.
    """

    data = {
        "state": state,
        "district": district,
        "season": season,
        "recommended_crop": recommended_crop,
        "crop_confidence": crop_confidence,
        "climate_risk": climate_risk,
        "irrigation_recommendation": str(irrigation_recommendation),
        "predicted_yield": predicted_yield,
        "predicted_market_price": predicted_market_price,
    }

    # user_id is optional
    if user_id:
        data["user_id"] = user_id

    response = (
        supabase
        .table("predictions")
        .insert(data)
        .execute()
    )

    return response
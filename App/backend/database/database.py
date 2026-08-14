from supabase import create_client, Client

from App.backend.database.config import (SUPABASE_URL,SUPABASE_KEY)


# ---------------------------------------------------------
# Supabase client
# ---------------------------------------------------------

supabase: Client = create_client(SUPABASE_URL,SUPABASE_KEY)


# ---------------------------------------------------------
# Save prediction
# ---------------------------------------------------------

def save_prediction(prediction_type: str,input_data: dict,prediction):

    data = {
        "prediction_type": prediction_type,
        "input_data": input_data,
        "prediction": str(prediction)
    }

    response = (
        supabase
        .table("predictions")
        .insert(data)
        .execute()
    )

    return response
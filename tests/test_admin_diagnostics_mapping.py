"""
AgriFusion — Admin Diagnostics Mapping Regression Tests
========================================================
Tests value mapping from predict_disease_and_pests inference contract to database
persistence (save_disease_prediction) and admin query (get_all_diagnostics_for_admin).
"""

import pytest
from unittest.mock import patch, MagicMock
from App.backend.database.save_predictions import save_disease_prediction
from App.backend.database.farmer_db import get_all_diagnostics_for_admin


@pytest.fixture
def realistic_inference_result():
    return {
        "id": "pred-uuid-12345",
        "crop": "Rice",
        "primary_diagnosis": "Rice Blast",
        "top_confidence": 0.9421,
        "is_low_confidence": False,
        "selected_crop_result": {
            "provider": "Roboflow",
            "model": "rice-disease-v1",
            "detection": {
                "label": "Rice Blast",
                "confidence": 0.9421,
                "box": [10, 20, 100, 200]
            }
        },
        "selected_pest_result": {
            "provider": "Roboflow",
            "model": "pest-v1",
            "detection": {
                "label": "Rice Stem Borer",
                "confidence": 0.785,
                "box": [30, 40, 80, 90]
            }
        },
        "selected_nutrient_result": None,
        "other_possible_detections": [
            {
                "label": "Bacterial Leaf Blight",
                "confidence": 0.32,
                "provider": "Roboflow",
                "model": "rice-disease-v1"
            }
        ],
        "image_url": "https://storage.supabase.co/test.jpg",
        "notice": None
    }


def test_save_disease_prediction_mapping(realistic_inference_result):
    """Verify that save_disease_prediction extracts real primary_diagnosis, confidence, and all_detections."""
    mock_admin_client = MagicMock()
    mock_table = MagicMock()
    mock_admin_client.table.return_value = mock_table
    mock_table.insert.return_value.execute.return_value = MagicMock(data=[{"id": "db-row-1"}])

    res_data = realistic_inference_result
    payload = {
        "user_id": None,
        "user_email": "farmer@example.com",
        "crop": res_data["crop"],
        "primary_diagnosis": res_data["primary_diagnosis"],
        "top_confidence": res_data["top_confidence"],
        "top_disease": res_data["selected_crop_result"]["detection"]["label"],
        "top_disease_confidence": res_data["selected_crop_result"]["detection"]["confidence"],
        "top_pest": res_data["selected_pest_result"]["detection"]["label"],
        "top_pest_confidence": res_data["selected_pest_result"]["detection"]["confidence"],
        "top_nutrient": None,
        "top_nutrient_confidence": None,
        "annotated_image_url": res_data["image_url"],
        "all_detections": [
            {"label": "Rice Blast", "confidence": 0.9421, "category": "disease", "source": "Roboflow"},
            {"label": "Rice Stem Borer", "confidence": 0.785, "category": "pest", "source": "Roboflow"},
            {"label": "Bacterial Leaf Blight", "confidence": 0.32, "category": "secondary", "source": "Roboflow"}
        ],
        "custom_crop_notice": None,
        "status": "success",
        "latency_ms": 150.0
    }

    with patch("App.backend.database.save_predictions._get_admin_client", return_value=mock_admin_client):
        result = save_disease_prediction(payload)

    assert result["telemetry_saved"] is True
    # Check that disease_prediction table insert received correct primary_diagnosis and confidence
    insert_call_args = mock_table.insert.call_args[0][0]
    assert insert_call_args["primary_diagnosis"] == "Rice Blast"
    assert insert_call_args["confidence"] == 0.9421
    assert insert_call_args["crop"] == "Rice"
    assert len(insert_call_args["all_detections"]) == 3


def test_get_all_diagnostics_for_admin_contract():
    """Verify get_all_diagnostics_for_admin maps primary_diagnosis, nullable confidence, and secondary_matches accurately."""
    db_rows = [
        {
            "id": "row-uuid-1",
            "created_at": "2026-09-25T14:00:00Z",
            "crop": "Rice",
            "primary_diagnosis": "Rice Blast",
            "confidence": 0.9421,
            "top_disease": "Rice Blast",
            "top_disease_confidence": 0.9421,
            "top_pest": "Rice Stem Borer",
            "top_pest_confidence": 0.785,
            "all_detections": [
                {"label": "Rice Blast", "confidence": 0.9421, "category": "disease", "source": "Roboflow"},
                {"label": "Rice Stem Borer", "confidence": 0.785, "category": "pest", "source": "Roboflow"},
                {"label": "Bacterial Leaf Blight", "confidence": 0.32, "category": "secondary", "source": "Roboflow"}
            ],
            "state": "Andhra Pradesh",
            "district": "Visakhapatnam",
            "status": "success"
        }
    ]

    mock_cnt_query = MagicMock()
    mock_cnt_query.execute.return_value = MagicMock(count=1)

    mock_select_query = MagicMock()
    mock_select_query.order.return_value.range.return_value.execute.return_value = MagicMock(data=db_rows)

    mock_stats_query = MagicMock()
    mock_stats_query.execute.return_value = MagicMock(data=db_rows)

    def table_side_effect(table_name):
        mock_t = MagicMock()
        mock_t.select.side_effect = lambda *args, **kwargs: (
            mock_cnt_query if kwargs.get("count") == "exact" and len(args) == 1 and args[0] == "id"
            else mock_select_query if kwargs.get("count") == "exact"
            else mock_stats_query
        )
        return mock_t

    mock_admin_supabase = MagicMock()
    mock_admin_supabase.table.side_effect = table_side_effect

    with patch("App.backend.settings.SUPABASE_URL", "https://test.supabase.co"), \
         patch("App.backend.database.farmer_db._get_admin_supabase", return_value=mock_admin_supabase):
        data = get_all_diagnostics_for_admin(page=1, page_size=25)

    assert data["total"] == 1
    items = data["items"]
    assert len(items) == 1
    item = items[0]
    assert item["primary_diagnosis"] == "Rice Blast"
    assert item["confidence"] == 0.9421
    assert item["crop"] == "Rice"
    assert len(item["secondary_matches"]) == 2
    sec1 = item["secondary_matches"][0]
    assert sec1["label"] == "Rice Stem Borer"
    assert sec1["confidence"] == 0.785
    assert sec1["category"] == "pest"


def test_api_predict_disease_route_mapping(realistic_inference_result):
    """Verify POST /api/v1/predict/disease correctly maps predict_disease_and_pests() return values into save_disease_prediction."""
    from App.backend.server import api_predict_disease
    import asyncio

    mock_image = MagicMock()
    mock_image.filename = "rice_leaf.jpg"
    mock_image.content_type = "image/jpeg"
    mock_image.read = MagicMock(side_effect=lambda: asyncio.sleep(0.001) or b"fake_bytes")

    with patch("App.backend.server.predict_disease_and_pests", return_value=realistic_inference_result), \
         patch("App.backend.server.save_disease_prediction") as mock_save:
        
        mock_save.return_value = {"telemetry_saved": True, "event_id": "evt-123"}
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            response = loop.run_until_complete(
                api_predict_disease(crop="Rice", image=mock_image, current_user=None)
            )
        finally:
            loop.close()

    assert response["success"] is True
    assert response["result"]["primary_diagnosis"] == "Rice Blast"
    assert response["result"]["top_confidence"] == 0.9421

    mock_save.assert_called_once()
    saved_data = mock_save.call_args[0][0]

    assert saved_data["primary_diagnosis"] == "Rice Blast"
    assert saved_data["top_confidence"] == 0.9421
    assert saved_data["crop"] == "Rice"
    assert saved_data["top_disease"] == "Rice Blast"
    assert saved_data["top_disease_confidence"] == 0.9421
    assert saved_data["top_pest"] == "Rice Stem Borer"
    assert saved_data["top_pest_confidence"] == 0.785

    all_det = saved_data["all_detections"]
    assert len(all_det) == 3
    assert all_det[0] == {"label": "Rice Blast", "confidence": 0.9421, "category": "disease", "source": "Roboflow"}
    assert all_det[1] == {"label": "Rice Stem Borer", "confidence": 0.785, "category": "pest", "source": "Roboflow"}
    assert all_det[2] == {"label": "Bacterial Leaf Blight", "confidence": 0.32, "category": "secondary", "source": "Roboflow"}


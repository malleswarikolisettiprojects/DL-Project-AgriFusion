import io
import pytest
from PIL import Image
from unittest.mock import patch, MagicMock

from App.backend.disease_detection import predict_disease_and_pests

def create_test_image_bytes() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color="green")
    img.save(buf, format="JPEG")
    return buf.getvalue()

def test_explicit_healthy_prediction():
    """1. Test explicit healthy class prediction by model."""
    raw = create_test_image_bytes()
    mock_run = {
        "provider": "roboflow",
        "model": "rice-leaf-disease/1",
        "status": "ok",
        "detections": [
            {"label": "Rice___healthy", "confidence": 0.92, "box_xyxy": [10, 10, 50, 50]}
        ],
        "top_confidence": 0.92
    }

    with patch("App.backend.disease_detection.run_provider", return_value=mock_run):
        res = predict_disease_and_pests(crop="rice", raw=raw)

        assert res["inference_outcome"] == "detected"
        assert res["primary_diagnosis"] == "Rice___healthy"
        assert res["top_confidence"] == 0.92
        assert res["is_low_confidence"] is False
        assert res["rag_remedies"] is None  # No chemical remedies generated for healthy crop
        assert "healthy" in res["notice"].lower()

def test_disease_detection():
    """2. Test valid disease class detection above threshold."""
    raw = create_test_image_bytes()
    mock_run = {
        "provider": "roboflow",
        "model": "rice-leaf-disease/1",
        "status": "ok",
        "detections": [
            {"label": "Rice_Bacterial_blight", "confidence": 0.88, "box_xyxy": [5, 5, 45, 45]}
        ],
        "top_confidence": 0.88
    }

    with patch("App.backend.disease_detection.run_provider", return_value=mock_run):
        with patch("App.backend.disease_detection.generate_rag_remedies", return_value={"chemical": "Apply copper spray"}):
            res = predict_disease_and_pests(crop="rice", raw=raw)

            assert res["inference_outcome"] == "detected"
            assert res["primary_diagnosis"] == "Rice_Bacterial_blight"
            assert res["top_confidence"] == 0.88
            assert res["is_low_confidence"] is False
            assert res["rag_remedies"] == {"chemical": "Apply copper spray"}

def test_below_threshold_candidate():
    """3. Test candidate detection below minimum threshold (low_confidence)."""
    raw = create_test_image_bytes()
    mock_run = {
        "provider": "roboflow",
        "model": "rice-leaf-disease/1",
        "status": "ok",
        "detections": [
            {"label": "Rice_Leaf_Spot", "confidence": 0.18, "box_xyxy": [5, 5, 20, 20]}
        ],
        "top_confidence": 0.18
    }

    with patch("App.backend.disease_detection.run_provider", return_value=mock_run):
        res = predict_disease_and_pests(crop="rice", raw=raw)

        assert res["inference_outcome"] == "low_confidence"
        # MUST NOT fabricate "Healthy Crop Leaf — 0.0%"!
        assert res["primary_diagnosis"] is None
        assert res["top_confidence"] == 0.18
        assert res["is_low_confidence"] is True
        assert res["rag_remedies"] is None
        assert "below" in res["notice"] and "threshold" in res["notice"]

def test_zero_detections():
    """4. Test providers responding successfully with zero detections (no_detection)."""
    raw = create_test_image_bytes()
    mock_run = {
        "provider": "roboflow",
        "model": "rice-leaf-disease/1",
        "status": "ok",
        "detections": [],
        "top_confidence": 0.0
    }

    with patch("App.backend.disease_detection.run_provider", return_value=mock_run):
        res = predict_disease_and_pests(crop="rice", raw=raw)

        assert res["inference_outcome"] == "no_detection"
        # MUST NOT default to "Healthy Crop Leaf"!
        assert res["primary_diagnosis"] is None
        assert res["top_confidence"] is None
        assert res["is_low_confidence"] is True
        assert res["rag_remedies"] is None
        assert "No disease or pest symptoms were detected" in res["notice"]

def test_all_providers_failing():
    """5. Test all model providers failing or erroring out (provider_error)."""
    raw = create_test_image_bytes()
    mock_run = {
        "provider": "roboflow",
        "model": "rice-leaf-disease/1",
        "status": "error",
        "error": "API key invalid or provider service unavailable",
        "detections": [],
        "top_confidence": 0.0
    }

    with patch("App.backend.disease_detection.run_provider", return_value=mock_run):
        res = predict_disease_and_pests(crop="rice", raw=raw)

        assert res["inference_outcome"] == "provider_error"
        assert res["primary_diagnosis"] is None
        assert res["top_confidence"] is None
        assert res["is_low_confidence"] is True
        assert res["rag_remedies"] is None
        assert "currently unavailable" in res["notice"]

def test_provider_timeout():
    """6. Test model providers timing out."""
    raw = create_test_image_bytes()
    mock_run = {
        "provider": "huggingface",
        "model": "insect-detection",
        "status": "timeout",
        "error": "Provider timed out",
        "detections": [],
        "top_confidence": 0.0
    }

    with patch("App.backend.disease_detection.run_provider", return_value=mock_run):
        res = predict_disease_and_pests(crop="rice", raw=raw)

        assert res["inference_outcome"] == "provider_error"
        assert res["primary_diagnosis"] is None
        assert res["top_confidence"] is None
        assert res["execution_status"] == "error"

def test_admin_telemetry_safety_and_no_pii():
    """7. Test admin telemetry summary format and safety against raw image or token leakage."""
    raw = create_test_image_bytes()
    mock_run = {
        "provider": "roboflow",
        "model": "beans-diseases/1",
        "status": "ok",
        "detections": [],
        "top_confidence": 0.0
    }

    with patch("App.backend.disease_detection.run_provider", return_value=mock_run):
        res = predict_disease_and_pests(crop="beans", raw=raw)

        assert "providers_summary" in res
        summary = res["providers_summary"]
        assert "total_configured" in summary
        assert "succeeded" in summary
        assert "failed" in summary
        assert "timed_out" in summary
        assert "skipped" in summary
        assert "applied_threshold" in summary

        # Verify output safety (no secret tokens or raw image bytes)
        output_str = str(res)
        assert "ROBOFLOW_API_KEY" not in output_str
        assert "HF_TOKEN" not in output_str

def test_execution_status_vs_human_review_status():
    """8. Test execution status (inference pipeline) vs human review status."""
    raw = create_test_image_bytes()
    mock_run = {
        "provider": "roboflow",
        "model": "beans-diseases/1",
        "status": "ok",
        "detections": [
            {"label": "Bean_Rust", "confidence": 0.85, "box_xyxy": [0, 0, 10, 10]}
        ],
        "top_confidence": 0.85
    }

    with patch("App.backend.disease_detection.run_provider", return_value=mock_run):
        with patch("App.backend.disease_detection.generate_rag_remedies", return_value=None):
            res = predict_disease_and_pests(crop="beans", raw=raw)

            # Pipeline execution succeeded
            assert res["execution_status"] == "success"
            # Human review status MUST remain pending_review (not automatically 'reviewed')
            assert res["review_status"] == "pending_review"

def test_zero_configured_providers():
    """9. Test zero configured providers yields provider_error (not no_detection)."""
    raw = create_test_image_bytes()
    with patch("App.backend.disease_detection.CROP_MODELS", {}):
        with patch("App.backend.disease_detection.SHARED_MODELS", {"pest": [], "nutrient": []}):
            res = predict_disease_and_pests(crop="unknown_crop_without_models", raw=raw)

            assert res["inference_outcome"] == "provider_error"
            assert res["execution_status"] == "error"
            assert res["primary_diagnosis"] is None
            assert "No visual inference models are configured" in res["notice"]

def test_inference_stored_row_admin_response_agreement():
    """10. Test agreement: inference response, stored row, and admin GET response return identical values."""
    from App.backend.database.save_predictions import save_disease_prediction
    from App.backend.database.farmer_db import get_all_diagnostics_for_admin

    raw = create_test_image_bytes()
    mock_run = {
        "provider": "roboflow",
        "model": "rice-leaf-disease/1",
        "status": "ok",
        "detections": [],
        "top_confidence": 0.0
    }

    with patch("App.backend.disease_detection.run_provider", return_value=mock_run):
        res = predict_disease_and_pests(crop="rice", raw=raw)

    assert res["inference_outcome"] == "no_detection"
    assert res["execution_status"] == "success"

    # Simulate saving to DB
    saved_payload = {
        "crop": res["crop"],
        "primary_diagnosis": res["primary_diagnosis"],
        "top_confidence": res["top_confidence"],
        "inference_outcome": res["inference_outcome"],
        "execution_status": res["execution_status"],
        "providers_summary": res["providers_summary"],
        "candidate_summary": res["candidate_summary"],
        "request_id": "test-req-123",
        "actor_ref": "test-user-456",
        "status": "pending_review",
    }

    mock_insert_chain = MagicMock()
    mock_insert_chain.execute.return_value = MagicMock(data=[saved_payload])
    mock_admin_sb = MagicMock()
    mock_admin_sb.table.return_value.insert.return_value = mock_insert_chain

    with patch("App.backend.database.save_predictions._get_admin_client", return_value=mock_admin_sb):
        save_res = save_disease_prediction(saved_payload)
        assert save_res.get("telemetry_saved") is True

    # Simulate admin endpoint reading back the saved record
    db_row = {
        "id": "pred-uuid-789",
        "created_at": "2026-09-26T14:00:00Z",
        "crop": "rice",
        "state": "Telangana",
        "district": "Warangal",
        "status": "pending_review",
        "severity": None,
        "primary_diagnosis": None,
        "confidence": None,
        "top_disease": None,
        "top_disease_confidence": None,
        "all_detections": [],
        "inference_outcome": "no_detection",
        "execution_status": "success",
        "providers_summary": res["providers_summary"],
        "candidate_summary": res["candidate_summary"],
        "request_id": "test-req-123",
        "actor_ref": "test-user-456",
    }

    mock_count_obj = MagicMock()
    mock_count_obj.count = 1
    mock_count_obj.execute.return_value = mock_count_obj

    mock_items_obj = MagicMock()
    mock_items_obj.data = [db_row]

    mock_query_chain = MagicMock()
    mock_query_chain.select.return_value = mock_query_chain
    mock_query_chain.order.return_value = mock_query_chain
    mock_query_chain.range.return_value = mock_query_chain
    mock_query_chain.execute.side_effect = [mock_count_obj, mock_items_obj]

    mock_admin_sb_read = MagicMock()
    mock_admin_sb_read.table.return_value = mock_query_chain

    with patch("App.backend.database.farmer_db._get_admin_supabase", return_value=mock_admin_sb_read):
        diag_res = get_all_diagnostics_for_admin(page=1, page_size=10)
        total = diag_res["total"]
        items = diag_res["items"]

    assert total == 1
    admin_item = items[0]

    # Verify 100% agreement across inference output, stored DB record, and admin diagnostics mapping
    assert res["inference_outcome"] == db_row["inference_outcome"] == admin_item["inference_outcome"] == "no_detection"
    assert res["execution_status"] == db_row["execution_status"] == admin_item["execution_status"] == "success"
    assert res["primary_diagnosis"] == db_row["primary_diagnosis"] == admin_item["primary_diagnosis"] is None
    assert admin_item["request_id"] == "test-req-123"
    assert admin_item["actor_ref"] == "test-user-456"


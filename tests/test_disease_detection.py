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
        assert "below minimum threshold" in res["notice"]

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

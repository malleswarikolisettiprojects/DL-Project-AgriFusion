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
        assert res["low_confidence_notice"] is not None
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
        assert res["is_low_confidence"] is False
        assert res["primary_diagnosis"] is None
        assert res["top_confidence"] is None
        assert res["low_confidence_notice"] is None
        assert res["rag_remedies"] is None
        assert "No disease or pest symptoms were detected" in res["notice"]
        # MUST NOT claim a candidate failed threshold!
        assert "threshold" not in res["notice"].lower()

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
        assert res["is_low_confidence"] is False
        assert res["low_confidence_notice"] is None
        assert res["rag_remedies"] is None
        assert "unavailable" in res["notice"]

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
        assert res["is_low_confidence"] is False
        assert res["low_confidence_notice"] is None
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


def test_missing_credentials_handling():
    """11. Test missing credentials resulting in status='skipped' and failure_class='missing_or_invalid_credential'."""
    from App.backend.disease_detection import run_roboflow, run_huggingface

    raw = create_test_image_bytes()
    with patch("App.backend.disease_detection.ROBOFLOW_API_KEY", None):
        res_rf = run_roboflow({"model_id": "test/1"}, raw, "image/jpeg")
        assert res_rf["status"] == "skipped"
        assert res_rf["failure_class"] == "missing_or_invalid_credential"
        assert res_rf["http_status"] is None

    with patch("App.backend.disease_detection.HF_TOKEN", None):
        res_hf = run_huggingface({"model_id": "test/model"}, raw, "image/jpeg")
        assert res_hf["status"] == "skipped"
        assert res_hf["failure_class"] == "missing_or_invalid_credential"
        assert res_hf["http_status"] is None


def test_provider_http_error_classes():
    """12. Test provider HTTP error classifications: 401, 404, and 503."""
    from App.backend.disease_detection import run_roboflow, run_huggingface
    import httpx

    raw = create_test_image_bytes()
    cfg_rf = {"model_id": "test-rf/1"}
    cfg_hf = {"model_id": "test-hf/model"}

    # 401 Unauthorized
    mock_resp_401 = MagicMock()
    mock_resp_401.status_code = 401
    with patch("App.backend.disease_detection.ROBOFLOW_API_KEY", "dummy_key"):
        with patch("httpx.post", return_value=mock_resp_401):
            rf_401 = run_roboflow(cfg_rf, raw, "image/jpeg")
            assert rf_401["status"] == "error"
            assert rf_401["http_status"] == 401
            assert rf_401["failure_class"] == "missing_or_invalid_credential"

    # 404 Not Found
    mock_resp_404 = MagicMock()
    mock_resp_404.status_code = 404
    with patch("App.backend.disease_detection.HF_TOKEN", "dummy_token"):
        with patch("httpx.post", return_value=mock_resp_404):
            hf_404 = run_huggingface(cfg_hf, raw, "image/jpeg")
            assert hf_404["status"] == "error"
            assert hf_404["http_status"] == 404
            assert hf_404["failure_class"] == "invalid_model_id"

    # 503 Service Unavailable
    mock_resp_503 = MagicMock()
    mock_resp_503.status_code = 503
    with patch("App.backend.disease_detection.ROBOFLOW_API_KEY", "dummy_key"):
        with patch("httpx.post", return_value=mock_resp_503):
            rf_503 = run_roboflow(cfg_rf, raw, "image/jpeg")
            assert rf_503["status"] == "error"
            assert rf_503["http_status"] == 503
            assert rf_503["failure_class"] == "provider_unavailable"


def test_provider_timeout_class():
    """13. Test provider timeout handling mapping to failure_class='timeout'."""
    from App.backend.disease_detection import run_roboflow, run_huggingface
    import httpx

    raw = create_test_image_bytes()
    cfg_rf = {"model_id": "test-rf/1"}

    with patch("App.backend.disease_detection.ROBOFLOW_API_KEY", "dummy_key"):
        with patch("httpx.post", side_effect=httpx.TimeoutException("Timeout")):
            res = run_roboflow(cfg_rf, raw, "image/jpeg")
            assert res["status"] == "timeout"
            assert res["failure_class"] == "timeout"
            assert res["http_status"] is None


def test_one_provider_success_detected():
    """14. Test case where 1 provider succeeds with qualifying candidate while others fail."""
    raw = create_test_image_bytes()

    def mock_run_prov(cfg, img, raw_b, ct):
        if cfg.get("name") == "pests-wropv":
            return {
                "provider": "roboflow",
                "model": "pests-wropv/3",
                "status": "ok",
                "http_status": 200,
                "failure_class": None,
                "latency_ms": 150.0,
                "detections": [{"label": "Rice_Bacterial_blight", "confidence": 0.85, "box_xyxy": [0,0,10,10]}],
                "top_confidence": 0.85,
            }
        return {
            "provider": cfg.get("provider", "roboflow"),
            "model": cfg.get("model_id", cfg.get("name", "")),
            "status": "error",
            "http_status": 401,
            "failure_class": "missing_or_invalid_credential",
            "latency_ms": 100.0,
            "detections": [],
            "top_confidence": 0.0,
        }

    with patch("App.backend.disease_detection.run_provider", side_effect=mock_run_prov):
        with patch("App.backend.disease_detection.generate_rag_remedies", return_value=None):
            res = predict_disease_and_pests(crop="rice", raw=raw)

            assert res["inference_outcome"] == "detected"
            assert res["primary_diagnosis"] == "Rice_Bacterial_blight"
            assert res["execution_status"] == "success"
            assert res["providers_summary"]["succeeded"] == 1
            assert res["providers_summary"]["failed"] == len(res["providers_summary"]["details"]) - 1


def test_one_provider_success_zero_candidates():
    """15. Test case where 1 provider succeeds but finds 0 candidate detections (no_detection)."""
    raw = create_test_image_bytes()

    def mock_run_prov(cfg, img, raw_b, ct):
        if cfg.get("name") == "pests-wropv":
            return {
                "provider": "roboflow",
                "model": "pests-wropv/3",
                "status": "ok",
                "http_status": 200,
                "failure_class": None,
                "latency_ms": 150.0,
                "detections": [],
                "top_confidence": 0.0,
            }
        return {
            "provider": cfg.get("provider", "huggingface"),
            "model": cfg.get("model_id", cfg.get("name", "")),
            "status": "error",
            "http_status": 401,
            "failure_class": "missing_or_invalid_credential",
            "latency_ms": 100.0,
            "detections": [],
            "top_confidence": 0.0,
        }

    with patch("App.backend.disease_detection.run_provider", side_effect=mock_run_prov):
        res = predict_disease_and_pests(crop="rice", raw=raw)

        assert res["inference_outcome"] == "no_detection"
        assert res["primary_diagnosis"] is None
        assert res["execution_status"] == "success"
        assert res["providers_summary"]["succeeded"] == 1


def test_sanitized_per_provider_details_structure():
    """16. Test that providers_summary['details'] includes clean per-provider entries with no secret leakage."""
    raw = create_test_image_bytes()
    mock_run = {
        "provider": "roboflow",
        "model": "rice-leaf-disease/1",
        "status": "ok",
        "http_status": 200,
        "failure_class": None,
        "latency_ms": 123.45,
        "detections": [],
        "top_confidence": 0.0
    }

    with patch("App.backend.disease_detection.run_provider", return_value=mock_run):
        res = predict_disease_and_pests(crop="rice", raw=raw)

        assert "details" in res["providers_summary"]
        details = res["providers_summary"]["details"]
        assert len(details) > 0

        for entry in details:
            assert "provider" in entry
            assert "model" in entry
            assert "status" in entry
            assert "http_status" in entry
            assert "failure_class" in entry
            assert "latency_ms" in entry
            assert "detections_count" in entry
            assert "top_confidence" in entry

        # Verify no secret tokens or image payloads leaked in output
        dump_str = str(res)
        assert "ROBOFLOW_API_KEY" not in dump_str
        assert "HF_TOKEN" not in dump_str
        assert "Authorization" not in dump_str


def test_crop_specific_timeouts_with_shared_provider_success():
    """17. Test crop disease model timeouts when shared pest provider succeeds with zero detections. Must NOT return no_detection."""
    raw = create_test_image_bytes()

    def mock_run_prov(cfg, img, raw_b, ct):
        name = cfg.get("name", "")
        if name == "pests-rt37d":  # Shared pest model
            return {
                "provider": "roboflow",
                "model": "pests-rt37d/1",
                "status": "ok",
                "http_status": 200,
                "failure_class": None,
                "latency_ms": 150.0,
                "detections": [],
                "top_confidence": 0.0,
            }
        # Crop-specific disease models time out
        return {
            "provider": cfg.get("provider", "roboflow"),
            "model": cfg.get("model_id", cfg.get("name", "")),
            "status": "timeout",
            "http_status": None,
            "failure_class": "timeout",
            "latency_ms": 5000.0,
            "detections": [],
            "top_confidence": 0.0,
        }

    with patch("App.backend.disease_detection.run_provider", side_effect=mock_run_prov):
        res = predict_disease_and_pests(crop="rice", raw=raw)

        # MUST NOT return no_detection when crop disease models timed out!
        assert res["inference_outcome"] == "provider_error"
        assert res["execution_status"] == "partial"
        assert "could not be completed" in res["notice"]
        cats = res["providers_summary"]["categories"]
        assert cats["disease"]["succeeded"] == 0
        assert cats["disease"]["timed_out"] > 0
        assert cats["pest"]["succeeded"] > 0


def test_crop_specific_success_with_zero_detections():
    """18. Test crop disease model succeeding with zero detections yields no_detection."""
    raw = create_test_image_bytes()

    def mock_run_prov(cfg, img, raw_b, ct):
        name = cfg.get("name", "")
        if name == "rice-leaf-disease-s1asn":
            return {
                "provider": "roboflow",
                "model": "rice-leaf-disease-s1asn/2",
                "status": "ok",
                "http_status": 200,
                "failure_class": None,
                "latency_ms": 200.0,
                "detections": [],
                "top_confidence": 0.0,
            }
        return {
            "provider": cfg.get("provider", "roboflow"),
            "model": cfg.get("model_id", cfg.get("name", "")),
            "status": "error",
            "http_status": 503,
            "failure_class": "provider_unavailable",
            "latency_ms": 100.0,
            "detections": [],
            "top_confidence": 0.0,
        }

    with patch("App.backend.disease_detection.run_provider", side_effect=mock_run_prov):
        res = predict_disease_and_pests(crop="rice", raw=raw)

        assert res["inference_outcome"] == "no_detection"
        assert res["execution_status"] == "success"
        cats = res["providers_summary"]["categories"]
        assert cats["disease"]["succeeded"] == 1


def test_disease_success_plus_shared_provider_failure():
    """19. Test crop disease model succeeding with a candidate detection while shared provider fails."""
    raw = create_test_image_bytes()

    def mock_run_prov(cfg, img, raw_b, ct):
        name = cfg.get("name", "")
        if name == "rice-leaf-disease-s1asn":
            return {
                "provider": "roboflow",
                "model": "rice-leaf-disease-s1asn/2",
                "status": "ok",
                "http_status": 200,
                "failure_class": None,
                "latency_ms": 180.0,
                "detections": [{"label": "Rice_Bacterial_blight", "confidence": 0.88, "box_xyxy": [0, 0, 10, 10]}],
                "top_confidence": 0.88,
            }
        return {
            "provider": cfg.get("provider", "huggingface"),
            "model": cfg.get("model_id", cfg.get("name", "")),
            "status": "error",
            "http_status": 400,
            "failure_class": "http_error",
            "latency_ms": 120.0,
            "detections": [],
            "top_confidence": 0.0,
        }

    with patch("App.backend.disease_detection.run_provider", side_effect=mock_run_prov):
        with patch("App.backend.disease_detection.generate_rag_remedies", return_value=None):
            res = predict_disease_and_pests(crop="rice", raw=raw)

            assert res["inference_outcome"] == "detected"
            assert res["primary_diagnosis"] == "Rice_Bacterial_blight"
            assert res["execution_status"] == "success"
            cats = res["providers_summary"]["categories"]
            assert cats["disease"]["succeeded"] > 0
            assert (cats["pest"]["failed"] > 0 or cats["pest"]["timed_out"] > 0 or cats["nutrient"]["failed"] > 0)


def test_all_providers_failing_regression():
    """20. Test all providers failing yields provider_error and execution_status='error'."""
    raw = create_test_image_bytes()

    def mock_run_prov(cfg, img, raw_b, ct):
        return {
            "provider": cfg.get("provider", "roboflow"),
            "model": cfg.get("model_id", cfg.get("name", "")),
            "status": "error",
            "http_status": 500,
            "failure_class": "http_error",
            "latency_ms": 100.0,
            "detections": [],
            "top_confidence": 0.0,
        }

    with patch("App.backend.disease_detection.run_provider", side_effect=mock_run_prov):
        res = predict_disease_and_pests(crop="rice", raw=raw)

        assert res["inference_outcome"] == "provider_error"
        assert res["execution_status"] == "error"




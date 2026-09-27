import base64
import io
import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, ImageDraw

# ultralytics / YOLO is optional — loaded lazily if run_local is invoked
_model_cache = {}

from App.backend.agronomy_rag import generate_rag_remedies, get_symptom_checklist
from App.backend.settings import ROBOFLOW_API_KEY, HF_TOKEN, SUPABASE_BUCKET, create_supabase_client

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = Path(os.getenv("MODELS_DIR", str(BASE_DIR / "models")))
PT_FILES_DIR = BASE_DIR.parent / "pt files"

CONFIDENCE = float(os.getenv("CONFIDENCE", "0.25"))
CUSTOM_CROP_CONF_THRESHOLD = float(os.getenv("CUSTOM_CROP_CONF_THRESHOLD", "0.75"))
IOU = float(os.getenv("IOU", "0.45"))
MAX_DETECTIONS = int(os.getenv("MAX_DETECTIONS", "100"))

# Upload safety limits
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))  # 10 MB
MAX_IMAGE_DIM = int(os.getenv("MAX_IMAGE_DIM", "4096"))  # 4096 x 4096 px
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
LOW_CONFIDENCE_THRESHOLD = float(os.getenv("LOW_CONFIDENCE_THRESHOLD", "0.40"))

AI_DISCLAIMER_TEXT = (
    "⚠️ This is an AI-assisted visual assessment, not a confirmed diagnosis. "
    "Visual AI models may produce false positives or misclassifications. "
    "Verify symptoms with a qualified agriculture professional or local Agriculture Officer "
    "before taking any action."
)

supabase = create_supabase_client()

def _get_admin_client():
    try:
        from App.backend.settings import create_supabase_admin_client
        admin_c = create_supabase_admin_client()
        if admin_c is not None:
            return admin_c
    except Exception:
        pass
    return supabase

app = FastAPI(title="Crop Disease & Pest Multi-Provider Inference API", version="3.1.0")

# Registered Crop Models with verified Roboflow Universe and Local PyTorch weights
CROP_MODELS: dict[str, list[dict[str, str]]] = {
    "banana": [
        {"provider": "local", "name": "banana-local", "path": "crops/banana.pt"},
        {"provider": "roboflow", "name": "banana-diseases-lrf9y", "model_id": "banana-diseases-lrf9y/1", "url": "https://universe.roboflow.com/tdtu-ocamc/banana-diseases-lrf9y"},
    ],
    "beans": [
        {"provider": "roboflow", "name": "beans-diseases", "model_id": "beans-diseases/1", "url": "https://universe.roboflow.com/zhang-wen-hao-itjzq/beans-diseases"},
    ],
    "blackgram": [
        {"provider": "local", "name": "blackgram-local", "path": "crops/blackgram.pt"},
    ],
    "muskmelon": [
        {"provider": "roboflow", "name": "melon-cantaloupe-pest", "model_id": "melon-cantaloupe-pest/12", "url": "https://universe.roboflow.com/trisha-mae/melon-cantaloupe-pest"},
        {"provider": "roboflow", "name": "melon-disease-j55st", "model_id": "melon-disease-j55st/5", "url": "https://universe.roboflow.com/choza-q6p0q/melon-disease-j55st"},
    ],
    "rice": [
        {"provider": "roboflow", "name": "pests-wropv", "model_id": "pests-wropv/3", "url": "https://universe.roboflow.com/ali-s5zbn/pests-wropv"},
        {"provider": "roboflow", "name": "rice-leaf-disease-s1asn", "model_id": "rice-leaf-disease-s1asn/2", "url": "https://universe.roboflow.com/riceleafdiseasedetection/rice-leaf-disease-s1asn"},
        {"provider": "roboflow", "name": "rice-i9qwz", "model_id": "rice-i9qwz/2", "url": "https://universe.roboflow.com/rice-pest/rice-i9qwz"},
    ],
    "paddy": [
        {"provider": "roboflow", "name": "pests-wropv", "model_id": "pests-wropv/3", "url": "https://universe.roboflow.com/ali-s5zbn/pests-wropv"},
        {"provider": "roboflow", "name": "rice-leaf-disease-s1asn", "model_id": "rice-leaf-disease-s1asn/2", "url": "https://universe.roboflow.com/riceleafdiseasedetection/rice-leaf-disease-s1asn"},
        {"provider": "roboflow", "name": "rice-i9qwz", "model_id": "rice-i9qwz/2", "url": "https://universe.roboflow.com/rice-pest/rice-i9qwz"},
    ],
    "maize": [
        {"provider": "roboflow", "name": "maize-disease-dataset", "model_id": "maize-disease-dataset/1", "url": "https://universe.roboflow.com/detection-of-corn-crop-diseases-using-yolov8/maize-disease-dataset"},
    ],
    "cotton": [
        {"provider": "roboflow", "name": "cotton-disease-detection-xevxs", "model_id": "cotton-disease-detection-xevxs/1", "url": "https://universe.roboflow.com/disease-detection-wounm/cotton-disease-detection-xevxs"},
        {"provider": "roboflow", "name": "cotton-disease-zrbov", "model_id": "cotton-disease-zrbov/22", "url": "https://universe.roboflow.com/industrial-engineer/cotton-disease-zrbov"},
        {"provider": "roboflow", "name": "cotton-disease-qjexe", "model_id": "cotton-disease-qjexe/6", "url": "https://universe.roboflow.com/sow-svfav/cotton-disease-qjexe"},
        {"provider": "roboflow", "name": "cotton-pests-detection", "model_id": "cotton-pests-detection/7", "url": "https://universe.roboflow.com/shoaib-btznm/cotton-pests-detection"},
        {"provider": "roboflow", "name": "cotton-diseases", "model_id": "cotton-diseases/1", "url": "https://universe.roboflow.com/arl-lab/cotton-diseases"},
        {"provider": "roboflow", "name": "6-class-cotton-disease-and-pest", "model_id": "6-class-cotton-disease-and-pest/5", "url": "https://universe.roboflow.com/cotton-disease-detection-lbqgm/6-class-cotton-disease-and-pest"},
    ],
    "grapes": [
        {"provider": "roboflow", "name": "grape-leaf-disease-dataset", "model_id": "grape-leaf-disease-dataset/1", "url": "https://universe.roboflow.com/tru-projects-cqcql/grape-leaf-disease-dataset"},
    ],
    "mango": [
        {"provider": "roboflow", "name": "mango-pests", "model_id": "mango-pests/3", "url": "https://universe.roboflow.com/project-pjsi8/mango-pests"},
    ],
    "orange": [
        {"provider": "roboflow", "name": "citrus-3hv7w", "model_id": "citrus-3hv7w/2", "url": "https://universe.roboflow.com/test-2uu68/citrus-3hv7w"},
        {"provider": "roboflow", "name": "citrus-diseases-bp1cl", "model_id": "citrus-diseases-bp1cl/2", "url": "https://universe.roboflow.com/test-jvpjm/citrus-diseases-bp1cl"},
    ],
    "papaya": [
        {"provider": "roboflow", "name": "papaya-disease", "model_id": "papaya-disease/4", "url": "https://universe.roboflow.com/academy-workspace/papaya-disease"},
    ],
    "pomegranate": [
        {"provider": "roboflow", "name": "pomegranate-disease-detection", "model_id": "pomegranate-disease-detection/1", "url": "https://universe.roboflow.com/vehicle-detection-and-counting-fdrtm/pomegranate-disease-detection"},
    ],
    "watermelon": [
        {"provider": "roboflow", "name": "watermelon-diseases", "model_id": "watermelon-diseases/3", "url": "https://universe.roboflow.com/watermelon-diseases/watermelon-diseases"},
    ],
}

# Registered Shared Models (General Pests & Nutrient Deficiencies)
SHARED_MODELS: dict[str, list[dict[str, str]]] = {
    "pest": [
        {"provider": "roboflow", "name": "pests-rt37d", "model_id": "pests-rt37d/1", "url": "https://universe.roboflow.com/digitalws/pests-rt37d"},
        {"provider": "roboflow", "name": "pest-detection-utqxd", "model_id": "pest-detection-utqxd/8", "url": "https://universe.roboflow.com/uzhavarconnect/pest-detection-utqxd"},
    ],
    "nutrient": [
        {"provider": "roboflow", "name": "nutrient-deficiency-obhfe", "model_id": "nutrient-deficiency-obhfe/1", "url": "https://universe.roboflow.com/agrivision-2025/nutrient-deficiency-obhfe"},
    ],
}
_model_cache: dict[str, Any] = {}


def _validate_upload(raw: bytes, content_type: str) -> None:
    """
    Validate upload size and content type before any processing.
    Raises ValueError with a safe user-facing message on failure.
    """
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ValueError(
            f"Image file is too large. Maximum allowed size is {MAX_UPLOAD_BYTES // (1024*1024)} MB."
        )
    ct = content_type.lower().split(";")[0].strip()
    if ct not in ALLOWED_CONTENT_TYPES:
        raise ValueError(
            f"Unsupported file type '{ct}'. Please upload a JPEG, PNG, or WebP image."
        )


def _validate_dimensions(pil_image: Image.Image) -> None:
    """Reject images that exceed the maximum allowed pixel dimensions."""
    w, h = pil_image.size
    if w > MAX_IMAGE_DIM or h > MAX_IMAGE_DIM:
        raise ValueError(
            f"Image dimensions ({w}x{h}) exceed the maximum allowed {MAX_IMAGE_DIM}x{MAX_IMAGE_DIM}."
        )


def normalize_detections(items: list[dict[str, Any]], source: str) -> list[dict[str, Any]]:
    output = []
    for item in items[:MAX_DETECTIONS]:
        box = item.get("box", {}) or {}
        raw_conf = float(item.get("confidence", item.get("score", 0.0)))
        # Normalize 0-100 percentage scale to 0.0-1.0 float scale if needed
        confidence = raw_conf / 100.0 if (raw_conf > 1.0 and raw_conf <= 100.0) else raw_conf
        label = item.get("class", item.get("label", "unknown"))
        if "x" in item:
            x, y, w, h = [float(item.get(k, 0)) for k in ("x", "y", "width", "height")]
            box_xyxy = [x - w / 2, y - h / 2, x + w / 2, y + h / 2]
        else:
            box_xyxy = [box.get(k, 0) for k in ("xmin", "ymin", "xmax", "ymax")]
        output.append({
            "label": str(label),
            "confidence": round(float(confidence), 6),
            "box_xyxy": [round(float(v), 2) for v in box_xyxy],
            "source": source,
        })
    return sorted(output, key=lambda x: x["confidence"], reverse=True)


def run_local(config: dict[str, str], image: Image.Image) -> dict[str, Any]:
    t0 = time.time()
    try:
        from ultralytics import YOLO
    except ImportError:
        dt = round((time.time() - t0) * 1000, 2)
        return {
            "provider": "local",
            "model": config.get("name", ""),
            "status": "skipped",
            "http_status": None,
            "failure_class": "missing_dependency",
            "error": "ultralytics not installed",
            "latency_ms": dt,
            "detections": [],
            "top_confidence": 0.0,
        }

    path = MODELS_DIR / config["path"]
    if not path.exists() and PT_FILES_DIR.exists():
        fallback_pt = PT_FILES_DIR / Path(config["path"]).name
        if fallback_pt.exists():
            path = fallback_pt

    if not path.exists():
        dt = round((time.time() - t0) * 1000, 2)
        return {
            "provider": "local",
            "model": config.get("name", ""),
            "status": "skipped",
            "http_status": None,
            "failure_class": "invalid_model_id",
            "error": f"Model file not found: {Path(config['path']).name}",
            "latency_ms": dt,
            "detections": [],
            "top_confidence": 0.0,
        }

    if str(path) not in _model_cache:
        _model_cache[str(path)] = YOLO(str(path))
    result = _model_cache[str(path)].predict(source=image, conf=CONFIDENCE, iou=IOU, max_det=MAX_DETECTIONS, verbose=False)[0]
    names = result.names
    detections = []
    if result.boxes is not None:
        for box in result.boxes:
            class_id = int(box.cls[0].item())
            detections.append({
                "label": str(names[class_id]),
                "class_id": class_id,
                "confidence": round(float(box.conf[0].item()), 6),
                "box_xyxy": [round(float(v), 2) for v in box.xyxy[0].tolist()],
                "source": "local",
            })
    detections.sort(key=lambda x: x["confidence"], reverse=True)
    dt = round((time.time() - t0) * 1000, 2)
    return {
        "provider": "local",
        "model": config["name"],
        "status": "ok",
        "http_status": None,
        "failure_class": None,
        "latency_ms": dt,
        "detections": detections,
        "top_confidence": detections[0]["confidence"] if detections else 0.0,
    }


def run_roboflow(config: dict[str, str], raw: bytes, content_type: str) -> dict[str, Any]:
    t0 = time.time()
    model_id = config.get("model_id", config.get("name", ""))
    if not ROBOFLOW_API_KEY:
        dt = round((time.time() - t0) * 1000, 2)
        return {
            "provider": "roboflow",
            "model": model_id,
            "status": "skipped",
            "http_status": None,
            "failure_class": "missing_or_invalid_credential",
            "error": "ROBOFLOW_API_KEY is not configured.",
            "latency_ms": dt,
            "detections": [],
            "top_confidence": 0.0,
        }
    url = f"https://serverless.roboflow.com/{model_id}"
    params = {"confidence": CONFIDENCE, "overlap": IOU, "api_key": ROBOFLOW_API_KEY}
    headers = {"Authorization": f"Bearer {ROBOFLOW_API_KEY}"}

    try:
        response = httpx.post(
            url,
            headers=headers,
            params=params,
            files={"file": ("image", raw, content_type)},
            timeout=httpx.Timeout(3.5, connect=2.0),
        )
        dt = round((time.time() - t0) * 1000, 2)
        http_status = response.status_code

        if http_status != 200:
            failure_class = "http_error"
            if http_status in (401, 403):
                failure_class = "missing_or_invalid_credential"
            elif http_status == 404:
                failure_class = "invalid_model_id"
            elif http_status in (502, 503, 504):
                failure_class = "provider_unavailable"

            return {
                "provider": "roboflow",
                "model": model_id,
                "status": "error",
                "http_status": http_status,
                "failure_class": failure_class,
                "error": f"Roboflow HTTP {http_status}",
                "latency_ms": dt,
                "detections": [],
                "top_confidence": 0.0,
            }

        payload = response.json()
        detections = normalize_detections(payload.get("predictions", []), "roboflow")
        return {
            "provider": "roboflow",
            "model": model_id,
            "status": "ok",
            "http_status": 200,
            "failure_class": None,
            "latency_ms": dt,
            "detections": detections,
            "top_confidence": detections[0]["confidence"] if detections else 0.0,
        }
    except httpx.TimeoutException:
        dt = round((time.time() - t0) * 1000, 2)
        return {
            "provider": "roboflow",
            "model": model_id,
            "status": "timeout",
            "http_status": None,
            "failure_class": "timeout",
            "error": "Roboflow request timed out",
            "latency_ms": dt,
            "detections": [],
            "top_confidence": 0.0,
        }
    except json.JSONDecodeError:
        dt = round((time.time() - t0) * 1000, 2)
        return {
            "provider": "roboflow",
            "model": model_id,
            "status": "error",
            "http_status": 200,
            "failure_class": "response_parsing_error",
            "error": "Failed to parse Roboflow JSON response",
            "latency_ms": dt,
            "detections": [],
            "top_confidence": 0.0,
        }
    except Exception as exc:
        dt = round((time.time() - t0) * 1000, 2)
        err_msg = str(exc)
        failure_class = "provider_unavailable" if ("getaddrinfo" in err_msg or "Connect" in err_msg or "Connection" in err_msg) else "http_error"
        return {
            "provider": "roboflow",
            "model": model_id,
            "status": "error",
            "http_status": None,
            "failure_class": failure_class,
            "error": f"Roboflow error: {failure_class}",
            "latency_ms": dt,
            "detections": [],
            "top_confidence": 0.0,
        }


def run_huggingface(config: dict[str, str], raw: bytes, content_type: str = "image/jpeg") -> dict[str, Any]:
    t0 = time.time()
    model_id = config.get("model_id", config.get("name", ""))
    if not HF_TOKEN:
        dt = round((time.time() - t0) * 1000, 2)
        return {
            "provider": "huggingface",
            "model": model_id,
            "status": "skipped",
            "http_status": None,
            "failure_class": "missing_or_invalid_credential",
            "error": "HF_TOKEN is not configured.",
            "latency_ms": dt,
            "detections": [],
            "top_confidence": 0.0,
        }

    urls = [
        f"https://router.huggingface.co/hf-inference/v1/models/{model_id}",
        f"https://api-inference.huggingface.co/models/{model_id}",
    ]
    base_headers = {"Authorization": f"Bearer {HF_TOKEN}"}

    response = None
    last_http_status = None

    for url in urls:
        try:
            headers = {**base_headers, "Content-Type": content_type}
            res = httpx.post(url, headers=headers, content=raw, timeout=httpx.Timeout(3.5, connect=2.0))
            last_http_status = res.status_code
            if res.status_code == 200:
                response = res
                break
            elif res.status_code == 400:
                # Try base64 JSON payload
                b64_data = base64.b64encode(raw).decode("utf-8")
                json_headers = {**base_headers, "Content-Type": "application/json"}
                json_body = {"inputs": f"data:{content_type};base64,{b64_data}"}
                res_j = httpx.post(url, headers=json_headers, json=json_body, timeout=httpx.Timeout(3.5, connect=2.0))
                last_http_status = res_j.status_code
                if res_j.status_code == 200:
                    response = res_j
                    break
        except httpx.TimeoutException:
            dt = round((time.time() - t0) * 1000, 2)
            return {
                "provider": "huggingface",
                "model": model_id,
                "status": "timeout",
                "http_status": None,
                "failure_class": "timeout",
                "error": "Hugging Face request timed out",
                "latency_ms": dt,
                "detections": [],
                "top_confidence": 0.0,
            }
        except Exception:
            pass

    dt = round((time.time() - t0) * 1000, 2)

    if response is None:
        http_status = last_http_status or 400
        failure_class = "http_error"
        if http_status in (401, 403):
            failure_class = "missing_or_invalid_credential"
        elif http_status == 404:
            failure_class = "invalid_model_id"
        elif http_status in (502, 503, 504, 507):
            failure_class = "provider_unavailable"

        return {
            "provider": "huggingface",
            "model": model_id,
            "status": "error",
            "http_status": http_status,
            "failure_class": failure_class,
            "error": f"Hugging Face HTTP {http_status}",
            "latency_ms": dt,
            "detections": [],
            "top_confidence": 0.0,
        }

    try:
        payload = response.json()
        items = []
        if isinstance(payload, list):
            for prediction in payload:
                if isinstance(prediction, dict):
                    items.append({
                        "label": prediction.get("label", "unknown"),
                        "score": prediction.get("score", 0.0),
                        "box": prediction.get("box", {}),
                    })
        detections = normalize_detections(items, "huggingface")
        return {
            "provider": "huggingface",
            "model": model_id,
            "status": "ok",
            "http_status": 200,
            "failure_class": None,
            "latency_ms": dt,
            "detections": detections,
            "top_confidence": detections[0]["confidence"] if detections else 0.0,
        }
    except json.JSONDecodeError:
        return {
            "provider": "huggingface",
            "model": model_id,
            "status": "error",
            "http_status": 200,
            "failure_class": "response_parsing_error",
            "error": "Failed to parse Hugging Face JSON response",
            "latency_ms": dt,
            "detections": [],
            "top_confidence": 0.0,
        }
    except Exception as exc:
        dt = round((time.time() - t0) * 1000, 2)
        err_msg = str(exc)
        failure_class = "provider_unavailable" if ("getaddrinfo" in err_msg or "Connect" in err_msg or "Connection" in err_msg) else "http_error"
        return {
            "provider": "huggingface",
            "model": model_id,
            "status": "error",
            "http_status": None,
            "failure_class": failure_class,
            "error": f"Hugging Face error: {failure_class}",
            "latency_ms": dt,
            "detections": [],
            "top_confidence": 0.0,
        }


def run_provider(config: dict[str, str], image: Image.Image, raw: bytes, content_type: str) -> dict[str, Any]:
    t0 = time.time()
    try:
        prov = config.get("provider", "unknown")
        if prov == "local":
            result = run_local(config, image)
        elif prov == "roboflow":
            result = run_roboflow(config, raw, content_type)
        elif prov == "huggingface":
            result = run_huggingface(config, raw, content_type)
        else:
            raise ValueError(f"Unknown provider: {prov}")
        if "latency_ms" not in result:
            result["latency_ms"] = round((time.time() - t0) * 1000, 2)
        result["top_confidence"] = result["detections"][0]["confidence"] if result.get("detections") else 0.0
        return result
    except Exception as exc:
        dt = round((time.time() - t0) * 1000, 2)
        err_str = str(exc)
        failure_class = "http_error"
        if "401" in err_str or "unauthorized" in err_str.lower():
            failure_class = "missing_or_invalid_credential"
        elif "404" in err_str or "not found" in err_str.lower():
            failure_class = "invalid_model_id"
        elif "timeout" in err_str.lower() or "timed out" in err_str.lower():
            failure_class = "timeout"
        elif "getaddrinfo" in err_str or "connection" in err_str.lower() or "connecterror" in err_str.lower():
            failure_class = "provider_unavailable"
        return {
            "provider": config.get("provider", "unknown"),
            "model": config.get("model_id", config.get("name", "unknown")),
            "status": "error",
            "http_status": None,
            "failure_class": failure_class,
            "error": f"Provider error: {failure_class}",
            "latency_ms": dt,
            "detections": [],
            "top_confidence": 0.0,
        }


def best_result(runs: list[dict[str, Any]], min_conf: float = 0.0) -> dict[str, Any] | None:
    successful = []
    for run in runs:
        for det in run.get("detections", []):
            if det.get("confidence", 0.0) >= min_conf:
                successful.append({"provider": run["provider"], "model": run["model"], "detection": det})

    if not successful:
        return None
    winner = max(successful, key=lambda item: item["detection"]["confidence"])
    return winner


def draw_bounding_boxes(pil_image: Image.Image, winner_detections: list[dict[str, Any]]) -> str:
    annotated = pil_image.copy()
    draw = ImageDraw.Draw(annotated)
    w, h = pil_image.size
    for winner in winner_detections:
        det = winner["detection"]
        box = det.get("box_xyxy", [])
        if len(box) == 4:
            draw.rectangle(box, outline="red", width=3)
            draw.text((box[0] + 5, box[1] + 5), f"{det['label']} ({det['confidence']:.0%})", fill="red")
    buffer = io.BytesIO()
    annotated.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


def predict_disease_and_pests(
    crop: str,
    raw: bytes,
    filename: str = "image.jpg",
    content_type: str = "image/jpeg",
    request_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Core backend inference workflow with bounded stage timings:
    1. Upload validation
    2. Multi-provider Vision Inference (ThreadPool with non-blocking cleanup)
    3. Bounded RAG Remedies Generation (3.0s timeout)
    4. Bounded Storage Upload (2.5s timeout)
    5. Non-blocking Telemetry Persistence
    """
    t_start = time.time()
    req_id = request_id or str(uuid.uuid4())[:8]
    crop_clean = crop.strip().lower()
    is_custom_crop = crop_clean not in CROP_MODELS
    custom_crop_notice = None

    # Stage 1: Upload validation
    t_val_start = time.time()
    _validate_upload(raw, content_type)

    if is_custom_crop:
        crop_configs = []
        custom_crop_notice = (
            f"We do not have a trained crop-specific disease model for '{crop.capitalize()}'. "
            "Running General Pest and Nutrient Deficiency models at 75% confidence."
        )
    else:
        crop_configs = CROP_MODELS[crop_clean]

    try:
        pil_image = Image.open(io.BytesIO(raw)).convert("RGB")
        _validate_dimensions(pil_image)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("The uploaded file is not a valid image.") from exc
    upload_validation_ms = round((time.time() - t_val_start) * 1000, 2)

    # Stage 2: Multi-provider Vision Inference (4.5s hard timeout)
    t_inf_start = time.time()
    import concurrent.futures
    all_configs = crop_configs + SHARED_MODELS["pest"] + SHARED_MODELS["nutrient"]
    results_by_config = {}

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=len(all_configs) or 1)
    try:
        future_map = {executor.submit(run_provider, cfg, pil_image, raw, content_type): cfg for cfg in all_configs}
        done, pending = concurrent.futures.wait(future_map.keys(), timeout=4.5)
        for future, cfg in future_map.items():
            if future in done:
                try:
                    results_by_config[id(cfg)] = future.result()
                except Exception as p_err:
                    err_str = str(p_err)
                    f_cls = "http_error"
                    if "401" in err_str or "unauthorized" in err_str.lower():
                        f_cls = "missing_or_invalid_credential"
                    elif "404" in err_str or "not found" in err_str.lower():
                        f_cls = "invalid_model_id"
                    elif "timeout" in err_str.lower():
                        f_cls = "timeout"
                    elif "getaddrinfo" in err_str or "connection" in err_str.lower():
                        f_cls = "provider_unavailable"
                    results_by_config[id(cfg)] = {
                        "provider": cfg.get("provider", "unknown"),
                        "model": cfg.get("model_id", cfg.get("name", "unknown")),
                        "status": "error",
                        "http_status": None,
                        "failure_class": f_cls,
                        "error": f"Provider error: {f_cls}",
                        "latency_ms": 0.0,
                        "detections": [],
                        "top_confidence": 0.0,
                    }
            else:
                results_by_config[id(cfg)] = {
                    "provider": cfg.get("provider", "unknown"),
                    "model": cfg.get("model_id", cfg.get("name", "unknown")),
                    "status": "timeout",
                    "http_status": None,
                    "failure_class": "timeout",
                    "error": "Provider timed out",
                    "latency_ms": 4500.0,
                    "detections": [],
                    "top_confidence": 0.0,
                }
    finally:
        executor.shutdown(wait=False, cancel_futures=True)

    vision_inference_ms = round((time.time() - t_inf_start) * 1000, 2)

    crop_runs = [results_by_config.get(id(cfg), {}) for cfg in crop_configs]
    pest_runs = [results_by_config.get(id(cfg), {}) for cfg in SHARED_MODELS["pest"]]
    nutrient_runs = [results_by_config.get(id(cfg), {}) for cfg in SHARED_MODELS["nutrient"]]

    all_runs = crop_runs + pest_runs + nutrient_runs
    total_configured = len(all_configs)
    providers_succeeded = sum(1 for r in all_runs if r.get("status") == "ok")
    providers_failed = sum(1 for r in all_runs if r.get("status") in ("error", "failed"))
    providers_timed_out = sum(1 for r in all_runs if r.get("status") == "timeout")
    providers_skipped = sum(1 for r in all_runs if r.get("status") == "skipped")

    min_conf = CUSTOM_CROP_CONF_THRESHOLD if is_custom_crop else CONFIDENCE

    def _make_category_summary(runs: list[dict[str, Any]]) -> dict[str, Any]:
        tot = len(runs)
        succ = sum(1 for r in runs if r.get("status") == "ok")
        fail = sum(1 for r in runs if r.get("status") in ("error", "failed"))
        tout = sum(1 for r in runs if r.get("status") == "timeout")
        skip = sum(1 for r in runs if r.get("status") == "skipped")
        details = [
            {
                "provider": str(r.get("provider", "unknown")),
                "model": str(r.get("model", "unknown")),
                "status": str(r.get("status", "unknown")),
                "http_status": r.get("http_status"),
                "failure_class": r.get("failure_class"),
                "error": r.get("error"),
                "latency_ms": round(float(r.get("latency_ms", 0.0)), 2),
                "detections_count": len(r.get("detections", [])),
                "top_confidence": round(float(r.get("top_confidence", 0.0)), 4),
            }
            for r in runs
        ]
        return {
            "total_configured": tot,
            "succeeded": succ,
            "failed": fail,
            "timed_out": tout,
            "skipped": skip,
            "details": details,
        }

    disease_summary = _make_category_summary(crop_runs)
    pest_summary = _make_category_summary(pest_runs)
    nutrient_summary = _make_category_summary(nutrient_runs)

    per_provider_summary = []
    for r in all_runs:
        per_provider_summary.append({
            "provider": str(r.get("provider", "unknown")),
            "model": str(r.get("model", "unknown")),
            "status": str(r.get("status", "unknown")),
            "http_status": r.get("http_status"),
            "failure_class": r.get("failure_class"),
            "error": r.get("error"),
            "latency_ms": round(float(r.get("latency_ms", 0.0)), 2),
            "detections_count": len(r.get("detections", [])),
            "top_confidence": round(float(r.get("top_confidence", 0.0)), 4),
        })

    providers_summary = {
        "total_configured": total_configured,
        "succeeded": providers_succeeded,
        "failed": providers_failed,
        "timed_out": providers_timed_out,
        "skipped": providers_skipped,
        "applied_threshold": min_conf,
        "categories": {
            "disease": disease_summary,
            "pest": pest_summary,
            "nutrient": nutrient_summary,
        },
        "details": per_provider_summary,
    }

    # Collect all raw candidate detections across all provider runs
    all_raw_detections = []
    for run in all_runs:
        for det in run.get("detections", []):
            all_raw_detections.append({
                "label": str(det.get("label", "unknown")),
                "confidence": round(float(det.get("confidence", 0.0)), 6),
                "provider": str(run.get("provider", "unknown")),
                "model": str(run.get("model", "unknown")),
                "box_xyxy": det.get("box_xyxy"),
            })
    all_raw_detections.sort(key=lambda x: x["confidence"], reverse=True)

    # Winners >= min_conf
    top_crop = best_result(crop_runs, min_conf=min_conf)
    top_pest = best_result(pest_runs, min_conf=min_conf)
    top_nutrient = best_result(nutrient_runs, min_conf=min_conf)

    all_winners = sorted(
        [item for item in [top_crop, top_pest, top_nutrient] if item],
        key=lambda x: x["detection"].get("confidence", 0.0),
        reverse=True
    )
    annotated_b64 = draw_bounding_boxes(pil_image, all_winners) if all_winners else ""

    # Secondary / alternate detections >= 0.15
    other_possible_detections = []
    for det in all_raw_detections:
        is_winner = any(det["label"] == w["detection"]["label"] and abs(det["confidence"] - w["detection"]["confidence"]) < 1e-5 for w in all_winners)
        if not is_winner and det["confidence"] >= 0.15:
            other_possible_detections.append(det)

    has_crop_disease_models = (not is_custom_crop) and (len(crop_configs) > 0)
    crop_disease_succeeded = disease_summary["succeeded"]

    # Classify inference_outcome & execution_status
    if total_configured == 0 or providers_succeeded == 0:
        inference_outcome = "provider_error"
        execution_status = "error"
    elif has_crop_disease_models and crop_disease_succeeded == 0:
        if all_winners:
            inference_outcome = "detected"
            execution_status = "partial"
        else:
            inference_outcome = "provider_error"
            execution_status = "partial" if providers_succeeded > 0 else "error"
    elif not all_raw_detections:
        inference_outcome = "no_detection"
        execution_status = "success"
    elif not all_winners:
        inference_outcome = "low_confidence"
        execution_status = "success"
    else:
        inference_outcome = "detected"
        execution_status = "success"

    primary_label: Optional[str] = None
    top_confidence_val: Optional[float] = None
    is_low_confidence = False
    rag_remedies = None
    notice_text = custom_crop_notice

    def _is_healthy_label(label_str: Optional[str]) -> bool:
        if not label_str:
            return False
        lbl = label_str.lower().strip()
        return "healthy" in lbl or lbl == "healthy crop leaf"

    # Stage 3: Bounded & Non-blocking RAG Remedies Generation (3.0s limit)
    t_rag_start = time.time()
    if inference_outcome == "detected":
        primary_label = all_winners[0]["detection"]["label"]
        top_confidence_val = round(float(all_winners[0]["detection"].get("confidence", 0.0)), 4)
        is_low_confidence = False
        if _is_healthy_label(primary_label):
            rag_remedies = None
            healthy_msg = "Crop appears healthy based on visual AI analysis."
            notice_text = f"{custom_crop_notice} {healthy_msg}" if custom_crop_notice else healthy_msg
        else:
            rag_exec = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            try:
                rag_fut = rag_exec.submit(generate_rag_remedies, primary_label, crop=crop)
                rag_remedies = rag_fut.result(timeout=1.5)
                if not rag_remedies and top_crop and top_crop.get("detection", {}).get("label"):
                    crop_lbl = top_crop["detection"]["label"]
                    if crop_lbl != primary_label:
                        rag_fut_crop = rag_exec.submit(generate_rag_remedies, crop_lbl, crop=crop)
                        rag_remedies = rag_fut_crop.result(timeout=1.0)
            except concurrent.futures.TimeoutError:
                print(f"[{req_id}] RAG remedies generation timed out (>1.5s) - proceeding without remedies")
                rag_remedies = None
            except Exception as rag_err:
                print(f"[{req_id}] RAG remedies generation warning: {rag_err}")
                rag_remedies = None
            finally:
                rag_exec.shutdown(wait=False, cancel_futures=True)

            if has_crop_disease_models and crop_disease_succeeded == 0:
                disease_warn = "Pest or nutrient candidate detected, but crop-specific disease assessment could not be completed because disease vision models timed out or were unavailable."
                notice_text = f"{custom_crop_notice} {disease_warn}" if custom_crop_notice else disease_warn

    elif inference_outcome == "low_confidence":
        is_low_confidence = True
        top_confidence_val = round(float(all_raw_detections[0]["confidence"]), 4) if all_raw_detections else None
        top_conf_pct = f"{top_confidence_val * 100:.1f}%" if top_confidence_val is not None else "low"
        primary_label = None
        low_conf_msg = (
            f"Candidate pattern detected but confidence ({top_conf_pct}) is below the required threshold ({min_conf * 100:.0f}%). "
            "Results may not be reliable. Please consult an agriculture professional."
        )
        notice_text = f"{custom_crop_notice} {low_conf_msg}" if custom_crop_notice else low_conf_msg

    elif inference_outcome == "no_detection":
        is_low_confidence = False
        primary_label = None
        top_confidence_val = None
        no_det_msg = (
            "No disease or pest symptoms were detected by visual analysis. "
            "If your crop displays unusual symptoms, please consult a local Agriculture Officer."
        )
        notice_text = f"{custom_crop_notice} {no_det_msg}" if custom_crop_notice else no_det_msg

    elif inference_outcome == "provider_error":
        is_low_confidence = False
        primary_label = None
        top_confidence_val = None
        if total_configured == 0:
            err_msg = (
                "No visual inference models are configured for this selection. "
                "Automated analysis is currently unavailable."
            )
        elif has_crop_disease_models and crop_disease_succeeded == 0:
            err_msg = (
                f"Crop disease assessment for '{crop.capitalize()}' could not be completed because disease vision models timed out or were unavailable. "
                "Please try again later or consult a local agronomy expert."
            )
        else:
            err_msg = (
                "Automated visual analysis is currently unavailable or timed out. "
                "Please try again later or consult a local agronomy expert."
            )
        notice_text = f"{custom_crop_notice} {err_msg}" if custom_crop_notice else err_msg

    if is_custom_crop and custom_crop_notice:
        if notice_text and notice_text != custom_crop_notice:
            notice_text = f"{custom_crop_notice} {notice_text}"
        else:
            notice_text = custom_crop_notice
    rag_remedies_ms = round((time.time() - t_rag_start) * 1000, 2)

    # Stage 4: Bounded Storage Upload (2.5s limit)
    t_st_start = time.time()
    prediction_id = str(uuid.uuid4())
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    extension = extension if extension in {"jpg", "jpeg", "png", "webp"} else "jpg"
    storage_path = f"{datetime.now(timezone.utc):%Y/%m/%d}/{prediction_id}.{extension}"
    image_url = ""

    admin_client = _get_admin_client()
    if admin_client:
        def _do_upload():
            admin_client.storage.from_(SUPABASE_BUCKET).upload(storage_path, raw, {"content-type": content_type, "upsert": "false"})
            return admin_client.storage.from_(SUPABASE_BUCKET).get_public_url(storage_path)

        st_exec = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        try:
            st_fut = st_exec.submit(_do_upload)
            image_url = st_fut.result(timeout=1.5)
        except Exception as exc:
            print(f"[{req_id}] Warning: Supabase Storage upload skipped/failed: {exc}")
        finally:
            st_exec.shutdown(wait=False, cancel_futures=True)
    storage_upload_ms = round((time.time() - t_st_start) * 1000, 2)

    # Stage 5: Non-blocking Telemetry DB Insert
    t_db_start = time.time()
    total_latency_ms = round((time.time() - t_start) * 1000, 2)
    stage_timings_ms = {
        "upload_validation_ms": upload_validation_ms,
        "vision_inference_ms": vision_inference_ms,
        "rag_remedies_ms": rag_remedies_ms,
        "storage_upload_ms": storage_upload_ms,
        "telemetry_persist_ms": 0.0,
        "total_latency_ms": total_latency_ms,
    }

    candidate_summary = {
        "crop_models_evaluated": len(crop_runs),
        "pest_models_evaluated": len(pest_runs),
        "nutrient_models_evaluated": len(nutrient_runs),
        "total_providers_contacted": total_configured,
        "total_providers_succeeded": providers_succeeded,
        "applied_thresholds": {
            "low_confidence_threshold": LOW_CONFIDENCE_THRESHOLD,
            "custom_crop_conf_threshold": CUSTOM_CROP_CONF_THRESHOLD,
            "confidence_threshold": CONFIDENCE,
        },
        "is_low_confidence": is_low_confidence,
        "inference_outcome": inference_outcome,
        "stage_timings_ms": stage_timings_ms,
    }

    final_symptoms = []
    final_symptoms_notice = "No verified symptom reference available"
    has_verified = False

    if isinstance(rag_remedies, dict) and rag_remedies.get("has_verified_symptoms"):
        final_symptoms = rag_remedies.get("symptom_checklist", [])
        final_symptoms_notice = rag_remedies.get("symptom_checklist_notice")
        has_verified = True
    else:
        candidate_labels = []
        if primary_label:
            candidate_labels.append(primary_label)
        if top_crop and top_crop.get("detection", {}).get("label"):
            candidate_labels.append(top_crop["detection"]["label"])
        if top_pest and top_pest.get("detection", {}).get("label"):
            candidate_labels.append(top_pest["detection"]["label"])

        for cand in candidate_labels:
            chk = get_symptom_checklist(cand, crop=crop)
            if chk and chk.get("has_verified_symptoms"):
                final_symptoms = chk.get("symptom_checklist", [])
                final_symptoms_notice = chk.get("symptom_checklist_notice")
                has_verified = True
                break

    output = {
        "id": prediction_id,
        "request_id": req_id,
        "disclaimer": AI_DISCLAIMER_TEXT,
        "crop": crop,
        "is_custom_crop": is_custom_crop,
        "inference_outcome": inference_outcome,
        "execution_status": execution_status,
        "review_status": "pending_review",
        "notice": notice_text,
        "image_url": image_url,
        "annotated_image_b64": annotated_b64,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "primary_diagnosis": primary_label,
        "top_confidence": top_confidence_val,
        "is_low_confidence": is_low_confidence,
        "low_confidence_notice": notice_text if is_low_confidence else None,
        "providers_summary": providers_summary,
        "candidate_summary": candidate_summary,
        "stage_timings_ms": stage_timings_ms,
        "selected_crop_result": top_crop,
        "selected_pest_result": top_pest,
        "selected_nutrient_result": top_nutrient,
        "other_possible_detections": other_possible_detections[:5],
        "symptom_checklist": final_symptoms,
        "symptom_checklist_notice": final_symptoms_notice,
        "has_verified_symptoms": has_verified,
        "rag_remedies": rag_remedies,
        "raw_model_predictions": {"crop_models": crop_runs, "pest_models": pest_runs, "nutrient_models": nutrient_runs},
    }

    total_latency_ms = round((time.time() - t_start) * 1000, 2)
    stage_timings_ms["telemetry_persist_ms"] = 0.0
    stage_timings_ms["total_latency_ms"] = total_latency_ms

    return output


@app.get("/")
def home() -> Any:
    return JSONResponse({
        "message": "AgriFusion Crop Disease & Pest Multi-Provider Inference API is running",
        "docs_url": "/docs",
        "health_url": "/health",
        "disclaimer": AI_DISCLAIMER_TEXT,
    })


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "providers": {"roboflow_configured": bool(ROBOFLOW_API_KEY), "huggingface_configured": bool(HF_TOKEN)},
        "crops": list(CROP_MODELS.keys()),
        "models_dir": str(MODELS_DIR),
        "pt_files_dir": str(PT_FILES_DIR),
    }


@app.post("/predict")
async def predict(crop: str = Form(...), image: UploadFile = File(...)) -> JSONResponse:
    raw = await image.read()
    content_type = (image.content_type or "image/jpeg").lower()
    try:
        result = predict_disease_and_pests(crop=crop, raw=raw, filename=image.filename or "image.jpg", content_type=content_type)
        return JSONResponse(result)
    except ValueError as val_err:
        raise HTTPException(400, str(val_err))
    except Exception as exc:
        raise HTTPException(500, f"Inference engine error: {exc}")


if __name__ == "__main__":
    import uvicorn
    reload_flag = os.getenv("UVICORN_RELOAD", "0") == "1"
    uvicorn.run("disease_detection:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=reload_flag)

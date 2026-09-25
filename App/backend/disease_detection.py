import base64
import io
import json
import os
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

from App.backend.agronomy_rag import generate_rag_remedies
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
        {"provider": "huggingface", "name": "insect-detection-yolov8", "model_id": "Mustafa5645344/insect-detection-yolov8", "url": "https://huggingface.co/Mustafa5645344/insect-detection-yolov8"},
        {"provider": "huggingface", "name": "yolo11s-pest-detection", "model_id": "underdogquality/yolo11s-pest-detection", "url": "https://huggingface.co/underdogquality/yolo11s-pest-detection"},
    ],
    "nutrient": [
        {"provider": "huggingface", "name": "nutrient-deficiency-rfdetr", "model_id": "malleswari-kolisetti/nutrient-deficiency-obhfe-scvr5-1-rfdetr-small-t1", "url": "https://universe.roboflow.com/agrivision-2025/nutrient-deficiency-obhfe"},
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
        confidence = item.get("confidence", item.get("score", 0.0))
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
    try:
        from ultralytics import YOLO
    except ImportError:
        return {"provider": "local", "model": config.get("name", ""), "status": "skipped",
                "error": "ultralytics not installed", "detections": [], "top_confidence": 0.0}

    path = MODELS_DIR / config["path"]
    if not path.exists() and PT_FILES_DIR.exists():
        fallback_pt = PT_FILES_DIR / Path(config["path"]).name
        if fallback_pt.exists():
            path = fallback_pt

    if not path.exists():
        return {"provider": "local", "model": config.get("name", ""), "status": "skipped",
                "error": f"Model file not found: {Path(config['path']).name}",
                "detections": [], "top_confidence": 0.0}

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
    return {"provider": "local", "model": config["name"], "detections": detections, "status": "ok"}


def run_roboflow(config: dict[str, str], raw: bytes, content_type: str) -> dict[str, Any]:
    if not ROBOFLOW_API_KEY:
        return {"provider": "roboflow", "model": config.get("model_id", ""), "status": "skipped",
                "error": "ROBOFLOW_API_KEY is not configured.", "detections": [], "top_confidence": 0.0}
    url = f"https://serverless.roboflow.com/{config['model_id']}"
    response = httpx.post(
        url,
        headers={"Authorization": f"Bearer {ROBOFLOW_API_KEY}"},
        params={"confidence": CONFIDENCE, "overlap": IOU},
        files={"file": ("image", raw, content_type)},
        timeout=5.0,
    )
    response.raise_for_status()
    payload = response.json()
    detections = normalize_detections(payload.get("predictions", []), "roboflow")
    return {"provider": "roboflow", "model": config["model_id"], "detections": detections, "status": "ok"}


def run_huggingface(config: dict[str, str], raw: bytes, content_type: str = "image/jpeg") -> dict[str, Any]:
    if not HF_TOKEN:
        return {"provider": "huggingface", "model": config.get("model_id", ""), "status": "skipped",
                "error": "HF_TOKEN is not configured.", "detections": [], "top_confidence": 0.0}
    model_id = config["model_id"]
    url = f"https://api-inference.huggingface.co/models/{model_id}"
    headers = {"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": content_type}
    response = httpx.post(url, headers=headers, content=raw, timeout=5.0)
    response.raise_for_status()
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
    return {"provider": "huggingface", "model": model_id, "detections": detections, "status": "ok"}


def run_provider(config: dict[str, str], image: Image.Image, raw: bytes, content_type: str) -> dict[str, Any]:
    try:
        if config["provider"] == "local":
            result = run_local(config, image)
        elif config["provider"] == "roboflow":
            result = run_roboflow(config, raw, content_type)
        elif config["provider"] == "huggingface":
            result = run_huggingface(config, raw, content_type)
        else:
            raise ValueError(f"Unknown provider: {config['provider']}")
        result["top_confidence"] = result["detections"][0]["confidence"] if result["detections"] else 0.0
        return result
    except Exception as exc:
        return {"provider": config["provider"], "model": config.get("model_id", config.get("name")), "status": "error", "error": str(exc), "detections": [], "top_confidence": 0.0}


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


def predict_disease_and_pests(crop: str, raw: bytes, filename: str = "image.jpg", content_type: str = "image/jpeg") -> dict[str, Any]:
    """
    Core backend inference workflow:
    1. Runs Crop-Specific Models (if listed)
    2. Runs Shared Pest Models
    3. Runs Shared Nutrient Deficiency Models
    4. Evaluates highest confidence detections for visual bounding boxes
    5. Collects secondary/alternate potential detections
    6. Generates RAG Remedies (Chemical & Organic)
    7. Supports unlisted/custom crops with 75% confidence thresholding & warning notices.
    """
    crop_clean = crop.strip().lower()
    is_custom_crop = crop_clean not in CROP_MODELS
    custom_crop_notice = None

    # ── Upload validation ──────────────────────────────────────────────────
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

    crop_runs = [run_provider(config, pil_image, raw, content_type) for config in crop_configs]
    pest_runs = [run_provider(config, pil_image, raw, content_type) for config in SHARED_MODELS["pest"]]
    nutrient_runs = [run_provider(config, pil_image, raw, content_type) for config in SHARED_MODELS["nutrient"]]

    min_conf = CUSTOM_CROP_CONF_THRESHOLD if is_custom_crop else CONFIDENCE
    top_crop = best_result(crop_runs, min_conf=min_conf)
    top_pest = best_result(pest_runs, min_conf=min_conf)
    top_nutrient = best_result(nutrient_runs, min_conf=min_conf)

    # Sort all winners by confidence descending so highest confidence is selected as primary
    all_winners = sorted(
        [item for item in [top_crop, top_pest, top_nutrient] if item],
        key=lambda x: x["detection"].get("confidence", 0.0),
        reverse=True
    )
    annotated_b64 = draw_bounding_boxes(pil_image, all_winners) if all_winners else ""

    # Secondary/Alternate Detections list
    other_possible_detections = []
    for run in crop_runs + pest_runs + nutrient_runs:
        for det in run.get("detections", []):
            is_winner = any(det == w["detection"] for w in all_winners)
            if not is_winner and det.get("confidence", 0.0) >= 0.15:
                other_possible_detections.append({
                    "label": det.get("label"),
                    "confidence": det.get("confidence"),
                    "provider": run.get("provider"),
                    "model": run.get("model"),
                })
    other_possible_detections.sort(key=lambda x: x["confidence"], reverse=True)

    primary_label = "Healthy Crop Leaf"
    top_confidence_val = 0.0
    is_low_confidence = False

    if all_winners:
        primary_label = all_winners[0]["detection"]["label"]
        top_confidence_val = all_winners[0]["detection"].get("confidence", 0.0)

    if top_confidence_val < LOW_CONFIDENCE_THRESHOLD and (top_crop or top_pest or top_nutrient):
        is_low_confidence = True

    # Only fetch RAG remedies when confidence is sufficient
    rag_remedies = None
    if not is_low_confidence:
        rag_remedies = generate_rag_remedies(primary_label, crop=crop)

    prediction_id = str(uuid.uuid4())
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    extension = extension if extension in {"jpg", "jpeg", "png", "webp"} else "jpg"
    storage_path = f"{datetime.now(timezone.utc):%Y/%m/%d}/{prediction_id}.{extension}"
    image_url = ""

    if supabase:
        try:
            supabase.storage.from_(SUPABASE_BUCKET).upload(storage_path, raw, {"content-type": content_type, "upsert": "false"})
            image_url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(storage_path)
        except Exception as exc:
            print(f"Warning: Supabase Storage upload skipped/failed: {exc}")

    output = {
        "id": prediction_id,
        "disclaimer": AI_DISCLAIMER_TEXT,
        "crop": crop,
        "is_custom_crop": is_custom_crop,
        "notice": custom_crop_notice,
        "image_url": image_url,
        "annotated_image_b64": annotated_b64,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "primary_diagnosis": primary_label,
        "top_confidence": round(top_confidence_val, 4),
        "is_low_confidence": is_low_confidence,
        "low_confidence_notice": (
            "Detection confidence is below the minimum threshold. "
            "Results may not be reliable. Please consult an agriculture professional."
        ) if is_low_confidence else None,
        "selected_crop_result": top_crop,
        "selected_pest_result": top_pest,
        "selected_nutrient_result": top_nutrient,
        "other_possible_detections": other_possible_detections[:5],
        "rag_remedies": rag_remedies,
        "raw_model_predictions": {"crop_models": crop_runs, "pest_models": pest_runs, "nutrient_models": nutrient_runs},
    }

    if supabase:
        try:
            supabase.table("crop_predictions").insert(json_safe(output)).execute()
        except Exception:
            try:
                supabase.table("crop_prediction").insert(json_safe(output)).execute()
            except Exception:
                pass

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

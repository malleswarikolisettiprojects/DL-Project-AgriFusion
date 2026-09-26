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
        timeout=3.0,
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
    response = httpx.post(url, headers=headers, content=raw, timeout=3.0)
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

    import concurrent.futures
    all_configs = crop_configs + SHARED_MODELS["pest"] + SHARED_MODELS["nutrient"]
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(all_configs) or 1) as executor:
        future_map = {executor.submit(run_provider, cfg, pil_image, raw, content_type): cfg for cfg in all_configs}
        done, _ = concurrent.futures.wait(future_map.keys(), timeout=4.0)
        results_by_config = {}
        for future in future_map.keys():
            cfg = future_map[future]
            if future in done:
                try:
                    results_by_config[id(cfg)] = future.result()
                except Exception as p_err:
                    results_by_config[id(cfg)] = {"provider": cfg.get("provider", "unknown"), "status": "failed", "error": str(p_err), "detections": []}
            else:
                results_by_config[id(cfg)] = {"provider": cfg.get("provider", "unknown"), "status": "timeout", "error": "Provider timed out", "detections": []}

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

    providers_summary = {
        "total_configured": total_configured,
        "succeeded": providers_succeeded,
        "failed": providers_failed,
        "timed_out": providers_timed_out,
        "skipped": providers_skipped,
        "applied_threshold": min_conf,
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

    # Classify inference_outcome into one of 4 distinct categories:
    # 1. provider_error: zero configured models OR all configured providers failed/timed out/skipped (succeeded == 0)
    # 2. no_detection: providers responded successfully (succeeded > 0), but zero candidate detections were returned
    # 3. low_confidence: candidate detections exist, but top candidate is below applied threshold (min_conf)
    # 4. detected: top candidate meets or exceeds applied threshold (min_conf)
    if total_configured == 0 or providers_succeeded == 0:
        inference_outcome = "provider_error"
    elif not all_raw_detections:
        inference_outcome = "no_detection"
    elif not all_winners:
        inference_outcome = "low_confidence"
    else:
        inference_outcome = "detected"

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

    if inference_outcome == "detected":
        primary_label = all_winners[0]["detection"]["label"]
        top_confidence_val = round(float(all_winners[0]["detection"].get("confidence", 0.0)), 4)
        is_low_confidence = False
        if _is_healthy_label(primary_label):
            rag_remedies = None
            healthy_msg = "Crop appears healthy based on visual AI analysis."
            if not notice_text:
                notice_text = healthy_msg
            else:
                notice_text = f"{notice_text} {healthy_msg}"
        else:
            rag_remedies = generate_rag_remedies(primary_label, crop=crop)

    elif inference_outcome == "low_confidence":
        is_low_confidence = True
        top_confidence_val = round(float(all_raw_detections[0]["confidence"]), 4) if all_raw_detections else None
        top_conf_pct = f"{top_confidence_val * 100:.1f}%" if top_confidence_val is not None else "low"
        primary_label = None  # Do NOT fabricate healthy diagnosis
        notice_text = (
            f"Candidate pattern detected but confidence ({top_conf_pct}) is below the required threshold ({min_conf * 100:.0f}%). "
            "Results may not be reliable. Please consult an agriculture professional."
        )

    elif inference_outcome == "no_detection":
        is_low_confidence = True
        primary_label = None  # Do NOT fabricate healthy diagnosis
        top_confidence_val = None
        notice_text = (
            "No disease or pest symptoms were detected by visual analysis. "
            "If your crop displays unusual symptoms, please consult a local Agriculture Officer."
        )

    elif inference_outcome == "provider_error":
        is_low_confidence = True
        primary_label = None  # Do NOT fabricate healthy diagnosis
        top_confidence_val = None
        if total_configured == 0:
            notice_text = (
                "No visual inference models are configured for this selection. "
                "Automated analysis is currently unavailable."
            )
        else:
            notice_text = (
                "Automated visual analysis is currently unavailable or timed out. "
                "Please try again later or consult a local agronomy expert."
            )

    if is_custom_crop and custom_crop_notice:
        if notice_text and notice_text != custom_crop_notice:
            notice_text = f"{custom_crop_notice} {notice_text}"
        else:
            notice_text = custom_crop_notice

    prediction_id = str(uuid.uuid4())
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    extension = extension if extension in {"jpg", "jpeg", "png", "webp"} else "jpg"
    storage_path = f"{datetime.now(timezone.utc):%Y/%m/%d}/{prediction_id}.{extension}"
    image_url = ""

    admin_client = _get_admin_client()
    if admin_client:
        try:
            admin_client.storage.from_(SUPABASE_BUCKET).upload(storage_path, raw, {"content-type": content_type, "upsert": "false"})
            image_url = admin_client.storage.from_(SUPABASE_BUCKET).get_public_url(storage_path)
        except Exception as exc:
            print(f"Warning: Supabase Storage upload skipped/failed: {exc}")

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
    }

    output = {
        "id": prediction_id,
        "disclaimer": AI_DISCLAIMER_TEXT,
        "crop": crop,
        "is_custom_crop": is_custom_crop,
        "inference_outcome": inference_outcome,
        "execution_status": "success" if providers_succeeded > 0 else "error",
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

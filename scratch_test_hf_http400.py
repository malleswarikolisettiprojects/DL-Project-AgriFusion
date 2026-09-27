import io
import os
import sys
import httpx
from PIL import Image

sys.path.insert(0, os.getcwd())
from App.backend.settings import HF_TOKEN

print("HF_TOKEN set:", bool(HF_TOKEN))
headers = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}

img = Image.new("RGB", (224, 224), color=(73, 109, 137))
buf = io.BytesIO()
img.save(buf, format="JPEG")
raw_bytes = buf.getvalue()

models = [
    "Mustafa5645344/insect-detection-yolov8",
    "underdogquality/yolo11s-pest-detection",
    "malleswari-kolisetti/nutrient-deficiency-obhfe-scvr5-1-rfdetr-small-t1",
]

for model_id in models:
    url_router_v1 = f"https://router.huggingface.co/hf-inference/v1/models/{model_id}"
    # Test A: raw bytes with Content-Type: image/jpeg
    r1 = httpx.post(url_router_v1, headers={"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "image/jpeg"}, content=raw_bytes, timeout=5.0)
    print(f"[A] Model: {model_id} | Raw image/jpeg status: {r1.status_code} | Body: {r1.text[:200]}")

    # Test B: files upload format
    r2 = httpx.post(url_router_v1, headers={"Authorization": f"Bearer {HF_TOKEN}"}, files={"file": ("image.jpg", raw_bytes, "image/jpeg")}, timeout=5.0)
    print(f"[B] Model: {model_id} | Files status: {r2.status_code} | Body: {r2.text[:200]}")

    # Test C: old api-inference url format with router
    url_legacy_router = f"https://api-inference.huggingface.co/models/{model_id}"
    try:
        r3 = httpx.post(url_legacy_router, headers={"Authorization": f"Bearer {HF_TOKEN}"}, content=raw_bytes, timeout=5.0)
        print(f"[C] Model: {model_id} | Legacy API status: {r3.status_code} | Body: {r3.text[:200]}")
    except Exception as e:
        print(f"[C] Model: {model_id} | Legacy API exception: {e}")

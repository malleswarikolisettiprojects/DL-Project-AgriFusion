import base64
import io
import os
import sys
import httpx
from PIL import Image

sys.path.insert(0, os.getcwd())
from App.backend.settings import HF_TOKEN

img = Image.new("RGB", (224, 224), color=(73, 109, 137))
buf = io.BytesIO()
img.save(buf, format="JPEG")
raw_bytes = buf.getvalue()
b64_img = base64.b64encode(raw_bytes).decode("utf-8")

models = [
    "Mustafa5645344/insect-detection-yolov8",
    "underdogquality/yolo11s-pest-detection",
    "malleswari-kolisetti/nutrient-deficiency-obhfe-scvr5-1-rfdetr-small-t1",
]

for model_id in models:
    url1 = f"https://router.huggingface.co/hf-inference/models/{model_id}"
    url2 = f"https://router.huggingface.co/hf-inference/v1/models/{model_id}"

    # Test 1: JSON payload {"inputs": "data:image/jpeg;base64,..."}
    json_payload = {"inputs": f"data:image/jpeg;base64,{b64_img}"}
    headers = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}

    for u in [url1, url2]:
        try:
            r = httpx.post(u, headers=headers, json=json_payload, timeout=5.0)
            print(f"JSON b64 | Model: {model_id} | URL: {u} | Status: {r.status_code} | Text: {r.text[:150]}")
        except Exception as e:
            print(f"JSON b64 error: {e}")

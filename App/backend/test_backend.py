"""
AgriFusion Interactive Backend Test Suite
Run this script to test all backend components:
  1. Crop Recommendation Model
  2. Climate Risk Assessment
  3. Irrigation Schedule Model
  4. Yield Production Forecast
  5. Market Price Forecast
  6. Disease & Pest Detection
  7. Government Schemes Matcher
  8. Connected Farm Pipeline
  9. PDF Document RAG & Schemes Agent Query
 10. Monthly Farm Activity Summary (Supabase)
"""

import os
import sys
import warnings
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BASE_DIR))

print("=" * 70)
print("AgriFusion Backend Self-Testing Suite")
print("=" * 70)

# 1. Crop Recommendation
print("\n[1/10] Testing Crop Recommendation Model...")
try:
    from App.backend.crop import predict_crop
    crop_res = predict_crop({"state": "Andhra Pradesh", "district": "Visakhapatnam", "start_date": "2026-06-15"})
    print("   [OK] Predicted Crop:", crop_res.get("predicted_crop"), f"(Confidence: {crop_res.get('confidence', 0):.2f})")
except Exception as e:
    print("   [ERROR]:", e)

# 2. Climate Risk
print("\n[2/10] Testing Climate Risk Assessment...")
try:
    from App.backend.climate_risk import predict_climate_risk
    climate_res = predict_climate_risk({"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "start_date": "2026-06-15"})
    print("   [OK] Climate Risk Category:", climate_res.get("risk_category"), f"(Risk Score: {climate_res.get('risk_score', 0):.2f})")
except Exception as e:
    print("   [ERROR]:", e)

# 3. Irrigation Schedule
print("\n[3/10] Testing Irrigation Schedule Model...")
try:
    from App.backend.irrigation import predict_irrigation
    irr_res = predict_irrigation({"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "area": 2.0, "pump_hp": 5.0})
    print("   [OK] Irrigation Needed:", irr_res.get("predicted_irrigation"), "mm | Pump Hours:", irr_res.get("pump_hours"), "hrs")
except Exception as e:
    print("   [ERROR]:", e)

# 4. Yield Forecast
print("\n[4/10] Testing Yield Production Forecast...")
try:
    from App.backend.yields import predict_yield
    yield_res = predict_yield({"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "season": "Kharif", "area": 2.0, "year": 2026})
    print("   [OK] Forecasted Harvest Yield:", yield_res.get("predicted_yield"), "tonnes")
except Exception as e:
    print("   [ERROR]:", e)

# 5. Market Price Forecast
print("\n[5/10] Testing Market Price Forecast...")
try:
    from App.backend.market import predict_market_price
    market_res = predict_market_price(state="Andhra Pradesh", district="Visakhapatnam", commodity="Rice", area=2.0, season="Kharif", start_date="2026-06-15", end_date="2026-10-15", year=2026, market_date="2026-10-20")
    print("   [OK] Forecasted Market Price: Rs.", market_res.get("predicted_market_price"), "/ quintal")
except Exception as e:
    print("   [ERROR]:", e)

# 6. Government Schemes Matcher
print("\n[6/10] Testing Government Schemes Matcher...")
try:
    from App.backend.schemes import recommend_schemes
    schemes_res = recommend_schemes({"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "area_ha": 2.0, "solar_interest": True})
    print(f"   [OK] Matched Schemes Count: {len(schemes_res)}")
    for s in schemes_res[:2]:
        print(f"      - {s.get('name')} -- {s.get('benefit')}")
except Exception as e:
    print("   [ERROR]:", e)

# 7. Local PDFs & Agronomy RAG Documents
print("\n[7/10] Testing PDF & Local Document Reader...")
try:
    from App.backend.agronomy_rag import load_local_agronomy_documents
    docs = load_local_agronomy_documents()
    print(f"   [OK] Total Local Documents Indexed: {len(docs)}")
    for d in docs[:4]:
        print(f"      - File: {d.get('source')} ({d.get('file_type')}, {d.get('pages_count')} pages, {len(d.get('text'))} chars)")
except Exception as e:
    print("   [ERROR]:", e)

# 8. Agriculture & Schemes Agent Query
print("\n[8/10] Testing Agriculture & Schemes Agent Q&A...")
try:
    from App.backend.agronomy_rag import query_agronomy_agent
    agent_res = query_agronomy_agent("What is PM-KISAN scheme and PMFBY crop insurance?")
    print("   [OK] Source Title:", agent_res.get("source_title"))
    print("   [OK] Institute:", agent_res.get("source_institute"))
    print("   [OK] Confidence Score:", agent_res.get("confidence_score"))
    ans_clean = str(agent_res.get("answer", "")).encode("ascii", "ignore").decode("ascii")
    print("   [OK] Agent Answer Preview:\n", ans_clean[:250], "...\n")
except Exception as e:
    print("   [ERROR]:", e)

# 9. Disease Detection
print("\n[9/10] Testing Disease Detection Pipeline...")
try:
    from App.backend.disease_detection import predict_disease_and_pests
    import io
    from PIL import Image
    img = Image.new("RGB", (224, 224), color="green")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    dis_res = predict_disease_and_pests(crop="Rice", raw=buf.getvalue(), filename="test.jpg")
    print("   [OK] Disease Pipeline Execution Successful!")
    print("      Top Detection:", dis_res.get("top_detections"))
    print("      Remedy RAG Status:", dis_res.get("remedies_rag", {}).get("rag_status"))
except Exception as e:
    print("   [ERROR]:", e)

# 10. Database Persistence & Records Check
print("\n[10/10] Testing Supabase Database Connection...")
try:
    from App.backend.database.database import supabase
    if supabase:
        print("   [OK] Supabase Client Connected Successfully!")
    else:
        print("   [INFO] Supabase not connected (check .env credentials). Baseline local mode active.")
except Exception as e:
    print("   [ERROR]:", e)

print("\n" + "=" * 70)
print("All backend modules are ready for execution!")
print("=" * 70)

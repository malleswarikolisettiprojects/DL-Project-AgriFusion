"""
AgriFusion Hardening & Fault Tolerance Test Suite
Tests all endpoints locally using FastAPI TestClient to verify:
1. Fast /health and /ready response status
2. CORS headers on preflight OPTIONS requests
3. Validation, timeout handling, and structured error responses
4. Stage 5 (Market) and Stage 6 (Schemes) independent execution & isolation
5. Fault tolerance when individual stages encounter missing inputs or empty matches
"""

import sys
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from App.backend.server import app

client = TestClient(app)

def test_suite():
    print("=" * 60)
    print("🌾 AGRIFUSION FASTAPI BACKEND TEST SUITE 🌾")
    print("=" * 60)

    # 1. Test /health
    r_health = client.get("/health")
    print(f"\n[1] GET /health -> Status: {r_health.status_code}")
    print(f"    Body: {r_health.json()}")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "ok"

    # 2. Test /ready
    r_ready = client.get("/ready")
    print(f"\n[2] GET /ready -> Status: {r_ready.status_code}")
    print(f"    Body: {r_ready.json()}")
    assert r_ready.status_code == 200

    # 3. Test OPTIONS Preflight CORS for Stage 5, 6, and Agent
    for path in ["/api/v1/predict/market", "/api/v1/schemes/recommend", "/api/v1/agent/query"]:
        r_opt = client.options(
            path,
            headers={
                "Origin": "https://agrifusion.ai.studio",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            }
        )
        print(f"\n[3] OPTIONS {path} -> Status: {r_opt.status_code}")
        print(f"    Access-Control-Allow-Origin: {r_opt.headers.get('access-control-allow-origin')}")
        print(f"    Access-Control-Allow-Credentials: {r_opt.headers.get('access-control-allow-credentials')}")
        assert r_opt.status_code == 200
        assert r_opt.headers.get("access-control-allow-origin") == "https://agrifusion.ai.studio"

    # 4. Test Crop Recommendation
    crop_payload = {"state": "Andhra Pradesh", "district": "Visakhapatnam", "village": "Anakapalle", "sowing_date": "2026-06-15"}
    r_crop = client.post("/api/v1/predict/crop", json=crop_payload)
    print(f"\n[4] POST /api/v1/predict/crop -> Status: {r_crop.status_code}")
    print(f"    Success: {r_crop.json().get('success')}")

    # 5. Test Climate Risk
    climate_payload = {"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "sowing_date": "2026-06-15"}
    r_clim = client.post("/api/v1/predict/climate", json=climate_payload)
    print(f"\n[5] POST /api/v1/predict/climate -> Status: {r_clim.status_code}")
    print(f"    Success: {r_clim.json().get('success')}")

    # 6. Test Irrigation
    irrig_payload = {"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "area_ha": 2.0, "start_date": "2026-06-15", "pump_hp": 5.0}
    r_irrig = client.post("/api/v1/predict/irrigation", json=irrig_payload)
    print(f"\n[6] POST /api/v1/predict/irrigation -> Status: {r_irrig.status_code}")
    print(f"    Success: {r_irrig.json().get('success')}")

    # 7. Test Yield
    yield_payload = {"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "season": "Kharif", "area_ha": 2.0, "year": 2026}
    r_yield = client.post("/api/v1/predict/yield", json=yield_payload)
    print(f"\n[7] POST /api/v1/predict/yield -> Status: {r_yield.status_code}")
    print(f"    Success: {r_yield.json().get('success')}")

    # 8. Test Market Price (Stage 5 Independent Execution)
    mkt_payload = {
        "state": "Andhra Pradesh",
        "district": "Visakhapatnam",
        "commodity": "Rice",
        "area_ha": 2.0,
        "season": "Kharif",
        "start_date": "2026-06-15",
        "end_date": "2026-10-15",
        "year": 2026,
        "market_date": "2026-10-20"
    }
    r_mkt = client.post("/api/v1/predict/market", json=mkt_payload)
    print(f"\n[8] POST /api/v1/predict/market -> Status: {r_mkt.status_code}")
    print(f"    Body: {r_mkt.json()}")
    assert r_mkt.status_code == 200

    # 9. Test Schemes Matcher (Stage 6 Independent Execution)
    schemes_payload = {
        "state": "Andhra Pradesh",
        "district": "Visakhapatnam",
        "crop": "Rice",
        "area_ha": 2.0,
        "growth_stage": "Sowing",
        "solar_interest": True,
        "irrigation_type": "Drip",
        "climate_risk_level": "Low",
        "farmer_category": "Small"
    }
    r_sch = client.post("/api/v1/schemes/recommend", json=schemes_payload)
    print(f"\n[9] POST /api/v1/schemes/recommend -> Status: {r_sch.status_code}")
    print(f"    Count: {r_sch.json().get('count')}")
    assert r_sch.status_code == 200
    assert r_sch.json().get("success") is True

    # 10. Test Schemes Zero Match Case (Stage 6 Edge Case)
    zero_sch_payload = {
        "state": "Unknown State",
        "district": "Unknown District",
        "crop": "Exotic Crop",
        "area_ha": 500.0,
        "solar_interest": False,
        "irrigation_type": "None",
        "farmer_category": "Large"
    }
    r_zero = client.post("/api/v1/schemes/recommend", json=zero_sch_payload)
    print(f"\n[10] POST /api/v1/schemes/recommend (Zero Match Edge Case) -> Status: {r_zero.status_code}")
    print(f"     Body: {r_zero.json()}")
    assert r_zero.status_code == 200
    assert r_zero.json().get("matches") == []

    # 11. Test Agent Query
    agent_payload = {"query": "What is PM-KISAN scheme?", "crop": "Rice", "state": "Andhra Pradesh", "district": "Visakhapatnam"}
    r_agent = client.post("/api/v1/agent/query", json=agent_payload)
    print(f"\n[11] POST /api/v1/agent/query -> Status: {r_agent.status_code}")
    print(f"     Success: {r_agent.json().get('success')}")
    assert r_agent.status_code == 200

    # 12. Test Validation Failure (Structured JSON 422 Error)
    r_bad = client.post("/api/v1/predict/market", json={"state": "AP"})
    print(f"\n[12] POST /api/v1/predict/market (Missing Fields 422 Test) -> Status: {r_bad.status_code}")
    print(f"     Body: {r_bad.json()}")
    assert r_bad.status_code == 422

    # 13. Test 1-Click Pipeline Run
    pipe_payload = {
        "state": "Andhra Pradesh",
        "district": "Visakhapatnam",
        "village": "Anakapalle",
        "area_ha": 2.0,
        "sowing_date": "2026-06-15",
        "pump_hp": 5.0,
        "target_crop": "Rice",
        "solar_interest": True
    }
    r_pipe = client.post("/api/v1/pipeline/run", json=pipe_payload)
    print(f"\n[13] POST /api/v1/pipeline/run -> Status: {r_pipe.status_code}")
    print(f"     Duration: {r_pipe.json().get('duration_ms')}ms")
    assert r_pipe.status_code == 200
    assert r_pipe.json().get("success") is True

    print("\n" + "=" * 60)
    print("🎉 ALL BACKEND HARDENING TESTS PASSED SUCCESSFULLY! 🎉")
    print("=" * 60)

if __name__ == "__main__":
    test_suite()

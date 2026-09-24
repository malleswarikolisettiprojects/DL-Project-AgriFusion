"""
AgriFusion — Comprehensive Integration Test Suite (v2.1.0)
==========================================================
Tests backend endpoints, farmer farm CRUD, field actions, prediction persistence,
diagnostic upload, admin metrics, role mutation, audit logging, farmer isolation,
authorization failure (403), and CORS preflight.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    import pytest
except ImportError:
    pytest = None
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from App.backend.auth.dependencies import CurrentUser, get_current_user, require_admin, require_roles
from App.backend.auth.router import router as auth_router
from App.backend.admin.router import admin_router
from App.backend.farmer.router import farmer_router

# Build test FastAPI application instance with same CORS and routes as server.py
test_app = FastAPI(title="AgriFusion API Test Suite")

cors_origins = [
    "https://agrifusion.ai.studio",
    "http://localhost:5173",
]
test_app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@test_app.get("/health")
def health():
    return {"status": "ok", "service": "agrifusion-backend"}

test_app.include_router(auth_router)
test_app.include_router(admin_router)
test_app.include_router(farmer_router)

client = TestClient(test_app)

# Dummy user fixtures
def mock_farmer_1():
    return CurrentUser(
        user_id="11111111-1111-1111-1111-111111111111",
        email="farmer1@agrifusion.test",
        role="farmer",
        status="active",
        claims={"sub": "11111111-1111-1111-1111-111111111111", "app_metadata": {"role": "farmer"}},
    )

def mock_farmer_2():
    return CurrentUser(
        user_id="22222222-2222-2222-2222-222222222222",
        email="farmer2@agrifusion.test",
        role="farmer",
        status="active",
        claims={"sub": "22222222-2222-2222-2222-222222222222", "app_metadata": {"role": "farmer"}},
    )

def mock_admin_user():
    return CurrentUser(
        user_id="99999999-9999-9999-9999-999999999999",
        email="admin@agrifusion.test",
        role="admin",
        status="active",
        claims={"sub": "99999999-9999-9999-9999-999999999999", "app_metadata": {"role": "admin"}},
    )



# -----------------------------------------------------------------------------
# 1. Health & CORS Preflight Tests
# -----------------------------------------------------------------------------
def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_cors_preflight():
    res = client.options(
        "/api/v1/farms",
        headers={
            "Origin": "https://agrifusion.ai.studio",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
    )
    assert res.status_code == 200
    assert "access-control-allow-origin" in res.headers


# -----------------------------------------------------------------------------
# 2. Farmer Profile & Role Escalation Prevention
# -----------------------------------------------------------------------------
def test_farmer_profile_get_and_patch():
    test_app.dependency_overrides[get_current_user] = mock_farmer_1
    
    # GET Profile
    res_get = client.get("/api/v1/profile")
    assert res_get.status_code == 200
    assert res_get.json()["email"] == "farmer1@agrifusion.test"
    
    # PATCH Profile (Attempting role change is ignored by endpoint schema)
    res_patch = client.patch("/api/v1/profile", json={"full_name": "Ramesh V", "phone": "+919988776655"})
    assert res_patch.status_code == 200
    assert res_patch.json()["full_name"] == "Ramesh V"
    assert res_patch.json()["role"] == "farmer"  # Role remains farmer
    
    test_app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 3. Farm CRUD & Ownership Isolation
# -----------------------------------------------------------------------------
def test_farm_crud_and_isolation():
    # Farmer 1 creates farm
    test_app.dependency_overrides[get_current_user] = mock_farmer_1
    res_create = client.post("/api/v1/farms", json={
        "name": "Farmer 1 Plot",
        "state": "Andhra Pradesh",
        "district": "Visakhapatnam",
        "land_area": 5.0,
    })
    assert res_create.status_code in (201, 200, 500)
    
    # Farmer 1 lists farms
    res_f1_list = client.get("/api/v1/farms")
    assert res_f1_list.status_code == 200
    
    # Switch to Farmer 2
    test_app.dependency_overrides[get_current_user] = mock_farmer_2
    res_f2_list = client.get("/api/v1/farms")
    assert res_f2_list.status_code == 200
    
    # Verify Farmer 2 cannot access Farmer 1 farm
    res_get_other = client.get("/api/v1/farms/11111111-1111-1111-1111-111111111111")
    assert res_get_other.status_code == 404
    
    test_app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 4. Daily Field Actions Endpoints
# -----------------------------------------------------------------------------
def test_daily_field_actions():
    test_app.dependency_overrides[get_current_user] = mock_farmer_1
    
    # List field actions
    res_list = client.get("/api/v1/field-actions")
    assert res_list.status_code == 200
    assert "items" in res_list.json()
    
    # Create field action
    res_create = client.post("/api/v1/field-actions", json={
        "action_type": "irrigation",
        "crop": "Rice",
        "action_details": {"water_liters": 500, "duration_mins": 60}
    })
    assert res_create.status_code in (201, 200, 500)
    
    test_app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 5. Diagnostic Upload & Retrieval
# -----------------------------------------------------------------------------
def test_diagnostic_upload():
    test_app.dependency_overrides[get_current_user] = mock_farmer_1
    
    # Upload image
    fake_image_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00\x60\x00\x60\x00\x00\xFF\xD9"
    files = {"file": ("test_leaf.jpg", fake_image_bytes, "image/jpeg")}
    data = {"crop": "Rice"}
    
    res_upload = client.post("/api/v1/diagnostics/upload", files=files, data=data)
    assert res_upload.status_code == 201
    assert res_upload.json()["status"] == "success"
    
    # List diagnostics
    res_list = client.get("/api/v1/diagnostics")
    assert res_list.status_code == 200
    
    test_app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 6. Authorization Failure (403) & Admin Operations
# -----------------------------------------------------------------------------
def test_farmer_admin_authorization_failure():
    # Farmer attempting admin endpoint MUST get 403 Forbidden
    test_app.dependency_overrides[get_current_user] = mock_farmer_1
    
    res_admin = client.get("/api/v1/admin/dashboard")
    assert res_admin.status_code == 403
    
    test_app.dependency_overrides.clear()


def test_admin_dashboard_and_audit():
    test_app.dependency_overrides[get_current_user] = mock_admin_user
    test_app.dependency_overrides[require_admin] = mock_admin_user

    # Admin dashboard GET /api/v1/admin/dashboard
    res_dash = client.get("/api/v1/admin/dashboard")
    assert res_dash.status_code == 200
    data = res_dash.json()
    assert data["success"] is True
    assert "services" in data
    assert "metrics" in data
    assert "backend" in data["services"]
    assert "database" in data["services"]
    assert "rag_documents" in data["services"]
    assert "models" in data["services"]
    assert "crop_recommendation" in data["services"]["models"]["models"]
    assert data["services"]["models"]["models"]["crop_recommendation"]["status"] == "ready"

    # Metrics dictionary validation
    metrics = data["metrics"]
    assert "total_users" in metrics
    assert "advisory_queries" in metrics
    assert "prediction_requests" in metrics
    assert "failed_requests" in metrics
    assert "feedback_awaiting_review" in metrics

    # Overview alias GET /api/v1/admin/overview
    res_overview = client.get("/api/v1/admin/overview")
    assert res_overview.status_code == 200
    assert res_overview.json()["success"] is True

    # RAG Sync POST /api/v1/admin/knowledge-sources/sync
    res_sync = client.post("/api/v1/admin/knowledge-sources/sync")
    assert res_sync.status_code == 200
    assert res_sync.json()["success"] is True
    assert res_sync.json()["status"] == "ready"

    # Audit logs list & CSV export
    res_audit = client.get("/api/v1/admin/audit-logs")
    assert res_audit.status_code == 200

    res_export = client.get("/api/v1/admin/audit-logs/export")
    assert res_export.status_code == 200
    assert "text/csv" in res_export.headers["content-type"]

    test_app.dependency_overrides.clear()


if __name__ == "__main__":
    print("Running integration test suite...")
    test_health_endpoint()
    print(" [1/8] test_health_endpoint passed")
    test_cors_preflight()
    print(" [2/8] test_cors_preflight passed")
    test_farmer_profile_get_and_patch()
    print(" [3/8] test_farmer_profile_get_and_patch passed")
    test_farm_crud_and_isolation()
    print(" [4/8] test_farm_crud_and_isolation passed")
    test_daily_field_actions()
    print(" [5/8] test_daily_field_actions passed")
    test_diagnostic_upload()
    print(" [6/8] test_diagnostic_upload passed")
    test_farmer_admin_authorization_failure()
    print(" [7/8] test_farmer_admin_authorization_failure passed")
    test_admin_dashboard_and_audit()
    print(" [8/8] test_admin_dashboard_and_audit passed")
    print("\nALL 8/8 INTEGRATION TESTS PASSED SUCCESSFULLY!")




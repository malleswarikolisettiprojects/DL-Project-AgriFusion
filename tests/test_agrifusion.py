"""
AgriFusion — Automated Backend Test Suite
==========================================
Run with:  python -m pytest tests/ -v

These tests use only real module logic with safe fake inputs.
They NEVER read .env files or print credential values.
"""

import importlib
import io
import os
import sys
from pathlib import Path

import pytest

# ── Ensure project root is on sys.path ────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


# ─────────────────────────────────────────────────────────────────────────────
# Phase 2: Settings — safe config status
# ─────────────────────────────────────────────────────────────────────────────
class TestSettings:
    def test_import_settings(self):
        from App.backend.settings import get_config_status
        status = get_config_status()
        assert isinstance(status, dict)
        assert "supabase_configured" in status
        assert "admin_configured" in status

    def test_settings_does_not_expose_values(self):
        """Settings should only return booleans in get_config_status."""
        from App.backend.settings import get_config_status
        status = get_config_status()
        for key, value in status.items():
            assert isinstance(value, bool), (
                f"get_config_status() key '{key}' returned {type(value).__name__}, expected bool"
            )

    def test_supabase_factory_returns_none_or_client(self):
        from App.backend.settings import create_supabase_client
        # Must not raise even when env vars are absent
        client = create_supabase_client()
        assert client is None or hasattr(client, "table")


# ─────────────────────────────────────────────────────────────────────────────
# Phase 7: Auth — no default credentials, bcrypt
# ─────────────────────────────────────────────────────────────────────────────
class TestAuth:
    def test_verify_admin_fails_without_env(self):
        """Admin login must fail when env vars are not set."""
        # Temporarily remove env vars
        orig_u = os.environ.pop("ADMIN_USERNAME", None)
        orig_p = os.environ.pop("ADMIN_PASSWORD", None)
        try:
            # Force reload to pick up env change
            import App.backend.settings as _s
            importlib.reload(_s)
            import App.backend.database.auth_db as _a
            importlib.reload(_a)
            result = _a.verify_admin("admin", "admin123")
            assert result is False, "Admin login must be disabled when env vars are absent"
        finally:
            if orig_u is not None:
                os.environ["ADMIN_USERNAME"] = orig_u
            if orig_p is not None:
                os.environ["ADMIN_PASSWORD"] = orig_p

    def test_verify_admin_succeeds_with_env(self):
        os.environ["ADMIN_USERNAME"] = "test_admin_xyz"
        os.environ["ADMIN_PASSWORD"] = "test_pass_xyz_secure!"
        try:
            import App.backend.settings as _s
            importlib.reload(_s)
            import App.backend.database.auth_db as _a
            importlib.reload(_a)
            assert _a.verify_admin("test_admin_xyz", "test_pass_xyz_secure!") is True
            assert _a.verify_admin("test_admin_xyz", "wrong_password") is False
            assert _a.verify_admin("wrong_user", "test_pass_xyz_secure!") is False
        finally:
            os.environ.pop("ADMIN_USERNAME", None)
            os.environ.pop("ADMIN_PASSWORD", None)

    def test_password_hash_and_verify(self):
        try:
            from App.backend.database.auth_db import hash_password, verify_password
        except ImportError:
            pytest.skip("bcrypt not installed")
        hashed = hash_password("TestPassword123!")
        assert isinstance(hashed, str)
        assert hashed != "TestPassword123!"
        assert verify_password("TestPassword123!", hashed) is True
        assert verify_password("WrongPassword", hashed) is False

    def test_login_safe_error_message(self):
        """Login must return a generic safe message for wrong credentials."""
        from App.backend.database.auth_db import login_user
        success, msg = login_user("nonexistent@test.invalid", "badpassword")
        assert success is False
        assert isinstance(msg, str)
        # The error must never contain internal technical details
        for forbidden in ("sqlite", "traceback", "exception", "stack", "sql", "cursor"):
            assert forbidden.lower() not in msg.lower(), (
                f"Error message leaked internal detail: '{forbidden}' in '{msg}'"
            )

    def test_register_rejects_short_password(self):
        from App.backend.database.auth_db import register_user
        success, msg = register_user("Test User", "test@example.com", "short")
        assert success is False
        assert "8" in msg or "password" in msg.lower()


# ─────────────────────────────────────────────────────────────────────────────
# Phase 4: RAG — no invented advice on unknown query
# ─────────────────────────────────────────────────────────────────────────────
class TestRAG:
    def test_rag_imports(self):
        from App.backend.agronomy_rag import (
            RAG_RELEVANCE_THRESHOLD,
            _no_verified_match_response,
        )
        assert isinstance(RAG_RELEVANCE_THRESHOLD, float)
        assert 0.0 < RAG_RELEVANCE_THRESHOLD < 1.0

    def test_no_verified_match_response_structure(self):
        from App.backend.agronomy_rag import _no_verified_match_response
        result = _no_verified_match_response("unknown_xyz", "wheat")
        assert result["rag_status"] == "no_verified_match"
        assert result["chemical_treatment"] is not None
        assert "consult" in result["chemical_treatment"].lower() or "not available" in result["chemical_treatment"].lower()
        # Must NOT contain invented dosages
        for invented in ["5ml/L", "2g/L", "spray 3 times", "0.5%"]:
            assert invented not in result["chemical_treatment"], (
                f"Invented dosage '{invented}' found in no-match response"
            )

    def test_query_agronomy_agent_known_scheme(self):
        from App.backend.agronomy_rag import query_agronomy_agent
        result = query_agronomy_agent("What is PM-KISAN scheme?")
        # Either a verified answer or explicit no-match — never None without notice
        if result.get("answer") is None:
            assert "notice" in result
            assert result["rag_status"] == "no_verified_match"
        else:
            assert isinstance(result["answer"], str)
            assert len(result["answer"]) > 20

    def test_query_agronomy_agent_nonsense_no_invention(self):
        from App.backend.agronomy_rag import query_agronomy_agent
        result = query_agronomy_agent("xyzkfq7293 randomnonsensecrop")
        # Should return no-match, NOT invented advice
        if result.get("answer") is None:
            assert result.get("rag_status") == "no_verified_match"
        elif result.get("answer"):
            # If something matched, it must cite a real source
            assert result.get("source_title") is not None


# ─────────────────────────────────────────────────────────────────────────────
# Phase 6: Schemes — safety language
# ─────────────────────────────────────────────────────────────────────────────
class TestSchemes:
    def test_schemes_returns_list(self):
        from App.backend.schemes import recommend_schemes
        result = recommend_schemes({"state": "Andhra Pradesh", "crop": "Rice", "area_ha": 1.0})
        assert isinstance(result, list)
        assert len(result) > 0

    def test_schemes_have_safety_fields(self):
        from App.backend.schemes import recommend_schemes
        result = recommend_schemes({
            "state": "Telangana", "crop": "Tomato", "area_ha": 2.0,
            "solar_interest": True, "irrigation_type": "Drip",
            "climate_risk_level": "High", "farmer_category": "Small"
        })
        for scheme in result:
            assert scheme.get("possible_match") is True, (
                f"Scheme '{scheme.get('id')}' missing possible_match=True"
            )
            assert scheme.get("verification_required") is True, (
                f"Scheme '{scheme.get('id')}' missing verification_required=True"
            )
            assert "verification_notice" in scheme, (
                f"Scheme '{scheme.get('id')}' missing verification_notice"
            )
            notice = scheme["verification_notice"]
            assert "verify" in notice.lower() or "official" in notice.lower()

    def test_schemes_do_not_state_exact_amounts(self):
        """No scheme should state definitive confirmed subsidy amounts as fact."""
        from App.backend.schemes import recommend_schemes
        result = recommend_schemes({"state": "Andhra Pradesh", "crop": "Rice", "area_ha": 1.0,
                                    "solar_interest": True})
        for scheme in result:
            benefit = scheme.get("possible_benefit", "")
            # Benefit field should either say "verify" or not claim a confirmed rupee amount
            if "₹" in benefit:
                assert "verify" in benefit.lower(), (
                    f"Scheme '{scheme.get('id')}' states a definitive amount without asking to verify: '{benefit}'"
                )


# ─────────────────────────────────────────────────────────────────────────────
# Phase 8: Disease Detection — upload validation
# ─────────────────────────────────────────────────────────────────────────────
class TestDiseaseDetectionValidation:
    def test_import_validation_functions(self):
        from App.backend.disease_detection import (
            _validate_upload,
            _validate_dimensions,
            MAX_UPLOAD_BYTES,
            ALLOWED_CONTENT_TYPES,
        )
        assert MAX_UPLOAD_BYTES == 10 * 1024 * 1024
        assert "image/jpeg" in ALLOWED_CONTENT_TYPES
        assert "image/png" in ALLOWED_CONTENT_TYPES

    def test_validate_upload_rejects_oversized(self):
        from App.backend.disease_detection import _validate_upload
        big_data = b"x" * (10 * 1024 * 1024 + 1)
        with pytest.raises(ValueError, match="too large"):
            _validate_upload(big_data, "image/jpeg")

    def test_validate_upload_rejects_bad_type(self):
        from App.backend.disease_detection import _validate_upload
        with pytest.raises(ValueError, match="Unsupported file type"):
            _validate_upload(b"fake_content", "application/pdf")

    def test_validate_upload_accepts_valid_jpeg(self):
        from App.backend.disease_detection import _validate_upload
        small_data = b"x" * 1024
        # Should not raise
        _validate_upload(small_data, "image/jpeg")

    def test_validate_dimensions_rejects_giant_image(self):
        from App.backend.disease_detection import _validate_dimensions
        from PIL import Image
        huge = Image.new("RGB", (5000, 5000), color="green")
        with pytest.raises(ValueError, match="dimensions"):
            _validate_dimensions(huge)


# ─────────────────────────────────────────────────────────────────────────────
# Phase 10: Server — health endpoint safe response
# ─────────────────────────────────────────────────────────────────────────────
class TestServerHealth:
    def test_health_endpoint_structure(self):
        try:
            from fastapi.testclient import TestClient
            from App.backend.server import app
        except Exception as exc:
            pytest.skip(f"FastAPI or server import failed: {exc}")

        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "ok"
        assert "timestamp" in data
        # Must NOT expose secrets or connection strings
        for forbidden_key in ("supabase_url", "supabase_key", "roboflow_key", "hf_token"):
            assert forbidden_key not in data, (
                f"Health endpoint exposed sensitive key: '{forbidden_key}'"
            )

    def test_health_returns_only_booleans_for_service_flags(self):
        try:
            from fastapi.testclient import TestClient
            from App.backend.server import app
        except Exception as exc:
            pytest.skip(f"FastAPI or server import failed: {exc}")

        client = TestClient(app)
        data = client.get("/health").json()
        for key, value in data.items():
            if key != "timestamp" and key != "status":
                assert isinstance(value, bool), (
                    f"Health endpoint key '{key}' returned {type(value).__name__}, expected bool"
                )


# ─────────────────────────────────────────────────────────────────────────────
# Phase 11: Module imports smoke test
# ─────────────────────────────────────────────────────────────────────────────
class TestModuleImports:
    @pytest.mark.parametrize("module", [
        "App.backend.settings",
        "App.backend.schemes",
        "App.backend.agronomy_rag",
        "App.backend.database.auth_db",
        "App.backend.database.database",
    ])
    def test_module_imports_without_crash(self, module):
        """Critical modules must import without raising an exception."""
        importlib.import_module(module)

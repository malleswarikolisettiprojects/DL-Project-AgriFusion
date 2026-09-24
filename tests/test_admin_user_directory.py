"""
AgriFusion — Unit Tests for Admin User Directory, Profiles & Authorization Sync
=================================================================================
Tests:
  1. Profiles with and without optional fields (full_name, email, dates)
  2. Pagination and count consistency between GET /users and dashboard total_users
  3. Missing profiles backfilling from Supabase Auth users
  4. Database error handling (500 internal server error, no silent fallback to 0 users)
  5. Role and status updates propagating to profile authorization reads (fetch_user_profile)
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# pytest optional import removed for standalone script execution
from fastapi import FastAPI
from fastapi.testclient import TestClient

from App.backend.auth.dependencies import CurrentUser, fetch_user_profile
from App.backend.auth.router import router as auth_router
from App.backend.admin.router import admin_router
from App.backend.database.auth_db import (
    count_active_admins_in_db,
    fetch_all_users,
    get_user_by_id,
    update_user_role_in_db,
    update_user_status_in_db,
)

app = FastAPI()
app.include_router(auth_router)
app.include_router(admin_router)

client = TestClient(app)


def test_profiles_optional_fields():
    """Verify profiles with missing optional fields do not crash and use safe defaults."""
    mock_supabase = MagicMock()
    mock_profiles_table = MagicMock()
    mock_supabase.table.return_value = mock_profiles_table

    # Mock DB response with missing optional fields
    mock_select = MagicMock()
    mock_profiles_table.select.return_value = mock_select
    mock_order = MagicMock()
    mock_select.order.return_value = mock_order
    mock_range = MagicMock()
    mock_order.range.return_value = mock_range

    mock_res = MagicMock()
    mock_res.data = [
        {"id": "usr-opt-1", "email": "opt1@test.com", "full_name": None, "role": None, "status": None},
        {"id": "usr-opt-2", "email": None, "name": None, "full_name": None, "role": "admin", "status": "active"},
    ]
    mock_res.count = 2
    mock_range.execute.return_value = mock_res

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        res = fetch_all_users(page=1, page_size=10)
        assert res["total"] == 2
        assert len(res["items"]) == 2

        item1 = res["items"][0]
        assert item1["id"] == "usr-opt-1"
        assert item1["name"] == "opt1"
        assert item1["role"] == "farmer"
        assert item1["status"] == "active"

        item2 = res["items"][1]
        assert item2["id"] == "usr-opt-2"
        assert item2["name"] == "User"
        assert item2["role"] == "admin"
        assert item2["status"] == "active"


def test_pagination_and_total_count_consistency():
    """Verify pagination ranges and count total consistency across pages."""
    mock_supabase = MagicMock()
    mock_profiles_table = MagicMock()
    mock_supabase.table.return_value = mock_profiles_table

    mock_select = MagicMock()
    mock_profiles_table.select.return_value = mock_select
    mock_order = MagicMock()
    mock_select.order.return_value = mock_order

    page1_range = MagicMock()
    page2_range = MagicMock()

    mock_res_page1 = MagicMock()
    mock_res_page1.data = [
        {"id": "u1", "email": "u1@test.com", "full_name": "User One", "role": "farmer", "status": "active"},
        {"id": "u2", "email": "u2@test.com", "full_name": "User Two", "role": "farmer", "status": "active"},
    ]
    mock_res_page1.count = 4
    page1_range.execute.return_value = mock_res_page1

    mock_res_page2 = MagicMock()
    mock_res_page2.data = [
        {"id": "u3", "email": "u3@test.com", "full_name": "User Three", "role": "farmer", "status": "active"},
        {"id": "u4", "email": "u4@test.com", "full_name": "User Four", "role": "admin", "status": "active"},
    ]
    mock_res_page2.count = 4
    page2_range.execute.return_value = mock_res_page2

    def range_side_effect(start, end):
        if start == 0:
            return page1_range
        return page2_range

    mock_order.range.side_effect = range_side_effect

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        res1 = fetch_all_users(page=1, page_size=2)
        res2 = fetch_all_users(page=2, page_size=2)

        assert res1["total"] == 4
        assert res2["total"] == 4
        assert res1["page"] == 1
        assert res2["page"] == 2
        assert res1["items"][0]["id"] == "u1"
        assert res2["items"][0]["id"] == "u3"


def test_missing_profiles_backfill_from_auth_users():
    """Verify Auth users missing from public.profiles are automatically backfilled."""
    mock_supabase = MagicMock()

    # Mock Auth Admin API user list
    mock_auth_user = MagicMock()
    mock_auth_user.id = "auth-uuid-999"
    mock_auth_user.email = "newauth@test.com"
    mock_auth_user.user_metadata = {"full_name": "New Auth User"}
    mock_auth_user.app_metadata = {"role": "agronomist"}
    mock_auth_user.created_at = "2026-09-24T12:00:00Z"
    mock_auth_user.last_sign_in_at = "2026-09-24T12:30:00Z"

    mock_auth_admin = MagicMock()
    mock_auth_admin.list_users.return_value = [mock_auth_user]
    mock_supabase.auth.admin = mock_auth_admin

    mock_profiles_table = MagicMock()
    mock_supabase.table.return_value = mock_profiles_table

    # Initially profiles table does not have auth-uuid-999
    mock_select_existing = MagicMock()
    mock_select_existing.execute.return_value = MagicMock(data=[])

    # After upsert, query returns backfilled profile
    mock_query_profiles = MagicMock()
    mock_profiles_table.select.side_effect = lambda fields, **kwargs: mock_select_existing if fields == "id" else mock_query_profiles

    mock_order = MagicMock()
    mock_query_profiles.order.return_value = mock_order
    mock_range = MagicMock()
    mock_order.range.return_value = mock_range

    mock_res = MagicMock()
    mock_res.data = [
        {
            "id": "auth-uuid-999",
            "email": "newauth@test.com",
            "full_name": "New Auth User",
            "role": "agronomist",
            "status": "active",
        }
    ]
    mock_res.count = 1
    mock_range.execute.return_value = mock_res

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        res = fetch_all_users(page=1, page_size=10)

        # Check upsert was called with backfilled dict
        mock_profiles_table.upsert.assert_called_once()
        upsert_arg = mock_profiles_table.upsert.call_args[0][0]
        assert len(upsert_arg) == 1
        assert upsert_arg[0]["id"] == "auth-uuid-999"
        assert upsert_arg[0]["email"] == "newauth@test.com"
        assert upsert_arg[0]["role"] == "farmer"

        assert res["total"] == 1
        assert res["items"][0]["id"] == "auth-uuid-999"


def test_database_error_fails_closed_in_production():
    """Verify configured Supabase DB failure raises RuntimeError and returns 500 error."""
    mock_supabase = MagicMock()
    mock_profiles_table = MagicMock()
    mock_supabase.table.return_value = mock_profiles_table
    mock_profiles_table.select.side_effect = Exception("Supabase connection error")

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        failed = False
        try:
            fetch_all_users(page=1, page_size=10)
        except RuntimeError as exc:
            failed = True
            assert "Database user directory query failed" in str(exc)
        assert failed is True, "Expected RuntimeError when Supabase DB query fails in production"


def test_role_and_status_update_propagation_to_auth_reads():
    """Verify role/status updates in public.profiles propagate immediately to fetch_user_profile authorization reads."""
    mock_supabase = MagicMock()
    mock_profiles_table = MagicMock()
    mock_supabase.table.return_value = mock_profiles_table

    # Mock initial profile
    mock_select = MagicMock()
    mock_profiles_table.select.return_value = mock_select
    mock_eq = MagicMock()
    mock_select.eq.return_value = mock_eq

    # 1. Update role to editor
    mock_update_role = MagicMock()
    mock_profiles_table.update.return_value = mock_update_role
    mock_eq_update_role = MagicMock()
    mock_update_role.eq.return_value = mock_eq_update_role
    mock_eq_update_role.execute.return_value = MagicMock(data=[{"id": "usr-role-1", "role": "editor"}])

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        ok = update_user_role_in_db("usr-role-1", "editor")
        assert ok is True

    # 2. Update status to suspended
    mock_update_status = MagicMock()
    mock_profiles_table.update.return_value = mock_update_status
    mock_eq_update_status = MagicMock()
    mock_update_status.eq.return_value = mock_eq_update_status
    mock_eq_update_status.execute.return_value = MagicMock(data=[{"id": "usr-role-1", "status": "suspended"}])

    with patch("App.backend.database.auth_db._get_supabase_admin", return_value=mock_supabase):
        ok_status = update_user_status_in_db("usr-role-1", "suspended")
        assert ok_status is True

    # 3. Read profile via fetch_user_profile (used by CurrentUser authorization dependency)
    mock_read_exec = MagicMock()
    mock_read_exec.data = [{"id": "usr-role-1", "role": "editor", "status": "suspended", "email": "editor@test.com"}]
    mock_eq.execute.return_value = mock_read_exec

    with patch("App.backend.database.database.supabase", mock_supabase):
        profile = fetch_user_profile("usr-role-1")
        assert profile is not None
        assert profile["id"] == "usr-role-1"
        assert profile["role"] == "editor"
        assert profile["status"] == "suspended"


def test_profile_creation_on_signup():
    """Verify register_user inserts record into public.profiles with default farmer role."""
    mock_supabase = MagicMock()
    mock_profiles_table = MagicMock()
    mock_supabase.table.return_value = mock_profiles_table

    mock_select = MagicMock()
    mock_profiles_table.select.return_value = mock_select
    mock_eq = MagicMock()
    mock_select.eq.return_value = mock_eq
    mock_eq.execute.return_value = MagicMock(data=[])  # No existing profile

    mock_insert = MagicMock()
    mock_profiles_table.insert.return_value = mock_insert
    mock_insert.execute.return_value = MagicMock(data=[{"id": "new-user-1", "email": "new@farmer.com", "role": "farmer"}])

    with patch("App.backend.database.auth_db._get_supabase", return_value=mock_supabase):
        from App.backend.database.auth_db import register_user
        ok, msg = register_user("New Farmer", "new@farmer.com", "Password123!")
        assert ok is True
        assert "Registration successful" in msg

        mock_profiles_table.insert.assert_called_once()
        insert_arg = mock_profiles_table.insert.call_args[0][0]
        assert insert_arg["email"] == "new@farmer.com"
        assert insert_arg["full_name"] == "New Farmer"
        assert insert_arg["role"] == "farmer"
        assert insert_arg["status"] == "active"


def test_update_user_profile_ignores_privilege_escalation():
    """Verify farmer update_user_profile cannot change role or status."""
    mock_supabase = MagicMock()
    mock_profiles_table = MagicMock()
    mock_supabase.table.return_value = mock_profiles_table

    mock_update = MagicMock()
    mock_profiles_table.update.return_value = mock_update
    mock_eq = MagicMock()
    mock_update.eq.return_value = mock_eq
    mock_eq.execute.return_value = MagicMock(data=[{"id": "usr-1", "full_name": "New Name", "role": "farmer"}])

    with patch("App.backend.database.farmer_db.supabase", mock_supabase):
        from App.backend.database.farmer_db import update_user_profile
        # Attempt to inject role="admin" and status="suspended"
        res = update_user_profile("usr-1", {"full_name": "New Name", "phone": "1234567890", "role": "admin", "status": "suspended"})
        
        mock_profiles_table.update.assert_called_once()
        update_arg = mock_profiles_table.update.call_args[0][0]
        assert "full_name" in update_arg
        assert "phone" in update_arg
        assert "role" not in update_arg
        assert "status" not in update_arg


if __name__ == "__main__":
    test_profiles_optional_fields()
    print("[PASS] test_profiles_optional_fields")

    test_pagination_and_total_count_consistency()
    print("[PASS] test_pagination_and_total_count_consistency")

    test_missing_profiles_backfill_from_auth_users()
    print("[PASS] test_missing_profiles_backfill_from_auth_users")

    test_database_error_fails_closed_in_production()
    print("[PASS] test_database_error_fails_closed_in_production")

    test_role_and_status_update_propagation_to_auth_reads()
    print("[PASS] test_role_and_status_update_propagation_to_auth_reads")

    test_profile_creation_on_signup()
    print("[PASS] test_profile_creation_on_signup")

    test_update_user_profile_ignores_privilege_escalation()
    print("[PASS] test_update_user_profile_ignores_privilege_escalation")

    print("\nALL ADMIN USER DIRECTORY & FARMER AUTH TESTS PASSED SUCCESSFULLY!")


"""
AgriFusion — Central Admin & Agronomy Management Portal
=========================================================
Connects to AgriFusion FastAPI Backend (default http://127.0.0.1:8000 or set AGRIFUSION_API_URL).
Provides administrative workflows for:
  1. 📊 Executive Dashboard Overview & System Metrics
  2. 👤 User Management Directory (Filters: role, status, search)
  3. 🚜 Regional Farm Profiles Aggregation (Filter: state)
  4. 📚 RAG Knowledge Sources Registry & Document Ingestion
  5. 🏛️ Central & State Government Schemes Registry
  6. 🩺 Agronomic Advisory Quality & Compliance Audit (Filters: state, no_verified_source, review_status)
  7. 💬 Farmer Feedback & Support Reports
  8. 🛡️ Security Audit Logs & CSV Export (Filter: action)
"""

import json
import os
import requests
import streamlit as st

st.set_page_config(
    page_title="AgriFusion Admin Portal",
    page_icon="🌾",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── API Base URL Configuration ────────────────────────────────────────────────
API_BASE_URL = os.getenv("AGRIFUSION_API_URL", "http://127.0.0.1:8000").rstrip("/")

# ── Session State Management ─────────────────────────────────────────────────
if "token" not in st.session_state:
    st.session_state.token = None
if "admin_user" not in st.session_state:
    st.session_state.admin_user = None

def get_headers():
    headers = {}
    if st.session_state.token:
        headers["Authorization"] = f"Bearer {st.session_state.token}"
    return headers

# ── Header Bar ───────────────────────────────────────────────────────────────
st.title("🌾 AgriFusion — Central Admin & Agronomy Management Portal")
st.caption(f"Backend Target: `{API_BASE_URL}`")
st.markdown("---")

# ── Authentication Screen ────────────────────────────────────────────────────
if not st.session_state.token:
    st.subheader("🔑 Admin Authentication")
    st.info("Log in with your administrator or agronomist credentials to access management controls.")

    col1, col2 = st.columns([1, 1])
    with col1:
        username = st.text_input("Username / Email", value="admin@agrifusion.com")
        password = st.text_input("Password", type="password", value="Admin@123456")
        login_btn = st.button("Log In to Admin Portal", type="primary")

        if login_btn:
            try:
                res = requests.post(
                    f"{API_BASE_URL}/api/v1/auth/login",
                    json={"email": username, "password": password},
                    timeout=10,
                )
                if res.status_code == 200:
                    data = res.json()
                    st.session_state.token = data.get("access_token")
                    st.session_state.admin_user = username
                    st.success("Successfully authenticated!")
                    st.rerun()
                else:
                    st.error(f"Login failed: {res.json().get('detail', 'Invalid credentials')}")
            except Exception as e:
                st.error(f"Failed to connect to backend API at {API_BASE_URL}: {e}")

    st.stop()

# ── Authenticated Sidebar Navigation ─────────────────────────────────────────
with st.sidebar:
    st.markdown(f"**Logged in as:** `{st.session_state.admin_user}`")
    if st.button("Log Out"):
        st.session_state.token = None
        st.session_state.admin_user = None
        st.rerun()

    st.markdown("---")
    menu = st.radio(
        "Admin Modules",
        [
            "📊 Dashboard Overview",
            "👤 User Directory",
            "🚜 Regional Farm Profiles",
            "🤖 ML Predictions Activity",
            "🩺 Advisory Quality & Audit",
            "🔬 Crop Diagnostics Audit",
            "🛡️ Security Audit Logs",
            "📚 RAG Knowledge Sources",
            "🏛️ Government Schemes Registry",
            "💬 Farmer Feedback & Support",
        ],
    )

# =============================================================================
# MODULE 1: DASHBOARD OVERVIEW
# =============================================================================
if menu == "📊 Dashboard Overview":
    st.header("📊 Executive Overview & System Metrics")
    
    try:
        overview_res = requests.get(f"{API_BASE_URL}/api/v1/admin/overview", headers=get_headers(), timeout=10)
        if overview_res.status_code == 200:
            ov_data = overview_res.json()
            metrics = ov_data.get("metrics", {})
            
            c1, c2, c3, c4, c5 = st.columns(5)
            c1.metric("Total Users", metrics.get("total_users", 0))
            c2.metric("Advisory Queries", metrics.get("advisory_queries", 0))
            c3.metric("Prediction Requests", metrics.get("prediction_requests", 0))
            c4.metric("Failed Requests", metrics.get("failed_requests", 0))
            c5.metric("Feedback Awaiting Review", metrics.get("feedback_awaiting_review", 0))

            st.markdown("---")
            st.subheader("⚡ Model Latency Benchmarks")
            latencies = metrics.get("model_latencies", {})
            l_cols = st.columns(len(latencies) if latencies else 1)
            for idx, (model_name, lat_val) in enumerate(latencies.items()):
                l_cols[idx % len(l_cols)].metric(f"{model_name.capitalize()} Engine", lat_val)
        else:
            st.warning(f"Overview status {overview_res.status_code}: {overview_res.text}")
    except Exception as err:
        st.warning(f"Could not load live overview statistics: {err}")

# =============================================================================
# MODULE 2: USER DIRECTORY
# =============================================================================
elif menu == "👤 User Directory":
    st.header("👤 User Management & Role Directory")
    
    col_f1, col_f2, col_f3 = st.columns(3)
    with col_f1:
        role_filter = st.selectbox("Filter by Role", ["All", "farmer", "user", "agronomist", "admin", "auditor"])
    with col_f2:
        status_filter = st.selectbox("Filter by Status", ["All", "active", "suspended", "pending"])
    with col_f3:
        search_query = st.text_input("Search Users (Email / Name)", value="")

    params = {"page": 1, "page_size": 50}
    if role_filter != "All":
        params["role"] = role_filter
    if status_filter != "All":
        params["status"] = status_filter
    if search_query.strip():
        params["search"] = search_query.strip()

    try:
        u_res = requests.get(f"{API_BASE_URL}/api/v1/admin/users", headers=get_headers(), params=params, timeout=10)
        if u_res.status_code == 200:
            u_data = u_res.json()
            users_list = u_data.get("items", [])
            st.subheader(f"Total Matching Users: {u_data.get('total', len(users_list))}")

            if users_list:
                for u in users_list:
                    status_badge = "🟢 Active" if u.get("status") == "active" else "🔴 Suspended"
                    with st.expander(f"👤 {u.get('name') or 'User'} ({u.get('email')}) — Role: `{u.get('role')}` | Status: {status_badge}"):
                        st.write(f"**User ID:** `{u.get('id')}` | **Created:** `{u.get('created_at')}`")
                        
                        btn_c1, btn_c2 = st.columns(2)
                        with btn_c1:
                            new_status = st.selectbox("Update Account Status", ["active", "suspended", "archived"], key=f"stat_sel_{u['id']}")
                            if st.button("Save Status", key=f"save_stat_{u['id']}"):
                                rx = requests.patch(
                                    f"{API_BASE_URL}/api/v1/admin/users/{u['id']}/status",
                                    headers=get_headers(),
                                    json={"status": new_status},
                                )
                                if rx.status_code == 200:
                                    st.success("Status updated!")
                                    st.rerun()
                                else:
                                    st.error(rx.json().get("detail", "Failed"))
                        with btn_c2:
                            new_role = st.selectbox("Update Authorization Role", ["user", "agronomist", "admin", "auditor"], key=f"role_sel_{u['id']}")
                            if st.button("Save Role", key=f"save_role_{u['id']}"):
                                rx = requests.patch(
                                    f"{API_BASE_URL}/api/v1/admin/users/{u['id']}/role",
                                    headers=get_headers(),
                                    json={"role": new_role},
                                )
                                if rx.status_code == 200:
                                    st.success("Role updated!")
                                    st.rerun()
                                else:
                                    st.error(rx.json().get("detail", "Failed"))
            else:
                st.info("No registered users match the selected filters.")
        else:
            st.error(f"Failed to fetch users: {u_res.text}")
    except Exception as err:
        st.error(f"Error connecting to users directory API: {err}")

# =============================================================================
# MODULE 3: REGIONAL FARM PROFILES
# =============================================================================
elif menu == "🚜 Regional Farm Profiles":
    st.header("🚜 Regional Farm Profiles & Crop Aggregations")
    
    state_f = st.selectbox(
        "Filter by State",
        ["All", "Andhra Pradesh", "Telangana", "Karnataka", "Punjab", "Maharashtra", "Tamil Nadu", "Gujarat"]
    )
    
    params = {"page": 1, "page_size": 50}
    if state_f != "All":
        params["state"] = state_f

    try:
        f_res = requests.get(f"{API_BASE_URL}/api/v1/admin/farms", headers=get_headers(), params=params, timeout=10)
        if f_res.status_code == 200:
            f_data = f_res.json()
            farms = f_data.get("items", [])
            st.subheader(f"Matching Regional Farm Clusters: {f_data.get('total', len(farms))}")
            st.caption(f_data.get("privacy_note", ""))

            if farms:
                st.dataframe(farms, use_container_width=True)
            else:
                st.info("No farm profile clusters found for the selected state.")
        else:
            st.error(f"Failed to load farm profiles: {f_res.text}")
    except Exception as err:
        st.error(f"Error fetching farm profiles: {err}")

# =============================================================================
# MODULE 3b: ML PREDICTIONS ACTIVITY LOG
# =============================================================================
elif menu == "🤖 ML Predictions Activity":
    st.header("🤖 ML Model Predictions Telemetry & Activity Log")

    p_col1, p_col2, p_col3, p_col4 = st.columns(4)
    with p_col1:
        pred_model_f = st.selectbox("Model Type", ["All", "crop_recommendation", "climate_risk", "irrigation_scheduling", "yield_prediction", "market_price_forecasting"])
    with p_col2:
        pred_state_f = st.selectbox("State Filter", ["All", "Andhra Pradesh", "Telangana", "Karnataka", "Punjab", "Maharashtra", "Tamil Nadu"])
    with p_col3:
        pred_status_f = st.selectbox("Status Filter", ["All", "success", "failed"])
    with p_col4:
        pred_search_f = st.text_input("Search Inferences", value="", placeholder="Crop, state, district, model...")

    params = {"page": 1, "page_size": 50}
    if pred_model_f != "All":
        params["model_type"] = pred_model_f
    if pred_state_f != "All":
        params["state"] = pred_state_f
    if pred_status_f != "All":
        params["status"] = pred_status_f
    if pred_search_f.strip():
        params["search"] = pred_search_f.strip()

    try:
        p_res = requests.get(f"{API_BASE_URL}/api/v1/admin/predictions", headers=get_headers(), params=params, timeout=10)
        if p_res.status_code == 200:
            p_data = p_res.json()
            items = p_data.get("items", [])
            analytics = p_data.get("analytics", {})

            # Summary Metrics Row
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Total Inferences", analytics.get("total_predictions", len(items)))
            m2.metric("Successful", analytics.get("success_count", 0))
            m3.metric("Failed", analytics.get("error_count", 0))
            avg_lat = analytics.get("average_latency_ms")
            m4.metric("Avg Latency (ms)", f"{avg_lat} ms" if avg_lat is not None else "Uncollected")

            st.markdown("---")
            st.subheader(f"Logged Inference Events: {p_data.get('total', len(items))}")

            if items:
                for ev in items:
                    st_badge = "🟢 Success" if ev.get("status") == "success" else f"🔴 Failed ({ev.get('error_code') or 'Error'})"
                    lat_str = f"{ev.get('latency_ms')} ms" if ev.get("latency_ms") is not None else "Uncollected"
                    with st.expander(f"🤖 [{ev.get('model_type')}] Crop: `{ev.get('crop') or 'Unspecified'}` — Status: {st_badge} | Latency: `{lat_str}`"):
                        st.write(f"**Event ID:** `{ev.get('id')}` | **Date:** `{ev.get('created_at')}`")
                        st.write(f"**State:** `{ev.get('state') or 'N/A'}` | **District:** `{ev.get('district') or 'N/A'}` | **User ID:** `{ev.get('user_id') or 'Anonymous'}`")
                        
                        col_req, col_res = st.columns(2)
                        with col_req:
                            st.write("**Request Summary:**")
                            st.json(ev.get("request_summary") or {})
                        with col_res:
                            st.write("**Result Summary:**")
                            st.json(ev.get("result_summary") or {})
            else:
                st.info("No ML prediction telemetry events match the selected filters.")
        elif p_res.status_code == 401:
            st.error("🔒 Authentication Error (401): Session expired or invalid admin token.")
        elif p_res.status_code == 403:
            st.error("🚫 Access Forbidden (403): You do not have admin rights for ML activity telemetry.")
        elif p_res.status_code == 500:
            st.error("💥 Server Error (HTTP 500): Database query failed for ML prediction activity log.")
        else:
            st.error(f"Failed to fetch ML predictions activity log (HTTP {p_res.status_code}): {p_res.text}")
    except Exception as err:
        st.error(f"Error fetching ML predictions activity log: {err}")

# =============================================================================
# MODULE 4: ADVISORY QUALITY & AUDIT
# =============================================================================
elif menu == "🩺 Advisory Quality & Audit":
    st.header("🩺 Farmer Advisory Quality & Compliance Monitoring")

    a_col1, a_col2, a_col3, a_col4 = st.columns(4)
    with a_col1:
        adv_state_f = st.selectbox("State Filter", ["All", "Andhra Pradesh", "Telangana", "Karnataka", "Punjab", "Maharashtra"])
    with a_col2:
        no_source_only = st.checkbox("Advisories - No Verified Sources Only", value=False)
    with a_col3:
        requires_review_only = st.checkbox("Requires Review Only", value=False)
    with a_col4:
        adv_search_input = st.text_input("Search Advisories", value="", placeholder="Summary, crop, region, ID...")

    params = {"page": 1, "page_size": 50}
    if adv_state_f != "All":
        params["state"] = adv_state_f
    if no_source_only:
        params["status"] = "no_verified_source"
    if requires_review_only:
        params["review_status"] = "needs_review"
    if adv_search_input.strip():
        params["search"] = adv_search_input.strip()

    try:
        adv_res = requests.get(f"{API_BASE_URL}/api/v1/admin/advisories", headers=get_headers(), params=params, timeout=10)
        if adv_res.status_code == 200:
            adv_data = adv_res.json()
            items = adv_data.get("items", [])
            st.subheader(f"Logged Advisory Telemetry Events: {adv_data.get('total', len(items))}")

            if items:
                for adv in items:
                    comp = adv.get("compliance", {})
                    status_color = "🟢 Passed" if comp.get("compliance_status") == "passed" else ("🟡 Needs Review" if comp.get("compliance_status") == "needs_review" else "🔴 Failed / Timeout")
                    with st.expander(f"🔍 {adv.get('query_summary')} ({adv.get('crop') or 'General'}) — Status: `{adv.get('activity_status')}` — Compliance: {status_color}"):
                        st.write(f"**Date:** {adv.get('created_at')} | **State:** {adv.get('state') or 'N/A'} | **District:** {adv.get('district') or 'N/A'} | **Status:** `{adv.get('activity_status')}`")
                        st.json(comp)
                        
                        note_text = st.text_input("Add Agronomist Note", key=f"note_{adv['query_id']}")
                        if st.button("Submit Agronomist Note", key=f"sub_note_{adv['query_id']}"):
                            nx = requests.post(
                                f"{API_BASE_URL}/api/v1/admin/advisories/{adv['query_id']}/note",
                                headers=get_headers(),
                                json={"note": note_text},
                            )
                            if nx.status_code == 200:
                                st.success("Agronomist review note recorded!")
                                st.rerun()
            else:
                st.info(adv_data.get("privacy_note", "No advisory telemetry logs match the selected filters."))
        elif adv_res.status_code == 401:
            st.error("🔒 Authentication Error (401): Session expired or invalid admin token. Please sign in again.")
        elif adv_res.status_code == 403:
            st.error("🚫 Access Forbidden (403): You do not have administrator permissions to access advisory telemetry.")
        elif adv_res.status_code == 500:
            st.error("💥 Server Error (HTTP 500): Database query failed for advisory activity telemetry. The backend failed closed instead of returning a false empty list.")
        else:
            st.error(f"Failed to fetch advisory activities (HTTP {adv_res.status_code}): {adv_res.text}")
    except requests.exceptions.Timeout:
        st.error("⏳ Network Timeout: Request to fetch advisory activity logs timed out.")
    except Exception as err:
        st.error(f"🌐 Connection Error: Could not reach backend API server ({err})")

# =============================================================================
# MODULE 5: SECURITY AUDIT LOGS
# =============================================================================
elif menu == "🛡️ Security Audit Logs":
    st.header("🛡️ Administrative Audit Trail & Compliance Export")

    action_f = st.selectbox(
        "Filter by Action Type",
        ["All Actions", "USER_LOGIN", "DOCUMENT_UPLOAD", "SCHEME_VERIFY", "ROLE_UPDATE", "FEEDBACK_REVIEW", "user_status_changed", "user_role_changed", "source_viewed"]
    )

    params = {"page": 1, "page_size": 100}
    if action_f != "All Actions":
        params["action"] = action_f

    try:
        audit_res = requests.get(f"{API_BASE_URL}/api/v1/admin/audit-logs", headers=get_headers(), params=params, timeout=10)
        if audit_res.status_code == 200:
            audit_data = audit_res.json()
            logs = audit_data.get("items", [])
            st.subheader(f"Total Logged Security Events: {audit_data.get('total', len(logs))}")

            if logs:
                st.dataframe(logs, use_container_width=True)
            else:
                st.info("No audit logs match the selected action filter.")

            if st.button("📥 Export Tamper-Evident Audit Trail CSV"):
                csv_res = requests.get(f"{API_BASE_URL}/api/v1/admin/audit-logs/export", headers=get_headers())
                if csv_res.status_code == 200:
                    st.download_button(
                        label="Click to Download Audit CSV",
                        data=csv_res.content,
                        file_name="agrifusion_admin_audit_logs.csv",
                        mime="text/csv",
                    )
        else:
            st.error(f"Failed to load audit logs: {audit_res.text}")
    except Exception as err:
        st.error(f"Failed to load audit logs: {err}")

# =============================================================================
# MODULE 6: RAG KNOWLEDGE SOURCES
# =============================================================================
elif menu == "📚 RAG Knowledge Sources":
    st.header("📚 Canonical Knowledge Sources & Document Ingestion")

    st.subheader("1. Upload Custom Agronomy Document (PDF, DOCX, TXT, MD)")
    up_col1, up_col2 = st.columns([2, 1])
    with up_col1:
        uploaded_file = st.file_uploader("Choose a document file", type=["pdf", "docx", "txt", "md"])
        doc_title = st.text_input("Document Title (optional)")
        doc_org = st.text_input("Organization / Author", value="ANGRAU / ICAR / Agriculture Dept")
    with up_col2:
        doc_crop = st.text_input("Target Crop", value="All Crops")
        doc_state = st.text_input("State Relevance (comma-separated)", value="Andhra Pradesh, Telangana")
        upload_btn = st.button("🚀 Upload & Index into RAG", type="primary")

        if upload_btn and uploaded_file:
            with st.spinner("Processing document and indexing..."):
                try:
                    files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
                    data = {
                        "title": doc_title or uploaded_file.name,
                        "organization": doc_org,
                        "crop": doc_crop,
                        "state_relevance": doc_state,
                    }
                    res = requests.post(
                        f"{API_BASE_URL}/api/v1/admin/sources/upload-document",
                        headers=get_headers(),
                        files=files,
                        data=data,
                    )
                    if res.status_code == 201:
                        st.success(f"Successfully uploaded and indexed `{uploaded_file.name}`!")
                    else:
                        st.error(f"Upload failed: {res.json().get('detail', res.text)}")
                except Exception as e:
                    st.error(f"Error connecting to server: {e}")

    st.markdown("---")
    st.subheader("2. Registered Knowledge Sources Registry")
    search_query = st.text_input("Search Sources Registry by title or organization", value="")
    try:
        res = requests.get(
            f"{API_BASE_URL}/api/v1/admin/sources",
            headers=get_headers(),
            params={"search": search_query if search_query else None},
        ).json()

        sources = res.get("items", [])
        if sources:
            for s in sources:
                with st.expander(f"📄 {s.get('title')} ({s.get('organization')}) — Status: {s.get('verification_status')}"):
                    st.write(f"**ID:** `{s.get('id')}` | **Format:** `{s.get('document_format')}` | **Language:** `{s.get('language')}`")
                    st.write(f"**Official URL / Path:** `{s.get('official_url')}`")
                    st.write(f"**Index Status:** `{s.get('index_status')}`")
        else:
            st.info("No knowledge sources match the search criteria.")
    except Exception as err:
        st.error(f"Failed to fetch knowledge sources: {err}")

# =============================================================================
# MODULE 7: GOVERNMENT SCHEMES REGISTRY
# =============================================================================
elif menu == "🏛️ Government Schemes Registry":
    st.header("🏛️ Central & State Government Schemes Registry")

    try:
        res = requests.get(f"{API_BASE_URL}/api/v1/admin/schemes", headers=get_headers()).json()
        schemes = res.get("items", [])

        st.markdown(f"Total Verified / Monitored Schemes: **{len(schemes)}**")
        for sch in schemes:
            with st.expander(f"🌾 {sch.get('scheme_name')} — Status: {sch.get('verification_status')} ({sch.get('current_status')})"):
                st.write(f"**Department:** {sch.get('department')}")
                st.write(f"**Official Portal:** [{sch.get('official_portal')}]({sch.get('official_portal')})")
                st.write(f"**Benefit Summary:** {sch.get('benefit_summary')}")
                st.write(f"**Required Documents:** {', '.join(sch.get('required_documents', []))}")
    except Exception as err:
        st.error(f"Error fetching schemes registry: {err}")

# =============================================================================
# MODULE 8: FARMER FEEDBACK & SUPPORT
# =============================================================================
elif menu == "💬 Farmer Feedback & Support":
    st.header("💬 Farmer Feedback Reports & Review Dashboard")

    MODULE_LABELS = {
        "crop_recommendation": "Crop Recommendation",
        "climate": "Climate Risk",
        "irrigation": "Irrigation",
        "yield": "Yield Prediction",
        "disease_diagnosis": "Disease Diagnostics",
        "advisory": "Agronomy Advisory",
        "schemes": "Government Schemes",
        "general": "General System",
    }

    def get_friendly_module_label(module_code):
        if not module_code:
            return "Not specified"
        clean = str(module_code).strip().lower()
        return MODULE_LABELS.get(clean, clean.replace("_", " ").title())

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        mod_filter = st.selectbox(
            "Module Filter",
            ["All", "irrigation", "crop_recommendation", "climate", "yield", "disease_diagnosis", "advisory", "schemes", "general"]
        )
    with col2:
        cat_filter = st.selectbox(
            "Category Filter",
            ["All", "incorrect_answer", "missing_information", "outdated_source", "wrong_language", "unclear_advice", "image_quality_problem", "technical_error", "other"]
        )
    with col3:
        status_filter = st.selectbox(
            "Status Filter",
            ["All", "pending_review", "under_review", "resolved", "rejected", "reviewed"]
        )
    with col4:
        rating_filter = st.selectbox(
            "Rating Filter",
            ["All", "5", "4", "3", "2", "1"]
        )

    params = {"page": 1, "page_size": 50}
    if mod_filter != "All":
        params["module"] = mod_filter
    if cat_filter != "All":
        params["category"] = cat_filter
    if status_filter != "All":
        params["status"] = status_filter
    if rating_filter != "All":
        params["rating"] = int(rating_filter)

    try:
        res = requests.get(f"{API_BASE_URL}/api/v1/admin/feedback", headers=get_headers(), params=params, timeout=10).json()
        reports = res.get("items", [])
        total = res.get("total", len(reports))
        st.subheader(f"Feedback Reports: {total}")

        if reports:
            for f in reports:
                mod_code = f.get("module")
                friendly_mod = get_friendly_module_label(mod_code)
                cat_val = f.get("category") or "other"
                rat_val = f.get("rating")
                stat_val = f.get("status") or "pending_review"
                fb_type = f.get("feedback_type") or "general"
                
                type_badge = "💬 Feedback"
                if fb_type == "helpful":
                    type_badge = "👍 Helpful"
                elif fb_type == "not_helpful":
                    type_badge = "👎 Not Helpful"
                elif fb_type == "problem_report":
                    type_badge = "⚠️ Problem Report"

                crop_str = f.get("crop") or "Not specified"
                region_parts = [p for p in [f.get("district"), f.get("state")] if p]
                region_str = ", ".join(region_parts) if region_parts else "Not specified"

                expander_title = f"{type_badge} | ⭐ Rating {rat_val}/5 — Module: {friendly_mod} | Category: {cat_val} ({stat_val})"

                with st.expander(expander_title):
                    st.write(f"**Feedback Type:** `{fb_type}` | **Module:** `{friendly_mod}` ({mod_code or 'General'})")
                    st.write(f"**Crop:** `{crop_str}` | **Region:** `{region_str}`")
                    st.write(f"**Category:** `{cat_val}` | **Priority:** `{f.get('priority')}` | **Status:** `{stat_val}`")
                    st.write(f"**Farmer Comment:** {f.get('comment') or f.get('message')}")
                    
                    adv_id = f.get("advisory_id")
                    pred_id = f.get("prediction_id")
                    if adv_id or pred_id:
                        st.write(f"**Linked Advisory ID:** `{adv_id or 'None'}` | **Linked Prediction ID:** `{pred_id or 'None'}`")

                    snapshot = f.get("context_snapshot") or {}
                    if isinstance(snapshot, dict) and snapshot.get("status") != "unavailable" and any(k in snapshot for k in ("question_summary", "query_summary", "ai_answer", "relevant_details")):
                        st.markdown("---")
                        st.markdown("##### 📌 Rated Context Snapshot")
                        q_summary = snapshot.get("question_summary") or snapshot.get("query_summary")
                        if q_summary:
                            st.write(f"**Farmer Query / Topic:** {q_summary}")
                        if snapshot.get("ai_answer"):
                            st.write(f"**AI Advice Provided:** {snapshot.get('ai_answer')}")
                        if snapshot.get("relevant_details"):
                            st.write(f"**Relevant Details:** `{snapshot.get('relevant_details')}`")

                    st.caption(f"Submitted At: {f.get('created_at')} | Identity Redacted")
        else:
            st.info("No farmer feedback reports match the selected filters.")
    except Exception as err:
        st.error(f"Failed to fetch farmer feedback: {err}")

# =============================================================================
# MODULE 9: CROP DIAGNOSTICS AUDIT & REVIEW
# =============================================================================
elif menu == "🔬 Crop Diagnostics Audit":
    st.header("🔬 Crop Health Diagnostics Audit & Review")

    d_col1, d_col2, d_col3, d_col4, d_col5 = st.columns(5)
    with d_col1:
        diag_crop_f = st.selectbox("Crop Filter", ["All", "Paddy / Rice", "Cotton", "Chilli", "Maize", "Groundnut", "Tomato", "Sugarcane"])
    with d_col2:
        diag_state_f = st.selectbox("State Filter", ["All", "Andhra Pradesh", "Telangana", "Karnataka", "Punjab", "Maharashtra"])
    with d_col3:
        diag_status_f = st.selectbox("Review Status", ["All", "reviewed", "pending_review", "flagged"])
    with d_col4:
        diag_outcome_f = st.selectbox("Inference Outcome", ["All", "detected", "no_detection", "low_confidence", "provider_error"])
    with d_col5:
        diag_search_input = st.text_input("Search Diagnostics", value="", placeholder="Crop, diagnosis, region, ID...")

    params = {"page": 1, "page_size": 50}
    if diag_crop_f != "All":
        params["crop"] = diag_crop_f
    if diag_state_f != "All":
        params["state"] = diag_state_f
    if diag_status_f != "All":
        params["status"] = diag_status_f
    if diag_outcome_f != "All":
        params["inference_outcome"] = diag_outcome_f
    if diag_search_input.strip():
        params["search"] = diag_search_input.strip()

    try:
        diag_res = requests.get(f"{API_BASE_URL}/api/v1/admin/diagnostics", headers=get_headers(), params=params, timeout=10)
        if diag_res.status_code == 200:
            diag_data = diag_res.json()
            items = diag_data.get("items", [])
            st.subheader(f"Logged Diagnostic Reports: {diag_data.get('total', len(items))}")

            if items:
                for diag in items:
                    outcome = diag.get("inference_outcome")
                    # Do NOT substitute a default: None means this row pre-dates telemetry columns.
                    exec_stat = diag.get("execution_status")  # May be None for legacy rows

                    if diag.get("primary_diagnosis"):
                        diag_title = diag.get("primary_diagnosis")
                    elif outcome == "no_detection":
                        diag_title = "No Disease or Pest Detected"
                    elif outcome == "low_confidence":
                        diag_title = "Inconclusive / Low Confidence"
                    elif outcome == "provider_error":
                        diag_title = "Inference Engine Error / Timeout"
                    else:
                        diag_title = "Inconclusive"

                    conf = diag.get("confidence")
                    conf_str = f"{round(conf * 100, 1)}% confidence" if conf is not None else "Confidence N/A"
                    badge_outcome = outcome.upper() if outcome else "UNSPECIFIED"
                    exec_stat_display = exec_stat if exec_stat is not None else "Not recorded"
                    expander_header = f"🔬 {diag_title} on {diag.get('crop')} ({conf_str}) — Outcome: `{badge_outcome}` [{exec_stat_display}]"

                    with st.expander(expander_header):
                        st.write(f"**Report ID:** `{diag.get('id')}` | **Request ID:** `{diag.get('request_id') or 'N/A'}` | **Date:** `{diag.get('created_at')}`")
                        exec_stat_display = exec_stat if exec_stat is not None else "Not recorded"
                        st.write(f"**Inference Outcome:** `{outcome}` | **Execution Status:** `{exec_stat_display}` | **Review Status:** `{diag.get('status') or 'pending_review'}`")
                        st.write(f"**Location:** {diag.get('district') or 'N/A'}, {diag.get('state') or 'N/A'} | **Actor Ref:** `{diag.get('actor_ref') or 'Anonymous'}`")

                        col_prov, col_cand = st.columns(2)
                        with col_prov:
                            st.markdown("##### ⚙️ Providers Summary")
                            st.json(diag.get("providers_summary") or {})
                        with col_cand:
                            st.markdown("##### 🎯 Candidate & Threshold Summary")
                            st.json(diag.get("candidate_summary") or {})

                        sec_list = diag.get("secondary_matches") or []
                        if sec_list:
                            st.write("**Secondary Detections / Matches:**")
                            for sec in sec_list:
                                if isinstance(sec, dict):
                                    s_conf = f" ({round(sec['confidence']*100, 1)}%)" if sec.get("confidence") is not None else ""
                                    st.write(f"- **{sec.get('label')}**{s_conf} — *{sec.get('category') or sec.get('source') or 'secondary'}*")
                                else:
                                    st.write(f"- {sec}")
                        st.caption(diag_data.get("privacy_note", ""))
            else:
                st.info("No diagnostic records match the selected filters.")
        elif diag_res.status_code == 401:
            st.error("🔒 Authentication Error (401): Session expired or invalid admin token. Please sign in again.")
        elif diag_res.status_code == 403:
            st.error("🚫 Access Forbidden (403): You do not have administrator permissions to access diagnostic reports.")
        elif diag_res.status_code == 500:
            st.error("💥 Server Error (HTTP 500): Database query failed for diagnostic reports. The backend failed closed instead of returning a false empty list.")
        else:
            st.error(f"Failed to fetch diagnostic reports (HTTP {diag_res.status_code}): {diag_res.text}")
    except requests.exceptions.Timeout:
        st.error("⏳ Network Timeout: Request to fetch diagnostic reports timed out.")
    except Exception as err:
        st.error(f"🌐 Connection Error: Could not reach backend API server ({err})")

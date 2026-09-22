"""
AgriFusion — Interactive Streamlit Admin Portal
=================================================
Connects to AgriFusion FastAPI Backend (default http://127.0.0.1:8000 or http://localhost:10000).
Provides administrative workflows for:
  1. 🔑 Admin Authentication (JWT bearer login)
  2. 📚 Knowledge Sources Registry & File Uploads (.pdf, .docx, .txt, .md, website URLs)
  3. 🏛️ Government Schemes Verification Registry
  4. 🩺 Agronomic Advisory Quality & Compliance Audit
  5. 💬 Farmer Feedback & Review System
  6. 🛡️ Tamper-Evident Audit Logs & CSV Export
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
st.markdown("---")

# ── Authentication Screen ────────────────────────────────────────────────────
if not st.session_state.token:
    st.subheader("🔑 Admin Authentication")
    st.info("Log in with your administrator or agronomist credentials to access management controls.")

    col1, col2 = st.columns([1, 1])
    with col1:
        username = st.text_input("Username / Email", value="admin@agrifusion.com")
        password = st.text_input("Password", type="password")
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
            "📚 RAG Knowledge Sources & Uploads",
            "🏛️ Government Schemes Registry",
            "🩺 Advisory Quality & Audit",
            "💬 Farmer Feedback & Support",
            "🛡️ Security Audit Logs",
        ],
    )

# =============================================================================
# MODULE 1: DASHBOARD OVERVIEW
# =============================================================================
if menu == "📊 Dashboard Overview":
    st.header("📊 Executive Overview & System Status")
    
    col1, col2, col3, col4 = st.columns(4)
    try:
        sources_res = requests.get(f"{API_BASE_URL}/api/v1/admin/sources", headers=get_headers()).json()
        schemes_res = requests.get(f"{API_BASE_URL}/api/v1/admin/schemes", headers=get_headers()).json()
        feedback_res = requests.get(f"{API_BASE_URL}/api/v1/admin/feedback", headers=get_headers()).json()
        advisories_res = requests.get(f"{API_BASE_URL}/api/v1/admin/advisories", headers=get_headers()).json()

        col1.metric("Registered Sources", sources_res.get("total", 0))
        col2.metric("Verified Schemes", schemes_res.get("total", 0))
        col3.metric("Farmer Feedback Reports", feedback_res.get("total", 0))
        col4.metric("Advisory RAG Activity Logs", advisories_res.get("total", 0))
    except Exception as err:
        st.warning(f"Could not load live statistics: {err}")

    st.markdown("### Quick Administrative Actions")
    c1, c2, c3 = st.columns(3)
    with c1:
        st.info("📚 **Knowledge Sources**\nUpload documents or website links to expand RAG response data.")
    with c2:
        st.info("🏛️ **Government Schemes**\nVerify AP & Telangana state subsidies and update official URLs.")
    with c3:
        st.info("🩺 **Agronomic Compliance**\nReview AI advisory responses for dosage safety and citations.")

# =============================================================================
# MODULE 2: RAG KNOWLEDGE SOURCES & UPLOADS
# =============================================================================
elif menu == "📚 RAG Knowledge Sources & Uploads":
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
            with st.spinner("Processing document and indexing into vector store..."):
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
                        st.success(f"Successfully uploaded and indexed `{uploaded_file.name}` into RAG knowledge base!")
                    else:
                        st.error(f"Upload failed: {res.json().get('detail', res.text)}")
                except Exception as e:
                    st.error(f"Error connecting to server: {e}")

    st.markdown("---")
    st.subheader("2. Register Official Agriculture Website URL")
    web_col1, web_col2 = st.columns([2, 1])
    with web_col1:
        web_url = st.text_input("Official Website URL", value="https://")
        web_title = st.text_input("Portal Title", value="TNAU Agritech Crop Protection Guide")
    with web_col2:
        web_org = st.text_input("Institute / University", value="TNAU")
        web_btn = st.button("🌐 Register & Scrape Web Source")

        if web_btn and web_url and web_url != "https://":
            try:
                res = requests.post(
                    f"{API_BASE_URL}/api/v1/admin/sources/register",
                    headers=get_headers(),
                    json={
                        "title": web_title,
                        "organization": web_org,
                        "source_type": "official_scheme_portal",
                        "official_url": web_url,
                        "subject": "Web Agricultural Advisory",
                    },
                )
                if res.status_code == 201:
                    st.success("Website URL successfully registered into knowledge sources!")
                else:
                    st.error(f"Registration failed: {res.json().get('detail', res.text)}")
            except Exception as e:
                st.error(f"Error connecting to server: {e}")

    st.markdown("---")
    st.subheader("3. Registered Knowledge Sources Registry")

    search_query = st.text_input("Search Sources Registry by title, organization, or URL", value="")
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
                    st.write(f"**Official URL / File Path:** `{s.get('official_url')}`")
                    st.write(f"**State Relevance:** {', '.join(s.get('state_relevance', []))}")
                    st.write(f"**Index Status:** `{s.get('index_status')}`")

                    c1, c2, c3 = st.columns(3)
                    with c1:
                        if st.button("🔄 Queue Re-index", key=f"reindex_{s['id']}"):
                            rx = requests.post(f"{API_BASE_URL}/api/v1/admin/sources/{s['id']}/reindex", headers=get_headers())
                            if rx.status_code == 200:
                                st.success("Re-indexing queued!")
                            else:
                                st.error(rx.json().get("detail"))
                    with c2:
                        if st.button("✅ Mark Verified", key=f"ver_{s['id']}"):
                            px = requests.patch(
                                f"{API_BASE_URL}/api/v1/admin/sources/{s['id']}",
                                headers=get_headers(),
                                json={"verification_status": "verified"},
                            )
                            if px.status_code == 200:
                                st.success("Source verified!")
                                st.rerun()
                    with c3:
                        if st.button("🗑️ Delete Source", key=f"del_{s['id']}"):
                            dx = requests.delete(f"{API_BASE_URL}/api/v1/admin/sources/{s['id']}", headers=get_headers())
                            if dx.status_code == 200:
                                st.success("Deleted source.")
                                st.rerun()
        else:
            st.info("No knowledge sources match the search criteria.")
    except Exception as err:
        st.error(f"Failed to fetch knowledge sources: {err}")

# =============================================================================
# MODULE 3: GOVERNMENT SCHEMES REGISTRY
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
                
                v1, v2 = st.columns(2)
                with v1:
                    new_ver = st.selectbox(
                        "Update Verification Status",
                        ["pending_review", "verified", "verified_with_caveats", "stale", "unavailable", "rejected"],
                        index=1 if sch.get("verification_status") == "verified" else 0,
                        key=f"sch_ver_{sch['id']}",
                    )
                with v2:
                    if st.button("Save Status Update", key=f"save_sch_{sch['id']}"):
                        up_res = requests.patch(
                            f"{API_BASE_URL}/api/v1/admin/schemes/{sch['id']}",
                            headers=get_headers(),
                            json={"verification_status": new_ver},
                        )
                        if up_res.status_code == 200:
                            st.success("Scheme status updated!")
                            st.rerun()
    except Exception as err:
        st.error(f"Error fetching schemes registry: {err}")

# =============================================================================
# MODULE 4: ADVISORY QUALITY & AUDIT
# =============================================================================
elif menu == "🩺 Advisory Quality & Audit":
    st.header("🩺 Farmer Advisory Quality & Compliance Monitoring")

    try:
        res = requests.get(f"{API_BASE_URL}/api/v1/admin/advisories", headers=get_headers()).json()
        items = res.get("items", [])

        if items:
            for adv in items:
                comp = adv.get("compliance", {})
                status_color = "🟢 Passed" if comp.get("compliance_status") == "passed" else "🟡 Needs Review"
                with st.expander(f"🔍 {adv.get('query_summary')} ({adv.get('crop') or 'General'}) — Compliance: {status_color}"):
                    st.write(f"**Date:** {adv.get('created_at')} | **State:** {adv.get('state')} | **Status:** {adv.get('activity_status')}")
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
        else:
            st.info("No advisory telemetry logs available yet.")
    except Exception as err:
        st.error(f"Failed to fetch advisory compliance records: {err}")

# =============================================================================
# MODULE 5: FARMER FEEDBACK & SUPPORT
# =============================================================================
elif menu == "💬 Farmer Feedback & Support":
    st.header("💬 Farmer Feedback Reports & Review Dashboard")

    try:
        res = requests.get(f"{API_BASE_URL}/api/v1/admin/feedback", headers=get_headers()).json()
        reports = res.get("items", [])

        if reports:
            for f in reports:
                with st.expander(f"⭐ Rating {f.get('rating')}/5 — {f.get('category')} ({f.get('status')})"):
                    st.write(f"**Farmer Comment:** {f.get('comment')}")
                    st.write(f"**Date:** {f.get('created_at')} | **Priority:** `{f.get('priority')}`")

                    c1, c2 = st.columns(2)
                    with c1:
                        new_status = st.selectbox("Status", ["received", "in_review", "resolved", "dismissed"], key=f"stat_{f['id']}")
                    with c2:
                        if st.button("Update Status", key=f"btn_f_{f['id']}"):
                            rx = requests.patch(
                                f"{API_BASE_URL}/api/v1/admin/feedback/{f['id']}",
                                headers=get_headers(),
                                json={"status": new_status},
                            )
                            if rx.status_code == 200:
                                st.success("Feedback status updated!")
                                st.rerun()
        else:
            st.info("No farmer feedback reports submitted yet.")
    except Exception as err:
        st.error(f"Failed to fetch farmer feedback: {err}")

# =============================================================================
# MODULE 6: SECURITY AUDIT LOGS
# =============================================================================
elif menu == "🛡️ Security Audit Logs":
    st.header("🛡️ Administrative Audit Trail & Compliance Export")

    try:
        res = requests.get(f"{API_BASE_URL}/api/v1/admin/audit-logs", headers=get_headers()).json()
        logs = res.get("items", [])

        st.dataframe(logs, use_container_width=True)

        if st.button("📥 Export Tamper-Evident Audit Trail CSV"):
            csv_res = requests.get(f"{API_BASE_URL}/api/v1/admin/audit-logs/export", headers=get_headers())
            if csv_res.status_code == 200:
                st.download_button(
                    label="Click to Download Audit CSV",
                    data=csv_res.content,
                    file_name="agrifusion_admin_audit_logs.csv",
                    mime="text/csv",
                )
    except Exception as err:
        st.error(f"Failed to load audit logs: {err}")

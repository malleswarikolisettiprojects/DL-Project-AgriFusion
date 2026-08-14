import streamlit as st
import os
import base64
from App.backend.database.auth_db import register_user, login_user, verify_admin



def show_auth_page():
    # ------------------------------------------------------------------
    # LOGO LOAD
    # ------------------------------------------------------------------
    _this_dir = os.path.dirname(os.path.abspath(__file__))
    _logo_path = os.path.join(_this_dir, "..", "assets", "logo.png")
    try:
        with open(_logo_path, "rb") as _f:
            _logo_b64 = base64.b64encode(_f.read()).decode()
    except Exception:
        _logo_b64 = ""

    _logo_img_html = (
        f'<img src="data:image/png;base64,{_logo_b64}" '
        'style="width: 185px; height: 185px; object-fit: contain; border-radius: 24px; '
        'background: rgba(255,255,255,0.22); padding: 12px; '
        'box-shadow: 0 10px 30px rgba(0,0,0,0.3); flex-shrink: 0; '
        'border: 2px solid rgba(255,255,255,0.35);" '
        'alt="AgriFusion logo" />'
    ) if _logo_b64 else '<span style="font-size: 4.5rem;">🌾</span>'

    # ------------------------------------------------------------------
    # CHECK IF ADMIN MODE IS REQUESTED VIA URL QUERY PARAM
    # Regular users land on ?mode= (empty) — they never see admin UI.
    # Admins navigate to  ?mode=admin  to see the admin login form.
    # ------------------------------------------------------------------
    try:
        _qp = st.query_params
        _is_admin_mode = str(_qp.get("mode", "")).lower() == "admin"
    except Exception:
        _is_admin_mode = False

    # ------------------------------------------------------------------
    # THEME-ADAPTIVE STYLES  (using st.html — injected directly into DOM)
    # ------------------------------------------------------------------
    st.html("""
    <style>
    /* ── Hero banner ───────────────────────────────────────── */
    .auth-hero {
        background: linear-gradient(135deg, #064E3B 0%, #047857 50%, #059669 100%);
        border-radius: 20px;
        padding: 32px 24px;
        color: white;
        margin-bottom: 24px;
        box-shadow: 0 10px 30px -5px rgba(6, 78, 59, 0.35);
        border: 1.5px solid rgba(255,255,255,0.2);
    }
    .auth-hero h1 {
        color: #FFFFFF !important;
        font-size: 2.8rem !important;
        font-weight: 900 !important;
        margin: 0 0 6px 0 !important;
        text-shadow: 0 3px 12px rgba(0,0,0,0.4) !important;
    }
    .auth-hero p {
        color: #ECFDF5 !important;
        font-size: 1.05rem !important;
        font-weight: 600 !important;
        margin: 0 0 16px 0 !important;
        text-shadow: 0 1px 6px rgba(0,0,0,0.3) !important;
    }

    .badge-pill {
        display: inline-block;
        background: rgba(3, 40, 30, 0.7);
        border: 1.5px solid rgba(255,255,255,0.4);
        color: #FFFFFF !important;
        padding: 5px 14px;
        border-radius: 20px;
        font-size: 0.82rem;
        font-weight: 700;
        margin-right: 6px;
        margin-top: 4px;
    }

    /* ── Feature card (left column) — theme-adaptive ─────── */
    .auth-card {
        background-color: var(--secondary-background-color);
        border: 1.5px solid rgba(128,128,128,0.2);
        border-radius: 16px;
        padding: 24px 22px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.04);
    }
    .auth-card h1, .auth-card h2, .auth-card h3, .auth-card h4 {
        color: var(--text-color) !important;
        font-weight: 800 !important;
    }
    .auth-card p, .auth-card span, .auth-card div, .auth-card strong {
        color: var(--text-color) !important;
    }

    /* ── Feature icon bubbles ──────────────────────── */
    .feature-item {
        display: flex; align-items: flex-start;
        gap: 14px; margin-bottom: 18px;
    }
    .feature-icon {
        background: rgba(5,150,105,0.12);
        color: #059669;
        border-radius: 12px; width: 42px; height: 42px;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.25rem; flex-shrink: 0;
        border: 1px solid rgba(5,150,105,0.3);
    }
    .feature-label { font-weight: 700; font-size: 0.98rem;
                     color: var(--text-color) !important; }
    .feature-desc  { font-size: 0.85rem; line-height: 1.4;
                     color: var(--text-color) !important; opacity: 0.82; }

    /* ── Standard Modern Auth Tab Navigation ── */
    div[data-testid="stTabs"] div[role="tablist"] {
        display: flex;
        justify-content: center;
        gap: 20px;
        background: rgba(128, 128, 128, 0.08);
        padding: 6px 12px;
        border-radius: 14px;
        border: 1px solid rgba(128, 128, 128, 0.18);
        margin-bottom: 16px;
        width: 100%;
    }
    div[data-testid="stTabs"] button[role="tab"] {
        flex: 1;
        text-align: center;
        font-size: 1rem !important;
        font-weight: 700 !important;
        padding: 9px 28px !important;
        border-radius: 10px !important;
        border: none !important;
        color: var(--text-color) !important;
        transition: all 0.2s ease;
        letter-spacing: 0.3px;
    }
    div[data-testid="stTabs"] button[role="tab"][aria-selected="true"] {
        background-color: #059669 !important;
        color: #FFFFFF !important;
        box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3) !important;
    }

    /* ── Admin-mode banner ──────────────────────────── */
    .admin-mode-banner {
        background: linear-gradient(135deg, #1E1B4B 0%, #312E81 100%);
        border: 2px solid #6366F1;
        border-radius: 14px;
        padding: 20px 24px;
        margin-bottom: 20px;
        box-shadow: 0 8px 24px rgba(99,102,241,0.25);
    }
    .admin-mode-banner h3 { color: #C7D2FE !important; margin: 0 0 6px 0 !important; font-size: 1.1rem !important; }
    .admin-mode-banner p  { color: #A5B4FC !important; margin: 0 !important; font-size: 0.88rem !important; }
    </style>
    """)

    # ==================================================================
    # ADMIN-ONLY MODE  (URL: ?mode=admin)
    # The regular login page has NO admin UI at all.
    # ==================================================================
    if _is_admin_mode:
        st.markdown("""
        <div class="admin-mode-banner">
            <h3>👑 AgriFusion Administrator Portal</h3>
            <p>Restricted access. This page is only for authorised system administrators.</p>
        </div>
        """, unsafe_allow_html=True)

        with st.form("admin_login_form_secure"):
            st.markdown("#### 🛡️ Administrator Sign In")
            admin_user = st.text_input("👤 Admin Username", value="", placeholder="Enter admin username")
            admin_pass = st.text_input("🔑 Admin Password", type="password", value="", placeholder="Enter admin password")
            admin_submitted = st.form_submit_button("🛡️ Log In as Administrator", type="primary", use_container_width=True)

            if admin_submitted:
                if not admin_user or not admin_pass:
                    st.error("Please enter both admin username and password.")
                elif verify_admin(admin_user, admin_pass):
                    st.session_state["logged_in"] = True
                    st.session_state["user_role"] = "admin"
                    st.session_state["user_info"] = {"name": "Administrator", "email": "admin@agrifusion.com"}
                    # Clear the query param so the URL looks normal after login
                    st.query_params.clear()
                    st.success("✅ Admin authentication successful!")
                    st.rerun()
                else:
                    st.error("❌ Invalid administrator credentials.")

        st.markdown(
            "<div style='text-align:center; margin-top: 24px;'>"
            "<a href='/' style='font-size: 0.82rem; color: #94A3B8;'>← Back to user login</a>"
            "</div>",
            unsafe_allow_html=True
        )
        return

    # ==================================================================
    # REGULAR USER LOGIN PAGE  (no admin UI)
    # ==================================================================

    # ── HERO BRANDING BANNER ──────────────────────────────────────────
    _emblem_html = (
        f'<img src="data:image/png;base64,{_logo_b64}" '
        'style="width: 220px; height: 220px; object-fit: contain; border-radius: 32px; '
        'background: rgba(255,255,255,0.98); padding: 18px; '
        'box-shadow: 0 0 0 6px rgba(16,185,129,0.35), 0 0 0 12px rgba(16,185,129,0.15), 0 20px 50px rgba(0,0,0,0.4); '
        'border: 3px solid #10B981;" '
        'alt="AgriFusion logo" />'
    ) if _logo_b64 else '<span style="font-size: 5rem; filter: drop-shadow(0 6px 16px rgba(0,0,0,0.4));">🌾</span>'

    st.html(f"""
    <div class="auth-hero" style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px;">
        <div style="margin-bottom: 20px; position: relative; display: inline-block;">
            <div style="position: absolute; inset: -10px; border-radius: 42px; background: radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%); pointer-events: none;"></div>
            {_emblem_html}
        </div>
        <h1>AgriFusion</h1>
        <p>AI Precision Decision Support System for Modern Smart Agriculture</p>
        <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 8px;">
            <span class="badge-pill">🧪 Soil Analysis</span>
            <span class="badge-pill">🌾 Crop Recommendation</span>
            <span class="badge-pill">🌦️ Climate Intelligence</span>
            <span class="badge-pill">💧 Precision Irrigation</span>
            <span class="badge-pill">💰 Market Forecasting</span>
        </div>
    </div>
    """)

    # ── SPLIT LAYOUT: FEATURE HIGHLIGHTS (LEFT) & AUTH CARD (RIGHT) ───
    col_left, col_right = st.columns([1.1, 1.3], gap="large")

    with col_left:
        st.html("""
        <div class="auth-card">
            <h3 style="margin-bottom: 6px; font-size: 1.25rem;">Why AgriFusion?</h3>
            <p style="font-size: 0.88rem; margin-bottom: 22px;">
                Empowering farmers with state-of-the-art machine learning models.
            </p>

            <div class="feature-item">
                <div class="feature-icon">🌱</div>
                <div>
                    <div class="feature-label">Smart Crop Recommendation</div>
                    <div class="feature-desc">Receive crop suggestions based on soil N-P-K levels, rainfall, and temperature.</div>
                </div>
            </div>

            <div class="feature-item">
                <div class="feature-icon">💧</div>
                <div>
                    <div class="feature-label">Precision Irrigation Guide</div>
                    <div class="feature-desc">Get exact daily pump motor hours and drip-line operating schedules.</div>
                </div>
            </div>

            <div class="feature-item">
                <div class="feature-icon">💰</div>
                <div>
                    <div class="feature-label">Market Price &amp; Yield Forecast</div>
                    <div class="feature-desc">Predict expected harvest volume and commodity selling prices in quintals.</div>
                </div>
            </div>

            <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                        color: white; border-radius: 12px; padding: 16px;
                        text-align: center; margin-top: 20px;">
                <div style="font-size: 1.6rem; font-weight: 800; color: #FFFFFF !important;">98.4%</div>
                <div style="font-size: 0.82rem; font-weight: 600; color: #E0F2FE !important;">
                    AI Prediction Accuracy Score
                </div>
            </div>

            <div style="background-color: rgba(217, 119, 6, 0.08);
                        border: 1px solid rgba(217, 119, 6, 0.25);
                        border-left: 4px solid #D97706;
                        padding: 12px 14px;
                        border-radius: 10px;
                        margin-top: 16px;
                        display: flex;
                        align-items: flex-start;
                        gap: 10px;">
                <span style="font-size: 1.1rem; flex-shrink: 0; line-height: 1.2;">⚠️</span>
                <p style="margin: 0; font-size: 0.82rem; line-height: 1.45; color: var(--text-color) !important;">
                    <strong>Important Note:</strong> These AI predictions provide data-driven guidance based on soil 
                    scans and satellite weather. Always combine these insights with your local field observations.
                </p>
            </div>
        </div>
        """)

    with col_right:
        tab_signin, tab_register = st.tabs(["🔑 Sign In", "📝 Register Account"])

        # ── TAB 1: USER SIGN IN ───────────────────────────────────────
        with tab_signin:
            st.html("""
            <div class="auth-card" style="margin-top: 4px;">
                <h3 style="margin-bottom: 4px; font-size: 1.25rem;">Welcome Back 👋</h3>
                <p style="font-size: 0.88rem; margin-bottom: 18px;">
                    Sign in to access your personalised farm dashboard and predictions.
                </p>
            </div>
            """)

            with st.form("user_login_form"):
                email = st.text_input("📧 Email Address or Username", placeholder="e.g. farmer@example.com")
                password = st.text_input("🔒 Password", type="password", value="", placeholder="Enter your password")
                submitted = st.form_submit_button("🚀 Sign In to AgriFusion", use_container_width=True, type="primary")

                if submitted:
                    if not email or not password:
                        st.error("Please enter both email/username and password.")
                    else:
                        success, res = login_user(email, password)
                        if success:
                            st.session_state["logged_in"] = True
                            st.session_state["user_role"] = "user"
                            st.session_state["user_info"] = res
                            st.success(f"Welcome back, {res.get('name', 'User')}! 🌾")
                            st.rerun()
                        else:
                            st.error(res)

            st.html("""
                <div style="margin-top: 15px; padding-top: 12px;
                            border-top: 1px solid rgba(128,128,128,0.2); text-align: center;">
                    <span style="font-size: 0.83rem;">
                        New to AgriFusion? Select <strong>Register Account</strong> above to sign up.
                    </span>
                </div>
            """)

        # ── TAB 2: USER REGISTRATION ──────────────────────────────────
        with tab_register:
            st.html("""
            <div class="auth-card" style="margin-top: 4px;">
                <h3 style="margin-bottom: 4px; font-size: 1.25rem;">Create Your Account</h3>
                <p style="font-size: 0.88rem; margin-bottom: 18px;">
                    Join AgriFusion to generate precision farming insights for your land.
                </p>
            </div>
            """)

            with st.form("user_register_form"):
                reg_name     = st.text_input("👤 Full Name", placeholder="e.g., Rajesh Kumar")
                reg_email    = st.text_input("📧 Email Address or Username", placeholder="farmer@example.com")
                reg_password = st.text_input("🔒 Password", type="password", value="", placeholder="Create a secure password")

                reg_submitted = st.form_submit_button("✨ Create Account", use_container_width=True, type="primary")

                if reg_submitted:
                    if not reg_name or not reg_email or not reg_password:
                        st.error("Please complete all fields.")
                    else:
                        success, msg = register_user(reg_name, reg_email, reg_password)
                        if success:
                            st.success("🎉 Account created! You can now switch to the 'Sign In' tab to log in.")
                        else:
                            st.error(f"Registration error: {msg}")
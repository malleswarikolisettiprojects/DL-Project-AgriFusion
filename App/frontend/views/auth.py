import streamlit as st
import os
import base64
import textwrap
from App.backend.database.auth_db import register_user, login_user, verify_admin


def show_auth_page():
    # Load logo for hero banner
    _logo_path = os.path.join("App", "Frontend", "assets", "logo.png")
    try:
        with open(_logo_path, "rb") as _f:
            _logo_b64 = base64.b64encode(_f.read()).decode()
    except Exception:
        _logo_b64 = ""

    _logo_img_html = (
        f'<img src="data:image/png;base64,{_logo_b64}" '
        'style="width: 54px; height: 54px; object-fit: contain; border-radius: 14px; '
        'background: rgba(255,255,255,0.18); padding: 5px; '
        'box-shadow: 0 4px 14px rgba(0,0,0,0.2); flex-shrink: 0;" '
        'alt="AgriFusion logo" />'
    ) if _logo_b64 else '<span style="font-size: 2rem;">🌾</span>'

    # Theme-Adaptive Styles
    st.markdown("""
    <style>
    .auth-hero {
        background: linear-gradient(135deg, #064E3B 0%, #047857 50%, #059669 100%);
        border-radius: 16px;
        padding: 28px 32px;
        color: white;
        margin-bottom: 24px;
        box-shadow: 0 10px 25px -5px rgba(6, 78, 59, 0.3);
    }
    .auth-hero h1 {
        color: #FFFFFF !important;
        font-size: 2.2rem !important;
        font-weight: 800 !important;
        margin: 0 !important;
    }
    .auth-hero p {
        color: #A7F3D0 !important;
        font-size: 1.02rem !important;
        margin: 10px 0 14px 0 !important;
    }

    .badge-pill {
        display: inline-block;
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: #F0FDF4 !important;
        padding: 5px 14px;
        border-radius: 20px;
        font-size: 0.82rem;
        font-weight: 600;
        margin-right: 8px;
        margin-top: 4px;
    }

    .auth-card {
        background-color: #FFFFFF;
        border: 1.5px solid #E2E8F0;
        border-radius: 16px;
        padding: 26px 24px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
    }
    .auth-card h1, .auth-card h2, .auth-card h3, .auth-card h4 {
        color: #0F172A !important;
        font-weight: 800 !important;
    }
    .auth-card p, .auth-card span, .auth-card div {
        color: #334155 !important;
    }

    .feature-item {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        margin-bottom: 18px;
    }
    .feature-icon {
        background: #ECFDF5;
        color: #059669;
        border-radius: 12px;
        width: 42px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        flex-shrink: 0;
        border: 1px solid #A7F3D0;
    }

    @media (prefers-color-scheme: dark) {
        .auth-card {
            background-color: #161B22 !important;
            border-color: #30363D !important;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
        }
        .auth-card h1, .auth-card h2, .auth-card h3, .auth-card h4 {
            color: #F1F5F9 !important;
        }
        .auth-card p, .auth-card span, .auth-card div {
            color: #CBD5E1 !important;
        }
        .feature-icon {
            background: #0D1117 !important;
            border-color: #059669 !important;
            color: #4ADE80 !important;
        }
    }
    </style>
    """, unsafe_allow_html=True)

    # ---------------------------------------------------------
    # 1. TOP BAR: ADMIN ACCESS
    # ---------------------------------------------------------
    top_col_left, top_col_admin = st.columns([3, 1.2])

    with top_col_admin:
        with st.popover("👑 Admin Portal Access", width='stretch'):
            st.markdown("<h4>👑 Administrator Sign In</h4>", unsafe_allow_html=True)
            st.markdown("<p style='font-size: 0.85rem; margin-bottom: 14px;'>Restricted admin authentication for system control.</p>", unsafe_allow_html=True)
            with st.form("admin_login_form_top_views"):
                admin_user = st.text_input("👤 Admin Username", value="", placeholder="Enter admin username")
                admin_pass = st.text_input("🔑 Admin Password", type="password", value="", placeholder="Enter admin password")
                admin_submitted = st.form_submit_button("🛡️ Log In as Admin", width='stretch', type="secondary")

                if admin_submitted:
                    if not admin_user or not admin_pass:
                        st.error("Please enter both admin username and password.")
                    elif verify_admin(admin_user, admin_pass):
                        st.session_state["logged_in"] = True
                        st.session_state["user_role"] = "admin"
                        st.session_state["user_info"] = {"name": "Administrator", "email": "admin@agrifusion.com"}
                        st.success("Admin authentication successful!")
                        st.rerun()
                    else:
                        st.error("Invalid administrator credentials.")

    st.markdown("<div style='margin-bottom: 6px;'></div>", unsafe_allow_html=True)

    # ---------------------------------------------------------
    # 2. HERO BRANDING BANNER
    # ---------------------------------------------------------
    hero_html = f"""
    <div class="auth-hero">
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 10px;">
            {_logo_img_html}
            <h1>AgriFusion</h1>
        </div>
        <p>AI Precision Decision Support System for Modern Smart Agriculture</p>
        <div>
            <span class="badge-pill">🧪 Soil Analysis</span>
            <span class="badge-pill">🌾 Crop Recommendation</span>
            <span class="badge-pill">🌦️ Climate Intelligence</span>
        </div>
    </div>
    """
    st.markdown(hero_html, unsafe_allow_html=True)

    # ---------------------------------------------------------
    # 3. MAIN SPLIT CONTENT: FEATURE PREVIEW + AUTH FORM
    # ---------------------------------------------------------
    col_left, col_right = st.columns([1.1, 1.4], gap="large")

    with col_left:
        feature_card_html = """
        <div class="auth-card">
            <h3 style="margin-bottom: 6px; font-size: 1.25rem;">Why AgriFusion?</h3>
            <p style="font-size: 0.88rem; margin-bottom: 22px;">Empowering farmers with state-of-the-art machine learning models.</p>
            
            <div class="feature-item">
                <div class="feature-icon">🌱</div>
                <div>
                    <div style="font-weight: 700; font-size: 0.98rem;">Smart Crop Recommendation</div>
                    <div style="font-size: 0.85rem; line-height: 1.4;">Receive crop suggestions based on soil N-P-K levels, rainfall, and temp.</div>
                </div>
            </div>
            
            <div class="feature-item">
                <div class="feature-icon">💧</div>
                <div>
                    <div style="font-weight: 700; font-size: 0.98rem;">Precision Irrigation Guide</div>
                    <div style="font-size: 0.85rem; line-height: 1.4;">Get exact daily 5 HP pump motor hours and drip line schedules.</div>
                </div>
            </div>
            
            <div class="feature-item">
                <div class="feature-icon">💰</div>
                <div>
                    <div style="font-weight: 700; font-size: 0.98rem;">Market Price &amp; Yield Forecast</div>
                    <div style="font-size: 0.85rem; line-height: 1.4;">Predict expected harvest volume and agricultural market selling prices.</div>
                </div>
            </div>
            
            <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; border-radius: 12px; padding: 16px; text-align: center; margin-top: 20px;">
                <div style="font-size: 1.6rem; font-weight: 800; color: #FFFFFF !important;">98.4%</div>
                <div style="font-size: 0.82rem; font-weight: 600; color: #E0F2FE !important;">AI Prediction Accuracy Model</div>
            </div>
        </div>
        """
        st.markdown(feature_card_html, unsafe_allow_html=True)

    with col_right:
        tab1, tab2 = st.tabs(["🔑 User Sign In", "📝 Register Account"])

        with tab1:
            st.markdown("""
            <div class="auth-card" style="margin-top: 10px;">
                <h3 style="margin-bottom: 4px; font-size: 1.25rem;">Welcome Back</h3>
                <p style="font-size: 0.88rem; margin-bottom: 18px;">Sign in to access your farm dashboard and predictions.</p>
            """, unsafe_allow_html=True)

            with st.form("user_login_form_views"):
                email = st.text_input("📧 Email Address or Username", placeholder="e.g. farmer@example.com")
                password = st.text_input("🔒 Password", type="password", value="", placeholder="Enter your password")
                submitted = st.form_submit_button("🚀 Sign In to AgriFusion", width='stretch', type="primary")

                if submitted:
                    if not email or not password:
                        st.error("Please enter both email/username and password.")
                    else:
                        success, res = login_user(email, password)
                        if success:
                            st.session_state["logged_in"] = True
                            st.session_state["user_role"] = "user"
                            st.session_state["user_info"] = res
                            st.success(f"Welcome back, {res.get('name', 'User')}!")
                            st.rerun()
                        else:
                            st.error(res)

            st.markdown("""
                <div style="margin-top: 15px; padding-top: 12px; border-top: 1px solid #E2E8F0; text-align: center;">
                    <span style="font-size: 0.83rem;">New to AgriFusion? Click the <strong>Register Account</strong> tab above to sign up.</span>
                </div>
            </div>
            """, unsafe_allow_html=True)

        with tab2:
            st.markdown("""
            <div class="auth-card" style="margin-top: 10px;">
                <h3 style="margin-bottom: 4px; font-size: 1.25rem;">Create Account</h3>
                <p style="font-size: 0.88rem; margin-bottom: 18px;">Join AgriFusion to generate precision farming insights.</p>
            """, unsafe_allow_html=True)

            with st.form("user_register_form_views"):
                reg_name = st.text_input("👤 Full Name", placeholder="e.g., Rajesh Kumar")
                reg_email = st.text_input("📧 Email Address or Username", placeholder="farmer@example.com")
                reg_password = st.text_input("🔒 Password", type="password", value="", placeholder="Create a secure password")

                reg_submitted = st.form_submit_button("✨ Register Account", width='stretch', type="primary")

                if reg_submitted:
                    if not reg_name or not reg_email or not reg_password:
                        st.error("Please complete all fields.")
                    else:
                        success, msg = register_user(reg_name, reg_email, reg_password)
                        if success:
                            st.success("🎉 Account created! You can now log in using the 'User Sign In' tab.")
                        else:
                            st.error(f"Registration error: {msg}")

            st.markdown("</div>", unsafe_allow_html=True)

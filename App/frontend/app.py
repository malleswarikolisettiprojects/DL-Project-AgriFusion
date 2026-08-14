import streamlit as st
import sys
import os
import base64
from pathlib import Path

# Ensure root workspace directory is in sys.path
BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Ensure case-insensitive module aliases are active in sys.modules
import App
try:
    import App.backend as _b
    sys.modules['App.backend'] = _b
except Exception:
    pass

try:
    import App.frontend as _f
    sys.modules['App.frontend'] = _f
except Exception:
    pass

# Imports from pages
from App.frontend.pages.auth import show_auth_page
from App.frontend.pages.home import show_home
from App.frontend.pages.overview import show_overview
from App.frontend.pages.predictions import show_predictions
from App.frontend.pages.integrated_pipeline import show_integrated_pipeline

try:
    from App.frontend.pages.admin_dashboard import show_admin_dashboard
except ImportError:
    def show_admin_dashboard():
        st.title("Admin Portal")
        st.info("Administrator portal access.")


def get_base64_image(image_path):
    try:
        with open(image_path, "rb") as img_file:
            return base64.b64encode(img_file.read()).decode()
    except Exception:
        return ""


LOGO_PATH = os.path.join("App", "Frontend", "assets", "logo.png")
LOGO_B64 = get_base64_image(LOGO_PATH) if os.path.exists(LOGO_PATH) else ""


def _sidebar_brand_icon_html():
    """Returns the HTML for the sidebar brand mark: the logo image if it
    exists on disk, otherwise the 🌾 emoji tile as a fallback."""
    if LOGO_B64:
        return (
            '<img src="data:image/png;base64,' + LOGO_B64 + '" '
            'style="width: 120px; height: 120px; object-fit: contain; border-radius: 22px; '
            'background: #FFFFFF; padding: 10px; box-shadow: 0 8px 24px rgba(22, 163, 74, 0.4); '
            'margin-bottom: 12px;" alt="AgriFusion logo" />'
        )
    return (
        '<div style="display: inline-flex; align-items: center; justify-content: center; '
        'width: 120px; height: 120px; border-radius: 22px; '
        'background: linear-gradient(135deg, #16A34A 0%, #059669 100%); '
        'box-shadow: 0 8px 24px rgba(22, 163, 74, 0.4); font-size: 3.2rem; margin-bottom: 12px;">'
        '🌾'
        '</div>'
    )

# =========================================================
# PAGE CONFIGURATION
# =========================================================
st.set_page_config(
    page_title="Agri Fusion - AI Platform",
    page_icon="🌾",
    layout="wide",
    initial_sidebar_state="expanded"
)

# =========================================================
# HIGH-CONTRAST GLOBAL CUSTOM CSS
# =========================================================
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    /* =====================================================
       SYSTEM THEME — LIGHT MODE (default)
       ===================================================== */
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }

    .stApp {
        background-color: #F8FAFC;
        transition: background-color 0.3s ease, color 0.3s ease;
    }

    div[data-testid="metric-container"] {
        background: #FFFFFF;
        padding: 16px;
        border-radius: 10px;
        border: 1px solid #CBD5E1;
        box-shadow: 0 2px 6px rgba(0,0,0,0.04);
    }

    div[data-testid="stMetricValue"] {
        font-weight: 800;
        color: #0F172A !important;
    }

    h1, h2, h3, h4, h5, h6 {
        font-weight: 700 !important;
    }

    /* =====================================================
       SYSTEM THEME — DARK MODE (OS preference)
       ===================================================== */
    @media (prefers-color-scheme: dark) {
        html, body, [class*="css"] {
            color: #E2E8F0 !important;
        }

        .stApp {
            background-color: #0D1117 !important;
        }

        /* Main content area */
        .main .block-container {
            background-color: #0D1117 !important;
        }

        h1, h2, h3, h4, h5, h6 {
            color: #F1F5F9 !important;
        }

        p, span, label {
            color: #CBD5E1 !important;
        }

        /* Metric cards */
        div[data-testid="metric-container"] {
            background: #161B22 !important;
            border: 1px solid #30363D !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35) !important;
        }

        div[data-testid="stMetricValue"] {
            color: #F1F5F9 !important;
        }

        div[data-testid="stMetricLabel"] p {
            color: #94A3B8 !important;
        }

        /* Input fields */
        .stTextInput input,
        .stSelectbox select,
        textarea {
            background-color: #161B22 !important;
            color: #E2E8F0 !important;
            border-color: #30363D !important;
        }

        /* Dataframes / tables */
        .stDataFrame, [data-testid="stDataFrame"] {
            background-color: #161B22 !important;
        }

        /* Expander */
        .streamlit-expanderHeader {
            background-color: #161B22 !important;
            color: #E2E8F0 !important;
            border-color: #30363D !important;
        }

        /* Info / warning / error boxes */
        .stAlert {
            background-color: #161B22 !important;
            border-color: #30363D !important;
        }

        /* Tabs */
        button[data-baseweb="tab"] {
            color: #94A3B8 !important;
        }
        button[data-baseweb="tab"][aria-selected="true"] {
            color: #4ADE80 !important;
            border-bottom-color: #4ADE80 !important;
        }

        /* Plotly / chart backgrounds */
        .js-plotly-plot .plotly,
        .js-plotly-plot .plotly .bg {
            fill: #161B22 !important;
        }
    }

    /* =====================================================
       SHARED STYLES (both themes)
       ===================================================== */

    /* Hide Streamlit's auto-generated multipage nav */
    [data-testid="stSidebarNav"] {
        display: none;
    }

    /* Custom button styling */
    .stButton>button {
        border-radius: 8px;
        font-weight: 600;
        transition: all 0.2s ease-in-out;
    }

    .stButton>button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    /* Tab Styling */
    button[data-baseweb="tab"] {
        font-size: 1.05rem;
        font-weight: 600;
        padding: 10px 20px;
    }

    /* =====================================================
       SIDEBAR — OVERALL SURFACE (always dark — brand style)
       ===================================================== */
    section[data-testid="stSidebar"] {
        background: linear-gradient(180deg, #0F172A 0%, #111C33 55%, #0B1424 100%);
        color: #F8FAFC;
        border-right: 1px solid rgba(148, 163, 184, 0.15);
    }

    section[data-testid="stSidebar"] > div {
        padding-top: 0;
    }

    section[data-testid="stSidebar"] .stMarkdown h1,
    section[data-testid="stSidebar"] .stMarkdown h2,
    section[data-testid="stSidebar"] .stMarkdown h3,
    section[data-testid="stSidebar"] p,
    section[data-testid="stSidebar"] span,
    section[data-testid="stSidebar"] label {
        color: #F8FAFC !important;
    }

    /* Section labels like "Navigation" / "Account" */
    section[data-testid="stSidebar"] .sidebar-section-label {
        text-transform: uppercase;
        letter-spacing: 1.2px;
        font-size: 0.72rem !important;
        font-weight: 700 !important;
        color: #64748B !important;
        margin: 4px 0 10px 2px;
    }

    /* =====================================================
       SIDEBAR — NAVIGATION RADIO AS PILL-STYLE NAV ITEMS
       ===================================================== */
    section[data-testid="stSidebar"] div[role="radiogroup"] {
        gap: 4px;
    }

    section[data-testid="stSidebar"] div[role="radiogroup"] label {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 11px 14px;
        border-radius: 10px;
        margin-bottom: 3px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    }

    section[data-testid="stSidebar"] div[role="radiogroup"] label:hover {
        background-color: rgba(74, 222, 128, 0.08);
        transform: translateX(2px);
    }

    section[data-testid="stSidebar"] div[role="radiogroup"] label:has(input:checked) {
        background-color: rgba(74, 222, 128, 0.16);
        border-color: rgba(74, 222, 128, 0.45);
    }

    section[data-testid="stSidebar"] div[role="radiogroup"] label:has(input:checked) p {
        color: #4ADE80 !important;
        font-weight: 700 !important;
    }

    section[data-testid="stSidebar"] div[role="radiogroup"] label p {
        font-size: 0.94rem !important;
        font-weight: 500 !important;
        margin: 0 !important;
    }

    /* Recolor the radio dot to match the green accent */
    section[data-testid="stSidebar"] div[data-baseweb="radio"] div:first-child {
        border-color: #475569 !important;
    }

    section[data-testid="stSidebar"] div[data-baseweb="radio"] input:checked + div {
        border-color: #4ADE80 !important;
        background-color: rgba(74, 222, 128, 0.15) !important;
    }

    /* =====================================================
       SIDEBAR — LOGOUT BUTTON (DANGER STYLE)
       ===================================================== */
    section[data-testid="stSidebar"] .stButton>button {
        background-color: rgba(248, 113, 113, 0.1);
        color: #FCA5A5 !important;
        border: 1px solid rgba(248, 113, 113, 0.35) !important;
        font-weight: 600;
    }

    section[data-testid="stSidebar"] .stButton>button:hover {
        background-color: rgba(248, 113, 113, 0.2);
        border-color: rgba(248, 113, 113, 0.6) !important;
        color: #FEE2E2 !important;
        transform: translateY(-1px);
    }

    section[data-testid="stSidebar"] .stButton>button p {
        color: inherit !important;
    }

    /* Divider look */
    section[data-testid="stSidebar"] hr {
        border-color: rgba(148, 163, 184, 0.18) !important;
        margin: 18px 0 !important;
    }
    </style>
""", unsafe_allow_html=True)

# =========================================================
# SESSION STATE INITIALIZATION
# =========================================================
if "logged_in" not in st.session_state:
    st.session_state["logged_in"] = False
if "user_role" not in st.session_state:
    st.session_state["user_role"] = None
if "user_info" not in st.session_state:
    st.session_state["user_info"] = {}

# =========================================================
# SIDEBAR NAVIGATION & USER INFO
# =========================================================
_this_dir = os.path.dirname(os.path.abspath(__file__))
logo_file = os.path.join(_this_dir, "assets", "logo.png")

if not st.session_state["logged_in"]:
    # ---------------------------------------------------------
    # LOGGED OUT STATE
    # ---------------------------------------------------------
    if os.path.exists(logo_file):
        st.sidebar.image(logo_file, use_container_width=True)
    st.sidebar.title("🌾 AgriFusion")
    st.sidebar.caption("AI Decision Support System for Agriculture")
    st.sidebar.divider()
    st.sidebar.info("👋 Please log in or register on the main page to continue.")

    show_auth_page()

else:
    # ---------------------------------------------------------
    # LOGGED IN STATE
    # ---------------------------------------------------------
    if os.path.exists(logo_file):
        st.sidebar.image(logo_file, use_container_width=True)
    st.sidebar.title("🌾 AgriFusion")
    st.sidebar.caption("Smart Precision Agriculture Platform")
    st.sidebar.divider()

    # User Account Details
    role = st.session_state.get("user_role", "user")
    user_info = st.session_state.get("user_info", {})
    user_name = user_info.get("name", "Farmer")
    user_email = user_info.get("email", user_info.get("username", ""))

    st.sidebar.subheader("👤 Account")
    st.sidebar.write(f"**Name:** {user_name}")
    if user_email:
        st.sidebar.write(f"**Email:** {user_email}")
    st.sidebar.write(f"**Role:** `{role.upper()}`")
    st.sidebar.divider()

    # Page Navigation
    st.sidebar.subheader("🧭 Navigation")
    nav_options = [
        "🏠 Home",
        "📊 Project Overview",
        "🎯 Step-by-Step Predictions",
        "⚡ Integrated Farm Pipeline"
    ]
    if role == "admin":
        nav_options.append("🛠️ Admin Dashboard")

    nav_selection = st.sidebar.radio(
        "Select Page",
        nav_options,
        index=0,
        label_visibility="collapsed"
    )
    nav_selection = nav_selection.split(" ", 1)[1] if " " in nav_selection else nav_selection

    st.sidebar.divider()
    if st.sidebar.button("🚪 Log Out", use_container_width=True):
        st.session_state["logged_in"] = False
        st.session_state["user_role"] = None
        st.session_state["user_info"] = {}
        st.rerun()

    st.sidebar.caption("AgriFusion v1.0 • Precision Agriculture AI")

    # ---------------------------------------------------------
    # PAGE ROUTER
    # ---------------------------------------------------------
    if nav_selection == "Home":
        show_home()
    elif nav_selection == "Project Overview":
        show_overview()
    elif nav_selection == "Step-by-Step Predictions":
        show_predictions()
    elif nav_selection == "Integrated Farm Pipeline":
        show_integrated_pipeline()
    elif nav_selection == "Admin Dashboard":
        show_admin_dashboard()
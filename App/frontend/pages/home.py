import streamlit as st
import os
import base64


def _get_base64_image(img_path: str) -> str | None:
    """Convert an image file to base64 string for CSS embedding."""
    try:
        if os.path.exists(img_path):
            with open(img_path, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")
    except Exception:
        pass
    return None


def show_home():
    # Resolve asset paths relative to this file so they work regardless of cwd
    _this_dir = os.path.dirname(os.path.abspath(__file__))
    _assets = os.path.join(_this_dir, "..", "assets")

    hero_b64 = _get_base64_image(os.path.join(_assets, "smart_farming_hero.jpg"))
    irrig_b64 = _get_base64_image(os.path.join(_assets, "farmer_water_irrigation.jpg"))
    seasons_img_path = os.path.join(_assets, "cropping_seasons.jpg")
    sensor_img_path = os.path.join(_assets, "soil_weather_sensing.jpg")
    displayed_seasons_img = seasons_img_path if os.path.exists(seasons_img_path) else sensor_img_path

    # =========================================================
    # THEME-ADAPTIVE CSS (uses Streamlit CSS variables)
    # =========================================================
    st.markdown("""
    <style>
    /* ── Card base ────────────────────────────────────────── */
    .agri-card {
        background-color: var(--secondary-background-color);
        color: var(--text-color);
        border: 1.5px solid rgba(128,128,128,0.2);
        border-radius: 16px;
        padding: 24px 28px;
        margin-bottom: 22px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.04);
    }
    .agri-card h1, .agri-card h2, .agri-card h3, .agri-card h4 {
        color: var(--text-color) !important;
        font-weight: 800 !important;
        margin-top: 0 !important;
    }
    .agri-card p, .agri-card span, .agri-card div,
    .agri-card li, .agri-card strong, .agri-card ul, .agri-card ol {
        color: var(--text-color) !important;
    }

    /* ── Coloured left-border variants ───────────────────── */
    .agri-card-green  { border-left: 6px solid #16A34A !important; }
    .agri-card-blue   { border-left: 6px solid #2563EB !important; }
    .agri-card-amber  { border-left: 6px solid #D97706 !important; }
    .agri-card-red    { border-left: 6px solid #EF4444 !important; }
    .agri-card-purple { border-left: 6px solid #9333EA !important; }
    .agri-card-orange { border-left: 6px solid #F97316 !important; }

    /* ── Callout (analogies / notes) ─────────────────────── */
    .agri-callout {
        background-color: var(--background-color);
        border: 1px solid rgba(128,128,128,0.25);
        border-radius: 10px;
        padding: 14px 18px;
        margin: 12px 0;
    }
    .agri-callout p, .agri-callout span, .agri-callout strong {
        color: var(--text-color) !important;
    }

    /* ── Stat badge pills ────────────────────────────────── */
    .agri-badge {
        display: inline-block;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 0.83rem;
        font-weight: 700;
        margin-top: 8px;
    }
    .agri-badge-red    { background: #EF4444; color: #FFFFFF !important; }
    .agri-badge-amber  { background: #F59E0B; color: #FFFFFF !important; }
    .agri-badge-blue   { background: #2563EB; color: #FFFFFF !important; }
    .agri-badge-purple { background: #8B5CF6; color: #FFFFFF !important; }
    .agri-badge-green  { background: #10B981; color: #FFFFFF !important; }
    .agri-badge-orange { background: #F97316; color: #FFFFFF !important; }

    /* ── Section headings ────────────────────────────────── */
    .agri-section-heading {
        color: var(--text-color) !important;
        font-weight: 800;
        font-size: 1.55rem;
        margin-top: 24px;
        margin-bottom: 8px;
        padding-bottom: 10px;
    }
    </style>
    """, unsafe_allow_html=True)

    # =========================================================
    # HERO BANNER  (real photo background if available)
    # =========================================================
    if hero_b64:
        hero_bg = (
            f"background: linear-gradient(rgba(5,46,22,0.62), rgba(5,46,22,0.68)),"
            f" url('data:image/jpeg;base64,{hero_b64}') center/cover no-repeat;"
        )
    else:
        hero_bg = "background: linear-gradient(135deg, #052e16 0%, #14532d 40%, #15803d 70%, #166534 100%);"

    st.markdown(f"""
    <div style="{hero_bg} padding: 60px 36px; border-radius: 20px; color: white;
         margin-bottom: 30px; box-shadow: 0 10px 32px rgba(0,0,0,0.30); position: relative; overflow: hidden;">
        <span style="background: #22C55E; color: #FFFFFF; font-weight: 800;
              padding: 6px 18px; border-radius: 25px; font-size: 0.85rem; text-transform: uppercase;
              letter-spacing: 1px; display: inline-block; margin-bottom: 18px;">
            🌾 Farming Guide for Beginners &amp; Farmers
        </span>
        <h1 style="color: #FFFFFF !important; margin: 0 0 18px 0; font-size: 2.8rem; font-weight: 900;
             line-height: 1.25; text-shadow: 0 4px 12px rgba(0,0,0,0.55);">
            How Farming Works in India —<br>Step-by-Step Guide for Anyone
        </h1>
        <p style="font-size: 1.15rem; line-height: 1.85; color: #F0FDF4 !important;
             font-weight: 500; margin: 0; max-width: 760px; text-shadow: 0 2px 6px rgba(0,0,0,0.45);">
            Whether you have never stepped foot on a farm or have been farming for years, this guide breaks down
            how Indian agriculture works, what steps lead to a successful harvest, and how to avoid the 6 most common mistakes.
        </p>
    </div>
    """, unsafe_allow_html=True)

    # =========================================================
    # QUICK FACT GRID (8 NUMBERS)
    # =========================================================
    st.markdown(
        "<h2 class='agri-section-heading' style='border-bottom: 3px solid #16A34A;'>"
        "📊 Indian Agriculture in Numbers</h2>",
        unsafe_allow_html=True
    )

    st.markdown("##### 📍 Farming Demographics & Economy")
    c1, c2, c3, c4 = st.columns(4)
    facts_row1 = [
        ("🌱", "#16A34A", "58%",          "of rural Indian families depend on farming to earn their livelihood."),
        ("🏠", "#2563EB", "146 Million",   "individual farm families across the country."),
        ("📏", "#D97706", "1.08 Hectares", "average farm size (approx. 2.6 acres) owned by a family."),
        ("💵", "#10B981", "₹10,218",       "average monthly income of a farming family."),
    ]
    for col, (icon, color, value, desc) in zip([c1, c2, c3, c4], facts_row1):
        with col:
            st.markdown(f"""
            <div class="agri-card" style="text-align: center; padding: 20px 14px; height: 100%;">
                <div style="font-size: 2rem; margin-bottom: 6px;">{icon}</div>
                <div style="font-size: 1.6rem; font-weight: 900; color: {color}; line-height: 1.1;">{value}</div>
                <div style="font-size: 0.85rem; margin-top: 6px; line-height: 1.4;">{desc}</div>
            </div>
            """, unsafe_allow_html=True)

    st.markdown("##### 📍 Production & Resource Challenges")
    c5, c6, c7, c8 = st.columns(4)
    facts_row2 = [
        ("🏆", "#8B5CF6", "#1 Producer",  "globally of spices, pulses, milk, and jute."),
        ("📦", "#EF4444", "15 – 25%",     "of fresh harvested crops spoil due to lack of cold storage."),
        ("🌧️", "#06B6D4", "52% Rain-fed", "fields have no irrigation and rely entirely on monsoon rain."),
        ("💧", "#0288D1", "80% Water",    "of India's total freshwater is consumed by agriculture."),
    ]
    for col, (icon, color, value, desc) in zip([c5, c6, c7, c8], facts_row2):
        with col:
            st.markdown(f"""
            <div class="agri-card" style="text-align: center; padding: 20px 14px; margin-bottom: 24px; height: 100%;">
                <div style="font-size: 2rem; margin-bottom: 6px;">{icon}</div>
                <div style="font-size: 1.6rem; font-weight: 900; color: {color}; line-height: 1.1;">{value}</div>
                <div style="font-size: 0.85rem; margin-top: 6px; line-height: 1.4;">{desc}</div>
            </div>
            """, unsafe_allow_html=True)

    # =========================================================
    # SECTION 1: THE 5 BASIC STEPS OF FARMING (FOR BEGINNERS)
    # =========================================================
    st.markdown("""
    <div class="agri-card agri-card-green">
        <h2 style="margin-bottom: 12px; font-size: 1.5rem;">
            👨‍🌾 New to Farming? Here is How a Crop Season Works (5 Steps)
        </h2>
        <p style="font-size: 1rem; line-height: 1.8; margin-bottom: 16px;">
            Farming is not just throwing seeds in the dirt and waiting for rain. It is a 5-step cycle that requires planning at every stage:
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
            <div class="agri-callout">
                <strong style="color: #16A34A; font-size: 1.05rem;">1. Soil Preparation &amp; Choice</strong>
                <p style="font-size: 0.88rem; margin-top: 6px; margin-bottom: 0; line-height: 1.6;">
                    Test soil chemistry (pH, nutrients) to pick a crop that naturally thrives in your field.
                </p>
            </div>
            <div class="agri-callout">
                <strong style="color: #2563EB; font-size: 1.05rem;">2. Sowing at the Right Time</strong>
                <p style="font-size: 0.88rem; margin-top: 6px; margin-bottom: 0; line-height: 1.6;">
                    Plant seeds at the start of the right season (Kharif monsoon or Rabi winter) for optimal growth.
                </p>
            </div>
            <div class="agri-callout">
                <strong style="color: #D97706; font-size: 1.05rem;">3. Smart Irrigation</strong>
                <p style="font-size: 0.88rem; margin-top: 6px; margin-bottom: 0; line-height: 1.6;">
                    Water plants precisely during critical growth stages (roots, flowering, grain-filling).
                </p>
            </div>
            <div class="agri-callout">
                <strong style="color: #9333EA; font-size: 1.05rem;">4. Harvest Planning</strong>
                <p style="font-size: 0.88rem; margin-top: 6px; margin-bottom: 0; line-height: 1.6;">
                    Estimate expected harvest volume 30 days early to book storage and transport.
                </p>
            </div>
            <div class="agri-callout">
                <strong style="color: #EF4444; font-size: 1.05rem;">5. Market Selling</strong>
                <p style="font-size: 0.88rem; margin-top: 6px; margin-bottom: 0; line-height: 1.6;">
                    Check expected market prices at harvest to sell at profitable rates rather than panic selling.
                </p>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # =========================================================
    # SECTION 2: THE 6 BIGGEST PITFALLS
    # =========================================================
    st.markdown(
        "<h2 class='agri-section-heading' style='border-bottom: 3px solid #EF4444;'>"
        "⚠️ The 6 Biggest Pitfalls Every Farmer Must Avoid</h2>"
        "<p style='font-size: 1rem; margin-bottom: 20px;'>"
        "These are the most common reasons why farms fail in India. Learn what causes them and how to stay safe.</p>",
        unsafe_allow_html=True
    )

    problems = [
        {
            "class": "agri-card-red", "badge_class": "agri-badge-red", "icon": "1️⃣",
            "title": "Pitfall 1: Planted the Wrong Crop for the Soil",
            "analogy": "💡 Analogy: Like trying to grow a tropical palm tree in frozen snow — it will not survive.",
            "detail": "Different crops need different soil chemistry. Tomatoes need slightly acidic soil; wheat needs good nitrogen. Planting without testing soil chemistry leads to poor germination and total crop loss.",
            "impact": "Over 30% of crop failures occur because crops do not match soil chemistry."
        },
        {
            "class": "agri-card-amber", "badge_class": "agri-badge-amber", "icon": "2️⃣",
            "title": "Pitfall 2: Unpredictable Weather & Extreme Heat",
            "analogy": "💡 Analogy: Imagine a sudden heatwave striking right when flowers are turning into grain.",
            "detail": "Unseasonable dry spells or sudden March heatwaves destroy crops if farmers don't monitor climate risk indicators like Growing Degree Days (GDD) and heat stress levels early.",
            "impact": "In March 2022, an unseasonal heatwave destroyed 3 million tonnes of wheat across India."
        },
        {
            "class": "agri-card-blue", "badge_class": "agri-badge-blue", "icon": "3️⃣",
            "title": "Pitfall 3: Over-Irrigating or Under-Irrigating",
            "analogy": "💡 Analogy: Giving a plant 10 buckets of water when it only needs 1 cup wastes water and rots roots.",
            "detail": "Flooding fields wastes up to 80% of freshwater and washes away fertilizers. Plants need exact water calculations based on growth stage (initial, mid-season, late-season).",
            "impact": "80% of India's freshwater goes to farming, yet over-irrigation depletes groundwater."
        },
        {
            "class": "agri-card-purple", "badge_class": "agri-badge-purple", "icon": "4️⃣",
            "title": "Pitfall 4: Last-Minute Harvest Panic",
            "analogy": "💡 Analogy: Ordering a truck on the day your 100 bags of perishable tomatoes are already picked.",
            "detail": "Without estimating yield volume (Tons/Hectare) 30 days before harvest, farmers cannot arrange cold storage or transport in time, leading to rotting crops.",
            "impact": "India loses ₹92,000 Crore worth of food every year to post-harvest spoilage."
        },
        {
            "class": "agri-card-green", "badge_class": "agri-badge-green", "icon": "5️⃣",
            "title": "Pitfall 5: Selling During a Market Glut (Price Crash)",
            "analogy": "💡 Analogy: Selling tomatoes for ₹1/kg at harvest when consumers in cities pay ₹80/kg.",
            "detail": "When all nearby farmers harvest the same crop simultaneously, local market prices crash. Knowing future market prices beforehand allows farmers to adjust harvest timing or plan storage.",
            "impact": "Farmers often sell below input costs due to lack of market price foresight."
        },
        {
            "class": "agri-card-orange", "badge_class": "agri-badge-orange", "icon": "6️⃣",
            "title": "Pitfall 6: Soil Degradation from Over-Chemical Use",
            "analogy": "💡 Analogy: Taking painkillers every day instead of eating healthy food — eventually the body breaks down.",
            "detail": "Continuous monoculture and heavy chemical fertilizer use without adding organic carbon (FYM/manure) destroys natural soil fertility and water retention.",
            "impact": "120 million hectares of Indian soil are degraded from chemical over-use."
        },
    ]

    for prob in problems:
        st.markdown(f"""
        <div class="agri-card {prob['class']}">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                <span style="font-size: 1.8rem; line-height: 1;">{prob['icon']}</span>
                <h3 style="margin: 0; font-size: 1.15rem;">{prob['title']}</h3>
            </div>
            <div class="agri-callout" style="margin-bottom: 12px;">
                <p style="margin: 0; font-size: 0.96rem; font-style: italic;">{prob['analogy']}</p>
            </div>
            <p style="font-size: 0.95rem; line-height: 1.75; margin-bottom: 12px;">{prob['detail']}</p>
            <div class="agri-badge {prob['badge_class']}">📊 {prob['impact']}</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("---")

    # =========================================================
    # SECOND BACKGROUND PHOTO STRIP (farmer irrigation)
    # =========================================================
    if irrig_b64:
        st.markdown(f"""
        <div style="
            background: linear-gradient(rgba(5,46,22,0.55), rgba(5,46,22,0.65)),
                        url('data:image/jpeg;base64,{irrig_b64}') center/cover no-repeat;
            border-radius: 18px;
            padding: 44px 36px;
            margin: 0 0 30px 0;
            box-shadow: 0 8px 28px rgba(0,0,0,0.28);
        ">
            <h2 style="color: #FFFFFF !important; font-size: 1.9rem; font-weight: 900;
                       margin: 0 0 10px 0; text-shadow: 0 3px 10px rgba(0,0,0,0.5);">
                💧 Smart Irrigation — the Single Biggest Water Saving Opportunity
            </h2>
            <p style="color: #D1FAE5 !important; font-size: 1.05rem; line-height: 1.8;
                      margin: 0; max-width: 720px; text-shadow: 0 2px 6px rgba(0,0,0,0.4);">
                India uses <strong style="color: #6EE7B7 !important;">80%</strong> of its entire freshwater supply for agriculture.
                Yet most of it is wasted through flood irrigation. Drip lines and pump-hour scheduling can
                cut water consumption by <strong style="color: #6EE7B7 !important;">30–50%</strong> while
                increasing yields.
            </p>
        </div>
        """, unsafe_allow_html=True)

    # =========================================================
    # SECTION 3: INDIA'S 3 CROPPING SEASONS
    # =========================================================
    img_col, cal_col = st.columns([1, 1], gap="large")

    with img_col:
        if os.path.exists(displayed_seasons_img):
            st.image(displayed_seasons_img, use_container_width=True,
                     caption="🌾 India's 3 Cropping Seasons: Kharif (Monsoon), Rabi (Winter) & Zaid (Summer)")

    with cal_col:
        st.subheader("🗓️ India's 3 Main Cropping Seasons")
        st.write("In India, crops are grown in three primary seasons depending on rainfall and temperature:")

        st.info(
            "🌧️ **Kharif Season (June – October)**\n\n"
            "Monsoon crops like **Rice, Maize, Cotton, Soybean, and Groundnut**. "
            "Sown with initial monsoon rains. Highly dependent on rainfall patterns."
        )
        st.success(
            "❄️ **Rabi Season (November – March)**\n\n"
            "Winter crops like **Wheat, Mustard, Chickpea, and Lentils**. "
            "Grown using stored soil moisture & irrigation."
        )
        st.warning(
            "☀️ **Zaid Season (March – May)**\n\n"
            "Summer crops like **Watermelon, Cucumber, and Vegetables**. "
            "Short duration, requires frequent watering."
        )

    st.markdown("---")

    # =========================================================
    # CALL TO ACTION
    # =========================================================
    st.markdown("""
    <div class="agri-card agri-card-green" style="text-align: center; padding: 36px 28px;">
        <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 1.4rem;">
            🚀 Ready to Generate Precision Guidance for Your Farm?
        </h3>
        <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 22px; max-width: 750px; margin-left: auto; margin-right: auto;">
            You don't need to be an expert! Use the step-by-step prediction tools in the sidebar to get
            automated guidance on what to plant, how much water to pump, and when to sell.
        </p>
        <div style="display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;">
            <span style="background: #16A34A; color: #FFFFFF; padding: 12px 26px; border-radius: 10px;
                  font-weight: 700; font-size: 0.95rem; box-shadow: 0 4px 14px rgba(22,163,74,0.35);">
                📋 View Project Architecture
            </span>
            <span style="background: #2563EB; color: #FFFFFF; padding: 12px 26px; border-radius: 10px;
                  font-weight: 700; font-size: 0.95rem; box-shadow: 0 4px 14px rgba(37,99,235,0.35);">
                🔮 Start Farm Predictions
            </span>
        </div>
    </div>
    """, unsafe_allow_html=True)
import streamlit as st
import os


def show_overview():
    # =========================================================
    # UNIVERSAL LIGHT + DARK THEME COMPATIBLE STYLES
    # =========================================================
    st.markdown("""
    <style>
    .overview-card {
        background-color: var(--background-color);
        color: var(--text-color) !important;
        border: 1.5px solid rgba(128, 128, 128, 0.25);
        border-radius: 14px;
        padding: 24px 28px;
        margin-bottom: 22px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    }
    .overview-card h1, .overview-card h2, .overview-card h3, .overview-card h4 {
        color: var(--text-color) !important;
        font-weight: 800 !important;
        margin-top: 0 !important;
    }
    .overview-card p, .overview-card span, .overview-card div, 
    .overview-card li, .overview-card strong, .overview-card ul, .overview-card ol {
        color: var(--text-color) !important;
    }
    </style>
    """, unsafe_allow_html=True)

    # =========================================================
    # HEADER
    # =========================================================
    st.markdown("""
        <div class="overview-card" style="border-top: 6px solid #2E7D32; margin-bottom: 25px;">
            <h1 style="margin-bottom: 8px;">
                📋 Project Technical Architecture &amp; Models
            </h1>
            <p style="font-size: 1.05rem; margin-bottom: 0; line-height: 1.6;">
                A complete technical breakdown of <strong>how AgriFusion solves each agricultural
                problem</strong> &mdash; the machine learning algorithms, the dataset APIs,
                and the model pickles used in the pipeline.
            </p>
        </div>
    """, unsafe_allow_html=True)

    # ML Pipeline Image
    pipeline_img_path = os.path.join("App", "Frontend", "assets", "ml_pipeline_flowchart.jpg")
    if os.path.exists(pipeline_img_path):
        st.image(pipeline_img_path, use_container_width=True,
                 caption="🧠 Integrated 5-Stage Machine Learning Farming Pipeline Flow")

    st.markdown("<br>", unsafe_allow_html=True)

    # =========================================================
    # WHAT WE BUILT
    # =========================================================
    st.markdown("""
        <div class="overview-card" style="border-left: 6px solid #2563EB; margin-bottom: 28px;">
            <h2 style="margin-top: 0; margin-bottom: 12px;">
                🚀 What We Built
            </h2>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 14px;">
                We built an end-to-end <strong>Smart Precision Agriculture Decision Platform</strong> that
                transforms raw soil science and meteorological physics into instant, actionable farming advice.
                The platform covers the full farming cycle &mdash; from choosing what to grow, through managing
                water and climate risk, to predicting yield and knowing when to sell.
            </p>
            <ul style="font-size: 0.95rem; line-height: 1.8; margin-bottom: 0; padding-left: 20px;">
                <li><strong>Automated Geospatial Data Engine:</strong> Queries live
                    <strong>ISRIC SoilGrids WCS rasters</strong> for 8 soil parameters (pH, N, Organic Carbon,
                    Clay%, Sand%, Silt%, CEC, Bulk Density) and <strong>OpenMeteo Weather APIs</strong>
                    (Temperature, Humidity, Rainfall, Wind Speed, Solar Radiation) by State and District.</li>
                <li><strong>5 Connected ML Modules:</strong> Crop Recommendation, Climate Risk Assessment,
                    Precision Irrigation, Yield Estimation, and Market Price Forecasting &mdash; each
                    solving a specific, documented problem faced by Indian farmers.</li>
                <li><strong>1-Click Integrated Pipeline:</strong> Recommended crops, growth stages, and
                    weather parameters automatically cascade through all 5 models without duplicate inputs.</li>
                <li><strong>Farmer-Centric Plain-Language Outputs:</strong> Scientific units (mm/day, L/Ha,
                    ET<sub>c</sub>) are translated into: <strong>5 HP Pump hours, drip-line duration, water tankers
                    per acre,</strong> and <strong>₹ revenue estimates.</strong></li>
            </ul>
        </div>
    """, unsafe_allow_html=True)

    # =========================================================
    # DATA SOURCES
    # =========================================================
    st.markdown(
        "<h2 style='font-weight: 800; margin-bottom: 18px;'>"
        "🌍 Data Sources &amp; APIs Used</h2>",
        unsafe_allow_html=True
    )

    ds_cols = st.columns(4)
    data_sources = [
        ("🏛️", "#2563EB", "ISRIC SoilGrids",
         "Global soil property rasters at 250m resolution. Provides pH, NPK, Organic Carbon, Clay/Sand/Silt %, CEC, and Bulk Density."),
        ("🌦️", "#0891B2", "OpenMeteo API",
         "Free open-source weather API. Delivers temperature, humidity, precipitation, wind speed, solar radiation, and 16-day forecasts."),
        ("📊", "#9333EA", "Agricultural Market Data",
         "Historical agricultural market (APMC) commodity price records used to train the market price regression model across States and Districts."),
        ("📜", "#D97706", "FAO Crop Coefficients",
         "FAO-56 Penman-Monteith evapotranspiration reference tables providing K_c values and growth stage durations for 25+ crops."),
    ]
    for col, (icon, color, title, desc) in zip(ds_cols, data_sources):
        with col:
            st.markdown(
                f'<div class="overview-card" style="border-top: 4px solid {color}; padding: 18px; height: 100%;">'
                f'<div style="font-size: 2rem; margin-bottom: 8px;">{icon}</div>'
                f'<strong style="font-size: 0.95rem;">{title}</strong>'
                f'<p style="font-size: 0.83rem; margin-top: 6px; margin-bottom: 0; line-height: 1.5;">{desc}</p>'
                f'</div>',
                unsafe_allow_html=True
            )

    st.markdown("---")

    # =========================================================
    # TECH STACK
    # =========================================================
    st.markdown(
        "<h2 style='font-weight: 800; margin-bottom: 18px;'>"
        "🛠️ Technology Stack</h2>",
        unsafe_allow_html=True
    )

    tech_cols = st.columns(4)
    tech_stack = [
        ("🐍", "#16A34A", "Python 3.10+", "Core ML pipeline, data ingestion, geospatial processing, and backend logic."),
        ("🤖", "#D97706", "Scikit-Learn & Joblib", "RandomForest classifiers and regressors, Linear Regression model, and model serialisation."),
        ("🎬", "#2563EB", "Streamlit", "Full-stack web application framework for the interactive farming dashboard."),
        ("🗄️", "#9333EA", "Supabase (PostgreSQL)", "User authentication, crop growth stage tables, and prediction record storage."),
    ]
    for col, (icon, color, title, desc) in zip(tech_cols, tech_stack):
        with col:
            st.markdown(
                f'<div class="overview-card" style="text-align: center; padding: 18px; height: 100%;">'
                f'<div style="font-size: 2rem; margin-bottom: 6px;">{icon}</div>'
                f'<strong style="font-size: 1rem;">{title}</strong>'
                f'<p style="font-size: 0.84rem; margin-top: 6px; margin-bottom: 0; line-height: 1.45;">{desc}</p>'
                f'</div>',
                unsafe_allow_html=True
            )

    st.markdown("---")

    # =========================================================
    # 5 MODULE SOLUTION CARDS (DETAILED)
    # =========================================================
    st.markdown(
        "<h2 style='font-weight: 800; margin-bottom: 6px; font-size: 1.6rem;'>"
        "🧠 Five AI Modules — Problems Solved &amp; How</h2>"
        "<p style='margin-bottom: 24px;'>"
        "Each module directly targets one of the six core problems Indian farmers face every season.</p>",
        unsafe_allow_html=True
    )

    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "🌱 Crop Recommendation",
        "🌦️ Climate Risk",
        "💧 Irrigation Needs",
        "🌾 Yield Estimation",
        "💰 Market Price"
    ])

    # ── TAB 1: CROP RECOMMENDATION ──────────────────────────────
    with tab1:
        st.markdown("""
            <div class="overview-card" style="border-left: 6px solid #16A34A; margin-bottom: 18px;">
                <h3 style="margin-top: 0; font-weight: 800;">
                    🌱 Module 1: Smart Crop Recommendation
                </h3>
                <p style="font-size: 0.95rem; line-height: 1.7; margin-bottom: 10px;">
                    <strong>Problem Solved:</strong> Farmers sow crops based on tradition, ignoring soil chemistry and texture, leading to germination failure and complete crop loss.
                </p>
                <p style="font-size: 0.95rem; line-height: 1.7; margin-bottom: 0;">
                    <strong>Our Solution:</strong> A <strong>Random Forest Classifier</strong> trained on soil physics and seasonal climate profiles recommends the top crops best suited to the farmer's exact land conditions.
                </p>
            </div>
        """, unsafe_allow_html=True)

        st.markdown("#### 🤖 Model Specifications")
        spec_col1, spec_col2 = st.columns(2)
        with spec_col1:
            st.markdown("""
- **Algorithm**: `RandomForestClassifier` (Multi-class ensemble)
- **Model Pickle**: `model.pkl` (Trained classification model)
- **Scaler File**: `scaler.pkl` (StandardScaler normalisation)
            """)
        with spec_col2:
            st.markdown("""
- **Encoders**: `label_encoder.pkl` (Crop output decoder), `season_encoder.pkl` (Cropping season OHE)
- **Feature Check**: `feature_columns.pkl` (Ensures strict feature sequence match)
            """)

        st.markdown("#### 📥 Input Features (Soil Physics & Climate)")
        st.markdown("""
| Feature Name | Description | Source | Units |
| :--- | :--- | :--- | :--- |
| **Nitrogen (N)** | Key macronutrient for vegetative leaf growth. | ISRIC SoilGrids API | mg/kg |
| **Phosphorus (P)** | Essential for root expansion and flowering. | ISRIC SoilGrids API | mg/kg |
| **Potassium (K)** | Aids crop disease resistance and water regulation. | ISRIC SoilGrids API | mg/kg |
| **Soil pH** | Measures soil acidity/alkalinity levels. | ISRIC SoilGrids API | pH Scale (0-14) |
| **Organic Carbon** | Represents organic matter content & health. | ISRIC SoilGrids API | dg/kg |
| **CEC** | Cation Exchange Capacity; soil nutrient retention ability. | ISRIC SoilGrids API | mmol(c)/kg |
| **Clay / Sand / Silt** | Mechanical texture percentage of the soil. | ISRIC SoilGrids API | % |
| **Bulk Density** | Soil compaction and porosity scale. | ISRIC SoilGrids API | kg/dm³ |
| **Mean Temp** | Growing window historical average temperature. | OpenMeteo Weather API | °C |
| **Relative Humidity** | Ambient moisture concentration indicator. | OpenMeteo Weather API | % |
| **Rainfall** | Cumulative precipitation during crop duration. | OpenMeteo Weather API | mm |
| **Season** | Active crop season based on sowing date. | Computed (Sowing date) | Kharif / Rabi / Zaid |
        """)

        st.markdown("#### 📤 Output Predictions")
        st.markdown("""
| Output Target | Description | Source | Units |
| :--- | :--- | :--- | :--- |
| **Recommended Crop** | The crop with the highest suitability match score. | Model Output (`model.pkl`) | Categorical Name |
| **Confidence Score** | Likelihood percentage of cultivation success. | Model Probability | % |
| **Alternative Crops** | Remaining top-4 ranked alternative crop recommendations. | Model Probability list | Ranked list |
        """)

    # ── TAB 2: CLIMATE RISK ──────────────────────────────────────
    with tab2:
        st.markdown("""
            <div class="overview-card" style="border-left: 6px solid #D97706; margin-bottom: 18px;">
                <h3 style="margin-top: 0; font-weight: 800;">
                    🌦️ Module 2: Climate Risk Assessment
                </h3>
                <p style="font-size: 0.95rem; line-height: 1.7; margin-bottom: 10px;">
                    <strong>Problem Solved:</strong> Extreme heat waves, consecutive dry days, and erratic monsoons hit farms without warning, causing crop stress or total yield destruction.
                </p>
                <p style="font-size: 0.95rem; line-height: 1.7; margin-bottom: 0;">
                    <strong>Our Solution:</strong> A <strong>Random Forest Classifier</strong> evaluates environmental physics metrics to classify climate vulnerability into Low, Moderate, or High Risk with mitigation recommendations.
                </p>
            </div>
        """, unsafe_allow_html=True)

        st.markdown("#### 🤖 Model Specifications")
        spec_col1, spec_col2 = st.columns(2)
        with spec_col1:
            st.markdown("""
- **Algorithm**: `RandomForestClassifier` (Risk rating ensemble)
- **Model Pickle**: `model.pkl` (Risk level classification model)
            """)
        with spec_col2:
            st.markdown("""
- **Encoder File**: `encoder.pkl` (Categorical location/crop encoders)
            """)

        st.markdown("#### 📥 Input Features (Climate Stress Physics)")
        st.markdown("""
| Feature Name | Description | Source | Units |
| :--- | :--- | :--- | :--- |
| **GDD** | Growing Degree Days; heat accumulated by crop over time. | Calculated from OpenMeteo | °C-days |
| **Heat Stress Index** | Total number of days exceeding critical crop threshold. | Calculated from OpenMeteo | Days |
| **Consecutive Dry Days** | Maximum consecutive days without measurable rain. | Calculated from OpenMeteo | Days |
| **Solar Radiation** | Cumulative shortwave radiation exposure. | OpenMeteo API | MJ/m²/day |
| **7-Day Rainfall Anomaly**| Short-term precipitation deviation from average. | Calculated from OpenMeteo | mm |
| **30-Day Rainfall Anomaly**| Seasonal precipitation deviation from baseline. | Calculated from OpenMeteo | mm |
        """)

        st.markdown("#### 📤 Output Predictions")
        st.markdown("""
| Output Target | Description | Source | Units |
| :--- | :--- | :--- | :--- |
| **Climate Risk Level** | Overall classification of stress hazard. | Model Output (`model.pkl`) | Low / Moderate / High |
| **Vulnerability Advisory**| Target guidance for mulching, irrigation adjustments. | System Rule-Engine | Plain Text |
        """)

    # ── TAB 3: IRRIGATION ────────────────────────────────────────
    with tab3:
        st.markdown("""
            <div class="overview-card" style="border-left: 6px solid #2563EB; margin-bottom: 18px;">
                <h3 style="margin-top: 0; font-weight: 800;">
                    💧 Module 3: Precision Irrigation Scheduling
                </h3>
                <p style="font-size: 0.95rem; line-height: 1.7; margin-bottom: 10px;">
                    <strong>Problem Solved:</strong> Without knowing crop water requirements, farmers over-irrigate (wasting groundwater and electricity) or under-irrigate (causing crop stress and yield loss).
                </p>
                <p style="font-size: 0.95rem; line-height: 1.7; margin-bottom: 0;">
                    <strong>Our Solution:</strong> A <strong>Linear Regression</strong> model estimates Net Irrigation requirements, combined with the <strong>FAO Penman-Monteith Evapotranspiration (ETc = ET0 × Kc)</strong> model to schedule dynamic water needs.
                </p>
            </div>
        """, unsafe_allow_html=True)

        st.markdown("#### 🤖 Engine Specifications")
        spec_col1, spec_col2 = st.columns(2)
        with spec_col1:
            st.markdown("""
- **Algorithm**: `LinearRegression` (Irrigation depth regression model)
- **Model Pickle**: `model.pkl` (Calculates required water depth)
- **Scaler File**: `irrigation_preprocessing.pkl` (Standard scale parameters)
            """)
        with spec_col2:
            st.markdown("""
- **Encoder File**: `encoder.pkl` (Encodes crop type and soil classifications)
- **Feature Check**: `irrigation_features.pkl` (Ensures matching feature vectors)
- **FAO Kc Tables**: Pulled dynamically via Supabase growth stage mappings
            """)

        st.markdown("#### 📥 Input Features (Water Depletion & Soil)")
        st.markdown("""
| Feature Name | Description | Source | Units |
| :--- | :--- | :--- | :--- |
| **Reference ET0** | Evapotranspiration rate for grass reference crop. | OpenMeteo API | mm/day |
| **Crop Coefficient (Kc)** | Scale factor corresponding to current crop growth stage. | FAO-56 lookup (Supabase) | Ratio (dimensionless) |
| **Growth Stage** | Current phase of maturity (Initial, Dev, Mid, Late). | Calculated from sowing date| Name string |
| **Soil Texture** | Proportions of sand, silt, and clay in the soil profile. | ISRIC SoilGrids | % |
| **Organic Carbon** | Soil organic carbon density. | ISRIC SoilGrids | dg/kg |
| **Bulk Density** | Volumetric mass of dry soil (measures compaction). | ISRIC SoilGrids | kg/dm³ |
| **Field Capacity** | Maximum soil moisture retention limit. | ISRIC SoilGrids | % volume |
| **Wilting Point** | Minimal soil moisture limit before crop wilts. | ISRIC SoilGrids | % volume |
| **Available Water** | Delta between Field Capacity and Wilting Point. | ISRIC SoilGrids | mm/m |
| **Root Depth** | Approximate root depth limit based on crop stage. | FAO-56 Table lookup | meters |
        """)

        st.markdown("#### 📤 Output Predictions & Actionable Guides")
        st.markdown("""
| Output Target | Description | Source | Units |
| :--- | :--- | :--- | :--- |
| **Daily Irrigation Depth** | Amount of water depth required. | Model Output (`model.pkl`) | mm/day |
| **Total Water Volume** | Total volumetric water need for farmer's land. | Computed: depth * area | Litres |
| **5 HP Pump Run Time** | Hours to operate a standard 5 HP electric pump. | Computed (45,000 L/hr) | Hours |
| **Drip Run Time** | Active duration needed for sub-surface drip lines. | Computed (10,000 L/hr/Ha)| Hours |
| **Water Tankers** | Approximate 10,000L transport tankers equivalent. | Computed (Liters / 10,000) | Tankers |
        """)

    # ── TAB 4: YIELD ESTIMATION ──────────────────────────────────
    with tab4:
        st.markdown("""
            <div class="overview-card" style="border-left: 6px solid #475569; margin-bottom: 18px;">
                <h3 style="margin-top: 0; font-weight: 800;">
                    🌾 Module 4: Crop Yield Estimation
                </h3>
                <p style="font-size: 0.95rem; line-height: 1.7; margin-bottom: 10px;">
                    <strong>Problem Solved:</strong> Without harvest volume forecasts, farmers cannot book cold storage, arrange logistics, or negotiate fair prices.
                </p>
                <p style="font-size: 0.95rem; line-height: 1.7; margin-bottom: 0;">
                    <strong>Our Solution:</strong> A <strong>Random Forest Regressor</strong> trained on regional soil moisture, farm area (hectares), seasonal precipitation, and temperature projects yield in Tons/Hectare and total farm harvest volume.
                </p>
            </div>
        """, unsafe_allow_html=True)

        st.markdown("#### 🤖 Model Specifications")
        spec_col1, spec_col2 = st.columns(2)
        with spec_col1:
            st.markdown("""
- **Algorithm**: `RandomForestRegressor` (Ensemble Regressor)
- **Model Pickle**: `model.pkl` (Trained yield regressor model)
            """)
        with spec_col2:
            st.markdown("""
- **Encoder File**: `encoder.pkl` (Encodes district and crop categories)
- **Feature Check**: `yield_features.pkl` (Validates model features structure)
- **State Map**: `state_maping.pkl` (Validates target state labels)
            """)

        st.markdown("#### 📥 Input Features (Yield Drivers)")
        st.markdown("""
| Feature Name | Description | Source | Units |
| :--- | :--- | :--- | :--- |
| **Land Area** | Total area of the field to harvest. | User input | Hectares |
| **Crop Type** | Recommended or selected crop name. | Sowing selection | Name string |
| **Soil Moisture** | Mean volumetric soil moisture during season. | OpenMeteo Weather API | m³/m³ |
| **Seasonal Temperature** | Average temperature across growing season. | OpenMeteo Weather API | °C |
| **Seasonal Rainfall** | Cumulative seasonal precipitation. | OpenMeteo Weather API | mm |
| **Organic Carbon** | Soil organic carbon content. | ISRIC SoilGrids | dg/kg |
        """)

        st.markdown("#### 📤 Output Predictions")
        st.markdown("""
| Output Target | Description | Source | Units |
| :--- | :--- | :--- | :--- |
| **Per-Hectare Yield** | Estimated crop output density per unit area. | Model Output (`model.pkl`) | Tons / Hectare |
| **Total Farm Yield (Tons)** | Volumetric mass of expected total harvest. | Computed: yield * area | Tons |
| **Total Farm Yield (Qtl)** | Expected total harvest in standard market units. | Computed: Tons * 10 | Quintals (qtl) |
        """)

    # ── TAB 5: MARKET PRICE ──────────────────────────────────────
    with tab5:
        st.markdown("""
            <div class="overview-card" style="border-left: 6px solid #9333EA; margin-bottom: 18px;">
                <h3 style="margin-top: 0; font-weight: 800;">
                    💰 Module 5: Market Price &amp; Revenue Forecasting
                </h3>
                <p style="font-size: 0.95rem; line-height: 1.7; margin-bottom: 10px;">
                    <strong>Problem Solved:</strong> Farmers have no visibility into future market prices at sowing time, leading to distress selling during harvest gluts.
                </p>
                <p style="font-size: 0.95rem; line-height: 1.7; margin-bottom: 0;">
                    <strong>Our Solution:</strong> A <strong>Random Forest Regressor</strong> predicts expected commodity prices (₹ per Quintal) based on location, crop type, and harvest date.
                </p>
            </div>
        """, unsafe_allow_html=True)

        st.markdown("#### 🤖 Model Specifications")
        spec_col1, spec_col2 = st.columns(2)
        with spec_col1:
            st.markdown("""
- **Algorithm**: `RandomForestRegressor` (Market price regressor)
- **Model Pickle**: `model.pkl` (Trained price estimator model)
            """)
        with spec_col2:
            st.markdown("""
- **Label Mappings**: `Label_Mappings.pkl` (State, District, and Crop maps)
            """)

        st.markdown("#### 📥 Input Features (Market Conditions)")
        st.markdown("""
| Feature Name | Description | Source | Units |
| :--- | :--- | :--- | :--- |
| **Crop Name** | Crop commodity to sell in agricultural market. | Selected Crop | Name string |
| **State & District** | Geographic location of target agricultural market. | Location configuration | Name string |
| **Target Date** | Calendar date when crop reaches harvest ready status. | Computed: sowing + growth days | Date (YYYY-MM-DD) |
| **Cropping Season** | Season classification matching target sale date. | Computed (Season index) | Kharif / Rabi / Zaid |
| **Year** | Sowing or target harvest calendar year. | Sowing configuration | Year |
        """)

        st.markdown("#### 📤 Output Predictions")
        st.markdown("""
| Output Target | Description | Source | Units |
| :--- | :--- | :--- | :--- |
| **Forecasted Market Price** | Predicted selling rate per unit weight in market. | Model Output (`model.pkl`) | ₹ / Quintal |
| **Total Gross Revenue** | Potential earnings of total harvest. | Computed: price * yield_qtl | ₹ (Rupees) |
| **Market Arrival volume** | Estimated quantity of crop entering local market today. | Model Output (`model.pkl`) | Quintals |
        """)

    st.markdown("---")

    # =========================================================
    # INTEGRATED PIPELINE FLOW (NATIVE STABLE STREAMLIT LAYOUT)
    # =========================================================
    st.markdown("## 🔗 End-to-End System Workflow")
    st.markdown("How data cascades sequentially across modules in the integrated pipeline:")

    c_step1, c_step2, c_step3, c_step4, c_step5 = st.columns(5)

    with c_step1:
        st.info(
            "🌐 **Step 1: Ingestion**\n\n"
            "Queries live satellite weather (OpenMeteo) and physical soil (ISRIC SoilGrids) APIs based on district."
        )

    with c_step2:
        st.success(
            "🌱 **Step 2: Crop Choice**\n\n"
            "**Core Decision**\n\n"
            "Random Forest Classifier ranks crops. Selects best match for soil nutrients and climate."
        )

    with c_step3:
        st.warning(
            "🌦️ **Step 3: Weather Risk**\n\n"
            "Random Forest Classifier checks for heat stress, dry spells, and monsoon deviation indicators."
        )

    with c_step4:
        st.success(
            "💧 **Step 4: Water Needs**\n\n"
            "**Core Decision**\n\n"
            "Linear Regression schedules water needs. Calculates pump hours based on FAO-56 growth stages."
        )

    with c_step5:
        st.success(
            "💰 **Step 5: Revenue**\n\n"
            "**Core Decision**\n\n"
            "Random Forest Regressors estimate total yield in quintals and forecast future market selling prices."
        )

    st.markdown("<br>", unsafe_allow_html=True)
    st.info(
        "⚡ **Automated Data Cascade:** Sowing dates and location inputs automatically calculate maturity days, "
        "harvest dates, Kc factors, expected yields, and price forecasts down the line with zero duplication."
    )
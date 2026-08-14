import streamlit as st
import pandas as pd
from datetime import date

from App.backend.crop import predict_crop
from App.backend.climate_risk import predict_climate_risk
from App.backend.irrigation import predict_irrigation
from App.backend.yields import predict_yield
from App.backend.market import predict_market_price

from App.backend.api.location import get_states, get_districts, get_location
from App.backend.growth_stages import compute_date_range, compute_stage_boundaries, get_all_crop_names
from App.backend.seasons import get_season

# Standard Average Cost of Cultivation (Principal Investment Benchmark in ₹/Hectare) for Indian Crops
# Based on ICAR / Commission for Agricultural Costs and Prices (CACP) benchmarks
DEFAULT_CULTIVATION_COSTS_PER_HA = {
    "rice": 42000,
    "paddy": 42000,
    "wheat": 32000,
    "maize": 30000,
    "cotton": 52000,
    "sugarcane": 85000,
    "chickpea": 26000,
    "groundnut": 38000,
    "banana": 140000,
    "jute": 35000,
    "coffee": 90000,
    "tea": 110000,
    "coconut": 65000,
    "blackgram": 22000,
    "mungbean": 22000,
    "lentil": 24000,
    "pigeonpeas": 28000,
    "mothbeans": 18000,
    "kidneybeans": 32000,
    "pomegranate": 120000,
    "watermelon": 45000,
    "muskmelon": 45000,
    "apple": 150000,
    "orange": 95000,
    "papaya": 85000,
    "mango": 75000,
    "grapes": 160000
}

def get_default_cost_per_ha(crop_name: str) -> float:
    if not crop_name:
        return 35000.0
    c_lower = str(crop_name).strip().lower()
    return float(DEFAULT_CULTIVATION_COSTS_PER_HA.get(c_lower, 35000.0))

def get_soil_texture_name(clay, sand, silt) -> str:
    try:
        c, s, si = float(clay), float(sand), float(silt)
    except Exception:
        return "Loam (Balanced Texture)"
    if c >= 40:
        if s >= 45: return "Sandy Clay"
        elif si >= 40: return "Silty Clay"
        else: return "Clay (Heavy Soil)"
    elif c >= 27:
        if s >= 45: return "Sandy Clay Loam"
        elif s <= 20: return "Silty Clay Loam"
        else: return "Clay Loam"
    elif c >= 20:
        if s >= 52: return "Sandy Clay Loam"
        else: return "Loam (Fertile Alluvial)"
    else:
        if si >= 80: return "Silt Soil"
        elif si >= 50: return "Silt Loam"
        elif s >= 85: return "Sand Soil"
        elif s >= 70: return "Loamy Sand"
        elif s >= 50: return "Sandy Loam (Well Drained)"
        else: return "Loam (Balanced Texture)"



def _render_ai_disclaimer():
    disclaimer_html = """
    <div class="pred-disclaimer" style="margin-bottom: 25px;">
        <span style="font-size: 1.3rem;">⚠️</span>
        <p style="margin: 0; font-size: 0.95rem; line-height: 1.5;">
            <strong>Important Note:</strong> These AI predictions provide data-driven guidance based on soil 
            scans and satellite weather. Always combine these insights with your local field observations.
        </p>
    </div>
    """
    st.markdown(disclaimer_html, unsafe_allow_html=True)


def _crop_selector(key_prefix, label="Select Target Crop"):
    all_crops = list(get_all_crop_names())
    if not all_crops:
        all_crops = ["Rice", "Maize", "Wheat", "Cotton", "Sugarcane", "Chickpea", "Groundnut", "Banana"]

    # Initialise if not present
    if "active_crop" not in st.session_state:
        rec_crop = st.session_state.get("mod_crop_res", {}).get("predicted_crop")
        if not rec_crop and "integ_crop_res" in st.session_state:
            rec_crop = st.session_state.get("integ_crop_res", {}).get("predicted_crop")
        if not rec_crop:
            rec_crop = "Rice"
        st.session_state["active_crop"] = rec_crop

    current_val = st.session_state["active_crop"]
    
    # Ensure current value is in all_crops list
    matched = None
    for c in all_crops:
        if c.lower() == current_val.strip().lower():
            matched = c
            break

    if matched:
        if matched in all_crops:
            idx = all_crops.index(matched)
        else:
            all_crops = [matched] + all_crops
            idx = 0
    else:
        all_crops = [current_val.strip()] + all_crops
        idx = 0

    selected = st.selectbox(label, all_crops, index=idx, key=f"{key_prefix}_crop_selector_widget")
    if selected != current_val:
        st.session_state["active_crop"] = selected
    return selected


def _state_district_inputs(key_prefix, default_state=None, default_district=None):
    states = get_states()
    state_index = states.index(default_state) if default_state in states else 0
    state = st.selectbox("State", states, index=state_index, key=f"{key_prefix}_state")

    districts = get_districts(state)
    district_index = (
        districts.index(default_district) if default_district in districts else 0
    )
    district = st.selectbox(
        "District", districts, index=district_index if districts else 0,
        key=f"{key_prefix}_district",
    )
    return state, district


def _resolve_location(state, district):
    cache_key = f"loc::{state}::{district}"

    if cache_key not in st.session_state:
        try:
            st.session_state[cache_key] = get_location(state=state, district=district)
        except Exception as e:
            st.session_state[cache_key] = None
            st.session_state[f"{cache_key}::error"] = str(e)

    location = st.session_state[cache_key]
    if location is None:
        error_msg = st.session_state.get(f"{cache_key}::error", "Unknown error")
        st.error(f"⚠️ Could not resolve location for {district}, {state}: {error_msg}")

    return location


def show_predictions():
    # Inject Theme-Adaptive Styles with improved layout spacing
    st.markdown("""
    <style>
    .pred-card {
        background-color: var(--background-color);
        color: var(--text-color);
        border: 1.5px solid rgba(128, 128, 128, 0.2);
        border-radius: 14px;
        padding: 24px 28px;
        margin-bottom: 24px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.04);
    }
    .pred-card h1, .pred-card h2, .pred-card h3, .pred-card h4 {
        color: var(--text-color) !important;
        font-weight: 800 !important;
        margin-top: 0 !important;
    }
    .pred-card p, .pred-card span, .pred-card div, .pred-card li, .pred-card strong, .pred-card ul {
        color: var(--text-color) !important;
    }
    .pred-disclaimer {
        background-color: rgba(217, 119, 6, 0.1);
        border: 1px solid rgba(217, 119, 6, 0.3);
        border-left: 6px solid #D97706;
        padding: 16px 20px;
        border-radius: 10px;
    }
    .pred-disclaimer p, .pred-disclaimer strong {
        color: var(--text-color) !important;
    }
    /* Metric container layout tweaks to prevent congestion */
    div[data-testid="stMetric"] {
        padding: 12px 18px !important;
        margin-bottom: 15px !important;
    }
    </style>
    """, unsafe_allow_html=True)

    header_html = """
    <div class="pred-card" style="border-top: 6px solid #0288D1; margin-bottom: 25px;">
        <h1 style="margin-bottom: 8px;">🔮 Interactive Modular Farm Predictions</h1>
        <p style="font-size: 1.05rem; margin-bottom: 0; line-height: 1.6;">
            Step-by-step decision tools designed for any farmer or beginner. Pick your location and date to get 
            instant recommendations on crops, climate risks, water needs, yield expectations, and market prices.
        </p>
    </div>
    """
    st.markdown(header_html, unsafe_allow_html=True)

    _render_ai_disclaimer()

    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "1. 🌱 Crop Selection",
        "2. 🌦️ Climate Risk",
        "3. 💧 Water Needs",
        "4. 🌾 Yield Forecast",
        "5. 💰 Market Selling Price"
    ])

    # =========================================================
    # TAB 1: CROP MODEL
    # =========================================================
    with tab1:
        st.markdown("""
        <div class="pred-card" style="border-left: 6px solid #16A34A; margin-bottom: 25px;">
            <h3 style="margin-top: 0; margin-bottom: 8px;">🌱 Step 1: Find the Best Crop for Your Soil &amp; Location</h3>
            <p style="font-size: 0.95rem; line-height: 1.6; margin-bottom: 0;">
                Select your State, District, and planned sowing date. Our system checks live ISRIC soil physics 
                (pH, Nitrogen, Organic Carbon, Texture) and seasonal climate patterns to rank the top suited crops.
            </p>
        </div>
        """, unsafe_allow_html=True)

        col1, col2 = st.columns(2)
        with col1:
            c_state, c_district = _state_district_inputs("c")
        with col2:
            c_start = st.date_input("Planned Sowing Date", value=date.today(), key="c_start")

        c_season = get_season(c_start)
        c_start_val, c_end_val, _ = compute_date_range(None, c_start)
        st.info(f"🗓️ Season: **{c_season}** | Standard Growth Window: **{c_start_val} → {c_end_val}**")

        c_location = _resolve_location(c_state, c_district)

        if st.button("🚀 Find Recommended Crops", type="primary", key="btn_crop", disabled=c_location is None):
            input_data = {
                "state": c_state,
                "district": c_district,
                "season": c_season,
                "start_date": str(c_start_val),
                "end_date": str(c_end_val),
                "location": c_location
            }
            with st.spinner("Analyzing Soil Chemistry & Seasonal Climate..."):
                try:
                    res = predict_crop(input_data)
                    st.session_state["mod_crop_res"] = res
                    st.session_state["active_crop"] = res.get("predicted_crop", "Rice")
                    st.success("✅ Crop Recommendation Complete!")
                except Exception as e:
                    st.error(f"❌ Crop prediction failed: {str(e)}")

        if "mod_crop_res" in st.session_state:
            res = st.session_state["mod_crop_res"]
            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown("### 🌿 Suitability Rankings for Your Farm")

            top_crops = res.get("top_5_crops", [])
            pred_crop = res.get("predicted_crop", "N/A")
            score = res.get("confidence", "N/A")

            col_a, col_b = st.columns([1, 1.2])
            with col_a:
                primary_rec_html = f"""
                <div class="pred-card" style="border-left: 6px solid #16A34A; margin-bottom: 25px;">
                    <h4 style="margin: 0; color: #16A34A !important;">🎯 #1 Recommended Crop</h4>
                    <div style="font-size: 2.2rem; font-weight: 800; margin: 10px 0; color: #16A34A;">{pred_crop}</div>
                    <p style="margin: 0; font-weight: 600;">Match Score: {score}% Suitability</p>
                </div>
                """
                st.markdown(primary_rec_html, unsafe_allow_html=True)
            with col_b:
                st.markdown("#### Top Suitable Crop Rankings:")
                for idx, tc in enumerate(top_crops[:5], start=1):
                    c_name = tc.get("crop", "N/A")
                    c_conf = tc.get("confidence", 0)
                    st.markdown(f"**#{idx} {c_name}** ({c_conf}% Match)")
                    st.progress(float(c_conf) / 100.0)

            # =========================================================
            # SOIL TEXTURE PROFILE
            # =========================================================
            soil_info = res.get("soil", {})
            loc_info = res.get("location", {})

            clay = float(soil_info.get("clay", 25.0)) if soil_info.get("clay") is not None else 25.0
            sand = float(soil_info.get("sand", 45.0)) if soil_info.get("sand") is not None else 45.0
            silt = float(soil_info.get("silt", 30.0)) if soil_info.get("silt") is not None else 30.0
            texture_name = get_soil_texture_name(clay, sand, silt)

            st.markdown("---")
            st.markdown("### 🌾 Area Soil Texture Verification")
            st.caption("Live soil physical scan retrieved from ISRIC World SoilGrids for your farm.")

            st_col1, st_col2, st_col3, st_col4 = st.columns([1.5, 1, 1, 1])
            with st_col1:
                st.metric("Soil Texture Class", texture_name)
            with st_col2:
                st.metric("Clay Content", f"{clay:.1f} %")
            with st_col3:
                st.metric("Sand Content", f"{sand:.1f} %")
            with st_col4:
                st.metric("Silt Content", f"{silt:.1f} %")

            st.markdown(f"""
            <div class="pred-card" style="border-left: 6px solid #0D9488; margin-top: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #0D9488 !important;">🛡️ Soil Texture &amp; Field Suitability</h4>
                <div style="font-size: 0.95rem; line-height: 1.8;">
                    📍 <strong>Farm Location:</strong> {loc_info.get('district', c_district)}, {loc_info.get('state', c_state)} 
                    (Lat {loc_info.get('latitude', 0.0):.4f}°N, Lon {loc_info.get('longitude', 0.0):.4f}°E)<br>
                    🧪 <strong>Identified Soil Texture:</strong> <strong style="color: #0D9488;">{texture_name}</strong> 
                    ({clay:.1f}% Clay, {sand:.1f}% Sand, {silt:.1f}% Silt).<br>
                    ✅ <strong>Why {pred_crop} is recommended:</strong> <strong>{pred_crop}</strong> root systems thrive in 
                    <strong>{texture_name}</strong> soil, ensuring proper water drainage and root aeration.
                </div>
            </div>
            """, unsafe_allow_html=True)

    # =========================================================
    # TAB 2: CLIMATE RISK MODULE
    # =========================================================
    with tab2:
        st.markdown("""
        <div class="pred-card" style="border-left: 6px solid #D97706; margin-bottom: 25px;">
            <h3 style="margin-top: 0; margin-bottom: 8px;">🌦️ Step 2: Check Climate &amp; Heat Stress Risks</h3>
            <p style="font-size: 0.95rem; line-height: 1.6; margin-bottom: 0;">
                Assess weather warnings, dry spell forecasts, and heat stress risks for your chosen crop 
                before planting to prevent sudden crop destruction.
            </p>
        </div>
        """, unsafe_allow_html=True)

        col1, col2 = st.columns(2)
        with col1:
            cl_state, cl_district = _state_district_inputs(
                "cl",
                default_state=st.session_state.get("c_state"),
                default_district=st.session_state.get("c_district"),
            )
        with col2:
            cl_crop = _crop_selector("cl", label="Select Target Crop")
            cl_start = st.date_input("Start Date", value=date.today(), key="cl_start")

        cl_start_val, cl_end_val, cl_stage_row = compute_date_range(cl_crop, cl_start)
        cl_season = get_season(cl_start)
        cl_location = _resolve_location(cl_state, cl_district)

        if st.button("🚀 Analyze Climate Stress Risk", type="primary", key="btn_climate", disabled=cl_location is None):
            input_data = {
                "state": cl_state,
                "district": cl_district,
                "city": cl_district,
                "crop": cl_crop,
                "season": cl_season,
                "start_date": str(cl_start_val),
                "end_date": str(cl_end_val),
                "location": cl_location
            }
            with st.spinner("Evaluating Satellite Weather Patterns..."):
                try:
                    res = predict_climate_risk(input_data)
                    st.session_state["mod_climate_res"] = res
                    st.success("✅ Climate Risk Analysis Complete!")
                except Exception as e:
                    st.error(f"❌ Climate analysis failed: {str(e)}")

        if "mod_climate_res" in st.session_state:
            res = st.session_state["mod_climate_res"]
            st.markdown("<br>", unsafe_allow_html=True)
            if isinstance(res, dict):
                risk = res.get("predicted_climate_risk", res.get("climate_risk", "N/A"))
                temp = f"{res.get('temperature', 'N/A')} °C"
                humidity = f"{res.get('relative_humidity', 'N/A')} %"
            else:
                risk = str(res)
                temp = "N/A"
                humidity = "N/A"

            risk_lower = str(risk).lower().strip()
            if "high" in risk_lower:
                advice = "⚠️ <strong>High Climate Alert</strong>: Heat stress or dry spell risk detected. Water your fields frequently and use mulching to protect roots."
                border_col = "#DC2626"
            elif "mod" in risk_lower:
                advice = "⚠️ <strong>Moderate Caution</strong>: Mild heat spikes expected. Monitor soil moisture weekly."
                border_col = "#D97706"
            else:
                advice = "✅ <strong>Favorable Weather</strong>: Stable monsoon/seasonal climate. Ideal for normal crop cultivation."
                border_col = "#16A34A"

            climate_html = f"""
            <div class="pred-card" style="border-left: 6px solid {border_col}; margin-bottom: 25px;">
                <h4 style="margin: 0 0 8px 0;">🌍 Weather Risk Outlook</h4>
                <p style="margin: 0; font-size: 1.02rem; line-height: 1.7;">{advice}</p>
            </div>
            """
            st.markdown(climate_html, unsafe_allow_html=True)

            c_a, c_b = st.columns(2)
            with c_a:
                st.metric("Climate Risk Level", risk)
            with c_b:
                st.metric("Expected Mean Temp", temp)
            c_c, c_d = st.columns(2)
            with c_c:
                st.metric("Relative Humidity", humidity)
            with c_d:
                st.metric("7-Day Rain Total", f"{res.get('rainfall_last_7_days', res.get('precipitation', '0.0'))} mm" if isinstance(res, dict) else "N/A")

            # =========================================================
            # DAY-WISE WEATHER RISK CHARTS
            # =========================================================
            daily_data = res.get("daily_data") if isinstance(res, dict) else None
            if daily_data is not None:
                try:
                    df_daily = pd.DataFrame(daily_data).copy()
                    if not df_daily.empty and "Date" in df_daily.columns:
                        df_daily["Date_Str"] = pd.to_datetime(df_daily["Date"]).dt.strftime("%d %b (%a)")
                        
                        st.markdown("---")
                        st.markdown("### 📈 Day-Wise Weather & Climate Trajectory")
                        st.caption("Daily satellite forecast showing temperature variations, rain intensity, and dry spell trends.")

                        chart_col1, chart_col2 = st.columns(2)
                        with chart_col1:
                            st.markdown("##### 🌡️ Daily Temperatures (°C)")
                            temp_plot_df = df_daily.set_index("Date_Str")[["max_temperature", "mean_temperature", "min_temperature"]].rename(
                                columns={
                                    "max_temperature": "Max Temp (°C)",
                                    "mean_temperature": "Mean Temp (°C)",
                                    "min_temperature": "Min Temp (°C)"
                                }
                            )
                            st.line_chart(temp_plot_df, color=["#DC2626", "#F59E0B", "#3B82F6"])

                        with chart_col2:
                            st.markdown("##### 🌧️ Daily Rainfall & Evapotranspiration (mm)")
                            rain_cols = []
                            if "precipitation" in df_daily.columns:
                                rain_cols.append("precipitation")
                            if "et0" in df_daily.columns:
                                rain_cols.append("et0")
                            
                            if rain_cols:
                                rain_plot_df = df_daily.set_index("Date_Str")[rain_cols].rename(
                                    columns={
                                        "precipitation": "Rainfall (mm)",
                                        "et0": "ET0 Evaporation (mm)"
                                    }
                                )
                                st.bar_chart(rain_plot_df, color=["#0284C7", "#10B981"][:len(rain_cols)])

                        with st.expander("📅 View Detailed Day-by-Day Weather Table", expanded=False):
                            display_cols = ["Date_Str"]
                            col_rename = {"Date_Str": "Forecast Date"}
                            for col, new_name in [
                                ("max_temperature", "Max Temp (°C)"),
                                ("min_temperature", "Min Temp (°C)"),
                                ("precipitation", "Rain (mm)"),
                                ("wind_speed", "Wind (km/h)"),
                                ("wind_gusts", "Max Gusts (km/h)"),
                                ("et0", "ET0 (mm/day)")
                            ]:
                                if col in df_daily.columns:
                                    display_cols.append(col)
                                    col_rename[col] = new_name
                            
                            table_df = df_daily[display_cols].rename(columns=col_rename)
                            st.dataframe(table_df, use_container_width=True, hide_index=True)
                except Exception as chart_err:
                    st.caption(f"Note: Could not render day-wise chart: {chart_err}")

    # =========================================================
    # TAB 3: IRRIGATION MODULE
    # =========================================================
    with tab3:
        st.markdown("""
        <div class="pred-card" style="border-left: 6px solid #2563EB; margin-bottom: 25px;">
            <h3 style="margin-top: 0; margin-bottom: 8px;">💧 Step 3: Exact Water &amp; Pump Operating Guidelines</h3>
            <p style="font-size: 0.95rem; line-height: 1.6; margin-bottom: 0;">
                Find out exactly how many hours to run your 5 HP pump or drip lines today to give your crop 
                the exact water it needs without wasting electricity or groundwater.
            </p>
        </div>
        """, unsafe_allow_html=True)

        col1, col2 = st.columns(2)
        with col1:
            ir_crop = _crop_selector("ir", label="Select Crop")
            ir_plant_date = st.date_input("Planting Date", value=date.today(), key="ir_plant_date")
            ir_area = st.number_input("Land Area (Hectares)", min_value=0.1, value=2.0, step=0.5, key="ir_area")
        with col2:
            ir_state, ir_district = _state_district_inputs(
                "ir",
                default_state=st.session_state.get("c_state"),
                default_district=st.session_state.get("c_district"),
            )

        boundaries = compute_stage_boundaries(ir_crop, ir_plant_date)
        if boundaries:
            stage_labels = [f"{b['stage']} ({b['start']} → {b['end']})" for b in boundaries]
            stage_choice = st.selectbox("Crop Growth Stage", stage_labels, key="ir_stage_choice")
            selected = boundaries[stage_labels.index(stage_choice)]
            ir_stage = selected["stage"]
            ir_kc = selected["kc"]
            ir_start_val, ir_end_val = selected["start"], selected["end"]
        else:
            ir_stage = st.selectbox("Crop Growth Stage", ["Initial", "Development", "Mid-season", "Late season"], key="ir_stage_fallback")
            ir_kc = 1.2
            ir_start_val, ir_end_val = ir_plant_date, ir_plant_date

        ir_location = _resolve_location(ir_state, ir_district)
        ir_season = get_season(ir_plant_date)

        if st.button("🚀 Calculate Irrigation Needs", type="primary", key="btn_irrigation", disabled=ir_location is None):
            input_data = {
                "state": ir_state,
                "city": ir_district,
                "district": ir_district,
                "crop": ir_crop,
                "season": ir_season,
                "growth_stage": ir_stage,
                "kc": ir_kc,
                "root_depth_m": 1.0,
                "start_date": str(ir_start_val),
                "end_date": str(ir_end_val),
                "location": ir_location
            }
            clim_data = st.session_state.get("mod_climate_res", {})
            with st.spinner("Computing FAO-56 Evapotranspiration & Pump Hours..."):
                try:
                    res = predict_irrigation(input_data, clim_data)
                    st.session_state["mod_irrigation_res"] = res
                    st.success("✅ Irrigation Guidelines Computed!")
                except Exception as e:
                    st.error(f"❌ Irrigation calculation failed: {str(e)}")

        if "mod_irrigation_res" in st.session_state:
            res = st.session_state["mod_irrigation_res"]
            st.markdown("<br>", unsafe_allow_html=True)

            req_mm = float(res.get('predicted_irrigation', 0.0)) if res.get('predicted_irrigation') else 0.0
            liters_per_ha = req_mm * 10000
            total_liters = liters_per_ha * ir_area
            pump_hours = total_liters / 45000.0
            drip_hours = liters_per_ha / 10000.0
            canal_flow_lps = 30.0          # assumed canal flow rate: 30 litres/second
            canal_minutes = (total_liters / canal_flow_lps) / 60.0
            water_inches = req_mm / 25.4

            # Fixed Soil Type resolution from the returned sub-dictionary
            soil_classification = res.get("soil", {}).get("soil_type", "N/A")

            irrigation_html = f"""
            <div class="pred-card" style="border-left: 6px solid #2563EB; margin-bottom: 25px;">
                <h4 style="margin: 0 0 10px 0; color: #2563EB !important;">💧 Practical Field Irrigation Guide</h4>
                <p style="margin: 0 0 12px 0; font-size: 1.05rem; line-height: 1.75;">
                    To irrigate your field of <strong>{ir_area:.1f} Hectares</strong> today, you need to apply a total of 
                    <strong>{total_liters:,.0f} Liters of water</strong> — equivalent to opening a 
                    <strong>canal channel for {canal_minutes:.0f} minutes</strong> at a standard flow rate of 30 L/s.
                </p>
                <hr style="border: 0; border-top: 1px solid rgba(128, 128, 128, 0.2); margin: 16px 0;">
                <p style="margin: 0 0 8px 0; font-weight: 700;">How to water your farm today:</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 0.98rem; line-height: 1.8;">
                    <li><strong>Open Canal / Field Channel</strong>: Open the canal gate and let water flow for <strong>{canal_minutes:.0f} minutes</strong> until the field receives {req_mm:.1f} mm depth.</li>
                    <li><strong>5 HP Electric Pump Motor</strong>: Turn ON pump for <strong>{pump_hours:.1f} Hours</strong> to lift canal water into field channels.</li>
                    <li><strong>Drip Line Irrigation</strong>: Run drip lines fed from canal for <strong>{drip_hours:.1f} Hours</strong> today.</li>
                    <li><strong>Flood / Furrow Irrigation</strong>: Let canal water flow through furrows until it stands <strong>{water_inches:.1f} inches ({req_mm:.1f} mm) deep</strong> across the field.</li>
                </ul>
            </div>
            """
            st.markdown(irrigation_html, unsafe_allow_html=True)

            m1, m2 = st.columns(2)
            with m1:
                st.metric("Water Depth Needed", f"{req_mm:.2f} mm/day")
            with m2:
                st.metric("5 HP Pump Duration", f"{pump_hours:.1f} Hours/day")
            m3, m4 = st.columns(2)
            with m3:
                st.metric("Drip Irrigation Time", f"{drip_hours:.1f} Hours/day")
            with m4:
                st.metric("Canal Open Time", f"{canal_minutes:.0f} Minutes")

    # =========================================================
    # TAB 4: YIELD MODULE
    # =========================================================
    with tab4:
        st.markdown("""
        <div class="pred-card" style="border-left: 6px solid #475569; margin-bottom: 25px;">
            <h3 style="margin-top: 0; margin-bottom: 8px;">🌾 Step 4: Estimate Harvest Volume &amp; Production</h3>
            <p style="font-size: 0.95rem; line-height: 1.6; margin-bottom: 0;">
                Predict your expected harvest volume in Quintals and Tons to book cold storage, transport, and labour early.
            </p>
        </div>
        """, unsafe_allow_html=True)

        col1, col2 = st.columns(2)
        with col1:
            y_crop = _crop_selector("y", label="Select Crop")
            y_area = st.number_input("Land Area (Hectares)", min_value=0.1, value=2.5, step=0.5, key="y_area")
        with col2:
            y_state, y_district = _state_district_inputs(
                "y",
                default_state=st.session_state.get("c_state"),
                default_district=st.session_state.get("c_district"),
            )

        y_season = get_season(date.today())
        y_location = _resolve_location(y_state, y_district)

        if st.button("🚀 Forecast Harvest Yield", type="primary", key="btn_yield", disabled=y_location is None):
            input_data = {
                "state": y_state,
                "district": y_district,
                "crop": y_crop,
                "season": y_season,
                "area": y_area,
                "year": date.today().year,
                "location": y_location
            }
            with st.spinner("Estimating Expected Harvest Yield..."):
                try:
                    res = predict_yield(input_data)
                    st.session_state["mod_yield_res"] = res
                    st.success("✅ Yield Forecast Complete!")
                except Exception as e:
                    st.error(f"❌ Yield prediction failed: {str(e)}")

        if "mod_yield_res" in st.session_state:
            res = st.session_state["mod_yield_res"]
            st.markdown("<br>", unsafe_allow_html=True)

            pred_yield_ton_ha = float(res.get('predicted_yield', 0.0))  # Model raw output in Tons/Ha
            pred_yield_qtl_ha = pred_yield_ton_ha * 10.0               # Converted to Quintals/Ha (1 Ton = 10 Quintals)
            tot_yield_tons = float(res.get('total_yield', 0.0))        # Total Tons
            tot_yield_qtl = float(res.get('arrival_quantity', tot_yield_tons * 10.0)) # Total Quintals

            yield_html = f"""
            <div class="pred-card" style="border-left: 6px solid #475569; margin-bottom: 25px;">
                <h4 style="margin: 0 0 10px 0;">🌾 Expected Total Harvest Performance</h4>
                <p style="margin: 0; font-size: 1.05rem; line-height: 1.75;">
                    Raw Model Prediction: <strong>{pred_yield_ton_ha:.2f} Tons per Hectare</strong> 
                    (converted to <strong>{pred_yield_qtl_ha:.1f} Quintals/Ha</strong>).<br>
                    Total estimated harvest: <strong>{tot_yield_qtl:,.1f} Quintals ({tot_yield_tons:,.2f} Tons)</strong> over <strong>{y_area:.1f} Hectares</strong>.
                </p>
            </div>
            """
            st.markdown(yield_html, unsafe_allow_html=True)

            ym1, ym2 = st.columns(2)
            with ym1:
                st.metric("Raw Model Yield (Tons/Ha)", f"{pred_yield_ton_ha:.2f} Tons/Ha")
            with ym2:
                st.metric("Converted Yield (Quintals/Ha)", f"{pred_yield_qtl_ha:.1f} qtl/ha")
            ym3, ym4 = st.columns(2)
            with ym3:
                st.metric("Total Harvest (Quintals)", f"{tot_yield_qtl:,.1f} qtl")
            with ym4:
                st.metric("Total Harvest (Tons)", f"{tot_yield_tons:,.2f} Tons")

    # =========================================================
    # TAB 5: MARKET PRICE MODULE
    # =========================================================
    with tab5:
        st.markdown("""
        <div class="pred-card" style="border-left: 6px solid #9333EA; margin-bottom: 25px;">
            <h3 style="margin-top: 0; margin-bottom: 8px;">💰 Step 5: Forecast Market Selling Price &amp; Expected Gross Revenue</h3>
            <p style="font-size: 0.95rem; line-height: 1.6; margin-bottom: 0;">
                Predict expected market prices (₹ per Quintal) on your harvest end date so you can sell at profitable rates.
            </p>
        </div>
        """, unsafe_allow_html=True)

        col1, col2 = st.columns(2)
        with col1:
            mk_crop = _crop_selector("mk", label="Select Target Crop")
            sow_date = date.today()
            _mk_start, _mk_harvest_end, _mk_stage = compute_date_range(mk_crop, sow_date)
            _mk_total_days = _mk_stage["total_growth_days"] if _mk_stage else 120

            st.info(f"📅 **{mk_crop}** duration: **{_mk_total_days} days**. Expected harvest ready by **{_mk_harvest_end.strftime('%d %b %Y')}**.")

            mk_date = st.date_input(
                "🗓️ Target Selling Date (auto-set to harvest end)",
                value=_mk_harvest_end,
                min_value=sow_date,
                key="mk_date"
            )

        with col2:
            mk_state, mk_district = _state_district_inputs(
                "mk",
                default_state=st.session_state.get("c_state"),
                default_district=st.session_state.get("c_district"),
            )

        col_area, col_cost = st.columns(2)
        with col_area:
            mk_area = st.number_input("Land Area (Hectares)", min_value=0.1, value=2.5, step=0.5, key="mk_area")
        with col_cost:
            default_ha_cost = get_default_cost_per_ha(mk_crop)
            mk_cost_per_ha = st.number_input(
                "Principal Cultivation Cost (₹ / Hectare)",
                min_value=1000.0,
                value=default_ha_cost,
                step=2000.0,
                key="mk_cost_per_ha",
                help="Estimated investment needed per hectare (seeds, fertilizers, diesel, labor, irrigation, machinery)."
            )

        total_principal_investment = mk_cost_per_ha * mk_area
        st.caption(f"💵 Total Principal Amount Needed for {mk_area:.1f} Ha: **₹ {total_principal_investment:,.2f}**")

        mk_season = get_season(mk_date)
        if st.button("🚀 Forecast Market Selling Price & Net Profit", type="primary", key="btn_market"):
            with st.spinner("Predicting Market Price & Financial Profitability..."):
                try:
                    res = predict_market_price(
                        state=mk_state,
                        district=mk_district,
                        commodity=mk_crop,
                        area=mk_area,
                        season=mk_season,
                        start_date=str(sow_date),
                        end_date=str(_mk_harvest_end),
                        year=mk_date.year,
                        market_date=str(mk_date)
                    )
                    st.session_state["mod_market_res"] = res
                    st.session_state["mod_market_crop"] = mk_crop
                    st.session_state["mod_market_date"] = mk_date
                    st.session_state["mod_market_district"] = mk_district
                    st.session_state["mod_market_cost_per_ha"] = mk_cost_per_ha
                    st.session_state["mod_market_area"] = mk_area
                    st.success(f"✅ Financial & Market Price Forecast Complete for {mk_crop}!")
                except Exception as e:
                    st.error(f"❌ Market price prediction failed: {str(e)}")

        if "mod_market_res" in st.session_state:
            res = st.session_state["mod_market_res"]
            _display_crop = st.session_state.get("mod_market_crop", mk_crop)
            _display_date = st.session_state.get("mod_market_date", mk_date)
            _display_district = st.session_state.get("mod_market_district", mk_district)
            _display_area = float(st.session_state.get("mod_market_area", mk_area))
            _display_cost_per_ha = float(st.session_state.get("mod_market_cost_per_ha", mk_cost_per_ha))
            st.markdown("<br>", unsafe_allow_html=True)

            # Get predicted yield in Tons from the Yield Forecast Module
            yield_res = st.session_state.get("mod_yield_res", {})
            yield_in_tons = float(yield_res.get("total_yield", 0.0))
            if yield_in_tons == 0.0:
                # If yield module was not run, estimate it dynamically using per-hectare fallback
                pred_yield_ton_ha = float(yield_res.get("predicted_yield", 2.5))
                yield_in_tons = pred_yield_ton_ha * _display_area

            # Convert expected yield from Tons to Quintals: 1 Ton = 10 Quintals
            farmer_yield_qtl = yield_in_tons * 10.0

            price_val = float(res.get("predicted_price") or res.get("predicted_market_price") or 0.0)
            total_revenue = price_val * farmer_yield_qtl
            total_cost = _display_cost_per_ha * _display_area
            net_profit = total_revenue - total_cost
            roi_pct = (net_profit / total_cost * 100.0) if total_cost > 0 else 0.0
            profit_per_ha = net_profit / _display_area if _display_area > 0 else 0.0

            is_profit = net_profit >= 0
            profit_color = "#16A34A" if is_profit else "#DC2626"
            profit_label = "🟢 NET ESTIMATED PROFIT" if is_profit else "🔴 ESTIMATED NET LOSS"

            market_html = f"""
            <div class="pred-card" style="border-left: 6px solid {profit_color}; margin-bottom: 25px;">
                <h3 style="margin: 0 0 10px 0; color: {profit_color} !important;">💰 Comprehensive Farm Financial P&amp;L Forecast</h3>
                <div style="font-size: 1.05rem; line-height: 1.8; margin-bottom: 14px;">
                    Predicted Market Selling Price on <strong>{_display_date.strftime("%d %b %Y")}</strong>: 
                    <strong style="color: #9333EA;">₹ {price_val:,.2f} per Quintal</strong> in <strong>{_display_district}</strong>.<br>
                    Expected Harvest Production: <strong>{farmer_yield_qtl:,.1f} Quintals</strong> ({yield_in_tons:.2f} Tons) over <strong>{_display_area:.1f} Hectares</strong>.
                </div>
                <div style="background-color: rgba(128,128,128,0.08); border-radius: 10px; padding: 16px 20px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 1.02rem;">
                        <span>💵 <strong>Gross Market Revenue</strong> ({farmer_yield_qtl:,.1f} qtl × ₹ {price_val:,.2f}):</span>
                        <strong>₹ {total_revenue:,.2f}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 1.02rem; color: #E11D48;">
                        <span>📉 <strong>Less: Principal Cultivation Cost</strong> ({_display_area:.1f} Ha × ₹ {_display_cost_per_ha:,.0f}):</span>
                        <strong>- ₹ {total_cost:,.2f}</strong>
                    </div>
                    <div style="border-top: 2px solid {profit_color}; padding-top: 10px; display: flex; justify-content: space-between; font-size: 1.25rem; font-weight: 800; color: {profit_color};">
                        <span>{profit_label} (ROI: {roi_pct:+.1f}%):</span>
                        <span>₹ {net_profit:,.2f}</span>
                    </div>
                </div>
                <p style="margin: 0; font-size: 0.9rem;">
                    💡 <strong>Net Return per Hectare:</strong> <strong style="color: {profit_color};">₹ {profit_per_ha:,.2f} / Ha</strong> | 🌾 Crop Maturity: <strong>{_mk_total_days} days</strong>
                </p>
            </div>
            """
            st.markdown(market_html, unsafe_allow_html=True)

            mka, mkb = st.columns(2)
            with mka:
                st.metric("Forecasted Price", f"₹ {price_val:,.2f}/qtl")
            with mkb:
                st.metric("Total Principal Cost", f"₹ {total_cost:,.2f}")
            mkc, mkd = st.columns(2)
            with mkc:
                st.metric("Gross Revenue", f"₹ {total_revenue:,.2f}")
            with mkd:
                st.metric(
                    "Net Profit / Loss",
                    f"₹ {net_profit:,.2f}",
                    delta=f"{roi_pct:+.1f}% ROI",
                    delta_color="normal" if is_profit else "inverse"
                )
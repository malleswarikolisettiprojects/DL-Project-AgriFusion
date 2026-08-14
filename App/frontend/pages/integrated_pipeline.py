import streamlit as st
from datetime import date
import pandas as pd

from App.backend.crop import predict_crop
from App.backend.climate_risk import predict_climate_risk
from App.backend.irrigation import predict_irrigation
from App.backend.yields import predict_yield
from App.backend.market import predict_market_price
from App.backend.api.location import get_states, get_districts, get_location
from App.backend.database.database import supabase
from App.backend.database.predictions import save_prediction as save_full_prediction
from App.backend.growth_stages import compute_date_range, compute_stage_boundaries
from App.backend.seasons import get_season
from App.frontend.pages.predictions import get_default_cost_per_ha, get_soil_texture_name, estimate_principal_investment


def safe_get(obj, key, default="N/A"):
    if isinstance(obj, dict):
        val = obj.get(key, default)
        return val if val is not None else default
    return default


def _render_ai_disclaimer():
    disclaimer_html = """
    <div class="pipe-disclaimer">
        <span style="font-size: 1.3rem;">⚠️</span>
        <p style="margin: 0; font-size: 0.92rem; line-height: 1.5;">
            <strong>Important Note for Farmers:</strong> These AI predictions provide automated guidance. 
            Independently verify field conditions before executing major farm operations.
        </p>
    </div>
    """
    st.markdown(disclaimer_html, unsafe_allow_html=True)


def _state_district_inputs(key_prefix, default_state="Andhra Pradesh", default_district="Visakhapatnam"):
    states = get_states()
    state_index = states.index(default_state) if default_state in states else 0
    state = st.selectbox("State", states, index=state_index, key=f"{key_prefix}_state")

    districts = get_districts(state)
    district_index = districts.index(default_district) if default_district in districts else 0
    district = st.selectbox("District", districts, index=district_index if districts else 0, key=f"{key_prefix}_district")
    return state, district


def show_integrated_pipeline():
    # Inject Theme-Adaptive Styles
    st.markdown("""
    <style>
    .pipe-card {
        background-color: #FFFFFF;
        border: 1.5px solid #E2E8F0;
        border-radius: 14px;
        padding: 24px 28px;
        margin-bottom: 22px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.05);
    }
    .pipe-card h1, .pipe-card h2, .pipe-card h3, .pipe-card h4 {
        color: #0F172A !important;
        font-weight: 800 !important;
    }
    .pipe-card p, .pipe-card span, .pipe-card div, .pipe-card li {
        color: #334155 !important;
    }
    .pipe-disclaimer {
        background-color: #FFFBEB;
        border: 1px solid #FDE68A;
        border-left: 6px solid #D97706;
        padding: 14px 18px;
        border-radius: 10px;
        margin-bottom: 22px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
    }
    .pipe-disclaimer p, .pipe-disclaimer strong {
        color: #92400E !important;
    }

    @media (prefers-color-scheme: dark) {
        .pipe-card {
            background-color: #161B22 !important;
            border-color: #30363D !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
        }
        .pipe-card h1, .pipe-card h2, .pipe-card h3, .pipe-card h4 {
            color: #F1F5F9 !important;
        }
        .pipe-card p, .pipe-card span, .pipe-card div, .pipe-card li {
            color: #CBD5E1 !important;
        }
        .pipe-disclaimer {
            background-color: #161B22 !important;
            border-color: #30363D !important;
            border-left-color: #F59E0B !important;
        }
        .pipe-disclaimer p, .pipe-disclaimer strong {
            color: #FCD34D !important;
        }
    }
    </style>
    """, unsafe_allow_html=True)

    header_html = """
    <div class="pipe-card" style="border-top: 6px solid #1E293B; margin-bottom: 22px;">
        <span style="background: #16A34A; color: #FFFFFF; padding: 4px 12px; border-radius: 12px; 
              font-size: 0.8rem; font-weight: 700; text-transform: uppercase;">
            ⚡ 1-Click Complete Farm Plan
        </span>
        <h1 style="margin-top: 10px; margin-bottom: 6px; font-size: 2.2rem;">
            Autonomous Connected Farming Pipeline
        </h1>
        <p style="font-size: 1.05rem; margin-bottom: 0;">
            Enter your location and farm area once. Our 5 connected AI models will automatically calculate your 
            best crop, weather risk, exact pump hours, expected yield, and market price in one click!
        </p>
    </div>
    """
    st.markdown(header_html, unsafe_allow_html=True)

    _render_ai_disclaimer()

    # Visual Workflow Overview
    workflow_html = """
    <div class="pipe-card" style="border-left: 6px solid #16A34A; text-align: center; padding: 20px;">
        <div style="font-size: 1.25rem; font-weight: 800; margin-bottom: 6px;">
            🌱 Soil Scan &rarr; 🌾 Crop Choice &rarr; 🌦️ Climate Check &rarr; 💧 Pump Hours &rarr; 📈 Yield &amp; Market Price
        </div>
        <div style="font-size: 0.9rem;">
            Full season guidance generated automatically without typing duplicate parameters.
        </div>
    </div>
    """
    st.markdown(workflow_html, unsafe_allow_html=True)

    # =========================================================
    # UNIFIED FARM CONFIGURATION FORM
    # =========================================================
    st.markdown("<h3 style='font-weight: 700;'>📍 Step 1: Set Up Your Farm Location &amp; Size</h3>", unsafe_allow_html=True)

    col1, col2 = st.columns(2)
    with col1:
        state, district = _state_district_inputs("integ")
        village = st.text_input("Village Name (Optional)", value="")
    with col2:
        start_date = st.date_input("Sowing / Start Date", value=date.today())
        area = st.number_input("Land Area (Hectares)", min_value=0.1, value=2.0, step=0.5)

    st.info(
        f"🗓️ Season: **{get_season(start_date)}** (auto-determined). "
        "Crop growth stages and harvest dates will be calculated automatically."
    )

    run_pipeline_btn = st.button("⚡ Generate Complete Farming Plan", type="primary", width='stretch')

    if run_pipeline_btn:
        try:
            location = get_location(state=state, district=district, village=village if village else None)
        except Exception as loc_err:
            location = None
            st.error(f"⚠️ Could not resolve location for {district}, {state}: {loc_err}")

        if location is None:
            st.stop()

        season = get_season(start_date)
        progress_bar = st.progress(0, text="Initializing Pipeline...")

        try:
            # =================================================
            # 1. CROP MODEL
            # =================================================
            progress_bar.progress(15, text="🌱 Step 1/5: Running Crop Recommendation Model...")
            crop_start_val, crop_end_val, _ = compute_date_range(None, start_date)

            crop_input_data = {
                "state": state,
                "district": district,
                "village": village if village else None,
                "season": season,
                "start_date": str(crop_start_val),
                "end_date": str(crop_end_val),
                "location": location
            }
            crop_res = predict_crop(crop_input_data)
            recommended_crop = safe_get(crop_res, "predicted_crop", None)
            if not recommended_crop or recommended_crop == "N/A":
                raise ValueError("Crop model did not return a usable crop recommendation.")

            crop_start_val, crop_end_val, stage_row = compute_date_range(recommended_crop, start_date)
            boundaries = compute_stage_boundaries(recommended_crop, start_date)
            if boundaries:
                current_stage = boundaries[0]
                growth_stage = current_stage["stage"]
                kc = current_stage["kc"]
            else:
                growth_stage = "Initial"
                kc = 1.2

            input_data = {
                "state": state,
                "district": district,
                "village": village if village else None,
                "city": district,
                "crop": recommended_crop,
                "season": season,
                "growth_stage": growth_stage,
                "kc": kc,
                "root_depth_m": 1.0,
                "area": area,
                "start_date": str(crop_start_val),
                "end_date": str(crop_end_val),
                "location": location
            }

            # =================================================
            # 2. CLIMATE RISK MODEL
            # =================================================
            progress_bar.progress(35, text="🌦️ Step 2/5: Evaluating Climate & Weather Risk...")
            clim_res = predict_climate_risk(input_data)

            # =================================================
            # 3. IRRIGATION MODEL
            # =================================================
            progress_bar.progress(55, text="💧 Step 3/5: Calculating FAO Irrigation Net Water Needs...")
            irrig_res = predict_irrigation(input_data, clim_res)

            # =================================================
            # 4. YIELD MODEL
            # =================================================
            progress_bar.progress(75, text="🌾 Step 4/5: Estimating Harvest Production Volume...")
            yield_input_data = {
                "state": state,
                "district": district,
                "crop": recommended_crop,
                "season": season,
                "area": area,
                "year": start_date.year,
                "location": location
            }
            yield_res = predict_yield(yield_input_data)

            # =================================================
            # 5. MARKET MODEL
            # =================================================
            progress_bar.progress(90, text="💰 Step 5/5: Forecasting Market Commodity Price & Revenue...")
            total_days = stage_row["total_growth_days"] if stage_row else 120
            harvest_end_date = crop_end_val

            market_input_data = {
                "state": state,
                "district": district,
                "commodity": recommended_crop,
                "area": area,
                "season": season,
                "start_date": str(start_date),
                "end_date": str(harvest_end_date),
                "year": harvest_end_date.year,
                "market_date": str(harvest_end_date)
            }
            market_res = predict_market_price(**market_input_data)

            progress_bar.progress(100, text="✅ Farming Plan Complete!")
            st.session_state["integ_results"] = {
                "input_data": input_data,
                "crop_res": crop_res,
                "clim_res": clim_res,
                "irrig_res": irrig_res,
                "yield_res": yield_res,
                "market_res": market_res,
                "recommended_crop": recommended_crop,
                "total_days": total_days,
                "harvest_end_date": harvest_end_date
            }
            st.success("🎉 Complete Farm Plan & Predictions Generated Successfully!")

        except Exception as e:
            progress_bar.empty()
            st.error(f"❌ Integrated Pipeline execution error: {str(e)}")

    # =========================================================
    # DISPLAY INTEGRATED RESULTS
    # =========================================================
    if "integ_results" in st.session_state:
        res = st.session_state["integ_results"]
        crop_res = res["crop_res"]
        clim_res = res["clim_res"]
        irrig_res = res["irrig_res"]
        yield_res = res["yield_res"]
        market_res = res["market_res"]
        rec_crop = res["recommended_crop"]
        total_days = res["total_days"]
        harvest_end_date = res["harvest_end_date"]

        st.markdown("---")
        st.markdown("## 📊 Your Complete Farm Execution Plan")

        # 1. CROP & CLIMATE SUMMARY
        c1, c2 = st.columns(2)
        with c1:
            rec_conf = safe_get(crop_res, "confidence", 0)
            st.markdown(f"""
            <div class="pipe-card" style="border-left: 6px solid #16A34A;">
                <h4 style="margin: 0;">🌱 #1 Recommended Crop</h4>
                <div style="font-size: 2rem; font-weight: 800; color: #16A34A; margin: 8px 0;">{rec_crop}</div>
                <p style="margin: 0;">Match Score: <strong>{rec_conf}% Suitability</strong></p>
                <p style="margin: 4px 0 0 0; font-size: 0.88rem;">Growing Window: <strong>{total_days} Days</strong> (Harvest ready: <strong>{harvest_end_date.strftime('%d %b %Y')}</strong>)</p>
            </div>
            """, unsafe_allow_html=True)
        with c2:
            climate_risk = safe_get(clim_res, "predicted_climate_risk", "Low Risk")
            st.markdown(f"""
            <div class="pipe-card" style="border-left: 6px solid #D97706;">
                <h4 style="margin: 0;">🌦️ Weather Risk Status</h4>
                <div style="font-size: 2rem; font-weight: 800; margin: 8px 0;">{climate_risk}</div>
                <p style="margin: 0;">Mean Temp: <strong>{safe_get(clim_res, "temperature", "N/A")} °C</strong></p>
                <p style="margin: 4px 0 0 0; font-size: 0.88rem;">Humidity: <strong>{safe_get(clim_res, "relative_humidity", "N/A")} %</strong></p>
            </div>
            """, unsafe_allow_html=True)

        # 1B. LIVE SOIL TEXTURE VERIFICATION
        soil_info = crop_res.get("soil", {}) if isinstance(crop_res, dict) else {}
        loc_info = crop_res.get("location", {}) if isinstance(crop_res, dict) else {}

        clay = float(soil_info.get("clay", 25.0)) if soil_info.get("clay") is not None else 25.0
        sand = float(soil_info.get("sand", 45.0)) if soil_info.get("sand") is not None else 45.0
        silt = float(soil_info.get("silt", 30.0)) if soil_info.get("silt") is not None else 30.0
        texture_name = get_soil_texture_name(clay, sand, silt)

        with st.expander("🌾 View Farm Soil Texture Profile (ISRIC SoilGrids Scan)", expanded=False):
            sc1, sc2, sc3, sc4 = st.columns([1.5, 1, 1, 1])
            with sc1:
                st.metric("Soil Texture Class", texture_name)
            with sc2:
                st.metric("Clay Content", f"{clay:.1f} %")
            with sc3:
                st.metric("Sand Content", f"{sand:.1f} %")
            with sc4:
                st.metric("Silt Content", f"{silt:.1f} %")
            
            st.markdown(f"""
            <div style="background-color: rgba(13,148,136,0.08); border-left: 4px solid #0D9488; padding: 12px 16px; border-radius: 8px; margin-top: 10px; font-size: 0.92rem;">
                <strong>🧪 Identified Texture:</strong> <strong style="color: #0D9488;">{texture_name}</strong> ({clay:.1f}% Clay, {sand:.1f}% Sand, {silt:.1f}% Silt)<br>
                <strong>💡 Agronomic Suitability:</strong> <strong>{rec_crop}</strong> is ranked #1 because its root structure excels in <strong>{texture_name}</strong> soil under local climate conditions.
            </div>
            """, unsafe_allow_html=True)

        # 1C. DAY-WISE CLIMATE TRAJECTORY CHARTS
        daily_data = clim_res.get("daily_data") if isinstance(clim_res, dict) else None
        if daily_data is not None:
            try:
                df_daily = pd.DataFrame(daily_data).copy()
                if not df_daily.empty and "Date" in df_daily.columns:
                    df_daily["Date_Str"] = pd.to_datetime(df_daily["Date"]).dt.strftime("%d %b (%a)")
                    for num_col in ["max_temperature", "mean_temperature", "min_temperature", "precipitation", "et0"]:
                        if num_col in df_daily.columns:
                            df_daily[num_col] = pd.to_numeric(df_daily[num_col], errors="coerce").round(1)

                    with st.expander("📈 View Day-Wise Satellite Weather Forecast Charts", expanded=False):
                        d_col1, d_col2 = st.columns(2)
                        with d_col1:
                            st.markdown("##### 🌡️ Daily Temperatures (°C)")
                            temp_df = df_daily.set_index("Date_Str")[["max_temperature", "mean_temperature", "min_temperature"]].rename(
                                columns={"max_temperature": "Max Temp", "mean_temperature": "Mean Temp", "min_temperature": "Min Temp"}
                            )
                            st.line_chart(temp_df, color=["#DC2626", "#F59E0B", "#3B82F6"])
                        with d_col2:
                            st.markdown("##### 🌧️ Daily Rainfall & ET0 Evaporation (mm)")
                            r_cols = [c for c in ["precipitation", "et0"] if c in df_daily.columns]
                            if r_cols:
                                rain_df = df_daily.set_index("Date_Str")[r_cols].rename(
                                    columns={"precipitation": "Rain (mm)", "et0": "ET0 Evaporation (mm)"}
                                )
                                st.bar_chart(rain_df, color=["#0284C7", "#10B981"][:len(r_cols)])
            except Exception:
                pass

        # 2. PRACTICAL IRRIGATION GUIDELINES
        req_mm = float(irrig_res.get('predicted_irrigation', 0.0)) if isinstance(irrig_res, dict) and irrig_res.get('predicted_irrigation') else 0.0
        liters_per_ha = req_mm * 10000
        total_liters = liters_per_ha * area
        pump_hours = total_liters / 45000.0
        drip_hours = liters_per_ha / 10000.0
        canal_flow_lps = 30.0          # assumed canal flow rate: 30 litres/second
        canal_minutes = (total_liters / canal_flow_lps) / 60.0

        st.markdown(f"""
        <div class="pipe-card" style="border-left: 6px solid #2563EB;">
            <h4 style="margin: 0 0 8px 0; color: #2563EB !important;">💧 Water Irrigation Plan for Today</h4>
            <p style="margin: 0 0 10px 0; font-size: 1.05rem; line-height: 1.75;">
                To irrigate your field of <strong>{area:.1f} Hectares</strong> today, you need to apply a total of 
                <strong>{total_liters:,.0f} Liters of water</strong> — equivalent to opening a 
                <strong>canal channel for {canal_minutes:.0f} minutes</strong> at a standard flow rate of 30 L/s.
            </p>
            <ul style="margin: 0; padding-left: 20px; font-size: 0.96rem; line-height: 1.8;">
                <li><strong>Open Canal / Field Channel</strong>: Open the canal gate and let water flow for <strong>{canal_minutes:.0f} minutes</strong> until field receives {req_mm:.1f} mm depth.</li>
                <li><strong>5 HP Electric Pump Motor</strong>: Turn ON pump for <strong>{pump_hours:.1f} Hours</strong> to lift canal water into field channels.</li>
                <li><strong>Drip Line Irrigation</strong>: Open drip lines fed from canal for <strong>{drip_hours:.1f} Hours</strong> today.</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)

        # 3. YIELD & FINANCIAL PROFITABILITY SUMMARY
        pred_yield = float(yield_res.get('predicted_yield', 0.0)) if isinstance(yield_res, dict) else 0.0
        tot_yield = float(yield_res.get('total_yield', 0.0)) if isinstance(yield_res, dict) else 0.0
        price_val = float(market_res.get("predicted_price") or market_res.get("predicted_market_price") or 0.0) if isinstance(market_res, dict) else 0.0
        
        # Farmer's yield in Quintals (Tons * 10)
        farmer_yield_qtl = tot_yield * 10.0
        total_revenue = price_val * farmer_yield_qtl
        
        # Cost of cultivation & Net Profit calculation
        est_cost = estimate_principal_investment(rec_crop, area)
        total_principal = est_cost["total_principal"]
        ha_cost = est_cost["cost_per_ha"]
        net_profit = total_revenue - total_principal
        roi_pct = (net_profit / total_principal * 100.0) if total_principal > 0 else 0.0
        profit_per_ha = net_profit / area if area > 0 else 0.0

        is_profit = net_profit >= 0
        profit_color = "#16A34A" if is_profit else "#DC2626"
        profit_label = "🟢 NET ESTIMATED PROFIT" if is_profit else "🔴 ESTIMATED NET LOSS"

        st.markdown(f"""
        <div class="pipe-card" style="border-left: 6px solid {profit_color};">
            <h3 style="margin: 0 0 10px 0; color: {profit_color} !important;">💰 Harvest Earnings &amp; Net Profit Forecast</h3>
            <p style="margin: 0 0 12px 0; font-size: 1.05rem; line-height: 1.75;">
                Total Expected Harvest: <strong>{farmer_yield_qtl:,.1f} Quintals ({tot_yield:.2f} Tons)</strong>.<br>
                Predicted Harvest Market Price: <strong>₹ {price_val:,.2f} per Quintal</strong> on <strong>{harvest_end_date.strftime('%d %b %Y')}</strong>.
            </p>
            <div style="background-color: rgba(128,128,128,0.08); border-radius: 10px; padding: 14px 18px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span>💵 <strong>Gross Harvest Revenue:</strong></span>
                    <strong>₹ {total_revenue:,.2f}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #E11D48;">
                    <span>📉 <strong>Less: AI-Estimated Principal Investment</strong> ({area:.1f} Ha @ ₹ {ha_cost:,.0f}/Ha):</span>
                    <strong>- ₹ {total_principal:,.2f}</strong>
                </div>
                <div style="border-top: 2px solid {profit_color}; padding-top: 8px; display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 800; color: {profit_color};">
                    <span>{profit_label} (ROI: {roi_pct:+.1f}%):</span>
                    <span>₹ {net_profit:,.2f}</span>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; font-size: 0.82rem; text-align: center; background-color: rgba(128,128,128,0.05); padding: 8px; border-radius: 6px; margin-bottom: 12px;">
                <div>🌱 <strong>Seeds:</strong><br>₹ {est_cost['seeds_cost']:,.0f}</div>
                <div>🧪 <strong>Fertilizer:</strong><br>₹ {est_cost['fertilizer_cost']:,.0f}</div>
                <div>💧 <strong>Water:</strong><br>₹ {est_cost['irrigation_cost']:,.0f}</div>
                <div>🚜 <strong>Machinery:</strong><br>₹ {est_cost['machinery_cost']:,.0f}</div>
                <div>👥 <strong>Labor:</strong><br>₹ {est_cost['labor_cost']:,.0f}</div>
            </div>
            <p style="margin: 0; font-size: 0.9rem;">
                💡 <strong>Estimated Return:</strong> <strong style="color: {profit_color};">₹ {profit_per_ha:,.2f} / Hectare</strong>
            </p>
        </div>
        """, unsafe_allow_html=True)

        m1, m2 = st.columns(2)
        with m1:
            st.metric("Total Harvest Volume", f"{farmer_yield_qtl:.1f} Quintals")
        with m2:
            st.metric("Principal Investment", f"₹ {total_principal:,.2f}")
        m3, m4 = st.columns(2)
        with m3:
            st.metric("Gross Revenue", f"₹ {total_revenue:,.2f}")
        with m4:
            st.metric(
                "Net Profit / Loss",
                f"₹ {net_profit:,.2f}",
                delta=f"{roi_pct:+.1f}% ROI",
                delta_color="normal" if is_profit else "inverse"
            )
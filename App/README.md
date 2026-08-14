# 🌾 AgriFusion — AI Precision Decision Support System for Modern Agriculture

AgriFusion is an end-to-end Machine Learning decision support platform designed to empower farmers and agricultural stakeholders with data-driven insights. By combining real-time satellite weather forecasts, soil grid data, and trained machine learning models, AgriFusion provides actionable recommendations for crop selection, climate risk mitigation, canal & drip irrigation scheduling, harvest yield estimation, and agricultural market price forecasting.

---

## 📁 Folder Structure

```text
App/
├── pickles/                      # Trained ML Models, Scalers & Encoders
│   ├── crop/                     # Crop Recommendation Model
│   ├── climate/                  # Climate Risk Assessment Model
│   ├── irrigation/               # FAO-56 Irrigation Depth Model
│   ├── yield/                    # Harvest Production Model
│   └── market/                   # Market Price Forecasting Model
├── backend/                      # Core Intelligence & Data Services
│   ├── api/                      # External API Integrations (OpenMeteo Weather, ISRIC Soil, Geocoding)
│   │   ├── location.py
│   │   ├── soil.py
│   │   └── weather.py
│   ├── database/                 # Supabase Database Persistence & Configuration
│   │   ├── database.py
│   │   ├── schemas.py
│   │   ├── save_predictions.py
│   │   ├── auth_db.py
│   │   └── config.py
│   ├── crop.py                   # Crop Recommendation Logic
│   ├── climate_risk.py           # Climate & Weather Stress Model
│   ├── irrigation.py             # Precision Irrigation Calculator
│   ├── yields.py                 # Yield Production Estimator
│   ├── market.py                 # Market Price Prediction Engine
│   ├── growth_stages.py          # Crop Phenology Helper
│   ├── seasons.py                # Indian Cropping Seasons Helper
│   ├── requirements.txt          # Backend Package Dependencies
│   └── .env                      # Environment Variables (Database Credentials)
├── frontend/                     # Streamlit Interactive User Interface
│   ├── app.py                    # Main Entry Point & Navigation Sidebar
│   ├── pages/                    # Multi-Page Modules
│   │   ├── home.py               # Landing & Agriculture Knowledge Base
│   │   ├── auth.py               # User Login & Registration Portal
│   │   ├── predictions.py        # Step-by-Step Prediction Tools
│   │   ├── integrated_pipeline.py# Complete 5-Step Pipeline Run
│   │   └── overview.py           # Technical System Architecture & Models Summary
│   └── requirements.txt          # Frontend UI Dependencies
└── README.md                     # Project Documentation
```

---

## 🚀 Key Modules & Capabilities

1. **🌱 Smart Crop Recommendation**:
   - Analyzes N-P-K soil nutrients, pH, temperature, and seasonal rainfall.
   - Ranks top crops with percentage suitability matching.

2. **🌦️ Climate Risk & Weather Stress Analysis**:
   - Connects to real-time satellite forecasts to evaluate dry spells, heat stress, and monsoon anomalies.
   - Provides risk warnings (Low, Moderate, High) and field protection advice.

3. **💧 Precision Irrigation & Canal Guide**:
   - Calculates daily Net Irrigation Water Depth (mm/day) using FAO-56 Penman-Monteith Evapotranspiration ($ET_c = ET_0 \times K_c$).
   - Recommends open canal open time (minutes), 5 HP electric pump operating hours, and drip line duration.

4. **🌾 Harvest Yield & Production Forecast**:
   - Predicts crop yield rate in Tons per Hectare and converts to Quintals per Hectare.
   - Calculates total expected production in Quintals and Tons for logistics planning.

5. **💰 Agricultural Market Price & Revenue Forecasting**:
   - Forecasts expected commodity prices (₹/Quintal) on harvest date across market regions.
   - Computes expected gross farm revenue based on predicted total harvest volume.

6. **⚡ All-in-One Integrated Pipeline**:
   - Runs all 5 predictive engines sequentially with a single click.

---

## ⚙️ Installation & Setup Guide

### 1. Prerequisites
- **Python**: 3.10 or higher
- **Git** (optional)

### 2. Clone / Navigate to Directory
```bash
cd App
```

### 3. Install Dependencies
Install required packages for the backend and frontend:
```bash
pip install -r backend/requirements.txt
pip install -r frontend/requirements.txt
```

### 4. Configure Environment Variables
Create or verify `App/backend/.env` file with Supabase credentials:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

### 5. Launch Application
Run the Streamlit web application:
```bash
streamlit run frontend/app.py
```

The application will open automatically in your browser at `http://localhost:8501`.

---

## 📊 Technologies Used

- **Frontend**: Streamlit, HTML5/CSS3
- **Machine Learning**: Scikit-Learn, Pandas, NumPy, Joblib
- **Data APIs**: OpenMeteo (Weather), ISRIC SoilGrids, OpenStreetMap Nominatim
- **Database & Storage**: Supabase (PostgreSQL), SQLite

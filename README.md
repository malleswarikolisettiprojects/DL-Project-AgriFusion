# 🌾 AgriFusion — AI Precision Agriculture Platform

AgriFusion is an AI-powered agricultural decision support system built for farmers and agricultural stakeholders in **Andhra Pradesh** and **Telangana**. It combines live satellite weather forecasts, soil data, machine learning models, multi-provider deep learning plant disease/pest visual inference, and RAG AI chat to provide clear, actionable farming guidance.

🌐 **Live Application**: [agrifusion.ai.studio](https://agrifusion.ai.studio/#)

---

## 📌 Features & Capabilities

1. 🔬 **Multi-Provider Visual AI Disease & Pest Diagnosis**:
   - Evaluates crop leaf photos using multi-provider models (Roboflow Universe, PyTorch local weights, HuggingFace).
   - Classifies inference outcomes into 4 strict, non-ambiguous categories: `detected`, `no_detection`, `low_confidence`, and `provider_error`.
   - Normalizes confidence scores to 0–1 scale and enforces applied confidence thresholds (25% for standard crops, 75% for custom crops).
   - Preserves candidate labels without fabricating synthetic diagnoses or assuming unverified plant health.

2. 🤖 **Agronomy RAG AI Advisory**:
   - AI assistant powered by Google Gemini API and verified agricultural literature.
   - Generates organic and chemical treatments, prevention guidelines, and regional agronomy advice.

3. 🌦️ **Climate Risk Assessment**:
   - Uses live weather forecasts to alert farmers about heat stress, drought, and heavy rainfall risks.

4. 💧 **Precision Irrigation Engine**:
   - Calculates daily water requirements ($ET_c$) using the FAO-56 Penman-Monteith method.
   - Computes pump operating hours and canal run times tailored to soil texture and crop growth stage.

5. 🌾 **Crop Yield Prediction**:
   - Estimates harvest yield in Tons per Hectare and Quintals per Hectare using trained ML models.

6. 💰 **Market Price Forecasting**:
   - Forecasts market prices (₹/Quintal) on harvest dates and estimates expected revenue.

7. 🌱 **Crop Recommendation**:
   - Recommends suitable crops based on soil nutrients (N, P, K, pH), location, and climate data.

8. 🏛️ **Government Schemes Matching**:
   - Matches eligible central and state government farming schemes (YSR Rythu Bharosa, Rythu Bandhu, PM-KISAN, PMFBY, Drip Subsidies).

9. 📊 **Machine Learning Research Notebooks**:
   - Includes full Jupyter Notebooks in `Notebooks/` for Climate Risk, Irrigation, Market Price, and Yield estimation models.

10. 📊 **Diagnostic Telemetry & Admin Activity Log**:
    - Persists execution status, provider summaries, candidate summaries, request IDs, and safe actor references into Supabase PostgreSQL.

---

## 🏗️ System Architecture

```text
               User / Frontend Web Application
                             │
                             ▼ (REST API / HTTPS)
               FastAPI Backend Server (App/backend/server.py)
                             │
      ┌──────────────────────┼──────────────────────┐
      │                      │                      │
      ▼                      ▼                      ▼
Multi-Provider Visual AI   Agronomy RAG       Machine Learning
Inference Engine           Advisory Engine    Predictive Subsystems
- Roboflow Universe        - Google Gemini    - Yield Prediction (.pkl)
- PyTorch Local (.pt)      - Verified Docs    - Market Forecasting (.pkl)
- HuggingFace Models                          - FAO-56 Irrigation Engine
                                              - Climate Risk Model
                             │
                             ▼
               Supabase PostgreSQL Database
         (Telemetry, User Records & Admin Logging)
```

---

## 📁 Folder Structure

```text
DL-Project-AgriFusion/
├── App/
│   ├── backend/                  # FastAPI backend server & intelligence modules
│   │   ├── admin/                # Admin API endpoints & audit logging
│   │   ├── database/             # Supabase handlers & migration.sql schema
│   │   ├── server.py             # Main FastAPI REST API server
│   │   ├── disease_detection.py  # Multi-provider visual AI engine
│   │   ├── agronomy_rag.py       # Gemini AI RAG advisory system
│   │   ├── crop.py               # Crop recommendation logic
│   │   ├── climate_risk.py       # Weather risk assessment
│   │   ├── irrigation.py         # Precision irrigation calculator
│   │   ├── yields.py             # Crop yield estimator
│   │   ├── market.py             # Market price forecaster
│   │   └── schemes.py            # Government scheme matcher
│   ├── frontend/                 # Admin Streamlit review dashboard
│   ├── pickles/                  # Trained scikit-learn models (.pkl)
│   └── pt files/                 # PyTorch leaf disease models (.pt)
├── Notebooks/                    # Jupyter Notebooks for model training & research
│   ├── climate_risk_NB.ipynb     # Climate Risk & Vulnerability model notebook
│   ├── Irrigation_Model_NB.ipynb # FAO-56 Smart Irrigation model notebook
│   ├── Market_prd.ipynb          # Commodity Market Price Forecasting notebook
│   └── yield.ipynb               # Crop Yield Estimation notebook
├── tests/                        # Automated unit & integration test suite
│   ├── test_disease_detection.py # Multi-provider inference & outcome tests
│   ├── test_admin_diagnostics_mapping.py # Admin contract & telemetry mapping tests
│   ├── test_admin_auth.py        # JWT security & RBAC tests
│   └── test_admin_diagnostics_monitoring.py # Database resilience & fallback tests
├── render.yaml                   # Render cloud deployment specification
├── requirements.txt              # Required Python packages
├── API_RESPONSE_CONTRACT.md      # OpenAPI data contract & response spec
└── README.md                     # Main documentation
```

---

## 🛠️ Tech Stack

- **Backend**: Python 3.10+, FastAPI, Uvicorn, Pydantic
- **Machine Learning & Deep Learning**: Scikit-Learn, PyTorch, Ultralytics YOLO, HuggingFace Transformers, Google Gemini API
- **Database & Storage**: Supabase PostgreSQL, Supabase Storage
- **External Data APIs**: OpenMeteo Weather, ISRIC SoilGrids, OpenStreetMap, Roboflow Universe
- **Testing**: PyTest, Starlette TestClient, AnyIO
- **Deployment**: Render Cloud, Supabase

---

## ⚡ How to Run Locally

### 1. Prerequisites
- **Python 3.10+** installed on your system.

### 2. Clone Repository & Setup Virtual Environment
```bash
git clone https://github.com/malleswarikolisettiprojects/DL-Project-AgriFusion.git
cd DL-Project-AgriFusion

# Create virtual environment
python -m venv .venv

# Activate on Windows
.venv\Scripts\activate

# Activate on Linux / Mac
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create a `.env` file in the root folder with your credentials:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
ROBOFLOW_API_KEY=your_roboflow_api_key
HF_TOKEN=your_huggingface_token
FRONTEND_URL=https://agrifusion.ai.studio
```

### 5. Start FastAPI Backend Server
```bash
uvicorn App.backend.server:app --reload --port 8000
```
Open interactive API documentation in your browser:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### 6. Run Test Suite
```bash
python -m pytest tests/ -v
```

---

## 🔌 Core API Endpoints Summary

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/predict/disease` | `POST` | Upload crop leaf photo for multi-provider disease/pest visual inference |
| `/api/v1/predict/crop` | `POST` | Get top recommended crops based on soil & climate |
| `/api/v1/predict/climate` | `POST` | Assess climate risk levels and field protection advice |
| `/api/v1/predict/irrigation` | `POST` | Calculate daily $ET_c$ water requirements & pump run times |
| `/api/v1/predict/yield` | `POST` | Predict harvest yield in Tons/Ha and Quintals/Ha |
| `/api/v1/predict/market` | `POST` | Forecast harvest date market prices and revenue |
| `/api/v1/schemes/recommend` | `POST` | Match eligible central and state government farming schemes |
| `/api/v1/agronomy/chat` | `POST` | Ask farming & crop management questions to Gemini AI Chatbot |
| `/api/v1/pipeline/run` | `POST` | Execute 5-step integrated prediction pipeline in one request |
| `/api/v1/admin/diagnostics` | `GET` | Retrieve paginated diagnostic telemetry reports for admin review |
| `/health` | `GET` | Lightweight health check & deployed commit SHA |

---

## 📄 License
This project is open-source and licensed under the **MIT License**.

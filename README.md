# 🌾 AgriFusion — AI Precision Agriculture Platform

AgriFusion is an AI-powered agricultural decision support system built for farmers and agricultural stakeholders in **Andhra Pradesh** and **Telangana**. It combines live satellite weather forecasts, soil data, machine learning models, deep learning plant diagnosis, and AI chat to provide clear, actionable farming guidance.

🌐 **Live Application**: [agrifusion.ai.studio](https://agrifusion.ai.studio/#)

---

## 📌 Features

1. 🌱 **Crop Recommendation**: Suggests suitable crops based on soil nutrients (N, P, K, pH), location, and climate data.
2. 🌦️ **Climate Risk Assessment**: Uses live weather forecasts to alert farmers about heat stress, drought, and heavy rainfall risks.
3. 💧 **Precision Irrigation**: Calculates daily water requirements ($ET_c$) using the FAO-56 method and gives pump operating hours and canal run times.
4. 🌾 **Yield Prediction**: Estimates crop harvest yield in Tons per Hectare and Quintals per Hectare.
5. 💰 **Market Price Prediction**: Forecasts market prices (₹/Quintal) on harvest dates and estimates expected revenue.
6. 🔬 **Leaf Disease & Nutrient Diagnosis**: Identifies crop diseases, pests, and plant nutrient deficiencies from leaf photos using deep learning models (including PyTorch CNNs, YOLO, and HuggingFace **RF-DETR** vision transformers) and provides treatments.
7. 🏛️ **Government Schemes**: Recommends eligible central and state government farming schemes (YSR Rythu Bharosa, Rythu Bandhu, PM-KISAN, PMFBY, Drip Subsidies).
8. 🤖 **Agronomy AI Chatbot**: An AI assistant powered by Google Gemini that answers farming questions using verified agricultural documents.
9. ⚡ **All-in-One Farm Pipeline**: Runs crop, climate, irrigation, yield, and market predictions together in one step.
10. 📋 **Farm Records**: Saves farm predictions and historical data securely using Supabase.

---

## 🏗️ System Architecture

```text
User / Frontend (agrifusion.ai.studio)
       │
       ▼ (REST API Requests)
FastAPI Backend Server (dl-project-agrifusion-backend.onrender.com)
       │
       ├── 🧠 ML & Deep Learning Models (App/pickles & App/pt files, RF-DETR)
       ├── 📚 Agronomy RAG Engine (Google Gemini AI + Agronomy Documents)
       ├── 🌐 External APIs (OpenMeteo Weather, ISRIC SoilGrids, OpenStreetMap)
       └── 🐘 Supabase Database (User Data & Records)
```

---

## 📁 Folder Structure

```text
DL-Project streamlit/
├── App/
│   ├── backend/                  # FastAPI backend server & intelligence modules
│   │   ├── server.py             # Main REST API server
│   │   ├── crop.py               # Crop recommendation logic
│   │   ├── climate_risk.py       # Weather risk assessment
│   │   ├── irrigation.py         # Precision irrigation calculator
│   │   ├── yields.py             # Crop yield estimator
│   │   ├── market.py             # Market price forecaster
│   │   ├── disease_detection.py  # Plant disease & RF-DETR nutrient deficiency detection
│   │   ├── agronomy_rag.py       # Gemini AI RAG chatbot
│   │   └── schemes.py            # Government scheme matcher
│   ├── frontend/                 # Admin Streamlit app
│   ├── pickles/                  # Trained machine learning models (.pkl)
│   └── pt files/                 # PyTorch leaf disease models (.pt)
├── rag_sources/                  # Crop & scheme reference documents (.md)
├── render.yaml                   # Render cloud deployment settings
├── requirements.txt              # Required Python packages
└── README.md                     # Main documentation
```

---

## 🛠️ Technologies Used

- **Backend API**: Python, FastAPI, Uvicorn
- **Machine Learning & AI**: Scikit-Learn, PyTorch, RF-DETR (Vision Transformer), YOLO, Google Gemini API
- **Database**: Supabase (PostgreSQL)
- **External Data APIs**: OpenMeteo (Weather), ISRIC SoilGrids (Soil), OpenStreetMap (Location)
- **Deployment**: Render (Backend), Google AI Studio (Frontend)

---

## ⚡ How to Run Locally

### 1. Prerequisites
- **Python 3.10+** installed on your system.

### 2. Clone Repository & Setup Virtual Environment
```bash
git clone https://github.com/your-username/DL-Project-AgriFusion.git
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
Create a `.env` file in the project folder with your API credentials:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=https://agrifusion.ai.studio
```

### 5. Start Backend Server
```bash
uvicorn App.backend.server:app --reload
```
Open interactive API documentation in your browser:
- **Swagger UI**: `http://localhost:8000/docs`

---

## 🔌 API Endpoints Summary

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/predict/crop` | `POST` | Get top recommended crops for a given location and soil |
| `/api/v1/predict/climate` | `POST` | Get climate risk levels and field protection advice |
| `/api/v1/predict/irrigation` | `POST` | Calculate daily water requirements and pump run time |
| `/api/v1/predict/yield` | `POST` | Predict harvest yield in Tons/Ha and Quintals/Ha |
| `/api/v1/predict/market` | `POST` | Forecast harvest date market prices and revenue |
| `/api/v1/predict/disease` | `POST` | Upload leaf photo for disease diagnosis and remedies |
| `/api/v1/schemes/recommend` | `POST` | Match eligible central and state government farming schemes |
| `/api/v1/agronomy/chat` | `POST` | Ask farming and crop management questions to AI Chatbot |
| `/api/v1/pipeline/run` | `POST` | Run 5-step integrated prediction pipeline in one request |

---

## 📄 License
This project is open-source and licensed under the **MIT License**.

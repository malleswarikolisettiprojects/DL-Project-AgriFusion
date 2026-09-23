# 🌾 AgriFusion Core App

> For complete project documentation, system features, and setup instructions, see the [Main README.md](../README.md).

---

## 🌐 Live Application
- **Frontend URL**: [https://agrifusion.ai.studio/#](https://agrifusion.ai.studio/#)

---

## 📁 Subdirectory Overview

- `backend/`: FastAPI REST API server, machine learning prediction engines, and database scripts.
- `frontend/`: Streamlit admin panel app.
- `pickles/`: Trained machine learning models for crop, climate, irrigation, yield, and market predictions.
- `pt files/`: PyTorch deep learning models for leaf disease detection.

---

## ⚡ Quick Backend Run
```bash
# Install dependencies from root
pip install -r ../requirements.txt

# Run FastAPI backend server
uvicorn App.backend.server:app --reload
```
API Documentation will be available at `http://localhost:8000/docs`.

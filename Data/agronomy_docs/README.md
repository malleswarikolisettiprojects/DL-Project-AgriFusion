# 📚 Agronomy Documents & IPM Knowledge Base Directory

Place agricultural extension handbooks, ICAR crop protection manuals, TNAU Agritech guides, and FAO IPM PDF/TXT/Markdown documents in this directory (`Data/agronomy_docs/`).

The AgriFusion **RAG (Retrieval-Augmented Generation) Agronomy Engine** (`App/backend/agronomy_rag.py`) automatically indexes all documents in this folder to generate crop-specific remedies, bio-pesticide choices, chemical controls, and fertilizer recommendations when plant diseases, pests, or nutrient deficiencies are detected.

---

## 📥 Recommended Documents to Download

### 1. ICAR Plant Protection & Crop Health Handbooks
- **Source**: Indian Council of Agricultural Research (ICAR)
- **Description**: Disease, pest, and weed management protocols for cereals (rice, wheat, maize), pulses, oilseeds, and commercial crops.
- **Save File Name**: `ICAR_Plant_Protection_Handbook.pdf` or `.txt`

### 2. TNAU Agritech Portal IPM Manuals
- **Source**: Tamil Nadu Agricultural University (TNAU) Agritech Portal
- **Description**: Comprehensive Integrated Pest Management (IPM) guidelines with exact chemical and organic dosages for crops.
- **Save File Name**: `TNAU_IPM_Manuals.txt` or `.pdf`

### 3. FAO Integrated Pest Management & Plant Health Guidelines
- **Source**: Food and Agriculture Organization (FAO)
- **Description**: International standards for bio-pesticides, biological natural enemies, and cultural prevention practices.
- **Save File Name**: `FAO_IPM_Guidelines.pdf` or `.txt`

### 4. CACP & ICAR Fertilizer & Soil Health Protocols
- **Source**: Commission for Agricultural Costs and Prices (CACP) / ICAR
- **Description**: Visual symptoms of Nitrogen, Phosphorus, Potassium, Zinc, Boron, and Iron deficiencies and corrective fertilizer schedules.
- **Save File Name**: `ICAR_Nutrient_Deficiency_Guide.txt` or `.pdf`

---

## ⚙️ Supported Formats
- `.pdf` (PDF text extracted via PyPDF2 / pdfplumber)
- `.txt` (Plain text documents)
- `.md` (Markdown files)

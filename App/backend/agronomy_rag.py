"""
AgriFusion Backend - RAG (Retrieval-Augmented Generation) Agronomy & Remedies Engine
Indexes documents from Data/agronomy_docs/ (PDFs, DOCX, TXT, MD) and generates tailored treatment plans
for detected crop diseases, pests, and nutrient deficiencies.
Provides direct links to agricultural handbooks, ICAR/FAO portals, PM-KISAN, PMFBY, KCC, and government scheme portals.
Answers any farmer query on general agriculture, crop management, organic farming, or government schemes.
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Real document fetcher — scrapes verified government/institute web pages
try:
    from App.backend.rag_document_fetcher import (
        VERIFIED_SOURCES,
        get_source_metadata,
        search_verified_documents,
    )
    REAL_DOC_RAG_OK = True
except ImportError:
    REAL_DOC_RAG_OK = False
    VERIFIED_SOURCES = []
    def search_verified_documents(disease_label, crop="", top_k=3):
        return []
    def get_source_metadata():
        return []

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    SKLEARN_OK = True
except ImportError:
    SKLEARN_OK = False

BASE_DIR = Path(__file__).resolve().parents[2]
DOCS_DIR = BASE_DIR / "Data" / "agronomy_docs"
DOCS_DIR.mkdir(parents=True, exist_ok=True)

AGRONOMY_DOCUMENT_LINKS: List[Dict[str, str]] = [
    {"title": "PM-KISAN Portal (Direct Benefit Transfer)", "url": "https://pmkisan.gov.in/", "type": "Govt Scheme Portal", "description": "Official PM-KISAN scheme portal for ₹6000 annual direct income support to farmers."},
    {"title": "PMFBY Crop Insurance Portal", "url": "https://pmfby.gov.in/", "type": "Govt Scheme Portal", "description": "Pradhan Mantri Fasal Bima Yojana — subsidized crop insurance against drought, flood & pest damage."},
    {"title": "Kisan Credit Card (KCC) Scheme - myScheme", "url": "https://myscheme.gov.in/schemes/kcc", "type": "Govt Scheme Portal", "description": "Concessional credit/loans at 4% effective interest rate up to ₹3 Lakh."},
    {"title": "Soil Health Card Portal", "url": "https://soilhealth.dac.gov.in/", "type": "Govt Scheme Portal", "description": "Free soil testing and custom fertilizer recommendations across 12 nutrient parameters."},
    {"title": "PM-KUSUM Solar Pump Scheme", "url": "https://pmkusum.mnre.gov.in/", "type": "Govt Scheme Portal", "description": "60% subsidy for solar agricultural pumps and solarization of grid pumps."},
    {"title": "SMAM Agrimachinery Portal", "url": "https://agrimachinery.nic.in/", "type": "Govt Scheme Portal", "description": "40-50% subsidy for purchasing tractors, tillers, rotavators, and agricultural drones."},
    {"title": "Paramparagat Krishi Vikas Yojana (PKVY)", "url": "https://pgsindia-ncof.gov.in/", "type": "Organic Farming Portal", "description": "₹50,000/ha support for organic farming clusters, bio-inputs & PGS certification."},
    {"title": "ICAR Crop Protection & Pest Management Handbook", "url": "https://icar.org.in/", "type": "Government Portal", "description": "Official ICAR guidelines for crop disease control, bio-pesticides, and fertilizer schedules."},
    {"title": "TNAU Agritech Portal - IPM", "url": "https://agritech.tnau.ac.in/crop_protection/crop_prot.html", "type": "University IPM Guide", "description": "Comprehensive IPM protocols for cereals, pulses, fruits, and cash crops."},
    {"title": "FAO Plant Production & Protection Division (IPM)", "url": "https://www.fao.org/pest-and-pesticide-management/en/", "type": "International Standard", "description": "FAO international guidelines for bio-pesticides and sustainable crop health."},
    {"title": "NIPHM - National Institute of Plant Health Management", "url": "https://niphm.gov.in/", "type": "Plant Health Authority", "description": "India nodal authority for plant health management, bio-pesticide registration, and IPM training."},
]

BASELINE_REMEDIES: Dict[str, Dict[str, Any]] = {
    "bacterial leaf blight": {"disease_name": "Bacterial Leaf Blight / BLB (Xanthomonas oryzae)", "organic_bio_control": "Spray Copper Oxychloride (2.5 g/liter) + Streptocycline (0.1 g/liter) as a prophylactic measure after storm/flood.", "chemical_treatment": "Spray Streptomycin Sulphate + Tetracycline (0.5 g/liter) or Copper Hydroxide (2 g/liter). Repeat after 10 days.", "cultural_practices": "Drain fields after flooding. Avoid excess Nitrogen. Uproot and burn wilted plants early. Use BLB-resistant varieties.", "fertilizer_advice": "Reduce Nitrogen dose. Apply Zinc Sulphate (25 kg/ha) as basal to strengthen cell walls."},
    "northern leaf blight": {"disease_name": "Northern Corn Leaf Blight / NCLB (Exserohilum turcicum)", "organic_bio_control": "Spray Neem Oil (5 ml/liter) or Copper Oxychloride (2.5 g/liter) as early preventive. Trichoderma seed treatment (4 g/kg).", "chemical_treatment": "Spray Propiconazole 25% EC (1 ml/liter) or Mancozeb 75% WP (2 g/liter) at VT stage. Repeat after 15 days.", "cultural_practices": "Use NCLB-resistant hybrids. Crop rotation with non-corn crops. Incorporate crop residues deeply.", "fertilizer_advice": "Balanced NPK. Avoid excess Nitrogen. Adequate Potassium (K) strengthens leaf cuticle against fungal entry."},
    "sheath blight": {"disease_name": "Sheath Blight of Rice (Rhizoctonia solani)", "organic_bio_control": "Apply Trichoderma viride granules (2.5 kg/ha) to field water. Spray Pseudomonas fluorescens (10 g/liter).", "chemical_treatment": "Spray Hexaconazole 5% EC (2 ml/liter) or Propiconazole 25% EC (1 ml/liter) at initiation. Repeat after 15 days.", "cultural_practices": "Avoid high plant density. Control weed hosts. Drain fields periodically to reduce humidity.", "fertilizer_advice": "Avoid top-heavy Nitrogen doses. Potash application (30 kg/acre MOP) improves stem strength."},
    "downy mildew": {"disease_name": "Downy Mildew (Plasmopara / Peronospora spp.)", "organic_bio_control": "Spray Neem Oil (5 ml/liter) + Garlic extract (10 ml/liter). Copper Sulphate Bordeaux mixture (1%) as preventive.", "chemical_treatment": "Spray Metalaxyl 35% WS (2 g/liter) or Cymoxanil 8% + Mancozeb 64% WP (2 g/liter).", "cultural_practices": "Ensure proper drainage and plant spacing. Avoid low-lying waterlogged areas. Remove infected leaves.", "fertilizer_advice": "Foliar spray of Calcium and Boron to strengthen cell walls. Avoid excess Nitrogen."},
    "powdery mildew": {"disease_name": "Powdery Mildew (Erysiphe / Sphaerotheca spp.)", "organic_bio_control": "Spray Neem Oil (5 ml/liter) + Potassium Bicarbonate (5 g/liter). Milk solution (10% dilution) effective as foliar spray.", "chemical_treatment": "Spray Tebuconazole 25.9% EC (1 ml/liter) or Hexaconazole 5% EC (2 ml/liter) or Triadimefon 25% WP (1 g/liter).", "cultural_practices": "Prune dense canopy for air circulation. Avoid overhead irrigation. Remove infected tissue immediately.", "fertilizer_advice": "Reduce high Nitrogen. Silicon (Si) foliar spray (2 g/liter) has suppressive effects against PM."},
    "anthracnose": {"disease_name": "Anthracnose (Colletotrichum gloeosporioides)", "organic_bio_control": "Spray Bordeaux Mixture (1%) before onset of rain. Trichoderma asperellum bioagent at 5 g/liter.", "chemical_treatment": "Spray Carbendazim 50% WP (1 g/liter) or Mancozeb 75% WP (2 g/liter) at 7-10 day intervals.", "cultural_practices": "Harvest at proper maturity. Post-harvest hot water treatment (52C, 2 min) for fruits. Practice field hygiene.", "fertilizer_advice": "Apply Calcium foliar spray to reduce susceptibility. Balanced NPK improves fruit skin integrity."},
    "sigatoka": {"disease_name": "Banana Sigatoka / Yellow Sigatoka (Mycosphaerella musicola)", "organic_bio_control": "Spray Neem Oil (10,000 ppm) 3 ml/liter fortnightly. Apply Trichoderma viride (5 g/liter). Remove and burn infected leaves.", "chemical_treatment": "Spray Propiconazole 25% EC (1 ml/liter) or Mancozeb 75% WP (2 g/liter) at 14-day intervals.", "cultural_practices": "Maintain proper plant spacing (1.8m x 1.8m) for air circulation. Avoid waterlogging.", "fertilizer_advice": "Apply Potassium (MOP 100 g/plant) to boost leaf immunity."},
    "leaf spot": {"disease_name": "Leaf Spot Disease (Cercospora / Alternaria spp.)", "organic_bio_control": "Spray Neem Oil (10,000 ppm) at 3 ml/liter or Trichoderma viride bio-fungicide (5g/liter). Prune affected lower leaves and burn them.", "chemical_treatment": "Spray Propiconazole 25% EC (1 ml/liter) or Mancozeb 75% WP (2g/liter). Repeat after 14 days if severe.", "cultural_practices": "Ensure proper plant spacing for aeration. Avoid overhead sprinkler irrigation to prevent spore spread.", "fertilizer_advice": "Apply Potassium (K) fertilizer to boost plant disease resistance. Foliar spray of Zinc Sulphate (0.5%)."},
    "blast": {"disease_name": "Rice / Grain Blast (Pyricularia oryzae)", "organic_bio_control": "Spray Pseudomonas fluorescens (10g/liter) at 15-day intervals. Seed treatment with Trichoderma viride (4g/kg seed).", "chemical_treatment": "Apply Tricyclazole 75% WP (0.6g/liter) or Isoprothiolane 40% EC (1.5 ml/liter). Spray at boot leaf and panicle initiation stages.", "cultural_practices": "Maintain 5 cm water layer in field during tillering. Avoid excessive Nitrogen application. Use blast-resistant varieties.", "fertilizer_advice": "Split Nitrogen dose into 3-4 applications; top-dress with Muriate of Potash (MOP 30 kg/acre)."},
    "rust": {"disease_name": "Rust Disease (Puccinia spp.)", "organic_bio_control": "Spray Sulfur WP 80% (3g/liter) or fermented buttermilk solution (10%). Remove wild grass hosts.", "chemical_treatment": "Spray Tebuconazole 25.9% EC (1 ml/liter) or Hexaconazole 5% EC (2 ml/liter).", "cultural_practices": "Use rust-resistant varieties. Clear field borders of wild grass hosts. Timely sowing avoids peak rust season.", "fertilizer_advice": "Ensure adequate Micronutrient spray (Zinc 0.5% + Boron 0.1%)."},
    "blight": {"disease_name": "Bacterial / Early Blight (Alternaria solani / Xanthomonas)", "organic_bio_control": "Copper Hydroxide 77% WP (2g/liter) + Bacillus subtilis bio-spray (5 ml/liter).", "chemical_treatment": "Spray Streptocycline (0.1g/liter) mixed with Copper Oxychloride (2.5g/liter). Repeat every 10-12 days.", "cultural_practices": "Ensure proper field drainage. Practice 2-year crop rotation with non-host crops. Remove infected plant debris.", "fertilizer_advice": "Avoid over-irrigating and high Nitrogen doses. Apply Calcium Nitrate spray (0.5%) to strengthen cell walls."},
    "wilt": {"disease_name": "Fusarium / Bacterial Wilt (Fusarium oxysporum / Ralstonia solanacearum)", "organic_bio_control": "Drenching with Pseudomonas fluorescens (10g/liter) at root zone. Apply Trichoderma viride (250g/kg FYM) as soil treatment.", "chemical_treatment": "Drench with Carbendazim 50% WP (2 g/liter) at root zone. Drench Copper Oxychloride (2.5 g/liter) for bacterial wilt.", "cultural_practices": "Avoid planting in wilt-endemic fields for 3-4 years. Remove and destroy infected plants immediately.", "fertilizer_advice": "Apply organic matter (FYM + Neem cake) to improve soil microbiome. Avoid waterlogging."},
    "canker": {"disease_name": "Citrus / Bacterial Canker (Xanthomonas axonopodis)", "organic_bio_control": "Bordeaux Mixture (1%) spray after pruning wounds. Remove all infected parts and burn.", "chemical_treatment": "Spray Streptocycline (0.1 g/liter) + Copper Oxychloride (2.5 g/liter). Repeat at 15-day intervals.", "cultural_practices": "Quarantine infected nursery material. Prune and burn canker-infected branches. Disinfect pruning tools with 10% bleach.", "fertilizer_advice": "Moderate Nitrogen application. Calcium spray to strengthen rind."},
    "mosaic": {"disease_name": "Mosaic Virus Disease (CMV / TMV / BYMV)", "organic_bio_control": "No cure - prevention is key. Use reflective mulches to deter aphid vectors. Neem Oil spray (5 ml/liter) to control vectors.", "chemical_treatment": "Control aphid/whitefly vectors with Imidacloprid 17.8 SL (0.3 ml/liter) or Thiamethoxam 25% WG (0.3 g/liter).", "cultural_practices": "Uproot and destroy infected plants immediately. Use virus-free certified seed. Rogue out infected plants.", "fertilizer_advice": "Maintain plant vigor through balanced nutrition to slow symptom progression."},
    "bollworm": {"disease_name": "Cotton Bollworm / American Bollworm (Helicoverpa armigera)", "organic_bio_control": "Install Pheromone Traps (5/acre). Spray Bt kurstaki (1 kg/ha) or NPV (1.5 x 10^8 POB/ml). Release Trichogramma (1 lakh/acre).", "chemical_treatment": "Spray Chlorantraniliprole 18.5% SC (0.4 ml/liter) or Emamectin Benzoate 5% SG (0.4 g/liter). Alternate insecticide groups.", "cultural_practices": "Adopt bird perches (10/acre). Remove and destroy damaged bolls. Harvest early to reduce carry-over population.", "fertilizer_advice": "Avoid excess Nitrogen which promotes lush growth attracting Helicoverpa."},
    "spider mite": {"disease_name": "Spider Mite Infestation (Tetranychus urticae)", "organic_bio_control": "Spray Neem Oil (10 ml/liter). Release predatory mite Phytoseiulus persimilis. Spray strong water jets to dislodge mites.", "chemical_treatment": "Spray Abamectin 1.8% EC (0.5 ml/liter) or Spiromesifen 22.9% SC (1 ml/liter). Cover undersides of leaves thoroughly.", "cultural_practices": "Avoid dusty conditions in fields. Adequate soil moisture reduces mite outbreaks.", "fertilizer_advice": "Silicon foliar spray (2 g/liter) significantly reduces mite infestation."},
    "mealybug": {"disease_name": "Mealybug Infestation (Phenacoccus solenopsis)", "organic_bio_control": "Release Cryptolaemus montrouzieri (mealybug destroyer) at 10 adults/plant. Spray NSKE 5%.", "chemical_treatment": "Spray Buprofezin 25% SC (2 ml/liter) or Profenofos 50% EC (2 ml/liter).", "cultural_practices": "Remove and destroy badly infested plant parts. Apply sticky tree bands on trunk to prevent ant movement.", "fertilizer_advice": "Avoid high Nitrogen. Adequate potassium hardens the bark."},
    "whitefly": {"disease_name": "Whitefly Infestation (Bemisia tabaci)", "organic_bio_control": "Install Yellow Sticky Traps (15/acre). Spray Neem Oil (5 ml/liter). Release Encarsia formosa parasitoid wasp. Spray Beauveria bassiana (5 g/liter).", "chemical_treatment": "Spray Buprofezin 25% SC (2 ml/liter) or Spiromesifen 22.9% SC (1 ml/liter) or Pymetrozine 50% WG (0.3 g/liter).", "cultural_practices": "Remove weeds that serve as alternate hosts. Use UV-absorbing mulches.", "fertilizer_advice": "Avoid high Nitrogen doses. Maintain balanced nutrition to reduce plant stress."},
    "stemborers": {"disease_name": "Rice / Maize Stem Borer (Scirpophaga incertulas / Chilo partellus)", "organic_bio_control": "Release Trichogramma japonicum (1 lakh/acre in 3 installments). Install light traps (1/acre). Spray Bt kurstaki (1 kg/ha).", "chemical_treatment": "Apply Carbofuran 3G granules (25 kg/ha) in the whorl. Or spray Chlorantraniliprole 18.5% SC (0.4 ml/liter).", "cultural_practices": "Destroy stubbles after harvest to kill pupae. Cut and burn dead hearts at vegetative stage.", "fertilizer_advice": "Avoid excessive Nitrogen which promotes lush growth preferred by stem borers."},
    "thrips": {"disease_name": "Thrips Infestation (Thrips palmi / Frankliniella occidentalis)", "organic_bio_control": "Install Blue Sticky Traps (10/acre). Spray Neem Oil (5 ml/liter). Release Amblyseius predatory mites.", "chemical_treatment": "Spray Fipronil 5% SC (1.5 ml/liter) or Imidacloprid 17.8% SL (0.3 ml/liter) or Spinosad 2.5% SC (1.5 ml/liter).", "cultural_practices": "Avoid intercropping susceptible crops. Remove flower buds in severe infestations.", "fertilizer_advice": "Balanced NPK. Excess Nitrogen causes soft tissue highly preferred by thrips."},
    "aphid": {"disease_name": "Aphid Infestation (Aphis gossypii / Myzus persicae)", "organic_bio_control": "Spray Neem Oil (5 ml/liter) + liquid soap (2 ml/liter). Release Chrysoperla predators or Coccinella beetles.", "chemical_treatment": "Spray Imidacloprid 17.8% SL (0.3 ml/liter) or Thiamethoxam 25% WG (0.3 g/liter). Focus spray on under side of leaves.", "cultural_practices": "Use reflective mulches to repel aphids. Remove and destroy heavily infested shoot tips.", "fertilizer_advice": "Reduce excess Nitrogen. Adequate Potassium application."},
    "nitrogen deficiency": {"disease_name": "Nitrogen Deficiency (N Deficiency)", "organic_bio_control": "Apply Urea top-dressing (30 kg/acre). Use FYM (5 Tons/acre) or inject liquid bio-nitrogen (Azospirillum 5 liter/acre).", "chemical_treatment": "Foliar spray of Urea (2%) or 19-19-19 soluble NPK (5 g/liter).", "cultural_practices": "Test soil N every season. Incorporate green manure crops (Dhaincha, Sunnhemp). Avoid burning crop residues.", "fertilizer_advice": "Split N doses into 3-4 applications to reduce leaching losses."},
    "zinc deficiency": {"disease_name": "Zinc Deficiency (Zn Deficiency - Khaira Disease in Rice)", "organic_bio_control": "Apply organic matter (FYM 5 Tons/acre). Use Zinc-solubilizing bacteria biofertilizer.", "chemical_treatment": "Foliar spray of Zinc Sulphate (ZnSO4) 0.5% (3-4 sprays at 10-day intervals). Soil: ZnSO4 25 kg/ha as basal.", "cultural_practices": "Correct soil pH if highly alkaline using Gypsum. Avoid heavy P application which fixes soil Zinc.", "fertilizer_advice": "Annual Zinc Sulphate application (25 kg/ha) in Zinc-deficient soils."},
    "iron deficiency": {"disease_name": "Iron Deficiency / Chlorosis (Fe Deficiency)", "organic_bio_control": "Apply FYM/compost which chelates iron and makes it available.", "chemical_treatment": "Foliar spray of Chelated Iron (Fe-EDTA) 0.5% solution (2-3 sprays).", "cultural_practices": "Correct soil pH if alkaline. Avoid waterlogged conditions which impair iron uptake.", "fertilizer_advice": "Apply Ferrous Sulphate 10 kg/ha as basal. In calcareous soils, prefer chelated Fe forms."},
    "nutrient": {"disease_name": "General Nutrient Deficiency", "organic_bio_control": "Apply Vermicompost (2 Tons/acre) or Panchagavya foliar spray (3%). Incorporate green manure crops.", "chemical_treatment": "Foliar spray of Chelated Zinc (1g/liter) or 19-19-19 NPK soluble fertilizer (5g/liter).", "cultural_practices": "Test soil pH and Organic Carbon. Incorporate green manure crops (Daincha/Sunnhemp).", "fertilizer_advice": "Correct soil pH using Agricultural Lime (acidic soils) or Gypsum (alkaline soils). Annual soil testing recommended."},
    "pest": {"disease_name": "Insect Pest Attack", "organic_bio_control": "Install Yellow & Blue Sticky Traps (10 traps/acre) + Neem Oil 1500 ppm (5 ml/liter). Release Trichogramma parasitoids (1 lakh/acre).", "chemical_treatment": "Spray Chlorantraniliprole 18.5% SC (0.4 ml/liter) or Emamectin Benzoate 5% SG (0.5g/liter). Rotate different pesticide groups.", "cultural_practices": "Install Pheromone Traps (5/acre) for monitoring moth population. Use light traps to attract adult moths.", "fertilizer_advice": "Balanced NPK application to build stem strength. Avoid excess Nitrogen which promotes tender growth."},
    "healthy": {"disease_name": "Healthy Crop - No Disease or Pest Detected", "organic_bio_control": "Continue preventive applications of Neem Oil (5 ml/liter) monthly. Apply bio-fertilizers for sustained nutrition.", "chemical_treatment": "No chemical treatment required. Maintain preventive calendar sprays as per crop stage.", "cultural_practices": "Continue good agronomic practices: crop rotation, proper spacing, and field sanitation. Monitor weekly.", "fertilizer_advice": "Follow soil test-based fertilizer application. Schedule micronutrient sprays as a preventive measure."},
}

# Extensive Knowledge Base for Farmer Schemes & Agriculture Q&A
SCHEME_KNOWLEDGE_BASE: List[Dict[str, Any]] = [
    {
        "topic": "pm-kisan",
        "keywords": ["pm kisan", "pm-kisan", "samman nidhi", "6000", "instalment", "financial support", "direct benefit", "income support"],
        "title": "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
        "url": "https://pmkisan.gov.in/",
        "institute": "Ministry of Agriculture & Farmers Welfare, Govt of India",
        "answer": (
            "**PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)** is a Central Sector Scheme providing direct income support to landholding farmer families across India.\n\n"
            "• **Financial Support:** ₹6,000 per year transferred directly into bank accounts in 3 equal instalments of ₹2,000 every 4 months.\n"
            "• **Eligibility:** All landholding farmer families with cultivable land in their names. Exclusions include high income-tax payers, government officers, and constitutional post holders.\n"
            "• **How to Apply:** Register online at [pmkisan.gov.in](https://pmkisan.gov.in/), visit nearest CSC (Common Service Center), or contact District Agriculture Officer.\n"
            "• **Required Documents:** Aadhaar Card, Land Record (Khata/Khatoni passbook), Aadhaar-linked Bank Account Details, Mobile Number."
        )
    },
    {
        "topic": "pmfby",
        "keywords": ["pmfby", "fasal bima", "crop insurance", "insurance", "drought insurance", "flood claim", "hailstorm damage", "crop loss"],
        "title": "PMFBY (Pradhan Mantri Fasal Bima Yojana)",
        "url": "https://pmfby.gov.in/",
        "institute": "Ministry of Agriculture & Farmers Welfare, Govt of India",
        "answer": (
            "**PMFBY (Pradhan Mantri Fasal Bima Yojana)** offers comprehensive crop insurance against non-preventable natural risks (drought, flood, unseasonal rain, hailstorm, pest attack).\n\n"
            "• **Subsidized Premium Rates:**\n"
            "  - **Kharif Crops:** 2.0% of sum insured\n"
            "  - **Rabi Crops:** 1.5% of sum insured\n"
            "  - **Commercial / Horticultural Crops:** 5.0% of sum insured\n"
            "• **Claim Process:** Report individual localized crop damage within **72 hours** of loss via the Crop Insurance App, portal [pmfby.gov.in](https://pmfby.gov.in/), or Toll-Free Number **1800-180-1551**.\n"
            "• **Coverage:** Covers pre-sowing to post-harvest losses due to localized calamities."
        )
    },
    {
        "topic": "kcc",
        "keywords": ["kcc", "kisan credit card", "crop loan", "bank loan", "subsidized interest", "credit card", "nabard loan"],
        "title": "Kisan Credit Card (KCC) Scheme",
        "url": "https://myscheme.gov.in/schemes/kcc",
        "institute": "NABARD & Ministry of Agriculture, Govt of India",
        "answer": (
            "**Kisan Credit Card (KCC)** provides timely, hassle-free credit to farmers for crop cultivation, post-harvest expenses, animal husbandry, and fisheries.\n\n"
            "• **Effective Interest Rate:** Standard interest is 7%, but with **3% Interest Subvention for prompt repayment**, effective interest is only **4% per annum**.\n"
            "• **Collateral-Free Limit:** Up to **₹1.60 Lakh** without collateral security (extendable up to ₹3 Lakh).\n"
            "• **Application:** Apply at Commercial Banks, Regional Rural Banks (RRBs), Cooperative Banks, or fill the simple 1-page KCC form via PM-KISAN portal."
        )
    },
    {
        "topic": "soil health card",
        "keywords": ["soil health card", "soil test", "fertilizer dose", "npk recommendation", "soil testing lab", "kvk soil"],
        "title": "Soil Health Card Scheme",
        "url": "https://soilhealth.dac.gov.in/",
        "institute": "Department of Agriculture & Farmers Welfare, Govt of India",
        "answer": (
            "**Soil Health Card Scheme** issues personalized soil cards every 3 years to inform farmers about nutrient deficiencies and exact fertilizer dosages needed.\n\n"
            "• **Parameters Tested:** 12 parameters — Macro (N, P, K), Secondary (S), Micro (Zn, Fe, Cu, Mn, Bo), and Physical (pH, EC, OC).\n"
            "• **Benefits:** Reduces excess fertilizer expenditure by up to 20-25% and boosts crop yield by providing crop-specific fertilizer recommendations.\n"
            "• **How to Get:** Contact local Krishi Vigyan Kendra (KVK), Block Agriculture Officer, or nearest Soil Testing Laboratory."
        )
    },
    {
        "topic": "pmksy drip irrigation",
        "keywords": ["pmksy", "drip irrigation", "sprinkler", "per drop more crop", "micro irrigation subsidy", "water saving"],
        "title": "PMKSY (Pradhan Mantri Krishi Sinchayee Yojana - Micro Irrigation)",
        "url": "https://pmksy.gov.in/",
        "institute": "Ministry of Agriculture & Farmers Welfare, Govt of India",
        "answer": (
            "**PMKSY (Per Drop More Crop)** provides financial assistance to farmers for installing Micro-Irrigation systems (Drip and Sprinkler).\n\n"
            "• **Subsidy Percentage:** 55% for Small & Marginal Farmers, 45% for Other Farmers (Up to 80-90% subsidy in specific states like AP/Telangana/Gujarat).\n"
            "• **Benefits:** Saves up to 40-50% irrigation water, increases fertilizer efficiency (fertigation), and yields up to 30% higher output.\n"
            "• **How to Apply:** Apply through State Horticulture / Agriculture Department online portal or District Horticulture Office."
        )
    },
    {
        "topic": "smam tractor machinery",
        "keywords": ["smam", "agrimachinery", "tractor subsidy", "rotavator", "drone subsidy", "custom hiring center", "machinery subsidy"],
        "title": "SMAM (Sub-Mission on Agricultural Mechanization)",
        "url": "https://agrimachinery.nic.in/",
        "institute": "Ministry of Agriculture & Farmers Welfare, Govt of India",
        "answer": (
            "**SMAM Scheme** promotes farm mechanization by offering capital subsidies on agricultural equipment and setting up Custom Hiring Centers (CHCs).\n\n"
            "• **Subsidy Level:** 40% to 50% subsidy for individual farmers purchasing tractors, power tillers, rotavators, sprayers, and Kisan Drones.\n"
            "• **Custom Hiring Center (CHC):** Up to 80% subsidy (max ₹8 Lakh to ₹10 Lakh) for FPOs / Farm Cooperatives to set up CHCs.\n"
            "• **How to Apply:** Register on the official portal [agrimachinery.nic.in](https://agrimachinery.nic.in/)."
        )
    },
    {
        "topic": "pkvy organic farming",
        "keywords": ["pkvy", "organic farming", "paramparagat krishi", "bio fertilizer", "vermicompost", "pgs certification", "natural farming"],
        "title": "Paramparagat Krishi Vikas Yojana (PKVY)",
        "url": "https://pgsindia-ncof.gov.in/",
        "institute": "National Centre of Organic Farming (NCOF), India",
        "answer": (
            "**PKVY** promotes organic farming through cluster-based adoption and Participatory Guarantee System (PGS) certification.\n\n"
            "• **Financial Assistance:** ₹50,000 per hectare over 3 years, of which ₹31,000 is directly paid for organic seeds, bio-fertilizers, neem cake, and vermicompost.\n"
            "• **Cluster Formation:** Farmers form groups of 20 or more holding 50 acres of land.\n"
            "• **How to Apply:** Contact Regional NCOF, District Agriculture Office, or join a local organic farming cluster."
        )
    },
    {
        "topic": "pm kusum solar pump",
        "keywords": ["pm kusum", "kusum", "solar pump", "solar subsidy", "water pump solar", "mnre solar"],
        "title": "PM-KUSUM Solar Pump Scheme",
        "url": "https://pmkusum.mnre.gov.in/",
        "institute": "Ministry of New & Renewable Energy (MNRE), Govt of India",
        "answer": (
            "**PM-KUSUM Scheme** enables farmers to install solar agricultural water pumps and solarize existing grid-connected pumps.\n\n"
            "• **Subsidy Structure:** 60% total subsidy (30% Central + 30% State Govt), farmer pays only 40% (can take 30% bank loan, net farmer contribution 10%).\n"
            "• **Pump Capacity:** 3 HP to 10 HP standalone solar pumps.\n"
            "• **Income Source:** Farmers can sell surplus solar power back to DISCOMs for steady income.\n"
            "• **How to Apply:** Register on official State Renewable Energy Development Agency portal."
        )
    }
]


_LOCAL_DOCS_CACHE: List[Dict[str, Any]] = []

def load_local_agronomy_documents(force_reload: bool = False) -> List[Dict[str, Any]]:
    """
    Scans Data/agronomy_docs/ recursively and extracts text from ALL local files:
      - .pdf  (Extracts ALL pages using pypdf / PyPDF2)
      - .docx (Extracts all text using python-docx)
      - .txt, .md, .json, .csv
    Caches parsed documents in memory for instant sub-second retrieval.
    """
    global _LOCAL_DOCS_CACHE
    if _LOCAL_DOCS_CACHE and not force_reload:
        return _LOCAL_DOCS_CACHE

    docs = []
    if not DOCS_DIR.exists():
        return docs

    for file_path in DOCS_DIR.glob("**/*"):
        if not file_path.is_file() or file_path.name.startswith("_"):
            continue

        suffix = file_path.suffix.lower()

        # ── 1. PDF Files ──────────────────────────────────────────────
        if suffix == ".pdf":
            text_content = ""
            pages_count = 0
            # Try pypdf
            try:
                import pypdf
                reader = pypdf.PdfReader(str(file_path))
                pages_count = len(reader.pages)
                extracted = []
                for p_idx, page in enumerate(reader.pages):
                    p_text = page.extract_text() or ""
                    if p_text.strip():
                        extracted.append(f"[Page {p_idx+1}]\n{p_text.strip()}")
                text_content = "\n\n".join(extracted)
            except Exception:
                # Fallback to PyPDF2
                try:
                    import PyPDF2
                    reader = PyPDF2.PdfReader(str(file_path))
                    pages_count = len(reader.pages)
                    extracted = []
                    for p_idx, page in enumerate(reader.pages):
                        p_text = page.extract_text() or ""
                        if p_text.strip():
                            extracted.append(f"[Page {p_idx+1}]\n{p_text.strip()}")
                    text_content = "\n\n".join(extracted)
                except Exception as pypdf_err:
                    print(f"[RAG] Could not parse PDF {file_path.name}: {pypdf_err}")

            if text_content.strip():
                docs.append({
                    "source": file_path.name,
                    "path": str(file_path),
                    "text": text_content.strip(),
                    "pages_count": pages_count,
                    "file_type": "PDF",
                })

        # ── 2. DOCX Files ─────────────────────────────────────────────
        elif suffix == ".docx":
            try:
                import docx
                doc_obj = docx.Document(str(file_path))
                fullText = [para.text for para in doc_obj.paragraphs if para.text.strip()]
                text_content = "\n".join(fullText)
                if text_content.strip():
                    docs.append({
                        "source": file_path.name,
                        "path": str(file_path),
                        "text": text_content.strip(),
                        "pages_count": 1,
                        "file_type": "DOCX",
                    })
            except Exception as docx_err:
                print(f"[RAG] Could not parse DOCX {file_path.name}: {docx_err}")

        # ── 3. Plain Text / Markdown / CSV / JSON Files ──────────────
        elif suffix in {".txt", ".md", ".json", ".csv"}:
            try:
                text_content = file_path.read_text(encoding="utf-8", errors="ignore")
                if text_content.strip():
                    docs.append({
                        "source": file_path.name,
                        "path": str(file_path),
                        "text": text_content.strip(),
                        "pages_count": 1,
                        "file_type": suffix.upper().replace(".", ""),
                    })
            except Exception as txt_err:
                print(f"[RAG] Could not read file {file_path.name}: {txt_err}")

    _LOCAL_DOCS_CACHE = docs
    return docs


def chunk_local_documents(docs: List[Dict[str, Any]], chunk_words: int = 250, overlap: int = 50) -> List[Dict[str, Any]]:
    """Split local document text into word-level chunks for high-precision vector search."""
    chunks = []
    step = chunk_words - overlap
    for doc in docs:
        words = doc["text"].split()
        if not words:
            continue
        for i in range(0, len(words), step):
            chunk_words_slice = words[i : i + chunk_words]
            chunk_text = " ".join(chunk_words_slice)
            if len(chunk_text) > 60:
                chunks.append({
                    "doc_id": doc["source"],
                    "title": doc["source"],
                    "url": f"file://{doc['path']}",
                    "institute": f"Local agronomy_docs folder ({doc['file_type']})",
                    "text": chunk_text,
                    "file_type": doc["file_type"],
                })
    return chunks


# Minimum similarity score required to use a retrieved passage.
# Results below this threshold are considered not reliably matched.
RAG_RELEVANCE_THRESHOLD = float(os.getenv("RAG_RELEVANCE_THRESHOLD", "0.15"))


def _no_verified_match_response(query_label: str, crop: str) -> Dict[str, Any]:
    """
    Returned when no verified source meets the relevance threshold.
    All dose/treatment fields contain an explicit sentinel so that the UI
    never displays an invented recommendation.
    """
    _NO_DOSE = "Not available — no verified source found for this condition. Consult your local Agriculture Officer or Krishi Vigyan Kendra."
    return {
        "target_condition": query_label,
        "crop": crop,
        "diagnosis": "Unidentified / No Verified Match",
        "document_passage": None,
        "chemical_treatment": _NO_DOSE,
        "organic_bio_control": _NO_DOSE,
        "cultural_practices": _NO_DOSE,
        "fertilizer_advice": _NO_DOSE,
        "rag_status": "no_verified_match",
        "source_title": None,
        "source_url": None,
        "source_institute": None,
        "relevance_score": 0.0,
        "retrieved_document_passages": [],
        "local_file_snippets": [],
        "reference_document_links": AGRONOMY_DOCUMENT_LINKS,
        "notice": (
            "No verified agronomic document matched this query above the confidence threshold. "
            "Please consult your local Agriculture Officer, Krishi Vigyan Kendra (KVK), "
            "or ICAR extension services for a professional diagnosis."
        ),
    }


def _match_baseline(query_lower: str) -> Optional[Dict[str, Any]]:
    """Finds the best-matching BASELINE_REMEDIES entry."""
    if query_lower in BASELINE_REMEDIES:
        return BASELINE_REMEDIES[query_lower]
    best_key: Optional[str] = None
    best_len = 0
    for key in BASELINE_REMEDIES:
        if key in query_lower and len(key) > best_len:
            best_key = key
            best_len = len(key)
    if best_key:
        return BASELINE_REMEDIES[best_key]
    for fallback in ("pest", "nutrient", "healthy"):
        if fallback in query_lower:
            return BASELINE_REMEDIES[fallback]
    return None


def generate_rag_remedies(query_label: str, crop: str = "crop") -> Dict[str, Any]:
    """
    Retrieve agronomic remedy information for a detected disease/pest/nutrient condition.

    Priority order:
    1. Real document search — TF-IDF over verified TNAU / ICAR / FAO web pages
    2. Local manually-placed files in Data/agronomy_docs/ (PDFs, DOCX, TXT)
    3. BASELINE_REMEDIES dictionary (last resort)
    """
    query_lower = str(query_label).lower()

    # ── 1. Real document search (primary) ──────────────────────────
    real_doc_hits = []
    if REAL_DOC_RAG_OK:
        try:
            real_doc_hits = search_verified_documents(query_label, crop=crop, top_k=3)
        except Exception as e:
            print(f"[RAG] Real-doc search error: {e}")

    # ── 2. Local manually-placed files & PDFs ──────────────────────
    local_docs = load_local_agronomy_documents()
    local_chunks = chunk_local_documents(local_docs)
    local_hits = []

    if local_chunks and SKLEARN_OK:
        try:
            texts = [c["text"] for c in local_chunks]
            vec = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
            mat = vec.fit_transform(texts + [query_label + " " + crop])
            sims = cosine_similarity(mat[-1], mat[:-1]).flatten()
            top_idx = np.argsort(sims)[::-1][:2]
            for idx in top_idx:
                if sims[idx] > RAG_RELEVANCE_THRESHOLD:
                    local_hits.append(local_chunks[idx])
        except Exception:
            pass

    local_snippets = []
    for hit in local_hits:
        snippet = hit["text"][:300].replace("\n", " ")
        # Do NOT expose internal filesystem paths
        local_snippets.append(f"[{hit['title']}]: {snippet}...")

    # Fallback substring check if no TF-IDF hits
    if not local_snippets:
        for doc in local_docs:
            if query_lower in doc["text"].lower() or crop.lower() in doc["text"].lower():
                snippet = doc["text"][:300].replace("\n", " ")
                local_snippets.append(f"[{doc['source']}]: {snippet}...")

    # ── 3. BASELINE_REMEDIES fallback ──────────────────────────────
    # Only used when the detected label is explicitly listed in BASELINE_REMEDIES.
    # We do NOT fall back to an unrelated disease entry to avoid inventing doses.
    matched_baseline = _match_baseline(query_lower)

    # ── Build the remedy text ──────────────────────────────────────
    if real_doc_hits:
        best = real_doc_hits[0]
        if best.get("relevance_score", 0.0) >= RAG_RELEVANCE_THRESHOLD:
            doc_passage = best["text"].strip()
            if len(doc_passage) > 600:
                doc_passage = doc_passage[:600].rsplit(" ", 1)[0] + " ..."
            remedy_source = "real_document"
            source_title = best["title"]
            source_url = best["url"]
            source_institute = best["institute"]
            relevance = round(best.get("relevance_score", 0.0), 3)
        else:
            real_doc_hits = []
            doc_passage = None
            remedy_source = "below_threshold"
            source_title = None
            source_url = None
            source_institute = None
            relevance = 0.0
    elif local_hits:
        best_loc = local_hits[0]
        doc_passage = best_loc["text"].strip()
        if len(doc_passage) > 600:
            doc_passage = doc_passage[:600].rsplit(" ", 1)[0] + " ..."
        remedy_source = "local_pdf_doc"
        source_title = f"Local Document: {best_loc['title']}"
        # Strip file:// internal paths from responses
        source_url = best_loc.get("url", "").replace("file://", "") or None
        source_institute = best_loc["institute"]
        relevance = 0.8
    else:
        doc_passage = None
        remedy_source = "no_match"
        source_title = None
        source_url = None
        source_institute = None
        relevance = 0.0

    # If no verified source is available AND no baseline entry matches this exact
    # condition, return the explicit no-match response to avoid invented advice.
    if not matched_baseline and remedy_source in ("no_match", "below_threshold"):
        return _no_verified_match_response(query_label, crop)

    # If a baseline entry exists, use it. Treat any missing fields as "not verified".
    _NO_DOSE = "Not available in the verified source — consult your local Agriculture Officer."
    if matched_baseline:
        chem_tx = matched_baseline.get("chemical_treatment") or _NO_DOSE
        organic = matched_baseline.get("organic_bio_control") or _NO_DOSE
        cultural = matched_baseline.get("cultural_practices") or _NO_DOSE
        fert = matched_baseline.get("fertilizer_advice") or _NO_DOSE
        diagnosis = matched_baseline.get("disease_name", query_label)
    else:
        chem_tx = organic = cultural = fert = _NO_DOSE
        diagnosis = query_label

    all_reference_links = get_source_metadata() if REAL_DOC_RAG_OK else AGRONOMY_DOCUMENT_LINKS

    return {
        "target_condition": query_label,
        "crop": crop,
        "diagnosis": diagnosis,
        "document_passage": doc_passage,
        "chemical_treatment": chem_tx,
        "organic_bio_control": organic,
        "cultural_practices": cultural,
        "fertilizer_advice": fert,
        "rag_status": remedy_source,
        "source_title": source_title,
        "source_url": source_url,
        "source_institute": source_institute,
        "relevance_score": relevance,
        "retrieved_document_passages": [
            {
                "text": h["text"][:400],
                "source": h["title"],
                "url": h["url"],
                "institute": h["institute"],
                "score": round(h.get("relevance_score", 0.0), 3),
            }
            for h in real_doc_hits
        ],
        "local_file_snippets": local_snippets[:3],
        "reference_document_links": all_reference_links,
    }


def query_agronomy_agent(user_query: str, crop: Optional[str] = None) -> Dict[str, Any]:
    """
    Universal Farmer Assistant & RAG Query Agent.
    Handles ANY question related to agriculture, crop diseases, pests, fertilizers,
    or government schemes (PM-KISAN, PMFBY, KCC, Soil Health Card, SMAM, PKVY, etc.).

    Searches:
    1. Local PDF / DOCX / TXT files in Data/agronomy_docs/
    2. Real verified government / institute web pages
    3. Extensive Knowledge Base for Indian schemes and agronomy best practices
    """
    query_lower = user_query.lower()
    crop_name = crop or ""

    # ── 1. Check Local PDFs & Documents ────────────────────────────
    local_docs = load_local_agronomy_documents()
    local_chunks = chunk_local_documents(local_docs)
    matched_local_passages = []

    if local_chunks and SKLEARN_OK:
        try:
            texts = [c["text"] for c in local_chunks]
            vec = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
            mat = vec.fit_transform(texts + [user_query])
            sims = cosine_similarity(mat[-1], mat[:-1]).flatten()
            top_indices = np.argsort(sims)[::-1][:3]
            for idx in top_indices:
                if sims[idx] > 0.05:
                    matched_local_passages.append({
                        "text": local_chunks[idx]["text"][:500],
                        "source": f"Local File: {local_chunks[idx]['title']}",
                        "url": local_chunks[idx]["url"],
                        "institute": local_chunks[idx]["institute"],
                        "score": round(float(sims[idx]), 3),
                    })
        except Exception as e:
            print(f"[RAG Agent] Local doc TF-IDF error: {e}")

    # ── 2. Check Scheme Knowledge Base ─────────────────────────────
    kb_match = None
    for item in SCHEME_KNOWLEDGE_BASE:
        if any(kw in query_lower for kw in item["keywords"]):
            kb_match = item
            break

    # ── 3. Check Verified Web Documents (if no local/KB match) ────
    verified_passages = []
    if REAL_DOC_RAG_OK and not kb_match and not matched_local_passages:
        try:
            web_hits = search_verified_documents(user_query, crop=crop_name, top_k=3)
            for h in web_hits:
                verified_passages.append({
                    "text": h["text"][:500],
                    "source": h["title"],
                    "url": h["url"],
                    "institute": h["institute"],
                    "score": round(h.get("relevance_score", 0.0), 3),
                })
        except Exception as e:
            print(f"[RAG Agent] Web fetch error: {e}")

    # ── 4. Synthesize the Final Answer ──────────────────────────────
    if kb_match:
        primary_answer = kb_match["answer"]
        source_title = kb_match["title"]
        source_url = kb_match["url"]
        source_institute = kb_match["institute"]
        confidence = 0.95
    elif matched_local_passages:
        best_loc = matched_local_passages[0]
        primary_answer = (
            f"Based on your document **{best_loc['source']}**:\n\n"
            f"{best_loc['text']}\n\n"
            "*(For specific implementation steps, consult your local Krishi Vigyan Kendra or Agriculture Officer.)*"
        )
        source_title = best_loc["source"]
        source_url = best_loc["url"]
        source_institute = best_loc["institute"]
        confidence = best_loc["score"]
    elif verified_passages:
        best_web = verified_passages[0]
        primary_answer = (
            f"According to **{best_web['institute']}** ([{best_web['source']}]({best_web['url']})): \n\n"
            f"{best_web['text']}\n\n"
            "*(Retrieved directly from verified government guidelines.)*"
        )
        source_title = best_web["source"]
        source_url = best_web["url"]
        source_institute = best_web["institute"]
        confidence = best_web["score"]
    else:
        # No verified match — do NOT invent generic advice.
        return {
            "query": user_query,
            "crop": crop_name,
            "answer": None,
            "confidence_score": 0.0,
            "source_title": None,
            "source_url": None,
            "source_institute": None,
            "retrieved_passages": [],
            "local_docs_scanned": len(local_docs),
            "reference_links": ref_links,
            "rag_status": "no_verified_match",
            "notice": (
                "No verified document matched your query above the confidence threshold. "
                "Please consult your local Krishi Vigyan Kendra (KVK), Agriculture Officer, "
                "or ICAR extension services for personalised guidance on this topic."
            ),
        }

    all_passages = matched_local_passages + verified_passages
    ref_links = get_source_metadata() if REAL_DOC_RAG_OK else AGRONOMY_DOCUMENT_LINKS

    return {
        "query": user_query,
        "crop": crop_name,
        "answer": primary_answer,
        "confidence_score": confidence,
        "source_title": source_title,
        "source_url": source_url,
        "source_institute": source_institute,
        "retrieved_passages": all_passages,
        "local_docs_scanned": len(local_docs),
        "reference_links": ref_links,
    }

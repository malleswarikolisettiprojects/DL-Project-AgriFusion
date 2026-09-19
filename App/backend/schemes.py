"""
AgriFusion Backend — Government Schemes & Subsidies Recommendation Engine

SAFETY NOTICE
=============
This module provides possible scheme matches to guide farmers toward official
government resources. It does NOT confirm eligibility, verify benefit amounts,
or make legally binding recommendations.

All scheme details (subsidy percentages, income limits, document requirements)
are subject to change. Farmers MUST verify details directly at the official
portal or through a local Agriculture Officer, Krishi Vigyan Kendra, or
registered Common Service Centre (CSC).
"""

from typing import Any, Dict, List

_VERIFICATION_NOTICE = (
    "⚠️ Eligibility requires official verification. "
    "Benefit amounts and rules may have changed. "
    "Confirm at the official portal or contact your local Agriculture Officer."
)


def _scheme(
    *,
    id_: str,
    name: str,
    category: str,
    possible_benefit: str,
    description: str,
    matched_criteria: list,
    key_documents: list,
    portal_url: str,
    helpline: str,
) -> Dict[str, Any]:
    """Build a scheme dict with consistent safety fields."""
    return {
        "id": id_,
        "name": name,
        "category": category,
        "possible_match": True,
        "verification_required": True,
        "verification_notice": _VERIFICATION_NOTICE,
        "possible_benefit": possible_benefit,
        "description": description,
        "matched_criteria": matched_criteria,
        "key_documents_typically_required": key_documents,
        "portal_url": portal_url,
        "helpline": helpline,
    }


def recommend_schemes(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Suggests government schemes that may be relevant to the farmer's situation.

    Expected input dictionary keys:
    - state (str): e.g. "Andhra Pradesh"
    - district (str): e.g. "Visakhapatnam"
    - crop (str): e.g. "Rice", "Banana", "Tomato"
    - area_ha (float): Land area in hectares
    - growth_stage (str): Sowing, Vegetative, Flowering, Harvesting
    - solar_interest (bool): Interested in solar pump / renewable energy
    - irrigation_type (str): Canal, Drip, Sprinkler, Rainfed, Borewell
    - climate_risk_level (str): Low, Moderate, High
    - farmer_category (str): Small (<2ha), Marginal (<1ha), General, SC/ST, Women

    Returns a list of possible-match scheme dictionaries. Each entry includes
    `possible_match: True` and `verification_required: True`. None of these
    entries implies confirmed eligibility or guaranteed benefit receipt.
    """
    state = str(data.get("state", "")).strip()
    crop = str(data.get("crop", "")).strip().lower()
    area_ha = float(data.get("area_ha", 1.0))
    growth_stage = str(data.get("growth_stage", "Sowing")).strip().lower()
    solar_interest = bool(data.get("solar_interest", False))
    irrigation_type = str(data.get("irrigation_type", "Drip")).strip().lower()
    climate_risk_level = str(data.get("climate_risk_level", "Low")).strip().lower()
    farmer_category = str(data.get("farmer_category", "Small")).strip().lower()

    horticulture_crops = {
        "banana", "mango", "papaya", "pomegranate", "grapes", "watermelon", "muskmelon",
        "apple", "orange", "chili", "chilli", "tomato", "potato", "onion", "brinjal",
        "coconut", "coffee", "tea"
    }

    is_small_marginal = area_ha <= 2.0 or farmer_category in {"small", "marginal", "sc/st", "women"}
    recommendations: List[Dict[str, Any]] = []

    # 1. PM-KUSUM (Solar Pump Scheme)
    if solar_interest or "borewell" in irrigation_type or "drip" in irrigation_type:
        recommendations.append(_scheme(
            id_="pm-kusum",
            name="PM-KUSUM Scheme (Solar Irrigation Pump Subsidy)",
            category="Renewable Energy & Solar Pumps",
            possible_benefit="Central and State subsidy on standalone solar agriculture pumps — verify current subsidy percentage at the official portal.",
            description=(
                "Provides financial assistance for standalone solar agriculture pumps "
                "and solarizing existing grid-connected pumps. Excess solar power may "
                "be sold back to DISCOMs under the scheme's provisions."
            ),
            matched_criteria=["Interest in Solar Irrigation / Pump", f"Land Area: {area_ha} Ha"],
            key_documents=["Aadhaar Card", "Land Pattadar Passbook / Adangal", "Bank Passbook", "Electricity Bill (if grid pump)"],
            portal_url="https://pmkusum.mnre.gov.in/",
            helpline="1800-180-3333",
        ))

    # 2. PMFBY (Crop Insurance)
    if climate_risk_level in {"high", "moderate"} or growth_stage in {"sowing", "vegetative"}:
        risk_tag = "High Climate Risk Alert Detected" if climate_risk_level == "high" else "Seasonal Climate Protection"
        recommendations.append(_scheme(
            id_="pmfby",
            name="Pradhan Mantri Fasal Bima Yojana (PMFBY Crop Insurance)",
            category="Risk Protection & Financial Safety",
            possible_benefit="Premium subsidy on crop insurance — verify current premium rates and notified crops for your district at the official portal.",
            description=(
                "Comprehensive insurance coverage against non-preventable natural risks "
                "(drought, dry spells, flood, inundation, pests & diseases, unseasonal cyclones). "
                "Claim settlement is made directly to the farmer's bank account."
            ),
            matched_criteria=[risk_tag, f"Target Crop: {crop.capitalize()}"],
            key_documents=["Land Sowing Certificate", "Aadhaar", "Bank Account Details", "Land Record (RoR/Khasra)"],
            portal_url="https://pmfby.gov.in/",
            helpline="1800-180-1551",
        ))

    # 3. PMKSY — Per Drop More Crop (Micro-Irrigation)
    if "drip" in irrigation_type or "sprinkler" in irrigation_type or area_ha >= 0.5:
        recommendations.append(_scheme(
            id_="pmksy-pdmc",
            name="PMKSY - Per Drop More Crop (Drip & Sprinkler Subsidy)",
            category="Micro-Irrigation & Water Conservation",
            possible_benefit="Subsidy on Drip & Sprinkler systems — verify current subsidy percentage for your farmer category and state at the official portal.",
            description=(
                "Promotes micro-irrigation technologies to increase water use efficiency. "
                "Includes financial aid for On-Farm Water Management. "
                "Small & Marginal Farmers may qualify for a higher subsidy percentage."
            ),
            matched_criteria=[f"Irrigation Mode: {irrigation_type.capitalize()}", "Water Efficiency Recommendation"],
            key_documents=["Land Ownership Document", "Soil & Water Test Report", "Aadhaar", "Bank Details"],
            portal_url="https://pmksy.gov.in/",
            helpline="1800-180-1551",
        ))

    # 4. MIDH (Horticulture)
    if crop in horticulture_crops:
        recommendations.append(_scheme(
            id_="midh",
            name="MIDH - Mission for Integrated Development of Horticulture",
            category="Horticulture Crop Production & Infrastructure",
            possible_benefit="Financial assistance for high density planting, shade nets, drip, poly-houses, and cold storage — verify current rates at the official portal.",
            description=(
                "Promotes holistic growth of horticulture sector covering fruits, vegetables, "
                "root & tuber crops, aromatic & medicinal plants, and spices."
            ),
            matched_criteria=[f"Horticulture Crop Match: {crop.capitalize()}"],
            key_documents=["Land Records", "Planting Material Invoice", "Aadhaar", "Bank Passbook"],
            portal_url="https://midh.gov.in/",
            helpline="011-23382012",
        ))

    # 5. SMAM (Farm Machinery)
    if is_small_marginal:
        recommendations.append(_scheme(
            id_="smam",
            name="SMAM - Sub-Mission on Agricultural Mechanization",
            category="Farm Machinery & Equipment Subsidy",
            possible_benefit="Subsidy on tractors, power tillers, seed drills, harvesters & sprayers — verify current rates and eligible equipment at the official portal.",
            description=(
                "Increases reach of farm mechanization to small & marginal farmers. "
                "Supports establishment of Custom Hiring Centres (CHCs)."
            ),
            matched_criteria=[f"Small/Marginal Farmer Category (Area: {area_ha} Ha)"],
            key_documents=["Aadhaar", "Category Certificate (if SC/ST)", "Land Records", "Quotation from Dealer"],
            portal_url="https://agrimachinery.nic.in/",
            helpline="1800-180-1551",
        ))

    # 6. PM-KISAN (Direct Income Support)
    recommendations.append(_scheme(
        id_="pm-kisan",
        name="PM-KISAN Samman Nidhi (Direct Income Support)",
        category="Direct Cash Benefit",
        possible_benefit="Direct income support in annual installments — verify current benefit and eligibility at the official portal.",
        description=(
            "Direct income support to landholding farmer families to help procure agricultural "
            "inputs (seeds, fertilizers, fuel) and meet domestic needs."
        ),
        matched_criteria=["All Landholding Farmers (possibly eligible)"],
        key_documents=["Aadhaar Card", "e-KYC Verified Account", "Land RoR / Khata Number", "Bank Account linked with NPCI/Aadhaar"],
        portal_url="https://pmkisan.gov.in/",
        helpline="155261 / 011-24300606",
    ))

    # 7. KCC (Kisan Credit Card)
    recommendations.append(_scheme(
        id_="kcc",
        name="Kisan Credit Card (KCC — Concessional Agriculture Loan)",
        category="Low-Interest Crop Credit",
        possible_benefit="Concessional interest rate on short-term agriculture loans — verify current rate and terms with your bank or the official portal.",
        description=(
            "Provides timely credit to farmers for crop production expenses, post-harvest needs, "
            "working capital, and allied activities."
        ),
        matched_criteria=["Crop Production Credit Support"],
        key_documents=["Filled KCC Application Form", "Land Ownership / Lease Agreement", "Aadhaar & PAN", "2 Passport Photos"],
        portal_url="https://www.myscheme.gov.in/schemes/kcc",
        helpline="1800-11-0001",
    ))

    # 8. State-specific schemes
    if state and state.lower() in {"andhra pradesh", "telangana", "karnataka", "tamil nadu", "maharashtra", "punjab"}:
        state_schemes = {
            "andhra pradesh": ("YSR Rythu Bharosa", "Financial assistance to farmer families including tenant farmers — verify current benefit amounts at the official AP Agriculture portal."),
            "telangana": ("Rythu Bandhu & Rythu Bima", "Investment support and life insurance for farmers — verify current benefit amounts at the Telangana Agriculture portal."),
            "karnataka": ("Raitha Siri & Krishi Bhagya", "Financial aid for millets & farm ponds / diesel pump subsidies — verify current status with Karnataka Agriculture."),
            "tamil nadu": ("Kalaignar All Village Integrated Agricultural Development", "Possible micro-irrigation and seedling subsidies — verify at the Tamil Nadu Agriculture portal."),
            "maharashtra": ("Namo Shetkari Maha Samman Nidhi", "Possible state top-up to PM-KISAN — verify current status at the Maharashtra Agriculture portal."),
            "punjab": ("Pani Bachao, Paise Kamao", "Possible benefit transfer for electricity savings in pumpsets — verify at the Punjab Agriculture portal."),
        }
        name, desc = state_schemes.get(state.lower(), ("State Farmer Welfare Scheme", "State-specific agricultural input subsidy — verify at the state Agriculture portal."))
        recommendations.insert(0, _scheme(
            id_=f"state-{state.lower().replace(' ', '-')}",
            name=f"{state.title()} State Scheme — Possible Match: {name}",
            category=f"State Specific Scheme ({state.title()})",
            possible_benefit="State subsidy or income support — verify current benefit amounts and eligibility at the official state portal.",
            description=desc,
            matched_criteria=[f"State Match: {state.title()}"],
            key_documents=["State Residence Proof", "Aadhaar", "Land Records", "Bank Passbook"],
            portal_url="https://www.myscheme.gov.in/",
            helpline="1800-180-1551",
        ))

    return recommendations

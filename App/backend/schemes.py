"""
AgriFusion Backend — Government Schemes & Subsidies Recommendation Engine
Focused on Andhra Pradesh & Telangana Farmers (State & Central Schemes)

SAFETY NOTICE
=============
This module provides scheme matches to guide farmers in Andhra Pradesh & Telangana toward
official government resources. It does NOT confirm eligibility, verify benefit amounts,
or make legally binding recommendations.

All scheme details (subsidy percentages, income limits, document requirements)
are subject to change. Farmers MUST verify details directly at official portals or through
their local Village Agriculture Assistant (VAA) / Rythu Seva Kendra (RSK) in AP,
or Agricultural Extension Officer (AEO) / Rythu Vedika in Telangana.
"""

from typing import Any, Dict, List

_VERIFICATION_NOTICE = (
    "⚠️ Official verification required. Benefit amounts and rules may vary. "
    "Verify at official portals, Rythu Seva Kendra (AP), or Rythu Vedika (Telangana)."
)


def _scheme(
    *,
    id_: str,
    name: str,
    category: str,
    applicable_states: str,
    possible_benefit: str,
    description: str,
    matched_criteria: list,
    key_documents: list,
    portal_url: str,
    helpline: str,
) -> Dict[str, Any]:
    """Build a scheme dict with consistent safety and eligibility fields."""
    return {
        "id": id_,
        "name": name,
        "category": category,
        "applicable_states": applicable_states,
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
    Suggests Andhra Pradesh & Telangana State and Central Government schemes
    relevant to the farmer's location, crop, land size, and irrigation method.
    """
    state_input = str(data.get("state", "")).strip().lower()
    crop = str(data.get("crop", "")).strip().lower()
    area_ha = float(data.get("area_ha", 1.0))
    growth_stage = str(data.get("growth_stage", "Sowing")).strip().lower()
    solar_interest = bool(data.get("solar_interest", False))
    irrigation_type = str(data.get("irrigation_type", "Drip")).strip().lower()
    climate_risk_level = str(data.get("climate_risk_level", "Low")).strip().lower()
    farmer_category = str(data.get("farmer_category", "Small")).strip().lower()

    # Normalize state detection
    is_ap = "andhra" in state_input or state_input == "ap"
    is_ts = "telangana" in state_input or "ts" in state_input or "tg" in state_input

    horticulture_crops = {
        "banana", "mango", "papaya", "pomegranate", "grapes", "watermelon", "muskmelon",
        "apple", "orange", "chili", "chilli", "tomato", "potato", "onion", "brinjal",
        "coconut", "coffee", "tea", "turmeric", "oil palm"
    }

    is_small_marginal = area_ha <= 2.0 or farmer_category in {"small", "marginal", "sc/st", "women"}
    recommendations: List[Dict[str, Any]] = []

    # =========================================================================
    # 1. ANDHRA PRADESH STATE SCHEMES (Included if AP selected or general query)
    # =========================================================================
    if is_ap or not is_ts:
        # AP Rythu Bharosa / Annadata Sukhibhava
        recommendations.append(_scheme(
            id_="ap-rythu-bharosa",
            name="YSR Rythu Bharosa / Annadata Sukhibhava (AP State Scheme)",
            category="State Financial Support & Input Subsidy",
            applicable_states="Andhra Pradesh",
            possible_benefit="Financial assistance of ₹13,500/year (verify details at official portal) to landowning & tenant farmer families in AP (includes PM-KISAN ₹6,000 central share + ₹7,500 AP State share).",
            description=(
                "Annual direct benefit transfer to farmer families in Andhra Pradesh to meet "
                "cost of cultivation, seeds, fertilizers, and farm labor expenses before sowing season."
            ),
            matched_criteria=["Location: Andhra Pradesh", "Landholding / Recognized Tenant Farmer"],
            key_documents=[
                "Aadhaar Card",
                "AP Land Pattadar Passbook / 1B Adangal or CCRC (Cultivator Rights Certificate for Tenants)",
                "Bank Account linked with NPCI / Aadhaar",
                "e-KYC Verification at Rythu Seva Kendra (RSK)"
            ],
            portal_url="https://rythubharosa.ap.gov.in/",
            helpline="155251 (AP Farmer Toll-Free)",
        ))

        # AP Free Crop Insurance (YSR Free Crop Insurance)
        recommendations.append(_scheme(
            id_="ap-free-crop-insurance",
            name="YSR Free Crop Insurance Scheme (AP Zero-Cost Insurance)",
            category="State Risk Protection & Free Insurance",
            applicable_states="Andhra Pradesh",
            possible_benefit="100% State Premium Subsidy (Zero premium cost to AP farmers for notified crops booked on e-Crop portal).",
            description=(
                "Andhra Pradesh government pays the complete crop insurance premium on behalf of farmers. "
                "Enrollment is automatic when crop booking is completed on the state e-Crop portal."
            ),
            matched_criteria=["Location: Andhra Pradesh", f"Notified Crop Enrollment: {crop.capitalize()}"],
            key_documents=[
                "e-Crop Booking Registration at Village Agriculture Assistant (VAA) office",
                "Aadhaar Card",
                "Bank Account Details",
                "Pattadar Passbook / Adangal"
            ],
            portal_url="https://karshak.ap.gov.in/",
            helpline="155251",
        ))

        # APMIP - Micro Irrigation Subsidies
        if "drip" in irrigation_type or "sprinkler" in irrigation_type or area_ha >= 0.5:
            recommendations.append(_scheme(
                id_="apmip-micro-irrigation",
                name="APMIP — Andhra Pradesh Micro Irrigation Project",
                category="State Drip & Sprinkler Subsidy",
                applicable_states="Andhra Pradesh",
                possible_benefit="Up to 90% subsidy for Small & Marginal farmers (up to 5 acres) and 80% for other farmers on Drip & Sprinkler systems.",
                description=(
                    "State initiative in AP to promote water conservation. Provides complete micro-irrigation "
                    "kits including drippers, lateral pipes, filters, and fertigation tanks."
                ),
                matched_criteria=["Location: Andhra Pradesh", f"Irrigation Type: {irrigation_type.capitalize()}"],
                key_documents=[
                    "Land 1B Adangal Copy",
                    "Aadhaar Card",
                    "Soil & Water Test Clearance Report",
                    "Borewell/Well Electricity Connection Bill"
                ],
                portal_url="http://apmip.ap.gov.in/",
                helpline="1800-425-2969",
            ))

    # =========================================================================
    # 2. TELANGANA STATE SCHEMES (Included if TS selected or general query)
    # =========================================================================
    if is_ts or not is_ap:
        # Telangana Rythu Bharosa / Rythu Bandhu
        recommendations.append(_scheme(
            id_="ts-rythu-bharosa",
            name="Telangana Rythu Bharosa / Rythu Bandhu (TS State Scheme)",
            category="State Direct Investment Support",
            applicable_states="Telangana",
            possible_benefit="Financial investment support deposited directly into farmer bank accounts per acre per season for Kharif & Rabi crops.",
            description=(
                "Pioneering direct cash transfer scheme in Telangana to purchase agricultural inputs "
                "such as high-yield seeds, fertilizers, pesticides, and labor charges."
            ),
            matched_criteria=["Location: Telangana", f"Land Area: {area_ha} Ha"],
            key_documents=[
                "Telangana Pattadar Passbook (Dharani Portal Record)",
                "Aadhaar Card",
                "Bank Passbook linked with Aadhaar",
                "VAA / AEO Registration Confirmation"
            ],
            portal_url="https://dharani.telangana.gov.in/",
            helpline="1800-425-2910 (TS Agriculture Dept)",
        ))

        # Telangana Rythu Bima (Life Insurance for Farmers)
        recommendations.append(_scheme(
            id_="ts-rythu-bima",
            name="Rythu Bima — Telangana Farmers Group Life Insurance Scheme",
            category="State Social Security & Life Insurance",
            applicable_states="Telangana",
            possible_benefit="₹5.00 Lakh free life insurance cover (verify details at official portal) for landowning farmers aged 18 to 59 years. 100% premium paid by TS Government.",
            description=(
                "Provides financial relief and social security to family members of deceased farmers in Telangana. "
                "Claim amount of ₹5 Lakh is credited to the nominee's account within 10 days of claim submission."
            ),
            matched_criteria=["Location: Telangana", "Landowning Farmer (Age 18-59)"],
            key_documents=[
                "Pattadar Passbook in Dharani Portal",
                "Aadhaar Card of Farmer & Nominee",
                "Rythu Bima Enrollment Form (filed at Rythu Vedika)",
                "Nominee Bank Account Details"
            ],
            portal_url="https://rythubima.telangana.gov.in/",
            helpline="1800-425-2910",
        ))

        # Telangana Micro Irrigation Project (TMIP)
        if "drip" in irrigation_type or "sprinkler" in irrigation_type or area_ha >= 0.5:
            recommendations.append(_scheme(
                id_="tmip-micro-irrigation",
                name="TMIP — Telangana Micro Irrigation Project",
                category="State Micro-Irrigation Subsidy",
                applicable_states="Telangana",
                possible_benefit="80% to 100% subsidy on drip and sprinkler irrigation equipment for SC/ST, Small & Marginal farmers in Telangana.",
                description=(
                    "Promotes efficient water usage in Telangana's drought-prone districts. "
                    "Covers drip installation for commercial, horticulture, and field crops."
                ),
                matched_criteria=["Location: Telangana", f"Irrigation Type: {irrigation_type.capitalize()}"],
                key_documents=[
                    "Dharani Pattadar Passbook Copy",
                    "Aadhaar Card",
                    "Caste Certificate (for 100% SC/ST Subsidy)",
                    "Soil & Water Test Report"
                ],
                portal_url="https://horticulture.telangana.gov.in/",
                helpline="040-23222221",
            ))

    # =========================================================================
    # 3. CENTRAL SCHEMES (Applicable to both AP & Telangana Farmers)
    # =========================================================================

    # PM-KISAN (Direct Income Support)
    recommendations.append(_scheme(
        id_="pm-kisan",
        name="PM-KISAN Samman Nidhi (Central Income Support)",
        category="Central Direct Cash Transfer",
        applicable_states="All India (Active in AP & Telangana)",
        possible_benefit="₹6,000 per year (verify details at official portal) paid in 3 equal installments of ₹2,000 directly into bank accounts.",
        description=(
            "Central government scheme providing supplemental income support to landholding farmer families "
            "across AP and Telangana to procure farm inputs."
        ),
        matched_criteria=["Landholding Farmer Family in AP / Telangana"],
        key_documents=[
            "Aadhaar Card",
            "e-KYC Verification (via PM-KISAN Portal or CSC)",
            "Land Pattadar Passbook / Khata RoR Record",
            "Aadhaar-NPCI Seeded Bank Account"
        ],
        portal_url="https://pmkisan.gov.in/",
        helpline="155261 / 011-24300606",
    ))

    # PM-KUSUM (Solar Irrigation Pumps)
    if solar_interest or "borewell" in irrigation_type or "drip" in irrigation_type:
        recommendations.append(_scheme(
            id_="pm-kusum",
            name="PM-KUSUM Scheme (Solar Irrigation Pump Subsidy)",
            category="Renewable Energy & Solar Pumps",
            applicable_states="AP (via NREDCAP/APDISCOM) & TS (via TSREDCO/TSDISCOM)",
            possible_benefit="Up to 60% combined Central & State subsidy on standalone solar agriculture pumps (3 HP, 5 HP, 7.5 HP & 10 HP).",
            description=(
                "Financial aid to replace diesel pumpsets with solar pumps or solarize existing grid pumps. "
                "Farmers can sell extra solar electricity back to AP Transco / TSDISCOM."
            ),
            matched_criteria=["Interest in Solar Pump / Renewable Energy", f"Land Area: {area_ha} Ha"],
            key_documents=[
                "Aadhaar Card",
                "Land Pattadar Passbook / 1B Adangal / Pahani",
                "DISCOM Electricity No-Objection Certificate (NOC)",
                "Bank Passbook"
            ],
            portal_url="https://pmkusum.mnre.gov.in/",
            helpline="1800-180-3333",
        ))

    # PMFBY (Pradhan Mantri Fasal Bima Yojana)
    if climate_risk_level in {"high", "moderate"} or growth_stage in {"sowing", "vegetative"}:
        risk_tag = "High Climate Risk Alert Detected" if climate_risk_level == "high" else "Seasonal Risk Protection"
        recommendations.append(_scheme(
            id_="pmfby",
            name="PMFBY — Pradhan Mantri Fasal Bima Yojana",
            category="Central Crop Insurance",
            applicable_states="Active in AP & Telangana",
            possible_benefit="Subsidy on insurance premium (Farmers pay only 1.5% for Rabi, 2% for Kharif, 5% for Commercial/Horticulture crops).",
            description=(
                "Comprehensive coverage against crop failure due to droughts, floods, dry spells, "
                "cyclones, pest attacks, and post-harvest losses."
            ),
            matched_criteria=[risk_tag, f"Crop: {crop.capitalize()}"],
            key_documents=[
                "Crop Sowing Certificate / e-Crop Registration Copy",
                "Aadhaar Card",
                "Land Pattadar Passbook (RoR)",
                "Bank Account Details"
            ],
            portal_url="https://pmfby.gov.in/",
            helpline="1800-180-1551",
        ))

    # Kisan Credit Card (KCC)
    recommendations.append(_scheme(
        id_="kcc",
        name="Kisan Credit Card (KCC — Low-Interest Crop Credit)",
        category="Concessional Agriculture Credit",
        applicable_states="All Banks in AP & Telangana",
        possible_benefit="Short-term crop production loan at 4% effective interest rate (with 3% prompt repayment incentive). Loan up to ₹3 Lakhs without collateral (verify details at bank portal).",
        description=(
            "Provides timely revolving credit to farmers in AP & TS for purchasing seeds, fertilizers, "
            "pesticides, paying labor, and meeting post-harvest expenses."
        ),
        matched_criteria=["Agriculture Credit & Working Capital Need"],
        key_documents=[
            "Filled KCC Application Form",
            "Pattadar Passbook / Land Ownership Record / Tenancy Deed",
            "Aadhaar Card & PAN Card",
            "2 Passport Size Photographs"
        ],
        portal_url="https://www.myscheme.gov.in/schemes/kcc",
        helpline="1800-11-0001",
    ))

    # MIDH (Mission for Integrated Development of Horticulture)
    if crop in horticulture_crops:
        recommendations.append(_scheme(
            id_="midh",
            name="MIDH — Mission for Integrated Development of Horticulture",
            category="Horticulture Subsidy & Infrastructure",
            applicable_states="AP Department of Horticulture & TS Horticulture Dept",
            possible_benefit="40% to 50% subsidy for high-density fruit orchards, polyhouses, shade nets, cold storages, and pack houses.",
            description=(
                "Financial assistance for horticulture crops popular in AP & Telangana (Mango, Citrus, Papaya, "
                "Banana, Chili, Tomato, Spices, and Flowers)."
            ),
            matched_criteria=[f"Horticulture Crop Match: {crop.capitalize()}"],
            key_documents=[
                "Land Ownership Document (Passbook)",
                "Planting Material / Nursery Invoice from Recognized Nursery",
                "Aadhaar Card",
                "Bank Account Details"
            ],
            portal_url="https://midh.gov.in/",
            helpline="011-23382012",
        ))

    # SMAM (Sub-Mission on Agricultural Mechanization)
    if is_small_marginal:
        recommendations.append(_scheme(
            id_="smam",
            name="SMAM — Agricultural Machinery & Equipment Subsidy",
            category="Farm Mechanization Subsidy",
            applicable_states="Implemented via RSK (AP) & Custom Hiring Centres (TS)",
            possible_benefit="40% to 50% subsidy on purchasing tractors, power tillers, rotavators, sprayers, and harvesters for small & marginal farmers.",
            description=(
                "Promotes farm mechanization among small landholders. Implemented through Rythu Seva Kendras (RSK) "
                "in Andhra Pradesh and Custom Hiring Centres (CHCs) in Telangana."
            ),
            matched_criteria=[f"Small/Marginal Farmer Category (Area: {area_ha} Ha)"],
            key_documents=[
                "Aadhaar Card",
                "Category Certificate (if SC/ST for higher subsidy)",
                "Pattadar Passbook Record",
                "Official Price Quotation from Authorized Equipment Dealer"
            ],
            portal_url="https://agrimachinery.nic.in/",
            helpline="1800-180-1551",
        ))

    return recommendations

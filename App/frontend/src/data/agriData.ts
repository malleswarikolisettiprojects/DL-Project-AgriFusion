/**
 * Regional Agricultural Reference Data
 * Andhra Pradesh and Telangana Focus
 */

export interface LocationState {
  name: string;
  districts: string[];
}

export const STATES_AND_DISTRICTS: LocationState[] = [
  {
    name: 'Andhra Pradesh',
    districts: [
      'Visakhapatnam',
      'Anakapalle',
      'Alluri Sitharama Raju',
      'Kakinada',
      'East Godavari',
      'Dr. B.R. Ambedkar Konaseema',
      'West Godavari',
      'Eluru',
      'Krishna',
      'NTR',
      'Guntur',
      'Bapatla',
      'Palnadu',
      'Prakasam',
      'Sri Potti Sriramulu Nellore',
      'Kurnool',
      'Nandyal',
      'Ananthapuramu',
      'Sri Sathya Sai',
      'YSR Kadapa',
      'Annamayya',
      'Chittoor',
      'Tirupati',
      'Srikakulam',
      'Vizianagaram',
      'Parvathipuram Manyam',
    ],
  },
  {
    name: 'Telangana',
    districts: [
      'Adilabad',
      'Bhadradri Kothagudem',
      'Hanamkonda',
      'Hyderabad',
      'Jagtial',
      'Jangaon',
      'Jayashankar Bhupalpally',
      'Jogulamba Gadwal',
      'Kamareddy',
      'Karimnagar',
      'Khammam',
      'Kumuram Bheem Asifabad',
      'Mahabubabad',
      'Mahabubnagar',
      'Mancherial',
      'Medak',
      'Medchal-Malkajgiri',
      'Mulugu',
      'Nagarkurnool',
      'Nalgonda',
      'Narayanpet',
      'Nirmal',
      'Nizamabad',
      'Peddapalli',
      'Rajanna Sircilla',
      'Ranga Reddy',
      'Sangareddy',
      'Siddipet',
      'Suryapet',
      'Vikarabad',
      'Wanaparthy',
      'Warangal',
      'Yadadri Bhuvanagiri',
    ],
  },
];

export const COMMON_CROPS = [
  'Rice',
  'Cotton',
  'Maize',
  'Chilli',
  'Groundnut',
  'Sugarcane',
  'Red Gram (Tur)',
  'Bengal Gram (Chickpea)',
  'Soybean',
  'Turmeric',
  'Mango',
  'Papaya',
  'Banana',
  'Tomato',
  'Tobacco',
];

export const CROP_MSP_BENCHMARKS: Record<string, number> = {
  Rice: 2320,
  Cotton: 7121,
  Maize: 2090,
  Chilli: 16500,
  Groundnut: 6377,
  Sugarcane: 340,
  'Red Gram (Tur)': 7550,
  'Bengal Gram (Chickpea)': 5440,
  Soybean: 4892,
  Turmeric: 11200,
  Tomato: 1800,
  Tobacco: 12500,
  'Black Gram Dal(Urd Dal)': 7400,
};


export const SEASONS = ['Kharif', 'Rabi', 'Zaid', 'Whole Year'];

export const GROWTH_STAGES = [
  'Sowing / Transplanting',
  'Vegetative Growth',
  'Flowering',
  'Grain/Fruit Formation',
  'Maturity / Pre-Harvest',
];

export const IRRIGATION_TYPES = [
  'Drip Irrigation',
  'Sprinkler',
  'Canal / Furrow',
  'Borewell / Tube Well',
  'Rainfed',
];

export const FARMER_CATEGORIES = [
  'Marginal (< 1 Hectare)',
  'Small (1 - 2 Hectares)',
  'Semi-Medium (2 - 4 Hectares)',
  'Medium (4 - 10 Hectares)',
  'Large (> 10 Hectares)',
];

export interface VerifiedScheme {
  id: string;
  name: string;
  category: 'Central' | 'State';
  sponsoring_body: string;
  benefits: string;
  eligibility: string;
  required_documents: string[];
  official_portal_url: string;
  helpline: string;
}

export const GOVERNMENT_SCHEMES_CATALOG: VerifiedScheme[] = [
  {
    id: 'pm-kisan',
    name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
    category: 'Central',
    sponsoring_body: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
    benefits: '₹6,000 per year directly transferred to bank accounts in three equal installments of ₹2,000.',
    eligibility: 'All landholding farmer families with cultivable land, subject to exclusion criteria (institutional holders, income tax payees).',
    required_documents: ['Aadhaar Card', 'Land Record (Pattadar Passbook / RoR-1B)', 'Aadhaar-seeded Bank Account'],
    official_portal_url: 'https://pmkisan.gov.in',
    helpline: '155261 / 011-24300606',
  },
  {
    id: 'pm-kusum',
    name: 'PM-KUSUM (Component B & C Solar Pump Subsidies)',
    category: 'Central',
    sponsoring_body: 'Ministry of New and Renewable Energy (MNRE)',
    benefits: 'Up to 60% capital subsidy for standalone solar agriculture pumps (up to 7.5 HP) and solarization of grid-connected pumps.',
    eligibility: 'Individual farmers, farmer groups, cooperatives with valid water source and grid connection status.',
    required_documents: ['Pattadar Passbook', 'Water source verification certificate', 'Electricity DISCOM bill', 'Aadhaar & Bank details'],
    official_portal_url: 'https://pmkusum.mnre.gov.in',
    helpline: '1800-180-3333',
  },
  {
    id: 'pmfby',
    name: 'PMFBY (Pradhan Mantri Fasal Bima Yojana)',
    category: 'Central',
    sponsoring_body: 'Department of Agriculture & Farmers Welfare, GoI',
    benefits: 'Comprehensive crop insurance against non-preventable natural risks from pre-sowing to post-harvest. Farmer premium capped at 2% for Kharif, 1.5% for Rabi.',
    eligibility: 'All farmers cultivating notified crops in notified areas (loanee and non-loanee, sharecroppers/tenant farmers with eligible documentation).',
    required_documents: ['Land record certificate / CCRC card for tenants', 'Sowing certificate from VAA/AEO', 'Bank passbook copy', 'Aadhaar'],
    official_portal_url: 'https://pmfby.gov.in',
    helpline: '1800-180-1551',
  },
  {
    id: 'rythu-bharosa-ap',
    name: 'YSR Rythu Bharosa / Annadata Sukhibhava (Andhra Pradesh)',
    category: 'State',
    sponsoring_body: 'Department of Agriculture, Govt of Andhra Pradesh',
    benefits: 'Annual financial assistance for input purchase and farm investment provided directly to eligible landowning and tenant farmers.',
    eligibility: 'Resident farmers in Andhra Pradesh with registered land or verified Crop Cultivator Rights Card (CCRC) tenant status.',
    required_documents: ['Aadhaar', 'AP e-Crop (e-Panta) registration', 'Pattadar passbook or CCRC Agreement', 'Active Bank Account'],
    official_portal_url: 'https://ysrrythubharosa.ap.gov.in',
    helpline: '1907 (Toll Free RBK)',
  },
  {
    id: 'rythu-bandhu-ts',
    name: 'Rythu Bandhu / Rythu Bharosa (Telangana)',
    category: 'State',
    sponsoring_body: 'Department of Agriculture, Govt of Telangana',
    benefits: 'Investment support per acre per season for agriculture and horticulture crops paid directly to Pattadar farmers.',
    eligibility: 'Landholding farmers with Dharani digital Pattadar passbooks in Telangana.',
    required_documents: ['Dharani Passbook Number', 'Aadhaar Card', 'Bank Account details linked with IFSC'],
    official_portal_url: 'https://rythubandhu.telangana.gov.in',
    helpline: '1800-425-4033',
  },
  {
    id: 'micro-irrigation-apmilma',
    name: 'APMIP Micro-Irrigation Subsidy (Drip & Sprinkler)',
    category: 'State',
    sponsoring_body: 'Andhra Pradesh Micro Irrigation Project (APMIP)',
    benefits: 'Up to 90% subsidy for SC/ST and small/marginal farmers for installing drip and sprinkler systems.',
    eligibility: 'Farmers having cultivable land with assured water source (borewell/open well/canal).',
    required_documents: ['Pattadar Passbook', 'Adangal / RoR 1B', 'Water/Electricity connection certificate', 'Soil & Water test report'],
    official_portal_url: 'https://apmip.ap.gov.in',
    helpline: '0863-2211907',
  },
];


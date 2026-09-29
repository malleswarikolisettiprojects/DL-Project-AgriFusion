export interface CropVisualInfo {
  image: string;
  subtitle: string;
  duration: string;
  seasonInfo: string;
  category?: 'Cereal' | 'Commercial' | 'Pulse' | 'Oilseed' | 'Spice' | 'Horticulture' | 'Fruit';
  typicalYield?: string;
  localTelugu?: string;
  localHindi?: string;
}

export const CROP_VISUALS: Record<string, CropVisualInfo> = {
  Rice: {
    image: '/crops/rice.jpg',
    subtitle: 'Paddy / Rice',
    duration: '120 - 140 Days',
    seasonInfo: 'Kharif & Rabi water-intensive staple',
    category: 'Cereal',
    typicalYield: '22 - 30 Quintals/Acre',
    localTelugu: 'వరి (ధాన్యం)',
    localHindi: 'चावल / धान',
  },
  Cotton: {
    image: '/crops/cotton.jpg',
    subtitle: 'Cotton',
    duration: '150 - 180 Days',
    seasonInfo: 'Kharif black soil cash crop',
    category: 'Commercial',
    typicalYield: '10 - 15 Quintals/Acre',
    localTelugu: 'పత్తి',
    localHindi: 'कपास',
  },
  Maize: {
    image: '/crops/maize.jpg',
    subtitle: 'Maize / Corn',
    duration: '100 - 115 Days',
    seasonInfo: 'High biomass grain & poultry feed',
    category: 'Cereal',
    typicalYield: '28 - 36 Quintals/Acre',
    localTelugu: 'మొక్కజొన్న',
    localHindi: 'मक्का',
  },
  Chilli: {
    image: '/crops/chilli.jpg',
    subtitle: 'Red Chilli',
    duration: '150 - 180 Days',
    seasonInfo: 'High-value commercial spice',
    category: 'Spice',
    typicalYield: '18 - 25 Quintals/Acre (Dry)',
    localTelugu: 'ఎర్ర మిర్చి',
    localHindi: 'लाल मिर्च',
  },
  Groundnut: {
    image: '/crops/groundnut.jpg',
    subtitle: 'Groundnut / Peanuts',
    duration: '105 - 120 Days',
    seasonInfo: 'Oilseed suitable for red sandy soils',
    category: 'Oilseed',
    typicalYield: '14 - 20 Quintals/Acre',
    localTelugu: 'వేరుశనగ (పల్లీలు)',
    localHindi: 'मूंगफली',
  },
  Sugarcane: {
    image: '/crops/sugarcane.jpg',
    subtitle: 'Sugarcane',
    duration: '10 - 12 Months',
    seasonInfo: 'Annual perennial sugar crop',
    category: 'Commercial',
    typicalYield: '40 - 55 Tonnes/Acre',
    localTelugu: 'చెరకు',
    localHindi: 'गन्ना',
  },
  'Red Gram (Tur)': {
    image: '/crops/red_gram.jpg',
    subtitle: 'Red Gram / Toor Dal',
    duration: '150 - 180 Days',
    seasonInfo: 'Nitrogen-fixing drought hardy pulse',
    category: 'Pulse',
    typicalYield: '7 - 11 Quintals/Acre',
    localTelugu: 'కందులు (తొగరి)',
    localHindi: 'अरहर / तुअर',
  },
  'Bengal Gram (Chickpea)': {
    image: '/crops/bengal_gram.jpg',
    subtitle: 'Bengal Gram / Chana',
    duration: '90 - 105 Days',
    seasonInfo: 'Post-monsoon Rabi pulse crop',
    category: 'Pulse',
    typicalYield: '8 - 12 Quintals/Acre',
    localTelugu: 'శనగలు',
    localHindi: 'चना',
  },
  Soybean: {
    image: '/crops/soybean.jpg',
    subtitle: 'Soybean',
    duration: '95 - 105 Days',
    seasonInfo: 'High-protein Kharif oilseed',
    category: 'Oilseed',
    typicalYield: '10 - 14 Quintals/Acre',
    localTelugu: 'సోయాబీన్',
    localHindi: 'सोयाबीन',
  },
  Turmeric: {
    image: '/crops/turmeric.jpg',
    subtitle: 'Turmeric',
    duration: '8 - 9 Months',
    seasonInfo: 'Traditional medicinal spice crop',
    category: 'Spice',
    typicalYield: '22 - 28 Quintals/Acre',
    localTelugu: 'పసుపు',
    localHindi: 'हल्दी',
  },
  Tomato: {
    image: '/crops/tomato.jpg',
    subtitle: 'Tomato',
    duration: '90 - 120 Days',
    seasonInfo: 'Multi-pick horticulture vegetable',
    category: 'Horticulture',
    typicalYield: '120 - 180 Quintals/Acre',
    localTelugu: 'టమాటా',
    localHindi: 'टमाटर',
  },
  Mango: {
    image: '/crops/mango.jpg',
    subtitle: 'Mango Orchard',
    duration: 'Perennial Orchard',
    seasonInfo: 'Tropical fruit orchard crop',
    category: 'Fruit',
    typicalYield: '35 - 50 Quintals/Acre (Mature)',
    localTelugu: 'మామిడి',
    localHindi: 'आम',
  },
  Papaya: {
    image: '/crops/papaya.jpg',
    subtitle: 'Papaya',
    duration: '9 - 12 Months',
    seasonInfo: 'Fast growing tropical horticulture fruit',
    category: 'Fruit',
    typicalYield: '150 - 200 Quintals/Acre',
    localTelugu: 'బొప్పాయి',
    localHindi: 'पपीता',
  },
  Banana: {
    image: '/crops/banana.jpg',
    subtitle: 'Banana',
    duration: '11 - 13 Months',
    seasonInfo: 'High moisture demanding commercial fruit',
    category: 'Fruit',
    typicalYield: '180 - 240 Quintals/Acre',
    localTelugu: 'అరటి',
    localHindi: 'केला',
  },
  Tobacco: {
    image: '/crops/tobacco.jpg',
    subtitle: 'Tobacco (FCV)',
    duration: '110 - 130 Days',
    seasonInfo: 'Commercial cash crop in coastal AP',
    category: 'Commercial',
    typicalYield: '7 - 10 Quintals/Acre',
    localTelugu: 'పొగాకు',
    localHindi: 'तंबाकू',
  },
  'Black Gram Dal(Urd Dal)': {
    image: '/crops/black_gram.jpg',
    subtitle: 'Black Gram / Urad Dal',
    duration: '75 - 85 Days',
    seasonInfo: 'Short duration relay pulse crop',
    category: 'Pulse',
    typicalYield: '5 - 8 Quintals/Acre',
    localTelugu: 'మినుములు (ఉద్ది)',
    localHindi: 'उड़द',
  },
};

// Farming activity photographs for cost heads
export const EXPENSE_IMAGES: Record<string, string> = {
  seeds: '/expenses/seeds.jpg',
  fertilizers: '/expenses/fertilizers.jpg',
  cropProtection: '/expenses/cropProtection.jpg',
  irrigationEnergy: '/expenses/irrigationEnergy.jpg',
  machinery: '/expenses/machinery.jpg',
  labor: '/expenses/labor.jpg',
  miscInsurance: '/expenses/miscInsurance.jpg',
};

// Helper to get crop image with fuzzy matching
export function getCropVisual(cropName?: string): CropVisualInfo {
  if (!cropName) return CROP_VISUALS.Rice;
  if (CROP_VISUALS[cropName]) return CROP_VISUALS[cropName];

  const lower = cropName.toLowerCase().trim();
  for (const [k, v] of Object.entries(CROP_VISUALS)) {
    if (lower === k.toLowerCase() || lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)) {
      return v;
    }
  }

  if (lower.includes('paddy') || lower.includes('rice')) return CROP_VISUALS.Rice;
  if (lower.includes('peanut') || lower.includes('groundnut')) return CROP_VISUALS.Groundnut;
  if (lower.includes('cane') || lower.includes('sugar')) return CROP_VISUALS.Sugarcane;
  if (lower.includes('chana') || lower.includes('chickpea')) return CROP_VISUALS['Bengal Gram (Chickpea)'];
  if (lower.includes('tur') || lower.includes('arhar') || lower.includes('pigeon')) return CROP_VISUALS['Red Gram (Tur)'];
  if (lower.includes('urad') || lower.includes('black gram')) return CROP_VISUALS['Black Gram Dal(Urd Dal)'];
  if (lower.includes('corn') || lower.includes('maize')) return CROP_VISUALS.Maize;
  if (lower.includes('cotton')) return CROP_VISUALS.Cotton;
  if (lower.includes('chilli') || lower.includes('chili')) return CROP_VISUALS.Chilli;
  if (lower.includes('soy')) return CROP_VISUALS.Soybean;
  if (lower.includes('haldi') || lower.includes('turmeric')) return CROP_VISUALS.Turmeric;
  if (lower.includes('tomato')) return CROP_VISUALS.Tomato;
  if (lower.includes('mango')) return CROP_VISUALS.Mango;
  if (lower.includes('papaya')) return CROP_VISUALS.Papaya;
  if (lower.includes('banana')) return CROP_VISUALS.Banana;
  if (lower.includes('tobacco')) return CROP_VISUALS.Tobacco;

  return CROP_VISUALS.Rice;
}

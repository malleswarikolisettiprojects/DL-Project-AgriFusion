/**
 * Local Farm State and Prediction History Storage
 * Aggregates all farmer runs, activities, and monthly summaries
 */

export interface SavedPrediction {
  id: string;
  category: 'crop' | 'climate' | 'irrigation' | 'yield' | 'market' | 'disease' | 'pipeline' | 'schemes' | 'advisory';
  title: string;
  summary: string;
  details: Record<string, unknown>;
  timestamp: string;
  badge: string;
}

export interface FarmActivityItem {
  id: string;
  title: string;
  category: 'irrigation' | 'fertilizer' | 'pest_scout' | 'weeding' | 'sowing' | 'harvest';
  date: string;
  completed: boolean;
  notes?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'all_day';
  durationHours?: number;
  areaCovered?: string;
}

export interface MonthlyFarmSummary {
  monthName: string;
  seasonPhase: string;
  estimatedWaterLiters: number;
  completedIrrigationHours: number;
  projectedYieldQuintals: number;
  estimatedRevenueInr: number;
  healthStatus: 'Excellent' | 'Good' | 'Attention Needed';
  keyActionItems: string[];
}

const PREDICTIONS_KEY = 'agrifusion_farmer_predictions_v2';
const ACTIVITIES_KEY = 'agrifusion_farmer_activities_v2';

const DEFAULT_PREDICTIONS: SavedPrediction[] = [
  {
    id: 'pred-1',
    category: 'crop',
    title: 'Crop Recommendation',
    summary: 'Black Gram Dal (Urd Dal) recommended with 54.9% confidence. High Kharif suitability.',
    details: {
      crop: 'Black Gram Dal(Urd Dal)',
      confidence: '54.91%',
      season: 'Kharif',
      soil: 'Loam Soil, pH 6.5',
    },
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    badge: 'High Suitability',
  },
  {
    id: 'pred-2',
    category: 'irrigation',
    title: 'Multi-Method Irrigation Plan',
    summary: '14.5 mm crop water demand. Drip: 2.1 hrs/day (saves 52% water). Flood: 4.8 hrs/day.',
    details: {
      predicted_mm: '14.52 mm',
      drip_hours: '2.1 hrs (5HP)',
      sprinkler_hours: '2.8 hrs',
      flood_hours: '4.8 hrs',
      frequency: 'Every 2 days',
    },
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    badge: 'Drip Optimal',
  },
  {
    id: 'pred-3',
    category: 'market',
    title: 'Agmarknet Market Forecast',
    summary: 'Rice modal price projected at ₹2,420 / Quintal. Trend is stable with rising festival demand.',
    details: {
      commodity: 'Rice',
      modal_price: '₹2,420 / Q',
      min_price: '₹2,150 / Q',
      max_price: '₹2,680 / Q',
      trend: 'Bullish / Stable',
    },
    timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
    badge: '₹2,420 / Q',
  },
  {
    id: 'pred-4',
    category: 'climate',
    title: 'Climate Risk Evaluation',
    summary: 'Low Climate Risk (Score 0.0). Normal monsoon rainfall expected for Coastal AP.',
    details: {
      risk_level: 'Low',
      monsoon_status: 'Normal to Above Normal',
      temperature_range: '24°C - 33°C',
    },
    timestamp: new Date(Date.now() - 3600000 * 72).toISOString(),
    badge: 'Low Risk',
  },
];

const DEFAULT_ACTIVITIES: FarmActivityItem[] = [
  {
    id: 'act-1',
    title: 'Drip Irrigation Session (Zone A & B)',
    category: 'irrigation',
    date: '2026-09-18',
    completed: true,
    timeOfDay: 'morning',
    durationHours: 2.5,
    areaCovered: 'Zone A & B (2.5 Acres)',
    notes: 'Ran 2.5 hours in the morning before peak sun. Lateral pressure checked at 1.2 kg/cm².',
  },
  {
    id: 'act-2',
    title: 'Top Dressing Nitrogen (Neem Coated Urea)',
    category: 'fertilizer',
    date: '2026-09-19',
    completed: true,
    timeOfDay: 'afternoon',
    durationHours: 2.0,
    areaCovered: 'Tillering Plot 1 (2.0 Acres)',
    notes: 'Applied 25 kg/acre during active tillering stage. Dry soil broadcast followed by light wetting.',
  },
  {
    id: 'act-3',
    title: 'Scout for Yellow Stem Borer & Leaf Blast',
    category: 'pest_scout',
    date: '2026-09-21',
    completed: false,
    timeOfDay: 'morning',
    durationHours: 1.5,
    areaCovered: 'Paddy Field (Zone A & B • 2.5 Acres)',
    notes: 'Install 4 pheromone traps per acre if dead hearts exceed 5%. Morning walk across zig-zag pattern.',
  },
  {
    id: 'act-4',
    title: 'Drain excess runoff from field corners',
    category: 'weeding',
    date: '2026-09-23',
    completed: false,
    timeOfDay: 'all_day',
    durationHours: 3.5,
    areaCovered: 'Field Corners & Drainage Bunds',
    notes: 'Ensure water stagnation does not exceed 3 cm during root development.',
  },
  {
    id: 'act-5',
    title: 'Apply Zinc Sulphate micro-nutrient spray',
    category: 'fertilizer',
    date: '2026-09-26',
    completed: false,
    timeOfDay: 'evening',
    durationHours: 2.0,
    areaCovered: 'Plot 2 (3.0 Acres)',
    notes: '0.2% ZnSO4 solution to prevent Khaira disease symptoms. Evening spraying protects pollinators.',
  },
];

let inMemoryPredictions: SavedPrediction[] = [...DEFAULT_PREDICTIONS];
let inMemoryActivities: FarmActivityItem[] = [...DEFAULT_ACTIVITIES];

export function getSavedPredictions(): SavedPrediction[] {
  return inMemoryPredictions;
}

export function savePrediction(pred: Omit<SavedPrediction, 'id' | 'timestamp'>): SavedPrediction {
  const newEntry: SavedPrediction = {
    ...pred,
    id: `pred-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
  inMemoryPredictions = [newEntry, ...inMemoryPredictions.slice(0, 30)];
  return newEntry;
}

export function getFarmActivities(): FarmActivityItem[] {
  return inMemoryActivities;
}

export function toggleFarmActivity(id: string): FarmActivityItem[] {
  inMemoryActivities = inMemoryActivities.map((item) =>
    item.id === id ? { ...item, completed: !item.completed } : item
  );
  return inMemoryActivities;
}

export function addFarmActivity(activity: Omit<FarmActivityItem, 'id'>): FarmActivityItem[] {
  const newEntry: FarmActivityItem = {
    ...activity,
    id: `act-${Date.now()}`,
  };
  inMemoryActivities = [newEntry, ...inMemoryActivities];
  return inMemoryActivities;
}

export function deleteFarmActivity(id: string): FarmActivityItem[] {
  inMemoryActivities = inMemoryActivities.filter((item) => item.id !== id);
  return inMemoryActivities;
}

export function calculateMonthlySummary(areaHa = 2): MonthlyFarmSummary {
  const acres = areaHa * 2.471;
  const waterLiters = Math.round(acres * 14500 * 30); // ~14,500 L/acre/day
  const yieldQ = Math.round(acres * 22); // ~22 quintals/acre for rice/pulses
  const revenue = Math.round(yieldQ * 2420); // ~₹2,420 per quintal

  return {
    monthName: 'September 2026',
    seasonPhase: 'Late Kharif (Vegetative & Panicle Initiation)',
    estimatedWaterLiters: waterLiters,
    completedIrrigationHours: 36,
    projectedYieldQuintals: yieldQ,
    estimatedRevenueInr: revenue,
    healthStatus: 'Good',
    keyActionItems: [
      'Maintain 2-3 cm standing water in paddy during panicle initiation',
      'Monitor leaf color chart (LCC) before applying final urea dose',
      'Check local Rythu Bharosa Kendra for subsidized micro-irrigation maintenance kits',
    ],
  };
}

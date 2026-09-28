import type { DailyFieldAction, FieldActionCategory } from '../types';
import { getFarmActivities, type FarmActivityItem } from './farmStorage';

const STORAGE_KEY = 'agrifusion_daily_field_actions_v1';
const FARM_ACTIVITIES_KEY = 'agrifusion_farmer_activities_v2';

export function mapActivityCategoryToFieldCategory(cat: FarmActivityItem['category']): FieldActionCategory {
  switch (cat) {
    case 'pest_scout':
      return 'pest_disease';
    case 'sowing':
      return 'sowing_tillage';
    case 'fertilizer':
      return 'fertilizer';
    case 'irrigation':
      return 'irrigation';
    case 'weeding':
      return 'weeding';
    case 'harvest':
      return 'harvesting';
    default:
      return 'other';
  }
}

export function convertFarmActivityToDailyAction(act: FarmActivityItem): DailyFieldAction {
  const isPest = act.category === 'pest_scout';
  return {
    id: act.id,
    date: act.date,
    title: act.title,
    category: mapActivityCategoryToFieldCategory(act.category),
    isCompleted: act.completed,
    timeOfDay: act.timeOfDay || (isPest ? 'morning' : 'morning'),
    areaCovered: act.areaCovered || 'Paddy Field (Zone A & B • 2.5 Acres)',
    inputsUsed: isPest ? '4 Pheromone traps/acre • Sticky traps' : undefined,
    durationHours: act.durationHours ?? (isPest ? 1.5 : 2.0),
    notes: act.notes || (isPest ? 'Install 4 pheromone traps per acre if dead hearts exceed 5%.' : undefined),
    reasonIfNotCompleted: act.completed
      ? undefined
      : (act.notes || 'Install 4 pheromone traps per acre if dead hearts exceed 5%. Field scouting scheduled.'),
    createdAt: `${act.date}T06:30:00.000Z`,
    updatedAt: undefined,
  };
}

// Seed sample historical actions so any day selected initially has realistic field operations
function generateInitialSeedActions(): DailyFieldAction[] {
  const today = new Date();
  const formatYMD = (d: Date) => d.toISOString().slice(0, 10);

  const d0 = formatYMD(today); // Today
  const d1 = formatYMD(new Date(today.getTime() - 86400000 * 1)); // Yesterday
  const d2 = formatYMD(new Date(today.getTime() - 86400000 * 2)); // 2 days ago
  const d3 = formatYMD(new Date(today.getTime() - 86400000 * 3)); // 3 days ago
  const d5 = formatYMD(new Date(today.getTime() - 86400000 * 5)); // 5 days ago
  const d7 = formatYMD(new Date(today.getTime() - 86400000 * 7)); // 1 week ago

  return [
    // TODAY
    {
      id: 'fa-today-1',
      date: d0,
      title: 'Morning Borewell Irrigation (5 HP Motor)',
      category: 'irrigation',
      isCompleted: true,
      timeOfDay: 'morning',
      areaCovered: '2.5 Acres (Plot A & B)',
      inputsUsed: 'Groundwater • 3.5 motor hours',
      durationHours: 3.5,
      notes: 'Soil moisture restored to 78% field capacity before noon heat.',
      createdAt: new Date(today.getTime() - 3600000 * 4).toISOString(),
    },
    {
      id: 'fa-today-2',
      date: d0,
      title: 'Neem Oil Spray (NSKE 5%) for Whitefly / Sucking Pests',
      category: 'pest_disease',
      isCompleted: true,
      timeOfDay: 'evening',
      areaCovered: '1.5 Acres (West Sector)',
      inputsUsed: 'Neem Oil 5ml/L + Sandovit sticking agent',
      durationHours: 1.5,
      costInr: 320,
      notes: 'Preventive organic spray applied under cloudy canopy conditions.',
      createdAt: new Date(today.getTime() - 3600000 * 1).toISOString(),
    },
    {
      id: 'fa-today-3',
      date: d0,
      title: 'Zinc Sulphate (ZnSO4 21%) Foliar Application',
      category: 'fertilizer',
      isCompleted: false,
      timeOfDay: 'afternoon',
      areaCovered: '2.5 Acres',
      inputsUsed: 'Zinc Sulphate @ 2g/L + Lime 1g/L',
      reasonIfNotCompleted: 'Postponed due to sudden wind gusts and light drizzle alert from IMD.',
      notes: 'Scheduled for tomorrow morning after dew evaporates.',
      createdAt: new Date(today.getTime() - 3600000 * 6).toISOString(),
    },
    {
      id: 'fa-today-4',
      date: d0,
      title: 'Canal Sluice Gate Water Level Inspection',
      category: 'other',
      isCompleted: true,
      timeOfDay: 'morning',
      areaCovered: 'Main feeder bund',
      durationHours: 0.5,
      notes: 'Water flow adequate. Silt cleared near field intake siphon.',
      createdAt: new Date(today.getTime() - 3600000 * 5).toISOString(),
    },

    // YESTERDAY (d1)
    {
      id: 'fa-yest-1',
      date: d1,
      title: 'Inter-row Hand Weeding with Hired Labor',
      category: 'weeding',
      isCompleted: true,
      timeOfDay: 'all_day',
      areaCovered: '2.0 Acres',
      durationHours: 6.0,
      costInr: 1400,
      notes: 'Removed Cyperus rotundus and broadleaf weeds along planting ridges.',
      createdAt: new Date(today.getTime() - 86400000 * 1 - 3600000 * 3).toISOString(),
    },
    {
      id: 'fa-yest-2',
      date: d1,
      title: 'Urea (N) Second Top-Dressing at Tillering Stage',
      category: 'fertilizer',
      isCompleted: true,
      timeOfDay: 'afternoon',
      areaCovered: '2.5 Acres',
      inputsUsed: 'Neem Coated Urea (NCU) @ 45 kg/acre',
      durationHours: 2.0,
      costInr: 680,
      notes: 'Broadcasting completed while soil was wet after evening irrigation.',
      createdAt: new Date(today.getTime() - 86400000 * 1 - 3600000 * 5).toISOString(),
    },
    {
      id: 'fa-yest-3',
      date: d1,
      title: 'Pheromone Trap Installation for Fall Armyworm / Bollworm',
      category: 'pest_disease',
      isCompleted: false,
      timeOfDay: 'evening',
      areaCovered: '2.5 Acres',
      reasonIfNotCompleted: 'Traps supply delayed at Rythu Bharosa Kendram (RBK). Stock expected tomorrow.',
      notes: 'Will install 5 traps per acre once lure lures arrive.',
      createdAt: new Date(today.getTime() - 86400000 * 1 - 3600000 * 7).toISOString(),
    },

    // 2 DAYS AGO (d2)
    {
      id: 'fa-d2-1',
      date: d2,
      title: 'Borewell Capacitor & Starter Switch Replacement',
      category: 'machinery_labor',
      isCompleted: true,
      timeOfDay: 'morning',
      areaCovered: 'Borewell Pump House #1',
      durationHours: 2.5,
      costInr: 850,
      notes: 'Electrician installed new 36 MFD capacitor for steady 3-phase supply.',
      createdAt: new Date(today.getTime() - 86400000 * 2).toISOString(),
    },
    {
      id: 'fa-d2-2',
      date: d2,
      title: 'Tricyclazole 75% WP Prophylactic Spray for Blast Prevention',
      category: 'pest_disease',
      isCompleted: true,
      timeOfDay: 'afternoon',
      areaCovered: '2.5 Acres',
      inputsUsed: 'Tricyclazole @ 0.6 g/L water (Knapsack battery sprayer)',
      durationHours: 3.0,
      costInr: 520,
      notes: 'Uniform spray coverage achieved. Protective gloves and mask used.',
      createdAt: new Date(today.getTime() - 86400000 * 2 - 3600000 * 2).toISOString(),
    },
    {
      id: 'fa-d2-3',
      date: d2,
      title: 'Soil Sample Dispatch to Mandal Soil Testing Lab (STL)',
      category: 'other',
      isCompleted: false,
      timeOfDay: 'morning',
      reasonIfNotCompleted: 'Lab closed on local government holiday. Re-scheduled.',
      notes: 'Composite 0-15cm soil core samples packed in labeled polythene bag.',
      createdAt: new Date(today.getTime() - 86400000 * 2 - 3600000 * 6).toISOString(),
    },

    // 3 DAYS AGO (d3)
    {
      id: 'fa-d3-1',
      date: d3,
      title: 'Secondary Deep Tillage with Tractor Cultivator',
      category: 'sowing_tillage',
      isCompleted: true,
      timeOfDay: 'morning',
      areaCovered: '3.0 Acres',
      inputsUsed: '45 HP Tractor with 9-tyne cultivator',
      durationHours: 3.5,
      costInr: 2800,
      notes: 'Fine tilth prepared. Clods broken for improved aeration and root depth.',
      createdAt: new Date(today.getTime() - 86400000 * 3).toISOString(),
    },
    {
      id: 'fa-d3-2',
      date: d3,
      title: 'Farmyard Manure (FYM) Basal Soil Incorporation',
      category: 'fertilizer',
      isCompleted: true,
      timeOfDay: 'evening',
      areaCovered: '2.0 Acres',
      inputsUsed: 'Well-decomposed cattle manure • 4 tractor trolley loads',
      durationHours: 4.0,
      costInr: 4000,
      notes: 'Organic carbon improvement for red sandy loam soil.',
      createdAt: new Date(today.getTime() - 86400000 * 3 - 3600000 * 4).toISOString(),
    },

    // 5 DAYS AGO (d5)
    {
      id: 'fa-d5-1',
      date: d5,
      title: 'Drip Lateral Flushing and Filter Backwash',
      category: 'irrigation',
      isCompleted: true,
      timeOfDay: 'morning',
      areaCovered: 'Drip sub-mains',
      durationHours: 1.5,
      notes: 'Screen filter cleaned of algae and particulate sediment.',
      createdAt: new Date(today.getTime() - 86400000 * 5).toISOString(),
    },
    {
      id: 'fa-d5-2',
      date: d5,
      title: 'Seed Treatment with Trichoderma viride',
      category: 'sowing_tillage',
      isCompleted: true,
      timeOfDay: 'afternoon',
      inputsUsed: 'Trichoderma viride @ 10g/kg seed + 2% Jaggery slurry',
      notes: 'Pre-sowing biological shield against root rot and damping-off.',
      createdAt: new Date(today.getTime() - 86400000 * 5 - 3600000 * 3).toISOString(),
    },

    // 7 DAYS AGO (d7)
    {
      id: 'fa-d7-1',
      date: d7,
      title: 'APMC Mandi Visit & Modal Price Verification',
      category: 'mandi_sale',
      isCompleted: true,
      timeOfDay: 'morning',
      areaCovered: 'Regional APMC Market Yard',
      notes: 'Checked prevailing rates: Paddy fine Rs 2380/qtl; Maize Rs 2150/qtl.',
      createdAt: new Date(today.getTime() - 86400000 * 7).toISOString(),
    },
    {
      id: 'fa-d7-2',
      date: d7,
      title: 'Bund Strengthening and Rat Burrow Gassing',
      category: 'other',
      isCompleted: true,
      timeOfDay: 'evening',
      areaCovered: 'Field perimeter bunds',
      durationHours: 2.0,
      notes: 'Compacted bunds to prevent irrigation water seepage into adjacent drains.',
      createdAt: new Date(today.getTime() - 86400000 * 7 - 3600000 * 2).toISOString(),
    },
  ];
}

let inMemoryFieldActions: DailyFieldAction[] = generateInitialSeedActions();

export function getDailyFieldActions(targetDate?: string): DailyFieldAction[] {
  try {
    if (!targetDate) {
      return [...inMemoryFieldActions].sort((a, b) => b.date.localeCompare(a.date));
    }

    return [...inMemoryFieldActions]
      .filter((a) => a.date === targetDate)
      .sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? -1 : 1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  } catch (err) {
    console.warn('Error reading daily field actions from memory:', err);
    return [];
  }
}

export function getAllFieldActionDates(): string[] {
  try {
    const all = getDailyFieldActions();
    const uniqueDates = Array.from(new Set(all.map((a) => a.date)));
    return uniqueDates.sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }
}

export function saveDailyFieldAction(action: DailyFieldAction): DailyFieldAction[] {
  try {
    const existingIndex = inMemoryFieldActions.findIndex((a) => a.id === action.id);

    if (existingIndex >= 0) {
      inMemoryFieldActions[existingIndex] = {
        ...action,
        updatedAt: new Date().toISOString(),
      };
    } else {
      inMemoryFieldActions = [action, ...inMemoryFieldActions];
    }

    return inMemoryFieldActions.filter((a) => a.date === action.date);
  } catch (err) {
    console.error('Failed to save daily field action:', err);
    return [];
  }
}

export function toggleFieldActionCompletion(
  id: string,
  reasonIfNotCompleted?: string
): DailyFieldAction | null {
  try {
    const target = inMemoryFieldActions.find((a) => a.id === id);
    if (!target) return null;

    const nextCompleted = !target.isCompleted;
    const updatedTarget: DailyFieldAction = {
      ...target,
      isCompleted: nextCompleted,
      reasonIfNotCompleted: nextCompleted ? undefined : reasonIfNotCompleted || target.reasonIfNotCompleted,
      updatedAt: new Date().toISOString(),
    };

    inMemoryFieldActions = inMemoryFieldActions.map((a) => (a.id === id ? updatedTarget : a));
    return updatedTarget;
  } catch (err) {
    console.error('Failed to toggle field action status:', err);
    return null;
  }
}

export function deleteDailyFieldAction(id: string): boolean {
  try {
    inMemoryFieldActions = inMemoryFieldActions.filter((a) => a.id !== id);
    return true;
  } catch (err) {
    console.error('Failed to delete daily field action:', err);
    return false;
  }
}

export function getCategoryBadge(cat: FieldActionCategory): {
  label: string;
  labelTe: string;
  colorClass: string;
} {
  switch (cat) {
    case 'irrigation':
      return {
        label: 'Irrigation & Water',
        labelTe: 'Watering & Pumping',
        colorClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      };
    case 'fertilizer':
      return {
        label: 'Fertilizer & Nutrition',
        labelTe: 'Nutrient Application',
        colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    case 'pest_disease':
      return {
        label: 'Pest & Disease Control',
        labelTe: 'Crop Spraying',
        colorClass: 'bg-rose-50 text-rose-800 border-rose-200',
      };
    case 'sowing_tillage':
      return {
        label: 'Tillage & Sowing',
        labelTe: 'Seed & Land Prep',
        colorClass: 'bg-amber-50 text-amber-900 border-amber-200',
      };
    case 'weeding':
      return {
        label: 'Weeding & Hoeing',
        labelTe: 'Weed Control',
        colorClass: 'bg-lime-50 text-lime-900 border-lime-200',
      };
    case 'harvesting':
      return {
        label: 'Harvest & Threshing',
        labelTe: 'Crop Harvest',
        colorClass: 'bg-yellow-50 text-yellow-900 border-yellow-200',
      };
    case 'mandi_sale':
      return {
        label: 'Mandi & Market Sale',
        labelTe: 'Market & Trading',
        colorClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      };
    case 'machinery_labor':
      return {
        label: 'Machinery & Labor',
        labelTe: 'Tractor & Workers',
        colorClass: 'bg-stone-100 text-stone-800 border-stone-300',
      };
    default:
      return {
        label: 'Field Operation',
        labelTe: 'Field Work',
        colorClass: 'bg-stone-50 text-stone-700 border-stone-200',
      };
  }
}

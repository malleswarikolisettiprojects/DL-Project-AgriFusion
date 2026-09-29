import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudSun,
  Coins,
  Compass,
  DollarSign,
  Droplets,
  FileCheck,
  FileSpreadsheet,
  Filter,
  History,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  Sprout,
  Stethoscope,
  Sun,
  Sunrise,
  Sunset,
  Timer,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { AreaInputField } from '../components/AreaInputField';
import {
  ConfidenceBadge,
  DataFreshnessLabel,
  DisclaimerBanner,
  MetricCard,
  RiskBadge,
  StatutoryAdvisoryTopBanner,
} from '../components/CommonUI';
import { PageHeader } from '../components/Navigation';
import { COMMON_CROPS, STATES_AND_DISTRICTS } from '../data/agriData';
import { CROP_VISUALS, getCropVisual, type CropVisualInfo } from '../data/cropImages';
import { calculateFarmEconomics } from '../lib/agriEconomics';
import {
  addFarmActivity,
  calculateMonthlySummary,
  deleteFarmActivity,
  getFarmActivities,
  getSavedPredictions,
  toggleFarmActivity,
  type FarmActivityItem,
  type MonthlyFarmSummary,
  type SavedPrediction,
} from '../lib/farmStorage';
import type { ActivePage, UserFarmProfile } from '../types';

const DEFAULT_PROFILE: UserFarmProfile = {
  user_email: 'farmer@agrifusion.com',
  state: 'Andhra Pradesh',
  district: 'Visakhapatnam',
  village: 'Anakapalle',
  crop: 'Rice',
  area_ha: 2,
  sowing_date: '2026-06-15',
  pump_hp: 5,
};

export function FarmerDashboard({
  profile,
  onUpdateProfile,
  onNavigate,
}: {
  profile?: UserFarmProfile;
  onUpdateProfile: (p: UserFarmProfile) => void;
  onNavigate: (page: ActivePage) => void;
  language?: 'en' | 'te';
}) {
  const safeProfile = useMemo<UserFarmProfile>(() => {
    const p: Partial<UserFarmProfile> = profile || {};
    return {
      user_email: p.user_email || DEFAULT_PROFILE.user_email,
      state: p.state || DEFAULT_PROFILE.state,
      district: p.district || DEFAULT_PROFILE.district,
      village: p.village || DEFAULT_PROFILE.village,
      crop: p.crop || DEFAULT_PROFILE.crop,
      area_ha: p.area_ha ?? DEFAULT_PROFILE.area_ha,
      sowing_date: p.sowing_date || DEFAULT_PROFILE.sowing_date,
      soil_type: p.soil_type || DEFAULT_PROFILE.soil_type,
      irrigation_source: p.irrigation_source || DEFAULT_PROFILE.irrigation_source,
      pump_hp: p.pump_hp ?? DEFAULT_PROFILE.pump_hp,
      farmer_name: p.farmer_name || DEFAULT_PROFILE.farmer_name,
      mobile: p.mobile || DEFAULT_PROFILE.mobile,
    };
  }, [profile]);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editState, setEditState] = useState<UserFarmProfile>(safeProfile);

  useEffect(() => {
    setEditState(safeProfile);
  }, [safeProfile]);

  // Predictions history & activities
  const [predictions, setPredictions] = useState<SavedPrediction[]>([]);
  const [activities, setActivities] = useState<FarmActivityItem[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyFarmSummary>(() =>
    calculateMonthlySummary(safeProfile.area_ha || 2)
  );
  const [predictionFilter, setPredictionFilter] = useState<string>('all');
  const [cropCategoryFilter, setCropCategoryFilter] = useState<string>('all');

  // Active crop visual
  const activeCropVisual = getCropVisual(safeProfile.crop || 'Rice');

  // Featured crops for showcase
  const FEATURED_CROPS = [
    'Maize',
    'Chilli',
    'Groundnut',
    'Sugarcane',
    'Red Gram (Tur)',
    'Rice',
    'Bengal Gram (Chickpea)',
    'Soybean',
    'Tomato',
    'Mango',
    'Cotton',
    'Turmeric',
  ];

  // New activity modal/state
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [showScheduleGuidelines, setShowScheduleGuidelines] = useState(true);
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityCat, setNewActivityCat] = useState<FarmActivityItem['category']>('irrigation');
  const [newActivityDate, setNewActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [newActivityTimeOfDay, setNewActivityTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'all_day'>('morning');
  const [newActivityDuration, setNewActivityDuration] = useState('2.0');
  const [newActivityArea, setNewActivityArea] = useState('North Plot (2.5 Acres)');
  const [newActivityNotes, setNewActivityNotes] = useState('');

  useEffect(() => {
    setPredictions(getSavedPredictions());
    setActivities(getFarmActivities());
    setMonthlySummary(calculateMonthlySummary(safeProfile.area_ha || 2));
  }, [safeProfile.area_ha]);

  const selectedStateObj =
    STATES_AND_DISTRICTS.find((s) => s.name === editState.state) || STATES_AND_DISTRICTS[0];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(editState);
    setIsEditingProfile(false);
    setMonthlySummary(calculateMonthlySummary(editState.area_ha || 2));
  };

  const handleToggleActivity = (id: string) => {
    const updated = toggleFarmActivity(id);
    setActivities(updated);
  };

  const handleCreateActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityTitle.trim()) return;
    const updated = addFarmActivity({
      title: newActivityTitle.trim(),
      category: newActivityCat,
      date: newActivityDate,
      completed: false,
      timeOfDay: newActivityTimeOfDay,
      durationHours: parseFloat(newActivityDuration) || 2.0,
      areaCovered: newActivityArea.trim() || undefined,
      notes: newActivityNotes.trim() || undefined,
    });
    setActivities(updated);
    setNewActivityTitle('');
    setNewActivityNotes('');
    setIsAddingActivity(false);
  };

  const handleCreateActivityDirect = (activity: Omit<Parameters<typeof addFarmActivity>[0], 'id'>) => {
    const updated = addFarmActivity(activity);
    setActivities(updated);
  };

  const filteredPredictions = predictions.filter((p) => {
    if (predictionFilter === 'all') return true;
    return p.category === predictionFilter;
  });

  const areaAcres = Number(((safeProfile.area_ha || 2) * 2.471).toFixed(1));

  const farmEconomics = useMemo(() => {
    return calculateFarmEconomics({
      crop: safeProfile.crop || 'Rice',
      areaHa: safeProfile.area_ha || 2,
    });
  }, [safeProfile.crop, safeProfile.area_ha]);

  return (
    <div className="space-y-8 pb-12">
      <StatutoryAdvisoryTopBanner module="dashboard" />

      {/* SCENIC AGRICULTURAL HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-800/30 shadow-md text-white">
        <div className="absolute inset-0">
          <img
            src="/agri/farm_hero.jpg"
            alt="Agricultural Landscape"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/crops/rice.jpg';
            }}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-linear-to-r from-emerald-950/95 via-emerald-900/85 to-stone-950/80 backdrop-blur-[1px]" />
        </div>

        <div className="relative p-6 sm:p-8 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Precision Agro Intelligence
                </span>
                <span className="text-xs text-emerald-200/80">• Kharif 2026 Season</span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white drop-shadow-xs">
                Andhra Pradesh & Telangana Farmer Command Center
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed drop-shadow-xs">
                Live micro-climate intelligence, crop health monitoring, and mandi economic forecasting customized for your <strong>{areaAcres} Acres</strong> in <strong>{safeProfile.district}</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('pipeline')}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-stone-900" />
                <span>Full Farm Analysis</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('cost-profit')}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition-all cursor-pointer flex items-center gap-2"
              >
                <Coins className="w-4 h-4 text-amber-300" />
                <span>Profit Calculator</span>
              </button>
            </div>
          </div>

          {/* Key Field Condition Quick Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/15 text-xs">
            <div className="flex items-center gap-2 bg-black/25 rounded-xl p-2.5 border border-white/10">
              <Sprout className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] text-emerald-200 block">Target Crop</span>
                <strong className="text-white text-xs">{safeProfile.crop}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-black/25 rounded-xl p-2.5 border border-white/10">
              <Droplets className="w-4 h-4 text-sky-400 shrink-0" />
              <div>
                <span className="text-[10px] text-sky-200 block">Canal / Soil Moisture</span>
                <strong className="text-white text-xs">Optimal (72%)</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-black/25 rounded-xl p-2.5 border border-white/10">
              <CloudSun className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="text-[10px] text-amber-200 block">Field Climate</span>
                <strong className="text-white text-xs">29°C • Sunny</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-black/25 rounded-xl p-2.5 border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] text-emerald-200 block">Pest Risk Index</span>
                <strong className="text-white text-xs">Low (Zone Safe)</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PageHeader
        title="Farm Land & Crop Settings"
        subtitle={`Summary of your registered land parcel in ${safeProfile.district}, ${safeProfile.state} with active crop parameters.`}
        badge="Land Parcel Profile"
        action={
          <button
            type="button"
            onClick={() => onNavigate('pipeline')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#14532D] text-white font-semibold text-xs shadow-xs hover:bg-[#14532D]/90 transition-all cursor-pointer"
          >
            <Activity className="w-4 h-4 text-emerald-300" />
            <span>Run Complete Farm Analysis</span>
          </button>
        }
      />

      {/* Active Farm Profile Card with Crop Photo Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div className="flex items-start sm:items-center gap-3.5">
            {/* Active Crop Photo Badge */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-xs shrink-0 group">
              <img
                src={activeCropVisual.image}
                alt={safeProfile.crop}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/crops/rice.jpg';
                }}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <span className="absolute bottom-0 inset-x-0 bg-emerald-950/80 text-[9px] font-bold text-emerald-200 text-center py-0.5 backdrop-blur-xs">
                Active Crop
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-stone-900">
                  {safeProfile.village ? `${safeProfile.village}, ` : ''}
                  {safeProfile.district}, {safeProfile.state}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#14532D] text-white">
                  {safeProfile.crop}
                </span>
                {activeCropVisual.category && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    {activeCropVisual.category}
                  </span>
                )}
              </div>

              <p className="text-xs text-stone-600 mt-1">
                {activeCropVisual.localTelugu ? (
                  <strong className="text-emerald-900 mr-1">{activeCropVisual.localTelugu}</strong>
                ) : null}
                {activeCropVisual.subtitle ? `(${activeCropVisual.subtitle}) • ` : ''}
                Duration: <strong className="text-stone-800">{activeCropVisual.duration}</strong> • Farm Area:{' '}
                <strong className="text-stone-800">{areaAcres} Acres</strong> ({safeProfile.area_ha} Ha)
              </p>

              {activeCropVisual.typicalYield && (
                <p className="text-[11px] text-emerald-800 font-medium mt-0.5 flex items-center gap-1.5">
                  <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Expected Farm Yield: <strong>{activeCropVisual.typicalYield}</strong></span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors cursor-pointer"
            >
              {isEditingProfile ? 'Close Editor' : 'Edit Land & Crop'}
            </button>
          </div>
        </div>

        {/* Quick Crop Selector Horizontal Strip */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Quick-Switch Crop for Recommendations & Costs:</span>
            <span className="text-[10px] text-stone-400">Click any crop photo below</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {FEATURED_CROPS.map((cropName) => {
              const visual = getCropVisual(cropName);
              const isSelected = (safeProfile.crop || '').toLowerCase().includes(cropName.toLowerCase());
              return (
                <button
                  key={cropName}
                  type="button"
                  onClick={() => {
                    const updated: UserFarmProfile = { ...safeProfile, crop: cropName };
                    onUpdateProfile(updated);
                  }}
                  className={`shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-600/30'
                      : 'bg-stone-50 border-stone-200 hover:border-emerald-300 hover:bg-white'
                  }`}
                >
                  <img
                    src={visual.image}
                    alt={cropName}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/crops/rice.jpg';
                    }}
                    className="w-6 h-6 rounded-lg object-cover"
                  />
                  <span className={`text-xs font-bold ${isSelected ? 'text-[#14532D]' : 'text-stone-700'}`}>
                    {cropName.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Inline Profile Editor Form with Unconstrained Area */}
        {isEditingProfile && (
          <form onSubmit={handleSaveProfile} className="mt-4 p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-4">
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Update Farm Field Parameters
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">State</label>
                <select
                  value={editState.state}
                  onChange={(e) => {
                    const newState = e.target.value;
                    const st = STATES_AND_DISTRICTS.find((s) => s.name === newState);
                    setEditState({
                      ...editState,
                      state: newState,
                      district: st ? st.districts[0] : '',
                    });
                  }}
                  className="w-full text-xs p-2.5 rounded-lg border border-stone-300 bg-white"
                >
                  {STATES_AND_DISTRICTS.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">District</label>
                <select
                  value={editState.district}
                  onChange={(e) => setEditState({ ...editState, district: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-stone-300 bg-white"
                >
                  {selectedStateObj.districts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Village / Mandal</label>
                <input
                  type="text"
                  value={editState.village}
                  onChange={(e) => setEditState({ ...editState, village: e.target.value })}
                  placeholder="e.g. Anakapalle"
                  className="w-full text-xs p-2.5 rounded-lg border border-stone-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Target Crop</label>
                <select
                  value={editState.crop}
                  onChange={(e) => setEditState({ ...editState, crop: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-stone-300 bg-white font-medium"
                >
                  {COMMON_CROPS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Unrestricted Area Input */}
            <div className="pt-2">
              <AreaInputField
                label="Farm Land Area"
                areaHa={editState.area_ha || 2}
                onChange={(ha) => setEditState({ ...editState, area_ha: ha })}
                helperText="Enter in Acres or Hectares. Any land size is supported."
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-stone-600 hover:bg-stone-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#14532D] text-white hover:bg-[#14532D]/90"
              >
                Save Farm Profile
              </button>
            </div>
          </form>
        )}

        {/* Profile summary badges */}
        <div className="mt-2 pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-[#14532D] font-semibold border border-emerald-200 flex items-center gap-1.5">
            <Sprout className="w-3.5 h-3.5" /> Target Crop: {safeProfile.crop}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-700 font-medium">
            Sowing Cycle: {safeProfile.sowing_date || 'Kharif 2026'}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-sky-50 text-sky-800 font-medium border border-sky-200">
            Total Land: {areaAcres} Acres ({safeProfile.area_ha} Ha)
          </span>
        </div>
      </div>

      {/* MAJOR CROPS CULTIVATION GALLERY ON HOME PAGE */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <Sprout className="w-5 h-5 text-[#14532D]" />
              <h3 className="text-base font-extrabold text-stone-900">
                Major Crops & Cultivation Profiles
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                Real Photos & Guidelines
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              High-resolution photo cards of Andhra Pradesh & Telangana crops with duration, expected yield, and instant model links.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'All Crops' },
              { id: 'cereal', label: 'Grains & Cereals' },
              { id: 'commercial', label: 'Commercial & Cash' },
              { id: 'pulse', label: 'Pulses' },
              { id: 'spice', label: 'Spices & Oilseeds' },
              { id: 'horticulture', label: 'Horticulture & Fruits' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCropCategoryFilter(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  cropCategoryFilter === cat.id
                    ? 'bg-[#14532D] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Crops Visual Grid with High-Res Photos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {FEATURED_CROPS.filter((cropName) => {
            if (cropCategoryFilter === 'all') return true;
            const visual = getCropVisual(cropName);
            const cat = visual.category?.toLowerCase() || '';
            if (cropCategoryFilter === 'cereal') return cat.includes('cereal');
            if (cropCategoryFilter === 'commercial') return cat.includes('commercial');
            if (cropCategoryFilter === 'pulse') return cat.includes('pulse');
            if (cropCategoryFilter === 'spice') return cat.includes('spice') || cat.includes('oilseed');
            if (cropCategoryFilter === 'horticulture') return cat.includes('horticulture') || cat.includes('fruit');
            return true;
          }).map((cropName) => {
            const visual = getCropVisual(cropName);
            const isSelected = (safeProfile.crop || '').toLowerCase().includes(cropName.toLowerCase());

            return (
              <div
                key={cropName}
                className={`group rounded-2xl border overflow-hidden transition-all duration-200 flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#14532D] ring-2 ring-[#14532D]/40 bg-emerald-50/40 shadow-xs'
                    : 'border-stone-200 bg-white hover:border-emerald-300 hover:shadow-md'
                }`}
              >
                {/* Crop Photo Container */}
                <div className="relative h-36 w-full overflow-hidden bg-stone-100">
                  <img
                    src={visual.image}
                    alt={cropName}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/crops/rice.jpg';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-stone-950/70 via-transparent to-transparent" />
                  
                  {/* Category Pill */}
                  {visual.category && (
                    <span className="absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-900/80 text-white backdrop-blur-xs border border-white/20">
                      {visual.category}
                    </span>
                  )}

                  {isSelected && (
                    <span className="absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 text-white shadow-xs">
                      ✓ Target Crop
                    </span>
                  )}

                  {/* Name overlay */}
                  <div className="absolute bottom-2 left-2.5 right-2.5 text-white">
                    <h4 className="font-extrabold text-sm leading-tight drop-shadow-xs">
                      {cropName}
                    </h4>
                    <p className="text-[11px] text-emerald-200 font-medium drop-shadow-xs">
                      {visual.localTelugu ? `${visual.localTelugu}` : visual.subtitle}
                    </p>
                  </div>
                </div>

                {/* Card Content & Meta */}
                <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5 text-xs text-stone-600">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-400">Duration:</span>
                      <strong className="text-stone-800">{visual.duration}</strong>
                    </div>
                    {visual.typicalYield && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-stone-400">Expected Yield:</span>
                        <strong className="text-emerald-800">{visual.typicalYield}</strong>
                      </div>
                    )}
                    <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed pt-0.5">
                      {visual.seasonInfo}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-stone-100 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const updated: UserFarmProfile = { ...safeProfile, crop: cropName };
                          onUpdateProfile(updated);
                        }}
                        className={`text-[11px] font-bold py-1.5 px-2 rounded-lg text-center transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-stone-100 hover:bg-emerald-100 text-stone-700 hover:text-emerald-900'
                        }`}
                      >
                        {isSelected ? '✓ Selected' : 'Set as Crop'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const updated: UserFarmProfile = { ...safeProfile, crop: cropName };
                          onUpdateProfile(updated);
                          onNavigate('cost-profit');
                        }}
                        className="text-[11px] font-bold py-1.5 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/70 text-center transition-colors cursor-pointer flex items-center justify-center gap-1"
                        title="Calculate cultivation cost & net profit"
                      >
                        <Coins className="w-3 h-3 text-amber-700" />
                        <span>Cost & Profit</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          const updated: UserFarmProfile = { ...safeProfile, crop: cropName };
                          onUpdateProfile(updated);
                          onNavigate('market');
                        }}
                        className="py-1 px-1.5 rounded-md text-stone-600 hover:bg-stone-100 text-center font-medium border border-stone-200 transition-colors cursor-pointer"
                      >
                        📈 Mandi Prices
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated: UserFarmProfile = { ...safeProfile, crop: cropName };
                          onUpdateProfile(updated);
                          onNavigate('disease-detection');
                        }}
                        className="py-1 px-1.5 rounded-md text-stone-600 hover:bg-stone-100 text-center font-medium border border-stone-200 transition-colors cursor-pointer"
                      >
                        🩺 Leaf Check
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: MONTHLY AGRICULTURAL SUMMARY */}
      <div className="p-6 rounded-3xl bg-linear-to-br from-white to-stone-50 border border-stone-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#14532D]" />
              <h3 className="text-base font-bold text-stone-900">
                Monthly Farm Overview: {monthlySummary.monthName}
              </h3>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Agricultural Phase: <strong className="text-stone-800">{monthlySummary.seasonPhase}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              Crop Condition: {monthlySummary.healthStatus}
            </span>
          </div>
        </div>

        {/* 4 Key Monthly Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Water Budget Needed"
            value={(monthlySummary.estimatedWaterLiters / 1000).toFixed(0)}
            unit="k Liters"
            subtitle="Estimated monthly irrigation volume"
            icon={Droplets}
            variant="blue"
          />

          <MetricCard
            title="Pump Runtime Logged"
            value={monthlySummary.completedIrrigationHours}
            unit="Hours"
            subtitle="Recorded across all irrigation zones"
            icon={Clock}
            variant="default"
          />

          <MetricCard
            title="Projected Harvest"
            value={monthlySummary.projectedYieldQuintals}
            unit="Quintals"
            subtitle={`Forecast for ${areaAcres} acres`}
            icon={TrendingUp}
            variant="green"
          />

          <MetricCard
            title="Estimated Gross Revenue"
            value={`₹${(monthlySummary.estimatedRevenueInr / 1000).toFixed(0)}k`}
            subtitle="Based on current market modal prices"
            icon={Coins}
            variant="amber"
          />
        </div>

        {/* CROP CULTIVATION ECONOMICS & PROFITABILITY ESTIMATION */}
        <div className="p-5 sm:p-6 rounded-3xl bg-linear-to-br from-emerald-950 via-[#14532D] to-[#0A2F1B] text-white shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/15">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/10 text-amber-300 flex items-center justify-center font-bold border border-white/10">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    Crop Costs & Expected Profit
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-400 text-stone-900">
                    Easy Farm Guide
                  </span>
                </div>
                <p className="text-xs text-emerald-100/80">
                  Estimated calculation for {safeProfile.crop || 'Rice'} across {areaAcres} Acres ({safeProfile.area_ha || 2} Ha) in {safeProfile.district}.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('cost-profit')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <span>Open Cost & Profit Calculator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-white/10 border border-white/10">
              <span className="text-[11px] text-emerald-200/90 block font-medium">
                Total Expenses
              </span>
              <span className="text-base sm:text-lg font-extrabold text-white">
                ₹{farmEconomics.totalCost.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-300/80 block mt-0.5">
                ₹{farmEconomics.costPerAcre.toLocaleString()} / Acre
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/10 border border-white/10">
              <span className="text-[11px] text-emerald-200/90 block font-medium">
                Crop Sales Money
              </span>
              <span className="text-base sm:text-lg font-extrabold text-white">
                ₹{farmEconomics.grossRevenue.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-300/80 block mt-0.5">
                {farmEconomics.expectedYieldTotalQuintals} Quintals (1Q = 100kg)
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/30">
              <span className="text-[11px] text-emerald-200 block font-semibold">
                Clean Profit in Hand
              </span>
              <span className="text-base sm:text-lg font-black text-amber-300">
                +₹{farmEconomics.netProfit.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-200/90 block mt-0.5">
                +₹{farmEconomics.netProfitPerAcre.toLocaleString()} / Acre profit
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/10 border border-white/10">
              <span className="text-[11px] text-emerald-200/90 block font-medium">
                Money Return (per ₹100 spent)
              </span>
              <span className="text-base sm:text-lg font-extrabold text-white">
                ₹{Math.round(farmEconomics.benefitCostRatio * 100)} return
              </span>
              <span className="text-[10px] text-emerald-300/80 block mt-0.5">
                ₹{farmEconomics.benefitCostRatio} earned per ₹1 spent
              </span>
            </div>
          </div>
        </div>

        {/* Seasonal Priority Action Checklist */}
        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
          <div className="text-xs font-bold text-[#14532D] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Priority Field Actions for this Month</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-stone-800">
            {monthlySummary.keyActionItems.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: FARM ACTIVITY PLANNER & RECENT LOGS */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <History className="w-5 h-5 text-[#14532D]" />
              <span>Farm Activities & Field Schedule</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Keep track of irrigation, fertilizer, pest control, and weeding tasks. Check off items as you complete them.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('farm-history')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-950 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
              title="Open the official Day-Wise Field Operations Register to retrieve past dates"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#14532D]" />
              <span>Full Day-Wise Register</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddingActivity(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14532D] text-white text-xs font-semibold hover:bg-[#14532D]/90 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Field Task</span>
            </button>
          </div>
        </div>

        {/* HIGHLIGHTED OPERATIONAL PROTOCOL CARD */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-stone-50 to-amber-50/40 border border-emerald-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#14532D] text-white shadow-2xs">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-2">
                  <span>Field Operations Scheduling & Timing Protocol</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Agronomic Standard
                  </span>
                </h4>
                <p className="text-[11px] text-stone-600 mt-0.5">
                  Core execution guidelines for scheduling target dates, biological day-part timings, and plot coverage.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowScheduleGuidelines(!showScheduleGuidelines)}
              className="text-xs font-bold text-[#14532D] hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
            >
              <span>{showScheduleGuidelines ? 'Hide Protocol' : 'Show Protocol'}</span>
              {showScheduleGuidelines ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showScheduleGuidelines && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1 border-t border-emerald-200/60">
              {/* 1. Target Date (date) */}
              <div className="p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                  <div className="p-1 rounded-md bg-emerald-100 text-[#14532D]">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <span>Target Date (date)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-stone-600">
                  You can schedule tasks for <strong className="text-stone-900 font-bold">Today</strong>, set them for <strong className="text-stone-900 font-bold">Upcoming dates</strong> (e.g., fertilizer application 4 days from now), or log past activities.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold">
                    ✓ Today's Priorities
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-800 text-[10px] font-semibold">
                    +4d Fertilizer Stage
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-stone-700 text-[10px] font-semibold">
                    Past Audit Logs
                  </span>
                </div>
              </div>

              {/* 2. Operational Time of Day (timeOfDay) */}
              <div className="p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                  <div className="p-1 rounded-md bg-amber-100 text-amber-900">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <span>Operational Time of Day (timeOfDay)</span>
                </div>
                <ul className="text-[11px] space-y-1.5 text-stone-600">
                  <li className="flex items-start gap-1.5">
                    <span className="font-bold text-amber-700 shrink-0 flex items-center gap-1">
                      <Sunrise className="w-3 h-3 text-amber-600" /> Morning:
                    </span>
                    <span>Borewell irrigation before peak sun, canal sluice inspection.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="font-bold text-orange-700 shrink-0 flex items-center gap-1">
                      <Sun className="w-3 h-3 text-orange-600" /> Afternoon:
                    </span>
                    <span>Top-dressing dry fertilizers or loosening soil for root air flow.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="font-bold text-purple-700 shrink-0 flex items-center gap-1">
                      <Sunset className="w-3 h-3 text-purple-600" /> Evening:
                    </span>
                    <span>Direct leaf spraying (neem oil / organic pesticides) to protect bees and pollinators.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="font-bold text-blue-700 shrink-0 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-blue-600" /> All Day:
                    </span>
                    <span>Hand weeding, tractor tillage, or harvesting.</span>
                  </li>
                </ul>
              </div>

              {/* 3. Duration & Area */}
              <div className="p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                  <div className="p-1 rounded-md bg-blue-100 text-blue-900">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <span>Duration & Area</span>
                </div>
                <p className="text-[11px] leading-relaxed text-stone-600">
                  Specify how many hours it takes (e.g., <strong className="text-stone-900 font-bold">2.5 hours</strong>) and which plot/acreage is covered (e.g., <strong className="text-stone-900 font-bold">North Plot • 2.5 Acres</strong>).
                </p>
                <div className="p-2 rounded-lg bg-stone-50 border border-stone-200/80 text-[10px] text-stone-600 space-y-1">
                  <div className="flex items-center justify-between font-bold text-stone-800">
                    <span>Field Water / Labor Ratio</span>
                    <span className="text-emerald-700">~1.2 ha / day</span>
                  </div>
                  <p>Ensures pump electricity hours, diesel consumption, and irrigation duty cycles stay within farm budget.</p>
                </div>
              </div>
            </div>
          )}

          {/* Proactive Crop Lifecycle Operational Suggestions: Weeding, Harvesting, Drying */}
          <div className="pt-2 border-t border-emerald-200/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Lifecycle Interventions (Weeding, Harvesting, Drying):</span>
              </span>
              <span className="text-[10px] text-stone-500">
                1-tap to schedule directly to today's ledger
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* 1. Weeding */}
              <div className="p-2.5 rounded-xl bg-white/80 hover:bg-white border border-stone-200/80 hover:border-emerald-300 transition-all flex flex-col justify-between gap-2 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900 flex items-center gap-1">
                      <span>🌿</span>
                      <span>Weeding & Soil Loosening</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      All Day • 15-45 DAT
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-snug">
                    De-weed sedges & broadleaves before 40 DAT. Prevents 30-40% fertilizer loss to wild weed canopy.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    handleCreateActivityDirect({
                      title: 'Field Weeding & Soil Air-Loosening',
                      category: 'weeding',
                      date: today,
                      completed: false,
                      timeOfDay: 'all_day',
                      durationHours: 3.5,
                      areaCovered: `${safeProfile.crop || 'Crop'} Field (Zone B)`,
                      notes: 'Manual / cono-weeder pass to remove weeds and loosen soil around roots so roots get fresh air.',
                    });
                  }}
                  className="w-full py-1.5 rounded-lg text-xs font-bold text-[#14532D] bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-300 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Schedule Weeding</span>
                </button>
              </div>

              {/* 2. Harvesting */}
              <div className="p-2.5 rounded-xl bg-white/80 hover:bg-white border border-stone-200/80 hover:border-amber-300 transition-all flex flex-col justify-between gap-2 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900 flex items-center gap-1">
                      <span>🌾</span>
                      <span>Field Drain & Harvest</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      Morning (9 AM)
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-snug">
                    Drain standing water 7-10d prior. Harvest when 80-85% panicles turn golden at 20-22% grain moisture.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    handleCreateActivityDirect({
                      title: 'Drain & Harvest Inspection',
                      category: 'harvest',
                      date: today,
                      completed: false,
                      timeOfDay: 'morning',
                      durationHours: 4.0,
                      areaCovered: `${safeProfile.crop || 'Field'} Main Plot`,
                      notes: 'Drain field bunds and initiate harvesting at 80% golden panicles after morning dew evaporates.',
                    });
                  }}
                  className="w-full py-1.5 rounded-lg text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-600 hover:text-white border border-amber-300 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Schedule Harvest</span>
                </button>
              </div>

              {/* 3. Drying */}
              <div className="p-2.5 rounded-xl bg-white/80 hover:bg-white border border-stone-200/80 hover:border-sky-300 transition-all flex flex-col justify-between gap-2 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900 flex items-center gap-1">
                      <span>☀️</span>
                      <span>Sun Drying & Storage</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                      Target 12-14% Moisture
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-snug">
                    Spread in 5 cm layers on clean tarpaulin sheets. Rake hourly to avoid fungal Aspergillus aflatoxin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    handleCreateActivityDirect({
                      title: 'Threshed Grain Sun-Drying',
                      category: 'harvest',
                      date: today,
                      completed: false,
                      timeOfDay: 'all_day',
                      durationHours: 5.0,
                      areaCovered: 'Drying Yard / Tarpaulin Floor',
                      notes: 'Continuous sun drying to bring moisture from 21% down to safe 12-14% storage threshold.',
                    });
                  }}
                  className="w-full py-1.5 rounded-lg text-xs font-bold text-sky-900 bg-sky-50 hover:bg-sky-600 hover:text-white border border-sky-300 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Schedule Drying</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Inline Activity Add Modal/Form */}
        {isAddingActivity && (
          <form onSubmit={handleCreateActivity} className="p-4 sm:p-5 rounded-2xl bg-stone-50 border-2 border-emerald-300 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between text-xs font-bold text-stone-800 border-b border-stone-200 pb-2">
              <span className="flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#14532D]" />
                <span>Log New Farm Activity with Operational Details</span>
              </span>
              <button
                type="button"
                onClick={() => setIsAddingActivity(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Task Title & Operation
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Applied Potash fertilizer in North field"
                  value={newActivityTitle}
                  onChange={(e) => setNewActivityTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-[#14532D]/20 focus:border-[#14532D]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Category
                </label>
                <select
                  value={newActivityCat}
                  onChange={(e) => setNewActivityCat(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-[#14532D]/20 focus:border-[#14532D]"
                >
                  <option value="irrigation">💧 Irrigation Session</option>
                  <option value="fertilizer">🌱 Fertilizer / Micronutrient</option>
                  <option value="pest_scout">🐛 Pest Scouting / Spray</option>
                  <option value="weeding">🌿 Weeding / Soil Care</option>
                  <option value="sowing">🌾 Sowing / Transplanting</option>
                  <option value="harvest">🚜 Harvesting</option>
                </select>
              </div>
            </div>

            {/* Target Date with Quick Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-stone-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#14532D]" />
                  <span>Target Date (date)</span>
                </label>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setNewActivityDate(new Date().toISOString().slice(0, 10))}
                    className="px-2 py-0.5 rounded-md bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      setNewActivityDate(d.toISOString().slice(0, 10));
                    }}
                    className="px-2 py-0.5 rounded-md bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold cursor-pointer"
                  >
                    Tomorrow (+1d)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 4);
                      setNewActivityDate(d.toISOString().slice(0, 10));
                    }}
                    className="px-2 py-0.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold cursor-pointer"
                    title="Target fertilizer application 4 days from now"
                  >
                    +4 Days (Fertilizer)
                  </button>
                </div>
              </div>
              <input
                type="date"
                required
                value={newActivityDate}
                onChange={(e) => setNewActivityDate(e.target.value)}
                className="w-full sm:w-auto text-xs p-2 rounded-xl border border-stone-300 bg-white"
              />
              <p className="text-[10px] text-stone-500">
                You can schedule tasks for Today, set them for Upcoming dates (e.g., fertilizer application 4 days from now), or log past activities.
              </p>
            </div>

            {/* Operational Time of Day Segmented Control */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-[11px] font-bold text-stone-700">
                Operational Time of Day (timeOfDay)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    id: 'morning' as const,
                    label: 'Morning',
                    icon: Sunrise,
                    hint: 'Borewell irrigation before peak sun, canal sluice inspection.',
                    color: 'text-amber-800 border-amber-300',
                  },
                  {
                    id: 'afternoon' as const,
                    label: 'Afternoon',
                    icon: Sun,
                    hint: 'Top-dressing dry fertilizers or loosening soil for root air flow.',
                    color: 'text-orange-800 border-orange-300',
                  },
                  {
                    id: 'evening' as const,
                    label: 'Evening',
                    icon: Sunset,
                    hint: 'Direct leaf spraying (neem oil / bio-pesticides) to protect bees & pollinators.',
                    color: 'text-purple-800 border-purple-300',
                  },
                  {
                    id: 'all_day' as const,
                    label: 'All Day',
                    icon: Calendar,
                    hint: 'Hand weeding, tractor tillage, or harvesting.',
                    color: 'text-blue-800 border-blue-300',
                  },
                ].map((slot) => {
                  const Icon = slot.icon;
                  const isSelected = newActivityTimeOfDay === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setNewActivityTimeOfDay(slot.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#14532D] text-white border-[#14532D] shadow-2xs ring-2 ring-[#14532D]/20'
                          : 'bg-white hover:bg-stone-100 text-stone-800 border-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-stone-500'}`} />
                        <span>{slot.label}</span>
                      </div>
                      <p className={`text-[10px] mt-1 line-clamp-2 leading-tight ${isSelected ? 'text-emerald-100' : 'text-stone-500'}`}>
                        {slot.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration & Area Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5 text-[#14532D]" />
                  <span>Duration (Hours)</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="16"
                  required
                  placeholder="e.g. 2.5"
                  value={newActivityDuration}
                  onChange={(e) => setNewActivityDuration(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-stone-300 bg-white"
                />
                <span className="text-[10px] text-stone-500">e.g., 2.5 hours</span>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#14532D]" />
                  <span>Plot / Acreage Covered</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Zone A & B • 2.5 Acres"
                  value={newActivityArea}
                  onChange={(e) => setNewActivityArea(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-stone-300 bg-white"
                />
                <span className="text-[10px] text-stone-500">Specify which plot/acreage is covered</span>
              </div>
            </div>

            {/* Notes / Inputs used */}
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Inputs Used / Agronomic Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g. 25 kg Neem Coated Urea, soil moisture checked prior to broadcast"
                value={newActivityNotes}
                onChange={(e) => setNewActivityNotes(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-stone-300 bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setIsAddingActivity(false)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-[#14532D] text-white rounded-lg hover:bg-[#14532D]/90 shadow-2xs cursor-pointer"
              >
                Save Task to Schedule & Ledger
              </button>
            </div>
          </form>
        )}

        {/* Activity Items List */}
        <div className="divide-y divide-stone-100">
          {activities.map((act) => {
            const todayStr = new Date().toISOString().slice(0, 10);
            const isToday = act.date === todayStr;
            const isUpcoming = act.date > todayStr;
            const isPast = act.date < todayStr;

            return (
              <div
                key={act.id}
                className="py-3.5 flex items-start justify-between gap-3 group hover:bg-stone-50/80 px-2.5 rounded-2xl transition-colors"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActivity(act.id)}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                      act.completed
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-stone-300 hover:border-emerald-600 bg-white'
                    }`}
                    aria-label={act.completed ? 'Mark pending' : 'Mark completed'}
                  >
                    {act.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-bold ${
                          act.completed ? 'line-through text-stone-400' : 'text-stone-900'
                        }`}
                      >
                        {act.title}
                      </span>

                      {/* Date status badge */}
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                          Today
                        </span>
                      )}
                      {isUpcoming && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                          Upcoming ({act.date})
                        </span>
                      )}
                      {isPast && !act.completed && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                          Deferred / Overdue
                        </span>
                      )}
                    </div>

                    {act.notes && (
                      <p className="text-[11px] text-stone-600 mt-0.5 leading-snug">{act.notes}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-stone-500">
                      <span className="capitalize font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md">
                        {act.category.replace('_', ' ')}
                      </span>

                      {act.timeOfDay && (
                        <span className="inline-flex items-center gap-1 font-medium bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md">
                          {act.timeOfDay === 'morning' && <Sunrise className="w-3 h-3 text-amber-700" />}
                          {act.timeOfDay === 'afternoon' && <Sun className="w-3 h-3 text-orange-600" />}
                          {act.timeOfDay === 'evening' && <Sunset className="w-3 h-3 text-purple-700" />}
                          {act.timeOfDay === 'all_day' && <Calendar className="w-3 h-3 text-blue-700" />}
                          <span className="capitalize">{act.timeOfDay.replace('_', ' ')}</span>
                        </span>
                      )}

                      {act.durationHours && (
                        <span className="inline-flex items-center gap-1 font-medium bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md">
                          <Timer className="w-3 h-3 text-stone-500" />
                          <span>{act.durationHours} hrs</span>
                        </span>
                      )}

                      {act.areaCovered && (
                        <span className="inline-flex items-center gap-1 font-medium bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md">
                          <MapPin className="w-3 h-3 text-stone-500" />
                          <span>{act.areaCovered}</span>
                        </span>
                      )}

                      <span>•</span>
                      <span>Target: {act.date}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.setItem('agrifusion_selected_field_date', act.date);
                      } catch {}
                      onNavigate('farm-history');
                    }}
                    className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#14532D] text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    title={`Open Day Log for ${act.date}`}
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    <span>Day Log</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = deleteFarmActivity(act.id);
                      setActivities(updated);
                    }}
                    className="text-stone-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Delete task"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: ALL PREDICTIONS DONE BY THE FARMER */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>All AI Predictions & Advisory History</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Every crop advisory, irrigation schedule, market price forecast, and disease diagnosis you run is stored here.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'All Runs' },
              { id: 'crop', label: 'Crops' },
              { id: 'irrigation', label: 'Irrigation' },
              { id: 'market', label: 'Markets' },
              { id: 'climate', label: 'Climate' },
              { id: 'disease', label: 'Diseases' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPredictionFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  predictionFilter === f.id
                    ? 'bg-[#14532D] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prediction Records List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPredictions.map((pred) => {
            const pageTarget: ActivePage =
              pred.category === 'crop'
                ? 'crop-recommendation'
                : pred.category === 'irrigation'
                ? 'irrigation'
                : pred.category === 'market'
                ? 'market'
                : pred.category === 'climate'
                ? 'climate-risk'
                : pred.category === 'disease'
                ? 'disease-detection'
                : 'pipeline';

            return (
              <div
                key={pred.id}
                className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 hover:border-emerald-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-stone-900">{pred.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {pred.badge}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{pred.summary}</p>
                </div>

                <div className="mt-3 pt-3 border-t border-stone-200/60 flex items-center justify-between text-[11px] text-stone-400">
                  <span>{new Date(pred.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <button
                    type="button"
                    onClick={() => onNavigate(pageTarget)}
                    className="inline-flex items-center gap-1 font-semibold text-[#14532D] hover:underline cursor-pointer"
                  >
                    <span>Open Tool</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredPredictions.length === 0 && (
          <div className="text-center py-8 text-xs text-stone-500">
            No predictions logged under this category yet. Run a prediction from any module to see it appear here.
          </div>
        )}
      </div>

      {/* SECTION 4: QUICK ACTION SHORTCUTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigate('disease-detection')}
          className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs hover:border-emerald-400 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center mb-3">
              <Stethoscope className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-stone-900">Leaf Disease Scanner</h4>
            <p className="text-xs text-stone-500 mt-1">
              Upload photo of damaged foliage or spots to identify blast, blight, or pests.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-[#14532D]">
            <span>Scan a Leaf</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('market')}
          className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs hover:border-emerald-400 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
              <Coins className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-stone-900">Mandi Price Forecasts</h4>
            <p className="text-xs text-stone-500 mt-1">
              Live Agmarknet prices and trend projections for your harvest date.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-[#14532D]">
            <span>Check Market Trends</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('advisor')}
          className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs hover:border-emerald-400 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#14532D] flex items-center justify-center mb-3">
              <Sprout className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-stone-900">Ask CropWise Agronomist</h4>
            <p className="text-xs text-stone-500 mt-1">
              Instant answers on organic sprays, soil health, and government scheme eligibility.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-[#14532D]">
            <span>Ask a Question</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      <DisclaimerBanner
        type="advisory"
        text="All decisions shown above are advisory model estimates based on regional agro-climatic trends. Consult your local Mandal Agricultural Officer (MAO) or Rythu Bharosa Kendra."
      />
    </div>
  );
}

import {
  AlertCircle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  DollarSign,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Info,
  Layers,
  Percent,
  PieChart,
  Printer,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sprout,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { PageHeader } from '../components/Navigation';
import {
  calculateFarmEconomics,
  CROP_ECONOMIC_BENCHMARKS,
  FarmEconomicsResult,
} from '../lib/agriEconomics';
import { savePrediction } from '../lib/farmStorage';
import type { UserFarmProfile } from '../types';

import {
  CROP_VISUALS,
  EXPENSE_IMAGES,
  getCropVisual,
} from '../data/cropImages';
export { CROP_VISUALS, EXPENSE_IMAGES };

function getExpenseImage(cat: string): string {
  const lower = (cat || '').toLowerCase();
  if (lower.includes('seed')) return EXPENSE_IMAGES.seeds;
  if (lower.includes('fertilizer')) return EXPENSE_IMAGES.fertilizers;
  if (lower.includes('pest') || lower.includes('protect')) return EXPENSE_IMAGES.cropProtection;
  if (lower.includes('irrig') || lower.includes('power')) return EXPENSE_IMAGES.irrigationEnergy;
  if (lower.includes('tractor') || lower.includes('machin')) return EXPENSE_IMAGES.machinery;
  if (lower.includes('labor')) return EXPENSE_IMAGES.labor;
  return EXPENSE_IMAGES.miscInsurance;
}

export function CostProfitEstimatorView({ profile }: { profile: UserFarmProfile }) {
  const defaultCrop =
    profile.crop && CROP_ECONOMIC_BENCHMARKS[profile.crop]
      ? profile.crop
      : 'Rice';

  const defaultAreaAcres = profile.area_ha ? Number((profile.area_ha * 2.47105).toFixed(1)) : 2.5;

  const [crop, setCrop] = useState<string>(defaultCrop);
  const [areaInput, setAreaInput] = useState<number>(defaultAreaAcres);
  const [areaUnit, setAreaUnit] = useState<'acres' | 'hectares'>('acres');
  const [season, setSeason] = useState<string>('Kharif');
  const [showDictionary, setShowDictionary] = useState<boolean>(false);
  const [cropCategoryFilter, setCropCategoryFilter] = useState<string>('all');

  // Benchmark for selected crop
  const benchmark = CROP_ECONOMIC_BENCHMARKS[crop] || CROP_ECONOMIC_BENCHMARKS.Rice;
  const currentVisual = CROP_VISUALS[crop] || CROP_VISUALS.Rice;

  // Derive initial yield and price from benchmark
  const areaHa = areaUnit === 'acres' ? areaInput / 2.47105 : areaInput;
  const areaAcres = areaUnit === 'acres' ? areaInput : areaInput * 2.47105;

  const defaultYieldPerAcre = Number((benchmark.baseYieldQuintalsPerHa / 2.47105).toFixed(1));

  // Custom overrides (null means use calculated benchmark)
  const [customYieldPerAcre, setCustomYieldPerAcre] = useState<number | null>(null);
  const [customPricePerQ, setCustomPricePerQ] = useState<number | null>(null);
  const [byproductRevenue, setByproductRevenue] = useState<number>(() => Math.round(areaAcres * 1800)); // Straw/fodder
  const [costMultiplier, setCostMultiplier] = useState<number>(1.0); // 0.8x to 1.3x for input intensity
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Active yield and price
  const activeYieldPerAcre = customYieldPerAcre !== null ? customYieldPerAcre : defaultYieldPerAcre;
  const activeYieldTotalQ = Number((activeYieldPerAcre * areaAcres).toFixed(1));
  const activePricePerQ = customPricePerQ !== null ? customPricePerQ : benchmark.typicalPricePerQuintal;

  // Calculate economics using the engine
  const economics: FarmEconomicsResult = useMemo(() => {
    const raw = calculateFarmEconomics({
      crop,
      areaHa,
      expectedYieldTotalQuintals: activeYieldTotalQ,
      pricePerQuintal: activePricePerQ,
    });

    const adjustedCost = Math.round(raw.totalCost * costMultiplier);
    const adjustedCostPerAcre = Math.round(adjustedCost / (areaAcres || 1));
    const adjustedCostPerHa = Math.round(adjustedCost / (areaHa || 1));

    const adjustedCostBreakdown = raw.costBreakdown.map((item) => {
      const adjustedAmount = Math.round(item.amount * costMultiplier);
      return {
        ...item,
        amount: adjustedAmount,
      };
    });

    const totalGrossRevenue = raw.grossRevenue + byproductRevenue;
    const netProfit = totalGrossRevenue - adjustedCost;
    const netProfitPerAcre = Math.round(netProfit / (areaAcres || 1));
    const benefitCostRatio = Number((totalGrossRevenue / (adjustedCost || 1)).toFixed(2));
    const profitMarginPercent = Number(((netProfit / (totalGrossRevenue || 1)) * 100).toFixed(1));

    return {
      ...raw,
      totalCost: adjustedCost,
      costPerAcre: adjustedCostPerAcre,
      costPerHa: adjustedCostPerHa,
      costBreakdown: adjustedCostBreakdown,
      grossRevenue: totalGrossRevenue,
      netProfit,
      netProfitPerAcre,
      benefitCostRatio,
      profitMarginPercent,
      isProfitable: netProfit > 0,
    };
  }, [crop, areaHa, areaAcres, activeYieldTotalQ, activePricePerQ, byproductRevenue, costMultiplier]);

  // Break-even metrics (No-loss threshold)
  const breakEvenYieldPerAcre = useMemo(() => {
    if (activePricePerQ <= 0) return 0;
    return Number((economics.costPerAcre / activePricePerQ).toFixed(1));
  }, [economics.costPerAcre, activePricePerQ]);

  const breakEvenPricePerQ = useMemo(() => {
    if (activeYieldPerAcre <= 0) return 0;
    return Math.round(economics.costPerAcre / activeYieldPerAcre);
  }, [economics.costPerAcre, activeYieldPerAcre]);

  const handleResetToDefaults = () => {
    setCustomYieldPerAcre(null);
    setCustomPricePerQ(null);
    setCostMultiplier(1.0);
    setByproductRevenue(Math.round(areaAcres * 1800));
  };

  const handleSaveToHistory = () => {
    savePrediction({
      category: 'yield',
      title: `Crop Cost & Profit Estimate: ${crop} (${areaAcres.toFixed(1)} Acres)`,
      summary: `Estimated expenses ₹${economics.totalCost.toLocaleString()} vs sales ₹${economics.grossRevenue.toLocaleString()}. Clean Profit in Hand: ₹${economics.netProfit.toLocaleString()} (₹${economics.netProfitPerAcre.toLocaleString()}/Acre).`,
      badge: 'Cost & Profit',
      details: {
        crop,
        area_acres: Number(areaAcres.toFixed(2)),
        area_ha: Number(areaHa.toFixed(2)),
        season,
        total_cost_inr: economics.totalCost,
        cost_per_acre: economics.costPerAcre,
        expected_yield_q_per_acre: activeYieldPerAcre,
        expected_yield_q_total: activeYieldTotalQ,
        selling_price_per_q: activePricePerQ,
        gross_revenue_inr: economics.grossRevenue,
        net_profit_inr: economics.netProfit,
        net_profit_per_acre: economics.netProfitPerAcre,
        benefit_cost_ratio: economics.benefitCostRatio,
        break_even_yield_q_per_acre: breakEvenYieldPerAcre,
        break_even_price_per_q: breakEvenPricePerQ,
        created_at: new Date().toISOString(),
      },
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const handleExportCSV = () => {
    const rows = [
      ['Item', 'Value', 'Notes / Explanation'],
      ['Selected Crop', crop, currentVisual.subtitle],
      ['Cultivated Land', `${areaAcres.toFixed(1)} Acres (${areaHa.toFixed(2)} Ha)`, 'Cultivated Area'],
      ['Season', season, 'Agricultural Season'],
      ['Total Cultivation Expenses (₹)', economics.totalCost, 'Total Farming Cost'],
      ['Expenses per Acre (₹)', economics.costPerAcre, 'Cost per Acre'],
      ['Expected Harvest Yield', `${activeYieldTotalQ} Quintals (${activeYieldPerAcre} Q/Acre)`, '1 Quintal = 100 kg'],
      ['Expected Selling Price (₹/Quintal)', activePricePerQ, 'Market Selling Price'],
      ['By-product / Straw Revenue (₹)', byproductRevenue, 'Straw / Fodder Sales'],
      ['Total Expected Sales Money (₹)', economics.grossRevenue, 'Total Gross Revenue'],
      ['Clean Profit in Hand (₹)', economics.netProfit, 'Net Clean Profit'],
      ['Clean Profit per Acre (₹)', economics.netProfitPerAcre, 'Net Profit per Acre'],
      ['Money Return (Benefit-Cost Ratio)', `${economics.benefitCostRatio}:1`, 'Return per ₹1 Invested'],
      ['Break-Even Minimum Yield (Q/Acre)', breakEvenYieldPerAcre, 'Break-Even Minimum Yield'],
      ['Break-Even Minimum Price (₹/Q)', breakEvenPricePerQ, 'Break-Even Minimum Price'],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((e) => e.map((cell) => `"${cell}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `agrifusion_crop_cost_profit_${crop.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Friendly, Honest Header */}
      <PageHeader
        title="Crop Cost & Profit Calculator"
        subtitle="Easily calculate your farming expenses, expected crop sales, clean profit in your pocket, and how much harvest you need so you don't face any loss."
        badge="Farmer Guide & Calculator"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-stone-600" />
              <span>Download File (CSV)</span>
            </button>
            <button
              type="button"
              onClick={handleSaveToHistory}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14532D] text-white text-xs font-bold hover:bg-[#14532D]/90 shadow-2xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Save to My Farm Records</span>
            </button>
          </div>
        }
      />

      {savedSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-semibold">
            Saved successfully to your Farm Records & History!
          </span>
        </div>
      )}

      {/* FARMER'S SIMPLE EXPLANATION & DICTIONARY BANNER */}
      <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 text-stone-900 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-200/80 text-amber-950 flex items-center justify-center font-bold">
              <HelpCircle className="w-5 h-5 text-amber-900" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <span>Farmer's Simple Word Guide</span>
                <span className="text-[10px] bg-amber-200 text-amber-950 px-2 py-0.5 rounded-md font-bold">
                  Easy Terms
                </span>
              </h4>
              <p className="text-xs text-stone-600">
                New to these calculation terms? Tap here to see what each word means in plain, simple English.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDictionary(!showDictionary)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs font-bold text-stone-800 hover:bg-amber-100 transition-colors cursor-pointer"
          >
            <span>{showDictionary ? 'Hide Guide' : 'Explain Terms'}</span>
            {showDictionary ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showDictionary && (
          <div className="pt-3 border-t border-amber-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-white border border-amber-200/70 space-y-1">
              <span className="font-bold text-amber-950 block">1. Quintal</span>
              <p className="text-stone-600 leading-relaxed">
                <strong>1 Quintal = 100 Kilograms</strong>. This is roughly equal to 2 standard 50kg gunny bags.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-amber-200/70 space-y-1">
              <span className="font-bold text-amber-950 block">2. Acre vs Hectare</span>
              <p className="text-stone-600 leading-relaxed">
                <strong>1 Acre = 40 Guntas / Cents</strong>. 1 Hectare is equal to about <strong>2.5 Acres</strong>.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-amber-200/70 space-y-1">
              <span className="font-bold text-amber-950 block">3. Total Farming Cost</span>
              <p className="text-stone-600 leading-relaxed">
                All money spent from first plowing to harvest: tractor rent, seeds, fertilizers, pest sprays, labor wages, and diesel.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-amber-200/70 space-y-1">
              <span className="font-bold text-amber-950 block">4. Total Crop Sales</span>
              <p className="text-stone-600 leading-relaxed">
                Total cash collected when you sell all your harvested quintals in the mandi or to buyers, plus dry straw/fodder sales.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-amber-200/70 space-y-1">
              <span className="font-bold text-amber-950 block">5. Clean Profit in Hand</span>
              <p className="text-stone-600 leading-relaxed">
                <strong>Your real savings!</strong> Total money from selling the crop minus all your farming expenses.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-amber-200/70 space-y-1">
              <span className="font-bold text-amber-950 block">6. No-Loss Point (Break-Even)</span>
              <p className="text-stone-600 leading-relaxed">
                The minimum harvest (bags/quintals) or minimum rate you MUST get to break even so you do not lose any money.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 1: CROP SELECTOR WITH REAL CROP PHOTOS */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
              <Sprout className="w-4 h-4 text-[#14532D]" />
              <span>Step 1: Choose Your Crop & Farm Size</span>
            </h3>
            <p className="text-xs text-stone-500">
              Select your crop from the photo cards or dropdown below, enter your land in acres, and select your season.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetToDefaults}
            className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset to Standard Rates</span>
          </button>
        </div>

        {/* Visual Crop Selection Gallery */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="text-xs font-bold text-stone-800 block">
                Crop Selection (Tap any card to calculate economics):
              </label>
              <p className="text-[11px] text-stone-500">
                Featuring authentic regional photos of Andhra Pradesh & Telangana crops.
              </p>
            </div>
            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'all', label: 'All Crops' },
                { id: 'cereal', label: 'Cereals (Rice, Maize)' },
                { id: 'oilseed', label: 'Oilseeds (Groundnut, Soybean)' },
                { id: 'commercial', label: 'Commercial (Sugarcane, Cotton)' },
                { id: 'pulse', label: 'Pulses (Red Gram, Bengal Gram)' },
                { id: 'spices', label: 'Spices & Veg (Chilli, Tomato)' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setCropCategoryFilter(pill.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    cropCategoryFilter === pill.id
                      ? 'bg-[#14532D] text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-80 overflow-y-auto pr-1">
            {Object.keys(CROP_VISUALS).filter((cropName) => {
              if (cropCategoryFilter === 'all') return true;
              const info = CROP_VISUALS[cropName];
              const cat = (info.category || '').toLowerCase();
              if (cropCategoryFilter === 'cereal') return cat.includes('cereal');
              if (cropCategoryFilter === 'oilseed') return cat.includes('oilseed');
              if (cropCategoryFilter === 'commercial') return cat.includes('commercial');
              if (cropCategoryFilter === 'pulse') return cat.includes('pulse');
              if (cropCategoryFilter === 'spices') return cat.includes('spice') || cat.includes('horticulture');
              return true;
            }).map((cropName) => {
              const info = CROP_VISUALS[cropName];
              const isSelected = crop === cropName;
              return (
                <button
                  key={cropName}
                  type="button"
                  onClick={() => {
                    setCrop(cropName);
                    setCustomYieldPerAcre(null);
                    setCustomPricePerQ(null);
                  }}
                  className={`group relative overflow-hidden rounded-2xl border text-left transition-all p-2 flex flex-col items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'border-[#14532D] ring-2 ring-[#14532D] bg-emerald-50/70 shadow-xs'
                      : 'border-stone-200 hover:border-emerald-300 hover:shadow-xs bg-white'
                  }`}
                >
                  <div className="relative w-full h-20 sm:h-22 rounded-xl overflow-hidden bg-stone-100">
                    <img
                      src={info.image}
                      alt={cropName}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/crops/rice.jpg';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {info.category && (
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-stone-900/80 text-white backdrop-blur-xs">
                        {info.category}
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white shadow-xs">
                        ✓ Active
                      </span>
                    )}
                  </div>
                  <div className="text-center w-full">
                    <span className="font-extrabold text-xs text-stone-900 block truncate">{cropName}</span>
                    {info.localTelugu ? (
                      <span className="text-[10px] font-semibold text-emerald-800 block truncate">
                        {info.localTelugu}
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-500 block truncate">{info.subtitle}</span>
                    )}
                    {info.typicalYield && (
                      <span className="text-[9px] text-stone-500 block truncate mt-0.5">
                        {info.typicalYield}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Dropdown and Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Dropdown for All Crops */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-700">All Crops</label>
            <select
              value={crop}
              onChange={(e) => {
                setCrop(e.target.value);
                setCustomYieldPerAcre(null);
                setCustomPricePerQ(null);
              }}
              className="w-full text-xs font-semibold p-2.5 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-[#14532D]/30"
            >
              {Object.keys(CROP_ECONOMIC_BENCHMARKS).map((c) => (
                <option key={c} value={c}>
                  {c} {CROP_VISUALS[c] ? `• ${CROP_VISUALS[c].subtitle}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Land Area with Units */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-700">Land Area</label>
              <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-50 text-[10px]">
                <button
                  type="button"
                  onClick={() => setAreaUnit('acres')}
                  className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                    areaUnit === 'acres' ? 'bg-[#14532D] text-white' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Acres
                </button>
                <button
                  type="button"
                  onClick={() => setAreaUnit('hectares')}
                  className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                    areaUnit === 'hectares' ? 'bg-[#14532D] text-white' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Hectares
                </button>
              </div>
            </div>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="500"
              value={areaInput}
              onChange={(e) => setAreaInput(Math.max(0.1, Number(e.target.value) || 1))}
              className="w-full text-xs font-bold p-2.5 rounded-xl border border-stone-300 bg-white"
            />
            <p className="text-[10px] text-stone-500">
              ≈ {areaUnit === 'acres' ? `${areaHa.toFixed(2)} Hectares` : `${areaAcres.toFixed(2)} Acres`}
            </p>
          </div>

          {/* Season Selector */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-700">Season</label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full text-xs font-semibold p-2.5 rounded-xl border border-stone-300 bg-white"
            >
              <option value="Kharif">Kharif (Monsoon Season)</option>
              <option value="Rabi">Rabi (Winter Season)</option>
              <option value="Summer">Summer Season</option>
            </select>
          </div>
        </div>

        {/* Selected Crop Visual Banner with Enhanced Metadata */}
        <div className="p-4 sm:p-5 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-22 h-22 sm:w-26 sm:h-26 rounded-2xl overflow-hidden shadow-xs border-2 border-emerald-600/30 shrink-0">
            <img
              src={currentVisual.image}
              alt={crop}
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/crops/rice.jpg';
              }}
              className="w-full h-full object-cover"
            />
            {currentVisual.category && (
              <span className="absolute bottom-1 inset-x-1 bg-stone-950/80 text-white text-[9px] font-bold text-center py-0.5 rounded backdrop-blur-xs">
                {currentVisual.category}
              </span>
            )}
          </div>
          <div className="space-y-1.5 text-center sm:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h4 className="text-lg font-extrabold text-stone-900">{crop}</h4>
              {currentVisual.localTelugu && (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-md">
                  {currentVisual.localTelugu}
                </span>
              )}
              {currentVisual.localHindi && (
                <span className="text-[11px] font-medium text-stone-600 bg-stone-200/70 px-2 py-0.5 rounded-md">
                  {currentVisual.localHindi}
                </span>
              )}
              <span className="text-[11px] text-stone-700 bg-white border border-stone-200 px-2 py-0.5 rounded-md font-medium">
                ⏱️ Duration: {currentVisual.duration}
              </span>
              {currentVisual.typicalYield && (
                <span className="text-[11px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  🌾 Expected Yield: {currentVisual.typicalYield}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              {currentVisual.seasonInfo}. Showing calculated expenses & projected revenue for <strong>{areaAcres.toFixed(1)} Acres</strong> in <strong>{profile.district}</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 2: THE 3 BIG FINANCIAL RESULT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Cultivation Cost */}
        <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-600">
              Total Farming Cost
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 text-stone-700">
              All Expenses
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-stone-900">
            ₹{economics.totalCost.toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-500">
            Seeds, fertilizers, tractor rent, labor wages, sprays & harvesting.
          </p>
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-700 font-semibold">
            <span>₹{economics.costPerAcre.toLocaleString()} / Acre</span>
            <span>₹{economics.costPerHa.toLocaleString()} / Hectare</span>
          </div>
        </div>

        {/* Card 2: Total Crop Sales Money */}
        <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-600">
              Crop Sales Money
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Harvest + Straw
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-stone-900">
            ₹{economics.grossRevenue.toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-500">
            {activeYieldTotalQ} Quintals total (1Q = 100 kg) @ ₹{activePricePerQ.toLocaleString()}/Q.
          </p>
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-700 font-semibold">
            <span>{activeYieldPerAcre} Quintals / Acre</span>
            <span>+₹{byproductRevenue.toLocaleString()} Straw Sales</span>
          </div>
        </div>

        {/* Card 3: Clean Profit in Hand */}
        <div
          className={`p-5 rounded-3xl border shadow-xs space-y-2 relative overflow-hidden ${
            economics.isProfitable
              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
              : 'bg-rose-50/90 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">
              {economics.isProfitable ? 'Clean Profit in Hand' : 'Estimated Deficit'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                economics.isProfitable
                  ? 'bg-emerald-200 text-emerald-900'
                  : 'bg-rose-200 text-rose-900'
              }`}
            >
              {economics.isProfitable ? 'Profit' : 'Deficit'}
            </span>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-black ${
              economics.isProfitable ? 'text-emerald-900' : 'text-rose-900'
            }`}
          >
            {economics.isProfitable ? '+' : ''}₹{economics.netProfit.toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-600">
            Clean money left in your pocket after paying back all farming debts & costs.
          </p>
          <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs font-bold">
            <span>
              {economics.isProfitable ? '+' : ''}₹{economics.netProfitPerAcre.toLocaleString()} / Acre Profit
            </span>
            <span>
              ₹{Math.round(economics.benefitCostRatio * 100)} return per ₹100 invested
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3: YIELD & PRICE OVERRIDE SLIDERS */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#14532D]" />
              <span>Step 2: Adjust Harvest Yield & Selling Rate</span>
            </h3>
            <p className="text-xs text-stone-500">
              Drag the sliders if you expect higher or lower bags/quintals, or different market prices.
            </p>
          </div>
          <span className="text-[11px] font-bold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
            Govt MSP: ₹{benchmark.msp.toLocaleString()} / Quintal
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Harvest Yield Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-stone-500" />
                <span>Expected Harvest per Acre</span>
              </label>
              <div className="text-xs font-extrabold text-[#14532D]">
                {activeYieldPerAcre} Quintals/Acre
                <span className="text-stone-500 font-normal ml-1">
                  (Total: {activeYieldTotalQ} Quintals)
                </span>
              </div>
            </div>
            <input
              type="range"
              min={Math.max(1, Math.round(defaultYieldPerAcre * 0.4))}
              max={Math.round(defaultYieldPerAcre * 2.2)}
              step="0.5"
              value={activeYieldPerAcre}
              onChange={(e) => setCustomYieldPerAcre(Number(e.target.value))}
              className="w-full accent-[#14532D] cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-stone-400">
              <span>Low: {(defaultYieldPerAcre * 0.5).toFixed(1)} Q</span>
              <span className="text-stone-700 font-bold">
                Normal: {defaultYieldPerAcre} Q
              </span>
              <span>High: {(defaultYieldPerAcre * 1.8).toFixed(1)} Q</span>
            </div>
            <p className="text-[10px] text-stone-500">
              💡 1 Quintal = 100 kg. Example: 20 Quintals = 2,000 kg (approx 40 standard bags).
            </p>
          </div>

          {/* Mandi Sale Price Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-stone-500" />
                <span>Selling Price per Quintal (₹)</span>
              </label>
              <div className="text-xs font-extrabold text-[#14532D]">
                ₹{activePricePerQ.toLocaleString()} / Quintal
              </div>
            </div>
            <input
              type="range"
              min={Math.round(benchmark.msp * 0.6)}
              max={Math.round(benchmark.typicalPricePerQuintal * 1.8)}
              step="50"
              value={activePricePerQ}
              onChange={(e) => setCustomPricePerQ(Number(e.target.value))}
              className="w-full accent-[#14532D] cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-stone-400">
              <span>₹{Math.round(benchmark.msp * 0.7).toLocaleString()}</span>
              <span className="text-emerald-800 font-bold">
                Govt MSP: ₹{benchmark.msp.toLocaleString()}
              </span>
              <span>₹{Math.round(benchmark.typicalPricePerQuintal * 1.6).toLocaleString()}</span>
            </div>
            <p className="text-[10px] text-stone-500">
              💡 Rate in mandi or local trader. Sell above Govt MSP to protect your profits.
            </p>
          </div>
        </div>

        {/* Input Cost Intensity Slider & By-product Revenue */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-stone-100">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-stone-800">
              <span>Farming Expense Level</span>
              <span className="text-stone-900">
                {costMultiplier === 1.0
                  ? 'Normal Cost (100%)'
                  : costMultiplier < 1.0
                  ? `Low Cost (${Math.round(costMultiplier * 100)}%)`
                  : `High Inputs (${Math.round(costMultiplier * 100)}%)`}
              </span>
            </div>
            <input
              type="range"
              min="0.75"
              max="1.35"
              step="0.05"
              value={costMultiplier}
              onChange={(e) => setCostMultiplier(Number(e.target.value))}
              className="w-full accent-[#14532D] cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-stone-400">
              <span>Low Cost (75%)</span>
              <span>Normal (100%)</span>
              <span>High Inputs (135%)</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-stone-800">
              <span>Straw / Fodder Sales (₹)</span>
              <span className="text-stone-900 font-bold">₹{byproductRevenue.toLocaleString()}</span>
            </div>
            <input
              type="number"
              min="0"
              max="100000"
              step="500"
              value={byproductRevenue}
              onChange={(e) => setByproductRevenue(Math.max(0, Number(e.target.value) || 0))}
              className="w-full text-xs font-semibold p-2 rounded-xl border border-stone-300 bg-white"
              placeholder="Straw, husk, or fodder value in rupees"
            />
            <p className="text-[10px] text-stone-500">
              Paddy straw or maize stalks sold to cattle and dairy owners.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: NO-LOSS THRESHOLDS & MARKET SCENARIOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* No-loss check */}
        <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-emerald-800" />
              <span>No-Loss Safety Check (Break-Even)</span>
            </h4>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
              Safe Target
            </span>
          </div>
          <p className="text-xs text-stone-600">
            How much harvest or minimum price you MUST reach just to clear your costs without losing money:
          </p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80">
              <span className="text-[11px] font-semibold text-stone-600 block">
                Minimum Yield Needed
              </span>
              <span className="text-base sm:text-lg font-bold text-stone-900">
                {breakEvenYieldPerAcre} Q / Acre
              </span>
              <span className="text-[10px] text-stone-500 block mt-0.5">
                Your current yield: {activeYieldPerAcre} Q/Acre
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80">
              <span className="text-[11px] font-semibold text-stone-600 block">
                Minimum Rate Needed
              </span>
              <span className="text-base sm:text-lg font-bold text-stone-900">
                ₹{breakEvenPricePerQ.toLocaleString()} / Quintal
              </span>
              <span className="text-[10px] text-stone-500 block mt-0.5">
                Your current price: ₹{activePricePerQ.toLocaleString()}/Q
              </span>
            </div>
          </div>

          <div
            className={`text-xs p-3 rounded-xl border flex items-center gap-2 ${
              activeYieldPerAcre >= breakEvenYieldPerAcre
                ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                : 'bg-rose-50 text-rose-950 border-rose-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700" />
            <span>
              {activeYieldPerAcre >= breakEvenYieldPerAcre
                ? `Safe Status: Your expected yield is ${(activeYieldPerAcre - breakEvenYieldPerAcre).toFixed(1)} quintals above break-even. You are projected to make a profit.`
                : `Attention Needed: Your expected yield is ${(breakEvenYieldPerAcre - activeYieldPerAcre).toFixed(1)} quintals below break-even. Increase yield or selling rate to prevent a deficit.`}
            </span>
          </div>
        </div>

        {/* Market Scenarios */}
        <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-800" />
              <span>What if Market Rates Change?</span>
            </h4>
            <span className="text-[10px] font-bold bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md">
              Outlook
            </span>
          </div>
          <p className="text-xs text-stone-600">
            How your clean profit changes if mandi prices go up or down:
          </p>

          <div className="space-y-2 pt-1">
            {/* Favorable */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                <span className="font-semibold text-emerald-950">
                  If Price Increases by +15%
                </span>
              </div>
              <span className="font-bold text-emerald-900">
                +₹{Math.round(economics.netProfit + activeYieldTotalQ * activePricePerQ * 0.15).toLocaleString()} Profit
              </span>
            </div>

            {/* Baseline */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-stone-600" />
                <span className="font-semibold text-stone-900">
                  Normal Expected Price
                </span>
              </div>
              <span className="font-bold text-stone-900">
                {economics.isProfitable ? '+' : ''}₹{economics.netProfit.toLocaleString()} Profit
              </span>
            </div>

            {/* Stressed */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-3.5 h-3.5 text-amber-700" />
                <span className="font-semibold text-amber-950">
                  If Price Drops by -15%
                </span>
              </div>
              <span className="font-bold text-amber-950">
                {economics.netProfit - activeYieldTotalQ * activePricePerQ * 0.15 > 0 ? '+' : ''}
                ₹{Math.round(economics.netProfit - activeYieldTotalQ * activePricePerQ * 0.15).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: ITEMIZED FARM EXPENSE BREAKDOWN WITH VISUAL ICONS & EXPLANATIONS */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#14532D]" />
              <span>Step 3: Where Does the Money Go?</span>
            </h3>
            <p className="text-xs text-stone-500">
              Complete breakdown of what is spent on tractor, seeds, fertilizers, spraying, and labor.
            </p>
          </div>
          <span className="text-xs font-extrabold text-stone-900 bg-stone-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
            Total Cost: ₹{economics.totalCost.toLocaleString()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 text-stone-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Farming Head</th>
                <th className="py-2.5 px-3">What is Included</th>
                <th className="py-2.5 px-3 text-right">Share (%)</th>
                <th className="py-2.5 px-3 text-right">Cost / Acre</th>
                <th className="py-2.5 px-3 text-right">Total Farm Expense</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {economics.costBreakdown.map((item, idx) => {
                const itemPerAcre = Math.round(item.amount / (areaAcres || 1));
                return (
                  <tr key={idx} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-stone-900">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getExpenseImage(item.category)}
                          alt={item.category}
                          className="w-9 h-9 rounded-xl object-cover border border-stone-200 shadow-xs shrink-0 bg-stone-100"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/expenses/miscInsurance.jpg';
                          }}
                        />
                        <span>{item.category}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-stone-600">
                      {item.description}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-stone-600">
                      {item.percentage}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-stone-800 font-medium">
                      ₹{itemPerAcre.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-stone-900">
                      ₹{item.amount.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300 font-bold bg-stone-50 text-stone-900">
                <td className="py-3 px-3" colSpan={2}>
                  Total Farming Cultivation Cost
                </td>
                <td className="py-3 px-3 text-right font-mono">100%</td>
                <td className="py-3 px-3 text-right text-stone-900">
                  ₹{economics.costPerAcre.toLocaleString()} / Acre
                </td>
                <td className="py-3 px-3 text-right text-sm text-[#14532D] font-black">
                  ₹{economics.totalCost.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Honest, helpful notice without fake certifications */}
      <div className="p-4 rounded-2xl bg-stone-100/80 border border-stone-200 text-stone-600 text-xs flex items-start gap-2.5">
        <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Farmer Note:</strong> These calculations are based on standard average farm expenses and yields across the region. Actual input shop prices, tractor rental charges, and labor wages may vary depending on your village, rainfall, and market conditions. Always verify mandi prices before selling.
        </p>
      </div>
    </div>
  );
}

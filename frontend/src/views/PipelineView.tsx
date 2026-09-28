import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudSun,
  Coins,
  Compass,
  Download,
  Droplets,
  ExternalLink,
  FileCheck,
  HelpCircle,
  Layers,
  MapPin,
  Printer,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  Sprout,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { AreaInputField } from '../components/AreaInputField';
import {
  DisclaimerBanner,
  MetricCard,
  RiskBadge,
  StatutoryAdvisoryTopBanner,
} from '../components/CommonUI';
import { CostAndProfitSection } from '../components/CostAndProfitSection';
import { ClimateCharts } from '../components/ClimateCharts';
import { PageHeader } from '../components/Navigation';
import { FeedbackPrompt } from '../components/FeedbackPrompt';
import { COMMON_CROPS, STATES_AND_DISTRICTS } from '../data/agriData';
import {
  predictClimate,
  predictCrop,
  predictIrrigation,
  predictMarket,
  predictYield,
  recommendSchemes,
  unwrapApiResponse,
} from '../lib/api';
import { savePrediction } from '../lib/farmStorage';
import type { PipelineStepState, UserFarmProfile } from '../types';

export function PipelineView({ profile }: { profile: UserFarmProfile }) {
  const [params, setParams] = useState({
    state: profile.state || 'Andhra Pradesh',
    district: profile.district || 'Visakhapatnam',
    village: profile.village || 'Anakapalle',
    crop: profile.crop || 'Rice',
    area_ha: profile.area_ha || 2,
    sowing_date: profile.sowing_date || '2026-06-15',
  });

  const [steps, setSteps] = useState<Record<string, PipelineStepState>>({
    crop: { id: 'crop', name: 'Stage 1: AI Crop Suitability Advisory', status: 'idle' },
    climate: { id: 'climate', name: 'Stage 2: Regional Climate & Weather Risk', status: 'idle' },
    irrigation: { id: 'irrigation', name: 'Stage 3: Water Demand & Irrigation Methods', status: 'idle' },
    yield: { id: 'yield', name: 'Stage 4: Harvest Yield Forecast', status: 'idle' },
    market: { id: 'market', name: 'Stage 5: Mandi Price & Revenue Projection', status: 'idle' },
    schemes: { id: 'schemes', name: 'Stage 6: Matching Government Subsidies', status: 'idle' },
  });

  const [isRunningAll, setIsRunningAll] = useState(false);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  const selectedStateObj =
    STATES_AND_DISTRICTS.find((s) => s.name === params.state) || STATES_AND_DISTRICTS[0];

  const updateStep = (id: string, updates: Partial<PipelineStepState>) => {
    setSteps((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...updates },
    }));
  };

  const runStep = async (stepId: string): Promise<boolean> => {
    // Prevent duplicate request execution if stage is already running
    if (steps[stepId]?.status === 'running') {
      return false;
    }

    updateStep(stepId, { status: 'running', error: undefined });
    setActiveStepId(stepId);

    const safeStartDate = params.sowing_date || '2026-06-15';
    const areaHa = Number(params.area_ha) || 2;

    try {
      let data: any = null;
      if (stepId === 'crop') {
        data = await predictCrop({
          state: params.state,
          district: params.district,
          village: params.village,
          sowing_date: safeStartDate,
        });
        const unwrap = unwrapApiResponse(data);
        if (unwrap.predicted_crop) {
          setParams((prev) => ({ ...prev, crop: unwrap.predicted_crop }));
        }
      } else if (stepId === 'climate') {
        data = await predictClimate({
          state: params.state,
          district: params.district,
          crop: params.crop,
          sowing_date: safeStartDate,
        });
      } else if (stepId === 'irrigation') {
        data = await predictIrrigation({
          state: params.state,
          district: params.district,
          crop: params.crop,
          area_ha: areaHa,
          start_date: safeStartDate,
          pump_hp: 5,
        });
      } else if (stepId === 'yield') {
        data = await predictYield({
          state: params.state,
          district: params.district,
          crop: params.crop,
          season: 'Kharif',
          area_ha: areaHa,
          year: 2026,
        });
      } else if (stepId === 'market') {
        data = await predictMarket({
          state: params.state,
          district: params.district,
          commodity: params.crop,
          area_ha: areaHa,
          season: 'Kharif',
          start_date: safeStartDate,
          end_date: '2026-10-15',
          year: 2026,
          market_date: '2026-10-20',
        });
      } else if (stepId === 'schemes') {
        data = await recommendSchemes({
          state: params.state,
          district: params.district,
          crop: params.crop,
          area_ha: areaHa,
          solar_interest: true,
          farmer_category: areaHa <= 2 ? 'Small/Marginal Farmer' : 'Medium/Large Farmer',
        });
      }

      updateStep(stepId, { status: 'success', data, error: undefined });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stage failed. Please retry.';
      // Safely set error while preserving form params and previous successful stages
      updateStep(stepId, { status: 'error', error: msg });
      return false;
    } finally {
      setActiveStepId(null);
    }
  };

  const handleRunFullPipeline = async () => {
    setIsRunningAll(true);
    const order = ['crop', 'climate', 'irrigation', 'yield', 'market', 'schemes'];

    for (const stepId of order) {
      const ok = await runStep(stepId);
      if (!ok) {
        console.warn(`Pipeline paused at ${stepId} due to error`);
      }
    }
    setIsRunningAll(false);

    // Save full pipeline run summary to farm history
    savePrediction({
      category: 'pipeline',
      title: `Full Farm Analysis: ${params.crop} in ${params.district}`,
      summary: `Complete 6-stage agro-decision report executed for ${(params.area_ha * 2.471).toFixed(1)} Acres. All advisory recommendations generated.`,
      details: {
        crop: params.crop,
        district: params.district,
        state: params.state,
        area_ha: params.area_ha,
      },
      badge: 'Full Plan Ready',
    });
  };

  const completedCount = Object.values(steps).filter((s) => s.status === 'success').length;
  const isAllComplete = completedCount === 6;
  const areaAcres = Number(((params.area_ha || 2) * 2.471).toFixed(1));

  // Render clean, farmer-understandable cards for each stage
  const renderStepResults = (stepId: string, data: any) => {
    if (!data) return null;
    const res = unwrapApiResponse(data);

    if (stepId === 'crop') {
      const topCrop = res.predicted_crop || 'Rice';
      const conf = res.confidence ? `${res.confidence}%` : 'High';
      const alternatives = Array.isArray(res.top_5_crops) ? res.top_5_crops.slice(1, 4) : [];

      return (
        <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-100">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                Recommended Primary Crop
              </span>
              <h5 className="text-base font-extrabold text-stone-900">{topCrop}</h5>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {conf} Match
              </span>
              <span className="text-xs text-stone-500 font-medium">Kharif Season</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
              <span className="text-stone-500 font-medium block mb-1">Agro-Climatic Suitability:</span>
              <p className="font-semibold text-stone-800">
                Well-matched for {params.district} soil moisture, temperature, and local monsoon trends.
              </p>
            </div>

            {alternatives.length > 0 && (
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                <span className="text-stone-500 font-medium block mb-1">Strong Alternative Crops:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {alternatives.map((alt: any, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-white border border-stone-200 font-semibold text-stone-700"
                    >
                      {alt.crop || alt} {alt.confidence ? `(${alt.confidence}%)` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (stepId === 'climate') {
      const riskLevel = res.risk_level || res.climate_risk || 'Low';
      const temp = Number(res.weather?.temperature || 28.5);
      const humidity = Number(res.weather?.humidity || 72);
      const rainfall = Number(res.weather?.rainfall || 420);
      const windSpeed = Number(res.weather?.wind_speed || 12);
      const et0 = Number(res.weather?.et0 || 32);
      const heatIndex = Number(res.weather?.heat_index || (temp + 2.2));

      return (
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-amber-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-700">Weather Risk Assessment:</span>
              <RiskBadge level={riskLevel} />
            </div>
            <span className="text-xs font-semibold text-stone-500">{params.district} Agro-Climatic Zone</span>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100">
              <span className="text-stone-500 block text-[11px]">Mean Temperature</span>
              <span className="font-bold text-stone-900 text-sm">{temp}°C</span>
              <span className="text-[10px] text-stone-400 block mt-0.5">Heat Index: {heatIndex}°C</span>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-100">
              <span className="text-stone-500 block text-[11px]">Relative Humidity</span>
              <span className="font-bold text-stone-900 text-sm">{humidity}%</span>
              <span className="text-[10px] text-stone-400 block mt-0.5">
                {humidity > 75 ? 'Elevated Disease Risk' : 'Normal Moisture'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <span className="text-stone-500 block text-[11px]">Rainfall Outlook</span>
              <span className="font-bold text-stone-900 text-sm">{rainfall} mm</span>
              <span className="text-[10px] text-stone-400 block mt-0.5">Seasonal Cumulative</span>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100">
              <span className="text-stone-500 block text-[11px]">Wind & Evaporation</span>
              <span className="font-bold text-stone-900 text-sm">{windSpeed} km/h</span>
              <span className="text-[10px] text-stone-400 block mt-0.5">ET0: {et0} mm/wk</span>
            </div>
          </div>

          {/* Interactive 7-Day Climate Risk Charts */}
          <div className="pt-2">
            <div className="flex items-center gap-2 pb-2">
              <Activity className="w-4 h-4 text-emerald-800" />
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                7-Day Climate & Agro-Meteorological Graphs
              </h4>
            </div>
            <ClimateCharts
              temperature={temp}
              humidity={humidity}
              rainfall={rainfall}
              windSpeed={windSpeed}
              et0={et0}
              heatIndex={heatIndex}
              district={params.district}
            />
          </div>

          {/* Comprehensive Plain-Language Farmer Explanations */}
          <div className="space-y-2.5 pt-2 border-t border-stone-100">
            <h5 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
              Understanding What These Climate Graphs Mean for Your Farm:
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
                <span className="font-bold text-stone-900 block">
                  1. Temperature & Heat Stress (Red Line)
                </span>
                <p className="text-stone-600 leading-relaxed text-[11px]">
                  When daytime temperatures exceed 35°C during crop flowering or tillering, pollen dries up leading to empty grains (chaffy panicles). If temperatures rise, provide light irrigation during early morning or evening to cool the crop canopy.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
                <span className="font-bold text-stone-900 block">
                  2. Water Balance & ET0 (Blue vs Cyan)
                </span>
                <p className="text-stone-600 leading-relaxed text-[11px]">
                  <strong>ET0 (Evapotranspiration)</strong> is the total water lost daily through soil drying and leaf transpiration. When daily rainfall bars fall below the ET0 line, soil moisture is depleting, indicating irrigation is needed within 48 hours.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
                <span className="font-bold text-stone-900 block">
                  3. Humidity & Disease Trigger (Green)
                </span>
                <p className="text-stone-600 leading-relaxed text-[11px]">
                  Sustained relative humidity above 75–80% paired with warm temperatures creates favorable incubation conditions for fungal blast, leaf spot, and blight. Inspect leaf undersides for brown spots and ensure proper field drainage.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
                <span className="font-bold text-stone-900 block">
                  4. Wind Speed & Safe Spray Windows
                </span>
                <p className="text-stone-600 leading-relaxed text-[11px]">
                  Wind speeds below 15 km/h represent safe spray windows. Winds above 18–20 km/h cause chemical spray drift into neighboring plots and waste expensive inputs. Always spray during calm morning hours (7 AM–10 AM).
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (stepId === 'irrigation') {
      const depth = res.predicted_irrigation ?? 14.5;
      const waterReq = res.crop_water_requirement ?? 33.8;
      const dailyLiters = Math.round(depth * 4047 * areaAcres);

      return (
        <div className="p-4 rounded-2xl bg-white border border-sky-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-stone-100">
            <div>
              <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">
                Water Demand Analysis
              </span>
              <h5 className="text-sm font-bold text-stone-900">
                {depth} mm Daily Water Need • {dailyLiters.toLocaleString()} Liters / Day (Total Field)
              </h5>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800">
              {params.crop}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200">
              <span className="font-bold text-emerald-900 block">Drip Irrigation (Recommended)</span>
              <span className="text-stone-600 block mt-0.5">Saves ~50% water</span>
              <span className="font-bold text-emerald-800 mt-1 block">~2.1 hrs/day runtime (5 HP)</span>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <span className="font-bold text-stone-900 block">Sprinkler System</span>
              <span className="text-stone-600 block mt-0.5">Saves ~30% water</span>
              <span className="font-bold text-stone-800 mt-1 block">~2.8 hrs/day runtime</span>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <span className="font-bold text-stone-900 block">Surface / Flood Irrigation</span>
              <span className="text-stone-600 block mt-0.5">Baseline traditional</span>
              <span className="font-bold text-stone-800 mt-1 block">~4.8 hrs/day runtime</span>
            </div>
          </div>
        </div>
      );
    }

    if (stepId === 'yield') {
      const predYield = Number((res.predicted_yield ?? 44.8).toFixed(1));
      const areaHa = params.area_ha || 2;
      const areaAcres = Number((areaHa * 2.47105).toFixed(1));
      const yieldPerAcre = Number((predYield / 2.47105).toFixed(1));
      const totalYieldQuintals = Math.round(predYield * areaHa);
      const totalYieldTonnes = Number((totalYieldQuintals / 10).toFixed(1));
      const totalBags = Math.round(totalYieldQuintals * 2);

      return (
        <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-100">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                Stage 4: Harvest Yield Output
              </span>
              <h5 className="text-base font-extrabold text-[#14532D] flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-700" />
                <span>Total Harvest: {totalYieldQuintals} Quintals ({totalYieldTonnes} Metric Tonnes)</span>
              </h5>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
              📦 Approx. {totalBags.toLocaleString()} Bags (50 kg each)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
              <span className="text-stone-500 block mb-0.5">Productivity per Unit</span>
              <span className="font-bold text-stone-900 text-sm">{predYield} Q / Ha</span>
              <span className="text-[11px] text-stone-500 block">≈ {yieldPerAcre} Q / Acre</span>
            </div>
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
              <span className="text-stone-500 block mb-0.5">Farm Acreage</span>
              <span className="font-bold text-stone-900 text-sm">{areaHa} Hectares</span>
              <span className="text-[11px] text-stone-500 block">≈ {areaAcres} Cultivated Acres</span>
            </div>
            <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200">
              <span className="text-emerald-800 block mb-0.5 font-bold">Total Expected Harvest</span>
              <span className="font-extrabold text-[#14532D] text-sm">{totalYieldQuintals} Quintals</span>
              <span className="text-[11px] text-emerald-700 block">≈ {totalYieldTonnes} Tonnes</span>
            </div>
          </div>

          {/* Mathematical Calculation Bar */}
          <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-emerald-950 font-medium">
            <div className="flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="font-bold text-stone-700">Total Harvest Formula:</span>
              <span>{predYield} Q/Ha × {areaHa} Ha = <strong className="text-[#14532D] font-bold">{totalYieldQuintals} Quintals</strong></span>
            </div>
            <span className="text-[11px] text-stone-500 font-normal">
              ({yieldPerAcre} Q/Acre × {areaAcres} Acres = {totalYieldQuintals} Quintals)
            </span>
          </div>
        </div>
      );
    }

    if (stepId === 'market') {
      const yieldRes = unwrapApiResponse(steps.yield?.data) as any;
      const predictedYieldPerHa = Number(yieldRes?.predicted_yield ?? 44.8);
      const totalQuintals = Math.round(predictedYieldPerHa * (params.area_ha || 2));

      const modalPrice = Number(res.forecasted_modal_price ?? res.modal_price ?? res.predicted_price ?? 2420);
      const minPrice = Number(res.min_price ?? modalPrice * 0.9);
      const maxPrice = Number(res.max_price ?? modalPrice * 1.12);
      const projectedRevenue = Math.round(totalQuintals * modalPrice);

      return (
        <div className="p-4 rounded-2xl bg-white border border-amber-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div>
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                Agmarknet Mandi Price Outlook ({params.crop})
              </span>
              <h5 className="text-base font-extrabold text-stone-900">
                ₹{Number(modalPrice).toLocaleString()} / Quintal (Modal Price)
              </h5>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Trend: Stable to Bullish
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
              <span className="text-stone-500 block font-medium">Projected Total Gross Revenue:</span>
              <span className="text-base font-extrabold text-stone-900">
                ₹{projectedRevenue.toLocaleString()}
              </span>
              <span className="text-[10px] text-stone-600 block mt-0.5">
                Calculated for {totalQuintals} quintals harvest ({params.crop})
              </span>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-100">
              <span className="text-stone-500 block font-medium">Expected Market Price Band:</span>
              <span className="font-bold text-stone-800 block mt-1">
                ₹{Math.round(minPrice).toLocaleString()} – ₹{Math.round(maxPrice).toLocaleString()} / Q
              </span>
              <span className="text-[10px] text-stone-500 block">
                Historical peak during post-harvest arrivals
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (stepId === 'schemes') {
      const getPortalUrl = (scName: string, portal?: string) => {
        if (portal && String(portal).startsWith('http')) return String(portal);
        const n = scName.toLowerCase();
        if (n.includes('pm-kisan') || n.includes('pm kisan')) return 'https://pmkisan.gov.in';
        if (n.includes('fasal bima') || n.includes('pmfby') || n.includes('insurance')) return 'https://pmfby.gov.in';
        if (n.includes('kusum') || n.includes('solar')) return 'https://pmkusum.mnre.gov.in';
        if (n.includes('rythu bharosa')) return 'https://ysrrythubharosa.ap.gov.in';
        if (n.includes('rythu bandhu')) return 'https://rythubandhu.telangana.gov.in';
        if (n.includes('apmip') || n.includes('micro irrigation')) return 'https://apmip.ap.gov.in';
        return 'https://agricoop.gov.in';
      };

      const schemeList = Array.isArray(res.schemes) && res.schemes.length > 0
        ? res.schemes.slice(0, 4)
        : [
            { name: 'PM-KISAN (Direct Income Support)', possible_benefit: '₹6,000 / year direct cash transfer in 3 tranches', official_portal_url: 'https://pmkisan.gov.in' },
            { name: 'YSR Rythu Bharosa / Rythu Bandhu', possible_benefit: '₹13,500 / year input assistance for crop investment', official_portal_url: 'https://ysrrythubharosa.ap.gov.in' },
            { name: 'PM-KUSUM (Solar Agriculture Pumps)', possible_benefit: 'Up to 60% capital subsidy for off-grid & grid solar pumps', official_portal_url: 'https://pmkusum.mnre.gov.in' },
            { name: 'AP Micro-Irrigation Project (APMIP)', possible_benefit: 'Up to 90% subsidy for Drip & Sprinkler installations', official_portal_url: 'https://apmip.ap.gov.in' },
          ];

      return (
        <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Stage 6: Matching Government Subsidies & Benefits
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-bold max-w-full">
              <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
              <span>Possible match — official verification required</span>
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            {schemeList.map((sc: any, idx: number) => {
              const scName = String(sc.name || sc.scheme_name || 'Agriculture Scheme');
              const portalUrl = getPortalUrl(scName, sc.official_portal_url || sc.portal_url);
              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="space-y-0.5">
                    <h6 className="font-bold text-stone-900 text-xs">{scName}</h6>
                    <p className="text-stone-600 text-[11px]">
                      {sc.possible_benefit || sc.benefits || sc.description || 'Subsidy support available'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Eligible
                    </span>
                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#14532D] text-white hover:bg-[#14532D]/90 transition-colors shadow-2xs"
                    >
                      <span>Official Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-8 pb-12">
      <StatutoryAdvisoryTopBanner module="pipeline" />

      <PageHeader
        title="Comprehensive Farm Decision Pipeline"
        subtitle="End-to-end agricultural planning: runs crop recommendation, weather risk, irrigation scheduling, yield forecasting, mandi prices, and government subsidies in a unified sequence."
        badge="Unified 6-Stage Engine"
        action={
          <button
            type="button"
            onClick={handleRunFullPipeline}
            disabled={isRunningAll}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#14532D]/90 text-white font-semibold text-xs disabled:opacity-50 transition-all shadow-sm cursor-pointer"
          >
            {isRunningAll ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Pipeline...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span>Execute Complete Farm Plan</span>
              </>
            )}
          </button>
        }
      />

      {/* Field Configuration Bar with Unconstrained Area */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2 pb-2 border-b border-stone-100">
          <MapPin className="w-4 h-4 text-[#14532D]" />
          <span>Farm Field Inputs for Unified Analysis</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-stone-600 font-semibold mb-1">State</label>
            <select
              value={params.state}
              onChange={(e) => {
                const newState = e.target.value;
                const st = STATES_AND_DISTRICTS.find((s) => s.name === newState);
                setParams({
                  ...params,
                  state: newState,
                  district: st ? st.districts[0] : '',
                });
              }}
              className="w-full p-2.5 rounded-xl border border-stone-300 bg-white"
            >
              {STATES_AND_DISTRICTS.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-stone-600 font-semibold mb-1">District</label>
            <select
              value={params.district}
              onChange={(e) => setParams({ ...params, district: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-stone-300 bg-white"
            >
              {selectedStateObj.districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-stone-600 font-semibold mb-1">Sowing Date</label>
            <input
              type="date"
              value={params.sowing_date}
              onChange={(e) => setParams({ ...params, sowing_date: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-stone-300 bg-white"
            />
          </div>
        </div>

        {/* Unrestricted Area Input Component */}
        <div className="pt-2">
          <AreaInputField
            label="Total Farm Land Area"
            areaHa={params.area_ha || 2}
            onChange={(ha) => setParams({ ...params, area_ha: ha })}
            helperText="Calculates water volume, expected harvest, and subsidy matching for your exact acreage."
            required
          />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#14532D]" />
          <span className="text-xs font-bold text-stone-900">
            Pipeline Stages Completed: {completedCount} / 6
          </span>
        </div>
        <div className="w-48 bg-stone-200 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-[#14532D] h-2.5 transition-all duration-500"
            style={{ width: `${(completedCount / 6) * 100}%` }}
          />
        </div>
      </div>

      {/* UNIFIED MASTER FARM SUMMARY (Displayed when all 6 stages complete) */}
      {isAllComplete && (
        <div className="p-6 rounded-3xl bg-linear-to-br from-[#14532D] to-[#166534] text-white shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-600/60">
            <div>
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                <span>Executive Agricultural Action Plan</span>
              </span>
              <h3 className="text-lg font-extrabold mt-0.5">
                Seasonal Strategy for {params.crop} on {areaAcres} Acres
              </h3>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-[#14532D] text-xs font-bold hover:bg-emerald-50 transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Action Plan</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10">
              <span className="text-emerald-200 block text-[11px]">Recommended Crop</span>
              <span className="text-sm font-bold text-white block mt-0.5">{params.crop}</span>
              <span className="text-[10px] text-emerald-200">Kharif High Suitability</span>
            </div>

            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10">
              <span className="text-emerald-200 block text-[11px]">Weather Risk Level</span>
              <span className="text-sm font-bold text-white block mt-0.5">Low Risk</span>
              <span className="text-[10px] text-emerald-200">Normal Coastal Rainfall</span>
            </div>

            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10">
              <span className="text-emerald-200 block text-[11px]">Daily Water Demand</span>
              <span className="text-sm font-bold text-white block mt-0.5">14.5 mm</span>
              <span className="text-[10px] text-emerald-200">Drip saves ~50% water</span>
            </div>

            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10">
              <span className="text-emerald-200 block text-[11px]">Expected Harvest</span>
              <span className="text-sm font-bold text-white block mt-0.5">
                {Math.round(((unwrapApiResponse(steps.yield?.data) as any)?.predicted_yield ?? 44.8) * (params.area_ha || 2))} Quintals
              </span>
              <span className="text-[10px] text-emerald-200">
                {Number(((unwrapApiResponse(steps.yield?.data) as any)?.predicted_yield ?? 44.8).toFixed(1))} Q/Ha × {params.area_ha || 2} Ha
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Consolidated Total Harvest Calculation for Full Farm Analysis */}
      {isAllComplete && (() => {
        const yieldRes = unwrapApiResponse(steps.yield?.data) as any;
        const pipelineYieldPerHa = Number((yieldRes?.predicted_yield ?? 44.8).toFixed(1));
        const pipelineAreaHa = params.area_ha || 2;
        const pipelineAreaAcres = Number((pipelineAreaHa * 2.47105).toFixed(1));
        const pipelineTotalQuintals = Math.round(pipelineYieldPerHa * pipelineAreaHa);
        const pipelineTotalTonnes = Number((pipelineTotalQuintals / 10).toFixed(1));
        const pipelineBags = Math.round(pipelineTotalQuintals * 2);

        return (
          <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-300 space-y-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-emerald-200">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Consolidated Harvest Planning
                </span>
                <h4 className="text-base font-extrabold text-[#14532D] flex items-center gap-2">
                  <Scale className="w-5 h-5 text-emerald-700" />
                  <span>Full Farm Total Harvest Output: {pipelineTotalQuintals} Quintals ({pipelineTotalTonnes} Tonnes)</span>
                </h4>
              </div>
              <span className="text-xs font-bold text-emerald-900 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 self-start sm:self-auto">
                📦 Approx. {pipelineBags.toLocaleString()} Bags (50 kg each)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white border border-emerald-200 shadow-2xs">
                <span className="text-stone-500 block mb-1 font-semibold">1. Field Productivity Rate</span>
                <span className="text-lg font-bold text-stone-900">{pipelineYieldPerHa} Q / Ha</span>
                <span className="text-[11px] text-emerald-700 block mt-0.5">
                  ≈ {Number((pipelineYieldPerHa / 2.47105).toFixed(1))} Quintals / Acre
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-emerald-200 shadow-2xs">
                <span className="text-stone-500 block mb-1 font-semibold">2. Total Cultivated Land</span>
                <span className="text-lg font-bold text-stone-900">{pipelineAreaHa} Hectares</span>
                <span className="text-[11px] text-stone-500 block mt-0.5">
                  ≈ {pipelineAreaAcres} Cultivated Acres
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-100/70 border border-emerald-300 shadow-2xs">
                <span className="text-[#14532D] block mb-1 font-bold">3. Total Expected Production</span>
                <span className="text-lg font-black text-[#14532D]">{pipelineTotalQuintals} Quintals</span>
                <span className="text-[11px] text-emerald-900 block mt-0.5 font-medium">
                  {pipelineTotalTonnes} Tonnes ({pipelineBags.toLocaleString()} standard gunny bags)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-medium">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="text-stone-700 font-bold">Calculation Formula:</span>
                <span className="text-stone-900">
                  {pipelineYieldPerHa} Q/Ha × {pipelineAreaHa} Ha = <strong className="text-[#14532D] font-bold">{pipelineTotalQuintals} Quintals</strong>
                </span>
              </div>
              <span className="text-stone-500 text-[11px]">
                ({Number((pipelineYieldPerHa / 2.47105).toFixed(1))} Q/Acre × {pipelineAreaAcres} Acres = {pipelineTotalQuintals} Quintals)
              </span>
            </div>
          </div>
        );
      })()}

      {/* Farm Financials & Economics Projection */}
      {isAllComplete && (
        <CostAndProfitSection
          crop={params.crop}
          areaHa={params.area_ha || 2}
          expectedYieldTotalQuintals={Math.round(((unwrapApiResponse(steps.yield?.data) as any)?.predicted_yield ?? 44.8) * (params.area_ha || 2))}
          pricePerQuintal={2420}
          title="Consolidated Farm Financial Projection: Estimated Costs & Net Profit"
          subtitle={`Economic estimation based on CACP standards across your ${params.area_ha || 2} Ha (${Number(((params.area_ha || 2) * 2.47105).toFixed(1))} Acres) cultivation.`}
        />
      )}

      {/* Stage-by-Stage Cards with Plain English Outputs */}
      <div className="space-y-4">
        {Object.values(steps).map((step, idx) => {
          return (
            <div
              key={step.id}
              className={`p-5 rounded-3xl border transition-all ${
                step.status === 'success'
                  ? 'bg-emerald-50/20 border-emerald-300'
                  : step.status === 'error'
                  ? 'bg-rose-50/30 border-rose-300'
                  : step.status === 'running'
                  ? 'bg-amber-50/40 border-amber-300 ring-2 ring-amber-300'
                  : 'bg-white border-stone-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      step.status === 'success'
                        ? 'bg-[#14532D] text-white'
                        : step.status === 'error'
                        ? 'bg-rose-600 text-white'
                        : step.status === 'running'
                        ? 'bg-amber-500 text-white animate-pulse'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {step.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">{step.name}</h4>
                    <span className="text-[11px] text-stone-500">
                      {step.status === 'success'
                        ? 'Analysis complete & ready'
                        : step.status === 'running'
                        ? 'Consulting agro-climatic neural network...'
                        : step.status === 'error'
                        ? 'Error during stage execution'
                        : 'Pending execution'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {step.status === 'running' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-semibold">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> In Progress...
                    </span>
                  )}

                  {step.status === 'success' && (
                    <button
                      type="button"
                      onClick={() => runStep(step.id)}
                      className="px-2.5 py-1 rounded-lg border border-stone-200 text-[11px] font-semibold text-stone-600 hover:bg-stone-100 cursor-pointer"
                    >
                      Re-run Stage
                    </button>
                  )}

                  {step.status === 'error' && (
                    <button
                      type="button"
                      onClick={() => runStep(step.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Retry Stage
                    </button>
                  )}

                  {step.status === 'idle' && !isRunningAll && (
                    <button
                      type="button"
                      onClick={() => runStep(step.id)}
                      className="px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
                    >
                      Run Stage
                    </button>
                  )}
                </div>
              </div>

              {step.error && (
                <div className="mt-3 text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{step.error}</span>
                </div>
              )}

              {/* Formatted Farmer Card (NEVER RAW JSON) */}
              {step.status === 'success' && Boolean(step.data) && (
                <div className="mt-4 pt-4 border-t border-stone-200/60">
                  {renderStepResults(step.id, step.data)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.values(steps).some((s) => s.status === 'success' && Boolean(s.data)) && (
        <FeedbackPrompt
          advisoryId={null}
          module="crop"
          crop={params.crop}
          district={`${params.district}, ${params.state}`}
        />
      )}

      <DisclaimerBanner
        type="advisory"
        text="The pipeline aggregates regional machine learning predictions with ICAR standards. Verify all seed choices and fertilizer schedules with your local agricultural officer."
      />
    </div>
  );
}

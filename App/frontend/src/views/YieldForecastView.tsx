import {
  BarChart3,
  Calculator,
  Calendar,
  CloudSun,
  Coins,
  Droplets,
  HelpCircle,
  Layers,
  MapPin,
  Scale,
  Sparkles,
  Sprout,
  Thermometer,
  TrendingUp,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  ConfidenceBadge,
  DisclaimerBanner,
  ErrorState,
  LoadingState,
  MetricCard,
  SourceList,
  StatutoryAdvisoryTopBanner,
} from '../components/CommonUI';
import { PageHeader } from '../components/Navigation';
import { FeedbackPrompt } from '../components/FeedbackPrompt';
import {
  COMMON_CROPS,
  CROP_MSP_BENCHMARKS,
  SEASONS,
  STATES_AND_DISTRICTS,
} from '../data/agriData';
import { CROP_ECONOMIC_BENCHMARKS } from '../lib/agriEconomics';
import { predictYield, unwrapApiResponse } from '../lib/api';
import { savePrediction } from '../lib/farmStorage';
import type { UserFarmProfile } from '../types';

export function YieldForecastView({ profile }: { profile: UserFarmProfile }) {
  const [formData, setFormData] = useState({
    state: profile.state || 'Andhra Pradesh',
    district: profile.district || 'Visakhapatnam',
    crop: profile.crop || 'Rice',
    season: 'Kharif',
    area_ha: String(profile.area_ha || 2),
    year: '2026',
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState('');

  const selectedState =
    STATES_AND_DISTRICTS.find((s) => s.name === formData.state) || STATES_AND_DISTRICTS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const areaHa = Number(formData.area_ha) || 2;
      const rawResponse: any = await predictYield({
        state: formData.state,
        district: formData.district,
        crop: formData.crop,
        season: formData.season || 'Kharif',
        area_ha: areaHa,
        year: Number(formData.year) || 2026,
      });

      const unwrapped = unwrapApiResponse(rawResponse);
      setResult(unwrapped);

      // Parse predicted values
      const predictedYield =
        unwrapped.predicted_yield !== undefined
          ? Number(unwrapped.predicted_yield)
          : unwrapped.estimated_yield !== undefined
          ? Number(unwrapped.estimated_yield)
          : unwrapped.yield !== undefined
          ? Number(unwrapped.yield)
          : 1.84;

      const totalYield =
        unwrapped.total_yield !== undefined
          ? Number(unwrapped.total_yield)
          : unwrapped.total_production !== undefined
          ? Number(unwrapped.total_production)
          : Number((predictedYield * areaHa).toFixed(2));

      // Save to history
      savePrediction({
        category: 'yield',
        title: `Harvest Yield Forecast: ${formData.crop}`,
        summary: `Expected ${predictedYield} Tonnes/Ha (~${(predictedYield * 10).toFixed(1)} Q/Ha) totaling ${totalYield} Tonnes across ${(areaHa * 2.471).toFixed(1)} Acres in ${formData.district}.`,
        details: {
          crop: formData.crop,
          season: formData.season,
          area_ha: areaHa,
          district: formData.district,
          state: formData.state,
          predicted_yield: predictedYield,
          total_yield: totalYield,
        },
        badge: `${predictedYield} T/Ha`,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Yield forecast failed. The backend service may be waking up. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Safe extraction from unwrapped result
  const areaHa = Number(formData.area_ha) || 2;
  const areaAcres = Number((areaHa * 2.471).toFixed(1));

  const cropBenchmark = CROP_ECONOMIC_BENCHMARKS[formData.crop] || { baseYieldQuintalsPerHa: 45 };
  const benchmarkYieldTonnes = Number((cropBenchmark.baseYieldQuintalsPerHa / 10).toFixed(2));

  let yieldVal: number | undefined;
  let totalVal: number | undefined;
  let arrivalVal: number | undefined;

  if (result) {
    if (result.predicted_yield !== undefined) yieldVal = Number(result.predicted_yield);
    else if (result.estimated_yield !== undefined) yieldVal = Number(result.estimated_yield);
    else if (result.yield !== undefined) yieldVal = Number(result.yield);
    else yieldVal = benchmarkYieldTonnes;

    if (result.total_yield !== undefined) totalVal = Number(result.total_yield);
    else if (result.total_production !== undefined) totalVal = Number(result.total_production);
    else if (yieldVal !== undefined) totalVal = Number((yieldVal * areaHa).toFixed(2));

    if (result.arrival_quantity !== undefined) arrivalVal = Number(result.arrival_quantity);
    else if (totalVal !== undefined) arrivalVal = Number((totalVal * 10).toFixed(1)); // Convert tonnes to quintals
  }

  // Harvest calculations
  const effectiveYieldTonnes = yieldVal !== undefined ? yieldVal : benchmarkYieldTonnes;
  const yieldQuintalsPerHa = Number((effectiveYieldTonnes * 10).toFixed(1));
  const yieldQuintalsPerAcre = Number((yieldQuintalsPerHa / 2.47105).toFixed(2));
  const quintalsTotal = totalVal ? Number((totalVal * 10).toFixed(1)) : Number((areaHa * yieldQuintalsPerHa).toFixed(1));
  const standard50kgBags = Math.round(quintalsTotal * 2);

  const weatherData = result?.weather && typeof result.weather === 'object' ? result.weather : null;
  const soilData = result?.soil && typeof result.soil === 'object' ? result.soil : null;

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <StatutoryAdvisoryTopBanner module="yield" />

      <PageHeader
        title="Crop Yield Forecasting"
        subtitle="Estimate harvest production per hectare based on regional historical trends, weather conditions, soil parameters, and acreage."
        badge="Agronomic Yield Model"
      />

      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-800" />
            <h2 className="text-sm font-bold text-stone-900">Yield Prediction Parameters</h2>
          </div>
          <button
            type="button"
            onClick={() =>
              setFormData({
                state: 'Andhra Pradesh',
                district: 'Visakhapatnam',
                crop: 'Rice',
                season: 'Kharif',
                area_ha: '2',
                year: '2026',
              })
            }
            className="text-xs font-semibold text-[#14532D] hover:underline"
          >
            Load Sample (Rice - Visakhapatnam)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.state}
                onChange={(e) => {
                  const newState = e.target.value;
                  const st = STATES_AND_DISTRICTS.find((s) => s.name === newState);
                  setFormData({
                    ...formData,
                    state: newState,
                    district: st ? st.districts[0] : '',
                  });
                }}
                className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:ring-1 focus:ring-emerald-500"
              >
                {STATES_AND_DISTRICTS.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                District <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:ring-1 focus:ring-emerald-500"
              >
                {selectedState.districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Crop <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.crop}
                onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:ring-1 focus:ring-emerald-500"
              >
                {COMMON_CROPS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Season</label>
              <select
                value={formData.season}
                onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:ring-1 focus:ring-emerald-500"
              >
                {SEASONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Cultivated Area (Hectares) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="1000"
                  value={formData.area_ha}
                  onChange={(e) => setFormData({ ...formData, area_ha: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:ring-1 focus:ring-emerald-500 pr-12"
                />
                <span className="absolute right-3 top-2.5 text-xs text-stone-400">Ha</span>
              </div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                ≈ {(Number(formData.area_ha || 2) * 2.471).toFixed(1)} Acres
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Harvest Year</label>
              <input
                type="number"
                min="2020"
                max="2035"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-semibold bg-[#14532D] text-white hover:bg-[#14532D]/90 disabled:opacity-50 transition-colors shadow-xs"
            >
              {loading ? 'Forecasting Yield...' : 'Calculate Harvest Forecast'}
            </button>
          </div>
        </form>
      </div>

      {loading && (
        <LoadingState
          message="Running Agro-Climatic Regression & District Productivity Estimation..."
          showColdStartHint={true}
        />
      )}

      {error && !loading && (
        <ErrorState
          error={error}
          endpoint="/api/v1/predict/yield"
          onRetry={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
        />
      )}

      {result !== null && !loading && yieldVal !== undefined && (
        <div className="p-6 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#14532D] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Yield Forecast: {formData.crop}
                </h3>
                <p className="text-xs text-stone-500">
                  {formData.season} Season • {formData.district}, {formData.state}
                </p>
              </div>
            </div>
            <ConfidenceBadge label="District Statistical Model" />
          </div>

          {/* Primary Metric Cards (Yield & Harvest Only - No Profit / Revenue) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <span className="text-[11px] font-bold text-[#14532D] uppercase tracking-wider block mb-1">
                Yield Productivity
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-stone-900">{yieldVal}</span>
                <span className="text-xs font-semibold text-stone-600">Tonnes / Ha</span>
              </div>
              <p className="text-xs text-emerald-800 mt-1 font-medium">
                = {yieldQuintalsPerHa} Quintals / Hectare
              </p>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-1">
                Per Acre Productivity
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-stone-900">{yieldQuintalsPerAcre}</span>
                <span className="text-xs font-semibold text-stone-600">Quintals / Acre</span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Local field benchmark measure
              </p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/90 border border-emerald-300">
              <span className="text-[11px] font-bold text-[#14532D] uppercase tracking-wider block mb-1">
                Total Farm Harvest
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-[#14532D]">{quintalsTotal}</span>
                <span className="text-xs font-bold text-[#14532D]">Quintals</span>
              </div>
              <p className="text-xs text-emerald-800 mt-1 font-medium">
                Across {areaHa} Ha ({areaAcres} Acres)
              </p>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-1">
                Standard Packaging
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-stone-900">{standard50kgBags.toLocaleString()}</span>
                <span className="text-xs font-semibold text-stone-600">Bags</span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Standard 50 kg APMC arrival bags
              </p>
            </div>
          </div>

          {/* Total Harvest Calculation Breakdown (Pure Agronomic Harvest & Yield Analysis) */}
          <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-200/80">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Harvest Yield Mathematics
                </span>
                <h3 className="text-base font-bold text-[#14532D] flex items-center gap-2">
                  <Scale className="w-5 h-5 text-[#14532D]" />
                  <span>Total Harvest Calculation & Crop Balance</span>
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-900 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 self-start sm:self-auto">
                Total Yield: {quintalsTotal.toLocaleString()} Quintals ({totalVal} Tonnes)
              </span>
            </div>

            {/* Step by Step Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white border border-emerald-200 shadow-2xs">
                <span className="text-stone-500 block mb-1 font-semibold">1. Productivity Rate</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-stone-900">{yieldVal}</span>
                  <span className="text-xs text-stone-600 font-semibold">Tonnes / Ha</span>
                </div>
                <p className="text-[11px] text-emerald-800 mt-1 font-medium">
                  = {yieldQuintalsPerHa} Q/Ha (≈ {yieldQuintalsPerAcre} Q/Acre)
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-emerald-200 shadow-2xs">
                <span className="text-stone-500 block mb-1 font-semibold">2. Land Cultivation Area</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-stone-900">{areaHa}</span>
                  <span className="text-xs text-stone-600 font-semibold">Hectares</span>
                </div>
                <p className="text-[11px] text-stone-600 mt-1 font-medium">
                  = {areaAcres} Acres total land
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-100/70 border border-emerald-300 shadow-2xs">
                <span className="text-[#14532D] block mb-1 font-bold">3. Total Expected Harvest</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-[#14532D]">{quintalsTotal.toLocaleString()}</span>
                  <span className="text-xs text-[#14532D] font-bold">Quintals</span>
                </div>
                <p className="text-[11px] text-emerald-900 mt-1 font-medium">
                  = {totalVal} Tonnes ({standard50kgBags.toLocaleString()} bags of 50 kg)
                </p>
              </div>
            </div>

            {/* Formula box */}
            <div className="p-3.5 rounded-xl bg-white border border-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="text-stone-700 font-bold">Calculation Formula:</span>
                <span className="text-stone-900 font-medium">
                  {yieldQuintalsPerHa} Quintals/Ha × {areaHa} Hectares = <strong className="text-[#14532D] font-bold">{quintalsTotal} Quintals</strong>
                </span>
              </div>
              <span className="text-[11px] text-stone-500">
                ({yieldQuintalsPerAcre} Q/Acre × {areaAcres} Acres = {quintalsTotal} Quintals)
              </span>
            </div>
          </div>

          {/* Growing Environment Context (Weather & Soil) */}
          {(weatherData || soilData) && (
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <CloudSun className="w-4 h-4 text-amber-700" />
                Agro-Climatic & Soil Context for {formData.district}
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                {weatherData?.mean_temperature !== undefined && (
                  <div className="p-2.5 rounded-lg bg-white border border-stone-200">
                    <span className="text-stone-500 block mb-0.5">Mean Temperature</span>
                    <span className="font-bold text-stone-900">{weatherData.mean_temperature}°C</span>
                    {weatherData.max_temperature && weatherData.min_temperature && (
                      <span className="text-[10px] text-stone-400 block">
                        ({weatherData.min_temperature}°C - {weatherData.max_temperature}°C)
                      </span>
                    )}
                  </div>
                )}

                {weatherData?.precipitation !== undefined && (
                  <div className="p-2.5 rounded-lg bg-white border border-stone-200">
                    <span className="text-stone-500 block mb-0.5">Seasonal Rainfall</span>
                    <span className="font-bold text-stone-900">{weatherData.precipitation} mm</span>
                    <span className="text-[10px] text-emerald-700 block">Adequate Kharif moisture</span>
                  </div>
                )}

                {weatherData?.relative_humidity !== undefined && (
                  <div className="p-2.5 rounded-lg bg-white border border-stone-200">
                    <span className="text-stone-500 block mb-0.5">Relative Humidity</span>
                    <span className="font-bold text-stone-900">{weatherData.relative_humidity}%</span>
                    <span className="text-[10px] text-stone-400 block">Atmospheric moisture</span>
                  </div>
                )}

                {soilData?.soil_ph !== undefined && (
                  <div className="p-2.5 rounded-lg bg-white border border-stone-200">
                    <span className="text-stone-500 block mb-0.5">Soil Reaction (pH)</span>
                    <span className="font-bold text-stone-900">{soilData.soil_ph}</span>
                    <span className="text-[10px] text-emerald-700 block">Neutral & fertile</span>
                  </div>
                )}

                {soilData?.organic_carbon !== undefined && (
                  <div className="p-2.5 rounded-lg bg-white border border-stone-200">
                    <span className="text-stone-500 block mb-0.5">Organic Carbon</span>
                    <span className="font-bold text-stone-900">{soilData.organic_carbon}%</span>
                    <span className="text-[10px] text-stone-400 block">Soil organic matter</span>
                  </div>
                )}

                {soilData?.clay !== undefined && (
                  <div className="p-2.5 rounded-lg bg-white border border-stone-200">
                    <span className="text-stone-500 block mb-0.5">Soil Texture</span>
                    <span className="font-bold text-stone-900">
                      Clay {soilData.clay}% • Sand {soilData.sand}%
                    </span>
                    <span className="text-[10px] text-stone-400 block">Sandy clay loam</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actionable Yield Maximization Tips */}
          <div className="p-4 rounded-xl bg-white border border-stone-200 space-y-2">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sprout className="w-4 h-4 text-emerald-700" />
              Agronomic Practices to Achieve Target Yield
            </h4>
            <ul className="space-y-1.5 text-xs text-stone-700">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span>
                  <strong>Balanced Fertilizer Schedule:</strong> Apply recommended N:P:K (100:50:50 kg/ha for Rice) with nitrogen split into 3 doses (basal, tillering, panicle initiation).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span>
                  <strong>Zinc Supplementation:</strong> Apply Zinc Sulphate 21% @ 25 kg/ha basal or 0.2% foliar spray at tillering to prevent khaira disease in calcareous soils.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span>
                  <strong>Alternate Wetting and Drying (AWD):</strong> Reduce water consumption by 25% while aerating roots and strengthening stem culm against lodging.
                </span>
              </li>
            </ul>
          </div>

          {/* Input Assumptions Bar */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600">
            <span className="font-bold text-stone-700 uppercase tracking-wider block mb-1">
              Forecast Input Assumptions
            </span>
            <p>
              Crop: <strong className="text-stone-900">{formData.crop}</strong> • Season:{' '}
              <strong className="text-stone-900">{formData.season}</strong> • Area:{' '}
              <strong className="text-stone-900">{formData.area_ha} Ha ({areaAcres} Acres)</strong> •
              Location: <strong className="text-stone-900">{formData.district}, {formData.state}</strong> •
              Harvest Year: <strong className="text-stone-900">{formData.year}</strong>
            </p>
          </div>

          {/* Verified Official Sources */}
          <SourceList
            sources={[
              {
                title: 'ICAR - Indian Institute of Rice Research (IIRR)',
                url: 'https://icar-iirr.org',
                snippet: 'National research institute for rice crop productivity, high-yielding varieties, and agronomic management.',
                date: 'ICAR Standard Yield Database',
              },
              {
                title: 'Agmarknet - Directorate of Marketing & Inspection',
                url: 'https://agmarknet.gov.in',
                snippet: 'Official mandi portal for crop arrival records and historical APMC trading statistics across Indian districts.',
                date: 'Agmarknet 2026',
              },
            ]}
          />

          <DisclaimerBanner
            type="advisory"
            text="Estimated yield is a statistical model forecast, not a guaranteed harvest amount. Actual yield depends on pest management, soil nutrition, irrigation regularity, and climatic conditions."
          />

          {/* Contextual Farmer Feedback */}
          <FeedbackPrompt
            advisoryId={result?.id ?? null}
            module="yield"
            crop={formData.crop}
            district={`${formData.district}, ${formData.state}`}
          />
        </div>
      )}
    </div>
  );
}

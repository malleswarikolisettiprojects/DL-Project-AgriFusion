import {
  ArrowUpRight,
  Calculator,
  Calendar,
  CheckCircle2,
  Coins,
  ExternalLink,
  HelpCircle,
  LineChart,
  MapPin,
  Scale,
  Sparkles,
  Store,
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
import { CostAndProfitSection } from '../components/CostAndProfitSection';
import { PageHeader } from '../components/Navigation';
import { FeedbackPrompt } from '../components/FeedbackPrompt';
import {
  COMMON_CROPS,
  CROP_MSP_BENCHMARKS,
  SEASONS,
  STATES_AND_DISTRICTS,
} from '../data/agriData';
import { CROP_ECONOMIC_BENCHMARKS } from '../lib/agriEconomics';
import { predictMarket, unwrapApiResponse } from '../lib/api';
import { savePrediction } from '../lib/farmStorage';
import type { UserFarmProfile } from '../types';

export function MarketForecastView({ profile }: { profile: UserFarmProfile }) {
  const [formData, setFormData] = useState({
    state: profile.state || 'Andhra Pradesh',
    district: profile.district || 'Visakhapatnam',
    commodity: profile.crop || 'Rice',
    area_ha: String(profile.area_ha || 2),
    season: 'Kharif',
    start_date: '2026-06-01',
    end_date: '2026-10-31',
    year: '2026',
    market_date: '2026-10-20',
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

    const areaHa = Number(formData.area_ha) || 2;
    try {
      const rawResponse: any = await predictMarket({
        state: formData.state,
        district: formData.district,
        commodity: formData.commodity,
        area_ha: areaHa,
        season: formData.season || 'Kharif',
        start_date: formData.start_date,
        end_date: formData.end_date,
        year: Number(formData.year) || 2026,
        market_date: formData.market_date,
      });

      const unwrapped = unwrapApiResponse(rawResponse);
      setResult(unwrapped);

      // Determine price
      const mspBenchmark = CROP_MSP_BENCHMARKS[formData.commodity] || 2320;
      const price =
        unwrapped.predicted_price !== undefined
          ? Number(unwrapped.predicted_price)
          : unwrapped.forecast_price !== undefined
          ? Number(unwrapped.forecast_price)
          : unwrapped.modal_price !== undefined
          ? Number(unwrapped.modal_price)
          : Math.round(mspBenchmark * 1.06);

      const totalQuintals = areaHa * 18.4;
      const totalRev = Math.round(price * totalQuintals);

      savePrediction({
        category: 'market',
        title: `Mandi Price Forecast: ${formData.commodity}`,
        summary: `Forecasted modal mandi price ₹${price}/Quintal in ${formData.district}. Estimated gross farm income ₹${totalRev.toLocaleString('en-IN')} for ${(areaHa * 2.471).toFixed(1)} Acres.`,
        details: {
          commodity: formData.commodity,
          district: formData.district,
          state: formData.state,
          forecasted_price: price,
          area_ha: areaHa,
          market_date: formData.market_date,
          projected_revenue: totalRev,
        },
        badge: `₹${price}/Q`,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Market price forecasting service is currently experiencing high load. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Safe metrics computation
  const areaHa = Number(formData.area_ha) || 2;
  const areaAcres = Number((areaHa * 2.471).toFixed(1));
  const mspFloor = CROP_MSP_BENCHMARKS[formData.commodity] || 2320;

  let forecastPrice: number = Math.round(mspFloor * 1.06);
  if (result) {
    if (result.predicted_price !== undefined && !isNaN(Number(result.predicted_price))) {
      forecastPrice = Math.round(Number(result.predicted_price));
    } else if (result.forecast_price !== undefined && !isNaN(Number(result.forecast_price))) {
      forecastPrice = Math.round(Number(result.forecast_price));
    } else if (result.price !== undefined && !isNaN(Number(result.price))) {
      forecastPrice = Math.round(Number(result.price));
    } else if (result.modal_price !== undefined && !isNaN(Number(result.modal_price))) {
      forecastPrice = Math.round(Number(result.modal_price));
    }
  }

  // Calculate estimated total quintals and revenue based on agronomic benchmarks
  const cropBenchmark = CROP_ECONOMIC_BENCHMARKS[formData.commodity] || { baseYieldQuintalsPerHa: 40 };
  const yieldQuintalsPerHa = cropBenchmark.baseYieldQuintalsPerHa;
  const yieldQuintalsPerAcre = Number((yieldQuintalsPerHa / 2.47105).toFixed(2));
  const estimatedTotalQuintals = Number((areaHa * yieldQuintalsPerHa).toFixed(1));
  const estimatedTotalTonnes = Number((estimatedTotalQuintals / 10).toFixed(2));
  const standard50kgBags = Math.round(estimatedTotalQuintals * 2);
  const estimatedRevenue = Math.round(forecastPrice * estimatedTotalQuintals);
  const mspRevenue = Math.round(mspFloor * estimatedTotalQuintals);
  const premiumOverMsp = Math.max(0, forecastPrice - mspFloor);

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <StatutoryAdvisoryTopBanner module="market" />

      <PageHeader
        title="Market Price Forecasting"
        subtitle="Mandi price trajectory, APMC modal rate projections, and harvest income estimates based on historical arrivals and seasonal market cycles."
        badge="Market Price Model"
      />

      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-600" />
            <h2 className="text-sm font-bold text-stone-900">Market & Harvest Parameters</h2>
          </div>
          <button
            type="button"
            onClick={() =>
              setFormData({
                state: 'Andhra Pradesh',
                district: 'Visakhapatnam',
                commodity: 'Rice',
                area_ha: '2',
                season: 'Kharif',
                start_date: '2026-06-01',
                end_date: '2026-10-31',
                year: '2026',
                market_date: '2026-10-20',
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
                Commodity / Crop <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.commodity}
                onChange={(e) => setFormData({ ...formData, commodity: e.target.value })}
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
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Target Market / Sale Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.market_date}
                onChange={(e) => setFormData({ ...formData, market_date: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:ring-1 focus:ring-emerald-500"
              />
            </div>

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
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-semibold bg-[#14532D] text-white hover:bg-[#14532D]/90 disabled:opacity-50 transition-colors shadow-xs"
            >
              {loading ? 'Forecasting Mandi Price...' : 'Predict Mandi Price & Revenue'}
            </button>
          </div>
        </form>
      </div>

      {loading && (
        <LoadingState
          message="Analyzing Agmarknet Historical Arrivals, Seasonality, & APMC Spot Prices..."
          showColdStartHint={true}
        />
      )}

      {error && !loading && (
        <ErrorState
          error={error}
          endpoint="/api/v1/predict/market"
          onRetry={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
        />
      )}

      {result !== null && !loading && (
        <div className="p-6 rounded-2xl bg-white border border-amber-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Market Price Projections: {formData.commodity}
                </h3>
                <p className="text-xs text-stone-500">
                  APMC Mandi trajectory for {formData.market_date} • {formData.district}, {formData.state}
                </p>
              </div>
            </div>
            <ConfidenceBadge label="APMC Arrival Regression" />
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Model Predicted Price */}
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-300">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                Forecasted Mandi Price
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-amber-950">₹{forecastPrice}</span>
                <span className="text-xs font-semibold text-amber-900">/ Quintal</span>
              </div>
              <p className="text-xs text-amber-800 mt-1 font-medium flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                {premiumOverMsp > 0 ? `+₹${premiumOverMsp} over Govt MSP` : 'Aligns with Govt MSP'}
              </p>
            </div>

            {/* 2. Official MSP Floor */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-1">
                Govt MSP Safety Floor
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-stone-900">₹{mspFloor}</span>
                <span className="text-xs font-semibold text-stone-600">/ Quintal</span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Official minimum support price for 2026
              </p>
            </div>

            {/* 3. Estimated Production */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-1">
                Expected Harvest Volume
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-stone-900">{estimatedTotalQuintals}</span>
                <span className="text-xs font-semibold text-stone-600">Quintals</span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {estimatedTotalTonnes} Tonnes ({standard50kgBags.toLocaleString()} bags)
              </p>
            </div>

            {/* 4. Projected Farm Gross Revenue */}
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <span className="text-[11px] font-bold text-[#14532D] uppercase tracking-wider block mb-1">
                Projected Gross Income
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-emerald-950">
                  ₹{estimatedRevenue.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-1 font-medium">
                At forecasted rate ₹{forecastPrice}/Q
              </p>
            </div>
          </div>

          {/* Total Harvest Calculation Breakdown for Market Disposal */}
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-emerald-200">
              <span className="text-xs font-bold text-[#14532D] uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-700" />
                Total Harvest Calculation for Mandi Sale
              </span>
              <span className="text-[11px] font-bold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 self-start sm:self-auto">
                Total Produce: {estimatedTotalQuintals} Q ({estimatedTotalTonnes} Tonnes)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-white border border-emerald-200">
                <span className="text-stone-500 block mb-0.5">Crop Yield Baseline</span>
                <span className="text-base font-bold text-stone-900">{yieldQuintalsPerHa} Q/Ha</span>
                <span className="text-[11px] text-stone-500 block mt-0.5">≈ {yieldQuintalsPerAcre} Quintals/Acre</span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-emerald-200">
                <span className="text-stone-500 block mb-0.5">Farm Acreage</span>
                <span className="text-base font-bold text-stone-900">{areaHa} Hectares</span>
                <span className="text-[11px] text-stone-500 block mt-0.5">{areaAcres} Total Acres</span>
              </div>
              <div className="p-3 rounded-lg bg-emerald-100/70 border border-emerald-300">
                <span className="text-emerald-900 block mb-0.5 font-bold">Total Harvest Output</span>
                <span className="text-base font-black text-[#14532D]">{estimatedTotalQuintals} Quintals</span>
                <span className="text-[11px] text-emerald-900 block mt-0.5 font-medium">{standard50kgBags.toLocaleString()} Standard 50-kg gunny bags</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white border border-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-medium">
              <div className="flex items-center gap-2">
                <Calculator className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="text-stone-700 font-bold">Calculation Formula:</span>
                <span className="text-stone-900">
                  {yieldQuintalsPerHa} Q/Ha × {areaHa} Ha = <strong className="text-[#14532D]">{estimatedTotalQuintals} Quintals</strong>
                </span>
              </div>
              <span className="text-stone-500 text-[11px]">
                Mandi Value: {estimatedTotalQuintals} Q × ₹{forecastPrice}/Q = <strong>₹{estimatedRevenue.toLocaleString('en-IN')}</strong>
              </span>
            </div>
          </div>

          {/* Farm Cost and Profit Economics Breakdown */}
          <CostAndProfitSection
            crop={formData.commodity}
            areaHa={areaHa}
            expectedYieldTotalQuintals={estimatedTotalQuintals}
            pricePerQuintal={forecastPrice}
            title="Estimated Production Costs & Net Profit Outlook"
            subtitle={`Itemized budget based on CACP standards across your ${areaHa} Ha (${areaAcres} Acres) ${formData.commodity} crop.`}
          />

          {/* Mandi Intelligence & Sales Strategy */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              Mandi Trading Intelligence & Post-Harvest Strategy
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-white border border-stone-200">
                <span className="font-semibold text-stone-900 block mb-1">
                  1. Peak Arrival Discount
                </span>
                <p className="text-stone-600 leading-relaxed">
                  Prices typically soften by 5-8% during peak harvest arrival (October-November). Consider holding produce for 30-45 days if warehouse storage is accessible.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white border border-stone-200">
                <span className="font-semibold text-stone-900 block mb-1">
                  2. Moisture & Quality Premium
                </span>
                <p className="text-stone-600 leading-relaxed">
                  APMC traders deduct ₹40-60/quintal for grain moisture above 14%. Sun-dry harvest to 12-13% moisture before transporting to APMC yard for Grade-A pricing.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white border border-stone-200">
                <span className="font-semibold text-stone-900 block mb-1">
                  3. e-NAM & Warehouse Receipts
                </span>
                <p className="text-stone-600 leading-relaxed">
                  Pledge stored stock in WDRA-accredited warehouses to obtain 75% loan against Electronic Negotiable Warehouse Receipts (e-NWR) at 7% interest rate.
                </p>
              </div>
            </div>
          </div>

          {/* Verified Official Market Portals */}
          <SourceList
            sources={[
              {
                title: 'Agmarknet - Directorate of Marketing & Inspection (DMI)',
                url: 'https://agmarknet.gov.in',
                snippet: 'Official daily wholesale prices and arrival quantities across regulated APMC markets in Andhra Pradesh & India.',
                date: 'Ministry of Agriculture',
              },
              {
                title: 'e-NAM - National Agriculture Market Portal',
                url: 'https://enam.gov.in',
                snippet: 'Pan-India electronic trading portal connecting farmers directly with multi-state buyers to ensure transparent price discovery.',
                date: 'e-NAM Central Portal',
              },
            ]}
            title="Official APMC & Market Intelligence Portals"
          />

          <DisclaimerBanner
            type="advisory"
            text="Forecast prices are algorithmic projections based on seasonal APMC arrival trends and statutory MSP rates, not guaranteed spot purchase prices. Actual realization depends on grain quality, grade, moisture percentage, and day-to-day arrivals at your local APMC mandi."
          />

          {/* Contextual Farmer Feedback */}
          <FeedbackPrompt
            advisoryId={result?.id ?? null}
            module="market"
            crop={formData.commodity}
            district={`${formData.district}, ${formData.state}`}
          />
        </div>
      )}
    </div>
  );
}

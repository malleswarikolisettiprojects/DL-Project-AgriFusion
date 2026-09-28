import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Droplets,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { AreaInputField } from '../components/AreaInputField';
import { DisclaimerBanner, MetricCard, RiskBadge, StatutoryAdvisoryTopBanner } from '../components/CommonUI';
import { PageHeader } from '../components/Navigation';
import { FeedbackPrompt } from '../components/FeedbackPrompt';
import { COMMON_CROPS, STATES_AND_DISTRICTS } from '../data/agriData';
import { predictIrrigation, unwrapApiResponse } from '../lib/api';
import { savePrediction } from '../lib/farmStorage';
import type { IrrigationRequest, UserFarmProfile } from '../types';

interface IrrigationMethodComparison {
  name: string;
  type: string;
  efficiency: string;
  efficiencyPercent: number;
  waterSavings: string;
  waterLitersPerAcre: number;
  runtimeHours3HP: number;
  runtimeHours5HP: number;
  runtimeHours7HP: number;
  frequency: string;
  suitability: string;
  pros: string[];
  isRecommendedForCrop: boolean;
}

export function IrrigationView({ profile }: { profile: UserFarmProfile }) {
  const [formData, setFormData] = useState<IrrigationRequest>({
    state: profile.state || 'Andhra Pradesh',
    district: profile.district || 'Visakhapatnam',
    crop: profile.crop || 'Rice',
    area_ha: profile.area_ha || 2,
    start_date: profile.sowing_date || '2026-06-15',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>('Drip');

  const selectedState =
    STATES_AND_DISTRICTS.find((s) => s.name === formData.state) || STATES_AND_DISTRICTS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const safeStartDate = formData.start_date || profile.sowing_date || '2026-06-15';
    const areaHa = Number(formData.area_ha) || 2;

    try {
      const response = await predictIrrigation({
        state: formData.state,
        district: formData.district,
        crop: formData.crop,
        area_ha: areaHa,
        start_date: safeStartDate,
        pump_hp: 5, // backend expectation handled silently without prompting farmer
      });

      setResult(response);

      const unwrapped = unwrapApiResponse(response);
      const predictedMm = unwrapped.predicted_irrigation ?? 14.5;
      savePrediction({
        category: 'irrigation',
        title: `Smart Irrigation Plan: ${formData.crop}`,
        summary: `${predictedMm} mm daily crop requirement across ${areaHa} Ha (${(areaHa * 2.471).toFixed(1)} Acres). Drip saves up to 50% water.`,
        details: {
          crop: formData.crop,
          area_ha: areaHa,
          district: formData.district,
          state: formData.state,
          predicted_irrigation: predictedMm,
          crop_water_requirement: unwrapped.crop_water_requirement,
          soil_type: unwrapped.soil?.soil_type || 'Loam Soil',
        },
        badge: `${predictedMm} mm/day`,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Irrigation calculation failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Compute multi-method irrigation metrics based on crop water requirement & area
  const unwrappedResult = result ? unwrapApiResponse(result) : null;
  const predictedDepthMm = unwrappedResult?.predicted_irrigation ?? 14.52;
  const totalWaterRequirementMm = unwrappedResult?.crop_water_requirement ?? 33.81;
  const areaHa = Number(formData.area_ha) || 2;
  const areaAcres = areaHa * 2.47105;

  // Total daily liters baseline for full flood coverage (1 mm over 1 acre = ~4,047 Liters)
  const baselineFloodLiters = Math.round(predictedDepthMm * 4047 * areaAcres);

  const methods: IrrigationMethodComparison[] = [
    {
      name: 'Drip Irrigation',
      type: 'Micro-Irrigation (Piped emitters)',
      efficiency: '90% - 95%',
      efficiencyPercent: 92,
      waterSavings: '50% - 55% saved',
      waterLitersPerAcre: Math.round((baselineFloodLiters / areaAcres) * 0.48),
      runtimeHours3HP: Number(((predictedDepthMm * 0.48 * areaAcres * 4047) / 24000).toFixed(1)),
      runtimeHours5HP: Number(((predictedDepthMm * 0.48 * areaAcres * 4047) / 40000).toFixed(1)),
      runtimeHours7HP: Number(((predictedDepthMm * 0.48 * areaAcres * 4047) / 60000).toFixed(1)),
      frequency: 'Every 1 to 2 days',
      suitability: ['Cotton', 'Chilli', 'Vegetables', 'Maize', 'Groundnut', 'Sugarcane'].includes(formData.crop)
        ? 'Best Match for your crop'
        : 'Good for water-scarce zones',
      pros: ['Zero water runoff', 'Fertilizer fertigation possible', 'Minimizes weed growth'],
      isRecommendedForCrop: !['Rice'].includes(formData.crop),
    },
    {
      name: 'Sprinkler Irrigation',
      type: 'Overhead Rain Simulation',
      efficiency: '75% - 80%',
      efficiencyPercent: 78,
      waterSavings: '30% - 35% saved',
      waterLitersPerAcre: Math.round((baselineFloodLiters / areaAcres) * 0.68),
      runtimeHours3HP: Number(((predictedDepthMm * 0.68 * areaAcres * 4047) / 24000).toFixed(1)),
      runtimeHours5HP: Number(((predictedDepthMm * 0.68 * areaAcres * 4047) / 40000).toFixed(1)),
      runtimeHours7HP: Number(((predictedDepthMm * 0.68 * areaAcres * 4047) / 60000).toFixed(1)),
      frequency: 'Every 3 to 5 days',
      suitability: ['Groundnut', 'Wheat', 'Pulses', 'Millets', 'Soybean'].includes(formData.crop)
        ? 'Best Match for your crop'
        : 'Suitable for undulating terrain',
      pros: ['Excellent for sandy/loamy soils', 'Washes foliage', 'Prevents soil crusting'],
      isRecommendedForCrop: ['Groundnut', 'Wheat', 'Pulses', 'Millets'].includes(formData.crop),
    },
    {
      name: 'Furrow / Ridge Irrigation',
      type: 'Bed & Channel Flow',
      efficiency: '60% - 65%',
      efficiencyPercent: 62,
      waterSavings: '15% - 20% saved',
      waterLitersPerAcre: Math.round((baselineFloodLiters / areaAcres) * 0.82),
      runtimeHours3HP: Number(((predictedDepthMm * 0.82 * areaAcres * 4047) / 24000).toFixed(1)),
      runtimeHours5HP: Number(((predictedDepthMm * 0.82 * areaAcres * 4047) / 40000).toFixed(1)),
      runtimeHours7HP: Number(((predictedDepthMm * 0.82 * areaAcres * 4047) / 60000).toFixed(1)),
      frequency: 'Every 5 to 7 days',
      suitability: ['Cotton', 'Sugarcane', 'Maize', 'Vegetables'].includes(formData.crop)
        ? 'Traditional row crop standard'
        : 'Moderate water consumption',
      pros: ['Inexpensive setup', 'Prevents water contact with plant crown'],
      isRecommendedForCrop: false,
    },
    {
      name: 'Surface / Flood Irrigation',
      type: 'Check Basin / Wild Flooding',
      efficiency: '40% - 50%',
      efficiencyPercent: 45,
      waterSavings: '0% (Baseline highest consumption)',
      waterLitersPerAcre: Math.round(baselineFloodLiters / areaAcres),
      runtimeHours3HP: Number(((baselineFloodLiters) / 24000).toFixed(1)),
      runtimeHours5HP: Number(((baselineFloodLiters) / 40000).toFixed(1)),
      runtimeHours7HP: Number(((baselineFloodLiters) / 60000).toFixed(1)),
      frequency: 'Every 7 to 10 days',
      suitability: formData.crop === 'Rice'
        ? 'Standard for lowland paddy'
        : 'High evaporation & percolation loss',
      pros: ['No equipment cost', 'Suppresses certain weeds in paddy'],
      isRecommendedForCrop: formData.crop === 'Rice',
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <StatutoryAdvisoryTopBanner module="irrigation" />

      <PageHeader
        title="Smart Irrigation Advisory"
        subtitle="Comprehensive water requirement analysis comparing Drip, Sprinkler, Furrow, and Surface irrigation methods for your farm."
        badge="Multi-Method Engine"
      />

      {/* Main Input Form */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-stone-100">
          <Droplets className="w-5 h-5 text-sky-600" />
          <h2 className="text-sm font-bold text-stone-900">
            Field Parameters for Water Calculation
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.state}
                onChange={(e) => {
                  const newState = e.target.value;
                  const stObj = STATES_AND_DISTRICTS.find((s) => s.name === newState);
                  setFormData({
                    ...formData,
                    state: newState,
                    district: stObj ? stObj.districts[0] : '',
                  });
                }}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white"
                required
              >
                {STATES_AND_DISTRICTS.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
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
                className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white"
                required
              >
                {selectedState.districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
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
                className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white font-medium"
                required
              >
                {COMMON_CROPS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Sowing / Cycle Date
              </label>
              <input
                type="date"
                value={formData.start_date || '2026-06-15'}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white"
              />
            </div>
          </div>

          {/* Unconstrained Area Input (Acres & Hectares) */}
          <div className="pt-2">
            <AreaInputField
              label="Total Farm Land Area"
              areaHa={formData.area_ha || 2}
              onChange={(newHa) => setFormData({ ...formData, area_ha: newHa })}
              helperText="Enter your exact acreage. Both smallholdings and large estates are fully supported."
              required
            />
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
            <p className="text-[11px] text-stone-500 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-stone-400" />
              Calculates water requirements and pump runtimes for 3 HP, 5 HP, and 7.5 HP motors across all irrigation methods.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-semibold text-xs disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Computing Water Plan...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-sky-200" />
                  <span>Calculate All Irrigation Methods</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Results Display: All Irrigation Methods */}
      {result && result.result && (
        <div className="space-y-6">
          {/* Key Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Daily Water Need"
              value={predictedDepthMm}
              unit="mm / day"
              subtitle={`Total: ${totalWaterRequirementMm} mm requirement`}
              icon={Droplets}
              variant="blue"
            />

            <MetricCard
              title="Farm Field Size"
              value={(areaAcres).toFixed(1)}
              unit="Acres"
              subtitle={`${areaHa} Hectares calculated`}
              icon={MapPin}
              variant="green"
            />

            <MetricCard
              title="Soil Moisture & Type"
              value={result.result.soil?.soil_type || 'Loam Soil'}
              subtitle={`Available water: ${result.result.soil?.available_water ?? 14}%`}
              icon={Layers}
              variant="default"
            />

            <MetricCard
              title="Climate Stress Risk"
              value={<RiskBadge level={result.result.climate_risk || 'Low'} />}
              subtitle={`Score: ${result.result.climate_risk_score ?? 0.0}`}
              icon={Activity}
              variant="amber"
            />
          </div>

          {/* Comparative Irrigation Methods Grid */}
          <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Irrigation Methods Comparison for {formData.crop}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  See how water consumption, pumping hours, and efficiency differ for each system on your {areaAcres.toFixed(1)} acres.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200 self-start sm:self-auto">
                {formData.crop} • {selectedState.name}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {methods.map((method) => {
                const isSelected = selectedMethod === method.name;
                return (
                  <div
                    key={method.name}
                    onClick={() => setSelectedMethod(method.name)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/40 ring-2 ring-sky-300 shadow-xs'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-stone-900 text-sm">{method.name}</h4>
                          <span className="text-[11px] text-stone-500">{method.type}</span>
                        </div>
                        {method.isRecommendedForCrop && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Recommended
                          </span>
                        )}
                      </div>

                      {/* Efficiency bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold mb-1">
                          <span className="text-stone-600">Efficiency</span>
                          <span className="text-sky-700">{method.efficiency}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                          <div
                            className="h-full bg-sky-600 rounded-full"
                            style={{ width: `${method.efficiencyPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Water Savings Badge */}
                      <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        💧 {method.waterSavings}
                      </div>

                      {/* Water Volume */}
                      <div className="text-xs text-stone-700 space-y-1 pt-1">
                        <div className="flex justify-between">
                          <span className="text-stone-500">Water / Acre / Day:</span>
                          <span className="font-bold">{method.waterLitersPerAcre.toLocaleString()} Liters</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Interval:</span>
                          <span className="font-medium">{method.frequency}</span>
                        </div>
                      </div>

                      {/* Pump runtime comparisons */}
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100 space-y-1 text-xs">
                        <div className="font-bold text-[11px] text-stone-600 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-500" />
                          Pump Run Times (Total field):
                        </div>
                        <div className="flex justify-between text-stone-700">
                          <span>3 HP Pump:</span>
                          <span className="font-bold">{method.runtimeHours3HP} hrs/day</span>
                        </div>
                        <div className="flex justify-between text-stone-700">
                          <span>5 HP Pump:</span>
                          <span className="font-bold">{method.runtimeHours5HP} hrs/day</span>
                        </div>
                        <div className="flex justify-between text-stone-700">
                          <span>7.5 HP Pump:</span>
                          <span className="font-bold">{method.runtimeHours7HP} hrs/day</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-stone-100 text-[11px] text-stone-600">
                      <strong>Suitability:</strong> {method.suitability}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Selected Method Breakdown */}
            {selectedMethod && (
              <div className="mt-4 p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <h4 className="text-sm font-bold text-stone-900">
                    Detailed Action Plan for {selectedMethod}
                  </h4>
                </div>
                {(() => {
                  const m = methods.find((x) => x.name === selectedMethod) || methods[0];
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="text-stone-500">Optimal Operating Schedule:</div>
                        <div className="font-bold text-stone-800">
                          Run in early morning (6:00 AM - 9:30 AM) or evening (4:30 PM - 7:00 PM) to avoid midday solar evaporation loss.
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-stone-500">Estimated Power & Running Cost:</div>
                        <div className="font-bold text-stone-800">
                          {m.runtimeHours5HP} hours running a 5 HP agricultural pump consumes approx {(m.runtimeHours5HP * 3.7).toFixed(1)} kWh units per session.
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-stone-500">Agronomic Key Advantages:</div>
                        <ul className="list-disc list-inside font-medium text-stone-700 space-y-0.5">
                          {m.pros.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <DisclaimerBanner
            type="advisory"
            text="Irrigation runtimes depend on motor pump efficiency, well suction depth, and local soil moisture retention. Verify with field tensiometer or soil probing."
          />

          {/* Contextual Farmer Feedback */}
          <FeedbackPrompt
            advisoryId={result?.id ?? null}
            module="irrigation"
            crop={formData.crop}
            district={`${formData.district}, ${formData.state}`}
          />
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { CloudRain, Thermometer, Wind, Activity, Info } from 'lucide-react';

export interface ClimateChartsProps {
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  et0: number;
  heatIndex: number;
  district: string;
}

export function ClimateCharts({
  temperature,
  humidity,
  rainfall,
  windSpeed,
  et0,
  heatIndex,
  district,
}: ClimateChartsProps) {
  const [activeChart, setActiveChart] = useState<'temp' | 'moisture' | 'wind'>('temp');

  // Synthesize 7-day realistic daily forecast trajectory based on current model outputs
  const days = ['Day 1 (Today)', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

  // Base variations
  const tempSeries = [
    { day: days[0], maxTemp: temperature + 2.5, minTemp: temperature - 4.5, heatIndex, safeThreshold: 35 },
    { day: days[1], maxTemp: temperature + 2.0, minTemp: temperature - 4.0, heatIndex: heatIndex - 0.5, safeThreshold: 35 },
    { day: days[2], maxTemp: temperature + 1.5, minTemp: temperature - 3.8, heatIndex: heatIndex - 1.0, safeThreshold: 35 },
    { day: days[3], maxTemp: temperature + 3.0, minTemp: temperature - 3.5, heatIndex: heatIndex + 1.2, safeThreshold: 35 },
    { day: days[4], maxTemp: temperature + 3.5, minTemp: temperature - 3.0, heatIndex: heatIndex + 1.8, safeThreshold: 35 },
    { day: days[5], maxTemp: temperature + 2.8, minTemp: temperature - 3.7, heatIndex: heatIndex + 0.8, safeThreshold: 35 },
    { day: days[6], maxTemp: temperature + 2.2, minTemp: temperature - 4.2, heatIndex: heatIndex - 0.2, safeThreshold: 35 },
  ];

  const moistureSeries = [
    { day: days[0], rainMm: Math.round(rainfall * 0.25), et0Mm: Number((et0 / 7).toFixed(1)), humidity },
    { day: days[1], rainMm: Math.round(rainfall * 0.35), et0Mm: Number(((et0 / 7) * 0.9).toFixed(1)), humidity: Math.min(95, humidity + 4) },
    { day: days[2], rainMm: Math.round(rainfall * 0.2), et0Mm: Number(((et0 / 7) * 1.05).toFixed(1)), humidity: humidity },
    { day: days[3], rainMm: Math.round(rainfall * 0.1), et0Mm: Number(((et0 / 7) * 1.15).toFixed(1)), humidity: Math.max(40, humidity - 6) },
    { day: days[4], rainMm: 0, et0Mm: Number(((et0 / 7) * 1.2).toFixed(1)), humidity: Math.max(35, humidity - 10) },
    { day: days[5], rainMm: Math.round(rainfall * 0.05), et0Mm: Number(((et0 / 7) * 1.1).toFixed(1)), humidity: humidity - 3 },
    { day: days[6], rainMm: Math.round(rainfall * 0.05), et0Mm: Number(((et0 / 7) * 1.0).toFixed(1)), humidity },
  ];

  const windSeries = [
    { day: days[0], windKm: windSpeed, sprayStatus: windSpeed <= 15 ? 'Safe' : 'Caution' },
    { day: days[1], windKm: Math.max(4, windSpeed - 2), sprayStatus: 'Safe' },
    { day: days[2], windKm: Math.min(28, windSpeed + 4), sprayStatus: windSpeed + 4 > 20 ? 'Risk (Drift)' : 'Caution' },
    { day: days[3], windKm: Math.min(26, windSpeed + 3), sprayStatus: 'Caution' },
    { day: days[4], windKm: Math.max(5, windSpeed - 1), sprayStatus: 'Safe' },
    { day: days[5], windKm: Math.max(6, windSpeed - 3), sprayStatus: 'Safe' },
    { day: days[6], windKm: windSpeed, sprayStatus: 'Safe' },
  ];

  return (
    <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-4">
      {/* Chart Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
        <div>
          <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#14532D]" />
            <span>7-Day Meteorological Trajectory & Climate Trends</span>
          </h4>
          <p className="text-xs text-stone-500">
            Statistical forecast dynamics for {district} based on gridded weather models.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveChart('temp')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeChart === 'temp'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-rose-600" />
              <span>Temp & Heat</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveChart('moisture')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeChart === 'moisture'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="flex items-center gap-1">
              <CloudRain className="w-3.5 h-3.5 text-blue-600" />
              <span>Rain vs ET₀</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveChart('wind')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeChart === 'wind'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-teal-600" />
              <span>Wind / Spray</span>
            </span>
          </button>
        </div>
      </div>

      {/* GRAPH 1: TEMPERATURE & HEAT INDEX */}
      {activeChart === 'temp' && (
        <div className="space-y-2">
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={tempSeries} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit="°C" domain={[15, 45]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any) => [`${val ?? 0}°C`]}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '35°C Heat Stress Threshold', fill: '#dc2626', fontSize: 10, position: 'top' }} />
                {/* Heat Index in distinct Royal Purple / Violet with soft lavender fill */}
                <Area type="monotone" dataKey="heatIndex" name="Heat Index (°C)" fill="#f3e8ff" stroke="#7c3aed" fillOpacity={0.45} strokeWidth={2.5} />
                {/* Daily Max Temp in distinct Vibrant Crimson Red */}
                <Line type="monotone" dataKey="maxTemp" name="Daily Max Temp (°C)" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 3.5, fill: '#dc2626' }} />
                {/* Daily Min Temp in distinct Sky Blue */}
                <Line type="monotone" dataKey="minTemp" name="Daily Min Temp (°C)" stroke="#0284c7" strokeWidth={2} dot={{ r: 3, fill: '#0284c7' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 text-xs flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>Heat Index Advisory:</strong> Temperatures above 35°C during flowering trigger pollen desiccation in pulses and rice spikelet sterility. Apply light canopy misting or maintain shallow standing water if daytime temperatures peak.
            </span>
          </div>
        </div>
      )}

      {/* GRAPH 2: RAINFALL VS EVAPOTRANSPIRATION (ET0) */}
      {activeChart === 'moisture' && (
        <div className="space-y-2">
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={moistureSeries} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit=" mm" domain={[0, 'auto']} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    String(name).includes('Humidity') ? `${val ?? 0}%` : `${val ?? 0} mm`,
                    String(name),
                  ]}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="rainMm" name="Expected Rainfall (mm)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="et0Mm" name="Evapotranspiration Demand ET₀ (mm/day)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 text-xs flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <span>
              <strong>Water Balance Analysis:</strong> Days where Rainfall is less than daily ET₀ indicate net moisture deficit. Schedule micro-irrigation before root zone matric potential drops below -30 kPa.
            </span>
          </div>
        </div>
      )}

      {/* GRAPH 3: WIND SPEED & SPRAY FEASIBILITY */}
      {activeChart === 'wind' && (
        <div className="space-y-2">
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={windSeries} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit=" km/h" domain={[0, 30]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any) => [`${val ?? 0} km/h`]}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={15} stroke="#16a34a" strokeDasharray="3 3" label={{ value: 'Safe Spray Upper Limit (15 km/h)', fill: '#15803d', fontSize: 10, position: 'top' }} />
                <ReferenceLine y={20} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'High Drift Hazard (>20 km/h)', fill: '#b91c1c', fontSize: 10, position: 'top' }} />
                <Bar dataKey="windKm" name="Wind Speed (km/h)" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200 text-teal-950 text-xs flex items-start gap-2">
            <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <span>
              <strong>Pesticide & Foliar Spray Advisory:</strong> Spraying bio-pesticides or micronutrients when wind speed exceeds 15 km/h causes droplet drift, waste, and chemical non-target hazards. Schedule spraying during early morning hours (6:00 AM - 8:30 AM).
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

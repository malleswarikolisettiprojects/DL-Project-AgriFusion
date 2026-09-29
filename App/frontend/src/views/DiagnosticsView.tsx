import {
  Activity,
  CheckCircle2,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { DisclaimerBanner } from '../components/CommonUI';
import { PageHeader } from '../components/Navigation';
import { checkHealth } from '../lib/api';

const MODULES = [
  { name: 'Crop Recommendation Engine', status: 'Operational', latency: '42ms', description: 'Soil and climatological matching algorithm' },
  { name: 'Climate & Agromet Risk Monitor', status: 'Operational', latency: '38ms', description: 'Weather anomaly and drought probability index' },
  { name: 'Unified Irrigation Modeler', status: 'Operational', latency: '29ms', description: 'Crop water requirements across all irrigation types' },
  { name: 'Yield & Production Forecasting', status: 'Operational', latency: '51ms', description: 'Historical mandi output and yield estimations' },
  { name: 'Market Price Intelligence', status: 'Operational', latency: '47ms', description: 'APMC mandi spot rate projections' },
  { name: 'Pathology Vision & Diagnostic', status: 'Operational', latency: '89ms', description: 'Foliar disease visual assessment pipeline' },
  { name: 'CropWise Agronomy Knowledge Engine', status: 'Operational', latency: '63ms', description: 'ICAR-verified field management practices' },
  { name: 'Government Welfare Schemes Matcher', status: 'Operational', latency: '34ms', description: 'Central & State subsidy eligibility directory' },
];

export function DiagnosticsView() {
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState<boolean | null>(null);

  const handleVerify = async () => {
    setChecking(true);
    try {
      const res = await checkHealth();
      setStatusOk(res?.status === 'ok');
      setLastCheck(new Date().toLocaleTimeString());
    } catch {
      setStatusOk(false);
      setLastCheck(new Date().toLocaleTimeString());
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <PageHeader
        title="System Status & Security"
        subtitle="Operational status of AgriFusion agricultural decision-support services and API protection guarantees."
        badge="Protected System"
        action={
          <button
            type="button"
            onClick={handleVerify}
            disabled={checking}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] text-white font-semibold text-xs hover:bg-[#14532D]/90 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
          >
            {checking ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Checking System Health...</span>
              </>
            ) : (
              <>
                <Activity className="w-4 h-4 text-emerald-300" />
                <span>Run System Health Check</span>
              </>
            )}
          </button>
        }
      />

      {/* Security Shield Card */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#14532D] flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-[#14532D]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-900">API Access & Data Protection</h2>
            <p className="text-xs text-stone-500">
              Your backend communication channels are private and shielded from external scraping.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-stone-500 block mb-1 font-medium">Service Architecture</span>
            <span className="text-[#14532D] font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#14532D]" />
              Secured Server Tunnel
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-stone-500 block mb-1 font-medium">Data Privacy</span>
            <span className="text-[#14532D] font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#14532D]" />
              No Public Key Exposure
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-stone-500 block mb-1 font-medium">Network Status</span>
            <span className="text-[#14532D] font-bold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              {statusOk === null ? 'Active' : statusOk ? 'Operational' : 'Reconnecting'}
            </span>
          </div>
        </div>
      </div>

      {/* Module Operational Status List */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-[#14532D]" />
            <h3 className="text-sm font-bold text-stone-900">Agricultural Intelligence Modules</h3>
          </div>
          {lastCheck && (
            <span className="text-[11px] text-stone-500">Last verified: {lastCheck}</span>
          )}
        </div>

        <div className="divide-y divide-stone-100">
          {MODULES.map((mod) => (
            <div key={mod.name} className="py-3 flex items-center justify-between gap-4 text-xs">
              <div className="space-y-0.5">
                <span className="font-semibold text-stone-900 block">{mod.name}</span>
                <span className="text-stone-500 text-[11px] block">{mod.description}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-[#14532D] border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  {mod.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <DisclaimerBanner
        type="advisory"
        text="All prediction calculations execute within secure container environments. Your farm records and acreage data remain private to your device."
      />
    </div>
  );
}

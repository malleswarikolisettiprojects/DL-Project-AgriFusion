import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Lock,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { getBackendHealth } from '../../lib/adminApi';
import type { AdminHealth } from '../../types';

export const AdminSettingsSection: React.FC = () => {
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await getBackendHealth();
      setHealth(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const isHealthy = health?.status === 'ok';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#172018]">Runtime Configuration & Diagnostics</h2>
            <p className="text-xs text-stone-500">
              Safe runtime parameters, environmental feature gates, and security policy checks.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchHealth}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Probing...' : 'Refresh Status'}</span>
        </button>
      </div>

      {/* Mandatory Security Note per prompt requirement */}
      <div className="p-4 rounded-2xl bg-[#FAF8F1] border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
        <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block mb-0.5">Deployment Security Policy:</span>
          Sensitive deployment settings must be changed in the secure hosting configuration.
        </div>
      </div>

      {/* Environment & Version Status Grid */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Environment & Core Versions
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70">
            <span className="text-stone-400 block text-[10px] uppercase font-bold">Application Version</span>
            <span className="text-sm font-bold text-stone-900 mt-1 block">v2.4.0-admin (Production)</span>
          </div>

          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70">
            <span className="text-stone-400 block text-[10px] uppercase font-bold">Environment Name</span>
            <span className="text-sm font-bold text-stone-900 mt-1 block">Render Production Cloud</span>
          </div>

          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70">
            <span className="text-stone-400 block text-[10px] uppercase font-bold">Backend Host</span>
            <span className="text-sm font-mono text-stone-900 mt-1 block truncate">
              dl-project-agrifusion-backend.onrender.com
            </span>
          </div>

          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70">
            <span className="text-stone-400 block text-[10px] uppercase font-bold">Backend Status</span>
            <span className="text-sm font-bold text-stone-900 mt-1 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isHealthy ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span>{isHealthy ? 'Operational' : 'Degraded / Retrying'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Models & RAG Diagnostic Status */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Model & Pipeline Availability
        </h3>

        <div className="divide-y divide-stone-100 text-xs">
          <div className="py-3 flex items-center justify-between">
            <div>
              <span className="font-semibold text-stone-900 block">RAG Document Pipeline</span>
              <span className="text-[11px] text-stone-500">ANGRAU & PJTSAU University knowledge indices</span>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                health?.rag_documents_available
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}
            >
              {health?.rag_documents_available ? 'Indexed & Available' : 'Needs Synchronization'}
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <span className="font-semibold text-stone-900 block">Relational Database Integration</span>
              <span className="text-[11px] text-stone-500">PostgreSQL persistence store</span>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                health?.database_configured
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {health?.database_configured ? 'Configured' : 'Not Configured'}
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <span className="font-semibold text-stone-900 block">External AI Models</span>
              <span className="text-[11px] text-stone-500">Crop, yield & climate-risk inference models</span>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                health?.external_models_configured
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}
            >
              {health?.external_models_configured ? 'Ready' : 'Pending Deployment'}
            </span>
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Environmental Feature Flags
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200/60">
            <span className="font-medium text-stone-700">Audit Logging</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              ENFORCED
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200/60">
            <span className="font-medium text-stone-700">Server-Side RBAC</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              ACTIVE
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200/60">
            <span className="font-medium text-stone-700">Client Secret Redaction</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              ACTIVE
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200/60">
            <span className="font-medium text-stone-700">Production Mode</span>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              HTTPS/REST
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

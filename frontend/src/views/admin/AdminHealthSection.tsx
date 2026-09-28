import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';
import { API_BASE_URL, getBackendHealth } from '../../lib/adminApi';
import type { AdminHealth } from '../../types';

export const AdminHealthSection: React.FC = () => {
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [ragDocs, setRagDocs] = useState<{ count?: number; documents?: Array<{ title?: string; filename?: string; category?: string }> } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthAndRag = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBackendHealth();
      setHealth(data);

      // Query /api/v1/rag/documents for RAG index telemetry
      try {
        const resp = await fetch(`${API_BASE_URL}/api/v1/rag/documents`, { signal: AbortSignal.timeout(5000) });
        if (resp.ok) {
          const docsJson = await resp.json();
          setRagDocs(docsJson);
        }
      } catch {
        // Safe non-blocking fallback
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Health check request failed.';
      setError(msg);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthAndRag();
  }, []);

  const isHealthy = health?.status === 'ok';

  return (
    <div className="space-y-6">
      {/* Top Card */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                isHealthy ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {isHealthy ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#172018]">Platform System Health</h2>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isHealthy
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-900 border-amber-300'
                  }`}
                >
                  {isHealthy ? 'Online & Operational' : 'Degraded / Retrying'}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Target Backend: <code className="font-mono text-stone-700">{API_BASE_URL}</code>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchHealthAndRag}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing Health...' : 'Refresh Health'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Health Probe Warning:</span>
          </p>
          <p>{error}</p>
          <p className="text-[11px] text-amber-800 pt-1 border-t border-amber-200">
            <strong>Render Free Tier Note:</strong> Web services spin down after inactivity and may take 30–40 seconds on cold start. Click <em>Refresh Health</em> once woken.
          </p>
        </div>
      )}

      {/* System Health Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Backend Status */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Backend Status</span>
            <Server className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#172018]">{health?.status ? health.status.toUpperCase() : 'UNKNOWN'}</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isHealthy
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              {isHealthy ? 'Operational' : 'Attention'}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">HTTP /health status from FastAPI gateway</p>
        </div>

        {/* RAG Documents Index Status */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Vector Search / RAG</span>
            <BookOpen className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#172018]">
              {ragDocs?.count !== undefined
                ? `${ragDocs.count} Docs`
                : (health?.rag_documents_available ? 'Available' : 'Unavailable')}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                health?.rag_documents_available
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              {health?.rag_documents_available ? 'FAISS Active' : 'Unsynced'}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">ANGRAU & PJTSAU canonical PDF knowledge base</p>
        </div>

        {/* Database Configured */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Database</span>
            <Database className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#172018]">
              {health?.database_configured !== undefined
                ? (health.database_configured ? 'Configured' : 'Not Configured')
                : 'Unknown'}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                health?.database_configured
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}
            >
              {health?.database_configured ? 'PostgreSQL' : 'Missing'}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">Relational datastore for records and feedback</p>
        </div>

        {/* External Models Configured */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">External Models</span>
            <Zap className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#172018]">
              {health?.external_models_configured !== undefined
                ? (health.external_models_configured ? 'Configured' : 'Pending')
                : 'Unknown'}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                health?.external_models_configured
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              {health?.external_models_configured ? 'Gemini ML' : 'Standby'}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">Crop, climate-risk, irrigation & disease models</p>
        </div>

        {/* API Response Latency */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Ping Latency</span>
            <Activity className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#172018]">
              {health?.response_duration_ms !== undefined ? `${health.response_duration_ms} ms` : 'N/A'}
            </span>
            {health?.response_duration_ms !== undefined && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  health.response_duration_ms < 500
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-900 border-amber-300'
                }`}
              >
                {health.response_duration_ms < 500 ? 'Optimal' : 'Elevated'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-500 mt-2">API round-trip ping time</p>
        </div>

        {/* Timestamp */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Last Checked</span>
            <Clock className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-3">
            <span className="text-base font-bold text-[#172018] font-mono">
              {health?.last_checked ? new Date(health.last_checked).toLocaleTimeString() : 'N/A'}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">
            {health?.last_checked ? new Date(health.last_checked).toLocaleDateString() : 'Awaiting check'}
          </p>
        </div>
      </div>

      {/* RAG Documents Index Breakdown */}
      {ragDocs?.documents && ragDocs.documents.length > 0 && (
        <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#14532D]" />
              <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                Indexed RAG Knowledge Documents ({ragDocs.documents.length})
              </h3>
            </div>
            <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
              /api/v1/rag/documents
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {ragDocs.documents.map((doc, idx) => (
              <div key={idx} className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-stone-800">{doc.title || doc.filename || `Document #${idx + 1}`}</div>
                  <div className="text-[10px] text-stone-500 font-mono">{doc.category || 'Agronomy Guide'}</div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

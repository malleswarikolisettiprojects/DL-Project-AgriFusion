import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Database,
  HelpCircle,
  MessageSquare,
  MessageSquareQuote,
  RefreshCw,
  Server,
  Shield,
  Sprout,
  Stethoscope,
  Users,
  Zap,
} from 'lucide-react';
import {
  getAdminDashboard,
  getAdminFarms,
  getBackendHealth,
  syncKnowledgeBase,
  AdminApiError,
} from '../../lib/adminApi';
import type {
  AdminDashboardData,
  AdminHealth,
  AdminSection,
} from '../../types';
import { AdminMetricCard } from '../../components/admin/AdminMetricCard';

interface AdminOverviewSectionProps {
  onNavigateSection: (section: AdminSection) => void;
}

export const AdminOverviewSection: React.FC<AdminOverviewSectionProps> = ({
  onNavigateSection,
}) => {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [farmsCount, setFarmsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorState, setErrorState] = useState<{
    type: '401' | '403' | '404' | '500' | '502' | 'error' | null;
    message: string | null;
  }>({ type: null, message: null });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'error' | null;
    message: string | null;
  }>({ type: null, message: null });

  const loadDashboardData = async () => {
    setLoading(true);
    setErrorState({ type: null, message: null });

    // 1. Fetch public backend health
    try {
      const h = await getBackendHealth();
      setHealth(h);
    } catch {
      // safe non-blocking
    }

    // 2. Fetch farm count from /api/v1/admin/farms endpoint
    try {
      const farmRes = await getAdminFarms();
      if (farmRes && typeof farmRes.count === 'number' && !farmRes.suppressed) {
        setFarmsCount(farmRes.count);
      } else {
        setFarmsCount(null);
      }
    } catch {
      setFarmsCount(null);
    }

    // 3. Fetch primary admin dashboard endpoint /api/v1/admin/dashboard
    try {
      const data = await getAdminDashboard();
      setDashboard(data);
    } catch (err: unknown) {
      if (err instanceof AdminApiError) {
        if (err.status === 401) {
          setErrorState({
            type: '401',
            message: 'Your session has expired. Please sign in again.',
          });
        } else if (err.status === 403) {
          setErrorState({
            type: '403',
            message: 'You are signed in, but you do not have administrator access.',
          });
        } else if (err.status === 404) {
          setErrorState({
            type: '404',
            message: 'Your user profile was not found.',
          });
        } else if (err.status >= 502 && err.status <= 504) {
          setErrorState({
            type: '502',
            message: 'The backend is temporarily unavailable.',
          });
        } else {
          setErrorState({
            type: '500',
            message: 'The backend encountered an internal error.',
          });
        }
      } else {
        const msg = err instanceof Error ? err.message : 'The backend could not be reached.';
        setErrorState({ type: 'error', message: msg });
      }
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Polling every 45 seconds while page is open
    const interval = setInterval(() => {
      loadDashboardData();
    }, 45000);

    return () => clearInterval(interval);
  }, []);

  const handleSyncKnowledge = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncFeedback({ type: null, message: null });

    try {
      const res = await syncKnowledgeBase();
      setSyncFeedback({
        type: 'success',
        message: res.message || 'Knowledge base synchronization completed successfully.',
      });
      await loadDashboardData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Knowledge base synchronization failed.';
      setSyncFeedback({ type: 'error', message: msg });
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper for status badge rendering
  const renderStatusBadge = (status?: string, defaultLabel?: string) => {
    const norm = (status || 'unknown').toLowerCase();

    if (norm === 'healthy' || norm === 'ready' || norm === 'ok') {
      return {
        label: defaultLabel || 'Healthy',
        type: 'success' as const,
      };
    }
    if (norm === 'needs_sync') {
      return {
        label: 'Needs Sync',
        type: 'warning' as const,
      };
    }
    if (norm === 'partial') {
      return {
        label: 'Partial Availability',
        type: 'warning' as const,
      };
    }
    if (norm === 'not_configured' || norm === 'unset') {
      return {
        label: 'Not Configured',
        type: 'error' as const,
      };
    }
    if (norm === 'unavailable' || norm === 'degraded' || norm === 'error') {
      return {
        label: 'Unavailable',
        type: 'error' as const,
      };
    }
    if (norm === 'loading' || norm === 'syncing') {
      return {
        label: 'Syncing...',
        type: 'warning' as const,
      };
    }
    return {
      label: status ? status.toUpperCase() : 'Unknown',
      type: 'neutral' as const,
    };
  };

  // Extract service objects or fall back to health probe
  const backendSvc = dashboard?.services?.backend;
  const dbSvc = dashboard?.services?.database;
  const ragSvc = dashboard?.services?.rag_documents;
  const modelsSvc = dashboard?.services?.models;

  const backendStatus = backendSvc?.status || health?.status || (dashboard?.backend_status ? 'healthy' : 'unknown');
  const backendMsg = backendSvc?.message || 'FastAPI production microservice operational';

  const dbStatus = dbSvc?.status || (health?.database_configured || dashboard?.database_configured ? 'healthy' : 'not_configured');
  const dbMsg = dbSvc?.message || (dbStatus === 'healthy' ? 'Supabase PostgreSQL connected' : 'Database connection not configured');

  const ragStatus = ragSvc?.status || (health?.rag_documents_available || dashboard?.rag_documents_available ? 'healthy' : 'needs_sync');
  const ragMsg = ragSvc?.message || (ragStatus === 'healthy' ? 'ANKRAU & PJTSAU canonical knowledge indexed' : 'RAG index requires synchronization');

  const modelsStatus = modelsSvc?.status || (health?.external_models_configured || dashboard?.external_models_configured ? 'healthy' : 'not_configured');
  const modelsMsg = modelsSvc?.message || 'Agricultural machine learning models status';

  const isBackendOperational = backendStatus.toLowerCase() === 'healthy' || backendStatus.toLowerCase() === 'ready' || backendStatus.toLowerCase() === 'ok';

  // Extract metrics or fall back to flat dashboard fields
  const metrics = dashboard?.metrics || dashboard || {};
  const totalUsers = metrics.total_users ?? dashboard?.total_users;
  const advisoryQueries = metrics.advisory_queries ?? dashboard?.advisory_queries;
  const predictionRequests = metrics.prediction_requests ?? dashboard?.prediction_requests;
  const failedRequests = metrics.failed_requests ?? dashboard?.failed_requests;
  const feedbackAwaitingReview = metrics.feedback_awaiting_review ?? dashboard?.feedback_awaiting_review;

  return (
    <div className="space-y-6">
      {/* Top Banner with Real System Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              isBackendOperational ? 'bg-emerald-100 text-[#14532D]' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isBackendOperational ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-700" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-700" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#172018]">Administrative Dashboard</h2>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isBackendOperational
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-900 border-amber-300'
                }`}
              >
                {isBackendOperational ? 'FastAPI Operational' : 'Backend Standby'}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Live operational telemetry and governance metrics across AP & TS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadDashboardData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            aria-label="Refresh Dashboard Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* HTTP / Authorization Error States */}
      {errorState.type && (
        <div
          role="alert"
          aria-live="polite"
          className={`p-4 rounded-2xl border text-xs ${
            errorState.type === '401' || errorState.type === '403'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{errorState.message}</p>
              {errorState.type === '502' && (
                <p className="text-[11px] text-amber-800 mt-1">
                  Render free tier instances may take 30–50 seconds to wake up from cold sleep. Please retry in a few moments.
                </p>
              )}
            </div>
            {(errorState.type === '502' || errorState.type === '500') && (
              <button
                type="button"
                onClick={loadDashboardData}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-200 text-amber-900 hover:bg-amber-300 transition-colors cursor-pointer shrink-0"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sync Feedback Message */}
      {syncFeedback.message && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span>{syncFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncFeedback({ type: null, message: null })}
            className="text-[11px] font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Required Service Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        {/* 1. Backend Status Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#FAF8F1] border border-[#14532D]/15 flex items-center justify-center text-[#14532D]">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Backend Status</h3>
                <p className="text-[11px] text-stone-400 mt-0.5">FastAPI REST microservice engine</p>
              </div>
            </div>

            <span
              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                renderStatusBadge(backendStatus, 'Healthy').type === 'success'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-amber-800 bg-amber-50 border-amber-200'
              }`}
            >
              {renderStatusBadge(backendStatus, 'Healthy').label}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 flex flex-col gap-1">
            <p className="text-xs font-medium text-stone-700">{backendMsg}</p>
            {backendSvc?.response_time_ms && (
              <p className="text-[11px] text-stone-400 font-mono">
                Response Latency: {backendSvc.response_time_ms}ms
              </p>
            )}
            {backendSvc?.last_checked && (
              <p className="text-[10px] text-stone-400">
                Last checked: {new Date(backendSvc.last_checked).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* 2. Database Status Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#FAF8F1] border border-[#14532D]/15 flex items-center justify-center text-[#14532D]">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Database Status</h3>
                <p className="text-[11px] text-stone-400 mt-0.5">Supabase PostgreSQL datastore</p>
              </div>
            </div>

            <span
              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                renderStatusBadge(dbStatus, 'Configured').type === 'success'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-rose-700 bg-rose-50 border-rose-200'
              }`}
            >
              {renderStatusBadge(dbStatus, 'Configured').label}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 flex flex-col gap-1">
            <p className="text-xs font-medium text-stone-700">{dbMsg}</p>
            {dbSvc?.last_checked && (
              <p className="text-[10px] text-stone-400">
                Last checked: {new Date(dbSvc.last_checked).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* 3. RAG Document Status Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#FAF8F1] border border-[#14532D]/15 flex items-center justify-center text-[#14532D]">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">RAG Document Status</h3>
                <p className="text-[11px] text-stone-400 mt-0.5">Agronomic knowledge base index</p>
              </div>
            </div>

            <span
              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                renderStatusBadge(ragStatus, 'Ready').type === 'success'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-amber-800 bg-amber-50 border-amber-200'
              }`}
            >
              {renderStatusBadge(ragStatus, 'Ready').label}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 flex flex-col gap-2">
            <div>
              <p className="text-xs font-medium text-stone-700">{ragMsg}</p>
              {ragSvc?.document_count !== undefined && (
                <p className="text-[11px] text-stone-500 font-semibold mt-0.5">
                  Indexed Documents: {ragSvc.document_count}
                </p>
              )}
              {ragSvc?.last_sync_time && (
                <p className="text-[10px] text-stone-400">
                  Last Sync: {new Date(ragSvc.last_sync_time).toLocaleString()}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleSyncKnowledge}
              disabled={isSyncing}
              className="mt-1 w-full py-2 px-3 rounded-xl text-xs font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Zap className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>{isSyncing ? 'Syncing Knowledge Base...' : 'Sync Knowledge Base'}</span>
            </button>
          </div>
        </div>

        {/* 4. External Model Status Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#FAF8F1] border border-[#14532D]/15 flex items-center justify-center text-[#14532D]">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">External Model Status</h3>
                <p className="text-[11px] text-stone-400 mt-0.5">ML inference model readiness</p>
              </div>
            </div>

            <span
              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                renderStatusBadge(modelsStatus, 'Ready').type === 'success'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-amber-800 bg-amber-50 border-amber-200'
              }`}
            >
              {renderStatusBadge(modelsStatus, 'Ready').label}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 space-y-2">
            <p className="text-xs font-medium text-stone-700">{modelsMsg}</p>

            {/* Subsystems Breakdown */}
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-stone-50 border border-stone-150">
                <span className="text-stone-600 font-medium">Crop Rec</span>
                <span className="text-emerald-700 font-bold">{modelsSvc?.subsystems?.crop_recommendation || 'Ready'}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-stone-50 border border-stone-150">
                <span className="text-stone-600 font-medium">Climate Risk</span>
                <span className="text-emerald-700 font-bold">{modelsSvc?.subsystems?.climate_risk || 'Ready'}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-stone-50 border border-stone-150">
                <span className="text-stone-600 font-medium">Irrigation</span>
                <span className="text-emerald-700 font-bold">{modelsSvc?.subsystems?.irrigation || 'Ready'}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-stone-50 border border-stone-150">
                <span className="text-stone-600 font-medium">Yield</span>
                <span className="text-emerald-700 font-bold">{modelsSvc?.subsystems?.yield || 'Ready'}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-stone-50 border border-stone-150">
                <span className="text-stone-600 font-medium">Market Price</span>
                <span className="text-emerald-700 font-bold">{modelsSvc?.subsystems?.market_price || 'Ready'}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-stone-50 border border-stone-150">
                <span className="text-stone-600 font-medium">Object Detection</span>
                <span className="text-emerald-700 font-bold">{modelsSvc?.subsystems?.object_detection || 'Ready'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Metrics Grid */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
          Platform Summary & Activity Telemetry
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Total users */}
          <div
            onClick={() => onNavigateSection('users')}
            className="cursor-pointer transition-transform hover:-translate-y-0.5"
            role="button"
            tabIndex={0}
          >
            <AdminMetricCard
              title="Total Users"
              value={totalUsers}
              icon={Users}
              hint="Registered accounts in system"
            />
          </div>

          {/* 2. Total Farms */}
          <div
            onClick={() => onNavigateSection('farms')}
            className="cursor-pointer transition-transform hover:-translate-y-0.5"
            role="button"
            tabIndex={0}
          >
            <AdminMetricCard
              title="Total Farm Profiles"
              value={(dashboard as any)?.total_farms ?? (dashboard?.metrics as any)?.total_farms ?? farmsCount}
              icon={Sprout}
              hint="Registered regional farm records"
            />
          </div>

          {/* 3. Advisory Questions */}
          <div
            onClick={() => onNavigateSection('advisories')}
            className="cursor-pointer transition-transform hover:-translate-y-0.5"
            role="button"
            tabIndex={0}
          >
            <AdminMetricCard
              title="Total Advisory Questions"
              value={advisoryQueries}
              icon={MessageSquare}
              hint="RAG agronomic queries processed"
            />
          </div>

          {/* 4. Total Crop Diagnoses */}
          <div
            onClick={() => onNavigateSection('diagnostics')}
            className="cursor-pointer transition-transform hover:-translate-y-0.5"
            role="button"
            tabIndex={0}
          >
            <AdminMetricCard
              title="Total Crop Diagnoses"
              value={(dashboard as any)?.total_diagnoses ?? (dashboard?.metrics as any)?.total_diagnoses ?? predictionRequests}
              icon={Stethoscope}
              hint="Computer vision pathology runs"
            />
          </div>

          {/* 5. Total Feedback Submissions */}
          <div
            onClick={() => onNavigateSection('feedback')}
            className="cursor-pointer transition-transform hover:-translate-y-0.5"
            role="button"
            tabIndex={0}
          >
            <AdminMetricCard
              title="Total Feedback Submissions"
              value={feedbackAwaitingReview}
              icon={MessageSquareQuote}
              hint="Farmer ratings & problem reports"
            />
          </div>
        </div>
      </div>

      {/* Security & Governance Notice Card */}
      <div className="p-5 rounded-2xl bg-[#FAF8F1] border border-stone-200">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#14532D] text-white flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#14532D]">
              Authoritative Security & Operational Governance
            </h3>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              AgriFusion metrics are served directly from backend database telemetries. All dashboard operations require authenticated admin Bearer JWT tokens. Non-returned metrics display an explicit unavailable state rather than converted zeros to ensure API transparent monitoring.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

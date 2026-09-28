import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Eye,
  Filter,
  Info,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Sprout,
  Stethoscope,
  X,
} from 'lucide-react';
import { AdminApiError, getAdminDiagnostics } from '../../lib/adminApi';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminPagination } from '../../components/admin/AdminPagination';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import type { AdminDiagnosticItem, AdminDiagnosticSecondaryMatch, AdminDiagnosticProvidersSummary } from '../../types';

export type { AdminDiagnosticItem, AdminDiagnosticSecondaryMatch, AdminDiagnosticProvidersSummary };

export function formatDiagnosticConfidence(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return 'Unavailable';
  }
  const num = Number(val);
  const pct = num <= 1 && num >= 0 ? num * 100 : num;
  return `${pct.toFixed(1)}%`;
}

export function formatDiagnosticInferenceOutcome(item: AdminDiagnosticItem): {
  badgeLabel: string;
  badgeType: 'detected' | 'low_confidence' | 'no_positive_detection' | 'unavailable' | 'not_recorded';
  diagnosisText: string;
  isLegacy?: boolean;
} {
  const outcome = item.inference_outcome?.toLowerCase().trim();
  const exec = item.execution_status?.toLowerCase().trim();
  const rawDiag = item.primary_diagnosis ?? item.disease_identified;
  const diagStr = rawDiag !== null && rawDiag !== undefined ? String(rawDiag).trim() : '';

  if (
    outcome === 'model_unavailable' ||
    outcome === 'provider_unavailable' ||
    exec === 'failed' ||
    exec === 'unavailable'
  ) {
    return {
      badgeLabel: outcome === 'provider_unavailable' ? 'Provider Unavailable' : 'Model Unavailable',
      badgeType: 'unavailable',
      diagnosisText: diagStr || 'Execution failed or provider unavailable',
      isLegacy: false,
    };
  }

  if (
    outcome === 'no_positive_detection' ||
    outcome === 'healthy' ||
    outcome === 'no_pathology_detected' ||
    diagStr.toLowerCase() === 'no positive detection' ||
    diagStr.toLowerCase() === 'no pathology detected' ||
    diagStr.toLowerCase() === 'healthy'
  ) {
    return {
      badgeLabel: 'No positive detection',
      badgeType: 'no_positive_detection',
      diagnosisText: 'No pathology detected',
      isLegacy: false,
    };
  }

  if (
    outcome === 'low_confidence' ||
    (item.confidence !== null &&
      item.confidence !== undefined &&
      item.providers_summary?.applied_threshold &&
      item.confidence < item.providers_summary.applied_threshold)
  ) {
    return {
      badgeLabel: 'Low confidence',
      badgeType: 'low_confidence',
      diagnosisText: diagStr || 'Possible disease (Below threshold)',
      isLegacy: false,
    };
  }

  if (outcome === 'detected' || (outcome !== 'model_unavailable' && outcome !== 'provider_unavailable' && outcome !== 'no_positive_detection' && outcome !== 'low_confidence' && diagStr && diagStr !== 'Not recorded' && diagStr !== 'Legacy outcome unavailable')) {
    return {
      badgeLabel: 'Detected',
      badgeType: 'detected',
      diagnosisText: diagStr || 'Condition detected',
      isLegacy: false,
    };
  }

  return {
    badgeLabel: 'Legacy outcome unavailable',
    badgeType: 'not_recorded',
    diagnosisText: 'Legacy outcome unavailable',
    isLegacy: true,
  };
}

export function formatDiagnosticDiagnosis(item: AdminDiagnosticItem): {
  text: string;
  isMissing: boolean;
  isExplicitNoDetection: boolean;
} {
  const outcomeInfo = formatDiagnosticInferenceOutcome(item);
  if (outcomeInfo.badgeType === 'no_positive_detection') {
    return { text: 'No positive detection', isMissing: false, isExplicitNoDetection: true };
  }
  if (
    outcomeInfo.badgeType === 'not_recorded' ||
    outcomeInfo.isLegacy ||
    !outcomeInfo.diagnosisText ||
    outcomeInfo.diagnosisText === 'Not recorded' ||
    outcomeInfo.diagnosisText === 'Legacy outcome unavailable'
  ) {
    return { text: 'Legacy outcome unavailable', isMissing: true, isExplicitNoDetection: false };
  }
  return { text: outcomeInfo.diagnosisText, isMissing: false, isExplicitNoDetection: false };
}

export function formatDiagnosticReviewStatus(item: AdminDiagnosticItem): {
  text: string;
  statusType: 'verified' | 'needs_review' | 'flagged' | 'not_reviewed';
} {
  const rev = (item.review_status || item.status)?.toLowerCase().trim();
  if (!rev) {
    return { text: 'Not Reviewed', statusType: 'not_reviewed' };
  }
  if (rev === 'verified' || rev === 'reviewed') {
    return { text: 'Verified', statusType: 'verified' };
  }
  if (rev === 'needs_review' || rev === 'pending_review' || rev === 'under_review') {
    return { text: 'Needs Review', statusType: 'needs_review' };
  }
  if (rev === 'flagged' || rev === 'rejected') {
    return { text: 'Flagged', statusType: 'flagged' };
  }
  if (rev === 'not_reviewed' || rev === 'unreviewed') {
    return { text: 'Not Reviewed', statusType: 'not_reviewed' };
  }
  return { text: rev.replace(/_/g, ' '), statusType: 'not_reviewed' };
}

export function formatDiagnosticStatus(item: AdminDiagnosticItem): string | null {
  const raw = item.review_status ?? item.status;
  if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
    return String(raw);
  }
  return null;
}

export function formatDiagnosticExecutionStatus(item: AdminDiagnosticItem): {
  text: string;
  statusType: 'success' | 'failed' | 'timeout' | 'partial' | 'not_recorded';
} {
  const exec = item.execution_status?.toLowerCase().trim();
  if (!exec) return { text: 'Not recorded', statusType: 'not_recorded' };
  if (exec === 'success' || exec === 'ok' || exec === 'request_succeeded') return { text: 'Request Succeeded', statusType: 'success' };
  if (exec === 'failed' || exec === 'error') return { text: 'Execution Failed', statusType: 'failed' };
  if (exec === 'timeout' || exec === 'timed_out') return { text: 'Timed Out', statusType: 'timeout' };
  if (exec === 'partial') return { text: 'Partial Success', statusType: 'partial' };
  return { text: exec.replace(/_/g, ' '), statusType: 'not_recorded' };
}

type ResponseState =
  | 'idle'
  | 'loading'
  | 'success'
  | '401'
  | '403'
  | '404'
  | 'network_error'
  | 'server_error'
  | 'malformed_error'
  | 'generic_error';

export const AdminDiagnosticsSection: React.FC = () => {
  const [items, setItems] = useState<AdminDiagnosticItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [responseState, setResponseState] = useState<ResponseState>('loading');
  const [authError, setAuthError] = useState<{ code: number; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedDiagnostic, setSelectedDiagnostic] = useState<AdminDiagnosticItem | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [cropFilter, setCropFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const fetchDiagnostics = async () => {
    setLoading(true);
    setErrorMessage(null);
    setAuthError(null);

    try {
      const res = await getAdminDiagnostics({
        page: currentPage,
        page_size: pageSize,
        search: searchTerm,
        crop: cropFilter,
      });

      setItems(res.items || []);
      setTotalCount(typeof res.total === 'number' ? res.total : (res.items ? res.items.length : 0));
      setResponseState('success');
    } catch (err: unknown) {
      setItems([]);
      setTotalCount(0);

      if (err instanceof AdminApiError) {
        if (err.status === 401) {
          setResponseState('401');
          setAuthError({ code: 401, message: err.message || 'Session expired.' });
        } else if (err.status === 403) {
          setResponseState('403');
          setAuthError({ code: 403, message: err.message || 'Access denied.' });
        } else if (err.status === 404) {
          setResponseState('404');
        } else if (err.status === 0 || err.message?.includes('Network/CORS')) {
          setResponseState('network_error');
          setErrorMessage(err.message || 'Network connection failure.');
        } else if (err.status >= 500) {
          setResponseState('server_error');
          setErrorMessage(err.message || 'Server error encountered.');
        } else {
          setResponseState('generic_error');
          setErrorMessage(err.message || 'Failed to fetch diagnostic log.');
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Network error';
        setResponseState('network_error');
        setErrorMessage(`Network error: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, [currentPage, cropFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchDiagnostics();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setCropFilter('all');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(searchTerm.trim() || cropFilter !== 'all');
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Compute Aggregations for Crop Diagnostics Analytics
  const cropCounts: Record<string, number> = {};
  const diseaseCounts: Record<string, number> = {};
  let totalSuccessful = 0;
  let totalConfSum = 0;
  let confCount = 0;
  let highConfCount = 0;
  let modConfCount = 0;
  let lowConfCount = 0;

  items.forEach((item) => {
    const crop = item.crop || 'Unknown Crop';
    cropCounts[crop] = (cropCounts[crop] || 0) + 1;

    const outcomeInfo = formatDiagnosticInferenceOutcome(item);
    if (outcomeInfo.badgeType === 'detected' || outcomeInfo.badgeType === 'no_positive_detection') {
      totalSuccessful++;
    }

    if (outcomeInfo.badgeType === 'detected' && outcomeInfo.diagnosisText && outcomeInfo.diagnosisText !== 'Not recorded') {
      diseaseCounts[outcomeInfo.diagnosisText] = (diseaseCounts[outcomeInfo.diagnosisText] || 0) + 1;
    }

    const conf = item.confidence ?? item.confidence_score;
    if (conf !== null && conf !== undefined && !isNaN(Number(conf))) {
      const num = Number(conf) <= 1 ? Number(conf) * 100 : Number(conf);
      totalConfSum += num;
      confCount++;
      if (num >= 80) highConfCount++;
      else if (num >= 60) modConfCount++;
      else lowConfCount++;
    }
  });

  const sortedCrops = Object.entries(cropCounts).sort((a, b) => b[1] - a[1]);
  const sortedDiseases = Object.entries(diseaseCounts).sort((a, b) => b[1] - a[1]);
  const avgConf = confCount > 0 ? (totalConfSum / confCount).toFixed(1) : 'N/A';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#172018]">Crop Diagnostics Analytics</h2>
              {responseState === 'success' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  Total Runs: {totalCount}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Read-only vision inference diagnostics, most common crop pathologies, and model confidence distributions.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchDiagnostics}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-700' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh Diagnostics'}</span>
        </button>
      </div>

      {/* Aggregate Diagnostics Summary Cards */}
      {responseState === 'success' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Successful Diagnoses</span>
              <span className="text-2xl font-extrabold text-stone-900 mt-0.5 block">{totalSuccessful}</span>
              <span className="text-[10px] text-stone-500 mt-1 block font-medium">Completed Computer Vision Runs</span>
            </div>

            <div className="p-4 bg-white border border-teal-200 rounded-2xl shadow-xs bg-gradient-to-br from-teal-50/40 via-white to-white">
              <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">Avg Confidence</span>
              <span className="text-2xl font-extrabold text-teal-950 mt-0.5 block">{avgConf}%</span>
              <span className="text-[10px] text-teal-700 mt-1 block font-medium">Mean Model Ingestion Score</span>
            </div>

            <div className="p-4 bg-white border border-emerald-200 rounded-2xl shadow-xs bg-gradient-to-br from-emerald-50/40 via-white to-white">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Top Crop</span>
              <span className="text-lg font-extrabold text-emerald-950 mt-0.5 block truncate">
                {sortedCrops[0]?.[0] || 'N/A'}
              </span>
              <span className="text-[10px] text-emerald-700 mt-1 block font-medium">
                {sortedCrops[0] ? `${sortedCrops[0][1]} diagnostic runs` : 'No data'}
              </span>
            </div>

            <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Most Common Disease</span>
              <span className="text-sm font-extrabold text-stone-900 mt-0.5 block truncate" title={sortedDiseases[0]?.[0]}>
                {sortedDiseases[0]?.[0] || 'None Identified'}
              </span>
              <span className="text-[10px] text-stone-500 mt-1 block font-medium">
                {sortedDiseases[0] ? `${sortedDiseases[0][1]} positive detections` : 'No positive detections'}
              </span>
            </div>
          </div>

          {/* Ranked Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Most Common Diseases & Pathologies */}
            <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-teal-700" />
                  <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Common Pathologies
                  </h3>
                </div>
                <span className="text-[10px] text-stone-400 font-semibold">{sortedDiseases.length} Found</span>
              </div>

              {sortedDiseases.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No specific plant diseases identified in current batch.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {sortedDiseases.slice(0, 5).map(([diseaseName, count], index) => {
                    const pct = Math.round((count / (totalSuccessful || 1)) * 100);
                    return (
                      <div key={diseaseName} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-800 truncate max-w-[160px]" title={diseaseName}>
                            #{index + 1} {diseaseName}
                          </span>
                          <span className="font-mono text-teal-900 font-bold">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-teal-700 h-1.5 rounded-full"
                            style={{ width: `${Math.max(pct, 8)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Most Diagnosed Crops */}
            <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-[#14532D]" />
                  <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Diagnosed Crops
                  </h3>
                </div>
                <span className="text-[10px] text-stone-400 font-semibold">{sortedCrops.length} Crops</span>
              </div>

              {sortedCrops.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No crop data available.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {sortedCrops.slice(0, 5).map(([cropName, count], index) => {
                    const pct = Math.round((count / (items.length || 1)) * 100);
                    return (
                      <div key={cropName} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-800">#{index + 1} {cropName}</span>
                          <span className="font-mono text-emerald-900 font-bold">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#14532D] h-1.5 rounded-full"
                            style={{ width: `${Math.max(pct, 8)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Confidence Distribution */}
            <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-700" />
                  <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Confidence Distribution
                  </h3>
                </div>
                <span className="text-[10px] text-stone-400 font-semibold">{confCount} Measured</span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-emerald-800">High Confidence (&gt;=80%)</span>
                    <span className="font-mono font-bold text-stone-800">{highConfCount}</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2">
                    <div
                      className="bg-emerald-600 h-2 rounded-full"
                      style={{ width: `${confCount > 0 ? (highConfCount / confCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-amber-800">Moderate (60% - 79%)</span>
                    <span className="font-mono font-bold text-stone-800">{modConfCount}</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full"
                      style={{ width: `${confCount > 0 ? (modConfCount / confCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-rose-800">Low Confidence (&lt;60%)</span>
                    <span className="font-mono font-bold text-stone-800">{lowConfCount}</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2">
                    <div
                      className="bg-rose-500 h-2 rounded-full"
                      style={{ width: `${confCount > 0 ? (lowConfCount / confCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 401 Banner */}
      {responseState === '401' && authError && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
            <span>Authentication Failed (401)</span>
          </div>
          <p className="text-xs text-amber-800">{authError.message}</p>
        </div>
      )}

      {/* 403 Banner */}
      {responseState === '403' && authError && (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Shield className="w-5 h-5 text-rose-700 shrink-0" />
            <span>Access Denied (403)</span>
          </div>
          <p className="text-xs text-rose-800">{authError.message}</p>
        </div>
      )}

      {/* Network Error Banner */}
      {responseState === 'network_error' && (
        <div className="p-5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Network Connection Error</span>
            </div>
            <button
              type="button"
              onClick={fetchDiagnostics}
              className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* API Unavailable State */}
      {responseState === '404' ? (
        <AdminEmptyState
          title="Crop Diagnostics endpoint (/api/v1/admin/diagnostics) is not available yet."
          description="Vision inference logs and secondary model confidence distributions will populate automatically once GET /api/v1/admin/diagnostics is deployed."
          note="Connected route: GET /api/v1/admin/diagnostics"
          action={{
            label: 'Check Endpoint Again',
            onClick: fetchDiagnostics,
          }}
        />
      ) : (responseState === 'success' || responseState === 'loading') && (
        <>
          {/* Controls */}
          <div className="space-y-3">
            <form onSubmit={handleSearchSubmit} className="p-4 bg-white border border-stone-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs text-xs">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search diagnostic ID, crop, or disease..."
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder:text-stone-400 focus:outline-hidden"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 text-stone-600">
                  <Filter className="w-3.5 h-3.5 text-stone-400" />
                  <span>Crop Filter:</span>
                  <select
                    value={cropFilter}
                    onChange={(e) => {
                      setCropFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden"
                  >
                    <option value="all">All Crops</option>
                    <option value="Rice">Rice / Paddy</option>
                    <option value="Chilli">Chilli</option>
                    <option value="Cotton">Cotton</option>
                    <option value="Groundnut">Groundnut</option>
                    <option value="Sugarcane">Sugarcane</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#14532D] text-white font-semibold text-xs rounded-xl hover:bg-[#16A34A] transition-colors cursor-pointer"
                >
                  Filter Diagnostics
                </button>
              </div>
            </form>

            {hasActiveFilters && (
              <div className="flex items-center justify-between gap-2 px-4 py-2 bg-stone-100/80 border border-stone-200 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-600 text-[11px] uppercase tracking-wider">
                    Active Filters:
                  </span>
                  {searchTerm.trim() && (
                    <span className="px-2 py-0.5 bg-white border border-stone-300 rounded-md font-medium text-stone-800 text-[11px]">
                      Search: "{searchTerm.trim()}"
                    </span>
                  )}
                  {cropFilter !== 'all' && (
                    <span className="px-2 py-0.5 bg-white border border-stone-300 rounded-md font-medium text-stone-800 text-[11px]">
                      Crop: {cropFilter}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 text-xs font-semibold text-[#14532D] hover:text-[#16A34A] transition-colors cursor-pointer underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              </div>
            )}
          </div>

          {/* Compact Read-Only Table */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#14532D]" />
                <span>Loading crop diagnostics log...</span>
              </div>
            ) : responseState === 'success' && items.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500 space-y-3">
                <p className="font-semibold text-stone-700 text-sm">No diagnostic log entries match</p>
                <p className="text-stone-500">
                  {hasActiveFilters
                    ? 'No pathology diagnostic records match your search or filter parameters.'
                    : 'No crop diagnostic inference logs exist on the server.'}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-stone-600" />
                    <span>Reset All Filters</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Diagnostic ID & Time</th>
                      <th className="px-4 py-3">Crop / Location</th>
                      <th className="px-4 py-3">Condition Identified</th>
                      <th className="px-4 py-3">Confidence Score</th>
                      <th className="px-4 py-3">Execution Status</th>
                      <th className="px-4 py-3">Review Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {items.map((item, idx) => {
                      const timeStr = item.created_at || item.timestamp;
                      const outcomeInfo = formatDiagnosticInferenceOutcome(item);
                      const rawConf = item.confidence ?? item.confidence_score;
                      const confFormatted = rawConf !== null && rawConf !== undefined && !isNaN(Number(rawConf))
                        ? formatDiagnosticConfidence(rawConf)
                        : null;
                      const execInfo = formatDiagnosticExecutionStatus(item);
                      const reviewInfo = formatDiagnosticReviewStatus(item);

                      return (
                        <tr key={item.id || `diag_${idx}`} className="hover:bg-stone-50/70 transition-colors text-xs">
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-stone-900">{item.id || 'N/A'}</span>
                            <div className="text-[10px] text-stone-400 mt-0.5">
                              {timeStr ? new Date(timeStr).toLocaleString() : 'N/A'}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-semibold text-stone-800">{item.crop || 'Unknown Crop'}</span>
                            <span className="text-[10px] text-stone-400 block font-mono">
                              {[item.district, item.state].filter(Boolean).join(', ') || 'Regional'}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider border ${
                                  outcomeInfo.badgeType === 'detected'
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                    : outcomeInfo.badgeType === 'low_confidence'
                                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                                    : outcomeInfo.badgeType === 'no_positive_detection'
                                    ? 'bg-stone-100 text-stone-700 border-stone-300'
                                    : outcomeInfo.badgeType === 'unavailable'
                                    ? 'bg-rose-50 text-rose-900 border-rose-300'
                                    : 'bg-stone-100 text-stone-500 border-stone-200'
                                }`}
                              >
                                {outcomeInfo.badgeLabel}
                              </span>
                              <div className="font-semibold text-xs text-stone-900">
                                {outcomeInfo.diagnosisText}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono font-semibold">
                            {confFormatted ? (
                              <span className="text-teal-900">{confFormatted}</span>
                            ) : (
                              <span className="text-stone-400 italic font-normal">Unavailable</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {execInfo.statusType === 'success' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                <span>{execInfo.text}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                                <span>{execInfo.text}</span>
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <AdminStatusBadge status={reviewInfo.statusType} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {responseState === 'success' && items.length > 0 && (
              <div className="p-4 border-t border-stone-200">
                <AdminPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Details Inspection Modal */}
      {selectedDiagnostic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 font-mono">
                    Diagnostic Record #{selectedDiagnostic.id}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Crop: {selectedDiagnostic.crop || 'Unknown Crop'} ({[selectedDiagnostic.district, selectedDiagnostic.state].filter(Boolean).join(', ') || 'Regional'})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDiagnostic(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Execution Status vs Review Status Row */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs">
              <div>
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Execution Status:</span>
                <span className="font-semibold text-stone-900 block mt-0.5">
                  {formatDiagnosticExecutionStatus(selectedDiagnostic).text}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Human Review Status:</span>
                <div className="mt-0.5">
                  <AdminStatusBadge status={formatDiagnosticReviewStatus(selectedDiagnostic).statusType} />
                </div>
              </div>
            </div>

            {/* Inference Outcome Summary */}
            <div className="p-4 bg-teal-50/50 border border-teal-200/80 rounded-2xl space-y-2 text-xs">
              <span className="font-bold text-teal-950 uppercase tracking-wider text-[11px] block border-b border-teal-200/60 pb-1.5">
                Model Result & Pathology:
              </span>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Inference Outcome:</span>
                  <span className="font-bold text-stone-900 text-sm block mt-0.5">
                    {formatDiagnosticInferenceOutcome(selectedDiagnostic).badgeLabel}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Confidence Score:</span>
                  <span className="font-mono font-bold text-teal-900 text-sm block mt-0.5">
                    {formatDiagnosticConfidence(selectedDiagnostic.confidence ?? selectedDiagnostic.confidence_score)}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Primary Diagnosis:</span>
                <p className="p-3 bg-white rounded-xl border border-teal-200 text-teal-950 font-bold text-xs mt-1">
                  {formatDiagnosticInferenceOutcome(selectedDiagnostic).diagnosisText}
                </p>
              </div>
            </div>

            {/* Secondary Candidate Matches */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2 text-xs">
              <span className="font-bold text-stone-800 uppercase tracking-wider text-[11px] block border-b border-stone-200/60 pb-1.5">
                Secondary Matches (secondary_matches):
              </span>
              {selectedDiagnostic.secondary_matches && selectedDiagnostic.secondary_matches.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedDiagnostic.secondary_matches.map((match, mIdx) => {
                    const matchLabel = match.label ?? match.name ?? 'Unlabeled match';
                    const matchConf = formatDiagnosticConfidence(match.confidence);
                    return (
                      <div key={mIdx} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-stone-200">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-900">{matchLabel}</span>
                          {Boolean((match as any).category) && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded">
                              {String((match as any).category)}
                            </span>
                          )}
                          {Boolean(match.source) && (
                            <span className="text-[10px] text-stone-400">({String(match.source)})</span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-teal-900">{matchConf}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-stone-400 italic text-xs">
                  No secondary candidate matches recorded for this diagnostic run.
                </p>
              )}
            </div>

            {/* Candidate Summary */}
            {Boolean(selectedDiagnostic.candidate_summary) && (
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs space-y-1">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Candidate Summary:</span>
                <p className="text-stone-800 font-medium">
                  {typeof selectedDiagnostic.candidate_summary === 'string'
                    ? selectedDiagnostic.candidate_summary
                    : JSON.stringify(selectedDiagnostic.candidate_summary)}
                </p>
              </div>
            )}

            {/* Request Telemetry / Ref */}
            {Boolean(selectedDiagnostic.request_id || selectedDiagnostic.actor_ref) && (
              <div className="p-3 bg-stone-100/70 border border-stone-200 rounded-xl text-[10px] font-mono text-stone-600 flex flex-wrap gap-3">
                {Boolean(selectedDiagnostic.request_id) && (
                  <span>Request ID: <strong>{String(selectedDiagnostic.request_id)}</strong></span>
                )}
                {Boolean(selectedDiagnostic.actor_ref) && (
                  <span>Actor Ref: <strong>{String(selectedDiagnostic.actor_ref)}</strong></span>
                )}
              </div>
            )}

            {/* Provider Telemetry */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3 text-xs">
              <span className="font-bold text-stone-800 uppercase tracking-wider text-[11px] block border-b border-stone-200/60 pb-1.5">
                Provider Telemetry Summary (providers_summary):
              </span>

              {selectedDiagnostic.providers_summary ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 bg-white rounded-xl border border-stone-200 text-center">
                      <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">Successful</span>
                      <span className="font-mono font-bold text-emerald-800 text-sm">
                        {selectedDiagnostic.providers_summary.successful_providers ?? 0}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-stone-200 text-center">
                      <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">Failed</span>
                      <span className="font-mono font-bold text-rose-800 text-sm">
                        {selectedDiagnostic.providers_summary.failed_providers ?? 0}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-stone-200 text-center">
                      <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">Timed Out</span>
                      <span className="font-mono font-bold text-amber-800 text-sm">
                        {selectedDiagnostic.providers_summary.timed_out_providers ?? 0}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-stone-200 text-center">
                      <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block">Applied Threshold</span>
                      <span className="font-mono font-bold text-teal-900 text-sm">
                        {selectedDiagnostic.providers_summary.applied_threshold
                          ? `${(selectedDiagnostic.providers_summary.applied_threshold * 100).toFixed(0)}%`
                          : '70%'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-stone-400 italic text-xs">
                  Provider telemetry summary unavailable for this diagnostic record.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setSelectedDiagnostic(null)}
                className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

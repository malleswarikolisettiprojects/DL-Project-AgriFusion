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
  X,
} from 'lucide-react';
import { AdminApiError, getAdminPredictions } from '../../lib/adminApi';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminPagination } from '../../components/admin/AdminPagination';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import type { AdminPredictionItem } from '../../types';

export type { AdminPredictionItem };

export function formatPredictionOutcome(item: AdminPredictionItem): {
  concise: string;
  isMissing: boolean;
  rawSummary: string | object | null;
} {
  const res = item.result_summary ?? item.outcome ?? item.result;

  if (res !== null && res !== undefined) {
    if (typeof res === 'string' && res.trim() !== '') {
      return { concise: res.trim(), isMissing: false, rawSummary: res };
    }
    if (typeof res === 'object' && res !== null) {
      const obj = res as Record<string, unknown>;

      if (obj.disease || obj.disease_identified || obj.primary_diagnosis) {
        const d = String(obj.disease || obj.disease_identified || obj.primary_diagnosis);
        const c = obj.confidence ?? obj.confidence_score;
        const confStr =
          c !== undefined && c !== null
            ? ` (${(Number(c) <= 1 && Number(c) > 0 ? Number(c) * 100 : Number(c)).toFixed(1)}%)`
            : '';
        return { concise: `${d}${confStr}`, isMissing: false, rawSummary: res };
      }
      if (obj.recommended_crop || obj.crop) {
        return { concise: `Crop: ${String(obj.recommended_crop || obj.crop)}`, isMissing: false, rawSummary: res };
      }
      if (obj.yield_predicted || obj.yield) {
        return { concise: `Yield: ${String(obj.yield_predicted || obj.yield)}`, isMissing: false, rawSummary: res };
      }
      if (obj.irrigation_advice || obj.water_requirement) {
        return { concise: `Irrigation: ${String(obj.irrigation_advice || obj.water_requirement)}`, isMissing: false, rawSummary: res };
      }
      if (obj.summary || obj.text || obj.message) {
        return { concise: String(obj.summary || obj.text || obj.message), isMissing: false, rawSummary: res };
      }
      return { concise: JSON.stringify(obj), isMissing: false, rawSummary: res };
    }
  }

  // Fallback to direct properties on item
  if (
    item.yield_predicted !== undefined &&
    item.yield_predicted !== null &&
    String(item.yield_predicted).trim() !== ''
  ) {
    return {
      concise: `Yield: ${item.yield_predicted}`,
      isMissing: false,
      rawSummary: { yield_predicted: item.yield_predicted },
    };
  }
  if (
    item.recommended_crop !== undefined &&
    item.recommended_crop !== null &&
    String(item.recommended_crop).trim() !== ''
  ) {
    return {
      concise: `Crop: ${item.recommended_crop}`,
      isMissing: false,
      rawSummary: { recommended_crop: item.recommended_crop },
    };
  }
  if (
    item.disease_identified !== undefined &&
    item.disease_identified !== null &&
    String(item.disease_identified).trim() !== ''
  ) {
    return {
      concise: `Disease: ${item.disease_identified}`,
      isMissing: false,
      rawSummary: { disease_identified: item.disease_identified },
    };
  }
  if (
    item.irrigation_advice !== undefined &&
    item.irrigation_advice !== null &&
    String(item.irrigation_advice).trim() !== ''
  ) {
    return {
      concise: `Irrigation: ${item.irrigation_advice}`,
      isMissing: false,
      rawSummary: { irrigation_advice: item.irrigation_advice },
    };
  }

  return { concise: 'Not recorded', isMissing: true, rawSummary: null };
}

export function formatPredictionLatency(item: AdminPredictionItem): string {
  const ms = item.latency_ms ?? item.execution_time_ms ?? item.latency;
  if (ms !== null && ms !== undefined && !isNaN(Number(ms))) {
    return `${Number(ms)} ms`;
  }
  return 'Unavailable';
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

export const AdminPredictionsSection: React.FC = () => {
  const [items, setItems] = useState<AdminPredictionItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [responseState, setResponseState] = useState<ResponseState>('loading');
  const [authError, setAuthError] = useState<{ code: number; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedPrediction, setSelectedPrediction] = useState<AdminPredictionItem | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [modelFilter, setModelFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const fetchPredictions = async () => {
    setLoading(true);
    setErrorMessage(null);
    setAuthError(null);

    try {
      const res = await getAdminPredictions({
        page: currentPage,
        page_size: pageSize,
        search: searchTerm,
        model_type: modelFilter,
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
        } else if (err.status === 404 || err.message?.includes('not found') || err.message?.includes('404')) {
          setResponseState('404');
        } else if (err.status === 0 || err.message?.includes('Network/CORS') || err.message?.includes('Failed to connect')) {
          setResponseState('network_error');
          setErrorMessage(err.message || 'Network/CORS connection failure.');
        } else if (err.message?.includes('Unexpected API response')) {
          setResponseState('malformed_error');
          setErrorMessage('Unexpected API response structure: Missing items array in predictions response.');
        } else if (err.status >= 500) {
          setResponseState('server_error');
          setErrorMessage(err.message || 'The backend encountered a server error.');
        } else {
          setResponseState('generic_error');
          setErrorMessage(err.message || 'Failed to fetch prediction log.');
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
    fetchPredictions();
  }, [currentPage, modelFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchPredictions();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setModelFilter('all');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(searchTerm.trim() || modelFilter !== 'all');
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#172018]">ML Predictions Activity Log</h2>
              {responseState === 'success' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                  Total: {totalCount}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Operational telemetry for crop recommendation, climate risk, irrigation, and yield inference requests.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchPredictions}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-700' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh Activity'}</span>
        </button>
      </div>

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
              <span>Network or CORS Error</span>
            </div>
            <button
              type="button"
              onClick={fetchPredictions}
              className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Server Error Banner */}
      {responseState === 'server_error' && (
        <div className="p-5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Server Error</span>
            </div>
            <button
              type="button"
              onClick={fetchPredictions}
              className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Malformed Response Banner */}
      {responseState === 'malformed_error' && (
        <div className="p-5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              <span>Unexpected API Response</span>
            </div>
            <button
              type="button"
              onClick={fetchPredictions}
              className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            The backend returned an unexpected response structure. Expected predictions schema: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">&#123; "items": [...], "total": 100 &#125;</code>
          </p>
        </div>
      )}

      {/* API Unavailable State */}
      {responseState === '404' ? (
        <AdminEmptyState
          title="Predictions Audit endpoint (/api/v1/admin/predictions) is not available yet."
          description="Inference logs across all 6 prediction models will stream automatically once GET /api/v1/admin/predictions is deployed on the backend."
          note="Connected route: GET /api/v1/admin/predictions (supports page, page_size, search parameters)"
          action={{
            label: 'Check Endpoint Again',
            onClick: fetchPredictions,
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
                  placeholder="Search prediction ID, model, or crop..."
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder:text-stone-400 focus:outline-hidden"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 text-stone-600">
                  <Filter className="w-3.5 h-3.5 text-stone-400" />
                  <span>Model:</span>
                  <select
                    value={modelFilter}
                    onChange={(e) => {
                      setModelFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden"
                  >
                    <option value="all">All Models</option>
                    <option value="crop">Crop Recommendation</option>
                    <option value="climate">Climate Risk</option>
                    <option value="irrigation">Irrigation</option>
                    <option value="yield">Yield</option>
                    <option value="market">Market Price</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#14532D] text-white font-semibold text-xs rounded-xl hover:bg-[#16A34A] transition-colors cursor-pointer"
                >
                  Filter Log
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
                  {modelFilter !== 'all' && (
                    <span className="px-2 py-0.5 bg-white border border-stone-300 rounded-md font-medium text-stone-800 text-[11px]">
                      Model: {modelFilter}
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

          {/* Table */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#14532D]" />
                <span>Loading prediction log...</span>
              </div>
            ) : responseState === 'success' && items.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500 space-y-3">
                <p className="font-semibold text-stone-700 text-sm">No prediction log entries match</p>
                <p className="text-stone-500">
                  {hasActiveFilters
                    ? 'No prediction inference records match your search or filter parameters.'
                    : 'No ML model inference logs exist on the server.'}
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
                      <th className="px-4 py-3">Prediction ID & Time</th>
                      <th className="px-4 py-3">Model Type</th>
                      <th className="px-4 py-3">Crop / Region</th>
                      <th className="px-4 py-3">Model Outcome / Summary</th>
                      <th className="px-4 py-3">Execution Latency</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {items.map((item, idx) => {
                      const timeStr = item.created_at || item.timestamp;
                      const outcomeInfo = formatPredictionOutcome(item);
                      const latencyStr = formatPredictionLatency(item);

                      return (
                        <tr key={item.id || `pred_${idx}`} className="hover:bg-stone-50/70 transition-colors text-xs">
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-stone-900">{item.id || 'N/A'}</span>
                            <div className="text-[10px] text-stone-400 mt-0.5">
                              {timeStr ? new Date(timeStr).toLocaleString() : 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-stone-800">
                            {item.model_type || 'Inference Model'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-[#14532D]">{item.crop || 'Multi-crop'}</span>
                            <span className="text-[10px] text-stone-400 block">
                              {[item.district, item.state].filter(Boolean).join(', ') || 'Regional'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {outcomeInfo.isMissing ? (
                              <span className="text-stone-400 italic">Not recorded</span>
                            ) : (
                              <span className="text-purple-950 font-semibold">{outcomeInfo.concise}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-stone-600">
                            {latencyStr === 'Unavailable' ? (
                              <span className="text-stone-400 italic">Unavailable</span>
                            ) : (
                              <span>{latencyStr}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <AdminStatusBadge status={item.status || 'success'} />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedPrediction(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-purple-700" />
                              <span>Inspect</span>
                            </button>
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
      {selectedPrediction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-stone-900 font-mono">
                      Prediction #{selectedPrediction.id}
                    </h3>
                    <AdminStatusBadge status={selectedPrediction.status || 'success'} />
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Model: {selectedPrediction.model_type || 'Inference Model'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPrediction(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Verification Warning Banner (Requirement 6) */}
            {selectedPrediction.verification_status === 'verified' || selectedPrediction.status === 'verified' ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Verified prediction. Correctness confirmed by agronomist review.</span>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Telemetry log entry</span>
                  <p className="text-amber-800 text-[11px] leading-relaxed">
                    Prediction correctness has not been verified by a farmer or agronomist. This telemetry record represents raw ML inference output.
                  </p>
                </div>
              </div>
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-stone-50 border border-stone-200/80 rounded-2xl text-xs">
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Crop / Region:</span>
                <span className="font-semibold text-stone-900">
                  {selectedPrediction.crop || 'Multi-crop'} ({[selectedPrediction.district, selectedPrediction.state].filter(Boolean).join(', ') || 'Regional'})
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Execution Latency:</span>
                <span className="font-mono font-semibold text-stone-900">
                  {formatPredictionLatency(selectedPrediction)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Target Land Area:</span>
                <span className="font-semibold text-stone-900">
                  {selectedPrediction.acres ? `${selectedPrediction.acres} Acres` : 'Not recorded'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Timestamp:</span>
                <span className="text-stone-700">
                  {selectedPrediction.created_at || selectedPrediction.timestamp ? new Date(selectedPrediction.created_at || selectedPrediction.timestamp!).toLocaleString() : 'Not recorded'}
                </span>
              </div>
            </div>

            {/* Stored Prediction Summary */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2 text-xs">
              <span className="font-bold text-stone-800 uppercase tracking-wider text-[11px] block border-b border-stone-200/60 pb-2">
                Stored Prediction Summary (result_summary):
              </span>
              <pre className="p-3 bg-white rounded-xl border border-stone-200 text-stone-900 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {typeof selectedPrediction.result_summary === 'object' && selectedPrediction.result_summary !== null
                  ? JSON.stringify(selectedPrediction.result_summary, null, 2)
                  : String(formatPredictionOutcome(selectedPrediction).rawSummary || formatPredictionOutcome(selectedPrediction).concise)}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setSelectedPrediction(null)}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
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

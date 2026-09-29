import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  FileText,
  Filter,
  MapPin,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Sprout,
} from 'lucide-react';
import {
  AdminApiError,
  getAdminAdvisories,
  getAdminAdvisoryAnalytics,
} from '../../lib/adminApi';
import type { AdminAdvisory, AdminAdvisoryAnalytics } from '../../types';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminPagination } from '../../components/admin/AdminPagination';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';

type ResponseState =
  | 'idle'
  | 'loading'
  | 'success'
  | '401'
  | '403'
  | '404'
  | '422'
  | 'network_error'
  | 'server_error'
  | 'malformed_error'
  | 'generic_error';

export const AdminAdvisoriesSection: React.FC = () => {
  const [analytics, setAnalytics] = useState<AdminAdvisoryAnalytics | null>(null);
  const [advisories, setAdvisories] = useState<AdminAdvisory[]>([]);
  const [totalAdvisories, setTotalAdvisories] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [responseState, setResponseState] = useState<ResponseState>('loading');
  const [authError, setAuthError] = useState<{ code: number; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [privacyNote, setPrivacyNote] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [cropFilter, setCropFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const fetchAdvisoriesData = async () => {
    setLoading(true);
    setErrorMessage(null);
    setAuthError(null);
    setPrivacyNote(null);

    try {
      // 1. Fetch server-side aggregate analytics
      const analyticsData = await getAdminAdvisoryAnalytics({
        crop: cropFilter,
        state: stateFilter,
        search: searchTerm,
      });
      setAnalytics(analyticsData);
      if (analyticsData.privacy_note) {
        setPrivacyNote(analyticsData.privacy_note);
      }

      // 2. Fetch paginated advisory list (page_size = 25)
      const listData = await getAdminAdvisories({
        page: currentPage,
        page_size: pageSize,
        crop: cropFilter,
        state: stateFilter,
        search: searchTerm,
      });
      setAdvisories(listData.items || []);
      setTotalAdvisories(typeof listData.total === 'number' ? listData.total : analyticsData.total_queries || 0);

      setResponseState('success');
    } catch (err: unknown) {
      setAnalytics(null);
      setAdvisories([]);
      setTotalAdvisories(0);

      if (err instanceof AdminApiError) {
        if (err.status === 401) {
          setResponseState('401');
          setAuthError({ code: 401, message: err.message || 'Session expired. Please sign in again.' });
        } else if (err.status === 403) {
          setResponseState('403');
          setAuthError({ code: 403, message: err.message || 'Administrator permission required.' });
        } else if (err.status === 404 || err.message?.includes('not available yet')) {
          setResponseState('404');
          setErrorMessage(err.message || 'The requested admin endpoint is not configured on the backend.');
        } else if (err.status === 422) {
          setResponseState('422');
          setErrorMessage(err.message || 'Request validation error (HTTP 422). Check filter parameters.');
        } else if (err.status === 0 || err.message?.includes('Network/CORS') || err.message?.includes('Failed to connect')) {
          setResponseState('network_error');
          setErrorMessage(err.message || 'Failed to connect to backend server due to network/CORS issue.');
        } else if (err.message?.includes('Unexpected API response') || err.message?.includes('Missing items array')) {
          setResponseState('malformed_error');
          setErrorMessage(err.message || 'Unexpected API response structure or contract mismatch.');
        } else if (err.status >= 500) {
          setResponseState('server_error');
          setErrorMessage(err.message || 'The backend server encountered an internal error.');
        } else {
          setResponseState('generic_error');
          setErrorMessage(err.message || 'Failed to load advisory query telemetry.');
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Network failure';
        setResponseState('network_error');
        setErrorMessage(`Network error: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvisoriesData();
  }, [cropFilter, stateFilter, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAdvisoriesData();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setCropFilter('all');
    setStateFilter('all');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() || cropFilter !== 'all' || stateFilter !== 'all'
  );
  const totalPages = Math.ceil(totalAdvisories / pageSize) || 1;

  // Aggregate Analytics fields
  const totalQueries = analytics?.total_queries ?? totalAdvisories;
  const citationInfo = analytics?.citation_rate ?? { cited_queries: 0, eligible_queries: 0, percent: 0 };
  const topCrops = analytics?.top_crops ?? [];
  const regionalQueries = analytics?.regional_queries ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#172018]">Advisory Analytics</h2>
              {responseState === 'success' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                  Total Queries: {totalQueries}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Read-only server-side advisory analytics: top asked crops, regional state & district query distribution, and verified RAG citation rates.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchAdvisoriesData}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-700' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh Analytics'}</span>
        </button>
      </div>

      {privacyNote && responseState === 'success' && (
        <div className="p-3 bg-stone-100/90 border border-stone-200 rounded-xl text-[11px] text-stone-600 font-medium">
          🔒 Privacy & Anonymization Note: {privacyNote}
        </div>
      )}

      {/* ERROR STATES DISPLAY WITH RETRY */}

      {/* 401 Session Expired Error */}
      {responseState === '401' && authError && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
              <span>Authentication Required (401)</span>
            </div>
            <button
              type="button"
              onClick={fetchAdvisoriesData}
              className="px-3.5 py-1.5 bg-amber-200/80 hover:bg-amber-300 text-amber-900 rounded-xl font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">{authError.message}</p>
        </div>
      )}

      {/* 403 Forbidden Error */}
      {responseState === '403' && authError && (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Shield className="w-5 h-5 text-rose-700 shrink-0" />
              <span>Access Denied (403)</span>
            </div>
            <button
              type="button"
              onClick={fetchAdvisoriesData}
              className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">{authError.message}</p>
        </div>
      )}

      {/* 404 Endpoint Not Available Error */}
      {responseState === '404' && (
        <AdminEmptyState
          title="Advisory Analytics endpoint is not available yet (HTTP 404)."
          description="The backend advisory analytics route GET /api/v1/admin/advisory-analytics is not configured on this server."
          note={errorMessage || 'Endpoint required: GET /api/v1/admin/advisory-analytics'}
          action={{
            label: 'Retry Request',
            onClick: fetchAdvisoriesData,
          }}
        />
      )}

      {/* 422 Request Validation Error */}
      {responseState === '422' && (
        <div className="p-5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Request Validation Error (422)</span>
            </div>
            <button
              type="button"
              onClick={fetchAdvisoriesData}
              className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            {errorMessage || 'The backend rejected request query parameters. Verify request payload.'}
          </p>
        </div>
      )}

      {/* Network or CORS Error */}
      {responseState === 'network_error' && (
        <div className="p-5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Network Connection or CORS Failure</span>
            </div>
            <button
              type="button"
              onClick={fetchAdvisoriesData}
              className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Malformed 200 Response / Contract Error */}
      {responseState === 'malformed_error' && (
        <div className="p-5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <FileText className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Malformed API Response Contract</span>
            </div>
            <button
              type="button"
              onClick={fetchAdvisoriesData}
              className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* 5xx Backend Server Error */}
      {responseState === 'server_error' && (
        <div className="p-5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Backend Server Internal Error (5xx)</span>
            </div>
            <button
              type="button"
              onClick={fetchAdvisoriesData}
              className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            {errorMessage || 'The backend database or server encountered an unexpected error.'}
          </p>
        </div>
      )}

      {/* Generic Failure State */}
      {responseState === 'generic_error' && (
        <div className="p-5 bg-stone-100 border border-stone-200 text-stone-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-stone-800">
              <AlertCircle className="w-5 h-5 text-stone-600 shrink-0" />
              <span>Advisory Processing Error</span>
            </div>
            <button
              type="button"
              onClick={fetchAdvisoriesData}
              className="px-3.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-stone-700 leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Overview Analytics Cards & Charts (Rendered on SUCCESS) */}
      {responseState === 'success' && analytics && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Total Questions</span>
              <span className="text-2xl font-extrabold text-stone-900 mt-0.5 block">{totalQueries}</span>
              <span className="text-[10px] text-stone-500 mt-1 block font-medium">Server Aggregate Total</span>
            </div>

            <div className="p-4 bg-white border border-sky-200 rounded-2xl shadow-xs bg-gradient-to-br from-sky-50/40 via-white to-white">
              <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">Crops Inquired</span>
              <span className="text-2xl font-extrabold text-sky-950 mt-0.5 block">{topCrops.length}</span>
              <span className="text-[10px] text-sky-700 mt-1 block font-medium">Distinct Crop Categories</span>
            </div>

            <div className="p-4 bg-white border border-emerald-200 rounded-2xl shadow-xs bg-gradient-to-br from-emerald-50/40 via-white to-white">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Verified Citation Rate</span>
              <span className="text-2xl font-extrabold text-emerald-950 mt-0.5 block">{citationInfo.percent}%</span>
              <span className="text-[10px] text-emerald-700 mt-1 block font-medium font-mono">
                {citationInfo.cited_queries} / {citationInfo.eligible_queries} verified citations
              </span>
            </div>

            <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Active Regions</span>
              <span className="text-2xl font-extrabold text-stone-900 mt-0.5 block">{regionalQueries.length}</span>
              <span className="text-[10px] text-stone-500 mt-1 block font-medium">State & District Groups</span>
            </div>
          </div>

          {/* Ranked Crop & Region Analytics Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Questions by Crop (Ranked Server-Side) */}
            <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-[#14532D]" />
                  <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Questions by Crop (Server Aggregate)
                  </h3>
                </div>
                <span className="text-[10px] text-stone-400 font-semibold">{topCrops.length} Crops</span>
              </div>

              {topCrops.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No crop query data available for selected filters.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {topCrops.slice(0, 6).map((item, index) => {
                    const pct = totalQueries > 0 ? Math.round((item.query_count / totalQueries) * 100) : 0;
                    return (
                      <div key={item.crop} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-800">
                            #{index + 1} {item.crop}
                          </span>
                          <span className="font-mono text-stone-600 font-bold">
                            {item.query_count} questions ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#14532D] h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Questions by District & State */}
            <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-sky-700" />
                  <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Questions by Region (State + District)
                  </h3>
                </div>
                <span className="text-[10px] text-stone-400 font-semibold">{regionalQueries.length} Regions</span>
              </div>

              {regionalQueries.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No regional query data available for selected filters.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {regionalQueries.slice(0, 6).map((item, index) => {
                    const regionLabel = item.state && item.district ? `${item.state} / ${item.district}` : item.district || item.state || 'Regional';
                    const pct = totalQueries > 0 ? Math.round((item.query_count / totalQueries) * 100) : 0;
                    return (
                      <div key={`${item.state}_${item.district}_${index}`} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-800">
                            #{index + 1} {regionLabel}
                          </span>
                          <span className="font-mono text-sky-900 font-bold">
                            {item.query_count} inquiries ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-sky-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls, Filters & Detailed Advisory Table */}
      {(responseState === 'success' || responseState === 'loading') && (
        <>
          {/* Controls & Filters */}
          <div className="space-y-3">
            <form onSubmit={handleSearchSubmit} className="p-4 bg-white border border-stone-200 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search query ID, summary, or district..."
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder:text-stone-400 focus:outline-hidden"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs text-stone-600">
                <Filter className="w-3.5 h-3.5 text-stone-400" />
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
                  <option value="Cotton">Cotton</option>
                  <option value="Chilli">Chilli</option>
                  <option value="Groundnut">Groundnut</option>
                  <option value="Sugarcane">Sugarcane</option>
                  <option value="Maize">Maize</option>
                </select>

                <select
                  value={stateFilter}
                  onChange={(e) => {
                    setStateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden"
                >
                  <option value="all">All States</option>
                  <option value="Andhra Pradesh">Andhra Pradesh</option>
                  <option value="Telangana">Telangana</option>
                </select>

                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#14532D] text-white font-semibold text-xs rounded-xl hover:bg-[#16A34A] transition-colors cursor-pointer"
                >
                  Apply Filters
                </button>
              </div>
            </form>

            <div className="flex items-center justify-between gap-2 px-4 py-2 bg-stone-100/80 border border-stone-200 rounded-xl text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-stone-600 text-[11px] uppercase tracking-wider">
                  Filter Scope:
                </span>
                <span className="text-[11px] text-stone-500 font-medium">
                  (Filters crop/state/search apply to both aggregate analytics & paginated list)
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
                {stateFilter !== 'all' && (
                  <span className="px-2 py-0.5 bg-white border border-stone-300 rounded-md font-medium text-stone-800 text-[11px]">
                    State: {stateFilter}
                  </span>
                )}
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 text-xs font-semibold text-[#14532D] hover:text-[#16A34A] transition-colors cursor-pointer underline shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Anonymized Read-Only Table (25 items per page) */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                Advisory Query Records (Paginated List)
              </h3>
              <span className="text-[10px] font-semibold text-stone-500">
                Showing Page {currentPage} of {totalPages} ({pageSize} records/page)
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#14532D]" />
                <span>Loading advisory activity telemetry...</span>
              </div>
            ) : responseState === 'success' && advisories.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500 space-y-3">
                <p className="font-semibold text-stone-700 text-sm">No advisory records match</p>
                <p className="text-stone-500">
                  {hasActiveFilters
                    ? 'No query activity matches your current search or crop/state filter.'
                    : 'No advisory query records exist on the server.'}
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
                      <th className="px-4 py-3">Query ID & Date</th>
                      <th className="px-4 py-3">Crop / Category</th>
                      <th className="px-4 py-3">Region (District, State)</th>
                      <th className="px-4 py-3">RAG Retrieval</th>
                      <th className="px-4 py-3">Cited Sources</th>
                      <th className="px-4 py-3">Status Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {advisories.map((a, idx) => {
                      const dateStr = a.created_at;
                      const sourcesList = Array.isArray(a.sources) ? a.sources : [];
                      const sourceCount = sourcesList.length;

                      const docsUsed = a.retrieval?.documents_used ?? 0;
                      const docsConsidered = a.retrieval?.documents_considered ?? 0;

                      return (
                        <tr key={a.query_id || a.id || `adv_${idx}`} className="hover:bg-stone-50/70 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-stone-900 font-bold">{a.query_id || a.id}</span>
                            <div className="text-[10px] text-stone-400 mt-0.5">
                              {dateStr ? new Date(dateStr).toLocaleString() : 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-[#14532D] text-xs">
                              {a.crop || 'Multi-Crop'}
                            </span>
                            <div className="text-[10px] text-stone-500 truncate max-w-xs" title={a.query_summary}>
                              {a.query_summary || 'Agronomic Question'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-stone-600 font-medium">
                            {[a.district, a.state].filter(Boolean).join(', ') || 'Regional'}
                          </td>
                          <td className="px-4 py-3">
                            {a.retrieval ? (
                              <div className="font-medium text-stone-800">
                                {docsUsed} / {docsConsidered} Docs
                              </div>
                            ) : (
                              <span className="text-stone-400 text-[11px]">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-stone-400" />
                              <span className="font-semibold">{sourceCount} cited</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {a.activity_status && <AdminStatusBadge status={a.activity_status} />}
                              {a.review_status && <AdminStatusBadge status={a.review_status} />}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {responseState === 'success' && advisories.length > 0 && (
              <div className="p-4 border-t border-stone-200">
                <AdminPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalAdvisories}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

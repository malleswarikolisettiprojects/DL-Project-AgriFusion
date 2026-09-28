import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BookOpen,
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
  getAdvisoryAnalytics,
} from '../../lib/adminApi';
import type { AdminAdvisory, AdvisoryAnalyticsResponse } from '../../types';
import { AdminPagination } from '../../components/admin/AdminPagination';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';

type StatusType = 'loading' | 'success' | '401' | '403' | 'error';

export const AdminAdvisoriesSection: React.FC = () => {
  // 1. Analytics state (independent)
  const [analyticsData, setAnalyticsData] = useState<AdvisoryAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsStatus, setAnalyticsStatus] = useState<StatusType>('loading');
  const [privacyNote, setPrivacyNote] = useState<string | null>(null);

  // 2. Advisory List state (independent)
  const [advisories, setAdvisories] = useState<AdminAdvisory[]>([]);
  const [totalAdvisories, setTotalAdvisories] = useState<number>(0);
  const [listLoading, setListLoading] = useState<boolean>(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listStatus, setListStatus] = useState<StatusType>('loading');

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [cropFilter, setCropFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    const filterParams = {
      crop: cropFilter !== 'all' ? cropFilter : undefined,
      state: stateFilter !== 'all' ? stateFilter : undefined,
      search: searchTerm.trim() || undefined,
    };

    try {
      const res = await getAdvisoryAnalytics(filterParams);
      setAnalyticsData(res);
      setPrivacyNote(res.privacy_note || null);
      setAnalyticsStatus('success');
    } catch (err: unknown) {
      if (err instanceof AdminApiError) {
        if (err.status === 401) {
          setAnalyticsStatus('401');
          setAnalyticsError(err.message || 'Session expired. Please sign in again.');
        } else if (err.status === 403) {
          setAnalyticsStatus('403');
          setAnalyticsError(err.message || 'Administrator permission required for analytics.');
        } else {
          setAnalyticsStatus('error');
          setAnalyticsError(err.message || 'The backend database or server encountered an error loading advisory analytics.');
        }
      } else {
        setAnalyticsStatus('error');
        setAnalyticsError(err instanceof Error ? err.message : 'Failed to connect to backend server.');
      }
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchList = async () => {
    setListLoading(true);
    setListError(null);
    const filterParams = {
      crop: cropFilter !== 'all' ? cropFilter : undefined,
      state: stateFilter !== 'all' ? stateFilter : undefined,
      search: searchTerm.trim() || undefined,
    };

    try {
      const listRes = await getAdminAdvisories({
        ...filterParams,
        page: currentPage,
        page_size: pageSize,
      });
      const items = listRes.items || [];
      setAdvisories(items);
      setTotalAdvisories(listRes.total || items.length);
      setListStatus('success');
    } catch (err: unknown) {
      if (err instanceof AdminApiError) {
        if (err.status === 401) {
          setListStatus('401');
          setListError(err.message || 'Session expired. Please sign in again.');
        } else if (err.status === 403) {
          setListStatus('403');
          setListError(err.message || 'Administrator permission required for advisory listing.');
        } else {
          setListStatus('error');
          setListError(err.message || 'The backend database or server encountered an error loading advisory activity list.');
        }
      } else {
        setListStatus('error');
        setListError(err instanceof Error ? err.message : 'Failed to connect to backend server.');
      }
    } finally {
      setListLoading(false);
    }
  };

  const loadData = async () => {
    await Promise.allSettled([fetchAnalytics(), fetchList()]);
  };

  useEffect(() => {
    loadData();
  }, [cropFilter, stateFilter, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadData();
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

  const isRefreshing = analyticsLoading || listLoading;
  const totalQueries = analyticsData?.total_queries ?? 0;
  const citationRate = analyticsData?.citation_rate?.percent ?? 0;
  const citedQueries = analyticsData?.citation_rate?.cited_queries ?? 0;
  const eligibleQueries = analyticsData?.citation_rate?.eligible_queries ?? 0;
  const topCrops = analyticsData?.top_crops || [];
  const regionalQueries = analyticsData?.regional_queries || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#172018]">Advisory Analytics</h2>
              {analyticsStatus === 'success' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                  Total: {totalQueries}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Server-aggregated advisory analytics: top inquired crops, state & district regional distribution, and verified RAG citation rates.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={isRefreshing}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-700' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Analytics'}</span>
        </button>
      </div>

      {privacyNote && (
        <div className="p-3 bg-stone-100/90 border border-stone-200 rounded-xl text-[11px] text-stone-600 font-medium">
          🔒 Anonymization Note: {privacyNote}
        </div>
      )}

      {/* Analytics Panel (Independent Error/Loading Handling) */}
      {analyticsLoading ? (
        <div className="p-8 bg-white border border-stone-200 rounded-2xl text-center text-xs text-stone-500 flex items-center justify-center gap-2 shadow-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-700" />
          <span>Loading advisory aggregate analytics...</span>
        </div>
      ) : analyticsStatus === 'error' || analyticsStatus === '401' || analyticsStatus === '403' ? (
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-xs text-rose-800">
              {analyticsStatus === '401' ? (
                <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
              ) : analyticsStatus === '403' ? (
                <Shield className="w-4 h-4 text-rose-700 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
              )}
              <span>Analytics Panel: {analyticsStatus === '401' ? 'Auth Expired (401)' : analyticsStatus === '403' ? 'Forbidden (403)' : 'Failed to Load'}</span>
            </div>
            <button
              type="button"
              onClick={fetchAnalytics}
              className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Analytics</span>
            </button>
          </div>
          <p className="text-xs text-rose-800">{analyticsError || 'Failed to load analytics metrics.'}</p>
        </div>
      ) : analyticsStatus === 'success' && analyticsData && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Total Questions</span>
              <span className="text-2xl font-extrabold text-stone-900 mt-0.5 block">{totalQueries}</span>
              <span className="text-[10px] text-stone-500 mt-1 block font-medium">Server-Aggregated Queries</span>
            </div>

            <div className="p-4 bg-white border border-sky-200 rounded-2xl shadow-xs bg-gradient-to-br from-sky-50/40 via-white to-white">
              <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">Crops Inquired</span>
              <span className="text-2xl font-extrabold text-sky-950 mt-0.5 block">{topCrops.length}</span>
              <span className="text-[10px] text-sky-700 mt-1 block font-medium">Top Crop Categories</span>
            </div>

            <div className="p-4 bg-white border border-emerald-200 rounded-2xl shadow-xs bg-gradient-to-br from-emerald-50/40 via-white to-white">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Citation Rate</span>
              <span className="text-2xl font-extrabold text-emerald-950 mt-0.5 block">{citationRate}%</span>
              <span className="text-[10px] text-emerald-700 mt-1 block font-medium">
                {citedQueries} of {eligibleQueries} eligible queries cited
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
            {/* Questions by Crop (Ranked) */}
            <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-[#14532D]" />
                  <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Questions by Crop (Ranked Most to Least)
                  </h3>
                </div>
                <span className="text-[10px] text-stone-400 font-semibold">{topCrops.length} Crops</span>
              </div>

              {topCrops.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No crop query data available.</p>
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

            {/* Questions by Region (State + District Grouped) */}
            <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-sky-700" />
                  <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Questions by Region (State & District)
                  </h3>
                </div>
                <span className="text-[10px] text-stone-400 font-semibold">{regionalQueries.length} Regions</span>
              </div>

              {regionalQueries.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No regional query data available.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {regionalQueries.slice(0, 6).map((item, index) => {
                    const label = item.district === 'Suppressed for privacy (<3 queries)'
                      ? `${item.state} (${item.district})`
                      : `${item.state} - ${item.district}`;
                    const pct = totalQueries > 0 ? Math.round((item.query_count / totalQueries) * 100) : 0;
                    return (
                      <div key={`${item.state}_${item.district}_${index}`} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-800">
                            #{index + 1} {label}
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

      {/* Controls & Filters (Always Rendered) */}
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
              {stateFilter !== 'all' && (
                <span className="px-2 py-0.5 bg-white border border-stone-300 rounded-md font-medium text-stone-800 text-[11px]">
                  State: {stateFilter}
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

      {/* Advisory Activity Table Section (Independent Error/Loading Handling) */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
        {listLoading ? (
          <div className="p-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#14532D]" />
            <span>Loading advisory activity telemetry records...</span>
          </div>
        ) : listStatus === 'error' || listStatus === '401' || listStatus === '403' ? (
          <div className="p-6 bg-rose-50 border-t border-rose-200 text-rose-900 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-xs text-rose-800">
                {listStatus === '401' ? (
                  <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                ) : listStatus === '403' ? (
                  <Shield className="w-4 h-4 text-rose-700 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                )}
                <span>Table Section: {listStatus === '401' ? 'Auth Expired (401)' : listStatus === '403' ? 'Forbidden (403)' : 'Failed to Load Activity List'}</span>
              </div>
              <button
                type="button"
                onClick={fetchList}
                className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Advisory Table</span>
              </button>
            </div>
            <p className="text-xs text-rose-800">{listError || 'Failed to load advisory activity record table.'}</p>
          </div>
        ) : listStatus === 'success' && advisories.length === 0 ? (
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
                  <th className="px-4 py-3">Region</th>
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

        {listStatus === 'success' && advisories.length > 0 && (
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
    </div>
  );
};

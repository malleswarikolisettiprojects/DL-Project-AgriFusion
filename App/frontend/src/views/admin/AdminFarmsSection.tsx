import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Filter,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Sprout,
  Users,
} from 'lucide-react';
import { AdminApiError, getAdminFarms } from '../../lib/adminApi';
import type { AdminFarmsCountResponse } from '../../types';

type ResponseState =
  | 'idle'
  | 'loading'
  | 'success'
  | '401'
  | '403'
  | '404'
  | 'network_error'
  | 'server_error'
  | '422'
  | 'generic_error';

export const AdminFarmsSection: React.FC = () => {
  const [data, setData] = useState<AdminFarmsCountResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [responseState, setResponseState] = useState<ResponseState>('loading');
  const [authError, setAuthError] = useState<{ code: number; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Supported API query parameters
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [cropFilter, setCropFilter] = useState<string>('all');
  const [areaRangeFilter, setAreaRangeFilter] = useState<string>('all');
  const [irrigationTypeFilter, setIrrigationTypeFilter] = useState<string>('all');
  const [privacyThreshold, setPrivacyThreshold] = useState<number>(1);

  const fetchFarmsCount = async () => {
    setLoading(true);
    setErrorMessage(null);
    setAuthError(null);

    try {
      const res = await getAdminFarms({
        state: stateFilter,
        district: districtFilter,
        crop: cropFilter,
        area_range: areaRangeFilter,
        irrigation_type: irrigationTypeFilter,
        privacy_threshold: privacyThreshold,
      });

      setData(res);
      setResponseState('success');
    } catch (err: unknown) {
      setData(null);

      if (err instanceof AdminApiError) {
        if (err.status === 401) {
          setResponseState('401');
          setAuthError({ code: 401, message: err.message || 'Session expired.' });
        } else if (err.status === 403) {
          setResponseState('403');
          setAuthError({ code: 403, message: err.message || 'Access denied.' });
        } else if (err.status === 404) {
          setResponseState('404');
        } else if (err.status === 422) {
          setResponseState('422');
          setErrorMessage(err.message || 'Invalid query parameter provided.');
        } else if (err.status === 0 || err.message?.includes('Network/CORS') || err.message?.includes('Failed to connect')) {
          setResponseState('network_error');
          setErrorMessage(err.message || 'Failed to connect to backend server due to network or CORS error.');
        } else if (err.status >= 500) {
          setResponseState('server_error');
          setErrorMessage(err.message || 'The backend server encountered an internal error.');
        } else {
          setResponseState('generic_error');
          setErrorMessage(err.message || 'Failed to retrieve farm coverage data.');
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
    fetchFarmsCount();
  }, [stateFilter, districtFilter, cropFilter, areaRangeFilter, irrigationTypeFilter, privacyThreshold]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFarmsCount();
  };

  const handleResetFilters = () => {
    setStateFilter('all');
    setDistrictFilter('all');
    setCropFilter('all');
    setAreaRangeFilter('all');
    setIrrigationTypeFilter('all');
    setPrivacyThreshold(1);
  };

  const hasActiveFilters = Boolean(
    stateFilter !== 'all' ||
    districtFilter !== 'all' ||
    cropFilter !== 'all' ||
    areaRangeFilter !== 'all' ||
    irrigationTypeFilter !== 'all' ||
    privacyThreshold !== 1
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#172018]">Farm Coverage Counter</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                Count-Only API
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Aggregate farm counts across districts and crop profiles with privacy suppression threshold protection.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchFarmsCount}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#14532D]' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh Count'}</span>
        </button>
      </div>

      {/* Filter Controls (Supported Query Parameters Only) */}
      <form onSubmit={handleApplyFilters} className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-700">
            <Filter className="w-3.5 h-3.5 text-stone-500" />
            <span>Filter Dimensions</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* State */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">State</label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="all">All States</option>
              <option value="Andhra Pradesh">Andhra Pradesh</option>
              <option value="Telangana">Telangana</option>
            </select>
          </div>

          {/* District */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">District</label>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="all">All Districts</option>
              <option value="Guntur">Guntur</option>
              <option value="Krishna">Krishna</option>

              <option value="Kurnool">Kurnool</option>
              <option value="Warangal">Warangal</option>
              <option value="Nalgonda">Nalgonda</option>
              <option value="Karimnagar">Karimnagar</option>
              <option value="Anantapur">Anantapur</option>
              <option value="West Godavari">West Godavari</option>
            </select>
          </div>

          {/* Crop */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">Crop</label>
            <select
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="all">All Crops</option>
              <option value="Paddy / Rice">Paddy / Rice</option>
              <option value="Cotton">Cotton</option>
              <option value="Chilli">Chilli</option>
              <option value="Maize">Maize</option>
              <option value="Groundnut">Groundnut</option>
              <option value="Pulses">Pulses</option>
              <option value="Sugarcane">Sugarcane</option>
            </select>
          </div>

          {/* Area Range */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">Area Range</label>
            <select
              value={areaRangeFilter}
              onChange={(e) => setAreaRangeFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="all">All Area Ranges</option>
              <option value="< 1 ha">&lt; 1 ha (Small)</option>
              <option value="1 - 2 ha">1 - 2 ha (Marginal)</option>
              <option value="2 - 5 ha">2 - 5 ha (Medium)</option>
              <option value="> 5 ha">&gt; 5 ha (Large)</option>
            </select>
          </div>

          {/* Irrigation Type */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">Irrigation Type</label>
            <select
              value={irrigationTypeFilter}
              onChange={(e) => setIrrigationTypeFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="all">All Irrigation Types</option>
              <option value="borewell">Borewell</option>
              <option value="canal">Canal</option>
              <option value="rainfed">Rainfed</option>
              <option value="drip">Drip</option>
              <option value="sprinkler">Sprinkler</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-stone-500">Privacy Threshold:</label>
            <select
              value={privacyThreshold}
              onChange={(e) => setPrivacyThreshold(Number(e.target.value))}
              className="px-2 py-1 text-xs rounded-lg border border-stone-200 bg-stone-50 font-medium"
            >
              <option value={1}>1 farm min (Default)</option>
              <option value={3}>3 farms min</option>
              <option value={5}>5 farms min</option>
              <option value={10}>10 farms min</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#14532D] hover:bg-[#114324] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Apply Filters</span>
          </button>
        </div>
      </form>

      {/* Response States */}

      {/* 1. Loading State */}
      {loading && (
        <div className="p-8 rounded-2xl bg-white border border-stone-200 shadow-xs flex flex-col items-center justify-center text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[#14532D]" />
          <p className="text-xs font-semibold text-stone-600">Querying farm coverage metrics...</p>
        </div>
      )}

      {/* 2. Authentication Error (401) */}
      {!loading && responseState === '401' && authError && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
            <span>Authentication Failed (401)</span>
          </div>
          <p className="text-xs text-amber-800">{authError.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded-xl transition-colors cursor-pointer"
          >
            Sign in Again
          </button>
        </div>
      )}

      {/* 3. Access Denied (403) */}
      {!loading && responseState === '403' && authError && (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Shield className="w-5 h-5 text-rose-700 shrink-0" />
            <span>Access Denied (403)</span>
          </div>
          <p className="text-xs text-rose-800">{authError.message}</p>
        </div>
      )}

      {/* 4. Network / CORS Error */}
      {!loading && responseState === 'network_error' && (
        <div className="p-5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Network or CORS Connection Error</span>
          </div>
          <p className="text-xs text-rose-700">{errorMessage}</p>
        </div>
      )}

      {/* 5. Validation Error (422) */}
      {!loading && responseState === '422' && (
        <div className="p-5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Request Validation Error (422)</span>
          </div>
          <p className="text-xs text-amber-700">{errorMessage}</p>
        </div>
      )}

      {/* 6. Server Error (500) */}
      {!loading && responseState === 'server_error' && (
        <div className="p-5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Internal Server Error (500)</span>
          </div>
          <p className="text-xs text-rose-700">{errorMessage}</p>
        </div>
      )}

      {/* 7. Success State */}
      {!loading && responseState === 'success' && data && (
        <div className="space-y-4">
          {/* Suppressed Result Display */}
          {data.suppressed ? (
            <div className="p-6 bg-amber-50/80 border border-amber-200 rounded-2xl text-amber-900 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
                <Lock className="w-5 h-5 text-amber-700 shrink-0" />
                <span>Result Suppressed for Privacy Protection</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                {data.privacy_note || `The requested slice contains fewer than ${data.privacy_threshold ?? 1} matching records and was suppressed to prevent re-identification.`}
              </p>
              <div className="text-[11px] text-amber-700 bg-amber-100/60 p-2.5 rounded-xl border border-amber-200/50">
                🔒 Note: Numeric farm count is strictly hidden when <code className="font-mono bg-amber-200/50 px-1 rounded">suppressed === true</code>.
              </div>
            </div>
          ) : data.count === 0 ? (
            /* Successful Empty (0 Count) */
            <div className="p-8 rounded-2xl bg-white border border-stone-200 shadow-xs flex flex-col items-center justify-center text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-stone-800">No farms match these filters.</h3>
              <p className="text-xs text-stone-500 max-w-md">
                Try broadening your filter criteria (e.g. state, crop, or irrigation type) to view aggregate coverage.
              </p>
            </div>
          ) : (
            /* Successful Count (> 0) */
            <div className="p-6 rounded-2xl bg-white border border-emerald-200 shadow-xs space-y-3 bg-gradient-to-br from-emerald-50/40 via-white to-white">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <Sprout className="w-4 h-4 text-emerald-600" />
                <span>Coverage Match Summary</span>
              </div>
              <div className="text-3xl font-extrabold text-[#172018]">
                {data.count}{' '}
                <span className="text-base font-semibold text-stone-600">
                  {data.count === 1 ? 'farm matches your filters.' : 'farms match your filters.'}
                </span>
              </div>
              <div className="text-xs text-stone-500">
                Matching records meet or exceed the privacy threshold of {data.privacy_threshold ?? 1} {data.privacy_threshold === 1 ? 'record' : 'records'}.
              </div>
            </div>
          )}

          {/* Active Applied Filters Card */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
            <div className="text-xs font-bold text-stone-700">Filters Applied in Query</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 font-medium">
                State: <strong>{data.filters_applied?.state || 'All'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 font-medium">
                District: <strong>{data.filters_applied?.district || 'All'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 font-medium">
                Crop: <strong>{data.filters_applied?.crop || 'All'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 font-medium">
                Area Range: <strong>{data.filters_applied?.area_range || 'All'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 font-medium">
                Irrigation Type: <strong>{data.filters_applied?.irrigation_type || 'All'}</strong>
              </span>
            </div>
          </div>

          {/* Backend Contract Privacy Mismatch Flag */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 text-[11px] text-amber-900 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Backend Privacy Contract Audit Note</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              The backend currently documents <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900">count</code> as an integer and sends the numeric count over the network even when <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900">suppressed === true</code>. The frontend UI enforces privacy by withholding the display of count, but for complete network privacy, the backend API should make <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900">count</code> nullable and set it to <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900">null</code> on the server side when suppressed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

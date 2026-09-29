import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CloudSun,
  Cpu,
  Droplets,
  Eye,
  FileText,
  Filter,
  Info,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Sprout,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import { AdminApiError, getAdminPredictions } from '../../lib/adminApi';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminPagination } from '../../components/admin/AdminPagination';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import type { AdminPredictionItem, PipelineRequestSummary, PipelineResultSummary, PipelineStageDetail } from '../../types';

export type { AdminPredictionItem };

export function formatModelTypeName(modelType?: string | null): string {
  if (!modelType) return 'Inference Model';
  const norm = modelType.toLowerCase().trim();
  if (norm === 'farm_decision_pipeline' || norm === 'pipeline') {
    return 'Farm Decision Pipeline';
  }
  if (norm === 'crop' || norm === 'crop_recommendation') return 'Crop Recommendation';
  if (norm === 'climate' || norm === 'climate_risk') return 'Climate Risk';
  if (norm === 'irrigation') return 'Irrigation Advice';
  if (norm === 'yield') return 'Yield Prediction';
  if (norm === 'market' || norm === 'market_price') return 'Market Price';
  if (norm === 'schemes') return 'Government Schemes';
  return modelType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPredictionOutcome(item: AdminPredictionItem): {
  concise: string;
  isMissing: boolean;
  rawSummary: string | object | null;
} {
  const objSummary =
    item.result_summary && typeof item.result_summary === 'object'
      ? (item.result_summary as PipelineResultSummary & Record<string, unknown>)
      : null;

  const isPipeline =
    item.model_type === 'farm_decision_pipeline' ||
    item.model_type === 'pipeline' ||
    Boolean(objSummary && ('pipeline_status' in objSummary || 'stages' in objSummary));

  if (isPipeline && objSummary) {
    const status = String(objSummary.pipeline_status || item.status || 'success').toLowerCase();
    const stages = (objSummary.stages as Record<string, unknown> | undefined) || {};
    const stageKeys = ['crop', 'climate', 'irrigation', 'yield', 'market', 'schemes'];

    let passCount = typeof objSummary.stage_success_count === 'number' ? objSummary.stage_success_count : 0;
    let failCount = typeof objSummary.stage_failure_count === 'number' ? objSummary.stage_failure_count : 0;

    if (objSummary.stage_success_count === undefined && Object.keys(stages).length > 0) {
      passCount = 0;
      failCount = 0;
      stageKeys.forEach((key) => {
        const stage = stages[key] as Record<string, unknown> | undefined;
        if (stage) {
          const st = String(stage.status || '').toLowerCase();
          if (st === 'success' || st === 'ok' || st === 'passed') {
            passCount++;
          } else if (st === 'failed' || st === 'error') {
            failCount++;
          } else if (stage.result !== undefined && stage.result !== null && !stage.error) {
            passCount++;
          } else if (stage.error || stage.message) {
            failCount++;
          }
        }
      });
    }

    const totalStages = Math.max(6, passCount + failCount, Object.keys(stages).length);

    let concise = '';
    if (status === 'success' || (passCount === totalStages && failCount === 0)) {
      concise = `Pipeline: ${passCount}/${totalStages} stages passed`;
    } else if (status === 'partial' || (passCount > 0 && failCount > 0)) {
      concise = `Pipeline: ${passCount} succeeded, ${failCount} failed`;
    } else if (status === 'failed' || (failCount === totalStages && passCount === 0)) {
      concise = `Pipeline: 0/${totalStages} stages passed (failed)`;
    } else {
      concise = `Pipeline (${status}): ${passCount} passed, ${failCount} failed`;
    }

    return { concise, isMissing: false, rawSummary: item.result_summary ?? null };
  }

  // 1. Check yield fields (from top-level or result_summary object)
  const predYield =
    item.predicted_yield ??
    item.yield_predicted ??
    objSummary?.predicted_yield ??
    objSummary?.yield_predicted ??
    objSummary?.yield;

  const totalTonnes = item.total_tonnes ?? objSummary?.total_tonnes;
  const yieldQHa = item.yield_q_per_ha ?? objSummary?.yield_q_per_ha;
  const yieldQAcre = item.yield_q_per_acre ?? objSummary?.yield_q_per_acre;

  const hasPredYield = predYield !== null && predYield !== undefined && String(predYield).trim() !== '';
  const hasTotalTonnes = totalTonnes !== null && totalTonnes !== undefined && String(totalTonnes).trim() !== '';
  const hasYieldQHa = yieldQHa !== null && yieldQHa !== undefined && String(yieldQHa).trim() !== '';
  const hasYieldQAcre = yieldQAcre !== null && yieldQAcre !== undefined && String(yieldQAcre).trim() !== '';

  if (hasPredYield || hasTotalTonnes || hasYieldQHa || hasYieldQAcre) {
    const parts: string[] = [];
    if (hasPredYield) {
      parts.push(`${predYield} tonnes/ha`);
    }
    if (hasTotalTonnes) {
      parts.push(`${totalTonnes} tonnes total`);
    }
    if (hasYieldQHa) {
      parts.push(`${yieldQHa} quintals/ha`);
    }
    if (hasYieldQAcre) {
      parts.push(`${yieldQAcre} quintals/acre`);
    }
    return {
      concise: parts.join(' • '),
      isMissing: false,
      rawSummary: item.result_summary || {
        predicted_yield: predYield,
        total_tonnes: totalTonnes,
        yield_q_per_ha: yieldQHa,
        yield_q_per_acre: yieldQAcre,
      },
    };
  }

  // 2. String result_summary
  if (typeof item.result_summary === 'string' && item.result_summary.trim() !== '') {
    return { concise: item.result_summary.trim(), isMissing: false, rawSummary: item.result_summary };
  }

  // 3. Object result_summary checks (diseases, crops, irrigation, general text)
  if (objSummary) {
    if (objSummary.disease || objSummary.disease_identified || objSummary.primary_diagnosis) {
      const d = String(objSummary.disease || objSummary.disease_identified || objSummary.primary_diagnosis);
      const c = objSummary.confidence ?? objSummary.confidence_score;
      const confStr =
        c !== undefined && c !== null
          ? ` (${(Number(c) <= 1 && Number(c) > 0 ? Number(c) * 100 : Number(c)).toFixed(1)}%)`
          : '';
      return { concise: `${d}${confStr}`, isMissing: false, rawSummary: item.result_summary ?? null };
    }
    if (objSummary.recommended_crop || objSummary.crop) {
      return { concise: `Crop: ${String(objSummary.recommended_crop || objSummary.crop)}`, isMissing: false, rawSummary: item.result_summary ?? null };
    }
    if (objSummary.irrigation_advice || objSummary.water_requirement) {
      return { concise: `Irrigation: ${String(objSummary.irrigation_advice || objSummary.water_requirement)}`, isMissing: false, rawSummary: item.result_summary ?? null };
    }
    if (objSummary.summary || objSummary.text || objSummary.message) {
      return { concise: String(objSummary.summary || objSummary.text || objSummary.message), isMissing: false, rawSummary: item.result_summary ?? null };
    }
    return { concise: JSON.stringify(objSummary), isMissing: false, rawSummary: item.result_summary ?? null };
  }

  // 4. Other direct item fallback fields
  const directRes = item.outcome ?? item.result;
  if (typeof directRes === 'string' && directRes.trim() !== '') {
    return { concise: directRes.trim(), isMissing: false, rawSummary: directRes };
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
  const objSummary =
    item.result_summary && typeof item.result_summary === 'object'
      ? (item.result_summary as Record<string, unknown>)
      : null;

  const ms =
    item.latency_ms ??
    item.execution_time_ms ??
    item.latency ??
    (objSummary?.duration_ms as number | undefined);

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

const PIPELINE_STAGES = [
  { key: 'crop', label: '1. Crop Selection', icon: Sprout },
  { key: 'climate', label: '2. Climate Risk', icon: CloudSun },
  { key: 'irrigation', label: '3. Irrigation Plan', icon: Droplets },
  { key: 'yield', label: '4. Yield Forecast', icon: BarChart3 },
  { key: 'market', label: '5. Market Price', icon: TrendingUp },
  { key: 'schemes', label: '6. Government Schemes', icon: Award },
];

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

  const renderStageContent = (stageKey: string, stageData: unknown) => {
    if (stageData === undefined || stageData === null) {
      return (
        <span className="text-stone-400 italic text-[11px]">
          Stage omitted or not executed in this pipeline run
        </span>
      );
    }

    let resultVal: unknown = stageData;
    let errVal: string | null = null;

    if (typeof stageData === 'object' && stageData !== null) {
      const sObj = stageData as Record<string, unknown>;
      if ('result' in sObj) {
        resultVal = sObj.result;
      }
      if (sObj.error) {
        errVal = String(sObj.error);
      } else if (sObj.message && String(sObj.status || '').toLowerCase().includes('fail')) {
        errVal = String(sObj.message);
      }
    }

    if (errVal) {
      return (
        <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-[11px] flex items-start gap-1.5 font-medium">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
          <span>{errVal}</span>
        </div>
      );
    }

    if (resultVal === undefined || resultVal === null) {
      return <span className="text-stone-400 italic text-[11px]">No return payload</span>;
    }

    if (typeof resultVal === 'string' || typeof resultVal === 'number' || typeof resultVal === 'boolean') {
      return <span className="font-semibold text-stone-800 text-xs">{String(resultVal)}</span>;
    }

    if (typeof resultVal === 'object') {
      const resObj = resultVal as Record<string, unknown>;

      if (stageKey === 'crop') {
        const cVal = resObj.recommended_crop || resObj.crop || resObj.target_crop;
        const conf = resObj.confidence ?? resObj.confidence_score;
        if (cVal) {
          return (
            <div className="space-y-0.5">
              <div className="font-bold text-stone-900 text-xs">
                Recommended Crop: <span className="text-[#14532D]">{String(cVal)}</span>
                {conf !== undefined && conf !== null && (
                  <span className="text-stone-500 font-normal ml-1 text-[11px]">
                    ({(Number(conf) <= 1 && Number(conf) > 0 ? Number(conf) * 100 : Number(conf)).toFixed(1)}% match)
                  </span>
                )}
              </div>
              {Boolean(resObj.reasoning) && (
                <p className="text-[11px] text-stone-600 leading-snug">{String(resObj.reasoning)}</p>
              )}
            </div>
          );
        }
      }

      if (stageKey === 'climate') {
        const risk = resObj.risk_level || resObj.status || resObj.climate_risk;
        const rainfall = resObj.rainfall_mm ?? resObj.expected_rainfall;
        if (risk || rainfall !== undefined) {
          return (
            <div className="space-y-0.5">
              {Boolean(risk) && (
                <div className="font-bold text-stone-900 text-xs">
                  Climate Risk: <span className="text-amber-800">{String(risk)}</span>
                </div>
              )}
              {rainfall !== undefined && (
                <div className="text-[11px] text-stone-600">Rainfall: {String(rainfall)} mm</div>
              )}
            </div>
          );
        }
      }

      if (stageKey === 'irrigation') {
        const advice = resObj.irrigation_advice || resObj.advice || resObj.water_requirement;
        if (advice) {
          return (
            <div className="space-y-0.5">
              <div className="font-bold text-stone-900 text-xs">
                Advice: <span className="text-sky-900">{String(advice)}</span>
              </div>
            </div>
          );
        }
      }

      if (stageKey === 'yield') {
        const pred = resObj.predicted_yield ?? resObj.yield;
        const total = resObj.total_tonnes;
        if (pred !== undefined || total !== undefined) {
          return (
            <div className="space-y-0.5 font-bold text-stone-900 text-xs">
              {pred !== undefined && <div>Yield: {String(pred)} tonnes/ha</div>}
              {total !== undefined && <div>Total Production: {String(total)} tonnes</div>}
            </div>
          );
        }
      }

      if (stageKey === 'market') {
        const price = resObj.expected_price ?? resObj.price;
        const trend = resObj.trend || resObj.market_trend;
        if (price !== undefined || trend) {
          return (
            <div className="space-y-0.5">
              {price !== undefined && (
                <div className="font-bold text-stone-900 text-xs">
                  Market Price: <span className="text-emerald-800">₹{String(price)}/quintal</span>
                </div>
              )}
              {Boolean(trend) && <div className="text-[11px] text-stone-600">Trend: {String(trend)}</div>}
            </div>
          );
        }
      }

      if (stageKey === 'schemes') {
        const count = resObj.eligible_schemes_count ?? resObj.matched_schemes_count;
        const top = resObj.top_scheme || resObj.scheme_name;
        if (count !== undefined || top) {
          return (
            <div className="space-y-0.5">
              {count !== undefined && (
                <div className="font-bold text-stone-900 text-xs">
                  Eligible Schemes: <span className="text-purple-900">{String(count)} schemes</span>
                </div>
              )}
              {Boolean(top) && <div className="text-[11px] text-stone-600">Top Match: {String(top)}</div>}
            </div>
          );
        }
      }

      // Generic fallback for any other stage object structure: render key-value summary
      const entries = Object.entries(resObj);
      if (entries.length > 0) {
        return (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            {entries.slice(0, 6).map(([k, v]) => (
              <div key={k} className="truncate">
                <span className="text-stone-400 font-mono capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
                <span className="font-semibold text-stone-800">
                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        );
      }
    }

    return <span className="font-mono text-[11px] text-stone-700">{JSON.stringify(resultVal)}</span>;
  };

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
              Operational telemetry for standalone ML models and connected Farm Decision Pipeline runs.
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
          description="Inference logs across all ML models and Farm Decision Pipeline runs will stream automatically once GET /api/v1/admin/predictions is deployed."
          note="Connected route: GET /api/v1/admin/predictions (supports page, page_size, search, model_type parameters)"
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
                    <option value="farm_decision_pipeline">Farm Decision Pipeline</option>
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
                      Model: {formatModelTypeName(modelFilter)}
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
                      const isPipelineItem =
                        item.model_type === 'farm_decision_pipeline' ||
                        item.model_type === 'pipeline' ||
                        outcomeInfo.concise.startsWith('Pipeline:');

                      const displayCrop =
                        item.crop ||
                        item.request_summary?.target_crop ||
                        item.recommended_crop ||
                        'Multi-crop';

                      const displayStatus = item.status || (isPipelineItem && typeof item.result_summary === 'object' && item.result_summary ? (item.result_summary as PipelineResultSummary).pipeline_status : 'success') || 'success';

                      return (
                        <tr key={item.id || `pred_${idx}`} className="hover:bg-stone-50/70 transition-colors text-xs">
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-stone-900">{item.id || 'N/A'}</span>
                            <div className="text-[10px] text-stone-400 mt-0.5">
                              {timeStr ? new Date(timeStr).toLocaleString() : 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-stone-800">
                            {isPipelineItem ? (
                              <span className="inline-flex items-center gap-1.5 font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                <Layers className="w-3 h-3 text-purple-700 shrink-0" />
                                <span>Farm Decision Pipeline</span>
                              </span>
                            ) : (
                              formatModelTypeName(item.model_type)
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-[#14532D]">{String(displayCrop)}</span>
                            <span className="text-[10px] text-stone-400 block">
                              {[item.district, item.state].filter(Boolean).join(', ') || 'Regional'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {outcomeInfo.isMissing ? (
                              <span className="text-stone-400 italic">Not recorded</span>
                            ) : isPipelineItem ? (
                              <span className="text-purple-950 font-bold bg-purple-50/80 px-2 py-0.5 rounded-md border border-purple-200/80">
                                {outcomeInfo.concise}
                              </span>
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
                            <AdminStatusBadge status={displayStatus} />
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
      {selectedPrediction && (() => {
        const objSummary =
          selectedPrediction.result_summary && typeof selectedPrediction.result_summary === 'object'
            ? (selectedPrediction.result_summary as PipelineResultSummary & Record<string, unknown>)
            : null;

        const reqSummary = selectedPrediction.request_summary || (objSummary?.request_summary as PipelineRequestSummary & Record<string, unknown> | undefined);

        const isPipelineModal =
          selectedPrediction.model_type === 'farm_decision_pipeline' ||
          selectedPrediction.model_type === 'pipeline' ||
          Boolean(objSummary && ('pipeline_status' in objSummary || 'stages' in objSummary));

        const stagesObj = (objSummary?.stages as Record<string, unknown> | undefined) || {};

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in max-h-[90vh] overflow-y-auto space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0">
                    {isPipelineModal ? <Layers className="w-5 h-5 text-purple-700" /> : <BarChart3 className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-stone-900 font-mono">
                        Prediction #{selectedPrediction.id}
                      </h3>
                      <AdminStatusBadge
                        status={selectedPrediction.status || (objSummary?.pipeline_status as string) || 'success'}
                      />
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Model: {formatModelTypeName(selectedPrediction.model_type)}
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

              {/* Verification Banner */}
              {selectedPrediction.verification_status === 'verified' || selectedPrediction.status === 'verified' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Verified prediction run. Correctness confirmed by agronomist review.</span>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold block">Telemetry log entry</span>
                    <p className="text-amber-800 text-[11px] leading-relaxed">
                      Inference output logged automatically. Correctness has not been manually audited by an agronomist.
                    </p>
                  </div>
                </div>
              )}

              {/* Connected Farm Request Parameters */}
              {Boolean(reqSummary) && (
                <div className="p-3.5 bg-purple-50/60 border border-purple-200/80 rounded-2xl space-y-2 text-xs">
                  <span className="font-bold text-purple-950 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-purple-700" />
                    <span>Connected Farm Pipeline Request Parameters (request_summary)</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    {Boolean(reqSummary?.target_crop) && (
                      <div className="p-2 bg-white rounded-xl border border-purple-100">
                        <span className="text-stone-400 block text-[10px]">Target Crop</span>
                        <span className="font-semibold text-stone-900">{String(reqSummary?.target_crop)}</span>
                      </div>
                    )}
                    {reqSummary?.area_ha !== undefined && reqSummary?.area_ha !== null && (
                      <div className="p-2 bg-white rounded-xl border border-purple-100">
                        <span className="text-stone-400 block text-[10px]">Land Area</span>
                        <span className="font-semibold text-stone-900">{String(reqSummary.area_ha)} ha</span>
                      </div>
                    )}
                    {Boolean(reqSummary?.sowing_date) && (
                      <div className="p-2 bg-white rounded-xl border border-purple-100">
                        <span className="text-stone-400 block text-[10px]">Sowing Date</span>
                        <span className="font-semibold text-stone-900">{String(reqSummary?.sowing_date)}</span>
                      </div>
                    )}
                    {reqSummary?.pump_hp !== undefined && reqSummary?.pump_hp !== null && (
                      <div className="p-2 bg-white rounded-xl border border-purple-100">
                        <span className="text-stone-400 block text-[10px]">Pump Capacity</span>
                        <span className="font-semibold text-stone-900">{String(reqSummary.pump_hp)} HP</span>
                      </div>
                    )}
                    {reqSummary?.solar_interest !== undefined && reqSummary?.solar_interest !== null && (
                      <div className="p-2 bg-white rounded-xl border border-purple-100">
                        <span className="text-stone-400 block text-[10px]">Solar Interest</span>
                        <span className="font-semibold text-stone-900">
                          {String(reqSummary.solar_interest) === 'true' || reqSummary.solar_interest === true ? 'Yes' : String(reqSummary.solar_interest)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-stone-50 border border-stone-200/80 rounded-2xl text-xs">
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Crop / Region:</span>
                  <span className="font-semibold text-stone-900">
                    {String(selectedPrediction.crop || reqSummary?.target_crop || 'Multi-crop')} ({[selectedPrediction.district, selectedPrediction.state].filter(Boolean).join(', ') || 'Regional'})
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
                    {reqSummary?.area_ha ? `${reqSummary.area_ha} ha` : selectedPrediction.acres ? `${selectedPrediction.acres} Acres` : 'Not recorded'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Timestamp:</span>
                  <span className="text-stone-700">
                    {selectedPrediction.created_at || selectedPrediction.timestamp ? new Date(selectedPrediction.created_at || selectedPrediction.timestamp!).toLocaleString() : 'Not recorded'}
                  </span>
                </div>
              </div>

              {/* Farm Decision Pipeline 6-Stage Breakdown */}
              {isPipelineModal && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-700" />
                      <span>Pipeline Stages Execution Breakdown (6 Stages)</span>
                    </span>
                    {objSummary?.pipeline_status && (
                      <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                        Status: {objSummary.pipeline_status}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PIPELINE_STAGES.map((st) => {
                      const Icon = st.icon;
                      const stageData = stagesObj[st.key] as Record<string, unknown> | undefined;

                      let statusText = 'Not Run';
                      let badgeColor = 'bg-stone-100 text-stone-600 border-stone-200';

                      if (stageData) {
                        const stStr = String(stageData.status || '').toLowerCase();
                        if (stStr === 'success' || stStr === 'ok' || stStr === 'passed') {
                          statusText = 'Success';
                          badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                        } else if (stStr === 'failed' || stStr === 'error' || stageData.error) {
                          statusText = 'Failed';
                          badgeColor = 'bg-rose-50 text-rose-800 border-rose-300';
                        } else if (stageData.result !== undefined && stageData.result !== null) {
                          statusText = 'Success';
                          badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                        }
                      }

                      return (
                        <div
                          key={st.key}
                          className="p-3 bg-stone-50/80 border border-stone-200/90 rounded-2xl space-y-2 flex flex-col justify-between text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-stone-200/60 pb-2">
                            <div className="flex items-center gap-2 font-bold text-stone-900">
                              <Icon className="w-4 h-4 text-purple-700 shrink-0" />
                              <span>{st.label}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                              {statusText}
                            </span>
                          </div>

                          <div className="py-1">{renderStageContent(st.key, stageData)}</div>

                          {stageData?.duration_ms !== undefined && stageData.duration_ms !== null && (
                            <div className="text-[10px] font-mono text-stone-400 text-right pt-1 border-t border-stone-200/40">
                              Latency: {Number(stageData.duration_ms)} ms
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Optional Technical Details & Collapsible Raw JSON */}
              <details className="group border border-stone-200 rounded-2xl bg-stone-50/80 overflow-hidden text-xs">
                <summary className="p-3.5 font-bold text-stone-800 text-xs cursor-pointer flex items-center justify-between hover:bg-stone-100 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-stone-500" />
                    <span>Technical Telemetry & Raw JSON Payload</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-stone-500 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="p-3.5 border-t border-stone-200 space-y-3 bg-white">
                  <span className="font-bold text-stone-700 text-[11px] block">
                    Raw result_summary Object:
                  </span>
                  <pre className="p-3 bg-stone-900 text-stone-100 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {typeof selectedPrediction.result_summary === 'object' && selectedPrediction.result_summary !== null
                      ? JSON.stringify(selectedPrediction.result_summary, null, 2)
                      : String(formatPredictionOutcome(selectedPrediction).rawSummary || formatPredictionOutcome(selectedPrediction).concise)}
                  </pre>
                  {selectedPrediction.request_summary && (
                    <>
                      <span className="font-bold text-stone-700 text-[11px] block pt-2">
                        Raw request_summary Object:
                      </span>
                      <pre className="p-3 bg-stone-900 text-stone-100 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {JSON.stringify(selectedPrediction.request_summary, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              </details>

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
        );
      })()}
    </div>
  );
};

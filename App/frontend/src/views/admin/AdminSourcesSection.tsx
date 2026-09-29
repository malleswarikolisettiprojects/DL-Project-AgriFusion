import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Filter,
  Globe,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Upload,
} from 'lucide-react';
import {
  AdminApiError,
  getAdminSources,
  reindexSource,
} from '../../lib/adminApi';
import type {
  KnowledgeSource,
  SourceIndexStatus,
  SourceVerificationStatus,
} from '../../types';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminPagination } from '../../components/admin/AdminPagination';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import { ConfirmActionDialog } from '../../components/admin/ConfirmActionDialog';
import {
  RegisterSourceModal,
  UpdateSourceStatusModal,
  UploadDocumentModal,
} from '../../components/admin/SourceModals';

export const AdminSourcesSection: React.FC = () => {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all');
  const [verificationStatusFilter, setVerificationStatusFilter] = useState('all');
  const [indexStatusFilter, setIndexStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [statusModalSource, setStatusModalSource] = useState<KnowledgeSource | null>(null);

  // Reindex Confirmation Dialog
  const [reindexTarget, setReindexTarget] = useState<KnowledgeSource | null>(null);
  const [reindexLoading, setReindexLoading] = useState(false);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setApiUnavailable(false);
    setAccessDenied(false);

    try {
      const data = await getAdminSources({
        page: currentPage,
        page_size: pageSize,
        search: searchTerm || undefined,
        organization: organizationFilter !== 'all' ? organizationFilter : undefined,
        source_type: sourceTypeFilter !== 'all' ? sourceTypeFilter : undefined,
        verification_status: verificationStatusFilter !== 'all' ? verificationStatusFilter : undefined,
        index_status: indexStatusFilter !== 'all' ? indexStatusFilter : undefined,
      });

      if (data && Array.isArray(data.items)) {
        setSources(data.items);
        setTotalCount(typeof data.total === 'number' ? data.total : data.items.length);
      } else {
        setSources([]);
        setTotalCount(0);
      }
    } catch (err: any) {
      setSources([]);
      setTotalCount(0);
      if (err instanceof AdminApiError) {
        if (err.status === 404) {
          setApiUnavailable(true);
        } else if (err.status === 403) {
          setAccessDenied(true);
          setErrorMessage('Access denied. Administrator credentials required to access RAG sources.');
        } else if (err.status === 401) {
          setErrorMessage('Your session has expired. Please sign in again.');
        } else {
          setErrorMessage(err.message || 'Failed to load knowledge sources.');
        }
      } else {
        setErrorMessage(err?.message || 'Unable to communicate with the knowledge source registry.');
      }
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    pageSize,
    searchTerm,
    organizationFilter,
    sourceTypeFilter,
    verificationStatusFilter,
    indexStatusFilter,
  ]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleConfirmReindex = async () => {
    if (!reindexTarget) return;
    setReindexLoading(true);
    try {
      const res = await reindexSource(reindexTarget.id);
      setSuccessMessage(res.message || `Re-indexing queued for "${reindexTarget.title}".`);
      setReindexTarget(null);
      await fetchSources();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to trigger reindexing.');
    } finally {
      setReindexLoading(false);
    }
  };

  const handleSourceRegistered = (newSource: KnowledgeSource) => {
    setSuccessMessage(`Registered knowledge source "${newSource.title}". Evaluation queued.`);
    fetchSources();
  };

  const handleSourceUpdated = (updated: KnowledgeSource) => {
    setSuccessMessage(`Updated status for "${updated.title}".`);
    fetchSources();
  };

  // Client-side state filter if backend did not filter state
  const displayedSources = sources.filter((s) => {
    if (stateFilter === 'all') return true;
    if (!s.state_relevance || s.state_relevance.length === 0) return true;
    return s.state_relevance.some(
      (st) => st.toLowerCase().includes(stateFilter.toLowerCase())
    );
  });

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const formatSourceType = (typeStr: string) => {
    const map: Record<string, string> = {
      agricultural_university: 'University (ANGRAU / PJTSAU)',
      icar_institute: 'ICAR Institute',
      kvk: 'Krishi Vigyan Kendra (KVK)',
      state_agriculture_department: 'State Agriculture Dept',
      state_horticulture_department: 'State Horticulture Dept',
      government_department: 'Central Ministry',
      ppqs: 'Plant Protection (PPQS)',
      cibrc: 'CIBRC Insecticides',
      official_scheme_portal: 'Scheme Portal',
      other_authoritative: 'Authoritative Research',
    };
    return map[typeStr] || typeStr.replace(/_/g, ' ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#172018]">Canonical Knowledge Sources</h2>
            <p className="text-xs text-stone-500">
              ANGRAU, PJTSAU, ICAR, KVK, state department, and other verified agricultural sources for the RAG system.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRegisterModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Source</span>
          </button>

          <button
            type="button"
            onClick={fetchSources}
            disabled={loading}
            aria-label="Refresh knowledge sources"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh Sources'}</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div
          role="status"
          className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* API Unavailable State */}
      {apiUnavailable ? (
        <AdminEmptyState
          title="Knowledge sources API is not available yet."
          description="The RAG knowledge base registry requires backend integration. To register canonical sources, the backend must expose GET /api/v1/admin/sources."
          note="Instructions: Once enabled, canonical university documents (e.g. ANGRAU Vyavasaya Panchangam, PJTSAU package of practices) will be tracked and reindexed here."
          action={{
            label: 'Check Endpoint',
            onClick: fetchSources,
          }}
        />
      ) : accessDenied ? (
        <AdminEmptyState
          title="Access Denied"
          description="Administrator authorization is required to view and manage canonical RAG sources."
          note="Sign in with an authorized administrator Supabase account."
        />
      ) : (
        <>
          {/* Controls Bar */}
          <div className="p-4 bg-white border border-stone-200 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-xs text-xs text-stone-600">
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search title, org, crop..."
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder:text-stone-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-stone-400" />
                <span>State:</span>
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
              </div>

              <div className="flex items-center gap-1.5">
                <span>Verification:</span>
                <select
                  value={verificationStatusFilter}
                  onChange={(e) => {
                    setVerificationStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden"
                >
                  <option value="all">All Verification</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="verified">Verified</option>
                  <option value="verified_with_caveats">Verified with caveats</option>
                  <option value="needs_review">Needs review</option>
                  <option value="stale">Stale</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span>Index:</span>
                <select
                  value={indexStatusFilter}
                  onChange={(e) => {
                    setIndexStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden"
                >
                  <option value="all">All Index Status</option>
                  <option value="indexed">Indexed</option>
                  <option value="queued">Queued</option>
                  <option value="indexing">Indexing</option>
                  <option value="not_indexed">Not Indexed</option>
                  <option value="outdated">Outdated</option>
                  <option value="index_failed">Index Failed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Records List / Grid */}
          {loading ? (
            <div className="p-12 text-center text-xs text-stone-500 bg-white border border-stone-200 rounded-2xl flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
              <span>Loading canonical knowledge sources from FastAPI backend...</span>
            </div>
          ) : errorMessage ? (
            /* When fetch fails with error (network, CORS, 5xx, 401), error alert banner is rendered above. Do not show empty state banner. */
            null
          ) : displayedSources.length === 0 ? (
            <div className="p-12 text-center text-xs text-stone-500 bg-white border border-stone-200 rounded-2xl space-y-2">
              <BookOpen className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="font-semibold text-stone-700">No canonical knowledge sources have been registered yet.</p>
              <p className="text-[11px] text-stone-400 max-w-md mx-auto">
                Once authoritative university and departmental guides are registered or imported, they will appear here with full provenance and verification tracking.
              </p>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register First Source</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedSources.map((source) => {
                const subjectStr = source.crop_or_subject || source.crop || source.subject || 'All Crops / General Agronomy';
                const statesStr = source.state_relevance && source.state_relevance.length > 0
                  ? source.state_relevance.join(', ')
                  : 'Andhra Pradesh & Telangana';

                return (
                  <div
                    key={source.id}
                    className="p-5 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-bold text-[#172018] leading-tight">
                            {source.title}
                          </h3>
                          <p className="text-[11px] text-[#8B5E34] font-medium mt-0.5">
                            {source.organization}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <AdminStatusBadge status={source.verification_status || source.status || 'pending_review'} />
                          <AdminStatusBadge
                            status={source.index_status || 'not_indexed'}
                            className="text-[10px]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-200/60">
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Category:</span>
                          <span className="font-semibold text-stone-800">
                            {formatSourceType(source.source_type || 'other_authoritative')}
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Crop / Subject:</span>
                          <span className="font-semibold text-stone-800 truncate block">
                            {subjectStr}
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">State Scope:</span>
                          <span className="font-semibold text-stone-800">{statesStr}</span>
                        </div>
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Verified Date:</span>
                          <span>
                            {source.verified_date || source.verification_date
                              ? new Date(source.verified_date || source.verification_date!).toLocaleDateString()
                              : 'Pending Review'}
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Last Indexed:</span>
                          <span>
                            {source.last_indexed_at || source.last_indexed_date
                              ? new Date(source.last_indexed_at || source.last_indexed_date!).toLocaleDateString()
                              : 'Queued / Not indexed'}
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Language:</span>
                          <span className="font-semibold text-stone-800">{source.language || 'English'}</span>
                        </div>
                      </div>

                      {/* Caveats */}
                      {Array.isArray(source.caveats) && source.caveats.length > 0 && (
                        <div className="text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 space-y-1">
                          <div className="font-bold flex items-center gap-1 text-[10px] uppercase">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            <span>Agronomic Caveats:</span>
                          </div>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {source.caveats.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Official Link */}
                      {source.official_url ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#14532D]">
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <a
                            href={source.official_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline truncate hover:text-[#16A34A]"
                          >
                            {source.official_url}
                          </a>
                        </div>
                      ) : (
                        <div className="text-[11px] text-stone-400 italic">
                          Official URL not available.
                        </div>
                      )}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-stone-100 text-xs">
                      <button
                        type="button"
                        onClick={() => setStatusModalSource(source)}
                        className="px-2.5 py-1 text-[11px] font-medium bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-lg text-stone-700 cursor-pointer transition-colors"
                      >
                        Update Status
                      </button>

                      <button
                        type="button"
                        onClick={() => setReindexTarget(source)}
                        className="px-3 py-1 text-[11px] font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Trigger Reindex</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="p-4 bg-white border border-stone-200 rounded-2xl">
              <AdminPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      {/* Registration Modal */}
      <RegisterSourceModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={handleSourceRegistered}
      />

      {/* Upload Document Modal (Disabled per missing endpoint) */}
      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />

      {/* Status Update Modal */}
      <UpdateSourceStatusModal
        isOpen={Boolean(statusModalSource)}
        source={statusModalSource}
        onClose={() => setStatusModalSource(null)}
        onSuccess={handleSourceUpdated}
      />

      {/* Reindex Confirmation Dialog */}
      <ConfirmActionDialog
        isOpen={Boolean(reindexTarget)}
        title={`Request Re-indexing: ${reindexTarget?.title || ''}`}
        message="Request re-indexing for this source? The source will not be treated as verified unless it has separately passed verification."
        confirmLabel="Queue Re-index"
        isLoading={reindexLoading}
        onConfirm={handleConfirmReindex}
        onCancel={() => setReindexTarget(null)}
      />
    </div>
  );
};

import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Filter,
  Globe,
  HelpCircle,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  AdminApiError,
  getAdminSchemes,
  recheckScheme,
} from '../../lib/adminApi';
import type {
  GovernmentScheme,
  SchemeCurrentStatus,
  SchemeVerificationStatus,
} from '../../types';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminPagination } from '../../components/admin/AdminPagination';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import {
  RegisterSchemeModal,
  UpdateSchemeModal,
  VerifySchemeModal,
} from '../../components/admin/SchemeModals';

export const AdminSchemesSection: React.FC = () => {
  const [schemes, setSchemes] = useState<GovernmentScheme[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [schemeTypeFilter, setSchemeTypeFilter] = useState('all');
  const [verificationStatusFilter, setVerificationStatusFilter] = useState('all');
  const [currentStatusFilter, setCurrentStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<GovernmentScheme | null>(null);
  const [updateTarget, setUpdateTarget] = useState<GovernmentScheme | null>(null);
  const [recheckingId, setRecheckingId] = useState<string | null>(null);

  const fetchSchemes = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setApiUnavailable(false);
    setAccessDenied(false);

    try {
      const data = await getAdminSchemes({
        page: currentPage,
        page_size: pageSize,
        search: searchTerm || undefined,
        state: stateFilter !== 'all' ? stateFilter : undefined,
        department: departmentFilter !== 'all' ? departmentFilter : undefined,
        scheme_type: schemeTypeFilter !== 'all' ? schemeTypeFilter : undefined,
        verification_status: verificationStatusFilter !== 'all' ? verificationStatusFilter : undefined,
        current_status: currentStatusFilter !== 'all' ? currentStatusFilter : undefined,
      });

      if (data && Array.isArray(data.items)) {
        setSchemes(data.items);
        setTotalCount(typeof data.total === 'number' ? data.total : data.items.length);
      } else {
        setSchemes([]);
        setTotalCount(0);
      }
    } catch (err: any) {
      setSchemes([]);
      setTotalCount(0);
      if (err instanceof AdminApiError) {
        if (err.status === 404) {
          setApiUnavailable(true);
        } else if (err.status === 403) {
          setAccessDenied(true);
          setErrorMessage('Access denied. Administrator credentials required to access government schemes.');
        } else if (err.status === 401) {
          setErrorMessage('Your session has expired. Please sign in again.');
        } else {
          setErrorMessage(err.message || 'Unable to load government schemes.');
        }
      } else {
        setErrorMessage(err?.message || 'Unable to communicate with the scheme verification registry.');
      }
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    pageSize,
    searchTerm,
    stateFilter,
    departmentFilter,
    schemeTypeFilter,
    verificationStatusFilter,
    currentStatusFilter,
  ]);

  useEffect(() => {
    fetchSchemes();
  }, [fetchSchemes]);

  const handleRecheck = async (scheme: GovernmentScheme) => {
    setRecheckingId(scheme.id);
    setErrorMessage(null);
    try {
      const res = await recheckScheme(scheme.id);
      setSuccessMessage(res.message || `Recheck initiated for "${scheme.scheme_name || scheme.name}".`);
      await fetchSchemes();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to recheck official scheme portal.');
    } finally {
      setRecheckingId(null);
    }
  };

  const handleSchemeRegistered = (created: GovernmentScheme) => {
    setSuccessMessage(`Registered scheme "${created.scheme_name}". Verification pending.`);
    fetchSchemes();
  };

  const handleSchemeVerified = (verified: GovernmentScheme) => {
    setSuccessMessage(`Officially verified scheme "${verified.scheme_name}".`);
    fetchSchemes();
  };

  const handleSchemeUpdated = (updated: GovernmentScheme) => {
    setSuccessMessage(`Updated status for "${updated.scheme_name}".`);
    fetchSchemes();
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#172018]">Government Scheme Verification</h2>
            <p className="text-xs text-stone-500">
              Verified state and central agricultural schemes for Andhra Pradesh, Telangana, and India.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRegisterModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Scheme</span>
          </button>

          <button
            type="button"
            onClick={fetchSchemes}
            disabled={loading}
            aria-label="Refresh government schemes"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh Schemes'}</span>
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
          title="Government-schemes administration API is not available yet."
          description="In strict compliance with accuracy standards, AgriFusion never fabricates scheme eligibility, unverified deadlines, or unbacked subsidy amounts without a verified backend endpoint."
          note="Required endpoint: GET /api/v1/admin/schemes (official portals, verification timestamps, caveats)"
          action={{
            label: 'Check Endpoint',
            onClick: fetchSchemes,
          }}
        />
      ) : accessDenied ? (
        <AdminEmptyState
          title="Access Denied"
          description="Administrator authorization is required to view and manage government schemes."
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
                placeholder="Search scheme name, department..."
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder:text-stone-400 focus:bg-white focus:border-purple-600 focus:outline-hidden"
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
                  <option value="all">All Jurisdictions</option>
                  <option value="Andhra Pradesh">Andhra Pradesh</option>
                  <option value="Telangana">Telangana</option>
                  <option value="Central">Central (India)</option>
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
                  <option value="verified">Verified</option>
                  <option value="verified_with_caveats">Verified with caveats</option>
                  <option value="pending_review">Pending review</option>
                  <option value="needs_review">Needs review</option>
                  <option value="stale">Stale</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span>Status:</span>
                <select
                  value={currentStatusFilter}
                  onChange={(e) => {
                    setCurrentStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden"
                >
                  <option value="all">All Operational</option>
                  <option value="active">Active</option>
                  <option value="requires_current_verification">Requires Verification</option>
                  <option value="temporarily_unavailable">Temporarily Unavailable</option>
                  <option value="expired_or_closed">Expired or Closed</option>
                  <option value="not_available">Not Available</option>
                </select>
              </div>
            </div>
          </div>

          {/* Records Grid */}
          {loading ? (
            <div className="p-12 text-center text-xs text-stone-500 bg-white border border-stone-200 rounded-2xl flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 text-purple-600 animate-spin" />
              <span>Loading government schemes from FastAPI backend...</span>
            </div>
          ) : errorMessage ? (
            /* When fetch fails with error (network, CORS, 5xx, 401), error alert banner is rendered above. Do not show empty state banner. */
            null
          ) : schemes.length === 0 ? (
            <div className="p-12 text-center text-xs text-stone-500 bg-white border border-stone-200 rounded-2xl space-y-2">
              <Award className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="font-semibold text-stone-700">No government schemes have been registered for verification yet.</p>
              <p className="text-[11px] text-stone-400 max-w-md mx-auto">
                Official agricultural subsidies, crop insurance programs, and direct income schemes registered in the backend will appear here for verification.
              </p>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register First Scheme</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schemes.map((scheme) => {
                const name = scheme.scheme_name || scheme.name || 'Untitled Scheme';
                const statesStr = scheme.state_relevance && scheme.state_relevance.length > 0
                  ? scheme.state_relevance.join(', ')
                  : scheme.state || 'All India';
                const districtsStr = scheme.district_relevance && scheme.district_relevance.length > 0
                  ? scheme.district_relevance.join(', ')
                  : scheme.district_applicability || 'All Districts';

                return (
                  <div
                    key={scheme.id}
                    className="p-5 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-semibold mb-1">
                            {scheme.scheme_type || 'Agricultural Welfare'}
                          </div>
                          <h3 className="text-sm font-bold text-[#172018] leading-snug">
                            {name}
                          </h3>
                          <p className="text-[11px] text-[#8B5E34] font-medium mt-0.5">
                            {scheme.department}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <AdminStatusBadge status={scheme.verification_status || scheme.status || 'pending_review'} />
                          <AdminStatusBadge
                            status={scheme.current_status || 'requires_current_verification'}
                            className="text-[10px]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-200/60">
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">State Jurisdiction:</span>
                          <span className="font-semibold text-stone-800">{statesStr}</span>
                        </div>
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Districts:</span>
                          <span className="font-semibold text-stone-800 truncate block">{districtsStr}</span>
                        </div>
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Verified Date:</span>
                          <span>
                            {scheme.verified_date || scheme.verification_date
                              ? new Date(scheme.verified_date || scheme.verification_date!).toLocaleDateString()
                              : 'Pending Verification'}
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Last Checked:</span>
                          <span>
                            {scheme.last_checked_at
                              ? new Date(scheme.last_checked_at).toLocaleDateString()
                              : 'Not checked yet'}
                          </span>
                        </div>
                      </div>

                      {/* Benefit Summary */}
                      <div className="text-[11px] text-stone-700 bg-stone-50/80 p-2.5 rounded-xl border border-stone-200/60">
                        <span className="font-bold text-stone-900 block text-[10px] uppercase mb-0.5">
                          Verified Benefit:
                        </span>
                        <p className="leading-relaxed">
                          {scheme.benefit_summary || (
                            <span className="text-stone-400 italic">
                              Missing in the verified official source.
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Eligibility Criteria */}
                      <div className="text-[11px] text-stone-700 bg-stone-50/80 p-2.5 rounded-xl border border-stone-200/60">
                        <span className="font-bold text-stone-900 block text-[10px] uppercase mb-0.5">
                          Eligibility Summary:
                        </span>
                        <p className="leading-relaxed">
                          {scheme.eligibility_summary || (
                            <span className="text-amber-800 italic">
                              Possible match — official verification required.
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Deadline & Application Route */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-stone-50 border border-stone-200/50">
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Deadline / Window:</span>
                          <span className="text-stone-700 font-medium">
                            {scheme.deadline || 'Deadline: Not provided in the verified official source.'}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-stone-50 border border-stone-200/50">
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Application Channel:</span>
                          <span className="text-stone-700 font-medium">
                            {scheme.application_route || 'Official department / Village center'}
                          </span>
                        </div>
                      </div>

                      {/* Caveats */}
                      {Array.isArray(scheme.caveats) && scheme.caveats.length > 0 && (
                        <div className="text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200 space-y-1">
                          <div className="font-bold flex items-center gap-1 text-[10px] uppercase">
                            <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>Official Eligibility Caveats:</span>
                          </div>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {scheme.caveats.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Official Portal Link */}
                      {scheme.official_portal && (
                        <div className="flex items-center gap-1.5 text-xs text-[#14532D]">
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          <a
                            href={scheme.official_portal}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold underline truncate hover:text-[#16A34A]"
                          >
                            Official Government Portal ({scheme.official_portal})
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between pt-3 border-t border-stone-100 text-xs gap-2">
                      <button
                        type="button"
                        onClick={() => setUpdateTarget(scheme)}
                        className="px-2.5 py-1 text-[11px] font-medium bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-lg text-stone-700 cursor-pointer transition-colors"
                      >
                        Update Status
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRecheck(scheme)}
                          disabled={recheckingId === scheme.id}
                          className="px-2.5 py-1 text-[11px] font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg border border-stone-200 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${recheckingId === scheme.id ? 'animate-spin' : ''}`} />
                          <span>{recheckingId === scheme.id ? 'Checking...' : 'Re-check'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setVerifyTarget(scheme)}
                          className="px-3 py-1 text-[11px] font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Verify Scheme</span>
                        </button>
                      </div>
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
      <RegisterSchemeModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={handleSchemeRegistered}
      />

      {/* Verification Modal */}
      <VerifySchemeModal
        isOpen={Boolean(verifyTarget)}
        scheme={verifyTarget}
        onClose={() => setVerifyTarget(null)}
        onSuccess={handleSchemeVerified}
      />

      {/* Status Update Modal */}
      <UpdateSchemeModal
        isOpen={Boolean(updateTarget)}
        scheme={updateTarget}
        onClose={() => setUpdateTarget(null)}
        onSuccess={handleSchemeUpdated}
      />
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  Filter,
  HelpCircle,
  Info,
  MessageSquare,
  MessageSquareQuote,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Star,
  Tag,
  UserX,
  X,
} from 'lucide-react';
import { addFeedbackNote, AdminApiError, getAdminFeedback, updateFeedbackStatus } from '../../lib/adminApi';
import { formatFeedbackCropLabel, formatFeedbackModuleLabel, hasFeedbackContext } from '../../lib/feedbackApi';
import type { AdminFeedback } from '../../types';
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
  | 'network_error'
  | 'server_error'
  | 'malformed_error'
  | 'generic_error';

export const AdminFeedbackSection: React.FC = () => {
  const [feedbackList, setFeedbackList] = useState<AdminFeedback[]>([]);
  const [totalFeedback, setTotalFeedback] = useState<number>(0);
  const [ratingDistribution, setRatingDistribution] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseState, setResponseState] = useState<ResponseState>('loading');
  const [authError, setAuthError] = useState<{ code: number; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // View Context Modal State
  const [selectedContextFeedback, setSelectedContextFeedback] = useState<AdminFeedback | null>(null);

  // Internal Note Modal State
  const [activeFeedbackForNote, setActiveFeedbackForNote] = useState<AdminFeedback | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const fetchFeedback = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setAuthError(null);

    try {
      const res = await getAdminFeedback({
        page: currentPage,
        page_size: pageSize,
        search: searchTerm,
        status: statusFilter,
        module: moduleFilter,
        rating: ratingFilter,
      });

      setFeedbackList(res.items || []);
      setTotalFeedback(typeof res.total === 'number' ? res.total : (res.items ? res.items.length : 0));
      setRatingDistribution(res.rating_distribution || null);
      setResponseState('success');
    } catch (err: unknown) {
      setFeedbackList([]);
      setTotalFeedback(0);

      if (err instanceof AdminApiError) {
        if (err.status === 401) {
          setResponseState('401');
          setAuthError({ code: 401, message: err.message || 'Session expired.' });
        } else if (err.status === 403) {
          setResponseState('403');
          setAuthError({ code: 403, message: err.message || 'Access denied.' });
        } else if (err.status === 404 || err.message?.includes('not available yet')) {
          setResponseState('404');
        } else if (err.status === 0 || err.message?.includes('Network/CORS') || err.message?.includes('Failed to connect')) {
          setResponseState('network_error');
          setErrorMessage(err.message || 'Failed to connect to backend server due to network/CORS error.');
        } else if (err.message?.includes('Unexpected API response')) {
          setResponseState('malformed_error');
          setErrorMessage('Unexpected API response structure: Missing items array in feedback response.');
        } else if (err.status >= 500) {
          setResponseState('server_error');
          setErrorMessage(err.message || 'The backend server encountered an internal error.');
        } else {
          setResponseState('generic_error');
          setErrorMessage(err.message || 'Failed to load farmer feedback logs.');
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
    fetchFeedback();
  }, [currentPage, statusFilter, moduleFilter, ratingFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchFeedback();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setModuleFilter('all');
    setRatingFilter('all');
    setCurrentPage(1);
  };

  const handleStatusChange = async (id: string, newStatus: 'new' | 'under_review' | 'resolved') => {
    try {
      await updateFeedbackStatus(id, newStatus);
      setSuccessMessage(`Feedback ${id} marked as "${newStatus}"`);
      await fetchFeedback();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update feedback status.';
      setErrorMessage(msg);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFeedbackForNote || !noteContent.trim()) return;

    setNoteSubmitting(true);
    try {
      await addFeedbackNote(activeFeedbackForNote.id, noteContent.trim());
      setSuccessMessage('Agronomic review note recorded successfully.');
      setActiveFeedbackForNote(null);
      setNoteContent('');
      await fetchFeedback();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit internal note.';
      setErrorMessage(msg);
    } finally {
      setNoteSubmitting(false);
    }
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() || statusFilter !== 'all' || moduleFilter !== 'all' || ratingFilter !== 'all'
  );
  const totalPages = Math.ceil(totalFeedback / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
            <MessageSquareQuote className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#172018]">Farmer Feedback & Validation</h2>
              {responseState === 'success' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Total: {totalFeedback}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Agronomic reviews, rating distributions, and supervised review notes.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchFeedback}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-800' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh Feedback'}</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Rating Distribution Summary if returned */}
      {ratingDistribution && (
        <div className="p-4 bg-white border border-stone-200 rounded-2xl flex flex-wrap items-center gap-4 text-xs">
          <span className="font-bold text-stone-700 text-xs uppercase tracking-wider">
            Backend Rating Distribution:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {[5, 4, 3, 2, 1].map((r) => (
              <span key={r} className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 font-medium">
                {r} ★: <strong className="text-[#14532D]">{ratingDistribution[String(r)] ?? 0}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 401 Session Expired Banner */}
      {responseState === '401' && authError && (
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

      {/* 403 Forbidden Banner */}
      {responseState === '403' && authError && (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Shield className="w-5 h-5 text-rose-700 shrink-0" />
            <span>Access Denied (403)</span>
          </div>
          <p className="text-xs text-rose-800">{authError.message}</p>
        </div>
      )}

      {/* Network or CORS Error Banner */}
      {responseState === 'network_error' && (
        <div className="p-5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Network or CORS Connection Error</span>
            </div>
            <button
              type="button"
              onClick={fetchFeedback}
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
              <span>Server or Database Error</span>
            </div>
            <button
              type="button"
              onClick={fetchFeedback}
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
              onClick={fetchFeedback}
              className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            The backend returned an unexpected response structure. Expected feedback response schema: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">&#123; "items": [...], "total": 100 &#125;</code>
          </p>
        </div>
      )}

      {/* API Unavailable State */}
      {responseState === '404' ? (
        <AdminEmptyState
          title="Feedback-review API is not available yet."
          description="The feedback governance queue will populate when GET /api/v1/admin/feedback is enabled on the backend."
          note="Required routes: GET /api/v1/admin/feedback, PATCH /api/v1/admin/feedback/{id}, POST /api/v1/admin/feedback/{id}/note"
          action={{
            label: 'Check Endpoint',
            onClick: fetchFeedback,
          }}
        />
      ) : (responseState === 'success' || responseState === 'loading') && (
        <>
          {/* Controls */}
          <div className="space-y-3">
            <form onSubmit={handleSearchSubmit} className="p-4 bg-white border border-stone-200 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs text-xs text-stone-600">
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search comment, module, ID..."
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder:text-stone-400 focus:outline-hidden"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-stone-400" />
                  <span>Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden"
                  >
                    <option value="all">All Statuses</option>
                    <option value="new">New</option>
                    <option value="under_review">Under Review</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span>Module:</span>
                  <select
                    value={moduleFilter}
                    onChange={(e) => {
                      setModuleFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden"
                  >
                    <option value="all">All Modules</option>
                    <option value="crop">Crop Recommendation</option>
                    <option value="irrigation">Irrigation</option>
                    <option value="yield">Yield Prediction</option>
                    <option value="market">Market Prediction</option>
                    <option value="rag">RAG Advisor</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span>Rating:</span>
                  <select
                    value={ratingFilter}
                    onChange={(e) => {
                      setRatingFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden"
                  >
                    <option value="all">All Ratings</option>
                    <option value="1">1 Star</option>
                    <option value="2">2 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="5">5 Stars</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#14532D] text-white font-semibold text-xs rounded-xl hover:bg-[#16A34A] transition-colors cursor-pointer"
                >
                  Search
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
                  {statusFilter !== 'all' && (
                    <span className="px-2 py-0.5 bg-white border border-stone-300 rounded-md font-medium text-stone-800 text-[11px]">
                      Status: {statusFilter}
                    </span>
                  )}
                  {moduleFilter !== 'all' && (
                    <span className="px-2 py-0.5 bg-white border border-stone-300 rounded-md font-medium text-stone-800 text-[11px]">
                      Module: {moduleFilter}
                    </span>
                  )}
                  {ratingFilter !== 'all' && (
                    <span className="px-2 py-0.5 bg-white border border-stone-300 rounded-md font-medium text-stone-800 text-[11px]">
                      Rating: {ratingFilter} ★
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

          {/* Feedback Cards Grid */}
          {loading ? (
            <div className="p-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2 bg-white border border-stone-200 rounded-2xl">
              <RefreshCw className="w-4 h-4 animate-spin text-[#14532D]" />
              <span>Loading feedback queue...</span>
            </div>
          ) : responseState === 'success' && feedbackList.length === 0 ? (
            <div className="p-12 text-center text-xs text-stone-500 bg-white border border-stone-200 rounded-2xl space-y-3">
              <p className="font-semibold text-stone-700 text-sm">No feedback records match</p>
              <p className="text-stone-500">
                {hasActiveFilters
                  ? 'No farmer feedback items match your selected filter options.'
                  : 'No farmer feedback entries exist in the review queue.'}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {feedbackList.map((fb, idx) => {
                const commentText = fb.message || fb.user_comment || fb.comment || 'No message provided';
                const dateStr = fb.created_at || fb.submitted_at || fb.date;
                const ratingNum = typeof fb.rating === 'number' ? fb.rating : 5;
                const categoryText = fb.category || 'General';
                const moduleLabel = formatFeedbackModuleLabel(fb.module);
                const cropLabel = formatFeedbackCropLabel(fb.crop);
                const hasCtx = hasFeedbackContext(fb);

                return (
                  <div key={fb.id || `fb_${idx}`} className="p-4 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-2.5 flex flex-col justify-between hover:border-stone-300 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-stone-900">{fb.id}</span>
                            {fb.feedback_type && (
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                fb.feedback_type === 'helpful'
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                  : fb.feedback_type === 'problem_report'
                                  ? 'bg-rose-50 text-rose-900 border-rose-300'
                                  : 'bg-amber-50 text-amber-900 border-amber-300'
                              }`}>
                                {fb.feedback_type === 'helpful' ? 'Helpful' : fb.feedback_type === 'problem_report' ? 'Problem Report' : 'Not Helpful'}
                              </span>
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                              {categoryText}
                            </span>
                          </div>
                          <div className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-1 flex-wrap">
                            <span>{dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A'}</span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-0.5 text-stone-500 font-medium">
                              <UserX className="w-3 h-3 text-stone-400" />
                              <span>Anonymous Farmer</span>
                            </span>
                            {(fb.district || fb.state) && (
                              <>
                                <span>•</span>
                                <span className="text-stone-500 font-medium">
                                  {[fb.district, fb.state].filter(Boolean).join(', ')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <AdminStatusBadge status={fb.status || 'new'} />
                      </div>

                      {/* Module & Crop Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-semibold border border-stone-200">
                          <Tag className="w-3 h-3 text-stone-500" />
                          <span>Module: {moduleLabel}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-semibold border border-stone-200">
                          <FileText className="w-3 h-3 text-stone-500" />
                          <span>Crop: {cropLabel}</span>
                        </span>
                        {hasCtx ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-medium border border-emerald-200 text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Linked Context</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-50 text-stone-400 font-medium border border-stone-200 text-[10px]">
                            <span>No Linked Source</span>
                          </span>
                        )}
                      </div>

                      {/* Rating Stars */}
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= ratingNum ? 'text-amber-400 fill-amber-400' : 'text-stone-300'
                            }`}
                          />
                        ))}
                        <span className="text-xs font-semibold text-stone-700 ml-1">{ratingNum}/5</span>
                      </div>

                      {/* Compact User Message Snippet */}
                      <div className="p-2.5 bg-stone-50 rounded-xl text-xs text-stone-700 italic border border-stone-200/60 leading-relaxed line-clamp-2">
                        &quot;{commentText}&quot;
                      </div>

                      {/* Internal Review Notes */}
                      {fb.internal_notes && fb.internal_notes.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                            Notes ({fb.internal_notes.length}):
                          </span>
                          <div className="text-[11px] text-[#14532D] bg-emerald-50/60 p-2 rounded-lg border border-emerald-100 font-medium truncate">
                            {typeof fb.internal_notes[0] === 'string' ? fb.internal_notes[0] : (fb.internal_notes[0] as any).note}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Compact Action Controls */}
                    <div className="flex items-center justify-between pt-2 border-t border-stone-100 gap-1.5 flex-wrap">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedContextFeedback(fb)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg border border-stone-200 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#14532D]" />
                          <span>View context</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveFeedbackForNote(fb)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#14532D] hover:text-[#16A34A] transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Note</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {fb.status !== 'resolved' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(fb.id, 'resolved')}
                            className="px-2 py-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Mark Resolved
                          </button>
                        )}
                        {fb.status === 'new' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(fb.id, 'under_review')}
                            className="px-2 py-1 text-[10px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Mark Review
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {responseState === 'success' && feedbackList.length > 0 && (
            <div className="p-4 bg-white border border-stone-200 rounded-2xl">
              <AdminPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalFeedback}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      {/* View Context Modal Panel */}
      {selectedContextFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in max-h-[90vh] overflow-y-auto space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-[#14532D] flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-stone-900 font-mono">
                      Feedback Context #{selectedContextFeedback.id}
                    </h3>
                    <AdminStatusBadge status={selectedContextFeedback.status || 'new'} />
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Detailed record context for agronomic quality audit
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedContextFeedback(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Module & Crop Metadata Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/80 text-xs">
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                  Application Module:
                </span>
                <span className="font-bold text-stone-900 text-sm">
                  {formatFeedbackModuleLabel(selectedContextFeedback.module)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                  Crop / Variety:
                </span>
                <span className="font-bold text-stone-900 text-sm">
                  {formatFeedbackCropLabel(selectedContextFeedback.crop)}
                </span>
              </div>
            </div>

            {/* Linked AI Advisory / Model Context OR Context Unavailable */}
            {hasFeedbackContext(selectedContextFeedback) ? (
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2 border-b border-emerald-200/60 pb-2">
                  <span className="font-bold text-[#14532D] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Linked AI Advisory Source Context</span>
                  </span>
                  <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-emerald-300 font-semibold text-stone-700">
                    ID: {selectedContextFeedback.advisory_id || selectedContextFeedback.prediction_id || selectedContextFeedback.context?.advisory_id || selectedContextFeedback.context?.prediction_id}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                    Original Question / Query Summary:
                  </span>
                  <p className="p-3 bg-white rounded-xl border border-emerald-200/80 text-stone-900 font-medium text-xs leading-relaxed">
                    {selectedContextFeedback.query_summary || selectedContextFeedback.context?.query_summary || (selectedContextFeedback.advisory_id ? `Advisory Query [Advisory ID: ${selectedContextFeedback.advisory_id}]` : 'Query recorded')}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                    AI Answer / Result Shown to Farmer:
                  </span>
                  <p className="p-3 bg-white rounded-xl border border-emerald-200/80 text-stone-800 text-xs leading-relaxed">
                    {selectedContextFeedback.ai_answer || selectedContextFeedback.context?.ai_answer || 'AI Advisory generated result recorded for this session.'}
                  </p>
                </div>
              </div>
            ) : (
              /* Requirement 6: Clear "Context unavailable" banner when record has no linked source */
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-xs text-amber-900">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-xs uppercase tracking-wider">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Context unavailable</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Original advisory context unavailable for this record. No linked query or AI model output was recorded.
                </p>
              </div>
            )}

            {/* Farmer Feedback Reported Details */}
            <div className="p-4 bg-white border border-stone-200 rounded-2xl space-y-3 text-xs">
              <span className="font-bold text-stone-800 uppercase tracking-wider text-[11px] block border-b border-stone-100 pb-2">
                Farmer Reported Feedback Details:
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Category:</span>
                  <span className="font-semibold text-stone-800">{selectedContextFeedback.category || 'General'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Rating:</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= (selectedContextFeedback.rating || 5)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-stone-300'
                        }`}
                      />
                    ))}
                    <span className="font-bold text-stone-800 ml-1">{selectedContextFeedback.rating}/5</span>
                  </div>
                </div>
              </div>

              {/* Separate Helpful / Wrong Text fields if recorded */}
              {selectedContextFeedback.helpful_comment && (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    What was helpful / correct:
                  </span>
                  <p className="text-xs text-stone-800 font-medium">
                    {selectedContextFeedback.helpful_comment}
                  </p>
                </div>
              )}

              {selectedContextFeedback.unhelpful_comment && (
                <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                    What was wrong / missing:
                  </span>
                  <p className="text-xs text-stone-800 font-medium">
                    {selectedContextFeedback.unhelpful_comment}
                  </p>
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Full Comment Message:</span>
                <p className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-800 italic leading-relaxed">
                  &quot;{selectedContextFeedback.message || selectedContextFeedback.comment || selectedContextFeedback.user_comment || 'No comment text provided.'}&quot;
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-stone-500 pt-2 border-t border-stone-100">
                <span>Response Language: <strong>{selectedContextFeedback.language || 'English'}</strong></span>
                <span className="inline-flex items-center gap-1 font-semibold text-stone-600">
                  <UserX className="w-3.5 h-3.5 text-stone-400" />
                  <span>User Identity: Anonymous Farmer (Redacted)</span>
                </span>
              </div>
            </div>

            {/* Existing Agronomist Review Notes */}
            {selectedContextFeedback.internal_notes && selectedContextFeedback.internal_notes.length > 0 && (
              <div className="space-y-2 p-4 bg-stone-50 border border-stone-200 rounded-2xl text-xs">
                <span className="font-bold text-stone-800 uppercase tracking-wider text-[11px] block">
                  Agronomist Internal Review Notes:
                </span>
                {selectedContextFeedback.internal_notes.map((item: any, nIdx: number) => (
                  <div key={nIdx} className="p-3 bg-white rounded-xl border border-stone-200 text-stone-800">
                    <p className="font-medium text-xs">{typeof item === 'string' ? item : item.note}</p>
                    {typeof item !== 'string' && item?.admin && (
                      <span className="text-[10px] text-stone-400 block mt-1">
                        Recorded by {item.admin} {item.date ? `• ${new Date(item.date).toLocaleString()}` : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setActiveFeedbackForNote(selectedContextFeedback);
                }}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#14532D] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Review Note</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedContextFeedback(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#14532D] hover:bg-[#16A34A] text-white transition-colors cursor-pointer shadow-xs"
              >
                Close Context
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal Dialog */}
      {activeFeedbackForNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 animate-in fade-in">
            <h3 className="text-sm font-bold text-[#172018]">Add Agronomist Review Note</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Attaching internal observation to feedback {activeFeedbackForNote.id}
            </p>

            <form onSubmit={handleAddNote} className="mt-4 space-y-4">
              <textarea
                rows={4}
                required
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Enter expert agronomic assessment or correction note..."
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#14532D]/30"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveFeedbackForNote(null);
                    setNoteContent('');
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={noteSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {noteSubmitting ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

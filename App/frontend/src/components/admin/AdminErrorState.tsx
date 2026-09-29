import React from 'react';
import { AlertCircle, RefreshCw, ShieldAlert } from 'lucide-react';

interface AdminErrorStateProps {
  error: Error | string;
  statusCode?: number;
  onRetry?: () => void;
  onSignOut?: () => void;
}

export const AdminErrorState: React.FC<AdminErrorStateProps> = ({
  error,
  statusCode,
  onRetry,
  onSignOut,
}) => {
  const message = typeof error === 'string' ? error : error.message;

  let title = 'An error occurred';
  let badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
  let isConfigurationIssue = false;

  if (statusCode === 404 || message.toLowerCase().includes('not available yet') || message.toLowerCase().includes('not configured')) {
    title = 'Backend Endpoint Not Configured';
    badgeColor = 'bg-amber-50 text-amber-900 border-amber-200';
    isConfigurationIssue = true;
  } else if (statusCode === 403 || message.toLowerCase().includes('permission') || message.toLowerCase().includes('denied')) {
    title = 'Administrator Permission Required';
    badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
  } else if (statusCode === 401 || message.toLowerCase().includes('expired') || message.toLowerCase().includes('session')) {
    title = 'Session Expired';
    badgeColor = 'bg-stone-100 text-stone-800 border-stone-300';
  } else if (statusCode === 429) {
    title = 'Rate Limit Exceeded';
    badgeColor = 'bg-amber-50 text-amber-900 border-amber-200';
  } else if (statusCode === 503) {
    title = 'Service Unavailable';
    badgeColor = 'bg-sky-50 text-sky-800 border-sky-200';
  } else if (statusCode && statusCode >= 500) {
    title = 'Backend Service Error';
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 max-w-xl mx-auto my-6 text-center shadow-xs">
      <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
        {statusCode === 403 ? <ShieldAlert className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
      </div>

      <div className="inline-block mb-2">
        <span className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
          {statusCode ? `HTTP ${statusCode}` : 'Error State'}
        </span>
      </div>

      <h3 className="text-base font-semibold text-[#172018]">{title}</h3>
      <p className="text-xs sm:text-sm text-stone-600 mt-2 leading-relaxed">
        {message}
      </p>

      {isConfigurationIssue && (
        <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-left text-xs text-amber-900">
          <p className="font-semibold mb-1">Backend Configuration Required:</p>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            The frontend is ready and configured. The FastAPI backend needs to deploy this route with Supabase Bearer token verification.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check again</span>
          </button>
        )}
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <span>Sign out</span>
          </button>
        )}
      </div>
    </div>
  );
};

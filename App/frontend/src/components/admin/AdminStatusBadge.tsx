import React from 'react';

interface AdminStatusBadgeProps {
  status: string;
  className?: string;
  label?: string;
}

export const AdminStatusBadge: React.FC<AdminStatusBadgeProps> = ({ status, className = '', label }) => {
  const norm = (status || '').toLowerCase().trim().replace(/-/g, '_');

  let colorClasses = 'bg-stone-100 text-stone-700 border-stone-300';

  if (
    norm === 'active' ||
    norm === 'verified' ||
    norm === 'indexed' ||
    norm === 'operational' ||
    norm === 'ok' ||
    norm === 'resolved' ||
    norm === 'reviewed' ||
    norm === 'success' ||
    norm === 'complete'
  ) {
    colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  } else if (
    norm === 'under_review' ||
    norm === 'pending_review' ||
    norm === 'needs_verification' ||
    norm === 'verified_with_caveats' ||
    norm === 'requires_current_verification' ||
    norm === 'queued' ||
    norm === 'degraded' ||
    norm === 'partial'
  ) {
    colorClasses = 'bg-amber-50 text-amber-900 border-amber-300';
  } else if (
    norm === 'needs_review' ||
    norm === 'outdated'
  ) {
    colorClasses = 'bg-orange-50 text-orange-900 border-orange-300';
  } else if (
    norm === 'not_reviewed' ||
    norm === 'indexing' ||
    norm === 'new' ||
    norm === 'medium'
  ) {
    colorClasses = 'bg-sky-50 text-sky-800 border-sky-300';
  } else if (
    norm === 'no_verified_source' ||
    norm === 'suspended' ||
    norm === 'expired_or_closed' ||
    norm === 'expired_or_unavailable' ||
    norm === 'unavailable' ||
    norm === 'temporarily_unavailable' ||
    norm === 'rejected' ||
    norm === 'index_failed' ||
    norm === 'stale' ||
    norm === 'missing_official_source' ||
    norm === 'failed' ||
    norm === 'urgent'
  ) {
    colorClasses = 'bg-rose-50 text-rose-800 border-rose-300';
  } else if (norm === 'not_indexed' || norm === 'not_available' || norm === 'archived' || norm === 'low') {
    colorClasses = 'bg-stone-100 text-stone-600 border-stone-300';
  }

  const formatLabel = (str: string) => {
    if (label) return label;
    return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70" />
      {formatLabel(status)}
    </span>
  );
};


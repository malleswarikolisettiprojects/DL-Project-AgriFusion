import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface AdminMetricCardProps {
  id?: string;
  title: string;
  value?: string | number | null;
  statusLabel?: string;
  statusType?: 'success' | 'warning' | 'error' | 'neutral';
  icon: LucideIcon;
  hint?: string;
}

export const AdminMetricCard: React.FC<AdminMetricCardProps> = ({
  id,
  title,
  value,
  statusLabel,
  statusType = 'neutral',
  icon: Icon,
  hint,
}) => {
  const isAvailable = value !== undefined && value !== null;

  const statusColors = {
    success: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    warning: 'text-amber-800 bg-amber-50 border-amber-200',
    error: 'text-rose-700 bg-rose-50 border-rose-200',
    neutral: 'text-stone-600 bg-stone-100 border-stone-200',
  };

  return (
    <div
      id={id}
      className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#FAF8F1] border border-[#14532D]/15 flex items-center justify-center text-[#14532D]">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">{title}</h3>
            {hint && <p className="text-[11px] text-stone-400 mt-0.5">{hint}</p>}
          </div>
        </div>

        {statusLabel && (
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusColors[statusType]}`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-stone-100">
        {isAvailable ? (
          <div className="text-2xl font-bold text-[#172018] tracking-tight">{value}</div>
        ) : (
          <div className="text-xs font-medium text-stone-500 bg-stone-50 py-1.5 px-2.5 rounded-lg border border-dashed border-stone-200">
            Not available from the current API.
          </div>
        )}
      </div>
    </div>
  );
};

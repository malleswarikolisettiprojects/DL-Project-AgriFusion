import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Database } from 'lucide-react';

interface AdminEmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
  note?: string;
}

export const AdminEmptyState: React.FC<AdminEmptyStateProps> = ({
  title,
  description,
  icon: Icon = Database,
  action,
  note,
}) => {
  return (
    <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto my-6">
      <div className="w-12 h-12 rounded-2xl bg-[#FAF8F1] border border-stone-200 text-[#8B5E34] flex items-center justify-center mx-auto mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-[#172018]">{title}</h3>
      <p className="text-xs sm:text-sm text-stone-500 mt-2 leading-relaxed">{description}</p>

      {note && (
        <p className="mt-3 text-[11px] font-mono bg-stone-50 text-stone-600 px-3 py-1.5 rounded-lg border border-stone-200 inline-block">
          {note}
        </p>
      )}

      {action && (
        <div className="mt-6">
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] transition-colors cursor-pointer shadow-xs"
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
};

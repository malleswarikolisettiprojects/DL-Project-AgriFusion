import React from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface FeedbackSuccessProps {
  message?: string;
  onClose?: () => void;
  compact?: boolean;
}

export const FeedbackSuccess: React.FC<FeedbackSuccessProps> = ({
  message = 'Thank you for helping us improve AgriFusion.',
  onClose,
  compact = false,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border border-emerald-300 bg-emerald-50/95 text-emerald-950 p-4 transition-all duration-200 ${
        compact ? 'py-3' : 'py-4'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-emerald-950">
              {message}
            </p>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              Your feedback helps extension scientists and agronomy teams refine regional guidance.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close message"
            className="p-1 rounded-lg text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

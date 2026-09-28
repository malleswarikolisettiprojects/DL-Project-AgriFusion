import React, { useEffect, useRef, useState } from 'react';
import { MessageSquareQuote, X } from 'lucide-react';
import { FeedbackForm } from './FeedbackForm';
import { FeedbackSuccess } from './FeedbackSuccess';
import type { FeedbackCategory } from '../lib/feedbackApi';

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  advisoryId?: string | null;
  predictionId?: string | null;
  crop?: string;
  district?: string;
  querySummary?: string | null;
  aiAnswer?: string | null;
  defaultRating?: number | null;
  defaultCategory?: FeedbackCategory;
  feedbackType?: 'helpful' | 'not_helpful' | 'problem_report';
  initialLanguage?: string;
  moduleTitle?: string;
  moduleRaw?: string;
  triggerElementRef?: React.RefObject<HTMLElement | null>;
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  isOpen,
  onClose,
  advisoryId = null,
  predictionId = null,
  crop,
  district,
  querySummary = null,
  aiAnswer = null,
  defaultRating = 1,
  defaultCategory = 'incorrect_answer',
  feedbackType = 'not_helpful',
  initialLanguage = 'English',
  moduleTitle,
  moduleRaw,
  triggerElementRef,
}) => {
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false);
      // Accessible focus management
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);

      // Disable body scroll when modal open
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Keyboard listener for Escape key
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsSuccess(false);
    onClose();
    // Return focus to trigger button
    setTimeout(() => {
      triggerElementRef?.current?.focus();
    }, 50);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      aria-labelledby="feedback-dialog-title"
      aria-describedby="feedback-dialog-description"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      {/* Dialog Container */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg bg-[#FAF8F1] border border-stone-200 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 z-10 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 mb-4 border-b border-stone-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-[#14532D] shrink-0">
              <MessageSquareQuote className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="feedback-dialog-title"
                className="text-base sm:text-lg font-bold text-stone-900 leading-tight"
              >
                Tell us about your experience
              </h2>
              <p
                id="feedback-dialog-description"
                className="text-xs text-stone-600 mt-0.5"
              >
                {moduleTitle
                  ? `Feedback for ${moduleTitle}. Your input directly refines regional guidance.`
                  : 'Your feedback helps us improve the quality and clarity of agricultural guidance.'}
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {isSuccess ? (
          <div className="py-4 space-y-4 text-center">
            <FeedbackSuccess
              message="Thank you for helping us improve AgriFusion."
              onClose={handleClose}
            />
            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 rounded-xl text-xs font-bold bg-[#14532D] hover:bg-[#16A34A] text-white transition-colors cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <FeedbackForm
            advisoryId={advisoryId}
            predictionId={predictionId}
            module={moduleRaw || moduleTitle}
            crop={crop}
            district={district}
            querySummary={querySummary}
            aiAnswer={aiAnswer}
            defaultRating={defaultRating}
            defaultCategory={defaultCategory}
            feedbackType={feedbackType}
            initialLanguage={initialLanguage}
            onSuccess={() => setIsSuccess(true)}
            onCancel={handleClose}
          />
        )}
      </div>
    </div>
  );
};

import React, { useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { FeedbackDialog } from './FeedbackDialog';
import {
  hasSubmittedFeedback,
  markFeedbackSubmitted,
  submitFeedback,
  type FeedbackCategory,
} from '../lib/feedbackApi';

export type FeedbackModuleType =
  | 'crop'
  | 'climate'
  | 'irrigation'
  | 'yield'
  | 'market'
  | 'disease'
  | 'rag'
  | 'schemes';

export interface FeedbackPromptProps {
  advisoryId?: string | null;
  module: FeedbackModuleType;
  language?: string;
  compact?: boolean;
  className?: string;
  crop?: string;
  district?: string;
  resultSummary?: string;
}

const MODULE_NAMES: Record<FeedbackModuleType, string> = {
  crop: 'Crop Recommendation',
  climate: 'Climate Risk Advisory',
  irrigation: 'Smart Irrigation Planner',
  yield: 'Yield Forecast',
  market: 'Market & Price Forecast',
  disease: 'Disease Detection & Diagnosis',
  rag: 'CropWise Agronomist AI',
  schemes: 'Government Schemes',
};

export const FeedbackPrompt: React.FC<FeedbackPromptProps> = ({
  advisoryId = null,
  module,
  language = 'English',
  compact = false,
  className = '',
  crop,
  district,
  resultSummary,
}) => {
  const [isSubmittingYes, setIsSubmittingYes] = useState<boolean>(false);
  const [isPositiveSuccess, setIsPositiveSuccess] = useState<boolean>(false);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [dialogFeedbackType, setDialogFeedbackType] = useState<'not_helpful' | 'problem_report'>('not_helpful');
  const [dialogCategory, setDialogCategory] = useState<FeedbackCategory>('incorrect_answer');
  const [dialogRating, setDialogRating] = useState<number>(1);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const promptButtonRef = useRef<HTMLButtonElement | null>(null);

  const alreadySubmitted = hasSubmittedFeedback(advisoryId) || isPositiveSuccess;

  const handlePositiveFeedback = async () => {
    if (alreadySubmitted || isSubmittingYes) return;
    setInlineError(null);
    setIsSubmittingYes(true);

    try {
      const defaultMsg = crop && district
        ? `Farmer indicated advice was helpful for ${crop} in ${district}.`
        : 'Farmer indicated advice was helpful and accurate.';

      await submitFeedback({
        feedback_type: 'helpful',
        advisory_id: advisoryId,
        module,
        crop: crop || null,
        district: district || null,
        rating: 5,
        category: 'other',
        helpful_comment: defaultMsg,
        message: defaultMsg,
        comment: defaultMsg,
        query_summary: resultSummary || null,
        language,
      });
      setIsPositiveSuccess(true);
      if (advisoryId) {
        markFeedbackSubmitted(advisoryId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'We could not submit your feedback. Please try again.';
      setInlineError(msg);
    } finally {
      setIsSubmittingYes(false);
    }
  };

  const handleNegativeFeedback = () => {
    setDialogFeedbackType('not_helpful');
    setDialogCategory('incorrect_answer');
    setDialogRating(1);
    setIsDialogOpen(true);
  };

  const handleReportProblem = () => {
    setDialogFeedbackType('problem_report');
    setDialogCategory('missing_information');
    setDialogRating(2);
    setIsDialogOpen(true);
  };

  return (
    <>
      <section
        aria-label="Advisory feedback"
        className={`rounded-2xl border border-stone-200 bg-[#FAF8F1] transition-all duration-200 ${
          compact ? 'p-3' : 'p-4 sm:p-5'
        } ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Question and Explanatory Label */}
          <div className="space-y-0.5 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-stone-900">
                Was this advice helpful?
              </h3>
              <span className="text-[11px] text-stone-500 hidden md:inline">
                (ఈ సలహా ఉపయోగకరంగా ఉందా?)
              </span>
            </div>
            <p className="text-[11px] text-stone-600">
              Your feedback helps improve agricultural guidance for Andhra Pradesh & Telangana.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            {alreadySubmitted ? (
              <div
                role="status"
                aria-live="polite"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-900 bg-emerald-100/80 border border-emerald-300"
              >
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>Feedback recorded. Thank you!</span>
              </div>
            ) : (
              <>
                {/* Yes Button */}
                <button
                  ref={promptButtonRef}
                  type="button"
                  onClick={handlePositiveFeedback}
                  disabled={isSubmittingYes}
                  aria-label="Yes, helpful"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-stone-800 border border-stone-300 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-[#14532D] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingYes ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                  ) : (
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-700" />
                  )}
                  <span>Yes, helpful</span>
                </button>

                {/* Not Helpful Button */}
                <button
                  type="button"
                  onClick={handleNegativeFeedback}
                  aria-label="Not helpful"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-stone-800 border border-stone-300 hover:bg-stone-100 hover:text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-[#14532D] transition-colors cursor-pointer"
                >
                  <ThumbsDown className="w-3.5 h-3.5 text-stone-600" />
                  <span>Not helpful</span>
                </button>

                {/* Report a Problem Button */}
                <button
                  type="button"
                  onClick={handleReportProblem}
                  aria-label="Report a problem with this recommendation"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 focus:outline-hidden focus:ring-2 focus:ring-[#14532D] transition-colors cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Report a problem</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Positive Success Acknowledgment */}
        {isPositiveSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 pt-3 border-t border-stone-200/80 flex items-center gap-2 text-xs font-semibold text-emerald-900"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Thank you. Your feedback helps us improve AgriFusion.</span>
          </div>
        )}

        {/* Inline Error Message */}
        {inlineError && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-3 pt-3 border-t border-amber-200 text-xs text-amber-900 flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{inlineError}</span>
          </div>
        )}
      </section>

      {/* Detail Feedback Dialog */}
      <FeedbackDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        advisoryId={advisoryId}
        crop={crop}
        district={district}
        querySummary={resultSummary}
        defaultRating={dialogRating}
        defaultCategory={dialogCategory}
        feedbackType={dialogFeedbackType}
        initialLanguage={language}
        moduleTitle={MODULE_NAMES[module] || module}
        moduleRaw={module}
        triggerElementRef={promptButtonRef}
      />
    </>
  );
};

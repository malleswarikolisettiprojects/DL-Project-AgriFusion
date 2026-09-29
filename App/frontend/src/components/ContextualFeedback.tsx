import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { submitFarmerFeedback } from '../lib/adminApi';

export interface ContextualFeedbackProps {
  module: string;
  crop?: string;
  district?: string;
  advisoryId?: string | null;
  predictionId?: string | null;
  querySummary?: string | null;
  aiAnswer?: string | null;
  resultSummary?: string;
  className?: string;
}

export const FEEDBACK_CATEGORIES = [
  'Incorrect answer',
  'Missing information',
  'Outdated source',
  'Wrong language',
  'Technical error',
  'Incorrect Recommendation',
  'Missing Crop or Variety',
  'Market / Price Discrepancy',
  'Dosage or Spray Query',
  'Telugu Language Correction',
  'Government Scheme Clarification',
  'Other',
];

export const ContextualFeedback: React.FC<ContextualFeedbackProps> = ({
  module,
  crop = 'General Crop',
  district = 'Andhra Pradesh / Telangana',
  advisoryId = null,
  predictionId = null,
  querySummary = null,
  aiAnswer = null,
  resultSummary,
  className = '',
}) => {
  const [usefulness, setUsefulness] = useState<'yes' | 'no' | null>(null);
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Incorrect answer');
  const [helpfulComment, setHelpfulComment] = useState('');
  const [unhelpfulComment, setUnhelpfulComment] = useState('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [acknowledgedYes, setAcknowledgedYes] = useState(false);

  const handlePositiveFeedback = async () => {
    setUsefulness('yes');
    setAcknowledgedYes(true);
    setError(null);
    try {
      await submitFarmerFeedback({
        category: 'General Feedback',
        module,
        rating: 5,
        comment: `Farmer marked this ${module} advice as useful and helpful.${resultSummary ? ` [Context: ${resultSummary}]` : ''}`,
        helpful_comment: 'Marked as helpful/accurate',
        district,
        crop,
        advisory_id: advisoryId,
        prediction_id: predictionId,
        query_summary: querySummary || resultSummary,
        ai_answer: aiAnswer,
      });
    } catch {
      // Quiet fail for positive thumb-up, state is already acknowledged
    }
  };

  const handleNegativeClick = () => {
    setUsefulness('no');
    setShowProblemForm(true);
    setSelectedCategory('Incorrect answer');
    setError(null);
  };

  const handleReportProblemClick = () => {
    setShowProblemForm(!showProblemForm);
    setError(null);
  };

  const handleSubmitProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      let combinedComment = comments.trim() || 'Farmer reported an issue with this advisory.';
      if (helpfulComment.trim()) {
        combinedComment += `\n[Helpful/Correct]: ${helpfulComment.trim()}`;
      }
      if (unhelpfulComment.trim()) {
        combinedComment += `\n[Wrong/Missing]: ${unhelpfulComment.trim()}`;
      }
      if (resultSummary) {
        combinedComment += ` [Context: ${resultSummary}]`;
      }

      await submitFarmerFeedback({
        category: selectedCategory,
        module,
        rating: usefulness === 'no' ? 2 : 3,
        comment: combinedComment,
        helpful_comment: helpfulComment.trim() || null,
        unhelpful_comment: unhelpfulComment.trim() || null,
        district,
        crop,
        advisory_id: advisoryId,
        prediction_id: predictionId,
        query_summary: querySummary || resultSummary,
        ai_answer: aiAnswer,
      });
      setSubmitted(true);
      setShowProblemForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit report. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-stone-200 bg-stone-50/70 p-4 transition-all duration-200 ${className}`}
    >
      {/* Top Strip: Question + Yes / No / Report buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-stone-800">
              Was this information useful?
            </span>
            <span className="text-[11px] text-stone-500 hidden md:inline">
              (ఈ సలహా ఉపయోగకరంగా ఉందా?)
            </span>
          </div>
          <p className="text-[11px] text-stone-500">
            Helps extension scientists at ANGRAU & PJTSAU refine regional advisories
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Yes Button */}
          <button
            type="button"
            onClick={handlePositiveFeedback}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
              usefulness === 'yes'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300'
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Yes, helpful</span>
          </button>

          {/* No Button */}
          <button
            type="button"
            onClick={handleNegativeClick}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
              usefulness === 'no'
                ? 'bg-stone-800 text-white border-stone-800 shadow-xs'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
            }`}
          >
            <ThumbsDown className="w-3.5 h-3.5 text-stone-600" />
            <span>Not helpful</span>
          </button>

          {/* Report a Problem Toggle */}
          <button
            type="button"
            onClick={handleReportProblemClick}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50/80 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Report a problem</span>
            {showProblemForm ? (
              <ChevronUp className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-rose-500" />
            )}
          </button>
        </div>
      </div>

      {/* Acknowledgment for Positive Feedback */}
      {acknowledgedYes && !showProblemForm && !submitted && (
        <div className="mt-3 pt-3 border-t border-stone-200/60 flex items-center gap-2 text-xs font-semibold text-emerald-800">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Thank you! Your feedback helps validate this advisory for {crop} in {district}.</span>
        </div>
      )}

      {/* Acknowledgment for Submitted Problem */}
      {submitted && (
        <div className="mt-3 pt-3 border-t border-stone-200/60 flex items-center gap-2 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Problem report submitted to the Agronomy Review Queue. Thank you for making AgriFusion more accurate!</span>
        </div>
      )}

      {/* Expandable "What was the problem?" Form */}
      {showProblemForm && !submitted && (
        <form
          onSubmit={handleSubmitProblem}
          className="mt-4 pt-4 border-t border-stone-200/80 space-y-3 animate-in fade-in duration-200"
        >
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-800 mb-2">
              What was the problem? (సమస్య ఏమిటి?)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FEEDBACK_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 border-[#14532D] text-[#14532D] font-bold shadow-2xs'
                        : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Separate optional inputs: Helpful vs Wrong */}
          <div className="space-y-2.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-emerald-800 mb-1">
                What was helpful or correct? (Optional)
              </label>
              <textarea
                value={helpfulComment}
                onChange={(e) => setHelpfulComment(e.target.value)}
                rows={2}
                placeholder="Tell us what was accurate, clear, or worked well in your field..."
                className="w-full text-xs p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/30 text-stone-800 placeholder:text-stone-400 focus:outline-hidden focus:border-[#14532D]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-800 mb-1">
                What was wrong or missing? (Optional)
              </label>
              <textarea
                value={unhelpfulComment}
                onChange={(e) => setUnhelpfulComment(e.target.value)}
                rows={2}
                placeholder="Tell us what was inaccurate, missing dosages, or incorrect..."
                className="w-full text-xs p-2.5 rounded-xl border border-amber-200 bg-amber-50/30 text-stone-800 placeholder:text-stone-400 focus:outline-hidden focus:border-[#14532D]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Additional comments or local practice (Optional)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={2}
                placeholder="Tell us what was inaccurate, missing dosages, incorrect mandi prices, or local village variations..."
                className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white text-stone-800 placeholder:text-stone-400 focus:outline-hidden focus:border-[#14532D]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowProblemForm(false)}
              className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-[#14532D] hover:bg-[#16A34A] text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : 'Submit feedback'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

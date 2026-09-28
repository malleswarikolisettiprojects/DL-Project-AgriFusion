import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  MessageSquare,
  Send,
  Star,
  Tag,
  X,
} from 'lucide-react';
import { submitFarmerFeedback } from '../lib/adminApi';
import { formatFeedbackCropLabel, formatFeedbackModuleLabel } from '../lib/feedbackApi';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultModule?: string;
  defaultCrop?: string;
  district?: string;
  advisoryId?: string | null;
  predictionId?: string | null;
  querySummary?: string | null;
  aiAnswer?: string | null;
}

const CATEGORIES = [
  'General Feedback',
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
  'App Bug or Performance Issue',
  'Other',
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  defaultModule = 'General Advisory',
  defaultCrop,
  district = 'Andhra Pradesh / Telangana',
  advisoryId = null,
  predictionId = null,
  querySummary = null,
  aiAnswer = null,
}) => {
  const [category, setCategory] = useState('General Feedback');
  const [module] = useState(defaultModule);
  const [rating, setRating] = useState(5);
  const [helpfulComment, setHelpfulComment] = useState('');
  const [unhelpfulComment, setUnhelpfulComment] = useState('');
  const [comment, setComment] = useState('');
  const [crop, setCrop] = useState(defaultCrop || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setSubmitting(true);

    try {
      let combinedComment = comment.trim();
      if (helpfulComment.trim()) {
        combinedComment += combinedComment ? `\n\n[Helpful/Correct]: ${helpfulComment.trim()}` : `[Helpful/Correct]: ${helpfulComment.trim()}`;
      }
      if (unhelpfulComment.trim()) {
        combinedComment += combinedComment ? `\n\n[Wrong/Missing]: ${unhelpfulComment.trim()}` : `[Wrong/Missing]: ${unhelpfulComment.trim()}`;
      }

      await submitFarmerFeedback({
        category,
        module,
        rating,
        comment: combinedComment,
        helpful_comment: helpfulComment.trim() || null,
        unhelpful_comment: unhelpfulComment.trim() || null,
        district,
        crop: crop.trim() || defaultCrop || 'General',
        advisory_id: advisoryId,
        prediction_id: predictionId,
        query_summary: querySummary,
        ai_answer: aiAnswer,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setComment('');
        setHelpfulComment('');
        setUnhelpfulComment('');
        onClose();
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit feedback.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const formattedModule = formatFeedbackModuleLabel(module);
  const formattedCrop = formatFeedbackCropLabel(crop || defaultCrop);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#14532D] border border-emerald-200 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Farmer Advisory Feedback</h3>
              <p className="text-[11px] text-stone-500">
                Direct channel to ANGRAU & PJTSAU agronomist review team
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Auto-Captured Context Display (No re-entry required!) */}
        <div className="mt-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-[#14532D] uppercase tracking-wider text-[10px]">
              Auto-Captured Context
            </span>
            <span className="text-[10px] text-stone-500 font-medium">Auto-attached from current page</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-stone-800 font-medium">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-emerald-300">
              <Tag className="w-3 h-3 text-[#14532D]" />
              <span>Module: <strong>{formattedModule}</strong></span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-emerald-300">
              <FileText className="w-3 h-3 text-[#14532D]" />
              <span>Crop: <strong>{formattedCrop}</strong></span>
            </span>
            {(advisoryId || predictionId) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-stone-200 font-mono text-[10px]">
                ID: {advisoryId || predictionId}
              </span>
            )}
          </div>
        </div>

        {success ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-stone-900">Feedback Submitted</h4>
            <p className="text-xs text-stone-600 max-w-sm mx-auto">
              Thank you! Your feedback has been queued in the AgriFusion Administration & Agronomist Review Console.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Rating */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Rate Advisory Accuracy & Usability
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 cursor-pointer focus:outline-hidden"
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        star <= rating
                          ? 'fill-amber-400 text-amber-500'
                          : 'fill-stone-100 text-stone-300 hover:text-amber-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-stone-700 ml-2">
                  {rating === 5 && 'Excellent / Precise'}
                  {rating === 4 && 'Good'}
                  {rating === 3 && 'Fair / Needs improvement'}
                  {rating === 2 && 'Poor / Inaccurate'}
                  {rating === 1 && 'Unsatisfactory'}
                </span>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 focus:outline-hidden focus:border-[#14532D]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Crop override if not auto-captured */}
            {!defaultCrop && (
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Crop or Variety (Optional)
                </label>
                <input
                  type="text"
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  placeholder="e.g., Rice (BPT 5204), Chilli (Teja), Cotton, Mango"
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 placeholder:text-stone-400 focus:outline-hidden focus:border-[#14532D]"
                />
              </div>
            )}

            {/* Separate Optional Inputs: "What was helpful/correct?" vs "What was wrong or missing?" */}
            <div className="space-y-3 pt-1 border-t border-stone-100">
              <div>
                <label className="block text-xs font-semibold text-emerald-800 mb-1">
                  What was helpful or correct? (Optional) / (ఉపయోగకరమైన వివరాలు)
                </label>
                <textarea
                  value={helpfulComment}
                  onChange={(e) => setHelpfulComment(e.target.value)}
                  rows={2}
                  placeholder="Tell us what advice was accurate, clear, or worked well in your field..."
                  className="w-full text-xs p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/30 text-stone-800 placeholder:text-stone-400 focus:outline-hidden focus:border-[#14532D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-800 mb-1">
                  What was wrong or missing? (Optional) / (తప్పు లేదా లోపించిన వివరాలు)
                </label>
                <textarea
                  value={unhelpfulComment}
                  onChange={(e) => setUnhelpfulComment(e.target.value)}
                  rows={2}
                  placeholder="Tell us what was inaccurate, missing dosages, incorrect mandi prices, or local village variations..."
                  className="w-full text-xs p-2.5 rounded-xl border border-amber-200 bg-amber-50/30 text-stone-800 placeholder:text-stone-400 focus:outline-hidden focus:border-[#14532D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Additional Comments or Suggestions (Optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Any other observations in English or Telugu..."
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 placeholder:text-stone-400 focus:outline-hidden focus:border-[#14532D]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-stone-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#14532D] hover:bg-[#16A34A] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Submitting...' : 'Submit Feedback'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

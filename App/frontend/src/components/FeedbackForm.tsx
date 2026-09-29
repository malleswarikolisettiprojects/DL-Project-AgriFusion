import React, { useState } from 'react';
import { AlertCircle, Check, Loader2, Send, Tag, FileText } from 'lucide-react';
import {
  FEEDBACK_CATEGORIES,
  formatFeedbackCropLabel,
  formatFeedbackModuleLabel,
  submitFeedback,
  type FeedbackCategory,
  type SubmitFeedbackPayload,
} from '../lib/feedbackApi';

interface FeedbackFormProps {
  advisoryId?: string | null;
  predictionId?: string | null;
  module?: string;
  crop?: string;
  district?: string;
  querySummary?: string | null;
  aiAnswer?: string | null;
  defaultRating?: number | null;
  defaultCategory?: FeedbackCategory;
  feedbackType?: 'helpful' | 'not_helpful' | 'problem_report';
  initialLanguage?: string;
  onSuccess: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

const SUPPORTED_LANGUAGES = [
  { code: 'English', label: 'English' },
  { code: 'Telugu', label: 'తెలుగు (Telugu)' },
  { code: 'Hindi', label: 'హిन्दी (Hindi)' },
];

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  advisoryId = null,
  predictionId = null,
  module,
  crop,
  district,
  querySummary = null,
  aiAnswer = null,
  defaultRating = 1,
  defaultCategory = 'incorrect_answer',
  feedbackType = 'not_helpful',
  initialLanguage = 'English',
  onSuccess,
  onCancel,
  compact = false,
}) => {
  const [category, setCategory] = useState<FeedbackCategory>(defaultCategory);
  const [rating, setRating] = useState<number | null>(defaultRating);
  const [helpfulComment, setHelpfulComment] = useState<string>('');
  const [unhelpfulComment, setUnhelpfulComment] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [language, setLanguage] = useState<string>(initialLanguage);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const characterCount = helpfulComment.length + unhelpfulComment.length + message.length;
  const maxCharacters = 2000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate category is selected
    if (!category) {
      setError('Please select a problem category.');
      return;
    }

    // Validate message max length
    if (characterCount > maxCharacters) {
      setError(`Feedback exceeds limit of ${maxCharacters} characters.`);
      return;
    }

    setIsSubmitting(true);

    let combinedMessage = message.trim();
    if (helpfulComment.trim()) {
      combinedMessage += combinedMessage ? `\n\n[Helpful/Correct]: ${helpfulComment.trim()}` : `[Helpful/Correct]: ${helpfulComment.trim()}`;
    }
    if (unhelpfulComment.trim()) {
      combinedMessage += combinedMessage ? `\n\n[Wrong/Missing]: ${unhelpfulComment.trim()}` : `[Wrong/Missing]: ${unhelpfulComment.trim()}`;
    }

    const payload: SubmitFeedbackPayload = {
      feedback_type: feedbackType,
      advisory_id: advisoryId,
      prediction_id: predictionId,
      module,
      crop: crop || null,
      district: district || null,
      rating,
      category,
      helpful_comment: helpfulComment.trim() || null,
      unhelpful_comment: unhelpfulComment.trim() || null,
      message: combinedMessage,
      comment: combinedMessage,
      language,
      query_summary: querySummary,
      ai_answer: aiAnswer,
    };

    try {
      await submitFeedback(payload);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'We could not submit your feedback. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedModule = formatFeedbackModuleLabel(module);
  const formattedCrop = formatFeedbackCropLabel(crop);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {/* Auto-Captured Context Display (No re-entry required!) */}
      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-[#14532D] uppercase tracking-wider text-[10px]">
            Auto-Captured Context
          </span>
          <span className="text-[10px] text-stone-500 font-medium">Auto-attached from page</span>
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

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Language Preference */}
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="feedback-language-select" className="text-xs font-semibold text-stone-700">
          Response Language
        </label>
        <select
          id="feedback-language-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="text-xs py-1 px-2.5 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-[#14532D]"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Problem Category Selection */}
      <div>
        <label className="block text-xs font-bold text-stone-900 mb-2">
          What was the problem? (సమస్య ఏమిటి?)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FEEDBACK_CATEGORIES.map((cat) => {
            const isSelected = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                aria-pressed={isSelected}
                className={`p-2.5 text-left rounded-xl border transition-all text-xs cursor-pointer flex items-start justify-between gap-2 ${
                  isSelected
                    ? 'border-[#14532D] bg-emerald-50 text-[#14532D] ring-1 ring-[#14532D] font-bold shadow-2xs'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 hover:border-stone-300'
                }`}
              >
                <div>
                  <div className="font-semibold">{cat.label}</div>
                  <div className="text-[10px] text-stone-500 font-normal mt-0.5">
                    {cat.description}
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-[#14532D] shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rating Optional Selector */}
      <div>
        <label className="block text-xs font-semibold text-stone-700 mb-1.5">
          Overall Guidance Rating (ఐచ్ఛిక రేటింగ్)
        </label>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                rating === star
                  ? 'bg-[#14532D] text-white border-[#14532D]'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
              title={`${star} out of 5 stars`}
            >
              {star}★
            </button>
          ))}
          {rating && (
            <span className="text-[11px] text-stone-500 ml-1">
              {rating === 1 ? 'Poor / Inaccurate' : rating === 5 ? 'Excellent' : `Rating: ${rating}/5`}
            </span>
          )}
        </div>
      </div>

      {/* Separate Optional Inputs: Helpful vs Wrong */}
      <div className="space-y-3 pt-2 border-t border-stone-200/80">
        <div>
          <label htmlFor="helpful-comments-textarea" className="block text-xs font-semibold text-emerald-800 mb-1">
            What was helpful or correct? (Optional) / (ఉపయోగకరమైన వివరాలు)
          </label>
          <textarea
            id="helpful-comments-textarea"
            value={helpfulComment}
            onChange={(e) => setHelpfulComment(e.target.value)}
            rows={compact ? 2 : 2}
            placeholder="Tell us what was accurate, clear, or worked well in your field..."
            className="w-full text-xs p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/30 text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#14532D]"
          />
        </div>

        <div>
          <label htmlFor="unhelpful-comments-textarea" className="block text-xs font-semibold text-amber-800 mb-1">
            What was wrong or missing? (Optional) / (తప్పు లేదా లోపించిన వివరాలు)
          </label>
          <textarea
            id="unhelpful-comments-textarea"
            value={unhelpfulComment}
            onChange={(e) => setUnhelpfulComment(e.target.value)}
            rows={compact ? 2 : 2}
            placeholder="Tell us what was inaccurate, missing dosages, incorrect mandi prices, or local variations..."
            className="w-full text-xs p-2.5 rounded-xl border border-amber-200 bg-amber-50/30 text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#14532D]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="feedback-comments-textarea" className="text-xs font-semibold text-stone-800">
              Additional comments (Optional)
            </label>
            <span
              className={`text-[11px] font-mono ${
                characterCount > maxCharacters ? 'text-rose-600 font-bold' : 'text-stone-500'
              }`}
            >
              {characterCount}/{maxCharacters}
            </span>
          </div>
          <textarea
            id="feedback-comments-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={compact ? 2 : 2}
            maxLength={maxCharacters}
            placeholder="Any other observations in English or Telugu..."
            className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#14532D] focus:border-[#14532D]"
          />
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200/80">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={isSubmitting || characterCount > maxCharacters}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-[#14532D] hover:bg-[#16A34A] text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Submit feedback</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

/**
 * AgriFusion Feedback API Client
 *
 * Implements the farmer feedback contract for both contextual (per-advisory/result)
 * and general application feedback.
 *
 * Backend contract:
 * POST /api/v1/feedback
 *
 * Compatible with Admin Review endpoints:
 * GET /api/v1/admin/feedback
 * PATCH /api/v1/admin/feedback/{id}
 * POST /api/v1/admin/feedback/{id}/note
 */

import { supabase } from './supabase';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://dl-project-agrifusion-backend.onrender.com'
).replace(/\/+$/, '');

export type FeedbackCategory =
  | 'incorrect_answer'
  | 'missing_information'
  | 'outdated_source'
  | 'wrong_language'
  | 'unclear_advice'
  | 'image_quality_problem'
  | 'technical_error'
  | 'other';

export const FEEDBACK_CATEGORIES: Array<{
  id: FeedbackCategory;
  label: string;
  labelTe?: string;
  labelHi?: string;
  description: string;
}> = [
  {
    id: 'incorrect_answer',
    label: 'Incorrect answer',
    labelTe: 'సరికాని సమాధానం',
    labelHi: 'गलत उत्तर',
    description: 'The recommendation contradicts verified ICAR/KVK field guidelines',
  },
  {
    id: 'missing_information',
    label: 'Missing information',
    labelTe: 'సమాచారం లేదు',
    labelHi: 'अधूरी जानकारी',
    description: 'Essential dosages, spray intervals, or crop varieties are omitted',
  },
  {
    id: 'outdated_source',
    label: 'Outdated source',
    labelTe: 'పాత సమాచారం',
    labelHi: 'पुरानी जानकारी',
    description: 'Price, subsidy, or package of practices is no longer current',
  },
  {
    id: 'wrong_language',
    label: 'Wrong language',
    labelTe: 'తప్పు భాష / అనువాద దోషం',
    labelHi: 'गलत भाषा या अनुवाद',
    description: 'Translation errors, unclear dialect, or inappropriate terminology',
  },
  {
    id: 'unclear_advice',
    label: 'Unclear advice',
    labelTe: 'అస్పష్టమైన సలహా',
    labelHi: 'अस्पष्ट सलाह',
    description: 'The advice is confusing or difficult to apply in the field',
  },
  {
    id: 'image_quality_problem',
    label: 'Image quality problem',
    labelTe: 'చిత్ర నాణ్యత సమస్య',
    labelHi: 'छवि गुणवत्ता समस्या',
    description: 'Disease photo was blurry, shadowed, or unreadable',
  },
  {
    id: 'technical_error',
    label: 'Technical error',
    labelTe: 'సాంకేతిక లోపం',
    labelHi: 'तकनीकी त्रुटि',
    description: 'Slow loading, timeout, or unexpected calculation result',
  },
  {
    id: 'other',
    label: 'Other',
    labelTe: 'ఇతర సమస్య',
    labelHi: 'अन्य समस्या',
    description: 'General farmer observation, suggestion, or feedback',
  },
];

export type FeedbackType = 'helpful' | 'not_helpful' | 'problem_report';

export interface SubmitFeedbackPayload {
  feedback_type?: FeedbackType | string;
  advisory_id?: string | null;
  prediction_id?: string | null;
  rating?: number | null;
  category: FeedbackCategory | string;
  message?: string;
  comment?: string;
  helpful_comment?: string | null;
  unhelpful_comment?: string | null;
  module?: string | null;
  crop?: string | null;
  district?: string | null;
  state?: string | null;
  language?: string;
  query_summary?: string | null;
  ai_answer?: string | null;
}

/**
 * Format raw module names to human-readable labels
 */
export function formatFeedbackModuleLabel(moduleStr?: string | null): string {
  if (!moduleStr || !moduleStr.trim()) return 'Not specified';
  const norm = moduleStr.trim().toLowerCase();
  if (norm === 'general' || norm === 'general advisory') return 'General Advisory';
  const map: Record<string, string> = {
    rag: 'CropWise Agronomist AI',
    crop: 'Crop Recommendation',
    irrigation: 'Smart Irrigation Planner',
    yield: 'Yield Forecast',
    market: 'Market & Price Forecast',
    disease: 'Leaf Disease Scanner',
    climate: 'Climate Risk Advisory',
    schemes: 'Government Schemes',
    pipeline: 'Full Farm Analysis Pipeline',
    cost: 'Cost & Profit Estimator',
  };
  if (map[norm]) return map[norm];
  return moduleStr.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format raw crop values to human-readable labels
 */
export function formatFeedbackCropLabel(cropStr?: string | null): string {
  if (
    !cropStr ||
    !cropStr.trim() ||
    cropStr.trim().toLowerCase() === 'general' ||
    cropStr.trim().toLowerCase() === 'general crop' ||
    cropStr.trim().toLowerCase() === 'field crop'
  ) {
    return 'Not specified';
  }
  return cropStr.trim();
}

/**
 * Helper to check if a feedback record has linked advisory/prediction context
 */
export function hasFeedbackContext(feedback: any): boolean {
  if (!feedback || typeof feedback !== 'object') return false;
  if (feedback.query_summary && String(feedback.query_summary).trim()) return true;
  if (feedback.ai_answer && String(feedback.ai_answer).trim()) return true;
  if (feedback.advisory_id && String(feedback.advisory_id).trim()) return true;
  if (feedback.prediction_id && String(feedback.prediction_id).trim()) return true;
  if (feedback.context && typeof feedback.context === 'object') {
    if (feedback.context.query_summary || feedback.context.ai_answer || feedback.context.advisory_id || feedback.context.prediction_id) {
      return true;
    }
  }
  return false;
}

export interface FeedbackResponse {
  id?: string;
  status?: string;
  message?: string;
  advisory_id?: string | null;
  created_at?: string;
}

export class FeedbackApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'FeedbackApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * In-memory session tracker to prevent accidental duplicate submissions
 * for the same result without persisting sensitive farmer state.
 */
const submittedAdvisoriesThisSession = new Set<string>();

export function hasSubmittedFeedback(advisoryId: string | null | undefined): boolean {
  if (!advisoryId) return false;
  return submittedAdvisoriesThisSession.has(advisoryId);
}

export function markFeedbackSubmitted(advisoryId: string | null | undefined): void {
  if (advisoryId) {
    submittedAdvisoriesThisSession.add(advisoryId);
  }
}

/**
 * Submits feedback to the AgriFusion backend.
 * Respects authentication if available, supports anonymous feedback,
 * validates length constraints, and provides user-friendly error messages.
 */
export async function submitFeedback(payload: SubmitFeedbackPayload): Promise<FeedbackResponse> {
  // Validate category
  const validCategories: string[] = [
    'incorrect_answer',
    'missing_information',
    'outdated_source',
    'wrong_language',
    'unclear_advice',
    'image_quality_problem',
    'technical_error',
    'other',
  ];

  if (!payload.category || !validCategories.includes(payload.category)) {
    throw new FeedbackApiError('Please select a valid feedback category.', 422);
  }

  // Validate message length (max 2000 chars)
  if (payload.message && payload.message.length > 2000) {
    throw new FeedbackApiError('Feedback message must be under 2000 characters.', 422);
  }

  // Validate rating (if provided, must be 1-5)
  if (payload.rating !== undefined && payload.rating !== null) {
    if (typeof payload.rating !== 'number' || payload.rating < 1 || payload.rating > 5) {
      throw new FeedbackApiError('Rating must be between 1 and 5.', 422);
    }
  }

  // Prevent duplicate submissions in same session
  if (payload.advisory_id && hasSubmittedFeedback(payload.advisory_id)) {
    throw new FeedbackApiError('Feedback has already been submitted for this result.', 409);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Attach Supabase access token if session exists
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch {
    // Non-blocking: anonymous feedback is supported
  }

  const sanitizedPayload = {
    feedback_type:
      payload.feedback_type ||
      (payload.rating && payload.rating >= 4 ? 'helpful' : 'not_helpful'),
    advisory_id: payload.advisory_id ?? null,
    prediction_id: payload.prediction_id ?? null,
    rating: payload.rating ?? null,
    category: payload.category,
    module: payload.module || null,
    crop: payload.crop || null,
    district: payload.district || null,
    state: payload.state || null,
    helpful_comment: payload.helpful_comment?.trim() || null,
    unhelpful_comment: payload.unhelpful_comment?.trim() || null,
    message: payload.message?.trim() || payload.comment?.trim() || '',
    comment: payload.comment?.trim() || payload.message?.trim() || '',
    language: payload.language || 'English',
    query_summary: payload.query_summary || null,
    ai_answer: payload.ai_answer || null,
  };

  const response = await fetch(`${API_BASE_URL}/api/v1/feedback`, {
    method: 'POST',
    headers,
    body: JSON.stringify(sanitizedPayload),
  });

  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (response.status === 400) {
    const msg = typeof body === 'object' && body?.detail ? String(body.detail) : 'Please check the feedback details.';
    throw new FeedbackApiError(msg, 400, body);
  }

  if (response.status === 401) {
    throw new FeedbackApiError('Please sign in to submit feedback.', 401, body);
  }

  if (response.status === 403) {
    throw new FeedbackApiError('You do not have permission to submit feedback.', 403, body);
  }

  if (response.status === 404) {
    throw new FeedbackApiError('Feedback submission is not available on the backend yet.', 404, body);
  }

  if (response.status === 422) {
    const detailMsg =
      typeof body === 'object' && body?.detail
        ? Array.isArray(body.detail)
          ? body.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ')
          : String(body.detail)
        : 'Please check the feedback details and try again.';
    throw new FeedbackApiError(detailMsg, 422, body);
  }

  if (response.status === 429) {
    throw new FeedbackApiError('Too many feedback requests. Please wait a moment before trying again.', 429, body);
  }

  if (response.status >= 500) {
    throw new FeedbackApiError('Feedback service is temporarily unavailable. Please try again later.', response.status, body);
  }

  if (!response.ok) {
    throw new FeedbackApiError('Feedback could not be submitted. Please try again.', response.status, body);
  }

  if (payload.advisory_id) {
    markFeedbackSubmitted(payload.advisory_id);
  }

  return body as FeedbackResponse;
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FEEDBACK_CATEGORIES,
  FeedbackApiError,
  formatFeedbackCropLabel,
  formatFeedbackModuleLabel,
  hasFeedbackContext,
  hasSubmittedFeedback,
  markFeedbackSubmitted,
  submitFeedback,
  type SubmitFeedbackPayload,
} from '../lib/feedbackApi';
import { supabase } from '../lib/supabase';

describe('Feedback Categories Specification', () => {
  it('includes all 8 approved feedback categories', () => {
    const ids = FEEDBACK_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('incorrect_answer');
    expect(ids).toContain('missing_information');
    expect(ids).toContain('outdated_source');
    expect(ids).toContain('wrong_language');
    expect(ids).toContain('unclear_advice');
    expect(ids).toContain('image_quality_problem');
    expect(ids).toContain('technical_error');
    expect(ids).toContain('other');
    expect(ids).toHaveLength(8);
  });
});

describe('submitFeedback API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits valid contextual feedback with rating, category, and language', async () => {
    const testAdvisoryId = `adv-test-${Date.now()}`;
    const mockResponse = {
      id: 'fb-12345',
      status: 'received',
      message: 'Feedback recorded successfully',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify(mockResponse)),
    });
    globalThis.fetch = fetchMock;

    const payload: SubmitFeedbackPayload = {
      advisory_id: testAdvisoryId,
      rating: 5,
      category: 'other',
      message: 'Excellent agronomic guidance for rice crop.',
      language: 'English',
    };

    const result = await submitFeedback(payload);
    expect(result).toEqual(mockResponse);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/feedback');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const sentBody = JSON.parse(options.body);
    expect(sentBody.advisory_id).toBe(testAdvisoryId);
    expect(sentBody.rating).toBe(5);
    expect(sentBody.category).toBe('other');
    expect(sentBody.message).toBe('Excellent agronomic guidance for rice crop.');
    expect(sentBody.language).toBe('English');
  });

  it('submits general feedback with advisory_id: null', async () => {
    const mockResponse = { id: 'fb-gen-1', status: 'received' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify(mockResponse)),
    });
    globalThis.fetch = fetchMock;

    const payload: SubmitFeedbackPayload = {
      advisory_id: null,
      rating: null,
      category: 'other',
      message: 'Great application for Andhra Pradesh farmers.',
      language: 'English',
    };

    const result = await submitFeedback(payload);
    expect(result).toEqual(mockResponse);

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.advisory_id).toBeNull();
    expect(sentBody.rating).toBeNull();
    expect(sentBody.category).toBe('other');
  });

  it('attaches Supabase Bearer token when an authenticated session exists', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-jwt-farmer-token',
        } as any,
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ status: 'ok' })),
    });
    globalThis.fetch = fetchMock;

    await submitFeedback({
      category: 'technical_error',
      message: 'Map took long to load',
      language: 'English',
    });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer mock-jwt-farmer-token');
  });

  it('rejects invalid feedback category before network dispatch', async () => {
    await expect(
      submitFeedback({
        category: 'unrecognized_category' as any,
        message: 'Invalid category test',
        language: 'English',
      })
    ).rejects.toThrow('Please select a valid feedback category.');
  });

  it('rejects out-of-range rating before network dispatch', async () => {
    await expect(
      submitFeedback({
        rating: 6,
        category: 'other',
        language: 'English',
      })
    ).rejects.toThrow('Rating must be between 1 and 5.');

    await expect(
      submitFeedback({
        rating: 0,
        category: 'other',
        language: 'English',
      })
    ).rejects.toThrow('Rating must be between 1 and 5.');
  });

  it('rejects message exceeding 2000 character limit', async () => {
    const longMessage = 'A'.repeat(2001);
    await expect(
      submitFeedback({
        category: 'other',
        message: longMessage,
        language: 'English',
      })
    ).rejects.toThrow('Feedback message must be under 2000 characters.');
  });

  it('prevents duplicate submissions for the same advisory_id in session', async () => {
    const duplicateAdvisoryId = `dup-adv-${Date.now()}`;
    markFeedbackSubmitted(duplicateAdvisoryId);
    expect(hasSubmittedFeedback(duplicateAdvisoryId)).toBe(true);

    await expect(
      submitFeedback({
        advisory_id: duplicateAdvisoryId,
        category: 'other',
        language: 'English',
      })
    ).rejects.toThrow('Feedback has already been submitted for this result.');
  });

  it('handles backend 404 cleanly (endpoint not deployed)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValue('Not Found'),
    });

    await expect(
      submitFeedback({
        category: 'incorrect_answer',
        message: 'Wrong dosage',
        language: 'English',
      })
    ).rejects.toMatchObject({
      name: 'FeedbackApiError',
      status: 404,
      message: 'Feedback submission is not available on the backend yet.',
    });
  });

  it('handles backend 429 rate limit cleanly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue('Too Many Requests'),
    });

    await expect(
      submitFeedback({
        category: 'technical_error',
        language: 'English',
      })
    ).rejects.toMatchObject({
      name: 'FeedbackApiError',
      status: 429,
      message: 'Too many feedback requests. Please wait a moment before trying again.',
    });
  });

  it('handles backend 500/503 temporary outage without crashing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue('Service Unavailable'),
    });

    await expect(
      submitFeedback({
        category: 'other',
        language: 'English',
      })
    ).rejects.toMatchObject({
      name: 'FeedbackApiError',
      status: 503,
      message: 'Feedback service is temporarily unavailable. Please try again later.',
    });
  });

  it('submits complete context payload including module, crop, advisory_id/prediction_id, helpful and unhelpful comments', async () => {
    const mockResponse = { id: 'fb-context-123', status: 'received' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify(mockResponse)),
    });
    globalThis.fetch = fetchMock;

    const fullPayload: SubmitFeedbackPayload = {
      advisory_id: 'adv-999',
      prediction_id: 'pred-888',
      module: 'Smart Irrigation Planner',
      crop: 'Chilli (Teja)',
      district: 'Guntur',
      rating: 4,
      category: 'missing_information',
      helpful_comment: 'Irrigation volume calculated was exact.',
      unhelpful_comment: 'Drip system pressure requirement was missing.',
      message: 'Good planner but add pressure bar details.',
      language: 'English',
      query_summary: 'Water requirement calculation for 2ha Chilli',
      ai_answer: 'Apply 25mm water every 4 days via drip irrigation.',
    };

    const res = await submitFeedback(fullPayload);
    expect(res).toEqual(mockResponse);

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.feedback_type).toBe('helpful');
    expect(sentBody.advisory_id).toBe('adv-999');
    expect(sentBody.prediction_id).toBe('pred-888');
    expect(sentBody.module).toBe('Smart Irrigation Planner');
    expect(sentBody.crop).toBe('Chilli (Teja)');
    expect(sentBody.helpful_comment).toBe('Irrigation volume calculated was exact.');
    expect(sentBody.unhelpful_comment).toBe('Drip system pressure requirement was missing.');
    expect(sentBody.query_summary).toBe('Water requirement calculation for 2ha Chilli');
    expect(sentBody.ai_answer).toBe('Apply 25mm water every 4 days via drip irrigation.');
  });

  it('submits helpful, not_helpful, and problem_report feedback types with correct defaults', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ status: 'ok' })),
    });
    globalThis.fetch = fetchMock;

    // 1. Helpful submission
    await submitFeedback({
      feedback_type: 'helpful',
      advisory_id: 'adv-helpful-1',
      module: 'crop',
      crop: 'Rice',
      category: 'other',
      rating: 5,
      helpful_comment: 'Recommendation was accurate',
    });
    let sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.feedback_type).toBe('helpful');
    expect(sent.module).toBe('crop');
    expect(sent.crop).toBe('Rice');

    // 2. Not Helpful submission
    await submitFeedback({
      feedback_type: 'not_helpful',
      advisory_id: 'adv-unhelpful-2',
      module: 'disease',
      crop: 'Cotton',
      category: 'incorrect_answer',
      rating: 1,
      unhelpful_comment: 'Wrong disease diagnosis',
    });
    sent = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(sent.feedback_type).toBe('not_helpful');
    expect(sent.module).toBe('disease');
    expect(sent.crop).toBe('Cotton');

    // 3. Problem Report submission
    await submitFeedback({
      feedback_type: 'problem_report',
      prediction_id: 'pred-problem-3',
      module: 'irrigation',
      category: 'technical_error',
      rating: 2,
      message: 'Calculation timed out',
    });
    sent = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(sent.feedback_type).toBe('problem_report');
    expect(sent.module).toBe('irrigation');
    expect(sent.category).toBe('technical_error');
  });

  it('allows user to retry submission after a network failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ status: 'ok', id: 'fb-retry-1' })),
      });
    globalThis.fetch = fetchMock;

    const payload: SubmitFeedbackPayload = {
      feedback_type: 'problem_report',
      advisory_id: 'adv-retry-100',
      category: 'technical_error',
      message: 'Network issue initially',
    };

    // First attempt fails
    await expect(submitFeedback(payload)).rejects.toThrow();

    // Retry succeeds (should not be blocked by duplicate prevention on failed attempt)
    const result = await submitFeedback(payload);
    expect(result).toEqual({ status: 'ok', id: 'fb-retry-1' });
  });
});

describe('Feedback Context & Label Formatters', () => {
  it('formats raw module codes into clean human-readable labels', () => {
    expect(formatFeedbackModuleLabel('rag')).toBe('CropWise Agronomist AI');
    expect(formatFeedbackModuleLabel('irrigation')).toBe('Smart Irrigation Planner');
    expect(formatFeedbackModuleLabel('disease')).toBe('Leaf Disease Scanner');
    expect(formatFeedbackModuleLabel('yield')).toBe('Yield Forecast');
    expect(formatFeedbackModuleLabel('market')).toBe('Market & Price Forecast');
    expect(formatFeedbackModuleLabel('crop')).toBe('Crop Recommendation');
    expect(formatFeedbackModuleLabel('climate')).toBe('Climate Risk Advisory');
    expect(formatFeedbackModuleLabel('schemes')).toBe('Government Schemes');
    expect(formatFeedbackModuleLabel(null)).toBe('Not specified');
  });

  it('formats crop strings safely and detects absent/generic crop values', () => {
    expect(formatFeedbackCropLabel('Chilli (Teja)')).toBe('Chilli (Teja)');
    expect(formatFeedbackCropLabel('Rice (BPT 5204)')).toBe('Rice (BPT 5204)');
    expect(formatFeedbackCropLabel('General')).toBe('Not specified');
    expect(formatFeedbackCropLabel('General Crop')).toBe('Not specified');
    expect(formatFeedbackCropLabel('Field Crop')).toBe('Not specified');
    expect(formatFeedbackCropLabel(null)).toBe('Not specified');
    expect(formatFeedbackCropLabel('')).toBe('Not specified');
  });

  it('correctly detects complete context vs missing context on old/unlinked records', () => {
    // Complete record with advisory_id and query/answer
    const completeRecord = {
      id: 'fb-1',
      advisory_id: 'q-100',
      query_summary: 'Stem borer in Rice',
      ai_answer: 'Apply Chlorantraniliprole 0.4% GR',
    };
    expect(hasFeedbackContext(completeRecord)).toBe(true);

    // Complete record with nested context object
    const nestedContextRecord = {
      id: 'fb-2',
      context: {
        advisory_id: 'q-200',
        query_summary: 'Papaya leaf curl',
      },
    };
    expect(hasFeedbackContext(nestedContextRecord)).toBe(true);

    // Old unlinked record without advisory_id, query_summary, or ai_answer
    const oldUnlinkedRecord = {
      id: 'fb-old-99',
      advisory_id: null,
      prediction_id: null,
      query_summary: null,
      ai_answer: null,
      message: 'App is very slow on 3G network',
    };
    expect(hasFeedbackContext(oldUnlinkedRecord)).toBe(false);

    // Record with empty context object
    const emptyContextRecord = {
      id: 'fb-empty',
      context: null,
    };
    expect(hasFeedbackContext(emptyContextRecord)).toBe(false);
  });
});

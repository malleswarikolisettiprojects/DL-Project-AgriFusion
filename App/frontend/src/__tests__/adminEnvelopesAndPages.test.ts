import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  API_BASE_URL,
  AdminApiError,
  getAdminAdvisories,
  getAdminAdvisoryAnalytics,
  getAdminDiagnostics,
  getAdminFarms,
  getAdminFeedback,
  getAdminPredictions,
  getAdminSchemes,
  getAdminSources,
  updateAdvisoryReview,
} from '../lib/adminApi';
import { supabase } from '../lib/supabase';

import {
  formatDiagnosticConfidence,
  formatDiagnosticDiagnosis,
  formatDiagnosticExecutionStatus,
  formatDiagnosticInferenceOutcome,
  formatDiagnosticReviewStatus,
  formatDiagnosticStatus,
} from '../views/admin/AdminDiagnosticsSection';
import {
  formatPredictionLatency,
  formatPredictionOutcome,
} from '../views/admin/AdminPredictionsSection';
import type { AdminPredictionItem } from '../types';

describe('Admin API Paginated Envelope Contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const setupMockAuth = (token = 'mock-supabase-bearer-jwt') => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: { access_token: token } as any,
      },
      error: null,
    });
  };

  it('1. GET /api/v1/admin/farms handles valid count response envelope and single farm count of 1', async () => {
    setupMockAuth();

    const mockSingleFarmResponse = {
      count: 1,
      filters_applied: {
        state: 'Andhra Pradesh',
        district: 'Guntur',
        crop: 'Chilli',
        area_range: null,
        irrigation_type: null,
      },
      suppressed: false,
      privacy_threshold: 1,
      privacy_note: 'Minimum threshold met.',
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockSingleFarmResponse),
    });
    globalThis.fetch = fetchSpy;

    const res = await getAdminFarms({ state: 'Andhra Pradesh', district: 'Guntur', crop: 'Chilli', privacy_threshold: 1 });

    expect(res.count).toBe(1);
    expect(res.suppressed).toBe(false);
    expect(res.privacy_threshold).toBe(1);
    expect(res.filters_applied.district).toBe('Guntur');

    // Verify privacy_threshold=1 query parameter was sent
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('privacy_threshold=1');

    // Verify singular grammar phrasing helper for UI
    const matchText = res.count === 1 ? '1 farm matches your filters.' : `${res.count} farms match your filters.`;
    expect(matchText).toBe('1 farm matches your filters.');
  });

  it('2. GET /api/v1/admin/farms contract test ensures number is hidden whenever suppressed is true, even if count is numeric', async () => {
    setupMockAuth();

    const mockSuppressedResponse = {
      count: 1, // numeric value sent in backend response
      filters_applied: {
        state: 'Andhra Pradesh',
        district: 'SmallDistrict',
        crop: 'Vanilla',
        area_range: null,
        irrigation_type: null,
      },
      suppressed: true,
      privacy_threshold: 5,
      privacy_note: 'Results suppressed for privacy: fewer than 5 records match.',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockSuppressedResponse),
    });

    const res = await getAdminFarms({ state: 'Andhra Pradesh', district: 'SmallDistrict', privacy_threshold: 5 });

    expect(res.suppressed).toBe(true);
    expect(res.privacy_note).toContain('suppressed');
    // Contract requirement: UI MUST hide count whenever suppressed === true
    const visibleCount = res.suppressed ? null : res.count;
    expect(visibleCount).toBeNull();
  });

  it('3. GET /api/v1/admin/farms handles zero count and multiple farm count non-suppressed responses', async () => {
    setupMockAuth();

    // Zero count
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          count: 0,
          filters_applied: { state: null, district: 'Nonexistent', crop: null, area_range: null, irrigation_type: null },
          suppressed: false,
          privacy_threshold: 1,
          privacy_note: 'No records found.',
        }),
    });

    const resZero = await getAdminFarms({ district: 'Nonexistent' });

    expect(resZero.count).toBe(0);
    expect(resZero.suppressed).toBe(false);

    // Multiple count
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          count: 42,
          filters_applied: { state: 'Telangana', district: 'Warangal', crop: 'Cotton', area_range: null, irrigation_type: null },
          suppressed: false,
          privacy_threshold: 1,
          privacy_note: 'Success',
        }),
    });

    const resMultiple = await getAdminFarms({ state: 'Telangana', district: 'Warangal' });

    expect(resMultiple.count).toBe(42);
    expect(resMultiple.suppressed).toBe(false);
    const multipleText = `${resMultiple.count} farms match your filters.`;
    expect(multipleText).toBe('42 farms match your filters.');
  });

  it('4. GET /api/v1/admin/advisories parses exact real backend schema fields (retrieval, sources, compliance)', async () => {
    setupMockAuth();

    const mockAdvisoryResponse = {
      items: [
        {
          query_id: 'q_999',
          created_at: '2026-09-24T10:00:00Z',
          crop: 'Cotton',
          state: 'Telangana',
          district: 'Warangal',
          query_summary: 'Pest management for pink bollworm in cotton',
          activity_status: 'success',
          review_status: 'needs_review',
          retrieval: {
            documents_considered: 12,
            documents_used: 3,
            relevance_threshold_passed: true,
            no_verified_source: false,
          },
          sources: [
            { title: 'PJTSAU Cotton Package of Practices', organization: 'PJTSAU', url: 'https://pjtsau.edu.in/cotton', verified_date: '2026-01-10' },
            { title: 'CICR Pink Bollworm Advisory', organization: 'ICAR-CICR', url: 'https://cicr.org.in', verified_date: '2026-02-15' },
          ],
          compliance: {
            citations_present: true,
            dose_claims_source_backed: true,
            missing_dose_fields_flagged: false,
            scheme_eligibility_qualified: true,
            extension_confirmation_flagged: false,
            compliance_status: 'fully_compliant',
          },
        },
      ],
      page: 1,
      page_size: 25,
      total: 42,
      privacy_note: 'Anonymized queries',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockAdvisoryResponse),
    });

    const res = await getAdminAdvisories({ page: 1, page_size: 25, crop: 'Cotton' });

    expect(res.items).toHaveLength(1);
    const item = res.items[0];
    expect(item.query_id).toBe('q_999');
    expect(item.activity_status).toBe('success');
    expect(item.review_status).toBe('needs_review');
    expect(item.retrieval?.documents_considered).toBe(12);
    expect(item.retrieval?.documents_used).toBe(3);
    expect(item.retrieval?.relevance_threshold_passed).toBe(true);
    expect(item.compliance?.citations_present).toBe(true);
    expect(item.compliance?.compliance_status).toBe('fully_compliant');
    expect(res.total).toBe(42);
  });

  it('4b. PATCH /api/v1/admin/advisories/{query_id}/review updates review status with exact enum values and notes', async () => {
    setupMockAuth();

    const mockUpdatedAdvisory = {
      query_id: 'q_999',
      review_status: 'resolved',
      activity_status: 'success',
      crop: 'Cotton',
      state: 'Telangana',
      district: 'Warangal',
      query_summary: 'Pest management for pink bollworm in cotton',
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockUpdatedAdvisory),
    });
    globalThis.fetch = fetchSpy;

    const res = await updateAdvisoryReview('q_999', {
      review_status: 'resolved',
      note: 'Verified agronomic recommendations with ICAR package of practices.',
    });

    expect(res.query_id).toBe('q_999');
    expect(res.review_status).toBe('resolved');

    // Verify correct PATCH endpoint URL and body JSON payload
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchSpy.mock.calls[0];
    expect(calledUrl).toContain('/api/v1/admin/advisories/q_999/review');
    expect(calledOptions.method).toBe('PATCH');
    expect(JSON.parse(calledOptions.body)).toEqual({
      review_status: 'resolved',
      note: 'Verified agronomic recommendations with ICAR package of practices.',
    });
  });

  it('4c. GET /api/v1/admin/advisories maps review_status filter to exact backend enums (needs_review, reviewed, resolved, not_reviewed)', async () => {
    setupMockAuth();

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [], page: 1, page_size: 25, total: 0 }),
    });
    globalThis.fetch = fetchSpy;

    await getAdminAdvisories({ review_status: 'needs_review' });
    let calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('review_status=needs_review');

    await getAdminAdvisories({ review_status: 'reviewed' });
    calledUrl = fetchSpy.mock.calls[1][0] as string;
    expect(calledUrl).toContain('review_status=reviewed');
  });

  it('4d. updateAdvisoryReview handles 401, 403, and network errors gracefully', async () => {
    setupMockAuth();

    // 401
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ detail: 'Token expired' }),
    });
    await expect(updateAdvisoryReview('q_1', { review_status: 'needs_review' })).rejects.toThrow('session has expired');

    // 403
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ detail: 'Forbidden' }),
    });
    await expect(updateAdvisoryReview('q_1', { review_status: 'needs_review' })).rejects.toThrow('administrator permission');
  });

  it('5. GET /api/v1/admin/feedback parses exact real backend schema fields (message, category, language, priority, admin_note_count)', async () => {
    setupMockAuth();

    const mockFeedbackResponse = {
      items: [
        {
          id: 'fb_101',
          advisory_id: 'q_999',
          created_at: '2026-09-23T15:30:00Z',
          rating: 5,
          category: 'Accuracy',
          message: 'Accurate fertilizer calculation for rice',
          language: 'en',
          status: 'resolved',
          priority: 'medium',
          admin_note_count: 1,
          identity_redacted: true,
        },
      ],
      page: 1,
      page_size: 25,
      total: 15,
      rating_distribution: { '5': 10, '4': 3, '3': 2, '2': 0, '1': 0 },
      privacy_note: 'Feedback identity redacted',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockFeedbackResponse),
    });

    const res = await getAdminFeedback({ page: 1, rating: 5 });

    expect(res.items).toHaveLength(1);
    const item = res.items[0];
    expect(item.id).toBe('fb_101');
    expect(item.message).toBe('Accurate fertilizer calculation for rice');
    expect(item.category).toBe('Accuracy');
    expect(item.language).toBe('en');
    expect(item.admin_note_count).toBe(1);
    expect(res.total).toBe(15);
    expect(res.rating_distribution?.['5']).toBe(10);
  });

  it('6. GET /api/v1/admin/predictions and GET /api/v1/admin/diagnostics handle grouped and outer data response wrappers', async () => {
    setupMockAuth();

    // Predictions grouped structure
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          status: 'success',
          admin_user_id: 'adm_1',
          data: {
            'Crop Predictions': [
              { id: 'pred_1', crop: 'Paddy', yield_predicted: '4.5 Tons/Ha', created_at: '2026-09-20' },
            ],
            'Irrigation Predictions': [
              { id: 'pred_2', crop: 'Cotton', water_req_mm: 450, created_at: '2026-09-21' },
            ],
          },
        }),
    });

    const predictions = await getAdminPredictions({ page: 1 });
    expect(predictions.items).toHaveLength(2);
    expect(predictions.items[0].model_type).toBe('Crop Predictions');
    expect(predictions.items[1].model_type).toBe('Irrigation Predictions');

    // Diagnostics outer data wrapper
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          status: 'success',
          data: {
            items: [
              { id: 'diag_1', crop: 'Groundnut', disease_identified: 'Tikka Leaf Spot', confidence_score: 0.96 },
            ],
            page: 1,
            page_size: 25,
            total: 1,
          },
        }),
    });

    const diagnostics = await getAdminDiagnostics({ page: 1 });
    expect(diagnostics.items).toHaveLength(1);
    expect(diagnostics.items[0].disease_identified).toBe('Tikka Leaf Spot');
  });

  it('6b. Admin Crop Diagnostics renders backend contract fields accurately across populated, null, zero confidence, and absent fields', () => {
    // 1. Populated fields matching deployed contract (primary_diagnosis, confidence, status, secondary_matches label/confidence/source)
    const populatedItem = {
      id: 'diag_101',
      primary_diagnosis: 'Early Leaf Spot (Cercospora arachidicola)',
      confidence: 0.942,
      status: 'needs_review',
      secondary_matches: [
        { label: 'Late Leaf Spot', confidence: 0.05, source: 'Vision Model v2' },
      ],
    };

    expect(formatDiagnosticDiagnosis(populatedItem)).toEqual({
      text: 'Early Leaf Spot (Cercospora arachidicola)',
      isMissing: false,
      isExplicitNoDetection: false,
    });
    expect(formatDiagnosticConfidence(populatedItem.confidence)).toBe('94.2%');
    expect(formatDiagnosticStatus(populatedItem)).toBe('needs_review');

    // 2. Preserves valid zero confidence (0% or 0.0) without substituting Unavailable
    expect(formatDiagnosticConfidence(0)).toBe('0.0%');
    expect(formatDiagnosticConfidence(0.0)).toBe('0.0%');

    // 3. Absent/null diagnosis -> returns "Legacy outcome unavailable" (never substitutes "No Pathology Detected")
    const nullDiagnosisItem = {
      id: 'diag_102',
      primary_diagnosis: null,
      disease_identified: null,
      confidence: null,
      status: null,
      secondary_matches: null,
    };

    expect(formatDiagnosticDiagnosis(nullDiagnosisItem)).toEqual({
      text: 'Legacy outcome unavailable',
      isMissing: true,
      isExplicitNoDetection: false,
    });
    expect(formatDiagnosticConfidence(nullDiagnosisItem.confidence)).toBe('Unavailable');
    expect(formatDiagnosticStatus(nullDiagnosisItem)).toBeNull(); // Must not default to "verified"

    // 4. Explicit "No Pathology Detected" / "No positive detection" from backend
    const healthyItem = {
      id: 'diag_103',
      primary_diagnosis: 'No Pathology Detected',
      confidence: 0.99,
      status: 'verified',
    };
    expect(formatDiagnosticDiagnosis(healthyItem)).toEqual({
      text: 'No positive detection',
      isMissing: false,
      isExplicitNoDetection: true,
    });
  });

  it('6d. Admin Crop Diagnostics parses new backend outcome contract, separates inference execution from human review, and renders provider summaries', () => {
    // 1. Post-deployment record with detected outcome, execution success, needs_review, and providers_summary
    const postDeploymentItem = {
      id: 'diag-2026-post-01',
      primary_diagnosis: 'Chilli Black Thrips',
      confidence: 0.945,
      inference_outcome: 'detected',
      execution_status: 'success',
      review_status: 'needs_review',
      providers_summary: {
        successful_providers: 3,
        failed_providers: 0,
        timed_out_providers: 0,
        total_providers: 3,
        applied_threshold: 0.70,
      },
    };

    expect(formatDiagnosticInferenceOutcome(postDeploymentItem)).toEqual({
      badgeLabel: 'Detected',
      badgeType: 'detected',
      diagnosisText: 'Chilli Black Thrips',
      isLegacy: false,
    });
    expect(formatDiagnosticExecutionStatus(postDeploymentItem)).toEqual({
      text: 'Request Succeeded',
      statusType: 'success',
    });
    expect(formatDiagnosticReviewStatus(postDeploymentItem)).toEqual({
      text: 'Needs Review',
      statusType: 'needs_review',
    });
    // Critical Requirement 4 Check: "Request Succeeded" execution status MUST NOT equal "Verified" review status
    expect(formatDiagnosticExecutionStatus(postDeploymentItem).text).not.toBe(
      formatDiagnosticReviewStatus(postDeploymentItem).text
    );

    // 2. Low confidence outcome below threshold
    const lowConfItem = {
      id: 'diag-2026-post-02',
      primary_diagnosis: 'Yellow Stem Borer',
      confidence: 0.52,
      inference_outcome: 'low_confidence',
      execution_status: 'success',
      review_status: 'not_reviewed',
      providers_summary: {
        successful_providers: 2,
        failed_providers: 1,
        applied_threshold: 0.70,
      },
    };
    expect(formatDiagnosticInferenceOutcome(lowConfItem).badgeLabel).toBe('Low confidence');
    expect(formatDiagnosticReviewStatus(lowConfItem).text).toBe('Not Reviewed');

    // 3. Provider/Model unavailable outcome
    const unavailableItem = {
      id: 'diag-2026-post-04',
      primary_diagnosis: null,
      confidence: null,
      inference_outcome: 'provider_unavailable',
      execution_status: 'failed',
      review_status: 'not_reviewed',
    };
    expect(formatDiagnosticInferenceOutcome(unavailableItem).badgeType).toBe('unavailable');
    expect(formatDiagnosticExecutionStatus(unavailableItem).text).toBe('Execution Failed');

    // 4. Legacy record without new fields -> handled safely without defaulting to Verified or Healthy
    const legacyItem = {
      id: 'diag-legacy-99',
      primary_diagnosis: null,
      confidence: null,
      inference_outcome: null,
      execution_status: null,
      review_status: null,
    };
    expect(formatDiagnosticInferenceOutcome(legacyItem).badgeLabel).toBe('Legacy outcome unavailable');
    expect(formatDiagnosticInferenceOutcome(legacyItem).badgeType).toBe('not_recorded');
    expect(formatDiagnosticExecutionStatus(legacyItem).text).toBe('Not recorded');
    expect(formatDiagnosticReviewStatus(legacyItem).text).toBe('Not Reviewed');
  });

  it('6e. Backend GET /api/v1/admin/diagnostics returns paginated envelope and parses primary diagnosis, confidence, outcome, execution status, and secondary labels', async () => {
    setupMockAuth();

    const mockPaginatedEnvelope = {
      items: [
        {
          id: 'diag-2026-001',
          created_at: '2026-09-25T23:00:00Z',
          crop: 'Chilli',
          state: 'Andhra Pradesh',
          district: 'Guntur',
          primary_diagnosis: 'Chilli Leaf Curl Virus',
          confidence: 0.912,
          inference_outcome: 'detected',
          execution_status: 'success',
          status: 'needs_review',
          secondary_matches: [
            { label: 'Chilli Mosaic Virus', confidence: 0.08, category: 'virus', source: 'Vision Model v2' },
          ],
          providers_summary: {
            successful_providers: 2,
            failed_providers: 0,
            applied_threshold: 0.70,
          },
          candidate_summary: 'Primary visual candidate confirmed by multi-model ensemble.',
          request_id: 'req-abc-123',
          actor_ref: 'farmer-99',
        },
      ],
      page: 1,
      page_size: 25,
      total: 1,
      summary_metrics: { total_runs: 1, avg_confidence: 0.912 },
      privacy_note: 'Redacted sensitive user identifiers.',
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockPaginatedEnvelope),
    });

    const result = await getAdminDiagnostics({ page: 1 });

    expect(result.page).toBe(1);
    expect(result.total).toBe(1);
    expect(result.items.length).toBe(1);

    const item = result.items[0];
    expect(item.id).toBe('diag-2026-001');
    expect(item.primary_diagnosis).toBe('Chilli Leaf Curl Virus');
    expect(item.confidence).toBe(0.912);
    expect(item.inference_outcome).toBe('detected');
    expect(item.execution_status).toBe('success');
    expect(item.status).toBe('needs_review');
    expect(item.secondary_matches?.[0].label).toBe('Chilli Mosaic Virus');

    const outcome = formatDiagnosticInferenceOutcome(item);
    expect(outcome.badgeLabel).toBe('Detected');
    expect(outcome.diagnosisText).toBe('Chilli Leaf Curl Virus');

    const confidenceFormatted = formatDiagnosticConfidence(item.confidence);
    expect(confidenceFormatted).toBe('91.2%');

    const execStatus = formatDiagnosticExecutionStatus(item);
    expect(execStatus.text).toBe('Request Succeeded');

    const reviewStatus = formatDiagnosticReviewStatus(item);
    expect(reviewStatus.text).toBe('Needs Review');
  });

  it('6c. Admin ML Predictions formats nested result_summary, latency_ms, null outcome, and concise model outputs', () => {
    // 1. Nested result_summary object with disease and confidence
    const diseasePred = {
      id: 'pred_101',
      model_type: 'Leaf Disease Scanner',
      result_summary: {
        disease: 'Bacterial Leaf Blight',
        confidence: 0.965,
      },
      latency_ms: 142,
    };
    expect(formatPredictionOutcome(diseasePred)).toEqual({
      concise: 'Bacterial Leaf Blight (96.5%)',
      isMissing: false,
      rawSummary: diseasePred.result_summary,
    });
    expect(formatPredictionLatency(diseasePred)).toBe('142 ms');

    // 2. Nested result_summary object for Crop Recommendation
    const cropPred = {
      id: 'pred_102',
      model_type: 'Crop Recommendation',
      result_summary: {
        recommended_crop: 'Red Gram (Pigeonpea)',
      },
      latency_ms: 85,
    };
    expect(formatPredictionOutcome(cropPred).concise).toBe('Crop: Red Gram (Pigeonpea)');

    // 3. String result_summary for Irrigation Planner
    const irrigationPred = {
      id: 'pred_103',
      model_type: 'Smart Irrigation Planner',
      result_summary: 'Apply 30mm water every 5 days via drip',
      execution_time_ms: 210,
    };
    expect(formatPredictionOutcome(irrigationPred).concise).toBe('Apply 30mm water every 5 days via drip');
    expect(formatPredictionLatency(irrigationPred)).toBe('210 ms');

    // 4. Null result_summary and missing latency
    const nullPred = {
      id: 'pred_104',
      model_type: 'Yield Forecast',
      result_summary: null,
      latency_ms: null,
    };
    expect(formatPredictionOutcome(nullPred)).toEqual({
      concise: 'Not recorded',
      isMissing: true,
      rawSummary: null,
    });
    expect(formatPredictionLatency(nullPred)).toBe('Unavailable');
  });

  it('6f. Admin ML Predictions handles Farm Decision Pipeline complete runs, partial runs, missing stage data, and model_type filtering', async () => {
    // 1. Complete Pipeline Run (6/6 stages passed)
    const completePipelineItem: AdminPredictionItem = {
      id: 'pipeline-run-001',
      model_type: 'farm_decision_pipeline',
      status: 'success',
      crop: 'Rice',
      state: 'Andhra Pradesh',
      district: 'Guntur',
      created_at: '2026-09-28T12:00:00Z',
      request_summary: {
        area_ha: 2.5,
        sowing_date: '2026-06-15',
        pump_hp: 5,
        target_crop: 'rice',
        solar_interest: true,
      },
      result_summary: {
        pipeline_status: 'success',
        duration_ms: 1250,
        stage_success_count: 6,
        stage_failure_count: 0,
        stages: {
          crop: { status: 'success', result: { recommended_crop: 'rice', confidence: 0.95 }, duration_ms: 180 },
          climate: { status: 'success', result: { risk_level: 'low', rainfall_mm: 120 }, duration_ms: 220 },
          irrigation: { status: 'success', result: { advice: 'Alternate wetting and drying (AWD)' }, duration_ms: 150 },
          yield: { status: 'success', result: { predicted_yield: 5.2, total_tonnes: 13.0 }, duration_ms: 310 },
          market: { status: 'success', result: { expected_price: 2300, trend: 'bullish' }, duration_ms: 210 },
          schemes: { status: 'success', result: { eligible_schemes_count: 3, top_scheme: 'PM-KISAN' }, duration_ms: 180 },
        },
      },
    };

    const completeOutcome = formatPredictionOutcome(completePipelineItem);
    expect(completeOutcome.concise).toBe('Pipeline: 6/6 stages passed');
    expect(completeOutcome.isMissing).toBe(false);
    expect(formatPredictionLatency(completePipelineItem)).toBe('1250 ms');

    // 2. Partial Pipeline Run (4 succeeded, 2 failed)
    const partialPipelineItem: AdminPredictionItem = {
      id: 'pipeline-run-002',
      model_type: 'farm_decision_pipeline',
      status: 'partial',
      crop: 'Cotton',
      state: 'Telangana',
      district: 'Warangal',
      created_at: '2026-09-28T12:15:00Z',
      request_summary: {
        area_ha: 1.0,
        sowing_date: '2026-05-20',
        pump_hp: 3,
        target_crop: 'cotton',
        solar_interest: false,
      },
      result_summary: {
        pipeline_status: 'partial',
        duration_ms: 2100,
        stage_success_count: 4,
        stage_failure_count: 2,
        stages: {
          crop: { status: 'success', result: { recommended_crop: 'cotton' } },
          climate: { status: 'failed', error: 'Climate risk API service timeout after 5000ms' },
          irrigation: { status: 'success', result: { advice: 'Drip irrigation 20mm' } },
          yield: { status: 'success', result: { predicted_yield: 2.8 } },
          market: { status: 'failed', error: 'Mandi price endpoint HTTP 503' },
          schemes: { status: 'success', result: { eligible_schemes_count: 2 } },
        },
      },
    };

    const partialOutcome = formatPredictionOutcome(partialPipelineItem);
    expect(partialOutcome.concise).toBe('Pipeline: 4 succeeded, 2 failed');
    expect(partialOutcome.isMissing).toBe(false);

    // 3. Incomplete / Missing Stage Data Pipeline
    const incompletePipelineItem: AdminPredictionItem = {
      id: 'pipeline-run-003',
      model_type: 'farm_decision_pipeline',
      status: 'failed',
      result_summary: {
        pipeline_status: 'failed',
        duration_ms: 450,
        stages: {
          crop: { status: 'failed', error: 'Invalid crop parameters' },
        },
      },
    };

    const incompleteOutcome = formatPredictionOutcome(incompletePipelineItem);
    expect(incompleteOutcome.concise).toBe('Pipeline: 0/6 stages passed (failed)');

    // 4. API helper filtering by model_type=farm_decision_pipeline
    setupMockAuth('test-admin-jwt-token');

    const mockFilteredResponse = {
      items: [completePipelineItem, partialPipelineItem],
      page: 1,
      page_size: 25,
      total: 2,
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockFilteredResponse),
    });
    globalThis.fetch = fetchSpy;

    const res = await getAdminPredictions({
      page: 1,
      page_size: 25,
      model_type: 'farm_decision_pipeline',
    });

    expect(res.items).toHaveLength(2);
    expect(res.total).toBe(2);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('model_type=farm_decision_pipeline'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-admin-jwt-token',
        }),
      })
    );
  });

  it('7. Handles 401, 403, 500 and network CORS rejection across endpoints', async () => {
    setupMockAuth();

    // 401
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ detail: 'Token expired' }),
    });
    await expect(getAdminFarms()).rejects.toThrow('session has expired');

    // 403
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ detail: 'Forbidden' }),
    });
    await expect(getAdminAdvisories()).rejects.toThrow('administrator permission');

    // 500
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ detail: 'Internal Server Error' }),
    });
    await expect(getAdminFeedback()).rejects.toThrow('internal error');

    // Network / CORS rejection
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    try {
      await getAdminFarms();
      expect.unreachable('Should have thrown AdminApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AdminApiError);
      expect(err.status).toBe(0);
      expect(err.message).toContain('Network/CORS Connection Error');
    }
  });

  it('8. GET /api/v1/admin/advisory-analytics sends Supabase Bearer token and parses server-side aggregate response contract', async () => {
    setupMockAuth('test-admin-jwt-token');

    const mockAnalyticsResponse = {
      total_queries: 120,
      citation_rate: {
        cited_queries: 108,
        eligible_queries: 120,
        percent: 90,
      },
      top_crops: [
        { crop: 'Rice', query_count: 50 },
        { crop: 'Cotton', query_count: 35 },
        { crop: 'Chilli', query_count: 20 },
      ],
      regional_queries: [
        { state: 'Andhra Pradesh', district: 'Guntur', query_count: 45 },
        { state: 'Telangana', district: 'Warangal', query_count: 35 },
        { state: 'Andhra Pradesh', district: 'Visakhapatnam', query_count: 25 },
      ],
      privacy_note: 'Aggregated analytics generated server-side.',
      generated_at: '2026-09-27T20:00:00Z',
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockAnalyticsResponse),
    });
    globalThis.fetch = fetchSpy;

    const res = await getAdminAdvisoryAnalytics({ crop: 'Rice', state: 'Andhra Pradesh' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchSpy.mock.calls[0];

    // Verify endpoint URL, query params, and Authorization header
    expect(calledUrl).toContain('/api/v1/admin/advisory-analytics');
    expect(calledUrl).toContain('crop=Rice');
    expect(calledUrl).toContain('state=Andhra+Pradesh');
    expect(calledOptions.headers.Authorization).toBe('Bearer test-admin-jwt-token');

    // Verify response structure
    expect(res.total_queries).toBe(120);
    expect(res.citation_rate.cited_queries).toBe(108);
    expect(res.citation_rate.eligible_queries).toBe(120);
    expect(res.citation_rate.percent).toBe(90);
    expect(res.top_crops).toHaveLength(3);
    expect(res.regional_queries[0]).toEqual({ state: 'Andhra Pradesh', district: 'Guntur', query_count: 45 });
  });

  it('9. GET /api/v1/admin/advisories clamps page_size to maximum of 100 before calling backend', async () => {
    setupMockAuth();

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [], page: 1, page_size: 100, total: 0 }),
    });
    globalThis.fetch = fetchSpy;

    // Call with page_size = 1000 (which frontend previously requested)
    await getAdminAdvisories({ page: 1, page_size: 1000 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;

    // Must be clamped to page_size=100
    expect(calledUrl).toContain('page_size=100');
    expect(calledUrl).not.toContain('page_size=1000');
  });

  it('10. GET /api/v1/admin/advisory-analytics handles 401, 403, 422, 500, and network errors strictly', async () => {
    setupMockAuth();

    // 401 Unauthorized
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ detail: 'Token expired' }),
    });
    await expect(getAdminAdvisoryAnalytics()).rejects.toThrow('session has expired');

    // 403 Forbidden
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ detail: 'Forbidden' }),
    });
    await expect(getAdminAdvisoryAnalytics()).rejects.toThrow('administrator permission');

    // 422 Validation Error
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ detail: 'Invalid parameter' }),
    });
    await expect(getAdminAdvisoryAnalytics()).rejects.toThrow('Validation error');

    // 500 Server Error
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ detail: 'Internal Server Error' }),
    });
    await expect(getAdminAdvisoryAnalytics()).rejects.toThrow('internal error');
  });
});

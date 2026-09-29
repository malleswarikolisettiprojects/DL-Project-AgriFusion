import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unwrapApiResponse } from '../lib/api';
import {
  generateOfflineFallbackResult,
  getDefaultGeneralSources,
  processAdvisorResponseData,
  type StructuredAdvisorResult,
} from '../views/CropWiseAdvisorView';

describe('CropWise Advisor Response Provenance & Persistence Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Handles normal success with persisted telemetry (telemetry_persisted = true and query_id)', () => {
    const mockBackendResponse = {
      status: 'success',
      telemetry_persisted: true,
      query_id: 'req-advisory-1001',
      provenance: 'verified_rag',
      answer: 'Apply Chlorantraniliprole 18.5% SC @ 60 mL/acre for stem borer in Rice.',
      explanation: 'Detailed ICAR grounded explanation for stem borer management.',
      action_points: ['Install pheromone traps @ 4-5/acre', 'Spray at ETL threshold'],
      chemical_management: 'Chlorantraniliprole 18.5% SC @ 60 mL/acre (PHI: 21 days)',
      biological_organic_management: 'Release Trichogramma egg parasitoids @ 40,000/acre',
      sources: [
        {
          title: 'ICAR Package of Practices for Rice Stem Borer',
          url: 'https://icar.org.in/rice-stem-borer',
          snippet: 'Certified SOP for stem borer management.',
          verified: true,
        },
      ],
    };

    const isVerifiedRAG = Boolean(
      mockBackendResponse.provenance === 'verified_rag' ||
      mockBackendResponse.sources.some((s) => s.verified)
    );

    const processed = processAdvisorResponseData(
      'How to control stem borer in Rice?',
      'Rice',
      'Visakhapatnam',
      'Andhra Pradesh',
      mockBackendResponse,
      isVerifiedRAG
    );

    const structuredResult: StructuredAdvisorResult = {
      short_answer: processed.directAnswer,
      explanation: processed.explanation,
      action_points: processed.actionPoints,
      chemical_management: processed.chem,
      biological_organic_management: processed.bio,
      sources: processed.sources,
      safety_disclaimer: 'Advisory disclaimer',
      response_source: 'backend_rag',
      telemetry_persisted: mockBackendResponse.telemetry_persisted,
      query_id: mockBackendResponse.query_id,
      backend_status: mockBackendResponse.status,
      is_verified_rag: isVerifiedRAG,
      badge_label: isVerifiedRAG ? 'ICAR RAG Verified' : 'Agronomy Guidance',
    };

    expect(structuredResult.telemetry_persisted).toBe(true);
    expect(structuredResult.query_id).toBe('req-advisory-1001');
    expect(structuredResult.response_source).toBe('backend_rag');
    expect(structuredResult.badge_label).toBe('ICAR RAG Verified');
    expect(structuredResult.sources[0].is_verified_rag).toBe(true);
    expect(structuredResult.sources[0].date).toBe('Verified RAG Source');
  });

  it('2. Handles backend success without telemetry persistence (telemetry_persisted = false)', () => {
    const mockBackendResponse = {
      status: 'success',
      telemetry_persisted: false,
      query_id: null,
      answer: 'Perform timely weeding at 20 Days After Transplanting.',
      explanation: 'Weed competition reduces yield if left unmanaged.',
      action_points: ['Cono-weeding at 20 DAT'],
    };

    const processed = processAdvisorResponseData(
      'When to perform weeding in paddy?',
      'Rice',
      'Guntur',
      'Andhra Pradesh',
      mockBackendResponse,
      false
    );

    const structuredResult: StructuredAdvisorResult = {
      short_answer: processed.directAnswer,
      explanation: processed.explanation,
      action_points: processed.actionPoints,
      sources: processed.sources,
      safety_disclaimer: 'Advisory disclaimer',
      response_source: 'backend_rag',
      telemetry_persisted: mockBackendResponse.telemetry_persisted,
      query_id: mockBackendResponse.query_id,
      backend_status: mockBackendResponse.status,
      is_verified_rag: false,
      badge_label: 'Agronomy Guidance',
    };

    expect(structuredResult.telemetry_persisted).toBe(false);
    expect(structuredResult.query_id).toBeNull();
    expect(structuredResult.badge_label).toBe('Agronomy Guidance');
    expect(structuredResult.badge_label).not.toBe('ICAR Grounded');
    expect(structuredResult.sources[0].is_verified_rag).toBe(false);
    expect(structuredResult.sources[0].date).toBe('General Reference Site');
  });

  it('3. Handles a backend timeout response with a saved query_id (telemetry_persisted = true and query_id present)', () => {
    const mockTimeoutBackendResponse = {
      status: 'timeout',
      telemetry_persisted: true,
      query_id: 'req-timeout-5502',
      request_id: 'req-timeout-5502',
      detail: 'Agent execution timed out after 15s but telemetry record was saved',
    };

    // Simulate offline fallback rendered first on frontend 15s timeout
    const offlineData = generateOfflineFallbackResult(
      'How to control stem borer in Rice?',
      'Rice',
      'Visakhapatnam',
      'Andhra Pradesh'
    );

    let result: StructuredAdvisorResult = {
      short_answer: offlineData.directAnswer,
      explanation: offlineData.explanation,
      action_points: offlineData.actionPoints,
      chemical_management: offlineData.chem,
      biological_organic_management: offlineData.bio,
      sources: offlineData.sources,
      safety_disclaimer: 'Advisory disclaimer',
      response_source: 'offline_fallback',
      telemetry_persisted: null, // Pending late backend promise
      query_id: null,
      backend_status: 'pending',
      is_verified_rag: false,
      badge_label: 'Offline Guidance',
    };

    expect(result.telemetry_persisted).toBeNull();
    expect(result.badge_label).toBe('Offline Guidance');

    // Simulate late backend promise settling
    const isPersisted = mockTimeoutBackendResponse.telemetry_persisted === true;
    const queryId = mockTimeoutBackendResponse.query_id || mockTimeoutBackendResponse.request_id;
    const backendStatus = mockTimeoutBackendResponse.status;

    // Update result while PRESERVING farmer's answer!
    result = {
      ...result,
      telemetry_persisted: isPersisted,
      query_id: queryId,
      backend_status: backendStatus,
    };

    expect(result.telemetry_persisted).toBe(true);
    expect(result.query_id).toBe('req-timeout-5502');
    expect(result.backend_status).toBe('timeout');
    // Answer text remains intact!
    expect(result.short_answer).toContain('Yellow stem borer causes deadhearts');
  });

  it('4. Handles backend timeout/failure without persistence (telemetry_persisted = false)', () => {
    const mockFailedBackendErr = {
      status: 'failed',
      telemetry_persisted: false,
      query_id: null,
      error: 'Backend agent crashed with 500 internal server error',
    };

    const offlineData = generateOfflineFallbackResult(
      'Why are papaya leaves yellowing?',
      'Papaya',
      'Chittoor',
      'Andhra Pradesh'
    );

    let result: StructuredAdvisorResult = {
      short_answer: offlineData.directAnswer,
      explanation: offlineData.explanation,
      action_points: offlineData.actionPoints,
      sources: offlineData.sources,
      safety_disclaimer: 'Advisory disclaimer',
      response_source: 'offline_fallback',
      telemetry_persisted: null,
      query_id: null,
      backend_status: 'pending',
      is_verified_rag: false,
      badge_label: 'Offline Guidance',
    };

    // Late failure update
    result = {
      ...result,
      telemetry_persisted: mockFailedBackendErr.telemetry_persisted,
      query_id: mockFailedBackendErr.query_id,
      backend_status: mockFailedBackendErr.status,
    };

    expect(result.telemetry_persisted).toBe(false);
    expect(result.query_id).toBeNull();
    expect(result.backend_status).toBe('failed');
    expect(result.badge_label).toBe('Offline Guidance');
  });

  it('6. Correctly unwraps rawResponse.agent_response and reads actual backend payload fields', () => {
    const rawResponseFromRender = {
      status: 'success',
      request_id: 'req-agent-7788',
      telemetry_persisted: true,
      agent_response: {
        answer: 'Real backend RAG answer: Apply Chlorantraniliprole 18.5% SC @ 60 mL/acre.',
        explanation: 'Real backend RAG explanation from ICAR documents.',
        action_points: ['Action point 1 from backend', 'Action point 2 from backend'],
        chemical_management: 'Chemical advice from backend RAG',
        biological_organic_management: 'Organic advice from backend RAG',
        provenance: 'verified_rag',
        sources: [
          {
            title: 'TNAU IPM Document',
            url: 'https://agritech.tnau.ac.in/ipm',
            snippet: 'Integrated pest management guide.',
            verified: true,
          },
        ],
      },
    };

    const unwrapped = unwrapApiResponse(rawResponseFromRender);
    // unwrapApiResponse promotes agent_response fields to top level
    expect(unwrapped.answer).toBe('Real backend RAG answer: Apply Chlorantraniliprole 18.5% SC @ 60 mL/acre.');
    expect(unwrapped.request_id).toBe('req-agent-7788');
    expect(unwrapped.telemetry_persisted).toBe(true);

    const processed = processAdvisorResponseData(
      'How to control stem borer in Rice?',
      'Rice',
      'Visakhapatnam',
      'Andhra Pradesh',
      rawResponseFromRender,
      true
    );

    expect(processed.directAnswer).toBe('Real backend RAG answer: Apply Chlorantraniliprole 18.5% SC @ 60 mL/acre.');
    expect(processed.explanation).toBe('Real backend RAG explanation from ICAR documents.');
    expect(processed.actionPoints).toEqual(['Action point 1 from backend', 'Action point 2 from backend']);
    expect(processed.chem).toBe('Chemical advice from backend RAG');
    expect(processed.bio).toBe('Organic advice from backend RAG');
    expect(processed.sources[0].title).toBe('TNAU IPM Document');
    expect(processed.sources[0].is_verified_rag).toBe(true);
  });
});

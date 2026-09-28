import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdvisoryAnalytics, getAdminAdvisories, AdminApiError } from '../lib/adminApi';
import { supabase } from '../lib/supabase';

describe('Admin Advisory Analytics & Paginated List Helper Suite', () => {
  const setupMockAuth = (token = 'secret-supabase-jwt-123') => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: { access_token: token } as any,
      },
      error: null,
    });
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const createMockResponse = (data: any, ok = true, status = 200) => {
    const jsonStr = JSON.stringify(data);
    return {
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      text: async () => jsonStr,
      json: async () => data,
    };
  };

  it('sends Supabase Bearer token and calls /api/v1/admin/advisory-analytics with filter params', async () => {
    setupMockAuth('secret-supabase-jwt-123');

    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse({
        total_queries: 150,
        citation_rate: {
          cited_queries: 120,
          eligible_queries: 150,
          percent: 80.0,
        },
        top_crops: [{ crop: 'Rice', query_count: 90 }],
        regional_queries: [{ state: 'Andhra Pradesh', district: 'Guntur', query_count: 60 }],
        privacy_note: 'Groups with fewer than 3 queries are suppressed for privacy protection.',
        generated_at: '2026-09-28T09:00:00Z',
      })
    );
    globalThis.fetch = mockFetch;

    const analytics = await getAdvisoryAnalytics({
      crop: 'Rice',
      state: 'Andhra Pradesh',
      district: 'Guntur',
      start_date: '2026-09-01',
      end_date: '2026-09-28',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/v1/admin/advisory-analytics');
    expect(url).toContain('crop=Rice');
    expect(url).toContain('state=Andhra+Pradesh');
    expect(url).toContain('district=Guntur');
    expect(url).toContain('start_date=2026-09-01');
    expect(url).toContain('end_date=2026-09-28');

    expect(options.headers.Authorization).toBe('Bearer secret-supabase-jwt-123');

    expect(analytics.total_queries).toBe(150);
    expect(analytics.citation_rate.percent).toBe(80.0);
    expect(analytics.regional_queries[0]).toEqual({
      state: 'Andhra Pradesh',
      district: 'Guntur',
      query_count: 60,
    });
  });

  it('handles dataset with > 100 queries without truncation in analytics response', async () => {
    setupMockAuth();

    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({
        total_queries: 1500, // > 100 queries
        citation_rate: {
          cited_queries: 1200,
          eligible_queries: 1500,
          percent: 80.0,
        },
        top_crops: [{ crop: 'Rice', query_count: 1000 }],
        regional_queries: [{ state: 'Andhra Pradesh', district: 'Guntur', query_count: 500 }],
        privacy_note: 'Protected',
        generated_at: '2026-09-28T09:00:00Z',
      })
    );

    const res = await getAdvisoryAnalytics();
    expect(res.total_queries).toBe(1500);
    expect(res.top_crops[0].query_count).toBe(1000);
  });

  it('clamps list page_size strictly to 1..100 when high page_size (e.g. 1000) is passed', async () => {
    setupMockAuth();

    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse({
        items: [],
        total: 0,
        page: 1,
        page_size: 100,
        total_pages: 0,
      })
    );
    globalThis.fetch = mockFetch;

    // Call getAdminAdvisories with page_size = 1000
    await getAdminAdvisories({ page: 1, page_size: 1000 });

    const [url] = mockFetch.mock.calls[0];
    // Must be clamped to 100, NOT 1000
    expect(url).toContain('page_size=100');
    expect(url).not.toContain('page_size=1000');
  });

  it('handles 401 Unauthorized with correct AdminApiError', async () => {
    setupMockAuth();

    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ detail: 'Token expired' }, false, 401)
    );

    try {
      await getAdvisoryAnalytics();
      expect.fail('Should have thrown AdminApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AdminApiError);
      expect(err.status).toBe(401);
      expect(err.message).toContain('session has expired');
    }
  });

  it('handles 403 Forbidden with correct AdminApiError', async () => {
    setupMockAuth();

    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ detail: 'Forbidden - Admin Access Required' }, false, 403)
    );

    try {
      await getAdvisoryAnalytics();
      expect.fail('Should have thrown AdminApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AdminApiError);
      expect(err.status).toBe(403);
      expect(err.message).toContain('administrator permission');
    }
  });

  it('handles 422 Validation Error with safe backend error details', async () => {
    setupMockAuth();

    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(
        { detail: [{ loc: ['query', 'days'], msg: 'ensure this value is greater than 0' }] },
        false,
        422
      )
    );

    try {
      await getAdvisoryAnalytics();
      expect.fail('Should have thrown AdminApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AdminApiError);
      expect(err.status).toBe(422);
      expect(err.message).toContain('ensure this value is greater than 0');
    }
  });

  it('throws malformed response error when 200 OK returns invalid shape missing total_queries', async () => {
    setupMockAuth();

    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ invalid_payload: true }, true, 200)
    );

    try {
      await getAdvisoryAnalytics();
      expect.fail('Should have thrown AdminApiError for malformed response');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AdminApiError);
      expect(err.status).toBe(200);
      expect(err.message).toContain('Malformed aggregate advisory analytics contract response');
    }
  });

  it('handles 500 Server Error safely', async () => {
    setupMockAuth();

    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ detail: 'Database pool exhausted' }, false, 500)
    );

    try {
      await getAdvisoryAnalytics();
      expect.fail('Should have thrown AdminApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AdminApiError);
      expect(err.status).toBe(500);
      expect(err.message).toContain('internal error');
    }
  });

  it('handles network/CORS rejection safely', async () => {
    setupMockAuth();

    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    try {
      await getAdvisoryAnalytics();
      expect.fail('Should have thrown network AdminApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AdminApiError);
      expect(err.status).toBe(0);
      expect(err.message).toContain('Network/CORS Connection Error');
    }
  });
});

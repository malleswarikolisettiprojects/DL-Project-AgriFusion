import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  API_BASE_URL,
  AdminApiError,
  adminRequest,
  getAdminSources,
  getAdminSchemes,
  registerSource,
  updateSource,
  reindexSource,
  registerScheme,
  verifyScheme,
  updateScheme,
  recheckScheme,
} from '../lib/adminApi';
import { supabase } from '../lib/supabase';
import type {
  KnowledgeSource,
  GovernmentScheme,
  SourcesResponse,
  SchemesResponse,
} from '../types';

describe('Admin Sources and Schemes API Integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // 1. API_BASE_URL sanitization
  it('1. API_BASE_URL strips trailing slashes, /docs, /openapi.json, and /api', () => {
    expect(API_BASE_URL).not.toMatch(/\/$/);
    expect(API_BASE_URL).not.toMatch(/\/docs$/);
    expect(API_BASE_URL).not.toMatch(/\/openapi\.json$/);
    expect(API_BASE_URL).not.toMatch(/\/api$/);
    expect(API_BASE_URL).toContain('dl-project-agrifusion-backend.onrender.com');
  });

  // 2. Bearer token in requests
  it('2. Requests include the Supabase Bearer token in Authorization header', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'fake-supabase-jwt-token-12345',
        } as any,
      },
      error: null,
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [], total: 0, page: 1, page_size: 8 }),
    });

    await getAdminSources();

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/admin/sources`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer fake-supabase-jwt-token-12345',
        }),
      })
    );
  });

  // 3. Missing session throws authentication error
  it('3. Missing Supabase session throws authentication error safely', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    await expect(getAdminSources()).rejects.toThrow('Authentication required. Please sign in again.');
  });

  // 4. HTTP 401 is handled safely
  it('4. HTTP 401 is handled safely with session expired message', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'expired-token' } as any,
      },
      error: null,
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ detail: 'Token expired' }),
    });

    await expect(getAdminSources()).rejects.toThrow('Your session has expired. Please sign in again.');
  });

  // 5. HTTP 403 displays access denied
  it('5. HTTP 403 displays administrator permission denied', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'non-admin-token' } as any,
      },
      error: null,
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ detail: 'Forbidden' }),
    });

    await expect(getAdminSources()).rejects.toThrow('You do not have administrator permission.');
  });

  // 6. HTTP 404 displays API unavailable state
  it('6. HTTP 404 displays backend endpoint not available yet', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'valid-token' } as any,
      },
      error: null,
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ detail: 'Not Found' }),
    });

    await expect(getAdminSources()).rejects.toThrow('This admin backend endpoint is not available yet.');
  });

  // 7. HTTP 422 validation errors handled safely
  it('7. HTTP 422 validation errors extract detail safely without crash', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'valid-token' } as any,
      },
      error: null,
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () =>
        JSON.stringify({
          detail: [{ loc: ['body', 'official_url'], msg: 'URL must start with https://' }],
        }),
    });

    await expect(
      registerSource({
        title: 'Test Source',
        organization: 'ANGRAU',
        source_type: 'agricultural_university',
        official_url: 'http://insecure.org',
      })
    ).rejects.toThrow('Validation error (422)');
  });

  // 8. Sources fetched with search and filter query parameters
  it('8. Sources are fetched with search and filter query parameters', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'valid-token' } as any,
      },
      error: null,
    });

    const mockResponse: SourcesResponse = {
      items: [
        {
          id: 'source-1',
          title: 'ANGRAU Rice Production Manual',
          organization: 'ANGRAU',
          source_type: 'agricultural_university',
          official_url: 'https://angrau.ac.in/rice.pdf',
          verification_status: 'verified',
          index_status: 'indexed',
        },
      ],
      page: 1,
      page_size: 10,
      total: 1,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockResponse),
    });

    const result = await getAdminSources({
      page: 1,
      page_size: 10,
      search: 'rice',
      organization: 'ANGRAU',
      verification_status: 'verified',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/admin/sources?page=1&page_size=10&search=rice&organization=ANGRAU&verification_status=verified`,
      expect.anything()
    );
    expect(result.items.length).toBe(1);
    expect(result.items[0].title).toBe('ANGRAU Rice Production Manual');
    expect(result.total).toBe(1);
  });

  // 9. Schemes fetched with query parameters
  it('9. Schemes are fetched with search and filter query parameters', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'valid-token' } as any,
      },
      error: null,
    });

    const mockResponse: SchemesResponse = {
      items: [
        {
          id: 'scheme-1',
          scheme_name: 'YSR Rythu Bharosa',
          scheme_type: 'Direct Income Support',
          department: 'Department of Agriculture, Govt. of Andhra Pradesh',
          official_portal: 'https://ysrrythubharosa.ap.gov.in',
          verification_status: 'verified',
          current_status: 'active',
          benefit_summary: '₹13,500/year to land-owning and tenant farmers',
        },
      ],
      page: 1,
      page_size: 8,
      total: 1,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockResponse),
    });

    const result = await getAdminSchemes({
      state: 'Andhra Pradesh',
      current_status: 'active',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/admin/schemes?state=Andhra+Pradesh&current_status=active`,
      expect.anything()
    );
    expect(result.items.length).toBe(1);
    expect(result.items[0].scheme_name).toBe('YSR Rythu Bharosa');
  });

  // 10. Empty source response returns clean items
  it('10. Empty source response returns clean empty array without inventing records', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'valid-token' } as any,
      },
      error: null,
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [], page: 1, page_size: 8, total: 0 }),
    });

    const res = await getAdminSources();
    expect(res.items).toEqual([]);
    expect(res.total).toBe(0);
  });

  // 11. Empty scheme response returns clean items
  it('11. Empty scheme response returns clean empty array without inventing records', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'valid-token' } as any,
      },
      error: null,
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [], page: 1, page_size: 8, total: 0 }),
    });

    const res = await getAdminSchemes();
    expect(res.items).toEqual([]);
    expect(res.total).toBe(0);
  });

  // 12. Register source calls POST /api/v1/admin/sources/register
  it('12. Register source sends valid JSON payload to backend', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'valid-token' } as any,
      },
      error: null,
    });

    const newSource: KnowledgeSource = {
      id: 'source-new',
      title: 'PJTSAU Cotton Advisory 2024',
      organization: 'PJTSAU',
      source_type: 'agricultural_university',
      official_url: 'https://pjtsau.edu.in/cotton.pdf',
      verification_status: 'pending_review',
      index_status: 'queued',
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      text: async () => JSON.stringify(newSource),
    });

    const created = await registerSource({
      title: 'PJTSAU Cotton Advisory 2024',
      organization: 'PJTSAU',
      source_type: 'agricultural_university',
      official_url: 'https://pjtsau.edu.in/cotton.pdf',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/admin/sources/register`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'PJTSAU Cotton Advisory 2024',
          organization: 'PJTSAU',
          source_type: 'agricultural_university',
          official_url: 'https://pjtsau.edu.in/cotton.pdf',
        }),
      })
    );
    expect(created.id).toBe('source-new');
  });

  // 13. Reindex source calls POST /api/v1/admin/sources/{id}/reindex
  it('13. Reindex source calls POST /api/v1/admin/sources/{id}/reindex and returns queued status', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'valid-token' } as any,
      },
      error: null,
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          message: 'Re-indexing queued successfully.',
          source_id: 'src-123',
          status: 'queued',
        }),
    });

    const res = await reindexSource('src-123');
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/admin/sources/src-123/reindex`,
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(res.message).toBe('Re-indexing queued successfully.');
  });

  // 14. Verify scheme calls POST /api/v1/admin/schemes/{id}/verify
  it('14. Verify scheme calls POST /api/v1/admin/schemes/{id}/verify with verified portal URL', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'valid-token' } as any,
      },
      error: null,
    });

    const verifiedScheme: GovernmentScheme = {
      id: 'sch-999',
      scheme_name: 'PM-KISAN',
      scheme_type: 'Direct Income Support',
      department: 'DA&FW',
      official_portal: 'https://pmkisan.gov.in',
      verification_status: 'verified',
      current_status: 'active',
      verified_date: '2026-09-22T10:00:00Z',
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(verifiedScheme),
    });

    const verified = await verifyScheme('sch-999', {
      official_source_url: 'https://pmkisan.gov.in',
      verification_notes: 'Verified against 18th installment guidelines.',
      current_status: 'active',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/admin/schemes/sch-999/verify`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          official_source_url: 'https://pmkisan.gov.in',
          verification_notes: 'Verified against 18th installment guidelines.',
          current_status: 'active',
        }),
      })
    );
    expect(verified.verification_status).toBe('verified');
  });

  // 15. Recheck scheme calls POST /api/v1/admin/schemes/{id}/recheck
  it('15. Recheck scheme calls POST /api/v1/admin/schemes/{id}/recheck', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'valid-token' } as any,
      },
      error: null,
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ message: 'Portal recheck completed.', status: 'active' }),
    });

    const res = await recheckScheme('sch-999');
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/v1/admin/schemes/sch-999/recheck`,
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(res.message).toBe('Portal recheck completed.');
  });

  // 16. FormData support without automatic Content-Type: application/json
  it('16. FormData requests omit automatic Content-Type: application/json', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'valid-token' } as any,
      },
      error: null,
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
    });

    const formData = new FormData();
    formData.append('sample', 'value');

    await adminRequest('/api/v1/test', {
      method: 'POST',
      body: formData,
    });

    const callArgs = (global.fetch as any).mock.calls[0][1];
    expect(callArgs.headers['Content-Type']).toBeUndefined();
    expect(callArgs.headers['Authorization']).toBe('Bearer valid-token');
  });

  // 17. Security: No secrets or tokens rendered in error messages
  it('17. Security: Errors do not leak secret token or headers', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: {
        session: { access_token: 'super-secret-token-xyz' } as any,
      },
      error: null,
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    try {
      await getAdminSources();
    } catch (err: any) {
      expect(err.message).not.toContain('super-secret-token-xyz');
      expect(JSON.stringify(err)).not.toContain('super-secret-token-xyz');
    }
  });

  // 18. AdminSources distinguishes failed fetch vs successful empty response
  it('18. GET /api/v1/admin/sources distinguishes failed fetch vs successful empty response', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: { access_token: 'valid-token' } as any,
      },
      error: null,
    });

    // Case A: Successful fetch with empty items array
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [], total: 0, page: 1, page_size: 8 }),
    });

    const emptyRes = await getAdminSources();
    expect(emptyRes.items).toEqual([]);
    expect(emptyRes.total).toBe(0);

    // Case B: Network/500 failure throws AdminApiError and preserves error
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ detail: 'Database connection failed' }),
    });

    await expect(getAdminSources()).rejects.toThrow('The backend encountered an internal error.');
  });

  // 19. AdminSchemes distinguishes failed fetch vs successful empty response
  it('19. GET /api/v1/admin/schemes distinguishes failed fetch vs successful empty response', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: { access_token: 'valid-token' } as any,
      },
      error: null,
    });

    // Case A: Successful fetch with empty items array
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [], total: 0, page: 1, page_size: 8 }),
    });

    const emptyRes = await getAdminSchemes();
    expect(emptyRes.items).toEqual([]);
    expect(emptyRes.total).toBe(0);

    // Case B: Network/500 failure throws AdminApiError and preserves error
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ detail: 'Database connection failed' }),
    });

    await expect(getAdminSchemes()).rejects.toThrow('The backend encountered an internal error.');
  });
});

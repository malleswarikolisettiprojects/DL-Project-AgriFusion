import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminUsers, API_BASE_URL, AdminApiError } from '../lib/adminApi';
import { supabase } from '../lib/supabase';

describe('Admin Users API tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends request directly to intended FastAPI host with Authorization header', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-supabase-jwt-token',
        } as any,
      },
      error: null,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [], page: 1, page_size: 25, total: 0 }),
    });
    globalThis.fetch = mockFetch;

    await getAdminUsers({ page: 1, page_size: 25, search: 'test', role: 'admin', status: 'active' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [requestedUrl, options] = mockFetch.mock.calls[0];

    expect(requestedUrl).toBe(`${API_BASE_URL}/api/v1/admin/users?page=1&page_size=25&search=test&role=admin&status=active`);
    expect(options.headers.Authorization).toBe('Bearer mock-supabase-jwt-token');
  });

  it('correctly parses valid non-empty paginated response {items, page, page_size, total}', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-jwt',
        } as any,
      },
      error: null,
    });

    const mockResponseData = {
      items: [
        {
          id: 'usr_1',
          name: 'Jane Farmer',
          email: 'jane@example.com',
          role: 'farmer',
          created_at: '2026-01-01T00:00:00Z',
          last_sign_in_at: '2026-09-20T10:00:00Z',
          status: 'active',
        },
      ],
      page: 1,
      page_size: 25,
      total: 100,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockResponseData),
    });

    const result = await getAdminUsers({ page: 1, page_size: 25 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('usr_1');
    expect(result.items[0].last_sign_in_at).toBe('2026-09-20T10:00:00Z');
    expect(result.total).toBe(100);
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(25);
  });

  it('handles valid empty response {items: [], total: 0}', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-jwt',
        } as any,
      },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [], page: 1, page_size: 25, total: 0 }),
    });

    const result = await getAdminUsers({ search: 'nonexistent' });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(25);
  });

  it('rejects malformed/unexpected response with a distinct AdminApiError instead of converting to empty list', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-jwt',
        } as any,
      },
      error: null,
    });

    // Malformed JSON payload without items array
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: 'success', data: null }),
    });

    await expect(getAdminUsers()).rejects.toThrow('Unexpected API response structure');
  });

  it('throws 401 error on unauthenticated request', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'expired-jwt',
        } as any,
      },
      error: null,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ detail: 'Token expired' }),
    });
    globalThis.fetch = mockFetch;

    await expect(getAdminUsers()).rejects.toThrow('Your session has expired. Please sign in again.');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE_URL}/api/v1/admin/users`);
  });

  it('handles 403 forbidden error cleanly without fallback', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'non-admin-jwt',
        } as any,
      },
      error: null,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ detail: 'Admin access required' }),
    });
    globalThis.fetch = mockFetch;

    await expect(getAdminUsers()).rejects.toThrow('permission');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles 500 internal server error properly', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-jwt',
        } as any,
      },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ detail: 'Internal Server Error' }),
    });

    await expect(getAdminUsers()).rejects.toThrow('internal error');
  });

  it('handles network / CORS failure (fetch rejection)', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-jwt',
        } as any,
      },
      error: null,
    });

    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    try {
      await getAdminUsers();
      expect.unreachable('Should have thrown AdminApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AdminApiError);
      expect(err.status).toBe(0);
      expect(err.message).toContain('Network/CORS Connection Error');
    }
  });

  it('allows refreshing the user list after a successful response', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-jwt',
        } as any,
      },
      error: null,
    });

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            items: [
              {
                id: `usr_${callCount}`,
                name: `User ${callCount}`,
                email: `user${callCount}@example.com`,
                role: 'farmer',
                status: 'active',
              },
            ],
            page: 1,
            page_size: 25,
            total: callCount,
          }),
      };
    });

    const first = await getAdminUsers({ page: 1 });
    expect(first.items[0].id).toBe('usr_1');
    expect(first.total).toBe(1);

    const second = await getAdminUsers({ page: 1 });
    expect(second.items[0].id).toBe('usr_2');
    expect(second.total).toBe(2);
  });
});

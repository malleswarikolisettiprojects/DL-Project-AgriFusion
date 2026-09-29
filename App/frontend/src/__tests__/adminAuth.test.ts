import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminApiError, verifyAdminAccess } from '../lib/adminApi';
import * as auth from '../lib/auth';

describe('AdminApiError', () => {
  it('correctly captures status code and message', () => {
    const error = new AdminApiError('User does not have admin role', 403, { code: 'FORBIDDEN' });
    expect(error.status).toBe(403);
    expect(error.message).toBe('User does not have admin role');
    expect(error.data).toEqual({ code: 'FORBIDDEN' });
  });

  it('provides safe default message', () => {
    const error = new AdminApiError('Not Found', 404);
    expect(error.message).toBe('Not Found');
    expect(error.status).toBe(404);
  });
});

describe('verifyAdminAccess', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns unauthenticated when there is no active session', async () => {
    vi.spyOn(auth, 'getSession').mockResolvedValue(null);
    const result = await verifyAdminAccess();
    expect(result.status).toBe('unauthenticated');
  });

  it('returns forbidden when backend responds with HTTP 403', async () => {
    vi.spyOn(auth, 'getSession').mockResolvedValue({
      access_token: 'valid-jwt-token',
      user: { id: 'u1', email: 'farmer@example.com' },
    } as any);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: vi.fn().mockResolvedValue('{"detail":"Forbidden: Admin access required"}'),
      json: vi.fn().mockResolvedValue({ detail: 'Forbidden: Admin access required' }),
    } as any);

    const result = await verifyAdminAccess();
    expect(result.status).toBe('forbidden');
  });

  it('returns not_configured when backend auth endpoints are not deployed (HTTP 404)', async () => {
    vi.spyOn(auth, 'getSession').mockResolvedValue({
      access_token: 'valid-jwt-token',
      user: { id: 'u1', email: 'admin@agrifusion.org' },
    } as any);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: vi.fn().mockResolvedValue('{"detail":"Not Found"}'),
      json: vi.fn().mockResolvedValue({ detail: 'Not Found' }),
    } as any);

    const result = await verifyAdminAccess();
    expect(result.status).toBe('not_configured');
  });

  it('returns authenticated when backend verifies admin role with 200 OK', async () => {
    vi.spyOn(auth, 'getSession').mockResolvedValue({
      access_token: 'valid-admin-jwt',
      user: { id: 'admin-123', email: 'director@agrifusion.org' },
    } as any);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          id: 'admin-123',
          email: 'director@agrifusion.org',
          role: 'admin',
          authenticated: true,
        })
      ),
      json: vi.fn().mockResolvedValue({
        id: 'admin-123',
        email: 'director@agrifusion.org',
        role: 'admin',
        authenticated: true,
      }),
    } as any);

    const result = await verifyAdminAccess();
    expect(result.status).toBe('authenticated');
    if (result.status === 'authenticated') {
      expect(result.user.email).toBe('director@agrifusion.org');
      expect(result.user.role).toBe('admin');
    }
  });
});

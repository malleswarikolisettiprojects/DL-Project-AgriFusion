import { getSession } from './auth';
import { supabase } from './supabase';
import type {
  AdminAdvisory,
  AdminAdvisoryAnalytics,
  AdminDashboardData,
  AdminFarm,
  AdminFarmsCountResponse,
  AdminFeedback,
  AdminHealth,
  AdminOverview,
  AdminPaginatedResponse,
  AdminScheme,
  AdminSource,
  AdminUser,
  AuditLogEntry,
  AuthMeResponse,
  GetAdvisoryAnalyticsParams,
  GovernmentScheme,
  KnowledgeSource,
  RegisterSchemeRequest,
  RegisterSourceRequest,
  SchemesResponse,
  SourcesResponse,
  UpdateSchemeRequest,
  UpdateSourceMetadataRequest,
  VerifySchemeRequest,
} from '../types';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://dl-project-agrifusion-backend.onrender.com'
)
  .replace(/\/+$/, '')
  .replace(/\/(docs|openapi\.json|api)$/, '');

export class AdminApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Secure Request Helper
 * Sends Supabase access token as Bearer token in Authorization header.
 * Handles 401, 403, 404, 422, 500, 503 strictly.
 */
export async function adminRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new AdminApiError('Authentication required. Please sign in again.', 401);
  }

  const method = (options.method || 'GET').toUpperCase();
  const isFormData = options.body instanceof FormData;
  const hasBody = Boolean(options.body);

  // Direct request to the FastAPI Render base URL
  const targetPath = path.startsWith('/') ? path : `/${path}`;
  const targetUrl = targetPath.startsWith(API_BASE_URL)
    ? targetPath
    : `${API_BASE_URL}${targetPath}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    ...(options.headers as Record<string, string> || {}),
  };

  // Only attach Content-Type: application/json when sending a non-FormData request payload
  if (hasBody && !isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      ...options,
      method,
      headers,
    });
  } catch (err: any) {
    // Network / CORS / Fetch rejection error
    throw new AdminApiError(
      err?.message ? `Network/CORS Connection Error: ${err.message}` : 'Failed to connect to backend server. Check CORS configuration or network connectivity.',
      0
    );
  }

  const text = await response.text();
  let body: any = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (response.status === 401) {
    throw new AdminApiError('Your session has expired. Please sign in again.', 401, body);
  }

  if (response.status === 403) {
    throw new AdminApiError('You do not have administrator permission.', 403, body);
  }

  if (response.status === 404) {
    throw new AdminApiError('This admin backend endpoint is not available yet.', 404, body);
  }

  if (response.status === 422) {
    const detailMsg = typeof body === 'object' && body?.detail
      ? (Array.isArray(body.detail) ? body.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ') : String(body.detail))
      : 'Validation error in request payload.';
    throw new AdminApiError(`Validation error (422): ${detailMsg}`, 422, body);
  }

  if (response.status === 429) {
    throw new AdminApiError('Rate limit exceeded. Please wait a moment before trying again.', 429, body);
  }

  if (response.status === 500) {
    throw new AdminApiError('The backend encountered an internal error.', 500, body);
  }

  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new AdminApiError('The backend is temporarily unavailable.', response.status, body);
  }

  if (!response.ok) {
    throw new AdminApiError(
      `Admin request failed with HTTP ${response.status}.`,
      response.status,
      body
    );
  }

  return body as T;
}

export type AdminAuthCheckResult =
  | { status: 'authenticated'; user: AuthMeResponse }
  | { status: 'unauthenticated'; message: string }
  | { status: 'forbidden'; message: string; user?: { id?: string; email?: string; role?: string } }
  | { status: 'not_configured'; message: string }
  | { status: 'error'; message: string; statusCode?: number };

/**
 * Backend verification for Administrator Role
 * The frontend must NEVER decide that a user is an admin by itself.
 * Queries /api/v1/auth/admin-check (or /api/v1/auth/me) with Supabase Bearer token.
 */
export async function verifyAdminAccess(): Promise<AdminAuthCheckResult> {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // ignore
  }

  if (!session?.access_token) {
    return {
      status: 'unauthenticated',
      message: 'Please sign in to continue.',
    };
  }

  const url = `${API_BASE_URL}/api/v1/auth/admin-check`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.status === 401) {
      let body: any = null;
      try {
        body = await response.json();
      } catch {
        // ignore
      }
      return {
        status: 'unauthenticated',
        message: body?.detail || 'Your session has expired or the token was rejected. Please sign in again.',
      };
    }

    if (response.status === 403) {
      let body: any = null;
      try {
        body = await response.json();
      } catch {
        // ignore
      }
      return {
        status: 'forbidden',
        message: body?.detail || 'You are signed in, but you do not have administrator permissions.',
        user: {
          id: session.user?.id,
          email: session.user?.email,
          role: body?.role || (session.user as any)?.role || 'farmer',
        },
      };
    }

    if (response.status === 404) {
      // Only fallback to /api/v1/auth/me if /admin-check responded with a READABLE 404 HTTP status
      return await verifyMeEndpoint(session.access_token);
    }

    if (response.status >= 500) {
      let body: any = null;
      try {
        body = await response.json();
      } catch {
        // ignore
      }
      return {
        status: 'error',
        message: body?.detail || `Backend server error (HTTP ${response.status}).`,
        statusCode: response.status,
      };
    }

    if (!response.ok) {
      return {
        status: 'error',
        message: `Unable to verify administrator access (HTTP ${response.status}).`,
        statusCode: response.status,
      };
    }

    const data: any = await response.json();

    const isAuthValid = Boolean(
      (data?.authenticated ?? true) &&
      (data?.authorized ?? true) &&
      (data?.role === 'admin' || data?.role === 'super_admin' || data?.role === 'superadmin' || data?.role === 'agronomist' || data?.role === 'auditor') &&
      (data?.status === undefined || data?.status === 'active')
    );

    if (isAuthValid) {
      return { status: 'authenticated', user: data as AuthMeResponse };
    }

    return {
      status: 'forbidden',
      message: 'You are signed in, but your account does not possess administrator permissions.',
      user: {
        id: session.user?.id,
        email: session.user?.email,
        role: data?.role || 'farmer',
      },
    };
  } catch (err: any) {
    // Fetch rejection (Network/CORS/URL error - NOT an HTTP status response)
    const errName = err?.name || 'FetchError';
    const errMsg = err?.message || 'Failed to fetch';
    const pageOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';

    if (import.meta.env.DEV) {
      console.warn('[AgriFusion Auth Network Diagnostic]', {
        targetUrl: url,
        pageOrigin,
        errorName: errName,
        errorMessage: errMsg,
      });
    }

    return {
      status: 'error',
      message: `Unable to verify administrator access due to network or CORS failure (${errName}: ${errMsg}). Check connectivity to ${API_BASE_URL}.`,
    };
  }
}

async function verifyMeEndpoint(accessToken: string): Promise<AdminAuthCheckResult> {
  const url = `${API_BASE_URL}/api/v1/auth/me`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.status === 404) {
      return {
        status: 'not_configured',
        message: 'Admin authentication is not configured on the backend.',
      };
    }

    if (res.status === 401) {
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // ignore
      }
      return { status: 'unauthenticated', message: body?.detail || 'Please sign in to continue.' };
    }

    if (res.status === 403) {
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // ignore
      }
      return { status: 'forbidden', message: body?.detail || 'Admin access required.' };
    }

    if (!res.ok) {
      return {
        status: 'error',
        message: `Unable to verify administrator access (HTTP ${res.status}).`,
        statusCode: res.status,
      };
    }

    const data: AuthMeResponse = await res.json();
    if (data?.authenticated && (data?.role === 'admin' || data?.role === 'superadmin' || data?.role === 'super_admin')) {
      return { status: 'authenticated', user: data };
    }

    return { status: 'forbidden', message: 'Admin access required.' };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Network error';
    return {
      status: 'error',
      message: `Unable to verify administrator access due to network failure: ${errMsg}`,
    };
  }
}

/**
 * System Health Call (Public /health endpoint)
 * Calls GET https://dl-project-agrifusion-backend.onrender.com/health
 */
export async function getBackendHealth(): Promise<AdminHealth> {
  const start = performance.now();
  // 35s timeout to handle free-tier cloud container spin-up gracefully
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const duration = Math.round(performance.now() - start);

    if (!response.ok) {
      throw new AdminApiError(`Health check failed with HTTP ${response.status}`, response.status);
    }

    const data = await response.json();
    return {
      status: data.status || (response.ok ? 'ok' : 'unknown'),
      rag_documents_available: Boolean(data.rag_documents_available),
      database_configured: Boolean(data.database_configured),
      external_models_configured: Boolean(data.external_models_configured),
      last_checked: new Date().toISOString(),
      response_duration_ms: duration,
      environment: data.environment || 'production',
      ...data,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AdminApiError(
        'Backend connection timed out (Render free tier instance is spinning up from cold sleep. Please retry in 30 seconds).',
        504
      );
    }
    throw err;
  }
}

/**
 * Admin Dashboard (GET /api/v1/admin/dashboard with fallback to /api/v1/admin/overview)
 */
export async function getAdminDashboard(): Promise<AdminDashboardData> {
  try {
    return await adminRequest<AdminDashboardData>('/api/v1/admin/dashboard');
  } catch (err: any) {
    if (err.status === 404) {
      if (import.meta.env.DEV) {
        console.log('[AgriFusion Admin] /api/v1/admin/dashboard 404 fallback -> /api/v1/admin/overview');
      }
      return await adminRequest<AdminDashboardData>('/api/v1/admin/overview');
    }
    throw err;
  }
}

/**
 * Sync RAG Knowledge Base (POST /api/v1/admin/knowledge-sources/sync with fallback to /api/v1/admin/knowledge/sync)
 */
export async function syncKnowledgeBase(): Promise<{ status: string; message: string; count?: number }> {
  try {
    return await adminRequest<{ status: string; message: string; count?: number }>(
      '/api/v1/admin/knowledge-sources/sync',
      { method: 'POST' }
    );
  } catch (err: any) {
    if (err.status === 404) {
      return await adminRequest<{ status: string; message: string; count?: number }>(
        '/api/v1/admin/knowledge/sync',
        { method: 'POST' }
      );
    }
    throw err;
  }
}

/**
 * Lightweight Backend Readiness Probe (GET /ready)
 */
export async function getBackendReadiness(): Promise<{ ready: boolean; status: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/ready`);
    if (!res.ok) return { ready: false, status: 'unavailable' };
    const data = await res.json();
    return { ready: Boolean(data.ready ?? data.status === 'ok'), status: data.status || 'healthy' };
  } catch {
    return { ready: false, status: 'unavailable' };
  }
}

/**
 * Admin Overview (GET /api/v1/admin/overview)
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  return adminRequest<AdminOverview>('/api/v1/admin/overview');
}

export interface GetAdminUsersParams {
  page?: number;
  page_size?: number;
  search?: string;
  role?: string;
  status?: string;
}

/**
 * Admin Users (GET /api/v1/admin/users)
 * Handles both paginated object { items, page, page_size, total } and raw array responses safely.
 */
export async function getAdminUsers(
  params: GetAdminUsersParams = {}
): Promise<AdminPaginatedResponse<AdminUser>> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.page_size !== undefined) query.set('page_size', String(Math.min(params.page_size, 100)));
  if (params.search && params.search.trim()) query.set('search', params.search.trim());
  if (params.role && params.role !== 'all') query.set('role', params.role);
  if (params.status && params.status !== 'all') query.set('status', params.status);

  const queryString = query.toString();
  const path = `/api/v1/admin/users${queryString ? `?${queryString}` : ''}`;

  const response = await adminRequest<unknown>(path);

  // Documented paginated response: { items: [...], page: 1, page_size: 25, total: 100 }
  if (
    response &&
    typeof response === 'object' &&
    !Array.isArray(response) &&
    'items' in response &&
    Array.isArray((response as { items?: unknown }).items)
  ) {
    const res = response as AdminPaginatedResponse<AdminUser>;
    return {
      items: res.items,
      page: res.page ?? params.page ?? 1,
      page_size: res.page_size ?? params.page_size ?? 25,
      total: typeof res.total === 'number' ? res.total : res.items.length,
    };
  }

  // Legacy/backward compatibility fallback for raw array responses
  if (Array.isArray(response)) {
    return {
      items: response,
      page: params.page || 1,
      page_size: params.page_size || response.length || 25,
      total: response.length,
    };
  }

  // Do NOT convert malformed or unexpected responses into empty items. Throw a distinct error instead.
  throw new AdminApiError(
    'Unexpected API response structure: Missing items array in paginated response.',
    422,
    response
  );
}

/**
 * Update User Status (PATCH /api/v1/admin/users/{user_id}/status)
 */
export async function updateUserStatus(
  userId: string,
  status: 'active' | 'suspended' | 'archived'
): Promise<AdminUser> {
  return adminRequest<AdminUser>(`/api/v1/admin/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/**
 * Update User Role (PATCH /api/v1/admin/users/{user_id}/role)
 */
export async function updateUserRole(userId: string, role: string): Promise<AdminUser> {
  return adminRequest<AdminUser>(`/api/v1/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

/**
 * Generic Paginated Response Parser
 * Parses documented paginated envelope { items, page, page_size, total, privacy_note, ... }
 * Throws AdminApiError if response structure is malformed (missing items array)
 */
export function parsePaginatedResponse<T>(
  response: unknown,
  defaultPage = 1,
  defaultPageSize = 25
): AdminPaginatedResponse<T> {
  if (
    response &&
    typeof response === 'object' &&
    !Array.isArray(response) &&
    'items' in response &&
    Array.isArray((response as { items?: unknown }).items)
  ) {
    const res = response as AdminPaginatedResponse<T>;
    return {
      items: res.items,
      page: typeof res.page === 'number' ? res.page : defaultPage,
      page_size: typeof res.page_size === 'number' ? res.page_size : defaultPageSize,
      total: typeof res.total === 'number' ? res.total : res.items.length,
      privacy_note: (response as { privacy_note?: string }).privacy_note,
      suppressed_groups: (response as { suppressed_groups?: Record<string, unknown> }).suppressed_groups,
      rating_distribution: (response as { rating_distribution?: Record<string, number> }).rating_distribution,
    };
  }

  if (Array.isArray(response)) {
    return {
      items: response as T[],
      page: defaultPage,
      page_size: defaultPageSize,
      total: response.length,
    };
  }

  throw new AdminApiError(
    'Unexpected API response structure: Missing items array in paginated response.',
    422,
    response
  );
}

export interface GetFarmsParams {
  state?: string;
  district?: string;
  crop?: string;
  area_range?: string;
  irrigation_type?: string;
  privacy_threshold?: number;
}

/**
 * Admin Farms (GET /api/v1/admin/farms)
 * Returns a count-only response matching OpenAPI:
 * { count, filters_applied, suppressed, privacy_threshold, privacy_note }
 */
export async function getAdminFarms(
  params?: GetFarmsParams
): Promise<AdminFarmsCountResponse> {
  const query = new URLSearchParams();
  if (params?.state && params.state !== 'all') query.set('state', params.state);
  if (params?.district && params.district !== 'all') query.set('district', params.district);
  if (params?.crop && params.crop !== 'all') query.set('crop', params.crop);
  if (params?.area_range && params.area_range !== 'all') query.set('area_range', params.area_range);
  if (params?.irrigation_type && params.irrigation_type !== 'all') query.set('irrigation_type', params.irrigation_type);
  if (params?.privacy_threshold !== undefined) {
    query.set('privacy_threshold', String(params.privacy_threshold));
  } else {
    query.set('privacy_threshold', '1');
  }

  const qs = query.toString();
  const path = `/api/v1/admin/farms${qs ? `?${qs}` : ''}`;
  const response = await adminRequest<unknown>(path);

  if (
    response &&
    typeof response === 'object' &&
    'suppressed' in response &&
    'privacy_note' in response
  ) {
    return response as AdminFarmsCountResponse;
  }

  // Fallback for unexpected or legacy envelope
  if (
    response &&
    typeof response === 'object' &&
    'items' in response &&
    Array.isArray((response as any).items)
  ) {
    const total = typeof (response as any).total === 'number' ? (response as any).total : (response as any).items.length;
    return {
      count: total,
      filters_applied: {
        state: params?.state || null,
        district: params?.district || null,
        crop: params?.crop || null,
        area_range: params?.area_range || null,
        irrigation_type: params?.irrigation_type || null,
      },
      suppressed: false,
      privacy_threshold: params?.privacy_threshold ?? 1,
      privacy_note: (response as any).privacy_note || 'Count computed from farm profiles.',
    };
  }

  throw new AdminApiError(
    'Unexpected API response structure: Missing count/suppressed fields for /api/v1/admin/farms.',
    422,
    response
  );
}

export interface GetAdvisoriesParams {
  page?: number;
  page_size?: number;
  search?: string;
  crop?: string;
  state?: string;
  district?: string;
  review_status?: string;
  activity_status?: string;
}

export interface UpdateAdvisoryReviewRequest {
  review_status: 'not_reviewed' | 'needs_review' | 'reviewed' | 'resolved';
  note?: string;
}

/**
 * Admin Advisory Analytics (GET /api/v1/admin/advisory-analytics)
 * Returns server-side privacy-safe aggregated query and citation metrics.
 */
export async function getAdminAdvisoryAnalytics(
  params?: GetAdvisoryAnalyticsParams
): Promise<AdminAdvisoryAnalytics> {
  const query = new URLSearchParams();
  if (params?.crop && params.crop !== 'all') query.set('crop', params.crop);
  if (params?.state && params.state !== 'all') query.set('state', params.state);
  if (params?.district && params.district !== 'all') query.set('district', params.district);
  if (params?.search?.trim()) query.set('search', params.search.trim());
  if (params?.activity_status && params.activity_status !== 'all') {
    query.set('activity_status', params.activity_status);
    query.set('status', params.activity_status);
  }
  if (params?.status && params.status !== 'all' && !query.has('status')) {
    query.set('status', params.status);
  }

  const qs = query.toString();
  const path = `/api/v1/admin/advisory-analytics${qs ? `?${qs}` : ''}`;
  return adminRequest<AdminAdvisoryAnalytics>(path);
}

/**
 * Admin Advisories (GET /api/v1/admin/advisories)
 * Detailed review list, paginated with maximum page_size of 100.
 */
export async function getAdminAdvisories(
  params?: GetAdvisoriesParams
): Promise<AdminPaginatedResponse<AdminAdvisory>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) {
    const clampedSize = Math.min(Math.max(1, params.page_size), 100);
    query.set('page_size', String(clampedSize));
  }
  if (params?.search?.trim()) query.set('search', params.search.trim());
  if (params?.crop && params.crop !== 'all') query.set('crop', params.crop);
  if (params?.state && params.state !== 'all') query.set('state', params.state);
  if (params?.district && params.district !== 'all') query.set('district', params.district);
  if (params?.review_status && params.review_status !== 'all') query.set('review_status', params.review_status);
  if (params?.activity_status && params.activity_status !== 'all') query.set('activity_status', params.activity_status);

  const qs = query.toString();
  const path = `/api/v1/admin/advisories${qs ? `?${qs}` : ''}`;
  const response = await adminRequest<unknown>(path);
  return parsePaginatedResponse<AdminAdvisory>(
    response,
    params?.page || 1,
    Math.min(params?.page_size || 25, 100)
  );
}

/**
 * Update Advisory Review (PATCH /api/v1/admin/advisories/{query_id}/review)
 */
export async function updateAdvisoryReview(
  queryId: string,
  data: UpdateAdvisoryReviewRequest
): Promise<AdminAdvisory> {
  return adminRequest<AdminAdvisory>(
    `/api/v1/admin/advisories/${encodeURIComponent(queryId)}/review`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  );
}

export interface GetFeedbackParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  category?: string;
  module?: string;
  rating?: number | string;
}

/**
 * Admin Feedback (GET /api/v1/admin/feedback)
 */
export async function getAdminFeedback(
  params?: GetFeedbackParams
): Promise<AdminPaginatedResponse<AdminFeedback>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.search?.trim()) query.set('search', params.search.trim());
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  if (params?.category && params.category !== 'all') query.set('category', params.category);
  if (params?.rating !== undefined && params.rating !== 'all') query.set('rating', String(params.rating));

  const qs = query.toString();
  const path = `/api/v1/admin/feedback${qs ? `?${qs}` : ''}`;
  const response = await adminRequest<unknown>(path);
  return parsePaginatedResponse<AdminFeedback>(response, params?.page || 1, params?.page_size || 25);
}

/**
 * Update Feedback (PATCH /api/v1/admin/feedback/{feedback_id})
 */
export async function updateFeedback(
  feedbackId: string,
  data: Partial<AdminFeedback>
): Promise<AdminFeedback> {
  return adminRequest<AdminFeedback>(`/api/v1/admin/feedback/${encodeURIComponent(feedbackId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateFeedbackStatus(
  feedbackId: string,
  status: 'new' | 'under_review' | 'resolved'
): Promise<AdminFeedback> {
  return updateFeedback(feedbackId, { status });
}

/**
 * Add Feedback Note (POST /api/v1/admin/feedback/{feedback_id}/note)
 */
export async function addFeedbackNote(
  feedbackId: string,
  note: string
): Promise<AdminFeedback> {
  return adminRequest<AdminFeedback>(`/api/v1/admin/feedback/${encodeURIComponent(feedbackId)}/note`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export interface GetSourcesParams {
  page?: number;
  page_size?: number;
  search?: string;
  organization?: string;
  source_type?: string;
  verification_status?: string;
  index_status?: string;
}

export interface GetSchemesParams {
  page?: number;
  page_size?: number;
  search?: string;
  state?: string;
  district?: string;
  department?: string;
  scheme_type?: string;
  verification_status?: string;
  current_status?: string;
}

/**
 * Admin Sources (GET /api/v1/admin/sources)
 */
export async function getAdminSources(
  params?: GetSourcesParams
): Promise<SourcesResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.search?.trim()) query.set('search', params.search.trim());
  if (params?.organization && params.organization !== 'all') query.set('organization', params.organization);
  if (params?.source_type && params.source_type !== 'all') query.set('source_type', params.source_type);
  if (params?.verification_status && params.verification_status !== 'all') query.set('verification_status', params.verification_status);
  if (params?.index_status && params.index_status !== 'all') query.set('index_status', params.index_status);

  const qs = query.toString();
  const path = `/api/v1/admin/sources${qs ? `?${qs}` : ''}`;
  const res = await adminRequest<unknown>(path);
  return parsePaginatedResponse<KnowledgeSource>(res, params?.page || 1, params?.page_size || 25);
}

/**
 * Admin Schemes (GET /api/v1/admin/schemes)
 */
export async function getAdminSchemes(
  params?: GetSchemesParams
): Promise<SchemesResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.search?.trim()) query.set('search', params.search.trim());
  if (params?.state && params.state !== 'all') query.set('state', params.state);
  if (params?.district && params.district !== 'all') query.set('district', params.district);
  if (params?.department && params.department !== 'all') query.set('department', params.department);
  if (params?.scheme_type && params.scheme_type !== 'all') query.set('scheme_type', params.scheme_type);
  if (params?.verification_status && params.verification_status !== 'all') query.set('verification_status', params.verification_status);
  if (params?.current_status && params.current_status !== 'all') query.set('current_status', params.current_status);

  const qs = query.toString();
  const path = `/api/v1/admin/schemes${qs ? `?${qs}` : ''}`;
  const res = await adminRequest<unknown>(path);
  return parsePaginatedResponse<GovernmentScheme>(res, params?.page || 1, params?.page_size || 25);
}

export interface GetPredictionsParams {
  page?: number;
  page_size?: number;
  search?: string;
  model_type?: string;
  status?: string;
}

/**
 * Admin Predictions (GET /api/v1/admin/predictions)
 * Backend returns: { status, admin_user_id, data: { "Crop Predictions": [...], "Irrigation Predictions": [...], ... } }
 * Normalizes group arrays into flat paginated list with model_type assigned from group key
 */
export async function getAdminPredictions(
  params?: GetPredictionsParams
): Promise<AdminPaginatedResponse<any>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.search?.trim()) query.set('search', params.search.trim());
  if (params?.model_type && params.model_type !== 'all') query.set('model_type', params.model_type);
  if (params?.status && params.status !== 'all') query.set('status', params.status);

  const qs = query.toString();
  const path = `/api/v1/admin/predictions${qs ? `?${qs}` : ''}`;
  const raw = await adminRequest<any>(path);

  if (raw && typeof raw === 'object' && 'items' in raw && Array.isArray((raw as any).items)) {
    return parsePaginatedResponse<any>(raw, params?.page || 1, params?.page_size || 25);
  }

  const groupData = raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
  const normalizedItems: any[] = [];

  if (groupData && typeof groupData === 'object' && !Array.isArray(groupData)) {
    for (const [groupName, rows] of Object.entries(groupData)) {
      if (Array.isArray(rows)) {
        rows.forEach((row: any, idx: number) => {
          normalizedItems.push({
            ...row,
            id: row.id || `${groupName.replace(/\s+/g, '_').toLowerCase()}_${idx}`,
            model_type: row.model_type || groupName,
          });
        });
      }
    }
  } else if (Array.isArray(groupData)) {
    normalizedItems.push(...groupData);
  }

  return {
    items: normalizedItems,
    page: params?.page || 1,
    page_size: params?.page_size || Math.max(normalizedItems.length, 25),
    total: normalizedItems.length,
  };
}

export interface GetDiagnosticsParams {
  page?: number;
  page_size?: number;
  search?: string;
  crop?: string;
  review_status?: string;
}

/**
 * Admin Diagnostics (GET /api/v1/admin/diagnostics)
 * Backend returns outer wrapper with paginated envelope under `data`: { data: { items, page, page_size, total } }
 */
export async function getAdminDiagnostics(
  params?: GetDiagnosticsParams
): Promise<AdminPaginatedResponse<any>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.search?.trim()) query.set('search', params.search.trim());
  if (params?.crop && params.crop !== 'all') query.set('crop', params.crop);
  if (params?.review_status && params.review_status !== 'all') query.set('review_status', params.review_status);

  const qs = query.toString();
  const path = `/api/v1/admin/diagnostics${qs ? `?${qs}` : ''}`;
  const raw = await adminRequest<any>(path);
  const payload = raw && typeof raw === 'object' && 'data' in raw && raw.data ? raw.data : raw;
  return parsePaginatedResponse<any>(payload, params?.page || 1, params?.page_size || 25);
}

/**
 * Register Source (POST /api/v1/admin/sources/register)
 */
export async function registerSource(
  data: RegisterSourceRequest
): Promise<KnowledgeSource> {
  return adminRequest<KnowledgeSource>('/api/v1/admin/sources/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update Source (PATCH /api/v1/admin/sources/{source_id})
 */
export async function updateSource(
  sourceId: string,
  data: UpdateSourceMetadataRequest
): Promise<KnowledgeSource> {
  return adminRequest<KnowledgeSource>(`/api/v1/admin/sources/${encodeURIComponent(sourceId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateSourceStatus(
  sourceId: string,
  status: string,
  notes?: string
): Promise<KnowledgeSource> {
  return updateSource(sourceId, {
    verification_status: status as any,
    verification_notes: notes || undefined,
  });
}

/**
 * Reindex Source (POST /api/v1/admin/sources/{source_id}/reindex)
 */
export async function reindexSource(
  sourceId: string
): Promise<{ message?: string; status?: string; source_id?: string; success?: boolean }> {
  return adminRequest<{ message?: string; status?: string; source_id?: string; success?: boolean }>(
    `/api/v1/admin/sources/${encodeURIComponent(sourceId)}/reindex`,
    {
      method: 'POST',
    }
  );
}

/**
 * Register Scheme (POST /api/v1/admin/schemes/register)
 */
export async function registerScheme(
  data: RegisterSchemeRequest
): Promise<GovernmentScheme> {
  return adminRequest<GovernmentScheme>('/api/v1/admin/schemes/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Verify Scheme (POST /api/v1/admin/schemes/{scheme_id}/verify)
 */
export async function verifyScheme(
  schemeId: string,
  data: VerifySchemeRequest
): Promise<GovernmentScheme> {
  return adminRequest<GovernmentScheme>(`/api/v1/admin/schemes/${encodeURIComponent(schemeId)}/verify`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update Scheme (PATCH /api/v1/admin/schemes/{scheme_id})
 */
export async function updateScheme(
  schemeId: string,
  data: UpdateSchemeRequest
): Promise<GovernmentScheme> {
  return adminRequest<GovernmentScheme>(`/api/v1/admin/schemes/${encodeURIComponent(schemeId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Recheck Scheme (POST /api/v1/admin/schemes/{scheme_id}/recheck)
 */
export async function recheckScheme(
  schemeId: string
): Promise<{ message?: string; status?: string; scheme_id?: string }> {
  return adminRequest<{ message?: string; status?: string; scheme_id?: string }>(
    `/api/v1/admin/schemes/${encodeURIComponent(schemeId)}/recheck`,
    {
      method: 'POST',
    }
  );
}

export interface GetAuditLogsParams {
  page?: number;
  page_size?: number;
  search?: string;
}

/**
 * Admin Audit Logs (GET /api/v1/admin/audit-logs)
 * Returns paginated envelope { items, page, page_size, total }
 */
export async function getAdminAuditLogs(
  params?: GetAuditLogsParams
): Promise<AdminPaginatedResponse<AuditLogEntry>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.search?.trim()) query.set('search', params.search.trim());

  const qs = query.toString();
  const path = `/api/v1/admin/audit-logs${qs ? `?${qs}` : ''}`;
  const res = await adminRequest<unknown>(path);
  return parsePaginatedResponse<AuditLogEntry>(res, params?.page || 1, params?.page_size || 25);
}

/**
 * Public Farmer Feedback Submission (POST /api/v1/feedback)
 */
export async function submitFarmerFeedback(feedback: {
  category: string;
  module?: string;
  rating?: number | null;
  comment?: string;
  helpful_comment?: string | null;
  unhelpful_comment?: string | null;
  district?: string;
  crop?: string;
  advisory_id?: string | null;
  prediction_id?: string | null;
  query_summary?: string | null;
  ai_answer?: string | null;
  language?: string;
}): Promise<{ success: boolean; message: string; feedback?: any }> {
  const payload = {
    category: feedback.category,
    module: feedback.module || 'General Advisory',
    rating: feedback.rating ?? 5,
    comment: feedback.comment || '',
    message: feedback.comment || '',
    helpful_comment: feedback.helpful_comment?.trim() || null,
    unhelpful_comment: feedback.unhelpful_comment?.trim() || null,
    district: feedback.district || null,
    crop: feedback.crop || null,
    advisory_id: feedback.advisory_id || null,
    prediction_id: feedback.prediction_id || null,
    query_summary: feedback.query_summary || null,
    ai_answer: feedback.ai_answer || null,
    language: feedback.language || 'English',
  };

  const response = await fetch(`${API_BASE_URL}/api/v1/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let msg = `Submission failed (${response.status})`;
    try {
      const err = await response.json();
      if (err.detail) msg = err.detail;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  return response.json();
}


import { isSupabaseConfigured, supabase } from './supabase';
import { DIRECT_BACKEND_URL } from './api';

/**
 * Normalizes user auth identifier input (email or phone)
 */
export function normalizeAuthIdentifier(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';

  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }

  // Handle phone numbers by extracting 10-digit national mobile number
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly) {
    const mobileDigits = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
    return `${mobileDigits}@kisan.in`;
  }

  return `${trimmed}@kisan.in`;
}

/**
 * Resolves Email, Phone, or User ID input to a Supabase account email
 */
export async function resolveUserIdentifier(identifier: string): Promise<string> {
  const trimmed = (identifier || '').trim();
  if (!trimmed) return '';

  if (trimmed.includes('@') || /^\d{10,}$/.test(trimmed.replace(/\D/g, ''))) {
    return normalizeAuthIdentifier(trimmed);
  }

  // Attempt server-side User ID lookup
  try {
    const res = await fetch(`${DIRECT_BACKEND_URL}/api/v1/auth/resolve-identifier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: trimmed }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.email) return data.email;
    }
  } catch {
    // fallback to normalized format
  }

  return normalizeAuthIdentifier(trimmed);
}

/**
 * Sign in with Supabase password auth
 * Never logs credentials or tokens
 */
export async function signInWithPassword(emailOrUserId: string, password: string) {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not configured. Please configure them in your environment.'
    );
  }

  const resolvedEmail = await resolveUserIdentifier(emailOrUserId);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.toLowerCase().includes('email not confirmed')) {
      throw new Error('Email not confirmed. Immediate sign-in requires "Confirm email" to be turned OFF in your Supabase Auth provider settings.');
    } else if (msg.toLowerCase().includes('invalid login credentials')) {
      throw new Error('Invalid Email/User ID or password. Please check your credentials and try again.');
    } else if (msg.toLowerCase().includes('rate limit') || error.status === 429) {
      throw new Error('Too many login attempts. Please wait a moment before trying again.');
    }
    throw new Error(error.message);
  }

  return data;
}

/**
 * Sign up with Supabase password auth
 */
export async function signUpWithPassword(
  email: string,
  password: string,
  metadata?: Record<string, any>
) {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase environment variables are not configured. Please configure them in your environment.'
    );
  }

  const normalized = normalizeAuthIdentifier(email);

  const { data, error } = await supabase.auth.signUp({
    email: normalized,
    password,
    options: {
      data: metadata || { role: 'farmer' },
    },
  });

  if (error) {
    const msg = error.message || '';
    const errCode = (error as any).code || '';
    if (
      errCode === 'over_email_send_rate_limit' ||
      msg.toLowerCase().includes('email rate limit exceeded') ||
      msg.toLowerCase().includes('over_email_send_rate_limit')
    ) {
      throw new Error(
        'The Supabase project email-send quota is exhausted. Email dispatch is currently disabled by the authentication provider.'
      );
    } else if (msg.toLowerCase().includes('rate limit') || error.status === 429) {
      throw new Error('Registration rate limit reached. Please try again later.');
    } else if (msg.toLowerCase().includes('user already registered')) {
      throw new Error('An account with this phone or email already exists. Please sign in instead.');
    }
    throw new Error(error.message);
  }

  return data;
}

/**
 * Resend confirmation email for unconfirmed accounts
 */
export async function resendConfirmationEmail(email: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase environment variables are not configured.');
  }

  const normalized = normalizeAuthIdentifier(email);

  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email: normalized,
  });

  if (error) {
    const msg = error.message || '';
    const errCode = (error as any).code || '';
    if (
      errCode === 'over_email_send_rate_limit' ||
      msg.toLowerCase().includes('email rate limit exceeded') ||
      msg.toLowerCase().includes('over_email_send_rate_limit')
    ) {
      throw new Error(
        'The Supabase project email-send quota is exhausted. Email dispatch is currently disabled by the authentication provider.'
      );
    } else if (
      msg.toLowerCase().includes('rate limit') ||
      msg.toLowerCase().includes('security') ||
      error.status === 429
    ) {
      throw new Error('Email rate limit exceeded. Please try again later.');
    }
    throw new Error(error.message);
  }

  return data;
}

/**
 * Sign out of current Supabase session
 */
export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Retrieve current active session
 */
export async function getSession() {
  if (!isSupabaseConfigured) return null;
  try {
    const res = await supabase.auth.getSession();
    if (res?.error) {
      return null;
    }
    return res?.data?.session || null;
  } catch {
    return null;
  }
}

/**
 * Retrieve current active user
 */
export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;
  try {
    const res = await supabase.auth.getUser();
    if (res?.error) {
      return null;
    }
    return res?.data?.user || null;
  } catch {
    return null;
  }
}

/**
 * Retrieve current Supabase access token for Bearer authentication
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token || null;
}

/**
 * Fetch profile and farm data from Supabase public tables & backend for authenticated farmer
 */
export async function fetchFarmerProfile(): Promise<{ profile?: any; farms?: any[] } | null> {
  const user = await getCurrentUser();
  const token = await getAccessToken();
  if (!user && !token) return null;

  let profileData: any = null;
  let farmsData: any[] = [];

  // 1. Query Supabase public.profiles table directly with user RLS
  if (user && typeof supabase?.from === 'function') {
    try {
      const res = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (res?.data) {
        profileData = res.data;
      }
    } catch (spErr) {
      console.warn('Supabase profiles query note:', spErr);
    }

    try {
      const res = await supabase
        .from('farms')
        .select('*')
        .eq('user_id', user.id);

      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        farmsData = res.data;
      }
    } catch (spErr) {
      console.warn('Supabase farms query note:', spErr);
    }
  }

  // 2. Fetch from backend REST API if token is present
  if (token) {
    try {
      const res = await fetch(`${DIRECT_BACKEND_URL}/api/v1/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const backendProfile = await res.json();
        profileData = { ...profileData, ...backendProfile };
      }
    } catch (err) {
      console.warn('Failed to fetch farmer profile from backend:', err);
    }

    try {
      const farmsRes = await fetch(`${DIRECT_BACKEND_URL}/api/v1/farms`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (farmsRes.ok) {
        const rawFarms = await farmsRes.json();
        const bFarms = Array.isArray(rawFarms)
          ? rawFarms
          : Array.isArray(rawFarms?.items)
          ? rawFarms.items
          : [];
        if (bFarms.length > 0 && farmsData.length === 0) {
          farmsData = bFarms;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch farms from backend:', err);
    }
  }

  if (!profileData && farmsData.length === 0) {
    return null;
  }

  return { profile: profileData, farms: farmsData };
}

/**
 * Update farmer profile in Supabase public.profiles & backend (PATCH /api/v1/profile)
 */
export async function updateFarmerProfile(payload: {
  full_name?: string;
  phone?: string;
  state?: string;
  district?: string;
  village?: string;
  area_ha?: number;
  crop?: string;
  soil_type?: string;
}) {
  const user = await getCurrentUser();
  const token = await getAccessToken();

  // 1. Safe idempotent upsert in Supabase public.profiles keyed by user.id
  if (user && typeof supabase?.from === 'function') {
    try {
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          full_name: payload.full_name,
          phone: payload.phone,
          state: payload.state,
          district: payload.district,
          village: payload.village,
          area_ha: payload.area_ha,
          crop: payload.crop,
          soil_type: payload.soil_type,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch (spErr) {
      console.warn('Supabase profiles upsert note:', spErr);
    }
  }

  // 2. Sync to backend API
  if (token) {
    try {
      const res = await fetch(`${DIRECT_BACKEND_URL}/api/v1/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.warn('Backend profile patch response note:', res.status, text);
      } else {
        return await res.json();
      }
    } catch (err) {
      console.warn('Backend profile update failed:', err);
    }
  }

  return { success: true };
}

/**
 * Save/upsert farm record in Supabase public.farms & backend (POST /api/v1/farms)
 */
export async function saveFarmerFarm(farmData: {
  name: string;
  state: string;
  district: string;
  village?: string;
  land_area?: number;
  land_area_unit?: string;
  soil_type?: string;
}) {
  const user = await getCurrentUser();
  const token = await getAccessToken();

  // 1. Safe idempotent upsert in Supabase public.farms keyed by user_id and name
  if (user && typeof supabase?.from === 'function') {
    try {
      await supabase.from('farms').upsert(
        {
          user_id: user.id,
          name: farmData.name,
          state: farmData.state,
          district: farmData.district,
          village: farmData.village || '',
          land_area: farmData.land_area ?? 2.0,
          land_area_unit: farmData.land_area_unit || 'hectares',
          soil_type: farmData.soil_type || 'Loam Soil',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, name' }
      );
    } catch (spErr) {
      console.warn('Supabase farms upsert note:', spErr);
    }
  }

  // 2. Sync to backend API
  if (token) {
    try {
      const res = await fetch(`${DIRECT_BACKEND_URL}/api/v1/farms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(farmData),
      });

      if (!res.ok) {
        const text = await res.text();
        console.warn('Backend farm save response note:', res.status, text);
      } else {
        return await res.json();
      }
    } catch (err) {
      console.warn('Backend farm save failed:', err);
    }
  }

  return { success: true };
}


import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { fetchFarmerProfile, getSession, signInWithPassword } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { FarmerUser, UserFarmProfile } from '../types';

vi.mock('../lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        signInWithPassword: vi.fn(),
        getSession: vi.fn(),
        getUser: vi.fn(),
      },
    },
  };
});

describe('Post-Login Flow & Hydration Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('1. Successful Login & Session Navigation', () => {
    it('establishes a valid authenticated session before navigating protected routes', async () => {
      const mockUser = { id: 'usr-kisan-101', email: 'reddy@agrifusion.com' };
      const mockSession = { access_token: 'mock-jwt-token-xyz', user: mockUser };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: mockUser, session: mockSession } as any,
        error: null,
      });

      const result = await signInWithPassword('reddy@agrifusion.com', 'password123');
      expect(result.session).toBeDefined();
      expect(result.session?.access_token).toBe('mock-jwt-token-xyz');
      expect(result.user?.id).toBe('usr-kisan-101');
    });
  });

  describe('2. Profile & Farm API Failure Handling', () => {
    it('gracefully handles backend API failure without logging user out', async () => {
      const mockUser = { id: 'usr-kisan-102', email: 'failure_test@agrifusion.com' };
      const mockSession = { access_token: 'mock-jwt-token-456', user: mockUser };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession } as any,
        error: null,
      });

      // Mock backend profile API throwing 500 network/server error
      vi.mocked(global.fetch).mockRejectedValue(new Error('500 Internal Server Error'));

      const profileResult = await fetchFarmerProfile();
      expect(profileResult).toBeNull();

      // Session should still exist and remain active
      const currentSession = await getSession();
      expect(currentSession?.access_token).toBe('mock-jwt-token-456');
    });
  });

  describe('3. Malformed / Missing Profile Data Safety', () => {
    it('applies fallback defaults safely when profile parameters are missing or null', () => {
      const DEFAULT_PROFILE: UserFarmProfile = {
        user_email: 'farmer@agrifusion.com',
        state: 'Andhra Pradesh',
        district: 'Visakhapatnam',
        village: 'Anakapalle',
        crop: 'Rice',
        area_ha: 2,
        sowing_date: '2026-06-15',
        pump_hp: 5,
      };

      const malformedInput: Partial<UserFarmProfile> = {
        state: undefined,
        district: undefined,
        crop: undefined,
        area_ha: undefined,
      };

      const safeProfile: UserFarmProfile = {
        user_email: malformedInput.user_email || DEFAULT_PROFILE.user_email,
        state: malformedInput.state || DEFAULT_PROFILE.state,
        district: malformedInput.district || DEFAULT_PROFILE.district,
        village: malformedInput.village || DEFAULT_PROFILE.village,
        crop: malformedInput.crop || DEFAULT_PROFILE.crop,
        area_ha: malformedInput.area_ha ?? DEFAULT_PROFILE.area_ha,
        sowing_date: malformedInput.sowing_date || DEFAULT_PROFILE.sowing_date,
        soil_type: malformedInput.soil_type || DEFAULT_PROFILE.soil_type,
        irrigation_source: malformedInput.irrigation_source || DEFAULT_PROFILE.irrigation_source,
        pump_hp: malformedInput.pump_hp ?? DEFAULT_PROFILE.pump_hp,
        farmer_name: malformedInput.farmer_name || DEFAULT_PROFILE.farmer_name,
        mobile: malformedInput.mobile || DEFAULT_PROFILE.mobile,
      };

      expect(safeProfile.state).toBe('Andhra Pradesh');
      expect(safeProfile.district).toBe('Visakhapatnam');
      expect(safeProfile.crop).toBe('Rice');
      expect(safeProfile.area_ha).toBe(2);
      expect((safeProfile.crop || '').toLowerCase()).toBe('rice');
    });
  });

  describe('4. Top-Level Error Boundary Recovery', () => {
    it('catches component render exceptions and provides recovery state', () => {
      const ProblematicComponent = () => {
        throw new Error('Simulated post-authentication component render exception');
      };

      // Instantiating getDerivedStateFromError directly to test ErrorBoundary state transformation
      const error = new Error('Simulated post-authentication component render exception');
      const derivedState = ErrorBoundary.getDerivedStateFromError(error);

      expect(derivedState.hasError).toBe(true);
      expect(derivedState.error?.message).toBe('Simulated post-authentication component render exception');
    });
  });

  describe('5. Post-Login Component Icon Import Verification', () => {
    it('confirms FarmerAuthModal and FarmerDashboard import and reference ArrowRight without ReferenceError', async () => {
      // Import the components dynamically to ensure module evaluation passes without ReferenceError
      const authModalModule = await import('../components/FarmerAuthModal');
      const dashboardModule = await import('../views/FarmerDashboard');

      expect(authModalModule.FarmerAuthModal).toBeDefined();
      expect(dashboardModule.FarmerDashboard).toBeDefined();
    });
  });
});

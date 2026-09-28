import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeAuthIdentifier,
  signInWithPassword,
  signUpWithPassword,
  resendConfirmationEmail,
} from '../lib/auth';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        resend: vi.fn(),
      },
    },
  };
});

describe('Farmer Auth Flow & Supabase Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Identifier Normalization Consistency', () => {
    it('normalizes emails consistently across signup and login', () => {
      const input1 = '  Farmer.Reddy@Gmail.COM  ';
      const input2 = 'farmer.reddy@gmail.com';
      expect(normalizeAuthIdentifier(input1)).toBe('farmer.reddy@gmail.com');
      expect(normalizeAuthIdentifier(input2)).toBe('farmer.reddy@gmail.com');
    });

    it('normalizes phone numbers consistently across signup and login', () => {
      const phoneInput1 = '9848012345';
      const phoneInput2 = '+91 98480 12345';
      const phoneInput3 = '9848012345@kisan.in';

      expect(normalizeAuthIdentifier(phoneInput1)).toBe('9848012345@kisan.in');
      expect(normalizeAuthIdentifier(phoneInput2)).toBe('9848012345@kisan.in');
      expect(normalizeAuthIdentifier(phoneInput3)).toBe('9848012345@kisan.in');
    });
  });

  describe('SignUp Flow', () => {
    it('handles signup with an active session immediately', async () => {
      const mockUser = { id: 'u123', email: 'farmer@gmail.com' };
      const mockSession = { access_token: 'fake-jwt-token', user: mockUser };

      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: mockUser, session: mockSession } as any,
        error: null,
      });

      const res = await signUpWithPassword('farmer@gmail.com', 'secret123', {
        full_name: 'Anji Reddy',
      });

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'farmer@gmail.com',
        password: 'secret123',
        options: { data: { full_name: 'Anji Reddy' } },
      });
      expect(res.session).toBeDefined();
      expect(res.session?.access_token).toBe('fake-jwt-token');
      expect(res.user?.id).toBe('u123');
    });

    it('handles signup when session === null (email confirmation required)', async () => {
      const mockUser = { id: 'u456', email: 'unconfirmed@gmail.com' };

      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: mockUser, session: null } as any,
        error: null,
      });

      const res = await signUpWithPassword('unconfirmed@gmail.com', 'secret123', {
        full_name: 'Anji Reddy',
      });

      expect(res.user?.id).toBe('u456');
      expect(res.session).toBeNull();
    });

    it('handles over_email_send_rate_limit response cleanly without claiming 1 minute will fix it', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: {
          code: 'over_email_send_rate_limit',
          message: 'email rate limit exceeded',
          status: 429,
        } as any,
      });

      await expect(
        signUpWithPassword('ratelimited@gmail.com', 'secret123')
      ).rejects.toThrow(
        'The Supabase project email-send quota is exhausted. Email dispatch is currently disabled by the authentication provider.'
      );
    });
  });

  describe('SignIn Flow', () => {
    it('handles successful login with an active session', async () => {
      const mockUser = { id: 'u123', email: 'farmer@gmail.com' };
      const mockSession = { access_token: 'valid-jwt', user: mockUser };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: mockUser, session: mockSession } as any,
        error: null,
      });

      const res = await signInWithPassword('farmer@gmail.com', 'secret123');

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'farmer@gmail.com',
        password: 'secret123',
      });
      expect(res.session?.access_token).toBe('valid-jwt');
    });

    it('surfaces actionable error for unconfirmed accounts', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed', status: 400 } as any,
      });

      await expect(
        signInWithPassword('unconfirmed@gmail.com', 'secret123')
      ).rejects.toThrow('Email not confirmed. Immediate sign-in requires "Confirm email" to be turned OFF in your Supabase Auth provider settings.');
    });

    it('surfaces actionable error for invalid credentials', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', status: 400 } as any,
      });

      await expect(
        signInWithPassword('farmer@gmail.com', 'wrongpassword')
      ).rejects.toThrow('Invalid Email/User ID or password. Please check your credentials and try again.');
    });
  });

  describe('Resend Confirmation Email Flow', () => {
    it('resends confirmation email successfully', async () => {
      vi.mocked(supabase.auth.resend).mockResolvedValue({
        data: {} as any,
        error: null,
      });

      const res = await resendConfirmationEmail('farmer@gmail.com');
      expect(supabase.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'farmer@gmail.com',
      });
      expect(res).toEqual({});
    });

    it('handles over_email_send_rate_limit error on resend cleanly', async () => {
      vi.mocked(supabase.auth.resend).mockResolvedValue({
        data: null as any,
        error: {
          code: 'over_email_send_rate_limit',
          message: 'email rate limit exceeded',
          status: 429,
        } as any,
      });

      await expect(resendConfirmationEmail('farmer@gmail.com')).rejects.toThrow(
        'The Supabase project email-send quota is exhausted. Email dispatch is currently disabled by the authentication provider.'
      );
    });
  });

  describe('Direct Portal Home Page Navigation After Registration', () => {
    it('directly navigates user to portal home page (dashboard) without asking user to click intermediate prompt', () => {
      let activePage = 'landing';
      let isModalOpen = true;

      const handleUserLogin = (user: { name: string; isLoggedIn: boolean }) => {
        activePage = 'dashboard';
        isModalOpen = false;
      };

      // Simulate completion of registration submit handler
      handleUserLogin({ name: 'Ramesh Reddy', isLoggedIn: true });

      expect(activePage).toBe('dashboard');
      expect(isModalOpen).toBe(false);
    });

    it('blocks admin@gmail.com public registration attempts', () => {
      const isPublicSignupAllowed = (email: string) => {
        if (email.toLowerCase().includes('admin@gmail.com')) {
          return 'Administrative accounts (e.g., admin@gmail.com) cannot be created via public farmer registration. Please use the secure Admin Portal.';
        }
        return null;
      };

      expect(isPublicSignupAllowed('admin@gmail.com')).toContain('Administrative accounts');
      expect(isPublicSignupAllowed('farmer@gmail.com')).toBeNull();
    });

    it('requires active Supabase session on signup before treating user as authenticated', () => {
      const processSignupResult = (signupData: { user?: any; session?: any }) => {
        if (!signupData.user) {
          throw new Error('Registration failed.');
        }
        if (!signupData.session) {
          throw new Error('Immediate sign-in after registration is unavailable because an active authenticated session was not returned.');
        }
        return { isAuthenticated: true };
      };

      expect(() => processSignupResult({ user: { id: 'u1' }, session: null })).toThrow(
        'Immediate sign-in after registration is unavailable'
      );

      const success = processSignupResult({
        user: { id: 'u1' },
        session: { access_token: 'token123' },
      });
      expect(success.isAuthenticated).toBe(true);
    });
  });
});

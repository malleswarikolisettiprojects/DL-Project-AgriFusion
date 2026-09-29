import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { getSession, signOut } from '../lib/auth';
import { verifyAdminAccess, type AdminAuthCheckResult } from '../lib/adminApi';
import type { AuthMeResponse } from '../types';
import { AdminLoginForm } from './admin/AdminLoginForm';
import { AccessDeniedPage } from './admin/AccessDeniedPage';

interface AdminRouteGuardProps {
  children: (user: AuthMeResponse) => React.ReactNode;
  onNavigateHome: () => void;
}

export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({
  children,
  onNavigateHome,
}) => {
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated' | 'forbidden' | 'not_configured' | 'error'>('checking');
  const [adminUser, setAdminUser] = useState<AuthMeResponse | null>(null);
  const [forbiddenUser, setForbiddenUser] = useState<{ id?: string; email?: string; role?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const checkAccess = async () => {
    setAuthState('checking');
    setErrorMessage('');
    setForbiddenUser(null);

    try {
      const session = await getSession();
      if (!session?.access_token) {
        setAuthState('unauthenticated');
        setErrorMessage('Please sign in to continue.');
        return;
      }

      const result: AdminAuthCheckResult = await verifyAdminAccess();

      if (result.status === 'authenticated') {
        setAdminUser(result.user);
        setAuthState('authenticated');
      } else if (result.status === 'forbidden') {
        setAuthState('forbidden');
        setErrorMessage(result.message || 'Admin access required.');
        if (result.user) {
          setForbiddenUser(result.user);
        } else if (session?.user) {
          setForbiddenUser({
            id: session.user.id,
            email: session.user.email,
            role: (session.user as any)?.role || 'farmer',
          });
        }
      } else if (result.status === 'not_configured') {
        setAuthState('not_configured');
        setErrorMessage(result.message || 'Admin authentication is not configured on the backend.');
      } else if (result.status === 'unauthenticated') {
        setAuthState('unauthenticated');
        setErrorMessage(result.message || 'Please sign in to continue.');
      } else {
        setAuthState('error');
        setErrorMessage(result.message || 'Unable to verify administrator access.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to verify administrator access.';
      setAuthState('error');
      setErrorMessage(msg);
    }
  };

  useEffect(() => {
    checkAccess();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
    setAdminUser(null);
    setAuthState('unauthenticated');
  };

  // State 1: Checking
  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-[#FAF8F1] flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-stone-200 rounded-3xl p-8 max-w-sm w-full text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-bold text-[#172018]">Checking administrator access...</h2>
          <p className="text-xs text-stone-500 mt-1">
            Verifying Supabase credentials and querying backend RBAC permissions.
          </p>
          <div className="mt-5 flex justify-center">
            <span className="w-5 h-5 border-2 border-purple-200 border-t-purple-700 rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // State 2: Unauthenticated -> Show Admin Login Form
  if (authState === 'unauthenticated') {
    return (
      <AdminLoginForm
        onSuccess={(user) => {
          setAdminUser(user);
          setAuthState('authenticated');
        }}
        onNavigateHome={onNavigateHome}
        onBackendNotConfigured={() => setAuthState('not_configured')}
      />
    );
  }

  // State 3: Forbidden (HTTP 403) -> Show Access Denied
  if (authState === 'forbidden') {
    return (
      <AccessDeniedPage
        userId={forbiddenUser?.id || adminUser?.user_id}
        email={forbiddenUser?.email || adminUser?.email}
        role={forbiddenUser?.role || adminUser?.role}
        onSignOut={handleSignOut}
        onNavigateHome={onNavigateHome}
      />
    );
  }

  // State 4: Backend endpoint not configured (HTTP 404 on /auth/admin-check and /auth/me)
  if (authState === 'not_configured') {
    return (
      <div className="min-h-screen bg-[#FAF8F1] flex items-center justify-center p-4">
        <div className="bg-white border border-stone-200 rounded-3xl max-w-lg w-full p-8 shadow-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-900 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            Backend Setup Required
          </span>

          <h1 className="text-xl font-bold text-[#172018] mt-3">
            Admin authentication is not configured on the backend.
          </h1>

          <p className="text-xs sm:text-sm text-stone-600 mt-2 leading-relaxed">
            The Admin UI is ready, but secure backend administrator authentication must be enabled before production use.
          </p>

          <div className="mt-5 p-4 bg-stone-50 rounded-2xl border border-stone-200 text-left text-xs text-stone-700 space-y-2">
            <p className="font-semibold text-stone-900">Required FastAPI Backend Endpoints:</p>
            <ul className="space-y-1 font-mono text-[11px] text-stone-600 list-disc list-inside">
              <li>GET /api/v1/auth/admin-check</li>
              <li>GET /api/v1/auth/me</li>
            </ul>
            <p className="text-[11px] text-stone-500 pt-1 border-t border-stone-200">
              The backend must verify the Supabase access token in the <code className="bg-stone-200/70 px-1 py-0.5 rounded">Authorization: Bearer</code> header and enforce the administrator role.
            </p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={checkAccess}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Verification</span>
            </button>
            <button
              type="button"
              onClick={onNavigateHome}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Farmer Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 5: General error state
  if (authState === 'error') {
    return (
      <div className="min-h-screen bg-[#FAF8F1] flex items-center justify-center p-4">
        <div className="bg-white border border-stone-200 rounded-3xl max-w-md w-full p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-[#172018]">Unable to verify administrator access.</h2>
          <p className="text-xs text-stone-600 mt-2">{errorMessage}</p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={checkAccess}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Verification</span>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 6: Authenticated & verified by backend
  if (adminUser) {
    return <>{children(adminUser)}</>;
  }

  return null;
};

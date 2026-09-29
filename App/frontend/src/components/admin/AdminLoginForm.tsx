import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck, Sprout } from 'lucide-react';
import { signInWithPassword } from '../../lib/auth';
import { verifyAdminAccess } from '../../lib/adminApi';
import type { AuthMeResponse } from '../../types';

interface AdminLoginFormProps {
  onSuccess: (user: AuthMeResponse) => void;
  onNavigateHome: () => void;
  onBackendNotConfigured?: () => void;
}

export const AdminLoginForm: React.FC<AdminLoginFormProps> = ({
  onSuccess,
  onNavigateHome,
  onBackendNotConfigured,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both your administrator email and password.');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Sign in with Supabase Auth
      await signInWithPassword(email.trim(), password);

      // Step 2: Backend-authoritative admin verification
      const checkResult = await verifyAdminAccess();

      if (checkResult.status === 'authenticated') {
        onSuccess(checkResult.user);
      } else if (checkResult.status === 'forbidden') {
        setError('Admin access required. This account does not possess administrator permissions on the backend.');
      } else if (checkResult.status === 'not_configured') {
        if (onBackendNotConfigured) {
          onBackendNotConfigured();
        } else {
          setError('Admin authentication is not configured on the backend.');
        }
      } else {
        setError(checkResult.message || 'Unable to verify administrator access.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F1] flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-3xl max-w-md w-full p-8 shadow-sm">
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#14532D] text-white flex items-center justify-center shadow-xs">
              <Sprout className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <span className="text-base font-extrabold text-[#172018] tracking-tight">AgriFusion</span>
              <span className="block text-[10px] font-semibold text-[#8B5E34] uppercase tracking-wider">
                Admin Gateway
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-purple-900 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
            <span>FastAPI RBAC</span>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-lg font-bold text-[#172018]">Administrator Sign In</h1>
          <p className="text-xs text-stone-500 mt-1">
            Sign in with your verified Supabase credentials to access administrative governance.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 leading-relaxed">
            <p className="font-semibold mb-0.5">Authentication Error:</p>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold text-stone-700 mb-1.5">
              Administrator Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@agrifusion.org"
                className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#14532D]/30 focus:border-[#14532D] transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-stone-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-10 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#14532D]/30 focus:border-[#14532D] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Security Note strictly per requirement */}
          <div className="p-3 bg-[#FAF8F1] border border-stone-200/80 rounded-xl text-[11px] text-stone-600 leading-relaxed">
            <span className="font-semibold text-stone-800">Security note: </span>
            Administrator access is verified by the secure backend. Do not share your credentials.
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-[#14532D] transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <span>{isLoading ? 'Verifying with Backend...' : 'Sign In as Administrator'}</span>
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-stone-100 text-center">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-[#14532D] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Farmer Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};

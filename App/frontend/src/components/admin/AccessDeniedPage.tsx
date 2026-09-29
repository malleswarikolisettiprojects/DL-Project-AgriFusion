import React, { useState } from 'react';
import { ArrowLeft, Check, Copy, KeyRound, LogOut, ShieldAlert } from 'lucide-react';

interface AccessDeniedPageProps {
  userId?: string;
  email?: string;
  role?: string;
  onSignOut: () => void;
  onNavigateHome: () => void;
}

export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({
  userId,
  email,
  role,
  onSignOut,
  onNavigateHome,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    if (userId) {
      navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F1] flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-3xl max-w-lg w-full p-8 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
          HTTP 403 Forbidden
        </span>

        <h1 className="text-xl font-bold text-[#172018] mt-3">Admin Access Required</h1>
        <p className="text-xs sm:text-sm text-stone-600 mt-2 leading-relaxed">
          Your Supabase authentication succeeded, but your account is not on the FastAPI backend administrator allowlist.
        </p>

        {/* Identity & User ID Details */}
        <div className="mt-5 p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-left text-xs space-y-2">
          {email && (
            <div className="flex justify-between py-1 border-b border-stone-200/60">
              <span className="text-stone-500">Authenticated Email:</span>
              <span className="font-semibold text-stone-800">{email}</span>
            </div>
          )}

          {userId && (
            <div className="py-1 border-b border-stone-200/60">
              <div className="flex items-center justify-between mb-1">
                <span className="text-stone-500 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-stone-400" />
                  <span>Supabase User UUID:</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#14532D] hover:underline cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy UUID</span>
                    </>
                  )}
                </button>
              </div>
              <code className="block w-full p-2 bg-white rounded-lg border border-stone-200 font-mono text-[11px] text-stone-800 break-all select-all">
                {userId}
              </code>
            </div>
          )}

          {role && (
            <div className="flex justify-between py-1">
              <span className="text-stone-500">Backend Assigned Role:</span>
              <span className="font-semibold text-rose-700 uppercase">{role}</span>
            </div>
          )}
        </div>

        {/* Actionable Instructions for Render configuration */}
        <div className="mt-4 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-left text-[11px] text-amber-900 leading-relaxed space-y-1.5">
          <p className="font-bold text-amber-950 flex items-center gap-1.5">
            <span>How to grant Admin privileges on Render:</span>
          </p>
          <ol className="list-decimal list-inside space-y-1 text-amber-800">
            <li>Copy the <strong>Supabase User UUID</strong> shown above.</li>
            <li>In Render, go to <strong>agrifusion-backend → Environment</strong>.</li>
            <li>Add or update: <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono font-bold">ADMIN_USER_IDS={userId || '<your-user-uuid>'}</code></li>
            <li>Click <strong>Save Changes</strong> and redeploy the backend.</li>
          </ol>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onNavigateHome}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Farmer Dashboard</span>
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] transition-colors cursor-pointer shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign In with Different Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};

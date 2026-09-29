import React from 'react';
import {
  ChevronRight,
  LogOut,
  Menu,
  RefreshCw,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import type { AdminHealth, AdminSection, AuthMeResponse } from '../../types';

interface AdminHeaderProps {
  activeSection: AdminSection;
  user: AuthMeResponse;
  health: AdminHealth | null;
  onRefreshHealth: () => void;
  onSignOut: () => void;
  onToggleMobileDrawer: () => void;
}

const SECTION_LABELS: Record<AdminSection, string> = {
  overview: 'Overview',
  users: 'Users',
  farms: 'Farm Profiles',
  advisories: 'Advisory Activity',
  diagnostics: 'Crop Diagnostics',
  health: 'System Health',
  predictions: 'ML Predictions',
  feedback: 'Feedback',
  sources: 'Knowledge Sources',
  schemes: 'Government Schemes',
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeSection,
  user,
  health,
  onRefreshHealth,
  onSignOut,
  onToggleMobileDrawer,
}) => {
  const isHealthy = health?.status === 'ok';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile Menu & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobileDrawer}
            className="md:hidden p-2 rounded-xl text-stone-600 hover:bg-stone-100 transition-colors"
            aria-label="Open mobile navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-stone-500">Admin</span>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            <span className="font-bold text-[#14532D]">
              {SECTION_LABELS[activeSection] || 'Portal'}
            </span>
          </nav>
        </div>

        {/* Right: Backend indicator, User profile, Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Backend Status indicator */}
          <button
            type="button"
            onClick={onRefreshHealth}
            title="Check live backend health"
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
              isHealthy
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isHealthy ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'
              }`}
            />
            <span>FastAPI Backend</span>
            <RefreshCw className="w-3 h-3 ml-0.5 text-stone-400" />
          </button>

          {/* Safe Administrator Identity (email + role, NO secrets) */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#FAF8F1] border border-stone-200">
            <div className="w-6 h-6 rounded-lg bg-[#14532D] text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            </div>
            <div className="text-left leading-none max-w-[140px] sm:max-w-[180px]">
              <p className="text-xs font-semibold text-[#172018] truncate" title={user.email}>
                {user.email}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] uppercase font-bold text-[#8B5E34] tracking-wider">
                  {user.role || 'Admin'}
                </span>
                <span className="text-[9px] font-mono text-stone-400">· RBAC</span>
              </div>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 hover:text-stone-900 transition-colors cursor-pointer"
            title="Sign out of Admin session"
          >
            <LogOut className="w-3.5 h-3.5 text-stone-500" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
};

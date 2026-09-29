import {
  Activity,
  Award,
  Bug,
  CloudSun,
  Coins,
  Compass,
  Droplets,
  FileCheck,
  FileSpreadsheet,
  FileText,
  History,
  Home,
  LandPlot,
  Layers,
  LogIn,
  Menu,
  MessageSquareQuote,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  ShieldCheck,
  Sprout,
  Stethoscope,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Wheat,
  X,
} from 'lucide-react';
import React from 'react';
import type { ActivePage, FarmerUser, HealthResponse } from '../types';

export interface NavigationProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  health: HealthResponse | null;
  onOpenSafetyModal: () => void;
  onRefreshHealth?: () => void;
  language?: 'en' | 'te';
  onToggleLanguage?: () => void;
  farmerUser?: FarmerUser | null;
  onOpenAuthModal?: (mode?: 'login' | 'signup' | 'profile') => void;
  onOpenFeedbackModal?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const NAV_ITEMS: Array<{
  id: ActivePage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}> = [
  { id: 'landing', label: 'Home', icon: Home },
  { id: 'dashboard', label: 'Farm Dashboard', icon: Sprout },
  { id: 'cost-profit', label: 'Cost & Profit Estimator', icon: Coins, badge: 'Calculator' },
  { id: 'crop-recommendation', label: 'Crop Advisory', icon: Compass },
  { id: 'climate-risk', label: 'Climate Risk', icon: CloudSun },
  { id: 'irrigation', label: 'Smart Irrigation', icon: Droplets },
  { id: 'disease-detection', label: 'Disease Check', icon: Stethoscope },
  { id: 'yield', label: 'Yield Forecast', icon: TrendingUp },
  { id: 'market', label: 'Market Forecast', icon: Coins },
  { id: 'advisor', label: 'CropWise Advisor', icon: MessageSquareQuote },
  { id: 'schemes', label: 'Govt Schemes', icon: FileCheck },
  { id: 'pipeline', label: 'Full Farm Analysis', icon: Activity, badge: 'Unified' },
  { id: 'farm-history', label: 'Daily Field Logs & History', icon: FileSpreadsheet },
];

export function TopNavigation({
  activePage,
  onNavigate,
  health,
  onOpenSafetyModal,
  onToggleMobileMenu,
  onRefreshHealth,
  farmerUser,
  onOpenAuthModal,
  onOpenFeedbackModal,
  isSidebarOpen = true,
  onToggleSidebar,
}: NavigationProps & { onToggleMobileMenu: () => void }) {
  const isHealthy = health?.status === 'ok';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
      {/* Simple Top Ribbon */}
      <div className="bg-[#0f3822] text-white text-[11px] font-medium border-b border-emerald-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-bold tracking-wide text-emerald-100">
              <Sprout className="w-3.5 h-3.5 text-emerald-400" />
              <span>AgriFusion</span>
            </span>
            <span className="hidden sm:inline text-emerald-600">•</span>
            <span className="hidden sm:inline text-emerald-200">
              Easy crop guide, expenses calculator & market prices for farmers
            </span>
          </div>

          <div className="flex items-center gap-3 text-emerald-100 text-[10px]">
            <span className="text-emerald-300 font-medium">Simple & Free Farm Helper</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo, Brand & Agricultural Symbol Toggle */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 -ml-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Agricultural Official Symbol Toggle (Replaces "Open Sidebar" text) */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className={`hidden md:inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-all cursor-pointer shadow-2xs group relative ${
                isSidebarOpen
                  ? 'bg-emerald-50/90 border-emerald-300 text-[#14532D] hover:bg-emerald-100 hover:border-emerald-400'
                  : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50 hover:border-[#14532D] hover:text-[#14532D]'
              }`}
              aria-label={isSidebarOpen ? 'Collapse Farm Directory' : 'Expand Farm Directory'}
              title={
                isSidebarOpen
                  ? 'Collapse Farm Directory'
                  : 'Open Farm Directory'
              }
            >
              {/* Agricultural Company Navigation Symbol */}
              <div className="flex items-center justify-center relative">
                {isSidebarOpen ? (
                  <PanelLeftClose className="w-4 h-4 text-[#14532D] group-hover:scale-110 transition-transform" />
                ) : (
                  <div className="flex items-center justify-center gap-0.5">
                    <Wheat className="w-3.5 h-3.5 text-[#14532D]" />
                    <PanelLeftOpen className="w-4 h-4 text-[#14532D] group-hover:scale-110 transition-transform" />
                  </div>
                )}
              </div>
            </button>
          )}

          {/* Official Agricultural Company Brand & Title */}
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
          >
            {/* Agricultural Mark */}
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#14532D] to-[#0A2F1B] text-white flex items-center justify-center shadow-xs border border-emerald-600/50 relative">
              <Wheat className="w-5 h-5 text-amber-300" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-white flex items-center justify-center">
                <Sprout className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-stone-900 group-hover:text-[#14532D] transition-colors">
                  AgriFusion
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#14532D] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  Farm Guide
                </span>
              </div>
              <span className="text-[10px] text-stone-500 block leading-tight font-medium">
                Smart Farming, Crop Costs & Market Prices
              </span>
            </div>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Calm Connection Status Indicator */}
          <button
            type="button"
            onClick={onRefreshHealth}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
              isHealthy
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                : health?.status === 'waking_up'
                ? 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100'
                : health === null
                ? 'bg-stone-100 border-stone-300 text-stone-700'
                : 'bg-rose-50 border-rose-300 text-rose-950 hover:bg-rose-100'
            }`}
            title="AgriFusion backend system status. Click to refresh health."
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isHealthy
                  ? 'bg-emerald-600 animate-pulse'
                  : health?.status === 'waking_up'
                  ? 'bg-amber-500 animate-ping'
                  : health === null
                  ? 'bg-stone-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="hidden sm:inline">
              {isHealthy
                ? 'Backend available'
                : health?.status === 'waking_up'
                ? 'Backend waking up'
                : health === null
                ? 'Checking backend'
                : 'Backend unavailable'}
            </span>
          </button>

          {/* Quick Farm Dashboard Link */}
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activePage === 'dashboard'
                ? 'bg-[#14532D] text-white'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
            }`}
          >
            <Sprout className="w-3.5 h-3.5" />
            <span>My Farm</span>
          </button>

          {/* Source & Safety Center Button */}
          <button
            type="button"
            onClick={onOpenSafetyModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#14532D] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-[#14532D]" />
            <span className="hidden sm:inline">Official Standards</span>
          </button>

          {/* Farmer Advisory Feedback Button */}
          {onOpenFeedbackModal && (
            <button
              type="button"
              onClick={onOpenFeedbackModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-300 transition-colors cursor-pointer"
              title="Share agronomic feedback or report discrepancies directly to extension scientists"
            >
              <MessageSquareQuote className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden md:inline">Help & Feedback</span>
            </button>
          )}

          {/* Farmer Profile & Account Button */}
          {farmerUser ? (
            <button
              type="button"
              onClick={() => onOpenAuthModal?.('profile')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-100/90 hover:bg-emerald-200 border border-emerald-300 text-emerald-950 transition-colors shadow-2xs cursor-pointer"
              title="Click to view or edit your farmer profile anytime"
            >
              <UserCheck className="w-4 h-4 text-emerald-800 shrink-0" />
              <div className="text-left hidden sm:block leading-tight">
                <span className="block font-bold truncate max-w-[120px]">{farmerUser.name}</span>
                <span className="block text-[10px] text-emerald-800 font-normal truncate max-w-[120px]">
                  {farmerUser.district}, {farmerUser.state}
                </span>
              </div>
              <span className="sm:hidden font-bold">Profile</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenAuthModal?.('login')}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 transition-colors cursor-pointer shadow-2xs"
              >
                <LogIn className="w-3.5 h-3.5 text-stone-600" />
                <span>Login</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuthModal?.('signup')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#14532D] hover:bg-[#14532D]/90 text-white transition-colors cursor-pointer shadow-2xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Top Navigation Bar - visible on the top like any other websites */}
      <nav className="hidden md:block bg-stone-50/95 border-t border-stone-200 px-4 sm:px-6 lg:px-8 py-1.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#14532D] text-white font-bold shadow-xs'
                    : 'text-stone-700 hover:bg-stone-200/80 hover:text-stone-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-300' : 'text-stone-500'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                      isActive ? 'bg-emerald-800 text-emerald-100' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

export function SidebarNavigation({
  activePage,
  onNavigate,
  language,
  onToggleLanguage,
  farmerUser,
  onOpenAuthModal,
  isOpen = true,
  onClose,
}: {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  language?: 'en' | 'te';
  onToggleLanguage?: () => void;
  farmerUser?: FarmerUser | null;
  onOpenAuthModal?: (mode?: 'login' | 'signup' | 'profile') => void;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <aside className="w-56 md:w-60 lg:w-64 shrink-0 hidden md:block sticky top-28 h-[calc(100vh-7.5rem)] overflow-y-auto pr-3 py-2">
      {/* Sidebar Top Header with Official Agricultural Symbol Toggle */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 px-1 border-b border-stone-200">
        <div className="flex items-center gap-1.5">
          <Wheat className="w-3.5 h-3.5 text-[#14532D]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-700">
            Farm Directory
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-500 hover:text-[#14532D] hover:bg-emerald-50 border border-stone-200 bg-white transition-colors cursor-pointer shadow-2xs"
            title="Collapse Sidebar Navigation"
            aria-label="Collapse Sidebar Navigation"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Farmer Account Card in Sidebar */}
      <div className="mb-3 p-3 rounded-2xl bg-white border border-stone-200 shadow-2xs">
        {farmerUser ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-stone-900 truncate">{farmerUser.name}</h5>
                <p className="text-[10px] text-stone-500 truncate">
                  {farmerUser.district}, {farmerUser.state}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuthModal?.('profile')}
              className="w-full py-1.5 px-2 rounded-lg text-xs font-semibold text-center bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
            >
              Edit Profile Anytime
            </button>
          </div>
        ) : (
          <div className="space-y-1.5 text-center">
            <p className="text-xs font-bold text-stone-800">Farmer Account</p>
            <p className="text-[11px] text-stone-500">Save farm profile & state info</p>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => onOpenAuthModal?.('login')}
                className="py-1 px-2 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => onOpenAuthModal?.('signup')}
                className="py-1 px-2 rounded-lg bg-[#14532D] text-white text-xs font-semibold hover:bg-[#14532D]/90 cursor-pointer"
              >
                Register
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-500">
          Farm Workspace
        </div>
        {NAV_ITEMS.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#14532D] text-white shadow-xs'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-stone-500'}`} />
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}

        <div className="pt-3 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-500">
          Field Advisory Tools
        </div>
        {NAV_ITEMS.slice(2, 7).map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#14532D] text-white shadow-xs font-semibold'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-stone-500'}`} />
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}

        <div className="pt-3 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-500">
          Protection & Guidance
        </div>
        {NAV_ITEMS.slice(7).map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#14532D] text-white shadow-xs font-semibold'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-stone-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                    isActive ? 'bg-emerald-700 text-emerald-100' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Farmer Help Box */}
      <div className="mt-6 p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
        <div className="flex items-center gap-2 mb-1 text-xs font-bold text-emerald-950">
          <Sprout className="w-4 h-4 text-[#14532D]" />
          <span>Kisan Helpline</span>
        </div>
        <p className="text-[11px] text-emerald-900/80 leading-relaxed mb-2">
          Toll-free agricultural assistance for AP & Telangana farmers:
        </p>
        <div className="text-xs font-bold text-[#14532D]">
          📞 1800-180-1551
        </div>
      </div>
    </aside>
  );
}

export function MobileDrawer({
  isOpen,
  onClose,
  activePage,
  onNavigate,
  farmerUser,
  onOpenAuthModal,
  onOpenFeedbackModal,
}: {
  isOpen: boolean;
  onClose: () => void;
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  language?: 'en' | 'te';
  onToggleLanguage?: () => void;
  farmerUser?: FarmerUser | null;
  onOpenAuthModal?: (mode?: 'login' | 'signup' | 'profile') => void;
  onOpenFeedbackModal?: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 w-72 max-w-full bg-white shadow-2xl p-4 flex flex-col justify-between">
        <div className="overflow-y-auto">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#14532D] text-white flex items-center justify-center">
                <Sprout className="w-4 h-4 text-emerald-300" />
              </div>
              <span className="font-bold text-stone-900">AgriFusion Menu</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-stone-500 hover:text-stone-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Farmer Account Box in Mobile Drawer */}
          <div className="mb-4 p-3 rounded-xl bg-stone-50 border border-stone-200">
            {farmerUser ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-900 truncate">{farmerUser.name}</p>
                    <p className="text-[10px] text-stone-500 truncate">
                      {farmerUser.district}, {farmerUser.state}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuthModal?.('profile');
                  }}
                  className="w-full py-1 px-2 rounded-lg text-xs font-semibold bg-[#14532D] text-white text-center"
                >
                  Edit Profile
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuthModal?.('login');
                  }}
                  className="flex-1 py-1 px-2 rounded-lg text-xs font-semibold bg-white border border-stone-200 text-stone-800 text-center"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuthModal?.('signup');
                  }}
                  className="flex-1 py-1 px-2 rounded-lg text-xs font-semibold bg-[#14532D] text-white text-center"
                >
                  Register
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#14532D] text-white font-semibold'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-stone-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Help & Feedback in Mobile Drawer */}
            {onOpenFeedbackModal && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFeedbackModal();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquareQuote className="w-4 h-4 text-emerald-700" />
                    <span>Help & Feedback (సహాయం & అభిప్రాయం)</span>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">
                    Review
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-stone-200 text-xs text-stone-500 text-center">
          AgriFusion • Andhra Pradesh & Telangana
        </div>
      </div>
    </div>
  );
}

export function MobileBottomNavigation({
  activePage,
  onNavigate,
}: {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
}) {
  const primaryTabs: Array<{ id: ActivePage; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: Sprout },
    { id: 'crop-recommendation', label: 'Crops', icon: Compass },
    { id: 'irrigation', label: 'Irrigation', icon: Droplets },
    { id: 'disease-detection', label: 'Disease', icon: Stethoscope },
    { id: 'pipeline', label: 'Full Farm', icon: Activity },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 pb-safe">
      <div className="grid grid-cols-5 h-14">
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePage === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-[#14532D] font-bold' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#14532D]' : 'text-stone-400'}`} />
              <span className="truncate max-w-[60px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function PageHeader({
  title,
  subtitle,
  badge,
  action,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed max-w-2xl">
          {subtitle}
        </p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

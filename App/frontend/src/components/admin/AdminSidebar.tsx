import React from 'react';
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  ChevronRight,
  LayoutDashboard,
  MessageSquareQuote,
  Server,
  Shield,
  Sprout,
  Stethoscope,
  Users,
} from 'lucide-react';
import type { AdminSection } from '../../types';

interface AdminSidebarProps {
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  onNavigateFarmer: () => void;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: AdminSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    description: 'System telemetry & key counters',
  },
  {
    id: 'users',
    label: 'Users',
    icon: Users,
    description: 'User directory & RBAC controls',
  },
  {
    id: 'farms',
    label: 'Farm Coverage',
    icon: Sprout,
    description: 'Aggregated regional acreage',
  },
  {
    id: 'advisories',
    label: 'Advisory Analytics',
    icon: Activity,
    description: 'Query logs & response audits',
  },
  {
    id: 'diagnostics',
    label: 'Crop Diagnostics',
    icon: Stethoscope,
    description: 'Computer vision & pathology logs',
  },
  {
    id: 'health',
    label: 'System Health',
    icon: Server,
    description: 'Backend, database & API performance',
  },
  {
    id: 'predictions',
    label: 'ML Predictions',
    icon: BarChart3,
    description: 'Yield & crop model inference logs',
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: MessageSquareQuote,
    description: 'Farmer satisfaction & ratings',
  },
  {
    id: 'sources',
    label: 'Knowledge Sources',
    icon: BookOpen,
    description: 'Canonical university repositories',
  },
  {
    id: 'schemes',
    label: 'Government Schemes',
    icon: Award,
    description: 'Verified subsidies & schemes',
  },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeSection,
  onSelectSection,
  onNavigateFarmer,
  onCloseMobile,
}) => {
  return (
    <aside className="w-64 bg-white border-r border-stone-200 flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      {/* Brand Header */}
      <div className="p-4 border-b border-stone-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#14532D] text-white flex items-center justify-center shadow-xs">
            <Shield className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#172018] tracking-tight">AgriFusion Admin</h2>
            <p className="text-[10px] text-stone-500 font-medium">Andhra Pradesh & Telangana</p>
          </div>
        </div>
      </div>

      {/* Navigation items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-stone-400 uppercase">
          Administrative Modules
        </div>
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                isActive
                  ? 'bg-[#14532D] text-white shadow-xs'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-300' : 'text-stone-500'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge ? (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase ${
                    isActive ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {item.badge}
                </span>
              ) : (
                isActive && <ChevronRight className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Farmer Dashboard Return */}
      <div className="p-3 border-t border-stone-200">
        <button
          type="button"
          onClick={onNavigateFarmer}
          className="w-full flex items-center justify-between p-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sprout className="w-4 h-4 text-[#16A34A]" />
            <span>Farmer Dashboard</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
        </button>
      </div>
    </aside>
  );
};

import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { AdminHealth, AdminSection, AuthMeResponse } from '../../types';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';

interface AdminLayoutProps {
  activeSection: AdminSection;
  user: AuthMeResponse;
  health: AdminHealth | null;
  onSelectSection: (section: AdminSection) => void;
  onRefreshHealth: () => void;
  onSignOut: () => void;
  onNavigateFarmer: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  activeSection,
  user,
  health,
  onSelectSection,
  onRefreshHealth,
  onSignOut,
  onNavigateFarmer,
  children,
}) => {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAF8F1] text-[#172018] flex flex-col font-sans">
      {/* Top Header */}
      <AdminHeader
        activeSection={activeSection}
        user={user}
        health={health}
        onRefreshHealth={onRefreshHealth}
        onSignOut={onSignOut}
        onToggleMobileDrawer={() => setIsMobileDrawerOpen(true)}
      />

      {/* Main Structural Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Left Sidebar */}
        <div className="hidden md:block">
          <AdminSidebar
            activeSection={activeSection}
            onSelectSection={onSelectSection}
            onNavigateFarmer={onNavigateFarmer}
          />
        </div>

        {/* Mobile Drawer */}
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileDrawerOpen(false)}
            />

            {/* Drawer Content */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-2xl z-10">
              <div className="absolute top-2 right-2 p-2">
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <AdminSidebar
                activeSection={activeSection}
                onSelectSection={(sec) => {
                  onSelectSection(sec);
                  setIsMobileDrawerOpen(false);
                }}
                onNavigateFarmer={onNavigateFarmer}
                onCloseMobile={() => setIsMobileDrawerOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main Administrative Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

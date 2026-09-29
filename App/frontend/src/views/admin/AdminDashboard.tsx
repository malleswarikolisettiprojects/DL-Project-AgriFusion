import React, { useEffect, useState } from 'react';
import { getBackendHealth } from '../../lib/adminApi';
import { signOut } from '../../lib/auth';
import type { ActivePage, AdminHealth, AdminSection, AuthMeResponse } from '../../types';
import { AdminRouteGuard } from '../../components/AdminRouteGuard';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminOverviewSection } from './AdminOverviewSection';
import { AdminUsersSection } from './AdminUsersSection';
import { AdminFarmsSection } from './AdminFarmsSection';
import { AdminAdvisoriesSection } from './AdminAdvisoriesSection';
import { AdminFeedbackSection } from './AdminFeedbackSection';
import { AdminSourcesSection } from './AdminSourcesSection';
import { AdminSchemesSection } from './AdminSchemesSection';
import { AdminHealthSection } from './AdminHealthSection';
import { AdminDiagnosticsSection } from './AdminDiagnosticsSection';
import { AdminPredictionsSection } from './AdminPredictionsSection';

interface AdminDashboardProps {
  onNavigateFarmer: (page: ActivePage) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateFarmer }) => {
  // Support deep links via location hash (e.g. #admin/users)
  const getInitialSection = (): AdminSection => {
    const valid: AdminSection[] = [
      'overview',
      'users',
      'farms',
      'advisories',
      'diagnostics',
      'health',
      'predictions',
      'feedback',
      'sources',
      'schemes',
    ];
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/^\/+/, '');
      if (path.startsWith('admin/')) {
        const sec = path.replace('admin/', '').split('/')[0] as AdminSection;
        if (valid.includes(sec)) return sec;
      }
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash.startsWith('admin/')) {
        const sec = hash.replace('admin/', '').split('/')[0] as AdminSection;
        if (valid.includes(sec)) return sec;
      }
    }
    return 'overview';
  };

  const [activeSection, setActiveSection] = useState<AdminSection>(getInitialSection);
  const [health, setHealth] = useState<AdminHealth | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveSection(getInitialSection());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const fetchHealth = async () => {
    try {
      const h = await getBackendHealth();
      setHealth(h);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = window.setInterval(fetchHealth, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const handleSelectSection = (section: AdminSection) => {
    setActiveSection(section);
    window.location.hash = `admin/${section}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
    window.location.hash = '';
    onNavigateFarmer('landing');
  };

  return (
    <AdminRouteGuard onNavigateHome={() => onNavigateFarmer('landing')}>
      {(adminUser: AuthMeResponse) => (
        <AdminLayout
          activeSection={activeSection}
          user={adminUser}
          health={health}
          onSelectSection={handleSelectSection}
          onRefreshHealth={fetchHealth}
          onSignOut={handleSignOut}
          onNavigateFarmer={() => onNavigateFarmer('dashboard')}
        >
          {activeSection === 'overview' && (
            <AdminOverviewSection onNavigateSection={handleSelectSection} />
          )}

          {activeSection === 'users' && <AdminUsersSection />}

          {activeSection === 'farms' && <AdminFarmsSection />}

          {activeSection === 'advisories' && <AdminAdvisoriesSection />}

          {activeSection === 'diagnostics' && <AdminDiagnosticsSection />}

          {activeSection === 'health' && <AdminHealthSection />}

          {activeSection === 'predictions' && <AdminPredictionsSection />}

          {activeSection === 'feedback' && <AdminFeedbackSection />}

          {activeSection === 'sources' && <AdminSourcesSection />}

          {activeSection === 'schemes' && <AdminSchemesSection />}
        </AdminLayout>
      )}
    </AdminRouteGuard>
  );
};

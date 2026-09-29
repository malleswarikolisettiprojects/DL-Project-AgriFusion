/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  MobileBottomNavigation,
  MobileDrawer,
  SidebarNavigation,
  TopNavigation,
} from './components/Navigation';
import { Footer } from './components/Footer';
import { SafetyModal } from './components/SafetyModal';
import { InfoModal, type InfoModalTab } from './components/InfoModal';
import { FarmerAuthModal } from './components/FarmerAuthModal';
import { FeedbackModal } from './components/FeedbackModal';
import { LoginCompulsoryGate } from './components/LoginCompulsoryGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { checkHealth } from './lib/api';
import { fetchFarmerProfile, getSession, signOut } from './lib/auth';
import { supabase } from './lib/supabase';
import type { ActivePage, FarmerUser, HealthResponse, UserFarmProfile } from './types';
import { ClimateRiskView } from './views/ClimateRiskView';
import { CropRecommendationView } from './views/CropRecommendationView';
import { CropWiseAdvisorView } from './views/CropWiseAdvisorView';
import { DiagnosticsView } from './views/DiagnosticsView';
import { DiseaseDetectionView } from './views/DiseaseDetectionView';
import { FarmHistoryView } from './views/FarmHistoryView';
import { FarmerDashboard } from './views/FarmerDashboard';
import { IrrigationView } from './views/IrrigationView';
import { LandingPage } from './views/LandingPage';
import { MarketForecastView } from './views/MarketForecastView';
import { PipelineView } from './views/PipelineView';
import { SchemesView } from './views/SchemesView';
import { YieldForecastView } from './views/YieldForecastView';
import { CostProfitEstimatorView } from './views/CostProfitEstimatorView';
import { AdminDashboard } from './views/admin/AdminDashboard';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>(() => {
    if (typeof window !== 'undefined') {
      if (
        window.location.hash.startsWith('#admin') ||
        window.location.pathname.startsWith('/admin')
      ) {
        return 'admin';
      }
    }
    return 'landing';
  });
  const [language, setLanguage] = useState<'en' | 'te'>('en');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [infoModalTab, setInfoModalTab] = useState<InfoModalTab>('about');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Sidebar UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  // Farmer User authentication & profile state
  const [currentUser, setCurrentUser] = useState<FarmerUser | null>(null);

  const isLoggedIn = Boolean(currentUser?.isLoggedIn);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | 'profile'>('login');
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const handleOpenAuthModal = (mode: 'login' | 'signup' | 'profile' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleOpenFeedbackModal = () => {
    setIsFeedbackModalOpen(true);
  };

  const handleUserLogin = (user: FarmerUser) => {
    setCurrentUser(user);
    // Synchronize app farm profile with user's details
    const updatedProfile: UserFarmProfile = {
      ...(profile || DEFAULT_PROFILE),
      user_email: user.email || profile?.user_email || DEFAULT_PROFILE.user_email,
      farmer_name: user.name || profile?.farmer_name || DEFAULT_PROFILE.farmer_name,
      mobile: user.phone || user.mobile || profile?.mobile || DEFAULT_PROFILE.mobile,
      user_name: user.name || profile?.user_name || DEFAULT_PROFILE.farmer_name,
      user_phone: user.phone || user.mobile || profile?.user_phone || DEFAULT_PROFILE.mobile,
      state: user.state || profile?.state || DEFAULT_PROFILE.state,
      district: user.district || profile?.district || DEFAULT_PROFILE.district,
      village: user.village || profile?.village || DEFAULT_PROFILE.village,
      area_ha: user.area_ha ?? profile?.area_ha ?? DEFAULT_PROFILE.area_ha,
      crop: user.crop || profile?.crop || DEFAULT_PROFILE.crop,
      sowing_date: user.sowing_date || profile?.sowing_date || DEFAULT_PROFILE.sowing_date,
      soil_type: user.soil_type || profile?.soil_type || DEFAULT_PROFILE.soil_type,
      irrigation_source: user.irrigation_source || profile?.irrigation_source || DEFAULT_PROFILE.irrigation_source,
    };
    handleUpdateProfile(updatedProfile);

    // After registering or signing in, take the farmer directly to the home page of the portal (dashboard)
    setActivePage('dashboard');
  };

  const handleUserLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn('Signout note:', err);
    }
    setCurrentUser(null);
    setActivePage('landing');
    handleOpenAuthModal('login');
  };

  // User farm profile state (session memory synchronized with backend)
  const [profile, setProfile] = useState<UserFarmProfile>(DEFAULT_PROFILE);

  const handleUpdateProfile = (newProfile: UserFarmProfile) => {
    setProfile(newProfile);
  };

  // Hydration state tracking
  const [isHydrating, setIsHydrating] = useState<boolean>(true);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  // Restore active Supabase session & persistent backend farmer profile/farm records on mount
  const restoreFarmerSession = useCallback(async () => {
    setIsHydrating(true);
    setHydrationError(null);

    try {
      const session = await getSession();
      if (session?.user) {
        const u = session.user;
        const phone = u.user_metadata?.phone || u.phone || '';
        let name = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Farmer';

        const restoredUser: FarmerUser = {
          id: u.id,
          name,
          mobile: phone,
          phone,
          email: u.email || '',
          isLoggedIn: true,
          isRegistered: true,
          createdAt: u.created_at,
          state: u.user_metadata?.state || DEFAULT_PROFILE.state,
          district: u.user_metadata?.district || DEFAULT_PROFILE.district,
          village: u.user_metadata?.village || DEFAULT_PROFILE.village,
          area_ha: u.user_metadata?.area_ha ?? DEFAULT_PROFILE.area_ha,
          crop: u.user_metadata?.crop || DEFAULT_PROFILE.crop,
        };

        try {
          const backendData = await fetchFarmerProfile();
          if (backendData?.profile) {
            if (backendData.profile.full_name) {
              name = backendData.profile.full_name;
              restoredUser.name = name;
            }
            if (backendData.profile.phone) {
              restoredUser.phone = backendData.profile.phone;
              restoredUser.mobile = backendData.profile.phone;
            }
          }

          if (backendData?.farms && Array.isArray(backendData.farms) && backendData.farms.length > 0) {
            const farm = backendData.farms[0];
            restoredUser.state = farm.state || restoredUser.state;
            restoredUser.district = farm.district || restoredUser.district;
            restoredUser.village = farm.village || restoredUser.village;
            restoredUser.area_ha = farm.land_area ?? restoredUser.area_ha;
            restoredUser.soil_type = farm.soil_type || restoredUser.soil_type;

            setProfile((prev) => ({
              ...prev,
              state: farm.state || prev.state,
              district: farm.district || prev.district,
              village: farm.village || prev.village,
              area_ha: farm.land_area ?? prev.area_ha,
              soil_type: farm.soil_type || prev.soil_type,
              farmer_name: name,
              mobile: restoredUser.phone,
              user_email: restoredUser.email,
            }));
          } else {
            setProfile((prev) => ({
              ...prev,
              state: restoredUser.state || prev.state,
              district: restoredUser.district || prev.district,
              village: restoredUser.village || prev.village,
              area_ha: restoredUser.area_ha ?? prev.area_ha,
              farmer_name: name,
              mobile: restoredUser.phone,
              user_email: restoredUser.email,
            }));
          }
        } catch (apiErr) {
          console.warn('Backend profile/farm hydration note:', apiErr);
          setHydrationError('Could not sync latest farm profile with the server. Local farm preferences are active.');
        }

        setCurrentUser(restoredUser);
        setActivePage((prev) => (prev === 'landing' || !prev ? 'dashboard' : prev));
      }
    } catch (sessionErr) {
      console.warn('Farmer session restoration note:', sessionErr);
      setHydrationError('Session check encountered an issue. Local parameters are active.');
    } finally {
      setIsHydrating(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    restoreFarmerSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && mounted) {
        setCurrentUser(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [restoreFarmerSession]);

  const refreshHealth = () => {
    checkHealth()
      .then((h: HealthResponse) => {
        setHealth(h);
      })
      .catch((err: unknown) => {
        console.warn('Backend health check note:', err);
      });
  };

  // Poll /health on initial load and keep connection warm
  useEffect(() => {
    let mounted = true;
    const fetchStatus = () => {
      checkHealth()
        .then((h: HealthResponse) => {
          if (mounted) setHealth(h);
        })
        .catch((err: unknown) => {
          console.warn('Backend health check note:', err);
        });
    };

    fetchStatus();

    // Poll every 12s if disconnected, or every 60s once connected
    const interval = window.setInterval(
      fetchStatus,
      health?.status === 'ok' ? 60000 : 12000
    );

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [health?.status]);

  // Close drawer and modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileDrawerOpen(false);
        setIsSafetyModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Synchronize routing for #admin and /admin routes
  useEffect(() => {
    const handleHash = () => {
      if (
        window.location.hash.startsWith('#admin') ||
        window.location.pathname.startsWith('/admin')
      ) {
        setActivePage('admin');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('popstate', handleHash);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('popstate', handleHash);
    };
  }, []);

  const handleNavigate = (page: ActivePage) => {
    setActivePage(page);
    if (page === 'admin') {
      if (!window.location.hash.startsWith('#admin')) {
        window.location.hash = 'admin/overview';
      }
    } else if (window.location.hash.startsWith('#admin')) {
      window.location.hash = '';
    }
    setIsMobileDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dedicated Admin experience if activePage is admin
  if (activePage === 'admin') {
    return <AdminDashboard onNavigateFarmer={handleNavigate} />;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900 flex flex-col font-sans selection:bg-emerald-200">
      {/* Accessibility Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-[#14532D] text-white rounded-xl shadow-lg text-xs font-semibold focus:outline-hidden"
      >
        Skip to main content
      </a>

      {/* Top sticky navigation bar */}
      <TopNavigation
        activePage={activePage}
        onNavigate={handleNavigate}
        health={health}
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'en' ? 'te' : 'en'))}
        onOpenSafetyModal={() => {
          setInfoModalTab('safety');
          setIsInfoModalOpen(true);
        }}
        onOpenFeedbackModal={handleOpenFeedbackModal}
        onToggleMobileMenu={() => setIsMobileDrawerOpen(true)}
        onRefreshHealth={refreshHealth}
        farmerUser={currentUser}
        onOpenAuthModal={handleOpenAuthModal}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
      />

      {/* Top Mandatory Advisory Banner: AI Safety & Chemical/Fertilizer Consultation Notice */}
      <div className="w-full bg-amber-50/95 border-b border-amber-200/90 py-2.5 px-4 sm:px-6 lg:px-8 text-left shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0 mt-1 animate-pulse" />
            <div>
              <p className="font-bold text-amber-950 flex flex-wrap items-center gap-1.5 leading-relaxed">
                <span>Mandatory Advisory:</span>
                <span className="font-normal text-amber-900">
                  AI models may make mistakes. All digital recommendations—especially chemical pesticides, fungicides, herbicides, and fertilizer dosages—are decision-support estimates only and <strong>MUST be consulted with and verified by your local Agricultural Extension Officer (AEO/DAO), KVK scientist, or certified agronomist</strong> before purchasing or applying to fields.
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end md:self-center text-[11px]">
            <a
              href="tel:18001801551"
              className="font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-300 transition-colors"
            >
              Kisan Helpline: 1800-180-1551
            </a>
            <button
              type="button"
              onClick={() => setIsSafetyModalOpen(true)}
              className="font-semibold text-amber-900 hover:text-stone-900 underline underline-offset-2 cursor-pointer"
            >
              Full Protocol
            </button>
          </div>
        </div>
      </div>

      {/* Main page layout */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 md:pb-12">
        <div className="flex gap-8">
          {/* Desktop Left Sidebar (closable and collapsible) */}
          <SidebarNavigation
            activePage={activePage}
            onNavigate={handleNavigate}
            language={language}
            farmerUser={currentUser}
            onOpenAuthModal={handleOpenAuthModal}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />

          {/* Main Content Area */}
          <main className="flex-1 min-w-0" id="main-content">
            {isHydrating && !currentUser ? (
              <div className="p-12 text-center text-stone-600 space-y-3 bg-white rounded-3xl border border-stone-200 shadow-sm max-w-md mx-auto my-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center mx-auto">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#14532D]" />
                </div>
                <h3 className="font-bold text-sm text-stone-900">Synchronizing AgriFusion Session</h3>
                <p className="text-xs text-stone-500">Restoring farm records and agricultural parameters...</p>
              </div>
            ) : activePage === 'landing' ? (
              <LandingPage
                onNavigate={handleNavigate}
                onOpenSafetyModal={() => {
                  setInfoModalTab('safety');
                  setIsInfoModalOpen(true);
                }}
                health={health}
                language={language}
                farmerUser={currentUser}
                onOpenAuthModal={handleOpenAuthModal}
              />
            ) : !isLoggedIn ? (
              /* Authentication Gate: Informs what module does and prompts login */
              <LoginCompulsoryGate
                activePage={activePage}
                onOpenAuthModal={handleOpenAuthModal}
                onNavigateToLanding={() => handleNavigate('landing')}
              />
            ) : (
              /* Authenticated Farmer Views wrapped in ErrorBoundary */
              <ErrorBoundary fallbackTitle="AgriFusion Module Recovery">
                {hydrationError && (
                  <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>{hydrationError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreFarmerSession()}
                      className="px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] transition-colors cursor-pointer shrink-0"
                    >
                      Retry Profile Sync
                    </button>
                  </div>
                )}

                {activePage === 'crop-recommendation' ? (
                  <CropRecommendationView profile={profile} />
                ) : activePage === 'climate-risk' ? (
                  <ClimateRiskView profile={profile} />
                ) : activePage === 'irrigation' ? (
                  <IrrigationView profile={profile} />
                ) : activePage === 'yield' ? (
                  <YieldForecastView profile={profile} />
                ) : activePage === 'cost-profit' ? (
                  <CostProfitEstimatorView profile={profile} />
                ) : activePage === 'market' ? (
                  <MarketForecastView profile={profile} />
                ) : activePage === 'disease-detection' ? (
                  <DiseaseDetectionView profile={profile} />
                ) : activePage === 'advisor' ? (
                  <CropWiseAdvisorView
                    profile={profile}
                    language={language}
                    onToggleLanguage={() => setLanguage((l) => (l === 'en' ? 'te' : 'en'))}
                    onNavigate={(page) => setActivePage(page as any)}
                  />
                ) : activePage === 'schemes' ? (
                  <SchemesView profile={profile} />
                ) : activePage === 'pipeline' ? (
                  <PipelineView profile={profile} />
                ) : activePage === 'history' || activePage === 'farm-history' ? (
                  <FarmHistoryView profile={profile} />
                ) : activePage === 'diagnostics' ? (
                  <DiagnosticsView />
                ) : (
                  <FarmerDashboard
                    profile={profile}
                    onUpdateProfile={handleUpdateProfile}
                    onNavigate={handleNavigate}
                    language={language}
                  />
                )}
              </ErrorBoundary>
            )}
          </main>
        </div>
      </div>

      {/* Comprehensive Standard Website Footer */}
      <Footer
        onNavigate={handleNavigate}
        onOpenSafetyModal={() => {
          setInfoModalTab('safety');
          setIsInfoModalOpen(true);
        }}
        onOpenInfoModal={(tab) => {
          setInfoModalTab(tab);
          setIsInfoModalOpen(true);
        }}
        onOpenAuthModal={handleOpenAuthModal}
        onOpenFeedbackModal={handleOpenFeedbackModal}
        currentUser={currentUser}
        health={health}
      />

      {/* Mobile Drawer Navigation */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        activePage={activePage}
        onNavigate={handleNavigate}
        language={language}
        farmerUser={currentUser}
        onOpenAuthModal={handleOpenAuthModal}
        onOpenFeedbackModal={handleOpenFeedbackModal}
      />

      {/* Mobile Bottom Thumb Navigation */}
      <MobileBottomNavigation
        activePage={activePage}
        onNavigate={handleNavigate}
      />

      {/* Unified Information Hub Modal (About, Privacy, Sources, Safety) */}
      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        initialTab={infoModalTab}
        onNavigate={handleNavigate}
      />

      {/* Safety & Sources Modal (Backward-compatible fallback) */}
      <SafetyModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
      />

      {/* Farmer Advisory Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        defaultModule={activePage}
        defaultCrop={profile?.crop || 'Field Crop'}
        district={profile?.district || currentUser?.district || 'Andhra Pradesh / Telangana'}
      />

      {/* Farmer Login / Register / Profile Modal */}
      <FarmerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        profile={profile}
        user={currentUser}
        initialTab={authModalMode}
        onLogin={(user, customProfile) => {
          handleUserLogin(user);
          if (customProfile) {
            handleUpdateProfile(customProfile);
          }
          setIsAuthModalOpen(false);
        }}
        onLogout={handleUserLogout}
        onSaveProfile={(newProf) => {
          handleUpdateProfile(newProf);
          if (currentUser) {
            const updatedUser: FarmerUser = {
              ...currentUser,
              name: newProf.farmer_name || currentUser.name,
              state: newProf.state,
              district: newProf.district,
              village: newProf.village,
              area_ha: newProf.area_ha,
              crop: newProf.crop,
            };
            setCurrentUser(updatedUser);
            try {
              localStorage.setItem('agrifusion_farmer_user', JSON.stringify(updatedUser));
            } catch {
              // ignore
            }
          }
        }}
      />
    </div>
  );
}

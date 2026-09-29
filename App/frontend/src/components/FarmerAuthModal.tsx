import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Phone,
  Sprout,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { AreaInputField } from './AreaInputField';
import { COMMON_CROPS, STATES_AND_DISTRICTS } from '../data/agriData';
import type { FarmerUser, UserFarmProfile } from '../types';
import {
  fetchFarmerProfile,
  normalizeAuthIdentifier,
  resendConfirmationEmail,
  saveFarmerFarm,
  signInWithPassword,
  signUpWithPassword,
  updateFarmerProfile,
} from '../lib/auth';
import { saveFarmRecord } from '../lib/api';

export interface FarmerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserFarmProfile;
  user: FarmerUser | null;
  onSaveProfile: (profile: UserFarmProfile) => void;
  onLogin: (user: FarmerUser, profile?: UserFarmProfile) => void;
  onLogout: () => void;
  initialTab?: 'profile' | 'login' | 'signup';
}

export function FarmerAuthModal({
  isOpen,
  onClose,
  profile,
  user,
  onSaveProfile,
  onLogin,
  onLogout,
  initialTab = 'profile',
}: FarmerAuthModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'login' | 'signup'>(
    user?.isLoggedIn ? 'profile' : initialTab === 'profile' ? 'login' : initialTab
  );

  useEffect(() => {
    if (isOpen) {
      if (user?.isLoggedIn) {
        setActiveTab('profile');
      } else {
        setActiveTab(initialTab === 'profile' ? 'login' : initialTab);
      }
    }
  }, [isOpen, user?.isLoggedIn, initialTab]);

  // Auth fields
  const [authMobile, setAuthMobile] = useState(user?.mobile || user?.phone || '');
  const [authName, setAuthName] = useState(user?.name || profile.farmer_name || '');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profile fields
  const [formData, setFormData] = useState<UserFarmProfile>({
    state: profile.state || 'Andhra Pradesh',
    district: profile.district || 'Visakhapatnam',
    area_ha: profile.area_ha || 2,
    farmer_name: profile.farmer_name || user?.name || '',
    mobile: profile.mobile || user?.mobile || '',
    village: profile.village || '',
    crop: profile.crop || 'Rice',
    soil_type: profile.soil_type || 'Loam Soil',
    irrigation_source: profile.irrigation_source || 'Borewell',
    sowing_date: profile.sowing_date || '2026-06-15',
    pump_hp: profile.pump_hp || 5,
    user_email: profile.user_email || 'farmer@agrifusion.com',
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedStateObj =
    STATES_AND_DISTRICTS.find((s) => s.name === formData.state) || STATES_AND_DISTRICTS[0];

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    const rawInput = authMobile.trim();
    if (!rawInput) {
      setAuthError('Please enter a valid mobile number or email address.');
      setIsSubmitting(false);
      return;
    }

    const isRealEmail = rawInput.includes('@');
    const authEmail = normalizeAuthIdentifier(rawInput);

    const cleanPassword = authPassword.trim();
    if (!cleanPassword) {
      setAuthError('Please enter a password.');
      setIsSubmitting(false);
      return;
    }

    if (activeTab === 'signup' && (rawInput.toLowerCase().includes('admin@gmail.com') || authEmail.toLowerCase().includes('admin@gmail.com'))) {
      setAuthError('Administrative accounts (e.g., admin@gmail.com) cannot be created via public farmer registration. Please use the secure Admin Portal.');
      setIsSubmitting(false);
      return;
    }

    if (activeTab === 'signup' && cleanPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long for secure account creation.');
      setIsSubmitting(false);
      return;
    }

    if (activeTab === 'signup') {
      try {
        const nameToUse = authName.trim() || formData.farmer_name || 'Kisan Mitra';
        const signupMetadata = {
          full_name: nameToUse,
          phone: !isRealEmail ? rawInput : '',
          role: 'farmer',
          state: formData.state,
          district: formData.district,
          village: formData.village,
          area_ha: formData.area_ha,
          crop: formData.crop,
          soil_type: formData.soil_type,
        };

        const signupData = await signUpWithPassword(authEmail, cleanPassword, signupMetadata);

        const supabaseUser = signupData?.user;
        const session = signupData?.session;

        if (!supabaseUser) {
          throw new Error('Sign up failed. Please try again.');
        }

        // REQUIREMENT 1, 2, 5: CHECK ACTIVE SESSION
        if (!session) {
          throw new Error(
            'Immediate sign-in after registration is unavailable because an active authenticated session was not returned. Please ensure "Confirm email" is turned OFF in your Supabase Auth provider settings, or try signing in directly with your registered credentials.'
          );
        }

        // ONLY PERSIST PROFILE/FARM WHEN AN AUTHENTICATED SESSION EXISTS
        await updateFarmerProfile({
          full_name: nameToUse,
          phone: rawInput,
        });

        await saveFarmerFarm({
          name: `${formData.state} Farm`,
          state: formData.state,
          district: formData.district,
          village: formData.village,
          land_area: formData.area_ha,
          land_area_unit: 'hectares',
          soil_type: formData.soil_type,
        });

        try {
          await saveFarmRecord({
            user_email: authEmail,
            record_type: 'farmer_profile',
            record_data: {
              ...formData,
              farmer_name: nameToUse,
              mobile: rawInput,
              user_email: authEmail,
            },
          });
        } catch {
          // ignore
        }

        const newUserObj: FarmerUser = {
          id: supabaseUser.id,
          name: nameToUse,
          mobile: rawInput,
          phone: rawInput,
          email: supabaseUser.email || authEmail,
          isLoggedIn: true,
          isRegistered: true,
          createdAt: supabaseUser.created_at || new Date().toISOString(),
          state: formData.state,
          district: formData.district,
          village: formData.village,
          area_ha: formData.area_ha,
          crop: formData.crop,
        };

        const newProfileObj: UserFarmProfile = {
          ...formData,
          farmer_name: nameToUse,
          mobile: rawInput,
          user_email: authEmail,
        };

        onLogin(newUserObj, newProfileObj);
        onClose();
      } catch (err: any) {
        setAuthError(err.message || 'Failed to create farmer account. Please check inputs.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // LOGIN
      try {
        const loginData = await signInWithPassword(authEmail, cleanPassword);
        const supabaseUser = loginData?.user;
        const session = loginData?.session;

        if (!supabaseUser || !session) {
          throw new Error('Sign in failed. No active authenticated session returned.');
        }

        // Fetch backend profile & farm data
        const backendData = await fetchFarmerProfile();
        const userMeta = supabaseUser.user_metadata || {};

        let restoredName =
          userMeta.full_name || authName.trim() || profile.farmer_name || 'Kisan Mitra';
        let restoredPhone = userMeta.phone || (isRealEmail ? profile.mobile : rawInput);

        let restoredProfile: UserFarmProfile = {
          ...formData,
          farmer_name: restoredName,
          mobile: restoredPhone,
          user_email: supabaseUser.email || authEmail,
          state: userMeta.state || formData.state,
          district: userMeta.district || formData.district,
          village: userMeta.village || formData.village,
          area_ha: userMeta.area_ha || formData.area_ha,
          crop: userMeta.crop || formData.crop,
          soil_type: userMeta.soil_type || formData.soil_type,
        };

        if (backendData?.profile) {
          if (backendData.profile.full_name) restoredName = backendData.profile.full_name;
          if (backendData.profile.phone) restoredPhone = backendData.profile.phone;
        }

        if (backendData?.farms && backendData.farms.length > 0) {
          const farm = backendData.farms[0];
          restoredProfile = {
            ...restoredProfile,
            state: farm.state || restoredProfile.state,
            district: farm.district || restoredProfile.district,
            village: farm.village || restoredProfile.village,
            area_ha: farm.land_area ?? restoredProfile.area_ha,
            soil_type: farm.soil_type || restoredProfile.soil_type,
          };
        }

        // Save & sync chosen farm profile alongside login to backend
        try {
          await updateFarmerProfile({
            full_name: restoredName,
            phone: restoredPhone,
          });

          await saveFarmerFarm({
            name: `${restoredProfile.state} Farm`,
            state: restoredProfile.state,
            district: restoredProfile.district,
            village: restoredProfile.village,
            land_area: restoredProfile.area_ha,
            land_area_unit: 'hectares',
            soil_type: restoredProfile.soil_type,
          });

          await saveFarmRecord({
            user_email: supabaseUser.email || authEmail,
            record_type: 'farmer_profile',
            record_data: restoredProfile as any,
          });
        } catch {
          // ignore
        }

        const loggedInUserObj: FarmerUser = {
          id: supabaseUser.id,
          name: restoredName,
          mobile: restoredPhone,
          phone: restoredPhone,
          email: supabaseUser.email || authEmail,
          isLoggedIn: true,
          isRegistered: true,
          createdAt: supabaseUser.created_at || new Date().toISOString(),
          state: restoredProfile.state,
          district: restoredProfile.district,
          village: restoredProfile.village,
          area_ha: restoredProfile.area_ha,
          crop: restoredProfile.crop,
        };

        onLogin(loggedInUserObj, restoredProfile);
        onClose();
      } catch (err: any) {
        const msg = err?.message || '';
        if (
          msg.toLowerCase().includes('email not confirmed') ||
          msg.toLowerCase().includes('unconfirmed')
        ) {
          setAuthError(
            'Account is unconfirmed. In no-confirmation mode, please ensure "Confirm email" is disabled in your Supabase Auth provider settings.'
          );
        } else {
          setAuthError(msg || 'Sign in failed. Please check your phone/email and password.');
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.state || !formData.district) {
      setValidationError('State and District (Place) are compulsory fields.');
      return;
    }

    if (!formData.area_ha || Number(formData.area_ha) <= 0) {
      setValidationError('Land Area is a compulsory field and must be greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateFarmerProfile({
        full_name: formData.farmer_name || user?.name || '',
        phone: formData.mobile || user?.mobile || '',
      });

      await saveFarmerFarm({
        name: `${formData.state} Farm`,
        state: formData.state,
        district: formData.district,
        village: formData.village,
        land_area: formData.area_ha,
        land_area_unit: 'hectares',
        soil_type: formData.soil_type,
      });

      try {
        await saveFarmRecord({
          user_email: user?.email || formData.user_email || 'farmer@agrifusion.com',
          record_type: 'farmer_profile',
          record_data: formData as any,
        });
      } catch {
        // ignore
      }

      onSaveProfile(formData);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save farm profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 pt-5 pb-4 bg-linear-to-r from-[#14532D] to-[#166534] text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Sprout className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h2 className="text-base font-bold">Farmer Profile & Account</h2>
                <p className="text-xs text-emerald-200">
                  Manage your farm coordinates, acreage, and credentials
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-4 pt-2 border-t border-white/10">
            {user?.isLoggedIn && (
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-white text-[#14532D] shadow-xs'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                Farm Profile (Editable)
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-white text-[#14532D] shadow-xs'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {user?.isLoggedIn ? 'Account Status' : 'Farmer Login'}
            </button>
            {!user?.isLoggedIn && (
              <button
                type="button"
                onClick={() => setActiveTab('signup')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'signup'
                    ? 'bg-white text-[#14532D] shadow-xs'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                Farmer Sign Up
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          {/* TAB 1: EDITABLE FARM PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-5">
              {/* Mandatory Notice */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300/80 text-amber-950 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <strong className="font-bold text-amber-950 block">Compulsory Fields Notice:</strong>
                  Only <span className="font-bold underline">State & District (Place)</span> and{' '}
                  <span className="font-bold underline">Land Area</span> are compulsory (*). All other fields (Farmer Name, Village, Crop, Soil) are optional and can be edited anytime.
                </div>
              </div>

              {validationError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">Farm profile saved and synchronized with backend database!</span>
                </div>
              )}

              {/* SECTION 1: PLACE & AREA (COMPULSORY) */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3.5">
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#14532D]" />
                    <span>Location & Land Area (Compulsory)</span>
                  </h4>
                  <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                    * Required
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      State <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={formData.state}
                      onChange={(e) => {
                        const newState = e.target.value;
                        const st = STATES_AND_DISTRICTS.find((s) => s.name === newState);
                        setFormData({
                          ...formData,
                          state: newState,
                          district: st ? st.districts[0] : '',
                        });
                      }}
                      required
                      className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500"
                    >
                      {STATES_AND_DISTRICTS.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      District <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      required
                      className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500"
                    >
                      {selectedStateObj.districts.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Area Input (Ha or Acres) */}
                <div className="pt-1">
                  <AreaInputField
                    label="Farm Land Area"
                    areaHa={formData.area_ha || 2}
                    onChange={(ha) => setFormData({ ...formData, area_ha: ha })}
                    required
                    helperText="Calculates irrigation volume, expected yield, subsidy limits, and costs."
                  />
                </div>
              </div>

              {/* SECTION 2: OPTIONAL FARMER & CROP DETAILS */}
              <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3.5">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4 text-stone-500" />
                    <span>Farmer & Field Details (Optional)</span>
                  </h4>
                  <span className="text-[11px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                    Optional
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Farmer Full Name <span className="text-stone-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.farmer_name || ''}
                      onChange={(e) => setFormData({ ...formData, farmer_name: e.target.value })}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Mobile Number <span className="text-stone-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.mobile || ''}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      placeholder="e.g. 9848012345"
                      className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Village / Mandal <span className="text-stone-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.village || ''}
                      onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                      placeholder="e.g. Anakapalle"
                      className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Primary Crop <span className="text-stone-400 font-normal">(Optional)</span>
                    </label>
                    <select
                      value={formData.crop || 'Rice'}
                      onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs focus:ring-1 focus:ring-emerald-500"
                    >
                      {COMMON_CROPS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Soil Type <span className="text-stone-400 font-normal">(Optional)</span>
                    </label>
                    <select
                      value={formData.soil_type || 'Loam Soil'}
                      onChange={(e) => setFormData({ ...formData, soil_type: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Loam Soil">Loam Soil</option>
                      <option value="Clay Loam">Clay Loam</option>
                      <option value="Black Cotton Soil">Black Cotton Soil (Regur)</option>
                      <option value="Red Sandy Loam">Red Sandy Loam</option>
                      <option value="Alluvial Soil">Alluvial Soil</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      Water / Irrigation Source{' '}
                      <span className="text-stone-400 font-normal">(Optional)</span>
                    </label>
                    <select
                      value={formData.irrigation_source || 'Borewell'}
                      onChange={(e) => setFormData({ ...formData, irrigation_source: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Borewell">Borewell (Motor Pump)</option>
                      <option value="Canal">Canal / River Water</option>
                      <option value="Open Well">Open Farm Well</option>
                      <option value="Rainfed">Rainfed / Tank Sump</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#14532D]/90 text-white font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{isSubmitting ? 'Saving...' : 'Save Farm Profile'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2 & 3: LOGIN / SIGNUP */}
          {(activeTab === 'login' || activeTab === 'signup') && (
            <div className="space-y-4">
              {user?.isLoggedIn ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#14532D] text-white flex items-center justify-center font-bold">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-900">
                        {user.name || 'Registered Farmer'}
                      </h4>
                      <p className="text-xs text-stone-600">
                        {user.mobile || user.email} • Authenticated Supabase Session
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed">
                    You are logged in via Supabase Auth. Your farm profile & regional farm records are synchronized with the backend.
                  </p>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveTab('profile')}
                      className="px-4 py-2 rounded-xl bg-[#14532D] text-white text-xs font-semibold hover:bg-[#14532D]/90 cursor-pointer"
                    >
                      Edit Farm Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onLogout();
                        setAuthMobile('');
                        setAuthName('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div className="text-center pb-2">
                    <h3 className="text-base font-bold text-stone-900">
                      {activeTab === 'signup' ? 'Create Farmer Account' : 'Farmer Sign-In'}
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {activeTab === 'signup'
                        ? 'Sign up with your mobile number or email to personalize advisories'
                        : 'Access your saved farm records, irrigation schedules & mandi forecasts'}
                    </p>
                  </div>

                  {authError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="font-medium">{authError}</span>
                    </div>
                  )}

                  <div className="space-y-3 text-xs">
                    {activeTab === 'signup' && (
                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">
                          Farmer Name <span className="text-stone-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          placeholder="e.g. Anji Reddy"
                          className="w-full p-2.5 rounded-xl border border-stone-300 bg-white focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block font-bold text-stone-800 mb-1">
                        Email or User ID <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          value={authMobile}
                          onChange={(e) => setAuthMobile(e.target.value)}
                          placeholder="Enter Email or User ID (e.g. farmer@gmail.com, 9876543210, or USR-101)"
                          required
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 bg-white font-medium focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-stone-800 mb-1">
                        Password <span className="text-rose-600">*</span>
                        {activeTab === 'signup' && (
                          <span className="text-stone-400 font-normal ml-1">(min. 6 characters)</span>
                        )}
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                        <input
                          type="password"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder={activeTab === 'signup' ? 'Password (min. 6 characters)' : 'Enter password'}
                          required
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* EMBEDDED FARM PROFILE SECTION - SIGNUP TAB ONLY */}
                    {activeTab === 'signup' && (
                      <div className="pt-3 border-t border-stone-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-[#14532D]" />
                            <span>Farm Profile Settings</span>
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-stone-800 mb-1">
                              State <span className="text-rose-600">*</span>
                            </label>
                            <select
                              value={formData.state}
                              onChange={(e) => {
                                const newState = e.target.value;
                                const st = STATES_AND_DISTRICTS.find((s) => s.name === newState);
                                setFormData({
                                  ...formData,
                                  state: newState,
                                  district: st ? st.districts[0] : '',
                                });
                              }}
                              required
                              className="w-full text-xs p-2 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500"
                            >
                              {STATES_AND_DISTRICTS.map((s) => (
                                <option key={s.name} value={s.name}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-stone-800 mb-1">
                              District <span className="text-rose-600">*</span>
                            </label>
                            <select
                              value={formData.district}
                              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                              required
                              className="w-full text-xs p-2 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500"
                            >
                              {selectedStateObj.districts.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <AreaInputField
                          label="Land Area"
                          areaHa={formData.area_ha || 2}
                          onChange={(ha) => setFormData({ ...formData, area_ha: ha })}
                          required
                          helperText="Calculates irrigation volume, yield, costs and subsidies."
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-stone-800 mb-1">
                              Primary Crop
                            </label>
                            <select
                              value={formData.crop || 'Rice'}
                              onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                              className="w-full text-xs p-2 rounded-xl border border-stone-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500"
                            >
                              {COMMON_CROPS.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-stone-700 mb-1">
                              Village / Mandal <span className="text-stone-400 font-normal">(Optional)</span>
                            </label>
                            <input
                              type="text"
                              value={formData.village || ''}
                              onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                              placeholder="e.g. Anakapalle"
                              className="w-full text-xs p-2 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-[#14532D] text-white font-bold text-xs hover:bg-[#14532D]/90 transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{activeTab === 'signup' ? 'Creating Account...' : 'Signing In...'}</span>
                      </>
                    ) : (
                      <span>
                        {activeTab === 'signup' ? 'Create Account & Set Farm Profile' : 'Sign In as Farmer'}
                      </span>
                    )}
                  </button>

                  <div className="pt-2 text-center border-t border-stone-100">
                    {activeTab === 'signup' ? (
                      <p className="text-xs text-stone-600">
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => setActiveTab('login')}
                          className="font-bold text-[#14532D] hover:underline cursor-pointer"
                        >
                          Sign In here
                        </button>
                      </p>
                    ) : (
                      <p className="text-xs text-stone-600">
                        Don't have an account?{' '}
                        <button
                          type="button"
                          onClick={() => setActiveTab('signup')}
                          className="font-bold text-[#14532D] hover:underline cursor-pointer"
                        >
                          Sign Up with Farm Profile
                        </button>
                      </p>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

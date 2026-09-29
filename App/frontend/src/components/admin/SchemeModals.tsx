import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  CheckCircle2,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  GovernmentScheme,
  RegisterSchemeRequest,
  SchemeCurrentStatus,
  SchemeVerificationStatus,
  UpdateSchemeRequest,
  VerifySchemeRequest,
} from '../../types';
import { registerScheme, updateScheme, verifyScheme } from '../../lib/adminApi';

interface RegisterSchemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (scheme: GovernmentScheme) => void;
}

const SCHEME_TYPES = [
  'Direct Income Support',
  'Crop Insurance',
  'Credit Support & Kisan Credit Card (KCC)',
  'Farm Mechanization & Implements (SMAM)',
  'Micro-Irrigation & Drip Subsidies',
  'Solar Pumps (PM-KUSUM)',
  'Soil Health & Nutrient Management',
  'Horticulture Mission (MIDH)',
  'Seed & Input Subsidy',
  'Organic / Natural Farming (PKVY / APCNF)',
  'Animal Husbandry & Dairy',
  'Other State / Central Welfare Scheme',
];

const COMMON_DEPARTMENTS = [
  'Department of Agriculture and Farmers Welfare (DA&FW), Govt. of India',
  'Department of Agriculture, Govt. of Andhra Pradesh',
  'Department of Agriculture, Govt. of Telangana',
  'Department of Horticulture, Govt. of Andhra Pradesh',
  'Department of Horticulture, Govt. of Telangana',
  'Ministry of New and Renewable Energy (MNRE)',
  'NABARD / Ministry of Finance',
];

export const RegisterSchemeModal: React.FC<RegisterSchemeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [schemeName, setSchemeName] = useState('');
  const [schemeType, setSchemeType] = useState('Direct Income Support');
  const [department, setDepartment] = useState('');
  const [officialPortal, setOfficialPortal] = useState('');
  const [stateAP, setStateAP] = useState(true);
  const [stateTS, setStateTS] = useState(true);
  const [benefitSummary, setBenefitSummary] = useState('');
  const [eligibilitySummary, setEligibilitySummary] = useState('');
  const [applicationRoute, setApplicationRoute] = useState('');
  const [deadline, setDeadline] = useState('');
  const [caveatsText, setCaveatsText] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = schemeName.trim();
    const trimmedDept = department.trim();
    const trimmedPortal = officialPortal.trim();

    if (!trimmedName) {
      setError('Scheme name is required.');
      return;
    }

    if (!trimmedDept) {
      setError('Department is required.');
      return;
    }

    if (!trimmedPortal) {
      setError('Official government portal URL is required.');
      return;
    }

    if (!trimmedPortal.startsWith('https://')) {
      setError('Official portal URL must be a secure HTTPS web address (starts with https://).');
      return;
    }

    try {
      new URL(trimmedPortal);
    } catch {
      setError('Please enter a syntactically valid portal URL.');
      return;
    }

    const stateRelevance: string[] = [];
    if (stateAP) stateRelevance.push('Andhra Pradesh');
    if (stateTS) stateRelevance.push('Telangana');

    const parsedCaveats = caveatsText
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean);

    const payload: RegisterSchemeRequest = {
      scheme_name: trimmedName,
      scheme_type: schemeType,
      department: trimmedDept,
      official_portal: trimmedPortal,
      state_relevance: stateRelevance.length > 0 ? stateRelevance : ['Andhra Pradesh', 'Telangana'],
      benefit_summary: benefitSummary.trim() || null,
      eligibility_summary: eligibilitySummary.trim() || null,
      application_route: applicationRoute.trim() || null,
      deadline: deadline.trim() || null,
      caveats: parsedCaveats.length > 0 ? parsedCaveats : null,
    };

    setLoading(true);
    try {
      const created = await registerScheme(payload);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register government scheme.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-scheme-title"
    >
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 id="register-scheme-title" className="text-sm font-bold text-stone-900">
                Register Government Scheme
              </h3>
              <p className="text-[11px] text-stone-500">
                Submits official state or central agricultural subsidy for verification in AgriFusion.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-[11px] text-stone-600 flex items-start gap-2">
            <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <div>
              <strong>Verification Standard:</strong> Newly registered schemes start with{' '}
              <span className="font-semibold">Pending Review</span> status and{' '}
              <span className="font-semibold">Requires Current Verification</span>. Only schemes officially verified via verified portals are cited to farmers.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Scheme Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={schemeName}
              onChange={(e) => setSchemeName(e.target.value)}
              placeholder="e.g. YSR Rythu Bharosa or PM-KISAN"
              required
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-purple-600 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Scheme Category <span className="text-rose-600">*</span>
              </label>
              <select
                value={schemeType}
                onChange={(e) => setSchemeType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:bg-white focus:border-purple-600 focus:outline-hidden"
              >
                {SCHEME_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Department / Ministry <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                list="dept-suggestions"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Department of Agriculture, Govt. of AP"
                required
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-purple-600 focus:outline-hidden"
              />
              <datalist id="dept-suggestions">
                {COMMON_DEPARTMENTS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Official Government Portal URL <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={officialPortal}
                onChange={(e) => setOfficialPortal(e.target.value)}
                placeholder="https://ysrrythubharosa.ap.gov.in"
                required
                className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-purple-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                State Jurisdiction
              </label>
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stateAP}
                    onChange={(e) => setStateAP(e.target.checked)}
                    className="rounded border-stone-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Andhra Pradesh</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stateTS}
                    onChange={(e) => setStateTS(e.target.checked)}
                    className="rounded border-stone-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Telangana</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Application Route (Optional)
              </label>
              <input
                type="text"
                value={applicationRoute}
                onChange={(e) => setApplicationRoute(e.target.value)}
                placeholder="e.g. Village RBK / MeeSeva Center"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-purple-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Verified Benefit Summary (Optional)
            </label>
            <textarea
              value={benefitSummary}
              onChange={(e) => setBenefitSummary(e.target.value)}
              rows={2}
              placeholder="e.g. ₹13,500 per year in three installments for land-owning farmers and tenant farmers."
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-purple-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Official Eligibility Criteria (Optional)
            </label>
            <textarea
              value={eligibilitySummary}
              onChange={(e) => setEligibilitySummary(e.target.value)}
              rows={2}
              placeholder="e.g. Resident farmers holding valid passbooks; tenant farmers with CCRC card."
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-purple-600 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Active Deadline / Window (Optional)
              </label>
              <input
                type="text"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="e.g. Kharif Enrollment: July 31 or Ongoing"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-purple-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Official Caveats (One per line)
              </label>
              <textarea
                value={caveatsText}
                onChange={(e) => setCaveatsText(e.target.value)}
                rows={2}
                placeholder="Institutional landholders excluded&#10;Income tax payees excluded"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-purple-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Register Scheme</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface VerifySchemeModalProps {
  isOpen: boolean;
  scheme: GovernmentScheme | null;
  onClose: () => void;
  onSuccess: (verified: GovernmentScheme) => void;
}

export const VerifySchemeModal: React.FC<VerifySchemeModalProps> = ({
  isOpen,
  scheme,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !scheme) return null;

  const [officialSourceUrl, setOfficialSourceUrl] = useState(scheme.official_portal || '');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [currentStatus, setCurrentStatus] = useState<SchemeCurrentStatus>('active');
  const [caveatsText, setCaveatsText] = useState(
    Array.isArray(scheme.caveats) ? scheme.caveats.join('\n') : ''
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUrl = officialSourceUrl.trim();
    const trimmedNotes = verificationNotes.trim();

    if (!trimmedUrl || trimmedUrl.length < 8) {
      setError('Official source URL is required (at least 8 characters).');
      return;
    }

    if (!trimmedUrl.startsWith('https://')) {
      setError('Official source URL must use HTTPS.');
      return;
    }

    if (!trimmedNotes || trimmedNotes.length < 2) {
      setError('Verification notes are required (at least 2 characters explaining the official check).');
      return;
    }

    const parsedCaveats = caveatsText
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean);

    const payload: VerifySchemeRequest = {
      official_source_url: trimmedUrl,
      verification_notes: trimmedNotes,
      current_status: currentStatus,
      caveats: parsedCaveats.length > 0 ? parsedCaveats : undefined,
    };

    setLoading(true);
    try {
      const updated = await verifyScheme(scheme.id, payload);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to verify scheme with backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-scheme-title"
    >
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 id="verify-scheme-title" className="text-sm font-bold text-stone-900">
                Officially Verify Government Scheme
              </h3>
              <p className="text-[11px] text-stone-500 truncate max-w-xs">{scheme.scheme_name || scheme.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-900">
            <strong>Backend Verification Protocol:</strong> Submitting this form calls <code className="bg-emerald-100/80 px-1 py-0.5 rounded">POST /api/v1/admin/schemes/{scheme.id}/verify</code>. The backend records your admin identity and current server timestamp automatically.
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Official Source URL <span className="text-rose-600">*</span>
            </label>
            <input
              type="url"
              value={officialSourceUrl}
              onChange={(e) => setOfficialSourceUrl(e.target.value)}
              placeholder="https://pmkisan.gov.in or https://ysrrythubharosa.ap.gov.in"
              required
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Verification Notes <span className="text-rose-600">*</span>
            </label>
            <textarea
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Cross-checked with AP GO Ms. No. 42 and official portal guidelines for 2024-25 season."
              required
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Current Operational Status
            </label>
            <select
              value={currentStatus}
              onChange={(e) => setCurrentStatus(e.target.value as SchemeCurrentStatus)}
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
            >
              <option value="active">Active (Disbursements & applications open)</option>
              <option value="requires_current_verification">Requires Current Verification</option>
              <option value="temporarily_unavailable">Temporarily Unavailable</option>
              <option value="expired_or_closed">Expired or Closed</option>
              <option value="not_available">Not Available</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Confirmed Caveats (One per line)
            </label>
            <textarea
              value={caveatsText}
              onChange={(e) => setCaveatsText(e.target.value)}
              rows={2}
              placeholder="Excludes commercial poultry / aquaculture&#10;Subject to annual biometric e-KYC"
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting Verification...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Confirm Verification</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface UpdateSchemeModalProps {
  isOpen: boolean;
  scheme: GovernmentScheme | null;
  onClose: () => void;
  onSuccess: (updated: GovernmentScheme) => void;
}

export const UpdateSchemeModal: React.FC<UpdateSchemeModalProps> = ({
  isOpen,
  scheme,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !scheme) return null;

  const [verificationStatus, setVerificationStatus] = useState<SchemeVerificationStatus>(
    scheme.verification_status || 'pending_review'
  );
  const [currentStatus, setCurrentStatus] = useState<SchemeCurrentStatus>(
    scheme.current_status || 'requires_current_verification'
  );
  const [notes, setNotes] = useState('');
  const [caveatsText, setCaveatsText] = useState(
    Array.isArray(scheme.caveats) ? scheme.caveats.join('\n') : ''
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const parsedCaveats = caveatsText
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean);

    const payload: UpdateSchemeRequest = {
      verification_status: verificationStatus,
      current_status: currentStatus,
      verification_notes: notes.trim() || null,
      caveats: parsedCaveats.length > 0 ? parsedCaveats : null,
      is_active: currentStatus === 'active',
      needs_review: verificationStatus === 'needs_review',
    };

    try {
      const updated = await updateScheme(scheme.id, payload);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update scheme status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-scheme-title"
    >
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 id="update-scheme-title" className="text-sm font-bold text-stone-900">
                Update Scheme Status
              </h3>
              <p className="text-[11px] text-stone-500 truncate max-w-xs">{scheme.scheme_name || scheme.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Verification Status
            </label>
            <select
              value={verificationStatus}
              onChange={(e) => setVerificationStatus(e.target.value as SchemeVerificationStatus)}
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:bg-white focus:border-purple-600 focus:outline-hidden"
            >
              <option value="pending_review">Pending Review</option>
              <option value="verified">Verified (Official Source Checked)</option>
              <option value="verified_with_caveats">Verified with Caveats</option>
              <option value="needs_review">Needs Review</option>
              <option value="stale">Stale (Needs Season Refresh)</option>
              <option value="unavailable">Unavailable</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Current Operational Status
            </label>
            <select
              value={currentStatus}
              onChange={(e) => setCurrentStatus(e.target.value as SchemeCurrentStatus)}
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:bg-white focus:border-purple-600 focus:outline-hidden"
            >
              <option value="active">Active</option>
              <option value="requires_current_verification">Requires Current Verification</option>
              <option value="temporarily_unavailable">Temporarily Unavailable</option>
              <option value="expired_or_closed">Expired or Closed</option>
              <option value="not_available">Not Available</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Subsidy paused for audit; scheduled to resume next month."
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-purple-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Caveats (One per line)
            </label>
            <textarea
              value={caveatsText}
              onChange={(e) => setCaveatsText(e.target.value)}
              rows={2}
              placeholder="Aadhaar linking mandatory&#10;Applicable only to dryland plots"
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-purple-600 focus:outline-hidden"
            />
          </div>

          <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

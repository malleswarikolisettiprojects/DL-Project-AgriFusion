import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  Globe,
  Info,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import type {
  KnowledgeSource,
  RegisterSourceRequest,
  SourceIndexStatus,
  SourceVerificationStatus,
  UpdateSourceMetadataRequest,
} from '../../types';
import { registerSource, updateSource } from '../../lib/adminApi';

interface RegisterSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (source: KnowledgeSource) => void;
}

const COMMON_ORGS = [
  'ANGRAU (Acharya N.G. Ranga Agricultural University)',
  'PJTSAU (Professor Jayashankar Telangana State Agricultural University)',
  'ICAR-CRIDA (Central Research Institute for Dryland Agriculture)',
  'ICAR-IIRR (Indian Institute of Rice Research)',
  'ICAR-IIOR (Indian Institute of Oilseeds Research)',
  'ICAR-CTRI (Central Tobacco Research Institute)',
  'Dr. YSR Horticultural University (Dr. YSRHU)',
  'SKLTS Horticultural University',
  'Krishi Vigyan Kendra (KVK)',
  'Department of Agriculture, Govt. of Andhra Pradesh',
  'Department of Agriculture, Govt. of Telangana',
  'Directorate of Plant Protection, Quarantine & Storage (PPQS)',
  'Central Insecticides Board & Registration Committee (CIBRC)',
];

const SOURCE_TYPES = [
  { value: 'agricultural_university', label: 'Agricultural University (ANGRAU, PJTSAU)' },
  { value: 'icar_institute', label: 'ICAR Institute (CRIDA, IIRR, IIOR)' },
  { value: 'kvk', label: 'Krishi Vigyan Kendra (KVK)' },
  { value: 'state_agriculture_department', label: 'State Agriculture Department (AP / TS)' },
  { value: 'state_horticulture_department', label: 'State Horticulture Department' },
  { value: 'government_department', label: 'Central Ministry / Department (DA&FW)' },
  { value: 'ppqs', label: 'Plant Protection & Quarantine (PPQS)' },
  { value: 'cibrc', label: 'CIBRC (Insecticide / Label Claims)' },
  { value: 'official_scheme_portal', label: 'Official Scheme Portal' },
  { value: 'other_authoritative', label: 'Other Authoritative Research Source' },
];

export const RegisterSourceModal: React.FC<RegisterSourceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [officialUrl, setOfficialUrl] = useState('');
  const [organization, setOrganization] = useState('');
  const [sourceType, setSourceType] = useState('agricultural_university');
  const [subject, setSubject] = useState('');
  const [crop, setCrop] = useState('');
  const [stateAP, setStateAP] = useState(true);
  const [stateTS, setStateTS] = useState(true);
  const [language, setLanguage] = useState('English');
  const [verificationNotes, setVerificationNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const trimmedTitle = title.trim();
    const trimmedUrl = officialUrl.trim();
    const trimmedOrg = organization.trim();

    if (!trimmedTitle) {
      setError('Source title is required.');
      return;
    }

    if (!trimmedUrl) {
      setError('Official URL is required.');
      return;
    }

    if (!trimmedUrl.startsWith('https://')) {
      setError('Official URL must be a secure HTTPS web address (starts with https://).');
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setError('Please enter a syntactically valid URL.');
      return;
    }

    if (!trimmedOrg) {
      setError('Organization is required.');
      return;
    }

    const stateRelevance: string[] = [];
    if (stateAP) stateRelevance.push('Andhra Pradesh');
    if (stateTS) stateRelevance.push('Telangana');

    const payload: RegisterSourceRequest = {
      title: trimmedTitle,
      official_url: trimmedUrl,
      organization: trimmedOrg,
      source_type: sourceType,
      subject: subject.trim() || null,
      crop: crop.trim() || null,
      state_relevance: stateRelevance.length > 0 ? stateRelevance : ['Andhra Pradesh', 'Telangana'],
      language: language.trim() || 'English',
      verification_notes: verificationNotes.trim() || null,
      verification_status: 'pending_review',
      index_status: 'queued',
    };

    setLoading(true);
    try {
      const created = await registerSource(payload);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register knowledge source.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-source-title"
    >
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 id="register-source-title" className="text-sm font-bold text-stone-900">
                Register Authoritative Knowledge Source
              </h3>
              <p className="text-[11px] text-stone-500">
                Submits canonical research documentation to the FastAPI backend for RAG indexing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
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

          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Strict Provenance Rule:</strong> Newly registered sources will be set to{' '}
              <span className="font-semibold underline">Pending Review</span> by the backend. Vector
              embeddings and RAG inclusion are queued asynchronously.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Source Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. ANGRAU Package of Practices for Kharif Rice 2024-25"
              required
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Official HTTPS URL <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={officialUrl}
                onChange={(e) => setOfficialUrl(e.target.value)}
                placeholder="https://angrau.ac.in/agronomy/rice_practices.pdf"
                required
                className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
              />
            </div>
            <p className="text-[10px] text-stone-400 mt-1">
              Must start with https:// pointing to an authentic portal or document.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Organization / University <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                list="org-suggestions"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. ANGRAU or PJTSAU"
                required
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
              />
              <datalist id="org-suggestions">
                {COMMON_ORGS.map((org) => (
                  <option key={org} value={org} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Source Type <span className="text-rose-600">*</span>
              </label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Crop Focus (Optional)
              </label>
              <input
                type="text"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                placeholder="e.g. Rice, Cotton, Chilli, Groundnut"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Subject Area (Optional)
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Pest Management, Nutrient Schedule"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
              >
                <option value="English">English</option>
                <option value="Telugu">Telugu</option>
                <option value="Bilingual (Telugu/English)">Bilingual (Telugu/English)</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                State Relevance
              </label>
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stateAP}
                    onChange={(e) => setStateAP(e.target.checked)}
                    className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Andhra Pradesh</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stateTS}
                    onChange={(e) => setStateTS(e.target.checked)}
                    className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Telangana</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Verification Notes / Scientific Context (Optional)
            </label>
            <textarea
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Official 2024 revised recommendations. Includes pesticide label caveats for blast resistance."
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
            />
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
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#14532D] hover:bg-[#16A34A] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Register Source</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-doc-title"
    >
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <h3 id="upload-doc-title" className="text-sm font-bold text-stone-900">
              Upload Agricultural Document
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Missing endpoint banner as strictly instructed in the prompt */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Document upload is not available yet.</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            The backend endpoint (<code className="bg-amber-100/80 px-1 py-0.5 rounded text-[11px]">POST /api/v1/admin/sources/upload-document</code>) is not implemented in the current API service. Direct file uploads (<code className="text-[11px]">.pdf, .docx, .txt, .md</code>) are temporarily disabled.
          </p>
        </div>

        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-600 space-y-1">
          <div className="font-semibold text-stone-800">Available Alternative:</div>
          <p className="text-[11px] leading-relaxed">
            Admins can register canonical web URLs directly from university and ICAR portals using the <span className="font-semibold text-emerald-800">"Register Source"</span> action.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface UpdateSourceStatusModalProps {
  isOpen: boolean;
  source: KnowledgeSource | null;
  onClose: () => void;
  onSuccess: (updated: KnowledgeSource) => void;
}

export const UpdateSourceStatusModal: React.FC<UpdateSourceStatusModalProps> = ({
  isOpen,
  source,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !source) return null;

  const [status, setStatus] = useState<SourceVerificationStatus>(
    source.verification_status || 'pending_review'
  );
  const [notes, setNotes] = useState(source.verification_notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: UpdateSourceMetadataRequest = {
      verification_status: status,
      verification_notes: notes.trim() || null,
      is_active: status !== 'unavailable' && status !== 'rejected',
      needs_review: status === 'needs_review',
    };

    try {
      const updated = await updateSource(source.id, payload);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update verification status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-source-status-title"
    >
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 id="update-source-status-title" className="text-sm font-bold text-stone-900">
                Update Verification Status
              </h3>
              <p className="text-[11px] text-stone-500 truncate max-w-xs">{source.title}</p>
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
              value={status}
              onChange={(e) => setStatus(e.target.value as SourceVerificationStatus)}
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
            >
              <option value="pending_review">Pending Review</option>
              <option value="verified">Verified (Authoritative)</option>
              <option value="verified_with_caveats">Verified with Caveats</option>
              <option value="needs_review">Needs Review</option>
              <option value="stale">Stale (Needs Season Update)</option>
              <option value="unavailable">Unavailable (Offline/Broken Link)</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Verification Notes & Agronomic Caveats
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Valid for AP coastal districts. Verified against official ICAR handbook 2024."
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
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Status</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

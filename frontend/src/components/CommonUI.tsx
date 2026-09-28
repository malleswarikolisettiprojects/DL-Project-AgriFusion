import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

export function RiskBadge({ level }: { level?: string | null }) {
  if (!level) return null;
  const l = level.toLowerCase();

  if (l.includes('low')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
        Low Risk
      </span>
    );
  }
  if (l.includes('mod') || l.includes('medium') || l.includes('amber')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
        Moderate Risk
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-900 border border-rose-300">
      <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
      High Risk
    </span>
  );
}

export function ConfidenceBadge({
  confidence,
  label = 'Model estimate',
}: {
  confidence?: number | string | null;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#14532D]/10 text-[#14532D] border border-[#14532D]/20">
      <Info className="w-3 h-3" />
      {label}
      {confidence !== undefined && confidence !== null ? `: ${confidence}` : ''}
    </span>
  );
}

export function DataFreshnessLabel({ timestamp }: { timestamp?: string | null }) {
  if (!timestamp) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-stone-500">
        <Clock className="w-3 h-3" />
        Update time not provided by the API.
      </span>
    );
  }

  let formatted = timestamp;
  try {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      formatted = d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    // fallback to raw
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
      <Clock className="w-3 h-3 text-stone-500" />
      Updated: {formatted}
    </span>
  );
}

export type AdvisoryModuleType =
  | 'dashboard'
  | 'crop'
  | 'climate'
  | 'irrigation'
  | 'yield'
  | 'market'
  | 'disease'
  | 'advisor'
  | 'schemes'
  | 'pipeline'
  | 'history';

const MODULE_STATUTORY_NOTICES: Record<
  AdvisoryModuleType,
  { title: string; text: string }
> = {
  dashboard: {
    title: 'Farm Management & Soil Health Notice:',
    text: 'General farm management advisories are predictive estimates. Check your official Soil Health Card (SHC) and consult your local Rythu Bharosa Kendra (RBK) or Mandal Agricultural Officer (MAO) before purchasing seasonal seeds or bulk fertilizers.',
  },
  crop: {
    title: 'Crop Suitability & Sowing Notice:',
    text: 'Crop suitability calculations rely on agro-climatic norms. Actual germination, crop stand, and harvest yield depend on seed lot certification (AP Seeds / TSSDC), localized sowing window onset, and farm-specific soil testing.',
  },
  climate: {
    title: 'Agrometeorological & Climate Risk Notice:',
    text: 'Weather trends and extreme heat/rain projections are downscaled estimates based on gridded IMD and meteorological models. Localized squalls, sudden cyclonic depressions, and micro-climate pockets can vary. Always monitor real-time IMD Mausam / Meghdoot bulletins.',
  },
  irrigation: {
    title: 'Irrigation & Water Allocation Notice:',
    text: 'Water demand calculations (depth in mm and motor run-hours) are engineering estimates based on FAO-56 Penman-Monteith guidelines. Calibrate run-times based on your actual pump delivery pressure, soil moisture tensiometer readings, and local groundwater availability.',
  },
  yield: {
    title: 'Yield Estimation & Harvest Notice:',
    text: 'Harvest estimates are statistical projections derived from historical district CACP and agricultural census figures. Actual yield is subject to localized pest attacks, fertilizer timing, and late-season weather. Not an appraisal for insurance settlement.',
  },
  market: {
    title: 'APMC Mandi Price & Revenue Notice:',
    text: 'Projected mandi rates are historical statistical trends, NOT statutory Minimum Support Price (MSP) purchase guarantees. Final auction rates at APMC yards depend on daily arrivals, moisture percentage, grain color/grade, and local trader demand.',
  },
  disease: {
    title: 'Plant Pathology & Chemical Spray Notice:',
    text: 'Computer vision leaf diagnosis is a rapid screening tool, not a certified lab pathology test. Verify all chemical fungicides and insecticides against registered Central Insecticides Board (CIB&RC) labels, adhere strictly to Pre-Harvest Intervals (PHI), and use proper personal protective equipment (PPE).',
  },
  advisor: {
    title: 'Agronomic Advisory & Extension Notice:',
    text: 'AI agronomic answers synthesize ICAR, ANGRAU, and PJTSAU package of practices. Before tank-mixing or spraying chemical pesticides, confirm dosage compatibility and certified waiting periods with your local KVK or Agriculture Officer.',
  },
  schemes: {
    title: 'Government Welfare & Subsidy Notice:',
    text: 'Subsidy and welfare listings indicate eligibility criteria matching. Final approval, benefit allocation, and DBT payments depend strictly on state portal guidelines (Rythu Bharosa / PM-KISAN), Aadhaar biometric eKYC, and land record verification by revenue authorities.',
  },
  pipeline: {
    title: 'Consolidated Seasonal Plan Notice:',
    text: 'This 6-stage agricultural plan connects crop selection, weather risk, irrigation scheduling, economics, and welfare schemes. Cross-verify stage recommendations with field observations and extension officers before allocating capital.',
  },
  history: {
    title: 'Farm Record Keeping Notice:',
    text: 'Activity and diagnostic logs are stored locally for farm management tracking. Keep physical copies of certified seed purchase vouchers and registered pesticide application dates for official farm audits and crop insurance claims.',
  },
};

export function StatutoryAdvisoryTopBanner({
  module = 'dashboard',
  customNote,
  customTitle,
}: {
  module?: AdvisoryModuleType;
  customNote?: string;
  customTitle?: string;
}) {
  const config = MODULE_STATUTORY_NOTICES[module] || MODULE_STATUTORY_NOTICES.dashboard;
  const title = customTitle || config.title;
  const note = customNote || config.text;

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/95 border border-amber-300 text-amber-950 flex items-start gap-3 shadow-xs">
      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="text-xs sm:text-sm leading-relaxed">
        <strong className="font-bold text-amber-950 block sm:inline mr-1.5">
          {title}
        </strong>
        <span className="text-amber-900 font-medium">{note}</span>
      </div>
    </div>
  );
}

export function DisclaimerBanner({
  type = 'advisory',
  text,
}: {
  type?: 'advisory' | 'warning' | 'official';
  text?: string;
}) {
  const defaultText =
    type === 'warning'
      ? 'This is an AI-assisted visual assessment, not a confirmed diagnosis. Verify symptoms with a qualified agriculture professional.'
      : type === 'official'
      ? 'Possible match — official verification required. Scheme rules, deadlines, and benefits may change.'
      : 'AI Model prediction for advisory guidance. Verify with local agricultural extension officer (AEO) or KVK.';

  const isWarning = type === 'warning';
  const isOfficial = type === 'official';

  return (
    <div
      className={`flex items-start gap-2.5 p-3 rounded-xl text-xs md:text-sm border break-words ${
        isWarning
          ? 'bg-rose-50 border-rose-200 text-rose-900'
          : isOfficial
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
      }`}
    >
      <Info
        className={`w-4 h-4 mt-0.5 shrink-0 ${
          isWarning ? 'text-rose-600' : isOfficial ? 'text-amber-600' : 'text-emerald-700'
        }`}
      />
      <div className="leading-relaxed min-w-0">
        <p className="font-medium break-words">{text || defaultText}</p>
      </div>
    </div>
  );
}

export function MetricCard({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  badge,
  variant = 'default',
}: {
  title: string;
  value: React.ReactNode;
  unit?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  variant?: 'default' | 'green' | 'blue' | 'amber';
}) {
  const bg =
    variant === 'green'
      ? 'bg-emerald-50/50 border-emerald-200'
      : variant === 'blue'
      ? 'bg-sky-50/50 border-sky-200'
      : variant === 'amber'
      ? 'bg-amber-50/50 border-amber-200'
      : 'bg-white border-stone-200';

  return (
    <div className={`p-4 rounded-xl border shadow-sm ${bg}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold tracking-wide text-stone-600 uppercase">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {badge}
          {Icon && <Icon className="w-4 h-4 text-stone-500" />}
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight text-stone-900">{value}</span>
        {unit && <span className="text-sm font-medium text-stone-500">{unit}</span>}
      </div>
      {subtitle && <p className="text-xs text-stone-600 mt-1 leading-snug">{subtitle}</p>}
    </div>
  );
}

export function LoadingState({
  message = 'Request in progress...',
  onCancel,
  showColdStartHint = true,
}: {
  message?: string;
  onCancel?: () => void;
  showColdStartHint?: boolean;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="p-8 rounded-2xl bg-white border border-stone-200 shadow-sm text-center flex flex-col items-center justify-center">
      <div className="relative mb-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#14532D]/20 border-t-[#14532D] animate-spin" />
      </div>

      <h4 className="text-base font-semibold text-stone-900 mb-1">{message}</h4>
      <p className="text-xs text-stone-500 mb-4">
        Elapsed time: <span className="font-mono font-medium">{seconds}s</span>
      </p>

      {showColdStartHint && seconds > 8 && (
        <div className="max-w-md p-3 rounded-lg bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-xs text-left mb-4 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5 text-emerald-900">Please Be Patient</p>
            <p className="text-emerald-800 leading-relaxed">
              Agricultural calculations and district statistical models might take a short moment to process. Please keep this screen open while we prepare your farm results.
            </p>
          </div>
        </div>
      )}

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
        >
          Cancel Request
        </button>
      )}
    </div>
  );
}

export function ErrorState({
  error,
  endpoint,
  status,
  onRetry,
}: {
  error: string;
  endpoint?: string;
  status?: number | null;
  onRetry?: () => void;
}) {
  const isTimeout =
    error.toLowerCase().includes('too long') ||
    error.toLowerCase().includes('aborted') ||
    error.toLowerCase().includes('timeout');

  return (
    <div className="p-6 rounded-2xl bg-rose-50/90 border border-rose-200 text-rose-950 shadow-sm">
      <div className="flex items-start gap-3">
        <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-semibold text-sm text-rose-900">
              {isTimeout ? 'Service Response Timeout' : 'Analysis Failed'}
            </h4>
            {endpoint && (
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-rose-200/60 text-rose-800">
                {endpoint}
              </span>
            )}
          </div>

          <p className="text-xs md:text-sm text-rose-800 leading-relaxed">{error}</p>

          {isTimeout && (
            <p className="text-xs text-rose-700 bg-white/70 p-2.5 rounded-lg border border-rose-200">
              The agriculture service took too long to respond. The Render service may be waking up or loading a model. Please try again.
            </p>
          )}

          <div className="pt-2 flex items-center gap-3">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#14532D] text-white hover:bg-[#14532D]/90 transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Request
              </button>
            )}
            {status && (
              <span className="text-xs text-rose-700">HTTP Status: {status}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title = 'No Data Available',
  description = 'Information not available from the current source.',
  actionLabel,
  onAction,
  icon: Icon = Info,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="p-8 rounded-2xl border border-stone-200 bg-white/60 text-center flex flex-col items-center justify-center">
      <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-stone-800 mb-1">{title}</h4>
      <p className="text-xs text-stone-500 max-w-sm mb-4 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#14532D] text-white hover:bg-[#14532D]/90 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function SourceCard({
  title,
  url,
  snippet,
  date,
}: {
  title?: string;
  url?: string;
  snippet?: string;
  date?: string;
}) {
  const displayUrl = url || 'https://icar.org.in';
  let domain = 'icar.org.in';
  try {
    domain = new URL(displayUrl).hostname.replace('www.', '');
  } catch {
    domain = 'agricoop.gov.in';
  }

  return (
    <div className="p-3.5 rounded-xl border border-stone-200 bg-white hover:border-emerald-300 hover:shadow-xs transition-all">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#14532D] border border-emerald-200 mb-1 font-mono">
            {domain}
          </span>
          <h5 className="text-xs font-bold text-stone-900 leading-snug">
            {title || 'Official Agricultural Extension Portal'}
          </h5>
        </div>
        <a
          href={displayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-[#14532D] hover:bg-emerald-100 hover:underline shrink-0 transition-colors"
        >
          <span>Open Site</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      {snippet && <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">{snippet}</p>}
      {date && <p className="text-[11px] text-stone-400 mt-1">Verified: {date}</p>}
    </div>
  );
}

const DEFAULT_AGRI_SOURCES = [
  {
    title: 'ICAR - Indian Council of Agricultural Research',
    url: 'https://icar.org.in',
    snippet: 'National repository for crop management guidelines, agronomic research, and certified field package of practices.',
    date: 'Current Season Advisory',
  },
  {
    title: 'TNAU Agritech Portal (Plant Protection & Agronomy)',
    url: 'https://agritech.tnau.ac.in',
    snippet: 'Detailed crop production guidelines, integrated pest management (IPM), and organic agricultural practices.',
    date: 'Verified ICAR Standard',
  },
  {
    title: 'CIB&RC - Central Insecticides Board & Registration Committee',
    url: 'https://cibrc.nic.in',
    snippet: 'Statutory government database for approved pesticide formulations, waiting periods, and safety limits in India.',
    date: 'Official Gazette',
  },
  {
    title: 'Agmarknet - Agricultural Marketing Information Network',
    url: 'https://agmarknet.gov.in',
    snippet: 'Directorate of Marketing & Inspection (DMI), Ministry of Agriculture portal for daily APMC mandi arrivals & prices.',
    date: 'Live Agmarknet Data',
  },
];

export function SourceList({
  sources,
  title = 'Verified Agricultural Sources & Portals',
}: {
  sources?: Array<{ title?: string; url?: string; snippet?: string; date?: string }>;
  title?: string;
}) {
  const displaySources = sources && sources.length > 0 ? sources : DEFAULT_AGRI_SOURCES;

  return (
    <div className="space-y-2.5 mt-3 pt-3 border-t border-stone-100">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
          {title}
        </span>
        <span className="text-[11px] text-stone-500">Government & Institutional References</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {displaySources.map((s, idx) => (
          <SourceCard key={idx} {...s} />
        ))}
      </div>
    </div>
  );
}

export function RawResponseViewer({ data }: { data: unknown }) {
  if (!data) return null;

  return (
    <details className="mt-4 text-xs rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
      <summary className="px-3.5 py-2.5 font-mono text-stone-600 hover:text-stone-900 cursor-pointer font-medium bg-stone-100/70 select-none">
        Raw API response (Developer inspection)
      </summary>
      <div className="p-3 bg-stone-900 text-stone-100 overflow-x-auto max-h-72">
        <pre className="font-mono text-[11px] leading-snug">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </details>
  );
}

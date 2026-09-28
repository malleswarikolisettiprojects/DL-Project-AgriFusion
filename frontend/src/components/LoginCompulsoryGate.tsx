import React from 'react';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  CloudSun,
  Coins,
  Compass,
  Droplets,
  FileCheck,
  History,
  LogIn,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  Sprout,
  Stethoscope,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import type { ActivePage } from '../types';

interface LoginCompulsoryGateProps {
  activePage: ActivePage;
  onOpenAuthModal: (mode?: 'login' | 'signup') => void;
  onNavigateToLanding: () => void;
}

interface ModuleDetails {
  title: string;
  badge: string;
  icon: React.ElementType;
  description: string;
  capabilities: string[];
}

const MODULE_DATA: Record<ActivePage, ModuleDetails> = {
  landing: {
    title: 'Platform Overview',
    badge: 'Overview',
    icon: Sprout,
    description: 'Explore the full agricultural intelligence architecture for Andhra Pradesh and Telangana.',
    capabilities: [
      'Comprehensive summary of all 10 farm intelligence modules',
      'Direct links to agricultural advisories and official resources',
      'Safety and statutory compliance standards',
      'Clean, farmer-friendly interface with simple guides',
    ],
  },
  dashboard: {
    title: 'Farmer Dashboard',
    badge: 'Farm Management Hub',
    icon: Sprout,
    description: 'Provides a consolidated operational overview of active weather alerts, crop development stages, and high-priority field actions.',
    capabilities: [
      'Tracks crop growth progress from vegetative stage to harvest readiness',
      'Monitors real-time rainfall, temperature anomalies, and IMD weather warnings',
      'Recommends immediate field actions for irrigation and nutrient applications',
      'Aggregates soil moisture trends and field telemetry in one place',
    ],
  },
  'crop-recommendation': {
    title: 'Crop Suitability Advisory',
    badge: 'Agronomic Recommendation',
    icon: Compass,
    description: 'Analyzes soil health parameters, seasonal rainfall, and sowing windows to recommend optimal crops for maximum yield.',
    capabilities: [
      'Evaluates Nitrogen (N), Phosphorus (P), Potassium (K), and soil pH suitability',
      'Ranks top-performing crops for Kharif, Rabi, and Summer seasons',
      'Compares water requirements and estimated input costs across candidate crops',
      'Provides sowing date windows and certified seed variety recommendations',
    ],
  },
  'climate-risk': {
    title: 'Climate & Weather Risk',
    badge: 'Micro-Climate Intelligence',
    icon: CloudSun,
    description: 'Forecasts heatwaves, dry spells, heavy rainfall, and Bay of Bengal cyclone depressions for your farm location.',
    capabilities: [
      'Generates 7-day temperature, precipitation, and relative humidity trends',
      'Detects prolonged dry spells and alerts when moisture stress is imminent',
      'Delivers preventive agronomic recommendations for crop protection',
      'Monitors wind speeds and cyclone trajectory alerts in coastal districts',
    ],
  },
  irrigation: {
    title: 'Smart Irrigation Planning',
    badge: 'ET0 Water Budgeting',
    icon: Droplets,
    description: 'Calculates exact crop evapotranspiration (ET0) and motor run-time hours to prevent over-irrigation and conserve groundwater.',
    capabilities: [
      'Computes net water requirement in millimeters and cubic meters for your land',
      'Calculates pump run-time hours based on motor horsepower (HP) and discharge',
      'Supports Drip, Sprinkler, Furrow, and Basin irrigation methods',
      'Generates a multi-day irrigation schedule with soil moisture threshold alerts',
    ],
  },
  yield: {
    title: 'Yield Forecasting',
    badge: 'Production Estimation',
    icon: TrendingUp,
    description: 'Projects crop harvest output in quintals per hectare and expected gross revenue using CACP and state agricultural benchmarks.',
    capabilities: [
      'Estimates total harvest yield in quintals based on field acreage',
      'Projects expected harvest date and harvest maturity window',
      'Calculates baseline gross revenue using regional productivity benchmarks',
      'Identifies primary yield limiting factors and mitigation strategies',
    ],
  },
  market: {
    title: 'Market Price Forecast',
    badge: 'APMC Mandi Intelligence',
    icon: Coins,
    description: 'Tracks modal market prices across nearby APMC mandis, compares with official MSP, and identifies favorable selling windows.',
    capabilities: [
      'Fetches modal, minimum, and maximum prices per quintal from Agmarknet',
      'Compares market rates against central Minimum Support Prices (MSP)',
      'Analyzes historical price trends and monthly arrival volumes',
      'Highlights optimal selling opportunities and nearby APMC trading centers',
    ],
  },
  'cost-profit': {
    title: 'Cost & Profit Estimator',
    badge: 'Farm Economics Suite',
    icon: Coins,
    description: 'Calculates comprehensive input expenditures, projected harvest revenues, net farm profits, and break-even thresholds for your landholding.',
    capabilities: [
      'Calculates total C2 Cost of Cultivation per acre and per hectare',
      'Breaks down expenses for seeds, fertilizers, labor, machinery, and irrigation',
      'Estimates net farm profit, Return on Investment (ROI), and Benefit-Cost Ratio (BCR)',
      'Computes break-even yield and break-even mandi selling prices with sensitivity scenarios',
    ],
  },
  'disease-detection': {
    title: 'Crop Health & Disease Check',
    badge: 'Pest & Pathogen Diagnostics',
    icon: Stethoscope,
    description: 'Analyzes photos of affected leaves to identify fungal, bacterial, and pest attacks with certified treatment protocols.',
    capabilities: [
      'Identifies plant pathogens from uploaded leaf photographs',
      'Provides confidence scores and symptom breakdowns for detected diseases',
      'Prescribes CIB&RC approved chemical treatments with exact dosage per liter',
      'Recommends organic and biological control measures with protective safety guidance',
    ],
  },
  advisor: {
    title: 'CropWise Agronomy Advisor',
    badge: 'AI Field Consultant',
    icon: MessageSquareQuote,
    description: 'Answers your agricultural questions in plain language, providing university-verified agronomic recommendations.',
    capabilities: [
      'Answers queries on crop protection, pest management, and fertilizer schedules',
      'Provides complete, easy-to-understand field guidance',
      'Includes statutory safety warnings and application timing precautions',
      'Suggests relevant follow-up questions tailored to your regional soil and crop',
    ],
  },
  schemes: {
    title: 'Government Subsidies & Schemes',
    badge: 'Welfare & Subsidy Matching',
    icon: FileCheck,
    description: 'Matches your farm profile with central and state government agricultural subsidy programs and welfare schemes.',
    capabilities: [
      'Identifies eligibility for PM-KISAN, Rythu Bharosa, and PM-KUSUM solar pumps',
      'Details micro-irrigation subsidies (up to 90% for small & marginal farmers)',
      'Provides direct application links to official state and central portals',
      'Outlines required documentation and verification guidelines',
    ],
  },
  pipeline: {
    title: 'Unified 6-Stage Farm Pipeline',
    badge: 'End-to-End Analysis',
    icon: Activity,
    description: 'Executes a complete, sequential farm decision pipeline connecting crop suitability, weather risk, irrigation, yield, market prices, and subsidies in one run.',
    capabilities: [
      'Executes all six decision-support modules in an automated sequence',
      'Generates an integrated seasonal master plan for your land',
      'Allows one-click review of complete agronomic and financial projections',
      'Provides actionable next steps from pre-sowing to harvest and sale',
    ],
  },
  'farm-history': {
    title: 'Activity & History Vault',
    badge: 'Historical Records',
    icon: History,
    description: 'Securely stores and organizes your past soil analyses, irrigation run-time logs, disease diagnoses, and market projections.',
    capabilities: [
      'Logs every farm advisory report with date and time stamps',
      'Allows filtering by module, crop, and search keywords',
      'Enables side-by-side comparison of seasonal performance',
      'Exports past reports for record-keeping and KVK consultation',
    ],
  },
  history: {
    title: 'Activity & History Vault',
    badge: 'Historical Records',
    icon: History,
    description: 'Securely stores and organizes your past soil analyses, irrigation run-time logs, disease diagnoses, and market projections.',
    capabilities: [
      'Logs every farm advisory report with date and time stamps',
      'Allows filtering by module, crop, and search keywords',
      'Enables side-by-side comparison of seasonal performance',
      'Exports past reports for record-keeping and KVK consultation',
    ],
  },
  diagnostics: {
    title: 'System Status & Diagnostics',
    badge: 'System Health',
    icon: Activity,
    description: 'Monitors real-time API latency, service connectivity, and platform diagnostic telemetry.',
    capabilities: [
      'Verifies backend API endpoint connectivity and response times',
      'Checks dataset freshness and model inference pipelines',
      'Inspects client-side state synchronization',
      'Displays telemetry and system uptime metrics',
    ],
  },
  admin: {
    title: 'Administrator Security Portal',
    badge: 'Admin & RBAC',
    icon: ShieldCheck,
    description: 'Restricted administrative gateway for verifying sources, inspecting system telemetry, and auditing platform mutations.',
    capabilities: [
      'Monitors API latency across all 10 agricultural ML prediction engines',
      'Enforces backend-verified Role-Based Access Control (RBAC)',
      'Manages verified ANGRAU, PJTSAU, and ICAR canonical agronomic knowledge sources',
      'Audits farmer advisory feedback and maintains immutable administrative logs',
    ],
  },
};

export function LoginCompulsoryGate({
  activePage,
  onOpenAuthModal,
  onNavigateToLanding,
}: LoginCompulsoryGateProps) {
  const currentModule = MODULE_DATA[activePage] || MODULE_DATA.dashboard;
  const IconComponent = currentModule.icon;

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {/* Top Breadcrumb / Return */}
      <button
        type="button"
        onClick={onNavigateToLanding}
        className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to AgriFusion Overview</span>
      </button>

      {/* Main Module Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-stone-200 shadow-xl overflow-hidden relative">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-linear-to-r from-emerald-600 via-[#14532D] to-teal-700" />

        {/* Module Header & Icon */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 text-[#14532D] flex items-center justify-center shrink-0 shadow-2xs">
            <IconComponent className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <span className="inline-block text-[11px] font-bold text-[#14532D] uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {currentModule.badge}
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900">
              {currentModule.title}
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed pt-1">
              {currentModule.description}
            </p>
          </div>
        </div>

        {/* What this module provides */}
        <div className="mt-6 p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
          <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
            What this module does:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {currentModule.capabilities.map((cap, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-white border border-stone-200 text-xs text-stone-700 flex items-start gap-2 leading-relaxed"
              >
                <CheckCircle2 className="w-4 h-4 text-[#14532D] shrink-0 mt-0.5" />
                <span>{cap}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sign In to Access */}
        <div className="mt-6 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-xs text-stone-700 space-y-3">
          <p className="font-medium text-stone-800">
            Sign in or register with your State, District, and Land Area to use this module.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => onOpenAuthModal('login')}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#14532D] hover:bg-[#14532D]/90 text-white font-bold text-xs sm:text-sm transition-all shadow-sm cursor-pointer active:scale-98"
            >
              <LogIn className="w-4 h-4" />
              <span>Log In</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenAuthModal('signup')}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs sm:text-sm border border-stone-300 transition-all cursor-pointer active:scale-98"
            >
              <UserPlus className="w-4 h-4 text-stone-600" />
              <span>Register (Place & Land Area)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

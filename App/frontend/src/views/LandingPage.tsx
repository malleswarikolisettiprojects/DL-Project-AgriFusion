import {
  Activity,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  CloudSun,
  Coins,
  Compass,
  Droplets,
  ExternalLink,
  FileCheck,
  HelpCircle,
  History,
  Layers,
  LogIn,
  MapPin,
  MessageSquareQuote,
  Scale,
  ShieldCheck,
  Sparkles,
  Sprout,
  Stethoscope,
  TrendingUp,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import React, { useState } from 'react';
import { CROP_VISUALS } from '../data/cropImages';
import type { ActivePage, FarmerUser, HealthResponse } from '../types';

interface OperationModuleItem {
  id: string;
  targetPage: ActivePage;
  badge: string;
  badgeBg: string;
  badgeText: string;
  accentBorder: string;
  image: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  highlights: string[];
  ctaText: string;
  ctaColor: string;
}

export function LandingPage({
  onNavigate,
  onOpenSafetyModal,
  health,
  language,
  farmerUser,
  onOpenAuthModal,
}: {
  onNavigate: (page: ActivePage) => void;
  onOpenSafetyModal: () => void;
  health: HealthResponse | null;
  language: 'en' | 'te';
  farmerUser?: FarmerUser | null;
  onOpenAuthModal?: (mode?: 'login' | 'signup') => void;
}) {
  const isHealthy = health?.status === 'ok';
  const isLoggedIn = Boolean(farmerUser?.isLoggedIn);
  const [activeCropFilter, setActiveCropFilter] = useState<'all' | 'cereals' | 'commercial' | 'pulses' | 'spices'>('all');

  const HIGHLIGHTED_CROPS = [
    { key: 'Rice', name: 'Rice / Paddy', telugu: 'వరి (ధాన్యం)', cat: 'cereals' },
    { key: 'Maize', name: 'Maize / Corn', telugu: 'మొక్కజొన్న', cat: 'cereals' },
    { key: 'Chilli', name: 'Red Chilli', telugu: 'ఎర్ర మిర్చి', cat: 'spices' },
    { key: 'Groundnut', name: 'Groundnut', telugu: 'వేరుశనగ (పల్లీలు)', cat: 'commercial' },
    { key: 'Sugarcane', name: 'Sugarcane', telugu: 'చెరకు', cat: 'commercial' },
    { key: 'Red Gram (Tur)', name: 'Red Gram / Toor', telugu: 'కందులు (తొగరి)', cat: 'pulses' },
    { key: 'Bengal Gram (Chickpea)', name: 'Bengal Gram / Chana', telugu: 'శనగలు', cat: 'pulses' },
    { key: 'Soybean', name: 'Soybean', telugu: 'సోయాబీన్', cat: 'commercial' },
    { key: 'Tomato', name: 'Tomato', telugu: 'టమాటా', cat: 'spices' },
    { key: 'Mango', name: 'Mango Orchard', telugu: 'మామిడి', cat: 'spices' },
  ];

  const CORE_MODULES: OperationModuleItem[] = [
    {
      id: 'dashboard',
      targetPage: 'dashboard',
      badge: 'Farm Command Hub',
      badgeBg: 'bg-emerald-600/90',
      badgeText: 'text-white',
      accentBorder: 'hover:border-emerald-500',
      image: '/modules/farmer_dashboard_ops_1790077770377.jpg',
      icon: Sprout,
      title: 'Farmer Dashboard & Daily Operations',
      description: 'Centralized daily action log with time-of-day task schedules (Morning irrigation, Afternoon soil loosening, Evening leaf spraying), acreage tracking, and crop development monitors.',
      highlights: ['Time-of-day task tracking', 'Weather risk warnings', 'Soil moisture & field alerts'],
      ctaText: 'Open Farm Dashboard',
      ctaColor: 'text-[#14532D]',
    },
    {
      id: 'crop-recommendation',
      targetPage: 'crop-recommendation',
      badge: 'Soil & Suitability',
      badgeBg: 'bg-teal-600/90',
      badgeText: 'text-white',
      accentBorder: 'hover:border-teal-400',
      image: '/modules/crop_soil_testing_1790077784109.jpg',
      icon: Compass,
      title: 'Crop Suitability & Soil Nutrition',
      description: 'Evaluates your soil N-P-K nutrient profile, pH levels, and seasonal rainfall patterns to scientifically rank the top crops for Kharif, Rabi, and Summer seasons.',
      highlights: ['NPK & pH soil matching', 'Seasonal suitability score', 'Acreage yield estimation'],
      ctaText: 'Explore Crop Suitability',
      ctaColor: 'text-teal-800',
    },
    {
      id: 'climate-risk',
      targetPage: 'climate-risk',
      badge: 'Weather & Climate',
      badgeBg: 'bg-amber-600/90',
      badgeText: 'text-white',
      accentBorder: 'hover:border-amber-400',
      image: '/modules/climate_risk_weather_1790077795298.jpg',
      icon: CloudSun,
      title: 'Climate Risk & Agronomic Alerts',
      description: 'Continuous monitoring of heatwaves, high-wind storms, dry spells, and Bay of Bengal cyclonic depressions with actionable crop protection advisories.',
      highlights: ['IMD meteorological grid data', 'Heat & drought vulnerability', 'Preventive spray timing'],
      ctaText: 'Check Climate Risks',
      ctaColor: 'text-amber-800',
    },
    {
      id: 'irrigation',
      targetPage: 'irrigation',
      badge: 'Water Management',
      badgeBg: 'bg-sky-600/90',
      badgeText: 'text-white',
      accentBorder: 'hover:border-sky-400',
      image: '/modules/smart_drip_irrigation_1790077807733.jpg',
      icon: Droplets,
      title: 'Canal & Micro-Irrigation Planner',
      description: 'Calculates exact water requirements in millimeters, ET0 evapotranspiration rates, and pump motor run-hours across Drip, Sprinkler, Furrow, and Flood methods.',
      highlights: ['ET0 evapotranspiration math', 'Pump HP run-time calculator', 'Water conservation savings'],
      ctaText: 'Calculate Water Needs',
      ctaColor: 'text-sky-700',
    },
    {
      id: 'cost-profit',
      targetPage: 'cost-profit',
      badge: 'Finance & P&L',
      badgeBg: 'bg-emerald-600/90',
      badgeText: 'text-white',
      accentBorder: 'hover:border-emerald-500',
      image: '/modules/farm_cost_calculator_1790077822491.jpg',
      icon: Coins,
      title: 'Cost & Profit Estimator',
      description: 'Easily calculate your exact production expenditures (seeds, fertilizers, tractor rentals, manual labor) and calculate your break-even yield and clean take-home profits.',
      highlights: ['Itemized input costs', 'Break-even yield threshold', 'Net margin calculation'],
      ctaText: 'Calculate Costs & Profit',
      ctaColor: 'text-emerald-800',
    },
    {
      id: 'market',
      targetPage: 'market',
      badge: 'Harvest Logistics',
      badgeBg: 'bg-yellow-600/90',
      badgeText: 'text-white',
      accentBorder: 'hover:border-yellow-400',
      image: '/modules/mandi_market_trade_1790077833745.jpg',
      icon: TrendingUp,
      title: 'Mandi Pricing & Sales Timing',
      description: 'Compares live and modal mandi prices across state APMC yards against official Government MSP benchmarks to pinpoint the most profitable week to sell.',
      highlights: ['APMC Agmarknet prices', 'MSP benchmark comparison', 'Optimal harvest sale window'],
      ctaText: 'Check Mandi Prices',
      ctaColor: 'text-amber-800',
    },
    {
      id: 'yield',
      targetPage: 'yield',
      badge: 'Yield Analytics',
      badgeBg: 'bg-emerald-700/90',
      badgeText: 'text-white',
      accentBorder: 'hover:border-emerald-500',
      image: '/modules/yield_forecast_harvest_1790077847153.jpg',
      icon: Scale,
      title: 'Yield Forecasting & Production',
      description: 'Projects harvest yields in quintals per hectare, expected harvest dates, and baseline gross revenue based on district soil types and historical CACP benchmarks.',
      highlights: ['Quintals/hectare projections', 'Expected harvest timeline', 'Revenue estimations'],
      ctaText: 'Forecast Harvest Yield',
      ctaColor: 'text-emerald-800',
    },
    {
      id: 'disease-detection',
      targetPage: 'disease-detection',
      badge: 'Plant Pathology',
      badgeBg: 'bg-rose-600/90',
      badgeText: 'text-white',
      accentBorder: 'hover:border-rose-400',
      image: '/modules/leaf_disease_inspection_1790077860787.jpg',
      icon: Stethoscope,
      title: 'Leaf Disease Check & Crop Health',
      description: 'Visual diagnosis for fungal spots, bacterial blights, and viral diseases with CIB&RC-certified chemical dosages, biological controls, and IPM safety instructions.',
      highlights: ['Instant visual diagnosis', 'CIB&RC certified treatments', 'Organic & bio-control options'],
      ctaText: 'Scan Leaf Photo',
      ctaColor: 'text-rose-700',
    },
    {
      id: 'advisor',
      targetPage: 'advisor',
      badge: 'Agronomist AI',
      badgeBg: 'bg-indigo-600/90',
      badgeText: 'text-white',
      accentBorder: 'hover:border-indigo-400',
      image: '/modules/agronomy_ai_advisor_1790077875775.jpg',
      icon: MessageSquareQuote,
      title: 'CropWise Agronomic Advisor',
      description: 'Ask any regional farming question in Telugu or English. Get verified advice on crop cycles, pest thresholds, fertilizer split-doses, and weed management.',
      highlights: ['Bilingual QA (Telugu/English)', 'Customized dosage guidance', 'Scientific IPM protocols'],
      ctaText: 'Ask CropWise AI',
      ctaColor: 'text-indigo-800',
    },
    {
      id: 'schemes',
      targetPage: 'schemes',
      badge: 'Official Subsidies',
      badgeBg: 'bg-purple-600/90',
      badgeText: 'text-white',
      accentBorder: 'hover:border-purple-400',
      image: '/modules/govt_farm_schemes_1790077890908.jpg',
      icon: FileCheck,
      title: 'Government Schemes & Subsidies',
      description: 'Matches small and marginal farmers to official schemes: PM-KISAN, Rythu Bharosa, PM-KUSUM solar pumps, and APMIP/TSMIP drip irrigation subsidies.',
      highlights: ['Direct benefit verification', 'Solar pump PM-KUSUM support', 'Application criteria & documents'],
      ctaText: 'Find Farmer Subsidies',
      ctaColor: 'text-purple-800',
    },
    {
      id: 'pipeline',
      targetPage: 'pipeline',
      badge: 'Full Automation',
      badgeBg: 'bg-emerald-800/90',
      badgeText: 'text-white',
      accentBorder: 'hover:border-emerald-500',
      image: '/modules/unified_farm_pipeline_1790077902609.jpg',
      icon: Activity,
      title: 'Unified 6-Stage Decision Pipeline',
      description: 'One-click consolidated farm assessment: Suitability → Climate Risk → Irrigation Budget → Yield Projection → Mandi Price → Government Subsidy Matching.',
      highlights: ['End-to-end seasonal plan', 'Consolidated output summary', 'Single-click execution'],
      ctaText: 'Run Unified Pipeline',
      ctaColor: 'text-[#14532D]',
    },
    {
      id: 'farm-history',
      targetPage: 'farm-history',
      badge: 'Records Vault',
      badgeBg: 'bg-stone-700/90',
      badgeText: 'text-white',
      accentBorder: 'hover:border-stone-400',
      image: '/modules/farm_history_vault_1790077916621.jpg',
      icon: History,
      title: 'Activity & History Records Vault',
      description: 'Review, filter, and export all past crop recommendations, water run-time schedules, disease diagnoses, and logged farm activities with timestamp verification.',
      highlights: ['Search & filter historical data', 'Exportable farm logs', 'Activity audit trail'],
      ctaText: 'Open Records Vault',
      ctaColor: 'text-stone-800',
    },
  ];

  return (
    <div className="space-y-10 pb-16">
      {/* 1. Hero Section with Real Agricultural Background Image */}
      <section className="relative overflow-hidden rounded-3xl text-white p-6 sm:p-10 lg:p-12 shadow-xl border border-emerald-800/30">
        <div className="absolute inset-0">
          <img
            src="/agri/farm_hero.jpg"
            alt="Agricultural Farm Landscape"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/crops/rice.jpg';
            }}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-linear-to-r from-emerald-950/95 via-emerald-900/85 to-stone-950/80 backdrop-blur-[0.5px]" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/80 border border-emerald-400/30 text-emerald-200 text-xs font-semibold backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AgriFusion • Farmer Decision Guide & Calculator</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight drop-shadow-xs">
            Simple Smart Farming, Crop Costs & Market Prices
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-emerald-100/90 leading-relaxed">
            AgriFusion helps farmers easily calculate farming expenses and profits, check weather risks, get crop recommendations, diagnose leaf diseases, and track daily APMC mandi market rates.
          </p>

          {/* Action CTAs depending on login status */}
          <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-4">
            {isLoggedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#14532D] font-bold text-xs sm:text-sm hover:bg-emerald-50 transition-all shadow-md active:scale-98 cursor-pointer"
                >
                  <Sprout className="w-4 h-4 text-[#14532D]" />
                  <span>Open Farm Dashboard</span>
                  <ArrowRight className="w-4 h-4 text-[#14532D]" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('cost-profit')}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-900/80 hover:bg-emerald-800/90 border border-emerald-400/40 text-white font-semibold text-xs sm:text-sm transition-all cursor-pointer backdrop-blur-xs"
                >
                  <Coins className="w-4 h-4 text-amber-300" />
                  <span>Cost & Profit Estimator</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuthModal?.('login')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#14532D] font-bold text-xs sm:text-sm hover:bg-emerald-50 transition-all shadow-md active:scale-98 cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-[#14532D]" />
                  <span>Farmer Login to Access</span>
                  <ArrowRight className="w-4 h-4 text-[#14532D]" />
                </button>

                <button
                  type="button"
                  onClick={() => onOpenAuthModal?.('signup')}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-900/80 hover:bg-emerald-800/90 border border-emerald-400/40 text-white font-semibold text-xs sm:text-sm transition-all cursor-pointer backdrop-blur-xs"
                >
                  <UserPlus className="w-4 h-4 text-emerald-300" />
                  <span>Register (Only Place & Land Area)</span>
                </button>
              </>
            )}
          </div>

          <div className="pt-2 flex items-center gap-3 text-xs text-emerald-200/90">
            <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>Official Standards Verified • Soil Health Card & CIB&RC Calibrated</span>
          </div>
        </div>
      </section>

      {/* 2. Core Agricultural Operations & Intelligence (All Modules with Real Imagery) */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-[#14532D] text-xs font-bold mb-2">
              <Sprout className="w-3.5 h-3.5 text-[#14532D]" />
              <span>Full Agricultural Intelligence Suite</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">
              Core Agricultural Operations & Intelligence
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 max-w-2xl mt-1">
              Complete decision-support tools tailored for Andhra Pradesh & Telangana farmers — integrating ICAR crop guides, IMD meteorological feeds, CACP cost metrics, Agmarknet APMC rates, and CIB&RC plant protection standards.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-stone-500 bg-stone-100 px-3 py-1.5 rounded-xl shrink-0">
            <Layers className="w-4 h-4 text-[#14532D]" />
            <span>12 Precision Modules</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CORE_MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <div
                key={module.id}
                onClick={() => onNavigate(module.targetPage)}
                className={`group relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs ${module.accentBorder} hover:shadow-md transition-all cursor-pointer flex flex-col justify-between`}
              >
                <div>
                  {/* Top Image Banner with Overlay Badge */}
                  <div className="relative h-44 w-full overflow-hidden bg-stone-100">
                    <img
                      src={module.image}
                      alt={module.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/crops/rice.jpg';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-stone-950/85 via-stone-950/30 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${module.badgeBg} ${module.badgeText} backdrop-blur-xs inline-block`}
                        >
                          {module.badge}
                        </span>
                      </div>
                      <h3 className="text-base font-bold mt-1 text-white leading-snug drop-shadow-xs">
                        {module.title}
                      </h3>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3">
                    <p className="text-stone-600 leading-relaxed text-xs">
                      {module.description}
                    </p>

                    {/* Operational Highlights */}
                    <div className="pt-2 border-t border-stone-100 space-y-1">
                      {module.highlights.map((highlight, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 text-[11px] text-stone-500"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{highlight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Action CTA */}
                <div className="px-4 py-3 bg-stone-50/70 border-t border-stone-100 flex items-center justify-between text-xs font-bold">
                  <span className={module.ctaColor}>{module.ctaText}</span>
                  <ArrowRight
                    className={`w-4 h-4 ${module.ctaColor} group-hover:translate-x-1 transition-transform`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Featured Regional Crops Photographic Gallery */}
      <section className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
              <Sprout className="w-5 h-5 text-[#14532D]" />
              <span>Major Crops of Andhra Pradesh & Telangana</span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Select any crop below to calculate field costs, estimate profits, or view harvest forecasts.
            </p>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'All Crops' },
              { id: 'cereals', label: 'Cereals' },
              { id: 'pulses', label: 'Pulses' },
              { id: 'commercial', label: 'Commercial & Oilseeds' },
              { id: 'spices', label: 'Spices & Fruits' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCropFilter(tab.id as any)}
                className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer text-xs ${
                  activeCropFilter === tab.id
                    ? 'bg-[#14532D] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {HIGHLIGHTED_CROPS.filter((c) => {
            if (activeCropFilter === 'all') return true;
            return c.cat === activeCropFilter;
          }).map((item) => {
            const visual = CROP_VISUALS[item.key] || CROP_VISUALS.Rice;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate('cost-profit')}
                className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white hover:border-emerald-500 hover:shadow-md transition-all text-left flex flex-col p-2.5 cursor-pointer"
              >
                <div className="relative w-full h-24 sm:h-28 rounded-xl overflow-hidden bg-stone-100 mb-2">
                  <img
                    src={visual.image}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/crops/rice.jpg';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {visual.category && (
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-stone-950/80 text-white backdrop-blur-xs">
                      {visual.category}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-stone-900 group-hover:text-[#14532D] transition-colors truncate">
                    {item.name}
                  </h4>
                  {visual.seasonInfo && (
                    <span className="text-[11px] font-medium text-emerald-800 block truncate">
                      {visual.seasonInfo}
                    </span>
                  )}
                  {visual.typicalYield && (
                    <span className="text-[10px] text-stone-500 block truncate">
                      {visual.typicalYield}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Safety & Standards Section */}
      <section className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0" />
          <p className="text-xs sm:text-sm">
            <strong className="font-semibold text-amber-900">Statutory Notice:</strong> All calculations are advisory decision-support estimates. Recommendations must be cross-verified with official state revenue records, local Krishi Vigyan Kendras (KVK), and certified agrochemical label registrations.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSafetyModal}
          className="text-xs font-bold text-amber-900 hover:text-amber-950 underline underline-offset-2 shrink-0 cursor-pointer"
        >
          View Standards & Sources
        </button>
      </section>

      {/* Bottom CTA Banner */}
      <section className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-stone-900">Ready to plan your season?</h3>
          <p className="text-xs text-stone-600 mt-0.5">
            {isLoggedIn
              ? 'Your farm profile is active. Jump directly into the Farmer Workspace.'
              : 'Login now with State, District, and Acreage to unlock all precision models.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#14532D]/90 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              Open Farmer Dashboard
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuthModal?.('login')}
              className="px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#14532D]/90 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              Log In to Start
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

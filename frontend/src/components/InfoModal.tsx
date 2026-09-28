import React, { useState } from 'react';
import {
  X,
  Sprout,
  ShieldCheck,
  Lock,
  BookOpen,
  Cpu,
  Layers,
  FileCheck2,
  Database,
  ExternalLink,
  PhoneCall,
  CheckCircle2,
  HelpCircle,
  Activity,
  HeartHandshake,
  Wheat,
} from 'lucide-react';

export type InfoModalTab = 'about' | 'privacy' | 'sources' | 'safety';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: InfoModalTab;
  onNavigate?: (page: any) => void;
}

export function InfoModal({
  isOpen,
  onClose,
  initialTab = 'about',
  onNavigate,
}: InfoModalProps) {
  const [activeTab, setActiveTab] = useState<InfoModalTab>(initialTab);

  // Sync tab if initialTab changes when opened
  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 bg-stone-900/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[88vh]">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-stone-200 bg-stone-50/70 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#14532D] text-white flex items-center justify-center shadow-xs">
                <Sprout className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black text-stone-900 flex items-center gap-2">
                  <span>AgriFusion Information Hub</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#14532D] border border-emerald-200">
                    v2.4
                  </span>
                </h3>
                <p className="text-xs text-stone-500">
                  Open Precision Agriculture & Agro-Intelligence Platform
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-stone-200 bg-white px-4 sm:px-6 gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'about'
                  ? 'border-[#14532D] text-[#14532D]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Sprout className="w-4 h-4" />
              <span>About AgriFusion</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'privacy'
                  ? 'border-[#14532D] text-[#14532D]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Privacy & Data Security</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sources')}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'sources'
                  ? 'border-[#14532D] text-[#14532D]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Official Data Sources</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('safety')}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'safety'
                  ? 'border-[#14532D] text-[#14532D]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Safety & Mandate</span>
            </button>
          </div>

          {/* Modal Content Area */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-stone-700 text-xs sm:text-sm leading-relaxed">
            {/* TAB 1: ABOUT AGRIFUSION */}
            {activeTab === 'about' && (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-stone-50 to-amber-50/40 border border-emerald-200">
                  <h4 className="text-sm sm:text-base font-extrabold text-stone-900 mb-1 flex items-center gap-2">
                    <Wheat className="w-4 h-4 text-[#14532D]" />
                    <span>What is AgriFusion?</span>
                  </h4>
                  <p className="text-stone-700 leading-relaxed text-xs sm:text-sm">
                    <strong>AgriFusion</strong> is a full-stack, offline-first precision agriculture platform designed specifically for smallholder and commercial farmers across India (with focused regional agronomy for <strong>Andhra Pradesh and Telangana</strong>). It unifies real-time weather forecasts, soil nutrient indices, crop economics, disease diagnosis, and government welfare access into a simple, bilingual interface in <strong>English and Telugu (తెలుగు)</strong>.
                  </p>
                </div>

                {/* Core Pillars Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-xl border border-stone-200 bg-white space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-2 font-bold text-stone-900 text-xs sm:text-sm">
                      <div className="p-1.5 rounded-lg bg-emerald-100 text-[#14532D]">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <span>AI & Agronomic ML Models</span>
                    </div>
                    <p className="text-xs text-stone-600">
                      Predicts optimal crop varieties, crop diseases via computer vision scanner, harvest yields, and irrigation hours using calibrated ICAR and ANGRAU research formulas.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 bg-white space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-2 font-bold text-stone-900 text-xs sm:text-sm">
                      <div className="p-1.5 rounded-lg bg-amber-100 text-amber-900">
                        <Activity className="w-4 h-4" />
                      </div>
                      <span>Live Mandi Prices & Cost-Profit</span>
                    </div>
                    <p className="text-xs text-stone-600">
                      Integrates Agmarknet / e-NAM modal prices, transport costs, and input expenses (seeds, fertilizers, diesel) to show real expected net returns per acre.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 bg-white space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-2 font-bold text-stone-900 text-xs sm:text-sm">
                      <div className="p-1.5 rounded-lg bg-sky-100 text-sky-900">
                        <Database className="w-4 h-4" />
                      </div>
                      <span>Day-Wise Operations Register</span>
                    </div>
                    <p className="text-xs text-stone-600">
                      Maintains a chronological field diary for water runs, weeding, fertilizer passes, and harvesting with offline persistence and PMFBY audit export.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 bg-white space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-2 font-bold text-stone-900 text-xs sm:text-sm">
                      <div className="p-1.5 rounded-lg bg-purple-100 text-purple-900">
                        <FileCheck2 className="w-4 h-4" />
                      </div>
                      <span>Central & State Subsidies</span>
                    </div>
                    <p className="text-xs text-stone-600">
                      Direct guidance for PM-KISAN, Rythu Bharosa, PM-KUSUM solar pumps, Soil Health Cards, and Micro-Irrigation (APMIP/TSMIP) subsidies.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                  <h5 className="font-bold text-stone-900 text-xs sm:text-sm">Built for Connectivity Resilience</h5>
                  <p className="text-xs text-stone-600">
                    Field internet can be erratic. AgriFusion stores your farm profile, field logs, offline disease diagnostics, and schedules in your local device storage. When network connectivity drops, your calculations and farm diary remain completely functional.
                  </p>
                  {onNavigate && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigate('dashboard');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#14532D] text-white font-bold text-xs hover:bg-[#14532D]/90 transition-colors cursor-pointer"
                      >
                        Open Farmer Dashboard
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigate('landing');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-800 font-bold text-xs hover:bg-stone-100 transition-colors cursor-pointer"
                      >
                        Explore Feature Tour
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: PRIVACY & DATA SECURITY */}
            {activeTab === 'privacy' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold mb-1">
                    <Lock className="w-4 h-4 text-[#14532D]" />
                    <span>Farmer Privacy First Principle</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                    AgriFusion does not sell, monetize, or harvest your private agricultural data. Your land records, survey numbers, yield predictions, and financial estimates are stored locally in your browser storage (IndexedDB / localStorage) and only transmitted to AI processing endpoints when you explicitly trigger an advisory query.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl border border-stone-200 bg-white space-y-1">
                    <h5 className="font-bold text-stone-900 text-xs sm:text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>1. Local-First Data Storage</span>
                    </h5>
                    <p className="text-xs text-stone-600 pl-5">
                      Farm logs, crop entries, and expense ledgers are saved locally on your device. You can clear your data at any time through the Settings or Diagnostics tab.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 bg-white space-y-1">
                    <h5 className="font-bold text-stone-900 text-xs sm:text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>2. No Commercial Brokerage Access</span>
                    </h5>
                    <p className="text-xs text-stone-600 pl-5">
                      We do not share your expected harvest dates or crop volumes with middlemen, traders, or loan sharks. Market price intelligence is fetched directly from public open APMC mandi records.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 bg-white space-y-1">
                    <h5 className="font-bold text-stone-900 text-xs sm:text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>3. Camera & Photo Permissions</span>
                    </h5>
                    <p className="text-xs text-stone-600 pl-5">
                      When using the Leaf Disease Scanner, uploaded crop photos are processed in temporary computer vision inference memory to detect fungal or bacterial blight and are not stored in any public visual gallery.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 bg-white space-y-1">
                    <h5 className="font-bold text-stone-900 text-xs sm:text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>4. Government Scheme Verification</span>
                    </h5>
                    <p className="text-xs text-stone-600 pl-5">
                      Subsidies checks are simulated based on published state guidelines. We do not solicit or store Aadhaar numbers, bank account numbers, or OTP credentials.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: OFFICIAL DATA SOURCES */}
            {activeTab === 'sources' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                  <h4 className="font-bold text-stone-900 mb-1 flex items-center gap-1.5 text-xs sm:text-sm">
                    <BookOpen className="w-4 h-4 text-[#14532D]" />
                    <span>Authoritative Scientific & Government Data Sources</span>
                  </h4>
                  <p className="text-xs text-stone-600">
                    AgriFusion anchors its algorithms and price tickers to verified public portals and national agricultural research institutes:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href="https://icar.org.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl border border-stone-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 transition-all flex items-start justify-between group shadow-2xs"
                  >
                    <div>
                      <span className="font-bold text-stone-900 text-xs group-hover:text-[#14532D]">
                        ICAR & ANGRAU
                      </span>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Package of practices, crop nutrient thresholds, and botanical disease classification.
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#14532D] shrink-0 ml-2" />
                  </a>

                  <a
                    href="https://agmarknet.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl border border-stone-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 transition-all flex items-start justify-between group shadow-2xs"
                  >
                    <div>
                      <span className="font-bold text-stone-900 text-xs group-hover:text-[#14532D]">
                        AGMARKNET & e-NAM
                      </span>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Daily wholesale mandi arrivals, minimum, maximum, and modal trading prices across AP & TS.
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#14532D] shrink-0 ml-2" />
                  </a>

                  <a
                    href="https://mausam.imd.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl border border-stone-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 transition-all flex items-start justify-between group shadow-2xs"
                  >
                    <div>
                      <span className="font-bold text-stone-900 text-xs group-hover:text-[#14532D]">
                        IMD & Agrimet Radar
                      </span>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Precipitation probability, evapotranspiration rates (ET₀), and monsoon progress tracking.
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#14532D] shrink-0 ml-2" />
                  </a>

                  <a
                    href="http://ppqs.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl border border-stone-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 transition-all flex items-start justify-between group shadow-2xs"
                  >
                    <div>
                      <span className="font-bold text-stone-900 text-xs group-hover:text-[#14532D]">
                        CIB&RC (PPQS)
                      </span>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Central Insecticides Board chemical registrations, pre-harvest intervals, and safety restrictions.
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#14532D] shrink-0 ml-2" />
                  </a>

                  <a
                    href="https://pmkisan.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl border border-stone-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 transition-all flex items-start justify-between group shadow-2xs"
                  >
                    <div>
                      <span className="font-bold text-stone-900 text-xs group-hover:text-[#14532D]">
                        PM-KISAN & State Portals
                      </span>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Official criteria for income support, Rythu Bharosa, and Rythu Bandhu schemes.
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#14532D] shrink-0 ml-2" />
                  </a>

                  <a
                    href="https://pmfby.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl border border-stone-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 transition-all flex items-start justify-between group shadow-2xs"
                  >
                    <div>
                      <span className="font-bold text-stone-900 text-xs group-hover:text-[#14532D]">
                        PMFBY Crop Insurance
                      </span>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Actuarial premium guidelines and localized crop loss notification frameworks.
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#14532D] shrink-0 ml-2" />
                  </a>
                </div>
              </div>
            )}

            {/* TAB 4: SAFETY & MANDATE */}
            {activeTab === 'safety' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-900 mb-1 text-xs sm:text-sm">
                        Decision Support & Ground Reality Notice
                      </h4>
                      <p className="text-amber-800 leading-relaxed text-xs">
                        AgriFusion is an agronomic decision-support platform, not a substitute for ground soil testing or field inspection by licensed agricultural officers. Microclimates, localized pest strains, and water salinity vary across every survey plot.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-white border border-stone-200 space-y-1">
                    <h5 className="font-bold text-stone-900 text-xs sm:text-sm">
                      Chemical Spray & Fertilizer Safety
                    </h5>
                    <p className="text-xs text-stone-600">
                      Never apply restricted pesticides without verifying CIB&RC approved label rates and mandatory pre-harvest intervals (PHI). Always confirm spray schedules with your Mandal Agricultural Officer (MAO) or nearest Rythu Bharosa Kendra (RBK).
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-stone-200 space-y-1">
                    <h5 className="font-bold text-stone-900 text-xs sm:text-sm">
                      24×7 Farmer Support Helplines
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                      <div className="p-2 rounded-lg bg-stone-50 border border-stone-200">
                        <span className="font-semibold text-stone-800 block">Kisan Call Centre (National)</span>
                        <a href="tel:18001801551" className="font-bold text-[#14532D] hover:underline">
                          Toll Free: 1800-180-1551
                        </a>
                      </div>
                      <div className="p-2 rounded-lg bg-stone-50 border border-stone-200">
                        <span className="font-semibold text-stone-800 block">Rythu Bharosa Kendra (AP)</span>
                        <a href="tel:1907" className="font-bold text-[#14532D] hover:underline">
                          Toll Free: 1907
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
            <span className="text-[11px] text-stone-500">
              AgriFusion • Built for Indian Farmers (భారతీయ రైతుల కోసం)
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#14532D] text-white hover:bg-[#14532D]/90 transition-colors cursor-pointer shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

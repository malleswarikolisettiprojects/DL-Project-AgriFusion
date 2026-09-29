import {
  Activity,
  ArrowUp,
  CheckCircle2,
  Coins,
  Compass,
  Droplets,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  Globe,
  Mail,
  MessageSquareQuote,
  PhoneCall,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sprout,
  Stethoscope,
  TrendingUp,
  User,
} from 'lucide-react';
import React, { useState } from 'react';
import type { ActivePage, FarmerUser, HealthResponse } from '../types';

interface FooterProps {
  onNavigate: (page: ActivePage) => void;
  onOpenSafetyModal: () => void;
  onOpenInfoModal?: (tab: 'about' | 'privacy' | 'sources' | 'safety') => void;
  onOpenAuthModal?: (mode?: 'login' | 'signup' | 'profile') => void;
  onOpenFeedbackModal?: () => void;
  currentUser?: FarmerUser | null;
  health?: HealthResponse | null;
}

export function Footer({
  onNavigate,
  onOpenSafetyModal,
  onOpenInfoModal,
  onOpenAuthModal,
  onOpenFeedbackModal,
  currentUser,
  health,
}: FooterProps) {
  const currentYear = new Date().getFullYear();
  const isHealthy = health?.status === 'ok';
  const [newsletterInput, setNewsletterInput] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterInput.trim()) {
      setSubscribed(true);
      setTimeout(() => {
        setNewsletterInput('');
      }, 3000);
    }
  };

  return (
    <footer className="border-t border-stone-200 bg-stone-900 text-stone-300 text-sm">
      {/* 1. NEWSLETTER / KISAN ADVISORY NOTIFICATION STRIP */}
      <div className="border-b border-stone-800 bg-stone-950/80 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                <Mail className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-white">
                Weekly Mandi & Monsoon Advisory Updates
              </h3>
            </div>
            <p className="text-xs text-stone-400 max-w-xl">
              Receive timely sowing dates, pest outbreak warnings, and APMC mandi price updates customized for Andhra Pradesh & Telangana.
            </p>
          </div>

          <form onSubmit={handleSubscribe} className="w-full lg:w-auto flex flex-col sm:flex-row items-center gap-2">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={newsletterInput}
                onChange={(e) => setNewsletterInput(e.target.value)}
                placeholder="Enter mobile number or email"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-xs text-white placeholder:text-stone-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <Send className="w-4 h-4 text-stone-500 absolute right-3 top-3 pointer-events-none" />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer whitespace-nowrap"
            >
              {subscribed ? '✓ Subscribed' : 'Get Farm Advisories'}
            </button>
          </form>
        </div>
      </div>

      {/* 2. GOVERNMENT HELPLINE BANNER */}
      <div className="border-b border-stone-800/60 bg-emerald-950/30 py-3.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-stone-200">
                Government Kisan Call Centre (Toll-Free, 24×7):
              </span>{' '}
              <a href="tel:18001801551" className="text-emerald-400 font-extrabold hover:underline">
                1800-180-1551
              </a>
              <span className="text-stone-400 ml-1.5 hidden sm:inline">
                (Free agronomist advice in Telugu & Hindi)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (onOpenInfoModal ? onOpenInfoModal('safety') : onOpenSafetyModal())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium transition-colors border border-stone-700 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Official Safety Guidelines</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. MAIN MULTI-COLUMN WEBSITE FOOTER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10">
          {/* Brand & Platform Column */}
          <div className="lg:col-span-2 space-y-4 pr-0 lg:pr-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md">
                <Sprout className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-black tracking-tight text-white">AgriFusion</span>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed">
              AgriFusion is an open precision agriculture intelligence platform built for Indian farmers. We integrate meteorological radar data, regional soil chemistry benchmarks, live APMC mandi arrivals, and ICAR agronomy recommendations into clear, actionable on-field guidance.
            </p>

            <div className="pt-1 flex flex-wrap gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-800 text-stone-300 border border-stone-700">
                <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                <span>{isHealthy ? 'AI Models Active' : 'Offline Mode'}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-800 text-stone-300 border border-stone-700">
                <Globe className="w-3 h-3 text-emerald-400" />
                <span>Telugu (తెలుగు) & English</span>
              </span>
            </div>

            {/* Quick account state */}
            <div className="pt-2 text-xs text-stone-400">
              {currentUser?.isLoggedIn ? (
                <div className="flex items-center gap-2">
                  <span className="text-stone-300">Signed in as <strong className="text-emerald-400">{currentUser.name}</strong></span>
                  <button
                    type="button"
                    onClick={() => onOpenAuthModal?.('profile')}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                  >
                    Farm Settings
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenAuthModal?.('login')}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Farmer Sign In / Register</span>
                </button>
              )}
            </div>
          </div>

          {/* Column 1: Precision Agro Tools */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Agro Tools
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="hover:text-white transition-colors text-stone-400 text-left flex items-center gap-1.5 cursor-pointer"
                >
                  <Sprout className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Farm Dashboard</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('cost-profit')}
                  className="hover:text-white transition-colors text-stone-400 text-left flex items-center gap-1.5 cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Cost & Profit Estimator</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('market')}
                  className="hover:text-white transition-colors text-stone-400 text-left flex items-center gap-1.5 cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Mandi Price Trends</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('yield')}
                  className="hover:text-white transition-colors text-stone-400 text-left flex items-center gap-1.5 cursor-pointer"
                >
                  <Scale className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Harvest Yield Forecast</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('disease-detection')}
                  className="hover:text-white transition-colors text-stone-400 text-left flex items-center gap-1.5 cursor-pointer"
                >
                  <Stethoscope className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Leaf Disease Scanner</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('irrigation')}
                  className="hover:text-white transition-colors text-stone-400 text-left flex items-center gap-1.5 cursor-pointer"
                >
                  <Droplets className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Smart Irrigation</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('pipeline')}
                  className="hover:text-white transition-colors text-stone-400 text-left flex items-center gap-1.5 cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Complete Farm Pipeline</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Government Programs */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Govt Schemes
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('schemes')}
                  className="hover:text-white transition-colors text-stone-400 text-left flex items-center gap-1.5 cursor-pointer font-medium text-emerald-400"
                >
                  <FileCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Subsidies Directory</span>
                </button>
              </li>
              <li>
                <a
                  href="https://pmkisan.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors text-stone-400 flex items-center justify-between gap-1 group"
                >
                  <span>PM-KISAN Portal</span>
                  <ExternalLink className="w-3 h-3 text-stone-600 group-hover:text-stone-300" />
                </a>
              </li>
              <li>
                <a
                  href="https://pmfby.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors text-stone-400 flex items-center justify-between gap-1 group"
                >
                  <span>PM Fasal Bima (PMFBY)</span>
                  <ExternalLink className="w-3 h-3 text-stone-600 group-hover:text-stone-300" />
                </a>
              </li>
              <li>
                <a
                  href="https://soilhealth.dac.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors text-stone-400 flex items-center justify-between gap-1 group"
                >
                  <span>Soil Health Card</span>
                  <ExternalLink className="w-3 h-3 text-stone-600 group-hover:text-stone-300" />
                </a>
              </li>
              <li>
                <a
                  href="https://enam.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors text-stone-400 flex items-center justify-between gap-1 group"
                >
                  <span>e-NAM National Mandi</span>
                  <ExternalLink className="w-3 h-3 text-stone-600 group-hover:text-stone-300" />
                </a>
              </li>
              <li>
                <a
                  href="https://pmksy.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors text-stone-400 flex items-center justify-between gap-1 group"
                >
                  <span>PM Krishi Sinchayee</span>
                  <ExternalLink className="w-3 h-3 text-stone-600 group-hover:text-stone-300" />
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Trust, Support & Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Trust & Support
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => (onOpenInfoModal ? onOpenInfoModal('safety') : onOpenSafetyModal())}
                  className="hover:text-white transition-colors text-stone-400 text-left flex items-center gap-1.5 cursor-pointer font-medium text-amber-300"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Mandatory Safety Protocol</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('farm-history')}
                  className="hover:text-white transition-colors text-stone-400 text-left flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Field Operations Register</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('advisor')}
                  className="hover:text-white transition-colors text-stone-400 text-left flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquareQuote className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>CropWise Agronomist AI</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('diagnostics')}
                  className="hover:text-white transition-colors text-stone-400 text-left flex items-center gap-1.5 cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>System Diagnostics</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenFeedbackModal ? onOpenFeedbackModal() : onNavigate('advisor')}
                  className="hover:text-white transition-colors text-emerald-400 text-left flex items-center gap-1.5 cursor-pointer font-medium"
                >
                  <MessageSquareQuote className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Farmer Advisory Feedback</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className="hover:text-white transition-colors text-purple-400 text-left flex items-center gap-1.5 cursor-pointer font-semibold"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                  <span>Administrator Portal</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => (onOpenInfoModal ? onOpenInfoModal('safety') : onOpenSafetyModal())}
                  className="hover:text-white transition-colors text-stone-400 text-left cursor-pointer"
                >
                  Chemical Pesticide Guidelines
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => (onOpenInfoModal ? onOpenInfoModal('privacy') : onOpenSafetyModal())}
                  className="hover:text-white transition-colors text-stone-400 text-left cursor-pointer"
                >
                  Data Privacy & Offline Security
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Advisory Disclaimer Notice Box */}
        <div className="mt-12 p-4 rounded-2xl bg-stone-950 border border-stone-800 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Important Agronomic & Decision Support Notice</span>
          </div>
          <p className="text-[11px] text-stone-400 leading-relaxed">
            AgriFusion is an independent digital agronomy decision-support software. Yield forecasts, disease detections, irrigation schedules, and price estimates are statistical models. Chemical spray applications (pesticides, fungicides, herbicides) and fertilizer dosages <strong>must always be confirmed with your Mandal Agricultural Officer (MAO), Rythu Bharosa Kendra (RBK), or KVK agronomist</strong> and strictly adhere to CIB&RC approved label rates.
          </p>
        </div>
      </div>

      {/* 4. SUB-FOOTER / COPYRIGHT & BACK TO TOP */}
      <div className="border-t border-stone-800/80 bg-stone-950 py-6 px-4 sm:px-6 lg:px-8 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <p>
              © {currentYear} <strong className="text-stone-300">AgriFusion</strong>. Built for Indian Farmers.
            </p>
            <span className="hidden sm:inline text-stone-700">•</span>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onOpenFeedbackModal || onOpenSafetyModal}
                className="hover:text-emerald-400 font-semibold text-emerald-500 transition-colors cursor-pointer"
              >
                Help & Feedback
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => (onOpenInfoModal ? onOpenInfoModal('privacy') : onOpenSafetyModal())}
                className="hover:text-stone-300 transition-colors cursor-pointer"
              >
                Privacy
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => (onOpenInfoModal ? onOpenInfoModal('sources') : onOpenSafetyModal())}
                className="hover:text-stone-300 transition-colors cursor-pointer"
              >
                Official Sources
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => (onOpenInfoModal ? onOpenInfoModal('about') : onNavigate('landing'))}
                className="hover:text-stone-300 transition-colors cursor-pointer"
              >
                About AgriFusion
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-medium transition-colors border border-stone-700 cursor-pointer shadow-xs"
            aria-label="Back to top"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}

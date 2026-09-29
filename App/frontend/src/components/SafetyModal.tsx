import React from 'react';
import { ShieldCheck, AlertTriangle, BookOpen, PhoneCall, ExternalLink, X, CheckCircle2 } from 'lucide-react';

export function SafetyModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-stone-200">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-200">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#14532D] flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-[#14532D]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-900">AgriFusion Source & Safety Center</h3>
                <p className="text-xs text-stone-500">Guidelines for AI predictions, crop protection, and official schemes</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-stone-700 max-h-[70vh] overflow-y-auto pr-1">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900 mb-1">Advisory Status & Verification</h4>
                  <p className="text-amber-800 leading-relaxed text-xs">
                    All machine learning outputs (crop recommendations, climate risk, irrigation hours, disease detections, yield forecasts, and market predictions) are digital decision-support estimates. They must never be treated as confirmed botanical diagnoses or guaranteed yields. Always consult your Mandal Agricultural Officer (AO), Krishi Vigyan Kendra (KVK), or Horticulture Officer before critical field applications.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1 shrink-0" />
                <div>
                  <h5 className="font-bold text-stone-900 text-xs sm:text-sm">Crop Disease & Visual Assessment</h5>
                  <p className="text-stone-600 text-xs mt-0.5 leading-relaxed">
                    Image-based pest and disease detections are visual inferences. Symptoms can overlap between nutritional deficiencies, fungal pathogens, and viral infections. Never apply restricted chemicals or unverified dosages based solely on an automated photo scan.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1 shrink-0" />
                <div>
                  <h5 className="font-bold text-stone-900 text-xs sm:text-sm">Pesticide & Fertilizer Responsibilities</h5>
                  <p className="text-stone-600 text-xs mt-0.5 leading-relaxed">
                    AgriFusion does not invent chemical dosages. Recommended sprays must comply with Central Insecticides Board & Registration Committee (CIB&RC) labels, waiting periods, and safety gear requirements. Fertilizer dosages require soil test report (Soil Health Card) validation.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1 shrink-0" />
                <div>
                  <h5 className="font-bold text-stone-900 text-xs sm:text-sm">Government Scheme Eligibility</h5>
                  <p className="text-stone-600 text-xs mt-0.5 leading-relaxed">
                    Schemes such as PM-KISAN, Rythu Bharosa, PM-KUSUM, and PMFBY are marked as <span className="font-semibold text-stone-900">“Possible match — official verification required.”</span> The platform does not decide eligibility; official verification by revenue authorities and state agriculture portals is mandatory.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <h5 className="font-semibold text-stone-900 mb-2 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-[#14532D]" />
                Official Farmers Helplines
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-white border border-stone-200">
                  <span className="font-medium block text-stone-800">Kisan Call Centre (National)</span>
                  <span className="font-bold text-[#14532D]">Toll Free: 1800-180-1551</span>
                </div>
                <div className="p-2 rounded bg-white border border-stone-200">
                  <span className="font-medium block text-stone-800">PM-KISAN Helpline</span>
                  <span className="font-bold text-[#14532D]">155261 / 011-24300606</span>
                </div>
                <div className="p-2 rounded bg-white border border-stone-200">
                  <span className="font-medium block text-stone-800">Rythu Bharosa Kendra (AP)</span>
                  <span className="font-bold text-[#14532D]">Toll Free: 1907</span>
                </div>
                <div className="p-2 rounded bg-white border border-stone-200">
                  <span className="font-medium block text-stone-800">Rythu Bandhu Cell (TS)</span>
                  <span className="font-bold text-[#14532D]">Toll Free: 1800-425-4033</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-stone-200 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#14532D] text-white hover:bg-[#14532D]/90 transition-colors"
            >
              I Understand & Acknowledge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

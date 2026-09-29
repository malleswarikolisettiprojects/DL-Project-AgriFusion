import {
  AlertTriangle,
  Building,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  HelpCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Waves,
} from 'lucide-react';
import React, { useState } from 'react';
import { AreaInputField } from '../components/AreaInputField';
import {
  ConfidenceBadge,
  DisclaimerBanner,
  ErrorState,
  LoadingState,
  RiskBadge,
  StatutoryAdvisoryTopBanner,
} from '../components/CommonUI';
import { PageHeader } from '../components/Navigation';
import { FeedbackPrompt } from '../components/FeedbackPrompt';
import {
  COMMON_CROPS,
  GOVERNMENT_SCHEMES_CATALOG,
  STATES_AND_DISTRICTS,
  type VerifiedScheme,
} from '../data/agriData';
import { recommendSchemes } from '../lib/api';
import type { SchemeItem, SchemeRecommendRequest, UserFarmProfile } from '../types';

export function SchemesView({ profile }: { profile: UserFarmProfile }) {
  const [formData, setFormData] = useState<SchemeRecommendRequest>({
    state: profile.state || 'Andhra Pradesh',
    district: profile.district || 'Visakhapatnam',
    crop: profile.crop || 'Rice',
    area_ha: profile.area_ha || 2,
    growth_stage: 'Vegetative',
    solar_interest: true,
    irrigation_type: 'Borewell',
    climate_risk_level: 'Low',
    farmer_category: 'Small & Marginal (Under 2 Ha)',
  });

  const [loading, setLoading] = useState(false);
  const [apiResult, setApiResult] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasMatched, setHasMatched] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'central' | 'state' | 'solar' | 'irrigation'>('all');

  const selectedState =
    STATES_AND_DISTRICTS.find((s) => s.name === formData.state) || STATES_AND_DISTRICTS[0];

  const handleRecommend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setHasMatched(true);

    try {
      const response = await recommendSchemes({
        state: formData.state,
        district: formData.district,
        crop: formData.crop || undefined,
        area_ha: Number(formData.area_ha) || 2,
        growth_stage: formData.growth_stage || undefined,
        solar_interest: formData.solar_interest ?? true,
        irrigation_type: formData.irrigation_type || undefined,
        climate_risk_level: formData.climate_risk_level || undefined,
        farmer_category: formData.farmer_category || undefined,
      });
      setApiResult(response);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch custom scheme recommendations. Showing verified catalog matches below.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Evaluate eligibility criteria and determine why each scheme matches
  const evaluateScheme = (scheme: Record<string, any>) => {
    const id = String(scheme.id || '');
    const state = formData.state;
    const areaHa = Number(formData.area_ha) || 2;
    const irrigation = formData.irrigation_type || 'Borewell';
    const crop = formData.crop || 'Rice';
    const solarInterest = formData.solar_interest ?? true;

    if (id === 'pm-kisan') {
      return {
        matched: true,
        why: `Matched: Direct financial assistance (₹6,000/year in 3 installments) applies to all resident landholding farmer families cultivating ${areaHa} Ha in ${formData.district}, ${state}.`,
      };
    }

    if (id === 'pm-kusum') {
      const qualifies = solarInterest || irrigation === 'Borewell' || irrigation === 'Open Well';
      if (qualifies) {
        return {
          matched: true,
          why: `Matched: Farm relies on ${irrigation} irrigation with active interest in solar power, qualifying for up to 60% capital subsidy under Component B & C.`,
        };
      }
      return {
        matched: false,
        why: 'Requires irrigation pump setup or active solar interest.',
      };
    }

    if (id === 'pmfby') {
      return {
        matched: true,
        why: `Matched: ${crop} is a notified insurable crop in ${formData.district}. Premium is heavily subsidized and capped at 1.5% - 2% to protect your ${areaHa} Ha from climate/weather risks.`,
      };
    }

    if (id === 'rythu-bharosa-ap') {
      if (state === 'Andhra Pradesh') {
        return {
          matched: true,
          why: `Matched: Resident cultivator in Andhra Pradesh (${formData.district}). Landholding (${areaHa} Ha) meets YSR Rythu Bharosa input investment eligibility via e-Crop registration.`,
        };
      }
      return {
        matched: false,
        why: 'Exclusive to farmers residing in Andhra Pradesh with registered e-Crop records.',
      };
    }

    if (id === 'rythu-bandhu-ts') {
      if (state === 'Telangana') {
        return {
          matched: true,
          why: `Matched: Resident agricultural landholding in Telangana (${formData.district}) with digital Dharani passbook qualifies for per-acre seasonal investment assistance.`,
        };
      }
      return {
        matched: false,
        why: 'Exclusive to farmers in Telangana with digital Dharani passbooks.',
      };
    }

    if (id === 'micro-irrigation-apmilma') {
      if (state === 'Andhra Pradesh') {
        const subsidyPct = areaHa <= 2 ? '90%' : '70%';
        return {
          matched: true,
          why: `Matched: Andhra Pradesh farmer with ${areaHa} Ha landholding qualifies for up to ${subsidyPct} subsidy on drip or sprinkler equipment under APMIP.`,
        };
      }
      return {
        matched: false,
        why: 'Exclusive to agricultural landholdings in Andhra Pradesh.',
      };
    }

    return {
      matched: true,
      why: `Matched based on general agricultural criteria for ${crop} in ${state}.`,
    };
  };

  // Combine API recommendations with catalog
  const apiSchemes = (
    Array.isArray(apiResult)
      ? apiResult
      : (apiResult as Record<string, unknown>)?.schemes || (apiResult as Record<string, unknown>)?.recommended_schemes
  ) as SchemeItem[] | undefined;

  const baseSchemes = apiSchemes && apiSchemes.length > 0 ? apiSchemes : GOVERNMENT_SCHEMES_CATALOG;

  // Process schemes with matching logic
  const evaluatedSchemes = baseSchemes.map((s: Record<string, any>) => {
    const evalResult = evaluateScheme(s);
    return {
      ...s,
      isMatched: evalResult.matched,
      whyMatched: evalResult.why,
    };
  });

  // When user clicked "Match Eligible Schemes", show ONLY matched schemes
  const eligibleOnlySchemes = hasMatched
    ? evaluatedSchemes.filter((s) => s.isMatched)
    : evaluatedSchemes;

  const displayedSchemes = eligibleOnlySchemes.filter((s: Record<string, any>) => {
    const name = String(s.name || '');
    const benefits = String(s.benefits || s.possible_benefit || '');
    const eligibility = String(s.eligibility || s.description || '');

    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      benefits.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eligibility.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedFilter === 'central') return s.category === 'Central';
    if (selectedFilter === 'state') return s.category === 'State';
    if (selectedFilter === 'solar') return name.toLowerCase().includes('solar') || name.toLowerCase().includes('kusum');
    if (selectedFilter === 'irrigation') return name.toLowerCase().includes('irrigation') || name.toLowerCase().includes('sinchayee');
    return true;
  });

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      <StatutoryAdvisoryTopBanner module="schemes" />

      <PageHeader
        title="Government Schemes & Subsidies"
        subtitle="Explore Central and State agricultural welfare, micro-irrigation subsidies, solar pump grants, and crop insurance."
        badge="Scheme Matching"
      />

      {/* Required Verification Badge / Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0" />
          <p className="text-xs sm:text-sm">
            <strong className="font-semibold text-amber-900">Mandatory Verification:</strong> All matching schemes are categorized as <em>“Possible match — official verification required.”</em> Final approval and disbursement are subject to revenue verification and state department scrutiny.
          </p>
        </div>
      </div>

      {/* Scheme Matching Query Form */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-purple-700" />
            <h2 className="text-sm font-bold text-stone-900">Farmer Eligibility Profiler</h2>
          </div>
          <button
            type="button"
            onClick={() =>
              setFormData({
                state: 'Andhra Pradesh',
                district: 'Visakhapatnam',
                crop: 'Rice',
                area_ha: 1.5,
                growth_stage: 'Vegetative',
                solar_interest: true,
                irrigation_type: 'Borewell',
                climate_risk_level: 'Low',
                farmer_category: 'Small & Marginal (Under 2 Ha)',
              })
            }
            className="text-xs font-semibold text-purple-700 hover:underline"
          >
            Load Sample Profile
          </button>
        </div>

        <form onSubmit={handleRecommend} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                State <span className="text-red-500">*</span>
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
                className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white"
                required
              >
                {STATES_AND_DISTRICTS.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                District <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white"
                required
              >
                {selectedState.districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Crop</label>
              <select
                value={formData.crop || ''}
                onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white"
              >
                {COMMON_CROPS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <AreaInputField
                label="Landholding Area"
                areaHa={formData.area_ha || 2}
                onChange={(newHa) => setFormData({ ...formData, area_ha: newHa })}
                helperText="Enter in Acres or Hectares. Automatically evaluates eligibility tier."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Farmer Category</label>
              <select
                value={formData.farmer_category || 'Small & Marginal (Under 2 Ha)'}
                onChange={(e) => setFormData({ ...formData, farmer_category: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Small & Marginal (Under 2 Ha)">Small & Marginal (Under 2 Ha)</option>
                <option value="Medium Farmer (2 to 10 Ha)">Medium Farmer (2 to 10 Ha)</option>
                <option value="Large Farmer (Above 10 Ha)">Large Farmer (Above 10 Ha)</option>
                <option value="Tenant Farmer (CCRC Card)">Tenant Farmer (CCRC Card)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Irrigation Source</label>
              <select
                value={formData.irrigation_type || 'Borewell'}
                onChange={(e) => setFormData({ ...formData, irrigation_type: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Borewell">Borewell</option>
                <option value="Canal">Canal / River</option>
                <option value="Open Well">Open Well</option>
                <option value="Rainfed">Rainfed Only</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 text-white font-semibold text-xs hover:bg-purple-800 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Matching Government Schemes...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Match Eligible Schemes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {loading && (
        <LoadingState
          message="Scanning Central & State Agriculture Scheme Eligibility Rules..."
          showColdStartHint={true}
        />
      )}

      {error && !loading && (
        <ErrorState
          error={error}
          endpoint="/api/v1/schemes/recommend"
          onRetry={() => handleRecommend({ preventDefault: () => {} } as React.FormEvent)}
        />
      )}

      {/* Matched State Banner */}
      {hasMatched && (
        <div className="p-4 rounded-2xl bg-purple-50/90 border border-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-sm text-purple-950 block">
                Showing Only Matched Schemes ({displayedSchemes.length} Found)
              </span>
              <p className="text-xs text-purple-900 mt-0.5 leading-relaxed">
                Filtered strictly for your profile: <strong>{formData.area_ha} Ha</strong> in{' '}
                <strong>{formData.district}, {formData.state}</strong> cultivating{' '}
                <strong>{formData.crop}</strong> ({formData.irrigation_type} irrigation).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHasMatched(false)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-purple-300 text-purple-800 hover:bg-purple-100 transition-colors shrink-0 cursor-pointer"
          >
            Show All Catalog Schemes
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'central', 'state', 'solar', 'irrigation'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setSelectedFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors cursor-pointer ${
                selectedFilter === filter
                  ? 'bg-[#14532D] text-white'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {filter === 'all' ? (hasMatched ? `Matched (${displayedSchemes.length})` : 'All Schemes') : filter}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search schemes, subsidies, or benefits..."
            className="text-xs pl-9 pr-3 py-2 rounded-xl border border-stone-300 bg-white w-full sm:w-64"
          />
        </div>
      </div>

      {/* Scheme Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayedSchemes.map((scheme: Record<string, any>, idx: number) => {
          const schemeId = String(scheme.id || `scheme-${idx}`);
          const name = String(scheme.name || 'Government Scheme');
          const body = String(scheme.sponsoring_body || 'Agriculture Department');
          const cat = String(scheme.category || 'Welfare');
          const benefit = String(scheme.benefits || scheme.possible_benefit || 'Financial/Subsidized equipment support.');
          const eligibility = String(scheme.eligibility || scheme.description || 'Eligible farmers subject to state verification.');
          const portalUrl = String(scheme.official_portal_url || scheme.portal_url || 'https://agricoop.nic.in');
          const helpline = scheme.helpline ? String(scheme.helpline) : null;
          const whyMatched = scheme.whyMatched as string | undefined;
          const docs: string[] | undefined = Array.isArray(scheme.required_documents)
            ? scheme.required_documents
            : Array.isArray(scheme.key_documents_typically_required)
            ? scheme.key_documents_typically_required
            : undefined;

          return (
            <div
              key={schemeId}
              className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-purple-300 transition-colors"
            >
              <div className="space-y-2.5">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                      {body} • {cat}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-bold max-w-full">
                      <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                      <span>Possible match — official verification required</span>
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-stone-900 leading-snug">{name}</h3>
                </div>

                {/* Why this scheme matched your farm */}
                {whyMatched && (
                  <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200/90 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Why this scheme matched your farm:</span>
                    </div>
                    <p className="text-[11px] text-emerald-950 leading-relaxed font-medium">
                      {whyMatched}
                    </p>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 text-xs">
                  <strong className="text-purple-950 font-bold block mb-0.5">Key Benefit:</strong>
                  <p className="text-purple-900 leading-relaxed">{benefit}</p>
                </div>

                <div className="text-xs space-y-1 text-stone-600">
                  <p>
                    <strong className="text-stone-800">Eligibility:</strong> {eligibility}
                  </p>
                  {docs && docs.length > 0 && (
                    <p>
                      <strong className="text-stone-800">Documents:</strong>{' '}
                      {docs.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-stone-500 text-[11px]">
                  {helpline && (
                    <span className="flex items-center gap-1 font-medium">
                      <Phone className="w-3 h-3 text-[#14532D]" /> {helpline}
                    </span>
                  )}
                </div>

                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#14532D] text-white hover:bg-[#14532D]/90 transition-colors"
                >
                  <span>Official Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Contextual Farmer Feedback for Government Schemes */}
      <FeedbackPrompt
        advisoryId={null}
        module="schemes"
        crop={formData.crop}
        district={`${formData.district}, ${formData.state}`}
      />
    </div>
  );
}

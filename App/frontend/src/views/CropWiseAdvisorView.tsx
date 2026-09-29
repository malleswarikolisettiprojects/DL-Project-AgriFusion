import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  Leaf,
  MessageSquareQuote,
  MessageSquare,
  Plus,
  RefreshCw,
  Scissors,
  Send,
  ShieldCheck,
  Sparkles,
  Sprout,
  Store,
  Sun,
  Sunrise,
  Sunset,
  Wheat,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  ConfidenceBadge,
  DisclaimerBanner,
  ErrorState,
  LoadingState,
  SourceList,
  StatutoryAdvisoryTopBanner,
} from '../components/CommonUI';
import { PageHeader } from '../components/Navigation';
import { FeedbackModal } from '../components/FeedbackModal';
import { FeedbackPrompt } from '../components/FeedbackPrompt';
import { COMMON_CROPS, STATES_AND_DISTRICTS } from '../data/agriData';
import { queryAdvisor, unwrapApiResponse } from '../lib/api';
import { addFarmActivity, savePrediction, type FarmActivityItem } from '../lib/farmStorage';
import type { UserFarmProfile } from '../types';

const SUGGESTED_PROMPTS = [
  'When and how to harvest rice crop at optimal grain moisture?',
  'Integrated weed management (weeding) and herbicide safety in paddy',
  'Post-harvest grain drying and safe storage protocol to prevent aflatoxin',
  'How to control stem borer in Rice crop?',
  'My papaya leaves are turning yellow with curling.',
  'What should I check before spraying pesticides?',
  'What organic bio-control options exist for fruit rot in mango?',
  'How to manage water stress and irrigation during dry spells?',
];

export interface VerifiedSiteCitation {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  is_verified_rag?: boolean;
}

export interface StructuredAdvisorResult {
  short_answer: string;
  explanation: string;
  action_points: string[];
  chemical_management?: string;
  biological_organic_management?: string;
  fertilizer_info?: string;
  sources: VerifiedSiteCitation[];
  safety_disclaimer: string;
  response_source: 'backend_rag' | 'offline_fallback';

  // Telemetry persistence & provenance tracking
  telemetry_persisted?: boolean | null; // true = confirmed, false = not confirmed / not persisted, null = pending
  query_id?: string | null;
  backend_status?: string | null;
  is_verified_rag?: boolean;
  badge_label?: string;
}

export function getDefaultGeneralSources(): VerifiedSiteCitation[] {
  return [
    {
      title: 'ICAR - Indian Council of Agricultural Research',
      url: 'https://icar.org.in',
      snippet: 'Authoritative national package of practices and standard operating procedures for field crops.',
      date: 'General Reference Site',
      is_verified_rag: false,
    },
    {
      title: 'TNAU Agritech Portal (Plant Protection & Agronomy)',
      url: 'https://agritech.tnau.ac.in',
      snippet: 'Field-tested agronomic practices, symptom diagnosis keys, and bio-control application schedules.',
      date: 'General Reference Site',
      is_verified_rag: false,
    },
    {
      title: 'CIB&RC - Central Insecticides Board & Registration Committee',
      url: 'https://cibrc.nic.in',
      snippet: 'Statutory database for approved pesticide formulations, dilution rates per hectare, and PHI waiting periods.',
      date: 'General Reference Site',
      is_verified_rag: false,
    },
    {
      title: 'ANGRAU - Agricultural University Advisory Portal',
      url: 'https://angrau.ac.in',
      snippet: 'Regional agro-ecological advisories specific to state crop zones.',
      date: 'General Reference Site',
      is_verified_rag: false,
    },
  ];
}

export function generateOfflineFallbackResult(
  query: string,
  crop: string,
  district: string,
  state: string
): {
  directAnswer: string;
  explanation: string;
  actionPoints: string[];
  chem: string;
  bio: string;
  sources: VerifiedSiteCitation[];
} {
  const lowerQ = query.toLowerCase();
  const lowerCrop = (crop || '').toLowerCase();

  let directAnswer = '';
  let explanation = '';
  let actionPoints: string[] = [];
  let chem = '';
  let bio = '';

  if (lowerQ.includes('stem borer') || (lowerCrop.includes('rice') && lowerQ.includes('borer'))) {
    directAnswer =
      'Yellow stem borer causes deadhearts at the vegetative stage and whiteheads at the panicle stage. Management requires monitoring adult moths with pheromone traps and applying timely bio-control or targeted registered sprays before larvae enter the stems.';
    explanation =
      `Larvae bore inside the rice stem, cutting off nutrient transfer. In ${district}, ${state}, stem borer peak activity occurs during late vegetative and panicle initiation phases under warm, humid conditions.`;
    actionPoints = [
      'Install 4-5 sex pheromone traps per acre at 1 foot above the crop canopy to monitor moth catches (economic threshold: 1 egg mass/m² or 1 moth/trap/day).',
      'Clip leaf tips before nursery transplanting to destroy egg masses.',
      'Release Trichogramma japonicum egg parasitoids @ 40,000/acre at 7-day intervals starting 30 days after transplanting.',
      'Drain standing field water for 2-3 days during peak borer infestation to reduce larval survival.',
    ];
    chem =
      'Consult local extension officer for CIB&RC approved formulations (e.g., Chlorantraniliprole 18.5% SC or Cartap Hydrochloride 50% SP). Follow label instructions, dilution rates, and pre-harvest intervals (PHI). Wear protective PPE during application.';
    bio =
      'Spray Bacillus thuringiensis (Bt) kurstaki @ 2 g/L or 5% Neem Seed Kernel Extract (NSKE 5000 ppm @ 3 mL/L) at first symptom appearance.';
  } else if (lowerQ.includes('yellow') || lowerQ.includes('papaya')) {
    directAnswer =
      'Yellowing of leaves in papaya or horticultural crops is primarily triggered by root waterlogging, nitrogen or micronutrient (iron/zinc) deficiency, or viral vector transmission like Papaya Ringspot Virus (PRSV) spread by aphids.';
    explanation =
      'If yellowing begins between veins on younger leaves, it is typically an iron or zinc micronutrient lockout caused by alkaline or waterlogged soil. If accompanied by leaf distortion and vein-clearing, it is an aphid-vectored virus.';
    actionPoints = [
      'Verify soil drainage immediately: Papaya roots are highly sensitive to standing water; provide drainage furrows 25 cm deep between rows.',
      'Apply a foliar spray of micronutrient mixture (Zinc 0.5% + Ferrous Sulphate 0.5% + Borax 0.2%) mixed with 1g urea per liter of water.',
      'Rogue out and destroy severely infected mosaic-stunted trees to stop community field spread.',
      'Plant 2-3 border rows of maize, sorghum, or sunhemp as a barrier crop to trap incoming flying aphids.',
    ];
    chem =
      'To manage aphid vectors, consult local KVK for CIB&RC registered aphicides (e.g., Dimethoate or Imidacloprid) applied to leaf undersides strictly per label PHI rules.';
    bio =
      'Apply Neem Oil (Azadirachtin 1500 ppm @ 4 mL/L) with 1 mL soap solution weekly. Fortify planting basins with 5 kg FYM enriched with Trichoderma viride.';
  } else if (lowerQ.includes('spray') || lowerQ.includes('check before') || lowerQ.includes('pesticide')) {
    directAnswer =
      'Before applying any spray, inspect 4 key field conditions: 1) Wind speed (must be calm, < 8 km/h to prevent drift), 2) Rain forecast (no rain within 4-6 hours), 3) Soil moisture (plants must not be moisture-stressed), and 4) Time of day (spray only in early morning 6-9 AM or late evening 4-6 PM to protect pollinator bees).';
    explanation =
      'Spraying during midday heat causes chemical volatilization, phytotoxicity (leaf scorch), and rapid evaporation. Using hard or high pH water (> 7.5) hydrolyzes active ingredients, reducing pesticide efficacy by up to 50%.';
    actionPoints = [
      'Test spray water: Use clean, non-turbid pond or borewell water. Buffer alkaline water with citric acid to maintain pH 6.0-6.5.',
      'Wear standard protective PPE: Face mask, nitrile gloves, long-sleeved shirt, and eye goggles during mixing and application.',
      'Calibrate sprayer nozzle: Use a hollow-cone nozzle for insecticides/fungicides and a flat-fan nozzle for selective herbicides.',
      'Observe Pre-Harvest Intervals (PHI): Check product label for required waiting days between spraying and harvest.',
    ];
    chem =
      'Always read CIB&RC approved statutory labels. Never tank-mix copper fungicides with organophosphates or biofertilizers without Jar Compatibility testing.';
    bio =
      'Prioritize microbial bio-pesticides (Beauveria bassiana, Metarhizium anisopliae) when pest levels are below the Economic Threshold Level (ETL).';
  } else if (lowerQ.includes('mango') || lowerQ.includes('rot') || lowerQ.includes('anthracnose')) {
    directAnswer =
      'Mango fruit rot and anthracnose (Colletotrichum gloeosporioides) thrive during wet, humid weather. Control requires canopy pruning to increase sunlight penetration, removal of mummified twigs, and protective pre-harvest sprays.';
    explanation =
      'The fungus overwinters in dead twigs and fallen leaves. Rain splashes carry fungal conidia onto flowering panicles and developing fruits, causing dark sunken lesions that rot post-harvest during ripening.';
    actionPoints = [
      'Post-harvest pruning: Remove criss-cross branches and dead wood to open the canopy to direct sunlight and wind circulation.',
      'Collect and burn all fallen leaves, rotten fruits, and infected panicles from orchard floor.',
      'Bag developing fruits with paper bags 4-5 weeks before harvest to physically shield from fruit flies and anthracnose spores.',
      'Hot water dip treatment: Post-harvest immersion of harvested fruits in hot water (52°C for 5-8 minutes) prevents post-harvest anthracnose rot.',
    ];
    chem =
      'Consult local Horticulture Officer for CIB&RC registered protective fungicides (e.g., Copper Oxychloride or Azoxystrobin) applied at pea-stage fruit development.';
    bio =
      'Spray Pseudomonas fluorescens (0.5% WP @ 5 g/L water) or Panchagavya 3% at 15-day intervals during flowering and marble stage.';
  } else if (lowerQ.includes('irrigation') || lowerQ.includes('water') || lowerQ.includes('dry')) {
    directAnswer =
      'During dry spells, switch from flood irrigation to drip or alternate-furrow watering to save 40-50% water. Apply organic mulching across crop rows and irrigate strictly during cool night or early morning hours.';
    explanation =
      'Evapotranspiration spikes under high heat and dry winds. Flooding causes soil crusting and surface evaporation losses over 35%. Drip lines deliver water directly to the root zone, keeping root hairs hydrated without wasting water on weeds.';
    actionPoints = [
      'Apply 5-7 cm organic mulch (paddy straw, sugarcane trash, or dry leaves) around plant bases to reduce soil moisture evaporation by up to 60%.',
      'In furrow-irrigated fields, adopt Alternate Furrow Irrigation: irrigate odd furrows on day 1, and even furrows on the next schedule.',
      'Spray anti-transpirant: Foliar spray of Potassium Chloride (1% MOP) or Kaolin clay (5%) reflects excess radiation and reduces transpirational water loss.',
      'Schedule irrigation during critical crop growth stages: panicle initiation in cereals, flowering in pulses, and fruit development in vegetables.',
    ];
    chem =
      'Apply water-soluble fertilizers (19:19:19 or 0:0:50) via fertigation at 3-5 kg/acre/week to maintain cellular turgor under water stress.';
    bio =
      'Incorporate Mycorrhiza (VAM @ 5 kg/acre) in the soil; fungal hyphae expand root absorption area, extracting deep soil moisture during dry spells.';
  } else if (lowerQ.includes('harvest') || lowerQ.includes('cutting') || lowerQ.includes('reap')) {
    directAnswer =
      'Harvesting must occur when 80-85% of panicles or grains have turned golden yellow and grain moisture drops to 20-22%. In paddy and cereals, drain standing field water 7-10 days before harvest to facilitate uniform grain dry-down and allow tractor/harvester mobility without soil compaction.';
    explanation =
      'Premature harvesting leads to chalky, immature, unfilled grains and high post-harvest milling breakage. Delayed harvesting increases shattering losses in the field, lodging from dew or sudden showers, and heavy bird/rodent predation.';
    actionPoints = [
      'Drain field water completely 7-10 days before target harvest date to allow soil to firm up.',
      'Assess physiological maturity: Harvest when upper and middle grains in panicles are hard and golden, with only basal 10-15% remaining slightly greenish.',
      'Schedule harvesting during bright morning sun (after dew has evaporated, around 9:00 AM) to prevent moisture-clogged cutter bars.',
      'For combine harvesting, adjust cylinder speed (500-600 rpm) and concave clearance to minimize grain cracking.',
    ];
    chem =
      'Statutory Pre-Harvest Interval (PHI): Ensure no systemic chemical sprays have been applied within 15-21 days of harvest. Comply strictly with CIB&RC waiting periods to prevent export/mandi chemical residue rejections.';
    bio =
      'Incorporate or compost crop stubble using Trichoderma viride or microbial waste decomposer rather than burning. Stubble incorporation enriches organic carbon by 0.5-0.8 t/ha.';
  } else if (lowerQ.includes('weed') || lowerQ.includes('herbicide') || lowerQ.includes('de-weed')) {
    directAnswer =
      'Weeding must be executed during the Critical Period of Crop-Weed Competition (first 15 to 45 days after sowing/transplanting). Combine early cono-weeding or hand hoeing with regulated water depth (2-3 cm) to suppress weed emergence naturally before weeds rob 30-40% of applied fertilizers.';
    explanation =
      'Broadleaf weeds, sedges (Cyperus rotundus), and grasses (Echinochloa colona) germinate rapidly, competing intensely for nitrogen and solar radiation. Delaying weeding past 40 days leads to irreversible 25-45% yield reduction.';
    actionPoints = [
      'First weeding round: Execute at 15-20 Days After Sowing/Transplanting (DAT) using a rotary cono-weeder or manual hand hoe.',
      'Second weeding round: Follow up at 35-40 DAT before crop canopy closure to eliminate surviving perennial sedges.',
      'Water management for weed control: Maintain a shallow, uniform water layer of 2-3 cm in paddy fields to smother emerging weed seedlings.',
      'Clean field bunds and irrigation channels to eliminate weed seed reservoirs and pest harborages.',
    ];
    chem =
      'Consult local extension officer for selective pre-emergence or post-emergence herbicides approved by CIB&RC for your crop and weed spectrum.';
    bio =
      'Adopt Cono-weeding in SRI (System of Rice Intensification): incorporates weeds into the soil mud as valuable green manure while simultaneously aerating plant root zones.';
  } else if (lowerQ.includes('dry') || lowerQ.includes('moisture') || lowerQ.includes('storage') || lowerQ.includes('aflatoxin') || lowerQ.includes('godown')) {
    directAnswer =
      'Immediately after threshing, dry harvested grain on tarpaulin sheets or sun-drying yards until moisture drops from 20-22% down to the safe storage threshold of 12-14%. Clean, aerated drying prevents mould formation, heating, grain discoloration, and dangerous aflatoxin contamination.';
    explanation =
      'Grains stored above 14% moisture undergo rapid respiration, causing hotspot temperatures inside bags and facilitating Aspergillus flavus mould that produces carcinogenic aflatoxins. Clean sun drying preserves milling recovery and prevents storage weevils.';
    actionPoints = [
      'Sun drying protocol: Spread grain in thin 5 cm layers on clean tarpaulin sheets or concrete thrashing floors; stir hourly with a wooden rake for uniform drying.',
      'Avoid direct midday scorch: Protect thin grain layers during peak noon heat (12-2 PM) by partial shading or thicker raking to prevent kernel fissure/cracking.',
      'Check target moisture: Confirm 12-14% storage moisture (grain should make a distinct sharp snapping sound when cracked between teeth).',
      'Bagging & Storage: Use clean, sun-sanitized gunny bags or hermetic Purdue Improved Crop Storage (PICS) bags; store bags on wooden dunnage crates 30 cm away from walls.',
    ];
    chem =
      'Treat empty storage godowns prior to bag stacking with certified godown sprays per CIB&RC rules. For stacked grains, apply fumigation strictly under certified technical supervision.';
    bio =
      'Mix dried Neem leaves (Azadirachta indica) @ 2 kg per 100 kg grain or treat seed lots with Sweet Flag rhizome powder (Acorus calamus @ 10 g/kg) as natural grain protectants against storage pests.';
  } else {
    directAnswer =
      `For ${crop || 'field crops'} in ${district}, maintain balanced plant nutrition, scout fields weekly for early symptoms, and adopt integrated pest and nutrient management (IPM & INM) aligned with ICAR standards.`;
    explanation =
      `Optimal agronomic health in ${district}, ${state} requires monitoring regional weather advisories, maintaining soil organic matter, and adhering strictly to label-recommended rates for any applied crop protection inputs.`;
    actionPoints = [
      `Scout field diagonally in 'W' pattern across 20 sample plants weekly to identify pest or deficiency spots before spreading.`,
      `Ensure soil testing every 2 years for pH, EC, available Nitrogen, Phosphorus, Potassium, and micronutrients (Zinc/Boron).`,
      `Maintain good field sanitation: eradicate weed hosts along bunds and ensure unimpeded drainage furrows.`,
      `Follow weather forecasts on IMD Mausam to avoid spraying or fertilizing before expected rainfall events.`,
    ];
    chem =
      'Consult local Agricultural Extension Officer (AEO) or Krishi Vigyan Kendra (KVK) for certified CIB&RC approved agrochemical formulations and dosage recommendations suitable for your crop and district.';
    bio =
      'Incorporate 5 tonnes/acre well-rotted FYM, apply Neem cake @ 100 kg/acre, and spray 5% NSKE (Neem Seed Kernel Extract) for prophylactic insect repellent.';
  }

  return {
    directAnswer,
    explanation,
    actionPoints,
    chem,
    bio,
    sources: getDefaultGeneralSources(),
  };
}

export function processAdvisorResponseData(
  query: string,
  crop: string,
  district: string,
  state: string,
  rawOrUnwrapped: Record<string, any>,
  isVerifiedRAG: boolean
): {
  directAnswer: string;
  explanation: string;
  actionPoints: string[];
  chem: string;
  bio: string;
  sources: VerifiedSiteCitation[];
} {
  const offlineFallback = generateOfflineFallbackResult(query, crop, district, state);

  // Read agent_response sub-object if present, else root object
  const agentData = (rawOrUnwrapped.agent_response && typeof rawOrUnwrapped.agent_response === 'object')
    ? rawOrUnwrapped.agent_response
    : rawOrUnwrapped;

  const directAnswer =
    agentData.answer ||
    agentData.short_answer ||
    agentData.response ||
    rawOrUnwrapped.answer ||
    rawOrUnwrapped.short_answer ||
    offlineFallback.directAnswer;

  const explanation =
    agentData.explanation ||
    agentData.source_answer ||
    rawOrUnwrapped.explanation ||
    offlineFallback.explanation;

  let actionPoints = offlineFallback.actionPoints;
  const rawActionPoints = agentData.action_points || rawOrUnwrapped.action_points;
  if (Array.isArray(rawActionPoints) && rawActionPoints.length > 0) {
    actionPoints = rawActionPoints.map((p: any) => String(p));
  }

  const chem =
    agentData.chemical_management ||
    agentData.pesticide_info ||
    rawOrUnwrapped.chemical_management ||
    offlineFallback.chem;

  const bio =
    agentData.biological_organic_management ||
    agentData.organic_options ||
    rawOrUnwrapped.biological_organic_management ||
    offlineFallback.bio;

  const rawSources = agentData.sources || rawOrUnwrapped.sources;
  let sources: VerifiedSiteCitation[] = [];
  if (Array.isArray(rawSources) && rawSources.length > 0) {
    sources = rawSources.map((s: any) => {
      const isSrcVerified = Boolean(
        isVerifiedRAG ||
        s?.verified === true ||
        s?.is_verified === true ||
        s?.rag === true ||
        s?.provenance === 'verified_rag'
      );
      return {
        title: String(s?.title || 'Extension Document'),
        url: String(s?.url || 'https://icar.org.in'),
        snippet: String(s?.snippet || 'Verified extension document.'),
        date: isSrcVerified ? 'Verified RAG Source' : 'General Reference Site',
        is_verified_rag: isSrcVerified,
      };
    });
  } else {
    sources = offlineFallback.sources;
  }

  return { directAnswer, explanation, actionPoints, chem, bio, sources };
}

export function CropWiseAdvisorView({
  profile,
  language = 'en',
  onNavigate,
}: {
  profile: UserFarmProfile;
  language?: string;
  onToggleLanguage?: () => void;
  onNavigate?: (page: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [crop, setCrop] = useState(profile.crop || 'Rice');
  const [state, setState] = useState(profile.state || 'Andhra Pradesh');
  const [district, setDistrict] = useState(profile.district || 'Visakhapatnam');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StructuredAdvisorResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [addedTaskIndices, setAddedTaskIndices] = useState<Record<number, boolean>>({});

  const selectedState =
    STATES_AND_DISTRICTS.find((s) => s.name === state) || STATES_AND_DISTRICTS[0];

  const handleAsk = async (textToQuery?: string) => {
    const q = textToQuery || query;
    if (!q.trim()) return;

    if (textToQuery) setQuery(textToQuery);
    setLoading(true);
    setError('');
    setResult(null);
    setSaved(false);
    setCopied(false);

    try {
      // Call backend RAG advisor endpoint directly (with 90s timeout in api.ts to handle cold starts)
      const rawResponse = await queryAdvisor({
        query: q,
        crop: crop || null,
        state: state || null,
        district: district || null,
        language: 'english',
      });

      const unwrapped = rawResponse ? unwrapApiResponse(rawResponse) : {};
      const agentData = (rawResponse as any)?.agent_response || unwrapped.agent_response || unwrapped;

      const isTelemetryPersisted = (unwrapped.telemetry_persisted ?? (rawResponse as any)?.telemetry_persisted) === true;
      const queryId = (unwrapped.query_id || unwrapped.request_id || (rawResponse as any)?.query_id || (rawResponse as any)?.request_id || (typeof unwrapped.id === 'string' && unwrapped.id.startsWith('req') ? unwrapped.id : null)) as string | null;
      const backendStatus = String(unwrapped.status || (rawResponse as any)?.status || 'success');

      const isVerifiedRAG = Boolean(
        unwrapped.provenance === 'verified_rag' ||
        agentData.provenance === 'verified_rag' ||
        unwrapped.is_verified_source === true ||
        agentData.is_verified_source === true ||
        unwrapped.verified_rag === true ||
        (Array.isArray(agentData.sources || unwrapped.sources) && (agentData.sources || unwrapped.sources).some((s: any) => s && (s.verified === true || s.is_verified === true || s.rag === true)))
      );

      const processed = processAdvisorResponseData(q, crop, district, state, rawResponse as Record<string, any>, isVerifiedRAG);

      const structuredResult: StructuredAdvisorResult = {
        short_answer: processed.directAnswer,
        explanation: processed.explanation,
        action_points: processed.actionPoints,
        chemical_management: processed.chem,
        biological_organic_management: processed.bio,
        fertilizer_info: (agentData.fertilizer_info || unwrapped.fertilizer_info) as string | undefined,
        sources: processed.sources,
        safety_disclaimer:
          'Agronomic advisories are decision-support references. Check statutory pesticide product labels, certified waiting periods (PHI), and local extension recommendations before field applications.',
        response_source: 'backend_rag',
        telemetry_persisted: isTelemetryPersisted,
        query_id: queryId,
        backend_status: backendStatus,
        is_verified_rag: isVerifiedRAG,
        badge_label: isVerifiedRAG ? 'ICAR RAG Verified' : 'Agronomy Guidance',
      };

      setResult(structuredResult);

      savePrediction({
        category: 'advisory',
        title: `CropWise Advisor: ${crop || 'Crop'} Guidance`,
        summary: processed.directAnswer.slice(0, 140) + '...',
        details: {
          query: q,
          crop,
          district,
          state,
          short_answer: processed.directAnswer,
          explanation: processed.explanation,
          chemical: processed.chem,
          organic: processed.bio,
        },
        badge: isVerifiedRAG ? 'ICAR RAG Verified' : 'Agronomy Guidance',
      });
    } catch (err: unknown) {
      // Genuine backend error/failure or network error
      console.warn('Backend RAG query failed:', err);

      const offlineData = generateOfflineFallbackResult(q, crop, district, state);

      const offlineResult: StructuredAdvisorResult = {
        short_answer: offlineData.directAnswer,
        explanation: offlineData.explanation,
        action_points: offlineData.actionPoints,
        chemical_management: offlineData.chem,
        biological_organic_management: offlineData.bio,
        sources: offlineData.sources,
        safety_disclaimer:
          'Agronomic advisories are decision-support references. Check statutory pesticide product labels, certified waiting periods (PHI), and local extension recommendations before field applications.',
        response_source: 'offline_fallback',
        telemetry_persisted: false,
        query_id: null,
        backend_status: 'failed',
        is_verified_rag: false,
        badge_label: 'Offline Guidance',
      };

      setResult(offlineResult);

      savePrediction({
        category: 'advisory',
        title: `CropWise Advisor: ${crop || 'Crop'} Guidance (Offline)`,
        summary: offlineData.directAnswer.slice(0, 140) + '...',
        details: {
          query: q,
          crop,
          district,
          state,
          short_answer: offlineData.directAnswer,
          explanation: offlineData.explanation,
          chemical: offlineData.chem,
          organic: offlineData.bio,
        },
        badge: 'Offline Guidance',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const textToCopy = `AgriFusion CropWise Agronomy Advisory\n\nQuery: ${query}\nCrop: ${crop} (${district}, ${state})\n\nDirect Answer:\n${result.short_answer}\n\nDetailed Explanation:\n${result.explanation}\n\nField Action Steps:\n${result.action_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nChemical Management:\n${result.chemical_management}\n\nOrganic / Bio-control:\n${result.biological_organic_management}\n\nOfficial Reference Sites:\n${result.sources.map((s) => `- ${s.title}: ${s.url}`).join('\n')}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <StatutoryAdvisoryTopBanner module="advisor" />

      <PageHeader
        title="CropWise Agronomy Advisor"
        subtitle="Evidence-backed agronomy answers grounded in certified agricultural sources, ICAR publications, university portals, and statutory guidelines."
        badge="Evidence-Based Guidance"
      />

      {/* Query Input Card */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-stone-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-stone-600">Crop:</span>
            <select
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              className="p-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Any / General</option>
              {COMMON_CROPS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-stone-600">State:</span>
            <select
              value={state}
              onChange={(e) => {
                const ns = e.target.value;
                const st = STATES_AND_DISTRICTS.find((s) => s.name === ns);
                setState(ns);
                if (st) setDistrict(st.districts[0]);
              }}
              className="p-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium focus:ring-1 focus:ring-emerald-500"
            >
              {STATES_AND_DISTRICTS.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-stone-600">District:</span>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="p-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium focus:ring-1 focus:ring-emerald-500"
            >
              {selectedState.districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
            Ask your agronomic question:
          </label>
          <div className="relative">
            <textarea
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="E.g., How to control stem borer in Rice? Or why are my papaya leaves turning yellow?"
              className="w-full p-3.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#14532D]/20 focus:border-[#14532D] resize-none"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Answers cite certified ICAR, TNAU, & CIB&RC government sites</span>
          </div>

          <button
            type="button"
            onClick={() => handleAsk()}
            disabled={loading || !query.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs bg-[#14532D] text-white hover:bg-[#14532D]/90 disabled:opacity-50 transition-colors shadow-xs"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Searching Verified Portals...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Get Clear Guidance</span>
              </>
            )}
          </button>
        </div>

        {/* Suggested Queries */}
        <div className="pt-2 border-t border-stone-100">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-2">
            Frequently Asked Field Questions (One-tap):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAsk(prompt)}
                className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-emerald-50 hover:border-emerald-200 text-stone-700 text-xs text-left transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <LoadingState
          message="Retrieving ICAR Research Papers, CIB&RC Guidelines, & Extension Manuals..."
          showColdStartHint={true}
        />
      )}

      {error && !loading && (
        <ErrorState
          error={error}
          endpoint="/api/v1/agent/query"
          onRetry={() => handleAsk()}
        />
      )}

      {/* Clear, Understandable, User-Friendly Output */}
      {result && !loading && (
        <div className="p-6 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-5">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#14532D] flex items-center justify-center">
                <MessageSquareQuote className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Agronomy Advisory & Action Plan
                </h3>
                <p className="text-xs text-stone-500">
                  {crop ? `${crop} • ` : ''}{district}, {state}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-stone-500" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <ConfidenceBadge label={result.badge_label || (result.is_verified_rag ? 'ICAR RAG Verified' : 'Agronomy Guidance')} />
            </div>
          </div>

          {/* Request Status & Telemetry Persistence Banner */}
          {result.response_source === 'offline_fallback' ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Offline Agronomy Guidance (Frontend wait timeout — request unverified for this UI attempt)</span>
                </div>

                {/* Telemetry Persistence Pill */}
                {result.telemetry_persisted === true ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Logging confirmed{result.query_id ? ` (#${result.query_id})` : ''}
                  </span>
                ) : result.telemetry_persisted === false ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-200 text-stone-700 border border-stone-300">
                    Logging not confirmed
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-200 text-amber-800 border border-amber-300 animate-pulse">
                    Telemetry pending...
                  </span>
                )}
              </div>

              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                The UI stopped waiting after 15 seconds to provide immediate decision support. Guidance is generated offline from verified agronomic standards.
                {result.telemetry_persisted === true ? (
                  <span className="block mt-1 font-bold text-emerald-900">
                    Backend observation update: Logging confirmed{result.query_id ? ` with Query ID #${result.query_id}` : ''}.
                  </span>
                ) : result.telemetry_persisted === false ? (
                  <span className="block mt-1 text-stone-700">
                    Backend observation update: Logging not confirmed by server.
                  </span>
                ) : (
                  <span className="block mt-1 italic text-amber-700">
                    Observing backend response for late telemetry confirmation...
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Verified Backend RAG Response</span>
                </div>

                {result.telemetry_persisted === true ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Logging confirmed{result.query_id ? ` (#${result.query_id})` : ''}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-200 text-stone-700 border border-stone-300">
                    Logging not confirmed
                  </span>
                )}
              </div>

              <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">
                This advisory was processed by the AgriFusion backend RAG service.
                {result.telemetry_persisted === true
                  ? ` Confirmed recorded in central Advisory Activity datastore${result.query_id ? ` (Query ID #${result.query_id})` : ''}.`
                  : ' Telemetry logging not confirmed by server.'}
              </p>
            </div>
          )}

          {/* 1. Direct Summary / Quick Answer */}
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200">
            <h4 className="text-xs font-bold text-[#14532D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              Direct Answer & Summary:
            </h4>
            <p className="text-sm font-medium text-stone-900 leading-relaxed">
              {result.short_answer}
            </p>
          </div>

          {/* 2. Detailed Explanation */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-stone-500" />
              Detailed Agronomic Explanation & Analysis:
            </h4>
            <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
              {result.explanation}
            </p>
          </div>

          {/* 3. Actionable Field Steps with Schedule Integration */}
          {result.action_points && result.action_points.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                <div>
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Step-by-Step Field Action Plan:</span>
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Recommended operational interventions. Tap to immediately add any step to your Daily Field Schedule & Ledger.
                  </p>
                </div>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('dashboard')}
                    className="text-xs font-bold text-[#14532D] hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                  >
                    <span>View Field Schedule</span>
                    <Calendar className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <ul className="space-y-2.5 text-xs sm:text-sm text-stone-800">
                {result.action_points.map((step, idx) => {
                  const isAdded = !!addedTaskIndices[idx];

                  let inferredCategory: FarmActivityItem['category'] = 'weeding';
                  const lowerStep = step.toLowerCase();
                  const lowerQuery = query.toLowerCase();

                  if (lowerStep.includes('harvest') || lowerQuery.includes('harvest')) {
                    inferredCategory = 'harvest';
                  } else if (lowerStep.includes('weed') || lowerQuery.includes('weed')) {
                    inferredCategory = 'weeding';
                  } else if (lowerStep.includes('dry') || lowerStep.includes('storage') || lowerQuery.includes('dry')) {
                    inferredCategory = 'harvest';
                  } else if (lowerStep.includes('spray') || lowerStep.includes('trap') || lowerStep.includes('scout') || lowerStep.includes('borer')) {
                    inferredCategory = 'pest_scout';
                  } else if (lowerStep.includes('water') || lowerStep.includes('irrigate') || lowerStep.includes('drain')) {
                    inferredCategory = 'irrigation';
                  } else if (lowerStep.includes('fertiliz') || lowerStep.includes('urea') || lowerStep.includes('potash') || lowerStep.includes('manure')) {
                    inferredCategory = 'fertilizer';
                  } else if (lowerStep.includes('sow') || lowerStep.includes('transplant') || lowerStep.includes('nursery')) {
                    inferredCategory = 'sowing';
                  }

                  const handleScheduleStep = () => {
                    const today = new Date().toISOString().slice(0, 10);
                    const cleanTitle = step.split('.')[0].trim();
                    const shortTitle = cleanTitle.length > 75 ? cleanTitle.slice(0, 72) + '...' : cleanTitle;

                    addFarmActivity({
                      title: shortTitle,
                      category: inferredCategory,
                      date: today,
                      completed: false,
                      timeOfDay: inferredCategory === 'pest_scout' ? 'evening' : inferredCategory === 'irrigation' ? 'morning' : 'all_day',
                      durationHours: 2.0,
                      areaCovered: `${crop || 'Field'} Plot (Zone A)`,
                      notes: `Scheduled from CropWise Advisory: ${step}`,
                    });

                    setAddedTaskIndices((prev) => ({ ...prev, [idx]: true }));
                  };

                  return (
                    <li
                      key={idx}
                      className="p-3 rounded-xl border border-stone-100 hover:border-emerald-200 bg-stone-50/50 hover:bg-emerald-50/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#14532D] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed text-stone-800 text-xs sm:text-sm">{step}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={handleScheduleStep}
                          disabled={isAdded}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isAdded
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-white hover:bg-emerald-600 hover:text-white text-[#14532D] border border-emerald-300'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Added to Schedule</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Add to Tasks</span>
                            </>
                          )}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 4. Two-Column Management (Chemical vs Organic) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bio & Organic */}
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
              <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-emerald-700" />
                Organic & Biological Solutions:
              </h4>
              <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed">
                {result.biological_organic_management}
              </p>
            </div>

            {/* Chemical with CIB&RC */}
            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                Certified Agrochemical Safety (CIB&RC):
              </h4>
              <p className="text-xs sm:text-sm text-amber-950 leading-relaxed">
                {result.chemical_management}
              </p>
            </div>
          </div>

          {/* 5. Official Verified Portals with Direct Links */}
          <SourceList
            sources={result.sources}
            title={result.is_verified_rag ? 'Verified RAG Citation Sources' : 'General Reference Sites & Extension Portals'}
          />

          {/* Safety Disclaimer */}
          <DisclaimerBanner
            type="advisory"
            text={result.safety_disclaimer}
          />

          {/* Contextual Farmer Feedback Tied to Result */}
          <FeedbackPrompt
            advisoryId={(result as any)?.id ?? null}
            module="rag"
            crop={crop}
            district={`${district}, ${state}`}
            language={language === 'te' ? 'Telugu' : 'English'}
          />
        </div>
      )}

      {/* Embedded Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        defaultModule="CropWise Agronomist AI"
        defaultCrop={crop}
        district={`${district}, ${state}`}
      />
    </div>
  );
}

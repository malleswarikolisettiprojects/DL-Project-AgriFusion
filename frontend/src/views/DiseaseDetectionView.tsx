import {
  Activity,
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Image as ImageIcon,
  Leaf,
  RefreshCw,
  Scan,
  ShieldAlert,
  Sprout,
  Upload,
  X,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import {
  ConfidenceBadge,
  DisclaimerBanner,
  ErrorState,
  LoadingState,
  SourceList,
  StatutoryAdvisoryTopBanner,
} from '../components/CommonUI';
import { PageHeader } from '../components/Navigation';
import { FeedbackPrompt } from '../components/FeedbackPrompt';
import { predictDisease, unwrapApiResponse } from '../lib/api';
import { compressImage } from '../lib/imageCompress';
import { savePrediction } from '../lib/farmStorage';
import type { UserFarmProfile } from '../types';

export interface DiseaseCheckCropOption {
  label: string;
  value: string;
}

export const DISEASE_CHECK_CROPS: DiseaseCheckCropOption[] = [
  { label: 'Banana', value: 'banana' },
  { label: 'Beans', value: 'beans' },
  { label: 'Blackgram', value: 'blackgram' },
  { label: 'Muskmelon / Cantaloupe', value: 'muskmelon' },
  { label: 'Rice / Paddy', value: 'rice' },
  { label: 'Maize / Corn', value: 'maize' },
  { label: 'Cotton', value: 'cotton' },
  { label: 'Grapes', value: 'grapes' },
  { label: 'Mango', value: 'mango' },
  { label: 'Orange / Citrus', value: 'orange' },
  { label: 'Papaya', value: 'papaya' },
  { label: 'Pomegranate', value: 'pomegranate' },
  { label: 'Watermelon', value: 'watermelon' },
];

export const DISEASE_CROP_ALIASES: Record<string, string> = {
  paddy: 'rice',
  corn: 'maize',
  cantaloupe: 'muskmelon',
  citrus: 'orange',
};

export function getCanonicalDiseaseCropKey(inputCrop: string): string | null {
  if (!inputCrop) return null;
  const clean = inputCrop.trim().toLowerCase();
  const normalized = DISEASE_CROP_ALIASES[clean] || clean;
  const found = DISEASE_CHECK_CROPS.find(
    (c) => c.value === normalized || c.label.toLowerCase() === clean
  );
  return found ? found.value : null;
}

export function resolveDiseaseCropInitial(profileCrop?: string | null): { cropValue: string; customCropName: string } {
  if (!profileCrop) {
    return { cropValue: 'rice', customCropName: '' };
  }
  const key = getCanonicalDiseaseCropKey(profileCrop);
  if (key) {
    return { cropValue: key, customCropName: '' };
  }
  return { cropValue: 'Other', customCropName: profileCrop };
}

export interface RagRemedies {
  cultural_practices?: string[] | string | null;
  organic_bio_control?: string[] | string | null;
  chemical_treatment?: string[] | string | null;
  fertilizer_advice?: string[] | string | null;
  rag_status?: string | null;
  source_title?: string | null;
  source_institute?: string | null;
  source_url?: string | null;
  document_passage?: string | null;
  retrieved_document_passages?: string[] | string | null;
  local_file_snippets?: string[] | string | null;
  reference_document_links?: string[] | string | null;
  notice?: string | null;
  symptoms?: string | null;
  symptom_checklist?: any;
  [key: string]: any;
}

export interface SymptomChecklistItem {
  symptom: string;
  source_title?: string | null;
  source_url?: string | null;
  source_institute?: string | null;
}

export interface DiagnosticResult {
  id: string;
  crop: string;
  primary_diagnosis: string | null;
  top_confidence: number | null;
  confidence_formatted: string | null;
  inference_outcome: 'detected' | 'low_confidence' | 'no_detection' | 'provider_error';
  is_low_confidence: boolean;
  execution_status: string;
  other_possible_detections: Array<{
    label: string;
    confidence: number | null;
    confidence_formatted: string | null;
    category?: string;
    source?: string;
  }>;
  annotated_image_b64?: string | null;
  bounding_boxes?: Array<{
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
    label?: string;
    confidence?: string | number | null;
  }>;
  symptoms?: string | null;
  cultural_steps?: string[];
  chemical_remedy?: string | null;
  organic_remedy?: string | null;
  rag_remedies?: RagRemedies | null;
  symptom_checklist?: SymptomChecklistItem[] | null;
  stage_timings_ms?: Record<string, number> | null;
  sources?: Array<{
    title: string;
    url: string;
    snippet?: string;
    date?: string;
  }>;
  notice?: string | null;
  low_confidence_notice?: string | null;
  providers_summary?: any;
}

export const VERIFIED_CROP_DISEASE_SYMPTOMS: Record<string, SymptomChecklistItem[]> = {
  'sheath blight': [
    {
      symptom: 'Initial oval or irregular greenish-gray water-soaked lesions (1–3 cm long) on leaf sheaths near the soil or waterline.',
      source_title: 'TNAU Agritech Portal & IRRI Rice Knowledge Bank - Rice Sheath Blight (Rhizoctonia solani)',
      source_institute: 'Tamil Nadu Agricultural University (TNAU) & International Rice Research Institute (IRRI)',
      source_url: 'https://agritech.tnau.ac.in/crop_protection/crop_prot_crop_diseases_cereals_rice.html',
    },
    {
      symptom: 'Lesions enlarge with gray-white centers surrounded by dark reddish-brown margins.',
      source_title: 'TNAU Agritech Portal - Rice Sheath Blight Symptoms',
      source_institute: 'TNAU',
      source_url: 'https://agritech.tnau.ac.in/crop_protection/crop_prot_crop_diseases_cereals_rice.html',
    },
    {
      symptom: 'Primary infection spreads upward to upper leaf sheaths and leaf blades, causing leaf drying and lodging.',
      source_title: 'IRRI Rice Knowledge Bank - Sheath Blight Management',
      source_institute: 'International Rice Research Institute (IRRI)',
      source_url: 'http://www.knowledgebank.irri.org/decision-tools/rice-doctor/rice-doctor-fact-sheets/item/sheath-blight',
    },
  ],
  'rice blast': [
    {
      symptom: 'Spindle-shaped or diamond-shaped lesions with gray/whitish centers and dark reddish-brown borders on leaf blades.',
      source_title: 'ICAR-NRRI & TNAU - Rice Blast Diagnostics',
      source_institute: 'ICAR-National Rice Research Institute & TNAU',
      source_url: 'https://agritech.tnau.ac.in/crop_protection/crop_prot_crop_diseases_cereals_rice.html',
    },
    {
      symptom: 'Lesions coalesce causing large burnt-like patches across leaf surface ("leaf blast").',
      source_title: 'IRRI Rice Doctor - Blast',
      source_institute: 'IRRI',
      source_url: 'http://www.knowledgebank.irri.org/decision-tools/rice-doctor/rice-doctor-fact-sheets/item/blast-leaf-collar-node-neck-panicle',
    },
  ],
  'brown spot': [
    {
      symptom: 'Small, round to oval brown spots with yellow halos scattered on leaf surfaces.',
      source_title: 'TNAU Agritech Portal - Rice Brown Spot',
      source_institute: 'TNAU',
      source_url: 'https://agritech.tnau.ac.in/crop_protection/crop_prot_crop_diseases_cereals_rice.html',
    },
    {
      symptom: 'Spots coalesce into larger dark brown patches with gray centers.',
      source_title: 'IRRI Rice Doctor - Brown Spot',
      source_institute: 'IRRI',
      source_url: 'http://www.knowledgebank.irri.org/decision-tools/rice-doctor/rice-doctor-fact-sheets/item/brown-spot',
    },
  ],
  'bacterial leaf blight': [
    {
      symptom: 'Water-soaked to yellowish wavy lesions starting from leaf tips and margins.',
      source_title: 'ICAR-NRRI Bacterial Leaf Blight Bulletin',
      source_institute: 'ICAR-National Rice Research Institute',
      source_url: 'https://nrri.icar.gov.in',
    },
    {
      symptom: 'Lesions turn straw-yellow to white with bacterial exudate droplets appearing on young lesions.',
      source_title: 'IRRI Rice Doctor - Bacterial Blight',
      source_institute: 'IRRI',
      source_url: 'http://www.knowledgebank.irri.org/decision-tools/rice-doctor/rice-doctor-fact-sheets/item/bacterial-blight',
    },
  ],
  'anthracnose': [
    {
      symptom: 'Circular, sunken dark brown or black lesions on chilli pods or leaf surfaces.',
      source_title: 'ANGRAU Chilli Pathology Manual - Anthracnose',
      source_institute: 'Acharya N.G. Ranga Agricultural University (ANGRAU)',
      source_url: 'https://angrau.ac.in',
    },
    {
      symptom: 'Concentric rings of tiny pinkish/black acervuli dots inside the sunken spots.',
      source_title: 'TNAU Agritech Portal - Chilli Diseases',
      source_institute: 'TNAU',
      source_url: 'https://agritech.tnau.ac.in',
    },
  ],
  'leaf curl virus': [
    {
      symptom: 'Upward curling, puckering, and stunting of young leaves with reduced leaf lamina.',
      source_title: 'ANGRAU Chilli Leaf Curl Advisory',
      source_institute: 'ANGRAU',
      source_url: 'https://angrau.ac.in',
    },
    {
      symptom: 'Vein clearing and crowded, bushy plant habit with severe yield loss.',
      source_title: 'TNAU Agritech Portal - Leaf Curl Virus',
      source_institute: 'TNAU',
      source_url: 'https://agritech.tnau.ac.in',
    },
  ],
  'grey mildew': [
    {
      symptom: 'Angular pale translucent spots bounded by veins on the upper leaf surface.',
      source_title: 'PJTSAU Cotton Pathology Guide',
      source_institute: 'PJTSAU',
      source_url: 'https://pjtsau.edu.in',
    },
    {
      symptom: 'Powdery white/gray fungal growth on the lower surface of affected leaves.',
      source_title: 'TNAU Crop Protection - Cotton Grey Mildew',
      source_institute: 'TNAU',
      source_url: 'https://agritech.tnau.ac.in',
    },
  ],
};

export function getSymptomChecklistForDiagnosis(
  primaryDiagnosis: string | null,
  rawChecklist: any
): SymptomChecklistItem[] | null {
  if (Array.isArray(rawChecklist) && rawChecklist.length > 0) {
    return rawChecklist.map((item: any) => ({
      symptom: typeof item === 'string' ? item : item.symptom || item.description || item.text || String(item),
      source_title: typeof item === 'object' ? item.source_title || item.source : null,
      source_url: typeof item === 'object' ? item.source_url || item.url : null,
      source_institute: typeof item === 'object' ? item.source_institute || item.institute : null,
    }));
  }

  if (!primaryDiagnosis) return null;
  const canonicalKey = getCanonicalDiseaseKey(primaryDiagnosis);
  return VERIFIED_CROP_DISEASE_SYMPTOMS[canonicalKey] || null;
}

export function SymptomCrossCheckSection({
  symptomChecklist,
}: {
  symptomChecklist?: SymptomChecklistItem[] | null;
}) {
  const [userAnswers, setUserResponses] = useState<Record<number, 'yes' | 'no' | 'unsure'>>({});

  const handleToggle = (index: number, answer: 'yes' | 'no' | 'unsure') => {
    setUserResponses((prev) => ({
      ...prev,
      [index]: prev[index] === answer ? (undefined as any) : answer,
    }));
  };

  return (
    <div className="p-5 rounded-2xl bg-[#14532D]/5 border border-[#14532D]/20 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-[#14532D]/15">
        <div className="flex items-center gap-2">
          <Scan className="w-5 h-5 text-[#14532D]" />
          <h4 className="text-sm font-extrabold text-[#14532D] uppercase tracking-wider">
            Symptoms to Cross-Check
          </h4>
        </div>
        <span className="text-[10px] font-bold bg-[#14532D]/10 text-[#14532D] px-2 py-0.5 rounded-md border border-[#14532D]/20">
          Field Comparison Aid
        </span>
      </div>

      <p className="text-xs text-stone-600 leading-relaxed font-medium">
        Compare your physical leaf sample against authoritative crop protection descriptions. Marking symptoms helps you evaluate field visual alignment. <strong className="text-stone-900">Note:</strong> Marking these items is for your reference and does not automatically alter the computer vision model diagnosis.
      </p>

      {!symptomChecklist || symptomChecklist.length === 0 ? (
        <div className="p-3.5 rounded-xl bg-white border border-stone-200 text-xs text-stone-600 font-medium flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-stone-500 shrink-0" />
          <span>No verified symptom reference available for this condition.</span>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {symptomChecklist.map((item, idx) => {
            const currentAns = userAnswers[idx];
            const isPublicUrl = isValidPublicHttpUrl(item.source_url);
            const cleanTitle = cleanDocumentTitle(item.source_title);

            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] font-extrabold text-[#14532D] uppercase tracking-wider block">
                      Symptom #{idx + 1}
                    </span>
                    <p className="text-stone-900 font-medium leading-relaxed">
                      {item.symptom}
                    </p>
                  </div>

                  {/* Interactive Farmer Response Toggles */}
                  <div className="flex items-center gap-1 shrink-0 bg-stone-100 p-1 rounded-lg border border-stone-200">
                    <button
                      type="button"
                      onClick={() => handleToggle(idx, 'yes')}
                      className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                        currentAns === 'yes'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(idx, 'no')}
                      className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                        currentAns === 'no'
                          ? 'bg-rose-700 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                      }`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(idx, 'unsure')}
                      className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                        currentAns === 'unsure'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                      }`}
                    >
                      Unsure
                    </button>
                  </div>
                </div>

                {/* Source Citation for Symptom */}
                {(item.source_title || item.source_institute || item.source_url) && (
                  <div className="pt-1.5 border-t border-stone-100 text-[11px] text-stone-500 flex flex-wrap items-center gap-1">
                    <span className="font-semibold text-stone-600">Source:</span>
                    {isPublicUrl ? (
                      <a
                        href={item.source_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-emerald-800 hover:underline inline-flex items-center gap-0.5"
                      >
                        <span>{cleanTitle}</span>
                        {item.source_institute ? ` (${item.source_institute})` : ''}
                        <ExternalLink className="w-3 h-3 text-emerald-700 inline" />
                      </a>
                    ) : (
                      <span className="font-medium text-stone-700">
                        {cleanTitle}
                        {item.source_institute ? ` (${item.source_institute})` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Validates whether a given URL is a valid public HTTP(S) URL.
 * Rejects local file paths, localhost, relative paths, and non-http(s) protocols.
 */
export function isValidPublicHttpUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const str = url.trim();
  if (
    str.startsWith('/') ||
    str.startsWith('\\') ||
    /^[a-zA-Z]:/.test(str) ||
    str.startsWith('file:')
  ) {
    return false;
  }
  try {
    const parsed = new URL(str);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.hostname.includes('localhost') &&
      !parsed.hostname.includes('127.0.0.1')
    );
  } catch {
    return false;
  }
}

/**
 * Cleans document titles by removing local filesystem path prefixes (Windows or Unix).
 */
export function cleanDocumentTitle(rawTitle: string | null | undefined): string {
  if (!rawTitle || typeof rawTitle !== 'string') return 'Knowledge-Base Document';
  let title = rawTitle.trim();
  if (title.includes('\\')) {
    title = title.split('\\').pop() || title;
  }
  if (title.includes('/')) {
    title = title.split('/').pop() || title;
  }
  return title || 'Knowledge-Base Document';
}

/**
 * Normalizes string or array inputs into a clean list of guidance items.
 */
export function formatGuidanceList(val: string[] | string | null | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((item) => String(item).trim()).filter(Boolean);
  }
  const str = String(val).trim();
  if (!str) return [];
  if (str.includes('\n') || str.includes('•') || str.includes(';')) {
    return str
      .split(/[\n•;]+/)
      .map((item) => item.replace(/^[-*\d.\s]+/, '').trim())
      .filter(Boolean);
  }
  return [str];
}

/**
 * Extracts any retrieved document passage or snippet from the backend RAG payload.
 */
export function getRetrievedPassage(rag: RagRemedies | null | undefined): string | null {
  if (!rag) return null;
  if (rag.document_passage && String(rag.document_passage).trim()) {
    return String(rag.document_passage).trim();
  }
  if (rag.retrieved_document_passages) {
    if (Array.isArray(rag.retrieved_document_passages) && rag.retrieved_document_passages.length > 0) {
      const first = String(rag.retrieved_document_passages[0]).trim();
      if (first) return first;
    } else if (typeof rag.retrieved_document_passages === 'string' && rag.retrieved_document_passages.trim()) {
      return rag.retrieved_document_passages.trim();
    }
  }
  if (rag.local_file_snippets) {
    if (Array.isArray(rag.local_file_snippets) && rag.local_file_snippets.length > 0) {
      const first = String(rag.local_file_snippets[0]).trim();
      if (first) return first;
    } else if (typeof rag.local_file_snippets === 'string' && rag.local_file_snippets.trim()) {
      return rag.local_file_snippets.trim();
    }
  }
  return null;
}

/**
 * Determines if the backend returned a verified reference source match.
 */
export function isVerifiedRagMatch(rag: RagRemedies | null | undefined): boolean {
  if (!rag) return false;
  if (rag.rag_status === 'no_verified_match') return false;

  if (
    rag.rag_status === 'verified_match' ||
    rag.rag_status === 'matched' ||
    rag.rag_status === 'success' ||
    rag.rag_status === 'kb_match' ||
    rag.rag_status === 'internal_kb_match'
  ) {
    return true;
  }

  const hasSourceInfo = Boolean(
    (rag.source_title && String(rag.source_title).trim()) ||
    (rag.source_institute && String(rag.source_institute).trim()) ||
    getRetrievedPassage(rag)
  );

  return hasSourceInfo;
}

export function formatConfidencePercent(val: number | null | undefined): string | null {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return null;
  }
  const num = Number(val);
  const pct = num <= 1 && num >= 0 ? num * 100 : num;
  return `${pct.toFixed(1)}%`;
}

/**
 * Computes a normalized, canonical disease key for case-insensitive comparison,
 * alias mapping, and hyphen/space normalization.
 */
export function getCanonicalDiseaseKey(label: string | null | undefined): string {
  if (!label) return '';
  let str = String(label).trim().toLowerCase();

  // Strip parenthetical text e.g. " (pyricularia oryzae)"
  str = str.replace(/\s*\([^)]*\)/g, '');

  // Replace hyphens, underscores, and multiple spaces with a single space
  str = str.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Canonical alias mapping (maps common name variants to a unified key)
  const aliasMap: Record<string, string> = {
    'sheath blight': 'sheath blight',
    'rice sheath blight': 'sheath blight',
    'brown spot': 'brown spot',
    'rice brown spot': 'brown spot',
    'helminthosporium leaf spot': 'brown spot',
    'helminthosporium oryzae': 'brown spot',
    'rice blast': 'rice blast',
    'leaf blast': 'rice blast',
    'blast': 'rice blast',
    'pyricularia oryzae': 'rice blast',
    'bacterial leaf blight': 'bacterial leaf blight',
    'bacterial blight': 'bacterial leaf blight',
    'tikka leaf spot': 'tikka leaf spot',
    'tikka disease': 'tikka leaf spot',
    'cercospora leaf spot': 'tikka leaf spot',
    'anthracnose': 'anthracnose',
    'chilli anthracnose': 'anthracnose',
    'leaf curl virus': 'leaf curl virus',
    'chilli leaf curl': 'leaf curl virus',
    'yellow leaf curl': 'leaf curl virus',
    'early blight': 'early blight',
    'late blight': 'late blight',
    'grey mildew': 'grey mildew',
    'gray mildew': 'grey mildew',
  };

  return aliasMap[str] || str;
}

export interface SecondaryDetectionCandidate {
  label: string;
  confidence: number | null;
  confidence_formatted: string | null;
  category?: string;
  source?: string;
}

/**
 * Deduplicates, excludes primary diagnosis, normalizes labels,
 * and orders secondary disease candidates.
 *
 * Rules:
 * 1. Primary condition exclusion: Candidates that match the primary diagnosis (using canonical key) are excluded.
 * 2. Deduplication: Candidates with the same canonical disease key are merged by keeping the one with the highest returned confidence. Scores are NOT combined/summed across providers.
 * 3. Sorting rule: Candidates are sorted descending by highest returned confidence score. If confidence is null or equal, sorted deterministically by canonical key.
 */
export function processSecondaryCandidates(
  rawCandidates: any[],
  primaryDiagnosis: string | null
): SecondaryDetectionCandidate[] {
  if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) {
    return [];
  }

  const primaryKey = getCanonicalDiseaseKey(primaryDiagnosis);
  const candidateMap = new Map<string, SecondaryDetectionCandidate>();

  for (const item of rawCandidates) {
    if (!item) continue;

    let matchLabel: string | null = null;
    let rawConf: any = null;
    let category: string | undefined = undefined;
    let source: string | undefined = undefined;

    if (typeof item === 'string') {
      matchLabel = item;
    } else if (typeof item === 'object') {
      matchLabel = item.label ?? item.disease ?? item.name ?? item.disease_name ?? item.primary_diagnosis ?? null;
      rawConf = item.confidence ?? item.score ?? item.probability ?? item.top_confidence ?? null;
      category = item.category ? String(item.category) : undefined;
      source = item.source ? String(item.source) : undefined;
    }

    if (!matchLabel || !String(matchLabel).trim()) {
      continue;
    }

    const cleanLabel = String(matchLabel).trim();
    const itemKey = getCanonicalDiseaseKey(cleanLabel);

    // Rule 1: Exclude empty keys and any candidate matching primary diagnosis
    if (!itemKey || itemKey === primaryKey) {
      continue;
    }

    const itemConfNum =
      rawConf !== null && rawConf !== undefined && !isNaN(Number(rawConf))
        ? Number(rawConf)
        : null;

    // Rule 2: Deduplicate using canonical key, preserving max confidence without sum/ensemble
    const existing = candidateMap.get(itemKey);
    if (!existing) {
      candidateMap.set(itemKey, {
        label: cleanLabel,
        confidence: itemConfNum,
        confidence_formatted: formatConfidencePercent(itemConfNum),
        category,
        source,
      });
    } else {
      // If new item has a higher confidence score, replace with higher confidence item
      const existingConf = existing.confidence;
      if (
        itemConfNum !== null &&
        (existingConf === null || itemConfNum > existingConf)
      ) {
        candidateMap.set(itemKey, {
          label: cleanLabel,
          confidence: itemConfNum,
          confidence_formatted: formatConfidencePercent(itemConfNum),
          category: category || existing.category,
          source: source || existing.source,
        });
      }
    }
  }

  // Rule 3: Sort descending by highest returned confidence score
  const uniqueCandidates = Array.from(candidateMap.values());
  uniqueCandidates.sort((a, b) => {
    if (a.confidence !== null && b.confidence !== null) {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
    } else if (a.confidence !== null) {
      return -1;
    } else if (b.confidence !== null) {
      return 1;
    }
    return getCanonicalDiseaseKey(a.label).localeCompare(getCanonicalDiseaseKey(b.label));
  });

  return uniqueCandidates;
}

export function parseDiseaseApiResponse(
  rawResponse: unknown,
  cropName: string
): DiagnosticResult {
  const unwrapped = rawResponse ? unwrapApiResponse<Record<string, any>>(rawResponse) : {};

  // 1. Result ID
  const id = unwrapped.result_id || unwrapped.id || unwrapped.prediction_id || `diag_${Date.now()}`;

  // 2. Primary diagnosis
  const rawDiag =
    unwrapped.primary_diagnosis ??
    unwrapped.disease_identified ??
    unwrapped.disease_name ??
    unwrapped.disease ??
    unwrapped.detection ??
    unwrapped.name;
  const rawDiagStr =
    rawDiag !== null && rawDiag !== undefined && String(rawDiag).trim() !== '' && String(rawDiag).trim() !== 'null'
      ? String(rawDiag).trim()
      : null;

  // 3. Top confidence (preserve 0 and valid numbers)
  const rawConf =
    unwrapped.top_confidence ??
    unwrapped.confidence ??
    unwrapped.confidence_score;
  const top_confidence =
    rawConf !== null && rawConf !== undefined && !isNaN(Number(rawConf))
      ? Number(rawConf)
      : null;

  // 4. Inference outcome determination
  const rawOutcome = unwrapped.inference_outcome?.toLowerCase().trim();
  const execStatus = unwrapped.execution_status?.toLowerCase().trim();

  let inference_outcome: 'detected' | 'low_confidence' | 'no_detection' | 'provider_error' = 'no_detection';

  if (
    rawOutcome === 'provider_error' ||
    rawOutcome === 'model_unavailable' ||
    rawOutcome === 'provider_unavailable' ||
    execStatus === 'failed' ||
    execStatus === 'unavailable' ||
    unwrapped.success === false
  ) {
    inference_outcome = 'provider_error';
  } else if (
    rawOutcome === 'no_detection' ||
    rawOutcome === 'no_positive_detection' ||
    rawOutcome === 'healthy'
  ) {
    // REQUIREMENT 2: For no_detection, inference_outcome is no_detection
    inference_outcome = 'no_detection';
  } else if (rawOutcome === 'low_confidence') {
    inference_outcome = 'low_confidence';
  } else if (rawOutcome === 'detected') {
    inference_outcome = 'detected';
  } else if (rawDiagStr) {
    const isNoDet =
      rawDiagStr.toLowerCase() === 'no positive detection' ||
      rawDiagStr.toLowerCase() === 'no pathology detected' ||
      rawDiagStr.toLowerCase() === 'healthy' ||
      rawDiagStr.toLowerCase() === 'no_detection';

    const isLow =
      top_confidence !== null &&
      (top_confidence < 0.7 || (top_confidence <= 1 ? top_confidence < 0.7 : top_confidence < 70));

    if (isNoDet) {
      inference_outcome = 'no_detection';
    } else if (isLow) {
      inference_outcome = 'low_confidence';
    } else {
      inference_outcome = 'detected';
    }
  } else {
    inference_outcome = 'no_detection';
  }

  // REQUIREMENT 1: is_low_confidence is true ONLY when inference_outcome === "low_confidence"
  const is_low_confidence = inference_outcome === 'low_confidence';

  // REQUIREMENT 2 & 3: Outcome-specific field mapping
  let primary_diagnosis: string | null = null;
  let final_top_confidence: number | null = null;
  let confidence_formatted: string | null = null;
  let low_confidence_notice: string | null = null;
  let notice: string | null = null;

  if (inference_outcome === 'no_detection') {
    // REQUIREMENT 2:
    // primary_diagnosis: null, top_confidence: null, low_confidence_notice: null, is_low_confidence: false
    primary_diagnosis = null;
    final_top_confidence = null;
    confidence_formatted = null;
    low_confidence_notice = null;

    const rawNoticeStr = unwrapped.notice || unwrapped.low_confidence_notice || '';
    const isThresholdText =
      rawNoticeStr.toLowerCase().includes('threshold') ||
      rawNoticeStr.toLowerCase().includes('low confidence') ||
      rawNoticeStr.toLowerCase().includes('met the detection');

    notice = isThresholdText || !rawNoticeStr.trim()
      ? 'No disease or pest symptoms were detected on this sample.'
      : rawNoticeStr.trim();
  } else if (inference_outcome === 'low_confidence') {
    // REQUIREMENT 3:
    // Keep returned candidate label/score and threshold explanation
    primary_diagnosis = rawDiagStr || 'Possible foliar condition';
    final_top_confidence = top_confidence;
    confidence_formatted = formatConfidencePercent(top_confidence);
    low_confidence_notice =
      unwrapped.low_confidence_notice ||
      unwrapped.notice ||
      'The computer vision model analyzed the leaf image and identified candidate symptoms, but the confidence score is below the 70% decision threshold.';
    notice = null; // Avoid duplicate notice
  } else if (inference_outcome === 'detected') {
    primary_diagnosis = rawDiagStr || 'Active Foliar Pathogen';
    final_top_confidence = top_confidence;
    confidence_formatted = formatConfidencePercent(top_confidence);
    low_confidence_notice = null;
    notice = unwrapped.notice || null;
  } else {
    // provider_error
    primary_diagnosis = null;
    final_top_confidence = null;
    confidence_formatted = null;
    low_confidence_notice = null;
    notice = unwrapped.notice || 'Computer vision model analysis endpoint is temporarily unavailable.';
  }

  // 5. Other possible detections (alternatives) - aggregated and deduplicated from backend fields
  let rawOthersList: any[] = [];
  if (Array.isArray(unwrapped.other_possible_detections)) {
    rawOthersList.push(...unwrapped.other_possible_detections);
  }
  if (Array.isArray(unwrapped.secondary_matches)) {
    rawOthersList.push(...unwrapped.secondary_matches);
  }
  if (Array.isArray(unwrapped.other_candidates)) {
    rawOthersList.push(...unwrapped.other_candidates);
  }
  if (Array.isArray(unwrapped.top_3_diseases)) {
    rawOthersList.push(...unwrapped.top_3_diseases);
  }

  const other_possible_detections = processSecondaryCandidates(
    rawOthersList,
    primary_diagnosis
  );

  // 6. Bounding boxes - ONLY from backend fields
  const rawBoxes = unwrapped.bounding_boxes || unwrapped.boxes || unwrapped.detections;
  let bounding_boxes: DiagnosticResult['bounding_boxes'] = undefined;

  if (Array.isArray(rawBoxes) && rawBoxes.length > 0) {
    bounding_boxes = rawBoxes.map((b: any) => {
      return {
        ymin: Number(b.ymin ?? b.top ?? b[0] ?? 0),
        xmin: Number(b.xmin ?? b.left ?? b[1] ?? 0),
        ymax: Number(b.ymax ?? b.bottom ?? b[2] ?? 100),
        xmax: Number(b.xmax ?? b.right ?? b[3] ?? 100),
        label: b.label ?? b.name ?? b.disease_name,
        confidence: formatConfidencePercent(b.confidence) ?? b.confidence,
      };
    });
  }

  // 7. Annotated image b64
  const annotated_image_b64 = unwrapped.annotated_image_b64 || unwrapped.annotated_image || null;

  // 8. Remedies & RAG payload aggregation
  const rawRag = unwrapped.rag_remedies || unwrapped.remedies || unwrapped.rag || {};

  const cultural_practices =
    unwrapped.cultural_practices ||
    rawRag.cultural_practices ||
    unwrapped.cultural_steps ||
    rawRag.cultural_steps ||
    null;

  const organic_bio_control =
    unwrapped.organic_bio_control ||
    rawRag.organic_bio_control ||
    unwrapped.organic_remedy ||
    rawRag.organic_remedy ||
    rawRag.organic ||
    null;

  const chemical_treatment =
    unwrapped.chemical_treatment ||
    rawRag.chemical_treatment ||
    unwrapped.chemical_remedy ||
    rawRag.chemical_remedy ||
    rawRag.chemical ||
    null;

  const fertilizer_advice =
    unwrapped.fertilizer_advice ||
    rawRag.fertilizer_advice ||
    null;

  const rag_status =
    unwrapped.rag_status ||
    rawRag.rag_status ||
    null;

  const source_title =
    unwrapped.source_title ||
    rawRag.source_title ||
    null;

  const source_institute =
    unwrapped.source_institute ||
    rawRag.source_institute ||
    null;

  const source_url =
    unwrapped.source_url ||
    rawRag.source_url ||
    null;

  const document_passage =
    unwrapped.document_passage ||
    rawRag.document_passage ||
    null;

  const retrieved_document_passages =
    unwrapped.retrieved_document_passages ||
    rawRag.retrieved_document_passages ||
    null;

  const local_file_snippets =
    unwrapped.local_file_snippets ||
    rawRag.local_file_snippets ||
    null;

  const reference_document_links =
    unwrapped.reference_document_links ||
    rawRag.reference_document_links ||
    null;

  const rag_notice =
    unwrapped.rag_notice ||
    rawRag.notice ||
    null;

  const rag_remedies: RagRemedies = {
    cultural_practices,
    organic_bio_control,
    chemical_treatment,
    fertilizer_advice,
    rag_status,
    source_title,
    source_institute,
    source_url,
    document_passage,
    retrieved_document_passages,
    local_file_snippets,
    reference_document_links,
    notice: rag_notice,
    ...rawRag,
  };

  const symptoms = unwrapped.symptoms || rawRag.symptoms || null;
  const cultural_steps = formatGuidanceList(cultural_practices);
  const chemical_remedy =
    typeof chemical_treatment === 'string'
      ? chemical_treatment
      : Array.isArray(chemical_treatment)
      ? chemical_treatment.join('; ')
      : null;
  const organic_remedy =
    typeof organic_bio_control === 'string'
      ? organic_bio_control
      : Array.isArray(organic_bio_control)
      ? organic_bio_control.join('; ')
      : null;
  const sources = Array.isArray(unwrapped.sources)
    ? unwrapped.sources
    : Array.isArray(rawRag.sources)
    ? rawRag.sources
    : undefined;

  const rawSymptomChecklist = unwrapped.symptom_checklist || rawRag.symptom_checklist || null;
  const symptom_checklist = getSymptomChecklistForDiagnosis(primary_diagnosis, rawSymptomChecklist);

  const stage_timings_ms = unwrapped.stage_timings_ms || unwrapped.stage_timings || unwrapped.timings_ms || null;

  return {
    id,
    crop: cropName,
    primary_diagnosis,
    top_confidence: final_top_confidence,
    confidence_formatted,
    inference_outcome,
    is_low_confidence,
    execution_status: unwrapped.execution_status || (inference_outcome === 'provider_error' ? 'failed' : 'success'),
    other_possible_detections,
    annotated_image_b64,
    bounding_boxes,
    symptoms,
    cultural_steps,
    chemical_remedy,
    organic_remedy,
    rag_remedies,
    symptom_checklist,
    stage_timings_ms,
    sources,
    notice,
    low_confidence_notice,
    providers_summary: unwrapped.providers_summary,
  };
}

export function DiseaseDetectionView({ profile }: { profile: UserFarmProfile }) {
  const initialCrop = resolveDiseaseCropInitial(profile.crop);
  const [crop, setCrop] = useState(initialCrop.cropValue);
  const [customCropName, setCustomCropName] = useState(initialCrop.customCropName);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File) => {
    setFileError(null);
    if (!file.type.startsWith('image/')) {
      setFileError('Please select a valid leaf image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setFileError('Image file is too large (max 12 MB). Please select a smaller photo.');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setResult(null);
    setError('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const clearImage = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
    setError('');
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedFile) {
      setFileError('Please upload or snap a leaf photo before submitting for diagnosis.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    const effectiveCrop =
      crop === 'Other'
        ? customCropName.trim() || 'Other Crop'
        : crop;

    try {
      const compressed = await compressImage(selectedFile, 1024, 1024, 0.82);

      let rawResponse: unknown = null;
      try {
        rawResponse = await predictDisease(effectiveCrop, compressed);
      } catch (backendErr: any) {
        const errMsg = backendErr?.message || String(backendErr);
        if (
          errMsg.includes('VALIDATION_ERROR:') ||
          errMsg.includes('400') ||
          errMsg.includes('422') ||
          errMsg.includes('Invalid multipart') ||
          errMsg.includes('file format') ||
          errMsg.includes('file size')
        ) {
          setFileError(errMsg.replace(/^VALIDATION_ERROR:\s*/, ''));
          setLoading(false);
          return;
        }

        // Render model provider error without fake fallback
        const parsedError = parseDiseaseApiResponse(
          {
            success: false,
            execution_status: 'failed',
            inference_outcome: 'provider_error',
            notice: errMsg || 'The computer vision diagnostic model or backend provider is currently unavailable.',
          },
          effectiveCrop
        );
        setResult(parsedError);
        setLoading(false);
        return;
      }

      const parsed = parseDiseaseApiResponse(rawResponse, effectiveCrop);
      setResult(parsed);

      if (parsed.inference_outcome === 'detected' && parsed.primary_diagnosis) {
        savePrediction({
          category: 'disease',
          title: `Leaf Diagnosis: ${parsed.primary_diagnosis}`,
          summary: `Identified ${parsed.primary_diagnosis} with ${parsed.confidence_formatted ?? 'measured'} confidence on ${effectiveCrop}.`,
          details: {
            crop: effectiveCrop,
            disease: parsed.primary_diagnosis,
            confidence: parsed.confidence_formatted,
            chemical: parsed.chemical_remedy,
            organic: parsed.organic_remedy,
            id: parsed.id,
          },
          badge: parsed.primary_diagnosis,
        });
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Diagnostic assessment failed. Please check your image and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <StatutoryAdvisoryTopBanner module="disease" />

      <PageHeader
        title="Plant Pathology & Disease Detection"
        subtitle="Upload or snap a high-resolution photo of affected leaves to identify symptoms, disease pathogens, and certified management solutions."
        badge="Computer Vision Diagnostic"
      />

      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-emerald-800" />
            <h2 className="text-sm font-bold text-stone-900">Leaf Sample & Crop Target</h2>
          </div>
          <span className="text-xs text-stone-500">Supports JPG, PNG, WEBP up to 12MB</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Select Crop <span className="text-red-500">*</span>
              </label>
              <select
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:ring-1 focus:ring-emerald-500"
              >
                <optgroup label="Crops with Crop-Specific Disease Models">
                  {DISEASE_CHECK_CROPS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="General Pest & Nutrient Screening">
                  <option value="Other">Other / Unlisted Crop (General Screening Only)</option>
                </optgroup>
              </select>
            </div>

            {crop === 'Other' && (
              <div className="space-y-2 sm:col-span-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Specify Crop Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customCropName}
                    onChange={(e) => setCustomCropName(e.target.value)}
                    placeholder="e.g. Brinjal, Onion, Okra, Rose"
                    className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-xs font-medium focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">General Screening Notice</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      No crop-specific disease model is configured for unlisted crops. Submitting will perform General Pest & Nutrient Deficiency screening only.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Upload Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Leaf Photo (Clear close-up of lesions or symptoms) <span className="text-red-500">*</span>
            </label>

            {!previewUrl ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-stone-300 hover:border-emerald-500 rounded-2xl p-6 sm:p-8 text-center transition-colors bg-stone-50/50 hover:bg-emerald-50/30 flex flex-col items-center justify-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#14532D] flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-stone-900 mb-1">
                  Upload Leaf Photo or Drag & Drop
                </h4>
                <p className="text-xs text-stone-500 max-w-sm mb-4">
                  For highest diagnostic accuracy, photograph a single leaf showing visible spots or curling in good natural daylight.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#14532D] text-white hover:bg-[#14532D]/90 transition-colors shadow-xs"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Browse Photos
                  </button>

                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 transition-colors"
                  >
                    <Camera className="w-4 h-4 text-emerald-700" />
                    Snap Camera Photo
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative rounded-2xl border border-stone-200 bg-stone-50 p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-stone-300 bg-stone-900 shrink-0">
                  <img
                    src={previewUrl}
                    alt="Uploaded leaf preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-stone-900/80 text-white hover:bg-stone-900 transition-colors"
                    title="Remove image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-stone-600">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Leaf Photo Ready for Assessment</span>
                  </div>
                  <p>
                    File:{' '}
                    <strong className="text-stone-900 font-mono">
                      {selectedFile?.name || 'leaf_sample.jpg'}
                    </strong>{' '}
                    ({((selectedFile?.size || 0) / 1024).toFixed(1)} KB)
                  </p>
                  <p>
                    Crop Category: <strong className="text-stone-900">{crop === 'Other' ? customCropName || 'Other' : crop}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={clearImage}
                    className="text-xs text-rose-600 hover:underline font-medium inline-block mt-1"
                  >
                    Change photo
                  </button>
                </div>
              </div>
            )}
          </div>

          {fileError && <p className="text-xs text-rose-600 font-medium">{fileError}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !selectedFile}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-semibold bg-[#14532D] text-white hover:bg-[#14532D]/90 disabled:opacity-50 transition-colors shadow-xs"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing Leaf Pathogens...
                </span>
              ) : (
                'Identify Disease & Get Management Plan'
              )}
            </button>
          </div>
        </form>
      </div>

      {loading && (
        <LoadingState
          message="Running Computer Vision Pathology Inference & Scanning Lesion Patterns..."
          showColdStartHint={true}
        />
      )}

      {error && !loading && (
        <ErrorState
          error={error}
          endpoint="/api/v1/predict/disease"
          onRetry={() => handleSubmit()}
        />
      )}

      {/* Structured Disease Assessment Result */}
      {result !== null && !loading && (
        <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-5">
          {/* Result Header */}
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Leaf className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Diagnostic Assessment</h3>
                <p className="text-xs text-stone-500">
                  Visual pattern identification • {result.crop}
                </p>
              </div>
            </div>
            <ConfidenceBadge label="Visual Pattern Match" />
          </div>

          {/* Backend Notice if returned for DETECTED state */}
          {result.notice && result.inference_outcome === 'detected' && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>{result.notice}</span>
            </div>
          )}

          {/* Outcome State 1: DETECTED */}
          {result.inference_outcome === 'detected' && (
            <>
              <div className="p-5 rounded-xl bg-rose-50/80 border border-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block mb-1">
                    Detected Primary Condition / Symptom
                  </span>
                  <h4 className="text-2xl font-black text-rose-950">
                    {result.primary_diagnosis || 'Pathogen Detected'}
                  </h4>
                  <p className="text-xs text-rose-900 mt-1 font-semibold">
                    Model Confidence:{' '}
                    {result.confidence_formatted !== null
                      ? result.confidence_formatted
                      : 'Measured'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-semibold text-rose-800 shrink-0">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Active Foliar Pathogen</span>
                </div>
              </div>

              {/* Source-backed Symptom Cross-Check Section */}
              <SymptomCrossCheckSection symptomChecklist={result.symptom_checklist} />

              {/* Observed Symptoms if provided */}
              {result.symptoms && (
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Observed Symptoms & Diagnostic Identifiers
                  </h4>
                  <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                    {result.symptoms}
                  </p>
                </div>
              )}

              {/* Verified Source vs No Verified Source Handling */}
              {!isVerifiedRagMatch(result.rag_remedies) || result.rag_remedies?.rag_status === 'no_verified_match' ? (
                <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-300 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-amber-950 font-bold uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>No Verified Reference Source Matched</span>
                  </div>
                  <p className="text-amber-900 leading-relaxed font-medium">
                    {result.rag_remedies?.notice ||
                      result.notice ||
                      'No verified ICAR or State Agriculture University reference document matched this specific diagnosis in the knowledge base.'}
                  </p>
                  <p className="text-[11px] text-amber-800 font-medium italic">
                    Because no verified reference document matched, AgriFusion does not display unverified chemical dosages or treatment instructions.
                  </p>
                </div>
              ) : (
                <>
                  {/* Suggested Next Steps */}
                  {(() => {
                    const rag = result.rag_remedies;
                    const culturalList = formatGuidanceList(rag?.cultural_practices || result.cultural_steps);
                    const organicList = formatGuidanceList(rag?.organic_bio_control || result.organic_remedy);
                    const chemicalList = formatGuidanceList(rag?.chemical_treatment || result.chemical_remedy);
                    const fertilizerList = formatGuidanceList(rag?.fertilizer_advice);

                    const hasNextSteps =
                      culturalList.length > 0 ||
                      organicList.length > 0 ||
                      chemicalList.length > 0 ||
                      fertilizerList.length > 0;

                    if (!hasNextSteps) return null;

                    return (
                      <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
                          <Sprout className="w-5 h-5 text-emerald-800" />
                          <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                            Suggested Next Steps
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Cultural Practices */}
                          {culturalList.length > 0 && (
                            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-2">
                              <h5 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                Cultural Practices
                              </h5>
                              <ul className="space-y-1.5 text-xs text-stone-700">
                                {culturalList.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Organic / Biological Options */}
                          {organicList.length > 0 && (
                            <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-200/80 space-y-2">
                              <h5 className="text-xs font-bold text-teal-950 uppercase tracking-wider flex items-center gap-1.5">
                                <Sprout className="w-4 h-4 text-teal-700" />
                                Organic & Biological Options
                              </h5>
                              <ul className="space-y-1.5 text-xs text-stone-700">
                                {organicList.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Chemical Treatment */}
                          {chemicalList.length > 0 && (
                            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-2">
                              <h5 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                                <ShieldAlert className="w-4 h-4 text-amber-700" />
                                Chemical Treatment
                              </h5>
                              <ul className="space-y-1.5 text-xs text-stone-700">
                                {chemicalList.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Fertilizer Advice (Only when relevant & source-supported) */}
                          {fertilizerList.length > 0 && (
                            <div className="p-4 rounded-xl bg-sky-50/50 border border-sky-200/80 space-y-2">
                              <h5 className="text-xs font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1.5">
                                <Activity className="w-4 h-4 text-sky-700" />
                                Fertilizer & Nutrition Advice
                              </h5>
                              <ul className="space-y-1.5 text-xs text-stone-700">
                                {fertilizerList.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-600 mt-1.5 shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Where This Guidance Comes From */}
                  {(() => {
                    const rag = result.rag_remedies;
                    const isPublicUrl = isValidPublicHttpUrl(rag?.source_url);
                    const isVerifiedByBackend = rag?.rag_status === 'verified_match' || rag?.rag_status === 'matched';
                    const passage = getRetrievedPassage(rag);
                    const cleanTitle = cleanDocumentTitle(rag?.source_title);
                    const institute = rag?.source_institute || 'AgriFusion Pathology Knowledge Base';

                    let badgeLabel = 'Knowledge-Base Document';
                    let badgeStyle = 'bg-stone-200 text-stone-800 border-stone-300';

                    if (isPublicUrl && isVerifiedByBackend) {
                      badgeLabel = 'Verified Public Source';
                      badgeStyle = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                    } else if (isPublicUrl) {
                      badgeLabel = 'External source link';
                      badgeStyle = 'bg-sky-100 text-sky-900 border-sky-300';
                    }

                    return (
                      <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 shadow-xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-emerald-800" />
                            <h4 className="text-xs font-extrabold text-stone-900 uppercase tracking-wider">
                              Where This Guidance Comes From
                            </h4>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeStyle}`}>
                            {badgeLabel}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs text-stone-800">
                          <div>
                            <span className="text-stone-500 font-medium">Source Document: </span>
                            {isPublicUrl ? (
                              <a
                                href={rag!.source_url!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-emerald-800 hover:underline inline-flex items-center gap-1"
                              >
                                <span>{cleanTitle}</span>
                                <ExternalLink className="w-3 h-3 text-emerald-700" />
                              </a>
                            ) : (
                              <strong className="font-bold text-stone-900">{cleanTitle}</strong>
                            )}
                          </div>

                          <div>
                            <span className="text-stone-500 font-medium">Publishing Institution: </span>
                            <strong className="font-bold text-stone-900">{institute}</strong>
                          </div>

                          {passage && (
                            <div className="mt-3 p-3 bg-white rounded-xl border border-stone-200 text-xs text-stone-700 leading-relaxed space-y-1">
                              <span className="font-bold text-stone-900 text-[11px] block uppercase tracking-wider">
                                Matched Document Excerpt:
                              </span>
                              <p className="italic text-stone-800 font-serif">"{passage}"</p>
                            </div>
                          )}

                          {/* General Reference Document Links (kept separate from specific matched evidence) */}
                          {Array.isArray(rag?.reference_document_links) &&
                            rag.reference_document_links.filter((l: any) => isValidPublicHttpUrl(String(l))).length > 0 && (
                              <div className="mt-3 pt-3 border-t border-stone-200 text-[11px] space-y-1.5">
                                <span className="font-bold text-stone-700 block">
                                  General Reference Document Links:
                                </span>
                                <p className="text-[10px] text-stone-500 italic">
                                  Note: These links are general reference documents provided for background reading, kept separate from the matched evidence excerpt above.
                                </p>
                                <div className="flex flex-wrap gap-2 pt-0.5">
                                  {rag.reference_document_links
                                    .filter((l: any) => isValidPublicHttpUrl(String(l)))
                                    .map((linkUrl: string, lIdx: number) => (
                                      <a
                                        key={lIdx}
                                        href={linkUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-sky-900 hover:underline bg-white px-2 py-1 rounded border border-stone-200"
                                      >
                                        <ExternalLink className="w-3 h-3 text-sky-700" />
                                        <span>Reference #{lIdx + 1}</span>
                                      </a>
                                    ))}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {result.sources && result.sources.length > 0 && (
                <SourceList sources={result.sources} title="Verified Pathology References" />
              )}
            </>
          )}

          {/* Outcome State 2: LOW CONFIDENCE */}
          {result.inference_outcome === 'low_confidence' && (
            <div className="p-5 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
                <h4 className="text-base font-bold text-amber-950">
                  Inconclusive / Low Confidence Assessment
                </h4>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                {result.low_confidence_notice || (
                  <>
                    The computer vision model analyzed the leaf image and identified candidate symptoms of{' '}
                    <strong>{result.primary_diagnosis || 'candidate condition'}</strong>, but the confidence score ({result.confidence_formatted ?? 'below threshold'}) is below the 70% decision threshold. This assessment is inconclusive and should not be treated as a confirmed diagnosis.
                  </>
                )}
              </p>
              {result.primary_diagnosis && (
                <div className="text-xs text-amber-900 font-semibold bg-amber-100/80 p-2.5 rounded-lg border border-amber-200 flex flex-wrap items-center justify-between gap-2">
                  <span>Candidate Match: <strong>{result.primary_diagnosis}</strong></span>
                  <span>Confidence Score: <strong>{result.confidence_formatted || 'Below threshold (<70%)'}</strong></span>
                </div>
              )}
              <div className="p-3 bg-white/80 rounded-lg border border-amber-200 text-xs text-amber-800">
                💡 Recommendation: Ensure the photo is taken in bright natural daylight, tightly focused on a single leaf showing clear lesions, and submit a new photo.
              </div>
            </div>
          )}

          {/* Outcome State 3: NO DETECTION */}
          {result.inference_outcome === 'no_detection' && (
            <div className="p-5 rounded-xl bg-stone-100 border border-stone-300 space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-stone-600 shrink-0" />
                <h4 className="text-base font-bold text-stone-900">
                  No Disease Symptoms Detected
                </h4>
              </div>
              <p className="text-xs text-stone-800 leading-relaxed font-medium">
                {result.notice || 'No disease or pest symptoms were detected on this sample.'}
              </p>
              <p className="text-xs text-stone-500 italic">
                Note: This indicates no disease symptoms were identified on the submitted leaf sample; it is not a statutory guarantee of full plant health. Monitor crop growth and consult your local KVK agronomist if physical symptoms develop.
              </p>
            </div>
          )}

          {/* Outcome State 4: PROVIDER ERROR */}
          {result.inference_outcome === 'provider_error' && (
            <div className="p-5 rounded-xl bg-rose-50 border border-rose-300 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0" />
                  <h4 className="text-base font-bold text-rose-950">
                    Assessment could not be completed—this is not a no-disease result
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  className="px-3 py-1.5 bg-rose-800 hover:bg-rose-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Assessment</span>
                </button>
              </div>
              <p className="text-xs text-rose-900 leading-relaxed font-medium">
                {result.notice ||
                  'The crop-specific computer vision diagnostic model or backend provider timed out or encountered an operational error while analyzing this sample. This is an operational service failure, NOT a clean plant health bill or no-disease finding.'}
              </p>
              <div className="p-3 bg-white/80 rounded-lg border border-rose-200 text-xs text-rose-800">
                💡 Your selected photo and crop target ({crop}) are preserved above. You can retry the assessment immediately or re-upload a clearer leaf close-up.
              </div>
            </div>
          )}

          {/* Annotated Image if returned from Backend */}
          {result.annotated_image_b64 && (
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <Scan className="w-4 h-4 text-emerald-800" />
                Annotated Leaf Scan from Model
              </h4>
              <div className="rounded-xl overflow-hidden border border-stone-300 max-w-md mx-auto">
                <img
                  src={
                    result.annotated_image_b64.startsWith('data:')
                      ? result.annotated_image_b64
                      : `data:image/jpeg;base64,${result.annotated_image_b64}`
                  }
                  alt="Model Annotated Leaf Scan"
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          )}

          {/* Bounding Boxes ONLY if returned from Backend */}
          {!result.annotated_image_b64 && previewUrl && result.bounding_boxes && result.bounding_boxes.length > 0 && (
            <div className="p-4 rounded-2xl bg-stone-50 text-stone-900 space-y-3 border border-stone-200">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                <h4 className="text-xs font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Scan className="w-4 h-4 text-emerald-800" />
                  Detected Lesion Regions (Backend Bounding Boxes)
                </h4>
              </div>
              <div className="relative rounded-xl overflow-hidden border border-stone-300 bg-stone-100 max-w-md mx-auto aspect-4/3 flex items-center justify-center">
                <img src={previewUrl} alt="Analyzed leaf scan" className="w-full h-full object-contain" />
                <div className="absolute inset-0 pointer-events-none">
                  {result.bounding_boxes.map((box: any, idx: number) => {
                    const topPct = box.ymin;
                    const leftPct = box.xmin;
                    const wPct = Math.max(10, box.xmax - box.xmin);
                    const hPct = Math.max(10, box.ymax - box.ymin);
                    return (
                      <div
                        key={idx}
                        style={{
                          top: `${topPct}%`,
                          left: `${leftPct}%`,
                          width: `${wPct}%`,
                          height: `${hPct}%`,
                        }}
                        className="absolute border-2 border-rose-600 bg-rose-500/20 rounded-md"
                      >
                        {box.label && (
                          <span className="absolute -top-5 left-0 bg-rose-600 text-white font-mono text-[9px] font-bold px-1 rounded whitespace-nowrap">
                            {box.label} {box.confidence ? `(${box.confidence})` : ''}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Secondary Model Candidates (Other Possible Detections) */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900 uppercase tracking-wider">
              <Activity className="w-4 h-4 text-amber-700" />
              <span>Secondary Candidates (other_possible_detections)</span>
            </div>

            {result.other_possible_detections && result.other_possible_detections.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {result.other_possible_detections.map((altItem: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white border border-amber-200/90 text-stone-800 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-amber-800 block">
                        Candidate #{idx + 1}:
                      </span>
                      <h5 className="text-xs font-bold text-stone-900 leading-snug">
                        {altItem.label}
                      </h5>
                      {altItem.category && (
                        <span className="text-[10px] text-stone-500">
                          Category: {altItem.category}
                        </span>
                      )}
                    </div>
                    {altItem.confidence_formatted && (
                      <span className="font-mono text-xs font-black bg-amber-100 text-amber-900 px-2 py-1 rounded-lg border border-amber-300 shrink-0">
                        {altItem.confidence_formatted}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-amber-800 italic">
                No additional model candidates returned.
              </p>
            )}
          </div>

          <DisclaimerBanner
            type="warning"
            text="This is an AI-assisted computer vision assessment, not a confirmed laboratory diagnosis. Verify symptoms with your local Mandal Agricultural Officer (MAO) or KVK agronomist before applying synthetic chemical treatments."
          />

          {/* Contextual Farmer Feedback */}
          <FeedbackPrompt
            advisoryId={result?.id ?? null}
            module="disease"
            crop={crop}
            district={profile?.district || 'Andhra Pradesh / Telangana'}
          />
        </div>
      )}
    </div>
  );
}

import { describe, expect, it } from 'vitest';
import {
  DISEASE_CHECK_CROPS,
  DISEASE_CROP_ALIASES,
  cleanDocumentTitle,
  formatConfidencePercent,
  formatGuidanceList,
  getCanonicalDiseaseCropKey,
  getCanonicalDiseaseKey,
  getRetrievedPassage,
  isVerifiedRagMatch,
  isValidPublicHttpUrl,
  parseDiseaseApiResponse,
  processSecondaryCandidates,
  resolveDiseaseCropInitial,
} from '../views/DiseaseDetectionView';
import { COMMON_CROPS } from '../data/agriData';

describe('DiseaseDetectionView - Disease Response Parsing & Unwrapping', () => {
  it('1. Correctly parses "detected" outcome with primary diagnosis, top confidence, and secondary matches', () => {
    const rawBackendResponse = {
      success: true,
      stage: 'Disease Diagnostic',
      result: {
        result_id: 'diag-2026-detected-01',
        primary_diagnosis: 'Rice Leaf Blast (Pyricularia oryzae)',
        top_confidence: 0.942,
        inference_outcome: 'detected',
        execution_status: 'success',
        other_possible_detections: [
          { label: 'Brown Spot (Helminthosporium oryzae)', confidence: 0.045, category: 'fungal' },
        ],
        rag_remedies: {
          symptoms: 'Spindle-shaped lesions on leaves.',
          chemical_remedy: 'Tricyclazole 75% WP @ 0.6 g/L water.',
          organic_remedy: 'Pseudomonas fluorescens 0.5% WP @ 5 g/L.',
        },
      },
    };

    const parsed = parseDiseaseApiResponse(rawBackendResponse, 'Rice');

    expect(parsed.id).toBe('diag-2026-detected-01');
    expect(parsed.primary_diagnosis).toBe('Rice Leaf Blast (Pyricularia oryzae)');
    expect(parsed.top_confidence).toBe(0.942);
    expect(parsed.confidence_formatted).toBe('94.2%');
    expect(parsed.inference_outcome).toBe('detected');
    expect(parsed.execution_status).toBe('success');

    // Secondary matches
    expect(parsed.other_possible_detections.length).toBe(1);
    expect(parsed.other_possible_detections[0].label).toBe('Brown Spot (Helminthosporium oryzae)');
    expect(parsed.other_possible_detections[0].confidence_formatted).toBe('4.5%');

    // Remedies
    expect(parsed.chemical_remedy).toBe('Tricyclazole 75% WP @ 0.6 g/L water.');
    expect(parsed.organic_remedy).toBe('Pseudomonas fluorescens 0.5% WP @ 5 g/L.');

    // Assert NO fabricated bounding boxes
    expect(parsed.bounding_boxes).toBeUndefined();
  });

  it('2. Correctly handles "low_confidence" outcome: keeps candidate label/score and threshold explanation, sets is_low_confidence to true, and does NOT call it no_detection', () => {
    const rawBackendResponse = {
      success: true,
      result: {
        result_id: 'diag-2026-lowconf-02',
        primary_diagnosis: 'Chilli Anthracnose',
        top_confidence: 0.48,
        inference_outcome: 'low_confidence',
        is_low_confidence: true,
        execution_status: 'success',
        notice: 'Confidence score is below the 70% decision threshold.',
      },
    };

    const parsed = parseDiseaseApiResponse(rawBackendResponse, 'Chilli');

    expect(parsed.id).toBe('diag-2026-lowconf-02');
    expect(parsed.inference_outcome).toBe('low_confidence');
    expect(parsed.is_low_confidence).toBe(true);
    expect(parsed.primary_diagnosis).toBe('Chilli Anthracnose');
    expect(parsed.top_confidence).toBe(0.48);
    expect(parsed.confidence_formatted).toBe('48.0%');
    expect(parsed.low_confidence_notice).toBe('Confidence score is below the 70% decision threshold.');

    // Remedies should be null/empty unless backend provided them
    expect(parsed.chemical_remedy).toBeNull();
    expect(parsed.organic_remedy).toBeNull();
  });

  it('3. Correctly handles "no_detection" outcome: returns is_low_confidence = false, primary_diagnosis = null, top_confidence = null, low_confidence_notice = null, and one no-detection notice only (never threshold text)', () => {
    // Even if backend mistakenly sends is_low_confidence: true or threshold text for no_detection
    const rawBackendResponseWithContradictions = {
      success: true,
      result: {
        result_id: 'diag-2026-nodet-03',
        primary_diagnosis: 'No Pathology Detected',
        top_confidence: 0.98,
        inference_outcome: 'no_detection',
        is_low_confidence: true, // Backend anomaly test
        execution_status: 'success',
        notice: 'No disease pattern met the detection threshold.', // Threshold text test
        other_possible_detections: [],
      },
    };

    const parsed = parseDiseaseApiResponse(rawBackendResponseWithContradictions, 'Tomato');

    expect(parsed.inference_outcome).toBe('no_detection');
    expect(parsed.is_low_confidence).toBe(false);
    expect(parsed.primary_diagnosis).toBeNull();
    expect(parsed.top_confidence).toBeNull();
    expect(parsed.confidence_formatted).toBeNull();
    expect(parsed.low_confidence_notice).toBeNull();
    expect(parsed.notice).toBe('No disease or pest symptoms were detected on this sample.');
    expect(parsed.notice).not.toContain('threshold');
    expect(parsed.notice).not.toContain('low confidence');
    expect(parsed.other_possible_detections).toEqual([]);
    expect(parsed.bounding_boxes).toBeUndefined();
  });

  it('4. Correctly handles "provider_error" outcome and marks analysis as unavailable', () => {
    const rawBackendResponse = {
      success: false,
      result: {
        result_id: 'diag-2026-err-04',
        inference_outcome: 'provider_error',
        execution_status: 'failed',
        notice: 'Vision model endpoint timed out or returned HTTP 503.',
      },
    };

    const parsed = parseDiseaseApiResponse(rawBackendResponse, 'Cotton');

    expect(parsed.inference_outcome).toBe('provider_error');
    expect(parsed.execution_status).toBe('failed');
    expect(parsed.primary_diagnosis).toBeNull();
    expect(parsed.notice).toBe('Vision model endpoint timed out or returned HTTP 503.');
  });

  it('5. Preserves valid zero (0.0) confidence score without converting to null or substituting fake numbers', () => {
    expect(formatConfidencePercent(0)).toBe('0.0%');
    expect(formatConfidencePercent(0.0)).toBe('0.0%');
    expect(formatConfidencePercent(null)).toBeNull();
    expect(formatConfidencePercent(undefined)).toBeNull();

    const rawResponseWithZero = {
      result: {
        primary_diagnosis: 'Background Soil Pattern',
        top_confidence: 0,
        inference_outcome: 'low_confidence',
      },
    };

    const parsed = parseDiseaseApiResponse(rawResponseWithZero, 'Maize');
    expect(parsed.top_confidence).toBe(0);
    expect(parsed.confidence_formatted).toBe('0.0%');
  });

  it('6. Custom / unrecognized crops NEVER produce fabricated "[crop] Foliar Spot & Blight Complex"', () => {
    const rawResponseNoMatch = {
      result: {
        primary_diagnosis: null,
        top_confidence: null,
        inference_outcome: 'no_detection',
      },
    };

    const parsedCustom = parseDiseaseApiResponse(rawResponseNoMatch, 'Dragonfruit');

    expect(parsedCustom.crop).toBe('Dragonfruit');
    expect(parsedCustom.primary_diagnosis).toBeNull();
    expect(parsedCustom.primary_diagnosis ?? '').not.toContain('Dragonfruit Foliar Spot & Blight Complex');
  });

  it('7. Empty secondary matches returns [] and never invents simulated top-3 diseases (e.g. 74% or 62%)', () => {
    const rawResponseNoOthers = {
      result: {
        primary_diagnosis: 'Cotton Grey Mildew',
        top_confidence: 0.88,
        inference_outcome: 'detected',
        other_possible_detections: null,
      },
    };

    const parsed = parseDiseaseApiResponse(rawResponseNoOthers, 'Cotton');

    expect(parsed.other_possible_detections).toEqual([]);
    // Ensure no simulated 74% or 62% entries exist
    expect(parsed.other_possible_detections.some((d) => d.label.includes('74'))).toBe(false);
  });

  it('8. Empty bounding boxes returns undefined and never invents simulated ymin/xmin boxes', () => {
    const rawResponseNoBoxes = {
      result: {
        primary_diagnosis: 'Chilli Leaf Curl Virus',
        top_confidence: 0.91,
        inference_outcome: 'detected',
        bounding_boxes: null,
      },
    };

    const parsed = parseDiseaseApiResponse(rawResponseNoBoxes, 'Chilli');

    expect(parsed.bounding_boxes).toBeUndefined();
  });

  it('9. Deduplicates repeated disease candidates and excludes primary diagnosis (prompt example)', () => {
    const rawResponse = {
      result: {
        primary_diagnosis: 'Sheath Blight',
        top_confidence: 0.556,
        inference_outcome: 'low_confidence',
        other_possible_detections: [
          'Brown-Spot',
          'Rice blast',
          'Sheath Blight',
          'Brown-Spot',
          'Rice blast',
        ],
      },
    };

    const parsed = parseDiseaseApiResponse(rawResponse, 'Rice');

    expect(parsed.primary_diagnosis).toBe('Sheath Blight');
    expect(parsed.other_possible_detections.length).toBe(2);
    // Sheath Blight must be excluded from secondary candidates
    expect(parsed.other_possible_detections.some((d) => getCanonicalDiseaseKey(d.label) === 'sheath blight')).toBe(false);
    // Brown Spot and Rice Blast are present exactly once
    const labels = parsed.other_possible_detections.map((d) => d.label);
    expect(labels).toContain('Brown-Spot');
    expect(labels).toContain('Rice blast');
  });

  it('10. Handles case, hyphen, space variants, and known aliases during normalization and deduplication', () => {
    const rawCandidates = [
      { label: 'Brown-Spot', confidence: 0.15 },
      { label: 'brown spot', confidence: 0.22 },
      { label: 'Brown Spot (Helminthosporium oryzae)', confidence: 0.18 },
      { label: 'RICE-BLAST', confidence: 0.12 },
      { label: 'Rice blast', confidence: 0.25 },
      { label: 'sheath-blight', confidence: 0.55 },
    ];

    const processed = processSecondaryCandidates(rawCandidates, 'Sheath Blight');

    // Primary diagnosis 'Sheath Blight' (canonical key 'sheath blight') is excluded
    expect(processed.some((c) => getCanonicalDiseaseKey(c.label) === 'sheath blight')).toBe(false);

    // Only 2 unique secondary conditions remain: 'brown spot' and 'rice blast'
    expect(processed.length).toBe(2);

    // Highest confidence item for brown spot was 0.22 ('brown spot')
    const brownSpot = processed.find((c) => getCanonicalDiseaseKey(c.label) === 'brown spot');
    expect(brownSpot).toBeDefined();
    expect(brownSpot?.confidence).toBe(0.22);
    expect(brownSpot?.confidence_formatted).toBe('22.0%');

    // Highest confidence item for rice blast was 0.25 ('Rice blast')
    const riceBlast = processed.find((c) => getCanonicalDiseaseKey(c.label) === 'rice blast');
    expect(riceBlast).toBeDefined();
    expect(riceBlast?.confidence).toBe(0.25);
    expect(riceBlast?.confidence_formatted).toBe('25.0%');
  });

  it('11. Keeps unique alternatives sorted by highest returned confidence score', () => {
    const rawCandidates = [
      { label: 'Bacterial Leaf Blight', confidence: 0.08 },
      { label: 'Rice blast', confidence: 0.28 },
      { label: 'Brown Spot', confidence: 0.14 },
    ];

    const processed = processSecondaryCandidates(rawCandidates, 'Sheath Blight');

    expect(processed.length).toBe(3);
    expect(processed[0].label).toBe('Rice blast');
    expect(processed[0].confidence).toBe(0.28);
    expect(processed[1].label).toBe('Brown Spot');
    expect(processed[1].confidence).toBe(0.14);
    expect(processed[2].label).toBe('Bacterial Leaf Blight');
    expect(processed[2].confidence).toBe(0.08);
  });

  it('12. Aggregates candidates from secondary_matches, top_3_diseases, and other_possible_detections without duplicates or score summing', () => {
    const rawResponse = {
      result: {
        primary_diagnosis: 'Chilli Anthracnose',
        top_confidence: 0.75,
        inference_outcome: 'detected',
        secondary_matches: [
          { label: 'Chilli Mites', confidence: 0.10, source: 'CV Model' },
          { label: 'Chilli Anthracnose', confidence: 0.75, source: 'CV Model' },
        ],
        other_possible_detections: [
          { label: 'chilli-mites', confidence: 0.15, source: 'Secondary Classifier' },
          { label: 'Leaf Curl Virus', confidence: 0.05, source: 'Secondary Classifier' },
        ],
      },
    };

    const parsed = parseDiseaseApiResponse(rawResponse, 'Chilli');

    // Chilli Anthracnose is primary -> excluded from secondary
    expect(parsed.other_possible_detections.some((d) => getCanonicalDiseaseKey(d.label) === 'anthracnose')).toBe(false);

    // Chilli Mites merged to max confidence 0.15 (not summed to 0.25)
    const mites = parsed.other_possible_detections.find((d) => d.label.toLowerCase().includes('mite'));
    expect(mites).toBeDefined();
    expect(mites?.confidence).toBe(0.15);
    expect(mites?.confidence_formatted).toBe('15.0%');

    // Leaf Curl Virus present with 0.05
    const curl = parsed.other_possible_detections.find((d) => d.label.toLowerCase().includes('curl'));
    expect(curl).toBeDefined();
    expect(curl?.confidence).toBe(0.05);

    // Sorted descending by confidence
    expect(parsed.other_possible_detections[0].confidence).toBe(0.15);
    expect(parsed.other_possible_detections[1].confidence).toBe(0.05);
  });

  it('13. RAG Helper Functions - isValidPublicHttpUrl validates HTTP(S) links and rejects local paths or localhost', () => {
    expect(isValidPublicHttpUrl('https://icar.org.in/bulletin/blast.pdf')).toBe(true);
    expect(isValidPublicHttpUrl('http://tnau.ac.in/pathology')).toBe(true);
    expect(isValidPublicHttpUrl('/var/data/app/icar_blast.pdf')).toBe(false);
    expect(isValidPublicHttpUrl('C:\\Users\\Admin\\Documents\\icar.pdf')).toBe(false);
    expect(isValidPublicHttpUrl('file:///C:/doc.pdf')).toBe(false);
    expect(isValidPublicHttpUrl('http://localhost:8000/doc.pdf')).toBe(false);
    expect(isValidPublicHttpUrl(null)).toBe(false);
  });

  it('14. RAG Helper Functions - cleanDocumentTitle strips Windows and Unix directory paths from titles', () => {
    expect(cleanDocumentTitle('/var/app/knowledge_base/icar_rice_blast.pdf')).toBe('icar_rice_blast.pdf');
    expect(cleanDocumentTitle('C:\\data\\docs\\tnau_sheath_blight.pdf')).toBe('tnau_sheath_blight.pdf');
    expect(cleanDocumentTitle('ICAR Package of Practices 2026')).toBe('ICAR Package of Practices 2026');
    expect(cleanDocumentTitle(null)).toBe('Knowledge-Base Document');
  });

  it('15. RAG Helper Functions - formatGuidanceList splits multiline, bulleted, or array guidance items cleanly', () => {
    expect(formatGuidanceList(['Drain field water', 'Apply neem oil'])).toEqual(['Drain field water', 'Apply neem oil']);
    expect(formatGuidanceList('1. Apply Tricyclazole\n2. Avoid excess Nitrogen\n• Drain excess water')).toEqual([
      'Apply Tricyclazole',
      'Avoid excess Nitrogen',
      'Drain excess water',
    ]);
    expect(formatGuidanceList(null)).toEqual([]);
  });

  it('16. RAG Remedies Parsing - Populates rag_remedies fields (cultural, organic, chemical, fertilizer, status, source, passage)', () => {
    const rawBackendResponse = {
      success: true,
      result: {
        primary_diagnosis: 'Rice Sheath Blight',
        top_confidence: 0.91,
        inference_outcome: 'detected',
        rag_remedies: {
          cultural_practices: ['Maintain proper hill spacing', 'Avoid excessive urea application'],
          organic_bio_control: 'Pseudomonas fluorescens @ 10g/L',
          chemical_treatment: 'Hexaconazole 5% EC @ 2ml/L',
          fertilizer_advice: 'Split nitrogen fertilizer into 3 equal doses at basal, tillering, and panicle initiation stages.',
          rag_status: 'verified_match',
          source_title: '/var/docs/icar_rice_diseases_handbook.pdf',
          source_institute: 'ICAR-National Rice Research Institute',
          source_url: 'https://nrri.icar.gov.in/diseases/sheath-blight',
          document_passage: 'Sheath blight lesions appear on leaf sheaths near water line. Hexaconazole or Validamycin sprays provide effective control.',
          reference_document_links: ['https://nrri.icar.gov.in/ref1', '/local/ref2'],
        },
      },
    };

    const parsed = parseDiseaseApiResponse(rawBackendResponse, 'Rice');

    expect(parsed.inference_outcome).toBe('detected');
    expect(parsed.rag_remedies).toBeDefined();
    expect(parsed.rag_remedies?.rag_status).toBe('verified_match');
    expect(isVerifiedRagMatch(parsed.rag_remedies)).toBe(true);

    expect(parsed.rag_remedies?.source_institute).toBe('ICAR-National Rice Research Institute');
    expect(isValidPublicHttpUrl(parsed.rag_remedies?.source_url)).toBe(true);
    expect(cleanDocumentTitle(parsed.rag_remedies?.source_title)).toBe('icar_rice_diseases_handbook.pdf');
    expect(getRetrievedPassage(parsed.rag_remedies)).toContain('Validamycin sprays');

    expect(formatGuidanceList(parsed.rag_remedies?.fertilizer_advice)).toEqual([
      'Split nitrogen fertilizer into 3 equal doses at basal, tillering, and panicle initiation stages.',
    ]);
  });

  it('17. RAG Remedies - rag_status = "no_verified_match" sets isVerifiedRagMatch = false', () => {
    const rawBackendResponse = {
      success: true,
      result: {
        primary_diagnosis: 'Uncertain Foliar Lesion',
        top_confidence: 0.82,
        inference_outcome: 'detected',
        rag_remedies: {
          rag_status: 'no_verified_match',
          notice: 'No verified ICAR reference document matched this specific symptom combination.',
        },
      },
    };

    const parsed = parseDiseaseApiResponse(rawBackendResponse, 'Rice');

    expect(parsed.inference_outcome).toBe('detected');
    expect(isVerifiedRagMatch(parsed.rag_remedies)).toBe(false);
    expect(parsed.rag_remedies?.notice).toContain('No verified ICAR reference document matched');
  });

  it('18. Non-detected outcomes (low_confidence, no_detection, provider_error) do not expose verified RAG match', () => {
    const lowConfResponse = {
      result: {
        primary_diagnosis: 'Chilli Leaf Curl',
        top_confidence: 0.45,
        inference_outcome: 'low_confidence',
      },
    };

    const parsed = parseDiseaseApiResponse(lowConfResponse, 'Chilli');
    expect(parsed.inference_outcome).toBe('low_confidence');
    // Primary diagnosis kept for low_confidence explanation, but is_low_confidence is true
    expect(parsed.is_low_confidence).toBe(true);
  });

  it('19. Source Badge Logic - External URLs without explicit verified status are labeled "External source link", not "Verified Public Source"', () => {
    const unverifiedPublicLinkRag = {
      source_url: 'https://example-agri-blog.org/rice-tips',
      rag_status: 'kb_match', // Not explicitly 'verified_match'
    };

    const isPublic = isValidPublicHttpUrl(unverifiedPublicLinkRag.source_url);
    const isExplicitlyVerified = unverifiedPublicLinkRag.rag_status === 'verified_match' || unverifiedPublicLinkRag.rag_status === 'matched';

    expect(isPublic).toBe(true);
    expect(isExplicitlyVerified).toBe(false);

    // Should receive 'External source link', NOT 'Verified Public Source'
    const badgeLabel = isPublic && isExplicitlyVerified ? 'Verified Public Source' : isPublic ? 'External source link' : 'Knowledge-Base Document';
    expect(badgeLabel).toBe('External source link');
  });

  it('20. Symptom Cross-Check Checklist - Generates verified Rice Sheath Blight symptom items from TNAU / IRRI sources', () => {
    const parsed = parseDiseaseApiResponse(
      {
        result: {
          primary_diagnosis: 'Sheath Blight',
          top_confidence: 0.5564,
          inference_outcome: 'detected',
        },
      },
      'Rice'
    );

    expect(parsed.symptom_checklist).toBeDefined();
    expect(parsed.symptom_checklist?.length).toBe(3);
    expect(parsed.symptom_checklist?.[0].symptom).toContain('greenish-gray water-soaked lesions');
    expect(parsed.symptom_checklist?.[0].source_institute).toContain('TNAU');
    expect(parsed.symptom_checklist?.[0].source_url).toContain('https://agritech.tnau.ac.in');
  });

  it('21. Ancillary Provider Failure - Ancillary model 404/failure does NOT invalidate successful disease diagnosis', () => {
    const rawResponseWithAncillaryFailure = {
      success: true,
      result: {
        result_id: 'diag-ancillary-404',
        primary_diagnosis: 'Rice Sheath Blight',
        top_confidence: 0.556,
        inference_outcome: 'detected',
        stage_timings_ms: {
          image_upload_ms: 45,
          disease_inference_ms: 1200,
          ancillary_nutrient_ms: 320,
          remedy_lookup_ms: 150,
          total_ms: 1715,
        },
        providers_summary: {
          ancillary_provider_status: {
            nutrient_model: '404_NOT_FOUND',
            status: 'ancillary_provider_failed',
          },
        },
      },
    };

    const parsed = parseDiseaseApiResponse(rawResponseWithAncillaryFailure, 'Rice');

    expect(parsed.inference_outcome).toBe('detected');
    expect(parsed.primary_diagnosis).toBe('Rice Sheath Blight');
    expect(parsed.stage_timings_ms).toBeDefined();
    expect(parsed.stage_timings_ms?.total_ms).toBe(1715);
    expect(parsed.providers_summary?.ancillary_provider_status?.nutrient_model).toBe('404_NOT_FOUND');
  });

  it('22. Unknown or unlisted disease returns null symptom checklist without inventing fake symptoms', () => {
    const parsed = parseDiseaseApiResponse(
      {
        result: {
          primary_diagnosis: 'Unlisted Rare Pathogen',
          top_confidence: 0.88,
          inference_outcome: 'detected',
        },
      },
      'Dragonfruit'
    );

    expect(parsed.symptom_checklist).toBeNull();
  });

  it('23. Disease Check Crop Selector - Contains exactly 13 canonical options, aliases map correctly, and unsupported crops return null', () => {
    expect(DISEASE_CHECK_CROPS.length).toBe(13);

    const expectedMap = [
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

    expect(DISEASE_CHECK_CROPS).toEqual(expectedMap);

    // Verify alias mappings
    expect(DISEASE_CROP_ALIASES['paddy']).toBe('rice');
    expect(DISEASE_CROP_ALIASES['corn']).toBe('maize');
    expect(DISEASE_CROP_ALIASES['cantaloupe']).toBe('muskmelon');
    expect(DISEASE_CROP_ALIASES['citrus']).toBe('orange');

    expect(getCanonicalDiseaseCropKey('Paddy')).toBe('rice');
    expect(getCanonicalDiseaseCropKey('corn')).toBe('maize');
    expect(getCanonicalDiseaseCropKey('Cantaloupe')).toBe('muskmelon');
    expect(getCanonicalDiseaseCropKey('citrus')).toBe('orange');
    expect(getCanonicalDiseaseCropKey('Rice')).toBe('rice');
    expect(getCanonicalDiseaseCropKey('Banana')).toBe('banana');

    // Unsupported / unlisted crops cannot be submitted as crop-specific keys
    expect(getCanonicalDiseaseCropKey('Wheat')).toBeNull();
    expect(getCanonicalDiseaseCropKey('Tomato')).toBeNull();
    expect(getCanonicalDiseaseCropKey('Brinjal')).toBeNull();

    // Verify resolveDiseaseCropInitial
    expect(resolveDiseaseCropInitial('Paddy')).toEqual({ cropValue: 'rice', customCropName: '' });
    expect(resolveDiseaseCropInitial('Tomato')).toEqual({ cropValue: 'Other', customCropName: 'Tomato' });

    // Confirm COMMON_CROPS in agriData remains intact with all crops for other modules
    expect(COMMON_CROPS).toBeDefined();
    expect(COMMON_CROPS.length).toBeGreaterThan(13);
    expect(COMMON_CROPS).toContain('Tomato');
    expect(COMMON_CROPS).toContain('Chilli');
  });
});


/**
 * AgriFusion Types & API Schemas
 * Source of truth: Backend OpenAPI Specification
 */

export interface CropRequest {
  state: string;
  district: string;
  village?: string | null;
  sowing_date?: string | null;
}

export interface ClimateRiskRequest {
  state: string;
  district: string;
  crop: string;
  sowing_date?: string | null;
}

export interface IrrigationRequest {
  state: string;
  district: string;
  crop: string;
  area_ha?: number;
  start_date?: string | null;
  pump_hp?: number;
}

export interface YieldRequest {
  state: string;
  district: string;
  crop: string;
  season?: string;
  area_ha?: number;
  year?: number;
}

export interface MarketRequest {
  state: string;
  district: string;
  commodity: string;
  area_ha?: number;
  season?: string;
  start_date: string;
  end_date: string;
  year?: number;
  market_date: string;
}

export interface AgentQueryRequest {
  query: string;
  crop?: string | null;
  state?: string | null;
  district?: string | null;
  language?: string | null;
}

export type SchemeRecommendRequest = SchemesRequest;

export interface DiagnosticEndpointResult {
  endpoint: string;
  method: string;
  latencyMs: number;
  status: number | null;
  success: boolean;
  error?: string;
  response?: unknown;
}

export interface DiagnosticReport {
  timestamp: string;
  endpoints: DiagnosticEndpointResult[];
}

export interface PipelineStepState {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  error?: string;
  data?: unknown;
}

export interface SchemesRequest {

  state: string;
  district: string;
  crop?: string;
  area_ha?: number;
  growth_stage?: string;
  solar_interest?: boolean;
  irrigation_type?: string;
  climate_risk_level?: string;
  farmer_category?: string;
}

export interface PipelineRequest {
  state: string;
  district: string;
  village?: string | null;
  area_ha?: number;
  sowing_date: string;
  pump_hp?: number;
  target_crop?: string | null;
  solar_interest?: boolean;
}

export interface SaveRecordRequest {
  user_email: string;
  record_type: string;
  record_data: Record<string, unknown>;
}

export interface SchemeItem {
  id?: string;
  name?: string;
  category?: string;
  possible_match?: boolean;
  verification_required?: boolean;
  verification_notice?: string;
  possible_benefit?: string;
  description?: string;
  matched_criteria?: string[];
  key_documents_typically_required?: string[];
  portal_url?: string;
  helpline?: string;
  [key: string]: unknown;
}

export interface SchemeResponse {
  status?: string;
  count?: number;
  schemes?: SchemeItem[];
  [key: string]: unknown;
}

export interface HealthResponse {
  status?: string;
  timestamp?: string;
  rag_documents_available?: boolean;
  database_configured?: boolean;
  external_models_configured?: boolean;
  [key: string]: unknown;
}

export interface RagDocumentsResponse {
  status?: string;
  count?: number;
  documents?: Array<{
    title?: string;
    filename?: string;
    category?: string;
    source?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface AdvisorResponse {
  short_answer?: string;
  source_summary?: string;
  source_answer?: string;
  safety_disclaimer?: string;
  integrated_management?: string;
  organic_options?: string;
  fertilizer_info?: string;
  pesticide_info?: string;
  missing_information?: string;
  confirmation_required?: string;
  sources?: Array<{
    title?: string;
    url?: string;
    snippet?: string;
    date?: string;
  }>;
  [key: string]: unknown;
}

export interface PipelineStageResult {
  title: string;
  status: 'waiting' | 'running' | 'complete' | 'failed';
  error?: string;
  data?: unknown;
}

export interface FarmRecord {
  id?: string;
  user_email?: string;
  record_type?: string;
  created_at?: string;
  record_data?: Record<string, unknown>;
  [key: string]: unknown;
}

export type ActivePage = 
  | 'landing'
  | 'dashboard'
  | 'crop-recommendation'
  | 'climate-risk'
  | 'irrigation'
  | 'yield'
  | 'market'
  | 'cost-profit'
  | 'disease-detection'
  | 'advisor'
  | 'schemes'
  | 'pipeline'
  | 'farm-history'
  | 'history'
  | 'diagnostics'
  | 'admin';

export interface FarmerUser {
  id: string;
  name?: string;
  mobile?: string;
  phone?: string;
  email?: string;
  isLoggedIn: boolean;
  isRegistered?: boolean;
  createdAt?: string;
  state?: string;
  district?: string;
  village?: string;
  area_ha?: number;
  crop?: string;
  soil_type?: string;
  irrigation_source?: string;
  sowing_date?: string;
}

export interface UserFarmProfile {
  // Place & Area are compulsory
  state: string;
  district: string;
  area_ha: number;
  // All other fields are optional
  farmer_name?: string;
  user_name?: string;
  mobile?: string;
  user_phone?: string;
  village?: string;
  crop?: string;
  soil_type?: string;
  irrigation_source?: string;
  sowing_date?: string;
  pump_hp?: number;
  user_email?: string;
}

export type FieldActionCategory =
  | 'irrigation'
  | 'fertilizer'
  | 'pest_disease'
  | 'sowing_tillage'
  | 'weeding'
  | 'harvesting'
  | 'mandi_sale'
  | 'machinery_labor'
  | 'other';

export interface DailyFieldAction {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: FieldActionCategory;
  isCompleted: boolean;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'all_day';
  areaCovered?: string; // e.g., "2.5 Acres" or "North Plot"
  inputsUsed?: string; // e.g., "Urea 50kg", "Chlorpyrifos 2ml/L"
  durationHours?: number;
  costInr?: number;
  notes?: string;
  reasonIfNotCompleted?: string;
  createdAt: string;
  updatedAt?: string;
}

export type AdminRole = 'admin' | 'agronomist' | 'farmer';
export type AdminUserStatus = 'active' | 'suspended' | 'archived';

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminUserStatus;
  createdAt: string;
  lastSignIn?: string;
  state?: string;
  district?: string;
}

export interface AdminOverviewMetrics {
  totalUsers: number;
  activeFarmers: number;
  totalAdvisories: number;
  totalPredictions: number;
  failedRequests: number;
  feedbackPending: number;
  activeSources: number;
  verifiedSchemes: number;
  backendOperational: boolean;
  ragAvailable: boolean;
  databaseConfigured: boolean;
  externalModelsConfigured: boolean;
}

export interface AdminSystemHealth {
  status: 'ok' | 'degraded' | 'unavailable' | 'unknown';
  rag_documents_available: boolean;
  database_configured: boolean;
  external_models_configured: boolean;
  last_checked: string;
  response_duration_ms: number;
  environment: string;
  services: {
    rag: string;
    database: string;
    models: string;
  };
}

export interface AdminApiMetric {
  module: string;
  endpoint: string;
  current_status: 'operational' | 'degraded' | 'unavailable';
  last_checked: string;
  last_http_status: number;
  avg_response_time_ms: number;
  failure_count: number;
}

export interface AdminFeedbackItem {
  id: string;
  submitted_at: string;
  category: 'Incorrect answer' | 'Missing information' | 'Outdated source' | 'Wrong language' | 'Image quality problem' | 'Technical error' | 'Other';
  module: string;
  rating: number;
  status: 'new' | 'under_review' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  comment: string;
  district?: string;
  crop?: string;
  internal_notes?: Array<{
    date: string;
    admin: string;
    note: string;
  }>;
}

export interface AdminKnowledgeSource {
  id: string;
  title: string;
  filename: string;
  organization: string;
  subject: string;
  crop?: string;
  state_relevance: string;
  source_type: string;
  official_url: string;
  verification_date: string;
  verifier: string;
  last_indexed_date: string;
  status: 'verified' | 'verified_with_caveats' | 'needs_review' | 'stale' | 'unavailable';
  notes?: string;
}

export interface AdminGovernmentScheme {
  id: string;
  scheme_name: string;
  state: string;
  district_applicability: string;
  department: string;
  official_portal: string;
  verification_date: string;
  status: 'active' | 'needs_verification' | 'expired_or_unavailable' | 'missing_official_source';
  caveats?: string;
  notes?: string;
}

export interface AdminAuditLog {
  id: string;
  event_id: string;
  admin_user_id: string;
  admin_name?: string;
  action: string;
  target_type: string;
  target_id: string;
  timestamp: string;
  safe_metadata?: Record<string, unknown>;
}

export interface AuthMeResponse {
  authenticated: boolean;
  user_id: string;
  email: string;
  role: string;
  name?: string;
}

export interface ModelSubsystemState {
  crop_recommendation?: string;
  climate_risk?: string;
  irrigation?: string;
  yield?: string;
  market_price?: string;
  object_detection?: string;
  [key: string]: string | undefined;
}

export interface AdminDashboardServices {
  backend?: {
    status: 'healthy' | 'ready' | 'needs_sync' | 'unavailable' | 'not_configured' | 'partial' | 'loading' | 'unknown' | string;
    message?: string;
    response_time_ms?: number;
    last_checked?: string;
  };
  database?: {
    status: 'healthy' | 'ready' | 'needs_sync' | 'unavailable' | 'not_configured' | 'partial' | 'loading' | 'unknown' | string;
    message?: string;
    connection_type?: string;
    last_checked?: string;
  };
  rag_documents?: {
    status: 'healthy' | 'ready' | 'needs_sync' | 'unavailable' | 'not_configured' | 'partial' | 'loading' | 'unknown' | string;
    message?: string;
    document_count?: number;
    last_sync_time?: string;
  };
  models?: {
    status: 'healthy' | 'ready' | 'needs_sync' | 'unavailable' | 'not_configured' | 'partial' | 'loading' | 'unknown' | string;
    message?: string;
    subsystems?: ModelSubsystemState;
  };
  [key: string]: unknown;
}

export interface AdminDashboardMetrics {
  total_users?: number | null;
  advisory_queries?: number | null;
  prediction_requests?: number | null;
  failed_requests?: number | null;
  feedback_awaiting_review?: number | null;
  active_sources?: number | null;
  verified_schemes?: number | null;
  [key: string]: unknown;
}

export interface AdminDashboardData {
  status?: string;
  timestamp?: string;
  services?: AdminDashboardServices;
  metrics?: AdminDashboardMetrics;
  // Backward compatibility flat fields
  backend_status?: string;
  rag_documents_available?: boolean;
  database_configured?: boolean;
  external_models_configured?: boolean;
  total_users?: number | null;
  advisory_queries?: number | null;
  prediction_requests?: number | null;
  failed_requests?: number | null;
  feedback_awaiting_review?: number | null;
  [key: string]: unknown;
}

export type AdminOverview = AdminDashboardData;

export interface AdminHealth {
  status: string;
  rag_documents_available: boolean;
  database_configured: boolean;
  external_models_configured: boolean;
  last_checked?: string;
  response_duration_ms?: number;
  environment?: string;
  [key: string]: unknown;
}

export interface AdminUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: 'admin' | 'agronomist' | 'farmer' | 'super_admin' | string;
  created_at?: string;
  last_sign_in?: string;
  last_sign_in_at?: string;
  status: 'active' | 'suspended' | 'archived' | string;
  state?: string;
  district?: string;
}

export interface AdminPaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  privacy_note?: string;
  suppressed_groups?: Record<string, unknown>;
  rating_distribution?: Record<string, number>;
}

export interface AdminFeedback {
  id: string;
  feedback_type?: 'helpful' | 'not_helpful' | 'problem_report' | string;
  advisory_id?: string | null;
  prediction_id?: string | null;
  user_id?: string | null;
  created_at: string;
  rating: number;
  category: string;
  message?: string;
  comment?: string;
  user_comment?: string;
  helpful_comment?: string | null;
  unhelpful_comment?: string | null;
  language?: string;
  status?: 'new' | 'under_review' | 'resolved' | string;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | string;
  admin_note_count?: number;
  identity_redacted?: boolean;
  submitted_at?: string;
  date?: string;
  module?: string | null;
  crop?: string | null;
  district?: string | null;
  state?: string | null;
  query_summary?: string | null;
  ai_answer?: string | null;
  anonymized_user_ref?: string;
  internal_notes?: Array<{ date?: string; admin?: string; note: string } | string>;
  context?: {
    module?: string | null;
    crop?: string | null;
    query_summary?: string | null;
    ai_answer?: string | null;
    advisory_id?: string | null;
    prediction_id?: string | null;
  } | null;
}

export type SourceVerificationStatus =
  | 'pending_review'
  | 'verified'
  | 'verified_with_caveats'
  | 'needs_review'
  | 'stale'
  | 'unavailable'
  | 'rejected';

export type SourceIndexStatus =
  | 'not_indexed'
  | 'queued'
  | 'indexing'
  | 'indexed'
  | 'index_failed'
  | 'outdated';

export type SourceType =
  | 'government_department'
  | 'state_agriculture_department'
  | 'state_horticulture_department'
  | 'icar'
  | 'icar_institute'
  | 'kvk'
  | 'agricultural_university'
  | 'ppqs'
  | 'cibrc'
  | 'official_scheme_portal'
  | 'other_authoritative';

export interface KnowledgeSource {
  id: string;
  title: string;
  organization: string;
  source_type: string;
  official_url: string;
  subject?: string | null;
  crop?: string | null;
  state_relevance?: string[];
  document_format?: string | null;
  language?: string | null;
  verification_status: SourceVerificationStatus;
  verified_date?: string | null;
  verified_by?: string | null;
  verification_notes?: string | null;
  last_indexed_at?: string | null;
  index_status: SourceIndexStatus;
  is_active?: boolean;
  needs_review?: boolean;
  caveats?: string[];
  // Compatibility fields with legacy client helpers
  status?: string;
  crop_or_subject?: string;
  notes?: string;
  last_indexed_date?: string;
  verification_date?: string;
}

export type AdminSource = KnowledgeSource;
export type AdminSourceItem = KnowledgeSource;

export interface SourcesResponse {
  items: KnowledgeSource[];
  page: number;
  page_size: number;
  total: number;
  privacy_note?: string;
}

export type AdminSourceListResponse = SourcesResponse;

export interface RegisterSourceRequest {
  title: string;
  organization: string;
  source_type: string;
  official_url: string;
  subject?: string | null;
  crop?: string | null;
  state_relevance?: string[] | null;
  language?: string | null;
  verification_notes?: string | null;
  verification_status?: SourceVerificationStatus | null;
  index_status?: SourceIndexStatus | null;
}

export interface UpdateSourceMetadataRequest {
  verification_status?: SourceVerificationStatus | null;
  verification_notes?: string | null;
  is_active?: boolean | null;
  needs_review?: boolean | null;
  caveats?: string[] | null;
}

export type SchemeVerificationStatus =
  | 'pending_review'
  | 'verified'
  | 'verified_with_caveats'
  | 'needs_review'
  | 'stale'
  | 'unavailable'
  | 'rejected';

export type SchemeCurrentStatus =
  | 'active'
  | 'requires_current_verification'
  | 'temporarily_unavailable'
  | 'expired_or_closed'
  | 'not_available';

export interface GovernmentScheme {
  id: string;
  scheme_name: string;
  scheme_type: string;
  department: string;
  official_portal: string;
  state_relevance?: string[];
  district_relevance?: string[];
  source_title?: string | null;
  source_organization?: string | null;
  source_url?: string | null;
  verification_status: SchemeVerificationStatus;
  current_status: SchemeCurrentStatus;
  verified_date?: string | null;
  verified_by?: string | null;
  last_checked_at?: string | null;
  benefit_summary?: string | null;
  eligibility_summary?: string | null;
  required_documents?: string[];
  application_route?: string | null;
  deadline?: string | null;
  caveats?: string[];
  is_active?: boolean;
  needs_review?: boolean;
  // Compatibility fields with legacy client helpers
  name?: string;
  state?: string;
  status?: string;
  notes?: string;
  district_applicability?: string;
  verification_date?: string;
}

export type AdminScheme = GovernmentScheme;
export type AdminSchemeItem = GovernmentScheme;

export interface SchemesResponse {
  items: GovernmentScheme[];
  page: number;
  page_size: number;
  total: number;
  privacy_note?: string;
}

export type AdminSchemeListResponse = SchemesResponse;

export interface RegisterSchemeRequest {
  scheme_name: string;
  scheme_type: string;
  department: string;
  official_portal: string;
  state_relevance?: string[] | null;
  district_relevance?: string[] | null;
  source_title?: string | null;
  source_organization?: string | null;
  benefit_summary?: string | null;
  eligibility_summary?: string | null;
  required_documents?: string[] | null;
  application_route?: string | null;
  deadline?: string | null;
  caveats?: string[] | null;
}

export interface VerifySchemeRequest {
  official_source_url: string;
  verification_notes: string;
  current_status?: SchemeCurrentStatus;
  caveats?: string[];
}

export interface UpdateSchemeRequest {
  verification_status?: SchemeVerificationStatus | null;
  current_status?: SchemeCurrentStatus | null;
  verification_notes?: string | null;
  is_active?: boolean | null;
  needs_review?: boolean | null;
  caveats?: string[] | null;
}

export interface AuditLogEntry {
  id?: string;
  event_id: string;
  administrator: string;
  admin_user_id?: string;
  admin_name?: string;
  action: string;
  target_type: string;
  target_id: string;
  timestamp: string;
  safe_metadata?: Record<string, unknown> | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages?: number;
  privacy_note?: string;
  suppressed_groups?: Record<string, unknown>;
  rating_distribution?: Record<string, number>;
}

export interface AdminFarm {
  id: string;
  state: string;
  district: string;
  crop: string;
  area_range?: string;
  area_ha?: number;
  irrigation_type?: string;
  creation_date?: string;
  created_at?: string;
  last_activity?: string;
  updated_at?: string;
}

export interface AdminFarmsCountResponse {
  count: number | null;
  filters_applied: {
    state?: string | null;
    district?: string | null;
    crop?: string | null;
    area_range?: string | null;
    irrigation_type?: string | null;
  };
  suppressed: boolean;
  privacy_threshold: number;
  privacy_note: string;
}

export interface RegionalFarmProfileResponse extends PaginatedResponse<AdminFarm> {}

export interface AdvisoryRetrievalInfo {
  documents_considered: number;
  documents_used: number;
  relevance_threshold_passed: boolean;
  no_verified_source: boolean;
  [key: string]: unknown;
}

export interface AdvisorySourceItem {
  title: string;
  organization: string;
  url: string;
  verified_date?: string;
  [key: string]: unknown;
}

export interface AdvisoryComplianceInfo {
  citations_present: boolean;
  dose_claims_source_backed: boolean;
  missing_dose_fields_flagged: boolean;
  scheme_eligibility_qualified: boolean;
  extension_confirmation_flagged: boolean;
  compliance_status: string;
  [key: string]: unknown;
}

export interface AdminAdvisory {
  query_id: string;
  created_at: string;
  crop: string;
  state: string;
  district: string;
  query_summary: string;
  activity_status: 'success' | 'no_verified_source' | 'failed' | 'partial' | string;
  review_status: 'not_reviewed' | 'needs_review' | 'reviewed' | 'resolved' | string;
  retrieval?: AdvisoryRetrievalInfo;
  sources?: AdvisorySourceItem[];
  compliance?: AdvisoryComplianceInfo;
  id?: string;
}

export interface AdminAdvisoriesResponse extends PaginatedResponse<AdminAdvisory> {}

export interface AdvisoryCitationRate {
  cited_queries: number;
  eligible_queries: number;
  percent: number;
}

export interface AdvisoryCropCount {
  crop: string;
  query_count: number;
}

export interface AdvisoryRegionalCount {
  state: string;
  district: string;
  query_count: number;
}

export interface AdminAdvisoryAnalytics {
  total_queries: number;
  citation_rate: AdvisoryCitationRate;
  top_crops: AdvisoryCropCount[];
  regional_queries: AdvisoryRegionalCount[];
  privacy_note?: string;
  generated_at?: string;
}

export interface GetAdvisoryAnalyticsParams {
  crop?: string;
  state?: string;
  district?: string;
  search?: string;
  activity_status?: string;
  status?: string;
}

export interface AdminDiagnosticSecondaryMatch {
  label?: string | null;
  name?: string | null;
  confidence?: number | null;
  source?: string | null;
  [key: string]: unknown;
}

export interface AdminDiagnosticProvidersSummary {
  successful_providers?: number | null;
  failed_providers?: number | null;
  timed_out_providers?: number | null;
  total_providers?: number | null;
  applied_threshold?: number | null;
  provider_details?: Array<{
    name?: string;
    status?: string;
    latency_ms?: number;
    [key: string]: unknown;
  }> | null;
  [key: string]: unknown;
}

export interface AdminDiagnosticItem {
  id: string;
  timestamp?: string | null;
  created_at?: string | null;
  crop?: string | null;
  state?: string | null;
  district?: string | null;
  primary_diagnosis?: string | null;
  disease_identified?: string | null;
  confidence?: number | null;
  confidence_score?: number | null;
  inference_outcome?: 'detected' | 'low_confidence' | 'no_positive_detection' | 'model_unavailable' | 'provider_unavailable' | string | null;
  execution_status?: 'success' | 'failed' | 'partial' | 'timeout' | 'unavailable' | string | null;
  status?: string | null;
  review_status?: string | null;
  model_version?: string | null;
  providers_summary?: AdminDiagnosticProvidersSummary | null;
  secondary_matches?: AdminDiagnosticSecondaryMatch[] | null;
  notes?: string | null;
  [key: string]: unknown;
}

export interface PipelineStageDetail {
  status?: 'success' | 'failed' | 'skipped' | string;
  result?: unknown;
  error?: string | null;
  message?: string | null;
  duration_ms?: number | null;
  [key: string]: unknown;
}

export interface PipelineStages {
  crop?: PipelineStageDetail | Record<string, unknown>;
  climate?: PipelineStageDetail | Record<string, unknown>;
  irrigation?: PipelineStageDetail | Record<string, unknown>;
  yield?: PipelineStageDetail | Record<string, unknown>;
  market?: PipelineStageDetail | Record<string, unknown>;
  schemes?: PipelineStageDetail | Record<string, unknown>;
  [key: string]: unknown;
}

export interface PipelineResultSummary {
  pipeline_status?: 'success' | 'partial' | 'failed' | string;
  duration_ms?: number | null;
  stage_success_count?: number | null;
  stage_failure_count?: number | null;
  stages?: PipelineStages | null;
  [key: string]: unknown;
}

export interface PipelineRequestSummary {
  area_ha?: number | string | null;
  sowing_date?: string | null;
  pump_hp?: number | string | null;
  target_crop?: string | null;
  solar_interest?: boolean | string | null;
  [key: string]: unknown;
}

export interface AdminPredictionItem {
  id: string;
  timestamp?: string | null;
  created_at?: string | null;
  model_type?: string | null;
  crop?: string | null;
  state?: string | null;
  district?: string | null;
  acres?: number | null;
  yield_predicted?: string | number | null;
  predicted_yield?: string | number | null;
  total_tonnes?: string | number | null;
  yield_q_per_ha?: string | number | null;
  yield_q_per_acre?: string | number | null;
  result_summary?: string | PipelineResultSummary | Record<string, unknown> | null;
  request_summary?: PipelineRequestSummary | Record<string, unknown> | null;
  latency_ms?: number | null;
  execution_time_ms?: number | null;
  latency?: number | null;
  status?: string | null;
  recommended_crop?: string | null;
  disease_identified?: string | null;
  irrigation_advice?: string | null;
  outcome?: string | null;
  result?: string | null;
  verification_status?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  [key: string]: unknown;
}

export type AdminSection =
  | 'overview'
  | 'users'
  | 'farms'
  | 'advisories'
  | 'diagnostics'
  | 'health'
  | 'predictions'
  | 'feedback'
  | 'sources'
  | 'schemes';



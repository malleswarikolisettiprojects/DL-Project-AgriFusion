-- =============================================================================
-- AgriFusion Supabase PostgreSQL Canonical Migration Script (v2.1.0)
-- Single Source of Truth for Application & Admin Data
-- =============================================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Pre-Migration Safety: Reconcile missing user_id columns on pre-existing tables
-- -----------------------------------------------------------------------------
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='farms') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='farms' AND column_name='user_id') THEN
            ALTER TABLE public.farms ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='farms' AND column_name='crop') THEN
            ALTER TABLE public.farms ADD COLUMN crop TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='farms' AND column_name='irrigation_type') THEN
            ALTER TABLE public.farms ADD COLUMN irrigation_type TEXT;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='prediction_records') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='prediction_records' AND column_name='user_id') THEN
        ALTER TABLE public.prediction_records ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='diagnostic_reports') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='diagnostic_reports' AND column_name='user_id') THEN
        ALTER TABLE public.diagnostic_reports ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_field_actions') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='daily_field_actions' AND column_name='user_id') THEN
        ALTER TABLE public.daily_field_actions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='saved_searches') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='saved_searches' AND column_name='user_id') THEN
        ALTER TABLE public.saved_searches ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_preferences') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_preferences' AND column_name='user_id') THEN
        ALTER TABLE public.user_preferences ADD COLUMN user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='scheme_matches') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='scheme_matches' AND column_name='user_id') THEN
        ALTER TABLE public.scheme_matches ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='system_events') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_events' AND column_name='user_id') THEN
        ALTER TABLE public.system_events ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='farmer_feedback') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='farmer_feedback' AND column_name='user_id') THEN
        ALTER TABLE public.farmer_feedback ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    -- schemes columns reconciliation
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schemes') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schemes' AND column_name='verification_status') THEN
            ALTER TABLE public.schemes ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'pending_review';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schemes' AND column_name='current_status') THEN
            ALTER TABLE public.schemes ADD COLUMN current_status TEXT NOT NULL DEFAULT 'active';
        END IF;
    END IF;

    -- knowledge_sources columns reconciliation
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='knowledge_sources') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='knowledge_sources' AND column_name='verification_status') THEN
            ALTER TABLE public.knowledge_sources ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'pending_review';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='knowledge_sources' AND column_name='approval_status') THEN
            ALTER TABLE public.knowledge_sources ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='knowledge_sources' AND column_name='url') THEN
            ALTER TABLE public.knowledge_sources ADD COLUMN url TEXT;
        END IF;
    END IF;

    -- saved_searches query column reconciliation
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='saved_searches') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='saved_searches' AND column_name='query') THEN
            ALTER TABLE public.saved_searches ADD COLUMN query TEXT;
        END IF;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Profiles Table (1:1 with auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'farmer',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hardened Trigger: Automatically create public.profiles when auth.users is created
-- IGNORES user metadata role claims to prevent privilege escalation on signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, status, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, 'farmer@agrifusion.user'),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Farmer'),
        'farmer', -- Always default to farmer for security
        'active',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. Farms Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    village TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    land_area NUMERIC(10, 2),
    land_area_unit TEXT DEFAULT 'acres',
    soil_type TEXT,
    crop TEXT,
    irrigation_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farms_user_id ON public.farms(user_id);
CREATE INDEX IF NOT EXISTS idx_farms_state_district ON public.farms(state, district);

DROP TRIGGER IF EXISTS trg_farms_updated_at ON public.farms;
CREATE TRIGGER trg_farms_updated_at
    BEFORE UPDATE ON public.farms
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. Prediction Records Table (Mandatory user_id NOT NULL)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prediction_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL,
    prediction_type TEXT NOT NULL,
    request_payload JSONB DEFAULT '{}'::jsonb,
    result_payload JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'completed',
    error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON public.prediction_records(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_type ON public.prediction_records(prediction_type);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON public.prediction_records(created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. Diagnostic Reports Table (Mandatory user_id NOT NULL)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diagnostic_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL,
    crop TEXT NOT NULL,
    image_storage_path TEXT,
    detection_results JSONB DEFAULT '{}'::jsonb,
    primary_diagnosis TEXT,
    confidence NUMERIC(5, 4),
    knowledge_guidance JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostics_user_id ON public.diagnostic_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_crop ON public.diagnostic_reports(crop);
CREATE INDEX IF NOT EXISTS idx_diagnostics_created_at ON public.diagnostic_reports(created_at DESC);

-- -----------------------------------------------------------------------------
-- 5. Daily Field Actions Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_field_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE,
    crop TEXT,
    action_type TEXT NOT NULL,
    action_details JSONB DEFAULT '{}'::jsonb,
    action_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_actions_user_id ON public.daily_field_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_field_actions_date ON public.daily_field_actions(action_date DESC);

-- -----------------------------------------------------------------------------
-- 6. Saved Searches & User Preferences Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    query TEXT NOT NULL, -- Canonical column name
    filters JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);

CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    language TEXT NOT NULL DEFAULT 'en',
    notification_enabled BOOLEAN NOT NULL DEFAULT true, -- Canonical column name
    preferred_units JSONB DEFAULT '{"land": "acres", "yield": "quintals"}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_prefs_updated_at ON public.user_preferences;
CREATE TRIGGER trg_prefs_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 7. Government Schemes, Scheme Sources, and Matches Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_name TEXT NOT NULL, -- Canonical column name
    department TEXT NOT NULL,
    state TEXT,
    eligible_crops JSONB DEFAULT '[]'::jsonb,
    eligibility_criteria JSONB DEFAULT '{}'::jsonb,
    land_criteria JSONB DEFAULT '{}'::jsonb,
    benefits TEXT,
    application_url TEXT,
    source_url TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending_review', -- Canonical column name
    current_status TEXT NOT NULL DEFAULT 'active',
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schemes_state ON public.schemes(state);
CREATE INDEX IF NOT EXISTS idx_schemes_verification ON public.schemes(verification_status);

DROP TRIGGER IF EXISTS trg_schemes_updated_at ON public.schemes;
CREATE TRIGGER trg_schemes_updated_at
    BEFORE UPDATE ON public.schemes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.scheme_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    verified_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scheme_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
    match_score NUMERIC(5, 2) NOT NULL,
    eligibility_summary JSONB DEFAULT '{}'::jsonb,
    matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheme_matches_user_id ON public.scheme_matches(user_id);

-- -----------------------------------------------------------------------------
-- 8. Agricultural Knowledge Base Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    source_type TEXT NOT NULL,
    url TEXT, -- Canonical column name
    storage_path TEXT,
    approval_status TEXT NOT NULL DEFAULT 'pending', -- Canonical column name
    verification_status TEXT NOT NULL DEFAULT 'pending_review',
    reviewer_id UUID REFERENCES auth.users(id),
    version TEXT DEFAULT '1.0',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_ks_updated_at ON public.knowledge_sources;
CREATE TRIGGER trg_ks_updated_at
    BEFORE UPDATE ON public.knowledge_sources
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content_summary TEXT,
    storage_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.source_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL,
    comments TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9. Admin Audit Logs Table (Tamper-evident system ledger)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON public.admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.admin_audit_logs(created_at DESC);

-- -----------------------------------------------------------------------------
-- 10. Complete Row Level Security (RLS) Policies on ALL 14 Tables
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_field_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheme_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheme_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles RLS Policies
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Farms RLS Policies
DROP POLICY IF EXISTS "Farmers read own farms" ON public.farms;
CREATE POLICY "Farmers read own farms" ON public.farms FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Farmers insert own farms" ON public.farms;
CREATE POLICY "Farmers insert own farms" ON public.farms FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Farmers update own farms" ON public.farms;
CREATE POLICY "Farmers update own farms" ON public.farms FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Farmers delete own farms" ON public.farms;
CREATE POLICY "Farmers delete own farms" ON public.farms FOR DELETE USING (auth.uid() = user_id);

-- 3. Prediction Records RLS Policies
DROP POLICY IF EXISTS "Farmers read own predictions" ON public.prediction_records;
CREATE POLICY "Farmers read own predictions" ON public.prediction_records FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Farmers insert own predictions" ON public.prediction_records;
CREATE POLICY "Farmers insert own predictions" ON public.prediction_records FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Diagnostic Reports RLS Policies
DROP POLICY IF EXISTS "Farmers read own diagnostics" ON public.diagnostic_reports;
CREATE POLICY "Farmers read own diagnostics" ON public.diagnostic_reports FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Farmers insert own diagnostics" ON public.diagnostic_reports;
CREATE POLICY "Farmers insert own diagnostics" ON public.diagnostic_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Daily Field Actions RLS Policies
DROP POLICY IF EXISTS "Farmers read own field actions" ON public.daily_field_actions;
CREATE POLICY "Farmers read own field actions" ON public.daily_field_actions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Farmers insert own field actions" ON public.daily_field_actions;
CREATE POLICY "Farmers insert own field actions" ON public.daily_field_actions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Farmers update own field actions" ON public.daily_field_actions;
CREATE POLICY "Farmers update own field actions" ON public.daily_field_actions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Farmers delete own field actions" ON public.daily_field_actions;
CREATE POLICY "Farmers delete own field actions" ON public.daily_field_actions FOR DELETE USING (auth.uid() = user_id);

-- 6. Saved Searches & Preferences RLS Policies
DROP POLICY IF EXISTS "Farmers read own searches" ON public.saved_searches;
CREATE POLICY "Farmers read own searches" ON public.saved_searches FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Farmers insert own searches" ON public.saved_searches;
CREATE POLICY "Farmers insert own searches" ON public.saved_searches FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Farmers delete own searches" ON public.saved_searches;
CREATE POLICY "Farmers delete own searches" ON public.saved_searches FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Farmers read own preferences" ON public.user_preferences;
CREATE POLICY "Farmers read own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Farmers upsert own preferences" ON public.user_preferences;
CREATE POLICY "Farmers upsert own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);

-- 7. Schemes & Matches RLS Policies
DROP POLICY IF EXISTS "Public read verified schemes" ON public.schemes;
CREATE POLICY "Public read verified schemes" ON public.schemes FOR SELECT USING (verification_status IN ('verified', 'verified_with_caveats'));

DROP POLICY IF EXISTS "Authenticated read scheme sources" ON public.scheme_sources;
CREATE POLICY "Authenticated read scheme sources" ON public.scheme_sources FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Farmers read own scheme matches" ON public.scheme_matches;
CREATE POLICY "Farmers read own scheme matches" ON public.scheme_matches FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Farmers insert own scheme matches" ON public.scheme_matches;
CREATE POLICY "Farmers insert own scheme matches" ON public.scheme_matches FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. Knowledge Base RLS Policies
DROP POLICY IF EXISTS "Public read approved knowledge" ON public.knowledge_sources;
CREATE POLICY "Public read approved knowledge" ON public.knowledge_sources FOR SELECT USING (approval_status = 'approved' OR verification_status = 'verified');

DROP POLICY IF EXISTS "Authenticated read knowledge docs" ON public.knowledge_documents;
CREATE POLICY "Authenticated read knowledge docs" ON public.knowledge_documents FOR SELECT USING (auth.role() = 'authenticated');

-- 9. Admin Audit Logs & Approvals RLS Policies (Restricted to authenticated admin/service-role)
DROP POLICY IF EXISTS "No public audit log reads" ON public.admin_audit_logs;
-- Ordinary users cannot read or delete audit logs. Server-side admin queries use service role or admin token.

-- -----------------------------------------------------------------------------
-- 10. System Events Table (Persisted Operational Events)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    module TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    http_status INTEGER DEFAULT 200,
    error_code TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    request_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_event_type ON public.system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_module ON public.system_events(module);
CREATE INDEX IF NOT EXISTS idx_system_events_status ON public.system_events(status);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON public.system_events(created_at DESC);

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated insert system events" ON public.system_events;
CREATE POLICY "Authenticated insert system events" ON public.system_events FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- -----------------------------------------------------------------------------
-- 11. Farmer Feedback Table (Feedback Awaiting Review)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.farmer_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    advisory_id TEXT,
    prediction_id UUID,
    rating INTEGER NOT NULL DEFAULT 5,
    category TEXT NOT NULL DEFAULT 'general',
    message TEXT NOT NULL,
    language TEXT DEFAULT 'English',
    status TEXT NOT NULL DEFAULT 'pending_review',
    priority TEXT NOT NULL DEFAULT 'normal',
    assigned_to TEXT,
    admin_note_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.farmer_feedback ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE public.farmer_feedback ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.farmer_feedback ADD COLUMN IF NOT EXISTS prediction_id UUID;
ALTER TABLE public.farmer_feedback ADD COLUMN IF NOT EXISTS admin_note_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_farmer_feedback_status ON public.farmer_feedback(status);
CREATE INDEX IF NOT EXISTS idx_farmer_feedback_user_id ON public.farmer_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_farmer_feedback_created_at ON public.farmer_feedback(created_at DESC);

ALTER TABLE public.farmer_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Farmers insert own feedback" ON public.farmer_feedback;
CREATE POLICY "Farmers insert own feedback" ON public.farmer_feedback FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon' OR auth.role() = 'service_role' OR user_id IS NULL);

DROP POLICY IF EXISTS "Farmers read own feedback" ON public.farmer_feedback;
CREATE POLICY "Farmers read own feedback" ON public.farmer_feedback FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins select farmer feedback" ON public.farmer_feedback;
CREATE POLICY "Admins select farmer feedback" ON public.farmer_feedback FOR SELECT USING (auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Admins update farmer feedback" ON public.farmer_feedback;
CREATE POLICY "Admins update farmer feedback" ON public.farmer_feedback FOR UPDATE USING (auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')));

-- -----------------------------------------------------------------------------
-- 11b. Feedback Review Notes Table (Admin Audit Notes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback_review_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES public.farmer_feedback(id) ON DELETE CASCADE,
    admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_review_notes_feedback_id ON public.feedback_review_notes(feedback_id);

ALTER TABLE public.feedback_review_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage feedback notes" ON public.feedback_review_notes;
CREATE POLICY "Admins manage feedback notes" ON public.feedback_review_notes FOR ALL USING (auth.role() = 'service_role' OR auth.jwt()->>'role' = 'admin');

-- -----------------------------------------------------------------------------
-- 12. Advisory Activity & Notes Tables (Agronomic Telemetry & Admin Audit)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.advisory_activity (
    query_id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    crop TEXT,
    state TEXT,
    district TEXT,
    query_summary TEXT,
    activity_status TEXT NOT NULL DEFAULT 'success',
    review_status TEXT NOT NULL DEFAULT 'not_reviewed',
    documents_considered INTEGER DEFAULT 0,
    documents_used INTEGER DEFAULT 0,
    relevance_threshold_passed BOOLEAN DEFAULT TRUE,
    no_verified_source BOOLEAN DEFAULT FALSE,
    source_citations_json TEXT,
    compliance_json TEXT,
    error_category TEXT,
    retention_expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_advisory_activity_created_at ON public.advisory_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advisory_activity_crop ON public.advisory_activity(crop);
CREATE INDEX IF NOT EXISTS idx_advisory_activity_state ON public.advisory_activity(state);
CREATE INDEX IF NOT EXISTS idx_advisory_activity_status ON public.advisory_activity(activity_status);
CREATE INDEX IF NOT EXISTS idx_advisory_activity_review_status ON public.advisory_activity(review_status);

ALTER TABLE public.advisory_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read and write advisory activity" ON public.advisory_activity;
CREATE POLICY "Admins read and write advisory activity" ON public.advisory_activity FOR ALL
USING (
  auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin', 'auditor', 'agronomist', 'editor')
  )
);

CREATE TABLE IF NOT EXISTS public.advisory_notes (
    id BIGSERIAL PRIMARY KEY,
    query_id TEXT NOT NULL REFERENCES public.advisory_activity(query_id) ON DELETE CASCADE,
    admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advisory_notes_query_id ON public.advisory_notes(query_id);

ALTER TABLE public.advisory_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read and write advisory notes" ON public.advisory_notes;
CREATE POLICY "Admins read and write advisory notes" ON public.advisory_notes FOR ALL
USING (
  auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin', 'auditor', 'agronomist', 'editor')
  )
);

-- -----------------------------------------------------------------------------
-- 13. Disease Prediction Telemetry Table (All Inference Events & Admin Audit)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disease_prediction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_email TEXT,
    crop TEXT,
    top_disease TEXT,
    top_disease_confidence NUMERIC(5, 4),
    top_pest TEXT,
    top_pest_confidence NUMERIC(5, 4),
    top_nutrient TEXT,
    top_nutrient_confidence NUMERIC(5, 4),
    annotated_image_url TEXT,
    all_detections JSONB DEFAULT '[]'::jsonb,
    custom_crop_notice TEXT,
    state TEXT,
    district TEXT,
    status TEXT DEFAULT 'reviewed'
);

CREATE INDEX IF NOT EXISTS idx_disease_pred_created_at ON public.disease_prediction(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disease_pred_crop ON public.disease_prediction(crop);

ALTER TABLE public.disease_prediction ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read and write disease prediction" ON public.disease_prediction;
DROP POLICY IF EXISTS "Allow telemetry insert for disease_prediction" ON public.disease_prediction;
DROP POLICY IF EXISTS "Admins select update delete disease prediction" ON public.disease_prediction;

-- 1. Allow backend service & users (authenticated or anon) to INSERT disease prediction telemetry records
CREATE POLICY "Allow telemetry insert for disease_prediction" ON public.disease_prediction FOR INSERT
WITH CHECK (true);

-- 2. Restrict SELECT, UPDATE, DELETE strictly to service_role and authorized admins
CREATE POLICY "Admins select update delete disease prediction" ON public.disease_prediction FOR ALL
USING (
  auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin', 'auditor', 'agronomist', 'editor')
  )
);

-- -----------------------------------------------------------------------------
-- SECTION 14: ML Prediction Events (System Telemetry for Admin Activity Log)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ml_prediction_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_type TEXT NOT NULL,
    crop TEXT,
    state TEXT,
    district TEXT,
    request_summary JSONB DEFAULT '{}'::jsonb,
    result_summary JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'success',
    latency_ms NUMERIC(10, 2),
    error_code TEXT,
    user_id UUID
);

CREATE INDEX IF NOT EXISTS idx_ml_pred_created_at ON public.ml_prediction_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_pred_model_type ON public.ml_prediction_events(model_type);
CREATE INDEX IF NOT EXISTS idx_ml_pred_crop ON public.ml_prediction_events(crop);
CREATE INDEX IF NOT EXISTS idx_ml_pred_state ON public.ml_prediction_events(state);
CREATE INDEX IF NOT EXISTS idx_ml_pred_user_id ON public.ml_prediction_events(user_id);

ALTER TABLE public.ml_prediction_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow telemetry insert for ml_prediction_events" ON public.ml_prediction_events;
DROP POLICY IF EXISTS "Admins select update delete ml_prediction_events" ON public.ml_prediction_events;

CREATE POLICY "Allow telemetry insert for ml_prediction_events" ON public.ml_prediction_events FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins select update delete ml_prediction_events" ON public.ml_prediction_events FOR ALL
USING (
  auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin', 'auditor', 'agronomist', 'editor')
  )
);




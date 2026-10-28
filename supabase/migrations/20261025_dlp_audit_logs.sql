-- Migration: Create dlp_audit_logs table for PromptOS DLP Shield
-- Stores privacy-preserving audit events. Never stores raw unmasked PII or credentials.

CREATE TABLE IF NOT EXISTS public.dlp_audit_logs (
    id TEXT PRIMARY KEY,
    scan_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    source_type TEXT NOT NULL DEFAULT 'text',
    file_name TEXT,
    file_type TEXT,
    file_size BIGINT,
    text_length INTEGER NOT NULL DEFAULT 0,
    total_findings INTEGER NOT NULL DEFAULT 0,
    finding_categories JSONB DEFAULT '{}'::jsonb,
    risk_score INTEGER NOT NULL DEFAULT 0,
    risk_level TEXT NOT NULL DEFAULT 'LOW',
    classification TEXT NOT NULL DEFAULT 'PUBLIC',
    policy_decision TEXT NOT NULL DEFAULT 'ALLOW',
    policy_name TEXT NOT NULL,
    reasons JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dlp_audit_created_at ON public.dlp_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlp_audit_user_id ON public.dlp_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_dlp_audit_decision ON public.dlp_audit_logs(policy_decision);
CREATE INDEX IF NOT EXISTS idx_dlp_audit_risk_level ON public.dlp_audit_logs(risk_level);

-- Row Level Security (RLS)
ALTER TABLE public.dlp_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own scan audit logs
CREATE POLICY "Users can read own dlp audit logs"
    ON public.dlp_audit_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Authenticated users can insert their own audit logs
CREATE POLICY "Users can insert own dlp audit logs"
    ON public.dlp_audit_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ==============================================================================
-- Migration: 20261027_privacy_receipts.sql
-- Description: Creates the privacy_receipts audit table with Row Level Security.
-- Enterprise AI Security & Data Protection Control Plane.
--
-- INSTRUCTIONS FOR MANUAL EXECUTION:
-- Run this SQL in the Supabase Dashboard -> SQL Editor for your project.
-- ==============================================================================

-- 1. Create privacy_receipts table
CREATE TABLE IF NOT EXISTS public.privacy_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID NULL,
    message_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    action TEXT NOT NULL CHECK (action IN ('allow', 'sanitize', 'review', 'block', 'held')),
    policy_version TEXT NOT NULL,
    inspection_status TEXT NOT NULL CHECK (inspection_status IN ('complete', 'partial', 'failed')),
    override_used BOOLEAN NOT NULL DEFAULT false,
    category_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    attachments_inspected INT NULL,
    attachments_total INT NULL
);

-- 2. Performance indexes for audit lookups & conversation threading
CREATE INDEX IF NOT EXISTS idx_privacy_receipts_user_created 
    ON public.privacy_receipts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_privacy_receipts_conversation 
    ON public.privacy_receipts(conversation_id);

CREATE INDEX IF NOT EXISTS idx_privacy_receipts_message 
    ON public.privacy_receipts(message_id);

-- 3. Row Level Security (RLS) Enforcement
ALTER TABLE public.privacy_receipts ENABLE ROW LEVEL SECURITY;

-- Regular authenticated users can ONLY select/read their own receipts
CREATE POLICY "Users can view own privacy receipts"
    ON public.privacy_receipts
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Explicitly NO INSERT, UPDATE, or DELETE policies for authenticated or anon roles.
-- All writes are performed exclusively server-side using the service_role key,
-- which bypasses RLS and prevents client tampering.

COMMENT ON TABLE public.privacy_receipts IS 'Minimal, privacy-preserving audit receipts containing decision metadata and category counts only (zero sensitive values).';

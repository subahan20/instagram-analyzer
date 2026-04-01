-- Migration: Remove legacy cron jobs and automation triggers
-- This migration cleans up background jobs that are no longer needed

DO $$ 
BEGIN 
    -- Remove the refresh_influencer_metrics function and cron trigger if they exist
    -- Note: Supabase cron uses the 'cron' schema
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('refresh-influencers-10m');
    END IF;
END $$;

DROP FUNCTION IF EXISTS public.refresh_influencer_metrics CASCADE;

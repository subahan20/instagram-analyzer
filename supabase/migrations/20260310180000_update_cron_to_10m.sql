-- Migration: Setup 10-minute automated Instagram refresh cron
-- Date: 2026-03-10

-- 1. Unschedule any existing refresh jobs safely
DO $$ 
BEGIN 
    -- Unschedule 3h job if it exists
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'automatic-instagram-refresh-3h') THEN
        PERFORM cron.unschedule('automatic-instagram-refresh-3h');
    END IF;

    -- Unschedule 10m job if it exists (for re-runs)
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'automatic-instagram-refresh-10m') THEN
        PERFORM cron.unschedule('automatic-instagram-refresh-10m');
    END IF;
END $$;

-- 2. Setup Cron Job for 10-minute refresh
-- This will trigger the refresh-instagram-data edge function every 10 minutes
SELECT cron.schedule(
    'automatic-instagram-refresh-10m',
    '*/10 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://<PROJECT_ID>.supabase.co/functions/v1/refresh-instagram-data',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
        ),
        body := '{}'::jsonb
    )
    $$
);

-- Note: PROJECT_ID and SERVICE_ROLE_KEY need to be replaced with actual values
-- in the Supabase Dashboard SQL Editor or via environment variable injection.

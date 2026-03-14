-- Migration: Add metric columns to influencers and setup 3h refresh cron
-- Date: 2026-03-10

-- 1. Add columns to influencers table for quick access
ALTER TABLE public.influencers 
ADD COLUMN IF NOT EXISTS followers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS posts INTEGER DEFAULT 0;

-- 2. Setup Cron Job for 3-hour refresh
-- This replaces or runs alongside the previous 6h capture if it exists.
-- We use a new name to avoid conflicts.
SELECT cron.schedule(
    'automatic-instagram-refresh-3h',
    '0 */3 * * *',
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

-- Note: If you don't have a settings table, you'll need to manually set the URL and Key in the Cron dashboard or update this script.

-- Migration: Align reels table with exact Apify keys
-- Description: Renames likes to likesCount, posted_at to timestamp and adds additional fields from Apify JSON.

BEGIN;

-- 1. Rename existing columns in reels table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='likes') THEN
        ALTER TABLE public.reels RENAME COLUMN likes TO \"likesCount\";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='posted_at') THEN
        ALTER TABLE public.reels RENAME COLUMN posted_at TO \"timestamp\";
    END IF;
END $$;

-- 2. Add new columns to reels table
ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS \"videoUrl\" TEXT,
ADD COLUMN IF NOT EXISTS \"videoViewCount\" BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS \"videoUrl\" TEXT,
ADD COLUMN IF NOT EXISTS \"videoDuration\" DECIMAL,
ADD COLUMN IF NOT EXISTS \"caption\" TEXT;

-- 3. Update metrics_history to use likesCount for consistency (optional but recommended)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='avg_likes') THEN
        ALTER TABLE public.metrics_history RENAME COLUMN avg_likes TO \"likesCount\";
    END IF;
END $$;

COMMIT;

-- Update influencers table with tracking columns
ALTER TABLE public.influencers 
ADD COLUMN IF NOT EXISTS is_fresh BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS needs_refresh BOOLEAN DEFAULT false;

-- Update scraper_cache table to allow history and extra metrics
-- First, remove the UNIQUE constraint on username if it exists
ALTER TABLE public.scraper_cache DROP CONSTRAINT IF EXISTS scraper_cache_username_key;

-- Add new metric columns to scraper_cache
ALTER TABLE public.scraper_cache
ADD COLUMN IF NOT EXISTS followers_count INTEGER,
ADD COLUMN IF NOT EXISTS following_count INTEGER,
ADD COLUMN IF NOT EXISTS posts_count INTEGER,
ADD COLUMN IF NOT EXISTS avg_likes INTEGER,
ADD COLUMN IF NOT EXISTS avg_comments INTEGER,
ADD COLUMN IF NOT EXISTS avg_views INTEGER;

-- Rename last_scraped_at to fetched_at if needed (or just add fetched_at)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scraper_cache' AND column_name='last_scraped_at') THEN
        ALTER TABLE public.scraper_cache RENAME COLUMN last_scraped_at TO fetched_at;
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scraper_cache' AND column_name='fetched_at') THEN
            ALTER TABLE public.scraper_cache ADD COLUMN fetched_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
        END IF;
    END IF;
END $$;

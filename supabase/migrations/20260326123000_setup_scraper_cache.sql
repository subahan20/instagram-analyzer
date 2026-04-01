-- Create scraper_cache table
-- We drop it first to ensure the schema matches the requirements perfectly
DROP TABLE IF EXISTS public.scraper_cache CASCADE;

CREATE TABLE public.scraper_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    last_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    raw_data JSONB
);

-- Index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_scraper_cache_username ON public.scraper_cache(username);

-- Enable RLS
ALTER TABLE public.scraper_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid error
DROP POLICY IF EXISTS "Enable all access for service role" ON public.scraper_cache;
CREATE POLICY "Enable all access for service role" ON public.scraper_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read access for all" ON public.scraper_cache;
CREATE POLICY "Enable read access for all" ON public.scraper_cache FOR SELECT USING (true);

-- Update influencers table to match requirements
DO $$ 
BEGIN
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='followers_count') THEN
        ALTER TABLE public.influencers ADD COLUMN followers_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='following_count') THEN
        ALTER TABLE public.influencers ADD COLUMN following_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='posts_count') THEN
        ALTER TABLE public.influencers ADD COLUMN posts_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='last_updated_at') THEN
        ALTER TABLE public.influencers ADD COLUMN last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;
    
    -- Sync data from existing columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='followers') THEN
        UPDATE public.influencers SET followers_count = followers WHERE followers_count = 0 AND (followers IS NOT NULL AND followers > 0);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='following') THEN
        UPDATE public.influencers SET following_count = following WHERE following_count = 0 AND (following IS NOT NULL AND following > 0);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='posts') THEN
        UPDATE public.influencers SET posts_count = posts WHERE posts_count = 0 AND (posts IS NOT NULL AND posts > 0);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='last_synced_at') THEN
        UPDATE public.influencers SET last_updated_at = last_synced_at WHERE last_synced_at IS NOT NULL;
    END IF;
END $$;

-- Ensure username is unique in influencers
ALTER TABLE public.influencers DROP CONSTRAINT IF EXISTS influencers_username_key;
ALTER TABLE public.influencers ADD CONSTRAINT influencers_username_key UNIQUE (username);

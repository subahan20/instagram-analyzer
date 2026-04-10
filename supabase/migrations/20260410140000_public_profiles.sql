-- Migration: Enable Publicly Sharable Profiles
-- This migration allows guest users (non-authenticated) to view profile pages
-- and the associated shared reels.

-- 1. Enable Public Read Access for Influencers
-- This allows anyone with a profile ID to view the metadata (username, pic, etc.)
DROP POLICY IF EXISTS "Users can only see their own influencers" ON public.influencers;
DROP POLICY IF EXISTS "Allow public read access for influencers" ON public.influencers;

CREATE POLICY "Allow public read access for influencers" ON public.influencers
    FOR SELECT USING (true);

-- 2. Enable Public Read Access for Reels
-- This builds on the 'globalize_reels' migration to allow guest users as well.
DROP POLICY IF EXISTS "Allow authenticated users to see all reels" ON public.reels;
DROP POLICY IF EXISTS "Allow public read access for reels" ON public.reels;

CREATE POLICY "Allow public read access for reels" ON public.reels
    FOR SELECT USING (true);

-- 3. Enable Public Read Access for Metrics History
-- Necessary for guest users to see growth stats on the public profile.
DROP POLICY IF EXISTS "Allow public read access for metrics" ON public.metrics_history;
CREATE POLICY "Allow public read access for metrics" ON public.metrics_history
    FOR SELECT USING (true);

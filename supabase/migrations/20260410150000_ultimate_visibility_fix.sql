-- Migration: Ultimate Public Access Cleanup
-- This migration ensures NO RESTRICTIVE POLICIES remain that could block 
-- shared reel visibility for guest or cross-account users.

-- 1. CLEAN REELS POLICIES
-- Drop any potential restrictive isolation policies from previous migrations
DROP POLICY IF EXISTS "Users can only see their own reels" ON public.reels;
DROP POLICY IF EXISTS "Allow all for reels" ON public.reels;
DROP POLICY IF EXISTS "Allow authenticated users to see all reels" ON public.reels;
DROP POLICY IF EXISTS "Allow public read access for reels" ON public.reels;

-- Create the final unrestricted read policy
CREATE POLICY "Allow public read access for reels" ON public.reels
    FOR SELECT USING (true);

-- 2. CLEAN INFLUENCERS POLICIES
DROP POLICY IF EXISTS "Users can only see their own influencers" ON public.influencers;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.influencers;
DROP POLICY IF EXISTS "Allow public read access for influencers" ON public.influencers;

CREATE POLICY "Allow public read access for influencers" ON public.influencers
    FOR SELECT USING (true);

-- 3. CLEAN METRICS POLICIES
DROP POLICY IF EXISTS "Allow public read access for metrics" ON public.metrics_history;
CREATE POLICY "Allow public read access for metrics" ON public.metrics_history
    FOR SELECT USING (true);
    
-- Ensure RLS is enabled on all tables
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_history ENABLE ROW LEVEL SECURITY;

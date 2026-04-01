-- Migration: Revert user_id columns and setup profiles-based isolation
-- This migration undoes the 20260328140000 changes and uses the 'profiles' table instead.

DO $$ 
BEGIN 
    -- 1. [DISABLED] Remove user_id from influencers
    -- IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='user_id') THEN
    --    ALTER TABLE public.influencers DROP COLUMN user_id CASCADE;
    -- END IF;

    -- 2. [DISABLED] Remove user_id from reels
    -- IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='user_id') THEN
    --    ALTER TABLE public.reels DROP COLUMN user_id CASCADE;
    -- END IF;
END $$;

-- 3. Restore wide-open RLS for influencers/reels (as it was originally)
-- Note: Logic-based filtering will be handled via 'follows' table and activeProfileId
DROP POLICY IF EXISTS "Users can only see their own influencers" ON public.influencers;
DROP POLICY IF EXISTS "Users can only insert their own influencers" ON public.influencers;
DROP POLICY IF EXISTS "Users can only update their own influencers" ON public.influencers;
DROP POLICY IF EXISTS "Users can only delete their own influencers" ON public.influencers;

CREATE POLICY "Enable read access for all users" ON public.influencers FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.influencers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.influencers FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.influencers FOR DELETE USING (true);

DROP POLICY IF EXISTS "Users can only see their own reels" ON public.reels;
DROP POLICY IF EXISTS "Users can only insert their own reels" ON public.reels;
DROP POLICY IF EXISTS "Users can only update their own reels" ON public.reels;
DROP POLICY IF EXISTS "Users can only delete their own reels" ON public.reels;

CREATE POLICY "Allow all for reels" ON public.reels FOR ALL USING (true);

-- 4. Setup strict isolation on 'profiles' table
-- This allows us to map auth.uid() to a specific influencer_id securely.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.profiles;
DROP POLICY IF EXISTS "Allow public insert access" ON public.profiles;

CREATE POLICY "Users can only see their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can only insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can only update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

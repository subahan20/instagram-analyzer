-- Migration: Guarantee user_id columns for data isolation
-- This migration ensures that the 'user_id' column exists in 'influencers' and 'reels'
-- regardless of previous migration state.

DO $$ 
BEGIN 
    -- 1. Ensure user_id exists in influencers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='user_id') THEN
        ALTER TABLE public.influencers ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 2. Ensure user_id exists in reels
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='user_id') THEN
        ALTER TABLE public.reels ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 3. Ensure last_updated_at and metrics columns exist in influencers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='last_updated_at') THEN
        ALTER TABLE public.influencers ADD COLUMN last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='followers_count') THEN
        ALTER TABLE public.influencers ADD COLUMN followers_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='following_count') THEN
        ALTER TABLE public.influencers ADD COLUMN following_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='posts_count') THEN
        ALTER TABLE public.influencers ADD COLUMN posts_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 3. Transition to strictly enforced isolation on influencers
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

-- Clean up any conflicting "allow all" policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.influencers;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.influencers;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.influencers;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.influencers;

-- Create user-specific policies for influencers
DROP POLICY IF EXISTS "Users can only see their own influencers" ON public.influencers;
CREATE POLICY "Users can only see their own influencers" ON public.influencers FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert their own influencers" ON public.influencers;
CREATE POLICY "Users can only insert their own influencers" ON public.influencers FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update their own influencers" ON public.influencers;
CREATE POLICY "Users can only update their own influencers" ON public.influencers FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own influencers" ON public.influencers;
CREATE POLICY "Users can only delete their own influencers" ON public.influencers FOR DELETE USING (auth.uid() = user_id);

-- 4. Transition to strictly enforced isolation on reels
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

-- Clean up any conflicting "allow all" policies for reels
DROP POLICY IF EXISTS "Enable read access for all users" ON public.reels;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.reels;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.reels;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.reels;

-- Create user-specific policies for reels
DROP POLICY IF EXISTS "Users can only see their own reels" ON public.reels;
CREATE POLICY "Users can only see their own reels" ON public.reels FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert their own reels" ON public.reels;
CREATE POLICY "Users can only insert their own reels" ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update their own reels" ON public.reels;
CREATE POLICY "Users can only update their own reels" ON public.reels FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own reels" ON public.reels;
CREATE POLICY "Users can only delete their own reels" ON public.reels FOR DELETE USING (auth.uid() = user_id);

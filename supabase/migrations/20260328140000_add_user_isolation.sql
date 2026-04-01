-- Migration: Add user_id to influencers and reels for data isolation
-- This migration refactors existing tables to support user-specific data

DO $$ 
BEGIN 
    -- 1. Add user_id to influencers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='user_id') THEN
        ALTER TABLE public.influencers ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 2. Add user_id to reels
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='user_id') THEN
        ALTER TABLE public.reels ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Enable RLS and setup policies for influencers
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

-- Drop existing "Allow all" policies to enforce isolation
DROP POLICY IF EXISTS "Enable read access for all users" ON public.influencers;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.influencers;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.influencers;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.influencers;

CREATE POLICY "Users can only see their own influencers" ON public.influencers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own influencers" ON public.influencers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own influencers" ON public.influencers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own influencers" ON public.influencers
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Enable RLS and setup policies for reels
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own reels" ON public.reels
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own reels" ON public.reels
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own reels" ON public.reels
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own reels" ON public.reels
    FOR DELETE USING (auth.uid() = user_id);

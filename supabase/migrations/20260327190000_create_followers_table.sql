-- Create followers table
-- This migration provides the base structure required by the scrape-followers logic

CREATE TABLE IF NOT EXISTS public.followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    influencer_id BIGINT REFERENCES public.influencers(id) ON DELETE CASCADE,
    follower_username TEXT NOT NULL,
    follower_name TEXT,
    follower_profile_pic TEXT,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(influencer_id, follower_username)
);

-- Enable Row Level Security
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

-- Create basic policies
CREATE POLICY "Allow all for followers" ON public.followers FOR ALL USING (true);

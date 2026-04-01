-- Create follows table to manage influencer-to-influencer relationships
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id BIGINT REFERENCES public.influencers(id) ON DELETE CASCADE,
    following_id BIGINT REFERENCES public.influencers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE follows;

-- Basic RLS (Allow all for now as it is a demo dashboard)
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for follows" ON public.follows FOR ALL USING (true);

-- Add comments for documentation
COMMENT ON TABLE public.follows IS 'Relational table defining which influencer follows which competitor.';

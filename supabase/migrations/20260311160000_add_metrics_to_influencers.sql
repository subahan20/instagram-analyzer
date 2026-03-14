-- Migration: Add live metrics columns to influencers table
-- Date: 2026-03-11

-- 1. Add current metric columns to influencers table
-- These will be updated directly by n8n or the Edge Function
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='followers') THEN
        ALTER TABLE public.influencers ADD COLUMN followers INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='following') THEN
        ALTER TABLE public.influencers ADD COLUMN following INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='posts') THEN
        ALTER TABLE public.influencers ADD COLUMN posts INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='avg_likes') THEN
        ALTER TABLE public.influencers ADD COLUMN avg_likes INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='avg_comments') THEN
        ALTER TABLE public.influencers ADD COLUMN avg_comments INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='reel_views') THEN
        ALTER TABLE public.influencers ADD COLUMN reel_views BIGINT DEFAULT 0;
    END IF;
END $$;

-- 2. Update existing influencers data from their latest metrics_history
UPDATE public.influencers i
SET 
  followers = mh.followers,
  following = mh.following,
  posts = mh.total_posts,
  avg_likes = mh.avg_likes,
  avg_comments = mh.avg_comments,
  reel_views = mh.reel_views
FROM (
  SELECT DISTINCT ON (influencer_id) *
  FROM public.metrics_history
  ORDER BY influencer_id, captured_at DESC
) mh
WHERE i.id = mh.influencer_id;

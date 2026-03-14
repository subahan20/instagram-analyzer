-- Migration: Align Relational Schema for Instagram Data
-- Target Tables: influencers, metrics_history, reels

-- 1. Align influencers table
DO $$ 
BEGIN 
    -- Ensure columns exist with correct names
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='profile_pic') THEN
        ALTER TABLE public.influencers ADD COLUMN profile_pic TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='business_category') THEN
        ALTER TABLE public.influencers ADD COLUMN business_category TEXT;
    END IF;

    -- Handle potential naming differences from previous migrations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='profile_url') THEN
        -- Already exists, ensure type
    ELSE
        ALTER TABLE public.influencers ADD COLUMN profile_url TEXT;
    END IF;

    -- ADD UNIQUE CONSTRAINT ON USERNAME
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'influencers_username_key' 
        AND conrelid = 'public.influencers'::regclass
    ) THEN
        ALTER TABLE public.influencers ADD CONSTRAINT influencers_username_key UNIQUE (username);
    END IF;
END $$;

-- 2. Align metrics_history table
-- We'll rename columns if they exist with slightly different names, or add them.
DO $$ 
BEGIN 
    -- followers, following, total_posts usually exist
    
    -- avg_likes (user requested) vs average_likes (existing)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='average_likes') THEN
        ALTER TABLE public.metrics_history RENAME COLUMN average_likes TO avg_likes;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='avg_likes') THEN
        ALTER TABLE public.metrics_history ADD COLUMN avg_likes INTEGER DEFAULT 0;
    END IF;

    -- avg_comments vs average_comments
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='average_comments') THEN
        ALTER TABLE public.metrics_history RENAME COLUMN average_comments TO avg_comments;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='avg_comments') THEN
        ALTER TABLE public.metrics_history ADD COLUMN avg_comments INTEGER DEFAULT 0;
    END IF;

    -- captured_at vs capture_date
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='capture_date') THEN
        ALTER TABLE public.metrics_history RENAME COLUMN capture_date TO captured_at;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='captured_at') THEN
        ALTER TABLE public.metrics_history ADD COLUMN captured_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;

    -- reel_views
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='reel_views') THEN
        ALTER TABLE public.metrics_history ADD COLUMN reel_views BIGINT DEFAULT 0;
    END IF;
END $$;

-- 3. Align reels table
DO $$ 
BEGIN 
    -- likes vs likes_count
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='likes_count') THEN
        ALTER TABLE public.reels RENAME COLUMN likes_count TO likes;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='likes') THEN
        ALTER TABLE public.reels ADD COLUMN likes INTEGER DEFAULT 0;
    END IF;

    -- posted_at vs posted_date
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='posted_date') THEN
        ALTER TABLE public.reels RENAME COLUMN posted_date TO posted_at;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='posted_at') THEN
        ALTER TABLE public.reels ADD COLUMN posted_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- is_trending
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='is_trending') THEN
        ALTER TABLE public.reels ADD COLUMN is_trending BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

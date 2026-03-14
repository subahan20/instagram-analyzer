-- Migration: Standardize influencer metrics columns
-- Date: 2026-03-12

-- 1. Standardize influencers table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='likes') THEN
        ALTER TABLE public.influencers ADD COLUMN likes INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='comments') THEN
        ALTER TABLE public.influencers ADD COLUMN comments INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='influencers' AND column_name='views') THEN
        ALTER TABLE public.influencers ADD COLUMN views BIGINT DEFAULT 0;
    END IF;
END $$;

DO $$
DECLARE
    col_likes TEXT;
    col_comments TEXT;
    col_views TEXT;
BEGIN
    SELECT column_name INTO col_likes FROM information_schema.columns WHERE table_name='influencers' AND column_name IN ('avg_likes', 'average_likes') LIMIT 1;
    SELECT column_name INTO col_comments FROM information_schema.columns WHERE table_name='influencers' AND column_name IN ('avg_comments', 'average_comments') LIMIT 1;
    SELECT column_name INTO col_views FROM information_schema.columns WHERE table_name='influencers' AND column_name IN ('reel_views', 'views') LIMIT 1;

    EXECUTE format('UPDATE public.influencers SET 
        likes = COALESCE(%I, likes),
        comments = COALESCE(%I, comments),
        views = COALESCE(%I, views)',
        COALESCE(col_likes, 'likes'),
        COALESCE(col_comments, 'comments'),
        COALESCE(col_views, 'views'));
END $$;

-- 2. Standardize metrics_history
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='likes') THEN
        ALTER TABLE public.metrics_history ADD COLUMN likes INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='comments') THEN
        ALTER TABLE public.metrics_history ADD COLUMN comments INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='views') THEN
        ALTER TABLE public.metrics_history ADD COLUMN views BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='captured_at') THEN
        ALTER TABLE public.metrics_history ADD COLUMN captured_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

DO $$
DECLARE
    col_likes TEXT;
    col_comments TEXT;
    col_views TEXT;
    col_date TEXT;
BEGIN
    SELECT column_name INTO col_likes FROM information_schema.columns WHERE table_name='metrics_history' AND column_name IN ('avg_likes', 'average_likes', 'likesCount') LIMIT 1;
    SELECT column_name INTO col_comments FROM information_schema.columns WHERE table_name='metrics_history' AND column_name IN ('avg_comments', 'average_comments', 'commentsCount') LIMIT 1;
    SELECT column_name INTO col_views FROM information_schema.columns WHERE table_name='metrics_history' AND column_name IN ('reel_views', 'views') LIMIT 1;
    SELECT column_name INTO col_date FROM information_schema.columns WHERE table_name='metrics_history' AND column_name IN ('capture_date', 'captured_at') LIMIT 1;

    EXECUTE format('UPDATE public.metrics_history SET 
        likes = COALESCE(%I, likes),
        comments = COALESCE(%I, comments),
        views = COALESCE(%I, views),
        captured_at = %I',
        COALESCE(col_likes, 'likes'),
        COALESCE(col_comments, 'comments'),
        COALESCE(col_views, 'views'),
        COALESCE(col_date, 'captured_at'));
END $$;

-- 3. Standardize reels
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='likes') THEN
        ALTER TABLE public.reels ADD COLUMN likes INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='comments') THEN
        ALTER TABLE public.reels ADD COLUMN comments INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='views') THEN
        ALTER TABLE public.reels ADD COLUMN views BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='posted_at') THEN
        ALTER TABLE public.reels ADD COLUMN posted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$
DECLARE
    col_likes TEXT;
    col_comments TEXT;
    col_views TEXT;
    col_date TEXT;
BEGIN
    SELECT column_name INTO col_likes FROM information_schema.columns WHERE table_name='reels' AND column_name IN ('likesCount', 'likes') LIMIT 1;
    SELECT column_name INTO col_comments FROM information_schema.columns WHERE table_name='reels' AND column_name IN ('commentsCount', 'comments') LIMIT 1;
    SELECT column_name INTO col_views FROM information_schema.columns WHERE table_name='reels' AND column_name IN ('videoPlayCount', 'videoViewCount', 'views') LIMIT 1;
    SELECT column_name INTO col_date FROM information_schema.columns WHERE table_name='reels' AND column_name IN ('timestamp', 'posted_at') LIMIT 1;

    EXECUTE format('UPDATE public.reels SET 
        likes = COALESCE(%I, likes),
        comments = COALESCE(%I, comments),
        views = COALESCE(%I, views),
        posted_at = %I',
        COALESCE(col_likes, 'likes'),
        COALESCE(col_comments, 'comments'),
        COALESCE(col_views, 'views'),
        COALESCE(col_date, 'posted_at'));
END $$;

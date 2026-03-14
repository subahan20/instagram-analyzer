-- Migration: Enrich reels table with additional API fields
-- Adds new columns to capture full Apify reel data

DO $$
BEGIN
    -- thumbnail / display URL
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='display_url') THEN
        ALTER TABLE public.reels ADD COLUMN display_url TEXT;
    END IF;

    -- direct video URL (CDN mp4 link)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='video_url') THEN
        ALTER TABLE public.reels ADD COLUMN video_url TEXT;
    END IF;

    -- video play count (separate from view count)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='play_count') THEN
        ALTER TABLE public.reels ADD COLUMN play_count INTEGER DEFAULT 0;
    END IF;

    -- video duration in seconds
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='video_duration') THEN
        ALTER TABLE public.reels ADD COLUMN video_duration NUMERIC(10, 2) DEFAULT 0;
    END IF;

    -- caption / alt text
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='caption') THEN
        ALTER TABLE public.reels ADD COLUMN caption TEXT;
    END IF;

    -- product type (clips, igtv, etc.)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='product_type') THEN
        ALTER TABLE public.reels ADD COLUMN product_type TEXT;
    END IF;

    -- is pinned
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='is_pinned') THEN
        ALTER TABLE public.reels ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
    END IF;

    -- audio URL
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='audio_url') THEN
        ALTER TABLE public.reels ADD COLUMN audio_url TEXT;
    END IF;

    -- owner full name (duplicated for quick access)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='owner_full_name') THEN
        ALTER TABLE public.reels ADD COLUMN owner_full_name TEXT;
    END IF;

    -- owner username
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='owner_username') THEN
        ALTER TABLE public.reels ADD COLUMN owner_username TEXT;
    END IF;
END $$;

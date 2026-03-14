-- Migration: Enable Real-time for influencers and reels, and add unique constraint for n8n UPSERT
-- Date: 2026-03-11

-- 1. Enable Real-time for live updates
DO $$
BEGIN
  -- Add influencers to publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'influencers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE influencers;
  END IF;

  -- Add reels to publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'reels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reels;
  END IF;
END $$;

-- 2. Ensure Replica Identity is set to FULL to capture all column changes for real-time
ALTER TABLE public.influencers REPLICA IDENTITY FULL;
ALTER TABLE public.reels REPLICA IDENTITY FULL;

-- 3. Ensure reel_url is unique for n8n UPSERT to work correctly
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'reels_reel_url_key' 
        AND conrelid = 'public.reels'::regclass
    ) THEN
        ALTER TABLE public.reels ADD CONSTRAINT reels_reel_url_key UNIQUE (reel_url);
    END IF;
END $$;

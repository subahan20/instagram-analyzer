-- Migration: Multi-User Isolation for Influencers and Reels
-- This migration allows multiple users to track the same profile/reel by moving the unique constraint to a composite (target, user_id) key.

DO $$ 
BEGIN 
    -- 1. Update influencers table uniqueness
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'influencers_username_key' 
        AND conrelid = 'public.influencers'::regclass
    ) THEN
        ALTER TABLE public.influencers DROP CONSTRAINT influencers_username_key;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'influencers_username_user_id_key' 
        AND conrelid = 'public.influencers'::regclass
    ) THEN
        ALTER TABLE public.influencers ADD CONSTRAINT influencers_username_user_id_key UNIQUE (username, user_id);
    END IF;

    -- 2. Update reels table uniqueness
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'reels_reel_url_key' 
        AND conrelid = 'public.reels'::regclass
    ) THEN
        ALTER TABLE public.reels DROP CONSTRAINT reels_reel_url_key;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'reels_reel_url_user_id_key' 
        AND conrelid = 'public.reels'::regclass
    ) THEN
        ALTER TABLE public.reels ADD CONSTRAINT reels_reel_url_user_id_key UNIQUE (reel_url, user_id);
    END IF;
END $$;

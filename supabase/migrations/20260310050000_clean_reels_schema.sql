-- Migration: Clean reels table to match exact schema requirements
-- Adds the required columns with correct names if not already present

-- Add video_url (the CDN direct URL to the video)
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add views (mapped from Apify videoPlayCount)
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- Add comments (mapped from Apify commentsCount)
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS comments INTEGER DEFAULT 0;

-- Ensure likes exists (mapped from Apify likesCount)
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

-- Ensure posted_at exists (mapped from Apify timestamp)
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP WITH TIME ZONE;

-- Drop the reel_url NOT NULL constraint temporarily to allow switching unique key to video_url
-- (Keep reel_url for backward compat but add UNIQUE on video_url for upsert)
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS reel_url TEXT;

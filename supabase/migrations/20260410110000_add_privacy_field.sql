-- Migration: Add is_private field to influencers
-- Date: 2026-04-10

ALTER TABLE public.influencers 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- Update existing data: No way to know for sure, so default to false
UPDATE public.influencers SET is_private = FALSE WHERE is_private IS NULL;

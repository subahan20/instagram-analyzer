-- Migration: Add last_synced_at to influencers
-- Date: 2026-03-11

ALTER TABLE public.influencers 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Initialize with current time for existing rows
UPDATE public.influencers SET last_synced_at = NOW() WHERE last_synced_at IS NULL;

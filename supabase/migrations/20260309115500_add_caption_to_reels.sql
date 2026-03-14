-- Add caption column to reels table
ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS caption TEXT;

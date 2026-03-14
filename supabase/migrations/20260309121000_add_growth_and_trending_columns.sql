-- Add growth and trending columns
ALTER TABLE public.metrics_history 
ADD COLUMN IF NOT EXISTS growth INTEGER DEFAULT 0;

ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT FALSE;

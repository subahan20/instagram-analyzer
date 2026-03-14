-- Migration: Add detailed profile metrics to influencers and metrics_history
-- Date: 2026-03-09

-- 1. Add static profile attributes to influencers
ALTER TABLE public.influencers 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_business BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS business_category TEXT,
ADD COLUMN IF NOT EXISTS external_url TEXT;

-- 2. Add time-series metrics to metrics_history
ALTER TABLE public.metrics_history
ADD COLUMN IF NOT EXISTS highlights_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS igtv_count INTEGER DEFAULT 0;

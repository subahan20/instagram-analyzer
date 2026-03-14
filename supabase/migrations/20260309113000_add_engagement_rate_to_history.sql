-- Add engagement_rate column to metrics_history
ALTER TABLE public.metrics_history 
ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(5, 2);

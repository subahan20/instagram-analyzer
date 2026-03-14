-- Migration: Enable Real-time for metrics_history
-- Date: 2026-03-11

-- 1. Enable Real-time for metrics_history updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'metrics_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE metrics_history;
  END IF;
END $$;

-- 2. Ensure Replica Identity is set to FULL
ALTER TABLE public.metrics_history REPLICA IDENTITY FULL;

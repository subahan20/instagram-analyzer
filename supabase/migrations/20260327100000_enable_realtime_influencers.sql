-- Enable Realtime for influencers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'influencers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE influencers;
  END IF;
END $$;

-- Ensure Replica Identity is set to FULL
ALTER TABLE influencers REPLICA IDENTITY FULL;

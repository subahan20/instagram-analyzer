-- Enable Realtime for post_insta_data table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'post_insta_data'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE post_insta_data;
  END IF;
END $$;

-- Ensure Replica Identity is set to FULL to capture all column changes
ALTER TABLE post_insta_data REPLICA IDENTITY FULL;

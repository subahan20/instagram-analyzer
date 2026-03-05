-- Create instagram_profiles table to store data from Instagram Graph API
CREATE TABLE IF NOT EXISTS instagram_profiles (
  id TEXT PRIMARY KEY, -- Instagram's unique internal ID
  username TEXT NOT NULL,
  follower_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  followers_count INT DEFAULT 0,
  follows_count INT DEFAULT 0,
  media_count INT DEFAULT 0,
  account_type TEXT,
  profile_picture_url TEXT,
  full_name TEXT,
  bio TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  raw_data JSONB, -- Full response from Meta API for backup
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE instagram_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anonymous selects for demo/frontend display
DROP POLICY IF EXISTS "Allow anonymous profile reads" ON instagram_profiles;
CREATE POLICY "Allow anonymous profile reads" ON instagram_profiles
  FOR SELECT USING (true);

-- Allow service role to perform any action (used by Edge Functions)
DROP POLICY IF EXISTS "Service role full access" ON instagram_profiles;
CREATE POLICY "Service role full access" ON instagram_profiles
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_instagram_profiles_updated_at ON instagram_profiles;
CREATE TRIGGER update_instagram_profiles_updated_at
    BEFORE UPDATE ON instagram_profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

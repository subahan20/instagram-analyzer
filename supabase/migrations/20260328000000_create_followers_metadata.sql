-- 1. Add username column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='followers' AND column_name='username') THEN
        ALTER TABLE public.followers ADD COLUMN username TEXT NOT NULL DEFAULT 'unknown';
        ALTER TABLE public.followers ALTER COLUMN username DROP DEFAULT;
    END IF;
END $$;

-- 2. Add unique constraint if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'followers_username_follower_username_key') THEN
        ALTER TABLE public.followers ADD CONSTRAINT followers_username_follower_username_key UNIQUE (username, follower_username);
    END IF;
END $$;

-- 3. Enable Realtime if not already enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'followers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.followers;
    END IF;
END $$;

-- 4. Enable RLS and Policy
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'followers' 
        AND policyname = 'Allow all for followers'
    ) THEN
        CREATE POLICY "Allow all for followers" ON public.followers FOR ALL USING (true);
    END IF;
END $$;

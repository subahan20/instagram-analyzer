-- Add profile_pic_url to influencers table
ALTER TABLE public.influencers 
ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;

-- 2. Ensure metrics_history has required columns for the view
-- Sometimes migrations run slightly out of order or on dirty states, 
-- so we'll be defensive here to ensure 'engagement_rate' and 'growth' exist.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='engagement_rate') THEN
        ALTER TABLE public.metrics_history ADD COLUMN engagement_rate DECIMAL(5, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_history' AND column_name='growth') THEN
        ALTER TABLE public.metrics_history ADD COLUMN growth INTEGER DEFAULT 0;
    END IF;
END $$;

-- 3. Create view for latest metrics per influencer
CREATE OR REPLACE VIEW public.latest_influencer_metrics AS
SELECT DISTINCT ON (influencer_id) 
    influencer_id, 
    followers, 
    following, 
    total_posts, 
    average_likes, 
    average_comments, 
    reel_views, 
    engagement_rate, 
    growth, 
    capture_date
FROM public.metrics_history
ORDER BY influencer_id, capture_date DESC;

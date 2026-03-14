-- Add profile_pic_url to influencers table
ALTER TABLE public.influencers 
ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;

-- Create view for latest metrics per influencer
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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url: targetUrl } = await req.json()
    if (!targetUrl) throw new Error('URL is required')

    // Extract username
    const username = targetUrl.split('instagram.com/')[1]?.split('/')[0]?.replace('@', '').toLowerCase();
    if (!username) throw new Error('Invalid Instagram URL')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const apifyToken = Deno.env.get('APIFY_API') || Deno.env.get('APIFY_TOKEN')

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // --- Scraping Logic (Multi-Stage for Maximum Freshness) ---
    const profileScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
    const reelsScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items?token=${apifyToken}`;

    const [pRes, rRes] = await Promise.all([
      fetch(profileScraperUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ usernames: [username], resultsLimit: 1, postsLimit: 20 }) 
      }),
      fetch(reelsScraperUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          username: [username], 
          resultsLimit: 20, 
          maxItems: 20,
          enhanceData: false 
        }) 
      })
    ]);

    if (!pRes.ok) throw new Error('Apify profile scrape failed');
    const pResults = await pRes.json();
    const raw = pResults[0];
    if (!raw) throw new Error('Instagram profile not found');

    const rResults = rRes.ok ? await rRes.json() : [];

    const now = new Date().toISOString();

    // 1. Upsert into influencers
    const { data: influencer, error: infError } = await supabase
      .from('influencers')
      .upsert({
        username: username,
        profile_url: `https://www.instagram.com/${username}/`,
        profile_pic: raw.profilePicUrlHD || raw.profilePicUrl,
        followers_count: raw.followersCount || 0,
        following_count: raw.followsCount || 0,
        posts_count: raw.postsCount || 0,
        last_updated_at: now,
        last_synced_at: now
      }, { onConflict: 'username' })
      .select()
      .single();

    if (infError) throw infError;

    // 2. Merge and Upsert into reels
    const allMedia = [...(raw.latestPosts || []), ...rResults];
    const reelsMap = new Map();

    allMedia.forEach((p: any) => {
        const url = p.url || p.instagramUrl || (p.shortCode ? `https://www.instagram.com/reels/${p.shortCode}/` : null);
        if (!url) return;
        
        const type = (p.type || p.productType || p.product_type || '').toLowerCase();
        const isVideo = ['video', 'reel', 'clips', 'clip', 'media'].includes(type) || !!p.videoUrl;
        
        if (isVideo && (!reelsMap.has(url) || p.displayUrl)) {
            reelsMap.set(url, {
              influencer_id: influencer.id,
              reel_url: url,
              display_url: p.displayUrl || p.thumbnailUrl || p.videoUrl,
              video_url: p.videoUrl || null,
              likes: p.likesCount || p.likes_count || 0,
              views: p.videoPlayCount || p.viewCount || p.play_count || 0,
              caption: p.caption || null,
              posted_at: p.timestamp || p.posted_at ? new Date(p.timestamp || p.posted_at).toISOString() : now
            });
        }
    });

    const reelsData = Array.from(reelsMap.values());
    if (reelsData.length > 0) {
      await supabase.from('reels').upsert(reelsData, { onConflict: 'reel_url' });
    }

    return new Response(JSON.stringify({ success: true, username }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    })
  }
})

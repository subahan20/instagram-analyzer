import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, accept, origin',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const apifyToken = (Deno.env.get('APIFY_API') || Deno.env.get('APIFY_TOKEN') || Deno.env.get('APIFY_API_TOKEN'))?.trim();
    
    // Configurable cache expiry (default 24 hours)
    const CACHE_EXPIRY_HOURS = parseInt(Deno.env.get('SCRAPER_CACHE_EXPIRY') || '24');

    const body = await req.json().catch(() => ({}));
    let { url, force = false, categoryId = null, subcategoryId = null, userId = null } = body;

    if (!url) {
      const requestUrl = new URL(req.url);
      url = requestUrl.searchParams.get('url');
    }

    if (!url) throw new Error('URL is required');

    // 1. Extract Username
    let username = "";
    try {
      if (url.includes('instagram.com/')) {
        const segments = new URL(url).pathname.split('/').filter(Boolean);
        // Handle URLs like instagram.com/reels/xyz/ or instagram.com/p/abc/
        if (['reels', 'p', 'tv'].includes(segments[0])) {
           // We might need to fetch the username from the page or just use the URL
           // For simplicity, if it's a post URL, we'll try to get the owner if possible later, 
           // but the user usually enters a profile URL.
           username = "unknown"; 
        } else {
           username = segments[0];
        }
      } else {
        username = url.replace('@', '').trim();
      }
    } catch (_e) {
      username = url.split('/').filter(Boolean).pop() || "";
    }

    username = username.toLowerCase().split('?')[0];
    if (!username || username === 'unknown') throw new Error("Could not extract valid username from URL");

    // 2. Fetch Existing Influencer Metadata (Maintain Categories)
    const { data: existingInfluencer } = await supabase
      .from('influencers')
      .select('category_id, subcategory_id')
      .eq('username', username)
      .eq('user_id', userId) // User-specific preservation
      .maybeSingle();

    // Preserve existing IDs if not provided in body
    const finalCategoryId = categoryId ?? existingInfluencer?.category_id ?? null;
    const finalSubcategoryId = subcategoryId ?? existingInfluencer?.subcategory_id ?? null;

    // 3. Cache Check Logic
    const { data: cacheEntry } = await supabase
      .from('scraper_cache')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (cacheEntry && !force) {
      const lastScraped = new Date(cacheEntry.last_scraped_at).getTime();
      const now = new Date().getTime();
      const diffHours = (now - lastScraped) / (1000 * 60 * 60);

      if (diffHours < CACHE_EXPIRY_HOURS) {
        
        // Always fetch the latest data from influencers table as requested
        const { data: influencer } = await supabase
          .from('influencers')
          .select('*')
          .eq('username', username)
          .maybeSingle();

        return new Response(JSON.stringify({ 
          success: true, 
          source: 'cache', 
          data: influencer,
          message: `Using cached data (Updated ${diffHours.toFixed(1)}h ago)`
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        });
      }
    } else {
      console.log(`[SCRAPER] Cache MISS for ${username}`);
    }

    // 4. API Integration (Triggered if cache miss or force)
    if (!apifyToken) throw new Error('Missing APIFY token');

    // Helper to parse numbers from Apify strings/numbers
    const parseNum = (val: any) => {
      if (typeof val === 'number') return val;
      if (typeof val !== 'string') return 0;
      let clean = val.trim().toLowerCase().replace(/,/g, '');
      let multiplier = 1;
      if (clean.endsWith('k')) multiplier = 1000;
      else if (clean.endsWith('m')) multiplier = 1000000;
      const numMatch = clean.match(/[0-9.]+/);
      return numMatch ? Math.round(parseFloat(numMatch[0]) * multiplier) : 0;
    };

    const getViews = (p: any) => {
      const v = p?.videoPlayCount ?? p?.typeCount?.videoPlayCount ?? p?.playCount ?? p?.play_count ?? p?.video_play_count ?? p?.viewCount ?? p?.videoViewCount ?? p?.video_view_count ?? p?.views;
      return parseNum(v ?? 0);
    };

    const getLikes = (p: any) => parseNum(p?.likesCount ?? p?.like_count ?? p?.likes ?? 0);

    const profileScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
    const reelsScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items?token=${apifyToken}`;

    const [profileResponse, reelsResponse] = await Promise.all([
      fetch(profileScraperUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          directUrls: [`https://www.instagram.com/${username}/`], 
          usernames: [username], 
          resultsLimit: 1,
          proxyConfiguration: { useApifyProxy: true }
        }) 
      }),
      fetch(reelsScraperUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          directUrls: [`https://www.instagram.com/${username}/reels/`],
          username: [username], 
          profiles: [username],
          resultsLimit: 300,
          maxItems: 300,
          proxyConfiguration: { useApifyProxy: true }
        }) 
      })
    ]);

    if (!profileResponse.ok) throw new Error(`Apify Profile Scraper failed: ${await profileResponse.text()}`);
    
    const profileResults = await profileResponse.json();
    const raw = profileResults[0];
    if (!raw) throw new Error('Profile not found on Instagram');

    let reelsResults = [];
    if (reelsResponse.ok) {
      reelsResults = await reelsResponse.json();
    }

    // Calculate Averages
    const reelPosts = reelsResults.filter((p: any) => {
      const type = (p.type || p.product_type || '').toLowerCase();
      return type === 'video' || type === 'reel' || !!p.videoUrl;
    });

    const avgLikes = reelPosts.length > 0 ? Math.round(reelPosts.reduce((sum: number, p: any) => sum + getLikes(p), 0) / reelPosts.length) : 0;
    const avgViews = reelPosts.length > 0 ? Math.round(reelPosts.reduce((sum: number, p: any) => sum + getViews(p), 0) / reelPosts.length) : 0;

    // 4. PREPARE Database Updates
    const now = new Date();
    const nowIso = now.toISOString();
    
    // Fetch Existing Influencer Id (to link reels)
    const { data: currentInfluencer } = await supabase
      .from('influencers')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    const influencerId = currentInfluencer?.id;

    // 5. Save Reels with Sync Tracking (PERSIST FIRST)
    if (reelPosts.length > 0 && influencerId) {
      const reelsData = reelPosts.map((p: any) => ({
        influencer_id: influencerId,
        reel_url: p.url || p.instagramUrl || `https://www.instagram.com/reels/${p.shortCode || p.id}/`,
        video_url: p.videoUrl || null,
        // Correctly store thumbnail image (NOT the video URL)
        display_url: p.displayUrl || p.thumbnailUrl || p.previewImageUrl || p.imageUrl || null,
        caption: p.caption || null,
        views: getViews(p),
        likes: getLikes(p),
        user_id: userId, // Ensure userId is passed to reels
        posted_at: p.timestamp ? new Date(p.timestamp).toISOString() : nowIso,
        last_synced_at: nowIso
      }));

      // NOTE: Using reel_url and user_id as unique constraint to avoid duplicates per user
      await supabase.from('reels').upsert(reelsData, { onConflict: 'reel_url,user_id' });
    }

    // 6. Save Metrics History
    if (influencerId) {
      await supabase.from('metrics_history').insert({
        influencer_id: influencerId,
        followers: raw.followersCount || 0,
        following: raw.followsCount || 0,
        total_posts: raw.postsCount || 0,
        likes: avgLikes,
        views: avgViews,
        captured_at: nowIso
      });
    }

    // 7. Update Influencer Master Table (FINAL TRIGGER FOR UI REALTIME)
    const influencerPayload: any = {
      username,
      profile_pic: raw?.profilePicUrlHD ?? raw?.profilePicUrl,
      followers_count: raw?.followersCount ?? 0,
      following_count: raw?.followsCount ?? 0,
      posts_count: raw?.postsCount ?? 0,
      last_updated_at: nowIso,
      last_synced_at: nowIso,
      last_fetched_at: nowIso,
      last_checked_at: nowIso,
      is_fresh: true,
      // Backward compatibility columns
      followers: raw?.followersCount ?? 0,
      following: raw?.followsCount ?? 0,
      posts: raw?.postsCount ?? 0,
      profile_url: `https://www.instagram.com/${username}/`,
      avg_likes: avgLikes,
      reel_views: avgViews,
      category_id: finalCategoryId,
      subcategory_id: finalSubcategoryId,
      user_id: userId // Ensure userId is part of the payload
    };

    const { data: influencer, error: infError } = await supabase
      .from('influencers')
      .upsert(influencerPayload, { onConflict: 'username,user_id' })
      .select()
      .single();

    if (infError) throw infError;

    // 8. Append to Scraper Cache (History Log)
    const cachePayload = {
      username,
      fetched_at: nowIso,
      followers_count: raw?.followersCount ?? 0,
      following_count: raw?.followsCount ?? 0,
      posts_count: raw?.postsCount ?? 0,
      avg_likes: avgLikes,
      avg_views: avgViews,
      raw_data: { profile: raw, reels: reelPosts, synced_at: nowIso }
    };

    await supabase.from('scraper_cache').insert(cachePayload);

    // 8. Trigger Followers Scrape in Background (Automation)
    const baseUrl = Deno.env.get('SUPABASE_URL');
    if (baseUrl) {
      fetch(`${baseUrl}/functions/v1/scrape-followers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ username, influencerId: influencer.id })
      }).catch(err => console.error('[SCRAPER] Automated followers trigger failed:', err.message));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      source: 'api', 
      data: influencer,
      message: 'Successfully fetched fresh data and updated history'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error: any) {
    console.error('[SCRAPER ERROR]', error.message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'An unexpected error occurred during scraping' 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 // Return 200 so callers (like refresh-instagram-data or n8n) can read the error
    });
  }
})

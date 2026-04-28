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
    let existingQuery = supabase
      .from('influencers')
      .select('id, category_id, subcategory_id')
      .eq('username', username);
    
    if (userId) {
      existingQuery = existingQuery.eq('user_id', userId);
    } else {
      existingQuery = existingQuery.is('user_id', null);
    }

    const { data: existingInfluencer } = await existingQuery.maybeSingle();

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
        let cacheInfluencerQuery = supabase
          .from('influencers')
          .select('*')
          .eq('username', username);
        
        if (userId) cacheInfluencerQuery = cacheInfluencerQuery.eq('user_id', userId);

        const { data: influencer } = await cacheInfluencerQuery.maybeSingle();

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
    const getComments = (p: any) => parseNum(p?.commentsCount ?? p?.comments_count ?? p?.comments ?? 0);

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
          maxPosts: force ? 1000 : 24, // Fetch 1000 posts from grid if forced
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
          resultsLimit: force ? 1000 : 300,
          maxItems: force ? 1000 : 300,
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
      try {
        reelsResults = await reelsResponse.json();
      } catch (err) {
        console.warn('[SCRAPER] Reels fetch failed, continuing with grid posts only.');
      }
    }

    // Merge results from both grid and reels tab
    const combinedResults = [
      ...(raw?.latestPosts || []),
      ...(reelsResults || [])
    ];

    const reelPosts = combinedResults.filter((p: any) => {
      const type = (p.type || p.product_type || p.typeCount?.type || '').toLowerCase();
      return type === 'video' || type === 'reel' || !!p.videoUrl || !!p.videoPlayCount;
    });

    // Deduplicate by shortcode so we don't process the same video twice if it's in both grid and reels
    const uniquePostsMap = new Map();
    reelPosts.forEach(p => {
      const sc = p.shortCode || p.id || p.url?.split('/').filter(Boolean).pop();
      if (sc) uniquePostsMap.set(sc, p);
    });
    const finalReelPosts = Array.from(uniquePostsMap.values());

    const avgLikes = finalReelPosts.length > 0 ? Math.round(finalReelPosts.reduce((sum: number, p: any) => sum + getLikes(p), 0) / finalReelPosts.length) : 0;
    const avgViews = finalReelPosts.length > 0 ? Math.round(finalReelPosts.reduce((sum: number, p: any) => sum + getViews(p), 0) / finalReelPosts.length) : 0;
    const avgComments = finalReelPosts.length > 0 ? Math.round(finalReelPosts.reduce((sum: number, p: any) => sum + getComments(p), 0) / finalReelPosts.length) : 0;

    // 4. PREPARE Database Updates
    const now = new Date();
    const nowIso = now.toISOString();

    // 5. UPSERT INFLUENCER FIRST — we need the ID to link reels
    const influencerPayload: any = {
      username,
      full_name: raw?.fullName ?? null,
      profile_pic: null as string | null,
      bio: raw?.biography ?? null,
      profile_url: `https://www.instagram.com/${username}/`,
      followers_count: raw?.followersCount ?? 0,
      following_count: raw?.followsCount ?? 0,
      posts_count: raw?.postsCount ?? 0,
      is_private: raw?.private ?? false,
      is_verified: raw?.verified ?? false,
      external_url: raw?.externalUrl ?? null,
      avg_likes: avgLikes,
      avg_comments: avgComments,
      reel_views: avgViews,
      last_updated_at: nowIso,
      last_synced_at: nowIso,
      category_id: finalCategoryId,
      subcategory_id: finalSubcategoryId,
      user_id: userId
    };

    // Attempt to permanentize the profile pic
    const picUrl = raw?.profilePicUrlHD || raw?.profilePicUrl;
    if (picUrl) {
      try {
        console.log(`[SCRAPER] Extraction tunnel: ${picUrl.substring(0, 50)}...`);
        // Use a proxy tunnel for the download to bypass IP blocks
        const tunnelUrl = `https://images.weserv.nl/?url=${encodeURIComponent(picUrl)}&w=200&h=200&fit=cover`;
        const picResponse = await fetch(tunnelUrl);
        
        if (picResponse.ok) {
          const buffer = await picResponse.arrayBuffer();
          const uint8 = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          const base64 = btoa(binary);
          const contentType = picResponse.headers.get('content-type') || 'image/jpeg';
          influencerPayload.profile_pic = `data:${contentType};base64,${base64}`;
          console.log(`[SCRAPER] Successfully extracted and saved profile pic.`);
        } else {
          console.warn('[SCRAPER] Extraction tunnel failed, saving raw URL');
          influencerPayload.profile_pic = picUrl;
        }
      } catch (picErr) {
        console.error('[SCRAPER] Extraction error:', picErr);
        influencerPayload.profile_pic = picUrl;
      }
    }

    // 5. UPDATE OR INSERT INFLUENCER — we need the ID to link reels
    let influencerResult;
    
    if (existingInfluencer?.id) {
      console.log(`[SCRAPER] Updating existing identity: ${username} (ID: ${existingInfluencer.id})`);
      influencerResult = await supabase
        .from('influencers')
        .update(influencerPayload)
        .eq('id', existingInfluencer.id)
        .select()
        .single();
    } else {
      console.log(`[SCRAPER] Creating new identity: ${username}`);
      influencerResult = await supabase
        .from('influencers')
        .insert(influencerPayload)
        .select()
        .single();
    }
    
    const { data: influencer, error: infError } = influencerResult;
    if (infError) throw infError;

    const influencerId = influencer.id;

    // 6. Update REELS (Per Request: Update everything including old reels' likes/views)
    if (finalReelPosts.length > 0 && influencerId) {
      const allReelsData = finalReelPosts
        .map((p: any) => {
          // Normalize URL: Ensure consistent /reel/ format and remove trailing slashes
          let rawUrl = p.url || p.instagramUrl || `https://www.instagram.com/reel/${p.shortCode || p.id}/`;
          const shortCode = p.shortCode || p.id || rawUrl.split('/').filter(Boolean).pop();
          const normalizedUrl = `https://www.instagram.com/reel/${shortCode}/`;

          return {
            influencer_id: influencerId,
            owner_username: username,
            reel_url: normalizedUrl,
            video_url: p.videoUrl || null,
            display_url: p.displayUrl || p.thumbnailUrl || p.previewImageUrl || p.imageUrl || null,
            caption: p.caption || null,
            views: getViews(p),
            likes: getLikes(p),
            comments: getComments(p),
            user_id: userId,
            posted_at: p.timestamp ? new Date(p.timestamp).toISOString() : nowIso,
            last_synced_at: nowIso
          };
        });

      console.log(`[SCRAPER] Updating and deduplicating ${allReelsData.length} reels for ${username}...`);

      // 6.5 DEEP DEDUPLICATION: Find and remove old variants (/p/ vs /reel/)
      try {
        const { data: existingReels } = await supabase
          .from('reels')
          .select('id, reel_url')
          .eq('influencer_id', influencerId);
        
        if (existingReels && existingReels.length > 0) {
          const toDelete: string[] = [];
          
          for (const newReel of allReelsData) {
            const newShortcode = newReel.reel_url.split('/').filter(Boolean).pop();
            
            for (const oldReel of existingReels) {
              const oldShortcode = oldReel.reel_url.split('/').filter(Boolean).pop();
              
              // If it's the same video but the URL string is different (e.g. /p/ vs /reel/)
              if (newShortcode === oldShortcode && newReel.reel_url !== oldReel.reel_url) {
                toDelete.push(oldReel.id);
              }
            }
          }
          
          if (toDelete.length > 0) {
            console.log(`[SCRAPER] Found ${toDelete.length} duplicate reel records. Deleting old variants...`);
            await supabase.from('reels').delete().in('id', toDelete);
          }
        }
      } catch (err) {
        console.warn('[SCRAPER] Deduplication failed:', err);
      }
      
      // Safe Upsert: Try with comments, fallback if column missing
      const { error: reelsError } = await supabase
        .from('reels')
        .upsert(allReelsData, { onConflict: 'reel_url,user_id' });

      if (reelsError) {
        // Handle PostgREST "Could not find the 'comments' column" error
        const isMissingColumn = reelsError.message.includes('comments') && 
                               (reelsError.message.includes('column') || reelsError.message.includes('schema cache'));
        
        if (isMissingColumn) {
          console.log('[SCRAPER] Reels table: "comments" column missing in DB. Retrying without it...');
          const safeData = allReelsData.map(({ comments, ...rest }) => rest);
          const { error: retryError } = await supabase
            .from('reels')
            .upsert(safeData, { onConflict: 'reel_url,user_id' });
          if (retryError) console.warn('[SCRAPER] Reels safe-upsert failed:', retryError.message);
        } else {
          console.warn('[SCRAPER] Reels update warning:', reelsError.message);
        }
      }
    }

    // 7. Save Metrics History (Resilient Schema Handling)
    if (influencerId) {
      const metricsData: any = {
        influencer_id: influencerId,
        followers: raw.followersCount || 0,
        following: raw.followsCount || 0,
        total_posts: raw.postsCount || 0,
        captured_at: nowIso
      };

      // Attempt to include likes/views with fallback names if they exist
      // We wrap this in a separate check to avoid crashing if columns are missing
      await supabase.from('metrics_history').insert(metricsData).then(({ error }) => {
        if (error && error.message.includes('column')) {
           console.log('[SCRAPER] Metrics history: Some columns missing, retrying with basic stats');
           // Basic stats only fallback
           return supabase.from('metrics_history').insert({
             influencer_id: influencerId,
             followers: metricsData.followers,
             captured_at: nowIso
           });
        }
      }).catch(err => console.warn('[SCRAPER] Metrics history failed:', err.message));
    }


    // 8. Append to Scraper Cache (Audit Trail)
    const cachePayload = {
      username,
      last_scraped_at: nowIso,
      raw_data: { 
        followers_count: raw?.followersCount ?? 0,
        following_count: raw?.followsCount ?? 0,
        posts_count: raw?.postsCount ?? 0,
        avg_likes: avgLikes,
        avg_views: avgViews,
        profile: raw, 
        reels_count: reelPosts.length,
        synced_at: nowIso 
      }
    };

    await supabase.from('scraper_cache').upsert(cachePayload, { onConflict: 'username' });

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

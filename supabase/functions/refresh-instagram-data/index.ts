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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const apifyToken = (Deno.env.get('APIFY_API') || Deno.env.get('APIFY_TOKEN') || Deno.env.get('APIFY_API_TOKEN'))?.trim()

    if (!supabaseUrl || !serviceRoleKey || !apifyToken) {
      throw new Error('Missing environment variables')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    
    const body = await req.json().catch(() => ({}));
    let { username: inputUsername, url: inputUrl, force = false, batch = false } = body;
    let targetUsername = inputUsername || inputUrl;
    
    // ─── BATCH SYNC MODE ───
    if (!targetUsername || batch) {
      console.log('[BATCH] No username provided. Starting batch refresh of influencers...');
      const { data: influencers, error: listError } = await supabase
        .from('influencers')
        .select('username')
        .order('last_checked_at', { ascending: true })
        .limit(10); // Process 10 at a time to avoid timeouts

      if (listError) throw listError;
      if (!influencers || influencers.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'No influencers found to refresh' }), { headers: corsHeaders });
      }

      console.log(`[BATCH] Triggering refreshes for ${influencers.length} influencers...`);
      // We trigger individual invokes or just return instructions. 
      // For now, let's just process the most stale one to resolve the immediate error.
      targetUsername = influencers[0].username;
      console.log(`[BATCH] Auto-selecting most stale: ${targetUsername}`);
    }

    if (targetUsername && targetUsername.includes('instagram.com/')) {
        targetUsername = targetUsername.split('/').filter(Boolean).pop()?.toLowerCase().replace('@', '').split('?')[0];
    } else if (targetUsername) {
        targetUsername = targetUsername.toLowerCase().replace('@', '').trim();
    }

    if (!targetUsername) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No target influencer provided for refresh. (Batch mode attempted if empty)' 
      }), { headers: corsHeaders });
    }

    // 1. Fetch current data from Supabase
    const { data: influencer, error: infError } = await supabase
      .from('influencers')
      .select('*')
      .eq('username', targetUsername)
      .maybeSingle();

    if (infError) throw infError;
    if (!influencer) return new Response(JSON.stringify({ success: false, error: 'Influencer not found in database' }), { headers: corsHeaders, status: 404 });

    const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes optimization
    const now = new Date();
    const lastChecked = influencer.last_checked_at ? new Date(influencer.last_checked_at) : new Date(0);

    if (now.getTime() - lastChecked.getTime() < COOLDOWN_MS && !force) {
      console.log(`[LIGHTWEIGHT] Skipping check for ${targetUsername} (Cooldown active)`);
      return new Response(JSON.stringify({ 
        success: true, 
        source: 'cooldown', 
        message: 'Checked recently. Skipping lightweight API call.', 
        data: influencer 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Call Lightweight Scraper (Profile info + minimal posts for avg_likes)
    console.log(`[LIGHTWEIGHT] Fetching fresh metrics for ${targetUsername}...`);
    const profileScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
    
    const profileResponse = await fetch(profileScraperUrl, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        usernames: [targetUsername], 
        resultsLimit: 1,
        postsLimit: 3 // Small number of posts to get fresh engagement data
      }) 
    });

    if (!profileResponse.ok) throw new Error(`Apify Lightweight Check failed: ${await profileResponse.text()}`);
    const results = await profileResponse.json();
    const fresh = results[0];

    if (!fresh) throw new Error('Could not find profile on Instagram');

    // Helper to parse numbers
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

    const getLikes = (p: any) => parseNum(p?.likesCount ?? p?.like_count ?? p?.likes ?? 0);

    // Calculate fresh avg_likes from the few posts retrieved
    const freshPosts = fresh.latestPosts || [];
    const freshAvgLikes = freshPosts.length > 0 
      ? Math.round(freshPosts.reduce((sum: number, p: any) => sum + getLikes(p), 0) / freshPosts.length) 
      : 0;

    // 3. Compare Metrics
    const currentMetrics = {
      followers: influencer.followers_count || 0,
      following: influencer.following_count || 0,
      posts: influencer.posts_count || 0,
      likes: influencer.avg_likes || 0
    };

    const newMetrics = {
      followers: fresh.followersCount || 0,
      following: fresh.followsCount || 0,
      posts: fresh.postsCount || 0,
      likes: freshAvgLikes
    };

    const hasChanged = 
      currentMetrics.followers !== newMetrics.followers ||
      currentMetrics.following !== newMetrics.following ||
      currentMetrics.posts !== newMetrics.posts ||
      Math.abs(currentMetrics.likes - newMetrics.likes) > 5; // Allow minor fluctuation in likes to avoid noise

    console.log(`[LIGHTWEIGHT] ${targetUsername} metrics comparison: 
      Followers: ${currentMetrics.followers} -> ${newMetrics.followers}
      Following: ${currentMetrics.following} -> ${newMetrics.following}
      Posts: ${currentMetrics.posts} -> ${newMetrics.posts}
      Avg Likes: ${currentMetrics.likes} -> ${newMetrics.likes}
      Changed=${hasChanged}`);

    let finalData = influencer;

    if (hasChanged || force) {
      // 4. Trigger Full Scraper & Store in scraped_cache
      console.log(`[LIGHTWEIGHT] Change detected for ${targetUsername}. Performing full recovery...`);
      
      const influencerUrl = `https://www.instagram.com/${targetUsername}/`;
      
      // We'll call the Full Scraper (Apify Profile + Reels) 
      const reelsScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
      const reelsResponse = await fetch(reelsScraperUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          username: [targetUsername], 
          profiles: [targetUsername],
          resultsLimit: 50
        }) 
      });

      let fullData: any[] = [];
      if (reelsResponse.ok) {
        fullData = await reelsResponse.json();
      }

      // Store RAW in scraper_cache
      console.log(`[CACHE] Storing raw sync for ${targetUsername} in scraper_cache...`);
      const { error: cacheError } = await supabase
        .from('scraper_cache')
        .insert({ 
          username: targetUsername, 
          raw_data: { profile: fresh, reels: fullData },
          fetched_at: now.toISOString(),
          followers_count: newMetrics.followers,
          following_count: newMetrics.following,
          posts_count: newMetrics.posts,
          avg_likes: newMetrics.likes
        });

      if (cacheError) console.error('[CACHE ERROR]', cacheError);

      // 5. Invoke the 'post' / 'scrape' function logic to update main tables (influencers, reels)
      // We can use invoke('post') or just call the logic. For simplicity, we trigger a dedicated 'scrape' with force:true to finalize.
      const { data: fullSyncResult, error: syncError } = await supabase.functions.invoke('scrape', {
        body: { url: targetUsername, force: true }
      });

      if (syncError) throw syncError;
      finalData = fullSyncResult?.data || influencer;
    } else {
      // Update last_checked_at only
      await supabase
        .from('influencers')
        .update({ last_checked_at: now.toISOString() })
        .eq('id', influencer.id);
      
      finalData = { ...influencer, last_checked_at: now.toISOString() };
    }

    return new Response(JSON.stringify({ 
      success: true, 
      source: hasChanged ? 'full_sync' : 'lightweight_check',
      message: hasChanged ? 'Intelligence updated due to detected change' : 'No changes detected',
      data: finalData
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Refresh Function] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})

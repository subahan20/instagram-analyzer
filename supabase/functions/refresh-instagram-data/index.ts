import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const apifyToken = (Deno.env.get('APIFY_API') || Deno.env.get('APIFY_TOKEN') || Deno.env.get('APIFY_API_TOKEN'))?.trim()

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[Refresh] CRITICAL: Missing Supabase secrets.')
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Edge Function Configuration Error: Missing SUPABASE_URL or SERVICE_ROLE_KEY.' 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (!apifyToken) {
       console.error('[Refresh] CRITICAL: Missing Apify token.')
       return new Response(JSON.stringify({ 
         success: false, 
         error: 'Missing Apify API Token.' 
       }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    
    const body = await req.json().catch(() => ({}));
    // Force must default to false for automation to follow the "Check then Scrape" logic
    const { 
      username: inputUsername, 
      url: inputUrl, 
      batch = false, 
      force = false, 
      userId, 
      categoryId, 
      subcategoryId 
    } = body;
    let targetUsername = inputUsername || inputUrl;
    
    if (batch) {
      const { data: influencers, error: listError } = await supabase
        .from('influencers')
        .select('username')
        .order('last_checked_at', { ascending: true })
        .limit(1)
      if (listError) throw listError;
      if (influencers?.[0]) targetUsername = influencers[0].username;
    }

    if (!targetUsername) {
      return new Response(JSON.stringify({ success: true, message: 'Signal hub operational' }), { headers: corsHeaders, status: 200 });
    }

    // Normalize username
    if (targetUsername.includes('instagram.com/')) {
        targetUsername = targetUsername.split('/').filter(Boolean).pop()?.toLowerCase().replace('@', '').split('?')[0];
    } else {
        targetUsername = targetUsername.toLowerCase().replace('@', '').trim();
    }

    // 1. Fetch current data — Pick the most recent one if duplicates exist
    let influencerQuery = supabase
      .from('influencers')
      .select('*')
      .eq('username', targetUsername)
      .order('last_synced_at', { ascending: false })
      .limit(1);
    
    // If userId is provided, scope to that user for proper isolation
    if (userId) influencerQuery = influencerQuery.eq('user_id', userId);

    const { data: influencers, error: infError } = await influencerQuery;

    if (infError) throw infError;
    const influencer = influencers?.[0];

    if (!influencer) {
      console.log(`[REFRESH] Influencer '${targetUsername}' not found in DB. Skipping.`);
      return new Response(JSON.stringify({ success: false, error: 'Influencer not found' }), { headers: corsHeaders, status: 200 });
    }

    // Cooldown removed to ensure live data on every trigger (n8n/UI)
    // We now rely on the 'Smart Gatekeeper' lightweight check below to save credits.
    const now = new Date();

    let finalData = influencer;
    let triggeredDeepSync = false;
    let wasUpdated = false;

    // ─── SMART ORCHESTRATION ───
    // If NOT forced, we do a lightweight check first to save Apify credits
    if (!force) {
      console.log(`[REFRESH] Performing lightweight check for ${targetUsername}`);
      const profileScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
      
      const profileResponse = await fetch(profileScraperUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ usernames: [targetUsername], resultsLimit: 1, postsLimit: 3 }) 
      });

      if (!profileResponse.ok) throw new Error(`Lightweight check failed: ${profileResponse.statusText}`);
      
      const results = await profileResponse.json();
      const fresh = results[0];
      if (!fresh) throw new Error('Profile not found during refresh check');

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

      const nextFollowers = parseNum(fresh.followersCount || 0);
      const nextPosts = parseNum(fresh.postsCount || 0);
      const freshLikes = (fresh.latestPosts || []).length > 0 
        ? Math.round(fresh.latestPosts.reduce((sum: number, p: any) => sum + parseNum(p.likesCount || 0), 0) / fresh.latestPosts.length) 
        : 0;

      // ─── POST-ID BASED DETECTION (Per Specification) ───
      const latestPost = fresh.latestPosts?.[0];
      const latestShortcode = latestPost?.shortCode || latestPost?.url?.split('/').filter(Boolean).pop();

      // Check if this specific post already exists in our 'reels' table
      const { data: existingPost } = await supabase
        .from('reels')
        .select('id')
        .eq('influencer_id', influencer.id)
        .or(`reel_url.ilike.%/${latestShortcode}/%,reel_url.ilike.%/${latestShortcode}`)
        .maybeSingle();

      const hasNewPosts = !existingPost && latestShortcode;
      
      // Also keep profile change detection as a secondary trigger
      const statsChanged = 
        influencer.followers_count !== nextFollowers ||
        influencer.posts_count !== nextPosts;

      if (hasNewPosts || statsChanged) {
        console.log(`[REFRESH] New data detected for ${targetUsername}. Requesting deep sync.`);
        triggeredDeepSync = true;
      } else {
        console.log(`[REFRESH] Minor or no changes for ${targetUsername}. Updating basic stats only.`);
        
        // Even if no "significant" change, we should still update the basic stats we just fetched
        const { data: updatedData, error: updateError } = await supabase
          .from('influencers')
          .update({ 
            followers_count: nextFollowers,
            posts_count: nextPosts,
            avg_likes: freshLikes,
            last_checked_at: now.toISOString(),
            is_fresh: true 
          })
          .eq('id', influencer.id)
          .select();

        const updatedInfluencer = updatedData?.[0];

        if (!updateError && updatedInfluencer) {
          finalData = updatedInfluencer;
          
          // ─── NEW: Update recent reels found in the lightweight check ───
          const latestPosts = fresh.latestPosts || [];
          if (latestPosts.length > 0) {
            console.log(`[REFRESH] Updating ${latestPosts.length} recent reels for ${targetUsername}`);
            
            for (const post of latestPosts) {
              const shortcode = post.shortCode || post.url?.split('/').filter(Boolean).pop();
              if (!shortcode) continue;

              const postViews = parseNum(post.videoPlayCount || post.viewCount || 0);
              const postLikes = parseNum(post.likesCount || 0);

              // Update the reel in the database if it exists
              await supabase
                .from('reels')
                .update({ 
                  views: postViews,
                  likes: postLikes,
                  last_synced_at: now.toISOString()
                })
                .eq('influencer_id', influencer.id)
                .or(`reel_url.ilike.%/${shortcode}/%,reel_url.ilike.%/${shortcode}`);
            }
          }
          
          wasUpdated = true;
        }
      }
    } else {
      // Force mode: Go straight to deep scrape
      console.log(`[REFRESH] Force sync requested for ${targetUsername}`);
      triggeredDeepSync = true;
    }

    // ─── FINAL SYNC EXECUTION (Single Time Only) ───
    if (triggeredDeepSync) {
      const { data: fullSyncResult, error: syncError } = await supabase.functions.invoke('scrape', {
        body: { 
          url: targetUsername, 
          force: true, 
          userId: influencer.user_id,
          categoryId: influencer.category_id,
          subcategoryId: influencer.subcategory_id 
        }
      });
      
      if (syncError) throw syncError;
      if (!fullSyncResult?.success) throw new Error(fullSyncResult?.error || 'Deep sync failed');
      
      console.log(`[REFRESH] Deep sync SUCCESS for ${targetUsername}`);
      finalData = fullSyncResult.data || influencer;
      wasUpdated = true;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      was_updated: wasUpdated,
      triggered_deep_sync: triggeredDeepSync,
      data: finalData, 
      message: wasUpdated ? 'Data updated via deep sync' : 'Checked: No update required'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error: any) {
    const msg = error.message || error.toString() || 'An unexpected error occurred in the Intelligence Engine';
    console.error('[REFRESH ERROR]', msg);
    
    // Check if it's a specific delegation error
    let status = 200;
    if (msg.includes('non-2xx status code')) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Delegation Failure: The 'scrape' motor is unreachable or returned an error. Check if 'scrape' is deployed correctly.`,
        originalError: msg 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: msg,
      details: error.stack 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });
  }
})

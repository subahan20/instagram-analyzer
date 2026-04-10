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
    const { username: inputUsername, url: inputUrl, batch = false, force = true, userId, categoryId, subcategoryId } = body;
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

    // 1. Fetch current data — MUST filter by user_id for isolation
    let influencerQuery = supabase
      .from('influencers')
      .select('*')
      .eq('username', targetUsername);
    
    // If userId is provided, scope to that user for proper isolation
    if (userId) influencerQuery = influencerQuery.eq('user_id', userId);

    const { data: influencer, error: infError } = await influencerQuery.maybeSingle();

    if (infError) throw infError;
    if (!influencer) return new Response(JSON.stringify({ success: false, error: 'Influencer not found' }), { headers: corsHeaders, status: 200 });

    const cooldown = 10 * 60 * 1000;
    const now = new Date();
    const lastChecked = influencer.last_checked_at ? new Date(influencer.last_checked_at) : new Date(0);

    if (now.getTime() - lastChecked.getTime() < cooldown && !force) {
      return new Response(JSON.stringify({ success: true, source: 'cooldown', data: influencer }), { headers: corsHeaders });
    }

    let finalData = influencer;

    // ─── SYNC EXECUTION ───
    if (force) {
       console.log(`[SYNC] Force sync for ${targetUsername}`);
       const { data: fullSyncResult, error: syncError } = await supabase.functions.invoke('scrape', {
         body: { url: targetUsername, force: true, userId: influencer.user_id }
       });
       if (syncError) throw syncError;
       finalData = fullSyncResult?.data || influencer;
    } else {
      // Lightweight check
      const profileScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
      const profileResponse = await fetch(profileScraperUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ usernames: [targetUsername], resultsLimit: 1, postsLimit: 3 }) 
      });

      if (!profileResponse.ok) throw new Error(`Apify check failed`);
      const results = await profileResponse.json();
      const fresh = results[0];
      if (!fresh) throw new Error('Profile not found');

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

      const freshLikes = (fresh.latestPosts || []).length > 0 
        ? Math.round(fresh.latestPosts.reduce((sum: number, p: any) => sum + parseNum(p.likesCount || 0), 0) / fresh.latestPosts.length) 
        : 0;

      const nextFollowers = parseNum(fresh.followersCount || 0);
      const nextPosts = parseNum(fresh.postsCount || 0);

      const hasChanged = 
        influencer.followers_count !== nextFollowers ||
        influencer.posts_count !== nextPosts ||
        Math.abs(influencer.avg_likes - freshLikes) > 10;

      if (hasChanged) {
        console.log(`[REFRESH] Change detected for ${targetUsername}: Followers (${influencer.followers_count}->${nextFollowers}), Posts (${influencer.posts_count}->${nextPosts}).`);
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
        if (!fullSyncResult?.success) throw new Error(fullSyncResult?.error || 'Master scrape delegation failed');
        finalData = fullSyncResult.data || influencer;
      } else {
        console.log(`[REFRESH] No significant changes for ${targetUsername}. Skipping deep scrape.`);
        await supabase.from('influencers').update({ 
          last_checked_at: now.toISOString(),
          is_fresh: true 
        }).eq('id', influencer.id);
      }
    }

    return new Response(JSON.stringify({ success: true, data: finalData, message: 'Sync completed' }), { 
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

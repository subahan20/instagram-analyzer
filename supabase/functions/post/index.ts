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
    let body;
    try {
      body = await req.json()
    } catch (_e) {
      body = {};
    }

    const {
      action,
      username: rawUsername,
      categoryId = null,
      subcategoryId = null
    } = body

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apifyToken = (Deno.env.get('APIFY_API') || Deno.env.get('APIFY_TOKEN') || Deno.env.get('APIFY_API_TOKEN'))?.trim()

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // --- Unified Metric Mapping Utilities ---
    const parseNum = (val: any) => {
      if (typeof val === 'number') return val;
      if (typeof val !== 'string') return 0;
      
      // Strip commas and handle suffixes
      let clean = val.trim().toLowerCase().replace(/,/g, '');
      let multiplier = 1;
      
      if (clean.endsWith('k')) multiplier = 1000;
      else if (clean.endsWith('m')) multiplier = 1000000;
      else if (clean.endsWith('b')) multiplier = 1000000000;
      
      const numMatch = clean.match(/[0-9.]+/);
      if (!numMatch) return 0;
      
      return Math.round(parseFloat(numMatch[0]) * multiplier) || 0;
    };

    const getLikes = (p: any) => parseNum(p.likesCount ?? p.like_count ?? p.likes ?? 0);
    const getComments = (p: any) => parseNum(p.commentsCount ?? p.comment_count ?? p.comments ?? 0);
    const getViews = (p: any) => parseNum(p.videoPlayCount ?? p.playCount ?? p.play_count ?? p.video_play_count ?? 0);

    // ─── ACTION: list — Dashboard influencer listing with filters ───
    if (action === 'list') {
      const { nameSearch } = body;

      const { count: totalCount } = await supabase
        .from('influencers')
        .select('*', { count: 'exact', head: true });

      let query = supabase
        .from('influencers')
        .select(`
          *,
          metrics:metrics_history(
            followers,
            following,
            total_posts,
            likes,
            comments,
            views,
            captured_at
          )
        `)
        .order('added_date', { ascending: false });

      const cleanId = (id: any) => {
        if (!id || id === 'null' || id === 'All Categories' || id === 'All Subcategories') return null;
        const n = Number(id);
        return isNaN(n) ? null : n;
      };

      const catId = cleanId(categoryId);
      const subId = cleanId(subcategoryId);

      if (catId !== null) query = query.eq('category_id', catId);
      if (subId !== null) query = query.eq('subcategory_id', subId);
      if (nameSearch) query = query.ilike('username', `%${nameSearch}%`);
      // Allow profiles with 0 views to appear instantly while n8n background scraper runs
      // query = query.gt('views', 0);

      const { data, error } = await query;
      if (error) throw error;

      const processedData = data?.map((inf: any) => {
        const history = inf.metrics?.sort((a: any, b: any) =>
          new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
        ) || [];

        const latest = history[0];
        const previous = history[1];

        let growth = 0;
        if (latest && previous && previous.followers > 0) {
          growth = Number(((latest.followers - previous.followers) / previous.followers * 100).toFixed(2));
        }

        return {
          ...inf,
          growth,
          latest_metrics: {
            followers: inf.followers || latest?.followers || 0,
            following: inf.following || latest?.following || 0,
            total_posts: inf.posts || latest?.total_posts || 0,
            likes: inf.likes || latest?.likes || 0,
            comments: inf.comments || latest?.comments || 0,
            views: inf.views || latest?.views || 0,
            captured_at: latest?.captured_at || inf.added_date,
            // Fallbacks for older UI code
            avg_likes: inf.likes || latest?.likes || 0,
            avg_comments: inf.comments || latest?.comments || 0,
            reel_views: inf.views || latest?.views || 0
          }
        };
      });

      return new Response(
        JSON.stringify({ success: true, data: processedData, totalCount, filteredCount: processedData?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ─── ACTION: get_profile — Profile detail page data ───
    if (action === 'get_profile') {
      const { influencerId } = body;
      if (!influencerId) throw new Error('influencerId is required');

      const { data: influencer, error: infError } = await supabase
        .from('influencers')
        .select('*')
        .eq('id', influencerId)
        .single();
      if (infError) throw infError;

      const { data: reels, error: reelsError } = await supabase
        .from('reels')
        .select('*')
        .eq('influencer_id', influencerId)
        .order('posted_at', { ascending: false, nullsFirst: false });
      if (reelsError) throw reelsError;

      const { data: latestMetrics } = await supabase
        .from('metrics_history')
        .select('*')
        .eq('influencer_id', influencerId)
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: { 
            influencer, 
            reels: reels || [], 
            latest_metrics: latestMetrics || null 
          } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ─── ACTION: fetch_and_store — Profile Scraper ───
    if (action === 'fetch_and_store' || !action) {
      if (!rawUsername) throw new Error('Username/URL is required');
      if (!apifyToken) throw new Error('Missing APIFY token');

      const input = rawUsername.trim();
      let targetUsername = '';
      if (input.includes('instagram.com/')) {
        try {
          const segments = new URL(input).pathname.split('/').filter(Boolean);
          targetUsername = ['reels', 'p', 'tv'].includes(segments[0]) ? 'unknown' : segments[0];
        } catch (_e) {
          targetUsername = input.split('instagram.com/')[1]?.split('/')[0] || 'unknown';
        }
      } else {
        targetUsername = input.startsWith('@') ? input.substring(1) : input;
      }
      if (targetUsername === 'unknown') throw new Error('Could not extract username from URL');

      const profileScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
      const reelsScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items?token=${apifyToken}`;

      // Run both scrapers in parallel
      const [profileResponse, reelsResponse] = await Promise.all([
        fetch(profileScraperUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames: [targetUsername], resultsLimit: 20 })
        }),
        fetch(reelsScraperUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: [targetUsername], resultsLimit: 20 })
        })
      ]);

      if (!profileResponse.ok) throw new Error(`Apify Profile Scraper failed: ${await profileResponse.text()}`);
      if (!reelsResponse.ok) console.error(`Apify Reels Scraper failed: ${await reelsResponse.text()}`); // Don't crash if only reels fail

      const profileResults = await profileResponse.json();
      const raw = profileResults[0];
      if (!raw) throw new Error('Profile not found');

      // Process Reels Data
      const reelsResults = reelsResponse.ok ? await reelsResponse.json() : [];
      const reelsMap = new Map();
      reelsResults.forEach((r: any) => {
        if (r.url) reelsMap.set(r.url, r);
      });

      // Merge profile latestPosts with exact reels data 
      const mergedPosts = (raw.latestPosts || []).map((p: any) => {
        const freshReel = reelsMap.get(p.url);
        return freshReel ? { ...p, ...freshReel } : p;
      });

      // Append any reels we found that weren't in the initial profile latestPosts
      for (const r of reelsResults) {
        if (!mergedPosts.some((p: any) => p.url === r.url)) {
          mergedPosts.push(r);
        }
      }

      const avgLikes = mergedPosts.length > 0 
        ? Math.round(mergedPosts.reduce((sum: number, p: any) => sum + getLikes(p), 0) / mergedPosts.length)
        : 0;
      const avgComments = mergedPosts.length > 0
        ? Math.round(mergedPosts.reduce((sum: number, p: any) => sum + getComments(p), 0) / mergedPosts.length)
        : 0;
      
      const reelPosts = mergedPosts.filter((p: any) => {
        const views = getViews(p);
        return views > 0 || p.type === 'Video' || p.type === 'Reel' || !!p.videoUrl;
      });
      const avgReelViews = reelPosts.length > 0
        ? Math.round(reelPosts.reduce((sum: number, p: any) => sum + getViews(p), 0) / reelPosts.length)
        : 0;

      const updatePayload: any = {
        username: targetUsername,
        profile_url: `https://www.instagram.com/${targetUsername}/`,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        profile_pic: raw.profilePicUrlHD || raw.profilePicUrl,
        business_category: raw.businessCategoryName || '',
        followers: raw.followersCount || 0,
        following: raw.followsCount || 0,
        posts: raw.postsCount || 0,
        last_synced_at: new Date().toISOString()
      };

      // ONLY update these if we actually have post data to average
      if (mergedPosts.length > 0) {
        updatePayload.likes = avgLikes;
        updatePayload.comments = avgComments;
        updatePayload.avg_likes = avgLikes;
        updatePayload.avg_comments = avgComments;
        
        if (avgReelViews > 0) {
          updatePayload.views = avgReelViews;
          updatePayload.reel_views = avgReelViews;
        }
      }

      // Upsert influencer
      const { data: influencer, error: infError } = await supabase
        .from('influencers')
        .upsert(updatePayload, { onConflict: 'username' })
        .select()
        .single();
      if (infError) throw infError;

      // Log metrics history
      const { error: metError } = await supabase
        .from('metrics_history')
        .insert({
          influencer_id: influencer.id,
          followers: raw.followersCount || 0,
          following: raw.followsCount || 0,
          total_posts: raw.postsCount || 0,
          likes: avgLikes,
          comments: avgComments,
          views: avgReelViews > 0 ? avgReelViews : (influencer.views || 0),
          captured_at: new Date().toISOString(),
          // Compatibility
          avg_likes: avgLikes,
          avg_comments: avgComments,
          reel_views: avgReelViews > 0 ? avgReelViews : (influencer.views || 0)
        });
      if (metError) throw metError;

      // Update reels
      if (reelPosts.length > 0) {
        const reelsData = reelPosts.map((post: any) => {
          const v = getViews(post);
          const likes = getLikes(post);
          const comms = getComments(post);
          
          const reel: any = {
            influencer_id: influencer.id,
            reel_url: post.url || `https://www.instagram.com/p/${post.shortcode || post.id || Date.now()}/`,
            video_url: post.videoUrl || null,
            display_url: post.displayUrl || post.thumbnailUrl || null,
            caption: post.caption || null,
            posted_at: post.timestamp ? new Date(post.timestamp).toISOString() : new Date().toISOString(),
            timestamp: post.timestamp ? new Date(post.timestamp).toISOString() : new Date().toISOString()
          };

          // ONLY include these if we have valid non-zero data to prevent overwriting with 0
          if (v > 0) {
            reel.views = v;
            reel.videoPlayCount = v;
            reel.play_count = v;
          }
          if (likes > 0) {
            reel.likes = likes;
            reel.likesCount = likes;
          }
          if (comms > 0) {
            reel.comments = comms;
            reel.commentsCount = comms;
          }

          return reel;
        });

        // DO NOT DELETE existing reels. Use UPSERT to preserve historical viral reels.
        const { error: reelsError } = await supabase.from('reels').upsert(reelsData, { onConflict: 'reel_url' });
        if (reelsError) console.error('[Profile Sync] Reels Error:', reelsError);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Profile synced', influencerId: influencer.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ─── ACTION: sync_reels — Reels Scraper ───
    if (action === 'sync_reels') {
      const { influencerId, instagramUrl } = body;
      if (!influencerId) throw new Error('influencerId is required');
      if (!instagramUrl) throw new Error('instagramUrl is required');
      if (!apifyToken) throw new Error('Missing APIFY token');

      const input = (instagramUrl || '').trim();
      let reelsUsername = '';
      if (input.includes('instagram.com/')) {
        try {
          const urlStr = input.startsWith('http') ? input : `https://${input}`;
          const urlObj = new URL(urlStr);
          const segments = urlObj.pathname.split('/').filter(Boolean);
          reelsUsername = segments[0] === 'reels' ? segments[1] : segments[0];
        } catch (_e) {
          reelsUsername = input.split('instagram.com/')[1]?.split('/')[0] || '';
        }
      } else {
        reelsUsername = input.replace('@', '');
      }
      
      reelsUsername = reelsUsername.split('?')[0].split('#')[0];
      if (!reelsUsername) throw new Error('Could not extract username for reels sync');

      console.log(`[Reels Sync] influencer=${influencerId} username=${reelsUsername}`);

      const reelsScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
      const reelsResponse = await fetch(reelsScraperUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: [reelsUsername],
          resultsLimit: 20 
        })
      });

      if (!reelsResponse.ok) throw new Error(`Apify Reels Scraper failed: ${await reelsResponse.text()}`);
      const reelsResults = (await reelsResponse.json()) || [];
      
      const filteredReels = reelsResults.filter((reel: any) => {
        const views = getViews(reel);
        return views > 0 || ['Video', 'Reel'].includes(reel.type) || !!reel.videoUrl;
      });

      const reelsData = filteredReels.map((reel: any) => {
        const v = getViews(reel);
        const l = getLikes(reel);
        const c = getComments(reel);

        const r: any = {
          influencer_id: influencerId,
          reel_url: reel.url || `https://www.instagram.com/p/${reel.shortCode || reel.id || Date.now()}/`,
          video_url:  reel.videoUrl || null,
          display_url: reel.videoUrl || reel.thumbnailUrl || null,
          caption:    reel.caption || null,
          posted_at:  reel.timestamp ? new Date(reel.timestamp).toISOString() : new Date().toISOString(),
          timestamp:  reel.timestamp ? new Date(reel.timestamp).toISOString() : new Date().toISOString()
        };

        if (v > 0) {
          r.views = v;
          r.videoPlayCount = v;
          r.play_count = v;
        }
        if (l > 0) {
          r.likes = l;
          r.likesCount = l;
        }
        if (c > 0) {
          r.comments = c;
          r.commentsCount = c;
        }

        return r;
      });

      // DO NOT DELETE existing reels. Use UPSERT with unique constraint on reel_url.
      const { error: reelsError } = await supabase.from('reels').upsert(reelsData, { onConflict: 'reel_url' });
      if (reelsError) throw reelsError;

      return new Response(
        JSON.stringify({ success: true, message: `${reelsData.length} reels synced`, count: reelsData.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    throw new Error(`Unsupported action: ${action}`);

  } catch (error: any) {
    const errorMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error');
    console.error('[Function Error Detail]', {
      message: errorMsg,
      stack: error?.stack,
      details: error?.details,
      hint: error?.hint,
      code: error?.code
    });
    return new Response(
      JSON.stringify({ error: errorMsg, details: error }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

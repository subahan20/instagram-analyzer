import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
}

// --- REFACTOR: Main Initialization Function ---
async function init(supabase: any, apifyToken: string) {
  
  // 1. Fetch all influencers
  const { data: influencers, error: influencerError } = await supabase
    .from('influencers')
    .select('id, username, profile_url, views')

  if (influencerError) {
    console.error('[Init] Influencer fetch error:', influencerError)
    throw influencerError
  }
  
  if (!influencers || influencers.length === 0) {
    return { success: true, message: 'No influencers to refresh' }
  }

  const usernames = influencers.map((inf: any) => inf.username);
  const influencerMap = Object.fromEntries(influencers.map((inf: any) => [
    inf.username.toLowerCase(), 
    { id: inf.id, username: inf.username, profile_url: inf.profile_url, current_views: inf.views || 0 }
  ]));

  // 2. Call Apify Scrapers
  
  // A. Profile Scraper (Batch) - for followers, following, posts
  const profileScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`
  
  const pResponse = await fetch(profileScraperUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames, resultsLimit: 20 })
  })

  // B. Reels Scraper (Batch) - for LIVE views
  const reelsScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items?token=${apifyToken}`
  
  const rResponse = await fetch(reelsScraperUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usernames, resultsLimit: 20 })
  })

  if (!pResponse.ok || !rResponse.ok) {
    const errorText = await (pResponse.ok ? rResponse.text() : pResponse.text())
    console.error('[Init] Apify API error:', errorText)
    throw new Error(`Apify request failed: ${errorText}`)
  }
  
  const profileResults = await pResponse.json()
  const reelsResults = await rResponse.json()
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

  // --- Robust Metric Extraction ---
  const getLikes = (p: any) => parseNum(p.likesCount ?? p.like_count ?? p.likes ?? 0)
  const getComments = (p: any) => parseNum(p.commentsCount ?? p.comment_count ?? p.comments ?? 0)
  const getViews = (p: any) => parseNum(p.videoPlayCount ?? p.playCount ?? p.play_count ?? p.video_play_count ?? 0)

  const influencerUpdates = []
  const metricsHistoryEntries = []
  const reelsToUpsert = []

  // Create a map of reels by URL for easy merging
  const reelsMap = new Map();
  for (const r of reelsResults) {
    if (r.url) reelsMap.set(r.url, r);
  }

  for (const item of profileResults) {
    const usernameKey = (item.username || '').toLowerCase()
    const mappedInf = influencerMap[usernameKey]

    if (!mappedInf) continue
    const influencerId = mappedInf.id

    const followers = parseNum(item.followersCount || 0)
    const following = parseNum(item.followsCount || 0)
    const postsCount = parseNum(item.postsCount || 0)
    // Merge latest posts from profile with fresh data from reels scraper if available
    const latestPosts = (item.latestPosts || []).map((p: any) => {
      const freshReel = reelsMap.get(p.url);
      return freshReel ? { ...p, ...freshReel } : p;
    });

    const avgLikes = latestPosts.length > 0 
      ? Math.round(latestPosts.reduce((sum: number, p: any) => sum + getLikes(p), 0) / latestPosts.length)
      : 0
    const avgComments = latestPosts.length > 0
      ? Math.round(latestPosts.reduce((sum: number, p: any) => sum + getComments(p), 0) / latestPosts.length)
      : 0

    // Calculate aggregate views from the reels we found in this sync
    const reelPosts = latestPosts.filter((p: any) => {
      const v = getViews(p);
      return v > 0 || p.type === 'Video' || p.type === 'Reel' || !!p.videoUrl;
    });
    const syncReelViews = reelPosts.reduce((sum: number, p: any) => sum + getViews(p), 0)
    const reelCount = reelPosts.length

    const updatePayload: any = {
      id: influencerId,
      username: mappedInf.username,
      profile_url: mappedInf.profile_url,
      followers,
      following,
      posts: postsCount,
      last_synced_at: new Date().toISOString()
    }

    // ONLY update these if we actually have post data to average
    if (latestPosts.length > 0) {
      updatePayload.likes = avgLikes
      updatePayload.comments = avgComments
      updatePayload.avg_likes = avgLikes
      updatePayload.avg_comments = avgComments
      
      // If we found any video content, update the views. 
      // Otherwise, we keep the previous value in the DB.
      if (reelCount > 0 && syncReelViews > 0) {
        updatePayload.views = Math.round(syncReelViews / reelCount)
        updatePayload.reel_views = updatePayload.views
      }
    }
    influencerUpdates.push(updatePayload)

    const historyViews = (reelCount > 0 && syncReelViews > 0)
      ? Math.round(syncReelViews / reelCount) 
      : (mappedInf.current_views || 0);

    metricsHistoryEntries.push({
      influencer_id: influencerId,
      followers,
      following,
      total_posts: postsCount,
      likes: avgLikes,
      comments: avgComments,
      views: historyViews,
      avg_likes: avgLikes,
      avg_comments: avgComments,
      reel_views: historyViews,
      captured_at: new Date().toISOString()
    })

    for (const post of latestPosts) {
      const views = getViews(post)
      const likes = getLikes(post)
      const comms = getComments(post)
      const isReel = views > 0 || post.type === 'Video' || post.type === 'Reel' || !!post.videoUrl
      
      if (isReel) {
        const reel: any = {
          influencer_id: influencerId,
          reel_url: post.url || `https://www.instagram.com/p/${post.shortcode || post.id}/`,
          video_url: post.videoUrl || null,
          display_url: post.displayUrl || post.thumbnailUrl || null,
          caption: post.caption || null,
          posted_at: post.timestamp ? new Date(post.timestamp).toISOString() : new Date().toISOString(),
        }

        // SAFEGUARD: Only update if we have fresh non-zero data
        if (views > 0) {
          reel.views = views
          reel.videoPlayCount = views
          reel.play_count = views
        }
        if (likes > 0) {
          reel.likes = likes
          reel.likesCount = likes
        }
        if (comms > 0) {
          reel.comments = comms
          reel.commentsCount = comms
        }

        reelsToUpsert.push(reel)
      }
    }
  }

  // 3. Handle Deletions (Auto-remove reels deleted on Instagram)
  const reelsToDelete: string[] = []
  
  // Fetch existing reels for all influencers in this batch to compare
  const { data: existingReels, error: existingError } = await supabase
    .from('reels')
    .select('reel_url, influencer_id, posted_at')
    .in('influencer_id', influencerUpdates.map(u => u.id))

  if (!existingError && existingReels) {
    // Group existing reels by influencer
    const reelsByInfluencer = existingReels.reduce((acc: any, r: any) => {
      if (!acc[r.influencer_id]) acc[r.influencer_id] = []
      acc[r.influencer_id].push(r)
      return acc
    }, {})

    // Group fresh reels by influencer (for easy lookup)
    const freshReelsByUrl = new Set(reelsToUpsert.map(r => r.reel_url))

    for (const inf of influencerUpdates) {
      const dbReels = reelsByInfluencer[inf.id] || []
      const infFreshReels = reelsToUpsert.filter(r => r.influencer_id === inf.id)
      
      if (infFreshReels.length === 0 && dbReels.length > 0) {
        // If scraper returned 0 reels but account still exists, 
        // it might be a private account or scraping failure. 
        // We skip deletion to be safe unless we are sure.
        continue;
      }

      // Find the oldest "fresh" reel timestamp to define the window
      const timestamps = infFreshReels.map(r => new Date(r.posted_at).getTime())
      const oldestFreshTime = timestamps.length > 0 ? Math.min(...timestamps) : 0
      const scraperLimitReached = infFreshReels.length >= 20

      for (const dbReel of dbReels) {
        if (!freshReelsByUrl.has(dbReel.reel_url)) {
          // Reel is in DB but NOT in scraper results
          const dbReelTime = new Date(dbReel.posted_at).getTime()
          
          let shouldDelete = false
          if (!scraperLimitReached) {
            // Scraper returned fewer than limit (e.g. 5 results total)
            // If it's not in those 5, it's definitely deleted.
            shouldDelete = true
          } else if (dbReelTime >= oldestFreshTime) {
            // Scraper returned 20 results, and this reel's timestamp 
            // is BETTER than the oldest one returned. 
            // It SHOULD have been in the results, so it was deleted.
            shouldDelete = true
          }

          if (shouldDelete) {
            reelsToDelete.push(dbReel.reel_url)
          }
        }
      }
    }
  }

  if (influencerUpdates.length > 0) {
    const { error: infError } = await supabase.from('influencers').upsert(influencerUpdates)
    if (infError) throw infError
  }
  if (metricsHistoryEntries.length > 0) {
    const { error: histError } = await supabase.from('metrics_history').insert(metricsHistoryEntries)
    if (histError) throw histError
  }
  if (reelsToUpsert.length > 0) {
    const { error: reelError } = await supabase.from('reels').upsert(reelsToUpsert, { onConflict: 'reel_url' })
    if (reelError) throw reelError
  }

  if (reelsToDelete.length > 0) {
    const { error: delError } = await supabase.from('reels').delete().in('reel_url', reelsToDelete)
    if (delError) console.error('[Init] Reel deletion error:', delError)
  }
  return { 
    success: true, 
    influencers_updated: influencerUpdates.length,
    reels_synced: reelsToUpsert.length,
    reels_deleted: reelsToDelete.length
  }
}

serve(async (req) => {
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const apifyToken = (Deno.env.get('APIFY_API') || Deno.env.get('APIFY_TOKEN') || Deno.env.get('APIFY_API_TOKEN'))?.trim()

    if (!supabaseUrl || !serviceRoleKey || !apifyToken) {
      throw new Error('Missing environment variables')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    
    // Trigger the actual sync process
    const result = await init(supabase, apifyToken)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[Refresh Function] Fatal Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})

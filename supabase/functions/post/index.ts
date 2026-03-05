import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let body;
    try {
      body = await req.json()
    } catch (e) {
      throw new Error('Malformed JSON in request body')
    }
    const { username, category = 'Software Developer' } = body

    if (!username) {
      throw new Error('Username is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apifyToken = (Deno.env.get('APIFY_API') || Deno.env.get('APIFY_TOKEN') || Deno.env.get('APIFY_API_TOKEN'))?.trim()

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables (URL or Service Role Key)')
    }

    if (!apifyToken) {
      throw new Error('Missing APIFY_API/APIFY_TOKEN in environment variables')
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    // 1. Fetch Instagram Data via Apify
    // Actor: apify/instagram-scraper
    // Robust URL/Username handling
    const input = username.trim();
    let reelsUrl = '';
    let targetUsername = '';

    if (input.includes('instagram.com/')) {
      try {
        const urlObj = new URL(input);
        const segments = urlObj.pathname.split('/').filter(Boolean);
        
        if (segments[0] === 'reels' || segments[0] === 'p' || segments[0] === 'tv') {
          // It's a specific post link. Use it as-is.
          reelsUrl = input.split('?')[0]; // Strip tracking params
          targetUsername = segments[1] || 'unknown'; 
        } else {
          // It's a profile link. Force it to the reels tab for better scraping.
          targetUsername = segments[0];
          reelsUrl = `https://www.instagram.com/${targetUsername}/reels/`;
        }
      } catch (e) {
        reelsUrl = input; // Fallback to raw input
        targetUsername = 'unknown';
      }
    } else {
      targetUsername = input.startsWith('@') ? input.substring(1) : input;
      reelsUrl = `https://www.instagram.com/${targetUsername}/reels/`;
    }

    const url = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}`
    
    let result: any[] = [];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          directUrls: [reelsUrl],
          resultsLimit: 50 // Reduced from 500 to stay within 60s timeout
        })
      })
      
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Apify error (${res.status}): ${errText}`)
      }
      
      result = await res.json()
    } catch (e: any) {
      throw new Error(`Apify connection failed: ${e.message || 'Unknown error'}`)
    }

    if (!Array.isArray(result) || result.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No data found from Apify', 
          success: false,
          debug: {
            host: 'api.apify.com',
            resultType: typeof result,
            resultSize: result?.length
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Explicit check for Apify scraper errors (e.g. no_items, private data)
    if (result[0]?.error) {
      throw new Error(`Apify Scraper Error: ${result[0].errorDescription || result[0].error}`)
    }

    // 2. Map Apify Data to Dashboard Structure
    const firstItem = result[0];
    const profile_id = firstItem.ownerId || firstItem.owner_id || firstItem.id || username;
    const profile_pic = firstItem.profilePicUrl || firstItem.profile_pic_url || firstItem.profilePic || '';
    const full_name = firstItem.ownerFullName || firstItem.owner_full_name || firstItem.ownerUsername || '';
    const follower_count = firstItem.followersCount || firstItem.followers_count || 0;
    const following_count = firstItem.followsCount || firstItem.follows_count || 0;

    // Standardize post objects for Dashboard compatibility
    // Filter for Reels and Videos specifically
    const formattedPosts = result
      .filter(post => 
        post.videoUrl || post.displayUrl || post.isVideo === true
      )
      .map(post => ({
        ...post,
        like_count: post.likesCount ?? post.like_count ?? 0,
        comment_count: post.commentsCount ?? post.comment_count ?? 0,
        video_play_count: post.videoPlayCount ?? post.videoViewCount ?? 0,
        display_url: post.videoUrl ?? post.displayUrl ?? '',
        shortcode: post.shortCode ?? post.id ?? '',
        caption: post.caption ?? '',
        product_type: post.productType || ''
      }));

    const enriched_data = {
      profile_metadata: {
        id: profile_id,
        username: username,
        full_name: full_name,
        profile_picture: profile_pic,
        follower_count: follower_count,
        following_count: following_count,
      },
      posts: formattedPosts,
      sync_timestamp: new Date().toISOString(),
      debug_info: {
        raw_count: result.length,
        processed_count: formattedPosts.length,
        available_keys: Object.keys(firstItem),
        first_item_sample: {
          id: firstItem.id,
          type: firstItem.type,
          productType: firstItem.productType,
          videoViewCount: firstItem.videoViewCount
        }
      }
    };

    // 3. Store Enriched Data
    const { data: insertedData, error: postDbError } = await supabaseClient
      .from('post_insta_data')
      .insert({
        username: username,
        post_data: enriched_data,
        category: category
      })
      .select()

    if (postDbError) {
      throw new Error(`Database Error (posts): ${postDbError.message}`)
    }

    return new Response(
      JSON.stringify({ 
        message: 'Post data synced successfully via Apify', 
        success: true,
        data: insertedData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

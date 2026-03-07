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

    // 0. Cache Check: If profile already exists, return immediately
    const input = username.trim();
    const cleanUsername = input.includes('instagram.com/') 
      ? input.split('instagram.com/')[1].split('/')[0].split('?')[0]
      : (input.startsWith('@') ? input.substring(1) : input);

    const { data: existingRecords, error: checkError } = await supabaseClient
      .from('post_insta_data')
      .select('*')
      .or(`username.eq."${username}",username.eq."${cleanUsername}"`)
      .order('created_at', { ascending: false })
      .limit(5);

    const validCache = existingRecords?.find((r: any) => r.post_data?.status === 'done' || (!r.post_data?.status && r.post_data?.post_data?.length > 0));

    if (!checkError && validCache) {
      return new Response(
        JSON.stringify({ 
          message: 'Profile data retrieved from cache', 
          success: true,
          data: validCache,
          cached: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 1. Fetch Instagram Data via Apify (if not in cache)
    // Robust URL/Username handling
    let reelsUrl = '';
    let targetUsername = '';

    if (input.includes('instagram.com/')) {
      try {
        const urlObj = new URL(input);
        const segments = urlObj.pathname.split('/').filter(Boolean);
        
        if (segments[0] === 'reels' || segments[0] === 'p' || segments[0] === 'tv') {
          // It's a specific post link. Use it as-is.
          reelsUrl = input.split('?')[0]; // Strip tracking params
          targetUsername = 'unknown'; 
        } else {
          // It's a profile link.
          targetUsername = segments[0];
          reelsUrl = `https://www.instagram.com/${targetUsername}/`;
        }
      } catch (e) {
        reelsUrl = input; // Fallback to raw input
        targetUsername = 'unknown';
      }
    } else {
      targetUsername = input.startsWith('@') ? input.substring(1) : input;
      reelsUrl = `https://www.instagram.com/${targetUsername}/`;
    }

    // 4. Create Syncing Placeholder
    const { data: placeholder, error: placeholderError } = await supabaseClient
      .from('post_insta_data')
      .insert({
        username: username,
        post_data: { 
          status: 'syncing',
          profile_data: [],
          post_data: []
        },
        category: category
      })
      .select()
      .single()

    if (placeholderError) {
      throw new Error(`Database Error (placeholder): ${placeholderError.message}`)
    }

    const profileScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`
    const postScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}`

    // 5. Trigger Background Scraper
    // @ts-ignore
    EdgeRuntime.waitUntil((async () => {
      try {
        console.log(`[Background] Starting sync for ${targetUsername} (ID: ${placeholder.id})...`)
        
        const [profileResponse, postResponse] = await Promise.all([
          targetUsername !== 'unknown' 
            ? fetch(profileScraperUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames: [targetUsername] })
              })
            : Promise.resolve({ ok: false, json: () => Promise.resolve([]) }),
          fetch(postScraperUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              directUrls: [reelsUrl], 
              resultsLimit: 30
            })
          })
        ])

        if (!postResponse.ok) throw new Error(`Posts fetch failed: ${await postResponse.text()}`)

        const [profileResults, result] = await Promise.all([
          profileResponse.ok ? profileResponse.json() : Promise.resolve([]),
          postResponse.json()
        ])

        if (!result || result.length === 0) {
          throw new Error('No posts found for this URL')
        }

        const owner = result[0]?.owner;
        const profileData = profileResults.length > 0 ? {
          fullName: profileResults[0].fullName || '',
          followersCount: profileResults[0].followersCount || 0,
          followsCount: profileResults[0].followsCount || 0,
          businessCategoryName: profileResults[0].businessCategoryName || '',
          postsCount: profileResults[0].postsCount || 0,
          profilePicUrl: profileResults[0].profilePicUrl || '',
          biography: profileResults[0].biography || '',
          externalUrl: profileResults[0].externalUrl || ''
        } : (owner ? {
          fullName: owner.fullName || owner.full_name || '',
          followersCount: owner.followersCount || 0,
          followsCount: owner.followsCount || 0,
          businessCategoryName: owner.businessCategoryName || '',
          postsCount: owner.postsCount || 0,
          profilePicUrl: owner.profilePicUrl || owner.profile_pic_url || '',
          biography: owner.biography || '',
          externalUrl: owner.externalUrl || ''
        } : null);

        const formattedPosts = result
          .filter((post: any) => post.videoUrl || post.displayUrl || post.isVideo === true)
          .map((post: any) => {
            const rawLikes = post.likesCount ?? post.like_count ?? 0;
            return {
              ...post,
              like_count: rawLikes < 0 ? 0 : rawLikes,
              comment_count: post.commentsCount ?? post.comment_count ?? 0,
              video_play_count: post.videoPlayCount ?? post.videoViewCount ?? 0,
              display_url: post.videoUrl ?? post.displayUrl ?? '',
              shortcode: post.shortCode ?? post.id ?? '',
              caption: post.caption ?? '',
            };
          });

        const final_storage_data = {
          status: 'done',
          post_data: formattedPosts,
          profile_data: profileData ? [profileData] : []
        };

        const { error: updateError } = await supabaseClient
          .from('post_insta_data')
          .update({ post_data: final_storage_data })
          .eq('id', placeholder.id)

        if (updateError) throw updateError
        console.log(`[Background] Successfully updated ${targetUsername} (ID: ${placeholder.id})`)

      } catch (err) {
        console.error(`[Background Error] ${err instanceof Error ? err.message : 'Unknown error'}`)
        // Update to failed status so UI can handle it
        await supabaseClient
          .from('post_insta_data')
          .update({ post_data: { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' } })
          .eq('id', placeholder.id)
      }
    })())

    // 6. Return placeholder response immediately
    return new Response(
      JSON.stringify({ 
        message: 'Synchronization started in background', 
        success: true,
        data: placeholder,
        background: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
    )

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Function Error] ${errorMsg}`)
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

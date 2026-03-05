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
    const { username } = await req.json()

    if (!username) {
      throw new Error('Username is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apifyToken = Deno.env.get('APIFY_API') || Deno.env.get('APIFY_TOKEN') || Deno.env.get('APIFY_API_TOKEN')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables')
    }

    if (!apifyToken) {
      throw new Error('Missing APIFY_API in environment variables')
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    // 1. Fetch Instagram Profile Data via Apify
    // Robust URL/Username handling
    const input = username.trim();
    let profileUrl = '';
    let targetUsername = '';

    if (input.includes('instagram.com/')) {
      try {
        const urlObj = new URL(input);
        const segments = urlObj.pathname.split('/').filter(Boolean);
        
        // Extract username from profile or post link
        if (segments[0] === 'reels' || segments[0] === 'p' || segments[0] === 'tv') {
          // For post links, the scraper usually returns the owner data too if directUrls is used
          profileUrl = input.split('?')[0]; // Strip tracking params
          targetUsername = segments[1] || segments[0];
        } else {
          targetUsername = segments[0];
          profileUrl = `https://www.instagram.com/${targetUsername}/`;
        }
      } catch (e) {
        profileUrl = input;
        targetUsername = 'unknown';
      }
    } else {
      targetUsername = input.startsWith('@') ? input.substring(1) : input;
      profileUrl = `https://www.instagram.com/${targetUsername}/`;
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
          directUrls: [profileUrl],
          resultsLimit: 1
        })
      })
      result = await res.json()
    } catch (e: any) {
      throw new Error(`Apify connection failed: ${e.message || 'Unknown error'}`)
    }

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error('No profile data found from Apify')
    }

    const data = result[0];
    
    const profileData = {
      id: data.ownerId || data.id || username,
      username: data.username || username,
      full_name: data.fullName || '',
      bio: data.biography || '',
      follower_count: data.followersCount || 0, 
      following_count: data.followsCount || 0,
      followers_count: data.followersCount || 0, 
      follows_count: data.followsCount || 0,
      media_count: data.postsCount || 0,
      account_type: data.isBusinessAccount ? 'Business' : 'Personal',
      profile_picture_url: data.profilePicUrl || '',
      is_verified: data.verified || false,
      raw_data: data
    }

    // 2. UPSERT into Supabase Profile Table
    const { data: upsertData, error: dbError } = await supabaseClient
      .from('instagram_profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single()

    if (dbError) {
      throw new Error(`Database Error (profiles): ${dbError.message}`)
    }

    return new Response(
      JSON.stringify(upsertData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

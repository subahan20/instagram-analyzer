import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[SCRAPE-FOLLOWERS] ERROR: Missing Supabase Environment Variables!')
      throw new Error('Server Configuration Error: SUPABASE_URL or SERVICE_ROLE_KEY missing.')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // 0. Parse Request Safely
    let body;
    try {
      body = await req.json();
    } catch (_e) {
      console.error('[SCRAPE-FOLLOWERS] ERROR: Failed to parse request JSON.');
      throw new Error('Invalid JSON in request body');
    }

    let { username, influencerId } = body;
    if (!username) {
      console.error('[SCRAPE-FOLLOWERS] ERROR: No username provided.');
      throw new Error('username is required');
    }
    
    // 1. Resolve Influencer ID if missing
    if (!influencerId) {
      const cleanName = username.trim().replace('@', '');
      
      let { data: profile, error: profileErr } = await supabaseClient
        .from('influencers')
        .select('id')
        .eq('username', cleanName)
        .maybeSingle();
      
      if (profileErr) {
        console.error(`[SCRAPE-FOLLOWERS] DB Profile Lookup Error:`, profileErr);
        throw new Error(`Database error during profile lookup: ${profileErr.message}`);
      }
      
      // AUTO-PROVISION: If not found, create a basic record
      if (!profile) {
        const { data: newProfile, error: createErr } = await supabaseClient
          .from('influencers')
          .insert([{ 
            username: cleanName,
            profile_url: `https://www.instagram.com/${cleanName}/`
          }])
          .select('id')
          .single();
        
        if (createErr) {
          console.error(`[SCRAPE-FOLLOWERS] DB Auto-provisioning Error:`, createErr);
          throw new Error(`Failed to create influencer record for @${cleanName}: ${createErr.message}`);
        }
        influencerId = newProfile.id;
      } else {
        influencerId = profile.id;
      }
    }

    // 2. Check Cache First (24-hour freshness check)
    const { data: cachedFollowers, error: cacheError } = await supabaseClient
      .from('followers')
      .select('*')
      .eq('influencer_id', influencerId)
      .order('fetched_at', { ascending: false });

    if (!cacheError && cachedFollowers && cachedFollowers.length > 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        count: cachedFollowers.length, 
        source: 'cache',
        data: cachedFollowers 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (cacheError) {
      console.warn(`[SCRAPE-FOLLOWERS] Cache lookup warning:`, cacheError.message);
    }

    // 3. Fallback to External Scraper (Apify)
    const apifyToken = (Deno.env.get('APIFY_API') || Deno.env.get('APIFY_TOKEN') || Deno.env.get('APIFY_API_TOKEN'))?.trim();
    if (!apifyToken) {
      console.error('[SCRAPE-FOLLOWERS] ERROR: Apify Token is missing.');
      throw new Error('Apify API Token not found. Please set your token using: supabase secrets set APIFY_TOKEN="your_token"');
    }

    const cleanUsername = username.trim().replace('@', '');
    
    // 1. Try known popular slugs first (Efficiency)
    const actorsToTry = [
      'apify~instagram-follower-scraper',
      'zuzka~instagram-followers-scraper',
      'apify~instagram-profile-scraper' // Some profile scrapers can fetch followers
    ];

    let results = null;
    let lastError = null;
    let successfulActor = null;

    for (const actor of actorsToTry) {
      const scraperUrl = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${apifyToken}`;
      
      try {
        const response = await fetch(scraperUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Universal Payload for any actor
            usernames: [cleanUsername],
            queries: [`https://www.instagram.com/${cleanUsername}/`],
            startUrls: [{ url: `https://www.instagram.com/${cleanUsername}/` }],
            maxData: 100,
            maxItems: 100,
            resultsLimit: 100,
            scrapeFollowers: true,
            extractFollowers: true
          })
        });

        if (response.ok) {
          results = await response.json();
          if (Array.isArray(results) && results.length > 0) {
            successfulActor = actor;
            break;
          }
        }
        lastError = response.status === 404 ? 'Actor Not Found' : await response.text();
      } catch (err: any) {
        lastError = err.message;
      }
    }

    // 2. DISCOVERY MODE
    if (!results) {
      try {
        const listRes = await fetch(`https://api.apify.com/v2/acts?token=${apifyToken}`);
        if (listRes.ok) {
          const listBody = await listRes.json();
          const allActors = listBody.data?.items || [];
          const found = allActors.find((a: any) => 
            a.name.toLowerCase().includes('follower') || 
            a.name.toLowerCase().includes('scraper') ||
            a.username?.toLowerCase().includes('follower')
          );

          if (found) {
            const discoveredSlug = `${found.username}~${found.name}`;
            
            const scraperUrl = `https://api.apify.com/v2/acts/${discoveredSlug}/run-sync-get-dataset-items?token=${apifyToken}`;
            const finalRes = await fetch(scraperUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                usernames: [cleanUsername],
                queries: [`https://www.instagram.com/${cleanUsername}/`],
                startUrls: [{ url: `https://www.instagram.com/${cleanUsername}/` }],
                maxData: 100,
                resultsLimit: 100,
                scrapeFollowers: true
              })
            });

            if (finalRes.ok) {
              results = await finalRes.json();
              successfulActor = discoveredSlug;
            } else {
              lastError = `Discovered ${discoveredSlug} failed: ${await finalRes.text()}`;
            }
          } else {
             lastError = "No usable Instagram scrapers found in your Apify account.";
          }
        }
      } catch (discoveryErr: any) {
        lastError = discoveryErr.message;
      }
    }
    
    if (!Array.isArray(results)) {
       console.warn('[SCRAPE-FOLLOWERS] Warning: Apify output was not an array.', results);
       results = [];
    }

    const followersData = results.map((item: any) => {
      // Create a super-resilient username fallback
      const protoUsername = item.username || item.ownerUsername || item.handle || item.id || item.ownerId || `user_${Math.random().toString(36).substring(7)}`;
      
      return {
        influencer_id: influencerId,
        follower_username: protoUsername,
        follower_name: item.full_name || item.fullName || item.name || protoUsername,
        follower_profile_pic: item.profile_pic_url || item.profilePicUrl || item.profile_image_url || null,
        fetched_at: new Date().toISOString()
      };
    });

    if (followersData.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('followers')
        .upsert(followersData, { onConflict: 'influencer_id,follower_username' });
      
      if (upsertError) {
        console.error('[SCRAPE-FOLLOWERS] DB Upsert Error:', upsertError.message);
      } else {
        console.log('[SCRAPE-FOLLOWERS] Database update completed.');
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      count: followersData.length, 
      source: 'scraper',
      actor: successfulActor,
      data: followersData 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    console.error('[SCRAPE-FOLLOWERS] CRITICAL FAILURE:', error.message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})

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

  let body: any;
  try {
    body = await req.json()
  } catch (_e) {
    body = {};
  }

  const action = body.action;
  const rawUsername = body.username;
  const categoryId = body.categoryId || null;
  const subcategoryId = body.subcategoryId || null;
  const userId = body.userId || body.profileId || null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apifyToken = (Deno.env.get('APIFY_API') || Deno.env.get('APIFY_TOKEN') || Deno.env.get('APIFY_API_TOKEN'))?.trim()

    // --- NEW SELF-DIAGNOSTIC INITIALIZATION ---
    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`[POST] CRITICAL CONFIG ERROR: Missing Supabase secrets in environment.`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Edge Function Configuration Error: Missing SUPABASE_URL or SERVICE_ROLE_KEY. Please run "supabase secrets set".',
        details: { url: !!supabaseUrl, key: !!serviceRoleKey }
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 // Return 200 so the UI can read the literal error message
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    console.log(`[POST] Action: ${action}, Username: ${rawUsername}`);

    // --- Helper for Internal Identity Mapping ---
    const mapToIdentity = (u: string) => {
      if (!u) return null;
      const clean = u.trim().toLowerCase().split('@')[0];
      return `${clean}@internal.node`;
    };

    // --- Unified Metric Mapping Utilities ---
    const parseNum = (val: any) => {
      if (typeof val === 'number') return val;
      if (typeof val !== 'string') return 0;
      
      let clean = val.trim().toLowerCase().replace(/,/g, '');
      let multiplier = 1;
      
      if (clean.endsWith('k')) multiplier = 1000;
      else if (clean.endsWith('m')) multiplier = 1000000;
      else if (clean.endsWith('b')) multiplier = 1000000000;
      
      const numMatch = clean.match(/[0-9.]+/);
      if (!numMatch) return 0;
      
      return Math.round(parseFloat(numMatch[0]) * multiplier) || 0;
    };

    const getLikes = (p: any) => parseNum(p?.likesCount ?? p?.like_count ?? p?.likes ?? 0);
    const getComments = (p: any) => parseNum(p?.commentsCount ?? p?.comment_count ?? p?.comments ?? 0);
    const getViews = (p: any) => {
      const v = p?.videoPlayCount ?? p?.typeCount?.videoPlayCount ?? p?.playCount ?? p?.play_count ?? p?.video_play_count ?? p?.viewCount ?? p?.videoViewCount ?? p?.video_view_count ?? p?.views;
      return parseNum(v ?? 0);
    };

    // --- Helper for action: fetch_and_store and !action (Backward Compatibility) ---
    const extractUsername = (input: string) => {
      if (!input) return 'unknown';
      let clean = input.trim();
      
      // Remove trailing slash
      if (clean.endsWith('/')) clean = clean.slice(0, -1);

      if (clean.includes('instagram.com/')) {
        try {
          // Handle various URL patterns
          const urlObj = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
          const segments = urlObj.pathname.split('/').filter(Boolean);
          
          if (segments.length === 0) return 'unknown';
          
          if (['reels', 'reels', 'p', 'tv'].includes(segments[0])) {
            // For reel/post URLs, the username is often NOT in the URL.
            // But sometimes it's like /reels/username/ - check if there's a second segment
            if (segments.length > 1 && !['videos', 'reels'].includes(segments[1])) {
              return segments[1];
            }
            return 'unknown';
          }
          
          return segments[0];
        } catch (_e) {
          return clean.split('instagram.com/')[1]?.split('/')[0] || 'unknown';
        }
      }
      return clean.startsWith('@') ? clean.substring(1) : clean.split('/').pop() || 'unknown';
    };

    // ─── NORMALIZED ACTION ROUTING ───
    const effectiveAction = (action || 'sync_reels').trim().toLowerCase();
    
    switch (effectiveAction) {
      case 'check_update': {
        const username = extractUsername(rawUsername || '');
        if (username === 'unknown') {
          return new Response(JSON.stringify({ success: true, hasChanged: true }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 200 
          });
        }

        const { data: existing } = await supabase
          .from('influencers')
          .select('last_updated_at')
          .eq('username', username)
          .maybeSingle();

        if (existing?.last_updated_at) {
          const lastUpdate = new Date(existing.last_updated_at).getTime();
          const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
          
          if (lastUpdate > twoHoursAgo) {
             return new Response(JSON.stringify({ 
               success: true, 
               hasChanged: false, 
               message: 'Intelligence is already fresh (Updated < 2h ago)' 
             }), { 
               headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
               status: 200 
             });
          }
        }

        // Isolation Check: If it's not owned by this user (or NO ONE owns it), we MUST sync it to claim it.
        const isNotOwned = !existing || !existing.user_id || existing.user_id !== userId;
        
        if (isNotOwned) {
          return new Response(JSON.stringify({ 
            success: true, 
            hasChanged: true, 
            message: 'Signal check: Claiming identity for user' 
          }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 200 
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          hasChanged: true, 
          message: 'Signal check: Update required' 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        });
      }

      case 'list': {
        const { nameSearch, followerId } = body;
        let query = supabase
          .from('influencers')
          .select(`
            *, 
            metrics:metrics_history(*)
          `)
          .order('added_date', { ascending: false });

        if (followerId) {
          const { data: followsData } = await supabase.from('follows').select('following_id').eq('follower_id', followerId);
          const followingIds = followsData?.map((f: any) => f.following_id) || [];
          query = query.in('id', followingIds);
        }

        if (categoryId) query = query.eq('category_id', categoryId);
        if (subcategoryId) query = query.eq('subcategory_id', subcategoryId);
        if (nameSearch) query = query.ilike('username', `%${nameSearch}%`);
        if (userId) query = query.eq('user_id', userId);

        const { data, error } = await query.limit(50);
        if (error) throw error;

        const processedData = data?.map((inf: any) => {
          const latest = inf.metrics?.sort((a: any, b: any) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime())[0];
          return {
            ...inf,
            latest_metrics: {
              followers: inf.followers_count || latest?.followers || 0,
              following: inf.following_count || latest?.following || 0,
              total_posts: inf.posts_count || latest?.total_posts || 0,
              likes: inf.avg_likes || latest?.likes || 0,
              comments: inf.avg_comments || latest?.comments || 0,
              views: inf.reel_views || latest?.views || 0,
            }
          };
        });

        return new Response(JSON.stringify({ success: true, data: processedData }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        });
      }

      case 'get_profile': {
        const { influencerId: rawId } = body;
        
        // --- NEW NULL-SAFE HARDENING: Prevent 400 crash during parsing ---
        if (!rawId) {
           console.warn('[POST] get_profile called without influencerId');
           return new Response(JSON.stringify({ 
             success: true, 
             data: { influencer: null, reels: [], latest_metrics: null, followers_list: [] } 
           }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        const isNumeric = !isNaN(Number(rawId));
        console.log(`[POST] Fetching profile for ID: ${rawId} (Numeric: ${isNumeric})`);

        let query = supabase.from('influencers').select('*');
        if (isNumeric) {
          query = query.eq('id', Number(rawId));
        } else {
          // SAFE PARSING: Prevent crash if rawId is somehow not a string
          const safeUsername = String(rawId).toLowerCase().trim();
          query = query.eq('username', safeUsername);
        }
        
        const { data: influencer, error: infError } = await query.maybeSingle();
        
        if (infError) {
          console.error(`[POST] Error fetching influencer metadata for ${rawId}:`, infError.message);
          throw infError;
        }

        // --- NEW RESILIENT LOGIC: Soft-fail if profile is missing ---
        if (!influencer) {
           console.warn(`[POST] Identity not found in database: ${rawId}. Returning empty state.`);
           return new Response(JSON.stringify({ 
             success: true, 
             data: { 
               influencer: null, 
               reels: [], 
               latest_metrics: null,
               followers_list: []
             } 
           }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        console.log(`[POST] Success: Identity resolved to ID ${influencer.id}. Fetching associated intelligence...`);

        // Fetch sub-data with standard async/await (NO BUGGY .catch() CALLS)
        const [reelsRes, metricsRes, followersRes] = await Promise.all([
          supabase.from('reels').select('*').eq('influencer_id', influencer.id).order('posted_at', { ascending: false }),
          supabase.from('metrics_history').select('*').eq('influencer_id', influencer.id).order('captured_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('followers').select('*').eq('influencer_id', influencer.id).order('fetched_at', { ascending: false })
        ]);

        if (reelsRes.error) console.warn('[POST] Reels fetch warning:', reelsRes.error.message);
        if (metricsRes.error) console.warn('[POST] Metrics fetch warning:', metricsRes.error.message);

        return new Response(JSON.stringify({ 
          success: true, 
          data: { 
            influencer, 
            reels: reelsRes.data || [], 
            latest_metrics: metricsRes.data || null,
            followers_list: followersRes.data || []
          } 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'scrape_full':
      case 'sync_reels': {
        const targetUrl = body.url || rawUsername;
        if (!targetUrl) throw new Error('Uplink URL is required for synchronization');

        const targetUsername = extractUsername(targetUrl);
        if (targetUsername === 'unknown') throw new Error(`Signal invalid. Could not extract identity from: ${targetUrl}`);

        if (!apifyToken) throw new Error('Missing APIFY token required for real intelligence extraction');

        console.log(`[POST] Initializing Real Sync: ${targetUsername}`);

        const profileScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
        const reelsScraperUrl = `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items?token=${apifyToken}`;

        const [profileResponse, reelsResponse] = await Promise.all([
          fetch(profileScraperUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ usernames: [targetUsername], resultsLimit: 1 }) 
          }),
          fetch(reelsScraperUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              username: [targetUsername], 
              profiles: [targetUsername],
              resultsLimit: 100
            }) 
          })
        ]);

        const [profileResults, reelsResultsRaw] = await Promise.all([
          profileResponse.json(),
          reelsResponse.ok ? reelsResponse.json() : []
        ]);

        const raw = profileResults[0];
        if (!raw) {
          console.error(`[POST] Identity ${targetUsername} not found in Apify results`);
          throw new Error('Identity not found on Instagram');
        }

        console.log(`[POST] Raw Scraped Data Profile for ${targetUsername}:`, JSON.stringify(raw).substring(0, 500) + '...');
        console.log(`[POST] Found ${reelsResultsRaw.length} reels for ${targetUsername}`);

        const reelPosts = reelsResultsRaw.filter((p: any) => {
          const type = (p.type || p.product_type || '').toLowerCase();
          return type === 'video' || type === 'reel' || !!p.videoUrl;
        });

        const now = new Date().toISOString();
        const influencerPayload = {
          username: targetUsername,
          profile_url: `https://www.instagram.com/${targetUsername}/`,
          profile_pic: raw?.profilePicUrlHD ?? raw?.profilePicUrl ?? `https://ui-avatars.com/api/?name=${targetUsername}`,
          followers_count: raw?.followersCount ?? 0,
          following_count: raw?.followsCount ?? 0,
          posts_count: raw?.postsCount ?? 0,
          avg_likes: reelPosts.length > 0 ? Math.round(reelPosts.reduce((sum: number, p: any) => sum + getLikes(p), 0) / reelPosts.length) : 0,
          avg_comments: reelPosts.length > 0 ? Math.round(reelPosts.reduce((sum: number, p: any) => sum + getComments(p), 0) / reelPosts.length) : 0,
          reel_views: reelPosts.length > 0 ? Math.round(reelPosts.reduce((sum: number, p: any) => sum + getViews(p), 0) / reelPosts.length) : 0,
          last_updated_at: now,
          is_fresh: true,
          user_id: userId,
          category_id: categoryId,
          subcategory_id: subcategoryId
        };

        console.log(`[POST] Upserting to influencers table for ${targetUsername}. Payload:`, influencerPayload);

        const { data: influencer, error: infError } = await supabase
          .from('influencers')
          .upsert(influencerPayload, { onConflict: 'username' })
          .select()
          .single();
        
        if (infError) {
          console.error(`[POST] Database Insert Error (influencers) for ${targetUsername}:`, infError);
          throw infError;
        }

        console.log(`[POST] Successfully persisted influencer ${targetUsername} with ID: ${influencer.id}`);

        // Save Real Reels
        if (reelPosts.length > 0) {
          const reelsData = reelPosts.map((p: any) => ({
            influencer_id: influencer.id,
            reel_url: p.url || p.instagramUrl || `https://www.instagram.com/reels/${p.shortCode || p.id}/`,
            video_url: p.videoUrl || null,
            display_url: p.displayUrl || p.thumbnailUrl || null,
            caption: p.caption || null,
            views: getViews(p),
            likes: getLikes(p),
            posted_at: p.timestamp ? new Date(p.timestamp).toISOString() : now,
            user_id: userId
          }));

          console.log(`[POST] Upserting ${reelsData.length} reels for influencer ID: ${influencer.id}`);
          const { error: reelsError } = await supabase.from('reels').upsert(reelsData, { onConflict: 'reel_url' });
          if (reelsError) {
            console.error(`[POST] Database Insert Error (reels) for ${targetUsername}:`, reelsError);
          } else {
            console.log(`[POST] Successfully persisted reels for ${targetUsername}`);
          }
        }

        return new Response(JSON.stringify({ success: true, data: influencer }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        });
      }

      case 'resolve_email_by_username': {
        const { username } = body;
        if (!username) throw new Error('Username is required');

        console.log(`[POST] Resolving email for username: ${username}`);
        
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.trim().toLowerCase())
          .maybeSingle();

        if (profileErr || !profile) {
          console.log(`[POST] Profile not found for ${username}. Attempting global user search fallback...`);
          const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
          
          if (!listErr) {
            const cleanUser = username.trim().toLowerCase();
            const foundUser = users.find((u: any) => 
               u.email?.toLowerCase().startsWith(cleanUser + '@') || 
               u.user_metadata?.username?.toLowerCase() === cleanUser
            );
            
            if (foundUser?.email) {
               console.log(`[POST] Identity recovered for ${username} via global search. Found user: ${foundUser.email}`);
               await supabase.from('profiles').upsert({ id: foundUser.id, username: cleanUser }, { onConflict: 'id' });
               
               return new Response(JSON.stringify({ success: true, email: foundUser.email }), { 
                 headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
                 status: 200 
               });
            }
          }

          console.error(`[POST] Could not resolve identity for: ${username}`);
          return new Response(JSON.stringify({ 
            success: false, 
            error: `Identity not found: '${username}'. Please ensure you have created an account.` 
          }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 200 
          });
        }

        console.log(`[POST] Successfully resolved email for ${username}: ${profile.id}. Fetching Auth record...`);
        const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(profile.id);
        
        if (authErr || !authUser?.user?.email) {
          throw new Error(`Account identity found (${profile.id}), but email record is missing from Auth database.`);
        }

        return new Response(JSON.stringify({ success: true, email: authUser.user.email }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        });
      }

      case 'admin_confirm_user':
      case 'admin_confirm_by_email': {
        const { userId, email, username } = body;
        let targetUserId = userId;
        const targetEmail = email || mapToIdentity(username);

        if (!targetUserId && targetEmail) {
          const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
          if (listError) throw listError;
          
          const foundUser = users.find((u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase());
          if (foundUser) {
            targetUserId = foundUser.id;
          } else {
            throw new Error(`Identity not found: ${username || targetEmail}`);
          }
        }

        if (!targetUserId) throw new Error('Identity ID or alias is required for confirmation');

        const { error: confirmError } = await supabase.auth.admin.updateUserByAppMetadata(targetUserId, { email_confirm: true });
        // Fallback for some supabase versions
        if (confirmError) {
          await supabase.auth.admin.updateUserById(targetUserId, { email_confirm: true });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Identity confirmed successfully',
          userId: targetUserId 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        });
      }

      case 'admin_create_user': {
        const { email, password, username } = body;
        
        if (!email || !password || !username) {
          throw new Error('Email, Username, and Password are all required');
        }

        console.log(`[POST] Creating user: ${email} with username: ${username}`);

        const { data: authData, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { username }
        });

        let targetUser = authData?.user;

        if (createError) {
          const isExisting = createError.message.toLowerCase().includes('already registered') || 
                            createError.message.toLowerCase().includes('already exists');
          
          if (isExisting) {
            console.log(`[POST] User ${email} already exists. Attempting update...`);
            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
            if (!listError) {
              const existingUser = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
              if (existingUser) {
                targetUser = existingUser;
                const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, { 
                  password, 
                  email_confirm: true 
                });
                if (updateError) throw updateError;
              }
            }
          } else {
            throw createError;
          }
        }

        if (!targetUser) throw new Error('Failed to identify target user for profile sync');

        // Upsert to profiles table to store the username
        console.log(`[POST] Syncing profile for user ${targetUser.id} with username ${username}`);
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: targetUser.id,
            username: username,
            profile_data: { display_username: username, updated_at: new Date().toISOString() }
          }, { onConflict: 'id' });

        if (profileError) {
          console.error(`[POST] Profile sync error:`, profileError);
          // We don't throw here to avoid failing the whole creation if only profile sync fails, 
          // but in this project the profile is critical for isolation.
          throw new Error(`Profile sync failed: ${profileError.message}`);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          user: targetUser,
          message: 'Account and profile established successfully'
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        });
      }

      default:
        throw new Error(`Action not recognized by signal hub: ${effectiveAction}`);
    }
  } catch (err: any) {
    const errorMsg = err.message || 'An unexpected error occurred';
    console.error(`[Edge Function Error] ${errorMsg}`);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMsg,
      action: action || 'unknown',
      details: err.stack
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 // WE USE 200 TO REVEAL THE HIDDEN ERROR MESSAGE TO THE FRONTEND
    });
  }
})

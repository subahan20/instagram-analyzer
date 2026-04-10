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
      const raw = clean.startsWith('@') ? clean.substring(1) : clean.split('/').pop() || 'unknown';
      return raw.toLowerCase();
    };

    // ─── NORMALIZED ACTION ROUTING ───
    const effectiveAction = (action || 'ping').trim().toLowerCase();
    
    switch (effectiveAction) {
      case 'ping': {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Signal hub operational', 
          timestamp: new Date().toISOString() 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

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
          .select('last_updated_at, user_id')
          .eq('username', username)
          .eq('user_id', userId)
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
        // 1. Find all 'influencer' record IDs for this same username across ALL users
        const { data: siblingInfluencers } = await supabase
          .from('influencers')
          .select('id')
          .ilike('username', influencer.username);
        
        const influencerIds = siblingInfluencers?.map(s => s.id) || [influencer.id];

        // 2. Fetch sub-data with standard async/await
        const [reelsRes, metricsRes, followersRes] = await Promise.all([
          supabase.from('reels').select('*').or(`influencer_id.in.(${influencerIds.join(',')}),owner_username.ilike.${influencer.username}`).order('posted_at', { ascending: false }),
          supabase.from('metrics_history').select('*').eq('influencer_id', influencer.id).order('captured_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('followers').select('*').eq('influencer_id', influencer.id).order('fetched_at', { ascending: false })
        ]);

        if (reelsRes.error) console.warn('[POST] Reels fetch warning:', reelsRes.error.message);
        if (metricsRes.error) console.warn('[POST] Metrics fetch warning:', metricsRes.error.message);

        // 3. Deduplicate reels by URL
        const seenUrls = new Set();
        const uniqueReels = (reelsRes.data || []).filter(r => {
          if (seenUrls.has(r.reel_url)) return false;
          seenUrls.add(r.reel_url);
          return true;
        });

        return new Response(JSON.stringify({ 
          success: true, 
          data: { 
            influencer, 
            reels: uniqueReels, 
            latest_metrics: metricsRes.data || null,
            followers_list: followersRes.data || []
          } 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'scrape_full':
      case 'sync_reels': {
        const targetUrl = body.url || rawUsername;
        if (!targetUrl) {
           throw new Error('Sync Request Error: No "username" or "url" provided. Please ensure your request body includes a target identity.');
        }

        const targetUsername = extractUsername(targetUrl);
        if (targetUsername === 'unknown') throw new Error(`Signal invalid. Could not extract identity from: ${targetUrl}`);

        if (!apifyToken) throw new Error('Missing APIFY token required for real intelligence extraction');

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
          is_private: raw?.isPrivate ?? false,
          user_id: userId,
          category_id: categoryId,
          subcategory_id: subcategoryId
        };

        const { data: influencer, error: infError } = await supabase
          .from('influencers')
          .upsert(influencerPayload, { onConflict: 'username,user_id' })
          .select()
          .single();
        
        if (infError) {
          console.error(`[POST] Database Insert Error (influencers) for ${targetUsername}:`, infError);
          throw infError;
        }

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
            owner_username: p.ownerUsername || p.owner_username || targetUsername,
            owner_full_name: p.ownerFullName || p.owner_full_name || null,
            product_type: p.productType || p.product_type || p.type || null,
            is_pinned: p.isPinned || p.is_pinned || false,
            posted_at: p.timestamp ? new Date(p.timestamp).toISOString() : now,
            user_id: userId
          }));
          const { error: reelsError } = await supabase.from('reels').upsert(reelsData, { onConflict: 'reel_url,user_id' });
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
        
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.trim().toLowerCase())
          .maybeSingle();

        if (profileErr || !profile) {
          const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
          
          if (!listErr) {
            const cleanUser = username.trim().toLowerCase();
            const foundUser = users.find((u: any) => 
               u.email?.toLowerCase().startsWith(cleanUser + '@') || 
               u.user_metadata?.username?.toLowerCase() === cleanUser
            );
            
            if (foundUser?.email) {
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

      case 'admin_reset_password': {
        const { email, username, password } = body;
        if (!password) throw new Error('New password is required');
        
        let targetEmail = email;
        if (!targetEmail && username) {
          // Resolve email by username if not provided
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username.trim().toLowerCase())
            .maybeSingle();
            
          if (profile) {
            const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
            targetEmail = authUser?.user?.email;
          } else {
            // Try listing users as fallback
            const { data: { users } } = await supabase.auth.admin.listUsers();
            const foundUser = users.find((u: any) => 
               u.email?.toLowerCase().startsWith(username.trim().toLowerCase() + '@') || 
               u.user_metadata?.username?.toLowerCase() === username.trim().toLowerCase()
            );
            targetEmail = foundUser?.email;
          }
        }

        if (!targetEmail) throw new Error('Could not identify user to reset password');

        const { data: { users } } = await supabase.auth.admin.listUsers();
        const user = users.find((u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase());
        
        if (!user) throw new Error('User not found');

        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { 
          password,
          email_confirm: true 
        });

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Password updated successfully'
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        });
      }

      case 'admin_forgot_username': {
        const { email } = body;
        const genericResponse = { success: true, message: 'If this email exists, you will receive your username.' };
        
        if (!email) return new Response(JSON.stringify({ error: 'Email required' }), { status: 400, headers: corsHeaders });

        const cleanEmail = email.trim().toLowerCase();

        try {
          // --- 🔒 SENIOR SECURITY: Anti-Enumeration & Rate Limiting ---
          // Note: In a large scale app, use Redis/Upstash for rate limiting.
          // For now, we move straight to secure lookup.
          console.log(`[RECOVERY] Request for: ${cleanEmail}`);

          const { data: users, error: searchError } = await supabase.auth.admin.listUsers();
          if (searchError) throw searchError;

          const targetUser = users.users.find((u: any) => u.email?.toLowerCase() === cleanEmail);
          
          if (!targetUser) {
            console.log(`[RECOVERY] Security Signal: Email not found. Returning generic success.`);
            return new Response(JSON.stringify(genericResponse), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
          }

          // --- 🔗 IDENTITY LINKING ---
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', targetUser.id)
            .single();

          if (profileErr || !profile?.username) {
            console.error(`[RECOVERY] Data Integrity Error: Auth user exists but profile missing for ${targetUser.id}`);
            return new Response(JSON.stringify(genericResponse), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
          }

          const username = profile.username;
          console.log(`[RECOVERY] Identity Verified: ${username}. Initiating Triple-Relay Dispatch...`);

          const emailHtml = `
            <div style="font-family: 'Inter', sans-serif; padding: 40px; background-color: #0f172a; color: #f8fafc; border-radius: 16px; max-width: 600px; margin: 20px auto; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #6366f1; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; margin: 0;">Identity Recovery</h1>
              </div>
              <p style="color: #94a3b8; font-size: 16px; line-height: 24px; margin-bottom: 24px;">Hello,</p>
              <p style="color: #94a3b8; font-size: 16px; line-height: 24px; margin-bottom: 32px;">We received a request to recover the username associated with this email address. Your username is:</p>
              <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.4); padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 32px;">
                <span style="font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 32px; font-weight: 700; color: #f8fafc; letter-spacing: 0.05em;">${username}</span>
              </div>
              <p style="color: #64748b; font-size: 14px; line-height: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">If you did not request this recovery, you can safely ignore this email. Your account security is our priority.</p>
              <div style="text-align: center; margin-top: 32px; color: #475569; font-size: 12px;">
                &copy; 2026 Your App Name. All rights reserved.
              </div>
            </div>
          `;

          let sent = false;

          // 🚛 Node 1: Gmail SMTP (Enhanced Security)
          const smtpUser = Deno.env.get('SMTP_USER');
          const smtpPass = Deno.env.get('SMTP_PASS');
          const resendKey = Deno.env.get('RESEND_API_KEY');

          if (smtpUser && smtpPass) {
            try {
              console.log(`[RECOVERY] Attempting SMTP Node (Secure 465)...`);
              const { default: nodemailer } = await import("npm:nodemailer");
              const transporter = nodemailer.createTransport({ 
                host: "smtp.gmail.com",
                port: 465,
                secure: true,
                auth: { user: smtpUser, pass: smtpPass } 
              });
              await transporter.sendMail({ 
                from: `"Identity Hub" <${smtpUser}>`, 
                to: cleanEmail, 
                subject: 'Your Username Recovery', 
                html: emailHtml 
              });
              console.log(`[RECOVERY] SMTP SUCCESS ✅`);
              sent = true;
            } catch (e) { console.error('[RECOVERY] SMTP NODE FAILED ❌:', e.message || e); }
          }

          // 🚛 Node 2: Resend API (With Deep Error Reporting)
          if (!sent && resendKey) {
            try {
              console.log(`[RECOVERY] SMTP Failed. Attempting Resend...`);
              const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ from: 'Auth Hub <onboarding@resend.dev>', to: [cleanEmail], subject: 'Your Username', html: emailHtml })
              });
              const resBody = await res.text();
              console.log(`[RECOVERY] Resend Status: ${res.status}`);
              if (res.ok) {
                console.log(`[RECOVERY] RESEND SUCCESS ✅`);
                sent = true;
              } else {
                console.error(`[RECOVERY] RESEND ERROR BODY:`, resBody);
              }
            } catch (e) { console.error('[RECOVERY] RESEND FATAL ERROR:', e); }
          }

          // 🚛 Node 3: Apify Fallback (Failsafe)
          const apifyToken = Deno.env.get('APIFY_API') || Deno.env.get('APIFY_TOKEN');
          if (!sent && apifyToken) {
            try {
              console.log(`[RECOVERY] Resend Failed. Attempting Apify Failsafe...`);
              const res = await fetch(`https://api.apify.com/v2/acts/apify~send-mail/runs?token=${apifyToken.trim()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: cleanEmail, subject: 'Your Account Username Recovery', html: emailHtml })
              });
              if (res.ok) {
                console.log('[RECOVERY] Apify Node Succeeded! ✅');
                sent = true;
              } else {
                console.error('[RECOVERY] Apify Node Failed ❌:', await res.text());
              }
            } catch (e) { console.error('[RECOVERY] Apify Node FATAL ❌:', e); }
          }

          if (!sent) console.error(`[RECOVERY] CRITICAL: All 3 nodes (SMTP, Resend, Apify) failed to deliver to ${cleanEmail}. Check Secrets.`);

        } catch (globalErr) {
          console.error('[RECOVERY] SYSTEM FATAL:', globalErr);
        }

        return new Response(JSON.stringify(genericResponse), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        });
      }

      case 'admin_create_user': {
        const { email, password, username } = body;
        
        if (!email || !password || !username) {
          throw new Error('Email, Username, and Password are all required');
        }

        const { data: authData, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { username }
        });

        let targetUser = authData?.user;

        if (createError) {
          const errMsg = createError.message.toLowerCase();
          const isExisting = errMsg.includes('already registered') || 
                            errMsg.includes('already exists') ||
                            errMsg.includes('email_exists');
          
          if (isExisting) {
            console.log(`[POST] User ${email} already registered. Searching...`);
            
            // Attempt 1: Standard List (Fastest)
            const { data: { users: listA } } = await supabase.auth.admin.listUsers();
            let existingUser = listA?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
            
            // Attempt 2: Filtered search (More reliable for large sets)
            if (!existingUser) {
              const { data: { users: listB } } = await supabase.auth.admin.listUsers({
                filter: `email=eq.${email.trim().toLowerCase()}`
              });
              existingUser = listB?.[0];
            }

            // Attempt 3: Search by Metadata (In case email is weird)
            if (!existingUser && username) {
               const { data: { users: listC } } = await supabase.auth.admin.listUsers();
               existingUser = listC?.find((u: any) => u.user_metadata?.username?.toLowerCase() === username.toLowerCase());
            }

            if (existingUser) {
              targetUser = existingUser;
              console.log(`[POST] Re-syncing existing user: ${existingUser.id}`);
              const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, { 
                password, 
                email_confirm: true,
                user_metadata: { username }
              });
              if (updateError) throw updateError;
            } else {
              // TERMINAL FALLBACK: If we still can't find them, we try to update UNCONDITIONALLY by email if possible
              // But Supabase Admin doesn't support updateByEmail. 
              // We throw a clear error with hint.
              throw new Error(`CRITICAL: User ${email} exists in Auth but is invisible to Admin API. Please check your Supabase dashboard > Authentication > Users.`);
            }
          } else {
            throw createError;
          }
        }

        if (!targetUser) throw new Error('Failed to identify target user for profile sync');

        // Upsert to profiles table to store the username
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

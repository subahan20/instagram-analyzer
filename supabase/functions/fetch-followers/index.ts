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
    const { username } = await req.json();
    if (!username) throw new Error('Username required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- Mock follower data generation ---
    const fResults = Array.from({ length: 20 }).map((_, i) => ({
      username: `follower_${i}_${Math.random().toString(36).substring(7)}`,
      profilePicUrl: `https://ui-avatars.com/api/?name=F${i}&background=random`
    }));

    const now = new Date().toISOString();

    // 1. Get Influencer ID
    const { data: influencer } = await supabase
      .from('influencers')
      .select('id')
      .eq('username', username)
      .single();

    if (!influencer) throw new Error('Influencer profile not found. Sync profile first.');

    // 2. Clear and Refill Followers
    if (fResults.length > 0) {
      await supabase.from('followers').delete().eq('influencer_id', influencer.id);
      
      const followerData = fResults.map((f: any) => ({
        influencer_id: influencer.id,
        username: username,
        follower_username: f.username,
        follower_profile_pic: f.profilePicUrl,
        fetched_at: now
      }));

      const { error: insError } = await supabase.from('followers').insert(followerData);
      if (insError) throw insError;
    }

    return new Response(JSON.stringify({ success: true, count: fResults.length }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error(`[fetch-followers] Error:`, error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})

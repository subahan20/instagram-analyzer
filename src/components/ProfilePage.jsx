import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoCard from './VideoCard'
import VideoModal from './VideoModal'
import scraperService from '../services/scraperService'
import { toast } from 'react-hot-toast'

function ProfilePage({ user, theme, setTheme }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false); // Shows banner while n8n syncs
  const lastSyncedAtRef = useRef(null);              // Tracks last sync timestamp
  const pollIntervalRef = useRef(null);              // Cleanup ref

  // Extract frequently used data from state
  const influencer = data?.influencer;
  const metrics = data?.latest_metrics || {};
  const reels = data?.reels || [];

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsSyncing(false);
  };

  // ─── LOAD DATA DIRECTLY FROM DATABASE (No Edge Function / No API call) ───
  // This runs on first load and whenever n8n triggers fresh data.
  const loadFromDatabase = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // Read influencer directly from DB
      const { data: influencer, error: infError } = await supabase
        .from('influencers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (infError) throw infError;
      if (!influencer) { setData(null); return; }

      // Record sync timestamp so Realtime knows baseline
      lastSyncedAtRef.current = influencer.last_synced_at;

      // 1. Find all 'influencer' record IDs for this same username across ALL users
      // This allows us to gather reels synced by anyone.
      const { data: siblingInfluencers } = await supabase
        .from('influencers')
        .select('id')
        .ilike('username', influencer.username);
      
      const influencerIds = siblingInfluencers?.map(s => s.id) || [influencer.id];

      // 2. Read reels (globally) and latest metrics (specifically for this user's view)
      // We use both 'influencer_id' and 'owner_username' to ensure 100% coverage
      // regardless of which user account originally performed the sync.
      const [reelsRes, metricsRes] = await Promise.all([
        supabase
          .from('reels')
          .select('*')
          .or(`influencer_id.in.(${influencerIds.join(',')}),owner_username.ilike.${influencer.username}`)
          .order('posted_at', { ascending: false }),
        supabase
          .from('metrics_history')
          .select('*')
          .eq('influencer_id', influencer.id)
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      // 3. Deduplicate reels by URL (essential for shared platforms)
      const seenUrls = new Set();
      const uniqueReels = (reelsRes.data || []).filter(r => {
        if (!r.reel_url || seenUrls.has(r.reel_url)) return false;
        seenUrls.add(r.reel_url);
        return true;
      });

      setData({
        influencer,
        reels: uniqueReels,
        latest_metrics: metricsRes.data || null,
        followers_list: []
      });
    } catch (err) {
      console.error('[Profile] DB load error:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    if (!influencer?.username || isSyncing) return;
    
    setIsSyncing(true);
    const loadingToast = toast.loading('Syncing latest Instagram intelligence...');
    
    try {
      console.log('[Profile] Stage 1: Checking versioning at /post...');
      const checkRes = await scraperService.checkUpdate(influencer.username, { userId: influencer.user_id });
      
      console.log('[Profile] Stage 2: Triggering smart refresh at /refresh-instagram-data...');
      const result = await scraperService.refreshData(influencer.username, {
        userId: influencer.user_id,
        categoryId: influencer.category_id,
        subcategoryId: influencer.subcategory_id
      });
      
      if (result?.success) {
        toast.success(result.message || 'Intelligence updated successfully!', { id: loadingToast });
        // Immediately load from DB to show any changes
        await loadFromDatabase(false);
      } else {
        toast.error(result?.error || 'Intelligence check completed with no changes.', { id: loadingToast });
      }
    } catch (err) {
      console.error('[Profile] Refresh error:', err);
      toast.error('Failed to connect to intelligence engine.', { id: loadingToast });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadFromDatabase();
    
    // ─── POLL FALLBACK: Every 30s to catch any out-of-sync events ───
    pollIntervalRef.current = setInterval(() => {
      console.log('[POLL] Checking for intelligence updates...');
      loadFromDatabase(false);
    }, 30000);

    return () => stopPolling();
  }, [id]);


  // ─── REALTIME: React when ANY sync for this username completes ───
  useEffect(() => {
    if (!influencer?.username) return;

    const influencersChannel = supabase
      .channel(`global-sync-signal-${influencer.username}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'influencers', 
          filter: `username=eq.${influencer.username}` 
        },
        (payload) => {
          const old = payload.old || {};
          const next = payload.new || {};
          
          console.log('[REALTIME] Update detected for:', influencer.username);

          // Refresh when synchronization timestamp changes from ANY row for this username
          if (old.last_synced_at !== next.last_synced_at) {
            console.log('[REALTIME] Intelligence sync completed globally. Refreshing...');
            loadFromDatabase(false);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(influencersChannel);
  }, [influencer?.username, id]);




  const { viralReels, recentReels } = useMemo(() => {
    if (reels?.length === 0) return { viralReels: [], recentReels: [] };

    const influencerUsername = (influencer?.username || '').toLowerCase().replace('@', '');
    const isPrivate = influencer?.is_private;

    // --- ACCURACY BLOCK: Determine privacy scope ---
    // If account is PRIVATE: Only show reels owned by this person (hide tagged reels).
    // If account is PUBLIC: Show all captured content (including tagged).
    const scopeReels = isPrivate 
      ? reels.filter(r => (r.owner_username || '').toLowerCase().replace('@', '') === influencerUsername)
      : reels;

    const getViews = (r) => Number(r?.video_play_count || r?.videoPlayCount || r?.play_count || r?.views || 0);
    const viral = [...scopeReels].filter(r => getViews(r) >= 100).sort((a, b) => getViews(b) - getViews(a)).slice(0, 6);
    const recent = [...scopeReels].sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());
    return { viralReels: viral, recentReels: recent };
  }, [reels, influencer]);

  const handleVideoClick = (reel) => {
    setSelectedVideo(reel);
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-indigo-500/5 blur-[120px] rounded-full animate-pulse"></div>
      <div className="w-16 h-16 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-2xl"></div>
      <div className="mt-6 text-indigo-400 font-bold tracking-[0.3em] uppercase animate-pulse text-xs">
        Analyzing Intelligence...
      </div>
    </div>
  )

  if (!influencer && data !== null) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-slate-400 gap-4">
      <div className="text-6xl mb-4">🔍</div>
      <p className="text-xl font-bold text-white">Profile not found</p>
      <Link to="/" className="px-6 py-2 bg-slate-900 border border-white/10 rounded-xl hover:text-indigo-400 transition-all">Back to Dashboard</Link>
    </div>
  )

  const profilePic = influencer?.profile_pic || influencer?.profile_pic_url || influencer?.profilePicUrl;

  return (
    <div className="relative min-h-screen bg-canvas transition-colors duration-500">
      <div 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ 
          backgroundImage: `url('/home-background.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.5
        }}
      >
        <div className="absolute inset-0 bg-white/20 dark:bg-slate-950/70 backdrop-blur-[1px] transition-colors duration-500"></div>
      </div>

      {/* SYNCING BANNER: Shown while polling for fresh data */}
      {isSyncing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 bg-indigo-600/90 backdrop-blur-md rounded-full shadow-2xl border border-indigo-400/30 animate-pulse">
          <div className="w-3 h-3 rounded-full bg-white animate-ping"></div>
          <span className="text-white text-sm font-bold tracking-wide">Fetching live Instagram data...</span>
        </div>
      )}

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-12">
          <div className="flex items-center justify-between gap-4 mb-8">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 group text-secondary hover:text-primary transition-colors"
            >
              <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-bold text-sm tracking-wider uppercase">Dashboard</span>
            </Link>
          </div>

        {influencer && (
          <div className="glass rounded-[3rem] p-8 md:p-12 mb-16 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] -mr-48 -mt-48 rounded-full pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-1000"></div>
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-16">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                  {profilePic ? (
                    <img 
                      src={`https://images.weserv.nl/?url=${encodeURIComponent(profilePic)}&w=150&h=150&fit=cover&mask=circle`} 
                      alt={influencer.username}
                      className="relative w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-white/10 shadow-2xl object-cover"
                    />
                  ) : (
                    <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full bg-slate-900 border-2 border-white/10 flex items-center justify-center text-4xl font-bold text-slate-700 shadow-2xl">
                      {influencer.username?.[0]?.toUpperCase() || 'V'}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-[10px] font-bold tracking-widest uppercase">
                      {influencer.business_category || 'CREATOR'}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <h1 className="text-4xl md:text-6xl font-bold text-primary tracking-tight break-all transition-colors flex items-center gap-4">
                      @{influencer.username}
                      <button 
                        onClick={handleManualRefresh}
                        disabled={isSyncing}
                        className={`p-2 rounded-xl transition-all duration-500 ${
                          isSyncing 
                            ? 'bg-indigo-500/20 text-indigo-400 animate-spin cursor-not-allowed' 
                            : 'bg-white/5 text-secondary hover:text-indigo-400 hover:bg-indigo-500/10'
                        }`}
                        title="Refresh Intelligence"
                      >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </h1>
                  </div>
                  <p className="text-secondary text-sm md:text-base max-w-xl font-medium leading-relaxed italic transition-colors">
                    {influencer.biography || 'No biography available.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Followers', value: influencer.followers_count || influencer.followers },
                    { label: 'Following', value: influencer.following_count || influencer.following || 0 },
                    { label: 'Reels', value: influencer.posts_count || influencer.posts }
                  ].map((stat, i) => (
                    <div key={i} className="glass px-5 py-4 rounded-2xl text-center hover:bg-white/5 transition-colors border-white/5 shadow-xl min-w-[100px]">
                      <div className="text-lg md:text-xl font-bold text-primary tracking-tight transition-colors">{stat.value?.toLocaleString() || '0'}</div>
                      <div className="text-[9px] text-secondary uppercase tracking-widest mt-1 font-bold transition-colors">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-24">
          {/* Audience Section Removed */}

          {viralReels.length > 0 && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center justify-between mb-10 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-gradient-to-b from-rose-500 to-orange-500 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.5)]"></div>
                  <div>
                    <h2 className="text-2xl font-bold text-primary tracking-tight uppercase leading-none transition-colors">Viral <span className="bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">Hits</span></h2>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-[0.2em] mt-2 transition-colors">Highest performing intelligence</p>
                  </div>
                </div>
                <div className="px-4 py-2 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                    Top {viralReels.length} Insights
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
                {viralReels.map((reel, idx) => (
                  <VideoCard 
                    key={reel.id || idx} 
                    video={reel} 
                    isViral={true} 
                    onVideoClick={handleVideoClick}
                  />
                ))}
              </div>
            </section>
          )}

          {recentReels.length > 0 && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
              <div className="flex items-center justify-between mb-10 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight uppercase leading-none">Recent <span className="text-indigo-400">Uploads</span></h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Chronological inventory</p>
                  </div>
                </div>
                <div className="px-4 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                    {recentReels.length} Items Captured
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
                {recentReels.map((reel, idx) => (
                  <VideoCard 
                    key={reel.id || idx} 
                    video={reel} 
                    onVideoClick={handleVideoClick}
                  />
                ))}
              </div>
            </section>
          )}

          {viralReels.length === 0 && recentReels.length === 0 && (
            <div className="py-32 text-center glass rounded-[3rem] border-slate-200 dark:border-white/5 transition-colors">
              <div className="text-6xl mb-6 opacity-20">🎞️</div>
              <h3 className="text-xl font-bold text-primary mb-2 transition-colors">No reels captured yet</h3>
              <p className="text-secondary text-sm max-w-sm mx-auto transition-colors">Latest intelligence is being extracted. The dashboard will automatically update once the analysis is complete.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modular Video Modal Interface */}
      {selectedVideo && (
        <VideoModal 
          video={selectedVideo} 
          influencer={data?.influencer} 
          onClose={() => setSelectedVideo(null)} 
        />
      )}
    </div>
  )
}

// Shared VideoCard component imported from ./VideoCard

export default ProfilePage;

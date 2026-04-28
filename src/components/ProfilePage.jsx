import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoCard from './VideoCard'
import VideoModal from './VideoModal'
import scraperService from '../services/scraperService'
import { toast } from 'react-hot-toast'
import Navbar from './Navbar'

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

  // ─── LOAD DATA DIRECTLY FROM DATABASE ───
  const loadFromDatabase = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { data: influencer, error: infError } = await supabase
        .from('influencers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (infError) throw infError;
      if (!influencer) { setData(null); return; }

      lastSyncedAtRef.current = influencer.last_synced_at;

      const { data: siblingInfluencers } = await supabase
        .from('influencers')
        .select('id')
        .ilike('username', influencer.username);
      
      const influencerIds = siblingInfluencers?.map(s => s.id) || [influencer.id];

      const [reelsRes, metricsRes] = await Promise.all([
        supabase
          .from('reels')
          .select('*')
          .or(`influencer_id.in.(${influencerIds.join(',')}),owner_username.ilike.${influencer.username}`)
          .order('last_synced_at', { ascending: false }),
        supabase
          .from('metrics_history')
          .select('*')
          .eq('influencer_id', influencer.id)
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      const seenUrls = new Set();
      const uniqueReels = (reelsRes.data || []).filter(r => {
        if (!r.reel_url) return false;
        // Normalize for deduplication: extract shortcode to treat /p/ and /reel/ as same
        const shortcode = r.reel_url.split('/').filter(Boolean).pop();
        if (seenUrls.has(shortcode)) return false;
        seenUrls.add(shortcode);
        return true;
      });

      // Re-sort unique reels by posted_at descending so the UI remains chronological
      const sortedReels = [...uniqueReels].sort((a, b) => 
        new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
      );

      setData({
        influencer,
        reels: sortedReels,
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
      await scraperService.checkUpdate(influencer.username, { userId: influencer.user_id });
      const result = await scraperService.refreshData(influencer.username, {
        userId: influencer.user_id,
        categoryId: influencer.category_id,
        subcategoryId: influencer.subcategory_id
      });
      
      if (result?.success) {
        toast.success(result.message || 'Intelligence updated successfully!', { id: loadingToast });
        // Force an immediate reload from DB after success
        setTimeout(() => loadFromDatabase(false), 500); 
        setTimeout(() => loadFromDatabase(false), 2000); // Second check for safety
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
    pollIntervalRef.current = setInterval(() => {
      loadFromDatabase(false);
    }, 30000);
    return () => stopPolling();
  }, [id]);

  useEffect(() => {
    if (!influencer?.username) return;

    // ─── REALTIME: Listen for Profile Updates ───
    const influencersChannel = supabase
      .channel(`profile-updates-${id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'influencers' }, 
        (payload) => {
          const changed = payload.new || payload.old;
          if (changed?.id === id || changed?.username === influencer.username) {
            console.log('[REALTIME] Profile update detected');
            loadFromDatabase(false);
          }
        }
      )
      .subscribe();

    // ─── REALTIME: Listen for Reels Updates (Likes/Views) ───
    const reelsChannel = supabase
      .channel(`reels-updates-${id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'reels' }, 
        (payload) => {
          const changed = payload.new || payload.old;
          if (changed?.influencer_id === id || changed?.owner_username === influencer.username) {
            console.log('[REALTIME] Reels update detected');
            loadFromDatabase(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(influencersChannel);
      supabase.removeChannel(reelsChannel);
    };
  }, [influencer?.username, id]);

  const { viralReels, recentReels } = useMemo(() => {
    if (reels?.length === 0) return { viralReels: [], recentReels: [] };
    const influencerUsername = (influencer?.username || '').toLowerCase().replace('@', '');
    const isPrivate = influencer?.is_private;
    const scopeReels = isPrivate 
      ? reels.filter(r => (r.owner_username || '').toLowerCase().replace('@', '') === influencerUsername)
      : reels;
    const getViews = (r) => Number(r?.video_play_count || r?.videoPlayCount || r?.play_count || r?.views || 0);
    const viral = [...scopeReels].filter(r => getViews(r) >= 100).sort((a, b) => getViews(b) - getViews(a)).slice(0, 6);
    const recent = [...scopeReels].sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());
    return { viralReels: viral, recentReels: recent };
  }, [reels, influencer]);

  const handleVideoClick = (reel) => { setSelectedVideo(reel); };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-canvas">
      <div className="absolute inset-0 bg-indigo-500/5 blur-[120px] rounded-full animate-pulse"></div>
      <div className="w-16 h-16 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-2xl"></div>
      <div className="mt-6 text-indigo-400 font-bold tracking-[0.3em] uppercase animate-pulse text-xs">Analyzing Intelligence...</div>
    </div>
  )

  if (!influencer && data !== null) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-slate-400 gap-4 bg-canvas">
      <div className="text-6xl mb-4">🔍</div>
      <p className="text-xl font-bold text-primary">Profile not found</p>
      <Link to="/" className="px-6 py-2 bg-slate-900 border border-white/10 rounded-xl hover:text-indigo-400 transition-all">Back to Dashboard</Link>
    </div>
  )

  const profilePic = influencer?.profile_pic || influencer?.profile_pic_url || influencer?.profilePicUrl;

  return (
    <div className="relative min-h-screen bg-canvas transition-colors duration-500">
      <Navbar user={user} theme={theme} setTheme={setTheme} />

      <div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundImage: `url('/home-background.png')`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.5 }}>
        <div className="absolute inset-0 bg-white/20 dark:bg-slate-950/70 backdrop-blur-[1px]"></div>
      </div>

      {isSyncing && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 bg-indigo-600/90 backdrop-blur-md rounded-full shadow-2xl border border-indigo-400/30 animate-pulse">
          <div className="w-3 h-3 rounded-full bg-white animate-ping"></div>
          <span className="text-white text-sm font-bold tracking-wide">Fetching live Instagram data...</span>
        </div>
      )}

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12 pt-24 sm:pt-32 pb-12">
        {influencer && (
          <div className="glass rounded-[3rem] p-6 sm:p-8 lg:p-12 mb-12 sm:mb-16 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] -mr-48 -mt-48 rounded-full pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-1000"></div>
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-8 lg:gap-12 mt-[-20px]">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
                <div className="relative group shrink-0">
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                  {profilePic ? (
                    <img 
                      src={profilePic.startsWith('data:') 
                        ? profilePic 
                        : `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(profilePic)}`
                      }
                      alt={influencer.username}
                      className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-white/10 shadow-2xl object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.target.onerror = null;
                        // Manual fallback if proxy fails
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white/20 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/20"
                    style={{ display: profilePic ? 'none' : 'flex' }}
                  >
                    <svg className="w-14 h-14 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                
                <div className="space-y-3 text-center sm:text-left">
                  <div className="relative inline-block mx-auto sm:mx-0">
                    <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black text-primary tracking-tighter break-all transition-colors leading-[1.1] relative z-10">
                      @{influencer.username}
                    </h1>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6 shrink-0 lg:w-full lg:max-w-xl mx-auto lg:mx-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                  {[
                    { label: 'Followers', value: influencer.followers_count || influencer.followers },
                    { label: 'Following', value: influencer.following_count || influencer.following || 0 },
                    { label: 'Reels', value: influencer.posts_count || influencer.posts }
                  ].map((stat, i) => (
                    <div key={i} className="glass px-5 py-6 rounded-[1.8rem] text-center flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-all duration-500 border-white/5 group/stat">
                      <div className="text-[10px] text-secondary uppercase tracking-[0.2em] font-black transition-colors group-hover/stat:text-indigo-400">{stat.label}</div>
                      <div className="text-xl sm:text-2xl font-black text-primary tracking-tight transition-colors">{stat.value?.toLocaleString() || '0'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-24">
          {viralReels.length > 0 && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center justify-between mb-10 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-gradient-to-b from-rose-500 to-orange-500 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.5)]"></div>
                  <div>
                    <h2 className="text-2xl font-bold text-primary tracking-tight uppercase leading-none transition-colors">Viral <span className="text-gradient font-black">Hits</span></h2>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-[0.2em] mt-2 transition-colors">Highest performing intelligence</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8 lg:gap-12">
                {viralReels.map((reel, idx) => (
                  <VideoCard key={reel.id || idx} video={reel} isViral={true} onVideoClick={handleVideoClick} />
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
                    <h2 className="text-2xl font-bold text-primary tracking-tight uppercase leading-none transition-colors">Recent <span className="text-gradient">Uploads</span></h2>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-[0.2em] mt-2 transition-colors">Chronological inventory</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8 lg:gap-12">
                {recentReels.map((reel, idx) => (
                  <VideoCard key={reel.id || idx} video={reel} onVideoClick={handleVideoClick} />
                ))}
              </div>
            </section>
          )}

          {viralReels.length === 0 && recentReels.length === 0 && (
            <div className="py-32 text-center glass rounded-[3rem] border-slate-200 dark:border-white/5 transition-colors">
              <div className="text-6xl mb-6 opacity-20">🎞️</div>
              <h3 className="text-xl font-bold text-primary mb-2 transition-colors">No reels captured yet</h3>
              <p className="text-secondary text-sm max-w-sm mx-auto transition-colors">Latest intelligence is being extracted.</p>
            </div>
          )}
        </div>
      </div>

      {selectedVideo && (
        <VideoModal video={selectedVideo} influencer={data?.influencer} onClose={() => setSelectedVideo(null)} />
      )}
    </div>
  )
}

export default ProfilePage;

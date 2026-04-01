import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoCard from './VideoCard'

function ProfilePage({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false); // Shows banner while n8n syncs
  const lastSyncedAtRef = useRef(null);              // Tracks last sync timestamp
  const pollIntervalRef = useRef(null);              // Cleanup ref

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

      // Read reels and latest metrics in parallel
      const [reelsRes, metricsRes] = await Promise.all([
        supabase.from('reels').select('*').eq('influencer_id', influencer.id).order('posted_at', { ascending: false }),
        supabase.from('metrics_history').select('*').eq('influencer_id', influencer.id).order('captured_at', { ascending: false }).limit(1).maybeSingle()
      ]);

      setData({
        influencer,
        reels: reelsRes.data || [],
        latest_metrics: metricsRes.data || null,
        followers_list: []
      });
    } catch (err) {
      console.error('[Profile] DB load error:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadFromDatabase();
    return () => stopPolling();
  }, [id]);


  // ─── REALTIME: Only react when n8n completes a sync (last_synced_at changes) ───
  useEffect(() => {
    const influencersChannel = supabase
      .channel(`profile-sync-signal-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'influencers', filter: `id=eq.${id}` },
        (payload) => {
          const old = payload.old || {};
          const next = payload.new || {};

          // ONLY refresh when the automation sync timestamp changes
          // This fires ONLY when n8n completes a scrape — not on page load, tab switch, etc.
          if (old.last_synced_at !== next.last_synced_at) {
            console.log('[REALTIME] n8n sync completed. Loading fresh data from DB...');
            loadFromDatabase(false);
          } else {
            console.log('[REALTIME] Ignoring non-sync update.');
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(influencersChannel);
  }, [id]);


  const influencer = data?.influencer;
  const metrics = data?.latest_metrics || {};
  const reels = data?.reels || [];

  const { viralReels, recentReels } = useMemo(() => {
    if (reels?.length === 0) return { viralReels: [], recentReels: [] };
    const getViews = (r) => Number(r?.video_play_count || r?.videoPlayCount || r?.play_count || r?.views || 0);
    const viral = [...reels].filter(r => getViews(r) >= 100).sort((a, b) => getViews(b) - getViews(a)).slice(0, 6);
    const recent = [...reels].sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());
    return { viralReels: viral, recentReels: recent };
  }, [reels]);

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
    <div className="relative min-h-screen bg-slate-950">
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
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[1px]"></div>
      </div>

      {/* SYNCING BANNER: Shown while polling for fresh data */}
      {isSyncing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 bg-indigo-600/90 backdrop-blur-md rounded-full shadow-2xl border border-indigo-400/30 animate-pulse">
          <div className="w-3 h-3 rounded-full bg-white animate-ping"></div>
          <span className="text-white text-sm font-bold tracking-wide">Fetching live Instagram data...</span>
        </div>
      )}

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-12">
        <div className="mb-12">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 group text-slate-500 hover:text-white transition-colors"
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
                    <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight break-all">@{influencer.username}</h1>
                  </div>
                  <p className="text-slate-400 text-sm md:text-base max-w-xl font-medium leading-relaxed italic">
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
                      <div className="text-lg md:text-xl font-bold text-white tracking-tight">{stat.value?.toLocaleString() || '0'}</div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-1 font-bold">{stat.label}</div>
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
                    <h2 className="text-2xl font-bold text-white tracking-tight uppercase leading-none">Viral <span className="bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">Hits</span></h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Highest performing intelligence</p>
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
            <div className="py-32 text-center glass rounded-[3rem] border-white/5">
              <div className="text-6xl mb-6 opacity-20">🎞️</div>
              <h3 className="text-xl font-bold text-white mb-2">No reels captured yet</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">Latest intelligence is being extracted. The dashboard will automatically update once the analysis is complete.</p>
            </div>
          )}
        </div>
      </div>

      {/* Video Modal Interface - Ambient Immersive Experience */}
      {selectedVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-500 overflow-hidden">
          {/* Ambient Blurred Background Layer */}
          <div className="absolute inset-0 z-0 overflow-hidden bg-black">
            <video 
              src={selectedVideo.video_url || selectedVideo.video_versions?.[0]?.url || selectedVideo.media_url} 
              autoPlay 
              muted 
              loop 
              playsInline
              className="w-full h-full object-cover opacity-40 blur-[100px] scale-[1.2] transition-opacity duration-1000"
            />
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          </div>

          <div 
            className="absolute inset-x-0 inset-y-0 z-10"
            onClick={() => setSelectedVideo(null)}
          ></div>
          
          <div className="relative z-20 w-full max-w-[500px] h-[90vh] bg-black rounded-[3.5rem] border border-white/20 shadow-[0_0_120px_rgba(0,0,0,1)] overflow-hidden animate-in zoom-in-95 duration-500 ring-1 ring-white/10">
            {/* The Cinematic Player */}
            <div className="w-full h-full relative flex items-center justify-center bg-black">
              <video 
                src={selectedVideo.video_url || selectedVideo.video_versions?.[0]?.url || selectedVideo.media_url} 
                controls={false}
                autoPlay 
                onClick={(e) => {
                  e.stopPropagation();
                  const video = e.currentTarget;
                  if (video.paused) video.play(); else video.pause();
                }}
                className="w-full h-full object-cover relative z-20 cursor-pointer"
              />
              
              {/* Top Profile Overlay - Moved to Top-Left */}
              <div className="absolute top-8 left-8 z-[110] flex items-center gap-3 bg-black/40 backdrop-blur-3xl px-5 py-3 rounded-full border border-white/10 shadow-2xl">
                 <img 
                    src={influencer?.profile_pic ? `https://images.weserv.nl/?url=${encodeURIComponent(influencer.profile_pic)}&w=50&h=50&fit=cover&mask=circle` : `https://ui-avatars.com/api/?name=${influencer?.username}&background=random`} 
                    className="w-7 h-7 rounded-full border border-white/10 shadow-xl" 
                 />
                 <span className="text-white text-[11px] font-black uppercase tracking-widest">{influencer?.username}</span>
              </div>

              {/* Top Close Button Node */}
              <button 
                onClick={() => setSelectedVideo(null)}
                className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-2xl rounded-full border border-white/10 text-white transition-all hover:scale-110 active:scale-95 group z-[110]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Shared VideoCard component imported from ./VideoCard

export default ProfilePage;

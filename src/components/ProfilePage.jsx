import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoModal from './VideoModal'

const activeProfileFetches = new Set();

function ProfilePage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedVideo, setSelectedVideo] = useState(null)

  const fetchProfileData = async (showLoading = true) => {
    if (activeProfileFetches.has(id)) return;
    activeProfileFetches.add(id);
    if (showLoading) setLoading(true)
    try {
      const { data: response, error } = await supabase.functions.invoke('post', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: { 
          action: 'get_profile',
          influencerId: id
        }
      });

      if (error) throw error
      setData(response.data)
    } catch (err) {
      console.error('Error fetching profile detail:', err)
    } finally {
      activeProfileFetches.delete(id);
      if (showLoading) setLoading(false)
    }
  }

  // Restored automatic fetch on mount to provide seamless experience.
  useEffect(() => {
    fetchProfileData();
  }, [id]);

  const debounceTimer = useRef(null);

  // Real-time subscription for profile changes
  // Removed automatic fetch on mount to guarantee 0 API calls on refresh.
  // Data will load when the user selects a category, subcategory, or types a search.
  useEffect(() => {
    const debouncedFetch = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        fetchProfileData(false);
      }, 2000);
    };

    const influencersChannel = supabase
      .channel(`profile-updates-${id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'influencers',
          filter: `id=eq.${id}`
        },
        () => {
          debouncedFetch();
        }
      )
      .subscribe();

    const reelsChannel = supabase
      .channel(`reels-updates-${id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'reels',
          filter: `influencer_id=eq.${id}`
        },
        () => {
          debouncedFetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(influencersChannel);
      supabase.removeChannel(reelsChannel);
    };
  }, [id]);

  const influencer = data?.influencer;
  const metrics = data?.latest_metrics || {};
  const reels = data?.reels || [];

  const viralReels = useMemo(() => {
    const followers = influencer?.followers || 0;
    return [...reels]
      .filter(reel => (reel.videoPlayCount || 0) > followers)
      .sort((a, b) => (b.videoPlayCount || 0) - (a.videoPlayCount || 0))
      .slice(0, 20)
  }, [reels, influencer?.followers])

  const handleVideoClick = (reel) => {
    setSelectedVideo(reel);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-indigo-500/5 blur-[120px] rounded-full animate-pulse"></div>
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_30px_-5px_rgba(99,102,241,0.5)]"></div>
        <div className="text-indigo-400 font-black text-2xl tracking-[0.3em] uppercase animate-pulse">
          Analyzing Profile...
        </div>
      </div>
    </div>
  )

  // Only show "NOT FOUND" if we have attempted to load and failed
  if (!influencer && data !== null) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4">
      <p className="text-xl font-bold">PROFILE NOT FOUND</p>
      <Link to="/dashboard" className="text-indigo-400 hover:underline">Back to Dashboard</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-indigo-500/30">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-10 lg:px-16 py-6 sm:py-16">
        <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] sm:rounded-[4rem] p-6 sm:p-12 lg:p-20 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
          {/* Decorative background blurs for premium feel */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[150px] -mr-64 -mt-64 rounded-full pointer-events-none group-hover:bg-indigo-500/15 transition-all duration-1000"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-500/10 blur-[120px] -ml-40 -mb-40 rounded-full pointer-events-none group-hover:bg-violet-500/15 transition-all duration-1000"></div>
          
          <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-10 mb-16 sm:mb-24 relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 text-center md:text-left">
              <Link 
                to="/dashboard" 
                className="w-12 h-12 flex items-center justify-center bg-slate-950 border border-slate-800 rounded-2xl hover:border-indigo-400 hover:bg-slate-900 transition-all group shadow-xl"
              >
                <span className="text-slate-500 group-hover:text-indigo-400 font-black text-lg block">←</span>
              </Link>

              {influencer && (
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="relative group shrink-0">
                    <div className="absolute -inset-1.5 bg-gradient-to-tr from-indigo-500 via-violet-500 to-indigo-500 rounded-full blur-[10px] opacity-20 group-hover:opacity-40 transition duration-700 animate-pulse"></div>
                    {influencer.profile_pic ? (
                      <img 
                        src={`https://images.weserv.nl/?url=${encodeURIComponent(influencer.profile_pic)}&w=300&h=300&fit=cover&mask=circle`} 
                        alt={influencer.username}
                        className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-slate-900 shadow-2xl"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-slate-800 border-4 border-slate-900 flex items-center justify-center text-4xl sm:text-5xl font-black text-slate-500">
                        {influencer.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tighter break-all">{influencer.username}</h1>
                    <p className="text-indigo-400 font-mono text-xs sm:text-sm tracking-[0.4em] uppercase font-black opacity-90 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 w-fit mx-auto md:mx-0">
                      {influencer.business_category || 'CREATOR'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {influencer && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 w-full xl:w-auto">
                {[
                  { label: 'Followers', value: influencer.followers },
                  { label: 'Following', value: influencer.following },
                  { label: 'Posts', value: influencer.posts }
                ].map((stat, i) => (
                  <div key={i} className="bg-slate-950/40 border border-slate-800/40 p-4 rounded-3xl text-center backdrop-blur-xl hover:border-indigo-500/40 hover:bg-slate-900/60 transition-all shadow-xl">
                    <div className="text-xl lg:text-2xl font-black text-white tracking-tighter">{stat.value?.toLocaleString() || '0'}</div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-[0.2em] mt-1 font-black opacity-80">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
          </header>

          <div className="space-y-16 sm:space-y-28 relative z-10">
            {/* Recent Reels Section */}
            {reels.length > 0 && (
              <section>
                <div className="flex items-center gap-4 mb-10 sm:mb-14">
                  <span className="w-16 h-[3px] bg-gradient-to-r from-indigo-500 to-transparent rounded-full"></span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter uppercase italic">Recent <span className="text-indigo-400">Reels</span></h2>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-8">
                  {reels.slice(0, 20).map((reel, idx) => (
                    <VideoCard key={idx} video={reel} onClick={() => handleVideoClick(reel)} />
                  ))}
                </div>
              </section>
            )}

            {/* Viral Reels Section */}
            {viralReels.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-8 px-2">
                  <span className="w-8 h-[2px] bg-indigo-500"></span>
                  <h2 className="text-2xl font-black text-white tracking-tight uppercase">Top Performance</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {viralReels.map((reel, idx) => (
                    <VideoCard key={idx} video={reel} onClick={() => handleVideoClick(reel)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {selectedVideo && (
        <VideoModal 
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)} 
        />
      )}
    </div>
  )
}

function VideoCard({ video, onClick }) {
  return (
    <div
      onClick={onClick}
      className="group bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden hover:border-indigo-500/50 transition-all duration-300 cursor-pointer shadow-xl"
    >
      <div className="aspect-[9/16] relative bg-slate-900 flex items-center justify-center overflow-hidden">
        {/* Top Overlays: Reel Badge + Caption */}
        <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 w-fit bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl">
            <span className="text-xs text-white">▶</span>
            <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase opacity-90">Reel</span>
          </div>
          
        </div>

        {/* Video Preview / Thumbnail */}
        {video.video_url ? (
          <video 
            src={video.video_url} 
            muted 
            loop 
            playsInline
            onMouseEnter={(e) => e.currentTarget.play()}
            onMouseLeave={(e) => {
              e.currentTarget.pause();
              e.currentTarget.currentTime = 0;
            }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
          />
        ) : video.display_url ? (
          <img 
            src={video.display_url} 
            alt={video.caption || 'Reel thumbnail'} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 to-indigo-950/30 flex items-center justify-center">
            <span className="text-5xl text-indigo-500/40">▶</span>
          </div>
        )}

        {/* Global Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/20 opacity-90"></div>

        {/* Metrics Overlay */}
        <div className="absolute bottom-6 left-4 right-4 flex justify-between z-10">
          <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl border border-white/5 shadow-lg">
            <span className="text-base text-white">👁</span>
            <span className="text-sm font-black text-white">{(video.views || 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl border border-white/5 shadow-lg">
            <span className="text-base text-pink-500">❤</span>
            <span className="text-sm font-black text-white">{(video.likes || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage

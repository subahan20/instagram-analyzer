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

  useEffect(() => {
    fetchProfileData();
  }, [id]);

  const debounceTimer = useRef(null);

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
      <Link to="/dashboard" className="px-6 py-2 bg-slate-900 border border-white/10 rounded-xl hover:text-indigo-400 transition-all">Back to Dashboard</Link>
    </div>
  )

  return (
    <div className="relative min-h-screen bg-slate-950">
      {/* Premium AI SaaS Background */}
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

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-12">
        <div className="mb-12">
          <Link 
            to="/dashboard" 
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
            
            <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-end justify-between gap-12">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-8 text-center md:text-left">
                <div className="relative group/avatar shrink-0">
                  <div className="absolute -inset-2 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-full blur-[8px] opacity-20 group-hover/avatar:opacity-40 transition duration-700"></div>
                  {influencer.profile_pic ? (
                    <img 
                      src={`https://images.weserv.nl/?url=${encodeURIComponent(influencer.profile_pic)}&w=300&h=300&fit=cover&mask=circle`} 
                      alt={influencer.username}
                      className="relative w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-slate-900 shadow-2xl"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-slate-900 border-4 border-slate-900 flex items-center justify-center text-5xl font-bold text-slate-700">
                      {influencer.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="inline-flex items-center px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-[10px] font-bold tracking-widest uppercase mb-2">
                    {influencer.business_category || 'CREATOR'}
                  </div>
                  <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight break-all">@{influencer.username}</h1>
                  <p className="text-slate-400 text-sm md:text-base max-w-xl font-medium leading-relaxed italic">
                    {influencer.biography || 'No biography available.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 w-full lg:w-auto">
                {[
                  { label: 'Followers', value: influencer.followers },
                  { label: 'Following', value: influencer.following },
                  { label: 'Posts', value: influencer.posts }
                ].map((stat, i) => (
                  <div key={i} className="glass px-6 py-5 rounded-3xl text-center hover:bg-white/5 transition-colors border-white/5 shadow-xl min-w-[120px]">
                    <div className="text-xl md:text-2xl font-bold text-white tracking-tight">{stat.value?.toLocaleString() || '0'}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-bold">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-24">
          {/* Viral Reels Section */}
          {viralReels.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-10 px-2">
                <div className="w-1.5 h-6 bg-rose-500 rounded-full"></div>
                <h2 className="text-2xl font-bold text-white tracking-tight uppercase">Viral <span className="text-rose-400">Hits</span></h2>
                <span className="ml-2 px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded-full text-[9px] font-bold text-rose-400 uppercase tracking-widest">Efficiency &gt; 100%</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 sm:gap-8">
                {viralReels.map((reel, idx) => (
                  <VideoCard key={idx} video={reel} onClick={() => handleVideoClick(reel)} isViral={true} />
                ))}
              </div>
            </section>
          )}

          {/* Recent Reels Section */}
          {reels.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-10 px-2">
                <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                <h2 className="text-2xl font-bold text-white tracking-tight uppercase">Recent <span className="text-indigo-400">Reels</span></h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 sm:gap-8">
                {reels.slice(0, 20).map((reel, idx) => (
                  <VideoCard key={idx} video={reel} onClick={() => handleVideoClick(reel)} />
                ))}
              </div>
            </section>
          )}
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

function VideoCard({ video, onClick, isViral = false }) {
  return (
    <div
      onClick={onClick}
      className="group relative bg-slate-900 border border-white/5 rounded-[2rem] overflow-hidden hover:border-indigo-500/30 transition-all duration-300 cursor-pointer shadow-2xl"
    >
      <div className="aspect-[9/16] relative bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Top Badges */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
          {isViral && (
             <div className="bg-rose-500 text-white text-[8px] font-black tracking-widest uppercase px-3 py-1 rounded-full shadow-lg">
               🔥 Viral
             </div>
          )}
          <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[8px] font-bold text-white/80 uppercase tracking-widest">
            {video.videoPlayCount?.toLocaleString() || '0'} Views
          </div>
        </div>

        {/* Video / Image */}
        {video.video_url ? (
          <video 
            src={video.video_url} 
            muted 
            loop 
            playsInline
            onMouseEnter={(e) => {
              const playPromise = e.currentTarget.play();
              if (playPromise !== undefined) {
                playPromise.catch(() => {
                  // Ignore error: common when hovering out quickly
                });
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.pause();
              e.currentTarget.currentTime = 0;
            }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : video.display_url ? (
          <img 
            src={video.display_url} 
            alt={video.caption || 'Reel thumbnail'} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
            <span className="text-4xl text-slate-800">▶</span>
          </div>
        )}

        {/* Bottom Metrics Gradient */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80"></div>

        {/* Dynamic Likes Badge - Always Visible */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 transition-all whitespace-nowrap z-20">
          <span className="text-rose-500 text-sm">❤️</span>
          <span className="text-white text-xs font-bold">{(video.likes || 0).toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage

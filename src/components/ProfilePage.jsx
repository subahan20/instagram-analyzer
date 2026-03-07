import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoModal from './VideoModal'

function ProfilePage() {
  const { id } = useParams()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedVideo, setSelectedVideo] = useState(null)

  useEffect(() => {
    async function fetchProfileData() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('post_insta_data')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error
        setRecord(data)
      } catch (err) {
        console.error('Error fetching profile detail:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfileData()
  }, [id])

  const profile = useMemo(() => {
    const profileData = record?.post_data?.profile_data;
    if (!profileData) return null;
    return Array.isArray(profileData) ? profileData[0] : profileData;
  }, [record])

  const posts = useMemo(() => {
    if (!record || !record.post_data) return []
    const rawPosts = record.post_data.post_data || record.post_data.posts || []
    return rawPosts
      .filter(p => p.videoUrl || p.videoPlayCount || p.videoViewCount || p.isVideo === true)
      .map(p => ({
        ...p,
        videoViewCount: p.videoPlayCount || p.videoViewCount || 0,
        likeCount: Math.max(0, p.likeCount || p.likesCount || p.like_count || 0),
        commentCount: p.commentCount || p.commentsCount || p.comment_count || 0,
        timestamp: p.timestamp || p.taken_at || 0,
        caption: p.caption || '',
        thumbnailUrl: p.thumbnailUrl || p.displayUrl || '',
        videoUrl: p.videoUrl || `https://www.instagram.com/reels/${p.shortcode}/`
      }))
  }, [record])

  const recentVideos = useMemo(() => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    return [...posts]
      .filter(p => {
        if (!p.timestamp) return false
        const postDate = new Date(p.timestamp)
        return postDate >= thirtyDaysAgo
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20)
  }, [posts])

  const viralVideos = useMemo(() => {
    // Rank all globally by engagement and take top 20
    return [...posts]
      .sort((a, b) => (b.videoViewCount + b.likeCount) - (a.videoViewCount + a.likeCount))
      .slice(0, 20)
  }, [posts])

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400 font-bold text-xl tracking-widest animate-pulse">
      LOADING PROFILE...
    </div>
  )

  if (!record || !profile) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4">
      <p className="text-xl font-bold">PROFILE NOT FOUND</p>
      <Link to="/dashboard" className="text-indigo-400 hover:underline">Back to Dashboard</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-indigo-500/30">
      <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-screen">
        <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 lg:p-12 shadow-2xl backdrop-blur-xl">
          
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
            <div className="flex items-center gap-6">
              <Link 
                to="/dashboard" 
                className="p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:border-indigo-500/50 transition-all group shrink-0"
              >
                <span className="text-slate-500 group-hover:text-indigo-400 font-bold block">←</span>
              </Link>
              <div className="flex items-center gap-6">
                <img 
                  src={`https://images.weserv.nl/?url=${encodeURIComponent(profile.profilePicUrl)}`} 
                  alt="Profile" 
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-slate-800 shadow-2xl"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">{profile.fullName}</h1>
                  <p className="text-slate-500 font-mono text-xs sm:text-sm tracking-widest uppercase">
                    {profile.businessCategoryName || 'Creator'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:gap-8 w-full md:w-auto">
              {[
                { label: 'Followers', value: profile.followersCount },
                { label: 'Following', value: profile.followsCount },
                { label: 'Posts', value: profile.postsCount }
              ].map((stat, i) => (
                <div key={i} className="bg-slate-950/50 border border-slate-800/50 p-4 rounded-2xl text-center">
                  <div className="text-xl sm:text-2xl font-black text-white">{stat.value?.toLocaleString() || '0'}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </header>

          <div className="space-y-20">
            {/* Recent Videos Section */}
            <section>
              <div className="flex items-center gap-3 mb-8 px-2">
                <span className="w-8 h-[2px] bg-indigo-500"></span>
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">Top 20 Recent Videos</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {recentVideos.map((video, idx) => (
                  <VideoCard key={idx} video={video} onClick={() => setSelectedVideo({ shortcode: video.shortcode, url: video.videoUrl })} />
                ))}
              </div>
            </section>

            {/* Viral Videos Section */}
            <section>
              <div className="flex items-center gap-3 mb-8 px-2">
                <span className="w-8 h-[2px] bg-indigo-500"></span>
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">Top 20 Viral Videos</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {viralVideos.map((video, idx) => (
                  <VideoCard key={idx} video={video} onClick={() => setSelectedVideo({ shortcode: video.shortcode, url: video.videoUrl })} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {selectedVideo && (
        <VideoModal 
          shortcode={selectedVideo.shortcode} 
          videoUrl={selectedVideo.url}
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
      className="group bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden hover:border-indigo-500/50 transition-all duration-300 cursor-pointer shadow-xl relative"
    >
      <div className="aspect-[3/4] overflow-hidden relative">
        <img 
          src={`https://images.weserv.nl/?url=${encodeURIComponent(video.thumbnailUrl)}`} 
          alt="Thumbnail" 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80 group-hover:opacity-40 transition-opacity"></div>
        
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800">
            <span className="text-[10px]">▶</span>
            <span className="text-xs font-black text-white">{video.videoViewCount?.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800">
            <span className="text-[10px]">❤</span>
            <span className="text-xs font-black text-white">{video.likeCount?.toLocaleString()}</span>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <p className="text-slate-400 text-[10px] leading-relaxed line-clamp-2 font-medium opacity-80 h-8">
          {video.caption || 'No caption available'}
        </p>
      </div>
    </div>
  )
}

export default ProfilePage

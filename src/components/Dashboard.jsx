import { useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoModal from './VideoModal'

const ITEMS_PER_PAGE = 25;

function Dashboard({ sharedCategories }) {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [nameSearch, setNameSearch] = useState('')
  const [selectedVideo, setSelectedVideo] = useState(null)

  // Dynamically generate categories from available profile data
  const dashboardCategories = useMemo(() => {
    const categories = profiles
      .map(p => p.businessCategoryName)
      .filter(Boolean)
    const uniqueCategories = [...new Set(categories)].sort()
    return ['All Categories', ...uniqueCategories]
  }, [profiles]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, nameSearch]);

  // Helper to map legacy database categories to current UI labels
  const mapCategory = (dbCategory) => {
    const mapping = {
      'Software Developer': 'Software Development',
      'Frontend Developer': 'Frontend Development',
      'Backend Developer': 'Backend Development',
      'AI Engineer': 'AI Tools',
      'LLM / AI Tools': 'LLMs',
      'Android Developer': 'Mobile Development' // Fallback for any others
    }
    return mapping[dbCategory] || dbCategory || 'Software Development';
  }

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const { data: records, error } = await supabase
        .from('post_insta_data')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const allPosts = records.flatMap(record => {
        const posts = record.post_data?.post_data || record.post_data?.posts || []
        const isSyncing = record.post_data?.status === 'syncing'
        const ownerName = record.post_data?.profile_data?.[0]?.fullName || record.username;
        
        if (isSyncing) return [];
        if (!ownerName || ownerName === 'N/A' || ownerName.trim() === '') return [];

        return posts
          .filter(post => post.videoUrl || post.videoPlayCount || post.videoViewCount || post.isVideo === true)
          .map((post, index) => ({
            id: `${record.id}-${post.id || post.shortcode || index}`, 
            username: record.username,
            ownerFullName: ownerName,
            profilePic: record.post_data?.profile_data?.[0]?.profilePicUrl || '',
            shortcode: post.shortcode,
            videoUrl: post.videoUrl || `https://www.instagram.com/reels/${post.shortcode}/`,
            plays: post.videoPlayCount || post.videoViewCount || 0,
            likes: Math.max(0, post.like_count || post.likesCount || 0),
            comments: post.comment_count || post.commentsCount || 0,
            syncDate: new Date(record.created_at).toLocaleDateString(),
            category: mapCategory(record.category),
            businessCategoryName: record.post_data?.profile_data?.[0]?.businessCategoryName || 
                                  record.post_data?.profile_data?.businessCategoryName || 'N/A'
          }))
      })

      const allProfiles = records.flatMap(record => {
        const isSyncing = record.post_data?.status === 'syncing';
        const profileData = record.post_data?.profile_data;
        
        if (isSyncing) {
          return [{
            fullName: 'Gathering Info...',
            username: record.username,
            isSyncing: true,
            recordId: record.id,
            businessCategoryName: 'Loading...',
            postsCount: 0,
            followsCount: 0,
            followersCount: 0,
            externalUrl: null
          }];
        }

        if (!profileData) return [];
        const profilesArray = Array.isArray(profileData) ? profileData : [profileData];
        return profilesArray
          .filter(profile => profile.fullName && profile.fullName.trim() !== '')
          .map(profile => ({
            ...profile,
            recordId: record.id,
            isSyncing: false
          }))
      })

      const sortedPosts = allPosts.sort((a, b) => {
        if (b.plays !== a.plays) return b.plays - a.plays;
        return b.likes - a.likes;
      })
      setData(sortedPosts)
      setProfiles(allProfiles)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(true)

    // Subscribe to real-time changes
    const channel = supabase
      .channel('post-insta-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_insta_data' },
        (payload) => {
          console.log('Real-time update received:', payload)
          fetchData(false) // Silent refresh
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
 // Fetch once on mount

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const nameMatch = nameSearch
        ? (row.ownerFullName || "").toLowerCase().includes(nameSearch.toLowerCase())
        : true;

      const categoryMatch =
        selectedCategory && selectedCategory !== "All Categories"
          ? row.businessCategoryName === selectedCategory
          : true;

      return nameMatch && categoryMatch;
    });
  }, [data, selectedCategory, nameSearch]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const nameMatch = nameSearch
        ? (profile.fullName || "").toLowerCase().includes(nameSearch.toLowerCase())
        : true;

      const categoryMatch =
        selectedCategory && selectedCategory !== "All Categories"
          ? profile.businessCategoryName === selectedCategory
          : true;

      return nameMatch && categoryMatch;
    });
  }, [profiles, selectedCategory, nameSearch]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE)
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredData, currentPage])

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400 font-bold text-xl tracking-widest animate-pulse">
      LOADING ARCHIVES...
    </div>
  )


  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-indigo-500/30">
      <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-screen">
        <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 lg:p-12 shadow-2xl backdrop-blur-xl">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-10 sm:mb-16 uppercase">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link 
              to="/" 
              className="p-3 sm:p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:border-indigo-500/50 transition-all group shrink-0"
              title="Back to Search"
            >
              <span className="text-slate-500 group-hover:text-indigo-400 font-bold block rotate-0">←</span>
            </Link>
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mb-1 sm:mb-2">
                Dashboard <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Analytics</span>
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm lg:text-base font-medium tracking-widest uppercase opacity-70">
                Instagram Performance Repository
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch gap-4 w-full xl:w-auto">
            <div className="relative group flex-1 md:w-80">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
              <input
                type="text"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                placeholder="Search by name..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 text-slate-300 pl-12 pr-5 py-3 sm:py-4 rounded-2xl outline-none font-semibold text-sm sm:text-base transition-all placeholder:text-slate-600"
              />
            </div>

            <div className="relative group md:w-72">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 text-slate-300 px-5 sm:px-8 py-3 sm:py-4 rounded-2xl outline-none cursor-pointer appearance-none font-semibold text-sm sm:text-base transition-all"
            >
              {dashboardCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">↓</div>
          </div>
        </div>
      </header>

        {/* Profile Analytics */}
        <div className="mt-12 mb-16">
          <div className="flex items-center gap-3 mb-6 px-2 sm:px-0">
            <span className="w-8 h-[2px] bg-indigo-500"></span>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Profile Analytics</h2>
          </div>
          
          <div className="bg-slate-900/40 border border-slate-800 rounded-[1.5rem] sm:rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                  <tr className="border-b border-slate-800/50 bg-slate-900/50">
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">Sr. No</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">Profile Pic</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">Name</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">Biography</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">Posts</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">Follows</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">Followers</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">Category</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">Link</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/20">
                  {filteredProfiles.length > 0 ? (
                    filteredProfiles.map((profile, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          <span className="text-slate-500 font-mono text-xs">{idx + 1}</span>
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          {profile.profilePicUrl ? (
                            <img 
                              src={`https://images.weserv.nl/?url=${encodeURIComponent(profile.profilePicUrl)}`} 
                              alt="Profile" 
                              width="40" 
                              height="40" 
                              className="rounded-full object-cover border border-slate-700" 
                              referrerPolicy="no-referrer"
                            />
                          ) : null}
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          {profile.isSyncing ? (
                            <div className="flex items-center gap-2 text-indigo-400 animate-pulse">
                              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></div>
                              <span className="text-[10px] font-bold uppercase tracking-wider">Syncing...</span>
                            </div>
                          ) : (
                            <span className="text-white font-bold text-xs">{profile.fullName || 'N/A'}</span>
                          )}
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6 max-w-[200px]">
                          <span className="text-slate-400 text-[10px] leading-relaxed line-clamp-3">{profile.biography || 'N/A'}</span>
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          <span className="text-white font-bold text-xs">{profile.postsCount?.toLocaleString() || '0'}</span>
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          <span className="text-white font-bold text-xs">{profile.followsCount?.toLocaleString() || '0'}</span>
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          <span className="text-white font-bold text-xs">{profile.followersCount?.toLocaleString() || '0'}</span>
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          <span className="text-white font-bold text-xs">{profile.businessCategoryName || 'N/A'}</span>
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          {profile.externalUrl ? (
                            <a 
                              href={profile.externalUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold text-[10px] transition-all"
                              title="External Profile"
                            >
                              Link
                            </a>
                          ) : (
                            <span className="text-slate-600 text-[10px] font-mono">N/A</span>
                          )}
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          <button 
                            onClick={() => navigate(`/profile/${profile.recordId}`)}
                            disabled={profile.isSyncing}
                            className={`text-xs font-bold py-2 px-4 rounded-lg transition-all ${
                              profile.isSyncing 
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                                : 'bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer'
                            }`}
                          >
                            {profile.isSyncing ? 'Waiting...' : 'View'}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" className="px-8 py-16 text-center text-slate-500">
                        No profile data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
  </div>
)
}

export default Dashboard

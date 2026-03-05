import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoModal from './VideoModal'

const ITEMS_PER_PAGE = 25;

function Dashboard({ sharedCategories }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [nameSearch, setNameSearch] = useState('')
  const [selectedVideo, setSelectedVideo] = useState(null)

  // Remove "Others" from the dashboard dropdown as requested
  const dashboardCategories = useMemo(() => {
    return ['All Categories', ...sharedCategories.filter(c => c.id !== 'Others').map(c => c.id)];
  }, [sharedCategories]);

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

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const { data: records, error } = await supabase
          .from('post_insta_data')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        const allPosts = records.flatMap(record => {
          const posts = record.post_data.posts || []
          return posts.map((post, index) => ({
            id: `${record.id}-${post.id || post.shortcode || index}`, // Ensure global uniqueness across records
            username: record.username,
            ownerFullName: record.post_data?.profile_metadata?.full_name || record.username,
            profilePic: record.post_data.profile_metadata.profile_picture,
            shortcode: post.shortcode,
            videoUrl: post.videoUrl || `https://www.instagram.com/reels/${post.shortcode}/`,
            plays: post.videoPlayCount || post.videoViewCount || 0,
            likes: post.like_count || post.likesCount || 0,
            comments: post.comment_count || post.commentsCount || 0,
            syncDate: new Date(record.created_at).toLocaleDateString(),
            category: mapCategory(record.category)
          }))
        })

        const sortedPosts = allPosts.sort((a, b) => {
          if (b.plays !== a.plays) return b.plays - a.plays;
          return b.likes - a.likes;
        })
        setData(sortedPosts)
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, []) // Fetch once on mount

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const nameMatch = nameSearch
        ? (row.ownerFullName || "").toLowerCase().includes(nameSearch.toLowerCase())
        : true;

      const categoryMatch =
        selectedCategory && selectedCategory !== "All Categories"
          ? row.category === selectedCategory
          : true;

      return nameMatch && categoryMatch;
    });
  }, [data, selectedCategory, nameSearch]);

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

        {/* Reel Analytics (Detailed Table) */}
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6 px-2 sm:px-0">
            <span className="w-8 h-[2px] bg-indigo-500"></span>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Reel Analytics</h2>
          </div>
          
          <div className="bg-slate-900/40 border border-slate-800 rounded-[1.5rem] sm:rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-slate-800/50 bg-slate-900/50">
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em]">Sr. No</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em]">Date</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em]">Name</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em]">Category</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em]">Link</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em]">Views</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em]">Likes</th>
                    <th className="px-6 sm:px-8 py-5 sm:py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em]">Comments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/20">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="px-8 py-24 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                          <p className="text-slate-500 font-bold tracking-widest text-xs uppercase animate-pulse">Analyzing Archives...</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedData.length > 0 ? (
                    paginatedData.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          <span className="text-slate-500 font-mono text-xs">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</span>
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6 whitespace-nowrap">
                          <span className="text-slate-500 font-bold text-xs">{item.syncDate}</span>
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          <span className="text-white font-bold leading-tight text-[10px] sm:text-xs md:text-sm line-clamp-2">{item.ownerFullName}</span>
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6 whitespace-nowrap">
                          <span className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-indigo-400 text-[10px] font-bold uppercase tracking-wider group-hover:border-indigo-500/30 transition-all">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6 whitespace-nowrap">
                          <button 
                            onClick={() => setSelectedVideo({ shortcode: item.shortcode, url: item.videoUrl })}
                            className="text-slate-400 hover:text-indigo-400 font-mono text-xs transition-colors flex items-center gap-1"
                          >
                            View Reel <span className="text-[10px]">↗</span>
                          </button>
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          <span className="text-white font-black text-sm">{item.plays?.toLocaleString()}</span>
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          <span className="text-white font-black text-sm">{item.likes?.toLocaleString()}</span>
                        </td>
                        <td className="px-6 sm:px-8 py-5 sm:py-6">
                          <span className="text-white font-black text-sm">{item.comments?.toLocaleString()}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-8 py-32 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-4">
                          <div className="text-4xl grayscale opacity-20">📊</div>
                          <p className="text-lg font-medium text-white/50 tracking-tight">No data available</p>
                          <p className="text-sm opacity-60">Adjust your filters or curate more content to see analytics.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 py-6 bg-slate-900/40 backdrop-blur-2xl border border-slate-800 rounded-3xl">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="w-12 h-12 flex items-center justify-center bg-slate-950 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all text-slate-400 disabled:opacity-30 disabled:pointer-events-none group font-bold"
              title="First Page"
            >
              <span className="group-hover:-translate-x-1 transition-transform">«</span>
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-12 h-12 flex items-center justify-center bg-slate-950 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all text-slate-400 disabled:opacity-30 disabled:pointer-events-none group"
              title="Previous Page"
            >
              <span className="group-hover:-translate-x-1 transition-transform">←</span>
            </button>
            
            <div className="flex items-center gap-2">
              <div className="bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-xl text-indigo-400 font-black text-sm">
                {currentPage}
              </div>
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="w-12 h-12 flex items-center justify-center bg-slate-950 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all text-slate-400 disabled:opacity-30 disabled:pointer-events-none group"
              title="Next Page"
            >
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="w-12 h-12 flex items-center justify-center bg-slate-950 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all text-slate-400 disabled:opacity-30 disabled:pointer-events-none group font-bold"
              title="Last Page"
            >
              <span className="group-hover:translate-x-1 transition-transform">»</span>
            </button>
          </div>
        )}
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

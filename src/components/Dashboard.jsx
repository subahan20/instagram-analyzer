import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoModal from './VideoModal'
import CategorySelector from './CategorySelector'
import SubcategorySelector from './SubcategorySelector'
import CreatorList from './CreatorList'

export default function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState({ name: 'All Categories', id: null })
  const [selectedSubcategory, setSelectedSubcategory] = useState({ name: 'All Subcategories', id: null })
  const [nameSearch, setNameSearch] = useState('')
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)


  // Auto-refresh data every 60 seconds to show latest updates from Cron
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1)
    }, 60000)
    return () => clearInterval(interval)
  }, [])

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
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[1px]"></div>
      </div>

      {/* Sticky Premium Header */}
      <div className="sticky top-0 z-50 glass border-b border-white/5 shadow-2xl overflow-hidden">
        {/* Subtle Header Glows */}
        <div className="absolute top-0 left-1/4 w-[400px] h-[100px] bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none"></div>
        <div className="absolute top-0 right-1/4 w-[200px] h-[50px] bg-violet-500/5 blur-[60px] rounded-full pointer-events-none"></div>

        <div className="max-w-[1800px] mx-auto relative z-10 px-4 sm:px-6 lg:px-12 py-5 lg:py-6">
          <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
            <div className="flex items-center gap-5">
              <Link 
                to="/" 
                className="w-10 h-10 flex items-center justify-center glass rounded-xl hover:bg-white/10 transition-colors group"
                title="Back to Landing"
              >
                <svg className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                  Creator <span className="text-gradient">Discovery</span>
                </h1>
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold opacity-70 mt-0.5">
                  Intelligence Dashboard
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full xl:w-auto">

              <div className="relative group min-w-[300px]">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  placeholder="Search creators by name..."
                  className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500/50 text-slate-200 pl-11 pr-5 py-3 rounded-xl outline-none text-sm transition-all placeholder:text-slate-600 focus:ring-4 focus:ring-indigo-500/5"
                />
              </div>

              <div className="md:w-[240px]">
                <CategorySelector 
                  selectedCategory={selectedCategory}
                  onCategoryChange={(cat) => {
                    setSelectedCategory(cat);
                    setSelectedSubcategory({ name: 'All Subcategories', id: null });
                  }}
                  showAllOption={true}
                  showOthers={false}
                />
              </div>

              {selectedCategory?.name !== 'All Categories' && (
                <div className="md:w-[240px] animate-in fade-in slide-in-from-right-4 duration-300">
                  <SubcategorySelector 
                    categoryId={selectedCategory?.id}
                    selectedSubcategory={selectedSubcategory}
                    onSubcategoryChange={setSelectedSubcategory}
                    showAllOption={true}
                  />
                </div>
              )}
            </div>
          </header>
        </div>
      </div>

      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-12 py-12 lg:py-16">
        {/* Creator Listing */}
        <div className="relative z-10">
          <CreatorList 
            key={refreshKey}
            categoryId={selectedCategory?.id}
            subcategoryId={selectedSubcategory?.id}
            nameSearch={nameSearch}
          />
        </div>
      </main>

      {selectedVideo && (
        <VideoModal 
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)} 
        />
      )}
    </div>
  )
}

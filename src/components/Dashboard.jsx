import { useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoModal from './VideoModal'
import CategorySelector from './CategorySelector'
import SubcategorySelector from './SubcategorySelector'
import CreatorList from './CreatorList'

const ITEMS_PER_PAGE = 25;

function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState({ name: 'All Categories', id: null })
  const [selectedSubcategory, setSelectedSubcategory] = useState({ name: 'All Subcategories', id: null })
  const [nameSearch, setNameSearch] = useState('')
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      console.log('🔄 Manual Sync Triggered...');
      const { data, error } = await supabase.functions.invoke('refresh-instagram-data', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (error) throw error;
      console.log('✅ Sync Success:', data);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('❌ Sync Failed:', err);
      alert('Failed to refresh data. Please check Edge Function logs.');
    } finally {
      setSyncing(false);
    }
  };

  // Auto-refresh data every 60 seconds to show latest updates from Cron
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1)
    }, 60000)
    return () => clearInterval(interval)
  }, [])


  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-indigo-500/30">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-50 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 bg-slate-950/80 backdrop-blur-2xl border-b border-slate-800/50 shadow-2xl relative overflow-hidden">
        {/* Decorative background element for premium feel on wide screens */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[120px] -mr-48 -mt-48 rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/5 blur-[100px] -ml-32 -mb-32 rounded-full pointer-events-none"></div>
        
        <div className="max-w-[2000px] mx-auto relative z-10">
          <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sm:gap-8">
            <div className="flex items-center gap-4 sm:gap-6">
              <Link 
                to="/" 
                className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl hover:border-indigo-500/50 transition-all group shrink-0 shadow-lg"
                title="Back to Search"
              >
                <span className="text-slate-500 group-hover:text-indigo-400 font-bold block rotate-0">←</span>
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white leading-none">
                  Creator <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Discovery</span>
                </h1>
                <p className="text-slate-500 text-[8px] sm:text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase mt-1.5 opacity-70">
                  Premium Performance Intelligence
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full xl:w-auto mt-2 xl:mt-0">
              {/* Sync Now Button */}
              <button
                onClick={handleSync}
                disabled={syncing}
                className={`group flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black text-xs tracking-widest uppercase transition-all shadow-lg active:scale-95 ${
                  syncing 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                    : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20'
                }`}
              >
                <span className={`${syncing ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`}>
                  {syncing ? '⌛' : '🔄'}
                </span>
                <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>

              <div className="relative group flex-1 md:w-64 lg:w-80">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 text-sm opacity-50 group-focus-within:opacity-100 transition-opacity">🔍</span>
                <input
                  type="text"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  placeholder="Search creators..."
                  className="w-full bg-slate-950/50 border border-slate-800 focus:border-indigo-500/50 text-slate-300 pl-12 pr-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl outline-none font-semibold text-sm transition-all placeholder:text-slate-600 backdrop-blur-md"
                />
              </div>

              <div className="md:w-64">
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
                <div className="md:w-64 animate-in fade-in slide-in-from-right-4 duration-500">
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

      <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-screen">
        {/* Creator Listing (Relational Table via CreatorList) */}
        <CreatorList 
          key={refreshKey}
          categoryId={selectedCategory?.id}
          subcategoryId={selectedSubcategory?.id}
          nameSearch={nameSearch}
        />
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

export default Dashboard

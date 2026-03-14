import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

let globalCreatorsCache = null;
let globalCreatorsCounts = { total: 0, filtered: 0 };
let lastFetchKey = '';
let isGlobalFetching = false;

export default function CreatorList({ categoryId, subcategoryId, nameSearch }) {
  const navigate = useNavigate()
  
  const currentKey = `${categoryId}-${subcategoryId}-${nameSearch}`;
  const hasCache = currentKey === lastFetchKey && globalCreatorsCache !== null;
  
  const [creators, setCreators] = useState(hasCache ? globalCreatorsCache : []);
  const [counts, setCounts] = useState(hasCache ? globalCreatorsCounts : { total: 0, filtered: 0 });
  const [loading, setLoading] = useState(!hasCache);
  const abortControllerRef = useRef(null);

  const fetchCreators = async (showLoading = true, forceRefresh = false) => {
    const currentKey = `${categoryId}-${subcategoryId}-${nameSearch}`;
    
    // Use cache if available and not forcing refresh
    if (!forceRefresh && showLoading && currentKey === lastFetchKey && globalCreatorsCache) {
      setCreators(globalCreatorsCache);
      setCounts(globalCreatorsCounts);
      setLoading(false);
      return;
    }

    if (isGlobalFetching) return;
    isGlobalFetching = true;

    if (showLoading) setLoading(true)
    try {
      // Fetch profiles via Edge Function dispatcher
      const { data, error } = await supabase.functions.invoke('post', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: { 
          action: 'list',
          categoryId: categoryId,
          subcategoryId: subcategoryId,
          nameSearch: nameSearch 
        }
      });

      if (error) throw error;
      
      globalCreatorsCache = data.data || [];
      globalCreatorsCounts = { 
        total: data.totalCount || 0, 
        filtered: data.filteredCount || 0 
      };
      lastFetchKey = currentKey;

      setCreators(globalCreatorsCache)
      setCounts(globalCreatorsCounts)
    } catch (err) {
      console.error('Error fetching profiles from Edge Function:', err);
    } finally {
      isGlobalFetching = false;
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true;
    
    const runFetch = async () => {
      await fetchCreators();
    };

    runFetch();

    return () => {
      isMounted = false;
    };
  }, [categoryId, subcategoryId, nameSearch]);

  const debounceTimer = useRef(null);

  // Real-time subscription ONLY for influencers table to avoid spam
  // Reels and Metrics will be updated visually by the 60s auto-refresh interval in Dashboard.jsx
  useEffect(() => {
    const debouncedFetch = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        console.log('Debounced fetch triggered from influencers update...');
        fetchCreators(false, true);
      }, 3000);
    };

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'influencers' 
        },
        () => {
          debouncedFetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [categoryId, subcategoryId, nameSearch]);

  if (loading) return (
    <div className="py-32 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800 rounded-[3rem] relative overflow-hidden backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent animate-pulse"></div>
      <div className="w-16 h-16 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mb-6 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]"></div>
      <div className="text-slate-400 font-bold uppercase tracking-[0.2em] text-sm animate-pulse">
        Fetching Intelligence...
      </div>
    </div>
  )

  if (creators.length === 0) return (
    <div className="py-20 text-center bg-slate-900/40 border border-slate-800 rounded-3xl">
      <p className="text-slate-500 font-medium italic">
        {counts.total > 0 
          ? `No profiles match this filter. (Total in database: ${counts.total})`
          : "No profiles found in the database. Please sync a profile from the Search page!"}
      </p>
      {counts.total > 0 && (
        <button 
          onClick={() => navigate('/')}
          className="mt-4 text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase tracking-widest"
        >
          + Sync New Profile
        </button>
      )}
    </div>
  )

  return (
    <div className="mt-12 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-3 mb-8 px-2 sm:px-0">
        <span className="w-12 h-[2px] bg-gradient-to-r from-indigo-500 to-transparent"></span>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
          Creator <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Discovery</span>
        </h2>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl sm:rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-800/50 bg-slate-900/50">
                <th className="px-6 sm:px-8 py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] text-center">Sr. No</th>
                <th className="px-6 sm:px-8 py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em]">Profile</th>
                <th className="px-6 sm:px-8 py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em]">Followers</th>
                <th className="px-6 sm:px-8 py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em]">Growth</th>
                <th className="px-6 sm:px-8 py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] text-center">Likes</th>
                <th className="px-6 sm:px-8 py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] text-center">Views</th>
                <th className="px-6 sm:px-8 py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] text-center">Last Sync</th>
                <th className="px-6 sm:px-8 py-6 text-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/20">
              {creators.map((influencer, idx) => {
                const metrics = influencer.latest_metrics || {};
                const engagementRate = metrics.followers > 0 
                  ? ((metrics.likes + metrics.comments) / metrics.followers * 100).toFixed(2) 
                  : '0.00';

                return (
                  <tr key={influencer.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 sm:px-8 py-5 sm:py-6">
                      <span className="text-slate-500 font-mono text-xs">{idx + 1}</span>
                    </td>
                    <td className="px-6 sm:px-8 py-5 sm:py-6">
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          {influencer.profile_pic ? (
                            <img 
                              src={`https://images.weserv.nl/?url=${encodeURIComponent(influencer.profile_pic)}&w=100&h=100&fit=cover&mask=circle`} 
                              alt={influencer.username}
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-slate-800 group-hover:border-indigo-500/50 transition-all shadow-xl"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-500 font-bold">
                              {influencer.username?.[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-white font-bold text-xs sm:text-sm md:text-base group-hover:text-indigo-400 transition-colors">@{influencer.username}</div>
                          <div className="text-slate-500 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider">{influencer.business_category || 'Creator'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 sm:px-8 py-5 sm:py-6">
                      <div className="text-white font-black text-xs sm:text-base md:text-lg tracking-tight">
                        {metrics.followers?.toLocaleString() || '0'}
                      </div>
                      <div className="text-slate-500 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest mt-0.5">TOTAL</div>
                    </td>
                    <td className="px-6 sm:px-8 py-5 sm:py-6">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] sm:text-[10px] font-black tracking-widest uppercase ${
                        influencer.growth >= 0 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        <span>{influencer.growth >= 0 ? '↑' : '↓'} {Math.abs(influencer.growth)}%</span>
                      </div>
                    </td>
                    <td className="px-6 sm:px-8 py-5 sm:py-6 text-center">
                      <div className="text-white font-black text-xs sm:text-base md:text-lg tracking-tight">
                        {metrics.likes?.toLocaleString() || '0'}
                      </div>
                      <div className="text-slate-500 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest mt-0.5">LIKES</div>
                    </td>
                    <td className="px-6 sm:px-8 py-5 sm:py-6 text-center">
                      <div className="text-white font-black text-xs sm:text-base md:text-lg tracking-tight">
                        {metrics.views?.toLocaleString() || '0'}
                      </div>
                      <div className="text-slate-500 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest mt-0.5">VIEWS</div>
                    </td>
                    <td className="px-6 sm:px-8 py-5 sm:py-6 text-center">
                      <div className="text-white font-black text-xs sm:text-base md:text-lg tracking-tight">
                        {influencer.last_synced_at 
                          ? new Date(influencer.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Never'}
                      </div>
                      <div className="text-slate-500 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest mt-0.5">
                        {influencer.last_synced_at 
                          ? new Date(influencer.last_synced_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                          : 'SYNC REQ'}
                      </div>
                    </td>
                    <td className="px-6 sm:px-8 py-5 sm:py-6 text-right">
                      <button 
                        onClick={() => navigate(`/profile/${influencer.id}`)}
                        className="inline-flex items-center justify-center p-2 sm:p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-indigo-500/50 hover:bg-slate-800 transition-all group/btn shadow-lg"
                      >
                        <span className="text-slate-400 group-hover/btn:text-indigo-400 font-bold block transition-transform group-hover/btn:translate-x-0.5">→</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

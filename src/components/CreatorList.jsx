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
  const debounceTimer = useRef(null);

  const fetchCreators = async (showLoading = true, forceRefresh = false) => {
    const currentKey = `${categoryId}-${subcategoryId}-${nameSearch}`;
    
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
    fetchCreators();
  }, [categoryId, subcategoryId, nameSearch]);

  useEffect(() => {
    const debouncedFetch = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
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
    <div className="py-32 flex flex-col items-center justify-center glass rounded-[2rem] relative overflow-hidden">
      <div className="absolute inset-0 bg-indigo-500/5 animate-pulse"></div>
      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
      <div className="text-slate-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">
        Gathering Intelligence...
      </div>
    </div>
  )

  if (creators.length === 0) return (
    <div className="py-20 text-center glass rounded-3xl">
      <p className="text-slate-500 font-medium italic mb-4">
        {counts.total > 0 
          ? `No profiles match this filter. (Total in database: ${counts.total})`
          : "Discover your first creator to begin."}
      </p>
      <button 
        onClick={() => navigate('/')}
        className="text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase tracking-widest border border-indigo-500/20 px-6 py-3 rounded-xl hover:bg-indigo-500/5 transition-all"
      >
        + Sync New Profile
      </button>
    </div>
  )

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
          <h2 className="text-xl font-bold text-white tracking-tight uppercase">
            Top <span className="text-gradient">Creators</span>
          </h2>
        </div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900 border border-white/5 px-3 py-1 rounded-full">
          {creators.length} Result{creators.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="glass rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-white/5 bg-white/2">
                <th className="px-8 py-5 text-slate-500 font-bold text-[10px] uppercase tracking-widest">Profile</th>
                <th className="px-8 py-5 text-slate-500 font-bold text-[10px] uppercase tracking-widest">Followers</th>
                <th className="px-8 py-5 text-slate-500 font-bold text-[10px] uppercase tracking-widest text-center">Likes Avg.</th>
                <th className="px-8 py-5 text-slate-500 font-bold text-[10px] uppercase tracking-widest text-center">Views Avg.</th>
                <th className="px-8 py-5 text-slate-500 font-bold text-[10px] uppercase tracking-widest text-center">Last Sync</th>
                <th className="px-8 py-5 text-slate-500 font-bold text-[10px] uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/2">
              {creators.map((influencer) => {
                const metrics = influencer.latest_metrics || {};
                return (
                  <tr key={influencer.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-4">
                        <div className="relative group/avatar">
                          <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-full blur-[4px] opacity-0 group-hover/avatar:opacity-20 transition-opacity"></div>
                          {influencer.profile_pic ? (
                            <img 
                              src={`https://images.weserv.nl/?url=${encodeURIComponent(influencer.profile_pic)}&w=100&h=100&fit=cover&mask=circle`} 
                              alt={influencer.username}
                              className="relative w-12 h-12 rounded-full object-cover border border-white/10 group-hover:border-indigo-500/50 transition-colors shadow-lg"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="relative w-12 h-12 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-500 font-bold text-lg">
                              {influencer.username?.[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-slate-100 font-bold group-hover:text-indigo-400 transition-colors">@{influencer.username}</div>
                          <div className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mt-0.5">{influencer.business_category || 'Creator'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <div className="text-slate-200 font-bold text-base tracking-tight">
                        {metrics.followers?.toLocaleString() || '0'}
                      </div>
                      <div className={`mt-1 inline-flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase ${
                        influencer.growth >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {influencer.growth >= 0 ? '↑' : '↓'} {Math.abs(influencer.growth)}%
                      </div>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <div className="text-slate-200 font-bold text-base tracking-tight">
                        {metrics.likes?.toLocaleString() || '0'}
                      </div>
                      <div className="text-slate-600 text-[9px] font-bold uppercase tracking-widest mt-1">TOTAL AVG</div>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <div className="text-slate-200 font-bold text-base tracking-tight">
                        {metrics.views?.toLocaleString() || '0'}
                      </div>
                      <div className="text-slate-600 text-[9px] font-bold uppercase tracking-widest mt-1">TOTAL AVG</div>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <div className="text-slate-300 font-semibold text-xs">
                        {influencer.last_synced_at 
                          ? new Date(influencer.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Pending'}
                      </div>
                      <div className="text-slate-600 text-[9px] font-bold uppercase tracking-widest mt-1">
                        {influencer.last_synced_at 
                          ? new Date(influencer.last_synced_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                          : 'Request'}
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button 
                        onClick={() => navigate(`/profile/${influencer.id}`)}
                        className="inline-flex items-center justify-center w-10 h-10 bg-slate-900 border border-white/10 rounded-xl hover:border-indigo-500/50 hover:bg-slate-800 transition-all shadow-lg group/btn"
                      >
                        <svg className="w-5 h-5 text-slate-500 group-hover/btn:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
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

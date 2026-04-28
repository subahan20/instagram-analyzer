import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import CategorySelector from './CategorySelector';
import SubcategorySelector from './SubcategorySelector';
import Navbar from './Navbar';
import scraperService from '../services/scraperService';

export default function Dashboard({ user, theme, setTheme }) {
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(null);
  const [subcategory, setSubcategory] = useState({ name: 'All Subcategories', id: null });
  const [imgErrors, setImgErrors] = useState({});
  const navigate = useNavigate();

  const handleRefreshAll = async (targetInfluencer = null) => {
    const target = targetInfluencer || influencers.find(inf => {
      const lastUpdate = new Date(inf.last_updated_at).getTime();
      return Date.now() - lastUpdate > 24 * 60 * 60 * 1000;
    });

    if (target) {
      console.log(`[SILENT-HEAL] Refreshing: ${target.username}`);
      try {
        await scraperService.refreshData(`https://instagram.com/${target.username}`, { force: true, userId: user?.id });
      } catch (err) {
        console.error('[SILENT-HEAL] Error:', err);
      }
    } else if (!targetInfluencer) {
      toast.info('All profiles are currently up to date!');
    }
  };

  useEffect(() => {
    async function fetchInfluencers() {
      setLoading(true);
      try {
        let query = supabase
          .from('influencers')
          .select('*')
          .order('last_updated_at', { ascending: false });

        if (user?.id) {
          query = query.eq('user_id', user.id);
        }

        if (category?.id) {
          query = query.eq('category_id', category.id);
        }
        
        if (subcategory?.id) {
          query = query.eq('subcategory_id', subcategory.id);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Final safety: deduplicate by username if somehow multiple records exist for same user
        const uniqueInfluencers = [];
        const seenUsernames = new Set();
        
        (data || []).forEach(inf => {
          if (!seenUsernames.has(inf.username)) {
            seenUsernames.add(inf.username);
            uniqueInfluencers.push(inf);
          }
        });

        setInfluencers(uniqueInfluencers);
      } catch (err) {
        console.error('Error fetching influencers:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchInfluencers();

    // ─── REALTIME SUBSCRIPTION ───
    // Listen for any updates to influencers to show "live" data
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
          console.log('[REALTIME] Change detected, refreshing...');
          fetchInfluencers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [category, subcategory, user]);

  // Auto-healing: Trigger a SILENT background refresh if images are broken
  useEffect(() => {
    if (!loading && influencers.length > 0) {
      const needsHealing = influencers.find(inf => {
        const isBroken = imgErrors[inf.id] || !inf.profile_pic || (inf.profile_pic && !inf.profile_pic.startsWith('data:'));
        const lastUpdate = new Date(inf.last_updated_at).getTime();
        return isBroken && (Date.now() - lastUpdate > 6 * 60 * 60 * 1000); // 6h threshold
      });
      
      if (needsHealing) {
        handleRefreshAll(needsHealing);
      }
    }
  }, [loading, influencers, imgErrors]);

  return (
    <div className="min-h-screen bg-canvas transition-colors duration-500">
      <Navbar user={user} theme={theme} setTheme={setTheme} />
      
      <div className="max-w-[1400px] mx-auto pt-24 sm:pt-32 px-4 sm:px-8 pb-20 space-y-8 sm:space-y-12">
        {/* Header Section: Responsive Column on Mobile, Row on Desktop */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 sm:gap-8 border-b border-slate-200 dark:border-white/5 pb-8">
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-black text-primary tracking-tighter uppercase italic transition-colors">
              Intelligence <span className="text-indigo-500">Hub</span>
            </h1>
            <p className="text-secondary font-bold uppercase tracking-[0.3em] text-[10px] mt-2 italic opacity-70 transition-colors">Your Personal AI-Driven Influencer Archive</p>
          </div>
          
          {/* Neural Filtering Cluster: Forced Row Layout for Mobile/Desktop */}
          <div className="flex flex-row items-center justify-end gap-2 sm:gap-4 w-full lg:w-auto transition-all">
            <div className="flex-1 lg:flex-none lg:min-w-[160px]">
              <CategorySelector 
                selectedCategory={category}
                onCategoryChange={(cat) => {
                  setCategory(cat);
                  setSubcategory({ name: 'All Subcategories', id: null });
                }}
                showAllOption={true}
                showOthers={false}
                className="px-3 sm:px-4 py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest outline-none cursor-pointer glass hover:border-indigo-500/30 transition-all flex items-center text-secondary w-full"
              />
            </div>
            
            {category?.id && (
              <div className="flex-1 lg:flex-none lg:min-w-[160px]">
                <SubcategorySelector 
                  categoryId={category.id}
                  selectedSubcategory={subcategory}
                  onSubcategoryChange={setSubcategory}
                  showAllOption={true}
                  showOthers={false}
                  className="px-3 sm:px-4 py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest outline-none cursor-pointer glass hover:border-indigo-500/30 transition-all flex items-center text-secondary w-full"
                />
              </div>
            )}
          </div>
        </div>

        {/* Results Section (Influencer Table) */}
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6">
              <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-[10px] text-secondary font-black uppercase tracking-[0.2em] animate-pulse">Scanning Neural Network...</p>
            </div>
          ) : influencers.length > 0 ? (
            <div className="glass rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 transition-colors">
                      <th className="px-8 py-6 text-secondary font-black text-[10px] uppercase tracking-[0.2em] text-center transition-colors">Profile</th>
                      <th className="px-8 py-6 text-secondary font-black text-[10px] uppercase tracking-[0.2em] text-center transition-colors">Identity</th>
                      <th className="px-8 py-6 text-secondary font-black text-[10px] uppercase tracking-[0.2em] text-center transition-colors">Followers</th>
                      <th className="px-8 py-6 text-secondary font-black text-[10px] uppercase tracking-[0.2em] text-center transition-colors">Following</th>
                      <th className="px-8 py-6 text-secondary font-black text-[10px] uppercase tracking-[0.2em] text-center transition-colors">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/2 transition-colors">
                    {influencers.map((inf) => (
                      <tr key={inf.id} className="hover:bg-slate-900/5 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex justify-center">
                            <div className="relative group/avatar w-14 h-14">
                              <div className="absolute -inset-1.5 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-full blur-[6px] opacity-0 group-hover/avatar:opacity-30 transition-opacity"></div>
                              {inf.profile_pic && !imgErrors[inf.id] ? (
                                <img 
                                  src={inf.profile_pic.startsWith('data:') 
                                    ? inf.profile_pic 
                                    : `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(inf.profile_pic)}`
                                  }
                                  className="relative w-14 h-14 rounded-full border-2 border-white/20 shadow-2xl object-cover"
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  onError={() => {
                                    setImgErrors(prev => ({ ...prev, [inf.id]: true }));
                                  }}
                                />
                              ) : (
                                <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white/20 flex items-center justify-center text-white shadow-xl shadow-indigo-500/10">
                                  <svg className="w-7 h-7 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <div className="font-black text-primary text-sm tracking-tighter group-hover:text-indigo-400 transition-colors">@{inf.username}</div>
                          <div className="text-[10px] text-secondary font-medium italic mt-0.5 opacity-60 transition-colors">
                            Last Signal: {inf.last_updated_at ? new Date(inf.last_updated_at).toLocaleDateString() : 'Historical'}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center font-black text-primary text-sm transition-colors">{inf.followers_count?.toLocaleString() || '0'}</td>
                        <td className="px-8 py-5 text-center font-black text-primary text-sm transition-colors">{inf.following_count?.toLocaleString() || '0'}</td>
                        <td className="px-8 py-5">
                          <div className="flex items-center justify-center gap-2">

                            <button 
                              onClick={() => navigate(`/profile/${inf.id}`)}
                              className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-indigo-500 hover:text-white transition-all border border-slate-200 dark:border-white/10 group/btn shadow-sm"
                            >
                              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-32 text-center glass rounded-[4rem] border-dashed border-2 border-slate-200 dark:border-white/5 transition-colors">
              <div className="text-7xl mb-8 opacity-10">👤</div>
              <p className="text-secondary font-bold uppercase tracking-[0.4em] text-[11px] italic transition-colors">No Synced Profiles Found</p>
              <p className="text-primary font-black uppercase tracking-widest text-[8px] mt-6 italic opacity-70 transition-colors">Start by searching for a creator on the Hub to build your personal archive.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

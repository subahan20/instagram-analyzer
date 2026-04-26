import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import CategorySelector from './CategorySelector';
import SubcategorySelector from './SubcategorySelector';
import Navbar from './Navbar';

export default function Dashboard({ user, theme, setTheme }) {
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(null);
  const [subcategory, setSubcategory] = useState({ name: 'All Subcategories', id: null });
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchInfluencers() {
      setLoading(true);
      try {
        let query = supabase
          .from('influencers')
          .select('*')
          .order('last_updated_at', { ascending: false });

        if (category?.id) {
          query = query.eq('category_id', category.id);
        }
        
        if (subcategory?.id) {
          query = query.eq('subcategory_id', subcategory.id);
        }

        const { data, error } = await query;
        if (error) throw error;
        setInfluencers(data || []);
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
  }, [category, subcategory]);

  return (
    <div className="min-h-screen bg-canvas transition-colors duration-500">
      <Navbar user={user} theme={theme} setTheme={setTheme} />
      
      <div className="max-w-[1400px] mx-auto pt-24 sm:pt-32 px-4 sm:px-8 pb-20 space-y-8 sm:space-y-12">
        {/* Header Section: Responsive Column on Mobile, Row on Desktop */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-end gap-6 sm:gap-8 border-b border-slate-200 dark:border-white/5 pb-8">
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
                            <div className="relative group-hover:scale-110 transition-transform duration-500 w-12 h-12">
                              <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-full blur-[4px] opacity-0 group-hover:opacity-20 transition-opacity"></div>
                              {inf.profile_pic ? (
                                <img 
                                  src={`https://images.weserv.nl/?url=${encodeURIComponent(inf.profile_pic)}&w=80&h=80&fit=cover&mask=circle`}
                                  className="relative w-12 h-12 rounded-full border border-white/10 shadow-lg object-cover"
                                  alt={inf.username}
                                />
                              ) : (
                                <div className="relative w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xl font-bold text-secondary transition-colors">
                                  {inf.username?.[0]?.toUpperCase()}
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
                        <td className="px-8 py-5 text-center">
                          <span className="text-sm font-black text-primary tracking-widest transition-colors">{(inf.followers_count || 0).toLocaleString()}</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="text-sm font-black text-secondary tracking-widest transition-colors">{(inf.following_count || 0).toLocaleString()}</span>
                        </td>
                        <td className="px-8 py-5 flex justify-center">
                          <button 
                            onClick={() => navigate(`/profile/${inf.id}`)}
                            className="w-10 h-10 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl flex items-center justify-center text-secondary hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all shadow-xl active:scale-90 group/btn cursor-pointer"
                          >
                            <svg className="w-5 h-5 group-hover/btn:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </button>
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

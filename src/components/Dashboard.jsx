import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import CategorySelector from './CategorySelector';
import SubcategorySelector from './SubcategorySelector';

export default function Dashboard({ user, theme, setTheme }) {
  const [url, setUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [category, setCategory] = useState({ name: 'All Categories', id: null });
  const [subcategory, setSubcategory] = useState({ name: 'All Subcategories', id: null });

  const navigate = useNavigate();

  // Fetch unique influencers that have been synced (Historical Log)
  const fetchSyncHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('influencers')
        .select('*')
        .eq('user_id', user.id);

      if (category?.id) {
        query = query.eq('category_id', category.id);
      }
      if (subcategory?.id) {
        query = query.eq('subcategory_id', subcategory.id);
      }

      const { data, error } = await query.order('last_updated_at', { ascending: false });

      if (error) throw error;
      setInfluencers(data || []);
    } catch (err) {
      console.error('Fetch history failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncHistory();
  }, [user, category?.id, subcategory?.id]);

  const handleSync = async (e) => {
    e.preventDefault();
    if (!url || syncing) return;

    setSyncing(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('post', {
        body: { 
          action: 'sync_reels',
          url: url.trim(), 
          userId: user.id 
        }
      });

      if (error || !data.success) throw new Error(error?.message || data?.error || 'Sync failed');

      setMessage({ type: 'success', text: data.message || 'Neural Extraction Successful' });
      setUrl('');
      fetchSyncHistory(); 
    } catch (err) {
      console.error('Sync failed:', err);
      setMessage({ type: 'error', text: err.message || 'Signal Interrupted' });
    } finally {
      setSyncing(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto pt-10 px-4 pb-20 space-y-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link 
            to="/" 
            className="group flex items-center gap-2 px-4 py-2 glass rounded-xl hover:border-indigo-500/30 transition-all text-secondary hover:text-primary whitespace-nowrap"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Hub</span>
          </Link>
        </div>

        {/* Neural Filtering Cluster */}
        <div className="flex items-center gap-6 flex-1 ml-12 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
          <div className="flex items-center gap-3">
            <CategorySelector 
              selectedCategory={category}
              onCategoryChange={(cat) => {
                setCategory(cat);
                setSubcategory({ name: 'All Subcategories', id: null });
              }}
              showAllOption={true}
              showOthers={false}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer glass hover:border-indigo-500/30 transition-all appearance-none flex items-center justify-between gap-3 text-secondary"
            />
            
            {category?.id && (
              <SubcategorySelector 
                categoryId={category.id}
                selectedSubcategory={subcategory}
                onSubcategoryChange={setSubcategory}
                showAllOption={true}
                showOthers={false}
                className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer glass hover:border-indigo-500/30 transition-all appearance-none flex items-center justify-between gap-3 text-secondary`}
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <h1 className="text-3xl font-black text-primary tracking-tighter uppercase italic transition-colors">Synced Profiles</h1>
            <p className="text-[9px] text-secondary uppercase font-black tracking-[0.4em] transition-colors">Your Archive of Discovered Creators</p>
          </div>
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
          <div className="glass rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 transition-colors">
                    <th className="px-8 py-6 text-secondary font-black text-[10px] uppercase tracking-[0.2em] transition-colors">Profile</th>
                    <th className="px-8 py-6 text-secondary font-black text-[10px] uppercase tracking-[0.2em] transition-colors">Identity</th>
                    <th className="px-8 py-6 text-secondary font-black text-[10px] uppercase tracking-[0.2em] text-center transition-colors">Followers</th>
                    <th className="px-8 py-6 text-secondary font-black text-[10px] uppercase tracking-[0.2em] text-center transition-colors">Following</th>
                    <th className="px-8 py-6 text-secondary font-black text-[10px] uppercase tracking-[0.2em] text-right transition-colors">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/2 transition-colors">
                  {influencers.map((inf) => (
                    <tr key={inf.id} className="hover:bg-slate-900/5 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-8 py-5">
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
                      </td>
                      <td className="px-8 py-5">
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
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => navigate(`/profile/${inf.id}`)}
                          className="w-10 h-10 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl flex items-center justify-center text-secondary hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all shadow-xl active:scale-90 group/btn"
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
  );
}

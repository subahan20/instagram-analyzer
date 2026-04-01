import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Dashboard({ user }) {
  const [url, setUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const navigate = useNavigate();

  // Fetch unique influencers that have been synced (Historical Log)
  const fetchSyncHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch all influencers (optionally filtered by those who have reels or specific metadata)
      // Since this is a "Sync History", we show the creators that exist in our intelligence database.
      const { data, error } = await supabase
        .from('influencers')
        .select('*')
        .eq('user_id', user.id)
        .order('last_updated_at', { ascending: false });

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
  }, [user]);

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
        <Link 
          to="/" 
          className="group flex items-center gap-2 px-4 py-2 glass rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all text-slate-400 hover:text-white"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest">Back to Hub</span>
        </Link>
        <div className="text-right">
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Synced Profiles</h1>
          <p className="text-[9px] text-slate-500 uppercase font-black tracking-[0.4em]">Your Archive of Discovered Creators</p>
        </div>
      </div>

      {/* Results Section (Influencer Table) */}
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] animate-pulse">Scanning Neural Network...</p>
          </div>
        ) : influencers.length > 0 ? (
          <div className="glass rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/5">
                    <th className="px-8 py-6 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">Profile</th>
                    <th className="px-8 py-6 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">Identity</th>
                    <th className="px-8 py-6 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] text-center">Followers</th>
                    <th className="px-8 py-6 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] text-center">Following</th>
                    <th className="px-8 py-6 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/2">
                  {influencers.map((inf) => (
                    <tr key={inf.id} className="hover:bg-white/2 transition-colors group">
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
                            <div className="relative w-12 h-12 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-xl font-bold text-slate-700">
                              {inf.username?.[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="font-black text-white text-sm tracking-tighter group-hover:text-indigo-400 transition-colors">@{inf.username}</div>
                        <div className="text-[10px] text-slate-500 font-medium italic mt-0.5 opacity-60">
                          Last Signal: {inf.last_updated_at ? new Date(inf.last_updated_at).toLocaleDateString() : 'Historical'}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="text-sm font-black text-white tracking-widest">{(inf.followers_count || 0).toLocaleString()}</span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="text-sm font-black text-slate-400 tracking-widest">{(inf.following_count || 0).toLocaleString()}</span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => navigate(`/profile/${inf.id}`)}
                          className="w-10 h-10 bg-slate-900 border border-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-slate-800 transition-all shadow-xl active:scale-90 group/btn"
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
          <div className="py-32 text-center glass rounded-[4rem] border-dashed border-2 border-white/5">
             <div className="text-7xl mb-8 opacity-10">👤</div>
             <p className="text-slate-600 font-bold uppercase tracking-[0.4em] text-[11px] italic">No Synced Profiles Found</p>
             <p className="text-slate-800 font-black uppercase tracking-widest text-[8px] mt-6 italic">Start by searching for a creator on the Hub to build your personal archive.</p>
          </div>
        )}
      </div>
    </div>
  );
}

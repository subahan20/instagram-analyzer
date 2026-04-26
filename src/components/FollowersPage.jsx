import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import scraperService from '../services/scraperService'
import Navbar from './Navbar'

function FollowersPage({ user, theme, setTheme }) {
  const { username } = useParams()
  const navigate = useNavigate()
  const [influencer, setInfluencer] = useState(null)
  const [followers, setFollowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchData = async (isFirstLoad = false, forceSync = false) => {
    if (isFirstLoad) setLoading(true);
    setError(null);
    try {
      const { data: response, error: apiError } = await supabase.functions.invoke('post', {
        body: { action: 'get_profile', influencerId: username }
      });
      if (apiError) throw apiError;
      
      const influencerData = response.data.influencer;
      const cachedFollowers = response.data.followers_list || [];
      
      setInfluencer(influencerData);
      setFollowers(cachedFollowers);

      const shouldSync = forceSync || (cachedFollowers.length === 0 && !syncing);
      if (influencerData && shouldSync && !syncing) {
        setSyncing(true);
        try {
          await scraperService.syncAudience(influencerData.id, `https://www.instagram.com/${username}/`);
        } catch (syncErr) {
          console.error('[FollowersPage] Sync API Error:', syncErr.message);
          setError(`Sync Error: ${syncErr.message}`);
        } finally {
          setSyncing(false);
          if (forceSync) fetchData(false, false);
        }
      }
    } catch (err) {
      console.error('[FollowersPage] Fetch Error:', err)
      setError('Failed to load audience intelligence archive.')
    } finally {
      if (isFirstLoad) setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(true);
    const pollInterval = setInterval(() => { fetchData(false); }, 10000);
    return () => clearInterval(pollInterval);
  }, [username]);

  const filteredFollowers = followers.filter(f => 
    f.follower_username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.follower_name && f.follower_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleFollowerClick = async (follower) => {
    setSyncing(true);
    try {
      const followerUrl = `https://www.instagram.com/${follower.follower_username}/`;
      await scraperService.initialSync(followerUrl);
      navigate(`/profile/${follower.follower_username}`);
    } catch (err) {
      console.error('Follower drill-down failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !syncing) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center transition-colors duration-500">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="mt-8 text-indigo-400 font-black uppercase tracking-[0.3em] text-xs transition-colors">Accessing Social Graph...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas text-primary selection:bg-indigo-500/30 transition-colors duration-500">
      <Navbar user={user} theme={theme} setTheme={setTheme} />

      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-500/5 blur-[120px] rounded-full opacity-50 transition-colors"></div>
      </div>

      <main className="relative z-10 max-w-2xl mx-auto pt-28 sm:pt-36 px-4 pb-12 flex flex-col min-h-screen">
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2.5 glass border border-white/5 rounded-xl text-secondary hover:text-indigo-400 hover:border-indigo-500/30 transition-all active:scale-90 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-indigo-500/20 ring-4 ring-indigo-500/5 overflow-hidden">
                {influencer?.profile_pic ? (
                  <img src={`https://images.weserv.nl/?url=${encodeURIComponent(influencer.profile_pic)}&w=40&h=40&fit=cover&mask=circle`} className="w-full h-full object-cover" alt={username} />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xs font-bold uppercase">{username[0]}</div>
                )}
              </div>
              <div>
                <h1 className="font-black text-sm tracking-tight text-primary leading-none transition-colors">@{username}</h1>
                <p className="text-[9px] text-secondary font-black uppercase tracking-widest mt-1">Social Intelligence</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-canvas dark:bg-[#1e1e1e] rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-2xl flex flex-col overflow-hidden transition-all h-[70vh] sm:h-[75vh]">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-black/20">
            <h2 className="text-sm font-bold tracking-tight text-primary">Followers Intelligence</h2>
            <button onClick={() => fetchData(false, true)} disabled={syncing} className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${syncing ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 animate-pulse' : 'bg-indigo-500/5 border-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white'}`}>
              {syncing ? 'Scanning...' : 'Refresh API'}
            </button>
          </div>

          <div className="px-4 py-3 bg-slate-100/50 dark:bg-[#1e1e1e] border-b border-slate-200 dark:border-white/5">
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search identifiers..." className="w-full bg-slate-200/50 dark:bg-[#262626] border border-slate-200 dark:border-none text-primary dark:text-white text-sm pl-11 pr-4 py-3 rounded-xl outline-none focus:ring-1 ring-indigo-500/30 placeholder:text-slate-500 transition-all font-medium" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {syncing && followers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 translate-y-10">
                <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <p className="text-indigo-400 font-bold uppercase tracking-widest text-[10px] mt-4">Deep Scan Active</p>
              </div>
            ) : filteredFollowers.length > 0 ? (
              <div className="py-2">
                {filteredFollowers.map((follower) => (
                  <div key={follower.id} onClick={() => handleFollowerClick(follower)} className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-all cursor-pointer group active:scale-[0.98]">
                    <div className="flex items-center gap-4">
                      {follower.follower_profile_pic ? (
                        <img src={`https://images.weserv.nl/?url=${encodeURIComponent(follower.follower_profile_pic)}&w=80&h=80&fit=cover&mask=circle`} className="w-12 h-12 rounded-full border border-white/5" alt={follower.follower_username} />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-sm font-bold text-secondary uppercase">{follower.follower_username[0]}</div>
                      )}
                      <div>
                        <div className="font-bold text-sm text-primary group-hover:text-indigo-400 transition-colors tracking-tight">@{follower.follower_username}</div>
                        <div className="text-secondary text-[11px] font-medium opacity-60">{follower.follower_name || 'Anonymous Creator'}</div>
                      </div>
                    </div>
                    <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-5 py-2 rounded-lg transition-all active:scale-95 shadow-lg shadow-indigo-600/10 cursor-pointer">Follow</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-20 text-center text-secondary text-[11px] font-bold uppercase tracking-widest italic opacity-40">No network nodes found</div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default FollowersPage;

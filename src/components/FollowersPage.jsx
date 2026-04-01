import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import scraperService from '../services/scraperService'

function FollowersPage() {
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
      console.log(`[FollowersPage] Fetching intelligence for: ${username}...`);
      
      const { data: response, error: apiError } = await supabase.functions.invoke('post', {
        body: { 
          action: 'get_profile',
          influencerId: username
        }
      });

      if (apiError) throw apiError;
      
      const influencerData = response.data.influencer;
      const cachedFollowers = response.data.followers_list || [];
      
      console.log(`[FollowersPage] Profile found: ${influencerData?.username}. Cached followers: ${cachedFollowers.length}`);
      
      setInfluencer(influencerData);
      setFollowers(cachedFollowers);

      // 2. AUTOMATIC OR FORCED SYNC
      const shouldSync = forceSync || (cachedFollowers.length === 0 && !syncing);
      
      if (influencerData && shouldSync && !syncing) {
        console.log(`[FollowersPage] Sync Triggered. Force: ${forceSync}. calling Puppeteer API...`);
        setSyncing(true);
        try {
          const syncRes = await scraperService.syncAudience(influencerData.id, `https://www.instagram.com/${username}/`);
          console.log('[FollowersPage] API Success:', syncRes);
        } catch (syncErr) {
          console.error('[FollowersPage] Sync API Error:', syncErr.message);
          setError(`Sync Error: ${syncErr.message}`);
        } finally {
          setSyncing(false);
          // Refresh list one last time after sync completes
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

    // Polling logic: Check for new data every 10s while syncing or if empty
    const pollInterval = setInterval(() => {
      fetchData(false);
    }, 10000);

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
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="mt-8 text-indigo-400 font-black uppercase tracking-[0.3em] text-xs">Accessing Social Graph...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Background Glow */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-500/5 blur-[120px] rounded-full"></div>
      </div>

      {/* Modern Compact Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            {influencer?.profile_pic ? (
              <img 
                src={`https://images.weserv.nl/?url=${encodeURIComponent(influencer.profile_pic)}&w=40&h=40&fit=cover&mask=circle`} 
                className="w-9 h-9 rounded-full border border-white/10 ring-2 ring-indigo-500/20" 
                alt={username} 
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold ring-2 ring-indigo-500/20">@{username[0].toUpperCase()}</div>
            )}
            <div>
              <h1 className="font-bold text-sm tracking-tight leading-none group flex items-center gap-1.5">
                {username}
                <svg className="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                </svg>
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Intelligence Archive</p>
            </div>
          </div>
        </div>
        <Link to="/" className="px-4 py-2 glass rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-400 transition-all">
          Exit
        </Link>
      </header>

      <main className="relative z-10 max-w-xl mx-auto py-12 px-4 h-full">
        {/* Instagram-Style Modal Container */}
        <div className="bg-[#1e1e1e] rounded-[1.5rem] border border-white/5 shadow-2xl flex flex-col max-h-[85vh]">
          {/* Modal Header with Search */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between relative bg-black/20">
            <h2 className="text-sm font-bold tracking-tight">Followers Intelligence</h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => fetchData(false, true)}
                disabled={syncing}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${
                  syncing 
                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 animate-pulse' 
                  : 'bg-indigo-500/5 border-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white hover:border-indigo-500'
                }`}
              >
                {syncing ? 'Scanning...' : 'Refresh API'}
              </button>
              <button 
                onClick={() => navigate(-1)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-4 py-3 bg-[#1e1e1e]">
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search"
                className="w-full bg-[#262626] border-none text-white text-sm pl-11 pr-4 py-2 rounded-lg outline-none focus:ring-1 ring-white/10 placeholder:text-slate-600 transition-all"
              />
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[400px]">
            {syncing && followers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 space-y-4">
                <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="text-center">
                  <p className="text-indigo-400 font-bold uppercase tracking-widest text-[10px]">Deep Scan in Progress</p>
                  <p className="text-slate-600 text-[10px] mt-1 font-medium italic">Establishing neural graph connection...</p>
                </div>
              </div>
            ) : followers.length > 0 ? (
              <div className="py-2">
                {filteredFollowers.map((follower) => (
                  <div 
                    key={follower.id}
                    onClick={() => handleFollowerClick(follower)}
                    className="flex items-center justify-between px-6 py-3 hover:bg-white/5 transition-all cursor-pointer group active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {follower.follower_profile_pic ? (
                          <img 
                            src={`https://images.weserv.nl/?url=${encodeURIComponent(follower.follower_profile_pic)}&w=80&h=80&fit=cover&mask=circle`}
                            className="w-11 h-11 rounded-full border border-white/5"
                            alt={follower.follower_username}
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-sm font-bold text-slate-700 uppercase">
                            {follower.follower_username[0]}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-sm text-white truncate group-hover:text-indigo-400 transition-colors tracking-tight">
                            {follower.follower_username}
                          </span>
                        </div>
                        <div className="text-slate-500 text-xs truncate leading-tight">{follower.follower_name}</div>
                      </div>
                    </div>
                    <div>
                      <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-5 py-1.5 rounded-lg transition-all active:scale-95 shadow-lg shadow-indigo-600/10">
                        Follow
                      </button>
                    </div>
                  </div>
                ))}
                
                {filteredFollowers.length === 0 && searchTerm && (
                  <div className="p-12 text-center text-slate-500 text-xs font-medium">
                    No results found for "{searchTerm}"
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-600 text-[10px] font-medium italic">
                No verified network nodes identified.
              </div>
            )}
          </div>
        </div>

        {/* Global Stats Footer */}
        <div className="mt-8 flex items-center justify-between px-8 text-center bg-white/5 py-4 rounded-2xl border border-white/5">
          <div>
            <div className="text-xl font-black text-white">{influencer?.followers_count?.toLocaleString() || '0'}</div>
            <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Global Reach</div>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div>
            <div className="text-xl font-black text-emerald-400">98%</div>
            <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Authenticity</div>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div>
            <div className="text-xl font-black text-indigo-400">{followers.length}</div>
            <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Archived Nodes</div>
          </div>
        </div>
      </main>

      {/* Profile Detail Drilldown Loading */}
      {syncing && followers.length > 0 && (
        <div className="fixed bottom-8 right-8 z-[100] flex items-center gap-4 bg-[#1e1e1e] p-4 rounded-2xl border border-indigo-500/30 shadow-2xl animate-in slide-in-from-right-8 duration-500">
           <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
           <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Expanding Neural Node...</div>
        </div>
      )}
    </div>
  )
}

export default FollowersPage;

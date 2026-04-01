import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function FollowersModal({ isOpen, onClose, username }) {
  const [state, setState] = useState({
    followers: [],
    showFollowersModal: isOpen,
    loading: false,
    error: null
  });

  useEffect(() => {
    if (isOpen && username) {
      fetchFollowers();
    }
  }, [isOpen, username]);

  const fetchFollowers = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // Step 1: Trigger On-Demand Extraction via Local Puppeteer Service
      const response = await fetch('http://localhost:4000/api/get-followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Network sync failed:', response.status, errorText);
        // Fallback to searching Supabase directly if automation node is offline
      } else {
        const syncData = await response.json();
        if (!syncData?.success) {
          console.warn('Puppeteer sync error:', syncData?.error);
        }
      }

      // Step 2: Fetch from Supabase
      // Query: select follower_username, follower_profile_pic where username = logged-in user
      const { data, error } = await supabase
        .from('followers')
        .select('follower_username, follower_profile_pic')
        .eq('username', username);

      if (error) throw error;
      
      setState(prev => ({ 
        ...prev, 
        followers: data || [], 
        loading: false 
      }));
    } catch (err) {
      console.error('Error fetching followers:', err);
      // Check if we have a detailed error from the server
      let displayError = 'Failed to synchronize audience data';
      if (err.message && err.message.length > 5) {
        displayError = err.message;
      }
      
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: displayError 
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      ></div>

      {/* Centered Popup with Rounded Corners */}
      <div className="relative w-full max-w-sm glass rounded-[2.5rem] border border-white/5 overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl bg-slate-900/90">
        <div className="p-8 border-b border-white/5 text-center">
          <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Followers Network</h3>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Node: @{username}</p>
        </div>

        {/* Scrollable list */}
        <div className="max-h-[420px] overflow-y-auto custom-scrollbar p-6">
          {state.loading ? (
            <div className="py-20 flex flex-col items-center gap-4">
               <div className="w-8 h-8 border-2 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
               <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest animate-pulse">Syncing...</span>
            </div>
          ) : state.error ? (
            <div className="py-20 text-center text-rose-500 text-[10px] font-black uppercase tracking-widest">
               {state.error}
            </div>
          ) : state.followers.length > 0 ? (
            <div className="space-y-4">
              {state.followers.map((follower, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-4 group hover:bg-white/5 p-2 rounded-2xl transition-all"
                >
                  {/* Profile Picture (Circle) */}
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-slate-800 flex-shrink-0">
                    {follower.follower_profile_pic ? (
                      <img 
                        src={`https://images.weserv.nl/?url=${encodeURIComponent(follower.follower_profile_pic)}&w=80&h=80&fit=cover&mask=circle`} 
                        alt={follower.follower_username}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-600">
                        {follower.follower_username?.[0].toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Username Only */}
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-white tracking-tight truncate">
                      @{follower.follower_username}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center space-y-4">
               <div className="text-4xl opacity-10">👤</div>
               <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">No followers found</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/5 bg-slate-900/50">
           <button 
             onClick={onClose}
             className="w-full py-3 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl transition-all"
           >
             Close Terminal
           </button>
        </div>
      </div>
    </div>
  );
}

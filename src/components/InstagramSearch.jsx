import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../supabase';
import scraperService from '../services/scraperService';
import CategorySelector from './CategorySelector';
import SubcategorySelector from './SubcategorySelector';
import CreatorList from './CreatorList';
import ThemeToggle from './ThemeToggle';

export default function InstagramSearch({ user, theme, setTheme }) {
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState(null);
  const [subcategory, setSubcategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [syncData, setSyncData] = useState(null);
  const [syncStatus, setSyncStatus] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!url || !url.trim()) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    if (!category?.id) {
      setError('Please select a category first.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const trimmedUrl = url.trim();
      const extractedUsername = scraperService.extractUsername(trimmedUrl);
      
      if (!extractedUsername) {
        toast.error('Could not extract a valid Instagram username from the link');
        setLoading(false);
        return;
      }

      // STAGE 0: Duplicate Check (User Isolation)
      const { data: existing } = await supabase
        .from('influencers')
        .select('id')
        .eq('username', extractedUsername)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        toast.warning('Duplicate profile detected: This profile is already in your dashboard.');
        setLoading(false);
        return;
      }

      const payload = { 
        url: trimmedUrl, 
        categoryId: category.id, 
        subcategoryId: subcategory?.id, 
        userId: user.id 
      };
      
      // STAGE 1: Check Update (Lightweight)
      const checkRes = await scraperService.checkUpdate(trimmedUrl, { userId: user.id });
      
      if (!checkRes.hasChanged) {
        setMessage('Network check complete: No updates found on Instagram.');
        setSuccess(true);
        // DO NOT update state with same data to avoid re-renders
        return;
      }

      // STAGE 2: Scrape Full / Smart Refresh (ONLY IF CHANGED)
      // Switch from scrapeFull to refreshData to call refresh-instagram-data function in sequence
      const fullRes = await scraperService.refreshData(trimmedUrl, {
        categoryId: category.id,
        subcategoryId: subcategory?.id,
        userId: user.id
      });

      if (fullRes.success && fullRes.data) {
        setSyncStatus('Finalizing Intelligence...');
        
        const influencerId = fullRes.data.id;
        const targetUsername = fullRes.data.username;
        const targetUrl = `https://www.instagram.com/${targetUsername}/`;

        // STAGE 3: AUTOMATIC FOLLOWERS SYNC (Mock)
        try {
          if (influencerId) {
            await scraperService.syncAudience(influencerId, targetUrl);
          }
        } catch (followerErr) {
          console.warn('[InstagramSearch] Audience extraction skipped/failed:', followerErr.message);
        }

        setSuccess(true);
        setMessage('Complete Intelligence updated successfully ✨');
        setSyncData(fullRes.data);
        setUrl('');
        setRefreshKey(prev => prev + 1);
        
        // Redirect to profile page after sync for better UX
        if (influencerId) {
          setTimeout(() => navigate(`/profile/${influencerId}`), 1000);
        }
      } else {
        throw new Error(fullRes.error || 'Failed to sync profile. Data was unavailable.');
      }
    } catch (err) {
      console.error('[InstagramSearch] Sync workflow failed:', err);
      setError(err.message || 'Synchronization failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen overflow-hidden bg-canvas text-primary selection:bg-indigo-500/30 transition-colors duration-500">
      {/* Premium AI SaaS Aesthetic Background - Using React state for bulletproof theme toggling */}
      {theme === 'dark' && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 scale-105 animate-in fade-in"
          style={{ 
            backgroundImage: `url('/home-background.png')` 
          }}
        >
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[1px] transition-colors duration-500"></div>
        </div>
      )}

      <div className="relative z-20 h-full flex flex-col">
        {/* Compact Navigation */}
        <nav className="flex justify-between items-center px-6 sm:px-12 py-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg 
                className="w-5 h-5 text-white" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold tracking-tight text-primary leading-none transition-colors">Instagram <span className="text-gradient">Analyzer</span></h1>
              <p className="text-[10px] text-secondary font-bold tracking-widest uppercase opacity-70 mt-0.5 transition-colors">Premium AI Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              to="/dashboard" 
              className="group flex items-center gap-2 px-5 py-2.5 glass rounded-xl hover:border-indigo-500/50 transition-all shadow-xl"
            >
              <span className="text-secondary group-hover:text-primary text-xs font-bold tracking-wider uppercase transition-colors">View Sync History</span>
              <span className="text-indigo-400 group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
            
            <ThemeToggle theme={theme} setTheme={setTheme} />
            
            {user ? (
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  // Reset all inputs and state upon sign out
                  setUrl('');
                  setCategory(null);
                  setSubcategory(null);
                  setError('');
                  setSuccess(false);
                  setMessage('');
                  setSyncData(null);
                  setSyncStatus('');
                }}
                className="group flex items-center justify-center w-11 h-11 glass rounded-xl border border-white/5 hover:border-rose-500/50 hover:bg-rose-500/5 transition-all shadow-xl"
                title="Terminate Session"
              >
                <svg 
                  className="w-5 h-5 text-secondary group-hover:text-rose-500 transition-colors" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                  <line x1="12" y1="2" x2="12" y2="12"></line>
                </svg>
              </button>
            ) : (
              <Link 
                to="/auth?mode=login"
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 cursor-pointer relative z-30"
              >
                Sign In
              </Link>
            )}
          </div>
        </nav>

        {/* Centered Main Experience */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-55">
          <div className="w-full max-w-4xl space-y-8 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Hero Text */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-600 dark:text-indigo-400 text-[9px] font-bold tracking-[0.2em] uppercase transition-colors">
                <span className="w-1 h-1 bg-indigo-500 rounded-full"></span>
                Next-Gen AI Analytics
              </div>
              <h2 className="text-4xl sm:text-6xl font-black tracking-tighter text-primary leading-[1.05] transition-colors">
                Instagram <span className="text-gradient">Analyzer</span>
              </h2>
              <p className="max-w-xl mx-auto text-secondary text-xs sm:text-sm font-bold tracking-wide leading-relaxed opacity-80 dark:opacity-70 transition-colors">
                Uncover the viral potential of any creator. Track live performance and find the top 1% of content.
              </p>
            </div>

            {/* High-End Search Interface (Single dynamic logic) */}
            <div className="bg-canvas/40 dark:bg-canvas/10 backdrop-blur-xl rounded-[2rem] p-3 sm:p-1.5 border border-slate-200 dark:border-transparent relative group max-w-2xl mx-auto w-full transition-all">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-indigo-500/10 rounded-[2.1rem] blur-xl opacity-0 group-focus-within:opacity-100 transition duration-700"></div>
              
              <div className="relative flex flex-col sm:flex-row items-stretch gap-2.5 p-3 sm:p-1">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Enter Instagram Profile or URL..."
                    className={`w-full bg-transparent border-none text-primary px-6 py-4 rounded-[1.5rem] outline-none text-base font-bold transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-4 focus:ring-indigo-500/10`}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !url.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:opacity-50 text-white font-black text-[10px] tracking-[0.2em] uppercase px-12 py-5 sm:py-0 rounded-[1.4rem] transition-all active:scale-[0.98]"
                >
                  {loading ? 'Starting...' : 'Sync Now'}
                </button>
              </div>
            </div>

            {/* Compact Categorization Row */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-2xl mx-auto w-full transition-opacity">
              <div className="w-full sm:w-1/2 group">
                <CategorySelector 
                  selectedCategory={category}
                  onCategoryChange={(cat) => {
                    setCategory(cat);
                    setSubcategory(null);
                  }}
                  showOthers
                  className="w-full bg-transparent border border-slate-200 dark:border-transparent hover:bg-slate-500/5 dark:hover:bg-white/5 text-primary px-6 py-3.5 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] outline-none cursor-pointer transition-all appearance-none flex items-center justify-center relative"
                />
              </div>
              <div className="w-full sm:w-1/2 group">
                <SubcategorySelector 
                  categoryId={category?.id}
                  selectedSubcategory={subcategory}
                  onSubcategoryChange={setSubcategory}
                  className="w-full bg-transparent border border-slate-200 dark:border-transparent hover:bg-slate-500/5 dark:hover:bg-white/5 text-primary px-6 py-3.5 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] outline-none cursor-pointer transition-all appearance-none flex items-center justify-center relative"
                />
              </div>
            </div>

            {error && (
              <div className="max-w-md mx-auto p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold uppercase tracking-widest animate-in fade-in zoom-in-95">
                {error}
              </div>
            )}

            {success && message && (
              <div className="max-w-md mx-auto p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold uppercase tracking-widest animate-in fade-in zoom-in-95">
                {message}
              </div>
            )}
          </div>
        </main>
      </div>

      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/80 dark:bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300 transition-colors">
          <div className="relative flex flex-col items-center gap-8">
            <div className="w-24 h-24 relative">
              <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-4 bg-indigo-500/10 rounded-full flex items-center justify-center">
                <svg 
                  className="w-10 h-10 text-indigo-400 animate-pulse" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </div>
            </div>
            <div className="text-center space-y-3">
              <div className="text-indigo-400 font-black text-2xl tracking-[0.4em] uppercase">
                {syncStatus || 'Processing'}
              </div>
              <p className="text-slate-500 text-sm font-bold tracking-widest uppercase opacity-60">
                {syncStatus ? 'This may take up to 60 seconds...' : 'Gathering Intelligence...'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

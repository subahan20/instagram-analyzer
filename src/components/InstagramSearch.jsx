import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../supabase';
import scraperService from '../services/scraperService';
import CategorySelector from './CategorySelector';
import SubcategorySelector from './SubcategorySelector';
import CreatorList from './CreatorList';
import ThemeToggle from './ThemeToggle';

import Navbar from './Navbar';

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

  // Auto-sync handle for dashboard shortcut
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    const syncParam = params.get('sync');
    if (urlParam) {
      setUrl(decodeURIComponent(urlParam));
      if (syncParam === 'true') {
        // Short delay to ensure component is ready
        setTimeout(() => {
          const btn = document.querySelector('button[disabled="false"]') || document.querySelector('button:not([disabled])');
          if (btn) btn.click();
        }, 500);
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setLoading(true);
    setError('');
    setSuccess(false);
    setMessage('');
    setSyncStatus('Connecting...');

    try {
      // Validate URL/username
      const username = scraperService.extractUsername(trimmedUrl);
      if (!username) {
        setError('Invalid Instagram URL or username. Please try again.');
        setLoading(false);
        setSyncStatus('');
        return;
      }

      setSyncStatus('Syncing Profile...');

      const result = await scraperService.scrapeFull(trimmedUrl, {
        userId: user?.id,
        categoryId: category?.id || null,
        subcategoryId: subcategory?.id || null,
        force: true,
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Sync failed. Please try again.');
      }

      setSyncStatus('Done!');
      setSuccess(true);
      setMessage('Profile synced successfully!');
      toast.success(`@${username} synced successfully!`);
      setRefreshKey(k => k + 1);

      // Navigate to profile if we have an id
      const profileId = result?.data?.id;
      if (profileId) {
        setTimeout(() => navigate(`/profile/${profileId}`), 800);
      }
    } catch (err) {
      console.error('[Sync Error]', err);
      const msg = err?.message || 'An unexpected error occurred.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setSyncStatus('');
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-canvas text-primary selection:bg-indigo-500/30 transition-colors duration-500">
      <Navbar user={user} theme={theme} setTheme={setTheme} />

      {/* Premium AI SaaS Aesthetic Background */}
      {theme === 'dark' && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 scale-105 animate-in fade-in"
          style={{ backgroundImage: `url('/home-background.png')` }}
        >
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[1px]"></div>
        </div>
      )}

      <div className="relative z-20 min-h-screen flex flex-col pt-12 sm:pt-20 pb-12">
        {/* Repositioned Main Experience (Moved towards Top) */}
        <main className="flex-1 flex flex-col items-center justify-start pt-6 sm:pt-12 px-4 sm:px-6">
          <div className="w-full max-w-5xl space-y-8 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Hero Text */}
            <div className="space-y-2">
              <div className="py-2 overflow-visible">
                <h1 className="text-3xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight text-primary leading-tight transition-all overflow-visible whitespace-nowrap px-4">
                  Instagram <span className="text-gradient">Analyzer</span>
                </h1>
              </div>
            </div>

            {/* High-End Search Interface (Responsive Refinement) */}
            <div className="max-w-2xl mx-auto w-full space-y-4">
              <div className="bg-white dark:bg-canvas/10 backdrop-blur-xl rounded-[2rem] p-1.5 sm:p-2 border border-slate-300 dark:border-white/5 shadow-sm relative group transition-all">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-indigo-500/20 rounded-[2.1rem] blur-xl opacity-0 group-focus-within:opacity-100 transition duration-700"></div>
                
                <div className="relative flex flex-col sm:flex-row items-stretch gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="Enter Instagram Profile or URL..."
                      className="w-full bg-transparent border-none text-primary px-6 py-4 rounded-[1.5rem] outline-none text-base font-bold transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-4 focus:ring-indigo-500/10"
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !url.trim()}
                    className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-100 dark:disabled:bg-slate-800 text-white disabled:text-slate-500 dark:disabled:text-slate-400 font-black text-[11px] tracking-[0.2em] uppercase px-8 sm:px-12 py-4 sm:py-0 rounded-[1.4rem] transition-all active:scale-[0.98] cursor-pointer shadow-xl shadow-indigo-500/20 shrink-0"
                  >
                    {loading ? 'Starting...' : 'Sync Now'}
                  </button>
                </div>
              </div>

              {/* Compact Categorization Row: Forced Side-by-Side Layout */}
              <div className="flex flex-row items-center justify-center gap-2 sm:gap-4 w-full transition-all px-2">
                <div className="flex-1 min-w-0">
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
                  <div className="flex-1 min-w-0">
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

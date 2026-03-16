import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import CategorySelector from './CategorySelector';
import SubcategorySelector from './SubcategorySelector';

export default function InstagramSearch() {
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState(null);
  const [subcategory, setSubcategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (!category?.name) {
        throw new Error('Please select a category first.');
      }

      const { data, error: funcError } = await supabase.functions.invoke('post', {
        body: { 
          action: 'fetch_and_store',
          username: url.trim(),
          categoryId: category.id,
          subcategoryId: subcategory?.id || null
        }
      });

      if (funcError) {
        let errorDetail = funcError.message;
        if (funcError.response) {
          try {
            const body = await funcError.response.clone().json();
            errorDetail = body.error || body.message || JSON.stringify(body);
          } catch {
            try { errorDetail = (await funcError.response.text()).slice(0, 200); } catch { /* noop */ }
          }
        }
        throw new Error(errorDetail || 'Edge Function failed');
      }

      if (!data.success) throw new Error(data.message || 'Failed to fetch data');

      const instagramUrl = url.trim().startsWith('http')
        ? url.trim()
        : `https://www.instagram.com/${url.trim().replace('@', '')}/`;

      const n8nWebhookUrl = 'http://localhost:5678/webhook/5d95366a-c416-4136-bfa6-9ed2dfbdca3e'; 
      
      try {
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instagramUrl, influencerId: data.influencerId })
        });
        
        if (!response.ok) {
           console.warn(`webhook warned with status ${response.status}`);
        }
      } catch (webhookErr) {
        console.error("Failed to trigger webhook, but continuing:", webhookErr);
      }

      setSuccess(true);
      setUrl('');
      navigate('/dashboard');
    } catch (err) {
      console.error('Sync failed:', err);
      setError(err.message || 'An unexpected error occurred. Please check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen overflow-hidden text-slate-50 selection:bg-indigo-500/30">
      {/* Premium AI SaaS Aesthetic Background - Using home-background.png from the public directory */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 scale-105"
        style={{ 
          backgroundImage: `url('/home-background.png')` 
        }}
      >
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[1px]"></div>
      </div>

      <div className="relative z-20 h-full flex flex-col">
        {/* Compact Navigation */}
        <nav className="flex justify-between items-center px-6 sm:px-12 py-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-black text-white shadow-lg shadow-indigo-500/20">A</div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">Instagram <span className="text-gradient">Analyzer</span></h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase opacity-70 mt-0.5">Premium AI Intelligence</p>
            </div>
          </div>
          <Link 
            to="/dashboard" 
            className="group flex items-center gap-2 px-5 py-2.5 glass rounded-xl border border-white/5 hover:border-indigo-500/50 transition-all shadow-xl"
          >
            <span className="text-slate-300 group-hover:text-white text-xs font-bold tracking-wider uppercase transition-colors">View Sync History</span>
            <span className="text-indigo-400 group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </nav>

        {/* Centered Main Experience */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-12">
          <div className="w-full max-w-4xl space-y-12 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Hero Text */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-[10px] font-bold tracking-[0.2em] uppercase mb-4 animate-pulse">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                Next-Gen AI Analytics
              </div>
              <h2 className="text-5xl sm:text-7xl font-bold tracking-tight text-white leading-[1.1]">
                Instagram <span className="text-gradient">Analyzer</span>
              </h2>
              <p className="max-w-xl mx-auto text-slate-400 text-sm sm:text-base font-medium leading-relaxed opacity-80">
                Uncover the viral potential of any creator. Track live performance and find the top 1% of content.
              </p>
            </div>

            {/* High-End Search Interface - Using Div instead of Form for easier centering/control if needed, but keeping handleSubmit logic */}
            <div className="glass rounded-[2.5rem] p-4 sm:p-2 border border-white/10 shadow-2xl relative group max-w-2xl mx-auto w-full">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-indigo-500/20 rounded-[2.6rem] blur-xl opacity-0 group-focus-within:opacity-100 transition duration-700"></div>
              
              <div className="relative flex flex-col sm:flex-row items-stretch gap-3 p-4 sm:p-1">
                <div className="flex-1 relative">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Enter Instagram Profile or URL..."
                    className="w-full bg-slate-950/40 focus:bg-slate-950/60 border-none text-white pl-14 pr-6 py-5 rounded-[1.8rem] outline-none text-lg font-medium transition-all placeholder:text-slate-600 focus:ring-0"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !url.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm tracking-widest uppercase px-10 py-5 sm:py-0 rounded-3xl transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98]"
                >
                  {loading ? 'Starting Sync...' : 'Sync Now'}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 max-w-2xl mx-auto w-full group-focus-within:opacity-100 opacity-60 transition-opacity">
              <div className="w-full sm:w-1/2 text-left space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Category</label>
                <CategorySelector 
                  selectedCategory={category}
                  onCategoryChange={(cat) => {
                    setCategory(cat);
                    setSubcategory(null);
                  }}
                  showOthers={true}
                />
              </div>
              <div className="w-full sm:w-1/2 text-left space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Specialization</label>
                <SubcategorySelector 
                  categoryId={category?.id}
                  selectedSubcategory={subcategory}
                  onSubcategoryChange={setSubcategory}
                />
              </div>
            </div>

            {error && (
              <div className="max-w-md mx-auto p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold uppercase tracking-widest animate-in fade-in zoom-in-95">
                {error}
              </div>
            )}
          </div>
        </main>
      </div>

      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="relative flex flex-col items-center gap-8">
            <div className="w-24 h-24 relative">
              <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-4 bg-indigo-500/10 rounded-full flex items-center justify-center">
                <span className="text-2xl animate-pulse text-indigo-400 font-black">AI</span>
              </div>
            </div>
            <div className="text-center space-y-3">
              <div className="text-indigo-400 font-black text-2xl tracking-[0.4em] uppercase">Processing</div>
              <p className="text-slate-500 text-sm font-bold tracking-widest uppercase opacity-60">Gathering Intelligence...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

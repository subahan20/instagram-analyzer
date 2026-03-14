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
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (!category?.name) {
        throw new Error('Please select a category first.');
      }

      // Step 1: Sync profile (influencer + metrics)
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

      // Step 2: Trigger n8n Background Scraper via Webhook Instead of Edge Function
      const n8nWebhookUrl = 'http://localhost:5678/webhook/5d95366a-c416-4136-bfa6-9ed2dfbdca3e'; // REPLACE THIS WITH YOUR WEBHOOK!
      
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
    <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16 lg:py-24 xl:py-32 flex flex-col items-center justify-center min-h-[90vh]">
      {/* Search Header Section */}
      <div className="w-full max-w-5xl bg-slate-900/40 border border-slate-800 rounded-[2.5rem] sm:rounded-[4rem] p-6 sm:p-12 lg:p-16 xl:p-20 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
        {/* Premium Decorative blurs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none group-hover:bg-indigo-500/15 transition-all duration-1000"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-violet-500/10 blur-[120px] rounded-full pointer-events-none group-hover:bg-violet-500/15 transition-all duration-1000"></div>

        <header className="mb-10 sm:mb-16 text-center max-w-3xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black tracking-[0.2em] uppercase mb-6 animate-fade-in">
            <span>✨ AI Power Analytics</span>
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6 leading-[1.1]">
            Instagram <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400 bg-[length:200%_auto] animate-gradient">Analyzer</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-lg lg:text-xl font-medium leading-relaxed opacity-80">
            Discover trending content by category. Track performance metrics and curate the best reels for your industry.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 relative z-10 max-w-4xl mx-auto">
          <div className="flex flex-col gap-6 sm:gap-8">
            <div className="relative group">
              <input
                type="text"
                placeholder="Instagram Username or URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 focus:ring-8 focus:ring-indigo-500/5 text-white px-6 sm:px-10 py-5 sm:py-6 rounded-2xl sm:rounded-[2rem] outline-none transition-all placeholder:text-slate-700 font-bold text-base sm:text-lg lg:text-xl shadow-inner shadow-black/20"
              />
              <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-slate-800 font-black text-xs hidden lg:block tracking-[0.3em]">PRO SERVICE</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <div className="space-y-2">
                <label className="block text-slate-500 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] mb-2 ml-6 opacity-60">Industry Category</label>
                <CategorySelector 
                  selectedCategory={category} 
                  onCategoryChange={(cat) => {
                    setCategory(cat);
                    setSubcategory('');
                  }} 
                />
              </div>

              <div className="space-y-2">
                <label className="block text-slate-500 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] mb-2 ml-6 opacity-60">Specialization</label>
                <SubcategorySelector 
                  categoryId={category?.id} 
                  selectedSubcategory={subcategory} 
                  onSubcategoryChange={setSubcategory} 
                />
                {!category && (
                  <div className="h-[64px] sm:h-[72px] flex items-center px-8 text-slate-700 italic text-sm border border-dashed border-slate-800 rounded-2xl sm:rounded-[2rem] bg-slate-950/20">
                    Select a category first...
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !category}
              className="w-full bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-black py-4 sm:py-5 rounded-2xl sm:rounded-3xl shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none tracking-wider text-sm sm:text-base flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>SYNCING...</span>
                </>
              ) : (
                'START SYNC'
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-center font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-[2rem] text-center animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xl">✓</div>
              <h3 className="text-xl font-bold text-white">Sync Complete!</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Content has been successfully analyzed and stored. You can now view the results in the analytics dashboard.
              </p>
              <div className="mt-4 flex items-center gap-4">
                <button 
                  onClick={() => setSuccess(false)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 text-sm"
                >
                  Sync Another
                </button>
                <Link 
                  to="/dashboard"
                  className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 text-sm"
                >
                  View Dashboard →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function InstagramSearch({ categories, onAddCategory }) {
  const [url, setUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categories[0].id);
  const [customKeyword, setCustomKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleAddCategory = () => {
    if (!customKeyword.trim()) return;
    const newCatName = customKeyword.trim();
    onAddCategory(newCatName);
    setSelectedCategory(newCatName);
    setCustomKeyword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { data, error: funcError } = await supabase.functions.invoke('post', {
        body: { 
          username: url.trim(),
          category: selectedCategory === 'Others' ? customKeyword : selectedCategory
        }
      });
      if (funcError) {
        console.error('Edge Function Error Object:', funcError);
        let errorDetail = '';
        
        if (funcError.response) {
          try {
            const responseClone = funcError.response.clone ? funcError.response.clone() : funcError.response;
            const body = await responseClone.json();
            errorDetail = body.error || body.message || JSON.stringify(body);
          } catch (parseError) {
            console.error('Failed to parse error body as JSON:', parseError);
            try {
              const text = await funcError.response.text();
              errorDetail = text.slice(0, 200); 
            } catch (textError) {
              errorDetail = funcError.message;
            }
          }
        } else {
          errorDetail = funcError.message;
        }

        throw new Error(errorDetail || 'Edge Function failed (No detail available)');
      }

      if (!data.success) throw new Error(data.message || 'Failed to fetch data');

      setSuccess(true);
      setUrl('');
    } catch (err) {
      console.error('Search failed detailed:', err);
      setError(err.message || 'An unexpected error occurred. Please check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Search Header Section */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 lg:p-12 mb-8 sm:mb-12 shadow-2xl backdrop-blur-xl">
        <header className="mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mb-2 sm:mb-4">
            Instagram <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Analyzer</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base lg:text-lg font-medium max-w-2xl leading-relaxed">
            Discover trending content by category. Track performance metrics and curate the best reels for your industry.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            <div className="flex-1 relative group">
              <input
                type="text"
                placeholder="Enter Instagram Profile URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 text-white px-5 sm:px-8 py-4 sm:py-5 rounded-2xl sm:rounded-3xl outline-none transition-all placeholder:text-slate-600 font-medium text-sm sm:text-base lg:text-lg"
              />
              <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-700 font-mono text-xs hidden sm:block">URL</div>
            </div>

            <div className="w-full lg:w-72 relative group">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 text-slate-300 px-5 sm:px-8 py-4 sm:py-5 rounded-2xl sm:rounded-3xl outline-none cursor-pointer appearance-none font-semibold text-sm sm:text-base"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.id}</option>
                ))}
              </select>
              <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">↓</div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="lg:w-48 bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-black py-4 sm:py-5 rounded-2xl sm:rounded-3xl shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none tracking-wider text-sm sm:text-base flex items-center justify-center gap-2"
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

          {selectedCategory === 'Others' && (
            <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <input
                type="text"
                placeholder="Enter custom category name..."
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                className="flex-1 bg-slate-950/50 border border-slate-800 focus:border-indigo-500/50 text-white px-5 py-3 rounded-xl outline-none transition-all placeholder:text-slate-600 text-sm font-medium"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold rounded-xl transition-all border border-slate-700 hover:border-indigo-500/30 text-sm"
              >
                Add
              </button>
            </div>
          )}
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

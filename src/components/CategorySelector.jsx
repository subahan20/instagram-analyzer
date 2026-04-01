import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export default function CategorySelector({ 
  selectedCategory, 
  onCategoryChange, 
  showAllOption = false, 
  className = "", 
  showOthers = true 
}) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name');
        
        if (error) throw error;
        setCategories(data || []);
      } catch (err) {
        console.error('[CategorySelector] Fetch Error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCategories();
  }, []);

  const filteredCategories = showOthers ? categories : categories.filter(({ name }) => name !== 'Others');

  const handleSelectChange = ({ target: { value: name } }) => {
    const cat = filteredCategories.find(c => c.name === name);
    onCategoryChange(cat ?? { name, id: null });
  };

  const baseSelectClass = "w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 text-slate-200 px-5 sm:px-6 py-3 rounded-xl sm:rounded-2xl outline-none transition-all font-semibold text-sm sm:text-base appearance-none cursor-pointer disabled:opacity-50 glass group-hover:border-slate-700";

  return (
    <div className="space-y-4">
      <div className="relative group">
        <select
          value={selectedCategory?.name || selectedCategory || ''}
          onChange={handleSelectChange}
          disabled={loading}
          className={className || baseSelectClass}
        >
          {loading ? (
            <option>Loading Categories...</option>
          ) : (
            <>
              {!showAllOption && <option value="" disabled>Select a Category</option>}
              {showAllOption && <option value="All Categories">All Categories</option>}
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </>
          )}
        </select>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

// Fallback categories shown if DB is unreachable
const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Coding' },
  { id: 2, name: 'AI Tools' },
  { id: 3, name: 'Design' },
  { id: 4, name: 'EdTech' },
];

export default function CategorySelector({ 
  selectedCategory, 
  onCategoryChange, 
  showAllOption = false, 
  className = "", 
  showOthers = true 
}) {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showOtherInput, setShowOtherInput] = useState(false);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name');
        
        if (error) throw error;
        // Only override fallback if we actually got data back
        if (data && data.length > 0) {
          setCategories(data);
        }
      } catch (err) {
        console.error('[CategorySelector] Fetch Error — using fallback categories:', err);
        // Keep DEFAULT_CATEGORIES already set in state
      } finally {
        setLoading(false);
      }
    }
    fetchCategories();
  }, []);

  const filteredCategories = categories.filter(({ name }) => name !== 'Others');

  const handleSelectChange = ({ target: { value: name } }) => {
    const cat = filteredCategories.find(c => c.name === name);
    onCategoryChange(cat ?? { name, id: null });
    setShowOtherInput(name === 'Others');
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim() || newCategory.trim().length >= 10) return;

    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{ 
          name: newCategory.trim() 
        }])
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      onCategoryChange(data);
      setShowOtherInput(false);
      setNewCategory('');
    } catch (err) {
      console.error('Error adding category:', err);
      alert('Failed to add category. It might already exist.');
    } finally {
      setIsAdding(false);
    }
  };

  const [isOpen, setIsOpen] = useState(false);
  const baseSelectClass = "w-full bg-canvas/40 border border-slate-400/20 dark:border-slate-800/50 hover:border-indigo-500/30 text-primary px-6 py-4 rounded-2xl outline-none transition-all font-semibold text-sm glass flex items-center justify-between cursor-pointer group min-h-[56px]";

  return (
    <div className="relative w-full">
      {showOtherInput ? (
        /* PROPER DESIGN: In-flow "Add New" Input to prevent overlapping */
        <div className={`flex items-center ${theme === 'dark' ? 'bg-slate-950/80 border-indigo-500/50' : 'bg-white border-slate-200'} rounded-2xl p-1.5 gap-2 border shadow-2xl animate-in fade-in zoom-in-95 duration-300 min-h-[56px] w-full`}>
          <input
            autoFocus
            type="text"
            placeholder="New Category..."
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            className="flex-1 bg-transparent text-primary px-4 outline-none font-bold text-sm min-w-0 placeholder:text-slate-400 dark:placeholder:text-slate-600"
          />
          <div className="flex gap-1">
            <button
              onClick={() => setShowOtherInput(false)}
              className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
              title="Cancel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              onClick={handleAddCategory}
              disabled={isAdding || !newCategory.trim() || newCategory.trim().length >= 10}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-30 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap"
            >
              {isAdding ? '...' : 'Add'}
            </button>
          </div>
        </div>
      ) : (
        /* Standard Selector Trigger */
        <div 
          onClick={() => !loading && setIsOpen(!isOpen)}
          className={`flex items-center gap-2 ${className || baseSelectClass}`}
        >
          {/* Centered Text Container */}
          <div className="flex-1 flex items-center justify-center min-w-0">
            <span className="truncate text-primary transition-colors">
              {loading ? "Initializing..." : (selectedCategory ? (selectedCategory.name.charAt(0).toUpperCase() + selectedCategory.name.slice(1)) : "Select a Category")}
            </span>
          </div>
          
          {/* Right-Aligned Arrow with spacing */}
          <div className="flex-none opacity-50 group-hover:opacity-100 transition-opacity">
            <svg 
              className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}

      {/* Custom Dropdown List */}
      {isOpen && !showOtherInput && (
        <>
          <div 
            className="fixed inset-0 z-30" 
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute top-full left-0 right-0 mt-3 z-40 bg-canvas border border-slate-200/50 dark:border-transparent rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-52 overflow-y-auto custom-scrollbar backdrop-blur-2xl">
            {showAllOption && (
              <div 
                className="px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-indigo-500/10 cursor-pointer text-sm font-bold text-secondary hover:text-primary transition-colors"
                onClick={() => {
                  onCategoryChange({ name: "All Categories", id: null });
                  setIsOpen(false);
                }}
              >
                All Categories
              </div>
            )}
            {filteredCategories.map((cat) => (
              <div 
                key={cat.id} 
                className="px-6 py-3.5 hover:bg-slate-100 dark:hover:bg-indigo-500/10 cursor-pointer text-sm font-bold text-secondary hover:text-primary transition-colors last:border-0"
                onClick={() => {
                  onCategoryChange(cat);
                  setIsOpen(false);
                }}
              >
                {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
              </div>
            ))}
            
            {showOthers && (
              <div 
                className="px-6 py-3.5 hover:bg-indigo-500/10 cursor-pointer text-sm font-black text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/5 group"
                onClick={() => {
                  setShowOtherInput(true);
                  setIsOpen(false);
                }}
              >
                <span className="group-hover:translate-x-1 inline-block transition-transform">+ Add New Category</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

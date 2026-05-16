import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const REQUIRED_CATEGORIES = [
  'Top 10 Edutech Influencer - BuildWithSanny',
  'NewB - CollegeStudent - AIWithSanny',
  'Marketing Solution - Scalebysanny',
  'Top Edutech Brand',
  'Foreign Educators in AI + n8n WOrkFlow'
];

export default function CategorySelector({ 
  selectedCategory, 
  onCategoryChange, 
  showAllOption = false, 
  className = ""
}) {
  const [categories, setCategories] = useState(
    REQUIRED_CATEGORIES.map((name, index) => ({ id: index + 1, name }))
  );
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function initCategories() {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .in('name', REQUIRED_CATEGORIES);
          
        if (error) throw error;
        
        let availableCategories = data || [];
        const missingNames = REQUIRED_CATEGORIES.filter(name => !availableCategories.find(c => c.name === name));
        
        if (missingNames.length > 0) {
          const { data: inserted, error: insertError } = await supabase
            .from('categories')
            .insert(missingNames.map(name => ({ name })))
            .select();
            
          if (!insertError && inserted) {
            availableCategories = [...availableCategories, ...inserted];
          }
        }
        
        const sortedCategories = REQUIRED_CATEGORIES.map(name => availableCategories.find(c => c.name === name)).filter(Boolean);
        setCategories(sortedCategories);
      } catch (err) {
        console.error('[CategorySelector] Fetch Error:', err);
      } finally {
        setLoading(false);
      }
    }
    initCategories();
  }, []);

  const baseSelectClass = "w-full bg-canvas/40 border border-slate-400/20 dark:border-slate-800/50 hover:border-indigo-500/30 text-primary px-6 py-4 rounded-2xl outline-none transition-all font-semibold text-sm glass flex items-center justify-between cursor-pointer group min-h-[56px]";

  return (
    <div className="relative w-full">
      <div 
        onClick={() => !loading && setIsOpen(!isOpen)}
        className={`flex items-center gap-2 ${className || baseSelectClass}`}
      >
        <div className="flex-1 flex items-center justify-center min-w-0">
          <span className="truncate text-primary transition-colors">
            {loading ? "Initializing..." : (selectedCategory && selectedCategory.name !== 'All Categories' ? selectedCategory.name : "Select Target")}
          </span>
        </div>
        
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

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-30" 
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute top-full left-0 min-w-full w-max max-w-[320px] sm:max-w-[450px] mt-3 z-40 bg-canvas border border-slate-200/50 dark:border-white/10 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-80 overflow-y-auto custom-scrollbar backdrop-blur-2xl shadow-2xl">
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
            {categories.map((cat) => (
              <div 
                key={cat.id} 
                className="px-6 py-3.5 hover:bg-slate-100 dark:hover:bg-indigo-500/10 cursor-pointer text-sm font-bold text-secondary hover:text-primary transition-colors last:border-0"
                onClick={() => {
                  onCategoryChange(cat);
                  setIsOpen(false);
                }}
              >
                {cat.name}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

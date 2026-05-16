import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

const ALL_SUBCATEGORIES = [
  'BuildWithSanny',
  'AIWithSanny',
  'Scalebysanny',
  'n8n WOrkFlow'
];

export default function SubcategorySelector({ 
  categoryId, 
  categoryName,
  selectedSubcategory, 
  onSubcategoryChange, 
  className = "", 
  showAllOption = false
}) {
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function initSubcategories() {
      if (!categoryId) {
        setSubcategories([]);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('subcategories')
          .select('*')
          .eq('category_id', categoryId)
          .in('name', ALL_SUBCATEGORIES);
          
        if (error) throw error;
        
        let availableSubcategories = data || [];
        const missingNames = ALL_SUBCATEGORIES.filter(name => !availableSubcategories.find(s => s.name === name));
        
        if (missingNames.length > 0) {
          const { data: inserted, error: insertError } = await supabase
            .from('subcategories')
            .insert(missingNames.map(name => ({ category_id: categoryId, name })))
            .select();
            
          if (!insertError && inserted) {
            availableSubcategories = [...availableSubcategories, ...inserted];
          }
        }
        
        const sortedSubcategories = ALL_SUBCATEGORIES.map(name => availableSubcategories.find(s => s.name === name)).filter(Boolean);
        setSubcategories(sortedSubcategories);
        
        // Auto-select the first subcategory if none is selected
        if (sortedSubcategories.length > 0 && (!selectedSubcategory || selectedSubcategory.name === 'All Subcategories')) {
          onSubcategoryChange(sortedSubcategories[0]);
        }
        
        setIsOpen(false);
      } catch (err) {
        console.error('Error fetching subcategories:', err);
        setSubcategories([]);
      } finally {
        setLoading(false);
      }
    }
    initSubcategories();
  }, [categoryId]);

  const baseSelectClass = "w-full bg-canvas/40 border border-slate-400/20 dark:border-slate-800/50 hover:border-indigo-500/30 text-primary px-6 py-4 rounded-2xl outline-none transition-all font-semibold text-sm glass flex items-center justify-between cursor-pointer group min-h-[56px]";

  if (!categoryId) return null;

  return (
    <div className="relative w-full animate-in fade-in slide-in-from-top-4 duration-500">

      {/* ── Selector trigger ── */}
      <div
        onClick={() => !loading && setIsOpen(!isOpen)}
        className={`flex items-center gap-2 ${className || baseSelectClass}`}
      >
        <div className="flex-1 flex items-center justify-center min-w-0">
          <span className="truncate text-primary transition-colors">
            {loading
              ? 'Fetching...'
              : selectedSubcategory && selectedSubcategory.name !== 'All Subcategories'
                ? selectedSubcategory.name
                : subcategories.length === 0
                  ? 'No Subcategories'
                  : 'Select a Subcategory'}
          </span>
        </div>
        <div className="flex-none opacity-50 group-hover:opacity-100 transition-opacity">
          <svg
            className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* ── Dropdown list ── */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />

          <div className="absolute top-full left-0 right-0 mt-3 z-40 bg-canvas border border-slate-200/50 dark:border-white/10 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto custom-scrollbar backdrop-blur-2xl shadow-xl">

            {/* "All Subcategories" option */}
            {showAllOption && subcategories.length > 0 && (
              <div
                className="px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-indigo-500/10 cursor-pointer text-sm font-bold text-secondary hover:text-primary transition-colors border-b border-slate-100 dark:border-white/5"
                onClick={() => { onSubcategoryChange({ name: 'All Subcategories', id: null }); setIsOpen(false); }}
              >
                All Subcategories
              </div>
            )}

            {/* Existing subcategories */}
            {subcategories.map((sub) => (
              <div
                key={sub.id}
                className="px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-indigo-500/10 cursor-pointer text-sm font-bold text-secondary hover:text-primary transition-colors"
                onClick={() => { onSubcategoryChange(sub); setIsOpen(false); }}
              >
                {sub.name}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

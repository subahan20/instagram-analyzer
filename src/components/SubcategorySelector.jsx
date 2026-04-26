import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

export default function SubcategorySelector({ 
  categoryId, 
  selectedSubcategory, 
  onSubcategoryChange, 
  className = "", 
  showAllOption = false,
  showOthers = true 
}) {
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newSubcategory, setNewSubcategory] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  // true = show inline add-input directly (when no subcategories exist)
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const addInputRef = useRef(null);

  useEffect(() => {
    async function fetchSubcategories() {
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
          .order('name');
        if (error) throw error;
        const subList = (data || []).filter(s => s.name !== 'Others');
        setSubcategories(subList);
        // Reset UI state on category change
        setIsOpen(false);
        setShowInlineAdd(false);
        setNewSubcategory('');
      } catch (err) {
        console.error('Error fetching subcategories:', err);
        setSubcategories([]);
      } finally {
        setLoading(false);
      }
    }
    fetchSubcategories();
  }, [categoryId]);

  // Auto-focus the add input whenever it appears
  useEffect(() => {
    if (showInlineAdd && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [showInlineAdd]);

  const handleAddSubcategory = async () => {
    const trimmed = newSubcategory.trim();
    if (!trimmed) return;

    setIsAdding(true);
    try {
      const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      const { data, error } = await supabase
        .from('subcategories')
        .insert([{ category_id: categoryId, name: formatted }])
        .select()
        .single();

      if (error) throw error;

      // Add to local list and select it
      setSubcategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      onSubcategoryChange(data);
      setShowInlineAdd(false);
      setIsOpen(false);
      setNewSubcategory('');
    } catch (err) {
      console.error('Error adding subcategory:', err);
      alert('Failed to add subcategory. It might already exist.');
    } finally {
      setIsAdding(false);
    }
  };

  const baseSelectClass = "w-full bg-canvas/40 border border-slate-400/20 dark:border-slate-800/50 hover:border-indigo-500/30 text-primary px-6 py-4 rounded-2xl outline-none transition-all font-semibold text-sm glass flex items-center justify-between cursor-pointer group min-h-[56px]";

  if (!categoryId) return null;

  // ── Inline "Add Subcategory" input (shown when no subcategories or user clicks +)
  if (showInlineAdd) {
    return (
      <div className="relative w-full animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center bg-canvas dark:bg-slate-900/80 rounded-2xl p-1.5 gap-2 border border-indigo-500/40 shadow-lg animate-in fade-in zoom-in-95 duration-300 min-h-[56px] w-full">
          <div className="flex-none pl-3">
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <input
            ref={addInputRef}
            type="text"
            placeholder="Type subcategory name..."
            value={newSubcategory}
            onChange={(e) => setNewSubcategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddSubcategory();
              if (e.key === 'Escape') { setShowInlineAdd(false); setNewSubcategory(''); }
            }}
            className="flex-1 bg-transparent text-primary px-2 outline-none font-bold text-sm min-w-0 placeholder:text-slate-400 dark:placeholder:text-slate-600"
          />
          <div className="flex gap-1">
            <button
              onClick={() => { setShowInlineAdd(false); setNewSubcategory(''); }}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              title="Cancel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              onClick={handleAddSubcategory}
              disabled={isAdding || !newSubcategory.trim()}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-30 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap cursor-pointer"
            >
              {isAdding ? (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              : selectedSubcategory
                ? selectedSubcategory.name.charAt(0).toUpperCase() + selectedSubcategory.name.slice(1)
                : subcategories.length === 0
                  ? '+ Add Subcategory'
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
                {sub.name.charAt(0).toUpperCase() + sub.name.slice(1)}
              </div>
            ))}

            {/* No subcategories: prompt to add */}
            {subcategories.length === 0 && !loading && (
              <div
                className="px-6 py-5 text-center cursor-pointer group"
                onClick={() => { setIsOpen(false); setShowInlineAdd(true); }}
              >
                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-1">
                  No subcategories yet
                </p>
                <p className="text-indigo-400 text-sm font-black group-hover:text-indigo-300 transition-colors">
                  + Add First Subcategory
                </p>
              </div>
            )}

            {/* Always visible "Add New" at bottom when subcategories exist */}
            {subcategories.length > 0 && (
              <div
                className="px-6 py-3.5 hover:bg-indigo-500/10 cursor-pointer text-sm font-black text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/5 border-t border-slate-100 dark:border-white/5 group"
                onClick={() => { setIsOpen(false); setShowInlineAdd(true); }}
              >
                <span className="group-hover:translate-x-1 inline-block transition-transform">
                  + Add New Subcategory
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

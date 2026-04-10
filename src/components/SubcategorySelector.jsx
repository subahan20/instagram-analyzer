import { useState, useEffect } from 'react';
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
  const [showOtherInput, setShowOtherInput] = useState(false);

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

        const subName = selectedSubcategory?.name || selectedSubcategory;
        if (subName === 'Others' || (subName && subName !== 'All Subcategories' && subList.length > 0 && !subList.find(s => s.name === subName))) {
          setShowOtherInput(true);
        } else {
          setShowOtherInput(false);
        }
      } catch (err) {
        console.error('Error fetching subcategories:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSubcategories();
  }, [categoryId, selectedSubcategory]);

  const handleSelectChange = (e) => {
    const value = e.target.value;
    const subcategory = subcategories.find(s => s.name === value);
    onSubcategoryChange(subcategory || { name: value, id: null });
    setShowOtherInput(value === 'Others');
  };

  const handleAddSubcategory = async () => {
    if (newSubcategory.trim().length >= 10) return;

    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .insert([{ 
          category_id: categoryId,
          name: newSubcategory.trim().charAt(0).toUpperCase() + newSubcategory.trim().slice(1)
        }])
        .select()
        .single();

      if (error) throw error;

      // Refresh subcategories from DB to ensure consistency
      setSubcategories(prev => [...prev, data]);
      
      // Select the newly added subcategory object
      onSubcategoryChange(data);
      setShowOtherInput(false);
      setNewSubcategory('');
    } catch (err) {
      console.error('Error adding subcategory:', err);
      alert('Failed to add subcategory. It might already exist.');
    } finally {
      setIsAdding(false);
    }
  };

  const [isOpen, setIsOpen] = useState(false);
  const baseSelectClass = "w-full bg-canvas/40 border border-slate-400/20 dark:border-slate-800/50 hover:border-indigo-500/30 text-primary px-6 py-4 rounded-2xl outline-none transition-all font-semibold text-sm glass flex items-center justify-between cursor-pointer group min-h-[56px]";

  if (!categoryId) return null;

  return (
    <div className="relative w-full animate-in fade-in slide-in-from-top-4 duration-500">
      {showOtherInput ? (
        /* PROPER DESIGN: In-flow "Add New" Input to prevent overlapping */
        <div className={`flex items-center ${theme === 'dark' ? 'bg-slate-950/80 border-indigo-500/50' : 'bg-white border-slate-200'} rounded-2xl p-1.5 gap-2 border shadow-2xl animate-in fade-in zoom-in-95 duration-300 min-h-[56px] w-full`}>
          <input
            autoFocus
            type="text"
            placeholder="New Specialization..."
            value={newSubcategory}
            onChange={(e) => setNewSubcategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSubcategory()}
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
              onClick={handleAddSubcategory}
              disabled={isAdding || !newSubcategory.trim() || newSubcategory.trim().length >= 10}
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
              {loading ? "Fetching..." : (selectedSubcategory ? (selectedSubcategory.name.charAt(0).toUpperCase() + selectedSubcategory.name.slice(1)) : "Select a Specialization")}
            </span>
          </div>

          {/* Right-Aligned Arrow */}
          <div className="flex-none">
            <svg 
              className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
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
                className="px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-indigo-500/10 cursor-pointer text-sm font-bold text-secondary hover:text-primary transition-colors border-b border-slate-100 dark:border-white/5"
                onClick={() => {
                  onSubcategoryChange({ name: "All Subcategories", id: null });
                  setIsOpen(false);
                }}
              >
                All Subcategories
              </div>
            )}
            {subcategories.map((sub) => (
              <div 
                key={sub.id} 
                className="px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-indigo-500/10 cursor-pointer text-sm font-bold text-secondary hover:text-primary transition-colors border-b border-slate-100 dark:border-white/5 last:border-0"
                onClick={() => {
                  onSubcategoryChange(sub);
                  setIsOpen(false);
                }}
              >
                {sub.name.charAt(0).toUpperCase() + sub.name.slice(1)}
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
                <span className="group-hover:translate-x-1 inline-block transition-transform">+ Add New Specialization</span>
              </div>
            )}

            {subcategories.length === 0 && !loading && !showOthers && (
              <div className="px-6 py-8 text-center text-slate-500 text-xs font-bold uppercase tracking-widest italic">
                No specializations available
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

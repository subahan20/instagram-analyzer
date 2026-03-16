import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

// Removed Supabase fetch on mount to guarantee 0 API calls before Start Sync.

const STATIC_SUBCATEGORIES_MAP = {
  1: [
    { id: 1, name: 'Web Development' },
    { id: 2, name: 'Software Development' },
    { id: 3, name: 'Data Science' },
    { id: 4, name: 'Frontend Development' },
    { id: 5, name: 'Backend Development' }
  ],
  2: [{ id: 6, name: 'jsds' }],
  3: [{ id: 8, name: 'dfjisdjf' }],
  4: [{ id: 7, name: 'coding' }],
  6: [{ id: 9, name: 'djnfdlfk' }]
};

export default function SubcategorySelector({ categoryId, selectedSubcategory, onSubcategoryChange, className = "", showAllOption = false }) {
  const [subcategories, setSubcategories] = useState([]);
  const [newSubcategory, setNewSubcategory] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showOtherInput, setShowOtherInput] = useState(false);

  // Use the static map for initialization
  useEffect(() => {
    if (categoryId) {
      const subList = STATIC_SUBCATEGORIES_MAP[categoryId] ? [...STATIC_SUBCATEGORIES_MAP[categoryId]] : [];
      setSubcategories(subList);
      
      const subName = selectedSubcategory?.name || selectedSubcategory;
      if (subName === 'Others' || (subName && subName !== 'All Subcategories' && subList && !subList.find(s => s.name === subName))) {
        setShowOtherInput(true);
      } else {
        setShowOtherInput(false);
      }
    } else {
      setSubcategories([]);
      setShowOtherInput(false);
    }
  }, [categoryId, selectedSubcategory]);

  const handleSelectChange = (e) => {
    const value = e.target.value;
    const subcategory = subcategories.find(s => s.name === value);
    onSubcategoryChange(subcategory || { name: value, id: null });
    setShowOtherInput(value === 'Others');
  };

  const handleAddSubcategory = async () => {
    if (!newSubcategory.trim() || !categoryId) return;

    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .insert([{ 
          category_id: categoryId,
          name: newSubcategory.trim() 
        }])
        .select()
        .single();

      if (error) throw error;

      // Add to local state and cache map so it shows up
      if (!STATIC_SUBCATEGORIES_MAP[categoryId]) {
        STATIC_SUBCATEGORIES_MAP[categoryId] = [];
      }
      STATIC_SUBCATEGORIES_MAP[categoryId].push(data);
      setSubcategories([...STATIC_SUBCATEGORIES_MAP[categoryId]]);
      
      // Select the newly added subcategory object
      onSubcategoryChange(data);
      setShowOtherInput(false);
    } catch (err) {
      console.error('Error adding subcategory:', err);
      alert('Failed to add subcategory. It might already exist.');
    } finally {
      setIsAdding(false);
    }
  };

  const baseSelectClass = "w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 text-slate-200 px-5 sm:px-6 py-3 rounded-xl sm:rounded-2xl outline-none transition-all font-semibold text-sm sm:text-base appearance-none cursor-pointer disabled:opacity-50 glass group-hover:border-slate-700";

  if (!categoryId) return null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="relative group">
        <select
          value={selectedSubcategory?.name || selectedSubcategory || ''}
          onChange={handleSelectChange}
          className={className || baseSelectClass}
        >
          {showAllOption && <option value="All Subcategories">All Subcategories</option>}
          {!showAllOption && <option value="" disabled>Select a Subcategory</option>}
          {subcategories.map((sub) => (
            <option key={sub.id} value={sub.name}>
              {sub.name}
            </option>
          ))}
          <option value="Others">Others</option>
        </select>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {showOtherInput && (
        <div className="flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <input
            type="text"
            placeholder="Enter new subcategory name..."
            value={newSubcategory}
            onChange={(e) => setNewSubcategory(e.target.value)}
            className="flex-1 bg-slate-950/40 border border-slate-800 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 text-slate-200 px-5 py-3 rounded-xl outline-none transition-all placeholder:text-slate-600 font-semibold text-sm"
          />
          <button
            type="button"
            onClick={handleAddSubcategory}
            disabled={isAdding || !newSubcategory.trim()}
            className="sm:w-32 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
          >
            {isAdding ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              'Add'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

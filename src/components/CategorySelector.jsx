// Removed Supabase fetch entirely to guarantee 0 API calls before Start Sync.

const STATIC_CATEGORIES = [
  { id: 1, name: "Coding" },
  { id: 2, name: "AI Tools" },
  { id: 3, name: "Design" },
  { id: 4, name: "EdTech" },
  { id: 5, name: "Others" },
  { id: 6, name: "fbgsb" }
];

export default function CategorySelector({ selectedCategory, onCategoryChange, showAllOption = false, className = "", showOthers = true }) {
  const filteredCategories = showOthers ? STATIC_CATEGORIES : STATIC_CATEGORIES.filter(c => c.name !== 'Others');

  const handleSelectChange = (e) => {
    const name = e.target.value;
    const cat = filteredCategories.find(c => c.name === name);
    onCategoryChange(cat || { name, id: null });
  };

  const baseSelectClass = "w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 text-white px-5 sm:px-8 py-4 sm:py-5 rounded-2xl sm:rounded-3xl outline-none transition-all font-medium text-sm sm:text-base lg:text-lg appearance-none cursor-pointer disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="relative group">
        <select
          value={selectedCategory?.name || selectedCategory || ''}
          onChange={handleSelectChange}
          className={className || baseSelectClass}
        >
          {!showAllOption && <option value="" disabled>Select a Category</option>}
          {showAllOption && <option value="All Categories">All Categories</option>}
          {filteredCategories.map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.name}
            </option>
          ))}
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

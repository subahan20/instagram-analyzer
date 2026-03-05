import { useState, useEffect } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { supabase } from './supabase'
import Dashboard from './components/Dashboard'
import InstagramSearch from './components/InstagramSearch'

const INITIAL_CATEGORIES = [
  { id: 'Software Development', keywords: ['software', 'developer', 'coding', 'programming', 'tech', 'build', 'dev'] },
  { id: 'Frontend Development', keywords: ['react', 'css', 'ui', 'ux', 'javascript', 'js', 'html', 'tailwind', 'nextjs', 'frontend'] },
  { id: 'Backend Development', keywords: ['backend', 'api', 'database', 'sql', 'node', 'express', 'python', 'server', 'microservices'] },
  { id: 'DevOps', keywords: ['devops', 'docker', 'kubernetes', 'cicd', 'jenkins', 'terraform', 'automation'] },
  { id: 'AI Tools', keywords: ['ai', 'intelligence', 'automation', 'openai', 'gemini', 'anthropic', 'agents', 'llm', 'gpt', 'llama', 'langchain'] },
  { id: 'LLMs', keywords: ['llm', 'gpt', 'llama', 'langchain', 'ai tools'] },
  { id: 'Others', keywords: [] },
];

function SyncPage({ categories, onAddCategory }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-indigo-500/30">
      <section className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 sm:mb-12">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Instagram Analyzer
            </h1>
            <p className="text-slate-500 font-medium tracking-widest uppercase text-[10px] sm:text-xs mt-1 sm:mt-2">
              Premium Content Intelligence & Analysis
            </p>
          </div>
          <Link 
            to="/dashboard" 
            className="group flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl font-semibold transition-all duration-300 w-full md:w-auto"
          >
            <span className="text-sm sm:text-base">View Sync History</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </header>
        
        <InstagramSearch categories={categories} onAddCategory={onAddCategory} />
      </section>
    </div>
  )
}

function App() {
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);

  useEffect(() => {
    const fetchCustomIndustries = async () => {
      const { data, error } = await supabase
        .from('custom_industries')
        .select('name')
        .order('created_at', { ascending: true });
      
      if (!error && data) {
        setCategories(prev => {
          const othersIdx = prev.findIndex(c => c.id === 'Others');
          const base = prev.slice(0, othersIdx);
          const others = prev.slice(othersIdx);
          
          const stored = data.map(d => ({ id: d.name, keywords: [d.name.toLowerCase()] }));
          // Filter out duplicates from initial list
          const filteredStored = stored.filter(s => !base.find(b => b.id === s.id));
          
          return [...base, ...filteredStored, ...others];
        });
      }
    };
    fetchCustomIndustries();
  }, []);

  const addCategory = async (name) => {
    if (!name || categories.find(c => c.id === name)) return;
    
    // Attempt persist to Supabase
    const { error } = await supabase
      .from('custom_industries')
      .insert([{ name: name.trim() }]);
    
    if (error && error.code !== '23505') { // Ignore unique constraint errors
      console.error('Error saving custom industry:', error);
    }

    const newCat = { id: name.trim(), keywords: [name.trim().toLowerCase()] };
    const othersIdx = categories.findIndex(c => c.id === 'Others');
    const newCategories = [...categories];
    newCategories.splice(othersIdx, 0, newCat);
    setCategories(newCategories);
  };

  return (
    <Routes>
      <Route path="/" element={<SyncPage categories={categories} onAddCategory={addCategory} />} />
      <Route path="/dashboard" element={<Dashboard sharedCategories={categories} />} />
    </Routes>
  )
}

export default App

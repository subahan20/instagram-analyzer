import { useState, useEffect } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { supabase } from './supabase'
import Dashboard from './components/Dashboard'
import InstagramSearch from './components/InstagramSearch'
import ProfilePage from './components/ProfilePage'

// Removed unused INITIAL_CATEGORIES array

function SyncPage() {
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
        
        <InstagramSearch />

        <div className="mt-20 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="max-w-2xl">
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-6">
              Discover Next-Gen <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Creators</span>
            </h2>
            <p className="text-slate-400 text-lg sm:text-xl font-medium leading-relaxed">
              Unlock deep performance insights, growth metrics, and engagement analytics for thousands of creators.
            </p>
          </div>
          
          <Link 
            to="/dashboard"
            className="group relative px-10 py-5 bg-indigo-500 hover:bg-indigo-600 rounded-2xl font-black text-lg sm:text-xl tracking-widest uppercase transition-all shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] hover:shadow-[0_0_60px_-10px_rgba(99,102,241,0.6)] active:scale-95 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-4">
              Start Instagram Dashboard
              <span className="group-hover:translate-x-2 transition-transform duration-300">→</span>
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite] skew-x-12"></div>
          </Link>
        </div>
      </section>
    </div>
  )
}

function App() {
  // Removed unused custom_industries fetching and state

  return (
    <Routes>
      <Route path="/" element={<SyncPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/profile/:id" element={<ProfilePage />} />
    </Routes>
  )
}

export default App

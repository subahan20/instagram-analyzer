import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6 overflow-hidden relative font-sans">
      {/* Dynamic Background Elements */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] animate-pulse delay-700"></div>
      
      <div className="relative z-10 text-center space-y-12 max-w-md w-full animate-in fade-in zoom-in duration-1000">
        <div className="space-y-6">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-[2rem] mx-auto flex items-center justify-center shadow-2xl shadow-indigo-600/20 mb-10 transform hover:rotate-12 transition-transform duration-500">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">
              User <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-500">Authentication</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] leading-relaxed">
              Sign in to manage your <br/>synchronized creator archive
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <button 
            onClick={() => navigate('/auth?mode=login')}
            className="w-full py-5 bg-white text-slate-950 text-[10px] font-black uppercase tracking-[0.4em] rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-white/5"
          >
            Sign In
          </button>
          
          <button 
            onClick={() => navigate('/auth?mode=signup')}
            className="w-full py-5 bg-slate-900/50 backdrop-blur-xl border border-white/5 text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-2xl transition-all hover:bg-slate-900 hover:border-indigo-500/30 active:scale-95"
          >
            Create Account
          </button>
        </div>

        <div className="pt-12 text-[9px] text-slate-600 font-bold uppercase tracking-widest opacity-50">
          SECURED VIA SUPABASE AUTH
        </div>
      </div>
    </div>
  );
}

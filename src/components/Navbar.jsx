import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import ThemeToggle from './ThemeToggle';

export default function Navbar({ user, theme, setTheme }) {
  const location = useLocation();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 py-4">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between glass py-2.5 px-4 sm:px-6 rounded-2xl border border-white/5 transition-all">
        {/* Brand Section */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
            <svg 
              className="w-5 h-5 sm:w-6 sm:h-6 text-white" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
          </div>
          <div className="hidden xs:block">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-primary leading-none transition-colors">
              Instagram <span className="text-gradient">Analyzer</span>
            </h1>
            <p className="text-[8px] sm:text-[9px] text-secondary font-bold tracking-[0.2em] uppercase opacity-70 mt-0.5 transition-colors">AI Intelligence</p>
          </div>
        </Link>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-4 ml-2">
          {user && (
            <Link 
              to="/dashboard" 
              className={`flex items-center gap-2 px-3 sm:px-5 py-2 rounded-xl border border-white/5 transition-all shadow-lg ${
                location.pathname === '/dashboard' 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500' 
                  : 'glass hover:border-indigo-500/50 text-secondary hover:text-primary'
              }`}
            >
              <svg className="w-3.5 h-3.5 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider">
                {location.pathname === '/dashboard' ? 'History' : 'Hub'}
              </span>
            </Link>
          )}
          
          <div className="flex items-center gap-1.5 sm:gap-2 border-l border-white/10 pl-2 sm:pl-4">
            <ThemeToggle theme={theme} setTheme={setTheme} />
            
            {user ? (
              <button 
                onClick={handleSignOut}
                className="group flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 glass rounded-xl border border-white/5 hover:border-rose-500/50 hover:bg-rose-500/5 transition-all shadow-xl cursor-pointer"
                title="Terminate Session"
              >
                <svg 
                  className="w-4 h-4 sm:w-5 sm:h-5 text-secondary group-hover:text-rose-500 transition-colors" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                  <line x1="12" y1="2" x2="12" y2="12"></line>
                </svg>
              </button>
            ) : (
              <Link 
                to="/auth?mode=login"
                className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

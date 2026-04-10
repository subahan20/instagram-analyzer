import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabase';
import Landing from './components/Landing';
import Auth from './components/Auth';
import InstagramSearch from './components/InstagramSearch';
import ProfilePage from './components/ProfilePage';
import Dashboard from './components/Dashboard';
import FollowersPage from './components/FollowersPage';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const location = useLocation();

  useEffect(() => {
    // Apply theme globally
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center transition-colors duration-500">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // --- Protected Route Wrapper ---
  const ProtectedRoute = ({ children }) => {
    if (!user) return <Navigate to="/auth" state={{ from: location }} />;
    return (
      <div className="min-h-screen bg-canvas text-primary font-sans selection:bg-indigo-500/30 transition-colors duration-500">
        {children}
      </div>
    );
  };

  return (
    <>
      <Routes>
        {/* Home Hub: Landing for Guest, Analyzer for Terminal User */}
        <Route 
          path="/" 
          element={<InstagramSearch user={user} theme={theme} setTheme={setTheme} />} 
        />
        
        {/* Sync History Node */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard user={user} theme={theme} setTheme={setTheme} />
          </ProtectedRoute>
        } />

        {/* Auth Step: Establish Identity */}
        <Route 
          path="/auth" 
          element={user ? <Navigate to="/" replace /> : <Auth onAuthSuccess={(userData) => setUser(userData)} theme={theme} setTheme={setTheme} />} 
        />
        
        {/* Creator Identity Node: Publicly Accessible */}
        <Route path="/profile/:id" element={<ProfilePage user={user} theme={theme} setTheme={setTheme} />} />

        <Route path="/followers/:username" element={
          <ProtectedRoute>
            <FollowersPage user={user} theme={theme} setTheme={setTheme} />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={theme === 'dark' ? 'dark' : 'light'}
      />
    </>
  );
}

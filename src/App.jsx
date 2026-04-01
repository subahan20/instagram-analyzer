import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabase';
import Landing from './components/Landing';
import Auth from './components/Auth';
import InstagramSearch from './components/InstagramSearch';
import ProfilePage from './components/ProfilePage';
import Dashboard from './components/Dashboard';
import FollowersPage from './components/FollowersPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // --- Protected Route Wrapper ---
  const ProtectedRoute = ({ children }) => {
    if (!user) return <Navigate to="/auth" state={{ from: location }} />;
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-indigo-500/30">
        {children}
      </div>
    );
  };

  return (
    <Routes>
      {/* Home Hub: Landing for Guest, Analyzer for Terminal User */}
      <Route 
        path="/" 
        element={<InstagramSearch user={user} />} 
      />
      
      {/* Sync History Node */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard user={user} />
        </ProtectedRoute>
      } />

      {/* Auth Step: Establish Identity */}
      <Route 
        path="/auth" 
        element={user ? <Navigate to="/" replace /> : <Auth onAuthSuccess={(userData) => setUser(userData)} />} 
      />
      
      {/* Protected Profile Nodes */}
      <Route path="/profile/:id" element={
        <ProtectedRoute>
          <ProfilePage user={user} />
        </ProtectedRoute>
      } />

      <Route path="/followers/:username" element={
        <ProtectedRoute>
          <FollowersPage user={user} />
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

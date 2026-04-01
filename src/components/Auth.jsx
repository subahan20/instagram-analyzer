import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Auth({ onAuthSuccess }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  
  const [mode, setMode] = useState(initialMode);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'signup' || m === 'login') {
      setMode(m);
      setError(null);
      setSuccessMsg(null);
    }
  }, [searchParams]);

  const clearSession = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      setError('Session cleared. Please try again.');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const invokeAdminAction = async (action, data) => {
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseAnonKey) {
      console.error("[Auth] Configuration missing: VITE_SUPABASE_ANON_KEY is undefined.");
      return { data: null, error: "System configuration error. Please check your .env file." };
    }

    try {
      const { data: resData, error: resError } = await supabase.functions.invoke('post', {
        body: { action, ...data },
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      });

      if (resError) {
        const msg = resError.message || resError.toString();
        if (msg.toLowerCase().includes('jwt')) {
          return { data: null, error: 'SECURITY MISMATCH: Your project keys do not match your URL. Please update Line 12 in .env.local with the correct Service Role Key.' };
        }
        return { data: null, error: msg };
      }

      return { data: resData, error: null };
    } catch (e) {
      return { data: null, error: e.message || e };
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const email = formData.email.trim().toLowerCase();
    const username = formData.username.trim().toLowerCase();

    if (mode === 'signup') {
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      // Administrative Registration (Bypasses client-side validation blocks)
      // Using manual fetch to avoid "Invalid JWT" conflicts from old sessions
      const { data: adminRes, error: adminErr } = await invokeAdminAction('admin_create_user', {
        email,
        username, 
        password: formData.password 
      });

      if (adminErr || !adminRes?.success) {
        const msg = (adminRes?.error || adminErr || 'Registration failed').toString();
        setLoading(false);
        
        if (msg.toLowerCase().includes('jwt') || msg.toLowerCase().includes('401')) {
          setError('Auth session conflict detected. Clearing session...');
          setTimeout(clearSession, 1500);
          return;
        }
        
        if (msg.includes('SECURITY MISMATCH')) {
          setError(msg);
          return;
        }

        setError(msg);
        return;
      }

      // Success - Transition to Login as requested
      setSuccessMsg('Identity established. Please access your node.');
      setMode('login');
      setSearchParams({ mode: 'login' });
      setLoading(false);
      setFormData({ email: '', username, password: '', confirmPassword: '' });
    } else {
      // Direct Identifier Extraction: We don't rely on the hidden email state anymore
      const identifier = formData.username.trim().toLowerCase();
      let loginEmail = identifier;

      // If the input doesn't look like an email, resolve it by username first
      if (!identifier.includes('@')) {
        const { data: resolveRes, error: resolveErr } = await invokeAdminAction('resolve_email_by_username', {
          username: identifier
        });
        
        if (resolveErr || !resolveRes?.success) {
          setError(resolveRes?.error || resolveErr || 'Account not found. Please check your username.');
          setLoading(false);
          return;
        }
        loginEmail = resolveRes.email;
      }


      let { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: formData.password,
      });

      // Handle "Email not confirmed" by auto-confirming via ADMIN and retrying
      if (signInError && signInError.message.toLowerCase().includes('email not confirmed')) {
        // Using manual fetch to avoid "Invalid JWT" conflicts from old sessions
        const { data: confirmData } = await invokeAdminAction('admin_confirm_by_email', {
          email: loginEmail
        });
        
        if (confirmData?.success) {
          const retry = await supabase.auth.signInWithPassword({ 
            email: loginEmail, 
            password: formData.password 
          });
          data = retry.data;
          signInError = retry.error;
        }
      }

      if (signInError) {
        const msg = signInError.message;
        if (msg.toLowerCase().includes('jwt') || msg.toLowerCase().includes('expired') || msg.includes('401')) {
          setError('Invalid session detected. Resetting...');
          setLoading(false);
          setTimeout(clearSession, 1500);
          return;
        }
        setError(msg.toLowerCase().includes('invalid login credentials') 
          ? 'Invalid login credentials' 
          : msg);
        setLoading(false);
        return;
      }

      if (data?.user) {
        onAuthSuccess(data.user);
        navigate('/');
      }
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || 'Google authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full glass p-8 rounded-[2.5rem] border border-white/5 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-2">
          <div 
            onClick={() => navigate('/')}
            className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-xl mx-auto flex items-center justify-center shadow-xl shadow-indigo-500/10 mb-4 cursor-pointer hover:scale-110 transition-transform"
          >
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            {mode === 'signup' ? 'Create Account' : 'Sign In'}
          </h2>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">
            {mode === 'signup' ? 'Register to start tracking profiles' : 'Enter your details to access hub'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-5">Email Address</label>
              <input
                type="email"
                required
                className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 px-6 text-sm font-medium focus:outline-none focus:border-indigo-500/50 transition-all text-white placeholder:text-slate-700"
                placeholder="e.g. name@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-5">
              {mode === 'signup' ? 'Username' : 'Username or Email'}
            </label>
            <input
              type="text"
              required
              className="w-full bg-slate-900 border border-white/5 rounded-2xl py-5 px-6 text-sm font-medium focus:outline-none focus:border-indigo-500/50 transition-all text-white placeholder:text-slate-700"
              placeholder={mode === 'signup' ? "e.g. subahan.sk20" : "Enter your username or email"}
              value={formData.username}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({ 
                  ...formData, 
                  username: val,
                  // If it's a login and looks like email, sync it to the email field too
                  email: (mode === 'login' && val.includes('@')) ? val : formData.email 
                });
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-5">Password</label>
            <input
              type="password"
              required
              className="w-full bg-slate-900 border border-white/5 rounded-2xl py-5 px-6 text-sm font-medium focus:outline-none focus:border-indigo-500/50 transition-all text-white placeholder:text-slate-700"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          {mode === 'signup' && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-5">Confirm Password</label>
              <input
                type="password"
                required
                className="w-full bg-slate-900 border border-white/5 rounded-2xl py-5 px-6 text-sm font-medium focus:outline-none focus:border-indigo-500/50 transition-all text-white placeholder:text-slate-700"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>
          )}

          {error && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-[10px] text-rose-500 font-bold uppercase tracking-wider text-center animate-shake">
                {error}
              </div>
              <button 
                type="button"
                onClick={clearSession}
                className="w-full py-3 px-4 bg-slate-900/50 hover:bg-slate-900 border border-white/5 rounded-xl text-[9px] font-black text-slate-500 hover:text-rose-400 uppercase tracking-[0.2em] transition-all"
              >
                Reset Session & Retry
              </button>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[10px] text-emerald-500 font-bold uppercase tracking-wider text-center">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-black text-[10px] uppercase tracking-[0.3em] py-4 rounded-2xl transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 active:scale-[0.98] mt-2 relative z-20 cursor-pointer"
          >
            {loading ? 'Processing...' : (mode === 'signup' ? 'Create Account' : 'Sign In')}
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[8px] font-black uppercase tracking-[0.4em]">
              <span className="bg-slate-950 px-4 text-slate-600">OR</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/5 text-white font-black text-[9px] uppercase tracking-[0.2em] py-4 rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              const newMode = mode === 'login' ? 'signup' : 'login';
              setMode(newMode);
              setSearchParams({ mode: newMode });
              setError(null);
              setSuccessMsg(null);
              // We keep the username to make it easy for the user
            }}
            className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-indigo-400 transition-colors"
          >
            {mode === 'login' ? 'Need an account? Sign up here' : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}

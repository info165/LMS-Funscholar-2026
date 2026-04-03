import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { LogOut, BookOpen, Users, ClipboardList, LayoutDashboard, Settings as SettingsIcon, Menu, X, Plus, ExternalLink, Camera, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import { Toaster } from 'sonner';

// --- Pages ---
import Schools from './pages/Schools';
import Teachers from './pages/Teachers';
import Courses from './pages/Courses';
import Projects from './pages/Projects';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import ContentManager from './pages/ContentManager';
import AttendancePage from './pages/Attendance';
import ReportsPage from './pages/Reports';
import StudentsPage from './pages/Students';

// --- Components ---

const Sidebar = ({ role }: { role: string }) => {
  const { logout } = useAuth();
  
  const links = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    ...(role === 'admin' ? [
      { name: 'Schools', path: '/schools', icon: Users },
      { name: 'Teachers', path: '/teachers', icon: Users },
      { name: 'Students', path: '/students', icon: Users },
      { name: 'Curriculum', path: '/content', icon: BookOpen },
      { name: 'Reports', path: '/reports', icon: ClipboardList },
    ] : []),
    ...(role === 'teacher' ? [
      { name: 'My Courses', path: '/courses', icon: BookOpen },
      { name: 'Attendance', path: '/attendance', icon: Users },
      { name: 'Content Control', path: '/content', icon: LayoutGrid },
      { name: 'Logs', path: '/logs', icon: ClipboardList },
    ] : []),
    ...(role === 'student' ? [
      { name: 'My Projects', path: '/projects', icon: ClipboardList },
    ] : []),
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <div className="w-64 bg-[#151619] text-white h-screen flex flex-col border-r border-white/10 shrink-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tighter text-[#F27D26]">FUNSCHOLAR</h1>
        <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-mono">Robotics LMS</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors text-sm font-medium opacity-70 hover:opacity-100"
          >
            <link.icon size={18} />
            {link.name}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg hover:bg-red-500/10 text-red-400 transition-colors text-sm font-medium"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-[#050505] text-white">Loading...</div>;
  if (!profile) return <Navigate to="/login" />;

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden">
      <Sidebar role={profile.role} />
      <main className="flex-1 overflow-y-auto p-8 relative custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

const Login = () => {
  const { login, loginWithEmail, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (profile) return <Navigate to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#050505] relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#F27D26_0%,transparent_50%)] blur-[100px]" />
      </div>
      
      <div className="relative z-10 text-center w-full max-w-md px-6">
        <motion.h1 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-5xl font-bold tracking-tighter text-white mb-2"
        >
          FUN<span className="text-[#F27D26]">SCHOLAR</span>
        </motion.h1>
        <p className="text-white/60 mb-8 text-lg font-light">
          Sign in to your account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#F27D26] text-white"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#F27D26] text-white"
            required
          />
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#F27D26] text-white rounded-xl font-bold text-lg hover:bg-[#d66a1e] transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/40 text-sm">OR</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <button
          onClick={login}
          className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-xl font-bold text-lg hover:bg-white/10 transition-all"
        >
          Sign in with Google
        </button>
        
        <p className="mt-8 text-white/20 text-[10px] uppercase font-bold tracking-widest">
          Private Access Only
        </p>
      </div>
    </div>
  );
};

const DashboardRedirect = () => {
  const { profile } = useAuth();
  if (!profile) return <Navigate to="/login" />;
  
  if (profile.role === 'admin') return <AdminDashboard />;
  if (profile.role === 'teacher') return <TeacherDashboard />;
  return <StudentDashboard />;
};

import { Component, ErrorInfo, ReactNode } from 'react';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || String(this.state.error);
      let isFirestoreError = false;
      
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error && parsed.operationType) {
          errorMessage = `Firestore ${parsed.operationType} error: ${parsed.error}`;
          isFirestoreError = true;
        }
      } catch (e) {
        // Not a JSON error, keep original message
      }

      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#050505] text-white p-6 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
            <X className="text-red-500" size={32} />
          </div>
          <h2 className="text-4xl font-bold mb-4">Something went wrong.</h2>
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 max-w-2xl w-full mb-8">
            <p className="text-white/60 mb-4">
              {isFirestoreError 
                ? "A database permission or configuration error occurred. Please contact support if this persists."
                : "An unexpected error occurred in the application."}
            </p>
            <pre className="bg-black/50 p-4 rounded-lg text-xs font-mono text-left overflow-auto max-h-48 text-red-400 border border-red-500/20">
              {errorMessage}
            </pre>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-[#F27D26] text-white rounded-xl font-bold hover:bg-[#d66a1e] transition-colors"
            >
              Reload App
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-8 py-3 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-colors border border-white/10"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster theme="dark" position="top-right" />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout><DashboardRedirect /></Layout>} />
            <Route path="/schools" element={<Layout><Schools /></Layout>} />
            <Route path="/teachers" element={<Layout><Teachers /></Layout>} />
            <Route path="/students" element={<Layout><StudentsPage /></Layout>} />
            <Route path="/courses" element={<Layout><Courses /></Layout>} />
            <Route path="/attendance" element={<Layout><AttendancePage /></Layout>} />
            <Route path="/content" element={<Layout><ContentManager /></Layout>} />
            <Route path="/reports" element={<Layout><ReportsPage /></Layout>} />
            <Route path="/logs" element={<Layout><Logs /></Layout>} />
            <Route path="/projects" element={<Layout><Projects /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

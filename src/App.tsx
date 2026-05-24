import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { LogOut, BookOpen, Users, ClipboardList, LayoutDashboard, Settings as SettingsIcon, Menu, X, Plus, ExternalLink, Camera, LayoutGrid, Wallet, ChevronDown, ShieldAlert, GraduationCap, Eye, RefreshCw } from 'lucide-react';
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
import Expenses from './pages/Expenses';

// --- Components ---

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { 
    profile, 
    loading, 
    logout, 
    realRole, 
    activeRole, 
    changeActiveRole, 
    activeAdminSubRole, 
    changeActiveAdminSubRole 
  } = useAuth();
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-[#050505] text-white">Loading...</div>;
  if (!profile) return <Navigate to="/login" />;

  const role = profile.role;

  // Custom filtering based on Role and Administrative Authority
  const getLinks = () => {
    if (role === 'admin') {
      const sub = profile.adminSubRole || 'Super Admin';
      if (sub === 'User Manager Admin') {
        return [
          { name: 'Schools', path: '/schools', icon: Users },
          { name: 'Teachers', path: '/teachers', icon: Users },
          { name: 'Students', path: '/students', icon: Users },
          { name: 'Reports', path: '/reports', icon: ClipboardList },
          { name: 'Settings', path: '/settings', icon: SettingsIcon },
        ];
      } else if (sub === 'Curriculum Admin') {
        return [
          { name: 'Curriculum', path: '/content', icon: BookOpen },
          { name: 'Expenses', path: '/expenses', icon: Wallet },
          { name: 'Settings', path: '/settings', icon: SettingsIcon },
        ];
      } else {
        // Super Admin
        return [
          { name: 'Schools', path: '/schools', icon: Users },
          { name: 'Teachers', path: '/teachers', icon: Users },
          { name: 'Students', path: '/students', icon: Users },
          { name: 'Curriculum', path: '/content', icon: BookOpen },
          { name: 'Reports', path: '/reports', icon: ClipboardList },
          { name: 'Expenses', path: '/expenses', icon: Wallet },
          { name: 'Settings', path: '/settings', icon: SettingsIcon },
        ];
      }
    }

    if (role === 'teacher') {
      return [
        { name: 'My Courses', path: '/courses', icon: BookOpen },
        { name: 'Attendance', path: '/attendance', icon: Users },
        { name: 'Content Control', path: '/content', icon: LayoutGrid },
        { name: 'Logs', path: '/logs', icon: ClipboardList },
        { name: 'Travel Expenses', path: '/expenses', icon: Wallet },
        { name: 'Settings', path: '/settings', icon: SettingsIcon },
      ];
    }

    if (role === 'student') {
      return [
        { name: 'My Projects', path: '/projects', icon: ClipboardList },
        { name: 'Settings', path: '/settings', icon: SettingsIcon },
      ];
    }

    return [{ name: 'Settings', path: '/settings', icon: SettingsIcon }];
  };

  const links = getLinks();

  // Map user role to readable rights description
  const getRoleBadge = () => {
    switch(role) {
      case 'admin': {
        const sub = profile.adminSubRole || 'Super Admin';
        return { 
          title: sub, 
          desc: sub === 'Super Admin' ? 'Full Authority Account' : (sub === 'User Manager Admin' ? 'In charge of teachers/students' : 'Curriculum & subject manager'), 
          color: sub === 'Super Admin' ? 'text-[#F27D26] bg-[#F27D26]/10 border-[#F27D26]/20' : 'text-purple-400 bg-purple-500/10 border-purple-500/20' 
        };
      }
      case 'teacher':
        return { title: 'Teacher', desc: 'Classroom Controls', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
      case 'student':
        return { title: 'Student', desc: 'Learning Portal', color: 'text-green-400 bg-green-500/10 border-green-500/20' };
      default:
        return { title: 'User', desc: 'General Access', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' };
    }
  };

  const badge = getRoleBadge();

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white overflow-hidden">
      {/* PERSPECTIVE SWITCHING INDICATOR BAR (if simulating) */}
      {((realRole === 'admin' && (activeRole || profile.adminSubRole !== 'Super Admin')) || 
        (realRole !== 'admin' && activeRole && activeRole !== realRole)) && (
        <div className="bg-[#F27D26] text-white text-[10px] font-bold uppercase tracking-widest text-center py-1 px-4 flex items-center justify-center gap-2 relative z-50">
          <Eye size={12} className="animate-pulse" />
          <span>Simulation Viewport Active: You are experiencing layout as a <b className="underline font-extrabold">{role}</b>{realRole === 'admin' ? ` (${profile.adminSubRole || 'Super Admin'})` : ''}</span>
          <button 
            onClick={() => {
              changeActiveRole(null);
              changeActiveAdminSubRole('Super Admin');
            }}
            className="ml-3 bg-white/20 hover:bg-white/30 text-[9px] px-2 py-0.5 rounded transition-all italic font-normal text-white uppercase tracking-normal"
          >
            Reset view
          </button>
        </div>
      )}

      {/* GLOBAL HEADER/NAVBAR */}
      <header className="h-16 border-b border-white/10 bg-[#151619]/90 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-30">
        <Link to="/" className="flex flex-col select-none">
          <h1 className="text-xl font-bold tracking-tighter text-white">
            FUN<span className="text-[#F27D26]">SCHOLAR</span>
          </h1>
          <p className="text-[8px] uppercase tracking-[0.2em] opacity-40 font-mono -mt-1">Robotics LMS</p>
        </Link>

        <div className="flex items-center gap-3">
          {/* Creator Role Selector Trigger Widget */}
          {(realRole === 'admin' || (profile?.roles && profile.roles.length > 1)) && (
            <div className="relative">
              <button
                onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-bold cursor-pointer select-none",
                  activeRole || profile.adminSubRole !== 'Super Admin'
                    ? "bg-[#F27D26]/20 text-[#F27D26] border-[#F27D26]/40 hover:bg-[#F27D26]/30"
                    : "bg-white/5 text-white/85 border-white/10 hover:bg-white/10 hover:text-white"
                )}
              >
                <Eye size={13} className="shrink-0" />
                <span className="hidden sm:inline text-[10px] uppercase font-bold tracking-wider">Switch Role</span>
                <ChevronDown size={13} className={cn("transition-transform duration-200", isSwitcherOpen ? "rotate-180" : "")} />
              </button>
              
              <AnimatePresence>
                {isSwitcherOpen && (
                  <>
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsSwitcherOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-72 bg-[#151619] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 space-y-4 text-left"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Eye size={12} className="text-[#F27D26]" />
                          <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-[#F27D26]">Switch Layout Role</h4>
                        </div>
                        <div className="space-y-1">
                          {[
                            { id: 'admin', label: 'Admin View', desc: 'System statistics, settings & reports', icon: ShieldAlert },
                            { id: 'teacher', label: 'Teacher View', desc: 'Class courses, attendance & activity logs', icon: Users },
                            { id: 'student', label: 'Student View', desc: 'Robotics modules, projects & code submissions', icon: GraduationCap }
                          ].filter((item) => {
                            if (realRole === 'admin' || profile?.email?.toLowerCase() === 'info@funscholar.com') return true;
                            return profile?.roles?.includes(item.id as any);
                          }).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                changeActiveRole(item.id as any);
                                setIsSwitcherOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-all border",
                                role === item.id 
                                  ? "bg-[#F27D26]/10 border-[#F27D26]/30 text-white font-semibold" 
                                  : "bg-transparent border-transparent text-white/50 hover:text-white hover:bg-white/5"
                              )}
                            >
                              <item.icon size={15} className="mt-0.5 shrink-0 text-[#F27D26]" />
                              <div>
                                <p className="text-xs font-medium leading-tight">{item.label}</p>
                                <p className="text-[9px] text-white/40 font-mono mt-0.5 leading-tight">{item.desc}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {role === 'admin' && realRole === 'admin' && (
                        <div className="pt-3 border-t border-white/5">
                          <div className="flex items-center gap-1.5 mb-2">
                            <ShieldAlert size={12} className="text-purple-400" />
                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-purple-400">Admin Sub-Authority</h4>
                          </div>
                          <div className="space-y-1">
                            {[
                              { label: 'Super Admin', desc: 'Can see and perform all tasks' },
                              { label: 'User Manager Admin', desc: 'In charge of schools, teachers & students' },
                              { label: 'Curriculum Admin', desc: 'In charge of subject syndication & content' }
                            ].map((subOpt) => (
                              <button
                                key={subOpt.label}
                                type="button"
                                onClick={() => {
                                  changeActiveAdminSubRole(subOpt.label);
                                  setIsSwitcherOpen(false);
                                }}
                                className={cn(
                                  "w-full flex flex-col p-2.5 rounded-xl text-left transition-all border",
                                  profile.adminSubRole === subOpt.label
                                    ? "bg-purple-500/10 border-purple-500/30 text-white font-semibold"
                                    : "bg-transparent border-transparent text-white/50 hover:text-white hover:bg-white/5"
                                )}
                              >
                                <span className="text-xs leading-none">{subOpt.label}</span>
                                <span className="text-[9px] text-white/40 font-mono mt-1 leading-tight">{subOpt.desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            changeActiveRole(null);
                            changeActiveAdminSubRole('Super Admin');
                            setIsSwitcherOpen(false);
                          }}
                          className="text-[9px] font-mono hover:text-white text-white/50 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw size={10} />
                          Reset to Administrative Defaults
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Rights Display & User Info */}
          <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 py-1 px-3 rounded-xl">
            <span className={cn("px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded border", badge.color)}>
              {badge.title}
            </span>
            <div className="hidden md:flex flex-col text-left leading-none">
              <span className="text-[10px] font-bold text-white/80">{profile.name || 'User'}</span>
              <span className="text-[8px] text-white/40 font-mono mt-0.5">{profile.email}</span>
            </div>
          </div>

          {/* Toggle Hamburger Button */}
          <button
            onClick={() => setIsNavOpen(!isNavOpen)}
            className="p-2 hover:bg-white/5 rounded-xl border border-white/10 text-white/80 hover:text-white transition-all flex items-center justify-center cursor-pointer font-bold"
            aria-label="Toggle navigation menu"
          >
            {isNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* DRAWER MENU CONTAINER */}
      <div className="flex-1 relative flex overflow-hidden">
        
        {/* VIEWPORT BACKDROP FOR DRAWER */}
        <AnimatePresence>
          {isNavOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNavOpen(false)}
              className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm pointer-events-auto"
            />
          )}
        </AnimatePresence>

        {/* SLIDING CONTEXT DRAWER RIG */}
        <AnimatePresence>
          {isNavOpen && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className="absolute top-0 right-0 h-full w-80 bg-[#151619] border-l border-white/10 z-50 shadow-2xl p-6 flex flex-col pointer-events-auto"
            >
              <div className="flex items-center justify-between pb-6 border-b border-white/5">
                <div className="flex flex-col">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Navigation</h3>
                  <span className="text-[10px] text-white/40 font-mono lowercase">{getRoleBadge().title} Account Menu</span>
                </div>
                <button 
                  onClick={() => setIsNavOpen(false)}
                  className="p-1 px-2 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/5 text-white/40 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <nav className="flex-1 py-4 space-y-1 overflow-y-auto custom-scrollbar">
                {links.map((link) => {
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setIsNavOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-semibold uppercase tracking-wider border",
                        isActive 
                          ? "bg-[#F27D26]/10 text-[#F27D26] border-[#F27D26]/20 font-bold" 
                          : "bg-transparent text-white/60 border-transparent hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <link.icon size={16} className={cn(isActive ? "text-[#F27D26]" : "opacity-60")} />
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-white/5 space-y-2">
                <button
                  onClick={() => {
                    setIsNavOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-3 px-4 py-3 w-full text-left rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors text-xs font-semibold uppercase tracking-wider border border-transparent hover:border-red-500/20"
                >
                  <LogOut size={16} />
                  Logout Account
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN VISUAL GALLERY WRAPPER */}
        <main className="flex-1 overflow-y-auto p-8 relative custom-scrollbar pointer-events-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
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
            <Route path="/expenses" element={<Layout><Expenses /></Layout>} />
            <Route path="/projects" element={<Layout><Projects /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

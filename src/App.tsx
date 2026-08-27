import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { auth } from './firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { LogOut, BookOpen, Users, ClipboardList, LayoutDashboard, Settings as SettingsIcon, Menu, X, Plus, ExternalLink, Camera, LayoutGrid, Wallet, ChevronDown, ShieldAlert, GraduationCap, Eye, EyeOff, RefreshCw, Trophy, Cpu, Sun, Moon, ArrowLeft, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import { Toaster, toast } from 'sonner';
import { logAudit } from './lib/audit';

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
import StudentSubmissions from './pages/StudentSubmissions';
import StudentsPage from './pages/Students';
import Expenses from './pages/Expenses';
import LeaderboardEvent from './pages/LeaderboardEvent';
import SimulationLab from './pages/SimulationLab';
import AdminCurriculum from './pages/AdminCurriculum';
import Photos from './pages/Photos';
import Chapter from './pages/Chapter';
import TeachingPanel from './pages/TeachingPanel';

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
  const [theme, setTheme] = useState<'day' | 'night'>(() => {
    const saved = localStorage.getItem('funscholar_theme');
    return (saved === 'day' || saved === 'night') ? saved : 'night';
  });

  useEffect(() => {
    if (theme === 'day') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('funscholar_theme', theme);
  }, [theme]);

  // Automatically log what pages teachers/users view
  useEffect(() => {
    if (profile) {
      const path = location.pathname;
      let pageName = '';
      if (path === '/') {
        pageName = 'Dashboard Home';
      } else if (path === '/schools') {
        pageName = 'Schools List';
      } else if (path === '/teachers') {
        pageName = 'Teachers Roster';
      } else if (path === '/students') {
        pageName = 'Students Roster';
      } else if (path === '/content') {
        pageName = 'Curriculum Manager';
      } else if (path === '/courses') {
        pageName = 'My Courses';
      } else if (path === '/submissions') {
        pageName = 'Student Submissions';
      } else if (path === '/projects') {
        pageName = 'Student Projects';
      } else if (path === '/logs') {
        pageName = 'Teacher Logbooks';
      } else if (path === '/teaching-panel') {
        pageName = 'Teaching Panel';
      } else if (path === '/reports') {
        pageName = 'System Audit Reports';
      } else if (path === '/expenses') {
        pageName = 'Travel Expenses';
      } else if (path === '/leaderboard-event') {
        pageName = 'Leaderboard Arena';
      } else if (path === '/simulation-lab') {
        pageName = 'Wokwi Microcontroller Simulator';
      } else if (path === '/photos') {
        pageName = 'Photos Module';
      } else if (path === '/settings') {
        pageName = 'Settings & Profile';
      } else {
        pageName = `Page ${path}`;
      }

      if (path && path !== '/login') {
        logAudit(profile, 'Open Page', `Viewed the ${pageName}`, { path });
      }
    }
  }, [location.pathname, profile?.uid]);

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-[#050505] text-white">Loading...</div>;
  if (!profile) {
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  const role = profile.role;

  // Custom filtering based on Role and Administrative Authority
  const getLinks = () => {
    if (role === 'admin') {
      const isSuper = profile.adminSubRole === 'Super Admin';
      const list = [
        { name: 'Home', path: '/', icon: LayoutDashboard }
      ];
      
      if (isSuper || profile.canAddSchool) {
        list.push({ name: 'Schools', path: '/schools', icon: Users });
      }
      if (isSuper || profile.canAddTeacher) {
        list.push({ name: 'Teachers', path: '/teachers', icon: Users });
      }
      if (isSuper || profile.canAddStudent) {
        list.push({ name: 'Students', path: '/students', icon: Users });
      }
      if (isSuper || profile.canManageContent) {
        list.push({ name: 'Curriculum', path: '/content', icon: BookOpen });
      }
      if (isSuper || profile.canAddStudent || profile.canAddTeacher) {
        list.push({ name: 'Reports', path: '/reports', icon: ClipboardList });
      }
      if (isSuper || profile.canManageContent || profile.canAddTeacher) {
        list.push({ name: 'Expenses', path: '/expenses', icon: Wallet });
      }
      list.push({ name: 'School-wise Curriculum', path: '/admin-curriculum', icon: BookOpen });
      list.push({ name: "Teacher's Logbooks", path: '/logs', icon: ClipboardList });
      list.push({ name: 'Leaderboard Arena', path: '/leaderboard-event', icon: Trophy });
      list.push({ name: 'Wokwi Simulator', path: '/simulation-lab', icon: Cpu });
      list.push({ name: 'Photos', path: '/photos', icon: Camera });
      // Settings is always visible for viewing profile or switching simulation views
      list.push({ name: 'Settings', path: '/settings', icon: SettingsIcon });
      
      return list;
    }

    if (role === 'teacher') {
      return [
        { name: 'Home', path: '/', icon: LayoutDashboard },
        { name: 'Teaching Panel', path: '/teaching-panel', icon: GraduationCap },
        { name: 'My Courses', path: '/courses', icon: BookOpen },
        { name: 'Student Submissions', path: '/submissions', icon: ClipboardList },
        { name: 'Content Control', path: '/content', icon: LayoutGrid },
        { name: 'Leaderboard Arena', path: '/leaderboard-event', icon: Trophy },
        { name: 'Wokwi Simulator', path: '/simulation-lab', icon: Cpu },
        { name: 'Logs', path: '/logs', icon: ClipboardList },
        { name: 'Travel Expenses', path: '/expenses', icon: Wallet },
        { name: 'Photos', path: '/photos', icon: Camera },
        { name: 'Settings', path: '/settings', icon: SettingsIcon },
      ];
    }

    if (role === 'student') {
      return [
        { name: 'Home', path: '/', icon: LayoutDashboard },
        { name: 'Leaderboard Arena', path: '/leaderboard-event', icon: Trophy },
        { name: 'My Projects', path: '/projects', icon: ClipboardList },
        { name: 'Wokwi Simulator', path: '/simulation-lab', icon: Cpu },
        { name: 'Settings', path: '/settings', icon: SettingsIcon },
      ];
    }

    return [
      { name: 'Home', path: '/', icon: LayoutDashboard },
      { name: 'Wokwi Simulator', path: '/simulation-lab', icon: Cpu },
      { name: 'Settings', path: '/settings', icon: SettingsIcon }
    ];
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
          {/* Day/Night Mode Toggle */}
          <button
            onClick={() => setTheme(theme === 'day' ? 'night' : 'day')}
            className="flex items-center justify-center p-2 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title={theme === 'day' ? "Switch to Night Mode (Dark)" : "Switch to Day Mode (Light)"}
          >
            {theme === 'day' ? <Moon size={15} className="text-[#F27D26]" /> : <Sun size={15} className="text-[#F27D26]" />}
          </button>

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
          <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 py-1.5 px-3 rounded-xl">
            {profile?.photoUrl ? (
              <img 
                src={profile.photoUrl} 
                alt={profile.name || 'User'} 
                className="w-7 h-7 rounded-full object-cover border border-[#F27D26]/40 shadow-sm hover:scale-105 transition-transform" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <span className={cn("px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded border", badge.color)}>
                {badge.title}
              </span>
            )}
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
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirectPath = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password Reset Request State
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  if (profile) return <Navigate to={redirectPath} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithEmail(email, password, rememberMe);
    } catch (err: any) {
      console.error("Login failed:", err);
      // Map standard firebase errors or dummy accounts issues to "Incorrect password"
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError('Incorrect password. If you forgot your password, please request a password reset below.');
      } else {
        setError('Incorrect password. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setSendingRequest(true);
    setError('');
    let firebaseEmailSent = false;
    
    // 1. Try sending the native password reset email via Firebase Auth first
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase());
      firebaseEmailSent = true;
    } catch (firebaseErr: any) {
      console.warn("Firebase native sendPasswordResetEmail failed:", firebaseErr);
    }

    // 2. Submit to the admin panel database (Firestore) so the admin is notified and has it in their logs
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');
      
      setRequestSent(true);
      if (firebaseEmailSent) {
        toast.success('A password reset link has been emailed to you via Firebase! An admin request has also been logged.');
      } else {
        toast.success('Admin password reset request logged successfully!');
      }
    } catch (err: any) {
      console.error("Failed to send reset request:", err);
      // If Firebase email succeeded but server database sync failed, we still consider it a success!
      if (firebaseEmailSent) {
        setRequestSent(true);
        toast.success('A password reset link was emailed to you by Firebase!');
      } else {
        setError(err.message || 'Failed to send request. Please try again.');
      }
    } finally {
      setSendingRequest(false);
    }
  };

  const mailtoUrl = `mailto:risheb@funscholar.com?subject=FunScholar Password Reset Request&body=Hi Admin,%0D%0DPlease reset the password for my FunScholar account:%0DEmail: ${encodeURIComponent(resetEmail || email)}%0D%0DThank you!`;

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

        {!isRequestingReset ? (
          <>
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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#F27D26] text-white pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer p-1 rounded hover:bg-white/5"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              <div className="flex items-center gap-2.5 px-1 py-0.5 text-left">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/15 bg-white/5 text-[#F27D26] focus:ring-0 focus:ring-offset-0 accent-[#F27D26] cursor-pointer"
                />
                <label htmlFor="rememberMe" className="text-white/60 hover:text-white text-xs select-none cursor-pointer font-medium">
                  Remember Me (Stay logged in for 30–90 days)
                </label>
              </div>

              {error && (
                <div className="text-left bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 space-y-2">
                  <p className="text-red-400 text-xs font-semibold leading-relaxed">{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setIsRequestingReset(true);
                      setError('');
                    }}
                    className="text-[#F27D26] hover:text-[#d66a1e] font-bold text-xs underline cursor-pointer"
                  >
                    Reset Password via Admin Request →
                  </button>
                </div>
              )}
              
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#F27D26] text-white rounded-xl font-bold text-lg hover:bg-[#d66a1e] transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Processing...' : 'Sign In'}
              </button>
            </form>

            <div className="flex justify-between items-center px-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setIsRequestingReset(true);
                  setError('');
                }}
                className="text-white/40 hover:text-white text-xs font-semibold transition-colors cursor-pointer hover:underline"
              >
                Forgot Password?
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/40 text-sm">OR</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              onClick={() => login(rememberMe)}
              className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-xl font-bold text-lg hover:bg-white/10 transition-all cursor-pointer"
            >
              Sign in with Google
            </button>
          </>
        ) : (
          <div className="bg-[#151619] border border-white/5 rounded-2xl p-6 text-left space-y-4">
            <div className="flex items-center gap-2 text-white/40">
              <button
                type="button"
                onClick={() => {
                  setIsRequestingReset(false);
                  setRequestSent(false);
                  setError('');
                }}
                className="hover:text-white transition-colors p-1 rounded hover:bg-white/5 flex items-center gap-1 text-xs cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            </div>

            <h2 className="text-xl font-bold text-white font-sans tracking-tight">Reset Account Password</h2>
            <p className="text-white/60 text-xs leading-relaxed">
              If you cannot receive normal reset emails or use a specialized login email, you can send a password reset request directly to the system administrator.
            </p>

            {!requestSent ? (
              <form onSubmit={handleSendResetRequest} className="space-y-4 pt-2">
                <div>
                  <label className="text-[10px] text-white/50 uppercase tracking-wider font-semibold block mb-1">
                    Your Registered Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. user@school.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-[#050505] border border-white/10 rounded-xl focus:outline-none focus:border-[#F27D26] text-white"
                    required
                  />
                </div>

                {error && <p className="text-red-500 text-xs">{error}</p>}

                <button
                  type="submit"
                  disabled={sendingRequest}
                  className="w-full py-3.5 bg-[#F27D26] text-white rounded-xl font-bold hover:bg-[#d66a1e] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Mail size={16} />
                  {sendingRequest ? 'Submitting Request...' : 'Send Reset Request to Admin'}
                </button>
              </form>
            ) : (
              <div className="space-y-4 pt-2 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center text-green-400">
                  <Mail size={20} />
                </div>
                <div className="space-y-1">
                  <p className="text-green-400 font-bold text-sm">Reset Link & Ticket Created!</p>
                  <p className="text-white/60 text-xs">
                    We have requested an automated Firebase password reset link for your email address. Please check your inbox and spam folder.
                  </p>
                  <p className="text-white/40 text-[11px]">
                    Additionally, your ticket has been successfully registered in the Admin Panel database.
                  </p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl text-left space-y-2">
                  <p className="text-[11px] text-white/50 font-medium">
                    If your account email is not configured to receive mail, or to ensure immediate attention from the administrator at <span className="text-white/80 font-bold font-sans">risheb@funscholar.com</span>, you can also send a direct notification:
                  </p>
                  
                  <a
                    href={mailtoUrl}
                    className="w-full py-2.5 bg-white/5 border border-white/10 text-white rounded-lg font-bold text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-2 hover:border-[#F27D26]/40 text-center cursor-pointer"
                  >
                    <ExternalLink size={12} className="text-[#F27D26]" />
                    Send Email to risheb@funscholar.com
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsRequestingReset(false);
                    setRequestSent(false);
                  }}
                  className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10 transition-all text-xs cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            )}
          </div>
        )}
        
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
  useEffect(() => {
    const saved = localStorage.getItem('funscholar_theme');
    if (saved === 'day') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, []);

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
            <Route path="/submissions" element={<Layout><StudentSubmissions /></Layout>} />
            <Route path="/content" element={<Layout><ContentManager /></Layout>} />
            <Route path="/reports" element={<Layout><ReportsPage /></Layout>} />
            <Route path="/logs" element={<Layout><Logs /></Layout>} />
            <Route path="/teaching-panel" element={<Layout><TeachingPanel /></Layout>} />
            <Route path="/expenses" element={<Layout><Expenses /></Layout>} />
            <Route path="/projects" element={<Layout><Projects /></Layout>} />
            <Route path="/leaderboard-event" element={<Layout><LeaderboardEvent /></Layout>} />
            <Route path="/simulation-lab" element={<Layout><SimulationLab /></Layout>} />
            <Route path="/admin-curriculum" element={<Layout><AdminCurriculum /></Layout>} />
            <Route path="/photos" element={<Layout><Photos /></Layout>} />
            <Route path="/chapter/:id" element={<Layout><Chapter /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

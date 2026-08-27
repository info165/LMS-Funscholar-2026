import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { School, UserProfile, Course, Submission, TeacherLog } from '../types';
import { 
  FileText, Download, TrendingUp, Users, BookOpen, School as SchoolIcon, 
  PieChart as PieChartIcon, BarChart as BarChartIcon, Star, Clock, 
  Search, Filter, ShieldAlert, CheckCircle, RefreshCw, Layers, Printer, Calendar, ArrowRight, Eye, User, Settings, AlertCircle, X, Maximize2, Minimize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../AuthContext';
import { AuditLog } from '../lib/audit';

// Safe date/time formatting helpers to avoid "Invalid Date"
const safeFormatDate = (timestamp: any): string => {
  if (!timestamp) return 'Just now';
  // If Firestore Timestamp object
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleDateString();
  }
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000).toLocaleDateString();
  }
  // If string or number
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) {
    return 'Just now';
  }
  return d.toLocaleDateString();
};

const safeFormatDateTime = (timestamp: any): string => {
  if (!timestamp) return 'Just now';
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) {
    return 'Just now';
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const safeGetTime = (timestamp: any): number => {
  if (!timestamp) return 0;
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().getTime();
  }
  if (timestamp.seconds !== undefined) {
    return timestamp.seconds * 1000;
  }
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) {
    return 0;
  }
  return d.getTime();
};

export default function ReportsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'admin' && profile?.adminSubRole === 'Super Admin';

  const [activeTab, setActiveTab] = useState<'analytics' | 'audit'>('analytics');

  // Existing collections states
  const [schools, setSchools] = useState<School[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [logs, setLogs] = useState<TeacherLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Brand-new audit logs collection state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  // Enlarged views state
  const [isClassLogsEnlarged, setIsClassLogsEnlarged] = useState(false);
  const [selectedTeacherLog, setSelectedTeacherLog] = useState<TeacherLog | null>(null);
  const [isModalEnlarged, setIsModalEnlarged] = useState(false);
  
  // Trainer Class Logs Enlarged Filters State
  const [classLogSearch, setClassLogSearch] = useState('');
  const [classLogSchoolFilter, setClassLogSchoolFilter] = useState('all');
  const [classLogTeacherFilter, setClassLogTeacherFilter] = useState('all');
  const [classLogCourseFilter, setClassLogCourseFilter] = useState('all');

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [userIdFilter, setUserIdFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('current-month');

  // Print Summary Report Modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMonth, setPrintMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setTeachers(allUsers.filter(u => u.role === 'teacher'));
      setStudents(allUsers.filter(u => u.role === 'student'));
    });

    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    });

    const unsubSubmissions = onSnapshot(collection(db, 'submissions'), (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    });

    const unsubLogs = onSnapshot(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(15)), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherLog)));
    });

    // Real-time subscription to the interaction audit logs
    const unsubAudits = onSnapshot(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc')), (snapshot) => {
      setAuditLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
      setLoading(false);
    }, (error) => {
      console.error("Failed to load audit logs in real-time:", error);
      setLoading(false);
    });

    return () => {
      unsubSchools();
      unsubUsers();
      unsubCourses();
      unsubSubmissions();
      unsubLogs();
      unsubAudits();
    };
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 space-y-6">
        <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center border border-red-500/20 shadow-lg shadow-red-500/5">
          <ShieldAlert size={40} />
        </div>
        <div className="max-w-md">
          <h2 className="text-2xl font-bold text-white tracking-tight">Access Restricted</h2>
          <p className="text-white/60 mt-3 text-sm leading-relaxed">
            The reporting dashboard contains protected educational files, system metrics, and student/teacher interaction audit logs. Only platform administrators and super-admins are authorized to access this panel.
          </p>
        </div>
      </div>
    );
  }

  // School data calculation for chart
  const schoolData = schools.map(school => ({
    name: school.name,
    students: students.filter(s => s.schoolIds?.includes(school.id)).length,
    teachers: teachers.filter(t => t.schoolIds?.includes(school.id)).length,
    courses: courses.filter(c => c.schoolId === school.id).length
  }));

  const roleDistribution = [
    { name: 'Admins', value: 1, color: '#F27D26' },
    { name: 'Teachers', value: teachers.length, color: '#3b82f6' },
    { name: 'Students', value: students.length, color: '#10b981' }
  ];

  const topStudents = [...students]
    .sort((a, b) => (b.xp || 0) - (a.xp || 0))
    .slice(0, 5);

  const downloadReport = () => {
    const reportData = {
      summary: {
        totalSchools: schools.length,
        totalTeachers: teachers.length,
        totalStudents: students.length,
        totalCourses: courses.length,
        totalSubmissions: submissions.length,
        totalAuditLogs: auditLogs.length
      },
      schools: schoolData,
      topStudents: topStudents.map(s => ({ name: s.name, xp: s.xp, level: s.level }))
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `funscholar_system_report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // Filter audit logs based on selected filters
  const filteredAuditLogs = auditLogs.filter(log => {
    // 1. Search Query
    const searchString = `${log.userName} ${log.userEmail} ${log.action} ${log.details}`.toLowerCase();
    if (searchQuery.trim() && !searchString.includes(searchQuery.toLowerCase())) {
      return false;
    }

    // 2. Role Filter
    if (roleFilter !== 'all' && log.userRole !== roleFilter) {
      return false;
    }

    // 2.5 Specific User Filter
    if (userIdFilter !== 'all' && log.userId !== userIdFilter) {
      return false;
    }

    // 3. Action Filter
    if (actionFilter !== 'all') {
      const actLower = log.action.toLowerCase();
      if (actionFilter === 'login' && !actLower.includes('login')) return false;
      if (actionFilter === 'file-open' && !actLower.includes('open module')) return false;
      if (actionFilter === 'page-view' && !actLower.includes('open page')) return false;
      if (actionFilter === 'user-mutation' && !actLower.includes('user') && !actLower.includes('student') && !actLower.includes('teacher')) return false;
      if (actionFilter === 'school-mutation' && !actLower.includes('school')) return false;
      if (actionFilter === 'curriculum-mutation' && !actLower.includes('course') && !actLower.includes('module')) return false;
      if (actionFilter === 'simulation' && !actLower.includes('simulation') && !actLower.includes('workspace')) return false;
    }

    // 4. Time Filter
    const logTimeMs = safeGetTime(log.timestamp);
    const logDate = new Date(logTimeMs);
    const now = new Date();
    if (timeFilter === 'current-month') {
      if (logDate.getMonth() !== now.getMonth() || logDate.getFullYear() !== now.getFullYear()) {
        return false;
      }
    } else if (timeFilter === 'last-30') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (logTimeMs < thirtyDaysAgo.getTime()) return false;
    } else if (timeFilter === 'prev-month') {
      let prevMonth = now.getMonth() - 1;
      let prevYear = now.getFullYear();
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }
      if (logDate.getMonth() !== prevMonth || logDate.getFullYear() !== prevYear) {
        return false;
      }
    }

    // 5. School filter
    if (schoolFilter !== 'all') {
      // Find user to check mapping or check metadata schoolId
      const targetUser = [...teachers, ...students].find(u => u.uid === log.userId);
      const isMapped = targetUser?.schoolIds?.includes(schoolFilter) || log.metadata?.schoolId === schoolFilter;
      if (!isMapped) return false;
    }

    return true;
  });

  // Export filtered logs to CSV spreadsheet format
  const downloadAuditCSV = () => {
    const headers = ['Timestamp', 'User Name', 'User Email', 'Role', 'Action Event', 'Details Summary'];
    const rows = filteredAuditLogs.map(log => [
      safeFormatDateTime(log.timestamp),
      log.userName,
      log.userEmail,
      log.userRole,
      log.action,
      log.details.replace(/"/g, '""')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `funscholar_audit_log_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  // Generate metrics for printable summary report
  const getMonthlyPrintMetrics = (yearMonthStr: string) => {
    const [year, month] = yearMonthStr.split('-').map(Number);
    const monthLogs = auditLogs.filter(log => {
      const d = new Date(safeGetTime(log.timestamp));
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    const totalLogins = monthLogs.filter(l => l.action.toLowerCase().includes('login')).length;
    const totalFilesOpened = monthLogs.filter(l => l.action.toLowerCase().includes('open module')).length;
    const totalCurriculumAdded = monthLogs.filter(l => l.action.toLowerCase().includes('add course') || l.action.toLowerCase().includes('add module')).length;
    const totalUserMutations = monthLogs.filter(l => l.action.toLowerCase().includes('add user') || l.action.toLowerCase().includes('edit user') || l.action.toLowerCase().includes('delete user') || l.action.toLowerCase().includes('student')).length;

    return {
      monthLogs,
      totalLogins,
      totalFilesOpened,
      totalCurriculumAdded,
      totalUserMutations
    };
  };

  const selectedMonthMetrics = getMonthlyPrintMetrics(printMonth);
  const monthName = new Date(Number(printMonth.split('-')[0]), Number(printMonth.split('-')[1]) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8">
      {/* Title Header with Export Controls */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-4xl font-sans font-bold tracking-tight text-white flex items-center gap-3">
            System Reporting Terminal
          </h2>
          <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">
            Secure interaction analytics, monthly audit trails & school diagnostic logs
          </p>
        </div>
        
        {/* Sliding View Switcher Tabs */}
        <div className="flex gap-2 bg-white/5 p-1.5 rounded-xl border border-white/5 font-sans font-medium text-xs">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'analytics' ? 'bg-[#F27D26] text-white shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            <BarChartIcon size={14} />
            LMS Analytics
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit' ? 'bg-[#F27D26] text-white shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            <Clock size={14} />
            User Interaction Logs
          </button>
        </div>
      </header>

      {/* Main Content Render */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <RefreshCw className="animate-spin text-[#F27D26] mr-3" size={24} />
          <span className="font-mono text-xs text-white/50 uppercase tracking-widest">Compiling audit state database...</span>
        </div>
      ) : activeTab === 'analytics' ? (
        // TAB 1: System-wide Visual Analytics & Leaderboards
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Quick Metrics Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-[#151619] border border-white/5 rounded-2xl relative overflow-hidden group hover:border-[#F27D26]/20 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 rounded-xl bg-[#F27D26]/10 text-[#F27D26]">
                  <SchoolIcon size={20} />
                </div>
                <h3 className="text-white/50 text-xs uppercase font-bold tracking-wider">Total Schools</h3>
              </div>
              <p className="text-4xl font-sans font-bold text-white">{schools.length}</p>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#F27D26]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            </div>
            
            <div className="p-6 bg-[#151619] border border-white/5 rounded-2xl relative overflow-hidden group hover:border-blue-500/20 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                  <Users size={20} />
                </div>
                <h3 className="text-white/50 text-xs uppercase font-bold tracking-wider">Active Teachers</h3>
              </div>
              <p className="text-4xl font-sans font-bold text-white">{teachers.length}</p>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            </div>

            <div className="p-6 bg-[#151619] border border-white/5 rounded-2xl relative overflow-hidden group hover:border-green-500/20 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 rounded-xl bg-green-500/10 text-green-400">
                  <Users size={20} />
                </div>
                <h3 className="text-white/50 text-xs uppercase font-bold tracking-wider">Registered Students</h3>
              </div>
              <p className="text-4xl font-sans font-bold text-white">{students.length}</p>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            </div>

            <div className="p-6 bg-[#151619] border border-white/5 rounded-2xl relative overflow-hidden group hover:border-purple-500/20 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                  <BookOpen size={20} />
                </div>
                <h3 className="text-white/50 text-xs uppercase font-bold tracking-wider">Total Courses</h3>
              </div>
              <p className="text-4xl font-sans font-bold text-white">{courses.length}</p>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            </div>
          </div>

          {/* Graphical Distributions Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <BarChartIcon className="text-[#F27D26]" size={20} />
                  <h3 className="text-xl font-bold text-white">School Performance Index</h3>
                </div>
                <span className="text-[10px] bg-white/5 text-white/50 uppercase px-2.5 py-1 rounded-full font-mono font-bold tracking-wider">Enrollments</span>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={schoolData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                    <XAxis dataKey="name" stroke="#ffffff30" fontSize={11} tickLine={false} />
                    <YAxis stroke="#ffffff30" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="students" fill="#F27D26" name="Students" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="teachers" fill="#3b82f6" name="Teachers" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-8">
                <PieChartIcon className="text-[#F27D26]" size={20} />
                <h3 className="text-xl font-bold text-white">System User Demographics</h3>
              </div>
              <div className="h-[300px] flex flex-col sm:flex-row items-center justify-around gap-6">
                <div className="w-[200px] h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={roleDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {roleDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4 font-sans text-xs w-full sm:w-auto">
                  {roleDistribution.map((role) => (
                    <div key={role.name} className="flex items-center gap-6 justify-between border-b border-white/5 pb-2 min-w-[160px]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                        <span className="font-bold text-white/70">{role.name}</span>
                      </div>
                      <span className="font-mono font-bold text-white text-sm">{role.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Underlay Side Panels (Top Students + System Logs) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-8">
                <Star className="text-yellow-400" size={20} />
                <h3 className="text-xl font-bold text-white">Top Performing Students</h3>
              </div>
              <div className="space-y-4">
                {topStudents.length === 0 ? (
                  <p className="text-white/40 text-xs py-4">No student standings recorded yet.</p>
                ) : (
                  topStudents.map((student, index) => (
                    <div key={student.uid} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                      <div className="w-8 h-8 rounded-full bg-[#F27D26]/20 text-[#F27D26] flex items-center justify-center font-sans font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-sans font-bold text-white text-sm">{student.name}</p>
                        <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest font-mono">Level {student.level} • {student.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#F27D26] font-sans font-bold text-sm">{student.xp} XP</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <Clock className="text-blue-400" size={20} />
                  <h3 className="text-xl font-bold text-white">Recent Trainer Class Logs</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsClassLogsEnlarged(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F27D26]/10 border border-[#F27D26]/20 hover:bg-[#F27D26]/25 rounded-lg text-[11px] font-bold text-[#F27D26] uppercase tracking-wider transition-all cursor-pointer"
                    title="Enlarge and filter class logs"
                  >
                    <Maximize2 size={12} />
                    Enlarge Logs
                  </button>
                  <button
                    onClick={downloadReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-[11px] font-bold text-white uppercase tracking-wider transition-all"
                  >
                    <Download size={12} />
                    JSON DB Dump
                  </button>
                </div>
              </div>
              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                {logs.length === 0 ? (
                  <p className="text-white/40 text-xs py-4">No recent class session activity logged.</p>
                ) : (
                  logs.map((log) => (
                    <div 
                      key={log.id} 
                      onClick={() => setSelectedTeacherLog(log)}
                      className="p-4 bg-white/5 hover:bg-white/[0.08] rounded-xl border border-white/5 transition-all cursor-pointer"
                      title="Click to view full log details"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-white">{teachers.find(t => t.uid === log.teacherId)?.name || log.teacherName || 'Class Trainer'}</p>
                        <span className="text-[10px] text-white/30 font-mono">{safeFormatDate(log.timestamp)}</span>
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed line-clamp-2">{log.activity}</p>
                      <div className="mt-2.5 flex items-center gap-2 text-[10px] text-[#F27D26] font-bold uppercase tracking-widest font-mono">
                        <Clock size={10} />
                        {log.duration ? `${log.duration} mins class block` : 'N/A duration class block'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </motion.div>
      ) : (
        // TAB 2: Interactive Audit Reporting Terminal
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8 font-sans"
        >
          {/* Audit Metrics Aggregations */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#151619] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider font-mono">Current Month Logs</span>
              <p className="text-2xl font-bold text-white mt-1">
                {auditLogs.filter(l => {
                  const d = new Date(l.timestamp);
                  const n = new Date();
                  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
                }).length}
              </p>
            </div>
            <div className="bg-[#151619] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider font-mono">Total Logins</span>
              <p className="text-2xl font-bold text-blue-400 mt-1">
                {auditLogs.filter(l => l.action.toLowerCase().includes('login')).length}
              </p>
            </div>
            <div className="bg-[#151619] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider font-mono">Lessons Opened</span>
              <p className="text-2xl font-bold text-green-400 mt-1">
                {auditLogs.filter(l => l.action.toLowerCase().includes('open module')).length}
              </p>
            </div>
            <div className="bg-[#151619] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider font-mono">Curriculum Added</span>
              <p className="text-2xl font-bold text-[#F27D26] mt-1">
                {auditLogs.filter(l => l.action.toLowerCase().includes('add course') || l.action.toLowerCase().includes('add module')).length}
              </p>
            </div>
          </div>

          {/* Advanced Filter Panel */}
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <Filter className="text-[#F27D26]" size={18} />
                <h3 className="text-base font-bold text-white">Filter Audit Actions</h3>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  <Printer size={14} />
                  Print Monthly Summary
                </button>
                <button
                  onClick={downloadAuditCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  <Download size={14} />
                  Export CSV Report
                </button>
              </div>
            </div>

            {/* Inputs & Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {/* Text Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 text-white/40" size={16} />
                <input
                  type="text"
                  placeholder="Search user, email, detail..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1e2025] text-white text-xs pl-10 pr-4 py-3.5 rounded-xl border border-white/5 focus:outline-none focus:border-[#F27D26] placeholder:text-white/20 transition-all"
                />
              </div>

              {/* Role Filter */}
              <div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full bg-[#1e2025] text-white text-xs px-4 py-3.5 rounded-xl border border-white/5 focus:outline-none focus:border-[#F27D26] transition-all"
                >
                  <option value="all">All User Roles</option>
                  <option value="admin">Admins</option>
                  <option value="teacher">Teachers</option>
                  <option value="student">Students</option>
                </select>
              </div>

              {/* Specific User Filter */}
              <div>
                <select
                  value={userIdFilter}
                  onChange={(e) => setUserIdFilter(e.target.value)}
                  className="w-full bg-[#1e2025] text-white text-xs px-4 py-3.5 rounded-xl border border-white/5 focus:outline-none focus:border-[#F27D26] transition-all"
                >
                  <option value="all">All Specific Users</option>
                  <optgroup label="Teachers">
                    {teachers.map(t => (
                      <option key={t.uid} value={t.uid}>{t.name} (Teacher)</option>
                    ))}
                  </optgroup>
                  <optgroup label="Admins">
                    {/* Admins listing if any or fallback */}
                    <option value={profile?.uid}>Me (Admin)</option>
                  </optgroup>
                  <optgroup label="Students">
                    {students.slice(0, 15).map(s => (
                      <option key={s.uid} value={s.uid}>{s.name} (Student)</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Action Category Filter */}
              <div>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full bg-[#1e2025] text-white text-xs px-4 py-3.5 rounded-xl border border-white/5 focus:outline-none focus:border-[#F27D26] transition-all"
                >
                  <option value="all">All Categories</option>
                  <option value="login">Account Logins</option>
                  <option value="page-view">Page Views & Navigation</option>
                  <option value="file-open">Opened Files / Modules</option>
                  <option value="curriculum-mutation">Curriculum Mutations</option>
                  <option value="user-mutation">User Profile Changes</option>
                  <option value="school-mutation">School Org Changes</option>
                  <option value="simulation">Simulator Workspace</option>
                </select>
              </div>

              {/* School Filter */}
              <div>
                <select
                  value={schoolFilter}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                  className="w-full bg-[#1e2025] text-white text-xs px-4 py-3.5 rounded-xl border border-white/5 focus:outline-none focus:border-[#F27D26] transition-all"
                >
                  <option value="all">All Schools</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </div>

              {/* Time Interval Filter */}
              <div>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="w-full bg-[#1e2025] text-white text-xs px-4 py-3.5 rounded-xl border border-white/5 focus:outline-none focus:border-[#F27D26] transition-all"
                >
                  <option value="current-month">This Month</option>
                  <option value="last-30">Last 30 Days</option>
                  <option value="prev-month">Previous Month</option>
                  <option value="all-time">All Records</option>
                </select>
              </div>
            </div>
          </section>

          {/* Interactive Logs Table View */}
          <section className="bg-[#151619] border border-white/5 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1a1b1f] border-b border-white/5 text-[10px] text-white/50 uppercase tracking-wider font-mono">
                    <th className="py-4 px-6 font-semibold">User Profile</th>
                    <th className="py-4 px-6 font-semibold">Interaction Action</th>
                    <th className="py-4 px-6 font-semibold">Description details</th>
                    <th className="py-4 px-6 font-semibold">Logged Timestamp</th>
                    <th className="py-4 px-6 font-semibold text-center">Diagnostics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-white/80">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-white/40">
                        <AlertCircle className="mx-auto text-[#F27D26] mb-3" size={28} />
                        No logs match the current search filters. Try relaxing filters or checking older date ranges.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => {
                      // Custom colors and design elements for Role Badges
                      const roleStyles = 
                        log.userRole === 'admin' ? 'bg-orange-500/15 text-orange-400 border-orange-500/20' :
                        log.userRole === 'teacher' ? 'bg-blue-500/15 text-blue-400 border-blue-500/20' :
                        'bg-green-500/15 text-green-400 border-green-500/20';

                      return (
                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                          {/* User details block */}
                          <td className="py-4.5 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-white text-xs uppercase">
                                {log.userName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-white leading-tight">{log.userName}</p>
                                <p className="text-[10px] text-white/40 leading-none mt-1 font-mono">{log.userEmail}</p>
                              </div>
                            </div>
                          </td>

                          {/* Action event block with Badge */}
                          <td className="py-4.5 px-6 font-sans">
                            <div className="flex flex-col items-start gap-1.5">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleStyles}`}>
                                {log.userRole}
                              </span>
                              <span className="text-[11px] font-mono text-[#F27D26] font-bold uppercase tracking-wider">
                                {log.action}
                              </span>
                            </div>
                          </td>

                          {/* Description details block */}
                          <td className="py-4.5 px-6 max-w-sm">
                            <p className="text-white/70 line-clamp-2 leading-relaxed">{log.details}</p>
                          </td>

                          {/* Beautiful Timestamp */}
                          <td className="py-4.5 px-6 font-mono text-[11px] text-white/40">
                            {safeFormatDateTime(log.timestamp)}
                          </td>

                          {/* Diagnostic inspection button */}
                          <td className="py-4.5 px-6 text-center">
                            <button
                              onClick={() => setSelectedAuditLog(log)}
                              className="p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-all cursor-pointer"
                              title="Inspect action technical metadata"
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination / Row counter */}
            <div className="p-4 bg-[#1a1b1f] border-t border-white/5 flex justify-between items-center text-[10px] font-mono text-white/40 uppercase tracking-widest">
              <span>Showing {filteredAuditLogs.length} matching interactions</span>
              <span>LMS Platform Security System</span>
            </div>
          </section>
        </motion.div>
      )}

      {/* METADATA DIAGNOSTICS MODAL INSPECTOR */}
      <AnimatePresence>
        {selectedAuditLog && (() => {
          const userTimelineLogs = auditLogs
            .filter(l => l.userId === selectedAuditLog.userId)
            .sort((a, b) => {
              const aTime = (a.timestamp as any)?.seconds ? (a.timestamp as any).seconds * 1000 : new Date(a.timestamp).getTime();
              const bTime = (b.timestamp as any)?.seconds ? (b.timestamp as any).seconds * 1000 : new Date(b.timestamp).getTime();
              return aTime - bTime;
            });

          return (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className={`bg-[#151619] border border-white/10 rounded-[2rem] w-full overflow-hidden shadow-2xl font-sans transition-all duration-300 flex flex-col max-h-[90vh] ${
                  isModalEnlarged ? 'max-w-5xl' : 'max-w-xl'
                }`}
              >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#191a1e]">
                  <div>
                    <h3 className="font-bold text-white text-lg flex items-center gap-2">
                      <ShieldAlert className="text-[#F27D26]" size={18} />
                      User Session & Journey Explorer
                    </h3>
                    <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest mt-1">
                      Inspecting: <span className="text-[#F27D26] font-bold">{selectedAuditLog.userName}</span> ({selectedAuditLog.userRole})
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsModalEnlarged(!isModalEnlarged)}
                      className="p-2 bg-white/5 hover:bg-[#F27D26]/10 text-white/60 hover:text-[#F27D26] border border-white/5 hover:border-[#F27D26]/20 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold uppercase"
                      title={isModalEnlarged ? "Compact view" : "Enlarge view to show timeline journey"}
                    >
                      {isModalEnlarged ? (
                        <>
                          <Minimize2 size={14} />
                          <span className="hidden sm:inline">Minimize</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 size={14} />
                          <span className="hidden sm:inline">Enlarge Journey Box</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAuditLog(null);
                        setIsModalEnlarged(false);
                      }}
                      className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-all border border-white/5"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Content body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                  <div className={`grid gap-8 ${isModalEnlarged ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                    
                    {/* Left Column - Details */}
                    <div className="space-y-5">
                      <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                          <div>
                            <span className="text-white/30 block uppercase text-[9px] tracking-wider font-bold">User Email</span>
                            <span className="text-white mt-1 block truncate" title={selectedAuditLog.userEmail}>{selectedAuditLog.userEmail}</span>
                          </div>
                          <div>
                            <span className="text-white/30 block uppercase text-[9px] tracking-wider font-bold">Log Event ID</span>
                            <span className="text-white mt-1 block truncate font-mono text-[10px]">{selectedAuditLog.id}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                          <div>
                            <span className="text-white/30 block uppercase text-[9px] tracking-wider font-bold">Exact Time</span>
                            <span className="text-[#F27D26] mt-1 block font-bold">{safeFormatDateTime(selectedAuditLog.timestamp)}</span>
                          </div>
                          <div>
                            <span className="text-white/30 block uppercase text-[9px] tracking-wider font-bold">Event Type / Action</span>
                            <span className="text-white mt-1 block font-bold uppercase">{selectedAuditLog.action}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-white/30 block uppercase text-[9px] tracking-wider font-mono font-bold">Event Log Description</span>
                        <div className="text-white/80 bg-white/5 p-4 rounded-2xl border border-white/5 text-xs leading-relaxed font-sans">
                          {selectedAuditLog.details}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-white/30 block uppercase text-[9px] tracking-wider font-mono font-bold">Diagnostic Payload Attributes</span>
                        <pre className="text-[10px] text-green-400 font-mono bg-[#111215] p-4 rounded-2xl border border-white/5 max-h-[160px] overflow-y-auto custom-scrollbar">
                          {JSON.stringify(selectedAuditLog.metadata || {}, null, 2)}
                        </pre>
                      </div>

                      {!isModalEnlarged && (
                        <div className="pt-2 text-center">
                          <button
                            onClick={() => setIsModalEnlarged(true)}
                            className="text-xs text-[#F27D26] hover:underline font-bold uppercase tracking-wider flex items-center gap-1.5 mx-auto bg-[#F27D26]/10 px-4 py-2 rounded-xl border border-[#F27D26]/20 cursor-pointer"
                          >
                            <Maximize2 size={12} />
                            Enlarge & View User Journey Timeline
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right Column - User Timeline Journey */}
                    {isModalEnlarged && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-white/30 block uppercase text-[10px] tracking-wider font-mono font-bold">
                            User Activity Timeline Journey
                          </span>
                          <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-[9px] font-mono text-white/50 uppercase">
                            {userTimelineLogs.length} events
                          </span>
                        </div>
                        <div className="border border-white/5 bg-white/[0.01] p-4 rounded-[1.5rem] space-y-4 max-h-[440px] overflow-y-auto custom-scrollbar">
                          {userTimelineLogs.length === 0 ? (
                            <p className="text-white/40 text-xs py-8 text-center">No other history logs found for this user.</p>
                          ) : (
                            userTimelineLogs.map((item, idx) => {
                              const isCurrent = item.id === selectedAuditLog.id;
                              const logTime = safeFormatDateTime(item.timestamp);
                              const durationStr = item.metadata?.sessionDuration || '';

                              return (
                                <div key={item.id || idx} className={`flex gap-3 relative pb-2 ${isCurrent ? 'bg-[#F27D26]/10 p-3 rounded-xl border border-[#F27D26]/20' : ''}`}>
                                  <div className="flex flex-col items-center shrink-0">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] ${
                                      item.action.toLowerCase().includes('login') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/25' :
                                      item.action.toLowerCase().includes('open') ? 'bg-green-500/20 text-green-400 border border-green-500/25' :
                                      item.action.toLowerCase().includes('logout') ? 'bg-red-500/20 text-red-400 border border-red-500/25' :
                                      'bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/25'
                                    }`}>
                                      {item.action.toLowerCase().includes('login') ? '🔑' :
                                       item.action.toLowerCase().includes('open') ? '👁️' :
                                       item.action.toLowerCase().includes('logout') ? '🚪' : '⚡'}
                                    </div>
                                    {idx < userTimelineLogs.length - 1 && (
                                      <div className="w-[1px] h-full bg-white/5 mt-1 min-h-[16px]" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-bold text-white font-mono uppercase tracking-wide">
                                        {item.action}
                                      </span>
                                      <span className="text-[9px] text-white/40 font-mono shrink-0">
                                        {logTime}
                                      </span>
                                    </div>
                                    <p className="text-xs text-white/60 mt-1 leading-relaxed">
                                      {item.details}
                                    </p>
                                    {durationStr && (
                                      <span className="inline-block mt-1.5 text-[9px] font-bold uppercase tracking-wider text-[#F27D26] font-mono bg-[#F27D26]/10 px-1.5 py-0.5 rounded border border-[#F27D26]/20">
                                        ⏱️ {durationStr} active session duration
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-[#1a1b1f] border-t border-white/5 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setSelectedAuditLog(null);
                      setIsModalEnlarged(false);
                    }}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer border border-white/5 transition-all"
                  >
                    Close Inspector
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* PRINT MONTHLY REPORT GENERATOR MODAL */}
      <AnimatePresence>
        {showPrintModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 overflow-y-auto p-4 flex items-start justify-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-[#151619] border border-white/10 rounded-2xl max-w-4xl w-full my-8 overflow-hidden shadow-2xl font-sans"
            >
              {/* Controls Bar (Hidden on print) */}
              <div className="p-6 bg-[#1e2025] border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
                <div className="flex items-center gap-3">
                  <Printer className="text-[#F27D26]" size={20} />
                  <div>
                    <h3 className="font-bold text-white text-base">Monthly Activity Report Generator</h3>
                    <p className="text-[10px] text-white/50">Compiles aggregate logs into a printable official summary</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input
                    type="month"
                    value={printMonth}
                    onChange={(e) => setPrintMonth(e.target.value)}
                    className="bg-[#151619] text-white text-xs px-3 py-2.5 rounded-xl border border-white/5 focus:outline-none"
                  />
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                  >
                    <Printer size={12} />
                    Print / Save PDF
                  </button>
                  <button
                    onClick={() => setShowPrintModal(false)}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Printable Body Block */}
              <div id="printable-area" className="p-12 bg-white text-black min-h-[11in] font-sans printable-report-sheet print:p-0">
                {/* Print Sheet Header */}
                <header className="flex justify-between items-start border-b-2 border-black pb-6 mb-8">
                  <div>
                    <h1 className="text-3xl font-sans font-black tracking-tight text-black">FUNSCHOLAR</h1>
                    <p className="font-mono text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">LMS Platform Security System</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-black text-white text-[10px] font-black uppercase px-3 py-1 font-mono tracking-widest mb-1.5">OFFICIAL AUDIT REPORT</span>
                    <p className="text-[11px] text-gray-600 font-medium">Reporting Cycle: <b className="text-black">{monthName}</b></p>
                  </div>
                </header>

                {/* Grid Summary Stats */}
                <section className="grid grid-cols-4 gap-6 mb-8">
                  <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono font-bold">Logins This Month</span>
                    <p className="text-2xl font-black text-black mt-1">{selectedMonthMetrics.totalLogins}</p>
                  </div>
                  <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono font-bold">Curriculums Opened</span>
                    <p className="text-2xl font-black text-black mt-1">{selectedMonthMetrics.totalFilesOpened}</p>
                  </div>
                  <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono font-bold">Curriculum Additions</span>
                    <p className="text-2xl font-black text-black mt-1">{selectedMonthMetrics.totalCurriculumAdded}</p>
                  </div>
                  <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono font-bold">User Mutations</span>
                    <p className="text-2xl font-black text-black mt-1">{selectedMonthMetrics.totalUserMutations}</p>
                  </div>
                </section>

                {/* Interaction list block */}
                <section className="space-y-4">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest border-b border-gray-200 pb-2 mb-4 text-black flex justify-between">
                    <span>Audit Interaction Records</span>
                    <span>Total Logs: {selectedMonthMetrics.monthLogs.length}</span>
                  </h3>

                  {selectedMonthMetrics.monthLogs.length === 0 ? (
                    <div className="text-center py-12 text-sm text-gray-400">
                      No interactions recorded during this month's cycle.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-300 text-gray-500 uppercase text-[9px] tracking-wider font-bold">
                          <th className="py-2.5 font-bold">User / Email</th>
                          <th className="py-2.5 font-bold">System Role</th>
                          <th className="py-2.5 font-bold">Action Event</th>
                          <th className="py-2.5 font-bold">Details Description</th>
                          <th className="py-2.5 font-bold text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-[11px] text-gray-800">
                        {selectedMonthMetrics.monthLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="py-3 font-bold text-black">
                              {log.userName}
                              <span className="block text-[9px] text-gray-400 font-mono font-normal mt-0.5">{log.userEmail}</span>
                            </td>
                            <td className="py-3 uppercase font-mono font-bold text-[10px] text-gray-600">
                              {log.userRole}
                            </td>
                            <td className="py-3 font-bold text-[#F27D26] font-mono text-[10px] uppercase">
                              {log.action}
                            </td>
                            <td className="py-3 max-w-sm text-gray-600">
                              {log.details}
                            </td>
                            <td className="py-3 font-mono text-[10px] text-gray-400 text-right">
                              {safeFormatDateTime(log.timestamp)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>

                {/* Printable signature and certification */}
                <footer className="mt-16 border-t border-gray-200 pt-8 flex justify-between items-end text-[10px] text-gray-400">
                  <div>
                    <p className="font-mono uppercase tracking-wider font-bold">Generated by FunScholar Platform</p>
                    <p className="mt-1">Date: {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="border-b border-black w-48 mx-auto mb-1"></p>
                    <p className="font-mono uppercase tracking-wider font-bold text-gray-500">Authorized Administrator Sign-Off</p>
                  </div>
                </footer>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ENLARGED CLASS LOGS MODAL */}
      <AnimatePresence>
        {isClassLogsEnlarged && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 overflow-y-auto p-4 flex items-start justify-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-[#151619] border border-white/10 rounded-2xl max-w-6xl w-full my-8 overflow-hidden shadow-2xl font-sans"
            >
              {/* Header */}
              <div className="p-6 bg-[#1a1b1f] border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Clock className="text-[#F27D26]" size={22} />
                  <div>
                    <h3 className="font-bold text-white text-lg">Detailed Trainer Class Logs Explorer</h3>
                    <p className="text-[10px] text-white/50">Comprehensive overview of school activities logged by class trainers</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsClassLogsEnlarged(false)}
                  className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-all border border-white/5"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Filters */}
              <div className="p-6 bg-[#1a1b1f] border-b border-white/5 grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold tracking-widest text-white/40 flex items-center gap-1.5 font-mono">
                    <Search size={10} /> Search Activity Text
                  </label>
                  <input
                    type="text"
                    placeholder="Filter by activity..."
                    value={classLogSearch}
                    onChange={(e) => setClassLogSearch(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F27D26] text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold tracking-widest text-white/40 flex items-center gap-1.5 font-mono font-black">
                    <SchoolIcon size={10} /> Filter School
                  </label>
                  <select
                    value={classLogSchoolFilter}
                    onChange={(e) => setClassLogSchoolFilter(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F27D26] text-white"
                  >
                    <option value="all">All Schools</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold tracking-widest text-white/40 flex items-center gap-1.5 font-mono font-black">
                    <User size={10} /> Filter Teacher
                  </label>
                  <select
                    value={classLogTeacherFilter}
                    onChange={(e) => setClassLogTeacherFilter(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F27D26] text-white"
                  >
                    <option value="all">All Teachers</option>
                    {teachers.map(t => <option key={t.uid} value={t.uid}>{t.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold tracking-widest text-white/40 flex items-center gap-1.5 font-mono font-black">
                    <BookOpen size={10} /> Filter Course
                  </label>
                  <select
                    value={classLogCourseFilter}
                    onChange={(e) => setClassLogCourseFilter(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F27D26] text-white"
                  >
                    <option value="all">All Courses</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              </div>

              {/* Results List */}
              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4">
                {(() => {
                  const filtered = logs.filter(log => {
                    const matchesSearch = log.activity.toLowerCase().includes(classLogSearch.toLowerCase());
                    const matchesSchool = classLogSchoolFilter === 'all' || log.schoolId === classLogSchoolFilter;
                    const matchesTeacher = classLogTeacherFilter === 'all' || log.teacherId === classLogTeacherFilter;
                    const matchesCourse = classLogCourseFilter === 'all' || log.courseId === classLogCourseFilter;
                    return matchesSearch && matchesSchool && matchesTeacher && matchesCourse;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-12 text-center text-white/40 text-sm">
                        No matching trainer logs found.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filtered.map(log => (
                        <div
                          key={log.id}
                          onClick={() => {
                            setSelectedTeacherLog(log);
                          }}
                          className="p-5 bg-white/5 hover:bg-white/[0.08] border border-white/5 hover:border-white/10 rounded-2xl cursor-pointer transition-all space-y-3"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="text-xs font-mono uppercase tracking-widest text-white/40 font-black">
                                {safeFormatDate(log.timestamp)}
                              </p>
                              <h4 className="text-sm font-bold text-white mt-1">
                                {teachers.find(t => t.uid === log.teacherId)?.name || log.teacherName || 'Trainer'}
                              </h4>
                            </div>
                            {log.duration && (
                              <span className="px-2.5 py-1 bg-[#F27D26]/10 border border-[#F27D26]/30 text-[#F27D26] text-[10px] font-mono uppercase tracking-wider font-bold rounded-lg shrink-0">
                                ⏱️ {log.duration} mins
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/60 line-clamp-3 leading-relaxed">
                            {log.activity}
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {log.classSection && (
                              <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-mono text-white/80">
                                Class: {log.classSection}
                              </span>
                            )}
                            {log.period && (
                              <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] font-mono text-blue-400">
                                Time: {log.period}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="p-6 bg-[#1a1b1f] border-t border-white/5 flex justify-end gap-3">
                <button
                  onClick={() => setIsClassLogsEnlarged(false)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer border border-white/5 transition-all"
                >
                  Close Explorer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SELECTED TEACHER LOG DETAILS MODAL */}
      <AnimatePresence>
        {selectedTeacherLog && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#151619] border border-white/10 rounded-[2rem] max-w-2xl w-full overflow-hidden shadow-2xl font-sans"
            >
              {/* Header */}
              <div className="p-6 bg-[#1a1b1f] border-b border-white/5 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white text-lg">Class Log Entry Detail</h3>
                  <p className="text-[10px] text-[#F27D26] font-mono uppercase tracking-widest mt-1">
                    Trainer Session Record • {selectedTeacherLog.id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTeacherLog(null)}
                  className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-all border border-white/5"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-white/[0.01] border border-white/5 p-4 rounded-xl">
                  <div>
                    <span className="text-white/30 block uppercase text-[9px] tracking-wider font-bold">Trainer Name</span>
                    <span className="text-white mt-1 block font-bold text-sm">
                      {teachers.find(t => t.uid === selectedTeacherLog.teacherId)?.name || selectedTeacherLog.teacherName || 'Trainer'}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/30 block uppercase text-[9px] tracking-wider font-bold">Log Date</span>
                    <span className="text-[#F27D26] mt-1 block font-bold text-sm">
                      {safeFormatDate(selectedTeacherLog.timestamp) || selectedTeacherLog.date}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-xs font-mono bg-white/[0.01] border border-white/5 p-4 rounded-xl">
                  <div>
                    <span className="text-white/30 block uppercase text-[9px] tracking-wider font-bold">School</span>
                    <span className="text-white mt-1 block font-bold truncate">
                      {schools.find(s => s.id === selectedTeacherLog.schoolId)?.name || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/30 block uppercase text-[9px] tracking-wider font-bold">Class Section</span>
                    <span className="text-white mt-1 block font-bold">
                      {selectedTeacherLog.classSection || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/30 block uppercase text-[9px] tracking-wider font-bold">Session Duration</span>
                    <span className="text-[#F27D26] mt-1 block font-bold">
                      {selectedTeacherLog.duration ? `${selectedTeacherLog.duration} minutes` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-white/30 block uppercase text-[10px] tracking-wider font-mono font-bold">Logged Activity / Work Done</span>
                  <div className="text-white/90 bg-white/5 p-5 rounded-2xl border border-white/5 text-sm leading-relaxed max-h-[250px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                    {selectedTeacherLog.activity}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-[#1a1b1f] border-t border-white/5 flex justify-end">
                <button
                  onClick={() => setSelectedTeacherLog(null)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer border border-white/5 transition-all"
                >
                  Close Log Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Styles Injection */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-area, #printable-area * {
            visibility: visible !important;
          }
          #printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
          }
          .fixed, .print\\:hidden, select, button, input {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

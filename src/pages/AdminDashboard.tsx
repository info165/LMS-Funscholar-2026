import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { School, UserProfile, Course, Submission, Attendance, ThematicSubmission } from '../types';
import { Users, School as SchoolIcon, BookOpen, ClipboardList, TrendingUp, MapPin, Search, Plus, Filter, ArrowUpRight, CheckCircle2, Clock, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const subRole = profile?.adminSubRole || 'Super Admin';
  const [stats, setStats] = useState({
    schools: 0,
    teachers: 0,
    students: 0,
    submissions: 0
  });
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedState, setSelectedState] = useState('All');
  const [studentsData, setStudentsData] = useState<UserProfile[]>([]);
  const [submissionsData, setSubmissionsData] = useState<Submission[]>([]);
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [thematicSubmissions, setThematicSubmissions] = useState<ThematicSubmission[]>([]);

  useEffect(() => {
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
      setStats(prev => ({ ...prev, schools: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schools');
    });

    const unsubTeachers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'teacher')), (snapshot) => {
      setStats(prev => ({ ...prev, teachers: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubStudents = onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setStudentsData(data);
      setStats(prev => ({ ...prev, students: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubSubmissions = onSnapshot(collection(db, 'submissions'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      setSubmissionsData(data);
      setStats(prev => ({ ...prev, submissions: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'submissions');
    });

    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      setAttendanceData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });

    const unsubThematic = onSnapshot(collection(db, 'thematicSubmissions'), (snapshot) => {
      setThematicSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ThematicSubmission)));
    });

    return () => {
      unsubSchools();
      unsubTeachers();
      unsubStudents();
      unsubSubmissions();
      unsubAttendance();
      unsubThematic();
    };
  }, []);

  const filteredSchools = selectedState === 'All' 
    ? schools 
    : schools.filter(s => s.state === selectedState);

  const states = ['All', ...new Set(schools.map(s => s.state))];

  const schoolPerformanceData = schools.map(school => {
    const schoolStudents = studentsData.filter(s => s.schoolIds?.includes(school.id));
    const avgXP = schoolStudents.length > 0 
      ? Math.round(schoolStudents.reduce((acc, s) => acc + (s.xp || 0), 0) / schoolStudents.length) 
      : 0;
    const schoolSubmissions = submissionsData.filter(sub => 
      schoolStudents.some(s => s.uid === sub.studentId)
    ).length;
    
    const schoolAttendance = attendanceData.filter(a => a.schoolId === school.id);
    const attendanceRate = schoolAttendance.length > 0
      ? Math.round((schoolAttendance.filter(a => a.status === 'present').length / schoolAttendance.length) * 100)
      : 0;
    
    return {
      id: school.id,
      name: school.name,
      avgXP,
      submissions: schoolSubmissions,
      students: schoolStudents.length,
      attendanceRate
    };
  });

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-bold tracking-tight">Executive Dashboard</h2>
            <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
              {subRole}
            </span>
          </div>
          <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">
            {subRole === 'Super Admin' && "Real-time global school status, teachers, and curriculum metrics"}
            {subRole === 'User Manager Admin' && "User management: rosters, schools, and teacher status metrics"}
            {subRole === 'Curriculum Admin' && "Curriculum management: course materials and lesson matrices"}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
            <Filter size={16} className="text-white/40" />
            <select 
              value={selectedState} 
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-transparent text-sm font-bold focus:outline-none"
            >
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Schools', value: stats.schools, icon: SchoolIcon, color: 'text-blue-400', trend: '+2 this month' },
          { label: 'Active Teachers', value: stats.teachers, icon: Users, color: 'text-green-400', trend: '98% active' },
          { label: 'Onboarded Students', value: stats.students, icon: Users, color: 'text-yellow-400', trend: '+124 new' },
          { label: 'Project Submissions', value: stats.submissions, icon: ClipboardList, color: 'text-[#F27D26]', trend: '85% completion' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-[#151619] border border-white/5 rounded-2xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon size={48} />
            </div>
            <div className={`p-2 w-fit rounded-lg bg-white/5 ${stat.color} mb-4`}>
              <stat.icon size={20} />
            </div>
            <p className="text-3xl font-bold">{stat.value}</p>
            <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mt-1">{stat.label}</p>
            <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-green-400">
              <ArrowUpRight size={12} />
              {stat.trend}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Approved Student Leaderboard Projects Showcase */}
      <section className="bg-[#151619] border border-white/5 rounded-2xl p-8 space-y-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Award className="text-yellow-400" size={24} /> Trainer-Approved Competition Showcase
          </h3>
          <p className="text-white/40 text-xs mt-1">
            Excellent student project photographs evaluated and approved by school trainers across all locations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {thematicSubmissions.filter(s => s.status === 'approved').length === 0 ? (
            <div className="col-span-full py-12 text-center bg-black/20 rounded-2xl border border-dashed border-white/5">
              <p className="text-sm text-white/30 italic">No approved student competition submissions outstanding or published yet.</p>
            </div>
          ) : (
            thematicSubmissions
              .filter(s => s.status === 'approved')
              .map(sub => (
                <div key={sub.id} className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-yellow-500/25 transition-all">
                  <div className="aspect-video bg-zinc-950 relative">
                    <img src={sub.photoUrl} alt="Approved Submission" className="w-full h-full object-cover animate-fade-in" />
                    <div className="absolute top-3 right-3 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[8px] font-black uppercase tracking-widest rounded-full">
                      +{sub.pointsAwarded || 100} PTS Credit
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div>
                      <p className="text-xs font-bold text-white truncate">{sub.studentName}</p>
                      <p className="text-[10px] text-white/40 truncate">{sub.schoolName}</p>
                    </div>
                    <p className="text-[10px] text-white/60 leading-relaxed font-sans line-clamp-2">{sub.description}</p>
                    <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[9px] text-white/40">
                      <span>Trainer: {sub.teacherName || 'Trainer'}</span>
                      <span className="font-mono text-[8px]">{new Date(sub.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#151619] border border-white/5 rounded-2xl p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold">School Performance Matrix</h3>
            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#F27D26]" />
                <span className="text-white/40">Avg XP</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-white/40">Attendance %</span>
              </div>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={schoolPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#F27D26' }}
                  cursor={{ fill: '#ffffff05' }}
                />
                <Bar dataKey="avgXP" fill="#F27D26" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="attendanceRate" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#151619] border border-white/5 rounded-2xl p-8 flex flex-col">
          <h3 className="text-xl font-bold mb-6">School Progress Report</h3>
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {schoolPerformanceData.sort((a, b) => b.avgXP - a.avgXP).map((perf, i) => (
              <motion.div 
                key={perf.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedSchool(schools.find(s => s.id === perf.id) || null)}
                className={cn(
                  "p-4 rounded-xl border transition-all cursor-pointer group",
                  selectedSchool?.id === perf.id 
                    ? "bg-[#F27D26]/10 border-[#F27D26]/30" 
                    : "bg-white/5 border-white/5 hover:border-white/10"
                )}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-sm group-hover:text-[#F27D26] transition-colors">{perf.name}</p>
                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">{perf.students} Students Onboarded</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#F27D26]">{perf.avgXP} XP</p>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Avg. Score</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest text-white/40">
                    <span>Curriculum Progress</span>
                    <span>{perf.attendanceRate}%</span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-1 overflow-hidden">
                    <div 
                      className="bg-[#F27D26] h-full transition-all duration-1000" 
                      style={{ width: `${perf.attendanceRate}%` }} 
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedSchool && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="bg-[#151619] border border-[#F27D26]/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Award size={120} />
            </div>
            
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26] border border-[#F27D26]/20">
                  <SchoolIcon size={40} />
                </div>
                <div>
                  <h3 className="text-3xl font-bold">{selectedSchool.name}</h3>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-white/40 text-sm">
                      <MapPin size={14} />
                      {selectedSchool.location}, {selectedSchool.state}
                    </div>
                    <div className="px-3 py-1 bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-widest rounded-full border border-green-500/20">
                      Active School
                    </div>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedSchool(null)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-6">
                <h4 className="text-xs uppercase font-bold tracking-[0.2em] text-white/30 border-b border-white/5 pb-2">Top Performers</h4>
                <div className="space-y-3">
                  {studentsData
                    .filter(s => s.schoolIds?.includes(selectedSchool.id))
                    .sort((a, b) => (b.xp || 0) - (a.xp || 0))
                    .slice(0, 3)
                    .map((student, i) => (
                      <div key={student.uid} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-[10px] font-bold text-[#F27D26]">
                          #{i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold">{student.name}</p>
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Level {student.level}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-[#F27D26]">{student.xp} XP</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-xs uppercase font-bold tracking-[0.2em] text-white/30 border-b border-white/5 pb-2">Recent Submissions</h4>
                <div className="space-y-3">
                  {submissionsData
                    .filter(sub => studentsData.find(s => s.uid === sub.studentId)?.schoolIds?.includes(selectedSchool.id))
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 3)
                    .map((sub) => (
                      <div key={sub.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="w-10 h-10 rounded-lg bg-black overflow-hidden border border-white/10">
                          {sub.photoUrl && <img src={sub.photoUrl} alt="Sub" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold">{studentsData.find(s => s.uid === sub.studentId)?.name}</p>
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">{sub.status}</p>
                        </div>
                        <div className="text-white/20">
                          <ArrowUpRight size={14} />
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-xs uppercase font-bold tracking-[0.2em] text-white/30 border-b border-white/5 pb-2">Teacher Activity</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                      <Clock size={16} className="text-blue-400" />
                      <span className="text-xs font-bold">Avg. Weekly Lab Hours</span>
                      <span className="ml-auto text-sm font-bold text-blue-400">12.5h</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={16} className="text-green-400" />
                      <span className="text-xs font-bold">Curriculum Completion</span>
                      <span className="ml-auto text-sm font-bold text-green-400">74%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { School, UserProfile, Course, Submission, TeacherLog } from '../types';
import { FileText, Download, TrendingUp, Users, BookOpen, School as SchoolIcon, PieChart as PieChartIcon, BarChart as BarChartIcon, Star, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function ReportsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [logs, setLogs] = useState<TeacherLog[]>([]);
  const [loading, setLoading] = useState(true);

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

    const unsubLogs = onSnapshot(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(10)), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherLog)));
      setLoading(false);
    });

    return () => {
      unsubSchools();
      unsubUsers();
      unsubCourses();
      unsubSubmissions();
      unsubLogs();
    };
  }, []);

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
        totalSubmissions: submissions.length
      },
      schools: schoolData,
      topStudents: topStudents.map(s => ({ name: s.name, xp: s.xp, level: s.level }))
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `funscholar_report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">System Reports</h2>
          <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Platform-wide analytics and data export</p>
        </div>
        <button
          onClick={downloadReport}
          className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-white/90 transition-all"
        >
          <Download size={18} />
          Export Data
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-[#151619] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 rounded-lg bg-[#F27D26]/10 text-[#F27D26]">
              <SchoolIcon size={20} />
            </div>
            <h3 className="text-white/50 text-xs uppercase font-bold tracking-wider">Total Schools</h3>
          </div>
          <p className="text-4xl font-bold">{schools.length}</p>
        </div>
        <div className="p-6 bg-[#151619] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Users size={20} />
            </div>
            <h3 className="text-white/50 text-xs uppercase font-bold tracking-wider">Total Teachers</h3>
          </div>
          <p className="text-4xl font-bold">{teachers.length}</p>
        </div>
        <div className="p-6 bg-[#151619] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
              <Users size={20} />
            </div>
            <h3 className="text-white/50 text-xs uppercase font-bold tracking-wider">Total Students</h3>
          </div>
          <p className="text-4xl font-bold">{students.length}</p>
        </div>
        <div className="p-6 bg-[#151619] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <BookOpen size={20} />
            </div>
            <h3 className="text-white/50 text-xs uppercase font-bold tracking-wider">Total Courses</h3>
          </div>
          <p className="text-4xl font-bold">{courses.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <BarChartIcon className="text-[#F27D26]" size={20} />
            <h3 className="text-xl font-bold">School Performance</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={schoolData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#ffffff50" fontSize={12} />
                <YAxis stroke="#ffffff50" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="students" fill="#F27D26" radius={[4, 4, 0, 0]} />
                <Bar dataKey="teachers" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <PieChartIcon className="text-[#F27D26]" size={20} />
            <h3 className="text-xl font-bold">User Distribution</h3>
          </div>
          <div className="h-[300px] flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
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
            <div className="space-y-4 pr-8">
              {roleDistribution.map((role) => (
                <div key={role.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
                  <span className="text-sm font-medium text-white/70">{role.name}</span>
                  <span className="text-sm font-bold ml-auto">{role.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <Star className="text-yellow-400" size={20} />
            <h3 className="text-xl font-bold">Top Performing Students</h3>
          </div>
          <div className="space-y-4">
            {topStudents.map((student, index) => (
              <div key={student.uid} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                <div className="w-8 h-8 rounded-full bg-[#F27D26]/20 text-[#F27D26] flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-bold">{student.name}</p>
                  <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Level {student.level}</p>
                </div>
                <div className="text-right">
                  <p className="text-[#F27D26] font-bold">{student.xp} XP</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <Clock className="text-blue-400" size={20} />
            <h3 className="text-xl font-bold">Recent Activity Logs</h3>
          </div>
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="p-4 bg-white/5 rounded-xl border border-white/5">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-bold">{teachers.find(t => t.uid === log.teacherId)?.name || 'Teacher'}</p>
                  <span className="text-[10px] text-white/30">{new Date(log.timestamp).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-white/60 line-clamp-2">{log.activity}</p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-[#F27D26] font-bold uppercase tracking-widest">
                  <Clock size={10} />
                  {log.duration} mins
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

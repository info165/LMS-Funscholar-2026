import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, addDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { TeacherLog, School, Course, Module } from '../types';
import { useAuth } from '../AuthContext';
import { ClipboardList, Plus, Clock, Download, Calendar, BookOpen, GraduationCap, Laptop } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';

export default function Logs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<TeacherLog[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [period, setPeriod] = useState('');
  const [classSection, setClassSection] = useState('');
  const [activity, setActivity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    // Fetch logs
    const logQuery = profile.role === 'admin' 
      ? query(collection(db, 'logs'), orderBy('timestamp', 'desc'))
      : query(collection(db, 'logs'), where('teacherId', '==', profile.uid), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(logQuery, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    // Fetch master data
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      const schoolData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
      setSchools(schoolData);
      if (profile.schoolIds && profile.schoolIds.length > 0) {
        setSelectedSchoolId(profile.schoolIds[0]);
      }
    });

    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    });

    const unsubModules = onSnapshot(collection(db, 'modules'), (snapshot) => {
      setModules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module)));
    });

    return () => {
      unsubscribe();
      unsubSchools();
      unsubCourses();
      unsubModules();
    };
  }, [profile]);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !activity || !selectedSchoolId || !selectedCourseId || !selectedModuleId) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'logs'), {
        teacherId: profile.uid,
        teacherName: profile.name,
        schoolId: selectedSchoolId,
        courseId: selectedCourseId,
        moduleId: selectedModuleId,
        date,
        period,
        classSection,
        activity,
        timestamp: serverTimestamp()
      });
      setActivity('');
      setPeriod('');
      setClassSection('');
      toast.success('Log entry added successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'logs');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadLogs = () => {
    if (logs.length === 0) {
      toast.error('No logs available to download');
      return;
    }

    const dataToExport = logs.map(log => ({
      Date: log.date,
      Period: log.period || 'N/A',
      'Class/Section': log.classSection || 'N/A',
      Teacher: log.teacherName || 'Unknown',
      School: schools.find(s => s.id === log.schoolId)?.name || log.schoolId,
      Grade: courses.find(c => c.id === log.courseId)?.title || log.courseId,
      Topic: modules.find(m => m.id === log.moduleId)?.title || log.moduleId,
      Activity: log.activity
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `FunScholar_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCourses = selectedSchoolId 
    ? courses.filter(c => c.schoolId === selectedSchoolId || !c.schoolId) 
    : courses;

  const filteredModules = selectedCourseId
    ? modules.filter(m => m.courseId === selectedCourseId)
    : modules;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-[#F27D26]/10 rounded-lg text-[#F27D26]">
               <ClipboardList size={24} />
             </div>
             <h2 className="text-4xl font-bold tracking-tight">Class Logbook</h2>
          </div>
          <p className="text-white/40 font-mono text-[10px] uppercase tracking-widest pl-1">Daily interaction and topic tracking</p>
        </div>
        
        <button
          onClick={handleDownloadLogs}
          className="bg-white/5 border border-white/10 text-white px-6 py-3 rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center gap-2"
        >
          <Download size={18} />
          Export to CSV
        </button>
      </header>

      {/* Log Form */}
      <section className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 shadow-xl">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#F27D26] mb-8">Add New Entry</h3>
        <form onSubmit={handleAddLog} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 flex items-center gap-2">
                <Calendar size={12} /> Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] text-white"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 flex items-center gap-2">
                <Clock size={12} /> Period / Time
              </label>
              <input
                type="text"
                placeholder="e.g. 1st Period, 10:30 AM"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] text-white"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 flex items-center gap-2">
                <Laptop size={12} /> Class / Section
              </label>
              <input
                type="text"
                placeholder="e.g. 6-A, 8-B"
                value={classSection}
                onChange={(e) => setClassSection(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] text-white"
                required
              />
            </div>

            {profile?.role === 'admin' && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 flex items-center gap-2">
                  <GraduationCap size={12} /> School
                </label>
                <select
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] text-white"
                  required
                >
                  <option value="">Select School</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 flex items-center gap-2">
                <BookOpen size={12} /> Grade / Course
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] text-white"
                required
              >
                <option value="">Select Grade</option>
                {filteredCourses.map(c => <option key={c.id} value={c.id}>Grade {c.grade}: {c.title}</option>)}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 flex items-center gap-2">
                <Laptop size={12} /> Topic / Module
              </label>
              <select
                value={selectedModuleId}
                onChange={(e) => setSelectedModuleId(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] text-white"
                required
              >
                <option value="">Select Topic</option>
                {filteredModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 flex items-center gap-2">
              What was taught today? (Lesson Summary)
            </label>
            <textarea
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:border-[#F27D26] text-white h-32 resize-none"
              placeholder="Describe the classroom session, student response, and practical completed..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#F27D26] text-white py-4 rounded-2xl font-bold hover:bg-[#d66a1e] transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#F27D26]/10 disabled:opacity-50"
          >
            {isSubmitting ? <Clock className="animate-spin" size={20} /> : <Plus size={20} />}
            Finalize Log Entry
          </button>
        </form>
      </section>

      {/* Logs Table-like View */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Clock size={20} className="text-[#F27D26]" />
          Recent Entries
        </h3>
        <div className="grid grid-cols-1 gap-4">
          {logs.map((log) => (
            <div key={log.id} className="group p-6 bg-[#151619] border border-white/5 rounded-[2rem] hover:border-white/10 transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-black uppercase tracking-widest text-white/40">
                      {log.date}
                    </span>
                    {log.period && (
                      <span className="px-2 py-1 bg-[#F27D26]/5 border border-[#F27D26]/20 rounded text-[10px] font-black uppercase tracking-widest text-[#F27D26]">
                        {log.period}
                      </span>
                    )}
                    {log.classSection && (
                      <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-black uppercase tracking-widest text-white">
                        {log.classSection}
                      </span>
                    )}
                    <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-black uppercase tracking-widest text-white/60">
                      {courses.find(c => c.id === log.courseId)?.title || 'Unknown Grade'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold group-hover:text-[#F27D26] transition-colors">
                      {modules.find(m => m.id === log.moduleId)?.title || 'Unknown Module'}
                    </h4>
                    <p className="text-white/60 text-sm mt-2 leading-relaxed">{log.activity}</p>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold">{log.teacherName || 'Teacher'}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20">
                      {schools.find(s => s.id === log.schoolId)?.name || 'School'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="py-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[2.5rem]">
               <ClipboardList size={48} className="mx-auto mb-4 text-white/10" />
               <p className="text-white/30 font-medium">No logs recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Course, Submission, TeacherLog, UserProfile } from '../types';
import { Calendar, BookOpen, ClipboardList, Star, Clock, CheckCircle, ArrowRight, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [logs, setLogs] = useState<TeacherLog[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!profile) return;

    const unsubCourses = onSnapshot(query(collection(db, 'courses'), where('teacherId', '==', profile.uid)), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    });

    const unsubSubmissions = onSnapshot(query(collection(db, 'submissions'), limit(5)), (snapshot) => {
      setRecentSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'submissions');
    });

    const unsubLogs = onSnapshot(query(collection(db, 'logs'), where('teacherId', '==', profile.uid), orderBy('timestamp', 'desc'), limit(5)), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    const unsubStudents = onSnapshot(query(collection(db, 'users'), where('role', '==', 'student'), where('schoolIds', 'array-contains', profile.schoolIds?.[0] || '')), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubCourses();
      unsubSubmissions();
      unsubLogs();
      unsubStudents();
    };
  }, [profile]);

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Today's Schedule</h2>
          <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Teacher: {profile?.name}</p>
        </div>
        <div className="flex items-center gap-4 bg-[#151619] px-6 py-3 rounded-2xl border border-white/5">
          <Calendar className="text-[#F27D26]" size={20} />
          <span className="text-sm font-bold">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">My Active Courses</h3>
              <button 
                onClick={() => navigate('/courses')}
                className="text-[#F27D26] text-sm font-bold hover:underline"
              >
                View All
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.map((course) => (
                <div key={course.id} className="p-6 bg-white/5 rounded-xl border border-white/5 hover:border-[#F27D26]/30 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 rounded-lg bg-[#F27D26]/10 text-[#F27D26]">
                      <BookOpen size={20} />
                    </div>
                  </div>
                  <h4 className="font-bold mb-2">{course.title}</h4>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-6 h-6 rounded-full bg-white/10 border-2 border-[#151619] flex items-center justify-center text-[8px] font-bold">
                          {i}
                        </div>
                      ))}
                      <div className="w-6 h-6 rounded-full bg-[#F27D26] border-2 border-[#151619] flex items-center justify-center text-[8px] font-bold">
                        +{students.length > 3 ? students.length - 3 : 0}
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate('/courses')}
                      className="text-white/40 group-hover:text-[#F27D26] transition-colors"
                    >
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Pending Reviews</h3>
              <span className="px-3 py-1 bg-[#F27D26]/10 text-[#F27D26] text-[10px] font-bold uppercase rounded-full">
                {recentSubmissions.filter(s => s.status === 'pending').length} New
              </span>
            </div>
            <div className="space-y-4">
              {recentSubmissions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black rounded-lg overflow-hidden border border-white/10">
                      {sub.photoUrl ? (
                        <img src={sub.photoUrl} alt="Submission" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                          <ClipboardList size={20} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Project Submission</p>
                      <p className="text-xs text-white/40">Student: {students.find(s => s.uid === sub.studentId)?.name || 'Student'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star key={star} size={14} className={sub.rating && sub.rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-white/10'} />
                      ))}
                    </div>
                    <button 
                      onClick={() => navigate(`/projects?review=${sub.id}`)}
                      className="px-4 py-2 bg-[#F27D26] text-white text-xs font-bold rounded-lg hover:bg-[#d66a1e]"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
            <h3 className="text-xl font-bold mb-6">Recent Logs</h3>
            <div className="space-y-6">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-4 relative">
                  <div className="absolute top-8 left-4 bottom-0 w-px bg-white/5" />
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 z-10">
                    <Clock size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{log.activity}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={() => navigate('/logs')}
              className="w-full mt-8 py-3 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={14} />
              Add Manual Log
            </button>
          </section>

          <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
            <h3 className="text-xl font-bold mb-6">Class Attendance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-sm font-medium">Total Students</span>
                <span className="font-bold">{students.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-sm font-medium">Present Today</span>
                <span className="font-bold text-green-400">--</span>
              </div>
              <button 
                onClick={() => navigate('/attendance')}
                className="w-full py-3 bg-white text-black rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/90 transition-colors"
              >
                Mark Attendance
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

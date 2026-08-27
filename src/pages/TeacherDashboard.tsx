import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit, doc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Course, Submission, TeacherLog, UserProfile, School, ThematicSubmission } from '../types';
import { Calendar, BookOpen, ClipboardList, Star, Clock, CheckCircle, ArrowRight, Plus, MapPin, School as SchoolIcon, Users, Trophy, Award, Camera, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getDirectImageUrl } from '../lib/utils';

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [logs, setLogs] = useState<TeacherLog[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);

  // Leaderboard Contest submissions from student
  const [thematicSubmissions, setThematicSubmissions] = useState<ThematicSubmission[]>([]);
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [customPoints, setCustomPoints] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!profile) return;

    // Fetch all schools
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    });

    // Fetch courses taught by this teacher or allotted to their mapped schools
    let coursesQuery;
    if (profile.schoolIds && profile.schoolIds.length > 0) {
      coursesQuery = query(collection(db, 'courses'), where('schoolId', 'in', profile.schoolIds));
    } else {
      coursesQuery = query(collection(db, 'courses'), where('teacherId', '==', profile.uid));
    }
    const unsubCourses = onSnapshot(coursesQuery, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    });

    // Fetch submissions
    const unsubSubmissions = onSnapshot(collection(db, 'submissions'), (snapshot) => {
      setRecentSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'submissions');
    });

    // Fetch logs only for this teacher
    const unsubLogs = onSnapshot(query(collection(db, 'logs'), where('teacherId', '==', profile.uid), orderBy('timestamp', 'desc'), limit(5)), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    // Fetch all student list - we will filter locally for security & responsiveness
    const unsubStudents = onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), (snapshot) => {
      const allStudents = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      const teacherSchools = profile.schoolIds || [];
      const localizedStudents = allStudents.filter(u => 
        u.schoolIds && u.schoolIds.some(id => teacherSchools.includes(id))
      );
      setStudents(localizedStudents);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubThematic = onSnapshot(collection(db, 'thematicSubmissions'), (snapshot) => {
      setThematicSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ThematicSubmission)));
    });

    return () => {
      unsubSchools();
      unsubCourses();
      unsubSubmissions();
      unsubLogs();
      unsubStudents();
      unsubThematic();
    };
  }, [profile]);

  if (!profile) return null;

  // Filter systems down to only this teacher's active scope
  const mySchools = schools.filter(s => profile.schoolIds?.includes(s.id));
  const studentIds = students.map(s => s.uid);
  
  const myPendingReviews = recentSubmissions
    .filter(sub => studentIds.includes(sub.studentId) && sub.status === 'pending')
    .slice(0, 5);

  const pendingThematic = thematicSubmissions.filter(sub => 
    profile.schoolIds?.includes(sub.schoolId) && sub.status === 'pending'
  );

  const handleApproveThematic = async (id: string, studentId: string) => {
    try {
      const pts = customPoints[id] || 100;
      const fb = feedbackInputs[id] || "Excellent work setting up your innovative project prototype!";
      
      await updateDoc(doc(db, 'thematicSubmissions', id), {
        status: 'approved',
        pointsAwarded: pts,
        teacherFeedback: fb,
        teacherId: profile.uid,
        teacherName: profile.name
      });

      // Update student metrics
      await updateDoc(doc(db, 'users', studentId), {
        projectPoints: increment(pts),
        totalPoints: increment(pts)
      });

      toast.success("Project accepted successfully! Points credited directly to the student leaderboard overall standings.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve student competition submission.");
    }
  };

  const handleRejectThematic = async (id: string) => {
    try {
      const fb = feedbackInputs[id] || "Need some revisions on your sensor connections before resubmitting.";
      
      await updateDoc(doc(db, 'thematicSubmissions', id), {
        status: 'rejected',
        teacherFeedback: fb,
        teacherId: profile.uid,
        teacherName: profile.name
      });

      toast.error("Submission rejected. Student can adjust and resubmit.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to process rejection.");
    }
  };

  const averageXP = students.length > 0 
    ? Math.round(students.reduce((acc, curr) => acc + (curr.xp || 0), 0) / students.length)
    : 0;

  const topStudents = [...students]
    .sort((a, b) => (b.xp || 0) - (a.xp || 0))
    .slice(0, 4);

  return (
    <div className="space-y-8 pb-12">
      {/* Personalized Header Context */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Hi, {profile.name}!</h2>
          <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">
            Local Teacher Dashboard • Visiting {mySchools.length} {mySchools.length === 1 ? 'School' : 'Schools'}
          </p>
        </div>
        <div className="flex items-center gap-4 bg-[#151619] px-6 py-3 rounded-2xl border border-white/5 shadow-lg">
          <Calendar className="text-[#F27D26]" size={18} />
          <span className="text-xs font-bold font-mono tracking-wide text-white/80">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </header>

      {/* Outlined visited schools section */}
      <section className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#F27D26] flex items-center gap-2">
          <SchoolIcon size={14} /> Assigned Visiting Schools
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mySchools.map((s) => {
            const schoolStudents = students.filter(st => st.schoolIds?.includes(s.id));
            const schoolCourses = courses.filter(c => c.schoolId === s.id);
            return (
              <div key={s.id} className="p-6 bg-[#151619] border border-white/5 rounded-2xl relative overflow-hidden group hover:border-[#F27D26]/25 transition-all">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#F27D26]" />
                <h4 className="text-lg font-bold text-white mb-1.5 truncate">{s.name}</h4>
                <div className="flex items-center gap-2 text-white/40 text-xs font-mono mb-4">
                  <MapPin size={12} />
                  <span>{s.location}, {s.state}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div>
                    <span className="text-[10px] text-white/40 font-mono block uppercase">My Students</span>
                    <span className="text-lg font-bold text-white font-mono">{schoolStudents.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 font-mono block uppercase">Active Courses</span>
                    <span className="text-lg font-bold text-white font-mono">{schoolCourses.length}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {mySchools.length === 0 && (
            <div className="col-span-full p-8 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-2xl">
              <p className="text-xs text-white/30 italic">No schools assigned to your teacher ID yet. Contact Super Admin for school mapping setup.</p>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Core Activities & Student Reports column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Student Reports for My School(s) */}
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h3 className="text-xl font-bold">Student Performance Reports</h3>
                <p className="text-white/40 text-xs mt-1">Academics snapshot for pupils within your mapped jurisdiction</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-white/40 font-mono block uppercase">Class Avg XP</span>
                <span className="text-lg font-extrabold text-[#F27D26]">{averageXP} XP</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-white/40 font-mono uppercase tracking-wider px-2">
                <span>Roster Name</span>
                <div className="flex gap-16">
                  <span>Level</span>
                  <span className="w-20 text-right">Total XP</span>
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {students.map((student) => (
                  <div key={student.uid} className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-white/60 overflow-hidden flex-shrink-0">
                        {student.photoUrl ? (
                          <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          student.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{student.name}</p>
                        <p className="text-[10px] text-white/40 font-mono">Grade: {student.classSection || 'Unassigned'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-16 font-mono text-xs">
                      <span className="text-white/70 font-bold">{student.level || 1}</span>
                      <span className="w-20 text-right text-[#F27D26] font-bold">{student.xp || 0} XP</span>
                    </div>
                  </div>
                ))}
                {students.length === 0 && (
                  <p className="text-xs text-white/30 italic text-center py-6">No students registered in your visiting schools.</p>
                )}
              </div>
            </div>
          </section>

          {/* Pending Reviews - filtered strictly for this teacher's students only */}
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h3 className="text-xl font-bold">Pending Project Reviews</h3>
                <p className="text-white/40 text-xs mt-1">Review and grade uploads from your school's students</p>
              </div>
              <span className="px-3 py-1 bg-[#F27D26]/10 text-[#F27D26] text-[10px] font-bold uppercase rounded-full">
                {myPendingReviews.length} Awaiting
              </span>
            </div>

            <div className="space-y-3">
              {myPendingReviews.map((sub) => {
                const student = students.find(s => s.uid === sub.studentId);
                return (
                  <div key={sub.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-black rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                        {sub.photoUrl ? (
                          <img src={getDirectImageUrl(sub.photoUrl)} alt="Submission" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20">
                            <ClipboardList size={20} />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white">Project Presentation</p>
                        <p className="text-xs text-white/40 mt-0.5">Student: {student?.name || 'Academic Student'}</p>
                        <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mt-0.5">School: {schools.find(s => s.id === student?.schoolIds?.[0])?.name || 'Local School'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star key={star} size={13} className={sub.rating && sub.rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-white/10'} />
                        ))}
                      </div>
                      <button 
                        onClick={() => navigate(`/projects?review=${sub.id}`)}
                        className="px-4 py-2 bg-[#F27D26] hover:bg-[#d66a1e] text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                      >
                        Grade
                      </button>
                    </div>
                  </div>
                );
              })}
              {myPendingReviews.length === 0 && (
                <div className="p-8 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-xl">
                  <CheckCircle className="mx-auto mb-2 text-green-400/45" size={24} />
                  <p className="text-xs text-white/30 italic">All caught up! No student submissions awaiting reviews right now.</p>
                </div>
              )}
            </div>
          </section>

          {/* New Section: Leaderboard Contest project photo approvals */}
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Trophy size={20} className="text-yellow-400" /> Contest Project Approvals
                </h3>
                <p className="text-white/40 text-xs mt-1">Accept student project photograph submissions from your visiting schools to credit leaderboard points</p>
              </div>
              <span className="px-3 py-1 bg-yellow-400/10 text-yellow-500 text-[10px] font-black uppercase rounded-full border border-yellow-500/20">
                {pendingThematic.length} Awaiting
              </span>
            </div>

            <div className="space-y-6">
              {pendingThematic.map((sub) => {
                return (
                  <div key={sub.id} className="p-6 bg-black/40 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-black rounded-xl overflow-hidden border border-white/10 shrink-0">
                          <img src={getDirectImageUrl(sub.photoUrl)} alt="Student project preview" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <span className="text-[9px] font-mono font-black uppercase tracking-widest text-yellow-500 bg-yellow-500/5 border border-yellow-500/10 px-2 py-0.5 rounded">
                            {sub.themeTitle || 'Leaderboard Theme'}
                          </span>
                          <h4 className="font-bold text-sm text-white mt-1.5">Submitted by {sub.studentName}</h4>
                          <p className="text-[10px] text-white/40 font-mono">School: {sub.schoolName || 'Local School'} • Section: {sub.classSection || 'General'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase text-white/40 font-mono shrink-0">Scoring Weight:</span>
                        <select
                          value={customPoints[sub.id] || 100}
                          onChange={(e) => setCustomPoints(prev => ({ ...prev, [sub.id]: parseInt(e.target.value) }))}
                          className="bg-zinc-900 border border-white/10 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#F27D26]"
                        >
                          <option value={50}>50 PTS</option>
                          <option value={75}>75 PTS</option>
                          <option value={100}>100 PTS</option>
                          <option value={150}>150 PTS</option>
                        </select>
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-xs text-white/80 leading-relaxed italic">"{sub.description}"</p>
                    </div>

                    {/* Feedback and review controls */}
                    <div className="space-y-3 pt-2">
                      <input
                        type="text"
                        placeholder="Add trainer review comment/feedback..."
                        value={feedbackInputs[sub.id] || ''}
                        onChange={(e) => setFeedbackInputs(prev => ({ ...prev, [sub.id]: e.target.value }))}
                        className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/15"
                      />
                      
                      <div className="flex gap-3 justify-end pt-1">
                        <button
                          onClick={() => handleRejectThematic(sub.id)}
                          className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <XCircle size={14} /> Reject
                        </button>
                        <button
                          onClick={() => handleApproveThematic(sub.id, sub.studentId)}
                          className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-green-500/10 cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle size={14} /> Approve & Grant Points
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {pendingThematic.length === 0 && (
                <div className="p-8 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-xl">
                  <CheckCircle className="mx-auto mb-2 text-green-400/45" size={24} />
                  <p className="text-xs text-white/30 italic">No leaderboard submission applications pending for your visiting schools.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Action Widgets & Courses column */}
        <div className="space-y-8">
          
          {/* Brief Overview of Taught Courses */}
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">My Active Courses</h3>
              <button 
                onClick={() => navigate('/courses')}
                className="text-[#F27D26] text-xs font-bold hover:underline"
              >
                Manage
              </button>
            </div>

            <div className="space-y-3">
              {[...courses].sort((a, b) => {
                const orderA = a.order !== undefined ? a.order : 0;
                const orderB = b.order !== undefined ? b.order : 0;
                if (orderA !== orderB) return orderA - orderB;
                return a.title.localeCompare(b.title);
              }).map((course) => {
                const school = schools.find(s => s.id === course.schoolId);
                return (
                  <div key={course.id} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-[#F27D26]/20 transition-all group flex justify-between items-start">
                    <div className="space-y-1.5 overflow-hidden">
                      <h4 className="font-bold text-sm text-white group-hover:text-[#F27D26] transition-colors truncate">{course.title}</h4>
                      <p className="text-[10px] text-white/40 font-mono uppercase truncate">
                        {school?.name || 'Local School'}
                      </p>
                    </div>
                    <button 
                      onClick={() => navigate('/courses')}
                      className="text-white/30 hover:text-[#F27D26] p-1.5 transition-colors shrink-0"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                );
              })}
              {courses.length === 0 && (
                <p className="text-xs text-white/30 italic">No courses assigned directly to your teacher ID.</p>
              )}
            </div>
          </section>

          {/* Leaderboard stats for My School */}
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Trophy className="text-[#F27D26]" size={18} /> Student Leaderboard (Local)
            </h3>
            <div className="space-y-3.5">
              {topStudents.map((student, idx) => (
                <div key={student.uid} className="flex items-center justify-between p-2.5 bg-white/[0.01] border border-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-xs font-mono font-bold text-white/40 flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">{student.name}</p>
                      <p className="text-[9px] text-[#F27D26] font-mono">Level {student.level || 1}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-white/60">{student.xp || 0} XP</span>
                </div>
              ))}
              {topStudents.length === 0 && (
                <p className="text-xs text-white/30 italic text-center">No scores recorded yet.</p>
              )}
            </div>
          </section>

          {/* Quick Actions (e.g. Attendance Mapping) */}
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/40 font-mono">Fast Classroom Actions</h3>
            <button 
              onClick={() => navigate('/attendance')}
              className="w-full py-3 bg-white text-black rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/90 transition-colors cursor-pointer"
            >
              Classroom Attendance
            </button>
            <button 
              onClick={() => navigate('/logs')}
              className="w-full py-3 bg-transparent border border-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-colors cursor-pointer"
            >
              Log Daily Lesson Progress
            </button>
          </section>

          {/* Activity Logs timelines ONLY for this teacher log */}
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/40 font-mono">My Recent Lesson Logs</h3>
              <Plus 
                size={16} 
                onClick={() => navigate('/logs')} 
                className="text-white/40 hover:text-[#F27D26] cursor-pointer"
              />
            </div>
            
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3 relative text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F27D26] mt-1 shrink-0" />
                  <div>
                    <p className="font-semibold text-white/90">{log.activity}</p>
                    {log.timestamp && (
                      <p className="text-[9px] text-white/30 font-mono mt-1">
                        {log.date || (() => {
                          try {
                            if (typeof log.timestamp === 'object' && log.timestamp && 'seconds' in log.timestamp) {
                              const t = (log.timestamp as any);
                              return new Date(t.seconds * 1000).toLocaleDateString();
                            }
                            const d = new Date(log.timestamp as any);
                            return isNaN(d.getTime()) ? 'Just now' : d.toLocaleDateString();
                          } catch (e) {
                            return 'Just now';
                          }
                        })()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-xs text-white/30 italic">No lessons logged yet.</p>
              )}
            </div>
          </section>

        </div>

      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Course, Module, Project, Submission, School, UserProfile, Component } from '../types';
import { Trophy, Star, Zap, BookOpen, ClipboardList, ChevronRight, Play, CheckCircle, Share2, X, Camera, Users, Search, UserPlus, UserMinus, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleDriveViewer } from '../components/GoogleDriveViewer';
import { ModulePlayer } from '../components/ModulePlayer';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

export default function StudentDashboard() {
  const { profile, partners, setPartners } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Group Session states
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [allStudents, setAllStudents] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!profile) return;

    // Fetch school
    if (profile.schoolIds && profile.schoolIds.length > 0) {
      onSnapshot(doc(db, 'schools', profile.schoolIds[0]), (doc) => {
        if (doc.exists()) {
          setSchool({ id: doc.id, ...doc.data() } as School);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `schools/${profile.schoolIds![0]}`);
      });

      // Fetch school leaderboard
      const unsubLeaderboard = onSnapshot(
        query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('schoolIds', 'array-contains', profile.schoolIds[0]),
          orderBy('xp', 'desc'),
          limit(5)
        ),
        (snapshot) => {
          setLeaderboard(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'users');
        }
      );
    }

    // Fetch courses for student's school
    const unsubCourses = onSnapshot(query(
      collection(db, 'courses'), 
      where('schoolId', '==', profile.schoolIds?.[0] || ''),
      where('activated', '==', true)
    ), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    });

    // Fetch modules
    const unsubModules = onSnapshot(collection(db, 'modules'), (snapshot) => {
      setModules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'modules');
    });

    // Fetch projects
    const unsubProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    // Fetch student's submissions
    const unsubSubmissions = onSnapshot(query(collection(db, 'submissions'), where('studentId', '==', profile.uid)), (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'submissions');
    });

    // Fetch all components for the player
    const unsubComponents = onSnapshot(collection(db, 'components'), (snapshot) => {
      setComponents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Component)));
    });

    // Fetch all students in school for group selection
    if (profile.schoolIds?.[0]) {
      onSnapshot(query(
        collection(db, 'users'),
        where('schoolIds', 'array-contains', profile.schoolIds[0]),
        where('role', '==', 'student')
      ), (snapshot) => {
        setAllStudents(snapshot.docs
          .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
          .filter(u => u.uid !== profile.uid)
        );
      });
    }

    setLoading(false);

    return () => {
      unsubCourses();
      unsubModules();
      unsubProjects();
      unsubSubmissions();
      unsubComponents();
    };
  }, [profile]);

  const xpToNextLevel = (profile?.level || 1) * 1000;
  const progressToNextLevel = ((profile?.xp || 0) % 1000) / 10;

  const shareProject = (platform: string) => {
    const url = window.location.href;
    const text = "Check out my robotics project on FunScholar!";
    if (platform === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`);
    if (platform === 'facebook') window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
    toast.success('Sharing link opened!');
  };

  if (loading) return <div className="flex items-center justify-center h-full">Loading Dashboard...</div>;

  return (
    <div className="space-y-10 pb-20">
      {/* Hero Section - Gamified */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-[#151619] border border-white/5 p-10">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(circle_at_70%_30%,#F27D26_0%,transparent_70%)] opacity-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-[#F27D26] p-1">
              <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-4xl font-bold text-[#F27D26]">
                {profile?.level || 1}
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-[#F27D26] text-white px-3 py-1 rounded-full text-[10px] font-black tracking-tighter uppercase">
              LEVEL
            </div>
          </div>

          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
              <h2 className="text-5xl font-bold tracking-tighter">Keep building, {profile?.name.split(' ')[0]}!</h2>
              <button 
                onClick={() => setIsGroupModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#F27D26]/10 hover:border-[#F27D26]/30 transition-all text-white/60 hover:text-[#F27D26]"
              >
                <Users size={14} /> 
                {partners.length > 0 ? `${partners.length + 1} Members Group` : 'Group Work'}
              </button>
            </div>
            {partners.length > 0 && (
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                {[profile!, ...partners].map(p => (
                  <div key={p.uid} className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold">
                    <div className="w-5 h-5 rounded-full bg-[#F27D26] flex items-center justify-center text-[10px] text-white">
                      {p.name.charAt(0)}
                    </div>
                    {p.name.split(' ')[0]}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2 max-w-md mx-auto md:mx-0">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-white/40">
                <span>XP PROGRESS</span>
                <span>{profile?.xp || 0} / {xpToNextLevel} XP</span>
              </div>
              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressToNextLevel}%` }}
                  className="h-full bg-gradient-to-r from-[#F27D26] to-[#ff9d5c]"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="px-6 py-4 bg-white/5 rounded-3xl border border-white/5 text-center">
              <Trophy className="text-yellow-400 mx-auto mb-2" size={24} />
              <p className="text-2xl font-bold">{profile?.badges?.length || 0}</p>
              <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Badges</p>
            </div>
            <div className="px-6 py-4 bg-white/5 rounded-3xl border border-white/5 text-center">
              <Zap className="text-blue-400 mx-auto mb-2" size={24} />
              <p className="text-2xl font-bold">{submissions.length}</p>
              <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Projects</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Course Progress */}
        <div className="lg:col-span-2 space-y-8">
          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold tracking-tight">My Courses</h3>
              <button className="text-[#F27D26] text-sm font-bold hover:underline">View Curriculum</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.map((course) => {
                const courseModules = modules
                  .filter(m => m.courseId === course.id)
                  .filter(m => m.isVisible !== false);
                const completedModules = courseModules.filter(m => submissions.some(s => s.projectId === m.id));
                const progress = courseModules.length > 0 ? (completedModules.length / courseModules.length) * 100 : 0;

                return (
                  <div key={course.id} className="group p-8 bg-[#151619] border border-white/5 rounded-[2rem] hover:border-[#F27D26]/30 transition-all">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 rounded-2xl bg-[#F27D26]/10 text-[#F27D26]">
                        <BookOpen size={24} />
                      </div>
                      {/* Grade indicator removed per user request */}
                    </div>
                    <h4 className="text-xl font-bold mb-4 group-hover:text-[#F27D26] transition-colors">{course.title}</h4>
                    <div className="flex flex-col gap-4">
                      {courseModules.map(module => (
                        <div key={module.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group/module hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center text-white/20 group-hover/module:text-[#F27D26] transition-colors">
                              <LayoutGrid size={16} />
                            </div>
                            <span className="text-sm font-bold truncate max-w-[120px]">{module.title}</span>
                          </div>
                          {(module.steps || []).length > 0 && (
                            <button 
                              onClick={() => setActiveModule(module)}
                              className="px-3 py-1.5 bg-[#F27D26]/10 text-[#F27D26] text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#F27D26] hover:text-white transition-all flex items-center gap-1.5"
                            >
                              <Play size={10} fill="currentColor" /> Start LMS
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3 mt-6">
                      <div className="flex justify-between text-[10px] font-bold text-white/40 uppercase tracking-widest">
                        <span>Progress</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[#F27D26]" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {courses.length === 0 && (
                <div className="col-span-2 p-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                  <BookOpen className="mx-auto mb-4 opacity-20" size={48} />
                  <p className="text-white/40 font-medium">No courses assigned yet.</p>
                </div>
              )}
            </div>
          </section>

          {/* Project Portfolio */}
          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold tracking-tight">Project Portfolio</h3>
              <button className="text-[#F27D26] text-sm font-bold hover:underline">Showcase All</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects
                .filter(p => p.isVisible !== false)
                .map((project) => {
                const submission = submissions.find(s => s.projectId === project.id);
                return (
                  <div key={project.id} className="bg-[#151619] border border-white/5 rounded-[2rem] overflow-hidden group">
                    <div className="aspect-video bg-black relative">
                      {submission?.photoUrl ? (
                        <img src={submission.photoUrl} alt={project.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/10">
                          <ClipboardList size={48} />
                        </div>
                      )}
                      <div className="absolute top-4 right-4">
                        {submission ? (
                          <div className="px-3 py-1 bg-green-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full">Completed</div>
                        ) : (
                          <div className="px-3 py-1 bg-[#F27D26] text-white text-[10px] font-black uppercase tracking-widest rounded-full">Active</div>
                        )}
                      </div>
                    </div>
                    <div className="p-8">
                      <h4 className="text-lg font-bold mb-2">{project.title}</h4>
                      <p className="text-white/40 text-sm line-clamp-2 mb-6">{project.description}</p>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => setActiveProject(project)}
                          className="flex-1 py-3 bg-white text-black rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/90 transition-colors"
                        >
                          View Details
                        </button>
                        <button 
                          onClick={() => shareProject('whatsapp')}
                          className="p-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors"
                        >
                          <Share2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <section className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8">
            <h3 className="text-xl font-bold mb-6">Achievements</h3>
            <div className="grid grid-cols-3 gap-4">
              {['Pioneer', 'Builder', 'Coder', 'Innovator', 'Master', 'Legend'].map((badge, i) => (
                <div key={badge} className={cn(
                  "aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all",
                  i < (profile?.badges?.length || 0) 
                    ? "bg-[#F27D26]/10 border-[#F27D26]/30 text-[#F27D26]" 
                    : "bg-white/5 border-white/5 text-white/10 grayscale"
                )}>
                  <Star size={20} fill={i < (profile?.badges?.length || 0) ? "currentColor" : "none"} />
                  <span className="text-[8px] font-black uppercase tracking-tighter">{badge}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8">
            <h3 className="text-xl font-bold mb-6">School Leaderboard</h3>
            <div className="space-y-4">
              {leaderboard.map((student, index) => (
                <div key={student.uid} className={cn(
                  "flex items-center gap-4 p-3 rounded-2xl transition-colors",
                  student.uid === profile?.uid ? "bg-[#F27D26]/10 border border-[#F27D26]/20" : "hover:bg-white/5"
                )}>
                  <span className={cn(
                    "text-lg font-black w-6",
                    index === 0 ? "text-yellow-400" : index === 1 ? "text-gray-400" : index === 2 ? "text-amber-600" : "text-white/20"
                  )}>
                    {index + 1}
                  </span>
                  <div className="w-10 h-10 rounded-full bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26] font-bold text-xs">
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{student.name}</p>
                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">{student.xp || 0} XP</p>
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-center text-white/20 text-xs py-4">No other students yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Module Player Modal */}
      <AnimatePresence>
        {activeModule && (
          <ModulePlayer 
            module={activeModule} 
            components={components}
            onClose={() => setActiveModule(null)} 
          />
        )}
      </AnimatePresence>

      {/* Group Login Modal */}
      <AnimatePresence>
        {isGroupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#151619] border border-white/10 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="text-2xl font-bold">Group Workspace</h3>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mt-1">Add session members</p>
                </div>
                <button onClick={() => setIsGroupModalOpen(false)} className="text-white/40 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                  <input 
                    type="text"
                    placeholder="Search students by name..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      const results = allStudents.filter(u => u.name.toLowerCase().includes(e.target.value.toLowerCase()));
                      setSearchResults(e.target.value ? results : []);
                    }}
                    className="w-full pl-12 pr-4 py-3 bg-black border border-white/10 rounded-xl focus:outline-none focus:border-[#F27D26] text-sm"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Current Group</label>
                    <span className="text-[10px] text-[#F27D26] font-bold">{partners.length + 1} / 4 Members</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-[#F27D26]/10 border border-[#F27D26]/20 rounded-xl">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-[#F27D26] flex items-center justify-center font-bold text-xs text-white">
                           {profile?.name.charAt(0)}
                         </div>
                         <span className="text-sm font-bold">{profile?.name} (You)</span>
                      </div>
                    </div>
                    {partners.map(p => (
                      <div key={p.uid} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs text-white/40">
                             {p.name.charAt(0)}
                           </div>
                           <span className="text-sm font-bold">{p.name}</span>
                        </div>
                        <button 
                          onClick={() => setPartners(prev => prev.filter(ptr => ptr.uid !== p.uid))}
                          className="text-white/20 hover:text-red-500 transition-colors"
                        >
                          <UserMinus size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {searchQuery && (
                  <div className="pt-4 border-t border-white/5 space-y-2 max-h-48 overflow-y-auto">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Results</label>
                    {searchResults.length > 0 ? searchResults.map(res => (
                      <button 
                        key={res.uid}
                        onClick={() => {
                          if (!partners.find(p => p.uid === res.uid) && partners.length < 3) {
                            setPartners(prev => [...prev, res]);
                            setSearchQuery('');
                            setSearchResults([]);
                          } else if (partners.length >= 3) {
                            toast.error('Max 4 members per group');
                          }
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group"
                      >
                         <span className="text-sm font-medium">{res.name}</span>
                         <UserPlus size={18} className="text-white/20 group-hover:text-[#F27D26]" />
                      </button>
                    )) : (
                      <p className="text-center py-4 text-xs text-white/20">No students found</p>
                    )}
                  </div>
                )}
                
                <button 
                  onClick={() => setIsGroupModalOpen(false)}
                  className="w-full py-4 bg-[#F27D26] text-white rounded-xl font-bold text-sm tracking-widest uppercase hover:bg-[#d66a1e] transition-all"
                >
                  Start Group Session
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project Modal */}
      <AnimatePresence>
        {activeProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#151619] border border-white/10 rounded-[3rem] w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="text-2xl font-bold">{activeProject.title}</h3>
                  <p className="text-white/40 text-xs uppercase tracking-widest font-mono mt-1">Project Resources & Submission</p>
                </div>
                <button 
                  onClick={() => setActiveProject(null)}
                  className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-[#F27D26]">Instructions</h4>
                      <p className="text-white/70 leading-relaxed">{activeProject.description}</p>
                    </div>

                    {activeProject.projectImages && activeProject.projectImages.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-black uppercase tracking-widest text-[#F27D26]">Project Gallery</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {activeProject.projectImages.map((img, idx) => (
                            <div key={idx} className="aspect-video rounded-2xl overflow-hidden border border-white/10">
                              <img src={img} alt={`Project ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeProject.componentIds && activeProject.componentIds.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-black uppercase tracking-widest text-[#F27D26]">Components Used</h4>
                        <div className="flex flex-wrap gap-2">
                          {activeProject.componentIds.map((compId, idx) => (
                            <span key={idx} className="px-3 py-1 bg-[#F27D26]/10 text-[#F27D26] text-xs font-bold rounded-lg border border-[#F27D26]/20">
                              {compId}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeProject.componentsUsed && activeProject.componentsUsed.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-black uppercase tracking-widest text-[#F27D26]">Components Used</h4>
                        <div className="flex flex-wrap gap-2">
                          {activeProject.componentsUsed.map((comp, idx) => (
                            <span key={idx} className="px-3 py-1 bg-[#F27D26]/10 text-[#F27D26] text-xs font-bold rounded-lg border border-[#F27D26]/20">
                              {comp}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeProject.driveUrl && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-black uppercase tracking-widest text-[#F27D26]">Learning Material</h4>
                        <div className="aspect-video rounded-3xl overflow-hidden border border-white/10 bg-black">
                          <GoogleDriveViewer url={activeProject.driveUrl} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-8">
                    <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5">
                      <h4 className="text-sm font-black uppercase tracking-widest text-[#F27D26] mb-6">Your Submission</h4>
                      
                      {submissions.find(s => s.projectId === activeProject.id) ? (
                        <div className="space-y-6">
                          <div className="aspect-video rounded-2xl overflow-hidden border border-white/10">
                            <img 
                              src={submissions.find(s => s.projectId === activeProject.id)?.photoUrl} 
                              alt="Submission" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400">
                            <CheckCircle size={20} />
                            <span className="text-xs font-bold uppercase tracking-widest">Project Successfully Submitted</span>
                          </div>
                          {submissions.find(s => s.projectId === activeProject.id)?.feedback && (
                            <div className="p-6 bg-[#F27D26]/5 border border-[#F27D26]/10 rounded-2xl">
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#F27D26] mb-2">Teacher Feedback</p>
                              <p className="text-sm italic text-white/70">"{submissions.find(s => s.projectId === activeProject.id)?.feedback}"</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-6 text-center py-10">
                          <p className="text-sm text-white/40 mb-6">Please submit your project photo via the "My Projects" page.</p>
                          <Link 
                            to="/projects"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-[#F27D26] text-white rounded-xl font-bold text-sm"
                          >
                            Go to Projects <ChevronRight size={18} />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

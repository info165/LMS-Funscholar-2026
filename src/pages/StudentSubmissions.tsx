import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Submission, SimulationSubmission, School, UserProfile, Project, ThematicSubmission } from '../types';
import { useAuth } from '../AuthContext';
import { FolderOpen, Cpu, CheckCircle, XCircle, Search, Star, Loader2, ExternalLink, Clock, User, ClipboardList, Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { getDirectImageUrl } from '../lib/utils';

export default function StudentSubmissions() {
  const { profile } = { profile: useAuth().profile };
  const [activeTab, setActiveTab] = useState<'projects' | 'simulators'>('projects');
  
  // Master Lists
  const [standardSubmissions, setStandardSubmissions] = useState<Submission[]>([]);
  const [thematicSubmissions, setThematicSubmissions] = useState<ThematicSubmission[]>([]);
  const [simulationSubmissions, setSimulationSubmissions] = useState<SimulationSubmission[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  // Search, Filtering & Feedback states
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [activeSubmittingId, setActiveSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    // Fetch Standard Submissions
    const unsubStandSub = onSnapshot(collection(db, 'submissions'), (snapshot) => {
      setStandardSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'submissions'));

    // Fetch Thematic (Leaderboard Arena) Submissions
    const unsubThemSub = onSnapshot(collection(db, 'thematicSubmissions'), (snapshot) => {
      setThematicSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ThematicSubmission)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'thematicSubmissions'));

    // Fetch Simulator Submissions
    const unsubSimSub = onSnapshot(collection(db, 'simulationSubmissions'), (snapshot) => {
      setSimulationSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimulationSubmission)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'simulationSubmissions'));

    // Fetch Students
    const studentQ = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubStudents = onSnapshot(studentQ, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'users'));

    // Fetch Projects metadata
    const unsubProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'projects'));

    // Fetch Schools
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'schools'));

    return () => {
      unsubStandSub();
      unsubThemSub();
      unsubSimSub();
      unsubStudents();
      unsubProjects();
      unsubSchools();
    };
  }, [profile]);

  if (!profile) return null;

  // Filter out teacher's mapped schools
  const teacherSchools = profile.schoolIds || [];
  const assignedSchoolsList = schools.filter(s => teacherSchools.includes(s.id));

  // Match students belonging to the teacher's mapped schools
  const mappedStudentsMap = new Map<string, UserProfile>();
  students.forEach(st => {
    const studentSchoolIds = st.schoolIds || [];
    const shareSchool = studentSchoolIds.some(id => teacherSchools.includes(id));
    if (shareSchool) {
      mappedStudentsMap.set(st.uid, st);
    }
  });

  // Filter Submissions to only show students mapped to teaching schools
  const relevantProjectSubs = [
    ...standardSubmissions.filter(sub => {
      // Overlapping schoolId check or student profile check
      const isDirectMatch = sub.schoolId && teacherSchools.includes(sub.schoolId);
      const isProfileMatch = mappedStudentsMap.has(sub.studentId);
      return isDirectMatch || isProfileMatch;
    }).map(sub => ({ ...sub, isThematic: false as const })),
    ...thematicSubmissions.filter(sub => {
      const isDirectMatch = sub.schoolId && teacherSchools.includes(sub.schoolId);
      const isProfileMatch = mappedStudentsMap.has(sub.studentId);
      return isDirectMatch || isProfileMatch;
    }).map(sub => ({ ...sub, isThematic: true as const }))
  ];

  const relevantSimulatorSubs = simulationSubmissions.filter(sub => {
    const isDirectMatch = sub.schoolId && teacherSchools.includes(sub.schoolId);
    const isProfileMatch = mappedStudentsMap.has(sub.studentId);
    return isDirectMatch || isProfileMatch;
  });

  // Application of filter controls (School & Search query)
  const applyFilters = (items: any[]) => {
    return items.filter(item => {
      // Find matches across schools
      const studentProfile = mappedStudentsMap.get(item.studentId);
      const studentSchoolId = item.schoolId || studentProfile?.schoolIds?.[0];
      
      const schoolMatch = schoolFilter === 'all' || studentSchoolId === schoolFilter;

      // Find search query matches
      const studentName = (item.studentName || studentProfile?.name || '').toLowerCase();
      const studentEmail = (item.studentEmail || studentProfile?.email || '').toLowerCase();
      const projTitle = (item.projectTitle || item.themeTitle || item.labTitle || '').toLowerCase();
      const queryStr = searchQuery.toLowerCase();

      const searchMatch = searchQuery === '' || 
        studentName.includes(queryStr) || 
        studentEmail.includes(queryStr) || 
        projTitle.includes(queryStr);

      return schoolMatch && searchMatch;
    });
  };

  const filteredProjectsList = applyFilters(relevantProjectSubs);
  const filteredSimulatorsList = applyFilters(relevantSimulatorSubs);

  // Grading controller
  const handleEvaluateProject = async (sub: any, approve: boolean) => {
    const key = sub.id;
    const note = feedbackInputs[key]?.trim() || (approve 
      ? 'Outstanding execution! Your documentation of pins, photos, and files demonstrates comprehensive engineering competency.' 
      : 'Revision requested. Please clarify your electronic wiring or upload a higher definition image representing your prototype.');

    setActiveSubmittingId(key);

    try {
      if (sub.isThematic) {
        // Evaluate thematic (leaderboard contest) project submission
        await updateDoc(doc(db, 'thematicSubmissions', sub.id), {
          status: approve ? 'approved' : 'rejected',
          teacherFeedback: note,
          teacherId: profile.uid,
          teacherName: profile.name,
          pointsAwarded: approve ? 100 : 0
        });

        if (approve) {
          // Reward student with 100 PTS and 300 XP
          await updateDoc(doc(db, 'users', sub.studentId), {
            projectPoints: increment(100),
            totalPoints: increment(100),
            xp: increment(300)
          });
          toast.success('Leaderboard creative project approved! +100 PTS & +300 XP credited to student standings.');
        } else {
          toast.success('Leaderboard project rejected. Custom revision instructions deployed to student.');
        }
      } else {
        // Traditional course project submission
        await updateDoc(doc(db, 'submissions', sub.id), {
          status: approve ? 'approved' : 'rejected',
          feedback: note,
          rating: approve ? 5 : 0
        });

        if (approve) {
          // Reward student with 50 XP standard
          await updateDoc(doc(db, 'users', sub.studentId), {
            projectPoints: increment(50),
            totalPoints: increment(50),
            xp: increment(250) // Bonus direct gamification level standings
          });
          toast.success('Project submission approved! +50 PTS & +250 XP credited to student standings.');
        } else {
          toast.success('Submission rejected. Custom revision instructions deployed to student dashboard.');
        }
      }

      // Smooth clear
      setFeedbackInputs(prev => ({ ...prev, [key]: '' }));
    } catch (err) {
      console.error(err);
      toast.error('Failed to commit submission evaluation.');
    } finally {
      setActiveSubmittingId(null);
    }
  };

  const handleEvaluateSimulator = async (sub: SimulationSubmission, approve: boolean) => {
    const key = sub.id;
    const note = feedbackInputs[key]?.trim() || (approve 
      ? 'Impeccable electronic circuit logic! Excellent virtual signal behavior and routing.' 
      : 'Re-examine your pin configurations and simulator serial monitor feedback. Make edits and resubmit.');

    setActiveSubmittingId(key);

    try {
      await updateDoc(doc(db, 'simulationSubmissions', sub.id), {
        status: approve ? 'approved' : 'rejected',
        teacherFeedback: note,
        teacherId: profile.uid,
        teacherName: profile.name,
        pointsAwarded: approve ? 100 : 0
      });

      if (approve) {
        // Increment student total points exactly like original lab grader 
        await updateDoc(doc(db, 'users', sub.studentId), {
          projectPoints: increment(100),
          totalPoints: increment(100),
          xp: increment(300)
        });
        toast.success('Circuit simulation approved! +100 PTS and revision logs completed.');
      } else {
        toast.success('Simulation rejected. Revision notes successfully dispatched.');
      }

      // Smooth clear
      setFeedbackInputs(prev => ({ ...prev, [key]: '' }));
    } catch (err) {
      console.error(err);
      toast.error('Failed to dispatch simulation evaluation.');
    } finally {
      setActiveSubmittingId(null);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10 space-y-8 select-none">
      
      {/* Header Block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <ClipboardList className="text-[#F27D26]" size={36} />
            Student Submissions
          </h2>
          <p className="text-white/40 text-xs font-mono uppercase tracking-widest mt-1">
            Review and grade submitted physical models and modular virtual sandbox circuits
          </p>
        </div>

        {/* School Dropdown filter */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl w-full sm:w-60">
            <Search className="text-white/40 shrink-0" size={16} />
            <input
              type="text"
              placeholder="Search students or titles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-sm focus:outline-none w-full text-white placeholder-white/30"
            />
          </div>

          <select
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value)}
            className="bg-white/5 border border-white/10 text-white rounded-xl text-sm py-2.5 px-4 outline-none font-bold hover:bg-white/10 transition-colors w-full sm:w-auto"
          >
            <option value="all" className="bg-zinc-950 text-white">All Schools</option>
            {assignedSchoolsList.map(sch => (
              <option key={sch.id} value={sch.id} className="bg-zinc-950 text-white">{sch.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs list selector */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-xl w-full max-w-sm">
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex-1 py-3 px-4 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            activeTab === 'projects' 
              ? 'bg-[#F27D26] text-white' 
              : 'text-white/40 hover:text-white'
          }`}
        >
          <FolderOpen size={14} />
          Projects ({filteredProjectsList.length})
        </button>
        <button
          onClick={() => setActiveTab('simulators')}
          className={`flex-1 py-3 px-4 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            activeTab === 'simulators' 
              ? 'bg-[#F27D26] text-white' 
              : 'text-white/40 hover:text-white'
          }`}
        >
          <Cpu size={14} />
          Wokwi Simulator ({filteredSimulatorsList.length})
        </button>
      </div>

      {/* Main viewport */}
      <div className="space-y-6">
        
        {/* Projects Tab viewport */}
        {activeTab === 'projects' && (
          <div className="grid grid-cols-1 gap-6">
            {filteredProjectsList.length === 0 ? (
              <div className="py-20 text-center bg-[#111] border border-dashed border-white/5 rounded-2xl">
                <FolderOpen className="mx-auto text-white/10 mb-4" size={48} />
                <h3 className="text-lg font-black text-white/50">No project submissions</h3>
                <p className="text-xs text-white/30 font-mono mt-1">Ensure students complete and submit their robotic model tasks.</p>
              </div>
            ) : (
              filteredProjectsList.map((sub) => {
                const studentProfile = mappedStudentsMap.get(sub.studentId);
                const projectMeta = projects.find(p => p.id === sub.projectId);
                
                return (
                  <div key={sub.id} className="p-6 bg-[#121214] border border-white/5 rounded-2xl flex flex-col xl:flex-row gap-6 hover:border-white/10 transition-colors">
                    
                    {/* Left Column: Student Details & Files */}
                    <div className="flex-1 space-y-4">
                      
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#F27D26] bg-[#F27D26]/10 border border-[#F27D26]/20 px-2 py-0.5 rounded">
                            {sub.isThematic ? (sub.themeTitle || 'Leaderboard Creative Contest') : (projectMeta?.title || sub.projectTitle || 'Project Submission')}
                          </span>
                          <h3 className="text-xl font-bold mt-2 text-white flex items-center gap-2">
                            <User size={16} className="text-white/40" />
                            {sub.studentName || studentProfile?.name || 'A Learning Student'}
                          </h3>
                          <p className="text-xs text-white/40 font-mono mt-0.5">
                            {sub.studentEmail || studentProfile?.email || 'N/A'} • Class {studentProfile?.classSection || 'N/A'}
                          </p>
                          <p className="text-xs text-[#F27D26]/80 font-mono font-medium mt-1">
                            School: {schools.find(s => s.id === (sub.schoolId || studentProfile?.schoolIds?.[0]))?.name || 'Local School'}
                          </p>
                        </div>
                        
                        {/* Status tag */}
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            sub.status === 'approved' 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : sub.status === 'rejected'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              sub.status === 'approved' ? 'bg-green-400' : sub.status === 'rejected' ? 'bg-red-400' : 'bg-yellow-400'
                            }`} />
                            {sub.status === 'approved' ? 'Accepted' : sub.status === 'rejected' ? 'Revision Requested' : 'Awaiting Review'}
                          </span>
                          <p className="text-[10px] text-white/30 font-mono mt-1 flex items-center justify-end gap-1">
                            <Clock size={10} />
                            {formatDate(sub.timestamp)}
                          </p>
                        </div>
                      </div>

                      {/* Display attachment file logic */}
                      <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-4">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono">Submitted Materials:</p>
                        <div className="flex flex-col gap-4">
                          {sub.photoUrl && (
                            <div className="space-y-3">
                              <div className="w-56 aspect-[4/3] bg-black rounded-lg overflow-hidden border border-white/10 shrink-0">
                                <img src={getDirectImageUrl(sub.photoUrl)} alt="Student project prototype" className="w-full h-full object-cover" />
                              </div>
                              <a 
                                href={sub.photoUrl} 
                                target="_blank" 
                                referrerPolicy="no-referrer"
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-black uppercase rounded-lg transition-colors text-[#F27D26]"
                              >
                                <ExternalLink size={12} />
                                View Full-Res Photo
                              </a>
                            </div>
                          )}
                          {sub.videoUrl && (
                            <a 
                              href={sub.videoUrl} 
                              target="_blank" 
                              referrerPolicy="no-referrer"
                              rel="noopener noreferrer" 
                              className="inline-flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-black uppercase rounded-lg transition-colors text-blue-400"
                            >
                              <Play size={12} fill="currentColor" />
                              View Submitted Video
                            </a>
                          )}
                          {sub.isThematic && sub.description && (
                            <div className="pt-3 border-t border-white/5 text-xs text-white/80 leading-relaxed italic">
                              <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block not-italic mb-1 font-mono">Project Idea & Working Logic:</span>
                              "{sub.description}"
                            </div>
                          )}
                          {!sub.videoUrl && !sub.photoUrl && (
                            <p className="text-xs italic text-white/30">No multimedia attachments loaded.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Note Feedback Box and grading actions */}
                    <div className="w-full xl:w-96 flex flex-col justify-between p-5 bg-white/5 border border-white/5 rounded-xl space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[#F27D26] font-mono">
                          Teacher Review Note:
                        </label>
                        <textarea
                          rows={3}
                          placeholder={sub.isThematic ? (sub.teacherFeedback || "Add review comments...") : (sub.feedback || "Add review comments...")}
                          value={feedbackInputs[sub.id] || ''}
                          onChange={(e) => setFeedbackInputs({ ...feedbackInputs, [sub.id]: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 focus:border-[#F27D26] outline-none text-xs rounded-lg p-2.5 text-white/90 placeholder-white/30 resize-none font-sans"
                        />
                        {(sub.isThematic ? sub.teacherFeedback : sub.feedback) && (
                          <div className="mt-1.5 p-2 bg-black/20 rounded border border-white/5 text-[9px] text-white/40 italic break-words">
                            Current published note: "{sub.isThematic ? sub.teacherFeedback : sub.feedback}"
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button
                          disabled={activeSubmittingId !== null}
                          onClick={() => handleEvaluateProject(sub, true)}
                          className="flex-1 py-2 px-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/20 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {activeSubmittingId === sub.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                          Accept
                        </button>
                        <button
                          disabled={activeSubmittingId !== null}
                          onClick={() => handleEvaluateProject(sub, false)}
                          className="flex-1 py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {activeSubmittingId === sub.id ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Simulators Tab viewport */}
        {activeTab === 'simulators' && (
          <div className="grid grid-cols-1 gap-6">
            {filteredSimulatorsList.length === 0 ? (
              <div className="py-20 text-center bg-[#111] border border-dashed border-white/5 rounded-2xl">
                <Cpu className="mx-auto text-white/10 mb-4" size={48} />
                <h3 className="text-lg font-black text-white/50">No Wokwi submissions</h3>
                <p className="text-xs text-white/30 font-mono mt-1">Ensure students compile and submit virtual Wokwi circuit models.</p>
              </div>
            ) : (
              filteredSimulatorsList.map((sub) => {
                const studentProfile = mappedStudentsMap.get(sub.studentId);
                
                return (
                  <div key={sub.id} className="p-6 bg-[#121214] border border-white/5 rounded-2xl flex flex-col xl:flex-row gap-6 hover:border-white/10 transition-colors">
                    
                    {/* Left Column: Student Details & Schematic Wokwi Link */}
                    <div className="flex-1 space-y-4">
                      
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                            {sub.labTitle || 'Wokwi IoT Design Challenge'}
                          </span>
                          <h3 className="text-xl font-bold mt-2 text-white flex items-center gap-2">
                            <User size={16} className="text-white/40" />
                            {sub.studentName || studentProfile?.name || 'A Learning Student'}
                          </h3>
                          <p className="text-xs text-white/40 font-mono mt-0.5">
                            {sub.studentEmail || studentProfile?.email || 'N/A'} • Class {sub.classSection || studentProfile?.classSection || 'N/A'}
                          </p>
                          <p className="text-xs text-blue-400 font-mono font-medium mt-1">
                            School: {schools.find(s => s.id === (sub.schoolId || studentProfile?.schoolIds?.[0]))?.name || 'Local School'}
                          </p>
                        </div>
                        
                        {/* Status tag */}
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            sub.status === 'approved' 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : sub.status === 'rejected'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              sub.status === 'approved' ? 'bg-green-400' : sub.status === 'rejected' ? 'bg-red-400' : 'bg-yellow-400'
                            }`} />
                            {sub.status === 'approved' ? 'Accepted' : sub.status === 'rejected' ? 'Revision Requested' : 'Awaiting Review'}
                          </span>
                          <p className="text-[10px] text-white/30 font-mono mt-1 flex items-center justify-end gap-1">
                            <Clock size={10} />
                            {formatDate(sub.timestamp)}
                          </p>
                        </div>
                      </div>

                      {/* Display schematic emulator details */}
                      <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono">Wokwi Diagram Details:</p>
                        <p className="text-xs text-white/80 max-w-xl break-words">
                          <span className="font-bold text-white">Student's Notes:</span> "{sub.description || 'No sandbox description available'}"
                        </p>
                        
                        <div className="flex flex-wrap gap-4 pt-1.5">
                          <a 
                            href={`https://wokwi.com/projects/${sub.wokwiUrl}`} 
                            target="_blank" 
                            referrerPolicy="no-referrer"
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-xs font-black uppercase rounded-lg transition-colors text-blue-400 cursor-pointer font-sans"
                          >
                            <ExternalLink size={12} />
                            Launch Virtual Circuit Sandbox
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Note Feedback Box and grading actions */}
                    <div className="w-full xl:w-96 flex flex-col justify-between p-5 bg-white/5 border border-white/5 rounded-xl space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[#F27D26] font-mono">
                          Teacher Review Note:
                        </label>
                        <textarea
                          rows={3}
                          placeholder={sub.teacherFeedback || "Add review comments, feedback details or notes for why you are accepting/rejecting this circuit design..."}
                          value={feedbackInputs[sub.id] || ''}
                          onChange={(e) => setFeedbackInputs({ ...feedbackInputs, [sub.id]: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 focus:border-[#F27D26] outline-none text-xs rounded-lg p-2.5 text-white/90 placeholder-white/30 resize-none font-sans"
                        />
                        {sub.teacherFeedback && (
                          <div className="mt-1.5 p-2 bg-black/20 rounded border border-white/5 text-[9px] text-white/40 italic break-words">
                            Current published note: "{sub.teacherFeedback}"
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button
                          disabled={activeSubmittingId !== null}
                          onClick={() => handleEvaluateSimulator(sub, true)}
                          className="flex-1 py-2 px-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/20 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {activeSubmittingId === sub.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                          Accept
                        </button>
                        <button
                          disabled={activeSubmittingId !== null}
                          onClick={() => handleEvaluateSimulator(sub, false)}
                          className="flex-1 py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {activeSubmittingId === sub.id ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}

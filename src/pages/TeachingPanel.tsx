import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { School, Course, Module, Component } from '../types';
import { 
  GraduationCap, Play, ChevronRight, ChevronLeft, Sliders, 
  HelpCircle, Sparkles, Clock, CheckCircle2, BookOpen, 
  AlertCircle, ArrowRight, BookMarked, Compass, Calendar, Search, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { ModulePlayer } from '../components/ModulePlayer';

// Day-wise Class Item type (aligned with AdminCurriculum and Logs)
interface CurriculumClass {
  classNumber: number;
  courseId: string;
  courseTitle: string;
  lessonId: string; // Module ID
  lessonTitle: string; // Module Title
}

interface SchoolCurriculum {
  id: string; // schoolId_grade
  schoolId: string;
  schoolName: string;
  grade: string;
  numberOfClasses: number;
  selectedCourseIds: string[];
  classes: CurriculumClass[];
  updatedAt: string;
}

interface CurriculumProgress {
  id: string; // schoolId_grade_section
  schoolId: string;
  grade: string;
  section: string;
  teacherId: string;
  teacherName: string;
  statuses: {
    classNumber: number;
    courseId: string;
    lessonId: string;
    status: 'Complete' | 'In Progress' | 'Not Started';
    start_date?: string;
    end_date?: string;
    lastActiveStepIdx?: number;
  }[];
  updatedAt: string;
}

const GRADES_DISPLAY = [
  { value: 'LKG', label: 'LKG' },
  { value: 'UKG', label: 'UKG' },
  { value: '1', label: 'Class 1' },
  { value: '2', label: 'Class 2' },
  { value: '3', label: 'Class 3' },
  { value: '4', label: 'Class 4' },
  { value: '5', label: 'Class 5' },
  { value: '6', label: 'Class 6' },
  { value: '7', label: 'Class 7' },
  { value: '8', label: 'Class 8' },
  { value: '9', label: 'Class 9' },
  { value: '10', label: 'Class 10' },
  { value: '11', label: 'Class 11' },
  { value: '12', label: 'Class 12' }
];

const SECTIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A to Z

export default function TeachingPanel() {
  const { profile } = useAuth();
  
  // Master data lists
  const [schools, setSchools] = useState<School[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [curriculums, setCurriculums] = useState<SchoolCurriculum[]>([]);
  const [progresses, setProgresses] = useState<CurriculumProgress[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection state (Step 1)
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  
  // Selection step control
  const [step, setStep] = useState<1 | 2>(1);

  // Search filter for school modal
  const [schoolSearch, setSchoolSearch] = useState('');
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);

  // Active playing module
  const [activePlayModule, setActivePlayModule] = useState<Module | null>(null);
  const [activeClassNumber, setActiveClassNumber] = useState<number>(-1);
  const [initialStepIdx, setInitialStepIdx] = useState<number>(-1);

  // Fetch collections
  useEffect(() => {
    if (!profile) return;

    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      const schoolData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
      setSchools(schoolData);
      
      // If teacher only has 1 school, auto-select it
      const myAssignedSchools = schoolData.filter(s => profile.schoolIds?.includes(s.id));
      if (myAssignedSchools.length === 1) {
        setSelectedSchool(myAssignedSchools[0]);
      }
      setLoading(false);
    }, err => handleFirestoreError(err, OperationType.LIST, 'schools'));

    const unsubModules = onSnapshot(collection(db, 'modules'), (snapshot) => {
      setModules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'modules'));

    const unsubComponents = onSnapshot(collection(db, 'components'), (snapshot) => {
      setComponents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Component)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'components'));

    const unsubCurrics = onSnapshot(collection(db, 'schoolCurriculums'), (snapshot) => {
      setCurriculums(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCurriculum)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'schoolCurriculums'));

    const unsubProgress = onSnapshot(collection(db, 'curriculumProgress'), (snapshot) => {
      setProgresses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CurriculumProgress)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'curriculumProgress'));

    return () => {
      unsubSchools();
      unsubModules();
      unsubComponents();
      unsubCurrics();
      unsubProgress();
    };
  }, [profile]);

  // Filter schools down to only this teacher's active scope
  const teacherSchools = schools.filter(s => {
    if (profile?.role === 'admin') return true;
    return profile?.schoolIds?.includes(s.id);
  });

  const filteredModalSchools = teacherSchools.filter(s => 
    s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
    s.location.toLowerCase().includes(schoolSearch.toLowerCase())
  );

  // Get active curriculum for selected School + Grade
  const activeCurriculum = curriculums.find(
    c => c.schoolId === selectedSchool?.id && c.grade === selectedGrade
  );

  // Get active progress document for School + Grade + Section
  const activeProgress = progresses.find(
    p => p.schoolId === selectedSchool?.id && p.grade === selectedGrade && p.section === selectedSection
  );

  // Function to find lesson status and saved step index
  const getLessonStatusInfo = (classNumber: number, lessonId: string) => {
    if (!activeProgress) {
      return { status: 'Not Started' as const, lastActiveStepIdx: -1 };
    }
    const match = activeProgress.statuses?.find(
      s => s.classNumber === classNumber && s.lessonId === lessonId
    );
    return {
      status: match?.status || 'Not Started',
      lastActiveStepIdx: match?.lastActiveStepIdx !== undefined ? match.lastActiveStepIdx : -1
    };
  };

  // Automated step-progress saving logic
  const handleStepChange = async (moduleId: string, classNumber: number, stepIdx: number, totalSteps: number) => {
    if (!selectedSchool || !selectedGrade || !selectedSection || classNumber === -1) return;
    
    const docId = `${selectedSchool.id}_${selectedGrade}_${selectedSection}`;
    const docRef = doc(db, 'curriculumProgress', docId);
    
    try {
      const docSnap = await getDoc(docRef);
      let existingStatuses = [];
      let teacherName = profile?.name || 'Assigned Teacher';
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        existingStatuses = data.statuses || [];
        if (data.teacherName) {
          teacherName = data.teacherName;
        }
      }
      
      const todayStr = new Date().toISOString().split('T')[0];
      let updated = false;
      
      const newStatuses = existingStatuses.map((item: any) => {
        if (item.classNumber === classNumber && item.lessonId === moduleId) {
          updated = true;
          
          let newStatus = item.status;
          let start_date = item.start_date || '';
          let end_date = item.end_date || '';
          
          // If they advanced into the lesson steps, make it In Progress
          if (stepIdx >= 0 && newStatus === 'Not Started') {
            newStatus = 'In Progress';
            start_date = start_date || todayStr;
          }
          
          // If they arrived at the final step, mark as Complete
          if (totalSteps > 0 && stepIdx === totalSteps - 1) {
            newStatus = 'Complete';
            start_date = start_date || todayStr;
            end_date = end_date || todayStr;
          }
          
          return {
            ...item,
            status: newStatus,
            start_date,
            end_date,
            lastActiveStepIdx: stepIdx
          };
        }
        return item;
      });
      
      if (!updated) {
        let initialStatus = 'Not Started';
        let start_date = '';
        let end_date = '';
        
        if (stepIdx >= 0) {
          initialStatus = 'In Progress';
          start_date = todayStr;
        }
        
        if (totalSteps > 0 && stepIdx === totalSteps - 1) {
          initialStatus = 'Complete';
          start_date = todayStr;
          end_date = todayStr;
        }
        
        newStatuses.push({
          classNumber,
          courseId: activeCurriculum?.classes.find(c => c.classNumber === classNumber)?.courseId || '',
          lessonId: moduleId,
          status: initialStatus,
          start_date,
          end_date,
          lastActiveStepIdx: stepIdx
        });
      }
      
      await setDoc(docRef, {
        id: docId,
        schoolId: selectedSchool.id,
        grade: selectedGrade,
        section: selectedSection,
        teacherId: profile?.uid || '',
        teacherName,
        statuses: newStatuses,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
    } catch (err) {
      console.error("Error saving step progress automatically:", err);
    }
  };

  // Mark lesson as complete on finish callback
  const handleLessonComplete = async (moduleId: string, classNumber: number, totalSteps: number) => {
    if (!selectedSchool || !selectedGrade || !selectedSection || classNumber === -1) return;
    
    const docId = `${selectedSchool.id}_${selectedGrade}_${selectedSection}`;
    const docRef = doc(db, 'curriculumProgress', docId);
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      const docSnap = await getDoc(docRef);
      let existingStatuses = [];
      let teacherName = profile?.name || 'Assigned Teacher';
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        existingStatuses = data.statuses || [];
        if (data.teacherName) {
          teacherName = data.teacherName;
        }
      }
      
      let updated = false;
      const newStatuses = existingStatuses.map((item: any) => {
        if (item.classNumber === classNumber && item.lessonId === moduleId) {
          updated = true;
          return {
            ...item,
            status: 'Complete',
            start_date: item.start_date || todayStr,
            end_date: todayStr,
            lastActiveStepIdx: totalSteps > 0 ? totalSteps - 1 : 0
          };
        }
        return item;
      });

      if (!updated) {
        newStatuses.push({
          classNumber,
          courseId: activeCurriculum?.classes.find(c => c.classNumber === classNumber)?.courseId || '',
          lessonId: moduleId,
          status: 'Complete',
          start_date: todayStr,
          end_date: todayStr,
          lastActiveStepIdx: totalSteps > 0 ? totalSteps - 1 : 0
        });
      }

      await setDoc(docRef, {
        id: docId,
        schoolId: selectedSchool.id,
        grade: selectedGrade,
        section: selectedSection,
        teacherId: profile?.uid || '',
        teacherName,
        statuses: newStatuses,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      toast.success("Lesson marked as completed successfully!");
    } catch (err) {
      console.error("Error setting lesson completed:", err);
    }
  };

  // Launch lesson player
  const startLessonPlayer = (moduleId: string, classNumber: number, startFromBeginning: boolean) => {
    const foundModule = modules.find(m => m.id === moduleId);
    if (!foundModule) {
      toast.error("Module lesson content is not found in database.");
      return;
    }
    
    setActiveClassNumber(classNumber);
    const { lastActiveStepIdx } = getLessonStatusInfo(classNumber, moduleId);
    
    setInitialStepIdx(startFromBeginning ? -1 : lastActiveStepIdx);
    setActivePlayModule(foundModule);
  };

  // General "Resume/Continue Curriculum" sequencing helper
  const handleResumeCurriculumSequence = () => {
    if (!activeCurriculum) return;
    
    // Find first day that is not complete
    const firstIncompleteDay = activeCurriculum.classes.find(cls => {
      const info = getLessonStatusInfo(cls.classNumber, cls.lessonId);
      return info.status !== 'Complete';
    });
    
    if (firstIncompleteDay) {
      const info = getLessonStatusInfo(firstIncompleteDay.classNumber, firstIncompleteDay.lessonId);
      // If never started, open from beginning (Overview / -1). Otherwise resume
      const startFromBeginning = info.status === 'Not Started';
      startLessonPlayer(firstIncompleteDay.lessonId, firstIncompleteDay.classNumber, startFromBeginning);
      toast.success(`Automatically opened Day ${firstIncompleteDay.classNumber}: ${firstIncompleteDay.lessonTitle}`);
    } else {
      // All days are completed! Start the last lesson from page 1 as fallback or show congrats
      toast.success("All curriculum classes in this schedule are completed! Opening the final day's lesson from the start.");
      const lastDay = activeCurriculum.classes[activeCurriculum.classes.length - 1];
      if (lastDay) {
        startLessonPlayer(lastDay.lessonId, lastDay.classNumber, true);
      }
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-[#F27D26]/10 rounded-xl text-[#F27D26]">
               <GraduationCap size={26} />
             </div>
             <h2 className="text-4xl font-bold tracking-tight">Teacher Teaching Panel</h2>
          </div>
          <p className="text-white/40 font-mono text-[10px] uppercase tracking-widest pl-1">
            Conduct live classrooms directly from mapped curricula
          </p>
        </div>
      </header>

      {/* ERROR HANDLERS */}
      {loading ? (
        <div className="text-center py-24 text-white/50">
          <Clock className="animate-spin mx-auto text-[#F27D26] mb-4" size={32} />
          <span>Loading parameters...</span>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {step === 1 ? (
            // STEP 1: CLASS SELECTION FORM
            <motion.div
              key="step1-form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 space-y-8 max-w-3xl mx-auto shadow-2xl relative overflow-hidden"
              id="teaching-selection-form"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_70%_30%,#F27D26_0%,transparent_70%)] opacity-20 pointer-events-none" />

              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Sliders size={20} className="text-[#F27D26]" />
                  Select Classroom Parameters
                </h3>
                <p className="text-white/40 text-xs mt-1.5 leading-relaxed">
                  Choose the school, grade, and section to access the tailored lesson sequence mapped by the administrator.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* SCHOOL SELECTION */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-white/40 block">
                    School
                  </label>
                  <button
                    type="button"
                    id="school-dropdown-btn"
                    disabled={teacherSchools.length <= 1}
                    onClick={() => setIsSchoolModalOpen(true)}
                    className="w-full bg-black/40 disabled:opacity-75 border border-white/10 hover:border-white/20 rounded-2xl px-5 py-4 text-xs text-white flex items-center justify-between transition-all text-left"
                  >
                    <span className="truncate">
                      {selectedSchool ? selectedSchool.name : 'Select assigned school...'}
                    </span>
                    {teacherSchools.length > 1 && <ChevronRight size={16} className="text-white/40 shrink-0" />}
                  </button>
                </div>

                {/* GRADE/CLASS SELECTION */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-white/40 block">
                    Grade Level
                  </label>
                  <button
                    type="button"
                    id="grade-dropdown-btn"
                    onClick={() => setIsGradeModalOpen(true)}
                    className="w-full bg-black/40 border border-white/10 hover:border-white/20 rounded-2xl px-5 py-4 text-xs text-white flex items-center justify-between transition-all text-left"
                  >
                    <span>
                      {selectedGrade 
                        ? GRADES_DISPLAY.find(g => g.value === selectedGrade)?.label || `Grade ${selectedGrade}` 
                        : 'Select classroom grade...'}
                    </span>
                    <ChevronRight size={16} className="text-white/40 shrink-0" />
                  </button>
                </div>
              </div>

              {/* SECTION SELECTION */}
              <div className="space-y-2 max-w-xs pt-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-white/40 block">
                  Section
                </label>
                <select
                  id="section-select-dropdown"
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 hover:border-white/20 rounded-2xl px-5 py-4 text-xs text-white focus:outline-none focus:border-[#F27D26] cursor-pointer transition-colors"
                >
                  <option value="" disabled className="text-white/30">Select classroom section...</option>
                  {SECTIONS.map(s => (
                    <option key={s} value={s} className="bg-[#151619] text-white">Section {s}</option>
                  ))}
                </select>
              </div>

              {/* BUTTON FOOTER */}
              <div className="pt-6 border-t border-white/5 flex justify-end">
                <button
                  type="button"
                  id="selection-next-btn"
                  disabled={!selectedSchool || !selectedGrade || !selectedSection}
                  onClick={() => setStep(2)}
                  className="px-8 py-4 bg-[#F27D26] hover:bg-[#d66a1e] disabled:opacity-20 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-[#F27D26]/10 hover:shadow-[#F27D26]/20 transition-all"
                >
                  <span>Load Mapped Curriculum</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          ) : (
            // STEP 2: DISPLAY CURRICULUM & CONTROLS
            <motion.div
              key="step2-curriculum"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* INTERFACES TOP BAR */}
              <div className="bg-[#151619] border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-[#F27D26] text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <ChevronLeft size={16} /> Back to Parameters
                  </button>
                  <h3 className="text-xl font-bold text-white">Curriculum Delivery Dashboard</h3>
                  <p className="text-white/40 text-xs">
                    Classroom: <b className="text-white/80">{selectedSchool?.name}</b> • Grade <b className="text-white/80">{GRADES_DISPLAY.find(g => g.value === selectedGrade)?.label || selectedGrade}</b> • Section <b className="text-white/80">{selectedSection}</b>
                  </p>
                </div>

                {activeCurriculum && activeCurriculum.classes.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResumeCurriculumSequence}
                    className="px-6 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-green-600/10 hover:shadow-green-600/20 transition-all"
                  >
                    <Play size={15} fill="currentColor" />
                    <span>Resume Sequencing teaching</span>
                  </button>
                )}
              </div>

              {/* CURRICULUM DAY LIST */}
              {!activeCurriculum || activeCurriculum.classes.length === 0 ? (
                <div className="text-center py-20 bg-[#151619] border border-white/5 rounded-[2.5rem] max-w-xl mx-auto space-y-5 shadow-xl">
                  <HelpCircle size={40} className="mx-auto text-yellow-500/80 animate-pulse" />
                  <p className="text-white/90 font-bold text-base">No Mapped Curriculum Found</p>
                  <p className="text-white/40 text-xs leading-relaxed max-w-sm mx-auto">
                    The administrator has not configured a day-wise curriculum mapping for <b className="text-white/60">{selectedSchool?.name}</b> (Grade {GRADES_DISPLAY.find(g => g.value === selectedGrade)?.label || selectedGrade}) yet. Please request the administrator to map lessons.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase text-white transition-all cursor-pointer"
                  >
                    Return to Step 1
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] uppercase font-black tracking-widest text-white/30">
                      Sequential Day-wise Class Schedule
                    </span>
                    <span className="text-[10px] text-white/40 font-mono">
                      {activeCurriculum.classes.length} mapped classes
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4" id="curriculum-classes-list">
                    {activeCurriculum.classes.map((cls, idx) => {
                      const { status, lastActiveStepIdx } = getLessonStatusInfo(cls.classNumber, cls.lessonId);
                      
                      return (
                        <motion.div
                          key={cls.classNumber}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className={cn(
                            "bg-[#151619] border rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all",
                            status === 'Complete' 
                              ? 'border-green-500/20 bg-green-950/5' 
                              : status === 'In Progress'
                                ? 'border-[#F27D26]/20 bg-[#F27D26]/5'
                                : 'border-white/5 hover:border-white/10'
                          )}
                        >
                          {/* DAY AND TOPIC SUMMARY */}
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-3">
                              <span className={cn(
                                "px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                status === 'Complete' 
                                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                  : status === 'In Progress'
                                    ? 'bg-[#F27D26]/10 text-[#F27D26] border border-[#F27D26]/20'
                                    : 'bg-white/5 text-white/40 border border-white/5'
                              )}>
                                Day {cls.classNumber}
                              </span>
                              
                              {/* STATUS BADGE */}
                              <span className="text-[10px] font-semibold text-white/30">
                                {status === 'Complete' && '✓ Completed'}
                                {status === 'In Progress' && `• In Progress (Page ${lastActiveStepIdx + 2})`}
                                {status === 'Not Started' && '○ Not Started'}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <h4 className="text-lg font-bold text-white tracking-tight">{cls.lessonTitle}</h4>
                              <p className="text-white/40 text-xs flex items-center gap-1.5 font-medium">
                                <BookMarked size={12} className="text-[#F27D26]" />
                                {cls.courseTitle}
                              </p>
                            </div>
                          </div>

                          {/* ACTION BUTTONS */}
                          <div className="flex items-center gap-3 shrink-0">
                            {/* START LESSON BUTTON */}
                            <button
                              type="button"
                              onClick={() => startLessonPlayer(cls.lessonId, cls.classNumber, true)}
                              className={cn(
                                "px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border",
                                status === 'Not Started'
                                  ? "bg-[#F27D26] text-white border-transparent hover:bg-[#d66a1e] shadow-md shadow-[#F27D26]/10"
                                  : "bg-white/5 text-white/60 border-white/5 hover:bg-white/10 hover:text-white"
                              )}
                            >
                              <Play size={12} fill="currentColor" />
                              <span>Start Lesson</span>
                            </button>

                            {/* CONTINUE BUTTON */}
                            <button
                              type="button"
                              onClick={() => startLessonPlayer(cls.lessonId, cls.classNumber, false)}
                              disabled={status === 'Not Started'}
                              className={cn(
                                "px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border disabled:opacity-20 disabled:cursor-not-allowed",
                                status === 'In Progress'
                                  ? "bg-green-600 text-white border-transparent hover:bg-green-700 shadow-md shadow-green-600/10 cursor-pointer"
                                  : status === 'Complete'
                                    ? "bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white cursor-pointer"
                                    : "bg-transparent text-white/20 border-white/5"
                              )}
                            >
                              <ArrowRight size={13} />
                              <span>Continue</span>
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* MODAL 1: SCHOOL SELECTION */}
      <AnimatePresence>
        {isSchoolModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSchoolModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#151619] border border-white/10 rounded-[2.5rem] w-full max-w-lg p-6 overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <h4 className="font-bold text-white uppercase tracking-wider text-sm">Select Classroom School</h4>
                <button
                  onClick={() => setIsSchoolModalOpen(false)}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="my-4 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                <input
                  type="text"
                  placeholder="Search mapped schools..."
                  value={schoolSearch}
                  onChange={(e) => setSchoolSearch(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#F27D26]"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {filteredModalSchools.length === 0 ? (
                  <p className="text-center py-8 text-white/30 text-xs">No assigned schools found matching search criteria.</p>
                ) : (
                  filteredModalSchools.map(sch => (
                    <button
                      key={sch.id}
                      onClick={() => {
                        setSelectedSchool(sch);
                        setIsSchoolModalOpen(false);
                      }}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl text-xs transition-all border flex items-center justify-between",
                        selectedSchool?.id === sch.id
                          ? "bg-[#F27D26]/10 border-[#F27D26]/30 text-[#F27D26]"
                          : "bg-white/[0.01] hover:bg-white/5 border-transparent text-white/70 hover:text-white"
                      )}
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold">{sch.name}</p>
                        <p className="text-white/40 text-[10px]">{sch.location}, {sch.state}</p>
                      </div>
                      {selectedSchool?.id === sch.id && <CheckCircle2 size={16} className="text-[#F27D26]" />}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: GRADE SELECTION */}
      <AnimatePresence>
        {isGradeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGradeModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#151619] border border-white/10 rounded-[2.5rem] w-full max-w-lg p-6 overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
                <h4 className="font-bold text-white uppercase tracking-wider text-sm">Select Classroom Grade</h4>
                <button
                  onClick={() => setIsGradeModalOpen(false)}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2.5 pr-1 custom-scrollbar">
                {GRADES_DISPLAY.map(gr => (
                  <button
                    key={gr.value}
                    onClick={() => {
                      setSelectedGrade(gr.value);
                      setIsGradeModalOpen(false);
                    }}
                    className={cn(
                      "text-center p-4 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-2",
                      selectedGrade === gr.value
                        ? "bg-[#F27D26]/10 border-[#F27D26]/30 text-[#F27D26]"
                        : "bg-white/[0.01] hover:bg-white/5 border-transparent text-white/70 hover:text-white"
                    )}
                  >
                    <span>{gr.label}</span>
                    {selectedGrade === gr.value && <CheckCircle2 size={14} className="text-[#F27D26]" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FULL-SCREEN LESSON WORKSPACE PLAYER OVERLAY */}
      {activePlayModule && (
        <ModulePlayer
          module={activePlayModule}
          components={components}
          onClose={() => {
            setActivePlayModule(null);
            setActiveClassNumber(-1);
          }}
          initialStepIdx={initialStepIdx}
          onStepChange={(stepIdx) => {
            handleStepChange(
              activePlayModule.id,
              activeClassNumber,
              stepIdx,
              activePlayModule.steps?.length || 0
            );
          }}
          onComplete={() => {
            handleLessonComplete(
              activePlayModule.id,
              activeClassNumber,
              activePlayModule.steps?.length || 0
            );
          }}
        />
      )}
    </div>
  );
}

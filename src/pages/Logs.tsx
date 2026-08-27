import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, addDoc, doc, updateDoc, setDoc, getDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { TeacherLog, School, Course, Module, UserProfile } from '../types';
import { useAuth } from '../AuthContext';
import { 
  ClipboardList, Plus, Clock, Download, Calendar, BookOpen, GraduationCap, Laptop, 
  Edit2, X, ChevronRight, Check, Search, Play, CheckCircle2, Sliders, List, HelpCircle 
} from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

const GRADES = ['LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A to Z

interface CurriculumClass {
  classNumber: number;
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
}

interface SchoolCurriculum {
  id: string; // schoolId_grade
  schoolId: string;
  schoolName: string;
  grade: string;
  numberOfClasses: number;
  classes: CurriculumClass[];
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
  }[];
  updatedAt: string;
}

export default function Logs() {
  const { profile } = useAuth();
  
  // Lists
  const [logs, setLogs] = useState<TeacherLog[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [curriculums, setCurriculums] = useState<SchoolCurriculum[]>([]);
  const [progresses, setProgresses] = useState<CurriculumProgress[]>([]);

  // Page level tabs: 'curriculum-log' vs 'daily-log'
  const [activeTab, setActiveTab] = useState<'curriculum-log' | 'daily-log'>('curriculum-log');

  // STEP-WISE WIZARD STATE (FEATURE 2)
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  
  // Modals for Step 1
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');

  // Step 2 State
  const [activeCurriculum, setActiveCurriculum] = useState<SchoolCurriculum | null>(null);
  const [progressStatuses, setProgressStatuses] = useState<Record<string, 'Complete' | 'In Progress' | 'Not Started'>>({});
  const [progressDates, setProgressDates] = useState<Record<string, { start_date?: string; end_date?: string }>>({});
  const [savingProgress, setSavingProgress] = useState(false);

  // ORIGINAL LOGS STATE (TAB 2)
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [filterSchoolId, setFilterSchoolId] = useState('');
  const [filterTeacherId, setFilterTeacherId] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [period, setPeriod] = useState('');
  const [classSection, setClassSection] = useState('');
  const [activity, setActivity] = useState('');
  const [duration, setDuration] = useState('');
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
      
      // Auto pre-populate if teacher has assigned schools
      if (profile.role === 'teacher' && profile.schoolIds && profile.schoolIds.length > 0) {
        const assigned = schoolData.filter(s => profile.schoolIds?.includes(s.id));
        if (assigned.length === 1) {
          setSelectedSchool(assigned[0]);
        }
      }
      
      if (profile.schoolIds && profile.schoolIds.length > 0) {
        setSelectedSchoolId(profile.schoolIds[0]);
      }
    });

    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'courses'));

    const unsubModules = onSnapshot(collection(db, 'modules'), (snapshot) => {
      setModules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'modules'));

    const unsubCurrics = onSnapshot(collection(db, 'schoolCurriculums'), (snapshot) => {
      setCurriculums(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCurriculum)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'schoolCurriculums'));

    const unsubProgress = onSnapshot(collection(db, 'curriculumProgress'), (snapshot) => {
      setProgresses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CurriculumProgress)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'curriculumProgress'));

    return () => {
      unsubscribe();
      unsubSchools();
      unsubCourses();
      unsubModules();
      unsubCurrics();
      unsubProgress();
    };
  }, [profile]);

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });
    return () => unsubscribe();
  }, [profile]);

  // Handle Step 1 "Next" Transition
  const handleStep1Next = () => {
    if (!selectedSchool || !selectedGrade || !selectedSection) {
      toast.error('Please complete all selection fields.');
      return;
    }

    // Find if a curriculum has been mapped for this school + grade
    const curr = curriculums.find(c => c.schoolId === selectedSchool.id && c.grade === selectedGrade);
    
    if (!curr) {
      setActiveCurriculum(null);
      setStep(2);
      toast.warning('No curriculum is mapped for this School + Grade combination.');
      return;
    }

    setActiveCurriculum(curr);

    // Load existing progress statuses if any
    const progId = `${selectedSchool.id}_${selectedGrade}_${selectedSection}`;
    const existingProg = progresses.find(p => p.id === progId);
    
    const statusesMap: Record<string, 'Complete' | 'In Progress' | 'Not Started'> = {};
    const datesMap: Record<string, { start_date?: string; end_date?: string }> = {};
    
    curr.classes.forEach(cls => {
      const match = existingProg?.statuses?.find(s => s.classNumber === cls.classNumber && s.lessonId === cls.lessonId);
      statusesMap[`${cls.classNumber}_${cls.lessonId}`] = match?.status || 'Not Started';
      datesMap[`${cls.classNumber}_${cls.lessonId}`] = {
        start_date: match?.start_date || '',
        end_date: match?.end_date || ''
      };
    });

    setProgressStatuses(statusesMap);
    setProgressDates(datesMap);
    setStep(2);
    toast.success('Curriculum day-wise log entries loaded.');
  };

  // Change single status
  const handleStatusChange = (classNumber: number, lessonId: string, status: 'Complete' | 'In Progress' | 'Not Started') => {
    setProgressStatuses(prev => ({
      ...prev,
      [`${classNumber}_${lessonId}`]: status
    }));
  };

  // Change single date
  const handleDateChange = (classNumber: number, lessonId: string, field: 'start_date' | 'end_date', value: string) => {
    setProgressDates(prev => ({
      ...prev,
      [`${classNumber}_${lessonId}`]: {
        ...(prev[`${classNumber}_${lessonId}`] || {}),
        [field]: value
      }
    }));
  };

  // Save Step 2 Curriculum Progress
  const handleSaveCurriculumProgress = async () => {
    if (!selectedSchool || !selectedGrade || !selectedSection || !activeCurriculum) return;

    setSavingProgress(true);

    // Validate dates based on status
    for (const cls of activeCurriculum.classes) {
      const status = progressStatuses[`${cls.classNumber}_${cls.lessonId}`] || 'Not Started';
      const dates = progressDates[`${cls.classNumber}_${cls.lessonId}`] || {};
      
      if (status === 'In Progress') {
        if (!dates.start_date) {
          toast.error(`Start Date is required for Class ${cls.classNumber} (${cls.lessonTitle}) when 'In Progress'.`);
          setSavingProgress(false);
          return;
        }
      } else if (status === 'Complete') {
        if (!dates.start_date || !dates.end_date) {
          toast.error(`Both Start Date and End Date are required for Class ${cls.classNumber} (${cls.lessonTitle}) when 'Complete'.`);
          setSavingProgress(false);
          return;
        }
      }

      if (dates.start_date && dates.end_date && dates.end_date < dates.start_date) {
        toast.error(`End Date cannot be before Start Date for Class ${cls.classNumber} (${cls.lessonTitle}).`);
        setSavingProgress(false);
        return;
      }
    }

    const docId = `${selectedSchool.id}_${selectedGrade}_${selectedSection}`;

    // Map statuses Record to required array structure
    const statusesArray = activeCurriculum.classes.map(cls => {
      const dates = progressDates[`${cls.classNumber}_${cls.lessonId}`] || {};
      return {
        classNumber: cls.classNumber,
        courseId: cls.courseId,
        lessonId: cls.lessonId,
        status: progressStatuses[`${cls.classNumber}_${cls.lessonId}`] || 'Not Started',
        start_date: dates.start_date || '',
        end_date: dates.end_date || ''
      };
    });

    const progressData: CurriculumProgress = {
      id: docId,
      schoolId: selectedSchool.id,
      grade: selectedGrade,
      section: selectedSection,
      teacherId: profile?.uid || '',
      teacherName: profile?.name || 'Assigned Teacher',
      statuses: statusesArray,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'curriculumProgress', docId), progressData);
      toast.success('Curriculum progress logs updated successfully!');
      setStep(1);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save progress. Please try again.');
    } finally {
      setSavingProgress(false);
    }
  };

  // FILTERED SCHOOLS FOR TEACHER (Shows only assigned schools!)
  const teacherSchools = schools.filter(s => {
    if (profile?.role === 'admin') return true;
    return profile?.schoolIds?.includes(s.id);
  });

  const filteredModalSchools = teacherSchools.filter(s => 
    s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
    s.location.toLowerCase().includes(schoolSearch.toLowerCase())
  );

  // ORIGINAL LOGS HANDLERS
  const handleStartEdit = (log: TeacherLog) => {
    setEditingLogId(log.id);
    setSelectedSchoolId(log.schoolId);
    setSelectedCourseId(log.courseId);
    setSelectedModuleId(log.moduleId);
    setDate(log.date);
    setPeriod(log.period || '');
    setClassSection(log.classSection || '');
    setActivity(log.activity);
    setDuration(log.duration ? String(log.duration) : '');
    
    setActiveTab('daily-log');
    window.scrollTo({ top: 150, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingLogId(null);
    setActivity('');
    setPeriod('');
    setClassSection('');
    setDuration('');
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !activity || !selectedSchoolId || !selectedCourseId || !selectedModuleId) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    const parsedDuration = duration ? parseInt(duration, 10) : 0;
    try {
      if (editingLogId) {
        await updateDoc(doc(db, 'logs', editingLogId), {
          schoolId: selectedSchoolId,
          courseId: selectedCourseId,
          moduleId: selectedModuleId,
          date,
          period,
          classSection,
          activity,
          duration: parsedDuration || null
        });
        toast.success('Log entry updated successfully');
        setEditingLogId(null);
      } else {
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
          duration: parsedDuration || null,
          timestamp: serverTimestamp()
        });
        toast.success('Log entry added successfully');
      }
      setActivity('');
      setPeriod('');
      setClassSection('');
      setDuration('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'logs');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filterSchoolId && log.schoolId !== filterSchoolId) return false;
    if (filterTeacherId && log.teacherId !== filterTeacherId) return false;
    return true;
  });

  const handleDownloadLogs = () => {
    if (filteredLogs.length === 0) {
      toast.error('No logs available matching current filters to download');
      return;
    }

    const dataToExport = filteredLogs.map(log => ({
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
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
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
        
        {activeTab === 'daily-log' && (
          <button
            onClick={handleDownloadLogs}
            className="bg-white/5 border border-white/10 text-white px-6 py-3 rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center gap-2 cursor-pointer text-xs uppercase tracking-wider"
          >
            <Download size={18} />
            Export to CSV
          </button>
        )}
      </header>

      {/* DUAL-TAB SELECTION */}
      <div className="flex border-b border-white/5 space-x-6">
        <button
          onClick={() => { setActiveTab('curriculum-log'); setStep(1); }}
          className={cn(
            "pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer",
            activeTab === 'curriculum-log' 
              ? "border-[#F27D26] text-[#F27D26]" 
              : "border-transparent text-white/40 hover:text-white"
          )}
        >
          Curriculum Progress Logs
        </button>
        <button
          onClick={() => setActiveTab('daily-log')}
          className={cn(
            "pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer",
            activeTab === 'daily-log' 
              ? "border-[#F27D26] text-[#F27D26]" 
              : "border-transparent text-white/40 hover:text-white"
          )}
        >
          Daily Class Logs
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'curriculum-log' ? (
          // NEW CURRICULUM LOGBOOK TAB (FEATURE 2)
          <motion.div
            key="curriculum-log"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {step === 1 ? (
              // STEP 1 FORM
              <div className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 space-y-6 max-w-3xl mx-auto">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sliders size={18} className="text-[#F27D26]" />
                    Class Parameters (Step 1)
                  </h3>
                  <p className="text-white/40 text-xs mt-1">Specify your current school, grade level, and section mapping.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SCHOOL SELECTION */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Your Mapped School:</label>
                    <button
                      type="button"
                      disabled={teacherSchools.length <= 1}
                      onClick={() => setIsSchoolModalOpen(true)}
                      className="w-full bg-black/40 disabled:opacity-75 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white flex items-center justify-between transition-colors text-left"
                    >
                      <span className="truncate">{selectedSchool ? selectedSchool.name : 'Click to select school...'}</span>
                      {teacherSchools.length > 1 && <ChevronRight size={14} className="text-white/40 shrink-0" />}
                    </button>
                  </div>

                  {/* GRADE/CLASS SELECTION */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Target Grade/Class:</label>
                    <button
                      type="button"
                      onClick={() => setIsGradeModalOpen(true)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white flex items-center justify-between transition-colors text-left"
                    >
                      <span>{selectedGrade ? `Grade ${selectedGrade}` : 'Click to select grade...'}</span>
                      <ChevronRight size={14} className="text-white/40 shrink-0" />
                    </button>
                  </div>
                </div>

                {/* SECTION SELECTION */}
                <div className="space-y-2 max-w-xs">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Class Section:</label>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                  >
                    <option value="">Select Section</option>
                    {SECTIONS.map(s => (
                      <option key={s} value={s}>Class {s}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 border-t border-white/5 flex justify-end">
                  <button
                    type="button"
                    disabled={!selectedSchool || !selectedGrade || !selectedSection}
                    onClick={handleStep1Next}
                    className="px-8 py-3.5 bg-[#F27D26] hover:bg-[#d66a1e] disabled:opacity-30 text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-[#F27D26]/20 transition-all"
                  >
                    <span>Next: Curriculum progress</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ) : (
              // STEP 2: SYLLABUS LOGS FORM
              <div className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-6 gap-4">
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-[#F27D26] text-xs font-bold flex items-center gap-1 hover:underline"
                    >
                      <X size={14} /> Back to Step 1
                    </button>
                    <h3 className="text-xl font-bold text-white mt-1">Curriculum Progress Form (Step 2)</h3>
                    <p className="text-white/40 text-xs">
                      Logging for <b className="text-white">{selectedSchool?.name}</b> • Grade <b className="text-white">{selectedGrade}</b> • Section <b className="text-white">{selectedSection}</b>
                    </p>
                  </div>

                  {activeCurriculum && (
                    <button
                      type="button"
                      disabled={savingProgress}
                      onClick={handleSaveCurriculumProgress}
                      className="px-6 py-3 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-[#F27D26]/20 disabled:opacity-50"
                    >
                      <Check size={14} />
                      {savingProgress ? 'Saving...' : 'Save Progress Logs'}
                    </button>
                  )}
                </div>

                {!activeCurriculum ? (
                  <div className="text-center py-16 bg-black/40 border border-dashed border-white/10 rounded-2xl max-w-xl mx-auto space-y-4">
                    <HelpCircle size={32} className="mx-auto text-yellow-500/60" />
                    <p className="text-white/80 font-medium text-sm">No curriculum mapped yet.</p>
                    <p className="text-white/40 text-xs leading-relaxed max-w-sm mx-auto">
                      The system administrator has not mapped a curriculum syllabus for {selectedSchool?.name} Grade {selectedGrade} yet. Please ask the administrator to build the curriculum mapping first.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase text-white"
                    >
                      Return to Step 1
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-white/30 font-mono">
                      Select completion status for each Sequential Day-wise Class:
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 pt-1">
                      {activeCurriculum.classes.map((cls) => {
                        const currentStatus = progressStatuses[`${cls.classNumber}_${cls.lessonId}`] || 'Not Started';

                        return (
                          <div key={cls.classNumber} className="p-5 bg-black/40 border border-white/5 rounded-2xl space-y-4 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/30">
                                  Class {cls.classNumber}
                                </span>
                                <span className="text-[9px] bg-[#F27D26]/10 border border-[#F27D26]/20 px-2 py-0.5 rounded text-[#F27D26] truncate max-w-[150px]">
                                  {cls.courseTitle}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-white mt-2.5">{cls.lessonTitle}</h4>
                            </div>

                            {/* SELECTABLE STATUSES */}
                            <div className="grid grid-cols-3 gap-2 pt-2">
                              {[
                                { name: 'Complete', color: 'border-green-500/20 text-green-400 bg-green-500/5 hover:bg-green-500/10' },
                                { name: 'In Progress', color: 'border-yellow-500/20 text-yellow-500 bg-yellow-500/5 hover:bg-yellow-500/10' },
                                { name: 'Not Started', color: 'border-white/10 text-white/40 bg-white/5 hover:bg-white/10' }
                              ].map((opt) => {
                                const isSelected = currentStatus === opt.name;
                                return (
                                  <button
                                    key={opt.name}
                                    type="button"
                                    onClick={() => handleStatusChange(cls.classNumber, cls.lessonId, opt.name as any)}
                                    className={cn(
                                      "py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider text-center border transition-all cursor-pointer",
                                      isSelected 
                                        ? opt.name === 'Complete' 
                                          ? "bg-green-500 border-green-500 text-black font-extrabold" 
                                          : opt.name === 'In Progress'
                                            ? "bg-yellow-500 border-yellow-500 text-black font-extrabold"
                                            : "bg-white border-white text-black font-extrabold"
                                        : opt.color
                                    )}
                                  >
                                    {opt.name}
                                  </button>
                                );
                              })}
                            </div>

                            {/* START & END DATES */}
                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-bold tracking-wider text-white/40 block">
                                  Start Date {currentStatus !== 'Not Started' && <span className="text-[#F27D26]">*</span>}
                                </label>
                                <input
                                  type="date"
                                  value={progressDates[`${cls.classNumber}_${cls.lessonId}`]?.start_date || ''}
                                  onChange={(e) => handleDateChange(cls.classNumber, cls.lessonId, 'start_date', e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-bold tracking-wider text-white/40 block">
                                  End Date {currentStatus === 'Complete' && <span className="text-[#F27D26]">*</span>}
                                </label>
                                <input
                                  type="date"
                                  value={progressDates[`${cls.classNumber}_${cls.lessonId}`]?.end_date || ''}
                                  onChange={(e) => handleDateChange(cls.classNumber, cls.lessonId, 'end_date', e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-white/5 pt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-6 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-xs font-bold uppercase tracking-wider text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingProgress}
                        onClick={handleSaveCurriculumProgress}
                        className="px-8 py-3.5 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-2xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-lg shadow-[#F27D26]/20 disabled:opacity-50"
                      >
                        <Check size={16} />
                        {savingProgress ? 'Saving progress...' : 'Save Progress Logs'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          // ORIGINAL LOGS TAB (TAB 2)
          <motion.div
            key="daily-log"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Log Form */}
            {(profile?.role !== 'admin' || editingLogId !== null) && (
              <section className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 shadow-xl">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#F27D26]">
                    {editingLogId ? 'Edit Log Entry' : 'Add New Entry'}
                  </h3>
                  {editingLogId && (
                    <button 
                      type="button" 
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors cursor-pointer"
                    >
                      <X size={14} /> Clear Edit Selection
                    </button>
                  )}
                </div>
                <form onSubmit={handleAddLog} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 flex items-center gap-2">
                        <Clock size={12} /> Duration (mins)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 45, 60"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] text-white"
                        min="1"
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
                        <BookOpen size={12} /> Course
                      </label>
                      <select
                        value={selectedCourseId}
                        onChange={(e) => setSelectedCourseId(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] text-white"
                        required
                      >
                        <option value="">Select Course</option>
                        {filteredCourses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
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

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-[#F27D26] text-white py-4 rounded-2xl font-bold hover:bg-[#d66a1e] transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#F27D26]/10 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? <Clock className="animate-spin" size={20} /> : (editingLogId ? <Edit2 size={20} /> : <Plus size={20} />)}
                      {editingLogId ? 'Update Log Entry' : 'Finalize Log Entry'}
                    </button>
                    {editingLogId && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-6 bg-zinc-900 border border-white/10 text-white hover:bg-zinc-800 transition-all rounded-2xl font-bold py-4 cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </form>
              </section>
            )}

            {/* Logs Table-like View */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between pb-2">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Clock size={20} className="text-[#F27D26]" />
                  Recent Entries
                </h3>
                
                {profile?.role === 'admin' && (
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="min-w-[160px]">
                      <select
                        value={filterSchoolId}
                        onChange={(e) => setFilterSchoolId(e.target.value)}
                        className="w-full bg-[#151619] border border-white/5 hover:border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                      >
                        <option value="">All Schools</option>
                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="min-w-[160px]">
                      <select
                        value={filterTeacherId}
                        onChange={(e) => setFilterTeacherId(e.target.value)}
                        className="w-full bg-[#151619] border border-white/5 hover:border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                      >
                        <option value="">All Teachers</option>
                        {teachers.map(t => <option key={t.uid} value={t.uid}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredLogs.map((log) => (
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
                          {log.duration && (
                            <span className="px-2 py-1 bg-[#F27D26]/10 border border-[#F27D26]/30 rounded text-[10px] font-black uppercase tracking-widest text-[#F27D26]">
                              {log.duration} mins
                            </span>
                          )}
                          <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-black uppercase tracking-widest text-white/60">
                            {courses.find(c => c.id === log.courseId)?.title || 'Unknown Course'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-lg font-bold group-hover:text-[#F27D26] transition-colors">
                            {modules.find(m => m.id === log.moduleId)?.title || 'Unknown Module'}
                          </h4>
                          <p className="text-white/60 text-sm mt-2 leading-relaxed">{log.activity}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-bold">{log.teacherName || 'Teacher'}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#F27D26]">
                            {schools.find(s => s.id === log.schoolId)?.name || 'School'}
                          </p>
                        </div>

                        {(profile?.role === 'admin' || log.teacherId === profile?.uid) && (
                          <button
                            onClick={() => handleStartEdit(log)}
                            className="mt-1 p-2 bg-white/5 hover:bg-[#F27D26]/10 text-white/40 hover:text-[#F27D26] border border-white/5 hover:border-[#F27D26]/20 rounded-xl transition-all flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-black cursor-pointer"
                            title="Edit this logbook entry"
                          >
                            <Edit2 size={12} />
                            <span>Edit log</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredLogs.length === 0 && (
                  <div className="py-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[2.5rem]">
                     <ClipboardList size={48} className="mx-auto mb-4 text-white/10" />
                     <p className="text-white/30 font-medium">No logs recorded yet.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STEP 1 MODALS */}

      {/* 1. SCHOOL SELECTION MODAL */}
      <AnimatePresence>
        {isSchoolModalOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setIsSchoolModalOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 m-auto w-full max-w-lg h-[460px] bg-[#151619] border border-white/10 rounded-3xl p-6 shadow-2xl z-50 flex flex-col justify-between"
            >
              <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Select Mapped School</h3>
                  <button onClick={() => setIsSchoolModalOpen(false)} className="text-white/40 hover:text-white p-1 rounded-lg">
                    <X size={16} />
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                  <input
                    type="text"
                    placeholder="Search assigned schools by name..."
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#F27D26]"
                  />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                  {filteredModalSchools.length === 0 ? (
                    <p className="text-center py-12 text-xs italic text-white/20">No schools found.</p>
                  ) : (
                    filteredModalSchools.map(s => {
                      const isSelected = selectedSchool?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            setSelectedSchool(s);
                            setIsSchoolModalOpen(false);
                            toast.success(`Selected school: ${s.name}`);
                          }}
                          className={cn(
                            "w-full p-3.5 rounded-xl text-left text-xs transition-all flex justify-between items-center border",
                            isSelected 
                              ? "bg-[#F27D26]/10 border-[#F27D26]/30 text-white font-bold" 
                              : "bg-black/20 border-transparent hover:bg-white/5 text-white/70 hover:text-white"
                          )}
                        >
                          <div>
                            <p>{s.name}</p>
                            <p className="text-[10px] text-white/40 font-mono mt-0.5">{s.location}, {s.state}</p>
                          </div>
                          {isSelected && <Check size={14} className="text-[#F27D26]" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 2. GRADE SELECTION MODAL */}
      <AnimatePresence>
        {isGradeModalOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setIsGradeModalOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 m-auto w-full max-w-md h-[400px] bg-[#151619] border border-white/10 rounded-3xl p-6 shadow-2xl z-50 flex flex-col justify-between"
            >
              <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Select Grade / Class</h3>
                  <button onClick={() => setIsGradeModalOpen(false)} className="text-white/40 hover:text-white p-1 rounded-lg">
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2.5 overflow-y-auto custom-scrollbar pr-1 pt-1">
                  {GRADES.map(g => {
                    const isSelected = selectedGrade === g;
                    return (
                      <button
                        key={g}
                        onClick={() => {
                          setSelectedGrade(g);
                          setIsGradeModalOpen(false);
                          toast.success(`Selected Grade: ${g}`);
                        }}
                        className={cn(
                          "py-3 rounded-xl font-bold text-center text-xs transition-all border",
                          isSelected 
                            ? "bg-[#F27D26]/10 border-[#F27D26]/30 text-white font-extrabold" 
                            : "bg-black/20 border-transparent hover:bg-white/5 text-white/55 hover:text-white"
                        )}
                      >
                        Grade {g}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

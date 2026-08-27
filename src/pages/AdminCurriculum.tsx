import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { School, Course, Module, UserProfile } from '../types';
import { useAuth } from '../AuthContext';
import { 
  BookOpen, Plus, Search, ChevronRight, Check, X, Sliders, Calendar, ArrowLeft, Save, 
  Trash2, ClipboardList, Download, Percent, FileSpreadsheet, Layers, Play, CheckCircle2, 
  HelpCircle, RefreshCw, AlertCircle, Sparkles, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn, getDirectImageUrl } from '../lib/utils';
import * as XLSX from 'xlsx';

// Day-wise Class Item type
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
  }[];
  updatedAt: string;
}

const GRADES = ['LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A to Z

export default function AdminCurriculum() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // State Lists
  const [schools, setSchools] = useState<School[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [curriculums, setCurriculums] = useState<SchoolCurriculum[]>([]);
  const [progresses, setProgresses] = useState<CurriculumProgress[]>([]);

  // Navigation state
  const [activeTab, setActiveTab] = useState<'builder' | 'overview'>('builder');

  // Form 1 States
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
  const [numClasses, setNumClasses] = useState<string>('');

  // Search queries for selection modals
  const [schoolSearch, setSchoolSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');

  // Modal open states
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [isCoursesModalOpen, setIsCoursesModalOpen] = useState(false);

  // Form 2 State
  const [isForm2Active, setIsForm2Active] = useState(false);
  const [form2Classes, setForm2Classes] = useState<CurriculumClass[]>([]);

  // Monitor tab states
  const [monitorSchool, setMonitorSchool] = useState<School | null>(null);
  const [monitorGrade, setMonitorGrade] = useState<string>('');
  const [monitorSection, setMonitorSection] = useState<string>('A');

  // Load Firestore collections
  useEffect(() => {
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'schools'));

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
      unsubSchools();
      unsubCourses();
      unsubModules();
      unsubCurrics();
      unsubProgress();
    };
  }, []);

  // When School and Grade change, check if there's an existing curriculum to edit
  useEffect(() => {
    if (selectedSchool && selectedGrade && !isForm2Active) {
      const existing = curriculums.find(c => c.schoolId === selectedSchool.id && c.grade === selectedGrade);
      if (existing) {
        // Pre-populate Form 1 settings
        const matchedCourses = courses.filter(c => existing.selectedCourseIds.includes(c.id));
        setSelectedCourses(matchedCourses);
        setNumClasses(String(existing.numberOfClasses));
      }
    }
  }, [selectedSchool, selectedGrade, curriculums, courses, isForm2Active]);

  // Restrict to numbers only
  const handleClassesChange = (val: string) => {
    setNumClasses(val.replace(/[^0-9]/g, ''));
  };

  // Check if Form 1 is fully completed
  const isForm1Valid = selectedSchool && selectedGrade && selectedCourses.length > 0 && parseInt(numClasses, 10) > 0;

  // Transition to Form 2
  const handleCreateCurriculum = () => {
    if (!isForm1Valid) return;

    const classCount = parseInt(numClasses, 10);
    const existing = curriculums.find(c => c.schoolId === selectedSchool!.id && c.grade === selectedGrade);

    const initialClasses: CurriculumClass[] = [];

    for (let i = 1; i <= classCount; i++) {
      // Check if existing class details can be recovered
      const existingClass = existing?.classes?.find(c => c.classNumber === i);
      
      // Check if recovered course is still in selected courses list
      const isCourseValid = existingClass && selectedCourses.some(sc => sc.id === existingClass.courseId);

      if (existingClass && isCourseValid) {
        initialClasses.push({ ...existingClass });
      } else {
        initialClasses.push({
          classNumber: i,
          courseId: selectedCourses[0]?.id || '',
          courseTitle: selectedCourses[0]?.title || '',
          lessonId: '',
          lessonTitle: ''
        });
      }
    }

    setForm2Classes(initialClasses);
    setIsForm2Active(true);
    toast.success('Form 2 Day-wise Curriculum Builder loaded.');
  };

  // Change Course for a Class section in Form 2
  const handleForm2CourseChange = (idx: number, courseId: string) => {
    const targetCourse = selectedCourses.find(c => c.id === courseId);
    if (!targetCourse) return;

    const updated = [...form2Classes];
    updated[idx] = {
      ...updated[idx],
      courseId: targetCourse.id,
      courseTitle: targetCourse.title,
      lessonId: '', // Reset lesson when course changes
      lessonTitle: ''
    };
    setForm2Classes(updated);
  };

  // Change Lesson for a Class section in Form 2
  const handleForm2LessonChange = (idx: number, lessonId: string) => {
    const courseId = form2Classes[idx].courseId;
    const courseLessons = modules.filter(m => m.courseId === courseId);
    const targetLesson = courseLessons.find(l => l.id === lessonId);
    
    if (!targetLesson) return;

    const updated = [...form2Classes];
    updated[idx] = {
      ...updated[idx],
      lessonId: targetLesson.id,
      lessonTitle: targetLesson.title
    };
    setForm2Classes(updated);
  };

  // Save the built day-wise curriculum
  const handleSaveCurriculum = async () => {
    if (!selectedSchool || !selectedGrade) return;

    // Check if any class lacks a course or a lesson
    const incomplete = form2Classes.some(c => !c.courseId || !c.lessonId);
    if (incomplete) {
      toast.error('All class sections must have a Course and Lesson assigned.');
      return;
    }

    const docId = `${selectedSchool.id}_${selectedGrade}`;
    const data: SchoolCurriculum = {
      id: docId,
      schoolId: selectedSchool.id,
      schoolName: selectedSchool.name,
      grade: selectedGrade,
      numberOfClasses: form2Classes.length,
      selectedCourseIds: selectedCourses.map(c => c.id),
      classes: form2Classes,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'schoolCurriculums', docId), data);
      toast.success(`Curriculum for ${selectedSchool.name} (${selectedGrade}) saved successfully!`);
      setIsForm2Active(false);
      
      // Set monitoring selections to watch it immediately
      setMonitorSchool(selectedSchool);
      setMonitorGrade(selectedGrade);
      setActiveTab('overview');
    } catch (err) {
      toast.error('Failed to save curriculum. Please try again.');
      console.error(err);
    }
  };

  // Delete a curriculum entirely
  const handleDeleteCurriculum = async (curr: SchoolCurriculum) => {
    if (!window.confirm(`Are you sure you want to delete the curriculum for ${curr.schoolName} Grade ${curr.grade}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'schoolCurriculums', curr.id));
      toast.success('Curriculum deleted.');
    } catch (err) {
      toast.error('Failed to delete curriculum.');
      console.error(err);
    }
  };

  // Generate Excel Report for selected school
  const handleDownloadExcelReport = () => {
    const schoolToReport = monitorSchool || (schools.length > 0 ? schools[0] : null);
    if (!schoolToReport) {
      toast.error('No school data loaded to generate report.');
      return;
    }

    // Filter curriculums for this school
    const schoolCurrics = curriculums.filter(c => c.schoolId === schoolToReport.id);
    if (schoolCurrics.length === 0) {
      toast.error(`No curriculums mapped yet for ${schoolToReport.name}.`);
      return;
    }

    const rows: any[] = [];

    // Loop through each grade mapped
    schoolCurrics.forEach(curr => {
      // Find all progress tracked for this school and grade across all sections
      const gradeProgresses = progresses.filter(p => p.schoolId === schoolToReport.id && p.grade === curr.grade);
      
      // We want to cover sections A, B, C... that have either logged progress or let's default to at least Section A
      const activeSections = gradeProgresses.length > 0 
        ? gradeProgresses.map(p => p.section) 
        : ['A'];

      // Distinct sections
      const uniqueSections = Array.from(new Set(activeSections)).sort();

      uniqueSections.forEach(sec => {
        const progressDoc = gradeProgresses.find(p => p.section === sec);

        curr.classes.forEach(cls => {
          // Find logged status
          const loggedStatus = progressDoc?.statuses?.find(
            s => s.classNumber === cls.classNumber && s.lessonId === cls.lessonId
          );

          rows.push({
            'School Name': schoolToReport.name,
            'Grade / Class': curr.grade,
            'Section': sec,
            'Class Day Number': `Class ${cls.classNumber}`,
            'Course Title': cls.courseTitle,
            'Lesson / Topic': cls.lessonTitle,
            'Completion Status': loggedStatus?.status || 'Not Started',
            'Start Date': loggedStatus?.start_date || 'N/A',
            'End Date': loggedStatus?.end_date || 'N/A',
            'Teacher Name': progressDoc?.teacherName || 'Not Logged Yet',
            'Last Updated': progressDoc?.updatedAt ? new Date(progressDoc.updatedAt).toLocaleDateString() : 'N/A'
          });
        });
      });
    });

    if (rows.length === 0) {
      toast.error('No curriculum classes found to report.');
      return;
    }

    // Use xlsx library
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Progress Report");
    
    // Auto-fit column widths
    const max_widths = Object.keys(rows[0]).map(key => {
      const max_len = Math.max(
        key.length,
        ...rows.map(r => String(r[key] || '').length)
      );
      return { wch: max_len + 3 };
    });
    worksheet['!cols'] = max_widths;

    // Save
    XLSX.writeFile(workbook, `LMS_Curriculum_Report_${schoolToReport.name.replace(/\s+/g, '_')}.xlsx`);
    toast.success(`Progress report for ${schoolToReport.name} exported successfully!`);
  };

  // Filter lists for search inside modals
  const filteredSchools = schools.filter(s => 
    s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
    s.location.toLowerCase().includes(schoolSearch.toLowerCase())
  );

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
    String(c.grade).includes(courseSearch)
  );

  // Monitor Stats Calculator
  const getMonitorCurriculum = () => {
    if (!monitorSchool || !monitorGrade) return null;
    return curriculums.find(c => c.schoolId === monitorSchool.id && c.grade === monitorGrade) || null;
  };

  const getMonitorProgress = () => {
    if (!monitorSchool || !monitorGrade || !monitorSection) return null;
    return progresses.find(p => p.schoolId === monitorSchool.id && p.grade === monitorGrade && p.section === monitorSection) || null;
  };

  const monitorCurr = getMonitorCurriculum();
  const monitorProg = getMonitorProgress();

  const getProgressStats = () => {
    if (!monitorCurr) return { complete: 0, inProgress: 0, notStarted: 0, percent: 0 };
    let complete = 0;
    let inProgress = 0;
    let notStarted = 0;

    monitorCurr.classes.forEach(cls => {
      const logged = monitorProg?.statuses?.find(s => s.classNumber === cls.classNumber && s.lessonId === cls.lessonId);
      const status = logged?.status || 'Not Started';
      if (status === 'Complete') complete++;
      else if (status === 'In Progress') inProgress++;
      else notStarted++;
    });

    const total = monitorCurr.classes.length;
    const percent = total > 0 ? Math.round((complete / total) * 100) : 0;

    return { complete, inProgress, notStarted, percent };
  };

  const stats = getProgressStats();

  if (!isAdmin) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-black">
        <AlertTriangle size={48} className="text-[#F27D26] mb-4" />
        <h3 className="text-xl font-bold text-white">Administrative Access Required</h3>
        <p className="text-white/40 text-sm max-w-md mt-2">
          Your account is currently simulated or logged in as a {profile?.role || 'user'}. Please switch roles to Super Admin to access the Curriculum Panel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* HEADER BAR */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#F27D26]/10 rounded-2xl text-[#F27D26]">
              <Layers size={26} />
            </div>
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight">School-wise Curriculum</h2>
              <p className="text-white/40 font-mono text-[9px] uppercase tracking-widest mt-1">
                Admin Panel — Syllabi Mapping & Progress Tracking
              </p>
            </div>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Set monitor school to first available
              if (schools.length > 0 && !monitorSchool) {
                setMonitorSchool(schools[0]);
              }
              handleDownloadExcelReport();
            }}
            className="px-5 py-3 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
            title="Download the entire curriculum status of the selected school to an Excel sheet"
          >
            <FileSpreadsheet size={16} className="text-green-400" />
            Excel Export Report
          </button>
        </div>
      </header>

      {/* CONTROLS TABS */}
      <div className="flex border-b border-white/5 space-x-6">
        <button
          onClick={() => { setActiveTab('builder'); setIsForm2Active(false); }}
          className={cn(
            "pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer",
            activeTab === 'builder' 
              ? "border-[#F27D26] text-[#F27D26]" 
              : "border-transparent text-white/40 hover:text-white"
          )}
        >
          Curriculum Builder
        </button>
        <button
          onClick={() => {
            setActiveTab('overview');
            if (schools.length > 0 && !monitorSchool) {
              setMonitorSchool(schools[0]);
            }
            if (GRADES.length > 0 && !monitorGrade) {
              setMonitorGrade(GRADES[0]);
            }
          }}
          className={cn(
            "pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer",
            activeTab === 'overview' 
              ? "border-[#F27D26] text-[#F27D26]" 
              : "border-transparent text-white/40 hover:text-white"
          )}
        >
          Syllabus Progress & Monitor
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'builder' ? (
          <motion.div
            key="builder"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {!isForm2Active ? (
              // FORM 1: SETUP
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* CONFIGURATION COLUMN */}
                <div className="lg:col-span-2 bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-5">
                    <Sliders size={180} />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sliders size={18} className="text-[#F27D26]" />
                      Step 1: Setup Parameters (Form 1)
                    </h3>
                    <p className="text-white/40 text-xs mt-1">All fields are mandatory to load day-wise class sections.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* SCHOOL FIELD */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">1. School Selection:</label>
                      <button
                        type="button"
                        onClick={() => setIsSchoolModalOpen(true)}
                        className="w-full bg-black/40 hover:bg-black/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white flex items-center justify-between transition-colors"
                      >
                        <span className="truncate">{selectedSchool ? selectedSchool.name : 'Click to select school...'}</span>
                        <ChevronRight size={14} className="text-white/40 shrink-0" />
                      </button>
                    </div>

                    {/* GRADE FIELD */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">2. Grade / Class:</label>
                      <button
                        type="button"
                        onClick={() => setIsGradeModalOpen(true)}
                        className="w-full bg-black/40 hover:bg-black/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white flex items-center justify-between transition-colors"
                      >
                        <span>{selectedGrade ? `Grade ${selectedGrade}` : 'Click to select grade...'}</span>
                        <ChevronRight size={14} className="text-white/40 shrink-0" />
                      </button>
                    </div>
                  </div>

                  {/* COURSES FIELD */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">3. Mapping Courses (Multi-Select):</label>
                    <button
                      type="button"
                      onClick={() => setIsCoursesModalOpen(true)}
                      className="w-full bg-black/40 hover:bg-black/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white flex items-center justify-between transition-colors"
                    >
                      <span className="truncate">
                        {selectedCourses.length > 0 
                          ? `${selectedCourses.length} courses selected: ${selectedCourses.map(c => c.title).join(', ')}`
                          : 'Click to choose courses...'
                        }
                      </span>
                      <ChevronRight size={14} className="text-white/40 shrink-0" />
                    </button>

                    {selectedCourses.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {selectedCourses.map(c => (
                          <span key={c.id} className="text-[10px] bg-white/5 border border-white/10 rounded px-2.5 py-1 text-white flex items-center gap-1">
                            {c.title}
                            <button 
                              type="button" 
                              onClick={() => setSelectedCourses(selectedCourses.filter(sc => sc.id !== c.id))}
                              className="text-red-400 hover:text-red-300 ml-1"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* CLASSES FIELD */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">4. Number of Day-wise Classes:</label>
                    <input
                      type="text"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      placeholder="Enter number (e.g. 10, 24, 30)..."
                      value={numClasses}
                      onChange={(e) => handleClassesChange(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                    />
                    <p className="text-[10px] text-white/30 italic">This defines how many day-wise class sessions will be sequentially mapped in Step 2.</p>
                  </div>

                  {/* TRIGGER ACTION */}
                  <button
                    type="button"
                    disabled={!isForm1Valid}
                    onClick={handleCreateCurriculum}
                    className="w-full py-4 rounded-2xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all cursor-pointer bg-[#F27D26] hover:bg-[#d66a1e] text-white disabled:opacity-30"
                  >
                    <Sliders size={16} />
                    Create Curriculum (Form 2)
                  </button>
                </div>

                {/* CURRENT LIST SIDEBAR */}
                <div className="bg-[#151619]/40 border border-white/5 rounded-[2.5rem] p-8 space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Configured Syllabi</h3>
                    <p className="text-white/40 text-xs mt-1">Existing mapped school-wise curriculums</p>
                  </div>

                  <div className="space-y-4 max-h-[360px] overflow-y-auto custom-scrollbar pr-2">
                    {curriculums.length === 0 ? (
                      <div className="text-center py-8 text-white/20 text-xs italic">
                        No custom curriculums built yet.
                      </div>
                    ) : (
                      curriculums.map(curr => (
                        <div key={curr.id} className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-3 relative group">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[9px] font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                                Grade {curr.grade}
                              </span>
                              <h4 className="text-xs font-bold text-white mt-1.5 truncate max-w-[150px]">{curr.schoolName}</h4>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteCurriculum(curr)}
                              className="text-white/20 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                              title="Delete Curriculum"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          
                          <div className="flex justify-between text-[10px] text-white/40 font-mono">
                            <span>{curr.numberOfClasses} day-wise classes</span>
                            <span>{curr.selectedCourseIds?.length || 0} courses</span>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedSchool(schools.find(s => s.id === curr.schoolId) || null);
                              setSelectedGrade(curr.grade);
                              const matchedCourses = courses.filter(c => curr.selectedCourseIds.includes(c.id));
                              setSelectedCourses(matchedCourses);
                              setNumClasses(String(curr.numberOfClasses));
                              
                              // Directly open builder step 2
                              const initialClasses = [...curr.classes];
                              setForm2Classes(initialClasses);
                              setIsForm2Active(true);
                              toast.info(`Editing curriculum for ${curr.schoolName} Grade ${curr.grade}.`);
                            }}
                            className="w-full py-2 bg-white/5 hover:bg-[#F27D26]/10 text-[#F27D26] hover:text-[#F27D26] border border-white/5 rounded-xl text-center text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                            Edit Curriculum Structure
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // FORM 2: DAY-WISE BUILDER
              <div className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-6 gap-4">
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsForm2Active(false)}
                      className="text-[#F27D26] text-xs font-bold flex items-center gap-1 hover:underline"
                    >
                      <ArrowLeft size={14} /> Back to Parameters Setup
                    </button>
                    <h3 className="text-xl font-bold text-white mt-1">Form 2 — Day-wise Curriculum Builder</h3>
                    <p className="text-white/40 text-xs">
                      Mapping <b className="text-white">{selectedSchool?.name}</b> • Grade <b className="text-white">{selectedGrade}</b> ({numClasses} classes)
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsForm2Active(false)}
                      className="px-5 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-xs font-bold uppercase text-white tracking-wider"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCurriculum}
                      className="px-6 py-3 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-[#F27D26]/20"
                    >
                      <Save size={14} />
                      Save Complete Curriculum
                    </button>
                  </div>
                </div>

                {/* DYNAMIC FORM ROW REPEATER */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 pt-2">
                  {form2Classes.map((cls, idx) => {
                    // Filter courses to selected only
                    const courseLessons = modules.filter(m => m.courseId === cls.courseId);

                    return (
                      <div key={idx} className="p-5 bg-black/40 border border-white/5 rounded-2xl space-y-4 relative flex flex-col justify-between">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                          <span className="text-xs font-extrabold uppercase tracking-widest text-[#F27D26]">
                            Class {cls.classNumber}
                          </span>
                          <span className="text-[10px] text-white/30 font-mono">Sequence Day {cls.classNumber}</span>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          {/* Course select */}
                          <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-bold tracking-wider text-white/40 block">Select Course:</label>
                            <select
                              value={cls.courseId}
                              onChange={(e) => handleForm2CourseChange(idx, e.target.value)}
                              className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white/90 focus:outline-none focus:border-[#F27D26]"
                            >
                              {selectedCourses.map(sc => (
                                <option key={sc.id} value={sc.id}>{sc.title}</option>
                              ))}
                            </select>
                          </div>

                          {/* Lesson/Module select */}
                          <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-bold tracking-wider text-white/40 block">Select Lesson / Topic:</label>
                            <select
                              value={cls.lessonId}
                              onChange={(e) => handleForm2LessonChange(idx, e.target.value)}
                              className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white/90 focus:outline-none focus:border-[#F27D26]"
                              required
                            >
                              <option value="">-- Choose Lesson --</option>
                              {courseLessons.map(l => (
                                <option key={l.id} value={l.id}>{l.title}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-white/5 pt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleSaveCurriculum}
                    className="px-8 py-4 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-2xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-lg shadow-[#F27D26]/20"
                  >
                    <Save size={16} />
                    Save Day-wise Curriculum
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          // TAB 2: OVERVIEW & PROGRESS MONITOR
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ClipboardList size={18} className="text-[#F27D26]" />
                  Curriculum Progress Monitor
                </h3>
                <p className="text-white/40 text-xs mt-1">
                  View real-time day-wise class completion logging completed by teachers.
                </p>
              </div>

              {/* SELECTIONS ROW */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Select School:</label>
                  <select
                    value={monitorSchool?.id || ''}
                    onChange={(e) => setMonitorSchool(schools.find(s => s.id === e.target.value) || null)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] text-white"
                  >
                    <option value="">Select School</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Select Grade:</label>
                  <select
                    value={monitorGrade}
                    onChange={(e) => setMonitorGrade(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] text-white"
                  >
                    <option value="">Select Grade</option>
                    {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Select Section:</label>
                  <select
                    value={monitorSection}
                    onChange={(e) => setMonitorSection(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] text-white"
                  >
                    {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </select>
                </div>
              </div>

              {/* STATS SUMMARY BOX */}
              {monitorCurr && (
                <div className="p-6 bg-black/40 border border-white/5 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-[#F27D26] bg-[#F27D26]/10 border border-[#F27D26]/20 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                      Overall Completion
                    </span>
                    <h4 className="text-3xl font-extrabold text-white mt-1">{stats.percent}%</h4>
                  </div>
                  
                  {/* PROGRESS BAR */}
                  <div className="md:col-span-2 space-y-2">
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                      <div className="bg-green-500" style={{ width: `${stats.percent}%` }} />
                      <div className="bg-yellow-500" style={{ width: `${monitorCurr.classes.length > 0 ? (stats.inProgress / monitorCurr.classes.length) * 100 : 0}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-white/30">
                      <span className="text-green-400">{stats.complete} Complete</span>
                      <span className="text-yellow-400">{stats.inProgress} In Progress</span>
                      <span>{stats.notStarted} Not Started</span>
                    </div>
                  </div>

                  {/* ACTION */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleDownloadExcelReport}
                      className="w-full md:w-auto px-5 py-3 bg-[#F27D26]/10 hover:bg-[#F27D26]/20 border border-[#F27D26]/20 text-[#F27D26] rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 justify-center cursor-pointer"
                    >
                      <Download size={14} /> Export School Report
                    </button>
                  </div>
                </div>
              )}

              {/* RESULTS PANEL */}
              {!monitorSchool || !monitorGrade ? (
                <div className="text-center py-12 text-white/20 text-sm italic border border-dashed border-white/10 rounded-2xl">
                  Please select a School and Grade above to monitor progress.
                </div>
              ) : !monitorCurr ? (
                <div className="text-center py-12 text-white/20 text-sm italic border border-dashed border-white/10 rounded-2xl space-y-3">
                  <AlertCircle size={24} className="mx-auto text-yellow-500/60" />
                  <p>No custom curriculum mapped for {monitorSchool.name} Grade {monitorGrade} yet.</p>
                  <button
                    onClick={() => {
                      setSelectedSchool(monitorSchool);
                      setSelectedGrade(monitorGrade);
                      setActiveTab('builder');
                    }}
                    className="px-4 py-2 bg-[#F27D26]/10 text-[#F27D26] hover:bg-[#F27D26]/20 text-xs font-bold uppercase rounded-lg border border-[#F27D26]/20"
                  >
                    Build Mapped Syllabus Now →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-white/30 font-mono">
                    <span>Syllabus Day Structure (Class 1 to N)</span>
                    <span>Teacher Log Status: Section {monitorSection}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                    {monitorCurr.classes.map((cls) => {
                      const logged = monitorProg?.statuses?.find(s => s.classNumber === cls.classNumber && s.lessonId === cls.lessonId);
                      const status = logged?.status || 'Not Started';

                      return (
                        <div key={cls.classNumber} className="p-4 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold text-white/40 uppercase">Class {cls.classNumber}</span>
                              <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/60 truncate max-w-[140px]" title={cls.courseTitle}>
                                {cls.courseTitle}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white mt-1.5 truncate max-w-[220px]" title={cls.lessonTitle}>{cls.lessonTitle}</h4>
                            {(logged?.start_date || logged?.end_date) && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] font-mono text-white/40">
                                {logged?.start_date && (
                                  <span>Start: <span className="text-white/60">{logged.start_date}</span></span>
                                )}
                                {logged?.end_date && (
                                  <span>End: <span className="text-white/60">{logged.end_date}</span></span>
                                )}
                              </div>
                            )}
                          </div>

                          <div>
                            {status === 'Complete' && (
                              <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-green-400 bg-green-400/10 border border-green-400/20 rounded-full flex items-center gap-1">
                                <Check size={10} /> Complete
                              </span>
                            )}
                            {status === 'In Progress' && (
                              <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-full flex items-center gap-1">
                                <Play size={10} className="fill-current" /> In Progress
                              </span>
                            )}
                            {status === 'Not Started' && (
                              <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/30 bg-white/5 border border-white/10 rounded-full">
                                Not Started
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODALS */}

      {/* 1. SCHOOL SELECTION MODAL */}
      <AnimatePresence>
        {isSchoolModalOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setIsSchoolModalOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 m-auto w-full max-w-lg h-[480px] bg-[#151619] border border-white/10 rounded-3xl p-6 shadow-2xl z-50 flex flex-col justify-between"
            >
              <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Select Associated School</h3>
                  <button onClick={() => setIsSchoolModalOpen(false)} className="text-white/40 hover:text-white p-1 rounded-lg">
                    <X size={16} />
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                  <input
                    type="text"
                    placeholder="Search schools by name or location..."
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#F27D26]"
                  />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                  {filteredSchools.length === 0 ? (
                    <p className="text-center py-12 text-xs italic text-white/20">No schools matching search found.</p>
                  ) : (
                    filteredSchools.map(s => {
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
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Select Target Grade</h3>
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

      {/* 3. COURSES SELECTION MODAL */}
      <AnimatePresence>
        {isCoursesModalOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setIsCoursesModalOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 m-auto w-full max-w-xl h-[520px] bg-[#151619] border border-white/10 rounded-3xl p-6 shadow-2xl z-50 flex flex-col justify-between"
            >
              <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Select Syllabi Courses</h3>
                  <button onClick={() => setIsCoursesModalOpen(false)} className="text-white/40 hover:text-white p-1 rounded-lg">
                    <X size={16} />
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                  <input
                    type="text"
                    placeholder="Search courses by name or key terms..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#F27D26]"
                  />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                  {filteredCourses.length === 0 ? (
                    <p className="text-center py-12 text-xs italic text-white/20">No courses matching search found.</p>
                  ) : (
                    filteredCourses.map(c => {
                      const isSelected = selectedCourses.some(sc => sc.id === c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCourses(selectedCourses.filter(sc => sc.id !== c.id));
                            } else {
                              setSelectedCourses([...selectedCourses, c]);
                            }
                          }}
                          className={cn(
                            "w-full p-3.5 rounded-xl text-left text-xs transition-all flex justify-between items-center border",
                            isSelected 
                              ? "bg-[#F27D26]/10 border-[#F27D26]/30 text-white font-bold" 
                              : "bg-black/20 border-transparent hover:bg-white/5 text-white/70 hover:text-white"
                          )}
                        >
                          <div>
                            <p className="font-bold">{c.title}</p>
                            <p className="text-[10px] text-white/40 font-mono mt-1">Grade Level: {c.grade || 'All'} • Type: {c.courseType || 'Robotics'}</p>
                          </div>
                          <div className={cn(
                            "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                            isSelected ? "border-[#F27D26] bg-[#F27D26] text-white" : "border-white/10 bg-black/40"
                          )}>
                            {isSelected && <Check size={12} />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="border-t border-white/5 pt-4 flex justify-between items-center">
                <span className="text-[10px] text-white/40 uppercase font-bold font-mono">
                  {selectedCourses.length} courses selected
                </span>
                <button
                  type="button"
                  onClick={() => setIsCoursesModalOpen(false)}
                  className="px-5 py-2.5 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Apply Selection
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

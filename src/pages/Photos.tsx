import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, addDoc, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { School, Course, Module } from '../types';
import { useAuth } from '../AuthContext';
import { 
  Camera, Plus, Trash2, ExternalLink, ChevronRight, Search, Save, BookOpen, 
  Users, Check, X, Calendar, ArrowLeft, AlertCircle, Filter, Clock, FileText, 
  Video, HelpCircle, Trophy, FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface ClassroomPhotoSubmission {
  id: string;
  schoolId: string;
  schoolName: string;
  grade: string;
  section: string;
  dayNumber: number;
  lessonName: string;
  lessonId: string;
  driveUrls: string[];
  teacherId: string;
  teacherName: string;
  timestamp: string;
}

interface CompetitionProjectSubmission {
  id: string;
  schoolId: string;
  schoolName: string;
  projectName: string;
  competitionName: string;
  studentNames: string[];
  projectBrief: string;
  photoDriveUrl: string;
  pdfDriveUrl: string;
  videoDriveUrl: string;
  teacherId: string;
  teacherName: string;
  timestamp: string;
}

interface SchoolCurriculum {
  id: string; // schoolId_grade
  schoolId: string;
  schoolName: string;
  grade: string;
  numberOfClasses: number;
  selectedCourseIds: string[];
  classes: {
    classNumber: number;
    courseId: string;
    courseTitle: string;
    lessonId: string;
    lessonTitle: string;
  }[];
  updatedAt: string;
}

const GRADES = ['LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A to Z

export default function Photos() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isTeacher = profile?.role === 'teacher';

  // State Lists
  const [schools, setSchools] = useState<School[]>([]);
  const [curriculums, setCurriculums] = useState<SchoolCurriculum[]>([]);
  const [classroomSubmissions, setClassroomSubmissions] = useState<ClassroomPhotoSubmission[]>([]);
  const [projectSubmissions, setProjectSubmissions] = useState<CompetitionProjectSubmission[]>([]);

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'classroom' | 'competition'>('classroom');
  
  // Views inside tabs: 'list' (View submissions) or 'submit' (Teacher submission form)
  const [classroomView, setClassroomView] = useState<'list' | 'submit'>('list');
  const [competitionView, setCompetitionView] = useState<'list' | 'submit'>('list');

  // Loading indicator states
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- FORM STATES: Regular Classroom Activity ---
  const [clSchoolId, setClSchoolId] = useState('');
  const [clGrade, setClGrade] = useState('');
  const [clSection, setClSection] = useState('');
  const [clLessonId, setClLessonId] = useState('');
  const [clDriveUrls, setClDriveUrls] = useState<string[]>(['']);

  // --- FORM STATES: Competition / Project Photos ---
  const [projSchoolId, setProjSchoolId] = useState('');
  const [projName, setProjName] = useState('');
  const [compName, setCompName] = useState('');
  const [projStudentNames, setProjStudentNames] = useState<string[]>(['']);
  const [projBrief, setProjBrief] = useState('');
  const [projPhotoUrl, setProjPhotoUrl] = useState('');
  const [projPdfUrl, setProjPdfUrl] = useState('');
  const [projVideoUrl, setProjVideoUrl] = useState('');

  // --- ADMIN & TEACHER FILTER STATES ---
  const [filterClassroomSchoolId, setFilterClassroomSchoolId] = useState('');
  const [filterClassroomGrade, setFilterClassroomGrade] = useState('');
  const [filterClassroomSection, setFilterClassroomSection] = useState('');
  const [classroomSearchText, setClassroomSearchText] = useState('');

  const [filterProjectSchoolId, setFilterProjectSchoolId] = useState('');
  const [projectSearchText, setProjectSearchText] = useState('');

  // Modals / Dropdown Selector States
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [lessonSearch, setLessonSearch] = useState('');

  // Fetch Firestore master collections and previous submissions
  useEffect(() => {
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'schools'));

    const unsubCurrics = onSnapshot(collection(db, 'schoolCurriculums'), (snapshot) => {
      setCurriculums(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCurriculum)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'schoolCurriculums'));

    // Real-time listener for classroom activity submissions
    const unsubClassroom = onSnapshot(query(collection(db, 'classroomActivityPhotos'), orderBy('timestamp', 'desc')), (snapshot) => {
      setClassroomSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassroomPhotoSubmission)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'classroomActivityPhotos'));

    // Real-time listener for competition submissions
    const unsubProjects = onSnapshot(query(collection(db, 'competitionProjectPhotos'), orderBy('timestamp', 'desc')), (snapshot) => {
      setProjectSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionProjectSubmission)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'competitionProjectPhotos'));

    return () => {
      unsubSchools();
      unsubCurrics();
      unsubClassroom();
      unsubProjects();
    };
  }, []);

  // Filter school options based on teacher mapping
  const availableSchools = schools.filter(school => {
    if (isAdmin) return true;
    return profile?.schoolIds?.includes(school.id);
  });

  // Auto select school if teacher only has one assigned school
  useEffect(() => {
    if (availableSchools.length === 1) {
      if (!clSchoolId) setClSchoolId(availableSchools[0].id);
      if (!projSchoolId) setProjSchoolId(availableSchools[0].id);
    }
  }, [availableSchools, clSchoolId, projSchoolId]);

  // Handle active curriculum lessons lookup
  const activeCurriculum = curriculums.find(c => c.schoolId === clSchoolId && c.grade === clGrade);
  const availableLessons = activeCurriculum ? activeCurriculum.classes : [];

  // Filter lessons based on search query in selection modal
  const filteredLessons = availableLessons.filter(les => 
    les.lessonTitle.toLowerCase().includes(lessonSearch.toLowerCase()) || 
    `day ${les.classNumber}`.includes(lessonSearch.toLowerCase())
  );

  // Validation function for Google Drive link
  const isValidDriveUrl = (url: string) => {
    if (!url) return false;
    const cleanUrl = url.trim().toLowerCase();
    return cleanUrl.startsWith('https://drive.google.com') || cleanUrl.includes('drive.google.com');
  };

  // Dynamic add/remove drive link field in Classroom Activity
  const handleAddDriveField = () => {
    setClDriveUrls([...clDriveUrls, '']);
  };

  const handleRemoveDriveField = (index: number) => {
    if (clDriveUrls.length === 1) return;
    const updated = clDriveUrls.filter((_, idx) => idx !== index);
    setClDriveUrls(updated);
  };

  const handleDriveUrlChange = (index: number, val: string) => {
    const updated = [...clDriveUrls];
    updated[index] = val;
    setClDriveUrls(updated);
  };

  // Dynamic add/remove student field in Projects
  const handleAddStudentField = () => {
    setProjStudentNames([...projStudentNames, '']);
  };

  const handleRemoveStudentField = (index: number) => {
    if (projStudentNames.length === 1) return;
    const updated = projStudentNames.filter((_, idx) => idx !== index);
    setProjStudentNames(updated);
  };

  const handleStudentNameChange = (index: number, val: string) => {
    const updated = [...projStudentNames];
    updated[index] = val;
    setProjStudentNames(updated);
  };

  // Reset Classroom Form
  const resetClassroomForm = () => {
    setClGrade('');
    setClSection('');
    setClLessonId('');
    setClDriveUrls(['']);
    setLessonSearch('');
  };

  // Reset Competition Form
  const resetCompetitionForm = () => {
    setProjName('');
    setCompName('');
    setProjStudentNames(['']);
    setProjBrief('');
    setProjPhotoUrl('');
    setProjPdfUrl('');
    setProjVideoUrl('');
  };

  // SUBMIT HANDLER: Section 1 (Classroom Activity Photos)
  const handleSubmitClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clSchoolId || !clGrade || !clSection || !clLessonId) {
      toast.error('Please complete all required fields.');
      return;
    }

    // Filter and validate non-empty drive links
    const filteredUrls = clDriveUrls.map(u => u.trim()).filter(u => u !== '');
    if (filteredUrls.length === 0) {
      toast.error('At least one Google Drive link is required.');
      return;
    }

    // Validate that each url is a Google Drive Link
    const invalidUrl = filteredUrls.find(url => !isValidDriveUrl(url));
    if (invalidUrl) {
      toast.error(`Invalid link: "${invalidUrl}". Please submit only valid Google Drive links.`);
      return;
    }

    setIsSubmitting(true);

    const schoolObject = schools.find(s => s.id === clSchoolId);
    const selectedLesson = availableLessons.find(l => l.lessonId === clLessonId);

    const submissionData: Omit<ClassroomPhotoSubmission, 'id'> = {
      schoolId: clSchoolId,
      schoolName: schoolObject ? schoolObject.name : 'Unknown School',
      grade: clGrade,
      section: clSection,
      dayNumber: selectedLesson ? selectedLesson.classNumber : 0,
      lessonName: selectedLesson ? selectedLesson.lessonTitle : 'Unknown Lesson',
      lessonId: clLessonId,
      driveUrls: filteredUrls,
      teacherId: profile?.uid || 'System',
      teacherName: profile?.name || 'Instructor',
      timestamp: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'classroomActivityPhotos'), submissionData);
      toast.success('Classroom activity photos submitted successfully!');
      resetClassroomForm();
      setClassroomView('list');
    } catch (err) {
      toast.error('Failed to submit. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUBMIT HANDLER: Section 2 (Competition / Project Photos)
  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projSchoolId || !projName || !compName || !projBrief || !projPhotoUrl || !projPdfUrl || !projVideoUrl) {
      toast.error('Please fill in all required fields.');
      return;
    }

    // Validate student names
    const filteredStudents = projStudentNames.map(s => s.trim()).filter(s => s !== '');
    if (filteredStudents.length === 0) {
      toast.error('At least one student name is required.');
      return;
    }

    // Validate Drive links
    const linksToValidate = [projPhotoUrl, projPdfUrl, projVideoUrl];
    const invalidUrl = linksToValidate.find(url => !isValidDriveUrl(url));
    if (invalidUrl) {
      toast.error(`Invalid link: "${invalidUrl}". Please submit only valid Google Drive links.`);
      return;
    }

    setIsSubmitting(true);

    const schoolObject = schools.find(s => s.id === projSchoolId);

    const submissionData: Omit<CompetitionProjectSubmission, 'id'> = {
      schoolId: projSchoolId,
      schoolName: schoolObject ? schoolObject.name : 'Unknown School',
      projectName: projName.trim(),
      competitionName: compName.trim(),
      studentNames: filteredStudents,
      projectBrief: projBrief.trim(),
      photoDriveUrl: projPhotoUrl.trim(),
      pdfDriveUrl: projPdfUrl.trim(),
      videoDriveUrl: projVideoUrl.trim(),
      teacherId: profile?.uid || 'System',
      teacherName: profile?.name || 'Instructor',
      timestamp: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'competitionProjectPhotos'), submissionData);
      toast.success('Competition/project documentation submitted successfully!');
      resetCompetitionForm();
      setCompetitionView('list');
    } catch (err) {
      toast.error('Failed to save project submission. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Deletion logic (Admin only)
  const handleDeleteClassroom = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this activity submission?')) return;
    try {
      await deleteDoc(doc(db, 'classroomActivityPhotos', id));
      toast.success('Submission deleted successfully.');
    } catch (err) {
      toast.error('Failed to delete. Please check permissions.');
      console.error(err);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this project submission?')) return;
    try {
      await deleteDoc(doc(db, 'competitionProjectPhotos', id));
      toast.success('Submission deleted successfully.');
    } catch (err) {
      toast.error('Failed to delete. Please check permissions.');
      console.error(err);
    }
  };

  // --- FILTERING SUBMISSIONS TO DISPLAY ---
  // Section 1 Display List
  const displayClassroomSubmissions = classroomSubmissions.filter(sub => {
    // 1. Role-based School Permission check
    if (!isAdmin && !profile?.schoolIds?.includes(sub.schoolId)) return false;

    // 2. Filter criteria matches
    if (filterClassroomSchoolId && sub.schoolId !== filterClassroomSchoolId) return false;
    if (filterClassroomGrade && sub.grade !== filterClassroomGrade) return false;
    if (filterClassroomSection && sub.section !== filterClassroomSection) return false;

    // 3. Search query matches
    if (classroomSearchText.trim()) {
      const queryLower = classroomSearchText.toLowerCase();
      const matchesLesson = sub.lessonName?.toLowerCase().includes(queryLower);
      const matchesTeacher = sub.teacherName?.toLowerCase().includes(queryLower);
      const matchesSchool = sub.schoolName?.toLowerCase().includes(queryLower);
      const matchesSection = `section ${sub.section}`.toLowerCase().includes(queryLower) || sub.section?.toLowerCase() === queryLower;
      if (!matchesLesson && !matchesTeacher && !matchesSchool && !matchesSection) return false;
    }

    return true;
  });

  // Section 2 Display List
  const displayProjectSubmissions = projectSubmissions.filter(sub => {
    // 1. Role-based School Permission check
    if (!isAdmin && !profile?.schoolIds?.includes(sub.schoolId)) return false;

    // 2. Filter criteria matches
    if (filterProjectSchoolId && sub.schoolId !== filterProjectSchoolId) return false;

    // 3. Search query matches
    if (projectSearchText.trim()) {
      const queryLower = projectSearchText.toLowerCase();
      const matchesProject = sub.projectName?.toLowerCase().includes(queryLower);
      const matchesComp = sub.competitionName?.toLowerCase().includes(queryLower);
      const matchesBrief = sub.projectBrief?.toLowerCase().includes(queryLower);
      const matchesTeacher = sub.teacherName?.toLowerCase().includes(queryLower);
      const matchesSchool = sub.schoolName?.toLowerCase().includes(queryLower);
      const matchesStudents = sub.studentNames?.some(st => st.toLowerCase().includes(queryLower));
      
      if (!matchesProject && !matchesComp && !matchesBrief && !matchesTeacher && !matchesSchool && !matchesStudents) return false;
    }

    return true;
  });

  const selectedLessonObject = availableLessons.find(l => l.lessonId === clLessonId);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-[#F27D26]/10 rounded-lg text-[#F27D26]">
               <Camera size={24} />
             </div>
             <h2 className="text-4xl font-bold tracking-tight">Photos Module</h2>
          </div>
          <p className="text-white/40 font-mono text-[10px] uppercase tracking-widest pl-1">
            Capture and track media from normal teaching activities & special competitions
          </p>
        </div>
      </header>

      {/* DUAL-TAB SELECTION */}
      <div className="flex border-b border-white/5 space-x-6">
        <button
          onClick={() => setActiveTab('classroom')}
          className={cn(
            "pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer",
            activeTab === 'classroom' 
              ? "border-[#F27D26] text-[#F27D26]" 
              : "border-transparent text-white/40 hover:text-white"
          )}
        >
          Regular Classroom Activity
        </button>
        <button
          onClick={() => setActiveTab('competition')}
          className={cn(
            "pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer",
            activeTab === 'competition' 
              ? "border-[#F27D26] text-[#F27D26]" 
              : "border-transparent text-white/40 hover:text-white"
          )}
        >
          Competition / Project Photos
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'classroom' ? (
          <motion.div
            key="classroom"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* VIEW SUBMISSIONS vs SUBMIT FORM ACTIONS */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white/90">
                {classroomView === 'list' ? 'Activity Photo Records' : 'New Activity Photos Submission'}
              </h3>
              {isTeacher && (
                <button
                  onClick={() => {
                    setClassroomView(classroomView === 'list' ? 'submit' : 'list');
                    resetClassroomForm();
                  }}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  {classroomView === 'list' ? (
                    <>
                      <Plus size={16} className="text-[#F27D26]" />
                      Upload Photo Links
                    </>
                  ) : (
                    <>
                      <ArrowLeft size={16} />
                      View Upload History
                    </>
                  )}
                </button>
              )}
            </div>

            {classroomView === 'list' ? (
              <div className="space-y-6">
                {/* FILTER CARD */}
                <div className="bg-[#151619] border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1.5 w-full">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Search Classroom Submissions</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/40">
                          <Search size={14} />
                        </span>
                        <input
                          type="text"
                          value={classroomSearchText}
                          onChange={(e) => setClassroomSearchText(e.target.value)}
                          placeholder="Search Lesson, Teacher..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-xs text-white focus:outline-none focus:border-[#F27D26] placeholder:text-white/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 w-full">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Filter School</label>
                      <select
                        value={filterClassroomSchoolId}
                        onChange={(e) => setFilterClassroomSchoolId(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                      >
                        <option value="">All Schools Available</option>
                        {availableSchools.map(sch => (
                          <option key={sch.id} value={sch.id}>{sch.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 w-full">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Filter Grade</label>
                      <select
                        value={filterClassroomGrade}
                        onChange={(e) => setFilterClassroomGrade(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                      >
                        <option value="">All Grades</option>
                        {GRADES.map(grd => (
                          <option key={grd} value={grd}>Grade {grd}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 w-full">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Filter Section</label>
                      <select
                        value={filterClassroomSection}
                        onChange={(e) => setFilterClassroomSection(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                      >
                        <option value="">All Sections</option>
                        {SECTIONS.map(sec => (
                          <option key={sec} value={sec}>Section {sec}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(filterClassroomSchoolId || filterClassroomGrade || filterClassroomSection || classroomSearchText) && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          setFilterClassroomSchoolId('');
                          setFilterClassroomGrade('');
                          setFilterClassroomSection('');
                          setClassroomSearchText('');
                        }}
                        className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  )}
                </div>

                {/* DISPLAY LIST */}
                {displayClassroomSubmissions.length === 0 ? (
                  <div className="bg-[#151619]/50 border border-dashed border-white/10 rounded-3xl p-16 text-center text-white/30 space-y-4">
                    <Camera className="mx-auto text-white/10" size={48} />
                    <p className="text-sm font-bold">No classroom activity photos found</p>
                    <p className="text-xs max-w-sm mx-auto">
                      {isAdmin ? 'Select school and grade filters above, or ask teachers to submit classroom activity photo links.' : 'Choose the Upload Photo Links option to log your first classroom activity.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {displayClassroomSubmissions.map((sub) => (
                      <div key={sub.id} className="bg-[#151619] border border-white/10 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold font-mono uppercase px-2 py-0.5 bg-[#F27D26]/10 border border-[#F27D26]/20 text-[#F27D26] rounded-md">
                                Grade {sub.grade} - Section {sub.section}
                              </span>
                              <h4 className="text-lg font-bold text-white mt-2 leading-tight">{sub.schoolName}</h4>
                            </div>
                            
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteClassroom(sub.id)}
                                className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-xl transition-all cursor-pointer"
                                title="Delete submission"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          <div className="p-4 bg-black/30 border border-white/5 rounded-2xl space-y-2 text-xs">
                            <div className="flex justify-between text-white/55">
                              <span>Day/Class Number:</span>
                              <span className="font-bold font-mono text-white">Day {sub.dayNumber}</span>
                            </div>
                            <div className="flex justify-between text-white/55">
                              <span>Assigned Topic:</span>
                              <span className="font-bold text-white text-right truncate max-w-[200px]" title={sub.lessonName}>
                                {sub.lessonName}
                              </span>
                            </div>
                            <div className="flex justify-between text-white/55">
                              <span>Submitted By:</span>
                              <span className="text-white">{sub.teacherName}</span>
                            </div>
                            <div className="flex justify-between text-white/55">
                              <span>Submitted On:</span>
                              <span className="text-white/70 font-mono text-[11px]">
                                {new Date(sub.timestamp).toLocaleDateString()} at {new Date(sub.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h5 className="text-[10px] font-bold uppercase tracking-wider text-white/40">Shared Media Links ({sub.driveUrls.length})</h5>
                            <div className="grid grid-cols-1 gap-2">
                              {sub.driveUrls.map((url, index) => (
                                <a
                                  key={index}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-[#F27D26] font-semibold transition-all group/link"
                                >
                                  <span className="truncate max-w-[220px] text-white/80 group-hover/link:text-white transition-colors">
                                    Drive Link {index + 1}
                                  </span>
                                  <ExternalLink size={14} className="shrink-0 text-[#F27D26]" />
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* SUBMISSION FORM */
              <form onSubmit={handleSubmitClassroom} className="bg-[#151619] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 max-w-3xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* SCHOOL SELECT */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">School <span className="text-red-500">*</span></label>
                    <select
                      value={clSchoolId}
                      onChange={(e) => {
                        setClSchoolId(e.target.value);
                        setClGrade('');
                        setClLessonId('');
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                      required
                    >
                      <option value="">Select School</option>
                      {availableSchools.map(sch => (
                        <option key={sch.id} value={sch.id}>{sch.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* GRADE SELECT */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Grade <span className="text-red-500">*</span></label>
                    <select
                      value={clGrade}
                      onChange={(e) => {
                        setClGrade(e.target.value);
                        setClLessonId('');
                      }}
                      disabled={!clSchoolId}
                      className="w-full bg-black/40 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                      required
                    >
                      <option value="">Select Grade</option>
                      {GRADES.map(grd => (
                        <option key={grd} value={grd}>Grade {grd}</option>
                      ))}
                    </select>
                  </div>

                  {/* SECTION SELECT */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Section <span className="text-red-500">*</span></label>
                    <select
                      value={clSection}
                      onChange={(e) => setClSection(e.target.value)}
                      disabled={!clGrade}
                      className="w-full bg-black/40 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                      required
                    >
                      <option value="">Select Section</option>
                      {SECTIONS.map(sec => (
                        <option key={sec} value={sec}>Section {sec}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* LESSON CURRICULUM SELECT */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">
                    Choose Lesson / Topic <span className="text-red-500">*</span>
                  </label>
                  
                  <button
                    type="button"
                    disabled={!clSection}
                    onClick={() => setIsLessonModalOpen(true)}
                    className="w-full bg-black/40 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white flex items-center justify-between transition-colors text-left"
                  >
                    <span className="truncate">
                      {selectedLessonObject 
                        ? `Day ${selectedLessonObject.classNumber} - ${selectedLessonObject.lessonTitle}` 
                        : (clSection ? 'Click to search/choose assigned lesson...' : 'Complete school, grade, & section first')}
                    </span>
                    <ChevronRight size={14} className="text-white/40 shrink-0" />
                  </button>

                  {!activeCurriculum && clGrade && clSchoolId && (
                    <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-xl text-xs mt-2">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>No curriculum is currently mapped for this school & grade. Map it in School-wise Curriculum page first.</span>
                    </div>
                  )}
                </div>

                {/* DYNAMIC DRIVE LINKS */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">
                      Google Drive Links <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[9px] text-white/40 font-mono">Uncapped link count</span>
                  </div>

                  <div className="space-y-3">
                    {clDriveUrls.map((url, idx) => (
                      <div key={idx} className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={url}
                            onChange={(e) => handleDriveUrlChange(idx, e.target.value)}
                            placeholder={`Paste Google Drive Link ${idx + 1}`}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                            required
                          />
                        </div>
                        
                        {clDriveUrls.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDriveField(idx)}
                            className="p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-2xl transition-all flex items-center justify-center shrink-0 cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}

                        {idx === clDriveUrls.length - 1 && (
                          <button
                            type="button"
                            onClick={handleAddDriveField}
                            className="p-3 bg-[#F27D26]/10 hover:bg-[#F27D26]/20 border border-[#F27D26]/20 hover:border-[#F27D26]/30 text-[#F27D26] rounded-2xl transition-all flex items-center justify-center shrink-0 cursor-pointer font-bold"
                            title="Add another link"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setClassroomView('list')}
                    className="px-6 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !clLessonId || clDriveUrls.some(u => !u.trim())}
                    className="px-8 py-3.5 bg-[#F27D26] hover:bg-[#d66a1e] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-[#F27D26]/20 transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <Clock size={14} className="animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Submit Photo Links</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="competition"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* VIEW SUBMISSIONS vs SUBMIT FORM ACTIONS */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white/90">
                {competitionView === 'list' ? 'Competition Project Documentation' : 'New Project Documentation Submission'}
              </h3>
              {isTeacher && (
                <button
                  onClick={() => {
                    setCompetitionView(competitionView === 'list' ? 'submit' : 'list');
                    resetCompetitionForm();
                  }}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  {competitionView === 'list' ? (
                    <>
                      <Plus size={16} className="text-[#F27D26]" />
                      Document New Project
                    </>
                  ) : (
                    <>
                      <ArrowLeft size={16} />
                      View Project History
                    </>
                  )}
                </button>
              )}
            </div>

            {competitionView === 'list' ? (
              <div className="space-y-6">
                {/* FILTER CARD */}
                <div className="bg-[#151619] border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-1.5 w-full">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Search Students & Projects</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/40">
                          <Search size={14} />
                        </span>
                        <input
                          type="text"
                          value={projectSearchText}
                          onChange={(e) => setProjectSearchText(e.target.value)}
                          placeholder="Search by Student, Project or Competition..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-xs text-white focus:outline-none focus:border-[#F27D26] placeholder:text-white/20"
                        />
                      </div>
                    </div>

                    <div className="w-full md:w-80 space-y-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Filter School</label>
                      <select
                        value={filterProjectSchoolId}
                        onChange={(e) => setFilterProjectSchoolId(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                      >
                        <option value="">All Schools Available</option>
                        {availableSchools.map(sch => (
                          <option key={sch.id} value={sch.id}>{sch.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(filterProjectSchoolId || projectSearchText) && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => {
                          setFilterProjectSchoolId('');
                          setProjectSearchText('');
                        }}
                        className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  )}
                </div>

                {/* DISPLAY LIST */}
                {displayProjectSubmissions.length === 0 ? (
                  <div className="bg-[#151619]/50 border border-dashed border-white/10 rounded-3xl p-16 text-center text-white/30 space-y-4">
                    <Trophy className="mx-auto text-white/10" size={48} />
                    <p className="text-sm font-bold">No competition project submissions found</p>
                    <p className="text-xs max-w-sm mx-auto">
                      {isAdmin ? 'Select school filter above, or ask teachers to submit competition documentation.' : 'Choose the Document New Project option to log your first school-wide project.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {displayProjectSubmissions.map((sub) => (
                      <div key={sub.id} className="bg-[#151619] border border-white/10 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold font-mono uppercase px-2 py-0.5 bg-[#F27D26]/10 border border-[#F27D26]/20 text-[#F27D26] rounded-md">
                                {sub.competitionName}
                              </span>
                              <h4 className="text-lg font-bold text-white mt-2 leading-tight">{sub.projectName}</h4>
                              <p className="text-xs text-white/50">{sub.schoolName}</p>
                            </div>
                            
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteProject(sub.id)}
                                className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-xl transition-all cursor-pointer"
                                title="Delete submission"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          <div className="p-4 bg-black/30 border border-white/5 rounded-2xl space-y-3 text-xs text-white/80">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block mb-1">Associated Students:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {sub.studentNames.map((st, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[11px] text-white">
                                    {st}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block mb-1">Project Brief:</span>
                              <p className="italic text-white/70 leading-relaxed">{sub.projectBrief}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-white/5 text-[11px] text-white/50">
                              <div>Submitted By: <span className="text-white">{sub.teacherName}</span></div>
                              <div className="text-right font-mono text-[10px]">{new Date(sub.timestamp).toLocaleDateString()}</div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h5 className="text-[10px] font-bold uppercase tracking-wider text-white/40">Project Media Links</h5>
                            <div className="grid grid-cols-3 gap-2">
                              {sub.photoDriveUrl && (
                                <a
                                  href={sub.photoDriveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-center transition-all group/media"
                                >
                                  <Camera size={16} className="text-[#F27D26] mb-1.5 group-hover/media:scale-110 transition-transform" />
                                  <span className="text-[10px] font-semibold text-white/70 group-hover/media:text-white">Photo</span>
                                </a>
                              )}
                              {sub.pdfDriveUrl && (
                                <a
                                  href={sub.pdfDriveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-center transition-all group/media"
                                >
                                  <FileText size={16} className="text-blue-400 mb-1.5 group-hover/media:scale-110 transition-transform" />
                                  <span className="text-[10px] font-semibold text-white/70 group-hover/media:text-white">PDF / Doc</span>
                                </a>
                              )}
                              {sub.videoDriveUrl && (
                                <a
                                  href={sub.videoDriveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-center transition-all group/media"
                                >
                                  <Video size={16} className="text-green-400 mb-1.5 group-hover/media:scale-110 transition-transform" />
                                  <span className="text-[10px] font-semibold text-white/70 group-hover/media:text-white">Video</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* SUBMISSION FORM - SECTION 2 */
              <form onSubmit={handleSubmitProject} className="bg-[#151619] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 max-w-3xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SCHOOL SELECT */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">School <span className="text-red-500">*</span></label>
                    <select
                      value={projSchoolId}
                      onChange={(e) => setProjSchoolId(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                      required
                    >
                      <option value="">Select School</option>
                      {availableSchools.map(sch => (
                        <option key={sch.id} value={sch.id}>{sch.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* PROJECT NAME */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Project Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={projName}
                      onChange={(e) => setProjName(e.target.value)}
                      placeholder="e.g. Smart Dustbin, Obstacle Avoiding Robot"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-white/5">
                  {/* COMPETITION NAME */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Competition Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      placeholder="e.g. World Robot Olympiad, ATL Marathon, School Science Fair"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                      required
                    />
                  </div>

                  {/* STUDENT NAMES (DYNAMIC FIELDS) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Student Names <span className="text-red-500">*</span></label>
                      <span className="text-[9px] text-white/40 font-mono">Uncapped count</span>
                    </div>

                    <div className="space-y-2">
                      {projStudentNames.map((name, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => handleStudentNameChange(idx, e.target.value)}
                            placeholder={`Student ${idx + 1} Name`}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                            required
                          />
                          {projStudentNames.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveStudentField(idx)}
                              className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          {idx === projStudentNames.length - 1 && (
                            <button
                              type="button"
                              onClick={handleAddStudentField}
                              className="p-2.5 bg-[#F27D26]/10 hover:bg-[#F27D26]/20 border border-[#F27D26]/20 hover:border-[#F27D26]/30 text-[#F27D26] rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer font-bold"
                              title="Add another student"
                            >
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PROJECT BRIEF */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Project Brief (2 to 5 lines explaining the project) <span className="text-red-500">*</span></label>
                  <textarea
                    value={projBrief}
                    onChange={(e) => setProjBrief(e.target.value)}
                    placeholder="Describe the purpose, mechanism, materials used, and features of the project..."
                    rows={4}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-[#F27D26] resize-none"
                    required
                  />
                </div>

                {/* MEDIA LINKS */}
                <div className="space-y-4 pt-2 border-t border-white/5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40">Project Media Links (Google Drive URLs only)</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* PHOTO LINK */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Project Photo <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={projPhotoUrl}
                        onChange={(e) => setProjPhotoUrl(e.target.value)}
                        placeholder="Paste Drive Link for Photo"
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                        required
                      />
                    </div>

                    {/* PDF LINK */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Project PDF <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={projPdfUrl}
                        onChange={(e) => setProjPdfUrl(e.target.value)}
                        placeholder="Paste Drive Link for PDF"
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                        required
                      />
                    </div>

                    {/* VIDEO LINK */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Project Video <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={projVideoUrl}
                        onChange={(e) => setProjVideoUrl(e.target.value)}
                        placeholder="Paste Drive Link for Video"
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCompetitionView('list')}
                    className="px-6 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-3.5 bg-[#F27D26] hover:bg-[#d66a1e] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-[#F27D26]/20 transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <Clock size={14} className="animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Submit Project documentation</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* LESSON SEARCH MODAL/POPUP (SECTION 1 FORM) */}
      <AnimatePresence>
        {isLessonModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLessonModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-[#151619] border border-white/10 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-bold text-white uppercase tracking-wider">Choose Curriculum Day/Lesson</h4>
                  <button 
                    onClick={() => setIsLessonModalOpen(false)}
                    className="p-1 px-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                  <input
                    type="text"
                    value={lessonSearch}
                    onChange={(e) => setLessonSearch(e.target.value)}
                    placeholder="Search by day or lesson title..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar min-h-[300px]">
                {filteredLessons.length === 0 ? (
                  <div className="p-12 text-center text-white/30 text-xs">
                    No assigned lessons found matching search criteria.
                  </div>
                ) : (
                  filteredLessons.map((les) => (
                    <button
                      key={les.lessonId}
                      type="button"
                      onClick={() => {
                        setClLessonId(les.lessonId);
                        setIsLessonModalOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-3.5 rounded-xl text-left border text-xs transition-all",
                        clLessonId === les.lessonId 
                          ? "bg-[#F27D26]/10 border-[#F27D26]/30 text-[#F27D26]" 
                          : "bg-transparent border-transparent hover:bg-white/5 text-white/70 hover:text-white"
                      )}
                    >
                      <div className="space-y-0.5">
                        <span className="font-mono text-[10px] text-[#F27D26]/80 uppercase block">Day {les.classNumber}</span>
                        <span className="font-bold">{les.lessonTitle}</span>
                      </div>
                      <ChevronRight size={14} className="opacity-50" />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

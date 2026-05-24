import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Course, Module, ContentActivation, School, Component, ContentFile, ModuleStep } from '../types';
import { 
  Plus, Book, Trash2, Eye, EyeOff, ExternalLink, ChevronRight, LayoutGrid, Upload, 
  FileVideo, FileText as FileIcon, Loader2, Edit2, X, Settings, File as FileGeneric, 
  Search, BookOpen, Sliders, Play, Code, List, Columns, Sparkles, Filter, ChevronDown, Check,
  ExternalLink as LinkIcon, HelpCircle
} from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

// Import extracted sub-components
import EditCourseModal from '../components/EditCourseModal';
import EditModuleModal from '../components/EditModuleModal';
import ManageComponentsModal from '../components/ManageComponentsModal';
import FileViewer from '../components/FileViewer';
import { ModulePlayer } from '../components/ModulePlayer';

const SUB_CATEGORIES: Record<string, string[]> = {
  'Robotics': ['Arduino & Microcontrollers', 'LEGO Robotics', 'Sensors & Actuators', 'Mechanical Assembly', 'BBC Micro:bit', 'PCB Prototyping'],
  'Coding': ['Scratch Blocks', 'Python Development', 'Web Design (HTML/CSS)', 'Game Design', 'Mobile Applications'],
  'IoT': ['Smart Home Systems', 'Wireless ESP8266/ESP32', 'Sensor Networks', 'Cloud Web Servers'],
  'Electronics': ['Circuits & Breadboards', 'Soldering & Assembly', 'Digital Logic Gates', 'Ohm\'s Law Fundamentals'],
  'AI & ML': ['Computer Vision', 'Voice Automation', 'Neural Networks', 'Algorithmic Models']
};

export default function ContentManager() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [activations, setActivations] = useState<ContentActivation[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [components, setComponents] = useState<Component[]>([]);

  // Navigation Tabs: 'library' (Explorer) vs 'publisher' (Creator)
  const [activeTab, setActiveTab] = useState<'library' | 'publisher'>('library');

  // Library Controls & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgeFilter, setSelectedAgeFilter] = useState('All');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');
  const [selectedDifficultyFilter, setSelectedDifficultyFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Toggle collapsed courses in List view
  const [collapsedCourses, setCollapsedCourses] = useState<string[]>([]);

  // Course Form States
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseGrade, setNewCourseGrade] = useState(1);
  const [newCourseDescription, setNewCourseDescription] = useState('');
  const [newCourseAgeRange, setNewCourseAgeRange] = useState('6-8');
  const [newCourseType, setNewCourseType] = useState('Robotics');
  const [newCourseSubCategory, setNewCourseSubCategory] = useState('Arduino & Microcontrollers');
  const [newCourseDifficulty, setNewCourseDifficulty] = useState('Beginner');

  // Module Form States
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleDescription, setNewModuleDescription] = useState('');
  const [newModuleDriveUrl, setNewModuleDriveUrl] = useState('');
  const [newModuleComponentIds, setNewModuleComponentIds] = useState<string[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  // Advanced Seamless Upload States
  const [videoOption, setVideoOption] = useState<'upload' | 'link'>('link');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');

  const [pptOption, setPPTOption] = useState<'upload' | 'link'>('link');
  const [pptFile, setPPTFile] = useState<File | null>(null);
  const [pptUrl, setPPTUrl] = useState('');

  const [codeTitle, setCodeTitle] = useState('');
  const [codeContent, setCodeContent] = useState('');

  const [extImageUrl, setExtImageUrl] = useState('');
  const [extImageFile, setExtImageFile] = useState<File | null>(null);

  const [extLinkTitle, setExtLinkTitle] = useState('');
  const [extLinkUrl, setExtLinkUrl] = useState('');

  // Modals visibility toggles
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [viewingModule, setViewingModule] = useState<Module | null>(null);
  const [isComponentRepoOpen, setIsComponentRepoOpen] = useState(false);

  // Upload/Saving progress controls
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // File Viewer config
  const [viewerConfig, setViewerConfig] = useState<{ url: string; type: 'video' | 'pdf' | 'ppt' | 'image' | 'doc' | 'code' | 'link'; title: string } | null>(null);

  // Target drag-and-drop course transfer state
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);

  useEffect(() => {
    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    });

    const unsubModules = onSnapshot(collection(db, 'modules'), (snapshot) => {
      setModules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module)));
    });

    const unsubActivations = onSnapshot(collection(db, 'activations'), (snapshot) => {
      setActivations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentActivation)));
    });

    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    });

    const unsubComponents = onSnapshot(collection(db, 'components'), (snapshot) => {
      setComponents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Component)));
    });

    return () => {
      unsubCourses();
      unsubModules();
      unsubActivations();
      unsubSchools();
      unsubComponents();
    };
  }, []);

  const uploadFile = async (file: File, path: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error) => {
          console.error(`Upload error:`, error);
          reject(error);
        }, 
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            resolve(downloadURL);
          });
        }
      );
    });
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;
    try {
      await addDoc(collection(db, 'courses'), {
        title: newCourseTitle,
        grade: Number(newCourseGrade),
        description: newCourseDescription || `Robotics curriculum for Grade ${newCourseGrade}`,
        ageRange: newCourseAgeRange,
        courseType: newCourseType,
        subCategory: newCourseSubCategory,
        difficulty: newCourseDifficulty,
        teacherId: profile?.uid || '',
        schoolId: profile?.schoolIds?.[0] || '',
        activated: false
      });
      setNewCourseTitle('');
      setNewCourseDescription('');
      toast.success('Course created successfully! Ready for module assignments.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'courses');
    }
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle.trim() || !selectedCourseId) {
      toast.error('Module Title and Target Course are required');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    try {
      let thumbnailUrl = '';
      if (thumbnailFile) {
        setUploadProgress(20);
        const ext = thumbnailFile.name.split('.').pop();
        thumbnailUrl = await uploadFile(thumbnailFile, `modules/${selectedCourseId}/${newModuleTitle}_thumb_${Date.now()}.${ext}`);
      }

      setUploadProgress(35);
      const uploadedFiles: ContentFile[] = [];

      // Seamless video processing
      if (videoOption === 'upload' && videoFile) {
        const ext = videoFile.name.split('.').pop();
        const url = await uploadFile(videoFile, `modules/${selectedCourseId}/${newModuleTitle}_vid_${Date.now()}.${ext}`);
        uploadedFiles.push({
          id: 'v_' + Math.random().toString(36).substr(2, 9),
          name: videoFile.name,
          url,
          type: 'video'
        });
      } else if (videoOption === 'link' && videoUrl.trim()) {
        uploadedFiles.push({
          id: 'v_' + Math.random().toString(36).substr(2, 9),
          name: 'Video Web Stream',
          url: videoUrl,
          type: 'video'
        });
      }

      setUploadProgress(55);
      // Seamless PPT/Slides processing
      if (pptOption === 'upload' && pptFile) {
        const ext = pptFile.name.split('.').pop();
        const url = await uploadFile(pptFile, `modules/${selectedCourseId}/${newModuleTitle}_ppt_${Date.now()}.${ext}`);
        uploadedFiles.push({
          id: 'p_' + Math.random().toString(36).substr(2, 9),
          name: pptFile.name,
          url,
          type: 'ppt'
        });
      } else if (pptOption === 'link' && pptUrl.trim()) {
        uploadedFiles.push({
          id: 'p_' + Math.random().toString(36).substr(2, 9),
          name: 'Presentation Module',
          url: pptUrl,
          type: 'ppt'
        });
      }

      setUploadProgress(70);
      // Seamless Code snippet block processing
      if (codeContent.trim()) {
        uploadedFiles.push({
          id: 'c_' + Math.random().toString(36).substr(2, 9),
          name: codeTitle.trim() || 'Source Code Explanation',
          url: codeContent,
          type: 'code'
        });
      }

      // Seamless External Images processing
      if (extImageFile) {
        const ext = extImageFile.name.split('.').pop();
        const url = await uploadFile(extImageFile, `modules/${selectedCourseId}/${newModuleTitle}_img_${Date.now()}.${ext}`);
        uploadedFiles.push({
          id: 'i_' + Math.random().toString(36).substr(2, 9),
          name: extImageFile.name,
          url,
          type: 'image'
        });
      } else if (extImageUrl.trim()) {
        uploadedFiles.push({
          id: 'i_' + Math.random().toString(36).substr(2, 9),
          name: 'Resource Schematic Panel',
          url: extImageUrl,
          type: 'image'
        });
      }

      // Seamless External Reference links processing
      if (extLinkUrl.trim()) {
        uploadedFiles.push({
          id: 'l_' + Math.random().toString(36).substr(2, 9),
          name: extLinkTitle.trim() || 'Student Learning Reference',
          url: extLinkUrl,
          type: 'link'
        });
      }

      setUploadProgress(90);

      // Save module doc to Firestore
      const moduleData: any = {
        title: newModuleTitle,
        description: newModuleDescription,
        courseId: selectedCourseId,
        driveUrl: newModuleDriveUrl || '',
        thumbnailUrl: thumbnailUrl || '',
        files: uploadedFiles,
        componentIds: newModuleComponentIds,
        isVisible: true
      };

      await addDoc(collection(db, 'modules'), moduleData);
      setUploadProgress(100);

      toast.success('Module added successfully into your curriculum library!');

      // Instant cleanup
      setNewModuleTitle('');
      setNewModuleDescription('');
      setNewModuleDriveUrl('');
      setNewModuleComponentIds([]);
      setThumbnailFile(null);
      setVideoFile(null);
      setVideoUrl('');
      setPPTFile(null);
      setPPTUrl('');
      setCodeTitle('');
      setCodeContent('');
      setExtImageUrl('');
      setExtImageFile(null);
      setExtLinkTitle('');
      setExtLinkUrl('');

      // Auto-focus on Library Explorer so they can view it
      setActiveTab('library');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'modules');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateCourse = async (courseId: string, updates: any) => {
    try {
      await updateDoc(doc(db, 'courses', courseId), updates);
      toast.success('Course updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `courses/${courseId}`);
    }
  };

  const handleUpdateModule = async (moduleId: string, updatedFields: Partial<Module>) => {
    try {
      await updateDoc(doc(db, 'modules', moduleId), updatedFields);
      toast.success('Module elements saved');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `modules/${moduleId}`);
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    const courseModules = modules.filter(m => m.courseId === course.id);
    if (courseModules.length > 0) {
      toast.error(`Cannot delete course with ${courseModules.length} assigned modules. Re-assign or delete modules first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete course "${course.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'courses', course.id));
      toast.success('Course deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `courses/${course.id}`);
    }
  };

  const handleDeleteModule = async (module: Module) => {
    if (!window.confirm(`Delete module "${module.title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'modules', module.id));
      setModules(prev => prev.filter(m => m.id !== module.id));
      toast.success('Module deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `modules/${module.id}`);
    }
  };

  const toggleActivation = async (moduleId: string) => {
    if (!profile?.schoolIds || profile.schoolIds.length === 0 || !profile?.uid) return;
    const activationId = `${profile.schoolIds[0]}_${moduleId}`;
    const existing = activations.find(a => a.id === activationId);
    try {
      await setDoc(doc(db, 'activations', activationId), {
        moduleId,
        schoolId: profile.schoolIds[0],
        teacherId: profile.uid,
        activated: !existing?.activated
      });
      toast.success(existing?.activated ? 'Module deactivated for students' : 'Module activated for students');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `activations/${activationId}`);
    }
  };

  const toggleVisibility = async (module: Module) => {
    const nextVis = module.isVisible === false;
    try {
      await updateDoc(doc(db, 'modules', module.id), { isVisible: nextVis });
      toast.success(nextVis ? 'Visible globally' : 'Hidden globally');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `modules/${module.id}`);
    }
  };

  const handleTransferModule = async (moduleId: string, targetCourseId: string) => {
    try {
      await updateDoc(doc(db, 'modules', moduleId), { courseId: targetCourseId });
      toast.success('Module reassigned successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `modules/${moduleId}`);
    }
  };

  const handleAddComponentToRepo = async (name: string, file: File | null) => {
    try {
      let imageUrl = '';
      if (file) {
        imageUrl = await uploadFile(file, `components/${Date.now()}_${file.name}`);
      }
      await addDoc(collection(db, 'components'), { name, imageUrl: imageUrl || undefined });
      toast.success('Component catalog updated');
    } catch (error) {
      toast.error('Failed to register component');
    }
  };

  const handleDeleteComponentFromRepo = async (id: string, name: string) => {
    if (!window.confirm(`Delete ${name} from catalog repository?`)) return;
    try {
      await deleteDoc(doc(db, 'components', id));
      toast.success('Component removed');
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const toggleCollapseCourse = (courseId: string) => {
    setCollapsedCourses(prev => 
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );
  };

  // Advanced Fallback Filter Logic
  const filteredCourses = courses.filter(course => {
    // Search Matching
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (course.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Filter by Age Segment
    if (selectedAgeFilter !== 'All') {
      const explicitAge = course.ageRange;
      if (explicitAge) {
        if (explicitAge !== selectedAgeFilter) return false;
      } else {
        const grade = course.grade || 1;
        let inferredAge = '6-8';
        if (grade >= 10) inferredAge = '15+';
        else if (grade >= 7) inferredAge = '12-14';
        else if (grade >= 4) inferredAge = '9-11';
        if (inferredAge !== selectedAgeFilter) return false;
      }
    }

    // Filter by Course Category
    if (selectedTypeFilter !== 'All') {
      const type = course.courseType || 'Robotics';
      if (type.toLowerCase() !== selectedTypeFilter.toLowerCase()) return false;
    }

    // Filter by Difficulty
    if (selectedDifficultyFilter !== 'All') {
      const difficulty = course.difficulty || 'Beginner';
      if (difficulty.toLowerCase() !== selectedDifficultyFilter.toLowerCase()) return false;
    }

    return true;
  });

  return (
    <div className="space-y-8">
      {/* Tab Navigation header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tight text-white mb-1">Curriculum Management</h2>
          </div>
          <p className="text-white/50 font-mono text-xs uppercase tracking-widest leading-none mt-1">Manage robotics syllabi and media streams</p>
        </div>

        <div className="flex items-center gap-4 bg-white/5 p-1 rounded-2xl border border-white/10 shrink-0">
          <button 
            onClick={() => setActiveTab('library')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2",
              activeTab === 'library' ? "bg-[#F27D26] text-white shadow-lg shadow-[#F27D26]/20" : "text-white/40 hover:text-white"
            )}
          >
            <BookOpen size={14} /> Explorer View
          </button>
          
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('publisher')}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2",
                activeTab === 'publisher' ? "bg-[#F27D26] text-white shadow-lg shadow-[#F27D26]/20" : "text-white/40 hover:text-white"
              )}
            >
              <Plus size={14} /> Publisher Hub
            </button>
          )}

          {isAdmin && (
            <button 
              onClick={() => setIsComponentRepoOpen(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2"
              title="Equipment Parts Catalog"
            >
              <Settings size={14} /> Catalog
            </button>
          )}
        </div>
      </header>

      {/* RENDER TAB 1: CURRICULUM EXPLORER */}
      {activeTab === 'library' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          {/* LEFT FILTER SIDEBAR */}
          <aside className="bg-[#151619] border border-white/5 rounded-2xl p-6 lg:sticky lg:top-4 space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-white/5">
              <Filter size={16} className="text-[#F27D26]" />
              <h4 className="font-extrabold uppercase text-xs tracking-widest text-white/80">Segment Filter options</h4>
            </div>

            {/* Age filters */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-white/40">Student Age Segment</label>
              <div className="flex flex-col gap-1">
                {['All', '6-8', '9-11', '12-14', '15+'].map(age => (
                  <button
                    key={age}
                    onClick={() => setSelectedAgeFilter(age)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all border flex items-center justify-between",
                      selectedAgeFilter === age 
                        ? "bg-[#F27D26]/10 text-[#F27D26] border-[#F27D26]/30 font-bold" 
                        : "bg-transparent text-white/60 border-transparent hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <span>{age === 'All' ? 'All Classes' : `Age ${age}`}</span>
                    {selectedAgeFilter === age && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Course type category filters */}
            <div className="space-y-2 pt-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-white/40">Syllabus Topic Category</label>
              <div className="flex flex-col gap-1">
                {['All', 'Robotics', 'Coding', 'IoT', 'Electronics', 'AI & ML'].map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedTypeFilter(type)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all border flex items-center justify-between",
                      selectedTypeFilter === type 
                        ? "bg-[#F27D26]/10 text-[#F27D26] border-[#F27D26]/30 font-bold" 
                        : "bg-transparent text-white/60 border-transparent hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <span>{type === 'All' ? 'All Categories' : type}</span>
                    {selectedTypeFilter === type && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty levels filters */}
            <div className="space-y-2 pt-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-white/40">Syllabus Complexity Level</label>
              <div className="flex flex-col gap-1">
                {['All', 'Beginner', 'Intermediate', 'Advanced'].map(diff => (
                  <button
                    key={diff}
                    onClick={() => setSelectedDifficultyFilter(diff)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all border flex items-center justify-between",
                      selectedDifficultyFilter === diff 
                        ? "bg-[#F27D26]/10 text-[#F27D26] border-[#F27D26]/30 font-bold" 
                        : "bg-transparent text-white/60 border-transparent hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <span>{diff === 'All' ? 'All Difficulties' : diff}</span>
                    {selectedDifficultyFilter === diff && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear filters trigger */}
            {(selectedAgeFilter !== 'All' || selectedTypeFilter !== 'All' || selectedDifficultyFilter !== 'All' || searchQuery !== '') && (
              <button 
                onClick={() => {
                  setSelectedAgeFilter('All');
                  setSelectedTypeFilter('All');
                  setSelectedDifficultyFilter('All');
                  setSearchQuery('');
                }}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all"
              >
                Reset Filter Settings
              </button>
            )}
          </aside>

          {/* MAIN CONTENT AREA */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* SEARCH AND VIEW OPTION CONTROLS */}
            <div className="bg-[#151619] border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-2.5 text-white/30" size={16} />
                <input
                  type="text"
                  placeholder="Search syllabus courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#F27D26] placeholder-white/30"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-black p-1 rounded-xl border border-white/5 shrink-0 self-end sm:self-auto">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                    viewMode === 'grid' ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                  )}
                >
                  <LayoutGrid size={12} /> Grid Layout
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                    viewMode === 'list' ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                  )}
                >
                  <List size={12} /> Sequential List
                </button>
              </div>
            </div>

            {/* CURRICULUM DISPLAY */}
            <div className="space-y-6">
              {filteredCourses.sort((a, b) => a.grade - b.grade).map((course) => {
                const courseModules = modules.filter(m => m.courseId === course.id)
                  .filter(m => isAdmin || m.isVisible !== false);

                const isCollapsed = collapsedCourses.includes(course.id);

                return (
                  <div 
                    key={course.id} 
                    className="bg-[#151619] border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/10"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('border-[#F27D26]/50', 'bg-white/[0.01]');
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-[#F27D26]/50', 'bg-white/[0.01]');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-[#F27D26]/50', 'bg-white/[0.01]');
                      if (draggedModuleId) {
                        handleTransferModule(draggedModuleId, course.id);
                        setDraggedModuleId(null);
                      }
                    }}
                  >
                    {/* Course header panel */}
                    <div className="p-6 bg-white/[0.02] border-b border-white/5 flex gap-4 items-center justify-between">
                      <div className="flex-1 min-w-0" onClick={() => toggleCollapseCourse(course.id)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xl font-bold text-white hover:text-[#F27D26] cursor-pointer transition-colors truncate">{course.title}</h4>
                          <span className="px-2 py-0.5 bg-zinc-800 text-white/50 text-[9px] font-mono rounded">
                            Grade {course.grade || 1}
                          </span>
                        </div>
                        
                        {/* Meta tagging details */}
                        <div className="flex flex-wrap gap-2 items-center text-white/40 text-[9px] font-bold uppercase tracking-widest mt-2">
                          <span>Age segment: {course.ageRange || '6-8'}</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-white/10" />
                          <span>Category: {course.courseType || 'Robotics'}</span>
                          {course.subCategory && (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-white/10" />
                              <span className="text-[#F27D26] bg-[#F27D26]/5 px-1.5 py-0.5 rounded border border-[#F27D26]/20">{course.subCategory}</span>
                            </>
                          )}
                          <span className="h-1.5 w-1.5 rounded-full bg-white/10" />
                          <span className="text-[#F27D26]">{course.difficulty || 'Beginner'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {isAdmin && (
                          <div className="flex items-center gap-1 border-r border-white/10 pr-3">
                            <button 
                              onClick={() => setEditingCourse(course)}
                              className="p-2 text-white/40 hover:text-[#F27D26] transition-colors"
                              title="Edit Syllabus settings"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteCourse(course)}
                              className="p-2 text-white/40 hover:text-red-500 transition-colors"
                              title="Delete Course syllabus"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => toggleCollapseCourse(course.id)}
                          className="p-2 text-white/40 hover:text-white transition-colors"
                        >
                          <ChevronDown size={18} className={cn("transition-transform duration-300", isCollapsed ? "-rotate-90" : "rotate-0")} />
                        </button>
                      </div>
                    </div>

                    {/* Course modules content frame */}
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className={cn(
                            "p-6",
                            viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"
                          )}>
                            {courseModules.map((module) => {
                              const activation = activations.find(a => a.moduleId === module.id && profile?.schoolIds?.includes(a.schoolId));
                              const isActivated = activation?.activated;

                              return (
                                <div 
                                  key={module.id} 
                                  draggable={isAdmin}
                                  onDragStart={() => setDraggedModuleId(module.id)}
                                  onDragEnd={() => setDraggedModuleId(null)}
                                  onClick={() => setViewingModule(module)}
                                  className={cn(
                                    "bg-black/30 border border-white/5 rounded-xl group relative cursor-pointer hover:border-[#F27D26]/40 hover:bg-black/40 transition-all flex flex-col",
                                    viewMode === 'grid' ? "p-4 h-full" : "p-3 sm:flex-row sm:items-center sm:gap-4 justify-between"
                                  )}
                                >
                                  {module.thumbnailUrl && (
                                    <div className={cn(
                                      "rounded-lg overflow-hidden border border-white/10 shrink-0 bg-zinc-900",
                                      viewMode === 'grid' ? "aspect-video mb-4 w-full" : "w-20 h-12"
                                    )}>
                                      <img src={module.thumbnailUrl} alt={module.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    </div>
                                  )}

                                  <div className="flex-1 min-w-0 pr-2">
                                    <h5 className="font-bold text-sm text-white group-hover:text-[#F27D26] transition-colors truncate">{module.title}</h5>
                                    {viewMode === 'grid' && (
                                      <p className="text-[10px] text-white/50 line-clamp-2 mt-1 mb-4 h-8">{module.description || 'Interactive robotics activity content.'}</p>
                                    )}
                                  </div>

                                  {/* Media links and quick settings triggers */}
                                  <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-2 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                                    
                                    {(module.files || []).map((file, idx) => (
                                      <button
                                        key={file.id || idx}
                                        onClick={() => setViewerConfig({ url: file.url, type: file.type as any, title: file.name })}
                                        className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all text-white/60 hover:text-white"
                                        title={`Launch ${file.type}`}
                                      >
                                        {file.type === 'video' ? <FileVideo size={10} className="text-[#F27D26]" /> : <FileGeneric size={10} className="text-blue-400" />}
                                        <span className="text-[8px] font-black uppercase tracking-wider truncate max-w-[80px]">{file.name}</span>
                                      </button>
                                    ))}

                                    {module.driveUrl && (
                                      <button
                                        onClick={() => setViewerConfig({ url: module.driveUrl!, type: 'doc', title: module.title })}
                                        className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-[#F27D26]/10 rounded-lg border border-white/5 transition-all text-white/60 hover:text-[#F27D26]"
                                        title="See Integrated Drive documents"
                                      >
                                        <ExternalLink size={10} className="text-green-400" />
                                        <span className="text-[8px] font-black uppercase tracking-wider">Drive</span>
                                      </button>
                                    )}

                                    {/* Action button adjustments */}
                                    {isAdmin && (
                                      <div className="flex items-center gap-1 border-l border-white/10 pl-1.5">
                                        <button 
                                          onClick={() => setEditingModule(module)}
                                          className="p-1 px-2 hover:bg-white/5 rounded text-white/40 hover:text-white"
                                          title="Modify module setups"
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteModule(module)}
                                          className="p-1 px-2 hover:bg-white/5 rounded text-white/40 hover:text-red-500"
                                          title="De-register module"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    )}

                                    {/* Visibility / Live Status Controls */}
                                    <div className="flex items-center gap-1 ml-auto">
                                      {(isAdmin || profile?.role === 'teacher') && (
                                        <>
                                          {isAdmin && (
                                            <button 
                                              onClick={() => toggleVisibility(module)}
                                              className={cn(
                                                "p-1 rounded bg-zinc-900 border border-white/5 hover:border-white/10 text-white/30 hover:text-white",
                                                module.isVisible !== false ? "text-green-500 bg-green-500/5 hover:text-green-400" : ""
                                              )}
                                              title={module.isVisible !== false ? "Syllabus Visible Globally" : "Hidden Globally"}
                                            >
                                              {module.isVisible !== false ? <Eye size={12} /> : <EyeOff size={12} />}
                                            </button>
                                          )}
                                          <button 
                                            onClick={() => toggleActivation(module.id)}
                                            className={cn(
                                              "p-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all",
                                              isActivated ? "bg-[#F27D26]/10 text-[#F27D26] border-[#F27D26]/20" : "bg-zinc-900 text-white/30 border-white/5 hover:text-white"
                                            )}
                                            title={isActivated ? "Activated in student hub" : "Deactivated"}
                                          >
                                            {isActivated ? "Active" : "Inactive"}
                                          </button>
                                        </>
                                      )}
                                    </div>

                                  </div>
                                </div>
                              );
                            })}

                            {courseModules.length === 0 && (
                              <div className="col-span-full py-12 text-center border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center p-6 bg-black/10">
                                <HelpCircle size={32} className="text-white/20 mb-2" />
                                <h6 className="text-[#F27D26] text-xs font-bold uppercase tracking-widest leading-none mb-1">No Modules Attached</h6>
                                <p className="text-[10px] text-white/30 uppercase tracking-wider">Drag lessons or head to publisher node to seed assets</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                );
              })}

              {filteredCourses.length === 0 && (
                <div className="py-24 text-center border border-dashed border-white/5 bg-[#151619] rounded-2xl p-8 max-w-lg mx-auto">
                  <Sliders size={48} className="mx-auto text-white/20 mb-4 animate-bounce" />
                  <h5 className="text-white font-extrabold text-lg">No syllabus records match filter selections</h5>
                  <p className="text-xs text-white/40 mt-1">Refine your Age, Category, or search terms to reload classes.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* RENDER TAB 2: CONTENT PUBLISHER HUB */}
      {activeTab === 'publisher' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* SECTION A: COURSE BULK SETUP AND CREATION */}
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-8 space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 border-b border-white/5 pb-4 text-[#F27D26]">
              <Book size={20} /> Design New Course Page
            </h3>

            <form onSubmit={handleAddCourse} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Course Title Name</label>
                <input
                  type="text"
                  required
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#F27D26] placeholder-white/20"
                  placeholder="e.g. Arduino Microcontrollers Level 2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 animate-fade-in">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Target School Grade</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    required
                    value={newCourseGrade}
                    onChange={(e) => setNewCourseGrade(Number(e.target.value))}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-[#F27D26]">Target Age Classification</label>
                  <select
                    value={newCourseAgeRange}
                    onChange={(e) => setNewCourseAgeRange(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26] text-white"
                  >
                    <option value="6-8">Age 6-8 (Lower Primary)</option>
                    <option value="9-11">Age 9-11 (Upper Primary)</option>
                    <option value="12-14">Age 12-14 (Middle School)</option>
                    <option value="15+">Age 15+ (High School)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Course category Type</label>
                  <select
                    value={newCourseType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewCourseType(val);
                      const subs = SUB_CATEGORIES[val] || [];
                      setNewCourseSubCategory(subs[0] || '');
                    }}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26] text-white"
                  >
                    <option value="Robotics">Robotics & Arduino</option>
                    <option value="Coding">Python & Coding</option>
                    <option value="IoT">IoT Solutions</option>
                    <option value="Electronics">Basic Electronics</option>
                    <option value="AI & ML">AI / Machine Learning</option>
                  </select>
                </div>
                <div className="space-y-1 bg-black/40 border border-white/5 p-1 px-2.5 rounded-lg">
                  <label className="text-[9px] uppercase font-bold tracking-widest text-[#F27D26]">Syllabus Sub-Category</label>
                  <select
                    value={newCourseSubCategory}
                    onChange={(e) => setNewCourseSubCategory(e.target.value)}
                    className="w-full bg-transparent text-white text-xs focus:outline-none h-6 mt-0.5"
                  >
                    {(SUB_CATEGORIES[newCourseType] || []).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    {(!SUB_CATEGORIES[newCourseType] || SUB_CATEGORIES[newCourseType].length === 0) && (
                      <option value="">No sub-categories</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Difficulty Scale</label>
                  <select
                    value={newCourseDifficulty}
                    onChange={(e) => setNewCourseDifficulty(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26] text-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced Level</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Description Details</label>
                <textarea
                  value={newCourseDescription}
                  onChange={(e) => setNewCourseDescription(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26] h-20 resize-none placeholder-white/20"
                  placeholder="Outline syllabus objective highlights..."
                />
              </div>

              <button 
                type="submit" 
                className="w-full py-3 bg-[#F27D26] text-white rounded-xl font-bold hover:bg-[#d66a1e] transition-all flex items-center justify-center gap-2 uppercase tracking-wide text-xs"
              >
                <Plus size={16} /> Create Curriculum Course
              </button>
            </form>
          </section>

          {/* SECTION B: MODULE STEP GENERATOR & RESOURCE ADDITION */}
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-8 space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 border-b border-white/5 pb-4 text-[#F27D26]">
              <Upload size={20} /> Publish Module Lessons
            </h3>

            <form onSubmit={handleAddModule} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest text-[#F27D26]">Select Target Course assignment</label>
                <select
                  value={selectedCourseId}
                  required
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#F27D26]"
                >
                  <option value="">Choose Course Page</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Lesson Module Title</label>
                <input
                  type="text"
                  required
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26]"
                  placeholder="e.g. Blinking LED with Morse Code pulse"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Short Overview description</label>
                <textarea
                  value={newModuleDescription}
                  onChange={(e) => setNewModuleDescription(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26] h-16 resize-none"
                  placeholder="Lesson high level tasks..."
                />
              </div>

              {/* INTEGRATED DOC DRIVERS */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Google Docs / Slides embedded URL</label>
                <input
                  type="url"
                  value={newModuleDriveUrl}
                  onChange={(e) => setNewModuleDriveUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-[#F27D26] font-mono"
                  placeholder="Drive doc viewer sharing link"
                />
              </div>

              {/* SEAMLESS ASSETS GENERATOR */}
              <div className="p-4 bg-zinc-900 rounded-xl border border-white/5 space-y-4">
                <h4 className="text-[10px] font-black uppercase text-white/40 tracking-wider">Fast Seamless Resource Publisher</h4>

                {/* Video Option */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest">
                    <span>1. Lesson Video</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setVideoOption('link')} className={cn("px-2 py-0.5 rounded", videoOption === 'link' ? "bg-white/10 text-white" : "text-white/30")}>Web URL</button>
                      <button type="button" onClick={() => setVideoOption('upload')} className={cn("px-2 py-0.5 rounded", videoOption === 'upload' ? "bg-white/10 text-white" : "text-white/30")}>Upload MP4</button>
                    </div>
                  </div>
                  {videoOption === 'link' ? (
                    <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="YouTube, MP4 web link..." className="w-full bg-black border border-white/5 rounded px-3 py-1.5 text-xs focus:outline-none" />
                  ) : (
                    <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} className="w-full text-xs text-white/40 bg-black border border-white/5 rounded p-1" />
                  )}
                </div>

                {/* PPT Slides Option */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest">
                    <span>2. PPT Slideshow / PDF</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPPTOption('link')} className={cn("px-2 py-0.5 rounded", pptOption === 'link' ? "bg-white/10 text-white" : "text-white/30")}>Web URL</button>
                      <button type="button" onClick={() => setPPTOption('upload')} className={cn("px-2 py-0.5 rounded", pptOption === 'upload' ? "bg-white/10 text-white" : "text-white/30")}>Upload File</button>
                    </div>
                  </div>
                  {pptOption === 'link' ? (
                    <input type="url" value={pptUrl} onChange={(e) => setPPTUrl(e.target.value)} placeholder="Web slides URL..." className="w-full bg-black border border-white/5 rounded px-3 py-1.5 text-xs focus:outline-none" />
                  ) : (
                    <input type="file" accept=".pdf,.ppt,.pptx" onChange={(e) => setPPTFile(e.target.files?.[0] || null)} className="w-full text-xs text-white/40 bg-black border border-white/5 rounded p-1" />
                  )}
                </div>

                {/* Source Code Block */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">3. Custom Code Block Page</span>
                  <div className="grid grid-cols-1 gap-2">
                    <input type="text" value={codeTitle} onChange={(e) => setCodeTitle(e.target.value)} placeholder="File title (e.g. morse_code.ino)" className="w-full bg-black border border-white/5 rounded px-3 py-1.5 text-xs focus:outline-none" />
                    <textarea value={codeContent} onChange={(e) => setCodeContent(e.target.value)} placeholder="Write or paste your code snippet reference..." className="w-full bg-black border border-white/5 rounded px-3 py-1.5 text-xs h-16 font-mono focus:outline-none resize-none" />
                  </div>
                </div>

                {/* External image */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/40 font-black">4. External Diagram Image (Option)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="url" value={extImageUrl} onChange={(e) => setExtImageUrl(e.target.value)} placeholder="HTTP direct image address" className="w-full bg-black border border-white/5 rounded px-3 py-1.5 text-xs focus:outline-none" />
                    <input type="file" accept="image/*" onChange={(e) => setExtImageFile(e.target.files?.[0] || null)} className="w-full text-xs text-white/40 bg-black border border-white/5 rounded p-1" />
                  </div>
                </div>

                {/* External Link */}
                <div className="space-y-2 pt-2 border-t border-white/5 font-black">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">5. External Reference Web Link</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={extLinkTitle} onChange={(e) => setExtLinkTitle(e.target.value)} placeholder="Reference Title" className="w-full bg-black border border-white/5 rounded px-3 py-1.5 text-xs focus:outline-none" />
                    <input type="url" value={extLinkUrl} onChange={(e) => setExtLinkUrl(e.target.value)} placeholder="External HTTP address link" className="w-full bg-black border border-white/5 rounded px-3 py-1.5 text-xs focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* Module Thumbnail optional */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50 block">Module Primary Card Banner Thumbnail</label>
                <label className="flex flex-col items-center justify-center w-full h-24 border border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/[0.02] transition-colors relative overflow-hidden bg-zinc-900 border-opacity-40">
                  {thumbnailFile ? (
                    <img src={URL.createObjectURL(thumbnailFile)} alt="Card Frame" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-2">
                      <Upload size={18} className="mb-1 text-white/20" />
                      <p className="text-[9px] text-white/40 uppercase tracking-widest font-black leading-none">Choose Card Frame</p>
                    </div>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              {/* Components library checklists */}
              <div className="space-y-3 pt-4 border-t border-white/5">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Required Kit Sensors for this Module</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 text-xs">
                  {components.map(comp => {
                    const isSelected = newModuleComponentIds.includes(comp.id);
                    return (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => {
                          setNewModuleComponentIds(prev => 
                            prev.includes(comp.id) ? prev.filter(id => id !== comp.id) : [...prev, comp.id]
                          );
                        }}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border transition-all text-left truncate",
                          isSelected 
                            ? "bg-[#F27D26]/10 border-[#F27D26] text-[#F27D26]" 
                            : "bg-black/30 border-white/5 hover:border-white/20"
                        )}
                      >
                        {comp.imageUrl ? (
                          <img src={comp.imageUrl} alt={comp.name} className="w-5 h-5 rounded object-cover shrink-0" referrerPolicy="no-referrer" />
                        ) : (
                          <LayoutGrid size={12} className="shrink-0" />
                        )}
                        <span className="truncate">{comp.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {isUploading && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                    <span className="text-[#F27D26]">Uploading module bundle...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-white/5 border border-white/10 rounded-full h-1 overflow-hidden">
                    <div className="bg-[#F27D26] h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isUploading}
                className="w-full py-3 h-12 bg-white text-black hover:bg-white/80 rounded-xl font-bold transition-all disabled:opacity-40 uppercase tracking-wider text-xs flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Play size={14} className="fill-black" />}
                Publish Course Module
              </button>
            </form>
          </section>

        </div>
      )}

      {/* EXTRACTED: Edit Course Settings Modal */}
      {editingCourse && (
        <EditCourseModal 
          course={editingCourse}
          onClose={() => setEditingCourse(null)}
          onUpdate={handleUpdateCourse}
        />
      )}

      {/* EXTRACTED: Edit Module Content Modal */}
      {editingModule && (
        <EditModuleModal
          module={editingModule}
          courses={courses}
          components={components}
          onClose={() => setEditingModule(null)}
          onSave={handleUpdateModule}
          uploadFile={uploadFile}
        />
      )}

      {/* EXTRACTED: Component Management dialog */}
      {isComponentRepoOpen && (
        <ManageComponentsModal
          isOpen={isComponentRepoOpen}
          onClose={() => setIsComponentRepoOpen(false)}
          components={components}
          onAddComponent={handleAddComponentToRepo}
          onDeleteComponent={handleDeleteComponentFromRepo}
        />
      )}

      {/* EXTRACTED: Native Module Player dashboard */}
      {viewingModule && (
        <ModulePlayer 
          module={viewingModule}
          components={components}
          onClose={() => setViewingModule(null)}
        />
      )}

      {/* EXTRACTED: Dynamic Multi-Format File Viewer */}
      {viewerConfig && (
        <FileViewer
          url={viewerConfig.url}
          type={viewerConfig.type}
          title={viewerConfig.title}
          onClose={() => setViewerConfig(null)}
        />
      )}

    </div>
  );
}

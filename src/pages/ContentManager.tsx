import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Course, Module, ContentActivation, School, Component, ContentFile } from '../types';
import { Plus, Book, Trash2, Eye, EyeOff, ExternalLink, ChevronRight, LayoutGrid, Upload, FileVideo, FileText as FileIcon, Loader2, Edit2, X, Settings, File as FileGeneric } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import Papa from 'papaparse';
import { GoogleDriveViewer } from '../components/GoogleDriveViewer';
import FileViewer from '../components/FileViewer';

export default function ContentManager() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [activations, setActivations] = useState<ContentActivation[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  
  // Admin form states
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseGrade, setNewCourseGrade] = useState(1);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleDescription, setNewModuleDescription] = useState('');
  const [newModuleFiles, setNewModuleFiles] = useState<{ file: File; type: 'video' | 'pdf' | 'ppt' | 'image' | 'doc' }[]>([]);
  const [newModuleDriveUrl, setNewModuleDriveUrl] = useState('');
  const [newModuleComponentIds, setNewModuleComponentIds] = useState<string[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  
  // File upload states
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isBulkImporting, setIsBulkImporting] = useState(false);

  // Edit states
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourseTitle, setEditCourseTitle] = useState('');
  const [editCourseGrade, setEditCourseGrade] = useState(1);

  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [viewingModule, setViewingModule] = useState<Module | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState('');
  const [editModuleDescription, setEditModuleDescription] = useState('');
  const [editModuleDriveUrl, setEditModuleDriveUrl] = useState('');
  const [editModuleThumbnailUrl, setEditModuleThumbnailUrl] = useState('');
  const [editModuleThumbnailFile, setEditModuleThumbnailFile] = useState<File | null>(null);
  const [editModuleComponentIds, setEditModuleComponentIds] = useState<string[]>([]);
  const [editModuleFiles, setEditModuleFiles] = useState<ContentFile[]>([]);
  const [newFilesToUpload, setNewFilesToUpload] = useState<{ file: File; type: 'video' | 'pdf' | 'ppt' | 'image' | 'doc' }[]>([]);
  
  // Component Repository states
  const [isComponentRepoOpen, setIsComponentRepoOpen] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompFile, setNewCompFile] = useState<File | null>(null);
  const [isUploadingComp, setIsUploadingComp] = useState(false);
  
  // Viewer state
  const [viewerConfig, setViewerConfig] = useState<{ url: string; type: 'video' | 'pdf' | 'ppt' | 'image' | 'doc'; title: string } | null>(null);
  
  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editModuleCourseId, setEditModuleCourseId] = useState('');
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);

  useEffect(() => {
    console.log("Current User Profile:", profile);
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

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle) return;
    try {
      await addDoc(collection(db, 'courses'), {
        title: newCourseTitle,
        grade: Number(newCourseGrade),
        description: `Robotics curriculum for Grade ${newCourseGrade}`
      });
      setNewCourseTitle('');
      toast.success('Course added successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'courses');
    }
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    console.log(`Starting upload to: ${path}`);
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error) => {
          console.error(`Upload error for ${path}:`, error);
          reject(error);
        }, 
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            console.log(`Upload complete for ${path}. URL: ${downloadURL}`);
            resolve(downloadURL);
          });
        }
      );
    });
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle || !selectedCourseId) return;
    
    setIsUploading(true);
    try {
      let thumbnailUrl = '';
      if (thumbnailFile) {
        const ext = thumbnailFile.name.split('.').pop();
        thumbnailUrl = await uploadFile(thumbnailFile, `modules/${selectedCourseId}/${newModuleTitle}_thumb_${Date.now()}.${ext}`);
      }

      const uploadedFiles: ContentFile[] = [];
      for (const item of newModuleFiles) {
        const ext = item.file.name.split('.').pop();
        const url = await uploadFile(item.file, `modules/${selectedCourseId}/${newModuleTitle}_${item.type}_${Date.now()}.${ext}`);
        uploadedFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          name: item.file.name,
          url,
          type: item.type
        });
      }

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

      console.log("Adding module to Firestore:", moduleData);
      await addDoc(collection(db, 'modules'), moduleData);

      setNewModuleTitle('');
      setNewModuleDescription('');
      setNewModuleDriveUrl('');
      setNewModuleComponentIds([]);
      setNewModuleFiles([]);
      setThumbnailFile(null);
      setUploadProgress(0);
      toast.success('Module added successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'modules');
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkImport = async (file: File) => {
    setIsBulkImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as any[];
          let importedCount = 0;

          // First pass: Create all courses
          const courseTitles = new Set(data.map(row => row.courseTitle || row.title || row['Course Name']).filter(Boolean));
          for (const title of courseTitles) {
            const existing = courses.find(c => c.title.toLowerCase() === (title as string).toLowerCase());
            if (!existing) {
              const row = data.find(r => (r.courseTitle || r.title || r['Course Name']) === title);
              await addDoc(collection(db, 'courses'), {
                title: title,
                grade: Number(row?.grade || row?.Grade) || 1,
                description: row?.description || row?.Description || `Robotics curriculum for Grade ${row?.grade || row?.Grade || 1}`
              });
              importedCount++;
            }
          }

          // Second pass: Create modules
          for (const row of data) {
            const moduleTitle = row.moduleTitle || row.title || row['Module Name'];
            const courseTitle = row.courseTitle || row['Course Name'];
            
            if (moduleTitle && courseTitle) {
              // Find course by title (including newly created ones)
              const course = courses.find(c => c.title.toLowerCase() === courseTitle.toLowerCase());
              if (course) {
                const files: ContentFile[] = [];
                const videoUrl = row.videoUrl || row.videoLink || row['Video Link'];
                const pptUrl = row.pptUrl || row.pptLink || row['PPT Link'];
                
                if (videoUrl) {
                  files.push({ id: Math.random().toString(36).substr(2, 9), name: 'Video Content', url: videoUrl, type: 'video' });
                }
                if (pptUrl) {
                  files.push({ id: Math.random().toString(36).substr(2, 9), name: 'PPT Content', url: pptUrl, type: 'ppt' });
                }

                await addDoc(collection(db, 'modules'), {
                  title: moduleTitle,
                  courseId: course.id,
                  description: row.description || row.Description || '',
                  driveUrl: row.driveUrl || row.driveLink || row['Drive Link'] || '',
                  files: files,
                  isVisible: true
                });
                importedCount++;
              }
            }
          }
          toast.success(`Successfully processed ${importedCount} items`);
        } catch (error) {
          console.error("Bulk import failed", error);
          toast.error('Bulk import failed. Check console for details.');
        } finally {
          setIsBulkImporting(false);
        }
      },
      error: (error) => {
        console.error("CSV parsing failed", error);
        toast.error('CSV parsing failed');
        setIsBulkImporting(false);
      }
    });
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
    const newVisibility = module.isVisible === false; // If currently false, set to true. If true/undefined, set to false.
    try {
      await updateDoc(doc(db, 'modules', module.id), {
        isVisible: newVisibility
      });
      toast.success(newVisibility ? 'Module visible globally' : 'Module hidden globally');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `modules/${module.id}`);
    }
  };

  const handleEditModule = (module: Module) => {
    setEditingModule(module);
    setEditModuleTitle(module.title);
    setEditModuleDescription(module.description || '');
    setEditModuleDriveUrl(module.driveUrl || '');
    setEditModuleThumbnailUrl(module.thumbnailUrl || '');
    setEditModuleCourseId(module.courseId);
    setEditModuleThumbnailFile(null);
    setEditModuleComponentIds(module.componentIds || []);
    setEditModuleFiles(module.files || []);
    setNewFilesToUpload([]);
  };

  const handleUpdateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModule || !editModuleTitle) return;

    setIsUploading(true);
    try {
      let thumbnailUrl = editModuleThumbnailUrl;
      if (editModuleThumbnailFile) {
        const ext = editModuleThumbnailFile.name.split('.').pop();
        thumbnailUrl = await uploadFile(editModuleThumbnailFile, `modules/${editModuleCourseId}/${editModuleTitle}_thumb_${Date.now()}.${ext}`);
      }

      const uploadedFiles: ContentFile[] = [...editModuleFiles];
      for (const item of newFilesToUpload) {
        const ext = item.file.name.split('.').pop();
        const url = await uploadFile(item.file, `modules/${editModuleCourseId}/${editModuleTitle}_${item.type}_${Date.now()}.${ext}`);
        uploadedFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          name: item.file.name,
          url,
          type: item.type
        });
      }

      await updateDoc(doc(db, 'modules', editingModule.id), {
        title: editModuleTitle,
        description: editModuleDescription,
        driveUrl: editModuleDriveUrl,
        courseId: editModuleCourseId,
        thumbnailUrl: thumbnailUrl,
        componentIds: editModuleComponentIds,
        files: uploadedFiles
      });
      setEditingModule(null);
      toast.success('Module updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `modules/${editingModule.id}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTransferModule = async (moduleId: string, targetCourseId: string) => {
    try {
      await updateDoc(doc(db, 'modules', moduleId), {
        courseId: targetCourseId
      });
      toast.success('Module transferred successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `modules/${moduleId}`);
    }
  };

  const handleCreateComponent = async () => {
    if (!newCompName) return;
    
    setIsUploadingComp(true);
    try {
      let imageUrl = '';
      if (newCompFile) {
        imageUrl = await uploadFile(newCompFile, `components/${Date.now()}_${newCompFile.name}`);
      }
      
      await addDoc(collection(db, 'components'), {
        name: newCompName,
        imageUrl: imageUrl || undefined
      });
      
      setNewCompName('');
      setNewCompFile(null);
      toast.success('Component added to repository');
    } catch (error) {
      toast.error('Failed to create component');
    } finally {
      setIsUploadingComp(false);
    }
  };

  const handleToggleModuleComponent = (compId: string, isEditing: boolean) => {
    if (isEditing) {
      setEditModuleComponentIds(prev => 
        prev.includes(compId) ? prev.filter(id => id !== compId) : [...prev, compId]
      );
    } else {
      setNewModuleComponentIds(prev => 
        prev.includes(compId) ? prev.filter(id => id !== compId) : [...prev, compId]
      );
    }
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setEditCourseTitle(course.title);
    setEditCourseGrade(course.grade);
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse || !editCourseTitle) return;

    try {
      await updateDoc(doc(db, 'courses', editingCourse.id), {
        title: editCourseTitle,
        grade: Number(editCourseGrade),
        description: `Robotics curriculum for Grade ${editCourseGrade}`
      });
      setEditingCourse(null);
      toast.success('Course updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `courses/${editingCourse.id}`);
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    const moduleCount = modules.filter(m => m.courseId === course.id).length;
    if (moduleCount > 0) {
      toast.error(`Cannot delete course with ${moduleCount} modules. Delete modules first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete course "${course.title}"?`)) return;

    try {
      await deleteDoc(doc(db, 'courses', course.id));
      toast.success('Course deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `courses/${course.id}`);
    }
  };

  const handleDeleteModule = async (module: Module) => {
    if (!window.confirm(`Are you sure you want to delete "${module.title}"?`)) return;

    try {
      // Delete files from storage if they exist
      const filesToDelete = [...(module.files || [])];
      if (module.thumbnailUrl) {
        filesToDelete.push({ id: 'thumb', name: 'thumbnail', url: module.thumbnailUrl, type: 'image' });
      }
      
      for (const file of filesToDelete) {
        if (file.url && file.url.includes('firebasestorage.googleapis.com')) {
          try {
            const fileRef = ref(storage, file.url);
            await deleteObject(fileRef);
          } catch (e) { 
            console.error(`Error deleting file ${file.name}:`, e); 
          }
        }
      }

      await deleteDoc(doc(db, 'modules', module.id));
      
      // Manually update local state to ensure it disappears immediately even if onSnapshot is slow
      setModules(prev => prev.filter(m => m.id !== module.id));
      
      toast.success('Module deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `modules/${module.id}`);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-bold tracking-tight">Curriculum Management</h2>
            {profile?.role === 'admin' && (
              <span className="px-2 py-1 bg-[#F27D26]/20 text-[#F27D26] text-[10px] font-black uppercase tracking-widest rounded border border-[#F27D26]/30">
                Admin Mode
              </span>
            )}
          </div>
          <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Manage courses and module activations</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
          {profile?.role === 'admin' && (
            <button 
              onClick={() => setIsComponentRepoOpen(true)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 text-white/40 hover:text-white hover:bg-white/5"
            >
              <Settings size={14} /> Manage Components
            </button>
          )}
          <button 
            onClick={() => setViewMode('grid')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2",
              viewMode === 'grid' ? "bg-[#F27D26] text-white" : "text-white/40 hover:text-white"
            )}
          >
            <LayoutGrid size={14} /> Grid
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2",
              viewMode === 'list' ? "bg-[#F27D26] text-white" : "text-white/40 hover:text-white"
            )}
          >
            <Plus size={14} className="rotate-45" /> List
          </button>
        </div>
      </header>

      {/* Edit Course Modal */}
      <AnimatePresence>
        {editingCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-xl font-bold">Edit Course</h3>
                <button onClick={() => setEditingCourse(null)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleUpdateCourse} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Course Title</label>
                  <input
                    type="text"
                    required
                    value={editCourseTitle}
                    onChange={(e) => setEditCourseTitle(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Grade (1-12)</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={editCourseGrade}
                    onChange={(e) => setEditCourseGrade(Number(e.target.value))}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-[#F27D26] text-white rounded-xl font-bold hover:bg-[#d66a1e] transition-colors">
                  Save Changes
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Module Modal */}
      <AnimatePresence>
        {editingModule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-xl font-bold">Edit Module</h3>
                <button onClick={() => setEditingModule(null)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <form onSubmit={handleUpdateModule} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Module Title</label>
                    <input
                      type="text"
                      required
                      value={editModuleTitle}
                      onChange={(e) => setEditModuleTitle(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Description</label>
                    <textarea
                      value={editModuleDescription}
                      onChange={(e) => setEditModuleDescription(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26] h-24 resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Google Drive URL</label>
                    <input
                      type="url"
                      value={editModuleDriveUrl}
                      onChange={(e) => setEditModuleDriveUrl(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Transfer to Course</label>
                    <select
                      value={editModuleCourseId}
                      onChange={(e) => setEditModuleCourseId(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                    >
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>Grade {c.grade}: {c.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Module Files</label>
                    <div className="space-y-2">
                      {editModuleFiles.map((file, idx) => (
                        <div key={file.id} className="flex items-center gap-3 p-3 bg-black/40 rounded-xl border border-white/5">
                          <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-white/40">
                            {file.type === 'video' ? <FileVideo size={14} /> : <FileGeneric size={14} />}
                          </div>
                          <span className="text-xs font-medium flex-1 truncate">{file.name}</span>
                          <button 
                            type="button"
                            onClick={() => setEditModuleFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 text-white/20 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {newFilesToUpload.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-[#F27D26]/10 rounded-xl border border-[#F27D26]/20">
                          <div className="w-8 h-8 rounded bg-[#F27D26]/20 flex items-center justify-center text-[#F27D26]">
                            <Upload size={14} />
                          </div>
                          <span className="text-xs font-medium flex-1 truncate">{item.file.name} (New)</span>
                          <button 
                            type="button"
                            onClick={() => setNewFilesToUpload(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 text-[#F27D26]/40 hover:text-red-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center justify-center gap-2 p-3 bg-white/5 border border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                        <FileVideo size={14} className="text-white/40" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Add Video</span>
                        <input type="file" className="hidden" accept="video/*" onChange={(e) => e.target.files?.[0] && setNewFilesToUpload(prev => [...prev, { file: e.target.files![0], type: 'video' }])} />
                      </label>
                      <label className="flex items-center justify-center gap-2 p-3 bg-white/5 border border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                        <FileGeneric size={14} className="text-white/40" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Add PDF/PPT</span>
                        <input type="file" className="hidden" accept=".pdf,.ppt,.pptx" onChange={(e) => e.target.files?.[0] && setNewFilesToUpload(prev => [...prev, { file: e.target.files![0], type: 'pdf' }])} />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Components & Equipment (Select from Repository)</label>
                    <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1">
                      {components.map(comp => (
                        <button
                          key={comp.id}
                          type="button"
                          onClick={() => handleToggleModuleComponent(comp.id, true)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                            editModuleComponentIds.includes(comp.id) 
                              ? "bg-[#F27D26]/10 border-[#F27D26] text-[#F27D26]" 
                              : "bg-black/40 border-white/5 text-white/60 hover:border-white/20"
                          )}
                        >
                          {comp.imageUrl ? (
                            <img src={comp.imageUrl} alt={comp.name} className="w-8 h-8 rounded object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center">
                              <LayoutGrid size={14} />
                            </div>
                          )}
                          <span className="text-xs font-medium truncate">{comp.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button type="submit" className="w-full py-3 bg-[#F27D26] text-white rounded-xl font-bold hover:bg-[#d66a1e] transition-colors mt-6">
                    Save Module Changes
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Component Repository Modal */}
      <AnimatePresence>
        {isComponentRepoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-xl font-bold">Component Repository</h3>
                <button onClick={() => setIsComponentRepoOpen(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 border-b border-white/5 bg-white/5">
                <div className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">New Component Name</label>
                    <input
                      type="text"
                      value={newCompName}
                      onChange={(e) => setNewCompName(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                      placeholder="e.g. Ultrasonic Sensor"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Image</label>
                    <label className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5 overflow-hidden">
                      {newCompFile ? (
                        <img src={URL.createObjectURL(newCompFile)} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Upload size={16} className="text-white/20" />
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => setNewCompFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <button 
                    onClick={handleCreateComponent}
                    disabled={isUploadingComp || !newCompName}
                    className="bg-[#F27D26] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#d66a1e] transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isUploadingComp ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Add
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {components.map(comp => (
                    <div key={comp.id} className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center gap-3 group">
                      {comp.imageUrl ? (
                        <img src={comp.imageUrl} alt={comp.name} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white/20">
                          <LayoutGrid size={16} />
                        </div>
                      )}
                      <span className="text-xs font-medium flex-1 truncate">{comp.name}</span>
                      <button 
                        onClick={async () => {
                          if (window.confirm(`Delete ${comp.name} from repository?`)) {
                            try {
                              await deleteDoc(doc(db, 'components', comp.id));
                              toast.success('Component deleted');
                            } catch (e) { toast.error('Failed to delete'); }
                          }
                        }}
                        className="p-1.5 text-white/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {(profile?.role === 'admin' || profile?.role === 'teacher') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Book className="text-[#F27D26]" size={20} />
                {profile?.role === 'admin' ? 'Add New Course' : 'Course Management'}
              </h3>
              {(profile?.role === 'admin' || profile?.role === 'teacher') && (
                <label className="cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-white/10 transition-colors flex items-center gap-2">
                  <Upload size={12} />
                  {isBulkImporting ? 'Importing...' : 'Bulk Import CSV'}
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && handleBulkImport(e.target.files[0])}
                    disabled={isBulkImporting}
                  />
                </label>
              )}
            </div>
            {profile?.role === 'admin' ? (
              <form onSubmit={handleAddCourse} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Course Title</label>
                    <input
                      type="text"
                      value={newCourseTitle}
                      onChange={(e) => setNewCourseTitle(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                      placeholder="e.g. Advanced Robotics"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Grade (1-12)</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={newCourseGrade}
                      onChange={(e) => setNewCourseGrade(Number(e.target.value))}
                      className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-3 bg-[#F27D26] text-white rounded-xl font-bold hover:bg-[#d66a1e] transition-colors">
                  Create Course
                </button>
              </form>
            ) : (
              <p className="text-white/40 text-sm">Select a course from the list below to manage its modules.</p>
            )}
          </section>

          <section className="bg-[#151619] border border-white/5 rounded-2xl p-8">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <LayoutGrid className="text-[#F27D26]" size={20} />
              Add Module to Course
            </h3>
            <form onSubmit={handleAddModule} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Select Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                >
                  <option value="">Select Course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>Grade {c.grade}: {c.title}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Module Title</label>
                <input
                  type="text"
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                  placeholder="e.g. Introduction to Sensors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Description</label>
                <textarea
                  value={newModuleDescription}
                  onChange={(e) => setNewModuleDescription(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26] h-20 resize-none"
                  placeholder="Module description..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Google Drive URL (Optional)</label>
                <input
                  type="url"
                  value={newModuleDriveUrl}
                  onChange={(e) => setNewModuleDriveUrl(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                  placeholder="Paste Google Docs/Drive link here"
                />
                <p className="text-[8px] text-white/30 italic">Note: Google Docs will be embedded automatically.</p>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Module Files</label>
                <div className="space-y-2">
                  {newModuleFiles.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-[#F27D26]/10 rounded-xl border border-[#F27D26]/20">
                      <div className="w-8 h-8 rounded bg-[#F27D26]/20 flex items-center justify-center text-[#F27D26]">
                        {item.type === 'video' ? <FileVideo size={14} /> : <FileGeneric size={14} />}
                      </div>
                      <span className="text-xs font-medium flex-1 truncate">{item.file.name}</span>
                      <button 
                        type="button"
                        onClick={() => setNewModuleFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-[#F27D26]/40 hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-center gap-2 p-3 bg-white/5 border border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                    <FileVideo size={14} className="text-white/40" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Add Video</span>
                    <input type="file" className="hidden" accept="video/*" onChange={(e) => e.target.files?.[0] && setNewModuleFiles(prev => [...prev, { file: e.target.files![0], type: 'video' }])} />
                  </label>
                  <label className="flex items-center justify-center gap-2 p-3 bg-white/5 border border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                    <FileGeneric size={14} className="text-white/40" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Add PDF/PPT</span>
                    <input type="file" className="hidden" accept=".pdf,.ppt,.pptx" onChange={(e) => e.target.files?.[0] && setNewModuleFiles(prev => [...prev, { file: e.target.files![0], type: 'pdf' }])} />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50 flex items-center gap-2">
                  <LayoutGrid size={12} /> Module Thumbnail (Optional)
                </label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-[#F27D26]/50 hover:bg-white/5 transition-all overflow-hidden relative">
                  {thumbnailFile ? (
                    <img src={URL.createObjectURL(thumbnailFile)} alt="Thumbnail Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload size={24} className="mb-2 text-white/20" />
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Upload Thumbnail</p>
                    </div>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              {isUploading && (
                <div className="space-y-2">
                   <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-[#F27D26]">Uploading Content...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <motion.div 
                      className="bg-[#F27D26] h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-white/5">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Components & Equipment (Select from Repository)</label>
                <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1">
                  {components.map(comp => (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => handleToggleModuleComponent(comp.id, false)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                        newModuleComponentIds.includes(comp.id) 
                          ? "bg-[#F27D26]/10 border-[#F27D26] text-[#F27D26]" 
                          : "bg-black/40 border-white/5 text-white/60 hover:border-white/20"
                      )}
                    >
                      {comp.imageUrl ? (
                        <img src={comp.imageUrl} alt={comp.name} className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center">
                          <LayoutGrid size={14} />
                        </div>
                      )}
                      <span className="text-xs font-medium truncate">{comp.name}</span>
                    </button>
                  ))}
                  {components.length === 0 && (
                    <p className="col-span-2 text-center py-4 text-white/20 text-[10px] uppercase tracking-widest font-bold border border-dashed border-white/10 rounded-xl">
                      No components in repository
                    </p>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isUploading}
                className="w-full py-3 bg-white text-black rounded-xl font-bold hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : 'Add Module'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Module Viewer Modal */}
      <AnimatePresence>
        {viewingModule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="text-2xl font-bold">{viewingModule.title}</h3>
                  <p className="text-xs text-white/40 uppercase tracking-widest font-bold mt-1">
                    {courses.find(c => c.id === viewingModule.courseId)?.title}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {(profile?.role === 'admin' || profile?.role === 'teacher') && (
                    <button 
                      onClick={() => {
                        handleEditModule(viewingModule);
                        setViewingModule(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-[#F27D26] text-white rounded-xl font-bold hover:bg-[#d66a1e] transition-colors"
                    >
                      <Edit2 size={16} /> Edit
                    </button>
                  )}
                  <button onClick={() => setViewingModule(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all">
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {viewingModule.description && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-white/30">Description</h4>
                    <p className="text-white/70 leading-relaxed">{viewingModule.description}</p>
                  </div>
                )}

                {viewingModule.driveUrl && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-white/30">Google Drive Resource</h4>
                    <GoogleDriveViewer url={viewingModule.driveUrl} title={viewingModule.title} />
                  </div>
                )}

                {(viewingModule.files || []).length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-white/30">Module Files</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {viewingModule.files.map(file => (
                        <button
                          key={file.id}
                          onClick={() => setViewerConfig({ url: file.url, type: file.type as any, title: file.name })}
                          className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-left group"
                        >
                          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-[#F27D26] transition-colors">
                            {file.type === 'video' ? <FileVideo size={24} /> : <FileIcon size={24} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{file.name}</p>
                            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mt-0.5">{file.type}</p>
                          </div>
                          <ChevronRight size={16} className="text-white/20 group-hover:text-white transition-all" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(viewingModule.componentIds || []).length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-white/30">Required Components</h4>
                    <div className="flex flex-wrap gap-3">
                      {viewingModule.componentIds?.map(compId => {
                        const comp = components.find(c => c.id === compId);
                        if (!comp) return null;
                        return (
                          <div key={compId} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                            {comp.imageUrl ? (
                              <img src={comp.imageUrl} alt={comp.name} className="w-6 h-6 rounded object-cover" />
                            ) : (
                              <LayoutGrid size={12} className="text-white/20" />
                            )}
                            <span className="text-xs font-medium">{comp.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* File Viewer Modal */}
      {viewerConfig && (
        <FileViewer
          url={viewerConfig.url}
          type={viewerConfig.type}
          title={viewerConfig.title}
          onClose={() => setViewerConfig(null)}
        />
      )}

      <div className="space-y-6">
        {courses.sort((a, b) => a.grade - b.grade).map((course) => {
          const courseModules = modules
            .filter(m => m.courseId === course.id)
            .filter(m => profile?.role === 'admin' || m.isVisible !== false);

          if (courseModules.length === 0 && profile?.role !== 'admin') return null;

          return (
            <div 
              key={course.id} 
              className="bg-[#151619] border border-white/5 rounded-2xl overflow-hidden"
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('border-[#F27D26]/50', 'bg-white/5');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('border-[#F27D26]/50', 'bg-white/5');
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-[#F27D26]/50', 'bg-white/5');
              if (draggedModuleId) {
                handleTransferModule(draggedModuleId, course.id);
                setDraggedModuleId(null);
              }
            }}
          >
            <div className="p-6 bg-white/5 border-b border-white/5 flex justify-between items-center">
              <div>
                <h4 className="text-xl font-bold">{course.title}</h4>
                <p className="text-xs text-white/40 uppercase tracking-widest font-bold mt-1">Grade {course.grade} Curriculum</p>
              </div>
              <div className="flex items-center gap-3">
                {profile?.role === 'admin' && (
                  <div className="flex items-center gap-1 mr-4 border-r border-white/10 pr-4">
                    <button 
                      onClick={() => handleEditCourse(course)}
                      className="p-2 text-white/40 hover:text-[#F27D26] transition-colors"
                      title="Edit Course"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteCourse(course)}
                      className="p-2 text-white/40 hover:text-red-500 transition-colors"
                      title="Delete Course"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
                <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  {modules.filter(m => m.courseId === course.id).length} Modules
                </span>
              </div>
            </div>
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
                    draggable
                    onDragStart={() => setDraggedModuleId(module.id)}
                    onDragEnd={() => setDraggedModuleId(null)}
                    className={cn(
                      "bg-black/40 border border-white/5 rounded-xl group relative cursor-pointer hover:border-[#F27D26]/30 transition-all",
                      viewMode === 'grid' ? "p-4" : "p-3 flex items-center gap-4"
                    )}
                    onClick={() => setViewingModule(module)}
                  >
                    {module.thumbnailUrl && (
                      <div className={cn(
                        "rounded-lg overflow-hidden border border-white/10",
                        viewMode === 'grid' ? "aspect-video mb-4" : "w-16 h-10 flex-shrink-0"
                      )}>
                        <img src={module.thumbnailUrl} alt={module.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <div className={cn("flex-1", viewMode === 'list' && "flex items-center justify-between")}>
                      <div>
                        <h5 className="font-bold text-sm">{module.title}</h5>
                        {viewMode === 'grid' && (
                          <p className="text-[10px] text-white/40 line-clamp-2 mb-4">{module.description || 'No description provided.'}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {profile?.role === 'admin' && (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditModule(module);
                              }}
                              className="p-2 text-white/40 hover:text-[#F27D26] transition-colors"
                              title="Edit Module"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteModule(module);
                              }}
                              className="p-2 text-white/40 hover:text-red-500 transition-colors"
                              title="Delete Module"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {(profile?.role === 'admin' || profile?.role === 'teacher') && (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleVisibility(module);
                              }}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                module.isVisible !== false ? "text-green-400 hover:bg-green-400/10" : "text-white/20 hover:text-white hover:bg-white/5"
                              )}
                              title={module.isVisible !== false ? "Visible Globally" : "Hidden Globally"}
                            >
                              {module.isVisible !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleActivation(module.id);
                              }}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                isActivated ? "bg-[#F27D26]/10 text-[#F27D26]" : "bg-white/5 text-white/20 hover:text-white"
                              )}
                              title={isActivated ? "Activated for your school" : "Deactivated for your school"}
                            >
                              <LayoutGrid size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {viewMode === 'grid' && (
                      <div className="flex flex-wrap items-center gap-3 mt-auto" onClick={(e) => e.stopPropagation()}>
                        {(module.files || []).map(file => (
                          <button
                            key={file.id}
                            onClick={() => setViewerConfig({ url: file.url, type: file.type as any, title: file.name })}
                            className="flex items-center gap-2 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all group"
                          >
                            {file.type === 'video' ? <FileVideo size={10} className="text-[#F27D26]" /> : <FileGeneric size={10} className="text-blue-400" />}
                            <span className="text-[8px] font-bold uppercase tracking-widest text-white/60 group-hover:text-white">{file.name}</span>
                          </button>
                        ))}
                        {module.driveUrl && (
                          <button
                            onClick={() => setViewerConfig({ url: module.driveUrl!, type: 'doc', title: module.title })}
                            className="flex items-center gap-2 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all group"
                          >
                            <ExternalLink size={10} className="text-green-400" />
                            <span className="text-[8px] font-bold uppercase tracking-widest text-white/60 group-hover:text-white">Drive</span>
                          </button>
                        )}
                        {isActivated && (
                          <span className="text-[8px] uppercase font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded ml-auto">Active</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { Project, Course, Submission, UserProfile, Component, ContentFile } from '../types';
import { useAuth } from '../AuthContext';
import { Plus, ClipboardList, ExternalLink, Camera, Trash2, CheckCircle, Star, X, MessageSquare, Send, Share2, FileVideo, Upload, Loader2, Edit2, Eye, EyeOff, Info, LayoutGrid, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import FileViewer from '../components/FileViewer';

import { useSearchParams } from 'react-router-dom';

export default function Projects() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [students, setStudents] = useState<Record<string, UserProfile>>({});
  const [components, setComponents] = useState<Component[]>([]);
  
  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDriveUrl, setNewDriveUrl] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [projectFiles, setProjectFiles] = useState<File[]>([]);
  const [projectImages, setProjectImages] = useState<File[]>([]);
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [reviewingSubmission, setReviewingSubmission] = useState<Submission | null>(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  // Edit/View states
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [viewerConfig, setViewerConfig] = useState<{ url: string; type: 'video' | 'pdf' | 'ppt' | 'image' | 'doc'; title: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    
    const coursesQ = profile.role === 'teacher' 
      ? query(collection(db, 'courses'), where('teacherId', '==', profile.uid))
      : query(collection(db, 'courses'), where('schoolId', 'in', profile.schoolIds || ['']));

    const unsubscribeCourses = onSnapshot(coursesQ, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    });

    const unsubscribeProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    });

    const subQ = profile.role === 'student'
      ? query(collection(db, 'submissions'), where('studentId', '==', profile.uid))
      : collection(db, 'submissions');

    const unsubscribeSubmissions = onSnapshot(subQ, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      setSubmissions(subs);

      // Check for review parameter
      const reviewId = searchParams.get('review');
      if (reviewId && profile.role === 'teacher') {
        const subToReview = subs.find(s => s.id === reviewId);
        if (subToReview) setReviewingSubmission(subToReview);
      }
    });

    const unsubStudents = onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), (snapshot) => {
      const studentMap: Record<string, UserProfile> = {};
      snapshot.docs.forEach(doc => {
        studentMap[doc.id] = doc.data() as UserProfile;
      });
      setStudents(studentMap);
    });

    const unsubComponents = onSnapshot(collection(db, 'components'), (snapshot) => {
      setComponents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Component)));
    });

    return () => {
      unsubscribeCourses();
      unsubscribeProjects();
      unsubscribeSubmissions();
      unsubStudents();
      unsubComponents();
    };
  }, [profile, searchParams]);

  const uploadFileWithProgress = async (file: File, path: string): Promise<string> => {
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
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          console.log(`Upload complete for ${path}. URL: ${url}`);
          resolve(url);
        }
      );
    });
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !selectedCourse) return;
    
    setIsCreatingProject(true);
    setUploadProgress(0);
    
    try {
      const uploadedFiles: ContentFile[] = [];
      for (const file of projectFiles) {
        const url = await uploadFileWithProgress(file, `projects/files/${Date.now()}_${file.name}`);
        uploadedFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          url,
          type: file.type.startsWith('video/') ? 'video' : 'pdf'
        });
      }

      const uploadedProjectImages: string[] = [];
      for (const file of projectImages) {
        const url = await uploadFileWithProgress(file, `projects/images/${Date.now()}_${file.name}`);
        uploadedProjectImages.push(url);
      }

      await addDoc(collection(db, 'projects'), {
        title: newTitle,
        description: newDesc,
        courseId: selectedCourse,
        driveUrl: newDriveUrl,
        files: uploadedFiles,
        componentIds: selectedComponentIds,
        projectImages: uploadedProjectImages,
        isVisible: true,
        createdAt: serverTimestamp()
      });

      setNewTitle('');
      setNewDesc('');
      setNewDriveUrl('');
      setSelectedCourse('');
      setProjectFiles([]);
      setProjectImages([]);
      setSelectedComponentIds([]);
      toast.success('Project created successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    } finally {
      setIsCreatingProject(false);
      setUploadProgress(0);
    }
  };

  const handleFileUpload = async (projectId: string, file: File) => {
    if (!profile) return;
    setUploading(projectId);
    setUploadProgress(0);
    
    try {
      const storageRef = ref(storage, `submissions/${profile.uid}/${projectId}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error) => {
          console.error("Upload failed", error);
          toast.error(`Upload failed: ${error.message}`);
          setUploading(null);
        }, 
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          const isVideo = file.type.startsWith('video/');
          
          await addDoc(collection(db, 'submissions'), {
            projectId,
            studentId: profile.uid,
            [isVideo ? 'videoUrl' : 'photoUrl']: url,
            timestamp: new Date().toISOString(),
            status: 'pending'
          });
          
          toast.success('Project submitted! +50 XP');
          setUploading(null);
          setUploadProgress(0);
        }
      );
    } catch (error) {
      console.error("Submission failed", error);
      toast.error(`Submission failed: ${error instanceof Error ? error.message : String(error)}`);
      setUploading(null);
    }
  };

  const handleReview = async () => {
    if (!reviewingSubmission || !reviewingSubmission.id) return;
    try {
      await updateDoc(doc(db, 'submissions', reviewingSubmission.id), {
        rating,
        feedback,
        status: 'reviewed',
        reviewedAt: serverTimestamp()
      });
      setReviewingSubmission(null);
      setRating(0);
      setFeedback('');
      toast.success('Review submitted');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'submissions');
    }
  };

  const shareProject = (platform: string) => {
    const text = `Check out my robotics project on FunScholar! 🤖\n\n${window.location.origin}`;
    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin)}`, '_blank');
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setNewTitle(project.title);
    setNewDesc(project.description);
    setNewDriveUrl(project.driveUrl || '');
    setSelectedCourse(project.courseId);
    setSelectedComponentIds(project.componentIds || []);
    setProjectFiles([]);
    setProjectImages([]);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !newTitle || !selectedCourse) return;

    setIsCreatingProject(true);
    setUploadProgress(0);

    try {
      const updatedFiles: ContentFile[] = [...(editingProject.files || [])];
      for (const file of projectFiles) {
        const url = await uploadFileWithProgress(file, `projects/files/${Date.now()}_${file.name}`);
        updatedFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          url,
          type: file.type.startsWith('video/') ? 'video' : 'pdf'
        });
      }

      const uploadedProjectImages: string[] = [...(editingProject.projectImages || [])];
      for (const file of projectImages) {
        const url = await uploadFileWithProgress(file, `projects/images/${Date.now()}_${file.name}`);
        uploadedProjectImages.push(url);
      }

      await updateDoc(doc(db, 'projects', editingProject.id), {
        title: newTitle,
        description: newDesc,
        courseId: selectedCourse,
        driveUrl: newDriveUrl,
        files: updatedFiles,
        componentIds: selectedComponentIds,
        projectImages: uploadedProjectImages
      });

      setEditingProject(null);
      setNewTitle('');
      setNewDesc('');
      setNewDriveUrl('');
      setSelectedCourse('');
      setSelectedComponentIds([]);
      setProjectFiles([]);
      setProjectImages([]);
      toast.success('Project updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${editingProject.id}`);
    } finally {
      setIsCreatingProject(false);
      setUploadProgress(0);
    }
  };

  const toggleVisibility = async (project: Project) => {
    const newVisibility = project.isVisible === false;
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        isVisible: newVisibility
      });
      toast.success(newVisibility ? 'Project visible to students' : 'Project hidden from students');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${project.id}`);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!window.confirm('Are you sure you want to delete this project? All associated files will also be deleted.')) return;
    try {
      // Delete project files from storage
      for (const file of project.files || []) {
        try {
          const fileRef = ref(storage, file.url);
          await deleteObject(fileRef);
        } catch (e) {
          console.warn("Failed to delete project file from storage", e);
        }
      }

      // Delete project images from storage
      for (const imgUrl of project.projectImages || []) {
        try {
          const imgRef = ref(storage, imgUrl);
          await deleteObject(imgRef);
        } catch (e) {
          console.warn("Failed to delete project image from storage", e);
        }
      }

      await deleteDoc(doc(db, 'projects', project.id));
      toast.success('Project and associated files deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${project.id}`);
    }
  };

  const filteredProjects = projects.filter(p => {
    const isCourseAssigned = courses.some(c => c.id === p.courseId);
    if (profile?.role === 'student') {
      return isCourseAssigned && p.isVisible !== false;
    }
    return isCourseAssigned;
  });

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-4xl font-bold tracking-tight">Project Management</h2>
        <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Track robotics projects and submissions</p>
      </header>

      {/* File Viewer */}
      {viewerConfig && (
        <FileViewer 
          url={viewerConfig.url}
          type={viewerConfig.type}
          title={viewerConfig.title}
          onClose={() => setViewerConfig(null)}
        />
      )}

      {/* Project Detail Modal */}
      <AnimatePresence>
        {viewingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#151619] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-3">
                  <Info className="text-[#F27D26]" size={24} />
                  <h3 className="text-xl font-bold">{viewingProject.title}</h3>
                </div>
                <button onClick={() => setViewingProject(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/40">Description</label>
                  <p className="text-white/80 leading-relaxed">{viewingProject.description}</p>
                </div>

                {viewingProject.projectImages && viewingProject.projectImages.length > 0 && (
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/40">Project Gallery</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {viewingProject.projectImages.map((img, idx) => (
                        <div 
                          key={idx} 
                          className="aspect-video bg-black rounded-xl overflow-hidden border border-white/5 cursor-pointer hover:border-[#F27D26]/50 transition-all"
                          onClick={() => setViewerConfig({ url: img, type: 'image', title: `${viewingProject.title} - Image ${idx + 1}` })}
                        >
                          <img src={img} alt="Project" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingProject.components && viewingProject.components.length > 0 && (
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/40">Equipment & Components</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {viewingProject.components.map((comp, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                          {comp.imageUrl ? (
                            <div 
                              className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 cursor-pointer"
                              onClick={() => setViewerConfig({ url: comp.imageUrl!, type: 'image', title: comp.name })}
                            >
                              <img src={comp.imageUrl} alt={comp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-black/40 flex items-center justify-center text-white/20 border border-white/10">
                              <Camera size={20} />
                            </div>
                          )}
                          <div>
                            <p className="font-bold">{comp.name}</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">Component</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingProject.componentIds && viewingProject.componentIds.length > 0 && (
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/40">Equipment & Components (Repository)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {viewingProject.componentIds.map((compId) => {
                        const comp = components.find(c => c.id === compId);
                        if (!comp) return null;
                        return (
                          <div key={compId} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                            {comp.imageUrl ? (
                              <div 
                                className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 cursor-pointer"
                                onClick={() => setViewerConfig({ url: comp.imageUrl!, type: 'image', title: comp.name })}
                              >
                                <img src={comp.imageUrl} alt={comp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-black/40 flex items-center justify-center text-white/20 border border-white/10">
                                <LayoutGrid size={20} />
                              </div>
                            )}
                            <div>
                              <p className="font-bold">{comp.name}</p>
                              <p className="text-[10px] text-white/40 uppercase tracking-widest">Component</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 pt-4 border-t border-white/5">
                  {(viewingProject.files || []).map(file => (
                    <button 
                      key={file.id}
                      onClick={() => setViewerConfig({ url: file.url, type: file.type as any, title: file.name })}
                      className="flex items-center gap-2 bg-[#F27D26] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#d66a1e] transition-all"
                    >
                      {file.type === 'video' ? <FileVideo size={18} /> : <FileText size={18} />}
                      {file.name}
                    </button>
                  ))}
                  {viewingProject.driveUrl && (
                    <button 
                      onClick={() => setViewerConfig({ url: viewingProject.driveUrl!, type: 'doc', title: viewingProject.title })}
                      className="flex items-center gap-2 bg-[#F27D26] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#d66a1e] transition-all"
                    >
                      <ExternalLink size={18} />
                      View Resources (PPT/PDF/DOC)
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Project Modal */}
      <AnimatePresence>
        {editingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-xl font-bold">Edit Project</h3>
                <button onClick={() => setEditingProject(null)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleUpdateProject} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Project Title</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Course</label>
                    <select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Description</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26] h-24 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Google Drive URL</label>
                  <input
                    type="url"
                    value={newDriveUrl}
                    onChange={(e) => setNewDriveUrl(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Components & Equipment (Select from Repository)</label>
                  <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1">
                    {components.map(comp => (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => {
                          setSelectedComponentIds(prev => 
                            prev.includes(comp.id) 
                              ? prev.filter(id => id !== comp.id) 
                              : [...prev, comp.id]
                          );
                        }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                          selectedComponentIds.includes(comp.id) 
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

                <div className="space-y-4">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Project Files (Videos/PDFs)</label>
                  <div className="space-y-2">
                    {(editingProject?.files || []).map(file => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          {file.type === 'video' ? <FileVideo size={16} className="text-[#F27D26]" /> : <FileText size={16} className="text-blue-400" />}
                          <span className="text-sm font-medium">{file.name}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            const updatedFiles = (editingProject.files || []).filter(f => f.id !== file.id);
                            setEditingProject({ ...editingProject, files: updatedFiles });
                          }}
                          className="p-1.5 text-white/20 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      {projectFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-[#F27D26]/10 text-[#F27D26] rounded-full border border-[#F27D26]/20 text-xs">
                          <span>{file.name}</span>
                          <button type="button" onClick={() => setProjectFiles(prev => prev.filter((_, i) => i !== idx))}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <label className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-[#F27D26]/50 transition-all group">
                      <Upload size={24} className="text-white/20 group-hover:text-[#F27D26] transition-colors mb-2" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white/40 group-hover:text-white">Add Project Files</span>
                      <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files) {
                            setProjectFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                          }
                        }} 
                      />
                    </label>
                  </div>
                </div>

                {isCreatingProject && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[#F27D26]">
                      <span>Updating Project...</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                      <div className="bg-[#F27D26] h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isCreatingProject}
                  className="w-full py-4 bg-[#F27D26] text-white rounded-xl font-bold hover:bg-[#d66a1e] transition-colors disabled:opacity-50"
                >
                  {isCreatingProject ? 'Saving...' : 'Update Project'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {profile?.role === 'teacher' && (
        <form onSubmit={handleAddProject} className="bg-[#151619] p-6 rounded-2xl border border-white/5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Project Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
                placeholder="e.g. Line Follower Robot"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Course</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
              >
                <option value="">Select Course</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Google Drive URL</label>
            <input
              type="url"
              value={newDriveUrl}
              onChange={(e) => setNewDriveUrl(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
              placeholder="Link to project resources in Drive"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Description</label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
              placeholder="Project instructions..."
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Project Images (Optional)</label>
              <div className="flex flex-wrap gap-4">
                {projectImages.map((file, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10">
                    <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => setProjectImages(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-red-500"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-[#F27D26]/50 transition-colors">
                  <Camera size={20} className="text-white/20" />
                  <span className="text-[8px] font-bold text-white/20 uppercase mt-1">Add Image</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files) {
                        setProjectImages(prev => [...prev, ...Array.from(e.target.files!)]);
                      }
                    }} 
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Project Files (Videos/PDFs)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {projectFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-[#F27D26]/10 text-[#F27D26] rounded-full border border-[#F27D26]/20 text-xs">
                    <span>{file.name}</span>
                    <button type="button" onClick={() => setProjectFiles(prev => prev.filter((_, i) => i !== idx))}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <label className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-[#F27D26]/50 transition-all group">
                <Upload size={24} className="text-white/20 group-hover:text-[#F27D26] transition-colors mb-2" />
                <span className="text-xs font-bold uppercase tracking-widest text-white/40 group-hover:text-white">Add Project Files</span>
                <input 
                  type="file" 
                  multiple 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files) {
                      setProjectFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }} 
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Components & Equipment (Select from Repository)</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1">
                {components.map(comp => (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => {
                      setSelectedComponentIds(prev => 
                        prev.includes(comp.id) 
                          ? prev.filter(id => id !== comp.id) 
                          : [...prev, comp.id]
                      );
                    }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                      selectedComponentIds.includes(comp.id) 
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
          </div>

          {isCreatingProject && (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[#F27D26]">
                <span>Uploading Project Assets...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                <div className="bg-[#F27D26] h-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isCreatingProject}
            className="bg-[#F27D26] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#d66a1e] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isCreatingProject ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {isCreatingProject ? 'Creating...' : 'Add Project'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-6">
        {filteredProjects.map((project) => {
          const projectSubmissions = submissions.filter(s => s.projectId === project.id);
          const userSubmission = projectSubmissions.find(s => s.studentId === profile?.uid);
          
          return (
            <div key={project.id} className="p-6 bg-[#151619] border border-white/5 rounded-2xl flex flex-col md:flex-row gap-6 group">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="text-[#F27D26]" size={24} />
                    <h3 className="text-xl font-bold">{project.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setViewingProject(project)}
                      className="p-2 text-white/20 hover:text-white transition-colors"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                    {profile?.role === 'teacher' && (
                      <>
                        <button 
                          onClick={() => toggleVisibility(project)}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            project.isVisible !== false ? "text-green-400 hover:bg-green-400/10" : "text-white/20 hover:text-white hover:bg-white/5"
                          )}
                          title={project.isVisible !== false ? "Visible to Students" : "Hidden from Students"}
                        >
                          {project.isVisible !== false ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                        <button 
                          onClick={() => handleEditProject(project)}
                          className="p-2 text-white/20 hover:text-[#F27D26] transition-colors"
                          title="Edit Project"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProject(project)}
                          className="p-2 text-white/20 hover:text-red-500 transition-colors"
                          title="Delete Project"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-white/60 text-sm mb-4 line-clamp-2">{project.description}</p>
                
                {project.componentIds && project.componentIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {project.componentIds.map((compId) => {
                      const comp = components.find(c => c.id === compId);
                      if (!comp) return null;
                      return (
                        <span key={compId} className="px-2 py-0.5 bg-[#F27D26]/10 text-[#F27D26] text-[10px] font-bold rounded border border-[#F27D26]/20">
                          {comp.name}
                        </span>
                      );
                    })}
                  </div>
                )}
                
                <div className="flex flex-wrap items-center gap-4">
                  {(project.files || []).map(file => (
                    <button
                      key={file.id}
                      onClick={() => setViewerConfig({ url: file.url, type: file.type as any, title: file.name })}
                      className="inline-flex items-center gap-2 text-[#F27D26] text-sm font-bold hover:underline"
                    >
                      {file.type === 'video' ? <FileVideo size={16} /> : <FileText size={16} />}
                      {file.name}
                    </button>
                  ))}
                  {project.driveUrl && (
                    <button
                      onClick={() => setViewerConfig({ url: project.driveUrl!, type: 'doc', title: project.title })}
                      className="inline-flex items-center gap-2 text-[#F27D26] text-sm font-bold hover:underline"
                    >
                      <ExternalLink size={16} />
                      View Resources (PPT/PDF/DOC)
                    </button>
                  )}
                  <button
                    onClick={() => setViewingProject(project)}
                    className="inline-flex items-center gap-2 text-white/40 text-sm font-bold hover:text-white transition-colors"
                  >
                    <Info size={16} />
                    Details & Components
                  </button>
                </div>
              </div>

              <div className="w-full md:w-64 flex flex-col justify-center items-center border-t md:border-t-0 md:border-l border-white/5 pt-6 md:pt-0 md:pl-6">
                {profile?.role === 'student' ? (
                  userSubmission ? (
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 mx-auto mb-2">
                        <CheckCircle size={32} />
                      </div>
                      <p className="text-sm font-bold text-green-400">Submitted</p>
                      {userSubmission.rating && (
                        <div className="flex gap-1 mt-2 justify-center">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} size={12} className={userSubmission.rating! >= s ? 'text-yellow-400 fill-yellow-400' : 'text-white/10'} />
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 mt-4 justify-center">
                        <button
                          onClick={() => shareProject('whatsapp')}
                          className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-white/40 hover:text-green-500 transition-colors"
                        >
                          <Share2 size={12} />
                          WhatsApp
                        </button>
                        <button
                          onClick={() => shareProject('facebook')}
                          className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-white/40 hover:text-blue-500 transition-colors"
                        >
                          <Share2 size={12} />
                          Facebook
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center w-full space-y-4">
                      {uploading === project.id ? (
                        <div className="space-y-3">
                          <div className="w-16 h-16 rounded-full bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26] mx-auto animate-pulse">
                            <Loader2 size={32} className="animate-spin" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Uploading {Math.round(uploadProgress)}%</p>
                            <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                              <div className="bg-[#F27D26] h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-4 justify-center">
                          <label className="cursor-pointer group flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26] group-hover:bg-[#F27D26]/20 transition-colors mb-2">
                              <Camera size={20} />
                            </div>
                            <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest group-hover:text-white transition-colors">Photo</p>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(project.id, e.target.files[0])}
                            />
                          </label>
                          <label className="cursor-pointer group flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-colors mb-2">
                              <FileVideo size={20} />
                            </div>
                            <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest group-hover:text-white transition-colors">Video</p>
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(project.id, e.target.files[0])}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="text-center space-y-4">
                    <div>
                      <p className="text-4xl font-bold text-[#F27D26]">
                        {projectSubmissions.length}
                      </p>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Submissions</p>
                    </div>
                    {projectSubmissions.length > 0 && (
                      <div className="space-y-2">
                        {projectSubmissions.map(sub => (
                          <button
                            key={sub.id}
                            onClick={() => setReviewingSubmission(sub)}
                            className="w-full p-2 bg-white/5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center justify-between"
                          >
                            <span>{students[sub.studentId]?.name || 'Student'}</span>
                            {sub.status === 'pending' ? <div className="w-2 h-2 rounded-full bg-[#F27D26]" /> : <CheckCircle size={12} className="text-green-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {reviewingSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#151619] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 className="text-xl font-bold">Review Submission</h3>
                <button onClick={() => setReviewingSubmission(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="flex gap-8">
                  <div className="w-1/2 aspect-square bg-black rounded-2xl overflow-hidden border border-white/5">
                    {reviewingSubmission.videoUrl ? (
                      <video 
                        src={reviewingSubmission.videoUrl} 
                        controls 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <img 
                        src={reviewingSubmission.photoUrl} 
                        alt="Submission" 
                        className="w-full h-full object-contain" 
                        referrerPolicy="no-referrer" 
                      />
                    )}
                  </div>
                  <div className="w-1/2 space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest text-white/40">Student</label>
                      <p className="text-lg font-bold">{students[reviewingSubmission.studentId]?.name}</p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest text-white/40">Submitted At</label>
                      <p className="text-sm">{new Date(reviewingSubmission.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-white/40">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(s => (
                          <button
                            key={s}
                            onClick={() => setRating(s)}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              rating >= s ? "text-yellow-400 bg-yellow-400/10" : "text-white/20 bg-white/5 hover:bg-white/10"
                            )}
                          >
                            <Star size={20} fill={rating >= s ? "currentColor" : "none"} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/40">Feedback</label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-[#F27D26] h-32"
                    placeholder="Provide constructive feedback..."
                  />
                </div>

                <button
                  onClick={handleReview}
                  className="w-full py-4 bg-[#F27D26] text-white rounded-2xl font-bold hover:bg-[#d66a1e] transition-all flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  Submit Review
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

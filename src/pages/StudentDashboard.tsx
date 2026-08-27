import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, orderBy, limit, updateDoc, getDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Course, Module, Project, Submission, School, UserProfile, Component, ContentActivation, QuizAttempt } from '../types';
import { Trophy, Star, Zap, BookOpen, ClipboardList, ChevronRight, Play, CheckCircle, Share2, X, Camera, Users, Search, UserPlus, UserMinus, LayoutGrid, Key, Shield, AlertCircle, Sparkles, GraduationCap, Upload, Loader2, Eye, EyeOff, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleDriveViewer } from '../components/GoogleDriveViewer';
import { ModulePlayer } from '../components/ModulePlayer';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';

const PRESET_AVATARS = [
  { name: 'Gizmo', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Gizmo' },
  { name: 'Sparky', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sparky' },
  { name: 'Volt', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Volt' },
  { name: 'Rocket', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Rocket' },
  { name: 'Astro', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Astro' }
];

export default function StudentDashboard() {
  const { profile, partners, setPartners, user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [activations, setActivations] = useState<ContentActivation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Quiz attempts states
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);

  // All schools collection for dropdown lists
  const [schools, setSchools] = useState<School[]>([]);
  
  // Dashboard navigation tab
  const [activeTab, setActiveTab] = useState<'curriculum' | 'about'>('curriculum');

  // QR Code Scanner states
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  
  // Profile Setup & Editing inputs state variables
  const [editName, setEditName] = useState('');
  const [editSchoolId, setEditSchoolId] = useState('');
  const [editClassSection, setEditClassSection] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, etc.).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image is too large. Please select an image under 10MB.');
      return;
    }

    setIsUploadingPhoto(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 250;
        const MAX_HEIGHT = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setEditPhotoUrl(dataUrl);
          toast.success('Photo processed and loaded successfully! Click Save below to persist your new photo.');
        } else {
          setEditPhotoUrl(event.target?.result as string);
          toast.success('Photo loaded successfully! Click Save below to persist your new photo.');
        }
        setIsUploadingPhoto(false);
      };
      img.onerror = () => {
        toast.error('Failed to load image file.');
        setIsUploadingPhoto(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      toast.error('Failed to read image file.');
      setIsUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  // Group Session states
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [allStudents, setAllStudents] = useState<UserProfile[]>([]);

  // Automatically load fields if profile updates
  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '');
      setEditSchoolId(profile.schoolIds?.[0] || '');
      setEditClassSection(profile.classSection || '');
      setEditPhotoUrl(profile.photoUrl || '');
    }
  }, [profile]);

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

      // Fetch school leaderboard based on total accumulated points
      const unsubLeaderboard = onSnapshot(
        query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('schoolIds', 'array-contains', profile.schoolIds[0])
        ),
        (snapshot) => {
          const list = snapshot.docs.map(doc => {
            const data = doc.data();
            const xpVal = data.xp || 0;
            const projPts = data.projectPoints || 0;
            const quizPts = data.quizPoints || 0;
            const calculatedTotal = xpVal + projPts + quizPts;
            return { uid: doc.id, ...data, totalPoints: calculatedTotal } as UserProfile;
          });
          list.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
          setLeaderboard(list.slice(0, 10));
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'users');
        }
      );
    }

    // Fetch courses for student's school
    const unsubCourses = onSnapshot(query(
      collection(db, 'courses'), 
      where('schoolId', '==', profile.schoolIds?.[0] || '')
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

    // Fetch activations
    const unsubActivations = onSnapshot(collection(db, 'activations'), (snapshot) => {
      setActivations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentActivation)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activations');
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

    // Fetch quiz attempts for student
    const unsubQuizAttempts = onSnapshot(query(collection(db, 'quizAttempts'), where('studentId', '==', profile.uid)), (snapshot) => {
      setQuizAttempts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizAttempt)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quizAttempts');
    });

    // Fetch all components for the player
    const unsubComponents = onSnapshot(collection(db, 'components'), (snapshot) => {
      setComponents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Component)));
    });

    // Fetch all schools for setup selects
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    }, (error) => {
      console.error("Failed to fetch schools library", error);
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
      unsubActivations();
      unsubProjects();
      unsubSubmissions();
      unsubComponents();
      unsubSchools();
      unsubQuizAttempts();
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

  // Complete profile setup and editable updates
  const handleUpdateStudentProfile = async (isSetup: boolean) => {
    if (!profile) return;
    if (!editName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!editSchoolId) {
      toast.error("Please select your school");
      return;
    }
    if (!editClassSection.trim()) {
      toast.error("Please enter your class/grade style");
      return;
    }

    setIsSavingProfile(true);
    try {
      // 1. Save general fields to Firestore
      await updateDoc(doc(db, 'users', profile.uid), {
        name: editName.trim(),
        schoolIds: [editSchoolId],
        classSection: editClassSection.trim(),
        photoUrl: editPhotoUrl.trim(),
        setupCompleted: true
      });

      // 2. If changing email-password, call updatePassword natively on active auth user
      if (editPassword.trim()) {
        if (user) {
          await updatePassword(user, editPassword.trim());
          toast.success("Password changed successfully in secure storage!");
          setEditPassword('');
        } else {
          throw new Error("Unable to locate firestore authentication reference.");
        }
      }

      toast.success(isSetup ? "Welcome aboard! Account activated!" : "Profile details saved successfully!");
      if (isSetup) {
        setActiveTab('curriculum');
      }
    } catch (err: any) {
      console.error("Profile saving context error", err);
      if (err.code === 'auth/requires-recent-login') {
        toast.error("Security notice: To modify your password, please sign out, sign back in immediately, and try again!");
      } else {
        toast.error(`Operation failed: ${err.message || err}`);
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  // QR Code scan processing logic
  const handleQrScanSuccess = async (scannedText: string) => {
    let moduleId = scannedText.trim();
    if (scannedText.includes('/chapter/')) {
      const parts = scannedText.split('/chapter/');
      if (parts.length > 1) {
        moduleId = parts[1].split('?')[0].split('#')[0].trim();
      }
    }
    
    if (!moduleId) {
      toast.error("Invalid QR Code content detected.");
      return;
    }

    toast.loading("Opening chapter player...", { id: 'qr-scan' });
    
    const foundModule = modules.find(m => m.id === moduleId);
    if (foundModule) {
      toast.success(`Opening Chapter: ${foundModule.title}!`, { id: 'qr-scan' });
      setActiveModule(foundModule);
    } else {
      try {
        const docRef = doc(db, 'modules', moduleId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const modData = { id: docSnap.id, ...docSnap.data() } as Module;
          toast.success(`Opening Chapter: ${modData.title}!`, { id: 'qr-scan' });
          setActiveModule(modData);
        } else {
          toast.error("Chapter not found. Please verify the QR Code is correct.", { id: 'qr-scan' });
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch scanned chapter.", { id: 'qr-scan' });
      }
    }
  };

  // Scanner mounting & lifecycle management
  useEffect(() => {
    let html5QrCode: any;
    if (isScanning) {
      setScanError('');
      const startScanner = async () => {
        try {
          html5QrCode = new Html5Qrcode("reader");
          const qrCodeSuccessCallback = async (decodedText: string, decodedResult: any) => {
            try {
              await html5QrCode.stop();
            } catch (stopErr) {
              console.error("Stop error", stopErr);
            }
            setIsScanning(false);
            handleQrScanSuccess(decodedText);
          };
          
          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 220, height: 220 },
            },
            qrCodeSuccessCallback,
            (errorMessage: string) => {
              // Ignore scanning transition verbose logging
            }
          );
        } catch (err: any) {
          console.error("Failed to start scanner:", err);
          setScanError(err.message || 'Could not access camera. Please verify permissions in settings.');
          setIsScanning(false);
        }
      };
      // Delay slightly to ensure DOM element is mounted
      const timer = setTimeout(startScanner, 300);
      return () => {
        clearTimeout(timer);
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().catch((err: any) => console.error("Scanner stop cleanup failed", err));
        }
      };
    }
  }, [isScanning]);

  // Render One-Time Profile Setup Wizard
  const renderSetupWizard = () => {
    return (
      <div className="max-w-xl mx-auto my-12 p-10 bg-[#151619] border border-white/10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_70%_30%,#F27D26_0%,transparent_70%)] opacity-20 pointer-events-none" />
        <div className="relative z-10 space-y-8 text-white">
          <div className="text-center space-y-3">
             <div className="w-16 h-16 bg-[#F27D26]/10 text-[#F27D26] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
               <GraduationCap size={36} />
             </div>
             <h2 className="text-3xl font-bold tracking-tight">Active Student Profile Setup</h2>
             <p className="text-sm text-white/50">Mention your details below to activate your learning space. This setup is a one-time process.</p>
          </div>

          <div className="space-y-6">
             {/* Name inputs */}
             <div className="space-y-2">
               <label className="text-xs font-bold text-white/60 uppercase tracking-widest block font-sans">Your Full Name</label>
               <input 
                 type="text"
                 placeholder="e.g. John Doe"
                 value={editName}
                 onChange={(e) => setEditName(e.target.value)}
                 className="w-full px-4 py-3 border border-white/10 rounded-xl bg-black/40 text-sm focus:outline-none focus:border-[#F27D26] text-white"
               />
             </div>

             {/* School selecting list */}
             <div className="space-y-2">
               <label className="text-xs font-bold text-white/60 uppercase tracking-widest block font-sans">Select Your School</label>
               <select
                 value={editSchoolId}
                 onChange={(e) => setEditSchoolId(e.target.value)}
                 className="w-full px-4 py-3 border border-white/10 rounded-xl bg-black hover:bg-black text-sm focus:outline-none text-white focus:border-[#F27D26]"
               >
                 <option value="" disabled className="text-white/40">-- Click list to select your school --</option>
                 {schools.map(s => (
                   <option key={s.id} value={s.id} className="bg-[#151619] text-white">{s.name} ({s.location})</option>
                 ))}
               </select>
             </div>

             {/* Class input list */}
             <div className="space-y-2">
               <label className="text-xs font-bold text-white/60 uppercase tracking-widest block font-sans">Your Class / Grade Section</label>
               <input 
                 type="text"
                 placeholder="e.g. Grade 5, Grade 6B (numbers only or grade format)"
                 value={editClassSection}
                 onChange={(e) => setEditClassSection(e.target.value)}
                 className="w-full px-4 py-3 border border-white/10 rounded-xl bg-black/40 text-sm focus:outline-none focus:border-[#F27D26] text-white"
               />
             </div>

             {/* Profile avatar avatar mascot selections */}
             <div className="space-y-4">
               <div>
                 <label className="text-xs font-bold text-white/60 uppercase tracking-widest block font-sans">Choose Robot Avatar Mascot</label>
                 <p className="text-[10px] text-white/40 mt-1">Select one of our cute robotics mascots below:</p>
               </div>
               <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                 {PRESET_AVATARS.map(avatar => {
                   const isSelected = editPhotoUrl === avatar.url;
                   return (
                     <button
                       key={avatar.name}
                       onClick={() => setEditPhotoUrl(avatar.url)}
                       type="button"
                       className={cn(
                         "flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all hover:bg-white/5",
                         isSelected ? "bg-[#F27D26]/10 border-[#F27D26] text-white font-sans" : "bg-[#151619] border-white/5 text-white/60 font-sans"
                       )}
                     >
                       <img src={avatar.url} alt={avatar.name} className="w-12 h-12 object-contain" />
                       <span className="text-[10px] font-bold">{avatar.name}</span>
                     </button>
                   );
                 })}
               </div>
               <div className="space-y-2 pt-2">
                  <div className="space-y-3 pb-3">
                    <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider block font-sans">Or Upload a Photo from your device:</span>
                    <div className="flex items-center gap-3">
                      <label 
                        htmlFor="setup-photo-upload"
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-[#F27D26]/10 border border-white/10 rounded-xl cursor-pointer text-xs font-bold transition-all text-white/80"
                      >
                        {isUploadingPhoto ? (
                          <Loader2 className="animate-spin text-[#F27D26]" size={14} />
                        ) : (
                          <Upload size={14} className="text-[#F27D26]" />
                        )}
                        <span>{isUploadingPhoto ? 'Processing...' : 'Choose PNG/JPG File'}</span>
                      </label>
                      <input 
                        type="file"
                        id="setup-photo-upload"
                        accept="image/*"
                        onChange={handlePhotoFileChange}
                        className="hidden"
                      />
                      <span className="text-[10px] text-white/40 font-mono">Optimized PNG/JPG</span>
                    </div>

                    <div className="relative flex items-center my-3">
                      <div className="flex-grow border-t border-white/5"></div>
                      <span className="flex-shrink mx-3 text-[8px] uppercase font-bold text-white/20 font-mono">Or Paste Web URL</span>
                      <div className="flex-grow border-t border-white/5"></div>
                    </div>
                  </div>
                 <span className="text-[10px] uppercase font-bold text-white/40 font-mono">Or Paste Image/Photo URL:</span>
                 <input 
                   type="text"
                   placeholder="https://example.com/avatar.png"
                   value={editPhotoUrl}
                   onChange={(e) => setEditPhotoUrl(e.target.value)}
                   className="w-full px-4 py-2 border border-white/10 rounded-xl bg-black/40 text-xs focus:outline-none focus:border-[#F27D26] text-white"
                 />
                 {editPhotoUrl && (
                   <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                     <img src={editPhotoUrl} alt="Preview Avatar" className="w-10 h-10 rounded-full object-cover border border-[#F27D26]/30" referrerPolicy="no-referrer" />
                     <span className="text-xs text-white/60">Live avatar preview shown successfully.</span>
                   </div>
                 )}
               </div>
             </div>

             {/* Password Setup */}
             <div className="space-y-2">
               <div className="flex justify-between items-center">
                 <label className="text-xs font-bold text-white/60 uppercase tracking-widest block font-sans">Set Account Password</label>
                 <span className="text-[9px] text-[#F27D26] font-mono">Optional</span>
               </div>
               <div className="relative">
                 <input 
                   type={showEditPassword ? "text" : "password"}
                   placeholder="Type new password (min 6 characters)"
                   value={editPassword}
                   onChange={(e) => setEditPassword(e.target.value)}
                   className="w-full px-4 py-3 border border-white/10 rounded-xl bg-black/40 text-sm focus:outline-none focus:border-[#F27D26] text-white pr-12"
                 />
                 <button
                   type="button"
                   onClick={() => setShowEditPassword(!showEditPassword)}
                   className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer p-1 rounded hover:bg-white/5"
                 >
                   {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                 </button>
               </div>
             </div>
          </div>

          <div className="pt-4">
             <button
               onClick={() => handleUpdateStudentProfile(true)}
               disabled={isSavingProfile}
               className="w-full py-4 bg-[#F27D26] text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-[#d66a1e] transition-colors shadow-xl shadow-[#F27D26]/20 flex items-center justify-center gap-2 disabled:opacity-50"
             >
               {isSavingProfile ? "Completing setup..." : "Save details & Activate account"}
               <Sparkles size={16} />
             </button>
          </div>
        </div>
      </div>
    );
  };

  // Render About Me View Details Tab
  const renderAboutMeTab = () => {
    return (
      <div className="max-w-3xl mx-auto p-10 bg-[#151619] border border-white/5 rounded-[2.5rem] relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_70%_30%,#F27D26_0%,transparent_70%)] opacity-20 pointer-events-none" />
        <div className="relative z-10 space-y-10">
          <div>
             <h3 className="text-3xl font-bold tracking-tight">About Me</h3>
             <p className="text-sm text-white/50 mt-1">Review and update your system credentials and student information files.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            
            {/* Left Column info */}
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center p-6 bg-black/20 rounded-3xl border border-white/5">
                <div className="relative mb-4">
                  <div className="w-24 h-24 rounded-full border-2 border-[#F27D26] p-1 overflow-hidden bg-black flex items-center justify-center">
                    {editPhotoUrl ? (
                      <img src={editPhotoUrl} alt="Avatar Profile" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <GraduationCap size={44} className="text-white/25" />
                    )}
                  </div>
                </div>
                <h4 className="text-lg font-bold">{editName || 'Student Name'}</h4>
                <p className="text-xs text-white/40 mt-1 font-mono uppercase">Level {profile?.level || 1} • {profile?.xp || 0} XP</p>
              </div>

              {/* Preset Avatars block inside About Student */}
              <div className="space-y-3 bg-black/20 p-5 rounded-3xl border border-white/5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#F27D26] block font-sans">Robot Mascot Presets</label>
                <div className="grid grid-cols-5 gap-2">
                  {PRESET_AVATARS.map(avatar => {
                    const isSelected = editPhotoUrl === avatar.url;
                    return (
                      <button
                        key={avatar.name}
                        onClick={() => setEditPhotoUrl(avatar.url)}
                        type="button"
                        className={cn(
                          "flex flex-col items-center gap-1 p-1 rounded-lg border transition-all hover:border-white/20",
                          isSelected ? "bg-[#F27D26]/10 border-[#F27D26]" : "bg-[#151619] border-white/5"
                        )}
                      >
                        <img src={avatar.url} alt={avatar.name} className="w-8 h-8 object-contain" />
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-1.5 pt-2">
                  <div className="space-y-2 pt-1 pb-3">
                    <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider block font-sans">Or Upload from computer/phone:</span>
                    <div className="flex items-center gap-2">
                      <label 
                        htmlFor="aboutme-photo-upload"
                        className="flex items-center gap-2 px-3 py-2 bg-[#151619] hover:bg-[#F27D26]/10 border border-white/10 rounded-xl cursor-pointer text-xs font-bold transition-all text-white/80"
                      >
                        {isUploadingPhoto ? (
                          <Loader2 className="animate-spin text-[#F27D26]" size={12} />
                        ) : (
                          <Upload size={12} className="text-[#F27D26]" />
                        )}
                        <span>{isUploadingPhoto ? 'Processing...' : 'Upload Image File'}</span>
                      </label>
                      <input 
                        type="file"
                        id="aboutme-photo-upload"
                        accept="image/*"
                        onChange={handlePhotoFileChange}
                        className="hidden"
                      />
                      <span className="text-[9px] text-white/30 font-mono">PNG, JPG, etc.</span>
                    </div>

                    <div className="relative flex items-center my-2.5">
                      <div className="flex-grow border-t border-white/5"></div>
                      <span className="flex-shrink mx-2 text-[8px] uppercase font-bold text-white/20 font-mono">Or paste web URL</span>
                      <div className="flex-grow border-t border-white/5"></div>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-white/40 uppercase font-mono">Custom Photo URL:</span>
                  <input 
                    type="text"
                    placeholder="https://example.com/avatar.png"
                    value={editPhotoUrl}
                    onChange={(e) => setEditPhotoUrl(e.target.value)}
                    className="w-full px-3 py-1.5 border border-white/10 rounded-xl bg-[#151619] text-xs focus:outline-none focus:border-[#F27D26] text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Fields configuration */}
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider block font-sans">Your Login ID / Email (Readonly)</span>
                <div className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-sm text-white/30 font-mono select-none">
                  {profile?.email}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/60 tracking-wider block font-sans">Your Full Name</label>
                <input 
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 border border-white/10 rounded-xl bg-black/40 text-sm focus:outline-none focus:border-[#F27D26] text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-[#F27D26] tracking-wider block font-sans">Your School Name</label>
                <select
                  value={editSchoolId}
                  onChange={(e) => setEditSchoolId(e.target.value)}
                  className="w-full px-4 py-3 border border-white/10 rounded-xl bg-black text-sm focus:outline-none text-white focus:border-[#F27D26]"
                >
                  <option value="" disabled className="text-white/40">-- Click list to select your school --</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id} className="bg-[#151619] text-white">{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/60 tracking-wider block font-sans">Your Class / Grade Section</label>
                <input 
                  type="text"
                  value={editClassSection}
                  onChange={(e) => setEditClassSection(e.target.value)}
                  className="w-full px-4 py-3 border border-white/10 rounded-xl bg-black/40 text-sm focus:outline-none focus:border-[#F27D26] text-white"
                />
              </div>

              <div className="space-y-2 bg-[#F27D26]/5 p-4 rounded-2xl border border-[#F27D26]/20">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] uppercase font-black text-[#F27D26] tracking-wider block font-sans">Change Password</label>
                  <span className="text-[8px] font-mono text-white/30">Secure update</span>
                </div>
                <div className="relative">
                  <input 
                    type={showEditPassword ? "text" : "password"}
                    placeholder="Enter new 6+ char password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-white/10 rounded-xl bg-[#151619] text-xs focus:outline-none focus:border-[#F27D26] text-white font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer p-1 rounded hover:bg-white/5"
                  >
                    {showEditPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
            <button
              onClick={() => handleUpdateStudentProfile(false)}
              disabled={isSavingProfile}
              className="px-8 py-4 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-colors shadow-lg shadow-[#F27D26]/10 disabled:opacity-50 font-sans"
            >
              {isSavingProfile ? "Saving changes..." : "Save details & update"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-full">Loading Dashboard...</div>;

  if (profile?.role === 'student' && !profile?.setupCompleted) {
    return renderSetupWizard();
  }

  // Filter courses by active activations for student's class section allocation
  const studentSection = profile?.classSection ? profile.classSection.trim().toUpperCase() : '';
  const filteredCourses = courses.filter(course => {
    const courseModules = modules
      .filter(m => m.courseId === course.id)
      .filter(m => m.isVisible !== false)
      .filter(m => {
        const matchedActs = activations.filter(a => {
          const matchesModule = a.moduleId === m.id;
          const sameSchool = profile?.schoolIds?.includes(a.schoolId);
          const actClass = a.classSection ? a.classSection.trim().toUpperCase() : '';
          return matchesModule && sameSchool && studentSection && (studentSection === actClass);
        });
        return matchedActs.length > 0;
      });
    return courseModules.length > 0;
  });

  return (
    <div className="space-y-10 pb-20 text-white">
      
      {/* Tab Switcher Navigation Segments */}
      <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl w-full max-w-sm ml-auto mr-0 justify-end mb-4">
        <button
          onClick={() => setActiveTab('curriculum')}
          className={cn(
            "flex-1 py-2.5 px-6 rounded-xl transition-all text-[11px] font-black uppercase tracking-wider",
            activeTab === 'curriculum' 
              ? "bg-[#F27D26] text-white shadow-lg shadow-[#F27D26]/20" 
              : "text-white/60 hover:text-white hover:bg-white/5"
          )}
        >
          Curriculum
        </button>
        <button
          onClick={() => setActiveTab('about')}
          className={cn(
            "flex-1 py-2.5 px-6 rounded-xl transition-all text-[11px] font-black uppercase tracking-wider",
            activeTab === 'about' 
              ? "bg-[#F27D26] text-white shadow-lg shadow-[#F27D26]/20" 
              : "text-white/60 hover:text-white hover:bg-white/5"
          )}
        >
          About Me
        </button>
      </div>

      {activeTab === 'about' ? (
        renderAboutMeTab()
      ) : (
        <>
          {/* Hero Section - Gamified */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-[#151619] border border-white/5 p-10">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(circle_at_70%_30%,#F27D26_0%,transparent_70%)] opacity-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-[#F27D26] p-1 overflow-hidden">
              {profile?.photoUrl ? (
                <img src={profile.photoUrl} alt={profile.name} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-4xl font-bold text-[#F27D26]">
                  {profile?.level || 1}
                </div>
              )}
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

      {/* Resume Last Active Chapter Section */}
      {profile?.lastActiveModuleId && (
        (() => {
          const activeMod = modules.find(m => m.id === profile.lastActiveModuleId);
          if (!activeMod) return null;
          return (
            <div className="p-8 bg-gradient-to-r from-[#F27D26]/15 via-[#151619] to-[#151619] border border-[#F27D26]/20 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 text-white leading-relaxed">
              <div className="space-y-1">
                <span className="px-3 py-1 bg-[#F27D26]/20 text-[#F27D26] text-[10px] font-black uppercase tracking-wider rounded-full font-mono">RESUME ACTIVE CHAPTER</span>
                <h4 className="text-2xl font-bold tracking-tight">{activeMod.title}</h4>
                <p className="text-sm text-white/50">Pick up right where you left off at Step {(profile.lastActiveStepIdx || 0) + 1}!</p>
              </div>
              <button 
                onClick={() => setActiveModule(activeMod)}
                className="px-8 py-4 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-[#F27D26]/20 font-sans"
              >
                <Play size={14} fill="currentColor" /> Resume Chapter
              </button>
            </div>
          );
        })()
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Course Progress */}
        <div className="lg:col-span-2 space-y-8">
          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold tracking-tight">My Courses</h3>
              <button className="text-[#F27D26] text-sm font-bold hover:underline">View Curriculum</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...filteredCourses].sort((a, b) => {
                const orderA = a.order !== undefined ? a.order : 0;
                const orderB = b.order !== undefined ? b.order : 0;
                if (orderA !== orderB) return orderA - orderB;
                return a.title.localeCompare(b.title);
              }).map((course) => {
                const courseModules = modules
                  .filter(m => m.courseId === course.id)
                  .filter(m => m.isVisible !== false)
                  .filter(m => {
                    const matchedActs = activations.filter(a => {
                      const matchesModule = a.moduleId === m.id;
                      const sameSchool = profile?.schoolIds?.includes(a.schoolId);
                      const studentClass = profile?.classSection ? profile.classSection.trim().toUpperCase() : '';
                      const actClass = a.classSection ? a.classSection.trim().toUpperCase() : '';
                      const classMatches = studentClass && actClass && (studentClass === actClass);
                      return matchesModule && sameSchool && classMatches;
                    });
                    return matchedActs.length > 0;
                  });
                const completedModules = courseModules.filter(m => {
                  const hasProject = submissions.some(s => s.projectId === m.id);
                  const quizQuestionsExist = m.quizQuestions && m.quizQuestions.length > 0;
                  const hasCompletedQuiz = quizQuestionsExist 
                    ? quizAttempts.some(qa => qa.moduleId === m.id && qa.completed)
                    : true;
                  return (m.steps && m.steps.length > 0 ? hasProject : true) && hasCompletedQuiz;
                });
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
                      {courseModules.map(module => {
                        const isProjDone = submissions.some(s => s.projectId === module.id);
                        const quizQuestionsExist = module.quizQuestions && module.quizQuestions.length > 0;
                        const isQuizDone = quizQuestionsExist
                          ? quizAttempts.some(qa => qa.moduleId === module.id && qa.completed)
                          : true;
                        const isModuleCompleted = (module.steps && module.steps.length > 0 ? isProjDone : true) && isQuizDone;

                        return (
                          <div key={module.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group/module hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center text-white/20 group-hover/module:text-[#F27D26] transition-colors">
                                <LayoutGrid size={16} />
                              </div>
                              <div>
                                <span className="text-sm font-bold block truncate max-w-[120px]">{module.title}</span>
                                {quizQuestionsExist && (
                                  <span className={`text-[9px] font-bold block mt-0.5 ${isQuizDone ? 'text-green-400' : 'text-yellow-500/70'}`}>
                                    {isQuizDone ? '✓ Quiz Passed' : '⚡ Mock Quiz Pending'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isModuleCompleted ? (
                                <span className="px-2.5 py-1 bg-green-500/15 border border-green-500/25 text-green-400 font-bold text-[8px] uppercase tracking-widest rounded-md">
                                  Completed
                                </span>
                              ) : (
                                (module.steps || []).length > 0 && (
                                  <button 
                                    onClick={() => setActiveModule(module)}
                                    className="px-3 py-1.5 bg-[#F27D26]/10 text-[#F27D26] text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#F27D26] hover:text-white transition-all flex items-center gap-1.5"
                                  >
                                    <Play size={10} fill="currentColor" /> Start LMS
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
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
              {filteredCourses.length === 0 && (
                <div className="col-span-2 p-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                  <BookOpen className="mx-auto mb-4 opacity-20" size={48} />
                  <p className="text-white/40 font-medium">No courses active or activated for your school/class section setup yet.</p>
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
          {/* TEXTBOOK SCANNER CARD */}
          <section className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_70%_30%,#F27D26_0%,transparent_70%)] opacity-20 pointer-events-none" />
            
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#F27D26]/10 text-[#F27D26] rounded-xl">
                  <QrCode size={20} />
                </div>
                <h3 className="text-lg font-bold tracking-tight">Textbook Chapter Scan</h3>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Scan physical book chapter QR codes with your device camera to open interactive lesson workspaces instantly.
              </p>
            </div>

            <AnimatePresence mode="wait">
              {isScanning ? (
                <motion.div
                  key="scanning"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="relative overflow-hidden rounded-2xl border border-[#F27D26]/30 bg-black/80 aspect-square w-full">
                    <div id="reader" className="w-full h-full" />
                    {/* Pulsing scan laser effect */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#F27D26] to-transparent animate-pulse shadow-[0_0_8px_#F27D26] z-10" style={{ animation: 'bounce 2s infinite' }} />
                  </div>
                  
                  <button
                    onClick={() => setIsScanning(false)}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Cancel Scan
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {scanError && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl flex gap-2.5 text-xs text-red-400 leading-relaxed">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <span>{scanError}</span>
                    </div>
                  )}

                  <button
                    onClick={() => setIsScanning(true)}
                    className="w-full py-4 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#F27D26]/10 cursor-pointer"
                  >
                    <Camera size={16} />
                    <span>Launch Camera Scanner</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

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
                  <div className="w-10 h-10 rounded-full bg-[#F27D26]/10 flex items-center justify-center overflow-hidden">
                    {student.photoUrl ? (
                      <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-[#F27D26] font-bold text-xs font-sans">{student.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{student.name}</p>
                    <p className="text-[10px] text-yellow-500 font-bold tracking-widest uppercase">{student.totalPoints || (student.xp || 0)} Total PTS</p>
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
      </>
    )}

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

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, addDoc, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { ProjectTheme, ThematicSubmission, School, UserProfile } from '../types';
import { Trophy, Gift, Calendar, Sparkles, Send, CheckCircle, Clock, AlertTriangle, AlertCircle, FilePlus, Eye, Users, Info, Settings, Edit3, Save, Upload, Loader2, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn, getDirectImageUrl } from '../lib/utils';

interface LeaderboardConfig {
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  heroAccentColor: string;
  heroBannerUrl?: string;
  rulesTitle: string;
  rulesDescription: string;
  rulesList: { title: string; desc: string; color: string }[];
}

const DEFAULT_CONFIG: LeaderboardConfig = {
  heroBadge: 'Robotics Leaderboard Arena',
  heroTitle: 'Create. Submit. Conquer!',
  heroDescription: 'Compete on quarterly and monthly project challenges! Build innovative electronics models, post working prototype captures, earn high-value teacher approvals, and climb the leaderboard standings to win official robotics hardware kits.',
  heroAccentColor: '#F27D26',
  heroBannerUrl: '',
  rulesTitle: 'Winner Board Rules',
  rulesDescription: 'Scoring is aggregated from daily quiz efforts and monthly design selections.',
  rulesList: [
    { title: 'Chapter Quizzes', desc: 'Earn 10 raw leaderboard points for every mock test correct selection.', color: 'emerald' },
    { title: 'Monthly Projects Showcase', desc: 'Approved creative prototype applications earn up to 100 points as validated by trainers!', color: 'orange' },
    { title: 'Hampers of the Month', desc: 'Top 3 overall scorers inside the School list win real Robotics packages at term end!', color: 'blue' }
  ]
};

const PRESET_PROJECT_SHOTS = [
  { name: 'Microcontroller Circuit', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=500&q=80' },
  { name: 'SMART Obstacle Robot', url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=500&q=80' },
  { name: 'DIY Solder Kit Board', url: 'https://images.unsplash.com/photo-1517055720413-77a67dad67b8?auto=format&fit=crop&w=500&q=80' },
  { name: 'Smart Greenhouse Sensor', url: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=500&q=80' }
];

export default function LeaderboardEvent() {
  const { profile } = useAuth();
  const [themes, setThemes] = useState<ProjectTheme[]>([]);
  const [submissions, setSubmissions] = useState<ThematicSubmission[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [schools, setSchools] = useState<Record<string, School>>({});
  const [students, setStudents] = useState<Record<string, UserProfile>>({});
  const [config, setConfig] = useState<LeaderboardConfig>(DEFAULT_CONFIG);
  
  // Submit Form States
  const [activeTheme, setActiveTheme] = useState<ProjectTheme | null>(null);
  const [desc, setDesc] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Admin Customizer States
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<'hero' | 'theme' | 'rules'>('hero');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Hero custom edit values
  const [editHeroBadge, setEditHeroBadge] = useState('');
  const [editHeroTitle, setEditHeroTitle] = useState('');
  const [editHeroDescription, setEditHeroDescription] = useState('');
  const [editHeroAccentColor, setEditHeroAccentColor] = useState('#F27D26');
  const [editHeroBannerUrl, setEditHeroBannerUrl] = useState('');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Theme custom edit values
  const [editThemeMonth, setEditThemeMonth] = useState('');
  const [editThemeTitle, setEditThemeTitle] = useState('');
  const [editThemeDescription, setEditThemeDescription] = useState('');
  const [editThemeStepsHtml, setEditThemeStepsHtml] = useState('');
  const [editThemeRewardDescription, setEditThemeRewardDescription] = useState('');

  // Rules custom edit values
  const [editRulesTitle, setEditRulesTitle] = useState('');
  const [editRulesDescription, setEditRulesDescription] = useState('');
  const [editRulesList, setEditRulesList] = useState<{ title: string; desc: string; color: string }[]>([]);

  useEffect(() => {
    if (!profile) return;

    // Fetch school mapped to current student
    if (profile.schoolIds?.[0]) {
      onSnapshot(doc(db, 'schools', profile.schoolIds[0]), (snapshot) => {
        if (snapshot.exists()) {
          setSchool({ id: snapshot.id, ...snapshot.data() } as School);
        }
      });
    }

    // Fetch global configuration
    const unsubConfig = onSnapshot(doc(db, 'settings', 'leaderboard_arena'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Partial<LeaderboardConfig>;
        setConfig({
          heroBadge: data.heroBadge ?? DEFAULT_CONFIG.heroBadge,
          heroTitle: data.heroTitle ?? DEFAULT_CONFIG.heroTitle,
          heroDescription: data.heroDescription ?? DEFAULT_CONFIG.heroDescription,
          heroAccentColor: data.heroAccentColor ?? DEFAULT_CONFIG.heroAccentColor,
          heroBannerUrl: data.heroBannerUrl ?? DEFAULT_CONFIG.heroBannerUrl,
          rulesTitle: data.rulesTitle ?? DEFAULT_CONFIG.rulesTitle,
          rulesDescription: data.rulesDescription ?? DEFAULT_CONFIG.rulesDescription,
          rulesList: data.rulesList ?? DEFAULT_CONFIG.rulesList,
        });
      }
    });

    // Fetch themes
    const unsubThemes = onSnapshot(collection(db, 'projectThemes'), (snapshot) => {
      const themeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectTheme));
      setThemes(themeList);
      
      // Auto-set first active theme
      const active = themeList.find(t => t.active === true);
      if (active) {
        setActiveTheme(active);
      } else if (themeList.length > 0) {
        setActiveTheme(themeList[0]);
      }
    });

    // Fetch thematic submissions
    const curSubQ = profile.role === 'student' 
      ? query(collection(db, 'thematicSubmissions'), where('studentId', '==', profile.uid))
      : collection(db, 'thematicSubmissions');

    const unsubSubmissions = onSnapshot(curSubQ, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ThematicSubmission)));
    });

    // Helpers to decode school & student profiles
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      const map: Record<string, School> = {};
      snapshot.docs.forEach(doc => {
        map[doc.id] = { id: doc.id, ...doc.data() } as School;
      });
      setSchools(map);
    });

    const unsubStudents = onSnapshot(collection(db, 'users'), (snapshot) => {
      const map: Record<string, UserProfile> = {};
      snapshot.docs.forEach(doc => {
        map[doc.id] = { uid: doc.id, ...doc.data() } as UserProfile;
      });
      setStudents(map);
    });

    return () => {
      unsubConfig();
      unsubThemes();
      unsubSubmissions();
      unsubSchools();
      unsubStudents();
    };
  }, [profile]);

  // Synchronize configuration changes to form states
  useEffect(() => {
    setEditHeroBadge(config.heroBadge);
    setEditHeroTitle(config.heroTitle);
    setEditHeroDescription(config.heroDescription);
    setEditHeroAccentColor(config.heroAccentColor);
    setEditHeroBannerUrl(config.heroBannerUrl || '');
    setEditRulesTitle(config.rulesTitle);
    setEditRulesDescription(config.rulesDescription);
    setEditRulesList(config.rulesList);
  }, [config]);

  // Synchronize active theme changes to form states
  useEffect(() => {
    if (activeTheme) {
      setEditThemeMonth(activeTheme.month);
      setEditThemeTitle(activeTheme.title);
      setEditThemeDescription(activeTheme.description);
      setEditThemeStepsHtml(activeTheme.stepsHtml || '');
      setEditThemeRewardDescription(activeTheme.rewardDescription || '');
    } else {
      setEditThemeMonth('');
      setEditThemeTitle('');
      setEditThemeDescription('');
      setEditThemeStepsHtml('');
      setEditThemeRewardDescription('');
    }
  }, [activeTheme]);

  // Handle banner image uploads
  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP, etc.).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image is too large. Please select an image under 10MB.');
      return;
    }

    setIsUploadingBanner(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 900;
        const MAX_HEIGHT = 500;
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
          setEditHeroBannerUrl(dataUrl);
          toast.success('Banner picture optimized successfully! Remember to save changes.');
        } else {
          setEditHeroBannerUrl(event.target?.result as string);
          toast.success('Banner picture loaded successfully! Remember to save changes.');
        }
        setIsUploadingBanner(false);
      };
      img.onerror = () => {
        toast.error('Failed to parse image file.');
        setIsUploadingBanner(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      toast.error('Failed to read image file onto device memory.');
      setIsUploadingBanner(false);
    };
    reader.readAsDataURL(file);
  };

  // Seeder to guarantee students see an elite active theme when database is empty
  const handleCreateMockTheme = async () => {
    try {
      const mockId = 'theme_' + Math.random().toString(36).substr(2, 9);
      const mockTheme: ProjectTheme = {
        id: mockId,
        title: 'Futuristic AI Eco-Rescue Robot',
        description: 'Design and build a robotics system that resolves environmental issues. Think Smart Trash Sorter devices, Autonomous beach-cleaning bots, or smart water-quality tester crafts!',
        month: 'June Contest Theme',
        active: true,
        createdAt: new Date().toISOString(),
        stepsHtml: '1. Build a working physical outline using breadboards, Arduino microcontrollers, or BBC micro:bits.\n2. Equip sensitive modules (IR Sensors, Servo Arms, Ultrasonic sensors, or Bluetooth tags).\n3. Code local loops explaining how environmental anomalies get logged or handled.\n4. Take a clear landscape workspace photograph and upload to the submission tab with descriptions of your logic flow.',
        rewardDescription: '🎁 Golden Robotics Champions Kit (Winner), 🥈 Silver Starter Electronics Kit (Top 2 & 3), +100 overall leaderboard points for all accepted submissions!'
      };

      await setDoc(doc(db, 'projectThemes', mockId), mockTheme);
      toast.success('Official Monthly Theme initialized!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create monthly theme');
    }
  };

  // Publish Hero Settings
  const handleSaveHeroConfig = async () => {
    setIsSavingConfig(true);
    try {
      await setDoc(doc(db, 'settings', 'leaderboard_arena'), {
        ...config,
        heroBadge: editHeroBadge.trim(),
        heroTitle: editHeroTitle.trim(),
        heroDescription: editHeroDescription.trim(),
        heroAccentColor: editHeroAccentColor,
        heroBannerUrl: editHeroBannerUrl.trim()
      }, { merge: true });
      toast.success('Leaderboard Arena hero aesthetics updated and synchronized!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to publish Hero updates');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Publish Active Theme Settings
  const handleSaveThemeConfig = async () => {
    setIsSavingConfig(true);
    try {
      let themeId = activeTheme?.id;
      if (!themeId) {
        themeId = 'theme_' + Math.random().toString(36).substr(2, 9);
      }
      const updatedTheme: ProjectTheme = {
        id: themeId,
        title: editThemeTitle.trim() || 'New Robotics Contest Challenge',
        description: editThemeDescription.trim() || 'Contest description and student engineering goals.',
        month: editThemeMonth.trim() || 'Active Challenge Month',
        active: true,
        createdAt: activeTheme?.createdAt || new Date().toISOString(),
        stepsHtml: editThemeStepsHtml.trim(),
        rewardDescription: editThemeRewardDescription.trim()
      };
      
      await setDoc(doc(db, 'projectThemes', themeId), updatedTheme);
      toast.success('Contest Theme updated in real-time, matching all views!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save theme contest changes');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Publish Win Standings Rules Settings
  const handleSaveRulesConfig = async () => {
    setIsSavingConfig(true);
    try {
      await setDoc(doc(db, 'settings', 'leaderboard_arena'), {
        ...config,
        rulesTitle: editRulesTitle.trim(),
        rulesDescription: editRulesDescription.trim(),
        rulesList: editRulesList
      }, { merge: true });
      toast.success('Scoring Rules configured and published live!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to write rules configuration to Firestore');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const updateRuleAtIndex = (index: number, fields: Partial<{ title: string; desc: string; color: string }>) => {
    const listCopy = [...editRulesList];
    listCopy[index] = { ...listCopy[index], ...fields };
    setEditRulesList(listCopy);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !activeTheme) return;

    if (!photoUrl.trim()) {
      toast.error('Please enter or select a project photograph visual.');
      return;
    }
    if (!desc.trim()) {
      toast.error('Please describe your prototype mechanics.');
      return;
    }

    setSubmitting(true);
    try {
      const submissionId = 'thematic_' + Math.random().toString(36).substr(2, 9);
      const newSub: Partial<ThematicSubmission> = {
        id: submissionId,
        themeId: activeTheme.id,
        themeTitle: activeTheme.title,
        studentId: profile.uid,
        studentName: profile.name,
        studentEmail: profile.email,
        schoolId: profile.schoolIds?.[0] || 'Unknown',
        schoolName: school?.name || 'My School',
        classSection: profile.classSection || 'General',
        photoUrl: photoUrl.trim(),
        description: desc.trim(),
        timestamp: new Date().toISOString(),
        status: 'pending',
        pointsAwarded: 0,
        teacherFeedback: '',
        teacherId: '',
        teacherName: ''
      };

      await setDoc(doc(db, 'thematicSubmissions', submissionId), newSub);
      setDesc('');
      setPhotoUrl('');
      toast.success('Your project submission was successfully sent directly to your school trainer!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload submission. Please verify your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 text-white">
      {/* Admin Live Customizer Panel */}
      {profile?.role === 'admin' && (
        <div className="bg-[#151619] border border-white/10 rounded-[2.5rem] p-6 lg:p-8 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#F27D26]/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26]">
                <Settings size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Leaderboard Arena Customizer <span className="px-2.5 py-0.5 bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/30 text-[9px] font-black uppercase tracking-wider rounded-md">Admin Active</span>
                </h2>
                <p className="text-xs text-white/40">Configure visuals, headers, live banner, active contest guidelines, and standings benchmarks below.</p>
              </div>
            </div>
            
            <button
              onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)}
              className="px-4.5 py-2.5 bg-white/5 hover:bg-white/10 active:scale-95 text-white/90 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-white/5"
            >
              {isAdminPanelOpen ? 'Collapse Controls' : 'Expand Editor Board'}
            </button>
          </div>

          <AnimatePresence>
            {isAdminPanelOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-6 overflow-hidden"
              >
                {/* Tab selections */}
                <div className="flex border-b border-white/5 gap-2 pb-1.5 overflow-x-auto">
                  <button
                    onClick={() => setActiveAdminTab('hero')}
                    className={cn(
                      "px-4 py-2 text-xs font-bold transition-all border-b-2 shrink-0 flex items-center gap-2",
                      activeAdminTab === 'hero' ? "border-[#F27D26] text-white" : "border-transparent text-white/40 hover:text-white/60"
                    )}
                  >
                    <ImageIcon size={12} /> 1. Hero Content & Banner
                  </button>
                  <button
                    onClick={() => setActiveAdminTab('theme')}
                    className={cn(
                      "px-4 py-2 text-xs font-bold transition-all border-b-2 shrink-0 flex items-center gap-2",
                      activeAdminTab === 'theme' ? "border-[#F27D26] text-white" : "border-transparent text-white/40 hover:text-white/60"
                    )}
                  >
                    <Calendar size={12} /> 2. active Contest Theme
                  </button>
                  <button
                    onClick={() => setActiveAdminTab('rules')}
                    className={cn(
                      "px-4 py-2 text-xs font-bold transition-all border-b-2 shrink-0 flex items-center gap-2",
                      activeAdminTab === 'rules' ? "border-[#F27D26] text-white" : "border-transparent text-white/40 hover:text-white/60"
                    )}
                  >
                    <Trophy size={12} /> 3. Leaderboard benchmarks
                  </button>
                </div>

                {/* Tab Views */}
                {activeAdminTab === 'hero' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-white/55 block">Hero tag Badge text</label>
                        <input
                          type="text"
                          value={editHeroBadge}
                          onChange={(e) => setEditHeroBadge(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-white/55 block">Hero main header title</label>
                        <input
                          type="text"
                          value={editHeroTitle}
                          onChange={(e) => setEditHeroTitle(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-white/55 block">Hero display Description paragraph</label>
                        <textarea
                          rows={4}
                          value={editHeroDescription}
                          onChange={(e) => setEditHeroDescription(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26] resize-none leading-relaxed"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-white/55 block">Accent Glow Color highlight</label>
                        <div className="flex gap-3 items-center">
                          <input
                            type="color"
                            value={editHeroAccentColor}
                            onChange={(e) => setEditHeroAccentColor(e.target.value)}
                            className="w-10 h-10 rounded-lg bg-transparent border-0 cursor-pointer overflow-hidden p-0"
                          />
                          <input
                            type="text"
                            value={editHeroAccentColor}
                            onChange={(e) => setEditHeroAccentColor(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#F27D26]"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-white/55 block">Hero section cover banner background photo</label>
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                            <label htmlFor="arena-hero-banner-upload" className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer text-xs font-bold transition-all text-white/80 shrink-0">
                              {isUploadingBanner ? (
                                <Loader2 size={12} className="animate-spin text-[#F27D26]" />
                              ) : (
                                <Upload size={12} className="text-[#F27D26]" />
                              )}
                              <span>Upload Picture file</span>
                            </label>
                            <input
                              id="arena-hero-banner-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleBannerFileChange}
                            />
                            <span className="text-[10px] text-white/30 truncate max-w-[180px]">{editHeroBannerUrl ? 'Optimized File Loaded' : 'No Custom Image Uploaded'}</span>
                          </div>

                          <div className="relative flex items-center my-1">
                            <div className="flex-grow border-t border-white/5"></div>
                            <span className="flex-shrink mx-2 text-[8px] uppercase font-bold text-white/20 font-mono">Or Paste Image Web URL</span>
                            <div className="flex-grow border-t border-white/5"></div>
                          </div>

                          <input
                            type="url"
                            placeholder="https://images.unsplash.com/photo-1518770660439..."
                            value={editHeroBannerUrl}
                            onChange={(e) => setEditHeroBannerUrl(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-3">
                        <button
                          onClick={handleSaveHeroConfig}
                          disabled={isSavingConfig}
                          className="px-6 py-3 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          <Save size={12} /> {isSavingConfig ? 'Publishing changes...' : 'Publish Hero visuals'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeAdminTab === 'theme' && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-white/55 block">Contest Month/Tag (e.g. June Contest Theme)</label>
                        <input
                          type="text"
                          value={editThemeMonth}
                          onChange={(e) => setEditThemeMonth(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-white/55 block">Contest Challenge Title</label>
                        <input
                          type="text"
                          value={editThemeTitle}
                          onChange={(e) => setEditThemeTitle(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/55 block">Challenge overview text</label>
                      <textarea
                        rows={3}
                        value={editThemeDescription}
                        onChange={(e) => setEditThemeDescription(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26] resize-none leading-relaxed"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/55 block">Guidelines Steps checklist (One step instruction per text line)</label>
                      <textarea
                        rows={4}
                        placeholder="Step 1 description goes here
Step 2 description goes here
Step 3 description goes here"
                        value={editThemeStepsHtml}
                        onChange={(e) => setEditThemeStepsHtml(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#F27D26] resize-none leading-relaxed"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-white/55 block">Rewards standing prize details description</label>
                      <input
                        type="text"
                        value={editThemeRewardDescription}
                        onChange={(e) => setEditThemeRewardDescription(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleSaveThemeConfig}
                        disabled={isSavingConfig}
                        className="px-6 py-3 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        <Save size={12} /> {isSavingConfig ? 'Saving...' : 'Lock-In Theme Changes'}
                      </button>
                    </div>
                  </div>
                )}

                {activeAdminTab === 'rules' && (
                  <div className="space-y-5 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-white/5 pb-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-white/55 block">Winner Rules header Title</label>
                        <input
                          type="text"
                          value={editRulesTitle}
                          onChange={(e) => setEditRulesTitle(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-white/55 block">Rules section summary description</label>
                        <input
                          type="text"
                          value={editRulesDescription}
                          onChange={(e) => setEditRulesDescription(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[11px] uppercase font-black tracking-wider text-white/40">Scoring Benchmark Milestones (Index 1-3)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {editRulesList.map((rule, idx) => (
                          <div key={idx} className="bg-black/30 border border-white/5 rounded-2xl p-4 space-y-3">
                            <span className="text-[10px] font-mono text-[#F27D26] font-bold">Rule Position {idx + 1}</span>
                            
                            <div className="space-y-1">
                              <label className="text-[8px] uppercase tracking-wider text-white/40 block">Benchmark Title</label>
                              <input
                                type="text"
                                value={rule.title}
                                onChange={(e) => updateRuleAtIndex(idx, { title: e.target.value })}
                                className="w-full bg-[#151619] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[8px] uppercase tracking-wider text-white/40 block">Benchmark Detail instruction</label>
                              <textarea
                                rows={2}
                                value={rule.desc}
                                onChange={(e) => updateRuleAtIndex(idx, { desc: e.target.value })}
                                className="w-full bg-[#151619] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#F27D26] resize-none leading-relaxed"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[8px] uppercase tracking-wider text-white/40 block">Icon Badge color tag</label>
                              <select
                                value={rule.color}
                                onChange={(e) => updateRuleAtIndex(idx, { color: e.target.value })}
                                className="w-full bg-[#151619] border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                              >
                                <option value="emerald">Emerald Green</option>
                                <option value="orange">Orange Accent</option>
                                <option value="blue">Blue Sky</option>
                                <option value="purple">Cosmic Purple</option>
                                <option value="yellow">Bright Yellow</option>
                                <option value="red">Danger Red</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-white/5 pt-4">
                      <button
                        onClick={handleSaveRulesConfig}
                        disabled={isSavingConfig}
                        className="px-6 py-3 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        <Save size={12} /> {isSavingConfig ? 'Publishing...' : 'Publish Rules List'}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Hero Banner Grid */}
      <section 
        className="relative overflow-hidden rounded-[2.5rem] border border-white/5 p-8 lg:p-12 shadow-2xl transition-all"
        style={
          config.heroBannerUrl 
            ? { 
                backgroundImage: `linear-gradient(to right, rgba(16,16,18,0.92) 30%, rgba(5,5,5,0.45) 100%), url(${config.heroBannerUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }
            : {
                backgroundImage: `linear-gradient(to top right, #151619, #101012, black)`
              }
        }
      >
        {!config.heroBannerUrl && (
          <div 
            className="absolute top-0 right-0 w-96 h-96 opacity-20 pointer-events-none transition-all"
            style={{
              backgroundImage: `radial-gradient(circle at 70% 30%, ${config.heroAccentColor || '#F27D26'} 0%, transparent 70%)`
            }}
          />
        )}
        
        <div className="relative z-10 max-w-3xl space-y-6">
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 border text-xs font-black uppercase tracking-widest rounded-full transition-all"
            style={{
              backgroundColor: `${config.heroAccentColor || '#F27D26'}12`,
              borderColor: `${config.heroAccentColor || '#F27D26'}33`,
              color: config.heroAccentColor || '#F27D26'
            }}
          >
            <Trophy size={14} /> {config.heroBadge || 'Robotics Leaderboard Arena'}
          </div>
          <h1 className="text-4xl lg:text-6xl font-black tracking-tight leading-none">
            Create. Submit. <span style={{ color: config.heroAccentColor || '#F27D26' }}>Conquer!</span>
          </h1>
          <p className="text-white/60 text-base leading-relaxed lg:text-lg">
            {config.heroDescription || 'Compete on quarterly and monthly project challenges! Build innovative electronics models, post working prototype captures, earn high-value teacher approvals, and climb the leaderboard standings to win official robotics hardware kits.'}
          </p>

          {themes.length === 0 && (
            <div className="pt-4">
              <button
                onClick={handleCreateMockTheme}
                className="px-6 py-3 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                style={{
                  backgroundColor: config.heroAccentColor || '#F27D26'
                }}
              >
                <Sparkles size={14} /> Initialize Monthly Theme
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Active Theme & Rules */}
        <div className="lg:col-span-8 space-y-8">
          {activeTheme && (
            <div className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
                <div>
                  <span 
                    className="text-[10px] font-black uppercase tracking-widest font-mono flex items-center gap-1.5 leading-none"
                    style={{ color: config.heroAccentColor || '#F27D26' }}
                  >
                    <Calendar size={12} /> {activeTheme.month || 'Current Challenge'}
                  </span>
                  <h2 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">{activeTheme.title}</h2>
                </div>
                <div 
                  className="px-4 py-2 border rounded-xl text-xs font-black uppercase tracking-widest"
                  style={{
                    backgroundColor: `${config.heroAccentColor || '#F27D26'}1A`,
                    borderColor: `${config.heroAccentColor || '#F27D26'}33`,
                    color: config.heroAccentColor || '#F27D26'
                  }}
                >
                  Live Contest
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs uppercase font-extrabold tracking-wider text-white/40">Theme Overview</h3>
                <p className="text-sm text-white/70 leading-relaxed font-sans">{activeTheme.description}</p>
              </div>

              {activeTheme.stepsHtml && (
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h3 className="text-xs uppercase font-extrabold tracking-wider text-white/40">Guidelines & How to Submit</h3>
                  <div className="space-y-2.5">
                    {activeTheme.stepsHtml.split('\n').filter(Boolean).map((step, idx) => (
                      <div key={idx} className="flex gap-3 text-xs leading-relaxed text-white/70 font-sans items-start">
                        <span 
                          className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center font-bold font-mono shrink-0 text-[10px]"
                          style={{ color: config.heroAccentColor || '#F27D26' }}
                        >
                          {idx + 1}
                        </span>
                        <span>{step.replace(/^\d+\.\s*/, '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTheme.rewardDescription && (
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-6 flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-400 shrink-0">
                    <Gift size={24} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-yellow-400">Prizes & Standings Rewards</h4>
                    <p className="text-xs text-white/80 leading-relaxed mt-1">{activeTheme.rewardDescription}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submission Arena for Students */}
          {profile?.role === 'student' && activeTheme && (
            <div className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
              <div className="border-b border-white/5 pb-4">
                <h3 className="text-lg font-bold">Submit Your Competition Entry</h3>
                <p className="text-xs text-white/40 mt-1">Send your completed project to your designated school trainer for review and scoring.</p>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-wider text-white/50 block font-mono">1. Paste Google Drive / Photo Link:</label>
                  
                  <input
                    type="url"
                    placeholder="Paste the Google Drive sharing link of the photo here..."
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                    required
                  />

                  {photoUrl && (
                    <div className="aspect-video max-w-md rounded-2xl overflow-hidden border border-white/10 mx-auto relative bg-black mt-2">
                      <img src={getDirectImageUrl(photoUrl)} alt="Active user preset selection preview" className="w-full h-full object-cover" />
                      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm rounded px-2.5 py-1 text-[9px] font-black uppercase text-green-400">
                        Live Preview Ready
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-wider text-white/50 block font-mono">2. Describe Your Project Mechanics & Working Logic:</label>
                  <textarea
                    rows={4}
                    placeholder="Describe how your prototype works, what components you connected (Arduino, servo motors, ultrasonic, etc.), and what environmental benefit it delivers..."
                    required
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#F27D26] resize-none leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-30"
                  style={{
                    backgroundColor: config.heroAccentColor || '#F27D26'
                  }}
                >
                  <Send size={12} /> {submitting ? 'Sending to Trainer...' : 'Submit Project to School Trainer'}
                </button>
              </form>
            </div>
          )}

          {/* Student's History entries */}
          {profile?.role === 'student' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold">My Contest Submissions</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {submissions.filter(s => s.studentId === profile.uid).length === 0 ? (
                  <div className="col-span-2 p-12 text-center bg-[#151619] rounded-[2rem] border border-dashed border-white/5">
                    <FilePlus className="mx-auto text-white/10 mb-3" size={36} />
                    <p className="text-xs text-white/40">You have not submitted any entries to the leaderboard contests yet. Be the first to build a prototype!</p>
                  </div>
                ) : (
                  submissions
                    .filter(s => s.studentId === profile.uid)
                    .map(sub => (
                      <div key={sub.id} className="bg-[#151619] border border-white/5 rounded-[2rem] overflow-hidden flex flex-col justify-between">
                        <div className="aspect-video bg-black relative">
                          <img src={getDirectImageUrl(sub.photoUrl)} alt="Submission shot" className="w-full h-full object-cover" />
                          <div className="absolute top-4 right-4">
                            {sub.status === 'approved' ? (
                              <div className="px-3 py-1 bg-green-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md">
                                <CheckCircle size={10} /> Approved
                              </div>
                            ) : sub.status === 'rejected' ? (
                              <div className="px-3 py-1 bg-red-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md">
                                <AlertTriangle size={10} /> Rejected
                              </div>
                            ) : (
                              <div className="px-3 py-1 bg-[#F27D26] text-white rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md animate-pulse">
                                <Clock size={10} /> Review Pending
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="p-6 space-y-4">
                          <div>
                            <span className="text-[9px] font-mono text-white/40 block">{new Date(sub.timestamp).toLocaleDateString()}</span>
                            <h4 className="text-base font-bold text-white truncate mt-1">{sub.themeTitle || 'Leaderboard Theme'}</h4>
                          </div>
                          
                          <p className="text-xs text-white/60 leading-relaxed font-sans line-clamp-2">{sub.description}</p>

                          {sub.status === 'approved' && (
                            <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl text-xs flex justify-between items-center">
                              <span className="font-bold">Points Awarded:</span>
                              <span className="font-mono font-black">+{sub.pointsAwarded || 100} PTS</span>
                            </div>
                          )}

                          {sub.teacherFeedback && (
                            <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                              <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Trainer Feedback ({sub.teacherName || 'Trainer'}):</span>
                              <p className="text-[11px] text-white/60 italic leading-relaxed">"{sub.teacherFeedback}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Dynamic event leaderboard showcase */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
            <div className="space-y-1">
              <h3 className="text-xl font-bold flex items-center gap-2 text-yellow-400">
                <Trophy size={20} /> {config.rulesTitle || 'Winner Board Rules'}
              </h3>
              <p className="text-xs text-white/40">{config.rulesDescription || 'Scoring is aggregated from daily quiz efforts and monthly design selections.'}</p>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              {(config.rulesList || []).map((rule, idx) => {
                let badgeClass = "bg-orange-500/10 text-orange-400";
                if (rule.color === 'emerald') badgeClass = "bg-emerald-500/10 text-emerald-400";
                else if (rule.color === 'blue') badgeClass = "bg-blue-500/10 text-blue-400";
                else if (rule.color === 'purple') badgeClass = "bg-purple-500/10 text-purple-400";
                else if (rule.color === 'yellow') badgeClass = "bg-yellow-500/10 text-yellow-400";
                else if (rule.color === 'red') badgeClass = "bg-red-500/10 text-red-500";

                return (
                  <div key={idx} className="flex gap-4">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-black font-mono", badgeClass)}>
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold">{rule.title}</h4>
                      <p className="text-[11px] text-white/50 leading-relaxed mt-0.5">{rule.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Sparkles size={16} className="text-[#F27D26]" /> Approved Entries Showcase
            </h3>
            <p className="text-xs text-white/40">Showcase of outstanding student projects approved by our trainers.</p>

            <div className="space-y-4">
              {submissions.filter(s => s.status === 'approved').length === 0 ? (
                <p className="text-xs text-white/30 text-center py-6">No approved entries showcased yet. Submissions approved by trainers will display here automatically.</p>
              ) : (
                submissions
                  .filter(s => s.status === 'approved')
                  .slice(0, 5)
                  .map(sub => (
                    <div key={sub.id} className="p-3 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black">
                        <img src={getDirectImageUrl(sub.photoUrl)} alt="Showcase" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-white/95">{sub.studentName || 'Student'}</p>
                        <p className="text-[10px] text-white/40 truncate">{sub.schoolName || 'School'}</p>
                        <p className="text-[9px] text-green-400 font-bold uppercase tracking-wider mt-0.5">+{sub.pointsAwarded || 100} Points Awarded</p>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

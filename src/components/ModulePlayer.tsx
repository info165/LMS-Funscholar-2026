import React, { useState } from 'react';
import { Module, ModuleStep, Component } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, LayoutGrid, Info, CheckCircle, Trophy, Zap, HelpCircle, Code, Video, FileText, Copy, Check, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';
import { doc, updateDoc, increment, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { logAudit } from '../lib/audit';

interface ModulePlayerProps {
  module: Module;
  components: Component[];
  onClose: () => void;
  initialStepIdx?: number;
  onStepChange?: (stepIdx: number) => void;
  onComplete?: () => void;
}

export const ModulePlayer = ({ 
  module, 
  components, 
  onClose,
  initialStepIdx,
  onStepChange,
  onComplete
}: ModulePlayerProps) => {
  const { profile, partners } = useAuth();
  
  // Start from saved step progress if student matches this active module
  const [currentStepIdx, setCurrentStepIdx] = useState(() => {
    if (initialStepIdx !== undefined) {
      return initialStepIdx;
    }
    if (profile?.role === 'student' && profile?.lastActiveModuleId === module.id) {
      return profile.lastActiveStepIdx !== undefined ? profile.lastActiveStepIdx : -1;
    }
    return -1;
  });
  
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Active Media Resources overlays
  const [activeOverlay, setActiveOverlay] = useState<'code' | 'video' | 'ppt' | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeCodeFileIdx, setActiveCodeFileIdx] = useState<number>(0);

  // Log module opened action
  React.useEffect(() => {
    if (profile) {
      logAudit(profile, 'Open Module', `Opened curriculum module: "${module.title}"`, { moduleId: module.id, title: module.title });
    }
  }, [module.id, profile]);

  // Chapter Quiz Interactive States
  const [isTakingQuiz, setIsTakingQuiz] = useState(false);
  const [currentQuizQuestionIdx, setCurrentQuizQuestionIdx] = useState<number>(0);
  const [quizAnswers, setQuizAnswers] = useState<{ [key: string]: number }>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizCorrectCount, setQuizCorrectCount] = useState<number>(0);
  const [pointsEarned, setPointsEarned] = useState<number>(0);
  const [quizError, setQuizError] = useState<string>('');

  const steps = module.steps || [];
  const totalSteps = steps.length;

  // Persist student learning step progress to Firestore on change
  React.useEffect(() => {
    if (!profile || profile.role !== 'student' || currentStepIdx === -1) return;
    const saveProgressToDatabase = async () => {
      try {
        await updateDoc(doc(db, 'users', profile.uid), {
          lastActiveCourseId: module.courseId || '',
          lastActiveModuleId: module.id,
          lastActiveStepIdx: currentStepIdx,
          lastActiveAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Failed to save progress step in Firestore", err);
      }
    };
    saveProgressToDatabase();
  }, [currentStepIdx, module, profile]);

  // Handle onStepChange for integrated teaching panel
  React.useEffect(() => {
    if (onStepChange) {
      onStepChange(currentStepIdx);
    }
  }, [currentStepIdx, onStepChange]);
  
  const nextStep = () => {
    if (currentStepIdx < totalSteps - 1) {
      setCurrentStepIdx(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStepIdx > -1) {
      setCurrentStepIdx(prev => prev - 1);
    }
  };

  const handleFinish = async () => {
    if (!profile) return;
    if (profile.role !== 'student') {
      setIsCompleted(true);
      toast.info('Module preview completed');
      if (onComplete) {
        onComplete();
      }
      return;
    }
    setIsFinishing(true);
    try {
      // Award XP to student and all partners
      const uids = [profile.uid, ...partners.map(p => p.uid)];
      
      const promises = uids.map(uid => 
        updateDoc(doc(db, 'users', uid), {
          xp: increment(25) // Completion XP
        })
      );

      await Promise.all(promises);
      setIsCompleted(true);
      toast.success(`Module completed! +25 XP awarded to ${uids.length} students.`);
    } catch (e) {
      console.error("Failed to update XP", e);
      toast.error("Failed to save progress");
    } finally {
      setIsFinishing(false);
    }
  };

  const handleFinishClick = () => {
    if (module.quizQuestions && module.quizQuestions.length > 0) {
      setIsTakingQuiz(true);
      setCurrentQuizQuestionIdx(0);
      setQuizAnswers({});
      setQuizScore(null);
    } else {
      handleFinish();
    }
  };

  const handleQuizSubmit = async () => {
    const questions = module.quizQuestions || [];
    let correct = 0;
    questions.forEach((q, idx) => {
      const selected = quizAnswers[q.id || idx];
      if (selected === q.correctOptionIdx) {
        correct++;
      }
    });
    const pts = correct * 10;
    setQuizCorrectCount(correct);
    setPointsEarned(pts);

    if (profile && profile.role === 'student') {
      setIsFinishing(true);
      try {
        const uids = [profile.uid, ...partners.map(p => p.uid)];
        
        const attemptData = {
          studentId: profile.uid,
          moduleId: module.id,
          score: correct,
          totalQuestions: questions.length,
          pointsEarned: pts,
          completed: true,
          timestamp: new Date().toISOString()
        };

        await addDoc(collection(db, 'quizAttempts'), attemptData);

        const studentPromises = uids.map(uid => 
          updateDoc(doc(db, 'users', uid), {
            xp: increment(25),
            quizPoints: increment(pts),
            totalPoints: increment(pts + 25)
          })
        );
        await Promise.all(studentPromises);
        
        setIsCompleted(true);
        setIsTakingQuiz(false);
        toast.success(`Mock test completed! +${pts} Quiz Points and +25 XP awarded.`);
      } catch (e) {
        console.error(e);
        toast.error('Failed to complete quiz. Please try again.');
      } finally {
        setIsFinishing(false);
      }
    } else {
      setIsCompleted(true);
      setIsTakingQuiz(false);
      toast.info(`Review completed! Mock score: ${correct}/${questions.length}`);
    }
  };

  const currentStep = currentStepIdx === -1 ? null : steps[currentStepIdx];

  const codeFiles = module.files?.filter(f => f.type === 'code') || [];
  const videoFiles = module.files?.filter(f => f.type === 'video') || [];
  const pptFiles = module.files?.filter(f => f.type === 'ppt' || f.type === 'pdf') || [];
  const hasCode = codeFiles.length > 0;
  const hasVideo = videoFiles.length > 0 || !!module.videoUrl;
  const hasPPT = pptFiles.length > 0 || !!module.pptUrl;

  const renderResourceBar = () => {
    return (
      <div className="grid grid-cols-3 gap-2.5 bg-white/5 p-2 rounded-xl border border-white/10 my-3">
        <button
          type="button"
          onClick={() => {
            if (hasCode) {
              setActiveOverlay('code');
              setActiveCodeFileIdx(0);
            } else {
              toast.error("No code block available for this module");
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all gap-1",
            hasCode 
              ? "bg-blue-500/10 border-blue-500/20 hover:border-blue-500/50 text-blue-400 cursor-pointer animate-pulse"
              : "bg-white/5 border-white/5 text-white/20 cursor-not-allowed"
          )}
        >
          <Code size={16} />
          <span className="text-[9px] font-bold uppercase tracking-wider">Source Code</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (hasVideo) {
              setActiveOverlay('video');
            } else {
              toast.error("No video file available for this module");
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all gap-1",
            hasVideo 
              ? "bg-[#F27D26]/10 border-[#F27D26]/25 hover:border-[#F27D26]/50 text-[#F27D26] cursor-pointer"
              : "bg-white/5 border-white/5 text-white/20 cursor-not-allowed"
          )}
        >
          <Video size={16} />
          <span className="text-[9px] font-bold uppercase tracking-wider">Lesson Video</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (hasPPT) {
              setActiveOverlay('ppt');
            } else {
              toast.error("No presentation/PDF file available for this module");
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all gap-1",
            hasPPT 
              ? "bg-purple-500/10 border-purple-500/20 hover:border-purple-500/50 text-purple-400 cursor-pointer"
              : "bg-white/5 border-white/5 text-white/20 cursor-not-allowed"
          )}
        >
          <FileText size={16} />
          <span className="text-[9px] font-bold uppercase tracking-wider">PDF / Slides</span>
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#151619]">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white"
          >
            <X size={20} />
          </button>
          <div className="h-4 w-[1px] bg-white/10" />
          <h2 className="font-bold text-lg">{module.title}</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <span className="text-[10px] font-black text-[#F27D26] uppercase tracking-widest leading-none">
              {currentStepIdx === -1 ? 'OVERVIEW' : `STEP ${currentStepIdx + 1} / ${totalSteps}`}
            </span>
          </div>
          <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden">
             <motion.div 
               className="h-full bg-[#F27D26]" 
               initial={{ width: 0 }}
               animate={{ width: `${((currentStepIdx + 2) / (totalSteps + 1)) * 100}%` }}
             />
          </div>
        </div>
      </div>

      {/* Main Content Area - Made Fully Scrollable vertically for lengthy student chapters */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar">
        <div className="min-h-full flex items-center justify-center py-4">
          <AnimatePresence mode="wait">
            {isTakingQuiz ? (
              <motion.div
                key={`quiz-q-${currentQuizQuestionIdx}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-3xl w-full bg-[#151619] border border-white/10 rounded-[2.5rem] p-8 lg:p-12 space-y-8 shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#F27D26]/10 text-[#F27D26]">
                      <HelpCircle size={24} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black tracking-widest text-[#F27D26] uppercase">CHAPTER MOCK TEST</span>
                      <h3 className="text-xl font-bold mt-0.5">Question {currentQuizQuestionIdx + 1} of {(module.quizQuestions || []).length}</h3>
                    </div>
                  </div>
                  <div className="px-3.5 py-1.5 bg-[#F27D26]/10 text-[#F27D26] rounded-xl font-mono text-xs font-bold border border-[#F27D26]/20">
                    Progress: {Math.round(((currentQuizQuestionIdx) / (module.quizQuestions || []).length) * 100)}%
                  </div>
                </div>

                <div className="space-y-6">
                  {module.quizQuestions && module.quizQuestions[currentQuizQuestionIdx] && (
                    <div className="space-y-6 bg-black/40 p-6 rounded-2xl border border-white/5 animate-fade-in">
                      <h4 className="text-lg font-bold text-white/95 leading-relaxed">
                        {module.quizQuestions[currentQuizQuestionIdx].question}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {module.quizQuestions[currentQuizQuestionIdx].options.map((opt, optIdx) => {
                          const questionId = module.quizQuestions![currentQuizQuestionIdx].id || currentQuizQuestionIdx;
                          const isSelected = quizAnswers[questionId] === optIdx;
                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => setQuizAnswers(prev => ({ ...prev, [questionId]: optIdx }))}
                              className={cn(
                                "text-left p-4 rounded-xl border text-xs font-semibold transition-all flex items-center gap-3 min-h-[56px]",
                                isSelected 
                                  ? "bg-[#F27D26]/10 border-[#F27D26] text-white"
                                  : "bg-white/5 border-white/5 hover:border-white/10 text-white/50 hover:text-white"
                              )}
                            >
                              <span className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] border shrink-0",
                                isSelected ? "bg-[#F27D26] text-white border-transparent" : "bg-black/40 text-white/40 border-white/10"
                              )}>
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className="leading-relaxed">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentQuizQuestionIdx > 0) {
                          setCurrentQuizQuestionIdx(prev => prev - 1);
                        } else {
                          setIsTakingQuiz(false);
                        }
                      }}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all border border-white/10 text-xs uppercase tracking-widest"
                    >
                      {currentQuizQuestionIdx > 0 ? "Previous MCQ" : "Back to Steps"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentQuizQuestionIdx < (module.quizQuestions || []).length - 1) {
                          setCurrentQuizQuestionIdx(prev => prev + 1);
                        } else {
                          handleQuizSubmit();
                        }
                      }}
                      disabled={isFinishing}
                      className="flex-[2] py-4 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#F27D26]/20 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <span>{currentQuizQuestionIdx < (module.quizQuestions || []).length - 1 ? "Submit & Next" : isFinishing ? "Processing..." : "Submit & Finish"}</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : isCompleted ? (
              <motion.div 
                key="completed"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-8"
              >
                <div className="w-32 h-32 bg-[#F27D26]/10 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-[#F27D26]/20">
                  <Trophy size={64} className="text-[#F27D26]" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-5xl font-bold tracking-tighter">Congratulations!</h3>
                  <p className="text-white/40 text-lg max-w-md mx-auto">
                    You and your team have successfully completed the <strong>{module.title}</strong> interactive module.
                  </p>
                  
                  <div className="flex flex-col items-center justify-center gap-2.5 mt-4">
                    <div className="flex items-center justify-center gap-2 text-[#F27D26] font-bold text-xl bg-[#F27D26]/5 px-4 py-1.5 rounded-full border border-[#F27D26]/10">
                      <Zap size={22} /> +25 XP EARNED
                    </div>
                    {module.quizQuestions && module.quizQuestions.length > 0 && (
                      <div className="flex items-center justify-center gap-2 text-green-400 font-bold text-lg bg-green-500/5 px-4 py-1.5 rounded-full border border-green-500/10">
                        <Trophy size={18} /> +{pointsEarned} QUIZ POINTS AWARDED ({quizCorrectCount} / {module.quizQuestions.length} Correct)
                      </div>
                    )}
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="px-10 py-4 bg-white text-black rounded-2xl font-bold text-lg hover:bg-white/80 transition-all uppercase tracking-wider"
                >
                  Back to Dashboard
                </button>
              </motion.div>
            ) : currentStepIdx === -1 ? (
               <motion.div 
                 key="overview"
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
               >
                 {/* Left Side (swapped): Thumbnail Image first */}
                 <div className="lg:col-span-7 relative group">
                   <div className="absolute -inset-4 bg-gradient-to-tr from-[#F27D26]/20 to-transparent blur-2xl rounded-[2rem] opacity-50 group-hover:opacity-100 transition-opacity" />
                   <div className="relative rounded-[2rem] overflow-hidden border border-white/10 bg-[#151619] flex items-center justify-center p-4">
                     {module.thumbnailUrl ? (
                       <img src={module.thumbnailUrl} alt={module.title} className="w-full h-auto max-h-[60vh] object-contain rounded-2xl" referrerPolicy="no-referrer" />
                     ) : (
                       <LayoutGrid size={120} className="text-white/5" />
                     )}
                   </div>
                 </div>

                 {/* Right Side: Overview text */}
                 <div className="lg:col-span-5 space-y-6">
                   <div className="space-y-2">
                     <h3 className="text-4xl font-bold tracking-tight">{module.title}</h3>
                   </div>
                   {renderResourceBar()}
                   <p className="text-lg text-white/60 leading-relaxed">
                     {module.description || "In this module, we will explore the practical implementation of this robotics project. Follow the step-by-step instructions to build your prototype."}
                   </p>
                   
                   <div className="pt-6">
                     <button 
                       onClick={nextStep}
                       className="px-10 py-4.5 bg-[#F27D26] text-white rounded-2xl font-bold text-lg hover:bg-[#d66a1e] transition-all flex items-center gap-3 shadow-xl shadow-[#F27D26]/20"
                     >
                       Get Started <ChevronRight size={20} />
                     </button>
                   </div>
                 </div>
               </motion.div>
            ) : (
              <motion.div 
                key={currentStep?.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
              >
                {/* [First change]: Image is placed on the LEFT column (rendered first) */}
                {/* [Second change]: Image occupies lg:col-span-7 (~58% width) to fill more page space while keeping strict aspect-[4/3] landscape */}
                <div className="lg:col-span-7 space-y-8 lg:sticky lg:top-4">
                  <div className="w-full rounded-[2rem] overflow-hidden border border-white/10 bg-[#151619] shadow-inner relative group flex items-center justify-center p-2 min-h-[200px]">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    {currentStep?.imageUrl ? (
                      <img src={currentStep.imageUrl} alt={currentStep.title} className="w-full h-auto max-h-[60vh] object-contain rounded-2xl" />
                    ) : (
                      <div className="w-full min-h-[250px] flex flex-col items-center justify-center text-white/5 space-y-4 py-12">
                         <Info size={80} />
                         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/10">Reference View</p>
                      </div>
                    )}
                  </div>

                  {/* Requirements Context */}
                  {(module.componentIds || []).length > 0 && indexIsZeroOrFirst(currentStepIdx) && (
                     <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Required From Kit</h4>
                       <div className="grid grid-cols-3 gap-3">
                         {module.componentIds?.map(id => {
                           const comp = components.find(c => c.id === id);
                           if (!comp) return null;
                           return (
                             <div key={id} className="flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10 group/comp transition-colors hover:border-[#F27D26]/30">
                               <div className="w-12 h-12 rounded-lg bg-black/40 flex items-center justify-center overflow-hidden">
                                 {comp.imageUrl ? (
                                   <img src={comp.imageUrl} alt={comp.name} className="w-full h-full object-cover" />
                                 ) : (
                                   <LayoutGrid size={20} className="text-white/10" />
                                 )}
                               </div>
                               <span className="text-[10px] font-bold text-center text-white/60 group-hover/comp:text-white truncate w-full">{comp.name}</span>
                             </div>
                           );
                         })}
                       </div>
                     </div>
                  )}
                </div>

                {/* [First change]: Written content is placed on the RIGHT column (rendered second) */}
                {/* [Second change]: Written content occupies lg:col-span-5 to pair beautifully with the large image */}
                <div className="lg:col-span-5 space-y-8">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-[#F27D26] uppercase tracking-[0.2em]">Step {currentStepIdx + 1}</span>
                    <h3 className="text-3xl font-bold tracking-tight">{currentStep?.title}</h3>
                  </div>

                  {renderResourceBar()}

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-8 min-h-[300px]">
                     <p className="text-xl text-white/80 leading-relaxed whitespace-pre-wrap font-medium">
                       {currentStep?.content}
                     </p>
                  </div>

                  {/* Progress Controls */}
                  <div className="flex items-center gap-4 pt-4">
                    <button 
                      onClick={prevStep}
                      className="flex-1 flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all border border-white/10"
                    >
                      <ChevronLeft size={20} /> Back
                    </button>
                    {currentStepIdx < totalSteps - 1 ? (
                      <button 
                        onClick={nextStep}
                        className="flex-[2] flex items-center justify-center gap-2 py-4 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-2xl font-bold transition-all shadow-lg shadow-[#F27D26]/10"
                      >
                        Next Step <ChevronRight size={20} />
                      </button>
                    ) : (
                      <button 
                        onClick={handleFinishClick}
                        disabled={isFinishing}
                        className="flex-[2] flex items-center justify-center gap-2 py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold transition-all disabled:opacity-20 shadow-lg shadow-green-500/10"
                      >
                        {isFinishing ? "Saving..." : "Finish Module"} <CheckCircle size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Keyboard Hint */}
      <div className="h-10 bg-black/50 flex items-center justify-center border-t border-white/5">
        <p className="text-[10px] text-white/20 uppercase font-black tracking-widest flex items-center gap-4">
          <span>Use <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/40">Next</kbd> and <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/40">Back</kbd> to navigate</span>
        </p>
      </div>

      {/* Media Overlays */}
      <AnimatePresence>
        {activeOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0a0b0d]/95 backdrop-blur-md flex items-center justify-center p-4 lg:p-8"
          >
            <div className="bg-[#151619] border border-white/10 w-full max-w-5xl h-[85vh] rounded-[2rem] flex flex-col overflow-hidden shadow-2xl relative">
              {/* Overlay Header */}
              <div className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-black/30">
                <div className="flex items-center gap-3">
                  {activeOverlay === 'code' && (
                    <>
                      <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg"><Code size={20} /></div>
                      <span className="font-bold text-white uppercase tracking-wider text-sm">Source Code Workspace</span>
                    </>
                  )}
                  {activeOverlay === 'video' && (
                    <>
                      <div className="p-2 bg-[#F27D26]/10 text-[#F27D26] rounded-lg"><Video size={20} /></div>
                      <span className="font-bold text-white uppercase tracking-wider text-sm">Interactive Media Video</span>
                    </>
                  )}
                  {activeOverlay === 'ppt' && (
                    <>
                      <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg"><FileText size={20} /></div>
                      <span className="font-bold text-white uppercase tracking-wider text-sm">PDF Slide Deck / Presentation</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveOverlay(null)}
                  className="p-2 hover:bg-white/5 rounded-full text-white/50 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Overlay Content body */}
              <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
                {activeOverlay === 'code' && (
                  <div className="space-y-6 h-full flex flex-col">
                    {codeFiles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-white/20 gap-4">
                        <Code size={64} />
                        <p className="text-sm font-medium">No code files or blocks are present in this module.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                        {/* File selector list */}
                        <div className="w-full md:w-64 shrink-0 space-y-2 border-r border-white/5 pr-4 overflow-y-auto max-h-[30vh] md:max-h-full">
                          <span className="text-[10px] font-black tracking-widest text-white/30 uppercase block mb-3">CONTAINS {codeFiles.length} CODE FILES</span>
                          {codeFiles.map((file, fIdx) => (
                            <button
                              key={fIdx}
                              className={cn(
                                "w-full text-left p-3 rounded-xl border transition-all flex items-center gap-2.5 text-xs text-white",
                                activeCodeFileIdx === fIdx 
                                  ? "bg-[#F27D26]/10 border-[#F27D26]/35 text-white font-bold" 
                                  : "border-white/5 bg-white/5 hover:bg-white/10"
                              )}
                              onClick={() => {
                                setActiveCodeFileIdx(fIdx);
                                setCopiedCode(false);
                              }}
                            >
                              <Code size={14} className={cn("shrink-0", activeCodeFileIdx === fIdx ? "text-[#F27D26]" : "text-blue-400")} />
                              <span className="font-mono truncate">{file.name}</span>
                            </button>
                          ))}
                        </div>

                        {/* Code editor / viewer block */}
                        <div className="flex-1 flex flex-col space-y-4 overflow-y-auto min-h-0">
                          {codeFiles[activeCodeFileIdx] && (
                            <div className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden flex flex-col flex-1 min-h-[300px]">
                              <div className="h-12 bg-black/60 border-b border-white/5 px-4 flex items-center justify-between">
                                <span className="font-mono text-xs text-[#F27D26] font-semibold">{codeFiles[activeCodeFileIdx].name}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(codeFiles[activeCodeFileIdx].url || "");
                                    setCopiedCode(true);
                                    toast.success("Code successfully copied to clipboard!");
                                    setTimeout(() => setCopiedCode(false), 2000);
                                  }}
                                  className="px-3 py-1.5 bg-[#F27D26]/10 hover:bg-[#F27D26]/20 text-[#F27D26] rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-[#F27D26]/20"
                                >
                                  {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                                  {copiedCode ? "Copied!" : "Copy Code"}
                                </button>
                              </div>
                              <pre className="flex-1 p-6 font-mono text-xs text-white/90 overflow-auto bg-[#0a0a0c] select-all leading-relaxed whitespace-pre font-medium custom-scrollbar">
                                <code>{codeFiles[activeCodeFileIdx].url || "// File is empty"}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeOverlay === 'video' && (
                  <div className="w-full h-full flex flex-col justify-center items-center">
                    {module.videoUrl || videoFiles.length > 0 ? (
                      <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black shadow-inner max-w-4xl">
                        <iframe
                          src={getEmbedUrl(module.videoUrl || (videoFiles[0]?.url || ""))}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-white/20 gap-4">
                        <Video size={64} />
                        <p className="text-sm font-medium">No video presentation uploaded for this module.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeOverlay === 'ppt' && (
                  <div className="w-full h-full flex flex-col justify-center items-center">
                    {module.pptUrl || pptFiles.length > 0 ? (
                      <div className="w-full h-full max-w-5xl rounded-2xl overflow-hidden border border-white/10 bg-[#151619] flex flex-col">
                        <div className="flex-1 min-h-0 bg-white rounded-t-2xl overflow-hidden">
                          <iframe
                            src={getViewerUrl(module.pptUrl || (pptFiles[0]?.url || ""))}
                            className="w-full h-full"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="p-3 bg-black/60 border-t border-white/5 flex items-center justify-between px-6 shrink-0 rounded-b-2xl">
                          <span className="text-xs text-white/60">Having trouble viewing the presentation?</span>
                          <a
                            href={module.pptUrl || (pptFiles[0]?.url || "")}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-[#F27D26] hover:underline flex items-center gap-1 bg-[#F27D26]/10 px-3 py-1.5 rounded-lg border border-[#F27D26]/20 transition-all hover:bg-[#F27D26]/20"
                          >
                            <span>Open in New Tab</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-white/20 gap-4">
                        <FileText size={64} />
                        <p className="text-sm font-medium">No presentation slide/PDF uploaded for this module.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const getEmbedUrl = (url: string) => {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}?autoplay=1`;
    }
  }
  return url;
};

const getViewerUrl = (url: string) => {
  if (url.includes('drive.google.com')) {
    let embedUrl = url;
    if (embedUrl.includes('/view')) {
      embedUrl = embedUrl.replace('/view', '/preview');
    } else if (embedUrl.includes('/edit')) {
      embedUrl = embedUrl.replace('/edit', '/preview');
    } else if (!embedUrl.includes('/preview')) {
      if (embedUrl.includes('?')) {
        embedUrl = embedUrl.split('?')[0] + '/preview';
      }
    }
    return embedUrl;
  }
  if (url.toLowerCase().endsWith('.pdf')) {
    return url;
  }
  if (url.includes('docs.google.com') || url.toLowerCase().endsWith('.ppt') || url.toLowerCase().endsWith('.pptx')) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  }
  return url;
};

function indexIsZeroOrFirst(idx: number) {
  return idx === 0 || idx === -1;
}

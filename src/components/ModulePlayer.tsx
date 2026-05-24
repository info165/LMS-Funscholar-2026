import React, { useState } from 'react';
import { Module, ModuleStep, Component } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, LayoutGrid, Info, CheckCircle, Trophy, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

interface ModulePlayerProps {
  module: Module;
  components: Component[];
  onClose: () => void;
}

export const ModulePlayer = ({ module, components, onClose }: ModulePlayerProps) => {
  const { profile, partners } = useAuth();
  const [currentStepIdx, setCurrentStepIdx] = useState(-1); // -1 is Overview, 0+ are steps
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const steps = module.steps || [];
  const totalSteps = steps.length;
  
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

  const currentStep = currentStepIdx === -1 ? null : steps[currentStepIdx];

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

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8 lg:p-12">
        <AnimatePresence mode="wait">
          {isCompleted ? (
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
                <div className="flex items-center justify-center gap-2 text-[#F27D26] font-bold text-xl">
                  <Zap size={24} /> +25 XP EARNED
                </div>
              </div>
              <button 
                onClick={onClose}
                className="px-10 py-4 bg-white text-black rounded-2xl font-bold text-lg hover:bg-white/80 transition-all"
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
               className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
             >
               <div className="space-y-6">
                 <div className="space-y-2">
                   <span className="text-[10px] font-black text-[#F27D26] uppercase tracking-[0.2em]">Project Objective</span>
                   <h3 className="text-4xl font-bold tracking-tight">{module.title}</h3>
                 </div>
                 <p className="text-lg text-white/60 leading-relaxed">
                   {module.description || "In this module, we will explore the practical implementation of this robotics project. Follow the step-by-step instructions to build your prototype."}
                 </p>
                 
                 <div className="pt-6">
                   <button 
                     onClick={nextStep}
                     className="px-8 py-4 bg-[#F27D26] text-white rounded-2xl font-bold text-lg hover:bg-[#d66a1e] transition-all flex items-center gap-3 shadow-xl shadow-[#F27D26]/20"
                   >
                     Get Started <ChevronRight size={20} />
                   </button>
                 </div>
               </div>

               <div className="relative group">
                 <div className="absolute -inset-4 bg-gradient-to-tr from-[#F27D26]/20 to-transparent blur-2xl rounded-[2rem] opacity-50 group-hover:opacity-100 transition-opacity" />
                 <div className="relative aspect-square rounded-[2rem] overflow-hidden border border-white/10 bg-[#151619] flex items-center justify-center p-8">
                   {module.thumbnailUrl ? (
                     <img src={module.thumbnailUrl} alt={module.title} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                   ) : (
                     <LayoutGrid size={120} className="text-white/5" />
                   )}
                 </div>
               </div>
             </motion.div>
          ) : (
            <motion.div 
              key={currentStep?.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-start"
            >
              {/* Left Side: Info */}
              <div className="space-y-8">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-[#F27D26] uppercase tracking-[0.2em]">Step {currentStepIdx + 1}</span>
                  <h3 className="text-3xl font-bold tracking-tight">{currentStep?.title}</h3>
                </div>

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
                      onClick={handleFinish}
                      disabled={isFinishing}
                      className="flex-[2] flex items-center justify-center gap-2 py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold transition-all disabled:opacity-20 shadow-lg shadow-green-500/10"
                    >
                      {isFinishing ? "Saving..." : "Finish Module"} <CheckCircle size={20} />
                    </button>
                  )}
                </div>
              </div>

              {/* Right Side: Media/Context */}
              <div className="space-y-8 sticky top-0">
                <div className="aspect-[4/3] rounded-[2rem] overflow-hidden border border-white/10 bg-[#151619] shadow-inner relative group">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                  {currentStep?.imageUrl ? (
                    <img src={currentStep.imageUrl} alt={currentStep.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/5 space-y-4">
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Keyboard Hint */}
      <div className="h-10 bg-black/50 flex items-center justify-center border-t border-white/5">
        <p className="text-[10px] text-white/20 uppercase font-black tracking-widest flex items-center gap-4">
          <span>Use <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/40">Next</kbd> and <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/40">Back</kbd> to navigate</span>
        </p>
      </div>
    </div>
  );
};

function indexIsZeroOrFirst(idx: number) {
  return idx === 0 || idx === -1;
}

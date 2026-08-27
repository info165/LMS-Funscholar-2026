import React, { useState } from 'react';
import { Module, School, ContentActivation, UserProfile } from '../types';
import { X, Plus, Trash2, School as SchoolIcon, Layers, BookOpen, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface ChapterActivationModalProps {
  module: Module;
  schools: School[];
  activations: ContentActivation[];
  profile: UserProfile | null;
  onClose: () => void;
}

export default function ChapterActivationModal({
  module,
  schools,
  activations,
  profile,
  onClose
}: ChapterActivationModalProps) {
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [classSection, setClassSection] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const allowedSchools = profile?.role === 'admin'
    ? schools
    : schools.filter(s => profile?.schoolIds?.includes(s.id));

  const moduleActivations = activations.filter(a => a.moduleId === module.id);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId) {
      toast.error('Please select a school mapping');
      return;
    }
    const cleanSection = classSection.trim();
    if (!cleanSection) {
      toast.error('Please enter a grade number');
      return;
    }
    if (!/^\d+$/.test(cleanSection)) {
      toast.error('Grade must contain only numbers (e.g. 6, 7, 8)');
      return;
    }
    setIsSaving(true);
    const activationId = `${selectedSchoolId}_${module.id}_${cleanSection}`;
    
    try {
      await setDoc(doc(db, 'activations', activationId), {
        id: activationId,
        moduleId: module.id,
        schoolId: selectedSchoolId,
        teacherId: profile?.uid || 'admin',
        classSection: cleanSection,
        activated: true
      });
      toast.success(`Chapter activated successfully for grade ${cleanSection}`);
      setClassSection('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save activation configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (actId: string) => {
    try {
      await deleteDoc(doc(db, 'activations', actId));
      toast.success('Chapter activation revoked');
    } catch (err) {
      console.error(err);
      toast.error('Failed to revoke activation');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#151619] border border-white/10 rounded-2xl p-6 text-white overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F27D26]/10 rounded-lg text-[#F27D26]">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-none">Chapter Activations</h3>
              <p className="text-xs text-white/40 mt-1.5 font-medium">Control student view for "{module.title}"</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 px-2 text-white/30 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content View Grid */}
        <div className="space-y-6">
          
          {/* Form to Add Activation rules */}
          <section className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F27D26] mb-3 flex items-center gap-1.5">
              <Plus size={14} /> Add Class Activation Rule
            </h4>
            
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/40">School</label>
                  <select
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    required
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#F27D26] text-white"
                  >
                    <option value="">Select target...</option>
                    {allowedSchools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-[#F27D26]">Class Grade (Required - Numbers Only)</label>
                  <input
                    type="text"
                    required
                    value={classSection}
                    onChange={(e) => setClassSection(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 6, 7 or 8"
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#F27D26] text-white placeholder-white/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? 'Activating...' : 'Activate Chapter'}
              </button>
            </form>
          </section>

          {/* Active Activations Table/List */}
          <section className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/60">Active Access Nodes ({moduleActivations.length})</h4>
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1 border border-white/5 rounded-xl p-2 bg-black/20">
              <AnimatePresence initial={false}>
                {moduleActivations.map((act) => {
                  const sName = schools.find(s => s.id === act.schoolId)?.name || 'Unknown School';
                  return (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <SchoolIcon size={14} className="text-[#F27D26]/80" />
                        <div>
                          <p className="font-bold">{sName}</p>
                          <p className="text-[10px] text-[#F27D26]/75 font-bold uppercase tracking-wider mt-0.5">
                            Grade: {act.classSection}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(act.id)}
                        className="p-1.5 text-white/30 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                        title="Remove activation rule"
                      >
                        <Trash2 size={13} />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {moduleActivations.length === 0 && (
                <div className="py-8 text-center text-white/30 flex flex-col items-center gap-2">
                  <AlertCircle size={20} className="text-white/10" />
                  <p className="text-[10px] uppercase font-bold tracking-widest">No Active Student Access</p>
                  <p className="text-[9px] lowercase max-w-xs leading-normal font-sans">
                    Students won't see this chapter until you activate it for their school/class above.
                  </p>
                </div>
              )}
            </div>
          </section>

        </div>
      </motion.div>
    </div>
  );
}

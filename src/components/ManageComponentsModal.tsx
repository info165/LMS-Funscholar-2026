import React, { useState } from 'react';
import { Component } from '../types';
import { X, Upload, Plus, Trash2, LayoutGrid, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ManageComponentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  components: Component[];
  onAddComponent: (name: string, file: File | null) => Promise<void>;
  onDeleteComponent: (id: string, name: string) => Promise<void>;
}

export default function ManageComponentsModal({ 
  isOpen, 
  onClose, 
  components, 
  onAddComponent, 
  onDeleteComponent 
}: ManageComponentsModalProps) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onAddComponent(name, file);
      setName('');
      setFile(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5 bg-opacity-40">
          <div>
            <h3 className="text-xl font-bold text-white">Component Repository</h3>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-mono">Manage kit pieces & equipment sensors</p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Add Component form */}
        <div className="p-6 border-b border-white/5 bg-white/[0.02]">
          <form onSubmit={handleSubmit} className="flex gap-4 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Component Sensor/Part Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26] text-white"
                placeholder="e.g. HC-SR04 Ultrasonic Sensor"
              />
            </div>
            <div className="space-y-1 shrink-0">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50 block text-center">Part Image</label>
              <label className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5 overflow-hidden border-dashed transition-colors">
                {file ? (
                  <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Upload size={16} className="text-white/20" />
                )}
                <input type="file" className="hidden" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <button 
              type="submit"
              disabled={isSaving || !name.trim()}
              className="bg-[#F27D26] text-white px-5 py-2 h-10 rounded-lg font-bold hover:bg-[#d66a1e] transition-colors disabled:opacity-40 flex items-center gap-2 whitespace-nowrap text-sm"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Add Part
            </button>
          </form>
        </div>

        {/* List of existing components */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {components.map(comp => (
              <div key={comp.id} className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center gap-3 group hover:border-white/10 transition-colors">
                {comp.imageUrl ? (
                  <img src={comp.imageUrl} alt={comp.name} className="w-10 h-10 rounded-lg object-cover border border-white/5 shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white/20 shrink-0">
                    <LayoutGrid size={16} />
                  </div>
                )}
                <span className="text-xs font-medium flex-1 truncate text-white/80">{comp.name}</span>
                <button 
                  type="button"
                  onClick={() => onDeleteComponent(comp.id, comp.name)}
                  className="p-1.5 text-white/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  title="Delete from repo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {components.length === 0 && (
              <div className="col-span-full py-12 text-center text-white/20 text-xs font-mono uppercase tracking-widest border border-dashed border-white/5 rounded-xl">
                No parts registered in library portfolio
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

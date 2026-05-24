import React, { useState, useEffect } from 'react';
import { Course, Module, Component, ContentFile, ModuleStep } from '../types';
import { X, Upload, Plus, Trash2, LayoutGrid, ChevronRight, FileVideo, File as FileGeneric, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface EditModuleModalProps {
  module: Module | null;
  courses: Course[];
  components: Component[];
  onClose: () => void;
  onSave: (moduleId: string, updatedFields: Partial<Module>) => Promise<void>;
  uploadFile: (file: File, path: string) => Promise<string>;
}

export default function EditModuleModal({ 
  module, 
  courses, 
  components, 
  onClose, 
  onSave, 
  uploadFile 
}: EditModuleModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [courseId, setCourseId] = useState('');
  const [componentIds, setComponentIds] = useState<string[]>([]);
  const [files, setFiles] = useState<ContentFile[]>([]);
  const [steps, setSteps] = useState<ModuleStep[]>([]);
  
  const [newFilesToUpload, setNewFilesToUpload] = useState<{ file: File; type: 'video' | 'pdf' | 'ppt' | 'image' | 'doc' }[]>([]);
  const [newStepFiles, setNewStepFiles] = useState<{ [key: string]: File }>({}); 
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (module) {
      setTitle(module.title || '');
      setDescription(module.description || '');
      setDriveUrl(module.driveUrl || '');
      setThumbnailUrl(module.thumbnailUrl || '');
      setCourseId(module.courseId || '');
      setComponentIds(module.componentIds || []);
      setFiles(module.files || []);
      setSteps(module.steps || []);
      setThumbnailFile(null);
      setNewFilesToUpload([]);
      setNewStepFiles({});
      setUploadProgress(0);
    }
  }, [module]);

  if (!module) return null;

  const handleApplyTemplate = () => {
    const templateSteps: ModuleStep[] = [
      { id: 'step-title', title: 'Topic Title', content: '## LED Blinking using Arduino\n\nWelcome to the first step of this exciting project!' },
      { id: 'step-objective', title: 'Project Objective', content: 'The objective of this project is to learn how to connect an LED to an Arduino board and make it blink at a specific interval.' },
      { id: 'step-components', title: 'List of Components', content: '1. Arduino Uno\n2. LED (any color)\n3. 220 Ohm Resistor\n4. Breadboard\n5. Jumper Wires' },
      { id: 'step-connections', title: 'Connection Steps', content: '1. Connect the long leg (anode) of the LED to digital pin 13 on the Arduino.\n2. Connect the short leg (cathode) of the LED to one end of the 220 Ohm resistor.\n3. Connect the other end of the resistor to the GND pin on the Arduino.' },
      { id: 'step-code', title: 'Arduino Code', content: '```cpp\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n```' },
      { id: 'step-upload', title: 'How to Upload Code', content: '1. Connect your Arduino Uno to your computer using a USB cable.\n2. Open the Arduino IDE.\n3. Copy and paste the code into the IDE.\n4. Select the correct board and port from the Tools menu.\n5. Click the Upload button.' },
      { id: 'step-results', title: 'Expected Results', content: 'Once the code is uploaded, the LED connected to digital pin 13 should start blinking on and off at 1-second intervals.' },
    ];
    setSteps(templateSteps);
    toast.success('Applied standard project structure template');
  };

  const handleAddStep = () => {
    const newStep: ModuleStep = {
      id: 'step_' + Math.random().toString(36).substr(2, 9),
      title: '',
      content: ''
    };
    setSteps(prev => [...prev, newStep]);
  };

  const handleUpdateStep = (id: string, updates: Partial<ModuleStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleRemoveStep = (id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
    setNewStepFiles(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleMoveStep = (id: string, direction: 'up' | 'down') => {
    const idx = steps.findIndex(s => s.id === id);
    if (direction === 'up' && idx > 0) {
      const next = [...steps];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      setSteps(next);
    } else if (direction === 'down' && idx < steps.length - 1) {
      const next = [...steps];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      setSteps(next);
    }
  };

  const handleToggleComponent = (compId: string) => {
    setComponentIds(prev =>
      prev.includes(compId) ? prev.filter(id => id !== compId) : [...prev, compId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !courseId) {
      toast.error('Module Title and Course must be selected');
      return;
    }

    setIsSaving(true);
    setUploadProgress(10);
    try {
      let finalThumbnailUrl = thumbnailUrl;
      if (thumbnailFile) {
        setUploadProgress(20);
        const ext = thumbnailFile.name.split('.').pop();
        finalThumbnailUrl = await uploadFile(thumbnailFile, `modules/${courseId}/${title}_thumb_${Date.now()}.${ext}`);
      }

      setUploadProgress(40);
      const uploadedFiles: ContentFile[] = [...files];
      for (let i = 0; i < newFilesToUpload.length; i++) {
        const item = newFilesToUpload[i];
        setUploadProgress(40 + Math.floor((i / newFilesToUpload.length) * 30));
        const ext = item.file.name.split('.').pop();
        const url = await uploadFile(item.file, `modules/${courseId}/${title}_${item.type}_${Date.now()}.${ext}`);
        uploadedFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          name: item.file.name,
          url,
          type: item.type
        });
      }

      setUploadProgress(70);
      const finalSteps: ModuleStep[] = [];
      const stepEntries = Object.entries(newStepFiles);
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        let imageUrl = step.imageUrl || '';
        if (newStepFiles[step.id]) {
          setUploadProgress(70 + Math.floor((i / steps.length) * 20));
          const file = newStepFiles[step.id];
          const ext = file.name.split('.').pop();
          imageUrl = await uploadFile(file, `modules/${courseId}/steps/${step.id}_${Date.now()}.${ext}`);
        }
        finalSteps.push({ ...step, imageUrl });
      }

      setUploadProgress(95);
      await onSave(module.id, {
        title,
        description,
        driveUrl,
        courseId,
        thumbnailUrl: finalThumbnailUrl,
        componentIds,
        files: uploadedFiles,
        steps: finalSteps
      });
      setUploadProgress(100);
      toast.success('Module successfully updated!');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update module settings');
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
        className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div>
            <h3 className="text-xl font-bold text-white">Edit Module Content</h3>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-mono">Alter steps & media linkages</p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Module Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#F27D26]">Course Assignment</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26]"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26] h-20 resize-none font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Google Drive Linked ID URL</label>
              <input
                type="url"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26] font-mono text-xs"
                placeholder="Google Doc Embed Viewer Link"
              />
            </div>

            {/* Thumbnail */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Module Display Thumbnail</label>
              <div className="flex gap-4 items-center">
                <label className="flex-1 flex flex-col items-center justify-center h-24 border border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/5 transition-all">
                  <Upload size={18} className="text-white/20 mb-1" />
                  <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                    {thumbnailFile ? thumbnailFile.name : 'Choose New Image'}
                  </span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)} />
                </label>
                {(thumbnailUrl || thumbnailFile) && (
                  <div className="w-24 h-24 rounded-lg bg-black border border-white/10 overflow-hidden shrink-0">
                    <img 
                      src={thumbnailFile ? URL.createObjectURL(thumbnailFile) : thumbnailUrl} 
                      alt="Thumbnail" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Steps interactive */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold tracking-widest text-[#F27D26]">Native Interactive Steps</label>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={handleApplyTemplate}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-[9px] text-white/60 font-bold uppercase transition-all"
                  >
                    Quick Structure
                  </button>
                  <button 
                    type="button"
                    onClick={handleAddStep}
                    className="px-2.5 py-1 bg-[#F27D26]/10 hover:bg-[#F27D26]/20 border border-[#F27D26]/20 text-[9px] text-[#F27D26] font-bold uppercase transition-all flex items-center gap-1"
                  >
                    <Plus size={10} /> Add Step
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.id} className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3 relative group/step">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-widest text-[#F27D26]">STEP {index + 1}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover/step:opacity-100 transition-opacity">
                        <button type="button" onClick={() => handleMoveStep(step.id, 'up')} className="p-1 hover:text-white text-white/40"><ChevronRight size={14} className="-rotate-90" /></button>
                        <button type="button" onClick={() => handleMoveStep(step.id, 'down')} className="p-1 hover:text-white text-white/40"><ChevronRight size={14} className="rotate-90" /></button>
                        <button type="button" onClick={() => handleRemoveStep(step.id)} className="p-1 hover:text-red-500 text-white/40"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <input 
                      type="text"
                      placeholder="Step Title (e.g. Connection Steps)"
                      value={step.title}
                      required
                      onChange={(e) => handleUpdateStep(step.id, { title: e.target.value })}
                      className="w-full bg-black/50 border border-white/5 rounded px-3 py-1.5 text-sm focus:border-[#F27D26] outline-none"
                    />
                    <textarea 
                      placeholder="Markdown content, code, instructions..."
                      value={step.content}
                      required
                      onChange={(e) => handleUpdateStep(step.id, { content: e.target.value })}
                      className="w-full bg-black/50 border border-white/5 rounded px-3 py-1.5 text-sm focus:border-[#F27D26] outline-none h-20 resize-none font-mono text-xs leading-relaxed"
                    />
                    <div className="flex items-center gap-3">
                      <label className="flex-1 flex items-center gap-2 p-2 bg-white/5 border border-dashed border-white/10 rounded cursor-pointer hover:bg-white/10 transition-colors">
                        <Upload size={12} className="text-white/40" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/40 truncate">
                          {newStepFiles[step.id] ? newStepFiles[step.id].name : step.imageUrl ? 'Change Panel Image' : 'Select Step Image'}
                        </span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && setNewStepFiles(prev => ({ ...prev, [step.id]: e.target.files![0] }))} />
                      </label>
                      {(step.imageUrl || newStepFiles[step.id]) && (
                        <div className="w-10 h-10 rounded border border-white/10 overflow-hidden shrink-0">
                          <img 
                            src={newStepFiles[step.id] ? URL.createObjectURL(newStepFiles[step.id]) : step.imageUrl} 
                            alt="Step Preview" 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hardware list */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Kit & Equipment Elements</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                {components.map(comp => (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => handleToggleComponent(comp.id)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left text-xs",
                      componentIds.includes(comp.id) 
                        ? "bg-[#F27D26]/10 border-[#F27D26] text-[#F27D26]" 
                        : "bg-black/40 border-white/5 text-white/60 hover:border-white/20"
                    )}
                  >
                    {comp.imageUrl ? (
                      <img src={comp.imageUrl} alt={comp.name} className="w-6 h-6 rounded object-cover border border-white/5 shrink-0" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center shrink-0">
                        <LayoutGrid size={12} />
                      </div>
                    )}
                    <span className="truncate">{comp.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Supporting old Files list */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Media Attachments</label>
              
              <div className="space-y-2">
                {files.map((file, idx) => (
                  <div key={file.id || idx} className="flex items-center gap-3 p-3 bg-black/40 rounded-xl border border-white/5">
                    <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-white/40 shrink-0">
                      {file.type === 'video' ? <FileVideo size={14} className="text-[#F27D26]" /> : <FileGeneric size={14} className="text-[#F27D26]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate text-white/80">{file.name}</p>
                      <p className="text-[8px] font-mono uppercase tracking-widest text-white/40 mt-0.5">{file.type}</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-white/20 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {newFilesToUpload.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-[#F27D26]/5 rounded-xl border border-[#F27D26]/20">
                    <div className="w-8 h-8 rounded bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26] shrink-0">
                      <Upload size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#F27D26] truncate">{item.file.name}</p>
                      <p className="text-[8px] font-mono uppercase tracking-widest text-[#F27D26]/60 mt-0.5">NEW {item.type}</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNewFilesToUpload(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-[#F27D26]/40 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-center gap-2 p-2.5 bg-white/5 border border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <FileVideo size={14} className="text-white/40" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Add MP4 Video</span>
                  <input type="file" className="hidden" accept="video/*" onChange={(e) => e.target.files?.[0] && setNewFilesToUpload(prev => [...prev, { file: e.target.files![0], type: 'video' }])} />
                </label>
                <label className="flex items-center justify-center gap-2 p-2.5 bg-white/5 border border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <FileGeneric size={14} className="text-white/40" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Add PDF/PPT</span>
                  <input type="file" className="hidden" accept=".pdf,.ppt,.pptx" onChange={(e) => e.target.files?.[0] && setNewFilesToUpload(prev => [...prev, { file: e.target.files![0], type: 'pdf' }])} />
                </label>
              </div>
            </div>

            {isSaving && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest">
                  <span className="text-[#F27D26] font-black">Uploading module assets...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1">
                  <div className="bg-[#F27D26] h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all border border-white/10 text-sm"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSaving}
                className="flex-[2] py-3 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-xl font-bold transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                {isSaving ? 'Processing Content...' : 'Save Module Changes'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

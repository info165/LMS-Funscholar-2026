import React, { useState, useEffect } from 'react';
import { Course } from '../types';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

export const SUB_CATEGORIES: Record<string, string[]> = {
  'Robotics': ['Arduino & Microcontrollers', 'LEGO Robotics', 'Sensors & Actuators', 'Mechanical Assembly', 'BBC Micro:bit', 'PCB Prototyping'],
  'Coding': ['Scratch Blocks', 'Python Development', 'Web Design (HTML/CSS)', 'Game Design', 'Mobile Applications'],
  'IoT': ['Smart Home Systems', 'Wireless ESP8266/ESP32', 'Sensor Networks', 'Cloud Web Servers'],
  'Electronics': ['Circuits & Breadboards', 'Soldering & Assembly', 'Digital Logic Gates', 'Ohm\'s Law Fundamentals'],
  'AI & ML': ['Computer Vision', 'Voice Automation', 'Neural Networks', 'Algorithmic Models']
};

interface EditCourseModalProps {
  course: Course | null;
  onClose: () => void;
  onUpdate: (courseId: string, updates: { title: string; grade: number; description: string; ageRange: string; courseType: string; subCategory?: string; difficulty: string }) => Promise<void>;
}

export default function EditCourseModal({ course, onClose, onUpdate }: EditCourseModalProps) {
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState(1);
  const [description, setDescription] = useState('');
  const [ageRange, setAgeRange] = useState('6-8');
  const [courseType, setCourseType] = useState('Robotics');
  const [subCategory, setSubCategory] = useState('');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (course) {
      setTitle(course.title);
      setGrade(course.grade || 1);
      setDescription(course.description || '');
      setAgeRange(course.ageRange || '6-8');
      const type = course.courseType || 'Robotics';
      setCourseType(type);
      setSubCategory(course.subCategory || (SUB_CATEGORIES[type]?.[0] || ''));
      setDifficulty(course.difficulty || 'Beginner');
    }
  }, [course]);

  if (!course) return null;

  const handleCourseTypeChange = (type: string) => {
    setCourseType(type);
    const subs = SUB_CATEGORIES[type] || [];
    setSubCategory(subs[0] || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdate(course.id, {
        title,
        grade,
        description,
        ageRange,
        courseType,
        subCategory,
        difficulty
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const availableSubs = SUB_CATEGORIES[courseType] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div>
            <h3 className="text-xl font-bold text-white">Edit Course Settings</h3>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-mono">Modify Course Metadata</p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all pointer-events-auto">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Course Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Target Grade (1-12)</label>
              <input
                type="number"
                min="1"
                max="12"
                required
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Target Age</label>
              <select
                value={ageRange}
                onChange={(e) => setAgeRange(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26]"
              >
                <option value="6-8">Age 6-8</option>
                <option value="9-11">Age 9-11</option>
                <option value="12-14">Age 12-14</option>
                <option value="15+">Age 15+</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Course Type</label>
              <select
                value={courseType}
                onChange={(e) => handleCourseTypeChange(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26]"
              >
                <option value="Robotics">Robotics</option>
                <option value="Coding">Coding</option>
                <option value="IoT">IoT</option>
                <option value="Electronics">Electronics</option>
                <option value="AI & ML">AI & ML</option>
              </select>
            </div>
            <div className="space-y-1 bg-black border border-white/5 rounded-lg p-1 px-2.5">
              <label className="text-[9px] uppercase font-bold tracking-widest text-[#F27D26]">Sub-Category</label>
              <select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full bg-transparent text-white text-xs focus:outline-none h-6"
              >
                {availableSubs.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
                {availableSubs.length === 0 && <option value="">None Available</option>}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26]"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#F27D26] h-20 resize-none"
              placeholder="Robotics course overview..."
            />
          </div>

          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full py-3 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-xl font-bold transition-all disabled:opacity-50 mt-4 flex items-center justify-center pointer-events-auto"
          >
            {isSaving ? 'Saving Changes...' : 'Save Settings'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

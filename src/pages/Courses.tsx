import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Course, School } from '../types';
import { useAuth } from '../AuthContext';
import { Plus, Book, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export default function Courses() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGrade, setNewGrade] = useState(1);
  const [selectedSchool, setSelectedSchool] = useState('');

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'courses'), where('teacherId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    });
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!profile?.schoolIds) return;
    const unsubscribe = onSnapshot(collection(db, 'schools'), (snapshot) => {
      const allSchools = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
      setSchools(allSchools.filter(s => profile.schoolIds?.includes(s.id)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schools');
    });
    return () => unsubscribe();
  }, [profile]);

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newTitle || !selectedSchool) return;
    try {
      await addDoc(collection(db, 'courses'), {
        title: newTitle,
        description: newDesc,
        grade: Number(newGrade),
        teacherId: profile.uid,
        schoolId: selectedSchool,
        activated: false
      });
      setNewTitle('');
      setNewDesc('');
      setNewGrade(1);
      setSelectedSchool('');
      toast.success('Course created successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'courses');
    }
  };

  const toggleActivation = async (courseId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'courses', courseId), {
        activated: !currentStatus
      });
      toast.success(`Course ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `courses/${courseId}`);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'courses', id));
      toast.success('Course deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `courses/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-4xl font-bold tracking-tight">My Courses</h2>
        <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Manage your robotics curriculum</p>
      </header>

      <form onSubmit={handleAddCourse} className="bg-[#151619] p-6 rounded-2xl border border-white/5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Course Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
              placeholder="e.g. Introduction to Arduino"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Grade</label>
            <input
              type="number"
              min="1"
              max="12"
              value={newGrade}
              onChange={(e) => setNewGrade(Number(e.target.value))}
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">School</label>
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
            >
              <option value="">Select School</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Description</label>
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
            placeholder="Course overview..."
          />
        </div>
        <button
          type="submit"
          className="bg-[#F27D26] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#d66a1e] transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Create Course
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courses.map((course) => (
          <div key={course.id} className="p-6 bg-[#151619] border border-white/5 rounded-2xl group relative overflow-hidden">
            <div className={cn(
              "absolute top-0 left-0 w-1 h-full transition-opacity",
              course.activated ? "bg-green-500" : "bg-[#F27D26] opacity-0 group-hover:opacity-100"
            )} />
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26]">
                  <Book size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">{course.title}</h3>
                  </div>
                  <p className="text-white/40 text-sm mt-1">{course.description}</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[#F27D26] mt-4">
                    {schools.find(s => s.id === course.schoolId)?.name || 'Unknown School'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-4">
                <button
                  onClick={() => handleDeleteCourse(course.id)}
                  className="text-white/20 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={() => toggleActivation(course.id, course.activated)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                    course.activated 
                      ? "bg-green-500/10 text-green-500 border border-green-500/20" 
                      : "bg-white/5 text-white/40 border border-white/10"
                  )}
                >
                  {course.activated ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  {course.activated ? 'Activated' : 'Inactive'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

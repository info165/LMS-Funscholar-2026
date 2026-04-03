import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { db, adminAuth, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, School } from '../types';
import { Users, Search, Filter, MoreVertical, Shield, ShieldOff, Trash2, School as SchoolIcon, Globe, MapPin, Edit2, Plus, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function StudentsPage() {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [selectedMode, setSelectedMode] = useState<'all' | 'in-school' | 'online'>('all');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    schoolId: '',
    level: 1,
    xp: 0
  });

  useEffect(() => {
    const unsubStudents = onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      setLoading(false);
    });

    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    });

    return () => {
      unsubStudents();
      unsubSchools();
    };
  }, []);

  const handleOpenAddModal = () => {
    setEditingStudent(null);
    setFormData({ name: '', email: '', password: '', schoolId: '', level: 1, xp: 0 });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (student: UserProfile) => {
    setEditingStudent(student);
    setFormData({ 
      name: student.name, 
      email: student.email, 
      password: '', 
      schoolId: student.schoolIds?.[0] || '',
      level: student.level || 1,
      xp: student.xp || 0
    });
    setIsModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      if (editingStudent) {
        await updateDoc(doc(db, 'users', editingStudent.uid), {
          name: formData.name,
          schoolIds: formData.schoolId ? [formData.schoolId] : [],
          level: Number(formData.level),
          xp: Number(formData.xp)
        });
        toast.success('Student updated successfully');
      } else {
        let firebaseUser;
        try {
          const result = await createUserWithEmailAndPassword(
            adminAuth, 
            formData.email, 
            formData.password
          );
          firebaseUser = result.user;
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            const result = await signInWithEmailAndPassword(
              adminAuth,
              formData.email,
              formData.password
            );
            firebaseUser = result.user;
          } else {
            throw authError;
          }
        }

        if (!firebaseUser) throw new Error('Failed to obtain user identity');

        const profile: UserProfile = {
          uid: firebaseUser.uid,
          name: formData.name,
          email: formData.email,
          role: 'student',
          schoolIds: formData.schoolId ? [formData.schoolId] : [],
          xp: Number(formData.xp),
          level: Number(formData.level),
          badges: [],
          mode: 'online',
          lastLogin: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', firebaseUser.uid), profile);
        await signOut(adminAuth);
        toast.success('Student account created successfully');
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error saving student:", error);
      toast.error(error.message || 'Failed to save student account');
    } finally {
      setModalLoading(false);
    }
  };

  const toggleMode = async (student: UserProfile) => {
    try {
      const newMode = student.mode === 'in-school' ? 'online' : 'in-school';
      await updateDoc(doc(db, 'users', student.uid), { mode: newMode });
      toast.success(`Student mode updated to ${newMode}`);
    } catch (error) {
      toast.error('Failed to update student mode');
    }
  };

  const deleteStudent = async (uid: string) => {
    if (!window.confirm('Are you sure you want to delete this student? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('Student deleted successfully');
    } catch (error) {
      toast.error('Failed to delete student');
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         student.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSchool = selectedSchool === 'all' || student.schoolIds?.includes(selectedSchool);
    const matchesMode = selectedMode === 'all' || student.mode === selectedMode;
    return matchesSearch && matchesSchool && matchesMode;
  });

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Student Management</h2>
          <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Manage student accounts, modes, and school mapping</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-[#F27D26] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#d66a1e] transition-all"
        >
          <Plus size={20} />
          Add New Student
        </button>
      </header>

      {/* Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-xl font-bold">{editingStudent ? 'Edit Student' : 'Create Student Account'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/40 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveStudent} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26]"
                  placeholder="e.g. John Doe"
                />
              </div>
              {!editingStudent && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Email Address</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26]"
                      placeholder="student@funscholar.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Password</label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26]"
                      placeholder="••••••••"
                      minLength={6}
                    />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Level</label>
                  <input
                    type="number"
                    required
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">XP</label>
                  <input
                    type="number"
                    required
                    value={formData.xp}
                    onChange={(e) => setFormData({ ...formData, xp: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Assign School (Optional)</label>
                <select
                  value={formData.schoolId}
                  onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26]"
                >
                  <option value="" className="bg-[#151619]">Unmapped</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id} className="bg-[#151619]">{s.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-[#F27D26] text-white py-4 rounded-xl font-bold hover:bg-[#d66a1e] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {modalLoading ? <Loader2 className="animate-spin" size={20} /> : (editingStudent ? 'Update Student' : 'Create Student')}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
          <input
            type="text"
            placeholder="Search students by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#151619] border border-white/10 rounded-xl focus:outline-none focus:border-[#F27D26] transition-all"
          />
        </div>
        <div className="flex gap-4">
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            className="px-4 py-3 bg-[#151619] border border-white/10 rounded-xl focus:outline-none focus:border-[#F27D26] transition-all text-sm"
          >
            <option value="all">All Schools</option>
            {schools.map(school => (
              <option key={school.id} value={school.id}>{school.name}</option>
            ))}
          </select>
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value as any)}
            className="px-4 py-3 bg-[#151619] border border-white/10 rounded-xl focus:outline-none focus:border-[#F27D26] transition-all text-sm"
          >
            <option value="all">All Modes</option>
            <option value="in-school">In-School</option>
            <option value="online">Online</option>
          </select>
        </div>
      </div>

      <div className="bg-[#151619] border border-white/5 rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-bottom border-white/5 bg-white/5">
              <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-white/40">Student</th>
              <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-white/40">School</th>
              <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-white/40">Mode</th>
              <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-white/40">Stats</th>
              <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-white/40 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filteredStudents.map((student) => (
                <motion.tr
                  key={student.uid}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-bottom border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26] font-bold">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{student.name}</p>
                        <p className="text-xs text-white/40">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <SchoolIcon size={14} className="text-[#F27D26]" />
                      {student.schoolIds && student.schoolIds.length > 0 
                        ? student.schoolIds.map(id => schools.find(s => s.id === id)?.name).filter(Boolean).join(', ')
                        : 'Unmapped'}
                    </div>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleMode(student)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                        student.mode === 'in-school' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                          : 'bg-green-500/10 text-green-400 border border-green-500/20'
                      }`}
                    >
                      {student.mode === 'in-school' ? <MapPin size={10} /> : <Globe size={10} />}
                      {student.mode}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] text-white/30 uppercase font-bold">Level</p>
                        <p className="text-sm font-bold text-[#F27D26]">{student.level}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30 uppercase font-bold">XP</p>
                        <p className="text-sm font-bold">{student.xp}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEditModal(student)}
                        className="p-2 text-white/30 hover:text-[#F27D26] transition-colors"
                        title="Edit Student"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => deleteStudent(student.uid)}
                        className="p-2 text-white/30 hover:text-red-500 transition-colors"
                        title="Delete Student"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {filteredStudents.length === 0 && !loading && (
          <div className="p-20 text-center">
            <Users size={48} className="mx-auto text-white/10 mb-4" />
            <p className="text-white/40 font-medium">No students found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}

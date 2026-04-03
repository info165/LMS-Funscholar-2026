import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, updateDoc, doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { db, adminAuth, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, School, UserRole } from '../types';
import { Users, Shield, UserCheck, Plus, Loader2, X, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

export default function Teachers() {
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    schoolIds: [] as string[],
    role: 'teacher' as UserRole
  });

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', 'in', ['teacher', 'admin']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schools');
    });
    return () => unsubscribe();
  }, []);

  const handleOpenAddModal = () => {
    setEditingTeacher(null);
    setFormData({ name: '', email: '', password: '', schoolIds: [], role: 'teacher' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (teacher: UserProfile) => {
    setEditingTeacher(teacher);
    setFormData({ 
      name: teacher.name, 
      email: teacher.email, 
      password: '', // Password not editable here for security
      schoolIds: teacher.schoolIds || [],
      role: teacher.role
    });
    setIsModalOpen(true);
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingTeacher) {
        // Update existing teacher
        await updateDoc(doc(db, 'users', editingTeacher.uid), {
          name: formData.name,
          schoolIds: formData.schoolIds,
          role: formData.role
        });
        toast.success('User updated successfully!');
      } else {
        // Create new teacher
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
          role: formData.role,
          schoolIds: formData.schoolIds,
          xp: 0,
          level: 1,
          badges: [],
          mode: 'online',
          lastLogin: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', firebaseUser.uid), profile);
        await signOut(adminAuth);
        toast.success('User account created successfully!');
      }
      
      setIsModalOpen(false);
      setFormData({ name: '', email: '', password: '', schoolIds: [], role: 'teacher' });
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast.error(error.message || 'Failed to save user account');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeacher = async (uid: string) => {
    if (!window.confirm('Are you sure you want to delete this teacher profile? This will not delete their Auth account but they will lose access to the LMS.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('Teacher deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  const handleToggleSchool = async (teacherUid: string, schoolId: string, currentIds: string[] = []) => {
    try {
      const newIds = currentIds.includes(schoolId)
        ? currentIds.filter(id => id !== schoolId)
        : [...currentIds, schoolId];
        
      await updateDoc(doc(db, 'users', teacherUid), { schoolIds: newIds });
      toast.success('School mapping updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${teacherUid}`);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">User Management</h2>
          <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Manage access, roles and school mapping</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-[#F27D26] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#d66a1e] transition-all"
        >
          <Plus size={20} />
          Add New User
        </button>
      </header>

      {/* Teacher Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-xl font-bold">{editingTeacher ? 'Edit User' : 'Create User Account'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/40 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveTeacher} className="p-6 space-y-4">
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
              {!editingTeacher && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Email Address</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26]"
                      placeholder="user@funscholar.com"
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
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26]"
                  >
                    <option value="teacher" className="bg-[#151619]">Teacher</option>
                    <option value="admin" className="bg-[#151619]">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Schools (Multi-select)</label>
                  <div className="max-h-32 overflow-y-auto bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                    {schools.map(s => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={formData.schoolIds.includes(s.id)}
                          onChange={(e) => {
                            const newIds = e.target.checked
                              ? [...formData.schoolIds, s.id]
                              : formData.schoolIds.filter(id => id !== s.id);
                            setFormData({ ...formData, schoolIds: newIds });
                          }}
                          className="rounded border-white/10 bg-black text-[#F27D26] focus:ring-[#F27D26]"
                        />
                        <span className="text-sm text-white/60 group-hover:text-white transition-colors">{s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F27D26] text-white py-4 rounded-xl font-bold hover:bg-[#d66a1e] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (editingTeacher ? 'Update User' : 'Create User')}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-[#151619] border border-white/5 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-[10px] uppercase font-bold tracking-widest text-white/40">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Mapped Schools</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {teachers.map((teacher) => (
              <tr key={teacher.uid} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-medium">{teacher.name}</td>
                <td className="px-6 py-4 text-white/60">{teacher.email}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest",
                    teacher.role === 'admin' ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"
                  )}>
                    {teacher.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {schools.filter(s => (teacher.schoolIds || []).includes(s.id)).map(s => (
                      <span key={s.id} className="px-2 py-0.5 bg-white/5 rounded text-[8px] font-bold uppercase tracking-widest text-white/60">
                        {s.name}
                      </span>
                    ))}
                    {(!teacher.schoolIds || teacher.schoolIds.length === 0) && (
                      <span className="text-white/20 text-[10px] italic">No schools mapped</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button 
                      onClick={() => handleOpenEditModal(teacher)}
                      className="p-2 text-white/40 hover:text-[#F27D26] transition-colors"
                      title="Edit Teacher"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteTeacher(teacher.uid)}
                      className="p-2 text-white/40 hover:text-red-500 transition-colors"
                      title="Delete Teacher"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button className="text-[#F27D26] text-[10px] font-bold hover:underline inline-flex items-center gap-1 bg-[#F27D26]/10 px-3 py-1 rounded-full">
                      <Shield size={12} />
                      Reset
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

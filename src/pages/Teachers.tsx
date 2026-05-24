import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, updateDoc, doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { db, adminAuth, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, School, UserRole } from '../types';
import { Users, Shield, UserCheck, Plus, Loader2, X, Trash2, Edit2, Phone, Key, HelpCircle } from 'lucide-react';
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
    phone: '',
    password: '',
    schoolIds: [] as string[],
    role: 'teacher' as UserRole,
    roles: [] as UserRole[]
  });

  useEffect(() => {
    // Fetch all users to support managing any roles
    const q = query(collection(db, 'users'));
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
    setFormData({ 
      name: '', 
      email: '', 
      phone: '', 
      password: '', 
      schoolIds: [], 
      role: 'teacher', 
      roles: ['teacher'] 
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (teacher: UserProfile) => {
    setEditingTeacher(teacher);
    setFormData({ 
      name: teacher.name, 
      email: teacher.email, 
      phone: teacher.phone || '',
      password: teacher.password || '', // Display if saved, allows changing "right then and there"
      schoolIds: teacher.schoolIds || [],
      role: teacher.role || 'teacher',
      roles: teacher.roles || [teacher.role || 'teacher']
    });
    setIsModalOpen(true);
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (formData.roles.length === 0) {
        toast.error('Please select at least one assigned role!');
        setLoading(false);
        return;
      }

      // Ensure the 'role' field has a fallback from chosen roles
      let primaryRole = formData.role;
      if (!formData.roles.includes(primaryRole)) {
        primaryRole = formData.roles[0];
      }

      if (editingTeacher) {
        // Update existing teacher field-by-field including optional phone/password
        const updatedFields: any = {
          name: formData.name,
          phone: formData.phone || '',
          schoolIds: formData.schoolIds,
          role: primaryRole,
          roles: formData.roles,
        };

        if (formData.password) {
          updatedFields.password = formData.password;
        }

        await updateDoc(doc(db, 'users', editingTeacher.uid), updatedFields);
        toast.success('User updated successfully!');
      } else {
        // Create new teacher under auth
        let firebaseUser;
        try {
          const result = await createUserWithEmailAndPassword(
            adminAuth, 
            formData.email, 
            formData.password || 'welcome123'
          );
          firebaseUser = result.user;
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            const result = await signInWithEmailAndPassword(
              adminAuth,
              formData.email,
              formData.password || 'welcome123'
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
          phone: formData.phone || '',
          role: primaryRole,
          roles: formData.roles,
          password: formData.password || 'welcome123',
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
      setFormData({ name: '', email: '', phone: '', password: '', schoolIds: [], role: 'teacher', roles: [] });
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast.error(error.message || 'Failed to save user account');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeacher = async (uid: string) => {
    if (!window.confirm('Are you sure you want to delete this user profile? This will revoke access to the LMS.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('User profile removed successfully');
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

  const triggerPasswordReset = (teacher: UserProfile) => {
    if (!teacher.password) {
      toast.error("No password set on file. Double-click edit to assign one manually.");
      return;
    }
    navigator.clipboard.writeText(teacher.password);
    toast.success(`Copied current login password on file: "${teacher.password}"`);
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">User Management</h2>
          <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Manage access, multiple roles and school mapping</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-[#F27D26] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#d66a1e] transition-all cursor-pointer font-sans"
        >
          <Plus size={20} />
          Add New User
        </button>
      </header>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Shield size={20} className="text-[#F27D26]" />
                {editingTeacher ? 'Edit User Credentials & Roles' : 'Create New User Account'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/40 hover:text-white cursor-pointer p-1 rounded hover:bg-white/5 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveTeacher} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-[#F27D26] uppercase tracking-widest mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#F27D26] transition-colors"
                    placeholder="e.g. Gaurav Jain"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-[#F27D26] uppercase tracking-widest mb-1.5">Contact Phone (Optional)</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-4 top-4 text-white/30" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#F27D26] transition-colors"
                      placeholder="e.g. +91 98765 43210"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-[#F27D26] uppercase tracking-widest mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  disabled={editingTeacher !== null}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#F27D26] disabled:opacity-50 transition-colors"
                  placeholder="user@funscholar.com"
                />
                {editingTeacher && (
                  <p className="text-[10px] text-white/40 italic mt-1 font-mono">Note: Registered email addresses cannot be modified.</p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-extrabold text-[#F27D26] uppercase tracking-widest">
                    {editingTeacher ? 'Redefine Password' : 'Password'}
                  </label>
                  {editingTeacher && (
                    <span className="text-[9px] text-[#F27D26] font-medium font-mono uppercase tracking-wider">Updates live in database</span>
                  )}
                </div>
                <div className="relative">
                  <Key size={14} className="absolute left-4 top-4 text-white/30" />
                  <input
                    type="text"
                    required={!editingTeacher}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white font-mono placeholder-white/30 focus:outline-none focus:border-[#F27D26] transition-colors"
                    placeholder={editingTeacher ? "Type new password to override on file" : "••••••••"}
                    minLength={6}
                  />
                </div>
                <p className="text-[10px] text-white/40 mt-1">Manage, copy or assign password credentials immediately for custom overrides.</p>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-[#F27D26] uppercase tracking-widest mb-2">Assigned Roles (Can holding multiple roles)</label>
                <div className="grid grid-cols-3 gap-3">
                  {['admin', 'teacher', 'student'].map((roleOpt) => {
                    const isChecked = formData.roles.includes(roleOpt as UserRole);
                    return (
                      <label 
                        key={roleOpt} 
                        className={cn(
                          "flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all",
                          isChecked 
                            ? "bg-[#F27D26]/10 border-[#F27D26]/30 text-white font-bold" 
                            : "bg-white/[0.02] border-white/5 text-white/40 hover:text-white/70 hover:bg-white/5"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const updatedRoles = e.target.checked
                              ? [...formData.roles, roleOpt as UserRole]
                              : formData.roles.filter(r => r !== roleOpt);
                            setFormData({ ...formData, roles: updatedRoles });
                          }}
                          className="rounded border-white/10 bg-black text-[#F27D26] focus:ring-[#F27D26] h-4 w-4"
                        />
                        <span className="text-xs uppercase tracking-widest font-mono select-none">{roleOpt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-[#F27D26] uppercase tracking-widest mb-1.5">Primary Default Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full bg-[#151619] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#F27D26] transition-colors"
                  >
                    {formData.roles.map((ro) => (
                      <option key={ro} value={ro} className="bg-[#151619] capitalize">
                        {ro}
                      </option>
                    ))}
                    {formData.roles.length === 0 && (
                      <option value="teacher" className="bg-[#151619]">Teacher</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-[#F27D26] uppercase tracking-widest mb-1.5">Assigned Schools (Multi-select)</label>
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
                    {schools.length === 0 && (
                      <p className="text-[10px] text-white/30 italic">No schools saved.</p>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F27D26] text-white py-4 rounded-xl font-bold hover:bg-[#d66a1e] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-sm uppercase tracking-wider"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (editingTeacher ? 'Apply Changes Live' : 'Create Dynamic User Account')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="bg-[#151619] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white/5 text-[10px] uppercase font-bold tracking-widest text-white/40">
            <tr>
              <th className="px-6 py-4">Full Name</th>
              <th className="px-6 py-4">Credentials & Contact</th>
              <th className="px-6 py-4">Assigned Roles</th>
              <th className="px-6 py-4">Mapped Schools</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {teachers.map((teacher) => (
              <tr key={teacher.uid} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-medium text-white text-sm">
                  {teacher.name}
                  {teacher.email?.toLowerCase().trim() === 'info@funscholar.com' && (
                    <span className="ml-2 text-[8px] bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/30 px-1.5 py-0.5 rounded font-extrabold uppercase">Creator</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-white/85 text-xs font-mono">{teacher.email}</div>
                  <div className="flex items-center gap-3 mt-1">
                    {teacher.phone && (
                      <span className="text-[10px] text-white/40 flex items-center gap-1">
                        <Phone size={10} />
                        {teacher.phone}
                      </span>
                    )}
                    {teacher.password && (
                      <span className="text-[10px] text-white/40 flex items-center gap-1 font-mono">
                        <Key size={10} />
                        pw: <span className="text-[#F27D26]/80 font-bold select-all">{teacher.password}</span>
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {(teacher.roles && teacher.roles.length > 0 ? teacher.roles : [teacher.role]).map((r) => (
                      <span key={r} className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border",
                        r === 'admin' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "",
                        r === 'teacher' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "",
                        r === 'student' ? "bg-green-500/10 text-green-400 border-green-500/20" : ""
                      )}>
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {schools.filter(s => (teacher.schoolIds || []).includes(s.id)).map(s => (
                      <span key={s.id} className="px-2 py-0.5 bg-white/5 border border-white/5 rounded text-[8px] font-bold uppercase tracking-widest text-white/50">
                        {s.name}
                      </span>
                    ))}
                    {(!teacher.schoolIds || teacher.schoolIds.length === 0) && (
                      <span className="text-white/20 text-[10px] italic">No school maps</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2.5">
                    <button 
                      onClick={() => handleOpenEditModal(teacher)}
                      className="p-2 text-white/40 hover:text-[#F27D26] transition-colors cursor-pointer rounded hover:bg-white/5"
                      title="Edit Account Credentials"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteTeacher(teacher.uid)}
                      className="p-2 text-white/40 hover:text-red-500 transition-colors cursor-pointer rounded hover:bg-white/5"
                      title="Delete User profile"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button 
                      onClick={() => triggerPasswordReset(teacher)}
                      className="text-[#F27D26] text-[10px] uppercase font-bold hover:bg-[#F27D26]/20 transition-all inline-flex items-center gap-1 bg-[#F27D26]/10 px-2.5 py-1 rounded-md cursor-pointer select-none"
                      title="Copy current password on file"
                    >
                      <Key size={10} />
                      copy pw
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

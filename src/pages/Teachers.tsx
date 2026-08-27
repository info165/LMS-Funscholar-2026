import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, updateDoc, doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { db, adminAuth, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, School, UserRole } from '../types';
import { Users, Shield, UserCheck, Plus, Loader2, X, Trash2, Edit2, Phone, Key, HelpCircle, Eye, EyeOff, Mail, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { deleteDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';
import { motion } from 'framer-motion';
import { logAudit } from '../lib/audit';

export default function Teachers() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'admin' && profile?.adminSubRole === 'Super Admin';
  const canManageTeachers = profile?.role === 'admin' && (profile?.adminSubRole === 'Super Admin' || !!profile?.canAddTeacher);

  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [visiblePhones, setVisiblePhones] = useState<Record<string, boolean>>({});
  
  // Password Reset Requests State
  const [resetRequests, setResetRequests] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'passwordResetRequests'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      requests.sort((a: any, b: any) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
      setResetRequests(requests);
    }, (error) => {
      console.error("Error loading reset requests:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleResolveReset = async (request: any) => {
    const newPassword = prompt(`Enter a new password for ${request.email}:`, 'welcome123');
    if (newPassword === null) return; // Cancelled
    if (!newPassword.trim()) {
      toast.error("Password cannot be empty!");
      return;
    }

    try {
      // Step 1: Update Auth & Firestore password via the update-password endpoint
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: request.email, password: newPassword.trim() })
      });
      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || 'Server error resetting password');
      }

      // Step 2: Mark the request as resolved/completed in Firestore
      await updateDoc(doc(db, 'passwordResetRequests', request.id), {
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedPassword: newPassword.trim()
      });

      toast.success(`Successfully reset password for ${request.email} and marked request as resolved!`);
    } catch (err: any) {
      console.error("Failed to resolve reset request:", err);
      toast.error(`Failed to resolve: ${err.message}`);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this password reset request record?")) return;
    try {
      await deleteDoc(doc(db, 'passwordResetRequests', id));
      toast.success("Request record deleted.");
    } catch (err: any) {
      console.error("Failed to delete request:", err);
      toast.error("Failed to delete record.");
    }
  };
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    schoolIds: [] as string[],
    role: 'teacher' as UserRole,
    roles: [] as UserRole[],
    adminSubRole: 'User Manager Admin',
    canAddStudent: false,
    canAddTeacher: false,
    canAddSchool: false,
    canManageContent: false,
    isPasswordPublic: false
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
    setShowPassword(false);
    setFormData({ 
      name: '', 
      email: '', 
      phone: '', 
      password: '', 
      schoolIds: [], 
      role: 'teacher', 
      roles: ['teacher'],
      adminSubRole: 'User Manager Admin',
      canAddStudent: false,
      canAddTeacher: false,
      canAddSchool: false,
      canManageContent: false,
      isPasswordPublic: false
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (teacher: UserProfile) => {
    setEditingTeacher(teacher);
    setShowPassword(false);
    
    // Only pre-populate password if it's the user's own account, OR if the teacher has chosen to make it public.
    // Otherwise, keep it blank so others cannot read it.
    const canSeePassword = profile?.uid === teacher.uid || !!teacher.isPasswordPublic;
    
    setFormData({ 
      name: teacher.name, 
      email: teacher.email, 
      phone: teacher.phone || '',
      password: canSeePassword ? (teacher.password || '') : '', 
      schoolIds: teacher.schoolIds || [],
      role: teacher.role || 'teacher',
      roles: teacher.roles || [teacher.role || 'teacher'],
      adminSubRole: teacher.adminSubRole || 'User Manager Admin',
      canAddStudent: !!teacher.canAddStudent,
      canAddTeacher: !!teacher.canAddTeacher,
      canAddSchool: !!teacher.canAddSchool,
      canManageContent: !!teacher.canManageContent,
      isPasswordPublic: teacher.isPasswordPublic ?? false
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
        // If a password is provided, always run the Firebase Auth password sync to make sure Auth & database are in sync
        if (formData.password) {
          try {
            const response = await fetch('/api/auth/update-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: editingTeacher.email, password: formData.password })
            });
            const resJson = await response.json();
            if (!response.ok || !resJson.success) {
              throw new Error(resJson.error || 'Server error resetting password');
            }
          } catch (authError: any) {
            console.error("Auth API password update error:", authError);
            toast.error(`Auth service update failed: ${authError.message}. Profile updated on database anyway.`);
          }
        }

        // Update existing teacher field-by-field including optional phone/password
        const updatedFields: any = {
          name: formData.name,
          phone: formData.phone || '',
          schoolIds: formData.schoolIds,
          role: primaryRole,
          roles: formData.roles,
          isPasswordPublic: formData.isPasswordPublic
        };

        if (formData.password) {
          updatedFields.password = formData.password;
        }

        if (primaryRole === 'admin' || formData.roles.includes('admin')) {
          updatedFields.adminSubRole = formData.adminSubRole;
          updatedFields.canAddStudent = formData.canAddStudent;
          updatedFields.canAddTeacher = formData.canAddTeacher;
          updatedFields.canAddSchool = formData.canAddSchool;
          updatedFields.canManageContent = formData.canManageContent;
        }

        await updateDoc(doc(db, 'users', editingTeacher.uid), updatedFields);
        toast.success('User updated successfully!');
        logAudit(profile, 'Edit User', `Updated user account: ${formData.name} (${formData.email}) as role ${primaryRole}`, { targetUserId: editingTeacher.uid, email: formData.email, role: primaryRole });
      } else {
        // Create new teacher via admin API
        let resolvedUid: string;
        try {
          const response = await fetch('/api/auth/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.email, password: formData.password || 'welcome123' })
          });
          const resJson = await response.json();
          if (!response.ok || !resJson.success) {
            throw new Error(resJson.error || 'Server error creating user');
          }
          resolvedUid = resJson.uid;
        } catch (authError: any) {
          console.error("Auth API create user error:", authError);
          throw new Error(`Failed to create or update authentication credentials: ${authError.message}`);
        }

        if (!resolvedUid) throw new Error('Failed to obtain user identity from backend');

        const newProfileData: UserProfile = {
          uid: resolvedUid,
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
          lastLogin: new Date().toISOString(),
          isPasswordPublic: formData.isPasswordPublic
        };

        if (primaryRole === 'admin' || formData.roles.includes('admin')) {
          newProfileData.adminSubRole = formData.adminSubRole;
          newProfileData.canAddStudent = formData.canAddStudent;
          newProfileData.canAddTeacher = formData.canAddTeacher;
          newProfileData.canAddSchool = formData.canAddSchool;
          newProfileData.canManageContent = formData.canManageContent;
        }

        await setDoc(doc(db, 'users', resolvedUid), newProfileData);
        toast.success('User account created successfully!');
        logAudit(profile, 'Add User', `Created user account: ${formData.name} (${formData.email}) with role ${primaryRole}`, { targetUserId: resolvedUid, email: formData.email, role: primaryRole });
      }
      
      setIsModalOpen(false);
      setFormData({ 
        name: '', 
        email: '', 
        phone: '', 
        password: '', 
        schoolIds: [], 
        role: 'teacher', 
        roles: [],
        adminSubRole: 'User Manager Admin',
        canAddStudent: false,
        canAddTeacher: false,
        canAddSchool: false,
        canManageContent: false,
        isPasswordPublic: false
      });
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast.error(error.message || 'Failed to save user account');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeacher = async (uid: string) => {
    if (!window.confirm('Are you sure you want to delete this user profile? This will revoke access to the LMS.')) return;
    const teacherName = teachers.find(t => t.uid === uid)?.name || uid;
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('User profile removed successfully');
      logAudit(profile, 'Delete User', `Deleted user profile: ${teacherName}`, { targetUserId: uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  const handleToggleSchool = async (teacherUid: string, schoolId: string, currentIds: string[] = []) => {
    const teacherName = teachers.find(t => t.uid === teacherUid)?.name || teacherUid;
    const schoolName = schools.find(s => s.id === schoolId)?.name || schoolId;
    try {
      const newIds = currentIds.includes(schoolId)
        ? currentIds.filter(id => id !== schoolId)
        : [...currentIds, schoolId];
        
      await updateDoc(doc(db, 'users', teacherUid), { schoolIds: newIds });
      toast.success('School mapping updated');
      const actionDesc = currentIds.includes(schoolId) ? 'Removed' : 'Added';
      logAudit(profile, 'Update School Mapping', `${actionDesc} school "${schoolName}" for user: ${teacherName}`, { targetUserId: teacherUid, schoolId });
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
        {canManageTeachers && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 bg-[#F27D26] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#d66a1e] transition-all cursor-pointer font-sans"
          >
            <Plus size={20} />
            Add New User
          </button>
        )}
      </header>

      {/* Password Reset Requests Section */}
      {resetRequests.filter(r => r.status === 'pending').length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-red-400 flex items-center gap-2">
              <AlertCircle size={16} />
              Pending Account Password Reset Requests ({resetRequests.filter(r => r.status === 'pending').length})
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resetRequests.filter(r => r.status === 'pending').map((req) => (
              <div key={req.id} className="bg-white/[0.03] border border-white/5 p-4 rounded-xl flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-white/40" />
                    <span className="text-white font-bold text-sm select-all">{req.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/40 text-[10px] font-mono">
                    <Clock size={10} />
                    <span>Requested: {new Date(req.requestedAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResolveReset(req)}
                    className="bg-[#F27D26] hover:bg-[#d66a1e] text-white text-xs font-bold py-1.5 px-3.5 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Key size={12} />
                    Reset Password
                  </button>
                  <button
                    onClick={() => handleDeleteRequest(req.id)}
                    className="bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 text-xs font-bold py-1.5 px-2 rounded-lg transition-all cursor-pointer"
                    title="Dismiss Request"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
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
            
            <form onSubmit={handleSaveTeacher} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
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
                    type={showPassword ? "text" : "password"}
                    required={!editingTeacher}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-white font-mono placeholder-white/30 focus:outline-none focus:border-[#F27D26] transition-colors"
                    placeholder={editingTeacher ? "Type new password to override on file" : "••••••••"}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer p-1 rounded hover:bg-white/5"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-white/40 mt-1">Manage, copy or assign password credentials immediately for custom overrides.</p>
              </div>

              {editingTeacher && profile?.uid === editingTeacher.uid && (
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Key size={14} className="text-[#F27D26]" />
                    <span className="block text-[10px] font-extrabold text-[#F27D26] uppercase tracking-widest">Password Visibility Setting</span>
                  </div>
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    Choose whether other users (administrators and teachers) can see your password or if it should be completely hidden from everyone else on the platform.
                  </p>
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isPasswordPublic: false })}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                        !formData.isPasswordPublic
                          ? "bg-red-500/10 border-red-500/30 text-red-400 font-extrabold"
                          : "bg-transparent border-white/5 text-white/40 hover:text-white/60"
                      )}
                    >
                      <EyeOff size={14} />
                      Hide My Password
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isPasswordPublic: true })}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                        formData.isPasswordPublic
                          ? "bg-green-500/10 border-green-500/30 text-green-400 font-extrabold"
                          : "bg-transparent border-white/5 text-white/40 hover:text-white/60"
                      )}
                    >
                      <Eye size={14} />
                      Unhide / Show
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-extrabold text-[#F27D26] uppercase tracking-widest mb-2">Assigned Roles (Can holding multiple roles)</label>
                <div className="grid grid-cols-3 gap-3">
                  {['admin', 'teacher', 'student'].map((roleOpt) => {
                    const isChecked = formData.roles.includes(roleOpt as UserRole);
                    return (
                      <label 
                        key={roleOpt} 
                        className={cn(
                          "flex items-center gap-2.5 p-3 rounded-xl border select-none transition-all",
                          !isSuperAdmin && "opacity-60 cursor-not-allowed",
                          isChecked 
                            ? "bg-[#F27D26]/10 border-[#F27D26]/30 text-white font-bold" 
                            : "bg-white/[0.02] border-white/5 text-white/40 hover:text-white/70 hover:bg-white/5",
                          isSuperAdmin && "cursor-pointer"
                        )}
                      >
                        <input
                          type="checkbox"
                          disabled={!isSuperAdmin}
                          checked={isChecked}
                          onChange={(e) => {
                            const updatedRoles = e.target.checked
                              ? [...formData.roles, roleOpt as UserRole]
                              : formData.roles.filter(r => r !== roleOpt);
                            setFormData({ ...formData, roles: updatedRoles });
                          }}
                          className="rounded border-white/10 bg-black text-[#F27D26] focus:ring-[#F27D26] h-4 w-4 disabled:opacity-50"
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
                    disabled={!isSuperAdmin}
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full bg-[#151619] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#F27D26] transition-colors disabled:opacity-65"
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
                        <span className="text-sm text-white/60 group-hover:text-white transition-colors select-none">{s.name}</span>
                      </label>
                    ))}
                    {schools.length === 0 && (
                      <p className="text-[10px] text-white/30 italic">No schools saved.</p>
                    )}
                  </div>
                </div>
              </div>

              {(formData.role === 'admin' || formData.roles.includes('admin')) && (
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-4">
                  <h4 className="text-xs font-extrabold text-[#F27D26] uppercase tracking-widest flex items-center gap-1.5">
                    <Shield size={14} />
                    Administrative Authority Configuration
                  </h4>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5 font-mono">Admin Sub-Role</label>
                    <select
                      disabled={!isSuperAdmin}
                      value={formData.adminSubRole || 'User Manager Admin'}
                      onChange={(e) => {
                        const val = e.target.value;
                        let perms = {
                          canAddStudent: formData.canAddStudent,
                          canAddTeacher: formData.canAddTeacher,
                          canAddSchool: formData.canAddSchool,
                          canManageContent: formData.canManageContent
                        };
                        if (val === 'Super Admin') {
                          perms = { canAddStudent: true, canAddTeacher: true, canAddSchool: true, canManageContent: true };
                        } else if (val === 'User Manager Admin') {
                          perms = { canAddStudent: true, canAddTeacher: true, canAddSchool: true, canManageContent: false };
                        } else if (val === 'Curriculum Admin') {
                          perms = { canAddStudent: false, canAddTeacher: false, canAddSchool: false, canManageContent: true };
                        }
                        setFormData({
                          ...formData,
                          adminSubRole: val,
                          ...perms
                        });
                      }}
                      className="w-full bg-[#151619] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#F27D26] transition-colors disabled:opacity-65"
                    >
                      {['Super Admin', 'User Manager Admin', 'Curriculum Admin', 'Custom Admin'].map((subRole) => (
                        <option key={subRole} value={subRole} className="bg-[#151619]">
                          {subRole}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 font-mono">Individual Toggled Permissions</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'canAddStudent', label: 'Manage Students' },
                        { key: 'canAddTeacher', label: 'Manage Teachers' },
                        { key: 'canAddSchool', label: 'Manage Schools' },
                        { key: 'canManageContent', label: 'Manage Curriculum' }
                      ].map((perm) => (
                        <label 
                          key={perm.key}
                          className={cn(
                            "flex items-center gap-2 p-2 px-3 rounded-lg border text-left transition-all",
                            formData[perm.key as keyof typeof formData]
                              ? "bg-[#F27D26]/5 border-[#F27D26]/20 text-white"
                              : "bg-transparent border-white/5 text-white/40 hover:text-white/60",
                            !isSuperAdmin ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                          )}
                        >
                          <input
                            type="checkbox"
                            disabled={!isSuperAdmin}
                            checked={!!formData[perm.key as keyof typeof formData]}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                [perm.key]: e.target.checked,
                                adminSubRole: 'Custom Admin'
                              });
                            }}
                            className="rounded border-white/10 bg-black text-[#F27D26] focus:ring-[#F27D26] h-3.5 w-3.5 disabled:opacity-50"
                          />
                          <span className="text-[11px] font-medium select-none">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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
            {teachers
              .filter((user) => {
                const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
                return userRoles.includes('admin') || userRoles.includes('teacher');
              })
              .map((teacher) => (
              <tr key={teacher.uid} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-medium text-white text-sm">
                  {teacher.name}
                  {teacher.email?.toLowerCase().trim() === 'info@funscholar.com' && (
                    <span className="ml-2 text-[8px] bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/30 px-1.5 py-0.5 rounded font-extrabold uppercase">Creator</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="teacher-email-text text-xs font-mono">{teacher.email}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {teacher.phone && (
                      <span className="text-[10px] text-white/50 flex items-center gap-1 bg-white/[0.03] border border-white/5 px-2 py-0.5 rounded-md">
                        <Phone size={10} className="text-white/30" />
                        <span>{visiblePhones[teacher.uid] ? teacher.phone : '••••••••'}</span>
                        <button
                          type="button"
                          onClick={() => setVisiblePhones(prev => ({ ...prev, [teacher.uid]: !prev[teacher.uid] }))}
                          className="hover:text-white text-white/40 transition-colors p-0.5 ml-1"
                          title={visiblePhones[teacher.uid] ? "Hide Phone" : "Show Phone"}
                        >
                          {visiblePhones[teacher.uid] ? <EyeOff size={10} /> : <Eye size={10} />}
                        </button>
                      </span>
                    )}
                    {teacher.password && (
                      <span className="text-[10px] text-white/50 flex items-center gap-1 bg-white/[0.03] border border-white/5 px-2 py-0.5 rounded-md font-mono">
                        <Key size={10} className="text-white/30" />
                        {profile?.uid === teacher.uid ? (
                          <>
                            <span>pw: <b className="text-[#F27D26]/80 font-bold select-all">{visiblePasswords[teacher.uid] ? teacher.password : '••••••••'}</b></span>
                            <button
                              type="button"
                              onClick={() => setVisiblePasswords(prev => ({ ...prev, [teacher.uid]: !prev[teacher.uid] }))}
                              className="hover:text-white text-white/40 transition-colors p-0.5 ml-1"
                              title={visiblePasswords[teacher.uid] ? "Hide Password" : "Show Password"}
                            >
                              {visiblePasswords[teacher.uid] ? <EyeOff size={10} /> : <Eye size={10} />}
                            </button>
                          </>
                        ) : teacher.isPasswordPublic ? (
                          <span>pw: <b className="text-[#F27D26]/80 font-bold select-all">{teacher.password}</b></span>
                        ) : (
                          <span>pw: <b className="text-white/20 select-none">••••••••</b></span>
                        )}
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
                    {canManageTeachers && (
                      <>
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
                      </>
                    )}
                    {(profile?.uid === teacher.uid || !!teacher.isPasswordPublic) && (
                      <button 
                        onClick={() => triggerPasswordReset(teacher)}
                        className="text-[#F27D26] text-[10px] uppercase font-bold hover:bg-[#F27D26]/20 transition-all inline-flex items-center gap-1 bg-[#F27D26]/10 px-2.5 py-1 rounded-md cursor-pointer select-none"
                        title="Copy current password on file"
                      >
                        <Key size={10} />
                        copy pw
                      </button>
                    )}
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

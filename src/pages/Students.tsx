import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { db, adminAuth, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, School, UserRole } from '../types';
import { Users, Search, Filter, MoreVertical, Shield, ShieldOff, Trash2, School as SchoolIcon, Globe, MapPin, Edit2, Plus, X, Loader2, Key, Eye, EyeOff, Upload, Download, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';
import { logAudit } from '../lib/audit';

export default function StudentsPage() {
  const { profile } = useAuth();
  const canManageStudents = profile?.role === 'admin' && (profile?.adminSubRole === 'Super Admin' || !!profile?.canAddStudent);
  const isSuperAdmin = profile?.role === 'admin' && profile?.adminSubRole === 'Super Admin';

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [selectedMode, setSelectedMode] = useState<'all' | 'in-school' | 'online'>('all');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    schoolId: '',
    level: 1,
    xp: 0,
    studentClass: '',
    section: '',
    rollNumber: '',
    role: 'student' as UserRole,
    roles: [] as UserRole[]
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

  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [parsedCsvData, setParsedCsvData] = useState<any[]>([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const downloadCsvTemplate = () => {
    // School Name, Name, Class, Section, Roll Number
    const csvContent = "data:text/csv;charset=utf-8," 
      + "School Name,Name,Class,Section,Roll Number\n"
      + '"Sample School","John Doe","6","A","101"\n'
      + '"Sample School","","6","B","102"';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "students_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map(val => val.replace(/^"|"$/g, ''));
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      if (lines.length === 0) {
        toast.error("The CSV file is empty");
        return;
      }

      const results = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseCsvLine(line);
        // Expecting School Name, Name, Class, Section, Roll Number
        const schoolName = cols[0] || '';
        const name = cols[1] || '';
        const studentClass = cols[2] || '';
        const section = cols[3] || '';
        const rollNumber = cols[4] || '';

        if (!rollNumber) {
          toast.warning(`Row ${i}: Roll Number is empty. Skipping row.`);
          continue;
        }

        results.push({
          schoolName: schoolName.trim(),
          name: name.trim(),
          studentClass: studentClass.trim().replace(/[^0-9]/g, ''),
          section: section.trim().toUpperCase(),
          rollNumber: rollNumber.trim()
        });
      }

      if (results.length === 0) {
        toast.error("No valid student records found in CSV");
      } else {
        setParsedCsvData(results);
        toast.success(`Parsed ${results.length} student records!`);
      }
    };
    reader.readAsText(file);
  };

  const handleProcessGroupImport = async () => {
    if (parsedCsvData.length === 0) return;
    setCsvLoading(true);
    setImportProgress({ current: 0, total: parsedCsvData.length });

    let successCount = 0;
    let failCount = 0;

    const currentSchools = [...schools];

    for (let i = 0; i < parsedCsvData.length; i++) {
      setImportProgress(prev => ({ ...prev, current: i + 1 }));
      const row = parsedCsvData[i];

      try {
        let schoolId = '';
        if (row.schoolName) {
          const matchedSchool = currentSchools.find(s => s.name.toLowerCase().trim() === row.schoolName.toLowerCase().trim());
          if (matchedSchool) {
            schoolId = matchedSchool.id;
          } else {
            const newSchoolRef = await addDoc(collection(db, 'schools'), {
              name: row.schoolName,
              location: 'Imported Location',
              state: 'Imported State'
            });
            schoolId = newSchoolRef.id;
            const newSchool = { id: schoolId, name: row.schoolName, location: 'Imported Location', state: 'Imported State' };
            currentSchools.push(newSchool);
          }
        }

        const finalName = row.name ? row.name.trim() : `Student #${row.rollNumber}`;

        const cleanSchool = row.schoolName ? row.schoolName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'unmapped';
        const cleanRoll = row.rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanClass = row.studentClass ? row.studentClass.toLowerCase().replace(/[^0-9]/g, '') : 'g';
        const cleanSection = row.section ? row.section.toLowerCase().replace(/[^a-z0-9]/g, '') : 's';
        const studentEmail = `student.${cleanSchool}.${cleanClass}.${cleanSection}.${cleanRoll || Math.floor(Math.random() * 10000)}@funscholar.com`;

        let resolvedUid: string;
        try {
          const response = await fetch('/api/auth/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: studentEmail, password: 'welcome123' })
          });
          const resJson = await response.json();
          if (!response.ok || !resJson.success) {
            throw new Error(resJson.error || 'Server error creating credentials');
          }
          resolvedUid = resJson.uid;
        } catch (authError: any) {
          console.error("Auth sync error for row ", i, authError);
          throw new Error(`Failed auth sync: ${authError.message}`);
        }

        const combinedClassSection = row.studentClass && row.section ? `${row.studentClass}${row.section}` : (row.studentClass || row.section || '');
        const newStudentProfile: UserProfile = {
          uid: resolvedUid,
          name: finalName,
          email: studentEmail,
          role: 'student',
          roles: ['student'],
          schoolIds: schoolId ? [schoolId] : [],
          xp: 0,
          level: 1,
          password: 'welcome123',
          badges: [],
          mode: 'online',
          studentClass: row.studentClass,
          section: row.section,
          classSection: combinedClassSection,
          rollNumber: row.rollNumber,
          lastLogin: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', resolvedUid), newStudentProfile);
        successCount++;
      } catch (err: any) {
        console.error("Row import failure:", row, err);
        failCount++;
      }
    }

    setCsvLoading(false);
    setParsedCsvData([]);
    setIsCsvModalOpen(false);

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} students!`);
      logAudit(profile, 'Group CSV Import', `Bulk imported ${successCount} students (Failed: ${failCount})`);
    } else {
      toast.error("Failed to import any student. Check logs.");
    }
  };

  const handleOpenAddModal = () => {
    setEditingStudent(null);
    setShowPassword(false);
    setFormData({ name: '', email: '', password: '', schoolId: '', level: 1, xp: 0, studentClass: '', section: '', rollNumber: '', role: 'student', roles: ['student'] });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (student: UserProfile) => {
    setEditingStudent(student);
    setShowPassword(false);
    
    const parsedClass = student.studentClass || (student.classSection ? student.classSection.replace(/[^0-9]/g, '') : '');
    const parsedSection = student.section || (student.classSection ? student.classSection.replace(/[0-9]/g, '') : '');

    setFormData({ 
      name: student.name, 
      email: student.email, 
      password: student.password || '', 
      schoolId: student.schoolIds?.[0] || '',
      level: student.level || 1,
      xp: student.xp || 0,
      studentClass: parsedClass,
      section: parsedSection,
      rollNumber: student.rollNumber || '',
      role: student.role || 'student',
      roles: student.roles || [student.role || 'student']
    });
    setIsModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      let primaryRole = formData.role || 'student';
      let rolesArr = formData.roles && formData.roles.length > 0 ? formData.roles : [primaryRole];
      if (!rolesArr.includes(primaryRole)) {
        primaryRole = rolesArr[0];
      }

      const finalClass = formData.studentClass.trim();
      const finalSection = formData.section.trim().toUpperCase();
      const combinedClassSection = finalClass && finalSection ? `${finalClass}${finalSection}` : (finalClass || finalSection || '');

      if (editingStudent) {
        // If a password is provided, always run the Firebase Auth password sync to make sure Auth & database are in sync
        if (formData.password) {
          try {
            const response = await fetch('/api/auth/update-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: editingStudent.email, password: formData.password })
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

        const updateObj: any = {
          name: formData.name,
          schoolIds: formData.schoolId ? [formData.schoolId] : [],
          level: Number(formData.level),
          xp: Number(formData.xp),
          studentClass: finalClass,
          section: finalSection,
          classSection: combinedClassSection,
          rollNumber: formData.rollNumber.trim(),
          role: primaryRole,
          roles: rolesArr
        };
        if (formData.password) {
          updateObj.password = formData.password;
        }

        await updateDoc(doc(db, 'users', editingStudent.uid), updateObj);
        toast.success('Student updated successfully');
        logAudit(profile, 'Edit Student', `Updated student profile: ${formData.name} (${formData.email})`, { targetUserId: editingStudent.uid, classSection: combinedClassSection });
      } else {
        // Create new student via admin API
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

        const newStudentProfile: UserProfile = {
          uid: resolvedUid,
          name: formData.name,
          email: formData.email,
          role: primaryRole,
          roles: rolesArr,
          schoolIds: formData.schoolId ? [formData.schoolId] : [],
          xp: Number(formData.xp),
          level: Number(formData.level),
          password: formData.password || 'welcome123',
          badges: [],
          mode: 'online',
          studentClass: finalClass,
          section: finalSection,
          classSection: combinedClassSection,
          rollNumber: formData.rollNumber.trim(),
          lastLogin: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', resolvedUid), newStudentProfile);
        toast.success('Student account created successfully');
        logAudit(profile, 'Add Student', `Created student profile: ${formData.name} (${formData.email})`, { targetUserId: resolvedUid, classSection: combinedClassSection });
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
      logAudit(profile, 'Update Student Mode', `Changed learning mode for ${student.name} to ${newMode}`, { targetUserId: student.uid, mode: newMode });
    } catch (error) {
      toast.error('Failed to update student mode');
    }
  };

  const deleteStudent = async (uid: string) => {
    if (!window.confirm('Are you sure you want to delete this student? This action cannot be undone.')) return;
    const studentName = students.find(s => s.uid === uid)?.name || uid;
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('Student deleted successfully');
      logAudit(profile, 'Delete Student', `Deleted student profile: ${studentName}`, { targetUserId: uid });
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
       {canManageStudents && (
         <button
           onClick={handleOpenAddModal}
           className="flex items-center gap-2 bg-[#F27D26] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#d66a1e] transition-all"
         >
           <Plus size={20} />
           Add New Student
         </button>
       )}
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
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  disabled={editingStudent !== null}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] disabled:opacity-50"
                  placeholder="student@funscholar.com"
                />
                {editingStudent && (
                  <p className="text-[10px] text-white/40 italic mt-1 font-mono">Note: Registered email addresses cannot be modified.</p>
                )}
              </div>
               <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-widest">
                    {editingStudent ? 'Redefine Password' : 'Password'}
                  </label>
                  {editingStudent && (
                    <span className="text-[10px] text-[#F27D26] font-medium font-mono uppercase tracking-wider">Updates live in auth & database</span>
                  )}
                </div>
                <div className="relative">
                  <Key size={14} className="absolute left-4 top-4 text-white/30" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!editingStudent}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-3 focus:outline-none focus:border-[#F27D26] text-white font-mono placeholder-white/30 transition-colors"
                    placeholder={editingStudent ? "Type new password to override" : "••••••••"}
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
                <p className="text-[10px] text-white/40 mt-1">Change or assign password credentials immediately for custom overrides.</p>
              </div>
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">School</label>
                  <select
                    value={formData.schoolId}
                    onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 focus:outline-none focus:border-[#F27D26] text-sm"
                  >
                    <option value="" className="bg-[#151619]">Unmapped</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id} className="bg-[#151619]">{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Class (Grade)</label>
                  <input
                    type="text"
                    value={formData.studentClass}
                    onChange={(e) => setFormData({ ...formData, studentClass: e.target.value.replace(/[^0-9]/g, '') })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 focus:outline-none focus:border-[#F27D26] text-sm"
                    placeholder="e.g. 6"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Section</label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value.toUpperCase() })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 focus:outline-none focus:border-[#F27D26] text-sm"
                    placeholder="e.g. A"
                    maxLength={5}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Roll Number</label>
                <input
                  type="text"
                  value={formData.rollNumber}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26]"
                  placeholder="e.g. 101"
                />
              </div>

              {isSuperAdmin && (
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-[#F27D26] uppercase tracking-widest mb-2">Assigned Roles</label>
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
                                  : formData.roles.filter(r => r !== roleOpt as UserRole);
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

                  <div>
                    <label className="block text-[10px] font-extrabold text-[#F27D26] uppercase tracking-widest mb-1.5 font-mono">Primary Default Role</label>
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
                    </select>
                  </div>
                </div>
              )}
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
              <th className="p-4 text-[10px] uppercase font-bold tracking-widest text-white/40">Class Section</th>
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
                      <div className="w-10 h-10 rounded-full bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26] font-bold overflow-hidden flex-shrink-0 border border-white/5">
                        {student.photoUrl ? (
                          <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          student.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-sm flex items-center gap-2">
                          {student.name}
                          {student.rollNumber && (
                            <span className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded font-mono text-white/50" title="Roll Number">
                              #{student.rollNumber}
                            </span>
                          )}
                        </p>
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
                  <td className="p-4 text-sm font-semibold text-white/80">
                    {student.studentClass || student.section ? (
                      <div className="flex flex-col">
                        <span>Class {student.studentClass || 'N/A'}</span>
                        <span className="text-[10px] text-white/40 font-mono">Sec {student.section || 'N/A'}</span>
                      </div>
                    ) : (
                      student.classSection || 'N/A'
                    )}
                  </td>
                  <td className="p-4">
                    <button
                      disabled={!canManageStudents}
                      onClick={() => toggleMode(student)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                        student.mode === 'in-school' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                          : 'bg-green-500/10 text-green-400 border border-green-500/20'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                    {canManageStudents ? (
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
                    ) : (
                      <span className="text-[10px] text-white/20 italic font-mono uppercase">Read Only</span>
                    )}
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

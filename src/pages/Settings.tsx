import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { School } from '../types';
import { User, Shield, School as SchoolIcon, RefreshCw, Layers, CheckSquare, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface RolePermission {
  id: string; // e.g., 'super_admin' | 'admin' | 'user_manager_admin' | 'curriculum_admin' | 'teacher' | 'student'
  name: string;
  description: string;
  canManageUsers: boolean;
  canManageCurriculum: boolean;
  canViewReports: boolean;
  canManageExpenses: boolean;
  canCreateCourses: boolean;
  canSubmitProjects: boolean;
}

export default function Settings() {
  const { profile, realRole } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Default permissions if document is not defined yet in Firestore
  const defaultPermissions: RolePermission[] = [
    {
      id: 'super_admin',
      name: 'Super Admin',
      description: 'Superior of all. Only accessible to system creators (e.g. info@funscholar.com / Gaurav Jain). Full absolute rights.',
      canManageUsers: true,
      canManageCurriculum: true,
      canViewReports: true,
      canManageExpenses: true,
      canCreateCourses: true,
      canSubmitProjects: true,
    },
    {
      id: 'user_manager_admin',
      name: 'User Manager Admin',
      description: 'Administration staff in charge of maintaining student registries, schools, and teacher accounts.',
      canManageUsers: true,
      canManageCurriculum: false,
      canViewReports: true,
      canManageExpenses: false,
      canCreateCourses: false,
      canSubmitProjects: false,
    },
    {
      id: 'curriculum_admin',
      name: 'Curriculum Admin',
      description: 'Administration staff in charge of content syndication, lesson matrix, and school resource expenses.',
      canManageUsers: false,
      canManageCurriculum: true,
      canViewReports: false,
      canManageExpenses: true,
      canCreateCourses: true,
      canSubmitProjects: false,
    },
    {
      id: 'teacher',
      name: 'Teacher / Trainer',
      description: 'Academic facilitator and trainers running classroom operations, attendance, and local expenses.',
      canManageUsers: false,
      canManageCurriculum: false,
      canViewReports: true,
      canManageExpenses: true,
      canCreateCourses: true,
      canSubmitProjects: false,
    },
    {
      id: 'student',
      name: 'Student Learner',
      description: 'Portals for children to complete robotics microtasks, construct projects, and submit source code.',
      canManageUsers: false,
      canManageCurriculum: false,
      canViewReports: false,
      canManageExpenses: false,
      canCreateCourses: false,
      canSubmitProjects: true,
    }
  ];

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schools');
    });
    return () => unsubscribe();
  }, []);

  // Fetch or initialize Role definitions from Firestore
  useEffect(() => {
    const permDocRef = doc(db, 'settings', 'role_permissions');
    const unsubscribe = onSnapshot(permDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.rolesList) {
          setPermissions(data.rolesList as RolePermission[]);
        } else {
          setPermissions(defaultPermissions);
        }
      } else {
        // Create initial config doc
        setDoc(permDocRef, { rolesList: defaultPermissions })
          .then(() => setPermissions(defaultPermissions))
          .catch(err => console.error("Could not write initial roles configs", err));
      }
    });

    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (newRole: string) => {
    if (!profile?.uid) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        role: newRole
      });
      toast.success(`Role updated to ${newRole}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
      toast.error('Failed to update role');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTogglePermission = (roleId: string, permissionKey: keyof Omit<RolePermission, 'id' | 'name' | 'description'>) => {
    // Only Super Admin can change role definitions
    if (realRole !== 'admin') {
      toast.error("Only Super Admins can mutate global system role permissions!");
      return;
    }
    // Safeguard: Do not mutate Super Admin permissions to avoid self-lockout
    if (roleId === 'super_admin') {
      toast.error("Absolute authority of Super Admin cannot be restricted!");
      return;
    }

    setPermissions(prev => prev.map(p => {
      if (p.id === roleId) {
        return {
          ...p,
          [permissionKey]: !p[permissionKey]
        };
      }
      return p;
    }));
  };

  const handleUpdateRoleDescription = (roleId: string, value: string) => {
    if (realRole !== 'admin') return;
    setPermissions(prev => prev.map(p => {
      if (p.id === roleId) {
        return {
          ...p,
          description: value
        };
      }
      return p;
    }));
  };

  const handleSavePermissions = async () => {
    if (realRole !== 'admin') {
      toast.error("Insufficient authority.");
      return;
    }
    setSavingPermissions(true);
    try {
      await setDoc(doc(db, 'settings', 'role_permissions'), { rolesList: permissions });
      toast.success("Role configurations and power assignments saved persistently to Firestore!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update role permissions mapping.");
    } finally {
      setSavingPermissions(false);
    }
  };

  const schoolNames = profile?.schoolIds?.map(id => schools.find(s => s.id === id)?.name).filter(Boolean).join(', ') || 'Not Mapped';

  return (
    <div className="space-y-8 pb-16">
      <header>
        <h2 className="text-4xl font-bold tracking-tight">System Settings</h2>
        <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Manage your profile, preferences, and configure framework permissions</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Hand: User Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#151619] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26] border-2 border-[#F27D26]/20">
                <User size={32} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{profile?.name}</h3>
                <p className="text-white/40 text-xs truncate">{profile?.email}</p>
                {profile?.phone && <p className="text-white/30 text-[10px] font-mono truncate mt-0.5">{profile?.phone}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-[#F27D26]/10 text-[#F27D26] text-[8px] font-bold uppercase rounded border border-[#F27D26]/20 tracking-wider">
                    {profile?.role || 'User'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-white/5 text-sm">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono tracking-widest text-white/40 flex items-center gap-1.5 leading-none">
                  <SchoolIcon size={11} className="text-[#F27D26]" />
                  Associated Schools
                </label>
                <p className="text-white/80 font-medium text-xs break-words">{schoolNames}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono tracking-widest text-white/40 flex items-center gap-1.5 leading-none">
                  <Shield size={11} className="text-[#F27D26]" />
                  Access Level
                </label>
                <p className="text-white/80 font-medium text-xs capitalize">{profile?.role} Operations Mode</p>
              </div>
            </div>
          </div>

          <div className="bg-[#151619] border border-white/5 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-3">System Information</h3>
            <div className="space-y-2 text-xs text-white/50 font-mono">
              <p className="flex justify-between"><span>Framework version:</span><span className="text-white/70">v1.3.0</span></p>
              <p className="flex justify-between"><span>Database sync:</span><span className="text-white/70">Firestore Active</span></p>
              <p className="flex justify-between text-right"><span className="text-left">Project context:</span><span className="text-white/70 break-all">{db.app.options.projectId}</span></p>
            </div>
          </div>
        </div>

        {/* Right Hand: Interactive Role Authority and Power Configurator */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#151619] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-white font-sans">
                  <Layers size={20} className="text-[#F27D26]" />
                  Role Definitions & Authority Matrix
                </h3>
                <p className="text-white/40 text-xs mt-1">Configure global role access rights and specific organizational powers</p>
              </div>
              {realRole === 'admin' && (
                <button
                  onClick={handleSavePermissions}
                  disabled={savingPermissions}
                  className="bg-[#F27D26] hover:bg-[#d66a1e] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-orange-500/10 cursor-pointer"
                >
                  {savingPermissions ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Powers Template
                </button>
              )}
            </div>

            {realRole !== 'admin' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3 text-xs text-blue-400">
                <Shield size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-1">View-Only Access Mode</span>
                  Only Super Administrators can modify global system roles or reassign permission capabilities. You are viewing live rules.
                </div>
              </div>
            )}

            <div className="space-y-6">
              {permissions.map((p) => (
                <div 
                  key={p.id} 
                  className={cn(
                    "p-5 rounded-2xl border transition-all",
                    p.id === 'super_admin' ? "bg-purple-900/10 border-purple-500/15" : "bg-white/[0.01] border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white capitalize">{p.name}</h4>
                        {p.id === 'super_admin' && (
                          <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 font-semibold rounded text-[8px] font-mono uppercase text-purple-300">Absolute Root</span>
                        )}
                      </div>
                      
                      {realRole === 'admin' && p.id !== 'super_admin' ? (
                        <input
                          type="text"
                          value={p.description}
                          onChange={(e) => handleUpdateRoleDescription(p.id, e.target.value)}
                          className="text-white/50 text-xs bg-white/5 border border-white/5 focus:border-[#F27D26] focus:outline-none px-2 py-1 rounded w-full mt-1.5"
                        />
                      ) : (
                        <p className="text-white/40 text-xs mt-1.5 font-sans leading-relaxed">{p.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <p className="text-[10px] uppercase font-mono tracking-wider text-[#F27D26] mb-3">Enforceable Capabilities Matrix</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        { key: 'canManageUsers', label: 'Manage Users/Staff Roster' },
                        { key: 'canManageCurriculum', label: 'Manage Curriculum & Subjects' },
                        { key: 'canViewReports', label: 'View Academic Progress Reports' },
                        { key: 'canManageExpenses', label: 'Manage Expenses Logging' },
                        { key: 'canCreateCourses', label: 'Syndicate Courses & Material' },
                        { key: 'canSubmitProjects', label: 'Grade & Submit Code Projects' },
                      ].map((perm) => {
                        const val = p[perm.key as keyof Omit<RolePermission, 'id' | 'name' | 'description'>];
                        return (
                          <button
                            key={perm.key}
                            type="button"
                            onClick={() => handleTogglePermission(p.id, perm.key as any)}
                            disabled={p.id === 'super_admin' || realRole !== 'admin'}
                            className={cn(
                              "flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all",
                              val 
                                ? "bg-[#F27D26]/10 border-[#F27D26]/20 text-white" 
                                : "bg-black/20 border-white/5 text-white/20 hover:text-white/30"
                            )}
                          >
                            <CheckSquare 
                              size={14} 
                              className={cn(
                                "shrink-0",
                                val ? "text-[#F27D26]" : "text-white/10"
                              )} 
                            />
                            <span className="text-[10px] font-medium leading-tight font-sans select-none">{perm.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { UserProfile, UserRole } from './types';
import { logAudit } from './lib/audit';

interface AuthContextType {
  user: User | null;
  profile: (UserProfile & { adminSubRole?: string }) | null;
  loading: boolean;
  login: (rememberMe?: boolean) => Promise<void>;
  loginWithEmail: (email: string, pass: string, rememberMe?: boolean) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  partners: UserProfile[];
  setPartners: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  realRole: UserRole | null;
  activeRole: UserRole | null;
  changeActiveRole: (role: UserRole | null) => void;
  activeAdminSubRole: string;
  changeActiveAdminSubRole: (subRole: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [partners, setPartners] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeRole, setActiveRole] = useState<UserRole | null>(() => {
    return (localStorage.getItem('funscholar_active_role') as UserRole) || null;
  });

  const [activeAdminSubRole, setActiveAdminSubRole] = useState<string>(() => {
    return localStorage.getItem('funscholar_active_admin_sub_role') || 'Super Admin';
  });

  const changeActiveRole = (role: UserRole | null) => {
    setActiveRole(role);
    if (role) {
      localStorage.setItem('funscholar_active_role', role);
    } else {
      localStorage.removeItem('funscholar_active_role');
    }
  };

  const changeActiveAdminSubRole = (subRole: string) => {
    setActiveAdminSubRole(subRole);
    localStorage.setItem('funscholar_active_admin_sub_role', subRole);
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      // Clean up previous profile listener if it exists
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Real-time profile listener
      unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (profileDoc) => {
        if (profileDoc.exists()) {
          const existingProfile = { uid: profileDoc.id, ...profileDoc.data() } as UserProfile;
          
          // Force admin role for the primary admin email
          const isAdminEmail = firebaseUser.email?.toLowerCase().trim() === 'info@funscholar.com';
          if (isAdminEmail && existingProfile.role !== 'admin') {
            existingProfile.role = 'admin';
            await setDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' }, { merge: true });
          }
          
          setProfile(existingProfile);
          
          // Update last login only once per session or periodically
          const lastLogin = existingProfile.lastLogin ? new Date(existingProfile.lastLogin).getTime() : 0;
          const now = new Date().getTime();
          if (now - lastLogin > 3600000) {
            await setDoc(doc(db, 'users', firebaseUser.uid), { lastLogin: new Date().toISOString() }, { merge: true });
            logAudit(existingProfile, 'Login', 'Logged in to the platform');
          }
        } else {
          // ONLY create profile automatically for the primary admin email
          const isAdminEmail = firebaseUser.email?.toLowerCase().trim() === 'info@funscholar.com';
          if (isAdminEmail) {
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Admin',
              email: firebaseUser.email || '',
              role: 'admin',
              xp: 0,
              level: 1,
              badges: [],
              mode: 'online',
              lastLogin: new Date().toISOString()
            };
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
              setProfile(newProfile);
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
            }
          } else {
            // For other users, if profile doesn't exist, they shouldn't be here
            console.error("No profile found for user:", firebaseUser.email);
            setProfile(null);
            // We don't sign out automatically here to avoid loops, 
            // but the UI will show they have no access.
          }
        }
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const login = async (rememberMe?: boolean) => {
    if (rememberMe !== undefined) {
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
    }
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string, rememberMe?: boolean) => {
    if (rememberMe !== undefined) {
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
    }
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, name: string, role: UserRole) => {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(firebaseUser, { displayName: name });
    
    // The onAuthStateChanged listener will handle profile creation if it doesn't exist,
    // but we can pre-emptively set the role here by writing to Firestore.
    const isAdminEmail = email === 'info@funscholar.com';
    const newProfile: UserProfile = {
      uid: firebaseUser.uid,
      name: name,
      email: email,
      role: isAdminEmail ? 'admin' : role,
      xp: 0,
      level: 1,
      badges: [],
      mode: 'online',
      lastLogin: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
    setProfile(newProfile);
  };

  const logout = async () => {
    if (profile) {
      await logAudit(profile, 'Logout', 'Logged out of the platform');
    }
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('funscholar_session_start');
    }
    await signOut(auth);
  };

  const realRole = profile?.role || null;
  const isCreatorOfSystem = profile?.email?.toLowerCase().trim() === 'info@funscholar.com';
  const hasMultipleRoles = isCreatorOfSystem || (profile?.roles && profile.roles.length > 1);

  const getDynamicPermissions = () => {
    if (!profile) return null;
    
    if (isCreatorOfSystem) {
      if (activeAdminSubRole === 'Super Admin') {
        return {
          adminSubRole: 'Super Admin',
          canAddStudent: true,
          canAddTeacher: true,
          canAddSchool: true,
          canManageContent: true,
        };
      } else if (activeAdminSubRole === 'User Manager Admin') {
        return {
          adminSubRole: 'User Manager Admin',
          canAddStudent: true,
          canAddTeacher: true,
          canAddSchool: true,
          canManageContent: false,
        };
      } else if (activeAdminSubRole === 'Curriculum Admin') {
        return {
          adminSubRole: 'Curriculum Admin',
          canAddStudent: false,
          canAddTeacher: false,
          canAddSchool: false,
          canManageContent: true,
        };
      }
    }
    
    // For other admins, permissions are database-backed on their profile
    const roleStr = profile.adminSubRole || 'Admin';
    const isSuperAdmin = roleStr === 'Super Admin';
    return {
      adminSubRole: roleStr,
      canAddStudent: isSuperAdmin || !!profile.canAddStudent,
      canAddTeacher: isSuperAdmin || !!profile.canAddTeacher,
      canAddSchool: isSuperAdmin || !!profile.canAddSchool,
      canManageContent: isSuperAdmin || !!profile.canManageContent,
    };
  };

  const dynPerms = getDynamicPermissions();

  const computedProfile = profile ? {
    ...profile,
    role: (hasMultipleRoles && activeRole) ? activeRole : profile.role,
    ...(profile.role === 'admin' && dynPerms ? dynPerms : {
      canAddStudent: false,
      canAddTeacher: false,
      canAddSchool: false,
      canManageContent: false,
    })
  } : null;

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile: computedProfile, 
      loading, 
      login, 
      loginWithEmail, 
      signUpWithEmail, 
      logout,
      partners,
      setPartners,
      realRole,
      activeRole,
      changeActiveRole,
      activeAdminSubRole,
      changeActiveAdminSubRole
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { School } from '../types';
import { User, Shield, School as SchoolIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { profile } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schools');
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

  const schoolNames = profile?.schoolIds?.map(id => schools.find(s => s.id === id)?.name).filter(Boolean).join(', ') || 'Not Mapped';

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-4xl font-bold tracking-tight">Account Settings</h2>
        <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Manage your profile and preferences</p>
      </header>

      <div className="max-w-2xl space-y-6">
        <div className="bg-[#151619] border border-white/5 rounded-2xl p-8 space-y-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26] border-2 border-[#F27D26]/20">
              <User size={48} />
            </div>
            <div>
              <h3 className="text-2xl font-bold">{profile?.name}</h3>
              <p className="text-white/40">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-3 py-1 bg-[#F27D26]/10 text-[#F27D26] text-[10px] font-bold uppercase rounded-full border border-[#F27D26]/20">
                  {profile?.role}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-white/5">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50 flex items-center gap-2">
                <SchoolIcon size={12} />
                Associated Schools
              </label>
              <p className="text-lg font-medium">{schoolNames}</p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-white/50 flex items-center gap-2">
                <Shield size={12} />
                Access Level
              </label>
              <p className="text-lg font-medium capitalize">{profile?.role} Access</p>
            </div>
          </div>
        </div>

        <div className="bg-[#151619] border border-white/5 rounded-2xl p-8">
          <h3 className="text-xl font-bold mb-4">System Information</h3>
          <div className="space-y-4 text-sm text-white/60">
            <p>FunScholar LMS v1.0.0</p>
            <p>Connected to Firebase: {db.app.options.projectId}</p>
            <p>Region: asia-south1</p>
          </div>
        </div>
      </div>
    </div>
  );
}

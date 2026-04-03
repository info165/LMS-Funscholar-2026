import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, addDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { TeacherLog } from '../types';
import { useAuth } from '../AuthContext';
import { ClipboardList, Plus, Clock } from 'lucide-react';

export default function Logs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<TeacherLog[]>([]);
  const [newActivity, setNewActivity] = useState('');

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'logs'),
      where('teacherId', '==', profile.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });
    return () => unsubscribe();
  }, [profile]);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newActivity) return;
    try {
      await addDoc(collection(db, 'logs'), {
        teacherId: profile.uid,
        activity: newActivity,
        timestamp: new Date().toISOString()
      });
      setNewActivity('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'logs');
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-4xl font-bold tracking-tight">Activity Logs</h2>
        <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Maintain your daily teaching records</p>
      </header>

      <form onSubmit={handleAddLog} className="bg-[#151619] p-6 rounded-2xl border border-white/5 flex gap-4 items-end">
        <div className="flex-1 space-y-2">
          <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Activity Description</label>
          <input
            type="text"
            value={newActivity}
            onChange={(e) => setNewActivity(e.target.value)}
            className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#F27D26]"
            placeholder="What did you do today? e.g. Conducted class 8 robotics workshop"
          />
        </div>
        <button
          type="submit"
          className="bg-[#F27D26] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#d66a1e] transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Log Activity
        </button>
      </form>

      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="p-6 bg-[#151619] border border-white/5 rounded-2xl flex items-center gap-6">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/40">
              <Clock size={24} />
            </div>
            <div className="flex-1">
              <p className="text-lg font-medium">{log.activity}</p>
              <p className="text-xs text-white/40 mt-1">
                {new Date(log.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

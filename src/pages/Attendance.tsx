import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { UserProfile, Attendance } from '../types';
import { Check, X, Users, Calendar, Search, ChevronRight, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export default function AttendancePage() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!profile?.schoolIds || profile.schoolIds.length === 0) return;

    const unsubStudents = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'student'), where('schoolIds', 'array-contains', profile.schoolIds[0])),
      (snapshot) => {
        setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
        setLoading(false);
      }
    );

    return () => unsubStudents();
  }, [profile]);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!profile?.schoolIds || profile.schoolIds.length === 0) return;
      
      const q = query(
        collection(db, 'attendance'),
        where('schoolId', '==', profile.schoolIds[0]),
        where('date', '==', selectedDate)
      );
      
      const snapshot = await getDocs(q);
      const data: Record<string, boolean> = {};
      snapshot.docs.forEach(doc => {
        const record = doc.data() as Attendance;
        data[record.studentId] = record.status === 'present';
      });
      setAttendance(data);
    };

    fetchAttendance();
  }, [selectedDate, profile]);

  const toggleAttendance = (studentId: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const saveAttendance = async () => {
    if (!profile?.schoolIds || profile.schoolIds.length === 0) return;
    setSaving(true);
    
    try {
      // First, clear existing records for this date and school to avoid duplicates
      const q = query(
        collection(db, 'attendance'),
        where('schoolId', '==', profile.schoolIds[0]),
        where('date', '==', selectedDate)
      );
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'attendance', d.id)));
      await Promise.all(deletePromises);

      // Now add new records
      const addPromises = Object.entries(attendance).map(([studentId, isPresent]) => {
        return addDoc(collection(db, 'attendance'), {
          studentId,
          schoolId: profile.schoolIds![0],
          teacherId: profile.uid,
          date: selectedDate,
          status: isPresent ? 'present' : 'absent',
          timestamp: serverTimestamp()
        });
      });

      await Promise.all(addPromises);
      toast.success('Attendance saved successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Attendance</h2>
          <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Manage daily student presence</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#151619] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[#F27D26] transition-colors"
            />
          </div>
          <button
            onClick={saveAttendance}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[#F27D26] text-white rounded-xl font-bold text-sm hover:bg-[#d66a1e] transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : <><Save size={18} /> Save Changes</>}
          </button>
        </div>
      </header>

      <div className="bg-[#151619] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[#F27D26] transition-colors"
            />
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-white/60">Present: {Object.values(attendance).filter(v => v).length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-white/60">Absent: {students.length - Object.values(attendance).filter(v => v).length}</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-xs uppercase tracking-widest text-white/40">
                <th className="px-6 py-4 font-bold">Student</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence>
                {filteredStudents.map((student) => (
                  <motion.tr
                    key={student.uid}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26] font-bold overflow-hidden flex-shrink-0 border border-white/5">
                          {student.photoUrl ? (
                            <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            student.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-xs text-white/40">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        attendance[student.uid] 
                          ? "bg-green-500/10 text-green-400" 
                          : "bg-red-500/10 text-red-400"
                      )}>
                        {attendance[student.uid] ? 'Present' : 'Absent'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleAttendance(student.uid)}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          attendance[student.uid]
                            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                        )}
                      >
                        {attendance[student.uid] ? <X size={18} /> : <Check size={18} />}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

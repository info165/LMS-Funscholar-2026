import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { School } from '../types';
import { Plus, Trash2, MapPin, Edit2, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import { logAudit } from '../lib/audit';

export default function Schools() {
  const { profile } = useAuth();
  const canManage = profile?.role === 'admin' && (profile?.adminSubRole === 'Super Admin' || !!profile?.canAddSchool);

  const [schools, setSchools] = useState<School[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    state: ''
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schools');
    });
    return () => unsubscribe();
  }, []);

  const handleOpenAddModal = () => {
    setEditingSchool(null);
    setFormData({ name: '', location: '', state: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (school: School) => {
    setEditingSchool(school);
    setFormData({ name: school.name, location: school.location, state: school.state });
    setIsModalOpen(true);
  };

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.location || !formData.state) return;
    setLoading(true);
    try {
      if (editingSchool) {
        await updateDoc(doc(db, 'schools', editingSchool.id), formData);
        toast.success('School updated successfully');
        logAudit(profile, 'Edit School', `Updated school details for: ${formData.name}`, { schoolId: editingSchool.id, ...formData });
      } else {
        const docRef = await addDoc(collection(db, 'schools'), formData);
        toast.success('School added successfully');
        logAudit(profile, 'Add School', `Created new school: ${formData.name}`, { schoolId: docRef.id, ...formData });
      }
      setIsModalOpen(false);
      setFormData({ name: '', location: '', state: '' });
    } catch (error) {
      handleFirestoreError(error, editingSchool ? OperationType.UPDATE : OperationType.CREATE, editingSchool ? `schools/${editingSchool.id}` : 'schools');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchool = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this school?')) return;
    const schoolName = schools.find(s => s.id === id)?.name || id;
    try {
      await deleteDoc(doc(db, 'schools', id));
      toast.success('School deleted successfully');
      logAudit(profile, 'Delete School', `Deleted school: ${schoolName}`, { schoolId: id });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `schools/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Schools Management</h2>
          <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Map schools to the LMS</p>
        </div>
        {canManage && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 bg-[#F27D26] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#d66a1e] transition-all"
          >
            <Plus size={20} />
            Add New School
          </button>
        )}
      </header>

      {/* School Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-xl font-bold">{editingSchool ? 'Edit School' : 'Add New School'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/40 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveSchool} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">School Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26]"
                  placeholder="e.g. St. Xavier's High School"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Location</label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26]"
                  placeholder="e.g. Mumbai"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">State</label>
                <input
                  type="text"
                  required
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26]"
                  placeholder="e.g. Maharashtra"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F27D26] text-white py-4 rounded-xl font-bold hover:bg-[#d66a1e] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (editingSchool ? 'Update School' : 'Add School')}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {schools.map((school) => (
          <div key={school.id} className="p-6 bg-[#151619] border border-white/5 rounded-2xl group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#F27D26] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold mb-2">{school.name}</h3>
                <div className="flex flex-col gap-1 text-white/40 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    {school.location}, {school.state}
                  </div>
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(school)}
                    className="p-2 text-white/20 hover:text-[#F27D26] transition-colors"
                    title="Edit School"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteSchool(school.id)}
                    className="p-2 text-white/20 hover:text-red-500 transition-colors"
                    title="Delete School"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

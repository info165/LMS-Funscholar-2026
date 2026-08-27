import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, addDoc, doc, updateDoc, serverTimestamp, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { School, ExpenseTemplate, ExpenseLog, ExpenseLeg, TransportMode } from '../types';
import { Plus, Wallet, History, Save, Edit2, Trash2, CheckCircle, Clock, X, AlertCircle, ChevronRight, Calculator, Download, PlusCircle, MinusCircle, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import Papa from 'papaparse';

const TRANSPORT_MODES: TransportMode[] = ['Auto', 'Bus', 'Train/Metro', 'Bike', 'Personal Vehicle', 'Others'];

export default function Expenses() {
  const { profile } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [expenseLogs, setExpenseLogs] = useState<ExpenseLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states for template
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null); // schoolId
  const [templateLegs, setTemplateLegs] = useState<ExpenseLeg[]>([{ mode: 'Auto', amount: 0 }]);
  const [templateDesc, setTemplateDesc] = useState<string>('');

  // Form states for daily log
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedLegs, setSelectedLegs] = useState<ExpenseLeg[]>([{ mode: 'Auto', amount: 0 }]);
  const [selectedDesc, setSelectedDesc] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Log state
  const [editingLog, setEditingLog] = useState<ExpenseLog | null>(null);
  const [editLogLegs, setEditLogLegs] = useState<ExpenseLeg[]>([]);
  const [editLogDesc, setEditLogDesc] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!profile) return;

    // Fetch all schools for expenses so teachers can travel anywhere
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    });

    const templatesQuery = query(collection(db, 'expenseTemplates'), where('teacherId', '==', profile.uid));
    const unsubTemplates = onSnapshot(templatesQuery, (snapshot) => {
      setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseTemplate)));
    });

    const logsQuery = profile.role === 'admin'
      ? query(collection(db, 'expenseLogs'), orderBy('timestamp', 'desc'), limit(100))
      : query(collection(db, 'expenseLogs'), where('teacherId', '==', profile.uid), orderBy('timestamp', 'desc'), limit(50));

    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      setExpenseLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseLog)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenseLogs');
    });

    return () => {
      unsubSchools();
      unsubTemplates();
      unsubLogs();
    };
  }, [profile]);

  // When a school is selected in the daily log, auto-fill from template
  useEffect(() => {
    if (selectedSchoolId) {
      const template = templates.find(t => t.schoolId === selectedSchoolId);
      if (template) {
        setSelectedLegs(template.legs && template.legs.length > 0 ? template.legs.map(l => ({ ...l })) : [{ mode: 'Auto', amount: 0 }]);
        setSelectedDesc(template.description || `Travel to ${schools.find(s => s.id === selectedSchoolId)?.name}`);
      } else {
        setSelectedLegs([{ mode: 'Auto', amount: 0 }]);
        setSelectedDesc('');
      }
    }
  }, [selectedSchoolId, templates, schools]);

  const handleAddLeg = (type: 'template' | 'log' | 'edit') => {
    const newLeg: ExpenseLeg = { mode: 'Auto', amount: 0 };
    if (type === 'template') setTemplateLegs([...templateLegs, newLeg]);
    else if (type === 'log') setSelectedLegs([...selectedLegs, newLeg]);
    else if (type === 'edit') setEditLogLegs([...editLogLegs, newLeg]);
  };

  const handleRemoveLeg = (idx: number, type: 'template' | 'log' | 'edit') => {
    if (type === 'template') {
      if (templateLegs.length > 1) setTemplateLegs(templateLegs.filter((_, i) => i !== idx));
    } else if (type === 'log') {
      if (selectedLegs.length > 1) setSelectedLegs(selectedLegs.filter((_, i) => i !== idx));
    } else if (type === 'edit') {
      if (editLogLegs.length > 1) setEditLogLegs(editLogLegs.filter((_, i) => i !== idx));
    }
  };

  const handleLegChange = (idx: number, updates: Partial<ExpenseLeg>, type: 'template' | 'log' | 'edit') => {
    if (type === 'template') {
      setTemplateLegs(templateLegs.map((l, i) => i === idx ? { ...l, ...updates } : l));
    } else if (type === 'log') {
      setSelectedLegs(selectedLegs.map((l, i) => i === idx ? { ...l, ...updates } : l));
    } else if (type === 'edit') {
      setEditLogLegs(editLogLegs.map((l, i) => i === idx ? { ...l, ...updates } : l));
    }
  };

  const calculateTotal = (legs: ExpenseLeg[]) => (legs || []).reduce((sum, leg) => sum + (leg.amount || 0), 0);

  const handleSaveTemplate = async (schoolId: string) => {
    if (!profile) return;
    try {
      const template = templates.find(t => t.schoolId === schoolId);
      const data = {
        teacherId: profile.uid,
        schoolId,
        legs: templateLegs || [],
        totalAmount: calculateTotal(templateLegs),
        description: templateDesc
      };

      if (template) {
        await updateDoc(doc(db, 'expenseTemplates', template.id), data);
      } else {
        await addDoc(collection(db, 'expenseTemplates'), data);
      }

      toast.success('Expense template saved successfully');
      setEditingTemplate(null);
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, 'expenseTemplates');
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedSchoolId) return;

    setIsSubmitting(true);
    try {
      const school = schools.find(s => s.id === selectedSchoolId);
      const totalAmount = calculateTotal(selectedLegs);
      
      await addDoc(collection(db, 'expenseLogs'), {
        teacherId: profile.uid,
        teacherName: profile.name,
        schoolId: selectedSchoolId,
        schoolName: school?.name || 'Unknown School',
        legs: selectedLegs || [],
        amount: totalAmount, // For backward compatibility
        totalAmount: totalAmount,
        date: selectedDate,
        description: selectedDesc,
        status: 'pending',
        timestamp: serverTimestamp()
      });

      toast.success('Expense logged successfully');
      setSelectedSchoolId('');
      setSelectedLegs([{ mode: 'Auto', amount: 0 }]);
      setSelectedDesc('');
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, 'expenseLogs');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this expense history entry?")) return;
    try {
      await deleteDoc(doc(db, 'expenseLogs', id));
      toast.success('Log deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenseLogs/${id}`);
    }
  };

  const handleUpdateLog = async () => {
    if (!editingLog) return;
    try {
      const totalAmount = calculateTotal(editLogLegs);
      await updateDoc(doc(db, 'expenseLogs', editingLog.id), {
        legs: editLogLegs || [],
        amount: totalAmount,
        totalAmount: totalAmount,
        description: editLogDesc
      });
      toast.success('Expense record updated');
      setEditingLog(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `expenseLogs/${editingLog.id}`);
    }
  };

  const handleQuickLog = async (schoolId: string) => {
    if (!profile) return;
    const template = templates.find(t => t.schoolId === schoolId);
    const school = schools.find(s => s.id === schoolId);

    if (!template) {
      setSelectedSchoolId(schoolId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.info(`Please set a template for ${school?.name} or log manually.`);
      return;
    }

    const legs = template.legs || [];
    const total = template.totalAmount || calculateTotal(legs);
    if (!window.confirm(`Log ₹${total} for ${school?.name}?`)) return;

    try {
      await addDoc(collection(db, 'expenseLogs'), {
        teacherId: profile.uid,
        teacherName: profile.name,
        schoolId: schoolId,
        schoolName: school?.name || 'Unknown School',
        legs: legs,
        amount: total,
        totalAmount: total,
        date: new Date().toISOString().split('T')[0],
        description: template.description || `Travel to ${school?.name}`,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      toast.success('Expense logged successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenseLogs');
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'approved' | 'rejected') => {
    if (profile?.role !== 'admin') return;
    try {
      await updateDoc(doc(db, 'expenseLogs', id), { status: newStatus });
      toast.success(`Expense ${newStatus}`);
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `expenseLogs/${id}`);
    }
  };

  const downloadCSV = () => {
    const data = expenseLogs.map(log => ({
      Date: log.date,
      Teacher: log.teacherName || 'Unknown',
      School: log.schoolName,
      Amount: log.totalAmount,
      Description: log.description,
      Status: log.status
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `expense_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-1 md:p-6 max-w-7xl mx-auto space-y-8 text-white">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Travel Expenses Log</h1>
          <p className="text-white/50 font-mono text-xs uppercase tracking-widest mt-2">Manage templates and log your daily travel costs</p>
        </div>
        
        {expenseLogs.length > 0 && (
          <button 
            onClick={downloadCSV}
            className="flex items-center gap-2 bg-white/5 border border-white/10 text-white px-5 py-2.5 rounded-xl hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            <Download size={14} /> Export Expenses CSV
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Log Daily Expense */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-[#151619] rounded-[2rem] border border-white/5 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-white/5 flex items-center gap-2">
              <Calculator size={18} className="text-[#F27D26]" />
              <h2 className="font-bold text-sm uppercase tracking-wider text-white">Log Travel Session</h2>
            </div>
            
            <form onSubmit={handleSubmitExpense} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50 flex items-center gap-2">Select Target School</label>
                <select 
                  required
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="w-full bg-black text-white border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F27D26] transition-all"
                >
                  <option value="">- Choose School -</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-black tracking-widest text-[#F27D26]">Transportation Steps</label>
                  <button 
                    type="button" 
                    onClick={() => handleAddLeg('log')}
                    className="text-[10px] flex items-center gap-1 text-[#F27D26] font-bold hover:underline uppercase tracking-wider cursor-pointer"
                  >
                    <PlusCircle size={14} /> Add travel step
                  </button>
                </div>
                
                <div className="space-y-3">
                  {selectedLegs.map((leg, idx) => (
                    <div key={idx} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1">
                      <select
                        value={leg.mode}
                        onChange={(e) => handleLegChange(idx, { mode: e.target.value as TransportMode }, 'log')}
                        className="flex-1 bg-black text-white border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#F27D26]"
                      >
                        {TRANSPORT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input 
                        type="number"
                        required
                        min="0"
                        value={leg.amount || ''}
                        onChange={(e) => handleLegChange(idx, { amount: parseFloat(e.target.value) || 0 }, 'log')}
                        placeholder="Amount ₹"
                        className="w-24 bg-black text-white border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#F27D26] text-right"
                      />
                      {selectedLegs.length > 1 && (
                        <button type="button" onClick={() => handleRemoveLeg(idx, 'log')} className="text-red-500 hover:text-red-400 p-1 cursor-pointer">
                          <MinusCircle size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-dashed border-white/10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Total Day Cost</span>
                  <span className="text-xl font-black text-[#F27D26]">₹{calculateTotal(selectedLegs)}</span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Date of Travel</label>
                  <input 
                    required
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-black text-white border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F27D26] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-white/50 border-white/5 pb-1">Remarks / Expense Description</label>
                <textarea 
                  required
                  value={selectedDesc}
                  onChange={(e) => setSelectedDesc(e.target.value)}
                  placeholder="e.g. Conducted Robotics Class, multiple auto interchanges..."
                  rows={2}
                  className="w-full bg-black text-white border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F27D26] transition-all resize-none"
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting || !selectedSchoolId}
                className="w-full bg-[#F27D26] text-white py-3.5 rounded-xl font-bold hover:bg-[#d66a1e] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#F27D26]/10 text-xs uppercase tracking-wider font-black"
              >
                {isSubmitting ? "Submitting Log..." : "Submit Travel Log"}
                {!isSubmitting && <ChevronRight size={14} />}
              </button>
            </form>
          </section>

          {/* Template Info Card */}
          <section className="bg-[#F27D26]/5 border border-[#F27D26]/10 rounded-[2.5rem] p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-[#F27D26]/10 rounded-lg shrink-0">
                <AlertCircle size={20} className="text-[#F27D26]" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-[#F27D26]">Quick Recording Tips</h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  Configure school templates for travel runs. Once saved, you can log visits in one click, as well as customize multiple transport types for exact logging.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Templates & History */}
        <div className="lg:col-span-2 space-y-8">
          {/* Templates Section */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-lg font-bold">
                <Edit2 size={20} className="text-[#F27D26]" />
                <h2 className="text-xl">Your Destination Guidelines (Templates)</h2>
              </div>
              <div className="relative w-full sm:w-auto">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                  type="text"
                  placeholder="Filter schools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#151619] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#F27D26] w-full sm:w-64"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schools
                .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            s.location.toLowerCase().includes(searchQuery.toLowerCase()))
                .sort((a, b) => {
                  const hasA = templates.some(t => t.schoolId === a.id);
                  const hasB = templates.some(t => t.schoolId === b.id);
                  if (hasA && !hasB) return -1;
                  if (!hasA && hasB) return 1;
                  return a.name.localeCompare(b.name);
                })
                .slice(0, searchQuery ? 20 : 6)
                .map(school => {
                  const template = templates.find(t => t.schoolId === school.id);
                  const isEditing = editingTemplate === school.id;

                  return (
                    <motion.div 
                      layout
                      key={school.id}
                      className={cn(
                        "group relative bg-[#151619] border rounded-2xl p-5 transition-all",
                        isEditing ? "border-[#F27D26] bg-[#1a1b1e]" : "border-white/5 hover:border-white/15"
                      )}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm text-white">{school.name}</h4>
                          <p className="text-xs text-white/40">{school.location}, {school.state}</p>
                        </div>
                        {!template && !isEditing && (
                          <span className="flex items-center gap-1 text-[8px] text-amber-500 font-black uppercase tracking-widest bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                            No Template
                          </span>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-4 pt-2">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] uppercase font-bold tracking-widest text-[#F27D26]">Route legs</label>
                              <button 
                                type="button" 
                                onClick={() => handleAddLeg('template')}
                                className="text-[10px] text-white/60 hover:text-white font-bold flex items-center gap-1 uppercase tracking-wider cursor-pointer"
                              >
                                <Plus size={10} /> Add Leg
                              </button>
                            </div>
                            {templateLegs.map((leg, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <select 
                                  value={leg.mode}
                                  onChange={(e) => handleLegChange(idx, { mode: e.target.value as TransportMode }, 'template')}
                                  className="flex-1 bg-black text-white border border-white/10 rounded-xl px-3 py-2 text-xs outline-none"
                                >
                                  {TRANSPORT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <input 
                                  type="number"
                                  required
                                  min="0"
                                  value={leg.amount || ''}
                                  onChange={(e) => handleLegChange(idx, { amount: parseFloat(e.target.value) || 0 }, 'template')}
                                  placeholder="Amount"
                                  className="w-20 bg-black text-white border border-white/10 rounded-xl px-3 py-2 text-xs outline-none text-right"
                                />
                                {templateLegs.length > 1 && (
                                  <button type="button" onClick={() => handleRemoveLeg(idx, 'template')} className="text-red-500/70 hover:text-red-400 p-1 cursor-pointer">
                                    <MinusCircle size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-dashed border-white/10">
                            <span className="text-[10px] font-bold uppercase text-white/40">Total</span>
                            <span className="text-sm font-black text-[#F27D26]">₹{calculateTotal(templateLegs)}</span>
                          </div>

                          <textarea 
                            value={templateDesc}
                            onChange={(e) => setTemplateDesc(e.target.value)}
                            placeholder="Add brief travel remarks (e.g. Standard auto route)..."
                            rows={2}
                            className="w-full bg-black text-white border border-white/10 rounded-xl px-3 py-3 text-xs outline-none focus:border-[#F27D26] resize-none"
                          />
                          <div className="flex items-center gap-2 pt-1">
                            <button 
                              onClick={() => handleSaveTemplate(school.id)}
                              className="flex-1 bg-[#F27D26] text-white hover:bg-[#d66a1e] text-[10px] py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 uppercase cursor-pointer"
                            >
                              <Save size={12} /> Save Template
                            </button>
                            <button 
                              onClick={() => setEditingTemplate(null)}
                              className="px-4 bg-white/5 text-white text-[10px] py-2.5 rounded-xl font-bold uppercase hover:bg-white/10 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {!template ? (
                            <button 
                               onClick={() => {
                                 setEditingTemplate(school.id);
                                 setTemplateLegs([{ mode: 'Auto', amount: 0 }]);
                                 setTemplateDesc('');
                               }}
                               className="w-full py-5 border border-dashed border-white/10 hover:border-[#F27D26]/50 rounded-xl text-white/40 hover:text-[#F27D26] hover:bg-[#F27D26]/5 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                            >
                               <Plus size={20} />
                               <span className="text-[10px] font-black uppercase tracking-wider">Configure Template</span>
                            </button>
                          ) : (
                            <>
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex flex-col gap-2 w-full">
                                  <div className="flex items-center justify-between w-full">
                                    <span className="text-[10px] text-white/40 uppercase font-black tracking-wider">Total Standard Run</span>
                                    <span className="font-black text-base text-[#F27D26]">₹{template.totalAmount}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {(template.legs || []).map((leg, i) => (
                                      <span key={i} className="text-[9px] px-2 py-0.5 bg-black text-white/70 rounded-md border border-white/5 font-mono">
                                        {leg.mode}: ₹{leg.amount}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                <button 
                                  onClick={() => handleQuickLog(school.id)}
                                  className="flex-1 bg-[#F27D26] text-white hover:bg-[#d66a1e] text-[10px] py-2.5 rounded-xl font-black uppercase tracking-widest hover:opacity-90 transition-all cursor-pointer"
                                >
                                   Quick Log Visit
                                </button>
                                <button 
                                  onClick={() => {
                                    setEditingTemplate(school.id);
                                    setTemplateLegs(template.legs && template.legs.length > 0 ? template.legs.map(l => ({ ...l })) : [{ mode: 'Auto', amount: template.totalAmount }]);
                                    setTemplateDesc(template.description || '');
                                  }}
                                  className="bg-white/5 hover:bg-white/10 text-white/60 hover:text-white p-2.5 rounded-xl transition-colors cursor-pointer border border-white/5"
                                  title="Edit Template Setup"
                                >
                                  <Edit2 size={14} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
            </div>
          </section>

          {/* History Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg font-bold">
                <History size={20} className="text-[#F27D26]" />
                <h2 className="text-xl">Your Travel Expense Records</h2>
              </div>
            </div>

            <div className="bg-[#151619] border border-white/5 rounded-[2rem] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5 text-[9px] font-black uppercase tracking-widest text-white/50 border-b border-white/5">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Destination</th>
                      {profile?.role === 'admin' && <th className="px-6 py-4">Trainer</th>}
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {expenseLogs.map((log) => (
                      <tr key={log.id} className="group hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-white/80">{log.date}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                             <span className="text-sm font-bold text-white">{log.schoolName}</span>
                             <div className="flex flex-wrap gap-1 mt-1">
                                {(log.legs || []).map((leg, i) => (
                                  <span key={i} className="text-[8px] px-1.5 py-0.5 bg-black text-white/50 rounded-md border border-white/10 font-mono">
                                    {leg.mode}: ₹{leg.amount}
                                  </span>
                                ))}
                             </div>
                             {log.description && (
                               <span className="text-xs text-white/40 truncate max-w-[200px] mt-1.5">{log.description}</span>
                             )}
                          </div>
                        </td>
                        {profile?.role === 'admin' && (
                          <td className="px-6 py-4 text-xs font-semibold text-white/80">{log.teacherName}</td>
                        )}
                        <td className="px-6 py-4 text-sm font-black text-[#F27D26] italic">₹{log.totalAmount}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[9px] font-black uppercase flex items-center w-fit gap-1",
                            log.status === 'approved' ? "bg-green-500/10 text-green-500 border border-green-500/20" :
                            log.status === 'rejected' ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                            "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          )}>
                            {log.status === 'pending' && <Clock size={10} />}
                            {log.status === 'approved' && <CheckCircle size={10} />}
                            {log.status === 'rejected' && <X size={10} />}
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                             {log.status === 'pending' && (
                               <button 
                                 onClick={() => {
                                   setEditingLog(log);
                                   setEditLogLegs(log.legs && log.legs.length > 0 ? log.legs.map(l => ({ ...l })) : [{ mode: 'Auto', amount: log.totalAmount }]);
                                   setEditLogDesc(log.description || '');
                                 }}
                                 className="p-1.5 bg-white/5 text-slate-400 hover:text-white rounded-lg border border-white/5 cursor-pointer"
                                 title="Configure Expense Record"
                               >
                                 <Edit2 size={14} />
                               </button>
                             )}
                             {profile?.role === 'admin' && log.status === 'pending' && (
                               <>
                                 <button 
                                   onClick={() => handleStatusChange(log.id, 'approved')}
                                   className="p-1.5 bg-white/5 text-green-500 hover:bg-green-950/20 rounded-lg border border-white/5 cursor-pointer"
                                   title="Approve Record"
                                 >
                                   <CheckCircle size={14} />
                                 </button>
                                 <button 
                                   onClick={() => handleStatusChange(log.id, 'rejected')}
                                   className="p-1.5 bg-white/5 text-red-500 hover:bg-red-950/20 rounded-lg border border-white/5 cursor-pointer"
                                   title="Reject Record"
                                 >
                                   <X size={14} />
                                 </button>
                               </>
                             )}
                             <button 
                               onClick={() => handleDeleteLog(log.id)}
                               className="p-1.5 text-white/30 hover:text-red-500 hover:bg-red-950/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                               title="Permanently Delete Log"
                             >
                               <Trash2 size={14} />
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {expenseLogs.length === 0 && (
                      <tr>
                        <td colSpan={profile?.role === 'admin' ? 6 : 5} className="px-6 py-16 text-center text-white/30 italic">
                           No expense records logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {editingLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#151619] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-white"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <h3 className="text-lg font-bold">Edit Expense Fields</h3>
                <button onClick={() => setEditingLog(null)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white/60 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#F27D26]">Update Route Runs</label>
                    <button 
                      type="button" 
                      onClick={() => handleAddLeg('edit')}
                      className="text-[10px] text-white/60 hover:text-white font-bold flex items-center gap-1 uppercase tracking-wider cursor-pointer"
                    >
                      <Plus size={10} /> Add Leg
                    </button>
                  </div>
                  {editLogLegs.map((leg, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select 
                        value={leg.mode}
                        onChange={(e) => handleLegChange(idx, { mode: e.target.value as TransportMode }, 'edit')}
                        className="flex-1 bg-black text-white border border-white/10 rounded-xl px-3 py-2 text-xs outline-none"
                      >
                        {TRANSPORT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input 
                        type="number"
                        required
                        min="0"
                        value={leg.amount || ''}
                        onChange={(e) => handleLegChange(idx, { amount: parseFloat(e.target.value) || 0 }, 'edit')}
                        placeholder="₹"
                        className="w-20 bg-black text-white border border-white/10 rounded-xl px-3 py-2 text-xs outline-none text-right"
                      />
                      {editLogLegs.length > 1 && (
                        <button type="button" onClick={() => handleRemoveLeg(idx, 'edit')} className="text-red-500/70 hover:text-red-400 p-1 cursor-pointer">
                          <MinusCircle size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-dashed border-white/10">
                    <span className="text-[10px] font-bold uppercase text-white/40">Total New Sum</span>
                    <span className="text-sm font-black text-[#F27D26]">₹{calculateTotal(editLogLegs)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Edit Remarks / Description</label>
                  <textarea 
                    value={editLogDesc}
                    onChange={(e) => setEditLogDesc(e.target.value)}
                    rows={3}
                    className="w-full bg-black text-white border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              <div className="p-6 bg-white/5 border-t border-white/5 flex gap-3">
                <button 
                  onClick={handleUpdateLog}
                  className="flex-1 bg-[#F27D26] hover:bg-[#d66a1e] text-white font-bold py-3 rounded-xl transition-all uppercase tracking-wider text-xs cursor-pointer"
                >
                  Save Updates
                </button>
                <button 
                  onClick={() => setEditingLog(null)}
                  className="flex-1 bg-white/5 border border-white/10 text-white font-bold py-3 rounded-xl hover:bg-white/10 transition-all uppercase tracking-wider text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

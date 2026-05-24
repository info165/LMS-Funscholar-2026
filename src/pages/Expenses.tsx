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
        setSelectedLegs(template.legs.length > 0 ? template.legs.map(l => ({ ...l })) : [{ mode: 'Auto', amount: 0 }]);
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
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Travel Expenses</h1>
          <p className="text-muted-foreground mt-1">Manage templates and log your daily travel costs.</p>
        </div>
        
        {profile?.role === 'admin' && (
          <button 
            onClick={downloadCSV}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl hover:bg-black/80 transition-all font-medium"
          >
            <Download size={18} /> Export CSV
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Log Daily Expense */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex items-center gap-2">
              <Calculator size={18} className="text-secondary" />
              <h2 className="font-semibold">Log Daily Expense</h2>
            </div>
            
            <form onSubmit={handleSubmitExpense} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select School</label>
                <select 
                  required
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="w-full bg-background border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                >
                  <option value="">- Choose School -</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Transportation Legs</label>
                  <button 
                    type="button" 
                    onClick={() => handleAddLeg('log')}
                    className="text-xs flex items-center gap-1 text-secondary font-bold hover:underline"
                  >
                    <PlusCircle size={14} /> Add Mode
                  </button>
                </div>
                
                <div className="space-y-3">
                  {selectedLegs.map((leg, idx) => (
                    <div key={idx} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1">
                      <select
                        value={leg.mode}
                        onChange={(e) => handleLegChange(idx, { mode: e.target.value as TransportMode }, 'log')}
                        className="flex-1 bg-background border rounded-xl px-3 py-2 text-sm outline-none"
                      >
                        {TRANSPORT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input 
                        type="number"
                        value={leg.amount || ''}
                        onChange={(e) => handleLegChange(idx, { amount: parseFloat(e.target.value) || 0 }, 'log')}
                        placeholder="₹"
                        className="w-24 bg-background border rounded-xl px-3 py-2 text-sm outline-none"
                      />
                      {selectedLegs.length > 1 && (
                        <button type="button" onClick={() => handleRemoveLeg(idx, 'log')} className="text-red-500 p-1">
                          <MinusCircle size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-dashed border-border">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Daily Total</span>
                  <span className="text-lg font-black text-secondary">₹{calculateTotal(selectedLegs)}</span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <input 
                    required
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-background border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Remarks / Description</label>
                <textarea 
                  required
                  value={selectedDesc}
                  onChange={(e) => setSelectedDesc(e.target.value)}
                  placeholder="Reason for travel..."
                  rows={2}
                  className="w-full bg-background border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-secondary/20 transition-all resize-none"
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting || !selectedSchoolId}
                className="w-full bg-secondary text-secondary-foreground py-3 rounded-xl font-bold hover:bg-secondary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? "Logging..." : "Save Expense"}
                {!isSubmitting && <ChevronRight size={18} />}
              </button>
            </form>
          </section>

          {/* Template Info Card */}
          <section className="bg-secondary/10 border border-secondary/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-secondary/20 rounded-lg">
                <AlertCircle size={20} className="text-secondary" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-secondary">Quick Log Tips</h3>
                <p className="text-sm text-secondary/70 leading-relaxed">
                  Set up templates for your frequent schools to auto-fill the amount and description. You can always adjust the amount for variable costs.
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
                <Edit2 size={20} className="text-primary" />
                <h2>School Expense Templates</h2>
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                  type="text"
                  placeholder="Search schools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-muted border-none rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary w-full sm:w-64"
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
                .slice(0, searchQuery ? 20 : 10) // Show top 10 or 20 if searching
                .map(school => {
                  const template = templates.find(t => t.schoolId === school.id);
                  const isEditing = editingTemplate === school.id;

                return (
                  <motion.div 
                    layout
                    key={school.id}
                    className={cn(
                      "group relative bg-white border rounded-2xl p-5 transition-all",
                      isEditing ? "ring-2 ring-primary border-transparent" : "hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-1">
                        <h4 className="font-bold">{school.name}</h4>
                        <p className="text-xs text-muted-foreground">{school.location}, {school.state}</p>
                      </div>
                      {!template && !isEditing && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-500 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                          <AlertCircle size={10} /> No Template
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-4 pt-2">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-white/50">Template Legs</label>
                            <button 
                              type="button" 
                              onClick={() => handleAddLeg('template')}
                              className="text-[10px] text-primary font-bold hover:underline uppercase"
                            >
                              + Add mode
                            </button>
                          </div>
                          {templateLegs.map((leg, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <select 
                                value={leg.mode}
                                onChange={(e) => handleLegChange(idx, { mode: e.target.value as TransportMode }, 'template')}
                                className="flex-1 bg-muted border-none rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary shadow-inner"
                              >
                                {TRANSPORT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                              <input 
                                type="number"
                                value={leg.amount || ''}
                                onChange={(e) => handleLegChange(idx, { amount: parseFloat(e.target.value) || 0 }, 'template')}
                                placeholder="₹"
                                className="w-20 bg-muted border-none rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary shadow-inner text-right"
                              />
                              {templateLegs.length > 1 && (
                                <button type="button" onClick={() => handleRemoveLeg(idx, 'template')} className="text-red-500/50 hover:text-red-500 p-1">
                                  <MinusCircle size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex items-center justify-between p-2 bg-black/5 rounded-lg border border-dashed border-black/10">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">Total Template</span>
                          <span className="text-sm font-black text-primary">₹{calculateTotal(templateLegs)}</span>
                        </div>

                        <textarea 
                          value={templateDesc}
                          onChange={(e) => setTemplateDesc(e.target.value)}
                          placeholder="Short description..."
                          rows={2}
                          className="w-full bg-muted border-none rounded-xl px-3 py-3 text-sm outline-none focus:ring-1 focus:ring-primary resize-none shadow-inner"
                        />
                        <div className="flex items-center gap-2 pt-1">
                          <button 
                            onClick={() => handleSaveTemplate(school.id)}
                            className="flex-1 bg-black text-white text-xs py-3 rounded-xl font-bold flex items-center justify-center gap-1 hover:bg-black/80 transition-all"
                          >
                            <Save size={14} /> Save Template
                          </button>
                          <button 
                            onClick={() => setEditingTemplate(null)}
                            className="px-4 bg-muted text-foreground text-xs py-3 rounded-xl font-bold"
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
                             className="w-full py-6 border-2 border-dashed border-muted-foreground/20 rounded-xl text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2"
                          >
                             <Plus size={24} />
                             <span className="text-xs font-bold uppercase tracking-wider">Setup Expense Template</span>
                          </button>
                        ) : (
                          <>
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex flex-col gap-2 w-full">
                                <div className="flex items-center justify-between w-full">
                                  <span className="text-[10px] text-muted-foreground uppercase font-black">Total Amount</span>
                                  <span className="font-bold text-lg text-primary">₹{template.totalAmount}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {(template.legs || []).map((leg, i) => (
                                    <span key={i} className="text-[10px] px-2 py-0.5 bg-muted rounded border border-border">
                                      {leg.mode}: ₹{leg.amount}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-4">
                              <button 
                                onClick={() => handleQuickLog(school.id)}
                                className="flex-1 bg-secondary text-secondary-foreground text-xs py-3 rounded-xl font-bold flex items-center justify-center gap-1 hover:opacity-90 transition-all shadow-lg shadow-secondary/10"
                              >
                                 Quick Log Visit
                              </button>
                              <button 
                                onClick={() => {
                                  setEditingTemplate(school.id);
                                  setTemplateLegs(template.legs?.length > 0 ? template.legs.map(l => ({ ...l })) : [{ mode: 'Auto', amount: template.totalAmount }]);
                                  setTemplateDesc(template.description || '');
                                }}
                                className="bg-muted text-muted-foreground p-3 rounded-xl hover:text-primary transition-colors"
                              >
                                <Edit2 size={16} />
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
                <History size={20} className="text-primary" />
                <h2>Expense History</h2>
              </div>
            </div>

            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted/30 text-xs font-black uppercase text-muted-foreground border-b italic">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">School</th>
                      {profile?.role === 'admin' && <th className="px-6 py-4">Trainer</th>}
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {expenseLogs.map((log) => (
                      <tr key={log.id} className="group hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium">{log.date}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                             <span className="text-sm font-bold">{log.schoolName}</span>
                             <div className="flex flex-wrap gap-1 mt-1">
                                {(log.legs || []).map((leg, i) => (
                                  <span key={i} className="text-[8px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground border border-border">
                                    {leg.mode}: ₹{leg.amount}
                                  </span>
                                ))}
                             </div>
                             <span className="text-xs text-muted-foreground truncate max-w-[200px] mt-1">{log.description}</span>
                          </div>
                        </td>
                        {profile?.role === 'admin' && (
                          <td className="px-6 py-4 text-sm font-medium">{log.teacherName}</td>
                        )}
                        <td className="px-6 py-4 text-sm font-black text-primary italic">₹{log.totalAmount}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center w-fit gap-1",
                            log.status === 'approved' ? "bg-green-100 text-green-700" :
                            log.status === 'rejected' ? "bg-secondary/10 text-secondary" :
                            "bg-amber-100 text-amber-700"
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
                                   setEditLogLegs(log.legs?.length > 0 ? log.legs.map(l => ({ ...l })) : [{ mode: 'Auto', amount: log.totalAmount }]);
                                   setEditLogDesc(log.description);
                                 }}
                                 className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                 title="Edit"
                               >
                                 <Edit2 size={16} />
                               </button>
                             )}
                             {profile?.role === 'admin' && log.status === 'pending' && (
                               <>
                                 <button 
                                   onClick={() => handleStatusChange(log.id, 'approved')}
                                   className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                                   title="Approve"
                                 >
                                   <CheckCircle size={16} />
                                 </button>
                                 <button 
                                   onClick={() => handleStatusChange(log.id, 'rejected')}
                                   className="p-1.5 text-secondary hover:bg-secondary/10 rounded-lg"
                                   title="Reject"
                                 >
                                   <X size={16} />
                                 </button>
                               </>
                             )}
                             <button 
                               onClick={() => handleDeleteLog(log.id)}
                               className="p-1.5 text-muted-foreground hover:text-secondary hover:bg-secondary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                               title="Delete"
                             >
                               <Trash2 size={16} />
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {expenseLogs.length === 0 && (
                      <tr>
                        <td colSpan={profile?.role === 'admin' ? 6 : 5} className="px-6 py-12 text-center text-muted-foreground italic">
                           No expense records found.
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="text-xl font-bold">Edit Expense Record</h3>
                <button onClick={() => setEditingLog(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase text-muted-foreground italic">Update Legs (₹)</label>
                    <button 
                      type="button" 
                      onClick={() => handleAddLeg('edit')}
                      className="text-[10px] text-primary font-bold hover:underline uppercase"
                    >
                      + Add mode
                    </button>
                  </div>
                  {editLogLegs.map((leg, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select 
                        value={leg.mode}
                        onChange={(e) => handleLegChange(idx, { mode: e.target.value as TransportMode }, 'edit')}
                        className="flex-1 bg-muted border-none rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary shadow-inner"
                      >
                        {TRANSPORT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input 
                        type="number"
                        value={leg.amount || ''}
                        onChange={(e) => handleLegChange(idx, { amount: parseFloat(e.target.value) || 0 }, 'edit')}
                        placeholder="₹"
                        className="w-20 bg-muted border-none rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary shadow-inner text-right"
                      />
                      {editLogLegs.length > 1 && (
                        <button type="button" onClick={() => handleRemoveLeg(idx, 'edit')} className="text-red-500/50 hover:text-red-500 p-1">
                          <MinusCircle size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-2 bg-black/5 rounded-lg border border-dashed border-black/10">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Total New Amount</span>
                    <span className="text-sm font-black text-primary">₹{calculateTotal(editLogLegs)}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-muted-foreground italic">Update Remarks</label>
                  <textarea 
                    value={editLogDesc}
                    onChange={(e) => setEditLogDesc(e.target.value)}
                    rows={3}
                    className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              <div className="p-6 bg-muted/30 flex gap-3">
                <button 
                  onClick={handleUpdateLog}
                  className="flex-1 bg-black text-white font-bold py-3 rounded-xl hover:bg-black/80 transition-all"
                >
                  Save Changes
                </button>
                <button 
                  onClick={() => setEditingLog(null)}
                  className="flex-1 bg-white border border-border text-foreground font-bold py-3 rounded-xl hover:bg-muted transition-all"
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

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, addDoc, updateDoc, increment, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { SimulationLab, SimulationSubmission, UserProfile, School } from '../types';
import { Cpu, Trophy, Play, CheckCircle, XCircle, Save, Plus, ExternalLink, FileText, Terminal, ArrowRight, Clock, Sparkles, Copy, Check, Loader2, Info, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { logAudit } from '../lib/audit';

export default function SimulationLabPage() {
  const { profile, realRole, activeRole } = useAuth();
  const role = activeRole || profile?.role;
  
  // State variables
  const [labs, setLabs] = useState<SimulationLab[]>([]);
  const [submissions, setSubmissions] = useState<SimulationSubmission[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'labs' | 'sandbox' | 'ci_docs' | 'grading'>('labs');
  
  // CI Token configuration
  const [cliTokenRef, setCliTokenRef] = useState<string>('');
  const [savingToken, setSavingToken] = useState(false);

  // Forms mapping
  const [activeWorkspace, setActiveWorkspace] = useState<{
    type: 'playground' | 'challenge';
    microcontroller: 'arduino-uno' | 'esp32' | 'pi-pico';
    starterId?: string;
    labId?: string;
  } | null>(null);

  useEffect(() => {
    if (activeWorkspace) {
      const workspaceType = activeWorkspace.type === 'playground' ? 'Simulation Sandbox Playground' : 'Simulation Challenge Lab';
      const targetName = activeWorkspace.labId
        ? (labs.find(l => l.id === activeWorkspace.labId)?.title || activeWorkspace.labId)
        : activeWorkspace.microcontroller;
      logAudit(profile, 'Open Simulation Workspace', `Opened ${workspaceType}: "${targetName}" (${activeWorkspace.microcontroller})`, {
        labId: activeWorkspace.labId,
        type: activeWorkspace.type,
        microcontroller: activeWorkspace.microcontroller
      });
    }
  }, [activeWorkspace, labs, profile]);

  // Lab assignment form
  const [newLabTitle, setNewLabTitle] = useState('');
  const [newLabDesc, setNewLabDesc] = useState('');
  const [newLabController, setNewLabController] = useState<'arduino-uno' | 'esp32' | 'pi-pico'>('arduino-uno');
  const [newLabWokwiId, setNewLabWokwiId] = useState('');
  const [newLabPoints, setNewLabPoints] = useState<number>(100);
  const [newLabCriteria, setNewLabCriteria] = useState('');
  const [submittingLab, setSubmittingLab] = useState(false);

  // Student submission form
  const [submittedWokwiUrl, setSubmittedWokwiUrl] = useState('');
  const [studentNotes, setStudentNotes] = useState('');
  const [submittingProject, setSubmittingProject] = useState(false);
  const [selectedLabForSubmission, setSelectedLabForSubmission] = useState<SimulationLab | null>(null);

  // Grading feedback mapping
  const [gradingFeedback, setGradingFeedback] = useState<Record<string, string>>({});
  const [gradingPoints, setGradingPoints] = useState<Record<string, number>>({});
  const [gradersAction, setGradersAction] = useState<Record<string, boolean>>({});

  // Code copying visual effect toggles
  const [copiedText, setCopiedText] = useState<'toml' | 'ci_cmd' | 'token_cmd' | null>(null);

  // Pre-configured Wokwi starting templates
  const WORKSPACE_TEMPLATES = {
    'arduino-uno': 'new/arduino-uno',
    'esp32': 'new/esp32',
    'pi-pico': 'new/pi-pico-w'
  };

  useEffect(() => {
    if (!profile) return;

    // Fetch Wokwi CLI token from firestore settings doc
    const unsubToken = onSnapshot(doc(db, 'settings', 'wokwi_integration'), (snapshot) => {
      if (snapshot.exists()) {
        setCliTokenRef(snapshot.data().token || 'wok_GN59V4y244tyhkOQYSFo8EFjzufqi1Rj93546435');
      } else {
        // Fallback default
        setCliTokenRef('wok_GN59V4y244tyhkOQYSFo8EFjzufqi1Rj93546435');
      }
    });

    // Unsub loaded state listeners
    let unsubLabs = () => {};
    let unsubSubs = () => {};
    let unsubStudents = () => {};
    let unsubSchools = () => {};

    // 1. Fetch simulation labs
    unsubLabs = onSnapshot(collection(db, 'simulationLabs'), (snapshot) => {
      setLabs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimulationLab)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'simulationLabs'));

    // 2. Fetch schools mapping
    unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'schools'));

    // 3. Fetch Student submissions & roster depending on user privileges
    if (role === 'student') {
      // Students see only their submissions
      unsubSubs = onSnapshot(
        query(collection(db, 'simulationSubmissions'), where('studentId', '==', profile.uid)),
        (snapshot) => {
          setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimulationSubmission)));
          setLoading(false);
        },
        err => handleFirestoreError(err, OperationType.LIST, 'simulationSubmissions')
      );
    } else {
      // Teachers and Admin see all simulations across associated schools
      unsubSubs = onSnapshot(collection(db, 'simulationSubmissions'), (snapshot) => {
        setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimulationSubmission)));
      }, err => handleFirestoreError(err, OperationType.LIST, 'simulationSubmissions'));

      unsubStudents = onSnapshot(collection(db, 'users'), (snapshot) => {
        setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
        setLoading(false);
      }, err => handleFirestoreError(err, OperationType.LIST, 'users'));
    }

    return () => {
      unsubToken();
      unsubLabs();
      unsubSubs();
      unsubStudents();
      unsubSchools();
    };
  }, [profile, role]);

  const handleSaveCliToken = async () => {
    setSavingToken(true);
    try {
      await setDoc(doc(db, 'settings', 'wokwi_integration'), {
        token: cliTokenRef,
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.name || 'User'
      });
      toast.success("Successfully optimized Wokwi CI token settings persistently in Firebase!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update token configurations.");
    } finally {
      setSavingToken(false);
    }
  };

  const handleCreateLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabTitle || !newLabDesc) {
      toast.error("Please fill in lab title and detailed instructions!");
      return;
    }
    setSubmittingLab(true);
    try {
      const targetId = newLabWokwiId.replace(/[^0-9]/g, ''); // Extract numerical workspace ID if they entered full url
      
      const newLabPayload: Omit<SimulationLab, 'id'> = {
        title: newLabTitle,
        description: newLabDesc,
        microcontroller: newLabController,
        points: newLabPoints,
        createdAt: new Date().toISOString(),
        creatorId: profile?.uid || 'Unknown'
      };

      if (targetId) {
        newLabPayload.starterWokwiId = targetId;
      }
      if (newLabCriteria.trim()) {
        newLabPayload.testCriteria = newLabCriteria.trim();
      }

      const docRef = await addDoc(collection(db, 'simulationLabs'), newLabPayload);
      toast.success("Simulation Challenge Lab commissioned and released successfully!");
      logAudit(profile, 'Create Simulation Lab', `Created simulation challenge lab: "${newLabPayload.title}"`, { labId: docRef.id, title: newLabPayload.title });
      
      // Reset form fields
      setNewLabTitle('');
      setNewLabDesc('');
      setNewLabWokwiId('');
      setNewLabCriteria('');
      setNewLabPoints(100);
    } catch (err) {
      console.error(err);
      toast.error("An error occurred creating simulation challenge.");
    } finally {
      setSubmittingLab(false);
    }
  };

  const handlePostStudentSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLabForSubmission) return;
    if (!submittedWokwiUrl) {
      toast.error("Provide your published Wokwi project link or workspace numeric ID!");
      return;
    }

    setSubmittingProject(true);
    try {
      // Retrieve current associated school mappings
      const studentSchoolId = profile?.schoolIds?.[0] || 'unknown-school';
      const studentSchoolName = schools.find(s => s.id === studentSchoolId)?.name || 'Direct Online Learner';

      // Parse ID from workspace URL if necessary
      let parsedWokwiUrlOrId = submittedWokwiUrl.trim();
      const match = parsedWokwiUrlOrId.match(/wokwi\.com\/projects\/(\d+)/);
      if (match && match[1]) {
        parsedWokwiUrlOrId = match[1];
      }

      const submissionPayload: Omit<SimulationSubmission, 'id'> = {
        labId: selectedLabForSubmission.id,
        labTitle: selectedLabForSubmission.title,
        studentId: profile?.uid || '',
        studentName: profile?.name || 'Student Learner',
        studentEmail: profile?.email || '',
        schoolId: studentSchoolId,
        schoolName: studentSchoolName,
        classSection: profile?.classSection || 'A',
        wokwiUrl: parsedWokwiUrlOrId,
        description: studentNotes,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      const docRef = await addDoc(collection(db, 'simulationSubmissions'), submissionPayload);
      toast.success("Simulation work uploaded to school trainer terminal! Awaiting review.");
      logAudit(profile, 'Submit Simulation Challenge', `Submitted virtual microcontroller project for: "${submissionPayload.labTitle}"`, { submissionId: docRef.id, labId: submissionPayload.labId, labTitle: submissionPayload.labTitle });
      
      setSubmittedWokwiUrl('');
      setStudentNotes('');
      setSelectedLabForSubmission(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload project submission.");
    } finally {
      setSubmittingProject(false);
    }
  };

  const handleGradeSubmission = async (sub: SimulationSubmission, approve: boolean) => {
    const key = sub.id;
    setGradersAction(prev => ({ ...prev, [key]: true }));
    try {
      const fb = gradingFeedback[key] || (approve 
        ? "Impeccable electronic circuit logic, all virtual diagnostics are green!" 
        : "Re-examine your pin routing connections and serial telemetry. Refined, and resubmit.");
      const points = gradingPoints[key] || sub.pointsAwarded || 100;

      await updateDoc(doc(db, 'simulationSubmissions', sub.id), {
        status: approve ? 'approved' : 'rejected',
        teacherFeedback: fb,
        teacherId: profile?.uid,
        teacherName: profile?.name,
        pointsAwarded: approve ? points : 0
      });

      if (approve) {
        // Increment Student points standings in database
        await updateDoc(doc(db, 'users', sub.studentId), {
          projectPoints: increment(points),
          totalPoints: increment(points)
        });
        toast.success(`Simulation accepted, +${points} PTS credited to student standings!`);
        logAudit(profile, 'Grade Simulation', `Approved simulator project submission by ${sub.studentName} for lab: "${sub.labTitle}" with ${points} PTS`, { submissionId: sub.id, studentId: sub.studentId, score: points });
      } else {
        toast.error("Submission rejected. Re-uploaded revision logs sent to student portal.");
        logAudit(profile, 'Grade Simulation', `Rejected simulator project submission by ${sub.studentName} for lab: "${sub.labTitle}"`, { submissionId: sub.id, studentId: sub.studentId });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to commit evaluations to Cloud Firestore.");
    } finally {
      setGradersAction(prev => ({ ...prev, [key]: false }));
    }
  };

  const copyToClipboard = (text: string, type: 'toml' | 'ci_cmd' | 'token_cmd') => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
    toast.success("Copied block directly to clipboard!");
  };

  // Automated wokwi.toml dynamically generated based on labs
  const generatedTomlScript = `[wokwi]
version = "1"
# Target micro-processor build configuration
elf = "build/firmware.elf"
firmware = "build/firmware.bin"
sketch = "sketch.ino"
diagram = "diagram.json"

[testing]
# Run headless virtual CI checks
tests = "tests/*.ino"
`;

  const generatedCiScript = `name: Continuous Hardware Simulation
on: [push, pull_request]

jobs:
  run-simulation:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source code
        uses: actions/checkout@v3

      - name: Execute Wokwi-CI Logic
        run: |
          npm install -g wokwi-ci
          wokwi-ci --timeout 15000 --token $WOKWI_CLI_TOKEN
        env:
          WOKWI_CLI_TOKEN: \${{ secrets.WOKWI_CLI_TOKEN || '${cliTokenRef}' }}
`;

  return (
    <div className="space-y-8 pb-16">
      {/* Header Panel */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <Cpu className="text-[#F27D26]" size={36} /> Wokwi Simulation Lab
          </h2>
          <p className="text-white/50 text-xs font-mono uppercase tracking-widest mt-1.5">
            Cloud-based robotics, IoT & circuit design workstation & virtual CI check portal
          </p>
        </div>

        {/* Global CI Token quick configuration in top right bar */}
        {(role === 'teacher' || realRole === 'admin') && (
          <div className="bg-[#151619] border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3 max-w-md shrink-0">
            <div>
              <span className="text-[10px] font-black uppercase text-[#F27D26] block tracking-wide">CI Automation Key</span>
              <input
                type="text"
                placeholder="wok_..."
                value={cliTokenRef}
                onChange={(e) => setCliTokenRef(e.target.value)}
                className="bg-black/50 border border-white/5 rounded-lg px-2.5 py-1 text-xs text-white/80 mt-1 placeholder-white/10 w-44 focus:outline-none focus:border-[#F27D26]"
              />
            </div>
            <button
              onClick={handleSaveCliToken}
              disabled={savingToken}
              className="px-3 py-1.5 bg-[#F27D26] text-white hover:bg-[#d66a1e] transition-all rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer self-end sm:self-center"
            >
              {savingToken ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Sync Key
            </button>
          </div>
        )}
      </header>

      {/* Tabs Menu Selection */}
      <div className="flex border-b border-white/5 pb-0.5 gap-2 overflow-x-auto">
        <button
          onClick={() => { setActiveTab('labs'); setActiveWorkspace(null); }}
          className={`px-5 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 shrink-0 ${
            activeTab === 'labs' && !activeWorkspace
              ? 'border-[#F27D26] text-white'
              : 'border-transparent text-white/40 hover:text-white/60'
          }`}
        >
          🏆 Simulation Labs
        </button>
        <button
          onClick={() => { setActiveTab('sandbox'); setActiveWorkspace(null); }}
          className={`px-5 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 shrink-0 ${
            activeTab === 'sandbox' && !activeWorkspace
              ? 'border-[#F27D26] text-white'
              : 'border-transparent text-white/40 hover:text-white/60'
          }`}
        >
          🛸 Simulator Sandbox
        </button>
        <button
          onClick={() => { setActiveTab('ci_docs'); setActiveWorkspace(null); }}
          className={`px-5 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 shrink-0 ${
            activeTab === 'ci_docs' && !activeWorkspace
              ? 'border-[#F27D26] text-white'
              : 'border-transparent text-white/40 hover:text-white/60'
          }`}
        >
          💻 CLI & CI Automation
        </button>
        {(role === 'teacher' || realRole === 'admin') && (
          <button
            onClick={() => { setActiveTab('grading'); setActiveWorkspace(null); }}
            className={`px-5 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 shrink-0 relative ${
              activeTab === 'grading' && !activeWorkspace
                ? 'border-[#F27D26] text-white'
                : 'border-transparent text-white/40 hover:text-white/60'
            }`}
          >
            📋 Submissions Evaluations
            {submissions.filter(s => s.status === 'pending').length > 0 && (
              <span className="absolute top-2 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            )}
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <Loader2 className="animate-spin text-[#F27D26] mx-auto mb-4" size={32} />
          <p className="text-sm font-mono text-white/50">Waking hardware emulation cores...</p>
        </div>
      ) : (
        <div>
          {/* Active Workspace layout: when launching a simulation project or workbench */}
          {activeWorkspace ? (
            <div className="space-y-6">
              {/* Back Bar */}
              <div className="flex justify-between items-center bg-[#151619] border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-black rounded-lg">
                    <Cpu className="text-[#F27D26]" size={18} />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono font-black uppercase tracking-widest text-[#F27D26] block">
                      {activeWorkspace.type === 'playground' ? 'SANDBOX PLAYGROUND' : 'CHALLENGE TASK'}
                    </span>
                    <h3 className="font-bold text-sm text-white">
                      {activeWorkspace.type === 'playground' 
                        ? `Live ${activeWorkspace.microcontroller.toUpperCase()} Virtual PCB`
                        : labs.find(l => l.id === activeWorkspace.labId)?.title || 'Assigned Lab Work'}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setActiveWorkspace(null)}
                  className="px-4 py-2 border border-white/10 rounded-xl text-xs hover:bg-white/5 transition-all text-white/60 cursor-pointer"
                >
                  ← Terminate Session
                </button>
              </div>

              {/* Lab-split Viewport */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left hand instructions and submit forms */}
                <div className="lg:col-span-4 space-y-6">
                  {activeWorkspace.type === 'challenge' && (
                    <div className="bg-[#151619] border border-white/5 rounded-2xl p-6 space-y-4">
                      <h4 className="font-bold text-base border-b border-white/5 pb-2">Lab Syllabus Instructions</h4>
                      <p className="text-xs text-white/80 leading-relaxed font-sans block whitespace-pre-line">
                        {labs.find(l => l.id === activeWorkspace.labId)?.description}
                      </p>
                      
                      {labs.find(l => l.id === activeWorkspace.labId)?.testCriteria && (
                        <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl space-y-1.5">
                          <span className="text-[9px] font-black uppercase text-amber-500 font-mono tracking-widest block">Simulation Grading Criteria</span>
                          <p className="text-xs text-white/70 italic leading-relaxed">
                            "{labs.find(l => l.id === activeWorkspace.labId)?.testCriteria}"
                          </p>
                        </div>
                      )}

                      <div className="pt-2">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 block">Reward standings credit:</span>
                        <span className="text-sm font-black text-yellow-400">+{labs.find(l => l.id === activeWorkspace.labId)?.points || 100} Leaderboard points</span>
                      </div>
                    </div>
                  )}

                  {activeWorkspace.type === 'playground' && (
                    <div className="bg-[#151619] border border-white/5 rounded-2xl p-6 space-y-4">
                      <h4 className="font-bold text-sm">Playground Guidelines</h4>
                      <p className="text-xs text-white/60 leading-relaxed font-sans">
                        This is an un-assigned Sandbox environment. You can design electronics boards, write programs and play around with pin telemetry interactively. 
                      </p>
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-400 space-y-1">
                        <span className="font-bold block">💡 Workpiece saving:</span>
                        You must log in to Wokwi inside the iframe or click Wokwi's "Save" inside and copy the final canvas URL to submit it later.
                      </div>
                    </div>
                  )}

                  {/* Submission form (Only for students on assigned labs) */}
                  {role === 'student' && activeWorkspace.type === 'challenge' && (
                    <div className="bg-[#151619] border border-white/15 rounded-2xl p-6 space-y-4 shadow-xl">
                      <h4 className="font-bold text-sm flex items-center gap-1.5">
                        <Send size={15} className="text-[#F27D26]" /> Submit Completed Lab Work
                      </h4>
                      <form onSubmit={handlePostStudentSubmission} className="space-y-4">
                        <div className="space-y-1 bg-black/40 border border-white/5 rounded-xl p-4">
                          <label className="text-[10px] uppercase font-bold text-white/50 block">Pasted Wokwi Share URL / ID</label>
                          <input
                            type="text"
                            placeholder="e.g. 401053158925574145 or https://wokwi.com/projects/..."
                            value={submittedWokwiUrl}
                            onChange={(e) => setSubmittedWokwiUrl(e.target.value)}
                            className="bg-zinc-900 border border-white/5 text-xs text-white px-3 py-2 w-full mt-2 rounded-lg focus:outline-none focus:border-[#F27D26] placeholder-white/10"
                            required
                          />
                          <p className="text-[9px] text-white/30 mt-1">Submit your customized project ID. Your Teacher will render your live schematic directly inside their LMS grading suite!</p>
                        </div>

                        <div className="space-y-1 font-sans">
                          <label className="text-[10px] uppercase font-bold text-white/50 block">Submission Notes</label>
                          <textarea
                            placeholder="Detail your component setups, LED pins, or explain issues encountered..."
                            value={studentNotes}
                            onChange={(e) => setStudentNotes(e.target.value)}
                            rows={3}
                            className="bg-zinc-900 border border-white/5 text-xs text-white px-3 py-2 w-full mt-2 rounded-lg focus:outline-none focus:border-[#F27D26] placeholder-white/10"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submittingProject}
                          onClick={() => {
                            const lab = labs.find(l => l.id === activeWorkspace.labId);
                            if (lab) setSelectedLabForSubmission(lab);
                          }}
                          className="w-full bg-[#F27D26] hover:bg-[#d66a1e] text-white py-3 font-semibold transition-all rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
                        >
                          {submittingProject ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                          Submit Project Workspace
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {/* Right hand embedded Wokwi viewer */}
                <div className="lg:col-span-8 bg-black border border-white/10 rounded-3xl overflow-hidden min-h-[500px] flex flex-col justify-between">
                  <div className="bg-[#151619] border-b border-white/5 p-3 flex justify-between items-center">
                    <span className="text-[10px] font-mono text-white/40 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Live hardware simulator viewport
                    </span>
                    <a
                      href={
                        activeWorkspace.starterId 
                          ? `https://wokwi.com/projects/${activeWorkspace.starterId}` 
                          : `https://wokwi.com/${WORKSPACE_TEMPLATES[activeWorkspace.microcontroller]}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#F27D26] font-bold uppercase hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={10} /> Open Wokwi in tab
                    </a>
                  </div>

                  <div className="relative w-full h-[650px] bg-zinc-950 flex-1">
                    <iframe
                      src={
                        activeWorkspace.starterId 
                          ? `https://wokwi.com/projects/${activeWorkspace.starterId}?embed=1` 
                          : `https://wokwi.com/${WORKSPACE_TEMPLATES[activeWorkspace.microcontroller]}?embed=1`
                      }
                      title="Wokwi Virtual Hardware Simulator"
                      className="w-full h-full border-none"
                      allow="geolocation; microphone; camera; midi; encrypted-media;"
                    />
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div>
              {/* Tab: Labs Grid */}
              {activeTab === 'labs' && (
                <div className="space-y-8">
                  {/* Creator Form for teachers / admins */}
                  {(role === 'teacher' || realRole === 'admin') && (
                    <section className="bg-[#151619] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
                      <div className="border-b border-white/5 pb-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <Plus size={20} className="text-[#F27D26]" /> Create & Assign Simulation Lab
                        </h3>
                        <p className="text-white/40 text-xs mt-1">Deploy a virtual circuit evaluation lab challenge assigned to your classes</p>
                      </div>

                      <form onSubmit={handleCreateLab} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-bold text-white/60 block mb-2">Challenge Title</label>
                            <input
                              type="text"
                              placeholder="e.g. Ultrasonic Radar Sensor Array"
                              value={newLabTitle}
                              onChange={(e) => setNewLabTitle(e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/10 focus:outline-none focus:border-[#F27D26]"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-white/60 block mb-2 font-sans">Lab Challenge Description & Instructions</label>
                            <textarea
                              placeholder="Explain wire routing assignments, microcontroller requirements, target pin connections e.g., 'Connect LED output to pin D4 and Trig pin of Sensor to pin D7...' "
                              value={newLabDesc}
                              onChange={(e) => setNewLabDesc(e.target.value)}
                              rows={5}
                              className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-xs text-white placeholder-white/10 focus:outline-none focus:border-[#F27D26] font-sans"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-bold text-white/60 block mb-2">Microcontroller Board</label>
                              <select
                                value={newLabController}
                                onChange={(e) => setNewLabController(e.target.value as any)}
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                              >
                                <option value="arduino-uno">Arduino Uno R3</option>
                                <option value="esp32">ESP32 DevKit V1</option>
                                <option value="pi-pico">Raspberry Pi Pico</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-xs font-bold text-white/60 block mb-2">Leaderboard Rating weight</label>
                              <select
                                value={newLabPoints}
                                onChange={(e) => setNewLabPoints(parseInt(e.target.value))}
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F27D26]"
                              >
                                <option value={50}>50 PTS</option>
                                <option value={75}>75 PTS</option>
                                <option value={100}>100 PTS</option>
                                <option value={150}>150 PTS</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-white/60 block mb-2">
                              Wokwi Project Starter ID <span className="text-white/20 font-normal text-[10px]">(Optional)</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. 322579184514859602 or paste full Wokwi project URL"
                              value={newLabWokwiId}
                              onChange={(e) => setNewLabWokwiId(e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/10 focus:outline-none focus:border-[#F27D26]"
                            />
                            <p className="text-[9px] text-[#F27D26]/70 mt-1">Leave blank to open a blank microcontroller workstation schematic</p>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-white/60 block mb-2">Simulation Test Criteria</label>
                            <input
                              type="text"
                              placeholder="e.g. Serial monitor must output 'Alert' when distance is lesser than 20cm"
                              value={newLabCriteria}
                              onChange={(e) => setNewLabCriteria(e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/10 focus:outline-none focus:border-[#F27D26]"
                            />
                          </div>

                          <div className="pt-2">
                            <button
                              type="submit"
                              disabled={submittingLab}
                              className="w-full bg-[#F27D26] hover:bg-[#d66a1e] text-white py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/5 cursor-pointer"
                            >
                              {submittingLab ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                              Release Assigned Lab
                            </button>
                          </div>
                        </div>
                      </form>
                    </section>
                  )}

                  {/* Labs List */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-bold">Assigned Challenges</h3>
                      <p className="text-white/40 text-xs font-mono uppercase tracking-widest mt-1">Complete labs programmatically inside active simulation beds</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {labs.map((lab) => {
                        const studentSub = submissions.find(s => s.labId === lab.id);
                        
                        return (
                          <div 
                            key={lab.id} 
                            className="bg-[#151619] border border-white/5 rounded-2xl p-6 flex flex-col justify-between space-y-6 hover:border-white/10 transition-all group"
                          >
                            <div className="space-y-3">
                              <div className="flex justify-between items-start">
                                <span className="px-2.5 py-1 bg-yellow-500/10 text-yellow-400 font-bold font-mono text-[9px] uppercase tracking-widest rounded-md border border-yellow-500/10 shrink-0">
                                  {lab.microcontroller.toUpperCase()}
                                </span>
                                
                                {studentSub ? (
                                  <span className={`px-2 py-0.5 rounded font-mono text-[8px] font-black uppercase tracking-widest ${
                                    studentSub.status === 'approved' 
                                      ? 'bg-green-500/15 border border-green-500/20 text-green-400'
                                      : studentSub.status === 'rejected'
                                      ? 'bg-red-500/15 border border-red-500/20 text-red-400'
                                      : 'bg-yellow-500/10 border border-yellow-500/15 text-yellow-500'
                                  }`}>
                                    {studentSub.status === 'approved' 
                                      ? 'Approved' 
                                      : studentSub.status === 'rejected'
                                      ? 'Revision Needed' 
                                      : 'Pending Coach'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-white/5 border border-white/5 text-white/30 rounded font-mono text-[8px] font-black uppercase tracking-widest">
                                    Inbox
                                  </span>
                                )}
                              </div>

                              <div>
                                <h4 className="font-extrabold text-white text-lg group-hover:text-[#F27D26] transition-colors">{lab.title}</h4>
                                <p className="text-white/40 text-[10px] mt-0.5">Points Standing: {lab.points} PTS Credit</p>
                              </div>

                              <p className="text-xs text-white/55 font-sans line-clamp-3 leading-relaxed">
                                {lab.description}
                              </p>
                            </div>

                            <div className="pt-2">
                              {studentSub?.status === 'approved' ? (
                                <div className="space-y-2">
                                  <div className="bg-green-500/5 rounded-xl p-3 border border-green-500/10 text-[11px] text-green-400/80 leading-relaxed font-sans font-medium">
                                    Coach: "{studentSub.teacherFeedback || 'Perfect simulation.'}"
                                  </div>
                                  <button
                                    onClick={() => setActiveWorkspace({
                                      type: 'challenge',
                                      microcontroller: lab.microcontroller,
                                      starterId: studentSub.wokwiUrl,
                                      labId: lab.id
                                    })}
                                    className="w-full py-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1 cursor-pointer font-sans"
                                  >
                                    View Approved Circuit
                                  </button>
                                </div>
                              ) : studentSub?.status === 'rejected' ? (
                                <div className="space-y-2">
                                  <div className="bg-red-500/5 rounded-xl p-3 border border-red-500/10 text-[11px] text-red-500/80 leading-relaxed font-sans font-medium">
                                    Coach Feedback: "{studentSub.teacherFeedback || 'Please refine wiring/routes.'}"
                                  </div>
                                  <button
                                    onClick={() => setActiveWorkspace({
                                      type: 'challenge',
                                      microcontroller: lab.microcontroller,
                                      starterId: studentSub.wokwiUrl || lab.starterWokwiId,
                                      labId: lab.id
                                    })}
                                    className="w-full py-3 bg-red-500/20 hover:bg-red-500/35 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                                  >
                                    <Play size={12} fill="currentColor" />
                                    Re-Route Simulator
                                  </button>
                                </div>
                              ) : studentSub?.status === 'pending' ? (
                                <div className="space-y-2">
                                  <div className="bg-yellow-500/5 rounded-xl p-3 border border-yellow-500/10 text-[11px] text-yellow-400/80 leading-relaxed font-sans font-medium">
                                    Awaiting trainer evaluation...
                                  </div>
                                  <button
                                    onClick={() => setActiveWorkspace({
                                      type: 'challenge',
                                      microcontroller: lab.microcontroller,
                                      starterId: studentSub.wokwiUrl,
                                      labId: lab.id
                                    })}
                                    className="w-full py-2.5 bg-yellow-500/20 hover:bg-yellow-500/35 text-yellow-400 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1 cursor-pointer font-sans"
                                  >
                                    View Submitted Circuit
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setActiveWorkspace({
                                    type: 'challenge',
                                    microcontroller: lab.microcontroller,
                                    starterId: studentSub?.wokwiUrl || lab.starterWokwiId,
                                    labId: lab.id
                                  })}
                                  className="w-full py-3 bg-[#F27D26] text-white hover:bg-[#d66a1e] rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/5 cursor-pointer font-sans"
                                >
                                  <Play size={12} fill="currentColor" /> 
                                  {studentSub ? 'Re-Route Simulator' : 'Commence Challenge'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {labs.length === 0 && (
                        <div className="col-span-full py-16 text-center bg-[#151619] border border-dashed border-white/5 rounded-2xl">
                          <Info className="mx-auto text-[#F27D26]/40 mb-3" size={32} />
                          <p className="text-xs text-white/40 italic">No assigned simulation challenges listed at this time.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Sandbox Workspace Launchers */}
              {activeTab === 'sandbox' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-2xl font-black">Emulation Sandboxes</h3>
                    <p className="text-white/40 text-xs font-mono uppercase tracking-widest mt-1">Launch unguided blank schematic boards for prototyping of circuits</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Arduino Uno Sandbox */}
                    <div className="bg-[#151619] border border-white/5 rounded-2xl p-6 space-y-6 flex flex-col justify-between hover:border-blue-500/10 transition-all">
                      <div className="space-y-3">
                        <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 font-bold font-mono text-[9px] uppercase tracking-widest rounded-md border border-blue-500/10">Arduino Uno R3</span>
                        <h4 className="text-xl font-bold text-white mt-2">Arduino Uno Sandbox</h4>
                        <p className="text-xs text-white/50 leading-relaxed font-sans">
                          A 16MHz ATMega328P based virtual testbed. Perfect for learning GPIO pin driving, ultrasonic range telemetry, servo motors, LCD screens and keypads.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveWorkspace({
                          type: 'playground',
                          microcontroller: 'arduino-uno'
                        })}
                        className="py-3 bg-blue-500/20 hover:bg-blue-500 hover:text-white transition-all text-blue-400 text-xs font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                      >
                        Launch Workbench
                      </button>
                    </div>

                    {/* ESP32 Sandbox */}
                    <div className="bg-[#151619] border border-white/5 rounded-2xl p-6 space-y-6 flex flex-col justify-between hover:border-emerald-500/10 transition-all">
                      <div className="space-y-3">
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 font-bold font-mono text-[9px] uppercase tracking-widest rounded-md border border-emerald-500/10">ESP32 IoT Dual-Core</span>
                        <h4 className="text-xl font-bold text-white mt-2">ESP32 IoT Sandbox</h4>
                        <p className="text-xs text-white/50 leading-relaxed font-sans">
                          Build real-time connected IoT structures. Features full WiFi simulation support, HTTP sockets, secure client links, MQTT, and Bluetooth logic telemetry.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveWorkspace({
                          type: 'playground',
                          microcontroller: 'esp32'
                        })}
                        className="py-3 bg-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all text-emerald-400 text-xs font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                      >
                        Launch Workbench
                      </button>
                    </div>

                    {/* Pi Pico Sandbox */}
                    <div className="bg-[#151619] border border-white/5 rounded-2xl p-6 space-y-6 flex flex-col justify-between hover:border-purple-500/10 transition-all">
                      <div className="space-y-3">
                        <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 font-bold font-mono text-[9px] uppercase tracking-widest rounded-md border border-purple-500/10">RP2040 ARM Cortex</span>
                        <h4 className="text-xl font-bold text-white mt-2">Raspberry Pi Pico Sandbox</h4>
                        <p className="text-xs text-white/50 leading-relaxed font-sans">
                          Dual core high-frequency computing with 264KB internal SRAM. Fully customizable with MicroPython, C/C++ SDK, or Arduino-pico core bindings.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveWorkspace({
                          type: 'playground',
                          microcontroller: 'pi-pico'
                        })}
                        className="py-3 bg-purple-500/20 hover:bg-purple-500 hover:text-white transition-all text-purple-400 text-xs font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                      >
                        Launch Workbench
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: CI Documentation & Automation */}
              {activeTab === 'ci_docs' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-2xl font-black flex items-center gap-2">
                      <Terminal size={24} className="text-[#F27D26]" /> Robotics Automation Port
                    </h3>
                    <p className="text-white/40 text-xs font-mono uppercase tracking-widest mt-1">Leverage Wokwi-CI CLI commands to integrate headless compiling into pull requests</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Instructions and Token showcase */}
                    <div className="bg-[#151619] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
                      <h4 className="text-lg font-bold border-b border-white/5 pb-3">Automating Evaluations</h4>
                      
                      <div className="space-y-4 text-xs text-white/80 leading-relaxed font-sans">
                        <p>
                          Your Wokwi CLI integration configuration enables coaches and school administrators to evaluate robotics source files 
                          autonomously during developer lifecycles.
                        </p>

                        <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
                          <span className="text-[10px] uppercase text-[#F27D26] font-mono tracking-widest block font-black">Installation Requirements</span>
                          <p className="text-white/60">Ensure CLI is deployed globally on your target workstation:</p>
                          <div className="bg-black border border-white/5 p-2.5 rounded-lg text-[10px] font-mono text-emerald-400 flex justify-between items-center">
                            <span>npm install -g wokwi-ci</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs text-white/60">Export the token within your Linux / Windows / Mac variables:</p>
                          <div className="bg-black border border-white/5 p-3 rounded-xl font-mono text-[10px] text-white/70 space-y-2 relative">
                            <span className="block text-amber-500"># Setting your authentication credential</span>
                            <span className="block text-emerald-400">export WOKWI_CLI_TOKEN={cliTokenRef}</span>
                            <button
                              onClick={() => copyToClipboard(`export WOKWI_CLI_TOKEN=${cliTokenRef}`, 'token_cmd')}
                              className="absolute top-2 right-2 p-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-all text-white/40"
                              title="Copy Command"
                            >
                              {copiedText === 'token_cmd' ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs text-white/60">Trigger headless checkout validation against configuration file:</p>
                          <div className="bg-black border border-white/5 p-3 rounded-xl font-mono text-[10px] text-white/70 space-y-2 relative">
                            <span className="block text-[#F27D26]">wokwi-ci --timeout 15000</span>
                            <button
                              onClick={() => copyToClipboard('wokwi-ci --timeout 15000', 'ci_cmd')}
                              className="absolute top-2 right-2 p-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-all text-white/40"
                              title="Copy Command"
                            >
                              {copiedText === 'ci_cmd' ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Dynamically Generated Configuration Script */}
                    <div className="space-y-6">
                      <div className="bg-[#151619] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-4">
                        <div className="flex justify-between items-center border-b border-white/5 pb-3">
                          <div>
                            <h4 className="text-base font-bold">Wokwi Manifest file</h4>
                            <p className="text-white/40 text-[10px] mt-0.5">Place wokwi.toml in your workspace root</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(generatedTomlScript, 'toml')}
                            className="bg-white/5 hover:bg-white/10 text-white/80 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            {copiedText === 'toml' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                            Copy Manifest
                          </button>
                        </div>
                        <pre className="bg-[#0b0c0d] p-4 rounded-xl border border-white/5 text-[10px] font-mono leading-relaxed text-teal-400 overflow-x-auto select-all max-h-64">
                          {generatedTomlScript}
                        </pre>
                      </div>

                      <div className="bg-[#151619] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-4">
                        <div className="border-b border-white/5 pb-3 flex justify-between items-center">
                          <div>
                            <h4 className="text-base font-bold">GitHub Actions Workflow</h4>
                            <p className="text-white/40 text-[10px] mt-0.5">Save under .github/workflows/wokwi.yml</p>
                          </div>
                        </div>
                        <pre className="bg-[#0b0c0d] p-4 rounded-xl border border-white/5 text-[10px] font-mono leading-relaxed text-yellow-500 overflow-x-auto select-all max-h-64">
                          {generatedCiScript}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Grading submissions (Teachers & Admin only) */}
              {activeTab === 'grading' && (role === 'teacher' || realRole === 'admin') && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-2xl font-black">Simulation Labs Evaluator</h3>
                    <p className="text-white/40 text-xs font-mono uppercase tracking-widest mt-1">
                      Render, compile and run student-pasted microcontroller setups in active real-time test beds
                    </p>
                  </div>

                  <div className="space-y-6">
                    {submissions.length === 0 ? (
                      <div className="py-16 text-center bg-[#151619] border border-dashed border-white/5 rounded-2xl">
                        <CheckCircle className="mx-auto text-green-400/40 mb-3" size={32} />
                        <p className="text-xs text-white/40 italic">No submitted files waiting for grading review.</p>
                      </div>
                    ) : (
                      submissions.map((sub) => {
                        const isUnderEvaluation = gradersAction[sub.id];

                        return (
                          <div 
                            key={sub.id} 
                            className="bg-[#151619] border border-white/5 rounded-2xl p-6 space-y-6 hover:border-white/10 transition-all"
                          >
                            {/* Student Metadata */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/15">
                                  <span className="text-xs font-black font-mono text-blue-400">
                                    {(sub.studentName || 'S').charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded font-mono border border-amber-500/10">
                                    {sub.labTitle}
                                  </span>
                                  <h4 className="font-extrabold text-sm text-white mt-1">Submitted by {sub.studentName}</h4>
                                  <p className="text-[10px] text-white/40 font-mono mt-0.5">
                                    School: {sub.schoolName} • Class/Sec: {sub.classSection || 'General'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className={`px-2.5 py-1 rounded font-mono text-[9px] font-black uppercase tracking-wider border ${
                                  sub.status === 'approved' 
                                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                    : sub.status === 'rejected'
                                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                    : 'bg-yellow-500/15 border border-yellow-500/20 text-yellow-500'
                                }`}>
                                  {sub.status === 'approved' ? 'Approved & Score Credited' : sub.status === 'rejected' ? 'Needs Revision' : 'Awaiting Grading'}
                                </span>
                                <span className="text-[10px] text-white/20 font-mono">
                                  {new Date(sub.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            {/* Two Column Layout: Left Details, Right live simulator render */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                              {/* Left detail Column */}
                              <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
                                <div className="space-y-4">
                                  {sub.description && (
                                    <div className="space-y-1">
                                      <span className="text-[9px] font-black uppercase font-mono tracking-widest text-white/30 block">Student program notes</span>
                                      <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-xs text-white/80 leading-relaxed font-sans italic">
                                        "{sub.description}"
                                      </div>
                                    </div>
                                  )}

                                  <div className="bg-black/20 rounded-xl p-3 border border-white/5 space-y-2">
                                    <span className="text-[8px] font-mono font-black uppercase tracking-widest text-white/40 block">Wokwi workpiece reference</span>
                                    <div className="flex items-center justify-between gap-2">
                                      <code className="text-[10px] font-mono text-emerald-400 truncate flex-1 block">{sub.wokwiUrl}</code>
                                      <a
                                        href={`https://wokwi.com/projects/${sub.wokwiUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[9px] text-white/50 hover:text-white flex items-center gap-0.5 shrink-0 hover:underline hover:text-[#F27D26]"
                                      >
                                        <ExternalLink size={10} /> Open source
                                      </a>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions / Feedback Form */}
                                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-4 pt-4">
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-black uppercase font-mono tracking-widest text-[#F27D26] block">Trainer feedback comment</span>
                                    <input
                                      type="text"
                                      placeholder="Add evaluation remarks..."
                                      value={gradingFeedback[sub.id] || ''}
                                      onChange={(e) => setGradingFeedback(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                      className="w-full bg-zinc-900 border border-white/5 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 mt-1 focus:outline-none focus:border-white/10"
                                    />
                                  </div>

                                  <div className="flex items-center gap-2 justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] font-bold text-white/30 font-mono uppercase">Grant Score:</span>
                                      <select
                                        value={gradingPoints[sub.id] || sub.pointsAwarded || 100}
                                        onChange={(e) => setGradingPoints(prev => ({ ...prev, [sub.id]: parseInt(e.target.value) }))}
                                        className="bg-zinc-900 border border-white/10 text-[10px] text-white rounded px-1.5 py-1 focus:outline-none focus:border-[#F27D26]"
                                      >
                                        <option value={50}>50 PTS</option>
                                        <option value={75}>75 PTS</option>
                                        <option value={100}>100 PTS</option>
                                        <option value={150}>150 PTS</option>
                                      </select>
                                    </div>

                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleGradeSubmission(sub, false)}
                                        disabled={isUnderEvaluation}
                                        className="px-3 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                      >
                                        <XCircle size={12} /> Reject
                                      </button>
                                      <button
                                        onClick={() => handleGradeSubmission(sub, true)}
                                        disabled={isUnderEvaluation}
                                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-lg shadow-green-500/10 cursor-pointer"
                                      >
                                        {isUnderEvaluation ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                        Grade & Approve
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Interactive Player iframe */}
                              <div className="lg:col-span-8 bg-black/60 rounded-2xl overflow-hidden border border-white/5 aspect-video min-h-[360px] flex flex-col">
                                <div className="bg-black/80 px-3 py-2 text-[9px] font-mono text-white/40 flex justify-between items-center border-b border-white/5">
                                  <span>🚀 Running live student circuit logic simulation</span>
                                  <span className="text-emerald-400">Interactive Active</span>
                                </div>
                                <div className="flex-1 w-full bg-zinc-950">
                                  <iframe
                                    src={`https://wokwi.com/projects/${sub.wokwiUrl}?embed=1`}
                                    title={`Wokwi Student ${sub.studentName}`}
                                    className="w-full h-full border-none"
                                    allow="geolocation; microphone; camera; midi; encrypted-media;"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

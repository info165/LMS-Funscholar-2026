import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Module, Component, Course } from '../types';
import { useAuth } from '../AuthContext';
import { ModulePlayer } from '../components/ModulePlayer';
import { 
  ArrowLeft, BookOpen, Play, Calendar, Award, Share2, 
  QrCode, Copy, Check, Printer, ChevronRight, HelpCircle, 
  Sparkles, ShieldAlert 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function Chapter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [module, setModule] = useState<Module | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const shareUrl = window.location.href;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}`;

  // Fetch Module data
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const unsubModule = onSnapshot(doc(db, 'modules', id), (docSnap) => {
      if (docSnap.exists()) {
        const modData = { id: docSnap.id, ...docSnap.data() } as Module;
        setModule(modData);

        // If module has courseId, fetch course details too
        if (modData.courseId) {
          onSnapshot(doc(db, 'courses', modData.courseId), (courseSnap) => {
            if (courseSnap.exists()) {
              setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
            }
          });
        }
      } else {
        setModule(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `modules/${id}`);
      setLoading(false);
    });

    // Fetch all components for the player
    const unsubComponents = onSnapshot(collection(db, 'components'), (snapshot) => {
      setComponents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Component)));
    });

    return () => {
      unsubModule();
      unsubComponents();
    };
  }, [id]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Permanent link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintQr = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print QR Code - ${module?.title || 'Chapter'}</title>
            <style>
              body {
                font-family: 'Inter', sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                text-align: center;
              }
              .qr-container {
                border: 2px solid #e2e8f0;
                padding: 24px;
                border-radius: 16px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              }
              img {
                width: 250px;
                height: 250px;
              }
              h1 {
                font-size: 24px;
                margin-top: 16px;
                color: #0f172a;
              }
              p {
                color: #64748b;
                font-size: 14px;
                margin-top: 8px;
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <img src="${qrCodeUrl}" alt="QR Code" />
              <h1>${module?.title || 'Robotics Chapter'}</h1>
              <p>${course?.title ? `Course: ${course.title}` : 'FunScholar Robotics Curriculum'}</p>
              <p style="font-size: 10px; font-family: monospace; color: #94a3b8; max-width: 300px; word-break: break-all;">${shareUrl}</p>
            </div>
            <script>
              window.onload = function() {
                window.print();
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-[#F27D26] border-t-transparent rounded-full animate-spin" />
        <p className="text-white/50 text-sm font-mono uppercase tracking-wider">Loading Chapter details...</p>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 text-white max-w-md mx-auto space-y-6">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center">
          <ShieldAlert size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Chapter Not Found</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            The chapter URL you requested does not exist or may have been archived. Please double check your QR code or link.
          </p>
        </div>
        <Link
          to="/"
          className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wider inline-flex items-center gap-2"
        >
          <ArrowLeft size={14} /> Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20 text-white max-w-5xl mx-auto">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <span className="text-[10px] font-mono text-[#F27D26] bg-[#F27D26]/10 border border-[#F27D26]/20 px-3 py-1 rounded-full uppercase tracking-wider font-bold">
          Permanent Lesson Link
        </span>
      </div>

      {/* Hero Overview */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-[#151619] border border-white/5 p-8 md:p-12">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(circle_at_70%_30%,#F27D26_0%,transparent_70%)] opacity-25 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row gap-8 md:gap-12 items-start md:items-center">
          <div className="w-24 h-24 rounded-3xl bg-[#F27D26]/10 border border-[#F27D26]/20 flex items-center justify-center text-[#F27D26] shadow-inner shrink-0">
            <BookOpen size={44} />
          </div>

          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              {course && (
                <span className="text-[10px] font-black uppercase tracking-widest text-[#F27D26]">
                  Course: {course.title}
                </span>
              )}
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none">{module.title}</h1>
              {module.description && (
                <p className="text-white/60 text-base max-w-2xl leading-relaxed">{module.description}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-xs font-semibold text-white/50">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/5 rounded-full">
                <Award size={14} className="text-yellow-400" />
                {(module.steps || []).length} Interactive Steps
              </span>
              {module.quizQuestions && module.quizQuestions.length > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/5 rounded-full">
                  <HelpCircle size={14} className="text-blue-400" />
                  {module.quizQuestions.length} Quiz Questions
                </span>
              )}
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col gap-3 shrink-0">
            <button
              onClick={() => setIsPlaying(true)}
              className="w-full md:w-auto px-8 py-4 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#F27D26]/20 font-sans cursor-pointer"
            >
              <Play size={16} fill="currentColor" /> Play Chapter
            </button>
            <button
              onClick={() => setShowQrModal(true)}
              className="w-full md:w-auto px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode size={16} className="text-[#F27D26]" /> QR Code Hub
            </button>
          </div>
        </div>
      </section>

      {/* Main split sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Outline of Steps */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
            <h3 className="text-xl font-bold tracking-tight border-b border-white/5 pb-4">Chapter Overview Steps</h3>
            
            <div className="space-y-4">
              {(module.steps || []).length > 0 ? (
                (module.steps || []).map((step, index) => (
                  <div 
                    key={step.id || index}
                    className="flex gap-4 p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-2xl transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full bg-[#F27D26]/10 text-[#F27D26] font-mono text-sm font-bold flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">{step.title}</h4>
                      <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{step.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-white/40 text-xs italic">No steps logged for this module.</p>
              )}
            </div>
          </section>
        </div>

        {/* Right: Sharing, URL and QR Code */}
        <div className="space-y-6">
          <section className="bg-[#151619] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
            <h3 className="text-lg font-bold tracking-tight">QR Scanner Integration</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              This permanent URL will never change, ensuring that any printed QR codes inside textbooks will always route students directly to this interactive chapter's digital workspace.
            </p>

            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-4">
              <div className="bg-white p-3 rounded-2xl shadow-lg border border-white/10">
                <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40 object-contain" />
              </div>
              <span className="text-[10px] font-mono text-white/40 text-center select-all break-all max-w-full">
                {shareUrl}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>
              <button
                onClick={handlePrintQr}
                className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                title="Print QR Code Page"
              >
                <Printer size={14} />
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* QR Code Hub Modal overlay */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#151619] border border-white/10 rounded-[2.5rem] max-w-md w-full p-8 space-y-6 relative text-center"
            >
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-6 right-6 p-1.5 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>

              <div className="space-y-2">
                <div className="w-12 h-12 bg-[#F27D26]/10 text-[#F27D26] rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <QrCode size={24} />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">QR Code Hub</h3>
                <p className="text-xs text-white/50 max-w-xs mx-auto">
                  Download or print this high-contrast QR code to embed in physical curriculum textbooks.
                </p>
              </div>

              <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl mx-auto">
                <img src={qrCodeUrl} alt="QR Code" className="w-56 h-56 object-contain" />
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-[10px] font-mono text-white/60 break-all select-all">
                  {shareUrl}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied' : 'Copy URL'}</span>
                  </button>
                  <button
                    onClick={handlePrintQr}
                    className="flex-1 py-3 bg-[#F27D26] hover:bg-[#d66a1e] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-[#F27D26]/10"
                  >
                    <Printer size={14} />
                    <span>Print QR</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Module Player Component full view */}
      {isPlaying && (
        <ModulePlayer
          module={module}
          components={components}
          onClose={() => setIsPlaying(false)}
        />
      )}
    </div>
  );
}

// X inline declaration to satisfy imports above if needed
const X = ({ size }: { size: number }) => <span className="opacity-0 w-0 h-0 inline-block" />;

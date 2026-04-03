import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useAuth } from '../AuthContext';

interface FileViewerProps {
  url: string;
  type: 'video' | 'pdf' | 'ppt' | 'image' | 'doc';
  title: string;
  onClose: () => void;
}

export default function FileViewer({ url, type, title, onClose }: FileViewerProps) {
  const { profile } = useAuth();
  const isYouTube = (url: string) => {
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const renderContent = () => {
    if (type === 'video') {
      if (isYouTube(url)) {
        const id = getYouTubeId(url);
        return (
          <iframe
            src={`https://www.youtube.com/embed/${id}`}
            className="w-full h-full rounded-xl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        );
      }
      return (
        <video 
          src={url} 
          controls 
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
          className="w-full h-full rounded-xl bg-black"
        />
      );
    }

    if (type === 'pdf' || type === 'ppt' || type === 'doc') {
      // Use Google Docs Viewer for in-app viewing without direct download link exposure
      // Adding rm=minimal to try and hide more of the viewer UI
      const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true&rm=minimal`;
      return (
        <div className="relative w-full h-full">
          <iframe
            src={viewerUrl}
            className="w-full h-full rounded-xl bg-white"
            frameBorder="0"
            title="Document Viewer"
          />
          {/* Shield to prevent clicking the pop-out button in Google Docs Viewer for non-admins */}
          {profile?.role !== 'admin' && (
            <div className="absolute top-0 right-0 w-24 h-24 bg-transparent z-10 cursor-default" />
          )}
        </div>
      );
    }

    if (type === 'image') {
      return (
        <div className="w-full h-full flex items-center justify-center bg-black/20 rounded-xl overflow-hidden">
          <img 
            src={url} 
            alt={title} 
            className="max-w-full max-h-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-md">
      <div className="bg-[#151619] border border-white/10 rounded-3xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div>
            <h3 className="text-xl font-bold tracking-tight">{title}</h3>
            <p className="text-xs text-white/40 font-mono uppercase tracking-widest mt-1">{type} viewer</p>
          </div>
          <div className="flex items-center gap-4">
            {profile?.role === 'admin' && (
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 text-white/40 hover:text-white transition-colors"
                title="Open in new tab"
              >
                <ExternalLink size={20} />
              </a>
            )}
            <button 
              onClick={onClose} 
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 p-4 md:p-8 min-h-0">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

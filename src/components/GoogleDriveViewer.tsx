import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '../AuthContext';

interface GoogleDriveViewerProps {
  url: string;
  title?: string;
}

export function GoogleDriveViewer({ url, title }: GoogleDriveViewerProps) {
  const { profile } = useAuth();
  // Convert standard Drive URL to embed URL
  const getEmbedUrl = (driveUrl: string) => {
    try {
      const urlObj = new URL(driveUrl);
      const pathParts = urlObj.pathname.split('/');
      const fileId = pathParts[pathParts.indexOf('d') + 1] || urlObj.searchParams.get('id');
      
      if (fileId) {
        if (urlObj.hostname.includes('docs.google.com')) {
          if (urlObj.pathname.includes('/document/')) {
            return `https://docs.google.com/document/d/${fileId}/preview`;
          }
          if (urlObj.pathname.includes('/spreadsheets/')) {
            return `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
          }
          if (urlObj.pathname.includes('/presentation/')) {
            return `https://docs.google.com/presentation/d/${fileId}/preview`;
          }
        }
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
      return driveUrl;
    } catch (e) {
      return driveUrl;
    }
  };

  const embedUrl = getEmbedUrl(url);

  return (
    <div className="w-full h-full min-h-[500px] bg-black/20 rounded-2xl overflow-hidden border border-white/10 flex flex-col">
      <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
        <h4 className="text-sm font-bold tracking-tight">{title || 'Resource Viewer'}</h4>
        {profile?.role === 'admin' && (
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[#F27D26] hover:underline text-xs flex items-center gap-1"
          >
            Open in Drive <ExternalLink size={12} />
          </a>
        )}
      </div>
      <div className="flex-1 relative">
        <iframe
          src={embedUrl}
          className="w-full h-full border-0"
          allow="autoplay"
          title={title || 'Google Drive File'}
        />
        {/* Shield to prevent clicking the pop-out button in Google Drive for non-admins */}
        {profile?.role !== 'admin' && (
          <div className="absolute top-0 right-0 w-24 h-24 bg-transparent z-10 cursor-default" />
        )}
      </div>
    </div>
  );
}

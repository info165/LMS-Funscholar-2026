import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

export interface AuditLog {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  details: string;
  timestamp: string;
  metadata?: any;
}

export const logAudit = async (
  profile: (UserProfile & { adminSubRole?: string }) | null,
  action: string,
  details: string,
  metadata?: any
) => {
  if (!profile) return;
  try {
    // Session duration calculations using sessionStorage
    let sessionStartStr = typeof window !== 'undefined' ? sessionStorage.getItem('funscholar_session_start') : null;
    if (!sessionStartStr && typeof window !== 'undefined') {
      sessionStartStr = new Date().toISOString();
      sessionStorage.setItem('funscholar_session_start', sessionStartStr);
    }
    
    let sessionDuration = '0s';
    if (sessionStartStr) {
      const start = new Date(sessionStartStr).getTime();
      const elapsedMs = Date.now() - start;
      const mins = Math.floor(elapsedMs / 60000);
      const secs = Math.floor((elapsedMs % 60000) / 1000);
      sessionDuration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    }

    const enrichedMetadata = {
      ...(metadata || {}),
      sessionDuration
    };

    await addDoc(collection(db, 'auditLogs'), {
      userId: profile.uid,
      userName: profile.name || 'Anonymous',
      userEmail: profile.email || '',
      userRole: profile.role || 'user',
      action,
      details,
      timestamp: new Date().toISOString(),
      metadata: enrichedMetadata
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};

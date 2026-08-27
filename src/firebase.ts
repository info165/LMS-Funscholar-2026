import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { toast } from 'sonner';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
}, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

// Secondary app for admin tasks (creating users without logging out current admin)
const adminApp = initializeApp(firebaseConfig, 'AdminApp');
export const adminAuth = getAuth(adminApp);
setPersistence(adminAuth, inMemoryPersistence).catch(err => {
  console.error('Failed to set inMemoryPersistence for adminAuth:', err);
});

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  const isPermissionError = message.toLowerCase().includes('permission') || message.toLowerCase().includes('insufficient');
  
  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }

  // Show a user-friendly toast
  if (isPermissionError) {
    toast.error(`Permission denied for ${operationType} on ${path || 'database'}. Please check your role permissions.`);
  } else {
    toast.error(`Database error during ${operationType}: ${message}`);
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Do not throw on list or get operations to avoid uncaught exceptions crashing async snapshot listeners
  if (operationType === OperationType.LIST || operationType === OperationType.GET) {
    return;
  }
  
  throw new Error(JSON.stringify(errInfo));
}

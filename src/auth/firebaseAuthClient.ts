import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
  type Unsubscribe,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const isFirebaseConfigured =
  typeof firebaseConfig.apiKey === 'string' && firebaseConfig.apiKey.length > 0 &&
  typeof firebaseConfig.authDomain === 'string' && firebaseConfig.authDomain.length > 0 &&
  typeof firebaseConfig.projectId === 'string' && firebaseConfig.projectId.length > 0 &&
  typeof firebaseConfig.appId === 'string' && firebaseConfig.appId.length > 0;

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

function getFirebaseAuth(): Auth {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase auth is not configured. Set VITE_FIREBASE_* environment variables.');
  }
  if (cachedAuth) return cachedAuth;
  cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  cachedAuth = getAuth(cachedApp);
  return cachedAuth;
}

export async function firebaseSignInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function firebaseSignOut(): Promise<void> {
  if (!isFirebaseConfigured) return;
  await signOut(getFirebaseAuth());
}

export function subscribeToFirebaseAuthState(listener: (user: User | null) => void): Unsubscribe {
  if (!isFirebaseConfigured) {
    listener(null);
    return () => {};
  }
  return onAuthStateChanged(getFirebaseAuth(), listener);
}

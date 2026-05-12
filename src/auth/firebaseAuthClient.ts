import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
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
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured =
  typeof firebaseConfig.apiKey === 'string' && firebaseConfig.apiKey.length > 0 &&
  typeof firebaseConfig.authDomain === 'string' && firebaseConfig.authDomain.length > 0 &&
  typeof firebaseConfig.projectId === 'string' && firebaseConfig.projectId.length > 0 &&
  typeof firebaseConfig.appId === 'string' && firebaseConfig.appId.length > 0;

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedAnalytics: Analytics | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!cachedApp) {
    cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return cachedApp;
}

function getFirebaseAuth(): Auth {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase auth is not configured. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID.',
    );
  }
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getFirebaseApp());
  return cachedAuth;
}

export async function initializeFirebaseAnalytics(): Promise<Analytics | null> {
  if (!isFirebaseConfigured || cachedAnalytics) return cachedAnalytics;
  if (typeof window === 'undefined') return null;
  if (!(await isSupported())) return null;
  cachedAnalytics = getAnalytics(getFirebaseApp());
  return cachedAnalytics;
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

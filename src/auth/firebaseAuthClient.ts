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
import { AUTH_RUNTIME_CONFIG } from './authRuntimeConfig';

/**
 * Set VITE_GOOGLE_AUTH_DISABLED=1 to disable Google sign-in across all surfaces.
 * When disabled, `firebaseSignInWithGoogle` throws and the login UI shows an
 * unavailable state instead of the sign-in button.
 */
export const GOOGLE_AUTH_DISABLED = AUTH_RUNTIME_CONFIG.googleAuthDisabled;

const firebaseConfig = AUTH_RUNTIME_CONFIG.firebaseConfig;

export const isFirebaseConfigured = AUTH_RUNTIME_CONFIG.isFirebaseConfigured;

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
    throw new Error(AUTH_RUNTIME_CONFIG.statusMessage);
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
  if (GOOGLE_AUTH_DISABLED) {
    throw new Error(AUTH_RUNTIME_CONFIG.statusMessage);
  }
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

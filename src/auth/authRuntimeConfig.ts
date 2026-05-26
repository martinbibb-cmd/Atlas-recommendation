export type AtlasAuthMode =
  | 'firebase_google'
  | 'disabled'
  | 'dev_mock'
  | 'misconfigured';

export interface AtlasAuthRuntimeConfig {
  readonly activeMode: AtlasAuthMode;
  readonly firebaseConfig: {
    readonly apiKey: string;
    readonly authDomain: string;
    readonly projectId: string;
    readonly appId: string;
    readonly storageBucket: string;
    readonly messagingSenderId: string;
    readonly measurementId: string;
  };
  readonly isFirebaseConfigured: boolean;
  readonly missingFirebaseVars: readonly string[];
  readonly googleAuthDisabled: boolean;
  readonly devMockAuthEnabled: boolean;
  readonly authDisabledIntentionally: boolean;
  readonly googleOAuthClientIdPresent: boolean;
  readonly usesLegacyFirebaseApiKeyFallback: boolean;
  readonly shouldInitializeFirebase: boolean;
  readonly modeLabel: string;
  readonly statusMessage: string;
}

const REQUIRED_FIREBASE_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

function readEnvValue(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveAuthRuntimeConfig(
  env: Record<string, string | boolean | undefined>,
  options: { dev: boolean },
): AtlasAuthRuntimeConfig {
  const apiKey = readEnvValue(env.VITE_FIREBASE_API_KEY) || readEnvValue(env.FIREBASE_API_KEY_FALLBACK);
  const authDomain = readEnvValue(env.VITE_FIREBASE_AUTH_DOMAIN);
  const projectId = readEnvValue(env.VITE_FIREBASE_PROJECT_ID);
  const appId = readEnvValue(env.VITE_FIREBASE_APP_ID);
  const storageBucket = readEnvValue(env.VITE_FIREBASE_STORAGE_BUCKET);
  const messagingSenderId = readEnvValue(env.VITE_FIREBASE_MESSAGING_SENDER_ID);
  const measurementId = readEnvValue(env.VITE_FIREBASE_MEASUREMENT_ID);
  const googleOAuthClientId =
    readEnvValue(env.VITE_GOOGLE_OAUTH_CLIENT_ID) || readEnvValue(env.VITE_GOOGLE_CLIENT_ID);
  const googleAuthDisabled = readEnvValue(env.VITE_GOOGLE_AUTH_DISABLED) === '1';
  const devMockAuthEnabled = options.dev && readEnvValue(env.VITE_ATLAS_DEV_MOCK_AUTH) === '1';
  const missingFirebaseVars = REQUIRED_FIREBASE_ENV_VARS.filter((envVar) => {
    switch (envVar) {
      case 'VITE_FIREBASE_API_KEY':
        return apiKey.length === 0;
      case 'VITE_FIREBASE_AUTH_DOMAIN':
        return authDomain.length === 0;
      case 'VITE_FIREBASE_PROJECT_ID':
        return projectId.length === 0;
      case 'VITE_FIREBASE_APP_ID':
        return appId.length === 0;
      default:
        return false;
    }
  });
  const isFirebaseConfigured = missingFirebaseVars.length === 0;

  let activeMode: AtlasAuthMode;
  let modeLabel: string;
  let statusMessage: string;

  if (devMockAuthEnabled) {
    activeMode = 'dev_mock';
    modeLabel = 'Dev mock auth';
    statusMessage = 'Authentication is using the dev mock session.';
  } else if (googleAuthDisabled) {
    activeMode = 'disabled';
    modeLabel = 'Auth disabled';
    statusMessage = 'Authentication is intentionally disabled via VITE_GOOGLE_AUTH_DISABLED=1.';
  } else if (isFirebaseConfigured) {
    activeMode = 'firebase_google';
    modeLabel = 'Firebase Google auth';
    statusMessage = 'Authentication is using Firebase Google sign-in.';
  } else {
    activeMode = 'misconfigured';
    modeLabel = 'Auth misconfigured';
    statusMessage =
      `Authentication is unavailable because Firebase runtime config is missing: ${missingFirebaseVars.join(', ')}. ` +
      'Set these Cloudflare Pages Production variables and redeploy.';
  }

  return {
    activeMode,
    firebaseConfig: {
      apiKey,
      authDomain,
      projectId,
      appId,
      storageBucket,
      messagingSenderId,
      measurementId,
    },
    isFirebaseConfigured,
    missingFirebaseVars,
    googleAuthDisabled,
    devMockAuthEnabled,
    authDisabledIntentionally: googleAuthDisabled,
    googleOAuthClientIdPresent: googleOAuthClientId.length > 0,
    usesLegacyFirebaseApiKeyFallback:
      readEnvValue(env.VITE_FIREBASE_API_KEY).length === 0 &&
      readEnvValue(env.FIREBASE_API_KEY_FALLBACK).length > 0,
    shouldInitializeFirebase: activeMode === 'firebase_google',
    modeLabel,
    statusMessage,
  };
}

export const AUTH_RUNTIME_CONFIG = resolveAuthRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>,
  { dev: import.meta.env.DEV },
);

export const FIREBASE_REQUIRED_RUNTIME_ENV_VARS = REQUIRED_FIREBASE_ENV_VARS;

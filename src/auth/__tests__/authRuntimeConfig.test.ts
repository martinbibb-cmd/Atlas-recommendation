import { describe, expect, it } from 'vitest';
import { resolveAuthRuntimeConfig } from '../authRuntimeConfig';

describe('resolveAuthRuntimeConfig', () => {
  it('uses Firebase Google auth when required runtime vars are present', () => {
    const config = resolveAuthRuntimeConfig({
      VITE_FIREBASE_API_KEY: 'api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'atlas.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'atlas-project',
      VITE_FIREBASE_APP_ID: 'app-id',
    }, { dev: false });

    expect(config.activeMode).toBe('firebase_google');
    expect(config.isFirebaseConfigured).toBe(true);
    expect(config.missingFirebaseVars).toEqual([]);
    expect(config.shouldInitializeFirebase).toBe(true);
  });

  it('treats Google auth disabled flag as an intentional safe fallback', () => {
    const config = resolveAuthRuntimeConfig({
      VITE_GOOGLE_AUTH_DISABLED: '1',
    }, { dev: false });

    expect(config.activeMode).toBe('disabled');
    expect(config.authDisabledIntentionally).toBe(true);
    expect(config.shouldInitializeFirebase).toBe(false);
    expect(config.statusMessage).toMatch(/intentionally disabled/i);
  });

  it('reports missing Firebase runtime vars when auth is not intentionally disabled', () => {
    const config = resolveAuthRuntimeConfig({
      VITE_FIREBASE_PROJECT_ID: 'atlas-project',
    }, { dev: false });

    expect(config.activeMode).toBe('misconfigured');
    expect(config.isFirebaseConfigured).toBe(false);
    expect(config.missingFirebaseVars).toEqual([
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_APP_ID',
    ]);
    expect(config.statusMessage).toMatch(/Set these environment variables and restart or redeploy/i);
  });

  it('accepts the legacy firebase_api_key compatibility fallback', () => {
    const config = resolveAuthRuntimeConfig({
      FIREBASE_API_KEY_FALLBACK: 'legacy-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'atlas.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'atlas-project',
      VITE_FIREBASE_APP_ID: 'app-id',
    }, { dev: false });

    expect(config.isFirebaseConfigured).toBe(true);
    expect(config.usesLegacyFirebaseApiKeyFallback).toBe(true);
  });

  it('prefers dev mock auth when enabled in development', () => {
    const config = resolveAuthRuntimeConfig({
      VITE_ATLAS_DEV_MOCK_AUTH: '1',
    }, { dev: true });

    expect(config.activeMode).toBe('dev_mock');
    expect(config.devMockAuthEnabled).toBe(true);
    expect(config.shouldInitializeFirebase).toBe(false);
  });
});

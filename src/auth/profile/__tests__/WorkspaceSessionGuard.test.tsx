import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspaceSessionGuard } from '../WorkspaceSessionGuard';
import { useWorkspaceSession } from '../WorkspaceSessionProvider';
import { useAtlasAuth } from '../../useAtlasAuth';

vi.mock('../WorkspaceSessionProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../WorkspaceSessionProvider')>();
  return {
    ...actual,
    useWorkspaceSession: vi.fn(),
  };
});

vi.mock('../../useAtlasAuth', () => ({
  useAtlasAuth: vi.fn(),
}));

function makeAuthContextValue(overrides: Partial<ReturnType<typeof useAtlasAuth>> = {}): ReturnType<typeof useAtlasAuth> {
  return {
    status: 'unauthenticated',
    isAuthenticated: false,
    isDevMockAuthEnabled: false,
    authMode: 'firebase_google',
    authRuntimeConfig: {
      activeMode: 'firebase_google',
      firebaseConfig: {
        apiKey: 'key',
        authDomain: 'atlas.firebaseapp.com',
        projectId: 'atlas',
        appId: 'app-id',
        storageBucket: '',
        messagingSenderId: '',
        measurementId: '',
      },
      isFirebaseConfigured: true,
      missingFirebaseVars: [],
      googleAuthDisabled: false,
      devMockAuthEnabled: false,
      authDisabledIntentionally: false,
      googleOAuthClientIdPresent: false,
      usesLegacyFirebaseApiKeyFallback: false,
      shouldInitializeFirebase: true,
      modeLabel: 'Firebase Google auth',
      statusMessage: 'Authentication is using Firebase Google sign-in.',
    },
    userProfile: null,
    workspaces: [],
    currentWorkspace: null,
    continueWithGoogle: async () => {},
    signOut: async () => {},
    setCurrentWorkspace: () => {},
    ...overrides,
  };
}

describe('WorkspaceSessionGuard', () => {
  it('shows demo/session mode for unauthenticated sessions', () => {
    vi.mocked(useWorkspaceSession).mockReturnValue({
      status: 'unauthenticated_demo',
      authUserId: null,
      atlasUserProfile: null,
      activeWorkspace: null,
      storageTarget: 'disabled',
    });
    vi.mocked(useAtlasAuth).mockReturnValue(makeAuthContextValue());
    render(<WorkspaceSessionGuard />);
    expect(screen.getByText(/Demo\/session mode/i)).toBeTruthy();
  });

  it('shows explicit disabled-auth messaging when auth is intentionally disabled', () => {
    vi.mocked(useWorkspaceSession).mockReturnValue({
      status: 'unauthenticated_demo',
      authUserId: null,
      atlasUserProfile: null,
      activeWorkspace: null,
      storageTarget: 'disabled',
    });
    vi.mocked(useAtlasAuth).mockReturnValue(makeAuthContextValue({
      authMode: 'disabled',
      authRuntimeConfig: {
        ...makeAuthContextValue().authRuntimeConfig,
        activeMode: 'disabled',
        googleAuthDisabled: true,
        authDisabledIntentionally: true,
        shouldInitializeFirebase: false,
        modeLabel: 'Auth disabled',
        statusMessage: 'Authentication is intentionally disabled via VITE_GOOGLE_AUTH_DISABLED=1.',
      },
    }));

    render(<WorkspaceSessionGuard />);

    expect(screen.getByText(/Authentication is intentionally disabled/i)).toBeTruthy();
  });

  it('shows explicit missing-config messaging when Firebase auth is misconfigured', () => {
    vi.mocked(useWorkspaceSession).mockReturnValue({
      status: 'unauthenticated_demo',
      authUserId: null,
      atlasUserProfile: null,
      activeWorkspace: null,
      storageTarget: 'disabled',
    });
    vi.mocked(useAtlasAuth).mockReturnValue(makeAuthContextValue({
      authMode: 'misconfigured',
      authRuntimeConfig: {
        ...makeAuthContextValue().authRuntimeConfig,
        activeMode: 'misconfigured',
        isFirebaseConfigured: false,
        missingFirebaseVars: ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN'],
        shouldInitializeFirebase: false,
        modeLabel: 'Auth misconfigured',
        statusMessage: 'Authentication is unavailable because Firebase runtime config is missing: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN. Set these Cloudflare Pages Production variables and redeploy.',
      },
    }));

    render(<WorkspaceSessionGuard />);

    expect(screen.getByText(/Authentication is unavailable because Firebase runtime config is missing/i)).toBeTruthy();
  });

  it('shows no-workspace creation guard for signed-in users without a workspace', () => {
    vi.mocked(useWorkspaceSession).mockReturnValue({
      status: 'authenticated_no_workspace',
      authUserId: 'user-1',
      atlasUserProfile: { atlasUserId: 'atlas-user-1' } as never,
      activeWorkspace: null,
      storageTarget: 'disabled',
    });
    vi.mocked(useAtlasAuth).mockReturnValue(makeAuthContextValue({
      status: 'authenticated',
      isAuthenticated: true,
      userProfile: { atlasUserId: 'atlas-user-1' } as never,
    }));
    render(<WorkspaceSessionGuard />);
    expect(screen.getByText(/Create or join workspace before creating customer visits/i)).toBeTruthy();
  });

  it('shows workspace name and storage preference when active', () => {
    vi.mocked(useWorkspaceSession).mockReturnValue({
      status: 'workspace_active',
      authUserId: 'user-1',
      atlasUserProfile: { atlasUserId: 'atlas-user-1' } as never,
      activeWorkspace: { workspaceId: 'ws-a', name: 'Workspace A' } as never,
      storageTarget: 'local_only',
    });
    vi.mocked(useAtlasAuth).mockReturnValue(makeAuthContextValue({
      status: 'authenticated',
      isAuthenticated: true,
      userProfile: { atlasUserId: 'atlas-user-1' } as never,
    }));
    render(<WorkspaceSessionGuard showWorkspaceActiveState />);
    const banner = screen.getByRole('status', { name: /workspace active banner/i });
    expect(banner.textContent).toMatch(/Workspace active:/i);
    expect(banner.textContent).toMatch(/Workspace A/i);
    expect(banner.textContent).toMatch(/local_only/i);
  });
});

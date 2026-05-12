import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { AtlasAuthContextValue, AtlasUserProfileV1, AtlasWorkspaceV1 } from './authTypes';
import { AtlasAuthContext } from './AtlasAuthContext';
import {
  firebaseSignInWithGoogle,
  firebaseSignOut,
  isFirebaseConfigured,
  subscribeToFirebaseAuthState,
} from './firebaseAuthClient';

const USER_PROFILE_STORE_KEY = 'atlas:auth:user-profile:v1';
const WORKSPACES_STORE_KEY = 'atlas:auth:workspaces:v1';
const CURRENT_WORKSPACE_STORE_KEY = 'atlas:auth:current-workspace:v1';

const DEV_MOCK_AUTH_ENABLED =
  import.meta.env.DEV &&
  import.meta.env.VITE_ATLAS_DEV_MOCK_AUTH === '1';

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // localStorage unavailable.
  }
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // sessionStorage unavailable.
  }
  return null;
}

function readJson<T>(key: string, fallback: T): T {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // best effort
  }
}

function writeString(key: string, value: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // best effort
  }
}

function readString(key: string): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function removeKey(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // best effort
  }
}

function buildProfileFromFirebaseUser(user: User): AtlasUserProfileV1 {
  const existing = readJson<AtlasUserProfileV1 | null>(USER_PROFILE_STORE_KEY, null);
  const isExistingForCurrentFirebaseUser = existing !== null && existing.firebaseUid === user.uid;
  const now = new Date().toISOString();
  return {
    version: '1.0',
    atlasUserId: isExistingForCurrentFirebaseUser ? existing.atlasUserId : `atlas_${user.uid}`,
    firebaseUid: user.uid,
    displayName: user.displayName?.trim() || user.email?.trim() || 'Atlas User',
    email: user.email ?? undefined,
    photoURL: user.photoURL ?? undefined,
    createdAt: isExistingForCurrentFirebaseUser ? existing.createdAt : now,
    updatedAt: now,
  };
}

function buildMockProfile(): AtlasUserProfileV1 {
  const existing = readJson<AtlasUserProfileV1 | null>(USER_PROFILE_STORE_KEY, null);
  const now = new Date().toISOString();
  return {
    version: '1.0',
    atlasUserId: existing?.atlasUserId ?? 'atlas_dev_mock_user',
    firebaseUid: existing?.firebaseUid ?? 'dev_mock_uid',
    displayName: existing?.displayName ?? 'Atlas Dev User',
    email: existing?.email ?? 'dev@atlas.local',
    photoURL: existing?.photoURL,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function ensureDefaultWorkspace(
  profile: AtlasUserProfileV1,
  options?: { persist?: boolean },
): { workspaces: AtlasWorkspaceV1[]; currentWorkspaceId: string } {
  const existing = readJson<AtlasWorkspaceV1[]>(WORKSPACES_STORE_KEY, []);
  const now = new Date().toISOString();
  const defaultWorkspaceId = `workspace_${profile.atlasUserId}`;
  const shouldPersist = options?.persist !== false;

  let workspaces = existing.filter((workspace) => workspace.ownerAtlasUserId === profile.atlasUserId);
  if (workspaces.length === 0) {
    workspaces = [
      {
        version: '1.0',
        workspaceId: defaultWorkspaceId,
        name: 'Default Workspace',
        ownerAtlasUserId: profile.atlasUserId,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  const persistedCurrentWorkspaceId = readString(CURRENT_WORKSPACE_STORE_KEY);
  const persistedWorkspaceExists =
    persistedCurrentWorkspaceId != null &&
    workspaces.some((workspace) => workspace.workspaceId === persistedCurrentWorkspaceId);
  const currentWorkspaceId = persistedWorkspaceExists ? persistedCurrentWorkspaceId : workspaces[0].workspaceId;

  if (shouldPersist) {
    writeJson(WORKSPACES_STORE_KEY, workspaces);
    writeString(CURRENT_WORKSPACE_STORE_KEY, currentWorkspaceId);
  }

  return { workspaces, currentWorkspaceId };
}

function persistAuthenticatedState(profile: AtlasUserProfileV1) {
  writeJson(USER_PROFILE_STORE_KEY, profile);
  return ensureDefaultWorkspace(profile);
}

function clearAuthenticatedState() {
  removeKey(USER_PROFILE_STORE_KEY);
  removeKey(CURRENT_WORKSPACE_STORE_KEY);
}

interface AtlasAuthProviderProps {
  children: ReactNode;
}

interface MockBootstrapState {
  userProfile: AtlasUserProfileV1;
  workspaces: AtlasWorkspaceV1[];
  currentWorkspaceId: string;
}

function getMockBootstrapState(): MockBootstrapState {
  const userProfile = buildMockProfile();
  const { workspaces, currentWorkspaceId } = ensureDefaultWorkspace(userProfile, { persist: false });
  return { userProfile, workspaces, currentWorkspaceId };
}

export function AtlasAuthProvider({ children }: AtlasAuthProviderProps) {
  const [mockBootstrapState] = useState<MockBootstrapState | null>(() =>
    DEV_MOCK_AUTH_ENABLED ? getMockBootstrapState() : null,
  );
  const [status, setStatus] = useState<AtlasAuthContextValue['status']>(() =>
    mockBootstrapState ? 'authenticated' : (isFirebaseConfigured ? 'loading' : 'unauthenticated'),
  );
  const [userProfile, setUserProfile] = useState<AtlasUserProfileV1 | null>(
    () => mockBootstrapState?.userProfile ?? null,
  );
  const [workspaces, setWorkspaces] = useState<AtlasWorkspaceV1[]>(
    () => mockBootstrapState?.workspaces ?? [],
  );
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
    () => mockBootstrapState?.currentWorkspaceId ?? null,
  );

  const hydrateAuthenticatedState = useCallback((profile: AtlasUserProfileV1) => {
    const { workspaces: nextWorkspaces, currentWorkspaceId: nextWorkspaceId } = persistAuthenticatedState(profile);
    setUserProfile(profile);
    setWorkspaces(nextWorkspaces);
    setCurrentWorkspaceId(nextWorkspaceId);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    if (DEV_MOCK_AUTH_ENABLED) {
      if (mockBootstrapState) {
        persistAuthenticatedState(mockBootstrapState.userProfile);
      }
      return;
    }

    if (!isFirebaseConfigured) {
      return;
    }

    const unsubscribe = subscribeToFirebaseAuthState((firebaseUser) => {
      if (!firebaseUser) {
        clearAuthenticatedState();
        setUserProfile(null);
        setWorkspaces([]);
        setCurrentWorkspaceId(null);
        setStatus('unauthenticated');
        return;
      }
      hydrateAuthenticatedState(buildProfileFromFirebaseUser(firebaseUser));
    });

    return () => unsubscribe();
  }, [hydrateAuthenticatedState, mockBootstrapState]);

  const continueWithGoogle = useCallback(async () => {
    if (DEV_MOCK_AUTH_ENABLED) {
      hydrateAuthenticatedState(buildMockProfile());
      return;
    }
    const firebaseUser = await firebaseSignInWithGoogle();
    hydrateAuthenticatedState(buildProfileFromFirebaseUser(firebaseUser));
  }, [hydrateAuthenticatedState]);

  const signOut = useCallback(async () => {
    if (!DEV_MOCK_AUTH_ENABLED) {
      await firebaseSignOut();
    }
    clearAuthenticatedState();
    setUserProfile(null);
    setWorkspaces([]);
    setCurrentWorkspaceId(null);
    setStatus('unauthenticated');
  }, []);

  const setCurrentWorkspace = useCallback((workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId);
    writeString(CURRENT_WORKSPACE_STORE_KEY, workspaceId);
  }, []);

  const currentWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.workspaceId === currentWorkspaceId) ?? null,
    [workspaces, currentWorkspaceId],
  );

  const value: AtlasAuthContextValue = {
    status,
    isAuthenticated: status === 'authenticated' && userProfile !== null,
    isDevMockAuthEnabled: DEV_MOCK_AUTH_ENABLED,
    userProfile,
    workspaces,
    currentWorkspace,
    continueWithGoogle,
    signOut,
    setCurrentWorkspace,
  };

  return (
    <AtlasAuthContext.Provider value={value}>
      {children}
    </AtlasAuthContext.Provider>
  );
}

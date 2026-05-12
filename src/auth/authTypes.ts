export interface AtlasUserProfileV1 {
  version: '1.0';
  atlasUserId: string;
  firebaseUid: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AtlasWorkspaceV1 {
  version: '1.0';
  workspaceId: string;
  name: string;
  ownerAtlasUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AtlasAuthContextValue {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  isAuthenticated: boolean;
  isDevMockAuthEnabled: boolean;
  userProfile: AtlasUserProfileV1 | null;
  workspaces: AtlasWorkspaceV1[];
  currentWorkspace: AtlasWorkspaceV1 | null;
  continueWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  setCurrentWorkspace: (workspaceId: string) => void;
}

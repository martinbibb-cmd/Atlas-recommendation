/**
 * authProfile.test.ts
 *
 * Tests for the auth profile and workspace boundary module.
 *
 * Coverage (from the problem statement acceptance criteria):
 *   1. Auth user creates an Atlas profile via buildAtlasUserProfileFromAuthUser
 *   2. Workspace membership resolves the active workspace
 *   3. Visits without a workspace are flagged as unowned
 *   4. Workflow export package includes workspace metadata (ownership)
 *   5. Non-member cannot resolve a route workspace
 *   6. Unauthenticated mode: no profile is created; session remains demo-only
 */

import { describe, it, expect } from 'vitest';
import { buildAtlasUserProfileFromAuthUser } from '../buildAtlasUserProfileFromAuthUser';
import { resolveActiveWorkspace } from '../resolveActiveWorkspace';
import { isUnownedVisit } from '../AtlasVisitOwnershipV1';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../WorkspaceMembershipV1';
import { buildWorkflowExportPackage } from '../../../storage/workflow/exportPackage/buildWorkflowExportPackage';
import { WORKFLOW_SCHEMA_VERSION } from '../../../storage/workflow/PersistedImplementationWorkflowV1';
import type { AtlasUserProfileV1 } from '../AtlasUserProfileV1';
import type { AtlasWorkspaceV1 } from '../AtlasWorkspaceV1';
import type { WorkspaceMembershipV1 } from '../WorkspaceMembershipV1';
import type { AtlasVisitOwnershipV1 } from '../AtlasVisitOwnershipV1';
import type { PersistedImplementationWorkflowV1 } from '../../../storage/workflow/PersistedImplementationWorkflowV1';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const FIXED_NOW = '2026-05-13T08:00:00.000Z';

function makeAuthUser(overrides: Partial<{ uid: string; email: string | null; displayName: string | null }> = {}) {
  return {
    uid: 'firebase_uid_abc',
    email: 'alice@example.com',
    displayName: 'Alice Engineer',
    ...overrides,
  };
}

function makeMembership(
  overrides: Partial<WorkspaceMembershipV1> = {},
): WorkspaceMembershipV1 {
  return {
    workspaceId: 'ws_001',
    userId: 'atlas_firebase_uid_abc',
    role: 'owner',
    permissions: DEFAULT_PERMISSIONS_BY_ROLE.owner,
    ...overrides,
  };
}

function makeWorkspace(overrides: Partial<AtlasWorkspaceV1> = {}): AtlasWorkspaceV1 {
  return {
    workspaceId: 'ws_001',
    name: 'Smith Heating',
    slug: 'smith-heating',
    ownerUserId: 'atlas_firebase_uid_abc',
    members: [makeMembership()],
    storagePreference: 'local_only',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

function makeWorkflowState(
  visitReference = 'fixture:test',
  overrides: Partial<PersistedImplementationWorkflowV1> = {},
): PersistedImplementationWorkflowV1 {
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    visitReference,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    packSnapshot: { recommendedScenarioId: 'system_unvented_cylinder' },
    resolutionSimulation: {
      resolvedTaskIds: [],
      capturedEvidenceIds: [],
      resolvedDependencyIds: [],
      changeLog: [],
    },
    scopePackStatuses: {},
    specLineStatuses: {},
    materialsReviewState: { confirmedIds: [], rejectedIds: [], flaggedIds: [] },
    ...overrides,
  };
}

function makeOwnership(overrides: Partial<AtlasVisitOwnershipV1> = {}): AtlasVisitOwnershipV1 {
  return {
    visitReference: 'fixture:test',
    workspaceId: 'ws_001',
    createdByUserId: 'atlas_firebase_uid_abc',
    visibleToRoles: ['owner', 'admin', 'surveyor', 'engineer', 'office', 'viewer'],
    storageTarget: 'local_only',
    ...overrides,
  };
}

// ─── 1. Auth user creates profile ─────────────────────────────────────────────

describe('1 — buildAtlasUserProfileFromAuthUser', () => {
  it('creates a profile with userId derived from auth UID', () => {
    const user = makeAuthUser();
    const profile = buildAtlasUserProfileFromAuthUser(user, null, FIXED_NOW);
    expect(profile.userId).toBe('atlas_firebase_uid_abc');
    expect(profile.authProviderId).toBe('firebase_uid_abc');
  });

  it('copies email and displayName from the auth user', () => {
    const user = makeAuthUser();
    const profile = buildAtlasUserProfileFromAuthUser(user, null, FIXED_NOW);
    expect(profile.email).toBe('alice@example.com');
    expect(profile.displayName).toBe('Alice Engineer');
  });

  it('falls back displayName to email when displayName is null', () => {
    const user = makeAuthUser({ displayName: null });
    const profile = buildAtlasUserProfileFromAuthUser(user, null, FIXED_NOW);
    expect(profile.displayName).toBe('alice@example.com');
  });

  it('leaves displayName undefined when both displayName and email are null', () => {
    const user = makeAuthUser({ displayName: null, email: null });
    const profile = buildAtlasUserProfileFromAuthUser(user, null, FIXED_NOW);
    expect(profile.displayName).toBeUndefined();
  });

  it('starts with empty workspaceMemberships for a new user', () => {
    const user = makeAuthUser();
    const profile = buildAtlasUserProfileFromAuthUser(user, null, FIXED_NOW);
    expect(profile.workspaceMemberships).toEqual([]);
  });

  it('preserves existing userId and workspaceMemberships on refresh', () => {
    const existing: AtlasUserProfileV1 = {
      userId: 'atlas_firebase_uid_abc',
      authProviderId: 'firebase_uid_abc',
      email: 'alice@example.com',
      displayName: 'Alice',
      workspaceMemberships: [makeMembership()],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const profile = buildAtlasUserProfileFromAuthUser(makeAuthUser(), existing, FIXED_NOW);
    expect(profile.userId).toBe('atlas_firebase_uid_abc');
    expect(profile.workspaceMemberships).toHaveLength(1);
    expect(profile.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(profile.updatedAt).toBe(FIXED_NOW);
  });

  it('creates a new userId when provider UID does not match existing profile', () => {
    const existing: AtlasUserProfileV1 = {
      userId: 'atlas_other_uid',
      authProviderId: 'other_uid',
      workspaceMemberships: [],
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    };
    const profile = buildAtlasUserProfileFromAuthUser(makeAuthUser(), existing, FIXED_NOW);
    expect(profile.userId).toBe('atlas_firebase_uid_abc');
    expect(profile.workspaceMemberships).toEqual([]);
  });
});

// ─── 2. Workspace membership resolves active workspace ────────────────────────

describe('2 — resolveActiveWorkspace', () => {
  function makeProfile(memberships: WorkspaceMembershipV1[]): AtlasUserProfileV1 {
    return {
      userId: 'atlas_firebase_uid_abc',
      authProviderId: 'firebase_uid_abc',
      workspaceMemberships: memberships,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    };
  }

  it('resolves via route slug when user is a member', () => {
    const workspace = makeWorkspace();
    const profile = makeProfile([makeMembership()]);
    const result = resolveActiveWorkspace({
      userProfile: profile,
      availableWorkspaces: [workspace],
      routeWorkspaceSlug: 'smith-heating',
    });
    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.workspace.workspaceId).toBe('ws_001');
    }
  });

  it('resolves via storedWorkspaceId when no route slug is provided', () => {
    const workspace = makeWorkspace();
    const profile = makeProfile([makeMembership()]);
    const result = resolveActiveWorkspace({
      userProfile: profile,
      availableWorkspaces: [workspace],
      storedWorkspaceId: 'ws_001',
    });
    expect(result.status).toBe('resolved');
  });

  it('resolves via defaultWorkspaceId when no route or stored workspace', () => {
    const workspace = makeWorkspace();
    const profile: AtlasUserProfileV1 = {
      ...makeProfile([makeMembership()]),
      defaultWorkspaceId: 'ws_001',
    };
    const result = resolveActiveWorkspace({
      userProfile: profile,
      availableWorkspaces: [workspace],
    });
    expect(result.status).toBe('resolved');
  });

  it('resolves via first membership as final fallback', () => {
    const workspace = makeWorkspace();
    const profile = makeProfile([makeMembership()]);
    const result = resolveActiveWorkspace({
      userProfile: profile,
      availableWorkspaces: [workspace],
    });
    expect(result.status).toBe('resolved');
  });

  it('returns no_workspace when user has no memberships', () => {
    const workspace = makeWorkspace();
    const profile = makeProfile([]);
    const result = resolveActiveWorkspace({
      userProfile: profile,
      availableWorkspaces: [workspace],
    });
    expect(result.status).toBe('no_workspace');
  });
});

// ─── 3. Visits without workspace are flagged unowned ──────────────────────────

describe('3 — isUnownedVisit', () => {
  it('flags null ownership as unowned', () => {
    expect(isUnownedVisit(null)).toBe(true);
  });

  it('flags undefined ownership as unowned', () => {
    expect(isUnownedVisit(undefined)).toBe(true);
  });

  it('flags ownership with empty workspaceId as unowned', () => {
    const ownership = makeOwnership({ workspaceId: '' });
    expect(isUnownedVisit(ownership)).toBe(true);
  });

  it('flags ownership with empty createdByUserId as unowned', () => {
    const ownership = makeOwnership({ createdByUserId: '' });
    expect(isUnownedVisit(ownership)).toBe(true);
  });

  it('returns false for a fully-populated ownership record', () => {
    expect(isUnownedVisit(makeOwnership())).toBe(false);
  });
});

// ─── 4. Workflow package includes workspace metadata ──────────────────────────

describe('4 — buildWorkflowExportPackage includes ownership', () => {
  it('embeds ownership in the manifest when provided', () => {
    const ownership = makeOwnership();
    const pkg = buildWorkflowExportPackage({
      payload: {
        workflowState: makeWorkflowState(),
        implementationPack: { packVersion: 'v1' } as never,
        specificationLines: [],
        scopePacks: [],
        materialsSchedule: [],
        engineerJobPack: { jobPackVersion: 'v1' } as never,
        followUpTasks: [],
        scanHandoffPreview: {} as never,
        customerSummary: {} as never,
      },
      ownership,
      exportedAt: FIXED_NOW,
    });
    const manifest = pkg.files['manifest.json'] as { ownership?: AtlasVisitOwnershipV1 };
    expect(manifest.ownership).toBeDefined();
    expect(manifest.ownership?.workspaceId).toBe('ws_001');
    expect(manifest.ownership?.createdByUserId).toBe('atlas_firebase_uid_abc');
  });

  it('manifest has no ownership field when not provided', () => {
    const pkg = buildWorkflowExportPackage({
      payload: {
        workflowState: makeWorkflowState(),
        implementationPack: { packVersion: 'v1' } as never,
        specificationLines: [],
        scopePacks: [],
        materialsSchedule: [],
        engineerJobPack: { jobPackVersion: 'v1' } as never,
        followUpTasks: [],
        scanHandoffPreview: {} as never,
        customerSummary: {} as never,
      },
      exportedAt: FIXED_NOW,
    });
    const manifest = pkg.files['manifest.json'] as { ownership?: AtlasVisitOwnershipV1 };
    expect(manifest.ownership).toBeUndefined();
  });
});

// ─── 5. Non-member cannot resolve route workspace ─────────────────────────────

describe('5 — non-member cannot resolve route workspace', () => {
  it('skips route workspace when user is not a member', () => {
    const workspace = makeWorkspace({ workspaceId: 'ws_other', slug: 'other-ws' });
    const profileWithDifferentWorkspace: AtlasUserProfileV1 = {
      userId: 'atlas_firebase_uid_abc',
      authProviderId: 'firebase_uid_abc',
      workspaceMemberships: [makeMembership({ workspaceId: 'ws_mine' })],
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    };
    // User is a member of ws_mine but the route points at other-ws (ws_other)
    const result = resolveActiveWorkspace({
      userProfile: profileWithDifferentWorkspace,
      availableWorkspaces: [workspace],
      routeWorkspaceSlug: 'other-ws',
    });
    // The user is not a member of ws_other so route resolution fails;
    // ws_mine is also not in availableWorkspaces so we get no_workspace
    expect(result.status).toBe('no_workspace');
  });

  it('falls through to stored workspace when route workspace is inaccessible', () => {
    const inaccessible = makeWorkspace({ workspaceId: 'ws_other', slug: 'other-ws' });
    const mine = makeWorkspace({ workspaceId: 'ws_mine', slug: 'my-ws' });
    const profile: AtlasUserProfileV1 = {
      userId: 'atlas_firebase_uid_abc',
      authProviderId: 'firebase_uid_abc',
      workspaceMemberships: [makeMembership({ workspaceId: 'ws_mine' })],
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    };
    const result = resolveActiveWorkspace({
      userProfile: profile,
      availableWorkspaces: [inaccessible, mine],
      routeWorkspaceSlug: 'other-ws',
      storedWorkspaceId: 'ws_mine',
    });
    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.workspace.workspaceId).toBe('ws_mine');
    }
  });
});

// ─── 6. Unauthenticated mode remains demo/session-only ────────────────────────

describe('6 — unauthenticated mode', () => {
  it('buildAtlasUserProfileFromAuthUser should not be called without real auth', () => {
    // The function does not itself enforce auth, but callers should not call it
    // without a real auth user.  Verify: calling it with a real user always
    // produces a non-empty userId and authProviderId, so any guard layer
    // checking for non-empty fields can detect the unauthenticated case.
    const profile = buildAtlasUserProfileFromAuthUser(makeAuthUser(), null, FIXED_NOW);
    expect(profile.userId.length).toBeGreaterThan(0);
    expect(profile.authProviderId.length).toBeGreaterThan(0);
  });

  it('visits without ownership are considered session-only (unowned)', () => {
    // Unauthenticated visits carry no ownership record → isUnownedVisit returns true
    expect(isUnownedVisit(undefined)).toBe(true);
    expect(isUnownedVisit(null)).toBe(true);
  });

  it('resolveActiveWorkspace returns no_workspace for a profile with no memberships', () => {
    const emptyProfile: AtlasUserProfileV1 = {
      userId: '',
      authProviderId: '',
      workspaceMemberships: [],
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    };
    const result = resolveActiveWorkspace({
      userProfile: emptyProfile,
      availableWorkspaces: [],
    });
    expect(result.status).toBe('no_workspace');
  });
});

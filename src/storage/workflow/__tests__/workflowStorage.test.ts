/**
 * workflowStorage.test.ts
 *
 * Tests for the implementation-workflow storage adapter boundary.
 *
 * Coverage:
 *   1. LocalWorkflowStorageAdapter — save/load round trip
 *   2. Schema version checked on load and import
 *   3. DisabledWorkflowStorageAdapter — never writes, load returns notFound
 *   4. GoogleDriveWorkflowStorageAdapterStub — returns unavailable, never saves
 *   5. import/export works with a JSON blob
 *   6. listWorkflowStates reflects saved records
 *   7. deleteWorkflowState removes a record from load and list
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalWorkflowStorageAdapter } from '../LocalWorkflowStorageAdapter';
import { GoogleDriveWorkflowStorageAdapterStub } from '../GoogleDriveWorkflowStorageAdapterStub';
import { DisabledWorkflowStorageAdapter } from '../DisabledWorkflowStorageAdapter';
import {
  WORKFLOW_SCHEMA_VERSION,
  type PersistedImplementationWorkflowV1,
} from '../PersistedImplementationWorkflowV1';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeWorkflow(
  visitReference: string,
  overrides: Partial<PersistedImplementationWorkflowV1> = {},
): PersistedImplementationWorkflowV1 {
  const now = new Date().toISOString();
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    visitReference,
    createdAt: now,
    updatedAt: now,
    packSnapshot: {
      recommendedScenarioId: 'system_unvented_cylinder',
      fixtureId: 'system_unvented_2bath',
    },
    resolutionSimulation: {
      resolvedTaskIds: [],
      capturedEvidenceIds: [],
      resolvedDependencyIds: [],
      changeLog: [],
    },
    scopePackStatuses: {},
    specLineStatuses: {},
    materialsReviewState: {
      confirmedIds: [],
      rejectedIds: [],
      flaggedIds: [],
    },
    ...overrides,
  };
}

// ─── localStorage mock ────────────────────────────────────────────────────────

function makeLocalStorageMock(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

// ─── Local adapter tests ──────────────────────────────────────────────────────

describe('LocalWorkflowStorageAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  it('save/load round trip preserves all fields', async () => {
    const adapter = new LocalWorkflowStorageAdapter();
    const workflow = makeWorkflow('visit-001', {
      resolutionSimulation: {
        resolvedTaskIds: ['task-a', 'task-b'],
        capturedEvidenceIds: ['ev-1'],
        resolvedDependencyIds: ['dep-x'],
        changeLog: [],
      },
      scopePackStatuses: { standard_unvented_cylinder_install: 'accepted' },
      specLineStatuses: { 'line-1': 'accepted', 'line-2': 'needs_check' },
      materialsReviewState: {
        confirmedIds: ['mat-1'],
        rejectedIds: [],
        flaggedIds: ['mat-2'],
      },
    });

    const saveResult = await adapter.saveWorkflowState(workflow);
    expect(saveResult.ok).toBe(true);
    if (saveResult.ok) {
      expect(saveResult.savedAt).toBe(workflow.updatedAt);
    }

    const loadResult = await adapter.loadWorkflowState('visit-001');
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      const state = loadResult.state;
      expect(state.visitReference).toBe('visit-001');
      expect(state.schemaVersion).toBe(WORKFLOW_SCHEMA_VERSION);
      expect(state.resolutionSimulation.resolvedTaskIds).toEqual(['task-a', 'task-b']);
      expect(state.resolutionSimulation.capturedEvidenceIds).toEqual(['ev-1']);
      expect(state.resolutionSimulation.resolvedDependencyIds).toEqual(['dep-x']);
      expect(state.scopePackStatuses).toEqual({ standard_unvented_cylinder_install: 'accepted' });
      expect(state.specLineStatuses).toEqual({ 'line-1': 'accepted', 'line-2': 'needs_check' });
      expect(state.materialsReviewState.confirmedIds).toEqual(['mat-1']);
      expect(state.materialsReviewState.flaggedIds).toEqual(['mat-2']);
    }
  });

  it('load returns notFound when no record exists', async () => {
    const adapter = new LocalWorkflowStorageAdapter();
    const result = await adapter.loadWorkflowState('nonexistent-visit');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.notFound).toBe(true);
    }
  });

  it('rejects records with wrong schema version', async () => {
    const mock = makeLocalStorageMock();
    vi.stubGlobal('localStorage', mock);
    // Manually write a record with the wrong schema version.
    const badRecord = JSON.stringify({
      schemaVersion: '0.9',
      visitReference: 'visit-bad',
      updatedAt: new Date().toISOString(),
    });
    mock.setItem('atlas:workflow:v1:visit-bad', badRecord);

    const adapter = new LocalWorkflowStorageAdapter();
    const result = await adapter.loadWorkflowState('visit-bad');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.notFound).toBe(false);
      expect(result.reason).toMatch(/schema version mismatch/i);
    }
  });

  it('listWorkflowStates reflects all saved records', async () => {
    const adapter = new LocalWorkflowStorageAdapter();
    await adapter.saveWorkflowState(makeWorkflow('visit-A'));
    await adapter.saveWorkflowState(makeWorkflow('visit-B'));

    const list = await adapter.listWorkflowStates();
    const refs = list.map((e) => e.visitReference);
    expect(refs).toContain('visit-A');
    expect(refs).toContain('visit-B');
    expect(list.length).toBe(2);
  });

  it('deleteWorkflowState removes record from load and list', async () => {
    const adapter = new LocalWorkflowStorageAdapter();
    await adapter.saveWorkflowState(makeWorkflow('visit-del'));

    const deleteResult = await adapter.deleteWorkflowState('visit-del');
    expect(deleteResult.ok).toBe(true);

    const loadResult = await adapter.loadWorkflowState('visit-del');
    expect(loadResult.ok).toBe(false);
    if (!loadResult.ok) {
      expect(loadResult.notFound).toBe(true);
    }

    const list = await adapter.listWorkflowStates();
    expect(list.some((e) => e.visitReference === 'visit-del')).toBe(false);
  });

  it('export/import JSON blob round trip is lossless', async () => {
    const adapter = new LocalWorkflowStorageAdapter();
    const original = makeWorkflow('visit-export', {
      resolutionSimulation: {
        resolvedTaskIds: ['task-z'],
        capturedEvidenceIds: [],
        resolvedDependencyIds: [],
        changeLog: [],
      },
    });
    await adapter.saveWorkflowState(original);

    const exportResult = await adapter.exportWorkflowState('visit-export');
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    // Reset storage and import back.
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    const freshAdapter = new LocalWorkflowStorageAdapter();

    const importResult = await freshAdapter.importWorkflowState(exportResult.json);
    expect(importResult.ok).toBe(true);

    const loadResult = await freshAdapter.loadWorkflowState('visit-export');
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.state.resolutionSimulation.resolvedTaskIds).toEqual(['task-z']);
    }
  });

  it('import rejects invalid JSON', async () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    const adapter = new LocalWorkflowStorageAdapter();
    const result = await adapter.importWorkflowState('not valid json {{{');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/invalid JSON/i);
    }
  });

  it('import rejects JSON with wrong schema version', async () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    const adapter = new LocalWorkflowStorageAdapter();
    const badJson = JSON.stringify({ schemaVersion: '99.0', visitReference: 'x', updatedAt: '' });
    const result = await adapter.importWorkflowState(badJson);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/schema version mismatch/i);
    }
  });

  it('export returns error when record does not exist', async () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    const adapter = new LocalWorkflowStorageAdapter();
    const result = await adapter.exportWorkflowState('no-such-visit');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/no saved workflow/i);
    }
  });
});

// ─── Disabled adapter tests ───────────────────────────────────────────────────

describe('DisabledWorkflowStorageAdapter', () => {
  it('save returns ok:true but load always returns notFound', async () => {
    const adapter = new DisabledWorkflowStorageAdapter();
    const workflow = makeWorkflow('visit-disabled');

    const saveResult = await adapter.saveWorkflowState(workflow);
    // save is a no-op but returns ok so callers do not crash.
    expect(saveResult.ok).toBe(true);

    const loadResult = await adapter.loadWorkflowState('visit-disabled');
    expect(loadResult.ok).toBe(false);
    if (!loadResult.ok) {
      expect(loadResult.notFound).toBe(true);
    }
  });

  it('listWorkflowStates returns empty array', async () => {
    const adapter = new DisabledWorkflowStorageAdapter();
    const list = await adapter.listWorkflowStates();
    expect(list).toEqual([]);
  });

  it('export returns error', async () => {
    const adapter = new DisabledWorkflowStorageAdapter();
    const result = await adapter.exportWorkflowState('visit-disabled');
    expect(result.ok).toBe(false);
  });

  it('import returns error', async () => {
    const adapter = new DisabledWorkflowStorageAdapter();
    const result = await adapter.importWorkflowState('{}');
    expect(result.ok).toBe(false);
  });

  it('target is disabled', () => {
    expect(new DisabledWorkflowStorageAdapter().target).toBe('disabled');
  });
});

// ─── Google Drive stub tests ──────────────────────────────────────────────────

describe('GoogleDriveWorkflowStorageAdapterStub', () => {
  it('save does not pretend to succeed — returns ok:false with clear reason', async () => {
    const adapter = new GoogleDriveWorkflowStorageAdapterStub();
    const result = await adapter.saveWorkflowState(makeWorkflow('visit-gdrive'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('Google Drive connection not configured.');
    }
  });

  it('load returns ok:false with notFound:false and clear reason', async () => {
    const adapter = new GoogleDriveWorkflowStorageAdapterStub();
    const result = await adapter.loadWorkflowState('visit-gdrive');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.notFound).toBe(false);
      expect(result.reason).toBe('Google Drive connection not configured.');
    }
  });

  it('listWorkflowStates returns empty array', async () => {
    const adapter = new GoogleDriveWorkflowStorageAdapterStub();
    const list = await adapter.listWorkflowStates();
    expect(list).toEqual([]);
  });

  it('export returns ok:false', async () => {
    const adapter = new GoogleDriveWorkflowStorageAdapterStub();
    const result = await adapter.exportWorkflowState('visit-gdrive');
    expect(result.ok).toBe(false);
  });

  it('import returns ok:false — does not pretend to save', async () => {
    const adapter = new GoogleDriveWorkflowStorageAdapterStub();
    const workflow = makeWorkflow('visit-gdrive');
    const validJson = JSON.stringify(workflow);
    const result = await adapter.importWorkflowState(validJson);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('Google Drive connection not configured.');
    }
  });

  it('delete returns ok:false', async () => {
    const adapter = new GoogleDriveWorkflowStorageAdapterStub();
    const result = await adapter.deleteWorkflowState('visit-gdrive');
    expect(result.ok).toBe(false);
  });

  it('target is google_drive', () => {
    expect(new GoogleDriveWorkflowStorageAdapterStub().target).toBe('google_drive');
  });
});

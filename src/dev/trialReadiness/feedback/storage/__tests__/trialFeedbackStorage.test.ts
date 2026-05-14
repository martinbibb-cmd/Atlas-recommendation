/**
 * trialFeedbackStorage.test.ts
 *
 * Tests for the trial-feedback storage adapter boundary.
 *
 * Coverage:
 *   1. load returns notFound before any save
 *   2. save/load round-trip preserves entries (feedback export/import round trip)
 *   3. clear resets state (load returns notFound after clear)
 *   4. export/import round-trip works (feedback export/import round trip)
 *   5. import rejects invalid JSON
 *   6. import rejects schema mismatch
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalTrialFeedbackStorageAdapter } from '../LocalTrialFeedbackStorageAdapter';
import { TRIAL_FEEDBACK_SCHEMA_VERSION } from '../PersistedTrialFeedbackV1';
import type { PersistedTrialFeedbackV1 } from '../PersistedTrialFeedbackV1';

// ─── localStorage mock ────────────────────────────────────────────────────────

function makeLocalStorageMock(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeSnapshot(
  overrides: Partial<PersistedTrialFeedbackV1> = {},
): PersistedTrialFeedbackV1 {
  return {
    schemaVersion: TRIAL_FEEDBACK_SCHEMA_VERSION,
    createdAt: '2026-05-14T00:00:00.000Z',
    updatedAt: '2026-05-14T00:00:00.000Z',
    entries: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LocalTrialFeedbackStorageAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  it('load returns notFound before any save', async () => {
    const adapter = new LocalTrialFeedbackStorageAdapter();
    const result = await adapter.load();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.notFound).toBe(true);
    }
  });

  it('save/load round-trip preserves entries', async () => {
    const adapter = new LocalTrialFeedbackStorageAdapter();
    const snapshot = makeSnapshot({
      entries: [
        {
          feedbackId: 'fb-001',
          scenarioId: 'workspace_owned_visit',
          testerType: 'internal',
          submittedAt: '2026-05-14T10:00:00.000Z',
          area: 'portal',
          severity: 'blocker',
          summary: 'Portal crashes on save',
          relatedTrialPlanItemIds: [],
          status: 'new',
        },
      ],
    });

    const saveResult = await adapter.save(snapshot);
    expect(saveResult.ok).toBe(true);

    const loadResult = await adapter.load();
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.snapshot.entries).toHaveLength(1);
      expect(loadResult.snapshot.entries[0]?.feedbackId).toBe('fb-001');
      expect(loadResult.snapshot.entries[0]?.severity).toBe('blocker');
    }
  });

  it('clear resets state — load returns notFound after clear', async () => {
    const adapter = new LocalTrialFeedbackStorageAdapter();
    await adapter.save(makeSnapshot({ entries: [] }));

    const clearResult = await adapter.clear();
    expect(clearResult.ok).toBe(true);

    const loadResult = await adapter.load();
    expect(loadResult.ok).toBe(false);
    if (!loadResult.ok) {
      expect(loadResult.notFound).toBe(true);
    }
  });

  it('export/import round-trip works', async () => {
    const adapter = new LocalTrialFeedbackStorageAdapter();
    const snapshot = makeSnapshot({
      entries: [
        {
          feedbackId: 'fb-002',
          scenarioId: 'open_vented_conversion',
          testerType: 'friendly_installer',
          submittedAt: '2026-05-14T11:00:00.000Z',
          area: 'pdf',
          severity: 'confusing',
          summary: 'PDF layout unclear',
          relatedTrialPlanItemIds: ['plan-item-1'],
          followUpAction: 'Review PDF template',
          status: 'triaged',
        },
      ],
    });
    await adapter.save(snapshot);

    const exportResult = await adapter.exportJson();
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    // Import into a fresh adapter (fresh localStorage mock)
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    const freshAdapter = new LocalTrialFeedbackStorageAdapter();

    const importResult = await freshAdapter.importJson(exportResult.json);
    expect(importResult.ok).toBe(true);
    if (importResult.ok) {
      expect(importResult.snapshot.entries[0]?.feedbackId).toBe('fb-002');
      expect(importResult.snapshot.entries[0]?.severity).toBe('confusing');
      expect(importResult.snapshot.entries[0]?.followUpAction).toBe('Review PDF template');
    }
  });

  it('import rejects invalid JSON', async () => {
    const adapter = new LocalTrialFeedbackStorageAdapter();
    const result = await adapter.importJson('not-json{{{');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('invalid JSON');
    }
  });

  it('import rejects schema mismatch', async () => {
    const adapter = new LocalTrialFeedbackStorageAdapter();
    const badJson = JSON.stringify({
      schemaVersion: '9.9',
      createdAt: '2026-05-14T00:00:00.000Z',
      updatedAt: '2026-05-14T00:00:00.000Z',
      entries: [],
    });
    const result = await adapter.importJson(badJson);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('schema version');
    }
  });
});

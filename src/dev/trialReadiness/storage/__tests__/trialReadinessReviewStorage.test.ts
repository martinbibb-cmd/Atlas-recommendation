/**
 * trialReadinessReviewStorage.test.ts
 *
 * Tests for the trial-readiness review storage adapter boundary.
 *
 * Coverage:
 *   1. loadReviewState returns notFound before any save
 *   2. save/load round-trip preserves reviewState
 *   3. status survives reopen (save then load)
 *   4. notes survive reopen (save then load)
 *   5. clear resets state (clearReviewState → loadReviewState returns notFound)
 *   6. export/import round-trip works
 *   7. import rejects invalid JSON
 *   8. import rejects schema mismatch
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalTrialReadinessReviewStorageAdapter } from '../LocalTrialReadinessReviewStorageAdapter';
import { TRIAL_READINESS_REVIEW_SCHEMA_VERSION } from '../PersistedTrialReadinessReviewV1';
import type { PersistedTrialReadinessReviewV1 } from '../PersistedTrialReadinessReviewV1';

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

function makeReview(
  overrides: Partial<PersistedTrialReadinessReviewV1> = {},
): PersistedTrialReadinessReviewV1 {
  return {
    schemaVersion: TRIAL_READINESS_REVIEW_SCHEMA_VERSION,
    generatedAt: '2026-01-01T00:00:00.000Z',
    reviewState: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LocalTrialReadinessReviewStorageAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  it('loadReviewState returns notFound before any save', async () => {
    const adapter = new LocalTrialReadinessReviewStorageAdapter();
    const result = await adapter.loadReviewState();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.notFound).toBe(true);
    }
  });

  it('save/load round-trip preserves reviewState', async () => {
    const adapter = new LocalTrialReadinessReviewStorageAdapter();
    const review = makeReview({
      reviewState: [
        {
          actionId: 'workspace-create-join-flow',
          status: 'in_progress',
          updatedAt: '2026-01-01T00:01:00.000Z',
        },
      ],
    });

    const saveResult = await adapter.saveReviewState(review);
    expect(saveResult.ok).toBe(true);

    const loadResult = await adapter.loadReviewState();
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.snapshot.reviewState).toHaveLength(1);
      expect(loadResult.snapshot.reviewState[0]?.actionId).toBe('workspace-create-join-flow');
      expect(loadResult.snapshot.reviewState[0]?.status).toBe('in_progress');
    }
  });

  it('status survives reopen', async () => {
    const adapter = new LocalTrialReadinessReviewStorageAdapter();
    const review = makeReview({
      reviewState: [
        {
          actionId: 'storage-export-package',
          status: 'done',
          updatedAt: '2026-01-01T00:05:00.000Z',
        },
      ],
    });

    await adapter.saveReviewState(review);

    // Simulate reopen: fresh adapter instance, same localStorage mock
    const freshAdapter = new LocalTrialReadinessReviewStorageAdapter();
    const loadResult = await freshAdapter.loadReviewState();
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.snapshot.reviewState[0]?.status).toBe('done');
    }
  });

  it('notes survive reopen', async () => {
    const adapter = new LocalTrialReadinessReviewStorageAdapter();
    const review = makeReview({
      reviewState: [
        {
          actionId: 'storage-export-package',
          status: 'accepted_risk',
          reviewerNote: 'Accepted for pilot with fallback in place',
          updatedAt: '2026-01-01T00:05:00.000Z',
        },
      ],
    });

    await adapter.saveReviewState(review);

    const freshAdapter = new LocalTrialReadinessReviewStorageAdapter();
    const loadResult = await freshAdapter.loadReviewState();
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.snapshot.reviewState[0]?.reviewerNote).toBe(
        'Accepted for pilot with fallback in place',
      );
    }
  });

  it('clear resets state — loadReviewState returns notFound after clear', async () => {
    const adapter = new LocalTrialReadinessReviewStorageAdapter();
    await adapter.saveReviewState(makeReview({ reviewState: [{ actionId: 'a', status: 'done', updatedAt: '2026-01-01T00:00:00Z' }] }));

    const clearResult = await adapter.clearReviewState();
    expect(clearResult.ok).toBe(true);

    const loadResult = await adapter.loadReviewState();
    expect(loadResult.ok).toBe(false);
    if (!loadResult.ok) {
      expect(loadResult.notFound).toBe(true);
    }
  });

  it('export/import round-trip works', async () => {
    const adapter = new LocalTrialReadinessReviewStorageAdapter();
    const review = makeReview({
      reviewState: [
        {
          actionId: 'workspace-create-join-flow',
          status: 'done',
          reviewerNote: 'Verified',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    });
    await adapter.saveReviewState(review);

    const exportResult = await adapter.exportReviewState();
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    // Import into a fresh adapter (fresh localStorage mock)
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    const freshAdapter = new LocalTrialReadinessReviewStorageAdapter();

    const importResult = await freshAdapter.importReviewState(exportResult.json);
    expect(importResult.ok).toBe(true);
    if (importResult.ok) {
      expect(importResult.snapshot.reviewState[0]?.status).toBe('done');
      expect(importResult.snapshot.reviewState[0]?.reviewerNote).toBe('Verified');
    }
  });

  it('import rejects invalid JSON', async () => {
    const adapter = new LocalTrialReadinessReviewStorageAdapter();
    const result = await adapter.importReviewState('not-json{{{');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('invalid JSON');
    }
  });

  it('import rejects schema mismatch', async () => {
    const adapter = new LocalTrialReadinessReviewStorageAdapter();
    const badJson = JSON.stringify({
      schemaVersion: '9.9',
      generatedAt: '2026-01-01T00:00:00.000Z',
      reviewState: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const result = await adapter.importReviewState(badJson);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('schema version');
    }
  });
});

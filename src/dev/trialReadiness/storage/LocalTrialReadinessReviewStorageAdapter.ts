/**
 * LocalTrialReadinessReviewStorageAdapter.ts
 *
 * Trial-readiness review storage backed by browser localStorage.
 *
 * Uses a single fixed key (not scoped by workspaceId) because the review
 * is global to the dev harness, not per-workspace.
 *
 * Storage key:
 *   atlas:trial-readiness-review:v1
 *
 * Dev-only — not used in production.
 */

import {
  TRIAL_READINESS_REVIEW_SCHEMA_VERSION,
  type PersistedTrialReadinessReviewV1,
} from './PersistedTrialReadinessReviewV1';
import type {
  TrialReadinessReviewStorageAdapterV1,
  TrialReadinessReviewSaveResult,
  TrialReadinessReviewLoadResult,
  TrialReadinessReviewClearResult,
  TrialReadinessReviewExportResult,
  TrialReadinessReviewImportResult,
} from './TrialReadinessReviewStorageAdapterV1';

// ─── Storage key ──────────────────────────────────────────────────────────────

const RECORD_KEY = 'atlas:trial-readiness-review:v1';

// ─── localStorage access ──────────────────────────────────────────────────────

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // localStorage unavailable (e.g. private browsing with cookies blocked).
  }
  return null;
}

// ─── Schema validation ────────────────────────────────────────────────────────

function isValidSchema(parsed: unknown): parsed is PersistedTrialReadinessReviewV1 {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  return (
    obj['schemaVersion'] === TRIAL_READINESS_REVIEW_SCHEMA_VERSION &&
    typeof obj['generatedAt'] === 'string' &&
    typeof obj['updatedAt'] === 'string' &&
    Array.isArray(obj['reviewState'])
  );
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * LocalTrialReadinessReviewStorageAdapter
 *
 * Stores trial-readiness review snapshots in browser localStorage.
 *
 * Construct one instance and share it for the lifetime of the harness session.
 * All methods are async for interface consistency.
 */
export class LocalTrialReadinessReviewStorageAdapter
  implements TrialReadinessReviewStorageAdapterV1
{
  async saveReviewState(
    review: PersistedTrialReadinessReviewV1,
  ): Promise<TrialReadinessReviewSaveResult> {
    const storage = getStorage();
    if (!storage) {
      return { ok: false, reason: 'localStorage is not available in this browser context.' };
    }
    try {
      storage.setItem(RECORD_KEY, JSON.stringify(review));
      return { ok: true, savedAt: review.updatedAt };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Write failed: ${message}` };
    }
  }

  async loadReviewState(): Promise<TrialReadinessReviewLoadResult> {
    const storage = getStorage();
    if (!storage) {
      return {
        ok: false,
        notFound: false,
        reason: 'localStorage is not available in this browser context.',
      };
    }
    try {
      const raw = storage.getItem(RECORD_KEY);
      if (raw === null) {
        return { ok: false, notFound: true };
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isValidSchema(parsed)) {
        return {
          ok: false,
          notFound: false,
          reason: `Schema version mismatch or invalid record. Expected schemaVersion "${TRIAL_READINESS_REVIEW_SCHEMA_VERSION}".`,
        };
      }
      return { ok: true, snapshot: parsed };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, notFound: false, reason: `Read failed: ${message}` };
    }
  }

  async clearReviewState(): Promise<TrialReadinessReviewClearResult> {
    const storage = getStorage();
    if (!storage) {
      return { ok: false, reason: 'localStorage is not available in this browser context.' };
    }
    try {
      storage.removeItem(RECORD_KEY);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Clear failed: ${message}` };
    }
  }

  async exportReviewState(): Promise<TrialReadinessReviewExportResult> {
    const result = await this.loadReviewState();
    if (!result.ok) {
      if (result.notFound) {
        return { ok: false, reason: 'No saved review state found.' };
      }
      return { ok: false, reason: result.reason };
    }
    try {
      const json = JSON.stringify(result.snapshot, null, 2);
      return { ok: true, json };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Serialization failed: ${message}` };
    }
  }

  async importReviewState(json: string): Promise<TrialReadinessReviewImportResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, reason: 'Import failed: invalid JSON.' };
    }
    if (!isValidSchema(parsed)) {
      return {
        ok: false,
        reason: `Import failed: schema version mismatch or missing required fields. Expected schemaVersion "${TRIAL_READINESS_REVIEW_SCHEMA_VERSION}".`,
      };
    }
    const storage = getStorage();
    if (!storage) {
      return { ok: false, reason: 'localStorage is not available in this browser context.' };
    }
    try {
      storage.setItem(RECORD_KEY, JSON.stringify(parsed));
      return { ok: true, snapshot: parsed };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Write failed: ${message}` };
    }
  }
}

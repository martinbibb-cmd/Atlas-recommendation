/**
 * LocalTrialFeedbackStorageAdapter.ts
 *
 * Trial-feedback storage backed by browser localStorage.
 *
 * Storage key:
 *   atlas:trial-feedback:v1
 *
 * Dev-only — not used in production.
 */

import {
  TRIAL_FEEDBACK_SCHEMA_VERSION,
  type PersistedTrialFeedbackV1,
} from './PersistedTrialFeedbackV1';
import type {
  TrialFeedbackStorageAdapterV1,
  TrialFeedbackSaveResult,
  TrialFeedbackLoadResult,
  TrialFeedbackClearResult,
  TrialFeedbackExportResult,
  TrialFeedbackImportResult,
} from './TrialFeedbackStorageAdapterV1';

// ─── Storage key ──────────────────────────────────────────────────────────────

const RECORD_KEY = 'atlas:trial-feedback:v1';

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

function isValidSchema(parsed: unknown): parsed is PersistedTrialFeedbackV1 {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  return (
    obj['schemaVersion'] === TRIAL_FEEDBACK_SCHEMA_VERSION &&
    typeof obj['createdAt'] === 'string' &&
    typeof obj['updatedAt'] === 'string' &&
    Array.isArray(obj['entries'])
  );
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * LocalTrialFeedbackStorageAdapter
 *
 * Stores trial-feedback snapshots in browser localStorage.
 *
 * Construct one instance and share it for the lifetime of the harness session.
 * All methods are async for interface consistency.
 */
export class LocalTrialFeedbackStorageAdapter
  implements TrialFeedbackStorageAdapterV1
{
  async save(snapshot: PersistedTrialFeedbackV1): Promise<TrialFeedbackSaveResult> {
    const storage = getStorage();
    if (!storage) {
      return { ok: false, reason: 'localStorage is not available in this browser context.' };
    }
    try {
      storage.setItem(RECORD_KEY, JSON.stringify(snapshot));
      return { ok: true, savedAt: snapshot.updatedAt };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Write failed: ${message}` };
    }
  }

  async load(): Promise<TrialFeedbackLoadResult> {
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
          reason: `Schema version mismatch or invalid record. Expected schemaVersion "${TRIAL_FEEDBACK_SCHEMA_VERSION}".`,
        };
      }
      return { ok: true, snapshot: parsed };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, notFound: false, reason: `Read failed: ${message}` };
    }
  }

  async clear(): Promise<TrialFeedbackClearResult> {
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

  async exportJson(): Promise<TrialFeedbackExportResult> {
    const result = await this.load();
    if (!result.ok) {
      if (result.notFound) {
        return { ok: false, reason: 'No saved feedback found.' };
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

  async importJson(json: string): Promise<TrialFeedbackImportResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, reason: 'Import failed: invalid JSON.' };
    }
    if (!isValidSchema(parsed)) {
      return {
        ok: false,
        reason: `Import failed: schema version mismatch or missing required fields. Expected schemaVersion "${TRIAL_FEEDBACK_SCHEMA_VERSION}".`,
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

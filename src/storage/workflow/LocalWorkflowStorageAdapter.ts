/**
 * LocalWorkflowStorageAdapter.ts
 *
 * Implementation-workflow storage backed by browser localStorage.
 *
 * Clearly labelled: "Local to this browser/device."
 * Data does NOT leave the device unless the user explicitly exports it.
 *
 * Storage key pattern:
 *   atlas:workflow:v1:{visitReference}
 *
 * Index key (for listWorkflowStates):
 *   atlas:workflow:index:v1
 *
 * Limitations of localStorage:
 *   - ~5 MB quota per origin on most browsers.
 *   - Synchronous writes (no concurrency issues in single-tab use).
 *   - Data persists until the user clears browser storage or calls delete.
 *
 * Future upgrade path:
 *   Replace the `getStorage()` helper with an IndexedDB wrapper if payloads
 *   grow beyond localStorage limits.  The adapter interface stays the same.
 */

import {
  WORKFLOW_SCHEMA_VERSION,
  type PersistedImplementationWorkflowV1,
} from './PersistedImplementationWorkflowV1';
import type {
  WorkflowStorageAdapterV1,
  WorkflowStorageDeleteResult,
  WorkflowStorageExportResult,
  WorkflowStorageLoadResult,
  WorkflowStorageSaveResult,
  WorkflowStateListEntry,
} from './WorkflowStorageAdapterV1';

// ─── Storage key helpers ──────────────────────────────────────────────────────

const RECORD_KEY_PREFIX = 'atlas:workflow:v1:';
const INDEX_KEY = 'atlas:workflow:index:v1';

function recordKey(visitReference: string): string {
  return `${RECORD_KEY_PREFIX}${visitReference}`;
}

// ─── localStorage access ──────────────────────────────────────────────────────

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // localStorage unavailable (e.g. private browsing with cookies blocked).
  }
  return null;
}

// ─── Index helpers ────────────────────────────────────────────────────────────

interface IndexEntry {
  visitReference: string;
  updatedAt: string;
  label: string;
}

function readIndex(storage: Storage): IndexEntry[] {
  try {
    const raw = storage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as IndexEntry[];
  } catch {
    return [];
  }
}

function writeIndex(storage: Storage, entries: IndexEntry[]): void {
  try {
    storage.setItem(INDEX_KEY, JSON.stringify(entries));
  } catch {
    // best effort
  }
}

function upsertIndexEntry(storage: Storage, state: PersistedImplementationWorkflowV1): void {
  const entries = readIndex(storage);
  const label = state.packSnapshot.recommendedScenarioId;
  const next = entries.filter((e) => e.visitReference !== state.visitReference);
  next.push({ visitReference: state.visitReference, updatedAt: state.updatedAt, label });
  writeIndex(storage, next);
}

function removeIndexEntry(storage: Storage, visitReference: string): void {
  const entries = readIndex(storage).filter((e) => e.visitReference !== visitReference);
  writeIndex(storage, entries);
}

// ─── Schema validation ────────────────────────────────────────────────────────

function isValidSchema(parsed: unknown): parsed is PersistedImplementationWorkflowV1 {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  return obj['schemaVersion'] === WORKFLOW_SCHEMA_VERSION
    && typeof obj['visitReference'] === 'string'
    && typeof obj['updatedAt'] === 'string';
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * LocalWorkflowStorageAdapter
 *
 * Stores workflow state in browser localStorage.
 * Clearly labelled: "Local to this browser/device."
 *
 * Construct one instance and share it for the lifetime of the session.
 * All methods are async for interface consistency (no actual async I/O needed).
 */
export class LocalWorkflowStorageAdapter implements WorkflowStorageAdapterV1 {
  readonly target = 'local_only' as const;
  readonly label = 'Local to this browser/device.';

  async saveWorkflowState(state: PersistedImplementationWorkflowV1): Promise<WorkflowStorageSaveResult> {
    const storage = getStorage();
    if (!storage) {
      return { ok: false, reason: 'localStorage is not available in this browser context.' };
    }
    try {
      storage.setItem(recordKey(state.visitReference), JSON.stringify(state));
      upsertIndexEntry(storage, state);
      return { ok: true, savedAt: state.updatedAt };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Write failed: ${message}` };
    }
  }

  async loadWorkflowState(visitReference: string): Promise<WorkflowStorageLoadResult> {
    const storage = getStorage();
    if (!storage) {
      return { ok: false, notFound: false, reason: 'localStorage is not available in this browser context.' };
    }
    try {
      const raw = storage.getItem(recordKey(visitReference));
      if (raw === null) {
        return { ok: false, notFound: true };
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isValidSchema(parsed)) {
        return {
          ok: false,
          notFound: false,
          reason: `Schema version mismatch or invalid record. Expected schemaVersion "${WORKFLOW_SCHEMA_VERSION}".`,
        };
      }
      return { ok: true, state: parsed };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, notFound: false, reason: `Read failed: ${message}` };
    }
  }

  async deleteWorkflowState(visitReference: string): Promise<WorkflowStorageDeleteResult> {
    const storage = getStorage();
    if (!storage) {
      return { ok: false, reason: 'localStorage is not available in this browser context.' };
    }
    try {
      storage.removeItem(recordKey(visitReference));
      removeIndexEntry(storage, visitReference);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Delete failed: ${message}` };
    }
  }

  async listWorkflowStates(): Promise<readonly WorkflowStateListEntry[]> {
    const storage = getStorage();
    if (!storage) return [];
    return readIndex(storage);
  }

  async exportWorkflowState(visitReference: string): Promise<WorkflowStorageExportResult> {
    const result = await this.loadWorkflowState(visitReference);
    if (!result.ok) {
      if (result.notFound) {
        return { ok: false, reason: `No saved workflow found for visit reference "${visitReference}".` };
      }
      return { ok: false, reason: result.reason };
    }
    try {
      const json = JSON.stringify(result.state, null, 2);
      return { ok: true, json };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Serialization failed: ${message}` };
    }
  }

  async importWorkflowState(json: string): Promise<WorkflowStorageSaveResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, reason: 'Import failed: invalid JSON.' };
    }
    if (!isValidSchema(parsed)) {
      return {
        ok: false,
        reason: `Import failed: schema version mismatch or missing required fields. Expected schemaVersion "${WORKFLOW_SCHEMA_VERSION}".`,
      };
    }
    return this.saveWorkflowState(parsed);
  }
}

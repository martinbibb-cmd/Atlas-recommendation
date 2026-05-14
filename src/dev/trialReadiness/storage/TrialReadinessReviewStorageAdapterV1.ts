/**
 * TrialReadinessReviewStorageAdapterV1.ts
 *
 * Contract for pluggable trial-readiness review storage.
 *
 * The adapter boundary keeps the dev harness decoupled from the specific
 * storage mechanism.  The only concrete implementation is
 * LocalTrialReadinessReviewStorageAdapter (browser localStorage).
 *
 * Dev-only — not used in production.
 */

import type { PersistedTrialReadinessReviewV1 } from './PersistedTrialReadinessReviewV1';

// ─── Result types ─────────────────────────────────────────────────────────────

export type TrialReadinessReviewSaveResult =
  | { readonly ok: true; readonly savedAt: string }
  | { readonly ok: false; readonly reason: string };

export type TrialReadinessReviewLoadResult =
  | { readonly ok: true; readonly snapshot: PersistedTrialReadinessReviewV1 }
  | { readonly ok: false; readonly notFound: true }
  | { readonly ok: false; readonly notFound: false; readonly reason: string };

export type TrialReadinessReviewClearResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export type TrialReadinessReviewExportResult =
  | { readonly ok: true; readonly json: string }
  | { readonly ok: false; readonly reason: string };

export type TrialReadinessReviewImportResult =
  | { readonly ok: true; readonly snapshot: PersistedTrialReadinessReviewV1 }
  | { readonly ok: false; readonly reason: string };

// ─── Adapter contract ─────────────────────────────────────────────────────────

/**
 * TrialReadinessReviewStorageAdapterV1
 *
 * All methods are async for interface consistency (no actual async I/O needed
 * for the local adapter).
 *
 * Implementors must never throw — all errors are returned in the result types.
 */
export interface TrialReadinessReviewStorageAdapterV1 {
  /**
   * Write the full review snapshot to storage.
   */
  saveReviewState(
    review: PersistedTrialReadinessReviewV1,
  ): Promise<TrialReadinessReviewSaveResult>;

  /**
   * Load the most recently persisted review snapshot.
   *
   * Returns `{ ok: false, notFound: true }` when no record exists.
   * Returns `{ ok: false, notFound: false, reason }` on a read/parse error.
   */
  loadReviewState(): Promise<TrialReadinessReviewLoadResult>;

  /**
   * Remove the stored review snapshot.
   */
  clearReviewState(): Promise<TrialReadinessReviewClearResult>;

  /**
   * Serialise the stored review snapshot to a portable JSON string.
   */
  exportReviewState(): Promise<TrialReadinessReviewExportResult>;

  /**
   * Parse and store a review snapshot from a portable JSON string.
   *
   * Validates the schema version before writing.
   */
  importReviewState(json: string): Promise<TrialReadinessReviewImportResult>;
}

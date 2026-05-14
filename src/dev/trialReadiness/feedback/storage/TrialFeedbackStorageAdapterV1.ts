/**
 * TrialFeedbackStorageAdapterV1.ts
 *
 * Contract for pluggable trial-feedback storage.
 *
 * Dev-only — not used in production.
 */

import type { PersistedTrialFeedbackV1 } from './PersistedTrialFeedbackV1';

// ─── Result types ─────────────────────────────────────────────────────────────

export type TrialFeedbackSaveResult =
  | { readonly ok: true; readonly savedAt: string }
  | { readonly ok: false; readonly reason: string };

export type TrialFeedbackLoadResult =
  | { readonly ok: true; readonly snapshot: PersistedTrialFeedbackV1 }
  | { readonly ok: false; readonly notFound: true }
  | { readonly ok: false; readonly notFound: false; readonly reason: string };

export type TrialFeedbackClearResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export type TrialFeedbackExportResult =
  | { readonly ok: true; readonly json: string }
  | { readonly ok: false; readonly reason: string };

export type TrialFeedbackImportResult =
  | { readonly ok: true; readonly snapshot: PersistedTrialFeedbackV1 }
  | { readonly ok: false; readonly reason: string };

// ─── Adapter contract ─────────────────────────────────────────────────────────

/**
 * TrialFeedbackStorageAdapterV1
 *
 * All methods are async for interface consistency.
 * Implementors must never throw — all errors are returned in the result types.
 */
export interface TrialFeedbackStorageAdapterV1 {
  save(snapshot: PersistedTrialFeedbackV1): Promise<TrialFeedbackSaveResult>;
  load(): Promise<TrialFeedbackLoadResult>;
  clear(): Promise<TrialFeedbackClearResult>;
  exportJson(): Promise<TrialFeedbackExportResult>;
  importJson(json: string): Promise<TrialFeedbackImportResult>;
}

/**
 * PersistedTrialFeedbackV1.ts
 *
 * Snapshot model for trial-feedback entries persisted to localStorage.
 *
 * Storage key:
 *   atlas:trial-feedback:v1
 *
 * Dev-only — not used in production.
 */

import type { TrialFeedbackEntryV1 } from '../TrialFeedbackEntryV1';

// ─── Schema version ───────────────────────────────────────────────────────────

export const TRIAL_FEEDBACK_SCHEMA_VERSION = '1.0' as const;
export type TrialFeedbackSchemaVersion = typeof TRIAL_FEEDBACK_SCHEMA_VERSION;

// ─── Snapshot ─────────────────────────────────────────────────────────────────

/**
 * PersistedTrialFeedbackV1
 *
 * Full collection of feedback entries written by the local adapter.
 */
export interface PersistedTrialFeedbackV1 {
  readonly schemaVersion: TrialFeedbackSchemaVersion;
  /** ISO 8601 timestamp when this collection was first created. */
  readonly createdAt: string;
  /** ISO 8601 timestamp when this record was last written. */
  readonly updatedAt: string;
  /** All captured feedback entries. */
  readonly entries: readonly TrialFeedbackEntryV1[];
}

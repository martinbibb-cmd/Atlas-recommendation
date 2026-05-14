/**
 * PersistedTrialReadinessReviewV1.ts
 *
 * Snapshot model written to localStorage when trial-readiness review state is
 * saved by the local adapter.
 *
 * Contains the full review state (per-action status and notes) along with
 * lightweight metadata so the record can be validated and identified on reload.
 *
 * Storage key:
 *   atlas:trial-readiness-review:v1
 *
 * Dev-only — not used in production.
 */

import type { TrialReadinessActionReviewStateV1 } from '../trialReadinessReviewState';

// ─── Schema version ───────────────────────────────────────────────────────────

export const TRIAL_READINESS_REVIEW_SCHEMA_VERSION = '1.0' as const;
export type TrialReadinessReviewSchemaVersion =
  typeof TRIAL_READINESS_REVIEW_SCHEMA_VERSION;

// ─── Snapshot ─────────────────────────────────────────────────────────────────

/**
 * PersistedTrialReadinessReviewV1
 *
 * The full trial-readiness review snapshot persisted by the local adapter.
 *
 * `reviewState` carries per-action status and reviewer notes.
 * `generatedAt` records when the review session was opened.
 * `updatedAt` records the last time the record was written.
 * `workspaceId` is optional metadata; the storage key is not scoped by it.
 */
export interface PersistedTrialReadinessReviewV1 {
  readonly schemaVersion: TrialReadinessReviewSchemaVersion;
  /** Optional workspace context recorded as metadata only. */
  readonly workspaceId?: string;
  /** ISO 8601 timestamp — when this review session was first created. */
  readonly generatedAt: string;
  /** Per-action review state entries. */
  readonly reviewState: readonly TrialReadinessActionReviewStateV1[];
  /** ISO 8601 timestamp — when this record was last written. */
  readonly updatedAt: string;
}

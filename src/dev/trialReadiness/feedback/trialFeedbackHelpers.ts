/**
 * trialFeedbackHelpers.ts
 *
 * Non-component helpers for trial feedback capture.
 *
 * Dev-only — not used in production.
 */

import type { TrialFeedbackEntryV1 } from './TrialFeedbackEntryV1';
import {
  TRIAL_FEEDBACK_SCHEMA_VERSION,
  type PersistedTrialFeedbackV1,
} from './storage/PersistedTrialFeedbackV1';

/**
 * buildTrialFeedbackSnapshot
 *
 * Builds a PersistedTrialFeedbackV1 from the current list of entries,
 * preserving createdAt from an existing snapshot when available.
 */
export function buildTrialFeedbackSnapshot(
  entries: readonly TrialFeedbackEntryV1[],
  existing: PersistedTrialFeedbackV1 | null,
): PersistedTrialFeedbackV1 {
  const now = new Date().toISOString();
  return {
    schemaVersion: TRIAL_FEEDBACK_SCHEMA_VERSION,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    entries,
  };
}

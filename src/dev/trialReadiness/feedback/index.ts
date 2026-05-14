/**
 * src/dev/trialReadiness/feedback/index.ts
 *
 * Public API for the trial-feedback capture boundary.
 *
 * Dev-only — not used in production.
 */

export type {
  TrialFeedbackTesterTypeV1,
  TrialFeedbackAreaV1,
  TrialFeedbackSeverityV1,
  TrialFeedbackStatusV1,
  TrialFeedbackEntryV1,
} from './TrialFeedbackEntryV1';

export { buildTrialFeedbackSummary } from './buildTrialFeedbackSummary';
export type { TrialFeedbackSummaryV1 } from './buildTrialFeedbackSummary';

export { buildTrialFeedbackSnapshot } from './trialFeedbackHelpers';
export {
  TRIAL_FEEDBACK_SCHEMA_VERSION,
  LocalTrialFeedbackStorageAdapter,
} from './storage';
export type {
  TrialFeedbackSchemaVersion,
  PersistedTrialFeedbackV1,
  TrialFeedbackSaveResult,
  TrialFeedbackLoadResult,
  TrialFeedbackClearResult,
  TrialFeedbackExportResult,
  TrialFeedbackImportResult,
  TrialFeedbackStorageAdapterV1,
} from './storage';

/**
 * src/dev/trialReadiness/feedback/storage/index.ts
 *
 * Public API for the trial-feedback storage adapter boundary.
 *
 * Dev-only — not used in production.
 */

export { TRIAL_FEEDBACK_SCHEMA_VERSION } from './PersistedTrialFeedbackV1';
export type {
  TrialFeedbackSchemaVersion,
  PersistedTrialFeedbackV1,
} from './PersistedTrialFeedbackV1';

export type {
  TrialFeedbackSaveResult,
  TrialFeedbackLoadResult,
  TrialFeedbackClearResult,
  TrialFeedbackExportResult,
  TrialFeedbackImportResult,
  TrialFeedbackStorageAdapterV1,
} from './TrialFeedbackStorageAdapterV1';

export { LocalTrialFeedbackStorageAdapter } from './LocalTrialFeedbackStorageAdapter';

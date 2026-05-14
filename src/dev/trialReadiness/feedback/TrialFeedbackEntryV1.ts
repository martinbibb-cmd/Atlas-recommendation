/**
 * TrialFeedbackEntryV1.ts
 *
 * Structured feedback captured from first testers during the limited trial.
 *
 * Dev-only — no production feedback form, no analytics backend, no personal
 * data required.
 */

// ─── Enum types ───────────────────────────────────────────────────────────────

export type TrialFeedbackTesterTypeV1 =
  | 'internal'
  | 'friendly_installer'
  | 'friendly_customer';

export type TrialFeedbackAreaV1 =
  | 'portal'
  | 'pdf'
  | 'implementation_workflow'
  | 'scan_handoff'
  | 'workspace'
  | 'general';

export type TrialFeedbackSeverityV1 =
  | 'blocker'
  | 'confusing'
  | 'polish'
  | 'positive';

export type TrialFeedbackStatusV1 =
  | 'new'
  | 'triaged'
  | 'accepted'
  | 'fixed'
  | 'rejected';

// ─── Entry ────────────────────────────────────────────────────────────────────

/**
 * TrialFeedbackEntryV1
 *
 * One piece of structured feedback from a first tester against the limited
 * trial plan.  No customer personal data is stored here — testerType captures
 * the cohort category only.
 */
export interface TrialFeedbackEntryV1 {
  /** Stable unique identifier for this feedback entry, e.g. "fb-001". */
  readonly feedbackId: string;
  /** Which trial scenario this feedback relates to (matches a scenario id). */
  readonly scenarioId: string;
  /** Cohort category of the tester who raised this item. */
  readonly testerType: TrialFeedbackTesterTypeV1;
  /** ISO 8601 timestamp when the feedback was recorded. */
  readonly submittedAt: string;
  /** Product area the feedback relates to. */
  readonly area: TrialFeedbackAreaV1;
  /** Severity / classification of the feedback. */
  readonly severity: TrialFeedbackSeverityV1;
  /** One-line summary of the issue or observation. */
  readonly summary: string;
  /** Optional extended description. */
  readonly details?: string;
  /** IDs of limited-trial-plan items this feedback relates to. */
  readonly relatedTrialPlanItemIds: readonly string[];
  /** Optional next action to take for this feedback item. */
  readonly followUpAction?: string;
  /** Current triage status. */
  readonly status: TrialFeedbackStatusV1;
}

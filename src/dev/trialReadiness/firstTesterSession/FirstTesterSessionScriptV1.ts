/**
 * FirstTesterSessionScriptV1.ts
 *
 * Typed schema for the first tester session script.
 *
 * Produced by buildFirstTesterSessionScript from a LimitedTrialPlanV1 and
 * TrialReadinessSummaryV1.  Dev-only — not rendered in production.
 */

import type { TrialFeedbackTesterTypeV1 } from '../feedback/TrialFeedbackEntryV1';
import type { TrialReadinessOverallRecommendationV1 } from '../buildTrialReadinessSummary';

// ─── Per-tester script ────────────────────────────────────────────────────────

export interface TesterSessionScriptV1 {
  readonly testerType: TrialFeedbackTesterTypeV1;
  readonly preSessionSetup: readonly string[];
  readonly testerIntro: readonly string[];
  readonly scenarioToRun: readonly string[];
  readonly observationChecklist: readonly string[];
  readonly tasksForTester: readonly string[];
  readonly promptsToAsk: readonly string[];
  readonly successSignals: readonly string[];
  readonly stopSignals: readonly string[];
  readonly feedbackCaptureReminder: readonly string[];
  readonly postSessionActions: readonly string[];
}

// ─── Aggregate script ─────────────────────────────────────────────────────────

export interface FirstTesterSessionScriptV1 {
  readonly generatedAt: string;
  readonly trialRecommendation: TrialReadinessOverallRecommendationV1;
  /**
   * Per-tester scripts.  Each entry is null when the tester type is excluded
   * from the current trial (e.g. all are null when trialRecommendation is
   * 'not_ready').
   */
  readonly scripts: {
    readonly internal: TesterSessionScriptV1 | null;
    readonly friendly_installer: TesterSessionScriptV1 | null;
    readonly friendly_customer: TesterSessionScriptV1 | null;
  };
}

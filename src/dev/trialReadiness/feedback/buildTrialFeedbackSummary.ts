/**
 * buildTrialFeedbackSummary.ts
 *
 * Aggregates a list of TrialFeedbackEntryV1 items against the limited trial
 * plan to produce a structured summary of trial health.
 *
 * Dev-only — not used in production.
 */

import type { LimitedTrialPlanV1 } from '../buildLimitedTrialPlan';
import type { TrialFeedbackEntryV1 } from './TrialFeedbackEntryV1';

// ─── Output type ──────────────────────────────────────────────────────────────

/**
 * TrialFeedbackSummaryV1
 *
 * Aggregated view of trial feedback suitable for quick triage.
 */
export interface TrialFeedbackSummaryV1 {
  /** Total number of open blocker-severity items. */
  readonly blockerCount: number;
  /**
   * De-duplicated list of area+summary themes from 'confusing' feedback,
   * sorted by frequency (most common first).
   */
  readonly confusionThemes: readonly string[];
  /**
   * De-duplicated list of area+summary themes from 'positive' feedback,
   * sorted by frequency (most common first).
   */
  readonly positiveSignals: readonly string[];
  /**
   * Suggested fix targets: one entry per unresolved blocker/confusing item,
   * formatted as "<area>: <summary>".
   */
  readonly recommendedFixes: readonly string[];
  /**
   * True when any open blocker is present (mirrors a limited-trial-plan stop
   * criterion: "Any release-gate blocker appears in trial usage").
   */
  readonly stopCriteriaTriggered: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOpen(entry: TrialFeedbackEntryV1): boolean {
  return entry.status === 'new' || entry.status === 'triaged';
}

function themeKey(entry: TrialFeedbackEntryV1): string {
  return `${entry.area}: ${entry.summary}`;
}

function sortedByFrequency(items: readonly string[]): string[] {
  const freq = new Map<string, number>();
  for (const item of items) {
    freq.set(item, (freq.get(item) ?? 0) + 1);
  }
  return Array.from(new Set(items)).sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0));
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * buildTrialFeedbackSummary
 *
 * Aggregates feedback entries against the limited trial plan.
 *
 * The `limitedTrialPlan` parameter is reserved for future stop-criteria
 * expansion (e.g. matching against plan stopCriteria strings).
 */
export function buildTrialFeedbackSummary(
  feedbackEntries: readonly TrialFeedbackEntryV1[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _limitedTrialPlan: LimitedTrialPlanV1,
): TrialFeedbackSummaryV1 {
  const openBlockers = feedbackEntries.filter(
    (entry) => entry.severity === 'blocker' && isOpen(entry),
  );

  const confusingEntries = feedbackEntries.filter(
    (entry) => entry.severity === 'confusing',
  );

  const positiveEntries = feedbackEntries.filter(
    (entry) => entry.severity === 'positive',
  );

  const needsFix = feedbackEntries.filter(
    (entry) =>
      (entry.severity === 'blocker' || entry.severity === 'confusing') &&
      isOpen(entry),
  );

  return {
    blockerCount: openBlockers.length,
    confusionThemes: sortedByFrequency(confusingEntries.map(themeKey)),
    positiveSignals: sortedByFrequency(positiveEntries.map(themeKey)),
    recommendedFixes: needsFix.map(themeKey),
    stopCriteriaTriggered: openBlockers.length > 0,
  };
}

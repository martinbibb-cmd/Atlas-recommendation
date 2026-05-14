/**
 * buildTrialFeedbackSummary.test.ts
 *
 * Tests for buildTrialFeedbackSummary.
 *
 * Coverage:
 *   1. blocker feedback triggers stopCriteriaTriggered
 *   2. confusing feedback aggregates themes
 *   3. positive feedback aggregates separately
 *   4. resolved blockers do not trigger stopCriteriaTriggered
 *   5. no customer personal data required (empty entries are valid)
 */

import { describe, expect, it } from 'vitest';
import type { TrialFeedbackEntryV1 } from '../TrialFeedbackEntryV1';
import type { LimitedTrialPlanV1 } from '../../buildLimitedTrialPlan';
import { buildTrialFeedbackSummary } from '../buildTrialFeedbackSummary';

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<TrialFeedbackEntryV1> = {}): TrialFeedbackEntryV1 {
  return {
    feedbackId: 'fb-001',
    scenarioId: 'workspace_owned_visit',
    testerType: 'internal',
    submittedAt: '2026-05-14T10:00:00.000Z',
    area: 'portal',
    severity: 'polish',
    summary: 'Minor layout issue',
    relatedTrialPlanItemIds: [],
    status: 'new',
    ...overrides,
  };
}

function makePlan(overrides: Partial<LimitedTrialPlanV1> = {}): LimitedTrialPlanV1 {
  return {
    trialRecommendation: 'ready_for_limited_trial',
    suggestedTesterCount: '3-5',
    eligibleScenarios: ['Workspace-owned visit'],
    excludedScenarios: [],
    requiredPreTrialChecks: [],
    duringTrialChecklist: [],
    rollbackPlan: [],
    feedbackQuestions: [],
    successCriteria: [],
    stopCriteria: ['Any release-gate blocker appears in trial usage.'],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildTrialFeedbackSummary', () => {
  it('blocker feedback triggers stopCriteriaTriggered', () => {
    const entries = [
      makeEntry({ feedbackId: 'fb-001', severity: 'blocker', area: 'portal', summary: 'Portal crashes on save', status: 'new' }),
    ];
    const summary = buildTrialFeedbackSummary(entries, makePlan());

    expect(summary.blockerCount).toBe(1);
    expect(summary.stopCriteriaTriggered).toBe(true);
    expect(summary.recommendedFixes).toContain('portal: Portal crashes on save');
  });

  it('confusing feedback aggregates themes', () => {
    const entries = [
      makeEntry({ feedbackId: 'fb-002', severity: 'confusing', area: 'pdf', summary: 'PDF layout unclear', status: 'new' }),
      makeEntry({ feedbackId: 'fb-003', severity: 'confusing', area: 'pdf', summary: 'PDF layout unclear', status: 'triaged' }),
      makeEntry({ feedbackId: 'fb-004', severity: 'confusing', area: 'workspace', summary: 'Settings page confusing', status: 'new' }),
    ];
    const summary = buildTrialFeedbackSummary(entries, makePlan());

    expect(summary.confusionThemes).toContain('pdf: PDF layout unclear');
    expect(summary.confusionThemes).toContain('workspace: Settings page confusing');
    // Most frequent first
    expect(summary.confusionThemes[0]).toBe('pdf: PDF layout unclear');
    expect(summary.stopCriteriaTriggered).toBe(false);
  });

  it('positive feedback aggregates separately', () => {
    const entries = [
      makeEntry({ feedbackId: 'fb-005', severity: 'positive', area: 'portal', summary: 'Recommendation was clear', status: 'new' }),
      makeEntry({ feedbackId: 'fb-006', severity: 'positive', area: 'pdf', summary: 'PDF looked professional', status: 'new' }),
      makeEntry({ feedbackId: 'fb-007', severity: 'confusing', area: 'workspace', summary: 'Confusing nav', status: 'new' }),
    ];
    const summary = buildTrialFeedbackSummary(entries, makePlan());

    expect(summary.positiveSignals).toContain('portal: Recommendation was clear');
    expect(summary.positiveSignals).toContain('pdf: PDF looked professional');
    expect(summary.positiveSignals).not.toContain('workspace: Confusing nav');
    expect(summary.confusionThemes).toContain('workspace: Confusing nav');
    expect(summary.stopCriteriaTriggered).toBe(false);
  });

  it('resolved blockers do not trigger stopCriteriaTriggered', () => {
    const entries = [
      makeEntry({ feedbackId: 'fb-008', severity: 'blocker', status: 'fixed', summary: 'Fixed blocker' }),
      makeEntry({ feedbackId: 'fb-009', severity: 'blocker', status: 'rejected', summary: 'Rejected blocker' }),
    ];
    const summary = buildTrialFeedbackSummary(entries, makePlan());

    expect(summary.blockerCount).toBe(0);
    expect(summary.stopCriteriaTriggered).toBe(false);
  });

  it('no customer personal data required — empty entries are valid', () => {
    const summary = buildTrialFeedbackSummary([], makePlan());

    expect(summary.blockerCount).toBe(0);
    expect(summary.stopCriteriaTriggered).toBe(false);
    expect(summary.confusionThemes).toHaveLength(0);
    expect(summary.positiveSignals).toHaveLength(0);
    expect(summary.recommendedFixes).toHaveLength(0);
  });
});

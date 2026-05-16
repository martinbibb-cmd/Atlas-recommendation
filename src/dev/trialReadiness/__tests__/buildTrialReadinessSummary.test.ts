import { describe, expect, it } from 'vitest';
import type { WorkspaceLifecycleReleaseReportV1 } from '../../workspaceQa/buildWorkspaceLifecycleReleaseReport';
import type { TrialReadinessActionV1 } from '../TrialReadinessActionV1';
import { buildTrialReadinessSummary } from '../buildTrialReadinessSummary';
import type { TrialFeedbackSummaryV1 } from '../feedback';

function makeReport(overrides: Partial<WorkspaceLifecycleReleaseReportV1> = {}): WorkspaceLifecycleReleaseReportV1 {
  return {
    generatedAt: '2026-05-14T00:00:00.000Z',
    overallStatus: 'pass',
    scenarioResults: [],
    blockingIssues: [],
    warnings: [],
    recommendedNextActions: [],
    trialReadiness: {
      customerPortal: 'pass',
      supportingPdf: 'pass',
      implementationWorkflow: 'pass',
      workspaceOwnership: 'pass',
      storageExport: 'pass',
      scanFollowUp: 'pass',
    },
    ...overrides,
  };
}

function makeAction(overrides: Partial<TrialReadinessActionV1> = {}): TrialReadinessActionV1 {
  return {
    actionId: 'action-1',
    title: 'Resolve action',
    area: 'workspace',
    priority: 'high',
    source: 'manual_review',
    status: 'open',
    ...overrides,
  };
}

function makeFeedbackSummary(overrides: Partial<TrialFeedbackSummaryV1> = {}): TrialFeedbackSummaryV1 {
  return {
    blockerCount: 0,
    confusionThemes: [],
    positiveSignals: [],
    recommendedFixes: [],
    stopCriteriaTriggered: false,
    ...overrides,
  };
}

describe('buildTrialReadinessSummary', () => {
  it('blocker open => not_ready', () => {
    const summary = buildTrialReadinessSummary({
      releaseGateReport: makeReport(),
      trialReadinessActions: [
        makeAction({
          actionId: 'blocker-1',
          title: 'Fix blocker before trial',
          priority: 'blocker',
          status: 'open',
        }),
      ],
    });

    expect(summary.overallRecommendation).toBe('not_ready');
  });

  it('accepted Google Drive gap => ready_with_known_risks', () => {
    const summary = buildTrialReadinessSummary({
      releaseGateReport: makeReport({
        overallStatus: 'warn',
        warnings: ['Google Drive integration is not configured; local-only export remains the trial fallback.'],
      }),
      trialReadinessActions: [
        makeAction({
          actionId: 'storage-google-drive-known-gap',
          title: 'accept Google Drive integration gap for trial and use local-only export fallback',
          area: 'storage',
          priority: 'low',
          source: 'known_gap',
          status: 'accepted_risk',
        }),
      ],
    });

    expect(summary.overallRecommendation).toBe('ready_with_known_risks');
  });

  it('all critical actions done => ready_for_limited_trial', () => {
    const summary = buildTrialReadinessSummary({
      releaseGateReport: makeReport(),
      trialReadinessActions: [
        makeAction({
          actionId: 'critical-1',
          title: 'Complete high-priority evidence',
          priority: 'high',
          status: 'done',
        }),
        makeAction({
          actionId: 'blocker-1',
          title: 'Close blocker',
          priority: 'blocker',
          status: 'done',
        }),
        makeAction({
          actionId: 'low-1',
          title: 'Follow-up polish task',
          priority: 'low',
          status: 'open',
        }),
      ],
    });

    expect(summary.overallRecommendation).toBe('ready_for_limited_trial');
  });

  it('summary excludes customer payload keys', () => {
    const summary = buildTrialReadinessSummary({
      releaseGateReport: makeReport(),
      trialReadinessActions: [makeAction({ status: 'done' })],
    });
    const serialized = JSON.stringify(summary);

    expect(serialized.includes('"visit"')).toBe(false);
    expect(serialized.includes('"workflowState"')).toBe(false);
    expect(serialized.includes('"customerPayload"')).toBe(false);
  });

  it('open blocker feedback forces recommendation to not_ready', () => {
    const summary = buildTrialReadinessSummary({
      releaseGateReport: makeReport(),
      trialReadinessActions: [makeAction({ status: 'done' })],
      trialFeedbackSummary: makeFeedbackSummary({
        blockerCount: 1,
        stopCriteriaTriggered: true,
      }),
    });

    expect(summary.overallRecommendation).toBe('not_ready');
    expect(summary.blockers.some((entry) => entry.includes('Open trial feedback blockers: 1'))).toBe(true);
  });

  it('confusing feedback adds a recommended before-trial fix', () => {
    const summary = buildTrialReadinessSummary({
      releaseGateReport: makeReport(),
      trialReadinessActions: [makeAction({ status: 'done' })],
      trialFeedbackSummary: makeFeedbackSummary({
        confusionThemes: ['recommendation_clarity: ambiguous wording'],
        recommendedFixes: ['recommendation_clarity: ambiguous wording'],
      }),
    });

    expect(
      summary.recommendedBeforeTrial.some((entry) => entry.includes('recommendation_clarity: ambiguous wording')),
    ).toBe(true);
  });

  it('positive feedback adds monitoring guidance but does not block trial', () => {
    const summary = buildTrialReadinessSummary({
      releaseGateReport: makeReport(),
      trialReadinessActions: [
        makeAction({
          actionId: 'critical-1',
          title: 'Complete high-priority evidence',
          priority: 'high',
          status: 'done',
        }),
        makeAction({
          actionId: 'blocker-1',
          title: 'Close blocker',
          priority: 'blocker',
          status: 'done',
        }),
      ],
      trialFeedbackSummary: makeFeedbackSummary({
        positiveSignals: ['recommendation_clarity: easy to follow'],
      }),
    });

    expect(summary.overallRecommendation).toBe('ready_for_limited_trial');
    expect(
      summary.recommendedDuringTrial.some((entry) => entry.includes('recommendation_clarity: easy to follow')),
    ).toBe(true);
  });
});

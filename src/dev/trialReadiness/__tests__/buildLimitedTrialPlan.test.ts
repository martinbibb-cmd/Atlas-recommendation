import { describe, expect, it } from 'vitest';
import type { WorkspaceLifecycleReleaseReportV1 } from '../../workspaceQa/buildWorkspaceLifecycleReleaseReport';
import type { WorkspaceVisitLifecycleScenarioV1 } from '../../workspaceQa/WorkspaceVisitLifecycleScenarioV1';
import type { TrialReadinessActionV1 } from '../TrialReadinessActionV1';
import type { TrialReadinessSummaryV1 } from '../buildTrialReadinessSummary';
import { buildLimitedTrialPlan } from '../buildLimitedTrialPlan';

function makeReport(overrides: Partial<WorkspaceLifecycleReleaseReportV1> = {}): WorkspaceLifecycleReleaseReportV1 {
  return {
    generatedAt: '2026-05-14T00:00:00.000Z',
    overallStatus: 'pass',
    scenarioResults: [
      { scenarioId: 'workspace_owned_visit', label: 'Workspace-owned visit', status: 'pass', blockingIssues: [], warnings: [] },
      { scenarioId: 'open_vented_conversion', label: 'Open-vented conversion', status: 'pass', blockingIssues: [], warnings: [] },
      { scenarioId: 'heat_pump_path', label: 'Heat pump path', status: 'pass', blockingIssues: [], warnings: [] },
    ],
    blockingIssues: [],
    warnings: [],
    recommendedNextActions: [],
    trialReadiness: {
      customerPortal: 'pass',
      implementationWorkflow: 'pass',
      workspaceOwnership: 'pass',
      storageExport: 'pass',
      scanFollowUp: 'pass',
    },
    ...overrides,
  };
}

function makeSummary(overrides: Partial<TrialReadinessSummaryV1> = {}): TrialReadinessSummaryV1 {
  return {
    overallRecommendation: 'ready_for_limited_trial',
    plainEnglishSummary: 'Ready for limited trial.',
    blockers: [],
    acceptedRisks: [],
    recommendedBeforeTrial: ['verify workspace create/join flow'],
    recommendedDuringTrial: ['Track warning during trial: none'],
    doNotTestYet: [],
    evidenceLinks: ['release-gate-report.json'],
    ...overrides,
  };
}

function makeAction(overrides: Partial<TrialReadinessActionV1> = {}): TrialReadinessActionV1 {
  return {
    actionId: 'portal-supporting-pdf-print-output',
    title: 'verify supporting PDF print output',
    area: 'portal',
    priority: 'medium',
    source: 'manual_review',
    status: 'done',
    ...overrides,
  };
}

function makeScenarios(): readonly WorkspaceVisitLifecycleScenarioV1[] {
  return [
    { id: 'workspace_owned_visit', label: 'Workspace-owned visit' },
    { id: 'open_vented_conversion', label: 'Open-vented conversion' },
    { id: 'heat_pump_path', label: 'Heat pump path' },
  ] as readonly WorkspaceVisitLifecycleScenarioV1[];
}

describe('buildLimitedTrialPlan', () => {
  it('not_ready recommends 0 testers', () => {
    const plan = buildLimitedTrialPlan({
      releaseGateReport: makeReport({ overallStatus: 'fail' }),
      trialReadinessSummary: makeSummary({ overallRecommendation: 'not_ready' }),
      trialReadinessActions: [makeAction()],
      workspaceLifecycleScenarios: makeScenarios(),
    });

    expect(plan.suggestedTesterCount).toBe(0);
  });

  it('ready_with_known_risks limits to friendly testers', () => {
    const plan = buildLimitedTrialPlan({
      releaseGateReport: makeReport({ overallStatus: 'warn' }),
      trialReadinessSummary: makeSummary({ overallRecommendation: 'ready_with_known_risks' }),
      trialReadinessActions: [makeAction({ status: 'accepted_risk' })],
      workspaceLifecycleScenarios: makeScenarios(),
    });

    expect(plan.suggestedTesterCount).toBe('1-2');
    expect(plan.duringTrialChecklist.some((entry) => entry.toLowerCase().includes('internal/friendly'))).toBe(true);
  });

  it('ready_for_limited_trial allows 3-5 testers', () => {
    const plan = buildLimitedTrialPlan({
      releaseGateReport: makeReport({ overallStatus: 'pass' }),
      trialReadinessSummary: makeSummary({ overallRecommendation: 'ready_for_limited_trial' }),
      trialReadinessActions: [makeAction()],
      workspaceLifecycleScenarios: makeScenarios(),
    });

    expect(plan.suggestedTesterCount).toBe('3-5');
  });

  it('failing scenarios are excluded', () => {
    const plan = buildLimitedTrialPlan({
      releaseGateReport: makeReport({
        scenarioResults: [
          { scenarioId: 'workspace_owned_visit', label: 'Workspace-owned visit', status: 'pass', blockingIssues: [], warnings: [] },
          { scenarioId: 'heat_pump_path', label: 'Heat pump path', status: 'fail', blockingIssues: ['fail'], warnings: [] },
        ],
      }),
      trialReadinessSummary: makeSummary(),
      trialReadinessActions: [makeAction()],
      workspaceLifecycleScenarios: makeScenarios(),
    });

    expect(plan.excludedScenarios.some((entry) => entry.includes('Heat pump path') && entry.includes('release-gate fail'))).toBe(true);
    expect(plan.eligibleScenarios).toEqual(['Workspace-owned visit']);
  });

  it('stop criteria are always included', () => {
    const plan = buildLimitedTrialPlan({
      releaseGateReport: makeReport({ overallStatus: 'pass' }),
      trialReadinessSummary: makeSummary({ overallRecommendation: 'ready_for_limited_trial' }),
      trialReadinessActions: [makeAction()],
      workspaceLifecycleScenarios: makeScenarios(),
    });

    expect(plan.stopCriteria.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import type { WorkspaceLifecycleReleaseReportV1 } from '../../workspaceQa/buildWorkspaceLifecycleReleaseReport';
import { buildTrialReadinessActions } from '../buildTrialReadinessActions';

function makeReport(overrides: Partial<WorkspaceLifecycleReleaseReportV1> = {}): WorkspaceLifecycleReleaseReportV1 {
  return {
    generatedAt: '2026-05-13T20:22:09.721Z',
    overallStatus: 'pass',
    scenarioResults: [],
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

describe('buildTrialReadinessActions', () => {
  it('release-gate fail creates blocker action', () => {
    const actions = buildTrialReadinessActions(
      makeReport({
        blockingIssues: ['Workspace-owned visit: Workspace ownership failed.'],
      }),
      { hasFailures: false },
    );

    expect(actions.some((action) => action.priority === 'blocker' && action.source === 'release_gate')).toBe(true);
  });

  it('lint failure creates test_quality action', () => {
    const actions = buildTrialReadinessActions(makeReport(), { hasFailures: true, failureCount: 212 });
    const lintAction = actions.find((action) => action.actionId === 'lint-clean-remaining-repo-wide-failures');

    expect(lintAction).toBeTruthy();
    expect(lintAction?.area).toBe('test_quality');
    expect(lintAction?.source).toBe('lint');
  });

  it('Google Drive missing becomes accepted warning known gap, not blocker', () => {
    const actions = buildTrialReadinessActions(
      makeReport({
        warnings: ['Google Drive missing: Google Drive integration is not configured; local-only export remains the trial fallback.'],
      }),
      { hasFailures: false },
    );

    const googleDriveGap = actions.find((action) => action.actionId === 'storage-google-drive-known-gap');
    expect(googleDriveGap).toBeTruthy();
    expect(googleDriveGap?.status).toBe('accepted_risk');
    expect(googleDriveGap?.source).toBe('known_gap');
    expect(googleDriveGap?.priority).not.toBe('blocker');
  });

  it('actions sort by priority', () => {
    const actions = buildTrialReadinessActions(
      makeReport({
        blockingIssues: ['Open-vented conversion: Export/import round-trip failed or lost required metadata.'],
      }),
      { hasFailures: true },
    );

    const priorities = actions.map((action) => action.priority);
    expect(priorities[0]).toBe('blocker');
    const firstLowIndex = priorities.indexOf('low');
    const firstMediumIndex = priorities.indexOf('medium');
    const firstHighIndex = priorities.indexOf('high');

    if (firstLowIndex !== -1 && firstMediumIndex !== -1) {
      expect(firstLowIndex).toBeGreaterThan(firstMediumIndex);
    }
    if (firstMediumIndex !== -1 && firstHighIndex !== -1) {
      expect(firstMediumIndex).toBeGreaterThan(firstHighIndex);
    }
  });
});

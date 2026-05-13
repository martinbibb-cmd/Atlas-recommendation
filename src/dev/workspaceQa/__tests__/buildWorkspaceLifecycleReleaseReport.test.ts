import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceLifecycleReleaseReport,
  type WorkspaceLifecycleReleaseScenarioCheckV1,
} from '../buildWorkspaceLifecycleReleaseReport';

function makePassScenario(
  overrides: Partial<WorkspaceLifecycleReleaseScenarioCheckV1> = {},
): WorkspaceLifecycleReleaseScenarioCheckV1 {
  return {
    scenarioId: 'workspace-owned-visit',
    label: 'Workspace-owned visit',
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

describe('buildWorkspaceLifecycleReleaseReport', () => {
  it('all-pass scenarios produce pass', () => {
    const report = buildWorkspaceLifecycleReleaseReport(
      [makePassScenario()],
      { generatedAt: '2026-05-13T20:22:09.721Z' },
    );

    expect(report.overallStatus).toBe('pass');
    expect(report.scenarioResults[0]?.status).toBe('pass');
    expect(report.blockingIssues).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.trialReadiness).toEqual({
      customerPortal: 'pass',
      implementationWorkflow: 'pass',
      workspaceOwnership: 'pass',
      storageExport: 'pass',
      scanFollowUp: 'pass',
    });
  });

  it('ownership failure produces fail', () => {
    const report = buildWorkspaceLifecycleReleaseReport([
      makePassScenario({
        scenarioId: 'ownership-failure',
        label: 'Ownership failure',
        ownershipFailure: true,
        trialReadiness: {
          customerPortal: 'pass',
          implementationWorkflow: 'pass',
          workspaceOwnership: 'fail',
          storageExport: 'pass',
          scanFollowUp: 'pass',
        },
      }),
    ]);

    expect(report.overallStatus).toBe('fail');
    expect(report.scenarioResults[0]?.status).toBe('fail');
    expect(report.blockingIssues).toContain('Ownership failure: Workspace ownership failed.');
  });

  it('Google Drive missing produces warn only', () => {
    const report = buildWorkspaceLifecycleReleaseReport([
      makePassScenario({
        scenarioId: 'google-drive-missing',
        label: 'Google Drive missing',
        optionalGoogleDriveUnavailable: true,
      }),
    ]);

    expect(report.overallStatus).toBe('warn');
    expect(report.scenarioResults[0]?.status).toBe('warn');
    expect(report.blockingIssues).toEqual([]);
    expect(report.warnings).toContain(
      'Google Drive missing: Google Drive integration is not configured; local-only export remains the trial fallback.',
    );
  });

  it('unresolved blockers warn', () => {
    const report = buildWorkspaceLifecycleReleaseReport([
      makePassScenario({
        scenarioId: 'blockers-warn',
        label: 'Blockers warn',
        unresolvedImplementationBlockers: ['Capture outstanding evidence'],
        trialReadiness: {
          customerPortal: 'pass',
          implementationWorkflow: 'warn',
          workspaceOwnership: 'pass',
          storageExport: 'pass',
          scanFollowUp: 'warn',
        },
      }),
    ]);

    expect(report.overallStatus).toBe('warn');
    expect(report.scenarioResults[0]?.status).toBe('warn');
    expect(report.blockingIssues).toEqual([]);
    expect(report.warnings).toContain('Blockers warn: Implementation blockers remain unresolved (1).');
  });
});

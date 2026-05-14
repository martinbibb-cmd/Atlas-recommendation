import { describe, expect, it } from 'vitest';
import { buildTrialReadinessActions } from '../../buildTrialReadinessActions';
import type { TrialReadinessActionReviewStateV1 } from '../../trialReadinessReviewState';
import {
  TRIAL_READINESS_PACK_REQUIRED_FILES,
  TRIAL_READINESS_PACK_SCHEMA,
  TRIAL_READINESS_PACK_VERSION,
  buildTrialReadinessPack,
  validateTrialReadinessPack,
} from '..';
import { getWorkspaceVisitLifecycleScenariosV1 } from '../../../workspaceQa/WorkspaceVisitLifecycleScenarioV1';
import { buildWorkspaceLifecycleReleaseReport } from '../../../workspaceQa/buildWorkspaceLifecycleReleaseReport';

function makeReleaseGateReport() {
  return buildWorkspaceLifecycleReleaseReport(
    [
      {
        scenarioId: 'open_vented_conversion',
        label: 'Open-vented conversion',
        optionalGoogleDriveUnavailable: true,
        trialReadiness: {
          customerPortal: 'pass',
          implementationWorkflow: 'warn',
          workspaceOwnership: 'pass',
          storageExport: 'warn',
          scanFollowUp: 'pass',
        },
      },
    ],
    { generatedAt: '2026-05-14T00:00:00.000Z' },
  );
}

function makePack() {
  const releaseGateReport = makeReleaseGateReport();
  const trialReadinessActions = buildTrialReadinessActions(releaseGateReport, { hasFailures: false });
  const trialReadinessReviewState: readonly TrialReadinessActionReviewStateV1[] = [
    {
      actionId: 'workspace-create-join-flow',
      status: 'in_progress',
      reviewerNote: 'Owner verification in progress',
      updatedAt: '2026-05-14T00:01:00.000Z',
    },
  ];

  return buildTrialReadinessPack({
    releaseGateReport,
    trialReadinessActions,
    trialReadinessReviewState,
    workspaceLifecycleScenarios: getWorkspaceVisitLifecycleScenariosV1(),
    exportedAt: '2026-05-14T00:05:00.000Z',
  });
}

describe('trial readiness pack export', () => {
  it('package includes all required files', () => {
    const pack = makePack();
    expect(Object.keys(pack.files).sort()).toEqual([...TRIAL_READINESS_PACK_REQUIRED_FILES].sort());
  });

  it('manifest schema/version are valid', () => {
    const pack = makePack();
    const manifest = pack.files['manifest.json'];
    expect(manifest.schema).toBe(TRIAL_READINESS_PACK_SCHEMA);
    expect(manifest.version).toBe(TRIAL_READINESS_PACK_VERSION);
    expect(manifest.exportedAt).toBe('2026-05-14T00:05:00.000Z');
  });

  it('review state is included in trial-readiness-review.json', () => {
    const pack = makePack();
    const reviewEntries = pack.files['trial-readiness-review.json'];
    const reviewedEntry = reviewEntries.find((entry) => entry.action.actionId === 'workspace-create-join-flow');
    expect(reviewedEntry?.reviewState?.status).toBe('in_progress');
    expect(reviewedEntry?.reviewState?.reviewerNote).toBe('Owner verification in progress');
  });

  it('known gaps are included in known-gaps.json', () => {
    const pack = makePack();
    const knownGaps = pack.files['known-gaps.json'];
    expect(knownGaps.some((gap) => gap.source === 'known_gap')).toBe(true);
  });

  it('import validator accepts valid schema', () => {
    const pack = makePack();
    const validated = validateTrialReadinessPack(pack);
    expect(validated.ok).toBe(true);
  });

  it('does not include customer visit payloads in workspace-lifecycle-scenarios.json', () => {
    const pack = makePack();
    const scenarios = pack.files['workspace-lifecycle-scenarios.json'] as Array<Record<string, unknown>>;
    expect(scenarios.every((entry) => !('visit' in entry) && !('workflowState' in entry))).toBe(true);
  });

  it('summary file does not include customer payload keys', () => {
    const pack = makePack();
    const summaryJson = JSON.stringify(pack.files['trial-readiness-summary.json']);
    expect(summaryJson.includes('"visit"')).toBe(false);
    expect(summaryJson.includes('"workflowState"')).toBe(false);
    expect(summaryJson.includes('"customerPayload"')).toBe(false);
  });
});

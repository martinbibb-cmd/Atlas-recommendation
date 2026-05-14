import type { TrialReadinessActionV1 } from '../TrialReadinessActionV1';
import type { TrialReadinessActionReviewStateV1 } from '../trialReadinessReviewState';
import type { WorkspaceLifecycleReleaseReportV1 } from '../../workspaceQa/buildWorkspaceLifecycleReleaseReport';
import type { WorkspaceVisitLifecycleScenarioV1 } from '../../workspaceQa/WorkspaceVisitLifecycleScenarioV1';
import { buildTrialReadinessSummary } from '../buildTrialReadinessSummary';
import { buildLimitedTrialPlan } from '../buildLimitedTrialPlan';
import { buildTrialFeedbackSummary } from '../feedback';
import { TRIAL_FEEDBACK_SCHEMA_VERSION } from '../feedback/storage/PersistedTrialFeedbackV1';
import type { TrialFeedbackEntryV1 } from '../feedback';
import {
  TRIAL_READINESS_PACK_SCHEMA,
  TRIAL_READINESS_PACK_VERSION,
  type TrialReadinessKnownGapV1,
  type TrialReadinessPackV1,
  type TrialReadinessReviewEntryV1,
  type TrialReadinessWorkspaceLifecycleScenarioV1,
} from './TrialReadinessPackV1';

interface BuildTrialReadinessPackInput {
  readonly releaseGateReport: WorkspaceLifecycleReleaseReportV1;
  readonly trialReadinessActions: readonly TrialReadinessActionV1[];
  readonly trialReadinessReviewState: readonly TrialReadinessActionReviewStateV1[];
  readonly workspaceLifecycleScenarios: readonly WorkspaceVisitLifecycleScenarioV1[];
  readonly trialFeedbackEntries?: readonly TrialFeedbackEntryV1[];
  readonly exportedAt?: string;
  readonly folderName?: string;
}

function dateStamp(iso: string): string {
  return iso.slice(0, 10);
}

function buildFolderName(exportedAt: string): string {
  return `Atlas-TrialReadinessPack-${dateStamp(exportedAt)}`;
}

function buildReadme(folderName: string): string {
  return [
    '# Atlas trial readiness pack',
    '',
    `Folder: ${folderName}`,
    '',
    'Portable dev-only trial planning package.',
    '',
    'Contents:',
    '- manifest.json',
    '- release-gate-report.json',
    '- trial-readiness-actions.json',
    '- trial-readiness-review.json',
    '- workspace-lifecycle-scenarios.json',
    '- known-gaps.json',
    '- trial-feedback.json',
    '- trial-feedback-summary.json',
    '- trial-readiness-summary.json',
    '- limited-trial-plan.json',
  ].join('\n');
}

function toReviewEntries(
  actions: readonly TrialReadinessActionV1[],
  reviewState: readonly TrialReadinessActionReviewStateV1[],
): readonly TrialReadinessReviewEntryV1[] {
  const reviewStateByActionId = new Map(reviewState.map((entry) => [entry.actionId, entry]));
  return actions.map((action) => ({
    action,
    reviewState: reviewStateByActionId.get(action.actionId) ?? null,
  }));
}

function toKnownGaps(actions: readonly TrialReadinessActionV1[]): readonly TrialReadinessKnownGapV1[] {
  return actions.filter((action) => action.source === 'known_gap');
}

function toScenarioExportEntries(
  scenarios: readonly WorkspaceVisitLifecycleScenarioV1[],
): readonly TrialReadinessWorkspaceLifecycleScenarioV1[] {
  return scenarios.map((scenario) => ({
    id: scenario.id,
    label: scenario.label,
    session: scenario.session,
    lifecycleProgression: scenario.lifecycleProgression,
    readinessProgression: scenario.readinessProgression,
  }));
}

export function buildTrialReadinessPack({
  releaseGateReport,
  trialReadinessActions,
  trialReadinessReviewState,
  workspaceLifecycleScenarios,
  trialFeedbackEntries = [],
  exportedAt = new Date().toISOString(),
  folderName = buildFolderName(exportedAt),
}: BuildTrialReadinessPackInput): TrialReadinessPackV1 {
  const preFeedbackSummary = buildTrialReadinessSummary({ releaseGateReport, trialReadinessActions });
  const preFeedbackPlan = buildLimitedTrialPlan({
    releaseGateReport,
    trialReadinessSummary: preFeedbackSummary,
    trialReadinessActions,
    workspaceLifecycleScenarios,
  });
  const trialFeedbackSummary = buildTrialFeedbackSummary(trialFeedbackEntries, preFeedbackPlan);
  const trialReadinessSummary = buildTrialReadinessSummary({
    releaseGateReport,
    trialReadinessActions,
    trialFeedbackSummary,
  });
  const limitedTrialPlan = buildLimitedTrialPlan({
    releaseGateReport,
    trialReadinessSummary,
    trialReadinessActions,
    workspaceLifecycleScenarios,
    trialFeedbackSummary,
  });
  const manifest = {
    schema: TRIAL_READINESS_PACK_SCHEMA,
    version: TRIAL_READINESS_PACK_VERSION,
    exportedAt,
    folderName,
  } as const;

  return {
    schema: TRIAL_READINESS_PACK_SCHEMA,
    version: TRIAL_READINESS_PACK_VERSION,
    folderName,
    files: {
      'manifest.json': manifest,
      'release-gate-report.json': releaseGateReport,
      'trial-readiness-actions.json': trialReadinessActions,
      'trial-readiness-review.json': toReviewEntries(trialReadinessActions, trialReadinessReviewState),
      'workspace-lifecycle-scenarios.json': toScenarioExportEntries(workspaceLifecycleScenarios),
      'known-gaps.json': toKnownGaps(trialReadinessActions),
      'trial-feedback.json': {
        schemaVersion: TRIAL_FEEDBACK_SCHEMA_VERSION,
        createdAt: exportedAt,
        updatedAt: exportedAt,
        entries: trialFeedbackEntries,
      },
      'trial-feedback-summary.json': trialFeedbackSummary,
      'trial-readiness-summary.json': trialReadinessSummary,
      'limited-trial-plan.json': limitedTrialPlan,
      'README.md': buildReadme(folderName),
    },
  };
}

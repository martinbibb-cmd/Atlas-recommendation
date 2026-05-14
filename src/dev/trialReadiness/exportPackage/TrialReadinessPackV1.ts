import type { TrialReadinessActionV1 } from '../TrialReadinessActionV1';
import type { TrialReadinessActionReviewStateV1 } from '../trialReadinessReviewState';
import type { WorkspaceLifecycleReleaseReportV1 } from '../../workspaceQa/buildWorkspaceLifecycleReleaseReport';
import type {
  WorkspaceVisitLifecycleProgressEntryV1,
  WorkspaceVisitReadinessProgressEntryV1,
  WorkspaceVisitLifecycleScenarioV1,
} from '../../workspaceQa/WorkspaceVisitLifecycleScenarioV1';
import type { TrialReadinessSummaryV1 } from '../buildTrialReadinessSummary';
import type { LimitedTrialPlanV1 } from '../buildLimitedTrialPlan';
import type { TrialFeedbackSummaryV1 } from '../feedback';
import type { PersistedTrialFeedbackV1 } from '../feedback/storage/PersistedTrialFeedbackV1';

export const TRIAL_READINESS_PACK_SCHEMA = 'atlas.trial-readiness-pack' as const;
export const TRIAL_READINESS_PACK_VERSION = '1.0' as const;

export const TRIAL_READINESS_PACK_REQUIRED_FILES = [
  'manifest.json',
  'release-gate-report.json',
  'trial-readiness-actions.json',
  'trial-readiness-review.json',
  'workspace-lifecycle-scenarios.json',
  'known-gaps.json',
  'trial-feedback.json',
  'trial-feedback-summary.json',
  'trial-readiness-summary.json',
  'limited-trial-plan.json',
  'README.md',
] as const;

export type TrialReadinessPackRequiredFileName = typeof TRIAL_READINESS_PACK_REQUIRED_FILES[number];

export interface TrialReadinessPackManifestV1 {
  readonly schema: typeof TRIAL_READINESS_PACK_SCHEMA;
  readonly version: typeof TRIAL_READINESS_PACK_VERSION;
  readonly exportedAt: string;
  readonly folderName: string;
}

export interface TrialReadinessReviewEntryV1 {
  readonly action: TrialReadinessActionV1;
  readonly reviewState: TrialReadinessActionReviewStateV1 | null;
}

export type TrialReadinessKnownGapV1 = TrialReadinessActionV1;

export interface TrialReadinessWorkspaceLifecycleScenarioV1 {
  readonly id: WorkspaceVisitLifecycleScenarioV1['id'];
  readonly label: WorkspaceVisitLifecycleScenarioV1['label'];
  readonly session: WorkspaceVisitLifecycleScenarioV1['session'];
  readonly lifecycleProgression: readonly WorkspaceVisitLifecycleProgressEntryV1[];
  readonly readinessProgression: readonly WorkspaceVisitReadinessProgressEntryV1[];
}

export interface TrialReadinessPackFilesV1 {
  readonly 'manifest.json': TrialReadinessPackManifestV1;
  readonly 'release-gate-report.json': WorkspaceLifecycleReleaseReportV1;
  readonly 'trial-readiness-actions.json': readonly TrialReadinessActionV1[];
  readonly 'trial-readiness-review.json': readonly TrialReadinessReviewEntryV1[];
  readonly 'workspace-lifecycle-scenarios.json': readonly TrialReadinessWorkspaceLifecycleScenarioV1[];
  readonly 'known-gaps.json': readonly TrialReadinessKnownGapV1[];
  readonly 'trial-feedback.json': PersistedTrialFeedbackV1;
  readonly 'trial-feedback-summary.json': TrialFeedbackSummaryV1;
  readonly 'trial-readiness-summary.json': TrialReadinessSummaryV1;
  readonly 'limited-trial-plan.json': LimitedTrialPlanV1;
  readonly 'README.md': string;
}

export interface TrialReadinessPackV1 {
  readonly schema: typeof TRIAL_READINESS_PACK_SCHEMA;
  readonly version: typeof TRIAL_READINESS_PACK_VERSION;
  readonly folderName: string;
  readonly files: TrialReadinessPackFilesV1;
}

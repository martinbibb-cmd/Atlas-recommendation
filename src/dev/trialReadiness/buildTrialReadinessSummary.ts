import type { WorkspaceLifecycleReleaseReportV1 } from '../workspaceQa/buildWorkspaceLifecycleReleaseReport';
import type { TrialReadinessActionV1 } from './TrialReadinessActionV1';

export type TrialReadinessOverallRecommendationV1 =
  | 'ready_for_limited_trial'
  | 'ready_with_known_risks'
  | 'not_ready';

export interface TrialReadinessSummaryV1 {
  readonly overallRecommendation: TrialReadinessOverallRecommendationV1;
  readonly plainEnglishSummary: string;
  readonly blockers: readonly string[];
  readonly acceptedRisks: readonly string[];
  readonly recommendedBeforeTrial: readonly string[];
  readonly recommendedDuringTrial: readonly string[];
  readonly doNotTestYet: readonly string[];
  readonly evidenceLinks: readonly string[];
}

interface BuildTrialReadinessSummaryInput {
  readonly releaseGateReport: WorkspaceLifecycleReleaseReportV1;
  readonly trialReadinessActions: readonly TrialReadinessActionV1[];
}

const EVIDENCE_LINKS: readonly string[] = [
  'release-gate-report.json',
  'trial-readiness-actions.json',
  'trial-readiness-review.json',
  'known-gaps.json',
];

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function isOpenStatus(action: TrialReadinessActionV1): boolean {
  return action.status === 'open' || action.status === 'in_progress';
}

function recommendationSummary(
  recommendation: TrialReadinessOverallRecommendationV1,
  blockers: readonly string[],
  acceptedRisks: readonly string[],
): string {
  if (recommendation === 'not_ready') {
    return blockers.length > 0
      ? `Not ready for trial: ${blockers.length} blocker(s) remain unresolved.`
      : 'Not ready for trial: critical pre-trial actions are still open.';
  }
  if (recommendation === 'ready_with_known_risks') {
    return `Ready with known risks: proceed with limited testers while tracking ${acceptedRisks.length} accepted risk(s).`;
  }
  return 'Ready for limited trial: all critical pre-trial actions are complete.';
}

function determineOverallRecommendation(options: {
  readonly releaseGateStatus: WorkspaceLifecycleReleaseReportV1['overallStatus'];
  readonly hasOpenBlockerActions: boolean;
  readonly hasOnlyAcceptedRisksAndWarnings: boolean;
  readonly allCriticalDone: boolean;
}): TrialReadinessOverallRecommendationV1 {
  if (options.releaseGateStatus === 'fail' || options.hasOpenBlockerActions) {
    return 'not_ready';
  }
  if (options.hasOnlyAcceptedRisksAndWarnings) {
    return 'ready_with_known_risks';
  }
  if (options.allCriticalDone) {
    return 'ready_for_limited_trial';
  }
  return 'not_ready';
}

export function buildTrialReadinessSummary({
  releaseGateReport,
  trialReadinessActions,
}: BuildTrialReadinessSummaryInput): TrialReadinessSummaryV1 {
  const openBlockerActions = trialReadinessActions.filter(
    (action) => action.priority === 'blocker' && isOpenStatus(action),
  );
  const openActions = trialReadinessActions.filter(isOpenStatus);
  const acceptedRiskActions = trialReadinessActions.filter((action) => action.status === 'accepted_risk');
  const criticalActions = trialReadinessActions.filter(
    (action) => action.priority === 'blocker' || action.priority === 'high',
  );
  const allCriticalDone = criticalActions.every((action) => action.status === 'done');
  const hasNoOpenActions = openActions.length === 0;
  const hasAcceptedRisks = acceptedRiskActions.length > 0;
  const hasWarnings = releaseGateReport.warnings.length > 0;
  const hasOnlyAcceptedRisksAndWarnings = hasNoOpenActions && (hasAcceptedRisks || hasWarnings);

  const blockers = unique([
    ...releaseGateReport.blockingIssues,
    ...openBlockerActions.map((action) => action.title),
  ]);
  const acceptedRisks = unique(acceptedRiskActions.map((action) => action.title));
  const recommendedBeforeTrial = unique(openActions.map((action) => action.title));
  const recommendedDuringTrial = unique([
    ...acceptedRisks.map((risk) => `Monitor accepted risk: ${risk}`),
    ...releaseGateReport.warnings.map((warning) => `Track warning during trial: ${warning}`),
  ]);
  const doNotTestYet = unique([
    ...releaseGateReport.blockingIssues,
    ...openBlockerActions.map((action) => `Resolve blocker action: ${action.title}`),
  ]);

  const overallRecommendation = determineOverallRecommendation({
    releaseGateStatus: releaseGateReport.overallStatus,
    hasOpenBlockerActions: openBlockerActions.length > 0,
    hasOnlyAcceptedRisksAndWarnings,
    allCriticalDone,
  });

  return {
    overallRecommendation,
    plainEnglishSummary: recommendationSummary(overallRecommendation, blockers, acceptedRisks),
    blockers,
    acceptedRisks,
    recommendedBeforeTrial,
    recommendedDuringTrial,
    doNotTestYet,
    evidenceLinks: EVIDENCE_LINKS,
  };
}

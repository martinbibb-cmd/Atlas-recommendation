import type { WorkspaceLifecycleReleaseReportV1, WorkspaceLifecycleReleaseStatusV1 } from '../workspaceQa/buildWorkspaceLifecycleReleaseReport';
import type { WorkspaceVisitLifecycleScenarioV1 } from '../workspaceQa/WorkspaceVisitLifecycleScenarioV1';
import type { TrialReadinessActionV1 } from './TrialReadinessActionV1';
import type { TrialReadinessOverallRecommendationV1, TrialReadinessSummaryV1 } from './buildTrialReadinessSummary';
import type { TrialFeedbackSummaryV1 } from './feedback';
import { FEEDBACK_CONFUSION_FIX_REQUIRED_CHECK_PREFIX } from './feedback/trialFeedbackReadinessLabels';

export type LimitedTrialSuggestedTesterCountV1 = 0 | '1-2' | '3-5';
export type LimitedTrialReadinessSignalV1 = 'pass' | 'warn' | 'fail';

export interface LimitedTrialPlanV1 {
  readonly trialRecommendation: TrialReadinessOverallRecommendationV1;
  readonly suggestedTesterCount: LimitedTrialSuggestedTesterCountV1;
  readonly eligibleScenarios: readonly string[];
  readonly excludedScenarios: readonly string[];
  readonly requiredPreTrialChecks: readonly string[];
  readonly duringTrialChecklist: readonly string[];
  readonly rollbackPlan: readonly string[];
  readonly feedbackQuestions: readonly string[];
  readonly successCriteria: readonly string[];
  readonly stopCriteria: readonly string[];
}

interface BuildLimitedTrialPlanInput {
  readonly releaseGateReport: WorkspaceLifecycleReleaseReportV1;
  readonly trialReadinessSummary: TrialReadinessSummaryV1;
  readonly trialReadinessActions: readonly TrialReadinessActionV1[];
  readonly workspaceLifecycleScenarios: readonly WorkspaceVisitLifecycleScenarioV1[];
  readonly trialFeedbackSummary?: TrialFeedbackSummaryV1;
}

const OPEN_VENTED_SCENARIO_ID = 'open_vented_conversion';
const HEAT_PUMP_SCENARIO_ID = 'heat_pump_path';
const SPECIAL_SCENARIO_IDS = new Set([OPEN_VENTED_SCENARIO_ID, HEAT_PUMP_SCENARIO_ID]);

const DEFAULT_STOP_CRITERIA: readonly string[] = [
  'Any release-gate blocker appears in trial usage.',
  'Any exported artifact fails ownership or brand integrity checks.',
  'Customer-facing output mismatch affects recommendation clarity or trust.',
  'A safety-critical or data-integrity defect is observed in a tester session.',
];

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function isOpenStatus(action: TrialReadinessActionV1): boolean {
  return action.status === 'open' || action.status === 'in_progress';
}

function resolveSuggestedTesterCount(
  recommendation: TrialReadinessOverallRecommendationV1,
): LimitedTrialSuggestedTesterCountV1 {
  if (recommendation === 'not_ready') return 0;
  if (recommendation === 'ready_with_known_risks') return '1-2';
  return '3-5';
}

function resolvePdfReadiness(actions: readonly TrialReadinessActionV1[]): LimitedTrialReadinessSignalV1 {
  const pdfActions = actions.filter((action) => {
    const normalized = `${action.actionId} ${action.title}`.toLowerCase();
    return normalized.includes('pdf');
  });
  if (pdfActions.length === 0) return 'pass';
  if (pdfActions.some((action) => action.priority !== 'low' && isOpenStatus(action))) return 'fail';
  if (pdfActions.some((action) => action.status !== 'done')) return 'warn';
  return 'pass';
}

function toSignal(status: WorkspaceLifecycleReleaseStatusV1): LimitedTrialReadinessSignalV1 {
  return status;
}

function isPassOrWarnOnly(status: LimitedTrialReadinessSignalV1): boolean {
  return status === 'pass' || status === 'warn';
}

function isOpenVentedOrHeatPumpEligible(
  releaseGateReport: WorkspaceLifecycleReleaseReportV1,
  trialReadinessActions: readonly TrialReadinessActionV1[],
): boolean {
  const portalReadiness = toSignal(releaseGateReport.trialReadiness.customerPortal);
  const workflowReadiness = toSignal(releaseGateReport.trialReadiness.implementationWorkflow);
  const pdfReadiness = resolvePdfReadiness(trialReadinessActions);

  return (
    isPassOrWarnOnly(portalReadiness) &&
    isPassOrWarnOnly(pdfReadiness) &&
    isPassOrWarnOnly(workflowReadiness)
  );
}

function buildScenarioLists({
  releaseGateReport,
  workspaceLifecycleScenarios,
  trialReadinessActions,
}: Pick<BuildLimitedTrialPlanInput, 'releaseGateReport' | 'workspaceLifecycleScenarios' | 'trialReadinessActions'>): {
  eligibleScenarios: readonly string[];
  excludedScenarios: readonly string[];
} {
  const eligibleScenarios: string[] = [];
  const excludedScenarios: string[] = [];
  const includeSpecialScenarios = isOpenVentedOrHeatPumpEligible(releaseGateReport, trialReadinessActions);
  const knownScenarioIds = new Set(workspaceLifecycleScenarios.map((scenario) => scenario.id));

  for (const result of releaseGateReport.scenarioResults) {
    if (!knownScenarioIds.has(result.scenarioId as WorkspaceVisitLifecycleScenarioV1['id'])) {
      continue;
    }
    if (result.status === 'fail') {
      excludedScenarios.push(`${result.label} (release-gate fail)`);
      continue;
    }
    if (SPECIAL_SCENARIO_IDS.has(result.scenarioId) && !includeSpecialScenarios) {
      excludedScenarios.push(`${result.label} (portal/PDF/workflow readiness not pass-or-warn)`);
      continue;
    }
    eligibleScenarios.push(result.label);
  }

  return {
    eligibleScenarios: unique(eligibleScenarios),
    excludedScenarios: unique(excludedScenarios),
  };
}

function buildRequiredPreTrialChecks(summary: TrialReadinessSummaryV1): readonly string[] {
  return unique([
    ...summary.recommendedBeforeTrial,
    'Confirm rollback owner and communication channel before first tester session.',
    'Confirm stop criteria acknowledgement by the trial owner.',
  ]);
}

function buildDuringTrialChecklist(summary: TrialReadinessSummaryV1): readonly string[] {
  return unique(summary.recommendedDuringTrial);
}

function buildRecommendationSpecificChecklist(
  recommendation: TrialReadinessOverallRecommendationV1,
): readonly string[] {
  if (recommendation === 'not_ready') {
    return ['Do not onboard testers until blockers and release-gate failures are resolved.'];
  }
  if (recommendation === 'ready_with_known_risks') {
    return [
      'Limit cohort to 1-2 internal/friendly testers only.',
      'Do not open external or broad tester recruitment in this phase.',
    ];
  }
  return ['Use a controlled cohort of 3-5 testers and keep rollout scoped to supervised sessions.'];
}

function buildRollbackPlan(): readonly string[] {
  return [
    'Pause new trial sessions immediately when stop criteria are triggered.',
    'Revert to last known-good recommendation/export path for active testers.',
    'Capture issue evidence and assign owner for remediation before re-entry.',
    'Resume only after release-gate-impacting defects are closed and rechecked.',
  ];
}

function buildFeedbackQuestions(): readonly string[] {
  return [
    'Was the recommendation understandable and trustworthy end-to-end?',
    'Did any portal or PDF output appear inconsistent, incomplete, or confusing?',
    'Did implementation or follow-up workflow steps block your progress?',
    'What prevented completion of your intended task, if anything?',
  ];
}

function buildSuccessCriteria(
  recommendation: TrialReadinessOverallRecommendationV1,
  eligibleScenarioCount: number,
): readonly string[] {
  const testerGuardrail =
    recommendation === 'not_ready'
      ? 'No real-world testers were onboarded before readiness blockers were cleared.'
      : recommendation === 'ready_with_known_risks'
        ? 'Trial remained constrained to 1-2 internal/friendly testers.'
        : 'Trial remained constrained to 3-5 controlled testers.';

  return [
    testerGuardrail,
    `Eligible trial scenarios executed without introducing new release-gate failures (${eligibleScenarioCount} scenario(s)).`,
    'No stop criteria were triggered during the trial window.',
    'Feedback collected for recommendation clarity, portal/PDF quality, and implementation handoff quality.',
  ];
}

export function buildLimitedTrialPlan({
  releaseGateReport,
  trialReadinessSummary,
  trialReadinessActions,
  workspaceLifecycleScenarios,
  trialFeedbackSummary,
}: BuildLimitedTrialPlanInput): LimitedTrialPlanV1 {
  const trialRecommendation = trialReadinessSummary.overallRecommendation;
  const feedbackStopCriteriaTriggered = trialFeedbackSummary?.stopCriteriaTriggered ?? false;
  const suggestedTesterCount = feedbackStopCriteriaTriggered ? 0 : resolveSuggestedTesterCount(trialRecommendation);
  const scenarioLists = buildScenarioLists({
    releaseGateReport,
    workspaceLifecycleScenarios,
    trialReadinessActions,
  });
  const feedbackFixes = trialFeedbackSummary?.recommendedFixes ?? [];
  const feedbackStopCriteria = unique([
    ...(feedbackStopCriteriaTriggered
      ? ['An unresolved blocker remains open in trial feedback.']
      : []),
    ...feedbackFixes.map((fix) => `Repeated confusion feedback observed: ${fix}`),
  ]);

  return {
    trialRecommendation,
    suggestedTesterCount,
    eligibleScenarios: scenarioLists.eligibleScenarios,
    excludedScenarios: scenarioLists.excludedScenarios,
    requiredPreTrialChecks: unique([
      ...buildRequiredPreTrialChecks(trialReadinessSummary),
      ...feedbackFixes.map((fix) => `${FEEDBACK_CONFUSION_FIX_REQUIRED_CHECK_PREFIX} ${fix}`),
    ]),
    duringTrialChecklist: unique([
      ...buildRecommendationSpecificChecklist(trialRecommendation),
      ...buildDuringTrialChecklist(trialReadinessSummary),
    ]),
    rollbackPlan: buildRollbackPlan(),
    feedbackQuestions: buildFeedbackQuestions(),
    successCriteria: buildSuccessCriteria(trialRecommendation, scenarioLists.eligibleScenarios.length),
    stopCriteria: unique([...DEFAULT_STOP_CRITERIA, ...feedbackStopCriteria]),
  };
}

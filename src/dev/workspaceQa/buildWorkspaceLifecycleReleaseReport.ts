import type {
  WorkspaceVisitLifecycleEvaluationV1,
  WorkspaceVisitLifecycleScenarioV1,
} from './WorkspaceVisitLifecycleScenarioV1';

export type WorkspaceLifecycleReleaseStatusV1 = 'pass' | 'warn' | 'fail';

export interface WorkspaceLifecycleTrialReadinessV1 {
  readonly customerPortal: WorkspaceLifecycleReleaseStatusV1;
  readonly supportingPdf: WorkspaceLifecycleReleaseStatusV1;
  readonly implementationWorkflow: WorkspaceLifecycleReleaseStatusV1;
  readonly workspaceOwnership: WorkspaceLifecycleReleaseStatusV1;
  readonly storageExport: WorkspaceLifecycleReleaseStatusV1;
  readonly scanFollowUp: WorkspaceLifecycleReleaseStatusV1;
}

export interface WorkspaceLifecycleReleaseScenarioCheckV1 {
  readonly scenarioId: string;
  readonly label: string;
  readonly ownershipFailure?: boolean;
  readonly brandMismatch?: boolean;
  readonly exportImportFailure?: boolean;
  readonly noWorkspaceBlockBehavingCorrectly?: boolean;
  readonly optionalGoogleDriveUnavailable?: boolean;
  readonly unresolvedImplementationBlockers?: readonly string[];
  readonly incorrectlyMarkedReady?: boolean;
  readonly trialReadiness?: Partial<WorkspaceLifecycleTrialReadinessV1>;
}

export interface WorkspaceLifecycleReleaseScenarioResultV1 {
  readonly scenarioId: string;
  readonly label: string;
  readonly status: WorkspaceLifecycleReleaseStatusV1;
  readonly blockingIssues: readonly string[];
  readonly warnings: readonly string[];
}

export interface WorkspaceLifecycleReleaseReportV1 {
  readonly generatedAt: string;
  readonly overallStatus: WorkspaceLifecycleReleaseStatusV1;
  readonly scenarioResults: readonly WorkspaceLifecycleReleaseScenarioResultV1[];
  readonly blockingIssues: readonly string[];
  readonly warnings: readonly string[];
  readonly recommendedNextActions: readonly string[];
  readonly trialReadiness: WorkspaceLifecycleTrialReadinessV1;
}

type MutableTrialReadiness = {
  -readonly [K in keyof WorkspaceLifecycleTrialReadinessV1]: WorkspaceLifecycleTrialReadinessV1[K];
};

const RELEASE_STATUS_PRIORITY: Record<WorkspaceLifecycleReleaseStatusV1, number> = {
  pass: 0,
  warn: 1,
  fail: 2,
};

const TRIAL_READINESS_KEYS: readonly (keyof WorkspaceLifecycleTrialReadinessV1)[] = [
  'customerPortal',
  'supportingPdf',
  'implementationWorkflow',
  'workspaceOwnership',
  'storageExport',
  'scanFollowUp',
];

const SCENARIO_TRIAL_READINESS_KEYS: Record<
  WorkspaceVisitLifecycleScenarioV1['id'],
  readonly (keyof WorkspaceLifecycleTrialReadinessV1)[]
> = {
  new_demo_visit: [],
  authenticated_no_workspace_blocked: ['workspaceOwnership'],
  workspace_owned_visit: ['customerPortal', 'supportingPdf', 'implementationWorkflow', 'workspaceOwnership'],
  open_vented_conversion: [
    'customerPortal',
    'supportingPdf',
    'implementationWorkflow',
    'workspaceOwnership',
    'storageExport',
    'scanFollowUp',
  ],
  heat_pump_path: [
    'customerPortal',
    'supportingPdf',
    'implementationWorkflow',
    'workspaceOwnership',
    'storageExport',
    'scanFollowUp',
  ],
  revisit_follow_up_path: [
    'customerPortal',
    'supportingPdf',
    'implementationWorkflow',
    'workspaceOwnership',
    'storageExport',
    'scanFollowUp',
  ],
  export_import_path: ['workspaceOwnership', 'storageExport'],
};

function mergeReleaseStatus(
  left: WorkspaceLifecycleReleaseStatusV1,
  right: WorkspaceLifecycleReleaseStatusV1,
): WorkspaceLifecycleReleaseStatusV1 {
  return RELEASE_STATUS_PRIORITY[left] >= RELEASE_STATUS_PRIORITY[right] ? left : right;
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function formatScenarioIssue(label: string, issue: string): string {
  return `${label}: ${issue}`;
}

function makePassTrialReadiness(): MutableTrialReadiness {
  return Object.fromEntries(
    TRIAL_READINESS_KEYS.map((key) => [key, 'pass']),
  ) as MutableTrialReadiness;
}

function isNoWorkspaceBlockBehavingCorrectly(
  scenario: WorkspaceVisitLifecycleScenarioV1,
  evaluation: WorkspaceVisitLifecycleEvaluationV1,
): boolean {
  return (
    scenario.session.status === 'authenticated_no_workspace' &&
    scenario.visit.workspaceId === undefined &&
    scenario.lifecycleProgression.some((entry) => entry.state === 'blocked') &&
    scenario.readinessProgression.every((entry) => entry.state === 'blocked') &&
    !evaluation.checks.visitHasWorkspaceId &&
    !evaluation.summary.ownershipValid
  );
}

function resolveTrialReadinessStatus(
  key: keyof WorkspaceLifecycleTrialReadinessV1,
  scenario: WorkspaceVisitLifecycleScenarioV1,
  evaluation: WorkspaceVisitLifecycleEvaluationV1,
  noWorkspaceBlockBehavingCorrectly: boolean,
): WorkspaceLifecycleReleaseStatusV1 {
  switch (key) {
    case 'customerPortal':
      return evaluation.summary.brandingValid ? 'pass' : 'fail';
    case 'supportingPdf':
      return evaluation.summary.brandingValid ? 'pass' : 'fail';
    case 'implementationWorkflow':
      return evaluation.summary.workflowValid ? 'pass' : 'fail';
    case 'workspaceOwnership':
      if (scenario.session.status === 'authenticated_no_workspace') {
        return noWorkspaceBlockBehavingCorrectly ? 'pass' : 'fail';
      }
      return evaluation.summary.ownershipValid ? 'pass' : 'fail';
    case 'storageExport':
      return evaluation.summary.exportValid ? 'pass' : 'fail';
    case 'scanFollowUp':
      return evaluation.checks.followUpHandoffContainsCorrectVisitOwnership ? 'pass' : 'fail';
  }
}

export function buildWorkspaceLifecycleReleaseScenarioCheckFromLifecycleScenario(
  scenario: WorkspaceVisitLifecycleScenarioV1,
  evaluation: WorkspaceVisitLifecycleEvaluationV1,
): WorkspaceLifecycleReleaseScenarioCheckV1 {
  const noWorkspaceBlockBehavingCorrectly = isNoWorkspaceBlockBehavingCorrectly(scenario, evaluation);
  const trialReadinessEntries = SCENARIO_TRIAL_READINESS_KEYS[scenario.id].map((key) => [
    key,
    resolveTrialReadinessStatus(key, scenario, evaluation, noWorkspaceBlockBehavingCorrectly),
  ] as const);

  return {
    scenarioId: scenario.id,
    label: scenario.label,
    ownershipFailure: scenario.session.status === 'workspace_active' && !evaluation.summary.ownershipValid,
    brandMismatch: scenario.session.status === 'workspace_active' && !evaluation.summary.brandingValid,
    exportImportFailure: scenario.session.status === 'workspace_active' && !evaluation.summary.exportValid,
    ...(scenario.session.status === 'authenticated_no_workspace'
      ? { noWorkspaceBlockBehavingCorrectly }
      : {}),
    ...(scenario.session.storageTarget === 'google_drive'
      ? { optionalGoogleDriveUnavailable: true }
      : {}),
    trialReadiness: Object.fromEntries(trialReadinessEntries),
  };
}

export function buildWorkspaceLifecycleReleaseReport(
  scenarioChecks: readonly WorkspaceLifecycleReleaseScenarioCheckV1[],
  options: { readonly generatedAt?: string } = {},
): WorkspaceLifecycleReleaseReportV1 {
  const recommendedNextActions: string[] = [];

  const scenarioResults = scenarioChecks.map<WorkspaceLifecycleReleaseScenarioResultV1>((check) => {
    const blockingIssues: string[] = [];
    const warnings: string[] = [];
    let status: WorkspaceLifecycleReleaseStatusV1 = 'pass';

    if (check.ownershipFailure) {
      blockingIssues.push('Workspace ownership failed.');
      recommendedNextActions.push('Fix workspace ownership propagation before trial.');
      status = 'fail';
    }

    if (check.brandMismatch) {
      blockingIssues.push('Customer-facing brand output does not match the resolved workspace brand.');
      recommendedNextActions.push('Fix brand resolution so customer-facing outputs always use the active workspace brand.');
      status = 'fail';
    }

    if (check.exportImportFailure) {
      blockingIssues.push('Export/import round-trip failed or lost required metadata.');
      recommendedNextActions.push('Fix export/import round-trip preservation before trial.');
      status = 'fail';
    }

    if (check.noWorkspaceBlockBehavingCorrectly === false) {
      blockingIssues.push('No-workspace gating did not block the lifecycle correctly.');
      recommendedNextActions.push('Restore no-workspace gating before trial.');
      status = 'fail';
    }

    if (check.optionalGoogleDriveUnavailable) {
      warnings.push('Google Drive integration is not configured; local-only export remains the trial fallback.');
      recommendedNextActions.push('Keep trial storage on local-only export until Google Drive integration is available.');
      status = mergeReleaseStatus(status, 'warn');
    }

    if ((check.unresolvedImplementationBlockers?.length ?? 0) > 0) {
      if (check.incorrectlyMarkedReady) {
        blockingIssues.push('Unresolved implementation blockers are incorrectly marked ready.');
        recommendedNextActions.push('Resolve or correctly gate implementation blockers before trial.');
        status = 'fail';
      } else {
        warnings.push(`Implementation blockers remain unresolved (${check.unresolvedImplementationBlockers?.length ?? 0}).`);
        recommendedNextActions.push('Resolve remaining implementation blockers before wider trial rollout.');
        status = mergeReleaseStatus(status, 'warn');
      }
    }

    return {
      scenarioId: check.scenarioId,
      label: check.label,
      status,
      blockingIssues,
      warnings,
    };
  });

  const trialReadiness = TRIAL_READINESS_KEYS.reduce<MutableTrialReadiness>(
    (acc, key) => {
      acc[key] = scenarioChecks.reduce<WorkspaceLifecycleReleaseStatusV1>((status, check) => {
        const next = check.trialReadiness?.[key];
        return next === undefined ? status : mergeReleaseStatus(status, next);
      }, 'pass');
      return acc;
    },
    makePassTrialReadiness(),
  );

  const blockingIssues = unique(
    scenarioResults.flatMap((result) => result.blockingIssues.map((issue) => formatScenarioIssue(result.label, issue))),
  );
  const warnings = unique(
    scenarioResults.flatMap((result) => result.warnings.map((issue) => formatScenarioIssue(result.label, issue))),
  );

  const overallStatus = [...scenarioResults.map((result) => result.status), ...Object.values(trialReadiness)].reduce(
    mergeReleaseStatus,
    'pass' as WorkspaceLifecycleReleaseStatusV1,
  );

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    overallStatus,
    scenarioResults,
    blockingIssues,
    warnings,
    recommendedNextActions: unique(recommendedNextActions),
    trialReadiness,
  };
}

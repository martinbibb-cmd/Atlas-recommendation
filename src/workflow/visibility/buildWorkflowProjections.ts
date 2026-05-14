import type { FollowUpEvidenceCaptureItemV1, SurveyFollowUpTaskV1 } from '../../specification/followUps';
import type { SpecificationReadinessV1 } from '../../specification/readiness';
import type { OperationalDigestV1 } from '../operationalDigest';
import type {
  ChecklistLineV1,
  ReadinessCheckV1,
  ReadinessCheckSeverityV1,
  WorkflowAudienceRole,
  WorkflowVisibility,
} from './WorkflowVisibilityV1';
import { classifyWorkflowVisibility } from './classifyWorkflowVisibility';

interface BuildWorkflowProjectionInput {
  readonly followUpTasks: readonly SurveyFollowUpTaskV1[];
  readonly readinessChecks: readonly ReadinessCheckV1[];
  readonly evidenceRequirements: readonly FollowUpEvidenceCaptureItemV1[];
  readonly operationalDigest: OperationalDigestV1;
  readonly checklistLines: readonly ChecklistLineV1[];
}

export interface WorkflowProjectionV1 {
  readonly audience: WorkflowAudienceRole;
  readonly followUpTasks: readonly SurveyFollowUpTaskV1[];
  readonly readinessChecks: readonly ReadinessCheckV1[];
  readonly evidenceRequirements: readonly FollowUpEvidenceCaptureItemV1[];
  readonly operationalDigest: OperationalDigestV1;
  readonly checklistLines: readonly ChecklistLineV1[];
}

function canAudienceSee(visibility: readonly WorkflowVisibility[], audience: WorkflowAudienceRole): boolean {
  if (visibility.includes('internal_hidden')) return false;
  if (audience === 'customer') {
    return visibility.includes('customer_summary') || visibility.includes('customer_action_required');
  }
  if (audience === 'installer') {
    return visibility.includes('installer_only')
      || visibility.includes('customer_summary')
      || visibility.includes('customer_action_required');
  }
  if (audience === 'office') {
    return visibility.includes('office_only')
      || visibility.includes('installer_only')
      || visibility.includes('customer_summary')
      || visibility.includes('customer_action_required');
  }
  return visibility.includes('compliance_audit')
    || visibility.includes('office_only')
    || visibility.includes('installer_only')
    || visibility.includes('customer_summary')
    || visibility.includes('customer_action_required');
}

function buildWorkflowProjection(
  audience: WorkflowAudienceRole,
  input: BuildWorkflowProjectionInput,
): WorkflowProjectionV1 {
  const followUpTasks = input.followUpTasks.filter((task) => canAudienceSee(task.visibility, audience));
  const allowedTaskIds = new Set(followUpTasks.map((task) => task.taskId));
  const readinessChecks = input.readinessChecks.filter((check) => canAudienceSee(check.visibility, audience));
  const evidenceRequirements = input.evidenceRequirements.filter((item) =>
    canAudienceSee(item.visibility, audience) && item.taskIds.some((taskId) => allowedTaskIds.has(taskId)));
  const checklistLines = input.checklistLines.filter((line) => canAudienceSee(line.visibility, audience));
  const digestItems = input.operationalDigest.items
    .filter((item) => canAudienceSee(item.visibility, audience))
    .map((item) => ({
      ...item,
      linkedTaskIds: item.linkedTaskIds.filter((taskId) => allowedTaskIds.has(taskId)),
      evidenceRequired: item.evidenceRequired.filter((evidence) => canAudienceSee(evidence.visibility, audience)),
    }))
    .filter((item) => item.linkedTaskIds.length > 0);

  return {
    audience,
    followUpTasks,
    readinessChecks,
    evidenceRequirements,
    operationalDigest: {
      ...input.operationalDigest,
      totalItems: digestItems.length,
      items: digestItems,
    },
    checklistLines,
  };
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function mapReadinessChecks(
  values: readonly string[],
  severity: ReadinessCheckSeverityV1,
): ReadinessCheckV1[] {
  return values.map((value, index) => ({
    checkId: `readiness_${severity}_${String(index + 1).padStart(3, '0')}_${hashString(value).slice(0, 4)}`,
    text: value,
    severity,
    visibility: classifyWorkflowVisibility({
      text: value,
      preferCustomerSummary: severity !== 'blocker',
    }),
  }));
}

export function buildReadinessChecksFromSpecificationReadiness(
  readiness: SpecificationReadinessV1,
): ReadinessCheckV1[] {
  return [
    ...mapReadinessChecks(readiness.blockingReasons, 'blocker'),
    ...mapReadinessChecks(readiness.warnings, 'warning'),
    ...mapReadinessChecks(readiness.unresolvedChecks, 'info'),
  ];
}

export function buildChecklistLinesFromReadinessChecks(
  checks: readonly ReadinessCheckV1[],
): ChecklistLineV1[] {
  return checks.map((check) => ({
    lineId: `checklist_${check.checkId}`,
    label: check.text,
    visibility: check.visibility,
  }));
}

export function buildCustomerWorkflowProjection(input: BuildWorkflowProjectionInput): WorkflowProjectionV1 {
  return buildWorkflowProjection('customer', input);
}

export function buildInstallerWorkflowProjection(input: BuildWorkflowProjectionInput): WorkflowProjectionV1 {
  return buildWorkflowProjection('installer', input);
}

export function buildOfficeWorkflowProjection(input: BuildWorkflowProjectionInput): WorkflowProjectionV1 {
  return buildWorkflowProjection('office', input);
}

export function buildAuditWorkflowProjection(input: BuildWorkflowProjectionInput): WorkflowProjectionV1 {
  return buildWorkflowProjection('audit', input);
}

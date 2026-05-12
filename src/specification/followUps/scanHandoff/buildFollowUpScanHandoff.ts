import type {
  FollowUpEvidenceCaptureItemV1,
  FollowUpEvidenceCapturePlanV1,
  SurveyFollowUpTaskPriority,
} from '..';
import type {
  FollowUpScanCaptureItemV1,
  FollowUpScanCaptureMode,
  FollowUpScanHandoffPriority,
  FollowUpScanHandoffV1,
  FollowUpScanUnresolvedDependencyV1,
} from './FollowUpScanHandoffV1';

const PRIORITY_ORDER: Readonly<Record<FollowUpScanHandoffPriority, number>> = {
  blocker: 0,
  important: 1,
  optional: 2,
};

const DEPENDENCY_MODES = new Set<FollowUpScanCaptureMode>([
  'qualification_check',
  'customer_confirmation',
]);

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function derivePriority(
  item: FollowUpEvidenceCaptureItemV1,
  taskPriorityById: ReadonlyMap<string, SurveyFollowUpTaskPriority>,
): FollowUpScanHandoffPriority {
  if (!item.required) return 'optional';
  for (const taskId of item.taskIds) {
    if (taskPriorityById.get(taskId) === 'blocker') return 'blocker';
  }
  return 'important';
}

function compareByPriorityLocationPrompt(
  a: { priority: FollowUpScanHandoffPriority; targetLocation?: string; prompt: string; evidenceId: string },
  b: { priority: FollowUpScanHandoffPriority; targetLocation?: string; prompt: string; evidenceId: string },
): number {
  const priorityDelta = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (priorityDelta !== 0) return priorityDelta;

  const locationDelta = (a.targetLocation ?? '').localeCompare(b.targetLocation ?? '');
  if (locationDelta !== 0) return locationDelta;

  const promptDelta = a.prompt.localeCompare(b.prompt);
  if (promptDelta !== 0) return promptDelta;

  return a.evidenceId.localeCompare(b.evidenceId);
}

function compareDependencies(
  a: FollowUpScanUnresolvedDependencyV1,
  b: FollowUpScanUnresolvedDependencyV1,
): number {
  const priorityDelta = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (priorityDelta !== 0) return priorityDelta;

  const promptDelta = a.prompt.localeCompare(b.prompt);
  if (promptDelta !== 0) return promptDelta;

  return a.evidenceId.localeCompare(b.evidenceId);
}

export function buildFollowUpScanHandoff(
  evidencePlan: FollowUpEvidenceCapturePlanV1,
): FollowUpScanHandoffV1 {
  const taskPriorityById = new Map(evidencePlan.tasks.map((task) => [task.taskId, task.priority]));
  const evidenceItems = [...evidencePlan.requiredEvidence, ...evidencePlan.optionalEvidence];

  const captureItems = evidenceItems
    .filter((item) => !DEPENDENCY_MODES.has(item.evidenceType))
    .map((item) => ({
      evidenceId: item.evidenceId,
      prompt: item.prompt,
      captureMode: item.evidenceType,
      ...(item.targetLocation ? { targetLocation: item.targetLocation } : {}),
      acceptanceCriteria: item.acceptanceCriteria,
      linkedTaskIds: item.taskIds,
      linkedLineIds: item.linkedLineIds,
      linkedMaterialIds: item.linkedMaterialIds,
      priority: derivePriority(item, taskPriorityById),
    }))
    .sort(compareByPriorityLocationPrompt)
    .map<FollowUpScanCaptureItemV1>((item, index) => ({
      captureItemId: `capture_${String(index + 1).padStart(3, '0')}`,
      ...item,
    }));

  const unresolvedDependencies = evidenceItems
    .filter((item): item is FollowUpEvidenceCaptureItemV1 & {
      readonly evidenceType: Extract<FollowUpScanCaptureMode, 'qualification_check' | 'customer_confirmation'>;
    } => DEPENDENCY_MODES.has(item.evidenceType))
    .map((item) => ({
      dependencyId: '',
      evidenceId: item.evidenceId,
      prompt: item.prompt,
      dependencyType: item.evidenceType,
      linkedTaskIds: item.taskIds,
      priority: derivePriority(item, taskPriorityById),
    }))
    .sort(compareDependencies)
    .map<FollowUpScanUnresolvedDependencyV1>((item, index) => ({
      ...item,
      dependencyId: `dependency_${String(index + 1).padStart(3, '0')}`,
    }));

  const handoffSeed = [
    evidencePlan.planId,
    ...captureItems.map((item) => `${item.evidenceId}:${item.captureMode}:${item.priority}`),
    ...unresolvedDependencies.map((item) => `${item.evidenceId}:${item.dependencyType}:${item.priority}`),
  ].join('|');

  return {
    handoffId: `follow_up_scan_handoff_v1_${hashString(handoffSeed)}`,
    ...(evidencePlan.visitReference ? { visitReference: evidencePlan.visitReference } : {}),
    sourcePlanId: evidencePlan.planId,
    createdAt: new Date().toISOString(),
    captureItems,
    unresolvedDependencies,
  };
}

import type { EngineerJobPackV1 } from '../../handover';
import type { SuggestedMaterialLineV1 } from '../../materials';
import type { SpecificationLineV1 } from '../../specLines';
import type { SurveyFollowUpTaskV1 } from '../SurveyFollowUpTaskV1';
import type {
  FollowUpEvidenceCaptureItemV1,
  FollowUpEvidenceCapturePlanV1,
  FollowUpEvidenceCaptureType,
} from './FollowUpEvidenceCapturePlanV1';

interface EvidenceDraft {
  readonly taskIds: readonly string[];
  readonly evidenceType: FollowUpEvidenceCaptureType;
  readonly prompt: string;
  readonly targetLocation?: string;
  readonly required: boolean;
  readonly acceptanceCriteria: readonly string[];
  readonly linkedLineIds: readonly string[];
  readonly linkedMaterialIds: readonly string[];
}

const EVIDENCE_ORDER: Readonly<Record<FollowUpEvidenceCaptureType, number>> = {
  photo: 0,
  measurement: 1,
  scan_pin: 2,
  note: 3,
  qualification_check: 4,
  customer_confirmation: 5,
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function stableUnique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function sortStrings(values: readonly string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function collectLocationById(engineerJobPack: EngineerJobPackV1): Map<string, string> {
  type EngineerSectionKey = Exclude<keyof EngineerJobPackV1, 'jobPackVersion' | 'surveyData' | 'scanData'>;
  const sectionKeys: readonly EngineerSectionKey[] = [
    'jobSummary',
    'fitThis',
    'removeThis',
    'checkThis',
    'discussWithCustomer',
    'locationsAndRoutes',
    'commissioning',
    'unresolvedBeforeInstall',
    'doNotMiss',
    'locationsToConfirm',
  ];

  const map = new Map<string, string>();
  for (const sectionKey of sectionKeys) {
    for (const item of engineerJobPack[sectionKey]) {
      if (!item.location) continue;
      map.set(item.location.locationId, item.location.label);
    }
  }
  return map;
}

function sortDrafts(a: EvidenceDraft, b: EvidenceDraft): number {
  const taskA = a.taskIds[0] ?? '';
  const taskB = b.taskIds[0] ?? '';
  const taskDelta = taskA.localeCompare(taskB);
  if (taskDelta !== 0) return taskDelta;

  const typeDelta = EVIDENCE_ORDER[a.evidenceType] - EVIDENCE_ORDER[b.evidenceType];
  if (typeDelta !== 0) return typeDelta;

  const requiredDelta = Number(b.required) - Number(a.required);
  if (requiredDelta !== 0) return requiredDelta;

  return a.prompt.localeCompare(b.prompt);
}

function makeDraft(
  task: SurveyFollowUpTaskV1,
  evidenceType: FollowUpEvidenceCaptureType,
  prompt: string,
  acceptanceCriteria: readonly string[],
  required: boolean,
  targetLocation?: string,
): EvidenceDraft {
  return {
    taskIds: [task.taskId],
    evidenceType,
    prompt,
    ...(targetLocation ? { targetLocation } : {}),
    required,
    acceptanceCriteria: stableUnique(acceptanceCriteria),
    linkedLineIds: stableUnique(task.relatedLineIds),
    linkedMaterialIds: stableUnique(task.relatedMaterialIds),
  };
}

function buildTaskEvidenceDrafts(
  task: SurveyFollowUpTaskV1,
  locationById: Map<string, string>,
): EvidenceDraft[] {
  const text = normalize(`${task.title} ${task.description}`);
  const primaryLocationId = task.relatedLocationIds[0];
  const targetLocation = primaryLocationId ? locationById.get(primaryLocationId) : undefined;
  const drafts: EvidenceDraft[] = [];

  if (task.source === 'missing_qualification' || /(^|[^a-z0-9])g3([^a-z0-9]|$)|mcs|qualification|certificate|certification/.test(text)) {
    drafts.push(makeDraft(
      task,
      'qualification_check',
      'Confirm installer qualification status (G3/MCS as applicable) and tag certificate reference/expiry.',
      [
        'Qualification evidence is attached or verified against records.',
        'Required qualification level is explicitly confirmed for this task.',
      ],
      true,
    ));
    return drafts;
  }

  if (/customer|access|disruption|occupant|permission/.test(text) || task.suggestedEvidenceType === 'customer_confirmation') {
    drafts.push(makeDraft(
      task,
      'customer_confirmation',
      'Confirm customer consent for access, disruption windows, and any temporary service interruption.',
      [
        'Customer acknowledgement is captured with date and contact name.',
        'Any access constraints are recorded for install-day planning.',
      ],
      true,
    ));
    return drafts;
  }

  if (task.source === 'unknown_location' || task.suggestedEvidenceType === 'scan_pin' || /unknown location|needs survey/.test(text)) {
    drafts.push(makeDraft(
      task,
      'scan_pin',
      'Drop an Atlas Scan pin at the confirmed on-site location.',
      [
        'Scan pin is placed at the exact install/check location.',
        'Pin label clearly identifies what was located.',
      ],
      true,
      targetLocation ?? 'Needs survey',
    ));
    drafts.push(makeDraft(
      task,
      'photo',
      'Capture a wide-angle photo proving the pinned location and access path.',
      [
        'Photo shows pinned location context clearly.',
        'Entry/access route is visible and unobstructed in the image.',
      ],
      true,
      targetLocation ?? 'Needs survey',
    ));
    return drafts;
  }

  if (/tundish|discharge/.test(text)) {
    drafts.push(makeDraft(
      task,
      'photo',
      'Take photos of the full discharge route including tundish, termination point, and visibility of pipe run.',
      [
        'Tundish is visible in at least one image.',
        'Termination point and discharge route continuity are visible.',
      ],
      true,
      targetLocation ?? 'Discharge route',
    ));
    return drafts;
  }

  if (/expansion vessel/.test(text)) {
    drafts.push(makeDraft(
      task,
      'measurement',
      'Measure available space and key clearances for expansion vessel placement.',
      [
        'Measured dimensions include width, height, depth, and service clearance.',
        'Measurement values are recorded in metric units.',
      ],
      true,
      targetLocation ?? 'Boiler/cylinder area',
    ));
    drafts.push(makeDraft(
      task,
      'note',
      'Record expansion vessel check notes (mounting feasibility and connection route).',
      [
        'Check note states if route and mounting are feasible.',
      ],
      false,
      targetLocation ?? 'Boiler/cylinder area',
    ));
    return drafts;
  }

  if (/cylinder|cupboard|space/.test(text)) {
    drafts.push(makeDraft(
      task,
      'measurement',
      'Measure available cylinder cupboard space for proposed storage solution.',
      [
        'Cupboard dimensions are captured as width, height, and depth.',
        'Obstructions and clearance constraints are noted.',
      ],
      true,
      targetLocation ?? 'Cylinder cupboard',
    ));
    return drafts;
  }

  if (/filling loop|pressure gauge/.test(text)) {
    drafts.push(makeDraft(
      task,
      'photo',
      'Photograph filling loop and pressure gauge arrangement, including surrounding service access.',
      [
        'Filling loop and pressure gauge are both visible.',
        'Image quality is sufficient to confirm component arrangement.',
      ],
      true,
      targetLocation ?? 'Boiler location',
    ));
    return drafts;
  }

  if (/loft|tank|cold feed|vent/.test(text)) {
    drafts.push(makeDraft(
      task,
      'measurement',
      'Measure loft tank-related pipework route lengths and available service clearances.',
      [
        'Pipe route measurements are captured in metric units.',
        'Any restricted access points are clearly noted.',
      ],
      true,
      targetLocation ?? 'Loft',
    ));
    drafts.push(makeDraft(
      task,
      'photo',
      'Photograph loft tank pipework route and capping/removal points.',
      [
        'Pipework route is visible end-to-end or across multiple linked images.',
        'Capping/removal points are visible.',
      ],
      true,
      targetLocation ?? 'Loft',
    ));
    return drafts;
  }

  if (task.suggestedEvidenceType === 'measurement') {
    drafts.push(makeDraft(
      task,
      'measurement',
      `Capture required on-site measurements for "${task.title}".`,
      ['Required measurement values are captured clearly and in metric units.'],
      true,
      targetLocation,
    ));
    return drafts;
  }

  if (task.suggestedEvidenceType === 'photo') {
    drafts.push(makeDraft(
      task,
      'photo',
      `Capture site photos for "${task.title}" showing component and route context.`,
      ['Photo set clearly shows the component and its connection/route context.'],
      true,
      targetLocation,
    ));
    return drafts;
  }

  drafts.push(makeDraft(
    task,
    'note',
    `Record survey note resolving "${task.title}".`,
    ['Survey note clearly resolves what remains unknown.'],
    true,
    targetLocation,
  ));
  return drafts;
}

export function buildFollowUpEvidenceCapturePlan(
  tasks: readonly SurveyFollowUpTaskV1[],
  engineerJobPack: EngineerJobPackV1,
  specificationLines: readonly SpecificationLineV1[],
  materialsSchedule: readonly SuggestedMaterialLineV1[],
): FollowUpEvidenceCapturePlanV1 {
  const sortedTasks = [...tasks].sort((a, b) => a.taskId.localeCompare(b.taskId));
  const locationById = collectLocationById(engineerJobPack);
  const validLineIds = new Set(specificationLines.map((line) => line.lineId));
  const validMaterialIds = new Set(materialsSchedule.map((material) => material.materialId));

  const drafts: EvidenceDraft[] = [];
  for (const task of sortedTasks) {
    const taskDrafts = buildTaskEvidenceDrafts(task, locationById).map((draft) => ({
      ...draft,
      linkedLineIds: sortStrings(draft.linkedLineIds.filter((lineId) => validLineIds.has(lineId))),
      linkedMaterialIds: sortStrings(draft.linkedMaterialIds.filter((materialId) => validMaterialIds.has(materialId))),
    }));
    drafts.push(...taskDrafts);
  }

  const sortedDrafts = drafts.sort(sortDrafts);
  const withIds: FollowUpEvidenceCaptureItemV1[] = sortedDrafts.map((draft, index) => ({
    evidenceId: `evidence_${String(index + 1).padStart(3, '0')}`,
    taskIds: draft.taskIds,
    evidenceType: draft.evidenceType,
    prompt: draft.prompt,
    ...(draft.targetLocation ? { targetLocation: draft.targetLocation } : {}),
    required: draft.required,
    acceptanceCriteria: draft.acceptanceCriteria,
    linkedLineIds: draft.linkedLineIds,
    linkedMaterialIds: draft.linkedMaterialIds,
  }));

  const requiredEvidence = withIds.filter((item) => item.required);
  const optionalEvidence = withIds.filter((item) => !item.required);
  const unresolvedAfterCapture = stableUnique(
    requiredEvidence
      .filter((item) => item.evidenceType === 'qualification_check' || item.evidenceType === 'customer_confirmation')
      .flatMap((item) => item.taskIds),
  );

  const taskSeed = sortedTasks.map((task) => task.taskId).join('|');
  return {
    planId: `follow_up_evidence_plan_v1_${hashString(taskSeed)}`,
    tasks: sortedTasks,
    requiredEvidence,
    optionalEvidence,
    unresolvedAfterCapture,
  };
}

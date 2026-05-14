import type {
  FollowUpEvidenceCapturePlanV1,
  FollowUpScanHandoffV1,
  SurveyFollowUpTaskPriority,
  SurveyFollowUpTaskV1,
} from '../../specification/followUps';
import type { EngineerJobPackV1 } from '../../specification/handover';
import type { SpecificationReadinessV1 } from '../../specification/readiness';
import type {
  EvidenceRequirementV1,
  OperationalDigestInstallPhaseV1,
  OperationalDigestV1,
  OperationalIntentGroupV1,
  OperationalLocationStateV1,
} from './OperationalDigestV1';
import { classifyWorkflowVisibility } from '../visibility/classifyWorkflowVisibility';
import type { WorkflowVisibility } from '../visibility/WorkflowVisibilityV1';

interface BuildOperationalDigestInput {
  readonly tasks: readonly SurveyFollowUpTaskV1[];
  readonly readiness: SpecificationReadinessV1;
  readonly evidencePlan: FollowUpEvidenceCapturePlanV1;
  readonly scanHandoff: FollowUpScanHandoffV1;
  readonly engineerJobPack: EngineerJobPackV1;
  readonly primaryItemLimit?: number;
}

type EngineerSectionKey = Exclude<keyof EngineerJobPackV1, 'jobPackVersion' | 'surveyData' | 'scanData'>;

interface DigestDraft {
  readonly id: string;
  title: string;
  summary: string;
  owner: OperationalIntentGroupV1['owner'];
  installPhase: OperationalDigestInstallPhaseV1;
  severity: OperationalIntentGroupV1['severity'];
  linkedTaskIds: string[];
  evidenceRequired: EvidenceRequirementV1[];
  unresolvedDependencies: string[];
  locationStates: OperationalLocationStateV1[];
  visibility: WorkflowVisibility[];
}

const PRIORITY_ORDER: Readonly<Record<SurveyFollowUpTaskPriority, number>> = {
  blocker: 0,
  important: 1,
  optional: 2,
};

const LOCATION_STATE_ORDER: Readonly<Record<OperationalLocationStateV1, number>> = {
  unresolved: 3,
  needs_survey: 2,
  inferred: 1,
  confirmed: 0,
};

const ENGINEER_SECTION_KEYS: readonly EngineerSectionKey[] = [
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

function stableUnique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return unique;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function hashString(value: string): string {
  // FNV-1a 32-bit hash constants (offset basis and prime).
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function summarizeDescription(description: string): string {
  return description
    .replace(/^Readiness blocker:\s*/i, '')
    .replace(/^Resolve unresolved check:\s*/i, '')
    .replace(/^Material requires survey confirmation:\s*/i, '')
    .replace(/^Location to confirm on survey:\s*/i, '')
    .trim();
}

function inferInstallPhase(task: SurveyFollowUpTaskV1): OperationalDigestInstallPhaseV1 {
  if (task.assignedRole === 'engineer') return 'installation';
  if (task.assignedRole === 'office') return 'coordination';
  if (task.source === 'missing_qualification') return 'coordination';
  // Surveyor-owned and unresolved field checks default to survey phase.
  return 'survey';
}

function collectLocationStateById(engineerJobPack: EngineerJobPackV1): Map<string, OperationalLocationStateV1> {
  const map = new Map<string, OperationalLocationStateV1>();
  for (const sectionKey of ENGINEER_SECTION_KEYS) {
    for (const item of engineerJobPack[sectionKey]) {
      const location = item.location;
      if (!location) continue;
      if (location.type === 'unknown') {
        map.set(location.locationId, 'needs_survey');
        continue;
      }
      if (location.confidence === 'confirmed') map.set(location.locationId, 'confirmed');
      else if (location.confidence === 'inferred') map.set(location.locationId, 'inferred');
      else map.set(location.locationId, 'needs_survey');
    }
  }
  return map;
}

function pickWorstLocationState(states: readonly OperationalLocationStateV1[]): OperationalLocationStateV1 {
  if (states.length === 0) return 'unresolved';
  return states.reduce<OperationalLocationStateV1>((worst, state) => (
    LOCATION_STATE_ORDER[state] > LOCATION_STATE_ORDER[worst] ? state : worst
  ), states[0]);
}

function buildDraftFromTask(task: SurveyFollowUpTaskV1, locationStateById: Map<string, OperationalLocationStateV1>): DigestDraft {
  const stateCandidates = task.relatedLocationIds
    .map((locationId) => locationStateById.get(locationId) ?? 'unresolved');
  const keySeed = normalize(task.title);
  return {
    id: `intent_${hashString(keySeed)}`,
    title: task.title,
    summary: summarizeDescription(task.description),
    owner: task.assignedRole,
    installPhase: inferInstallPhase(task),
    severity: task.priority,
    linkedTaskIds: [task.taskId],
    evidenceRequired: [],
    unresolvedDependencies: [],
    locationStates: stateCandidates.length > 0 ? stateCandidates : ['unresolved'],
    visibility: [...task.visibility],
  };
}

function mergeDraftTask(existing: DigestDraft, task: SurveyFollowUpTaskV1, locationStateById: Map<string, OperationalLocationStateV1>) {
  const summarizedDescription = summarizeDescription(task.description);
  existing.severity = PRIORITY_ORDER[task.priority] < PRIORITY_ORDER[existing.severity]
    ? task.priority
    : existing.severity;
  existing.owner = task.priority === 'blocker' ? task.assignedRole : existing.owner;
  existing.installPhase = task.priority === 'blocker' ? inferInstallPhase(task) : existing.installPhase;
  existing.linkedTaskIds = stableUnique([...existing.linkedTaskIds, task.taskId]);
  existing.locationStates = [
    ...existing.locationStates,
    ...task.relatedLocationIds.map((locationId) => locationStateById.get(locationId) ?? 'unresolved'),
  ];
  if (existing.summary.length < summarizedDescription.length) {
    existing.summary = summarizedDescription;
  }
  existing.visibility = stableUnique([...existing.visibility, ...task.visibility]) as WorkflowVisibility[];
}

function attachEvidence(
  draftsByTaskId: ReadonlyMap<string, DigestDraft>,
  evidencePlan: FollowUpEvidenceCapturePlanV1,
) {
  const evidenceById = new Map<string, EvidenceRequirementV1>();
  for (const item of evidencePlan.requiredEvidence) {
    const requirement: EvidenceRequirementV1 = {
      evidenceId: item.evidenceId,
      evidenceType: item.evidenceType,
      prompt: item.prompt,
      required: item.required,
      ...(item.targetLocation ? { targetLocation: item.targetLocation } : {}),
      acceptanceCriteria: item.acceptanceCriteria,
      linkedLineIds: item.linkedLineIds,
      linkedMaterialIds: item.linkedMaterialIds,
      visibility: stableUnique([
        ...item.visibility,
        ...classifyWorkflowVisibility({ text: item.prompt }),
      ]) as WorkflowVisibility[],
    };
    evidenceById.set(item.evidenceId, requirement);
  }

  for (const item of evidencePlan.requiredEvidence) {
    for (const taskId of item.taskIds) {
      const draft = draftsByTaskId.get(taskId);
      const evidence = evidenceById.get(item.evidenceId);
      if (!draft || !evidence) continue;
      const exists = draft.evidenceRequired.some((entry) => entry.evidenceId === evidence.evidenceId);
      if (!exists) draft.evidenceRequired.push(evidence);
    }
  }
}

function attachUnresolvedDependencies(
  draftsByTaskId: ReadonlyMap<string, DigestDraft>,
  readiness: SpecificationReadinessV1,
  scanHandoff: FollowUpScanHandoffV1,
) {
  for (const dependency of scanHandoff.unresolvedDependencies) {
    for (const taskId of dependency.linkedTaskIds) {
      const draft = draftsByTaskId.get(taskId);
      if (!draft) continue;
      draft.unresolvedDependencies = stableUnique([
        ...draft.unresolvedDependencies,
        dependency.prompt,
      ]);
    }
  }

  const readinessSignals = stableUnique([
    ...readiness.blockingReasons,
    ...readiness.unresolvedChecks,
  ]);
  const seenDrafts = new Set<DigestDraft>();
  for (const draft of draftsByTaskId.values()) {
    if (seenDrafts.has(draft)) continue;
    seenDrafts.add(draft);
    const taskKey = normalize(`${draft.title} ${draft.summary}`);
    const matched = readinessSignals.filter((signal) => {
      const normalizedSignal = normalize(signal);
      if (normalizedSignal.length === 0) return false;
      return taskKey.includes(normalizedSignal) || normalizedSignal.includes(taskKey);
    });
    if (matched.length === 0) continue;
    draft.unresolvedDependencies = stableUnique([...draft.unresolvedDependencies, ...matched]);
  }
}

function toDigestGroup(draft: DigestDraft): OperationalIntentGroupV1 {
  return {
    id: draft.id,
    title: draft.title,
    summary: draft.summary.length > 0 ? draft.summary : 'Resolve this operational intent before handover.',
    owner: draft.owner,
    installPhase: draft.installPhase,
    severity: draft.severity,
    linkedTaskIds: stableUnique(draft.linkedTaskIds),
    evidenceRequired: [...draft.evidenceRequired].sort((a, b) => a.prompt.localeCompare(b.prompt)),
    unresolvedDependencies: stableUnique(draft.unresolvedDependencies),
    locationState: pickWorstLocationState(draft.locationStates),
    visibility: stableUnique(draft.visibility) as WorkflowVisibility[],
  };
}

export function buildOperationalDigest(input: BuildOperationalDigestInput): OperationalDigestV1 {
  const {
    tasks,
    readiness,
    evidencePlan,
    scanHandoff,
    engineerJobPack,
    primaryItemLimit = 12,
  } = input;

  const locationStateById = collectLocationStateById(engineerJobPack);
  const draftsByIntent = new Map<string, DigestDraft>();
  const draftsByTaskId = new Map<string, DigestDraft>();

  for (const task of tasks) {
    const intentKey = normalize(task.title);
    const existing = draftsByIntent.get(intentKey);
    if (!existing) {
      const draft = buildDraftFromTask(task, locationStateById);
      draftsByIntent.set(intentKey, draft);
      draftsByTaskId.set(task.taskId, draft);
      continue;
    }
    mergeDraftTask(existing, task, locationStateById);
    draftsByTaskId.set(task.taskId, existing);
  }

  attachEvidence(draftsByTaskId, evidencePlan);
  attachUnresolvedDependencies(draftsByTaskId, readiness, scanHandoff);

  const items = Array.from(draftsByIntent.values(), toDigestGroup)
    .sort((a, b) => {
      const severityDelta = PRIORITY_ORDER[a.severity] - PRIORITY_ORDER[b.severity];
      if (severityDelta !== 0) return severityDelta;
      const ownerDelta = a.owner.localeCompare(b.owner);
      if (ownerDelta !== 0) return ownerDelta;
      return a.title.localeCompare(b.title);
    });

  return {
    digestVersion: 'v1',
    generatedAt: new Date().toISOString(),
    primaryItemLimit,
    totalItems: items.length,
    items,
  };
}

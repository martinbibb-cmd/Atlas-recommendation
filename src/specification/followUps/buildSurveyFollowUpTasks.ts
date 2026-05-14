import type { EngineerJobPackItemV1, EngineerJobPackV1 } from '../handover';
import type { SuggestedMaterialLineV1 } from '../materials';
import type { SpecificationReadinessV1 } from '../readiness';
import type { SpecificationLineV1 } from '../specLines';
import { classifyWorkflowVisibility } from '../../workflow/visibility/classifyWorkflowVisibility';
import type {
  SurveyFollowUpTaskAssignedRole,
  SurveyFollowUpTaskEvidenceType,
  SurveyFollowUpTaskPriority,
  SurveyFollowUpTaskSource,
  SurveyFollowUpTaskV1,
} from './SurveyFollowUpTaskV1';
import type { WorkflowVisibility } from '../../workflow/visibility/WorkflowVisibilityV1';

interface TaskSeed {
  readonly title: string;
  readonly description: string;
  readonly source: SurveyFollowUpTaskSource;
  readonly priority: SurveyFollowUpTaskPriority;
  readonly assignedRole: SurveyFollowUpTaskAssignedRole;
  readonly relatedSectionKey?: string;
  readonly relatedLineIds: readonly string[];
  readonly relatedMaterialIds: readonly string[];
  readonly relatedLocationIds: readonly string[];
  readonly suggestedEvidenceType: SurveyFollowUpTaskEvidenceType;
  readonly visibility: readonly WorkflowVisibility[];
}

type EngineerSectionKey = Exclude<keyof EngineerJobPackV1, 'jobPackVersion' | 'surveyData' | 'scanData'>;

interface EngineerItemWithSection {
  readonly sectionKey: EngineerSectionKey;
  readonly item: EngineerJobPackItemV1;
}

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

const PRIORITY_ORDER: Readonly<Record<SurveyFollowUpTaskPriority, number>> = {
  blocker: 0,
  important: 1,
  optional: 2,
};

const ROLE_ORDER: Readonly<Record<SurveyFollowUpTaskAssignedRole, number>> = {
  surveyor: 0,
  office: 1,
  engineer: 2,
};

const SOURCE_SPECIFICITY: Readonly<Record<SurveyFollowUpTaskSource, number>> = {
  missing_qualification: 0,
  unknown_location: 1,
  material_needs_survey: 2,
  unresolved_check: 3,
  readiness_blocker: 4,
};

const EVIDENCE_SPECIFICITY: Readonly<Record<SurveyFollowUpTaskEvidenceType, number>> = {
  qualification_check: 0,
  scan_pin: 1,
  measurement: 2,
  photo: 3,
  customer_confirmation: 4,
  note: 5,
};

function normalizeText(value: string): string {
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

function collectEngineerItems(engineerJobPack: EngineerJobPackV1): EngineerItemWithSection[] {
  const items: EngineerItemWithSection[] = [];
  for (const sectionKey of ENGINEER_SECTION_KEYS) {
    for (const item of engineerJobPack[sectionKey]) {
      items.push({ sectionKey, item });
    }
  }
  return items;
}

function inferEvidenceType(text: string): SurveyFollowUpTaskEvidenceType {
  const normalized = normalizeText(text);
  if (/\bg3\b|qualification|certif|mcs/.test(normalized)) return 'qualification_check';
  if (normalized.includes('unknown location') || normalized.includes('needs survey') || normalized.includes('location')) return 'scan_pin';
  if (normalized.includes('sizing') || normalized.includes('expansion vessel') || normalized.includes('capacity') || normalized.includes('flow')) return 'measurement';
  if (normalized.includes('customer')) return 'customer_confirmation';
  if (normalized.includes('tundish') || normalized.includes('discharge') || normalized.includes('route') || normalized.includes('loft') || normalized.includes('radiator') || normalized.includes('emitter') || normalized.includes('flush')) return 'photo';
  return 'note';
}

function inferRole(text: string, source: SurveyFollowUpTaskSource): SurveyFollowUpTaskAssignedRole {
  if (source === 'unknown_location' || source === 'material_needs_survey') return 'surveyor';
  if (source === 'missing_qualification') return 'office';

  const normalized = normalizeText(text);
  if (/\bg3\b|qualification|certif|mcs/.test(normalized)) return 'office';
  if (/commissioning|handover|installer validation/.test(normalized)) return 'engineer';
  return 'surveyor';
}

function inferTitle(seedText: string): string {
  const normalized = normalizeText(seedText);

  if (normalized.includes('expansion vessel')) return 'Confirm expansion vessel sizing basis';
  if (normalized.includes('tundish') || normalized.includes('discharge route')) return 'Confirm tundish/discharge route';
  if (normalized.includes('g3') && normalized.includes('qualification')) return 'Confirm G3-qualified installer availability';
  if (normalized.includes('loft') && (normalized.includes('tank') || normalized.includes('capping') || normalized.includes('removal'))) {
    return 'Confirm loft tank removal/capping route';
  }
  if (normalized.includes('emitter') || normalized.includes('radiator suitability')) return 'Confirm emitter/radiator suitability';
  if (normalized.includes('unknown') && (normalized.includes('plant') || normalized.includes('cylinder')) && normalized.includes('location')) {
    return 'Confirm unknown plant/cylinder location';
  }
  if (normalized.includes('flush') && normalized.includes('radiator')) return 'Confirm powerflush risk where old radiators flagged';

  const trimmed = seedText.trim();
  const withoutPrefix = trimmed
    .replace(/^Missing required qualification:\s*/i, '')
    .replace(/^Material needs survey confirmation:\s*/i, '')
    .replace(/^Safety\/compliance check unresolved:\s*/i, '')
    .replace(/^Installer validation unresolved:\s*/i, '')
    .replace(/^Location to confirm on survey in [^:]+:\s*/i, '')
    .replace(/^Specification line needs check:\s*/i, '');

  const firstChunk = withoutPrefix.split(/\s+—\s+/)[0]?.trim() ?? '';
  if (firstChunk.length === 0) return 'Confirm unresolved survey item';
  if (/^confirm\b/i.test(firstChunk)) return firstChunk;
  return `Confirm ${firstChunk.charAt(0).toLowerCase()}${firstChunk.slice(1)}`;
}

function buildDescription(prefix: string, detail: string, extraDetail?: string): string {
  const parts = [prefix, detail];
  if (extraDetail && extraDetail.trim().length > 0) parts.push(extraDetail.trim());
  return parts.join(' ');
}

function matchRelatedLineIds(text: string, lines: readonly SpecificationLineV1[]): string[] {
  const normalized = normalizeText(text);
  const related: string[] = [];
  for (const line of lines) {
    const label = normalizeText(line.label);
    if (label.length > 0 && normalized.includes(label)) {
      related.push(line.lineId);
    }
  }
  return stableUnique(related);
}

function matchRelatedMaterialIds(text: string, materials: readonly SuggestedMaterialLineV1[]): string[] {
  const normalized = normalizeText(text);
  const related: string[] = [];
  for (const material of materials) {
    const label = normalizeText(material.label);
    if (label.length > 0 && normalized.includes(label)) {
      related.push(material.materialId);
    }
  }
  return stableUnique(related);
}

function matchRelatedLocationIds(text: string, engineerItems: readonly EngineerItemWithSection[]): string[] {
  const normalized = normalizeText(text);
  const related: string[] = [];
  for (const entry of engineerItems) {
    const location = entry.item.location;
    if (!location) continue;
    const label = normalizeText(location.label);
    if (label.length > 0 && normalized.includes(label)) {
      related.push(location.locationId);
    }
  }
  return stableUnique(related);
}

function mergeSeeds(existing: TaskSeed, incoming: TaskSeed): TaskSeed {
  const incomingSourceIsMoreSpecific = SOURCE_SPECIFICITY[incoming.source] < SOURCE_SPECIFICITY[existing.source];
  const source = incomingSourceIsMoreSpecific ? incoming.source : existing.source;
  const priority = PRIORITY_ORDER[incoming.priority] < PRIORITY_ORDER[existing.priority]
    ? incoming.priority
    : existing.priority;
  const suggestedEvidenceType = EVIDENCE_SPECIFICITY[incoming.suggestedEvidenceType] < EVIDENCE_SPECIFICITY[existing.suggestedEvidenceType]
    ? incoming.suggestedEvidenceType
    : existing.suggestedEvidenceType;

  return {
    title: existing.title,
    description: existing.description.length >= incoming.description.length
      ? existing.description
      : incoming.description,
    source,
    priority,
    assignedRole: incomingSourceIsMoreSpecific ? incoming.assignedRole : existing.assignedRole,
    relatedSectionKey: existing.relatedSectionKey ?? incoming.relatedSectionKey,
    relatedLineIds: stableUnique([...existing.relatedLineIds, ...incoming.relatedLineIds]),
    relatedMaterialIds: stableUnique([...existing.relatedMaterialIds, ...incoming.relatedMaterialIds]),
    relatedLocationIds: stableUnique([...existing.relatedLocationIds, ...incoming.relatedLocationIds]),
    suggestedEvidenceType,
    visibility: stableUnique([...existing.visibility, ...incoming.visibility]) as WorkflowVisibility[],
  };
}

function sortTaskSeeds(a: TaskSeed, b: TaskSeed): number {
  const priorityDelta = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (priorityDelta !== 0) return priorityDelta;

  const roleDelta = ROLE_ORDER[a.assignedRole] - ROLE_ORDER[b.assignedRole];
  if (roleDelta !== 0) return roleDelta;

  return a.title.localeCompare(b.title);
}

export function buildSurveyFollowUpTasks(
  readiness: SpecificationReadinessV1,
  specificationLines: readonly SpecificationLineV1[],
  materialsSchedule: readonly SuggestedMaterialLineV1[],
  engineerJobPack: EngineerJobPackV1,
): SurveyFollowUpTaskV1[] {
  const lineById = new Map(specificationLines.map((line) => [line.lineId, line]));
  const engineerItems = collectEngineerItems(engineerJobPack);

  const seedsByKey = new Map<string, TaskSeed>();

  const addSeed = (seed: TaskSeed) => {
    const key = normalizeText(seed.title);
    const existing = seedsByKey.get(key);
    if (!existing) {
      seedsByKey.set(key, {
        ...seed,
        relatedLineIds: stableUnique(seed.relatedLineIds),
        relatedMaterialIds: stableUnique(seed.relatedMaterialIds),
        relatedLocationIds: stableUnique(seed.relatedLocationIds),
      });
      return;
    }
    seedsByKey.set(key, mergeSeeds(existing, seed));
  };

  for (const blocker of readiness.blockingReasons) {
    const source: SurveyFollowUpTaskSource = /missing required qualification|\bg3\b/i.test(blocker)
      ? 'missing_qualification'
      : /material needs survey confirmation/i.test(blocker)
        ? 'material_needs_survey'
        : /unknown location|location to confirm on survey/i.test(blocker)
          ? 'unknown_location'
          : 'readiness_blocker';

    const title = inferTitle(blocker);
    const assignedRole = inferRole(blocker, source);
    const relatedLineIds = matchRelatedLineIds(blocker, specificationLines);
    const relatedMaterialIds = matchRelatedMaterialIds(blocker, materialsSchedule);
    const relatedLocationIds = matchRelatedLocationIds(blocker, engineerItems);

    addSeed({
      title,
      description: buildDescription('Readiness blocker:', blocker),
      source,
      priority: 'blocker',
      assignedRole,
      relatedSectionKey: relatedLineIds[0] ? lineById.get(relatedLineIds[0])?.sectionKey : undefined,
      relatedLineIds,
      relatedMaterialIds,
      relatedLocationIds,
      suggestedEvidenceType: inferEvidenceType(blocker),
      visibility: classifyWorkflowVisibility({ text: blocker }),
    });
  }

  for (const check of readiness.unresolvedChecks) {
    const title = inferTitle(check);
    const relatedLineIds = matchRelatedLineIds(check, specificationLines);
    const relatedMaterialIds = matchRelatedMaterialIds(check, materialsSchedule);
    const relatedLocationIds = matchRelatedLocationIds(check, engineerItems);

    addSeed({
      title,
      description: buildDescription('Resolve unresolved check:', check),
      source: 'unresolved_check',
      priority: 'important',
      assignedRole: inferRole(check, 'unresolved_check'),
      relatedSectionKey: relatedLineIds[0] ? lineById.get(relatedLineIds[0])?.sectionKey : undefined,
      relatedLineIds,
      relatedMaterialIds,
      relatedLocationIds,
      suggestedEvidenceType: inferEvidenceType(check),
      visibility: classifyWorkflowVisibility({ text: check, preferCustomerSummary: true }),
    });
  }

  for (const material of materialsSchedule) {
    if (material.confidence !== 'needs_survey') continue;

    const seedText = `${material.label} ${material.unresolvedChecks.join(' ')}`;
    const title = inferTitle(seedText);
    addSeed({
      title,
      description: buildDescription(
        'Material requires survey confirmation:',
        material.label,
        material.unresolvedChecks.length > 0 ? material.unresolvedChecks.join(' ') : undefined,
      ),
      source: 'material_needs_survey',
      priority: material.requiredForInstall ? 'blocker' : 'important',
      assignedRole: 'surveyor',
      relatedSectionKey: material.sourceLineIds[0] ? lineById.get(material.sourceLineIds[0])?.sectionKey : undefined,
      relatedLineIds: material.sourceLineIds,
      relatedMaterialIds: [material.materialId],
      relatedLocationIds: [],
      suggestedEvidenceType: inferEvidenceType(seedText),
      visibility: classifyWorkflowVisibility({ text: seedText }),
    });
  }

  for (const entry of engineerItems) {
    if (entry.item.location?.type !== 'unknown') continue;

    const itemText = entry.item.text;
    const locationId = entry.item.location.locationId;
    addSeed({
      title: inferTitle(`unknown location ${itemText}`),
      description: buildDescription(
        'Location to confirm on survey:',
        itemText,
        'Capture scan pin and supporting photo evidence.',
      ),
      source: 'unknown_location',
      priority: entry.item.mustConfirmOnSite ? 'blocker' : 'important',
      assignedRole: 'surveyor',
      relatedSectionKey: entry.sectionKey,
      relatedLineIds: entry.item.sourceLineId ? [entry.item.sourceLineId] : [],
      relatedMaterialIds: [],
      relatedLocationIds: [locationId],
      suggestedEvidenceType: 'scan_pin',
      visibility: classifyWorkflowVisibility({ text: itemText, preferCustomerSummary: true }),
    });
  }

  const seeds = [...seedsByKey.values()].sort(sortTaskSeeds);
  return seeds.map((seed, index) => ({
    taskId: `follow_up_${String(index + 1).padStart(3, '0')}`,
    title: seed.title,
    description: seed.description,
    source: seed.source,
    priority: seed.priority,
    assignedRole: seed.assignedRole,
    ...(seed.relatedSectionKey ? { relatedSectionKey: seed.relatedSectionKey } : {}),
    relatedLineIds: seed.relatedLineIds,
    relatedMaterialIds: seed.relatedMaterialIds,
    relatedLocationIds: seed.relatedLocationIds,
    suggestedEvidenceType: seed.suggestedEvidenceType,
    visibility: seed.visibility,
    resolved: false,
  }));
}

import type { EngineInputV2_3Contract } from '../../../contracts/EngineInputV2_3';
import type {
  RequiredValidation,
  SuggestedImplementationPackV1,
  UnresolvedRisk,
} from '../../SuggestedImplementationPackV1';
import type { ScanDataInput } from '../../buildSuggestedImplementationPack';
import type { SpecificationLineV1 } from '../../specLines/SpecificationLineV1';
import type { ScopePackHandoverV1 } from '../ScopePackHandoverV1';
import type { EngineerJobPackItemV1, EngineerJobPackV1 } from './EngineerJobPackV1';
import { resolveEngineerJobLocation } from './locationResolver';

const MAX_BULLETS_PER_SECTION = 7;
const MAX_BULLET_TEXT_LENGTH = 140;
const REMOVE_ACTION_REGEX = /remove|disconnect|decommission|cap|capping/i;
const LOCATION_ROUTE_REGEX = /route|routing|location|loft|discharge|pipe/i;
const CHECK_ON_SITE_REGEX = /confirm|validate|check|test/i;
const COMMISSIONING_G3_REGEX = /commission|certificate|g3/i;
const CUSTOMER_BENEFIT_TERMS = [
  'why this wins',
  'plain english',
  'save',
  'savings',
  'educational',
  'analogy',
  'comfort',
  'peace of mind',
];

const HOT_WATER_STRATEGY_LABELS: Readonly<Record<SuggestedImplementationPackV1['hotWater']['strategy'], string>> = {
  on_demand: 'on-demand hot water',
  stored_unvented: 'Stored unvented',
  stored_vented: 'Stored vented',
  stored_mixergy: 'Stored Mixergy',
  heat_pump_cylinder: 'Heat pump cylinder',
  unknown: 'Unknown',
};

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function clipText(text: string): string {
  const normalized = normalizeText(text);
  if (normalized.length <= MAX_BULLET_TEXT_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_BULLET_TEXT_LENGTH - 1).trimEnd()}…`;
}

function isCustomerBenefitLanguage(text: string): boolean {
  const lowerText = text.toLowerCase();
  return CUSTOMER_BENEFIT_TERMS.some((term) => lowerText.includes(term));
}

function deriveRelatedRiskIdFromValidation(validationId: string): string | undefined {
  return validationId.startsWith('validation_') ? validationId.slice('validation_'.length) : undefined;
}

function stableDeduplicate(items: readonly EngineerJobPackItemV1[]): EngineerJobPackItemV1[] {
  const seen = new Set<string>();
  const deduped: EngineerJobPackItemV1[] = [];
  for (const item of items) {
    const key = `${item.text}|${item.sourceLineId ?? ''}|${item.relatedRiskId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function sortUnresolvedNearTop(items: readonly EngineerJobPackItemV1[]): EngineerJobPackItemV1[] {
  return [...items].sort((a, b) => {
    const aRank = a.mustConfirmOnSite ? 0 : 1;
    const bRank = b.mustConfirmOnSite ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    if (a.text < b.text) return -1;
    if (a.text > b.text) return 1;
    return 0;
  });
}

function finalizeSection(items: readonly EngineerJobPackItemV1[]): EngineerJobPackItemV1[] {
  const filtered = items.filter((item) => !isCustomerBenefitLanguage(item.text));
  const sanitized = filtered
    .map((item) => ({
      ...item,
      text: clipText(item.text),
      location: item.location ? { ...item.location, label: clipText(item.location.label) } : undefined,
    }))
    .filter((item) => item.text.length > 0);
  return stableDeduplicate(sortUnresolvedNearTop(sanitized)).slice(0, MAX_BULLETS_PER_SECTION);
}

function toItem(
  text: string,
  options: Omit<EngineerJobPackItemV1, 'text' | 'confidence'> & {
    confidence?: EngineerJobPackItemV1['confidence'];
  } = {},
): EngineerJobPackItemV1 {
  const normalized = normalizeText(text);
  return {
    text: normalized,
    confidence: options.confidence ?? 'inferred',
    sourceLineId: options.sourceLineId,
    location: options.location,
    relatedRiskId: options.relatedRiskId,
    mustConfirmOnSite: options.mustConfirmOnSite,
  };
}

function fromValidation(validation: RequiredValidation): EngineerJobPackItemV1 {
  const text = `${validation.check} — ${validation.reason}`;
  return toItem(text, {
    confidence: 'needs_survey',
    relatedRiskId: deriveRelatedRiskIdFromValidation(validation.id),
    mustConfirmOnSite: true,
  });
}

function fromRisk(risk: UnresolvedRisk): EngineerJobPackItemV1 {
  return toItem(`${risk.description} — ${risk.resolution}`, {
    confidence: 'needs_survey',
    relatedRiskId: risk.id,
    mustConfirmOnSite: true,
  });
}

function toActionLine(label: string, description: string): string {
  if (description === label) return label;
  return `${label} — ${description}`;
}

export function buildEngineerJobPack(
  handover: ScopePackHandoverV1,
  implementationPack: SuggestedImplementationPackV1,
  surveyData?: EngineInputV2_3Contract,
  scanData?: ScanDataInput,
  specificationLines: readonly SpecificationLineV1[],
): EngineerJobPackV1 {
  const engineerLines = handover.engineerInstallNotes.packs.flatMap((pack) => pack.lines);
  const customerLines = handover.customerScopeSummary.packs.flatMap((pack) => pack.lines);
  const unresolvedChecks = handover.engineerInstallNotes.unresolvedChecks;
  const dischargeRequirementItems = (implementationPack.hotWater.dischargeRequirements ?? []).map((requirement) =>
    toItem(requirement, { confidence: 'needs_survey', mustConfirmOnSite: true }));

  const resolveLocations = (items: readonly EngineerJobPackItemV1[]): EngineerJobPackItemV1[] =>
    items.map((item) => ({
      ...item,
      location: resolveEngineerJobLocation({
        text: item.text,
        sourceLineId: item.sourceLineId,
        surveyData,
        scanData,
        implementationPack,
        specificationLines,
      }),
    }));

  const jobSummary = finalizeSection(resolveLocations([
    toItem(`Scenario: ${implementationPack.recommendedScenarioId}`, { confidence: 'confirmed' }),
    toItem(`Heat source: ${implementationPack.heatSource.label}`, { confidence: 'confirmed' }),
    toItem(
      `Hot water strategy: ${HOT_WATER_STRATEGY_LABELS[implementationPack.hotWater.strategy] ?? 'Unknown'}`,
      { confidence: 'confirmed' },
    ),
    ...(surveyData?.occupancy?.peakConcurrentOutlets != null
      ? [toItem(`Peak concurrent outlets: ${surveyData.occupancy.peakConcurrentOutlets}`, { confidence: 'confirmed' })]
      : []),
  ]));

  const fitThis = finalizeSection(resolveLocations([
    ...engineerLines
      .filter((line) => line.lineType === 'included_scope' || line.lineType === 'material_suggestion')
      .map((line) =>
        toItem(toActionLine(line.label, line.description), {
          sourceLineId: line.lineId,
          confidence: 'inferred',
        })),
    ...implementationPack.hotWater.suggestedComponents.map((component) =>
      toItem(`${component.description}${component.suggestedSpec ? ` — ${component.suggestedSpec}` : ''}`, {
        confidence: component.confidence === 'required' ? 'confirmed' : component.confidence === 'suggested' ? 'inferred' : 'needs_survey',
      })),
  ]));

  const removeThis = finalizeSection(resolveLocations([
    ...engineerLines
      .filter((line) =>
        REMOVE_ACTION_REGEX.test(`${line.label} ${line.description}`))
      .map((line) =>
        toItem(toActionLine(line.label, line.description), {
          sourceLineId: line.lineId,
          confidence: 'inferred',
        })),
    ...implementationPack.pipework.topologyNotes
      .filter((note) => REMOVE_ACTION_REGEX.test(note))
      .map((note) => toItem(note, { confidence: 'inferred' })),
  ]));

  const checkThis = finalizeSection(resolveLocations([
    ...implementationPack.safetyCompliance.requiredQualifications
      .filter((qualification) => qualification.id === 'g3_unvented')
      .map((qualification) =>
        toItem(`Confirm ${qualification.label} qualification cover before unvented commissioning`, {
          confidence: 'confirmed',
          mustConfirmOnSite: true,
        })),
    ...implementationPack.allRequiredValidations.map(fromValidation),
    ...implementationPack.allUnresolvedRisks.map(fromRisk),
    ...unresolvedChecks.map((check) =>
      toItem(`${check.label} — ${check.detail}`, {
        confidence: 'needs_survey',
        sourceLineId: check.sourceType === 'line' ? check.sourceId : undefined,
        mustConfirmOnSite: true,
      })),
    ...dischargeRequirementItems,
    ...(implementationPack.hotWater.expansionManagement ?? []).map((management) =>
      toItem(management, { confidence: 'needs_survey', mustConfirmOnSite: true })),
  ]));

  const discussWithCustomer = finalizeSection(resolveLocations([
    ...customerLines.map((line) =>
      toItem(`Confirm with customer: ${toActionLine(line.label, line.description)}`, {
        sourceLineId: line.lineId,
        confidence: 'inferred',
      })),
    ...implementationPack.allUnresolvedRisks
      .filter((risk) => risk.severity !== 'info')
      .map((risk) =>
        toItem(`Discuss site access/constraints: ${risk.description}`, {
          confidence: 'needs_survey',
          relatedRiskId: risk.id,
          mustConfirmOnSite: true,
        })),
  ]));

  const locationsAndRoutes = finalizeSection(resolveLocations([
    ...implementationPack.pipework.routingNotes.map((note) =>
      toItem(note, { confidence: 'needs_survey', mustConfirmOnSite: true })),
    ...engineerLines
      .filter((line) => LOCATION_ROUTE_REGEX.test(`${line.label} ${line.description}`))
      .map((line) =>
        toItem(toActionLine(line.label, line.description), {
          sourceLineId: line.lineId,
          confidence: 'inferred',
          mustConfirmOnSite: true,
        })),
    ...(scanData?.engineerNotes
      ? [toItem(`Engineer note: ${scanData.engineerNotes}`, { confidence: 'inferred', mustConfirmOnSite: true })]
      : []),
  ]));

  const commissioning = finalizeSection(resolveLocations([
    ...implementationPack.commissioning.steps.map((step) => {
      const requiresSiteCheck = CHECK_ON_SITE_REGEX.test(step);
      return toItem(step, {
        confidence: requiresSiteCheck ? 'needs_survey' : 'confirmed',
        mustConfirmOnSite: requiresSiteCheck,
      });
    }),
    ...implementationPack.commissioning.requiredDocumentation.map((doc) =>
      toItem(`Issue/record: ${doc}`, { confidence: 'confirmed' })),
    ...implementationPack.safetyCompliance.requiredComplianceItems
      .filter((item) => COMMISSIONING_G3_REGEX.test(`${item.id} ${item.description}`))
      .map((item) => toItem(`${item.description}${item.regulatoryRef ? ` — ${item.regulatoryRef}` : ''}`, { confidence: 'confirmed' })),
  ]));

  const unresolvedBeforeInstall = finalizeSection(resolveLocations([
    ...implementationPack.allUnresolvedRisks.map(fromRisk),
    ...unresolvedChecks.map((check) =>
      toItem(`${check.label} — ${check.detail}`, {
        confidence: 'needs_survey',
        sourceLineId: check.sourceType === 'line' ? check.sourceId : undefined,
        mustConfirmOnSite: true,
      })),
  ]));

  const doNotMiss = finalizeSection(resolveLocations([
    ...implementationPack.safetyCompliance.requiredQualifications.map((qualification) =>
      toItem(`${qualification.label} — ${qualification.triggeredBy}`, { confidence: 'confirmed' })),
    ...implementationPack.safetyCompliance.requiredComplianceItems
      .filter((item) => item.timing === 'during' || item.timing === 'after')
      .map((item) => toItem(item.description, { confidence: 'confirmed' })),
    ...implementationPack.allUnresolvedRisks
      .filter((risk) => risk.severity === 'required')
      .map(fromRisk),
  ]));

  const locationsToConfirmCandidates: EngineerJobPackItemV1[] = [];
  for (const section of [
    fitThis,
    removeThis,
    checkThis,
    discussWithCustomer,
    locationsAndRoutes,
    commissioning,
    unresolvedBeforeInstall,
    doNotMiss,
  ]) {
    for (const item of section) {
      if (item.location?.confidence === 'needs_survey') {
        locationsToConfirmCandidates.push(item);
      }
    }
  }
  const locationsToConfirm = finalizeSection(locationsToConfirmCandidates);

  return {
    jobPackVersion: 'v1',
    jobSummary,
    fitThis,
    removeThis,
    checkThis,
    discussWithCustomer,
    locationsAndRoutes,
    commissioning,
    unresolvedBeforeInstall,
    doNotMiss,
    locationsToConfirm,
    surveyData,
    scanData,
  };
}

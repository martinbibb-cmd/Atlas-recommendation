import type { EngineInputV2_3Contract } from '../../../contracts/EngineInputV2_3';
import type {
  RequiredValidation,
  SuggestedImplementationPackV1,
  UnresolvedRisk,
} from '../../SuggestedImplementationPackV1';
import type { ScanDataInput } from '../../buildSuggestedImplementationPack';
import type { ScopePackHandoverV1 } from '../ScopePackHandoverV1';
import type { EngineerJobPackItemV1, EngineerJobPackV1 } from './EngineerJobPackV1';

const MAX_BULLETS_PER_SECTION = 7;
const MAX_BULLET_TEXT_LENGTH = 140;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function clipText(text: string): string {
  const normalized = normalizeText(text);
  if (normalized.length <= MAX_BULLET_TEXT_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_BULLET_TEXT_LENGTH - 1).trimEnd()}…`;
}

function isCustomerBenefitLanguage(text: string): boolean {
  return [
    'why this wins',
    'plain english',
    'save',
    'savings',
    'educational',
    'analogy',
    'comfort',
    'peace of mind',
  ].some((term) => text.toLowerCase().includes(term));
}

function deriveRelatedRiskIdFromValidation(validationId: string): string | undefined {
  return validationId.startsWith('validation_') ? validationId.slice('validation_'.length) : undefined;
}

function inferLocation(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('loft')) return 'Loft';
  if (lower.includes('airing cupboard') || lower.includes('cylinder')) return 'Cylinder cupboard';
  if (lower.includes('boiler') || lower.includes('flue')) return 'Boiler location';
  if (lower.includes('tundish') || lower.includes('discharge')) return 'Discharge route';
  if (lower.includes('outdoor') || lower.includes('external')) return 'External wall/outdoor area';
  if (lower.includes('pipe') || lower.includes('flow') || lower.includes('return')) return 'Pipe runs';
  if (lower.includes('controls') || lower.includes('thermostat')) return 'Controls location';
  return undefined;
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
    return a.text.localeCompare(b.text);
  });
}

function finalizeSection(items: readonly EngineerJobPackItemV1[]): EngineerJobPackItemV1[] {
  const sanitized = items
    .map((item) => ({
      ...item,
      text: clipText(item.text),
      location: item.location ? clipText(item.location) : undefined,
    }))
    .filter((item) => item.text.length > 0 && !isCustomerBenefitLanguage(item.text));
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
    location: options.location ?? inferLocation(normalized),
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
): EngineerJobPackV1 {
  const engineerLines = handover.engineerInstallNotes.packs.flatMap((pack) => pack.lines);
  const customerLines = handover.customerScopeSummary.packs.flatMap((pack) => pack.lines);
  const unresolvedChecks = handover.engineerInstallNotes.unresolvedChecks;

  const jobSummary = finalizeSection([
    toItem(`Scenario: ${implementationPack.recommendedScenarioId}`, { confidence: 'confirmed' }),
    toItem(`Heat source: ${implementationPack.heatSource.label}`, { confidence: 'confirmed' }),
    toItem(`Hot water strategy: ${implementationPack.hotWater.strategy.replaceAll('_', ' ')}`, { confidence: 'confirmed' }),
    ...(surveyData?.occupancy?.peakConcurrentOutlets != null
      ? [toItem(`Peak concurrent outlets: ${surveyData.occupancy.peakConcurrentOutlets}`, { confidence: 'confirmed' })]
      : []),
  ]);

  const fitThis = finalizeSection([
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
  ]);

  const removeThis = finalizeSection([
    ...engineerLines
      .filter((line) =>
        /remove|disconnect|decommission|cap|capping/i.test(`${line.label} ${line.description}`))
      .map((line) =>
        toItem(toActionLine(line.label, line.description), {
          sourceLineId: line.lineId,
          confidence: 'inferred',
        })),
    ...implementationPack.pipework.topologyNotes
      .filter((note) => /remove|disconnect|decommission|cap|capping/i.test(note))
      .map((note) => toItem(note, { confidence: 'inferred' })),
  ]);

  const checkThis = finalizeSection([
    ...implementationPack.allRequiredValidations.map(fromValidation),
    ...implementationPack.allUnresolvedRisks.map(fromRisk),
    ...unresolvedChecks.map((check) =>
      toItem(`${check.label} — ${check.detail}`, {
        confidence: 'needs_survey',
        sourceLineId: check.sourceType === 'line' ? check.sourceId : undefined,
        mustConfirmOnSite: true,
      })),
    ...(implementationPack.hotWater.dischargeRequirements ?? []).map((requirement) =>
      toItem(requirement, { confidence: 'needs_survey', mustConfirmOnSite: true })),
    ...(implementationPack.hotWater.expansionManagement ?? []).map((management) =>
      toItem(management, { confidence: 'needs_survey', mustConfirmOnSite: true })),
  ]);

  const discussWithCustomer = finalizeSection([
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
  ]);

  const locationsAndRoutes = finalizeSection([
    ...implementationPack.pipework.routingNotes.map((note) =>
      toItem(note, { confidence: 'needs_survey', mustConfirmOnSite: true })),
    ...(implementationPack.hotWater.dischargeRequirements ?? []).map((note) =>
      toItem(note, { confidence: 'needs_survey', mustConfirmOnSite: true })),
    ...(scanData?.engineerNotes
      ? [toItem(`Engineer note: ${scanData.engineerNotes}`, { confidence: 'inferred', mustConfirmOnSite: true })]
      : []),
  ]);

  const commissioning = finalizeSection([
    ...implementationPack.commissioning.steps.map((step) =>
      toItem(step, {
        confidence: /confirm|validate|check|test/i.test(step) ? 'needs_survey' : 'confirmed',
        mustConfirmOnSite: /confirm|validate|check|test/i.test(step),
      })),
    ...implementationPack.commissioning.requiredDocumentation.map((doc) =>
      toItem(`Issue/record: ${doc}`, { confidence: 'confirmed' })),
    ...implementationPack.safetyCompliance.requiredComplianceItems
      .filter((item) => /commission|certificate|g3/i.test(`${item.id} ${item.description}`))
      .map((item) => toItem(`${item.description}${item.regulatoryRef ? ` — ${item.regulatoryRef}` : ''}`, { confidence: 'confirmed' })),
  ]);

  const unresolvedBeforeInstall = finalizeSection([
    ...implementationPack.allUnresolvedRisks.map(fromRisk),
    ...unresolvedChecks.map((check) =>
      toItem(`${check.label} — ${check.detail}`, {
        confidence: 'needs_survey',
        sourceLineId: check.sourceType === 'line' ? check.sourceId : undefined,
        mustConfirmOnSite: true,
      })),
  ]);

  const doNotMiss = finalizeSection([
    ...implementationPack.safetyCompliance.requiredQualifications.map((qualification) =>
      toItem(`${qualification.label} — ${qualification.triggeredBy}`, { confidence: 'confirmed' })),
    ...implementationPack.safetyCompliance.requiredComplianceItems
      .filter((item) => item.timing === 'during' || item.timing === 'after')
      .map((item) => toItem(item.description, { confidence: 'confirmed' })),
    ...checkThis
      .filter((item) => item.mustConfirmOnSite)
      .slice(0, MAX_BULLETS_PER_SECTION)
      .map((item) =>
        toItem(item.text, {
          confidence: item.confidence,
          location: item.location,
          relatedRiskId: item.relatedRiskId,
          mustConfirmOnSite: true,
        })),
  ]);

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
    surveyData,
    scanData,
  };
}

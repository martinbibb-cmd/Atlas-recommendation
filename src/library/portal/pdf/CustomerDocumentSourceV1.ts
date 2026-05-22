import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../../contracts/CustomerSummaryV1';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import {
  normaliseGeneratedOutputs,
  type GeneratedOutputsV1,
} from '../../../lib/storage/visitReviewLifecycle';
import {
  readCustomerJourneyPackFromGeneratedOutputs,
  type CustomerJourneyPackV1,
  type RecommendationReasonBlockV1,
} from './buildPortalJourneyPrintModel';

export interface CustomerDocumentSourceV1 {
  readonly visitId: string;
  readonly visitReference: string;
  readonly acceptedScenarioId: string;
  readonly selectedSystemLabel: string;
  readonly dhwStrategy: string;
  readonly topologyType: string;
  readonly customerJourneyPack: CustomerJourneyPackV1;
  readonly recommendationReasons: readonly RecommendationReasonBlockV1[];
  readonly generatedOutputs: GeneratedOutputsV1;
}

export type ResolveCustomerDocumentSourceResultV1 =
  | {
      readonly ok: true;
      readonly source: CustomerDocumentSourceV1;
    }
  | {
      readonly ok: false;
      readonly missingFields: readonly string[];
    };

export interface ResolveCustomerDocumentSourceInputV1 {
  readonly visitId?: string;
  readonly visitReference?: string;
  readonly acceptedScenario?: ScenarioResult;
  readonly acceptedScenarioId?: string;
  readonly decision?: AtlasDecisionV1;
  readonly scenarios?: readonly ScenarioResult[];
  readonly customerSummary?: CustomerSummaryV1;
  readonly engineInput?: EngineInputV2_3;
  readonly engineOutput?: EngineOutputV1;
  readonly generatedOutputs?: Partial<GeneratedOutputsV1>;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveAcceptedScenarioId(input: ResolveCustomerDocumentSourceInputV1): string | undefined {
  return input.acceptedScenario?.scenarioId
    ?? input.acceptedScenarioId
    ?? input.decision?.recommendedScenarioId;
}

function resolveSelectedSystemLabel(input: ResolveCustomerDocumentSourceInputV1): string | undefined {
  return input.customerSummary?.recommendedSystemLabel
    ?? input.acceptedScenario?.display?.title
    ?? input.acceptedScenario?.system.summary
    ?? input.engineOutput?.recommendation?.primary;
}

function resolveTopologyType(input: ResolveCustomerDocumentSourceInputV1): string | undefined {
  const acceptedScenarioId = resolveAcceptedScenarioId(input)?.toLowerCase();
  const acceptedScenarioType = input.acceptedScenario?.system.type;
  const recommendationPrimary = input.engineOutput?.recommendation?.primary?.toLowerCase();

  const scenarioType = acceptedScenarioType ?? recommendationPrimary;
  if (scenarioType === 'combi' || acceptedScenarioId?.includes('combi')) return 'combi';
  if (scenarioType === 'ashp' || acceptedScenarioId?.includes('ashp') || acceptedScenarioId?.includes('heat_pump')) return 'heat_pump';
  if (
    scenarioType === 'system'
    || acceptedScenarioId?.includes('system_unvented')
    || acceptedScenarioId?.includes('regular_unvented')
    || acceptedScenarioId?.includes('stored')
    || acceptedScenarioId?.includes('unvented')
  ) {
    return 'sealed_system_unvented';
  }
  if (scenarioType === 'regular' || acceptedScenarioId?.includes('open_vented')) return 'open_vented';
  return undefined;
}

function resolveDhwStrategy(input: ResolveCustomerDocumentSourceInputV1, topologyType: string | undefined): string | undefined {
  if (topologyType === 'combi') return 'combi_instantaneous';
  const dhwStorageType = input.engineInput?.dhwStorageType;
  if (
    dhwStorageType === 'unvented'
    || dhwStorageType === 'mixergy'
    || dhwStorageType === 'thermal_store'
  ) {
    return 'stored_hot_water';
  }
  if (dhwStorageType === 'vented') return 'tank_fed_stored';
  if (topologyType === 'sealed_system_unvented') return 'stored_hot_water';
  return undefined;
}

function detectContentInconsistencies(source: {
  readonly selectedSystemLabel: string;
  readonly topologyType: string;
  readonly customerJourneyPack: CustomerJourneyPackV1;
}): string[] {
  const inconsistencies: string[] = [];
  const printModel = source.customerJourneyPack.staticPdf;
  const allText = [
    printModel.cover.title,
    printModel.cover.summary,
    ...printModel.sections.flatMap((section) => [
      section.heading,
      section.summary,
      section.keyTakeaway,
      section.reassurance,
      ...section.items,
    ]),
  ].join(' ').toLowerCase();
  const coverText = `${printModel.cover.title} ${printModel.cover.summary}`.toLowerCase();
  const sectionIdSet = new Set(printModel.sections.map((section) => section.sectionId));

  const sourceIsCombi =
    source.topologyType === 'combi'
    || source.selectedSystemLabel.toLowerCase().includes('combi');
  if (sourceIsCombi) {
    const hasStoredOrUnventedContent =
      sectionIdSet.has('unvented_safety')
      || sectionIdSet.has('pressure_vs_storage')
      || /(unvented|cylinder|tank-fed|stored hot water)/i.test(allText);
    if (hasStoredOrUnventedContent) {
      inconsistencies.push('Combi recommendation conflicts with stored/unvented PDF content.');
    }
  }

  const sourceIsStoredOrSystem = source.topologyType === 'sealed_system_unvented';
  if (sourceIsStoredOrSystem && /\bcombi\b/i.test(coverText)) {
    inconsistencies.push('Stored/system recommendation conflicts with combi cover wording.');
  }

  return inconsistencies;
}

export function resolveCustomerDocumentSourceV1(
  input: ResolveCustomerDocumentSourceInputV1,
): ResolveCustomerDocumentSourceResultV1 {
  const visitId = hasText(input.visitId) ? input.visitId : undefined;
  const visitReference = hasText(input.visitReference) ? input.visitReference : undefined;
  const acceptedScenarioId = resolveAcceptedScenarioId(input);
  const selectedSystemLabel = resolveSelectedSystemLabel(input);
  const topologyType = resolveTopologyType(input);
  const dhwStrategy = resolveDhwStrategy(input, topologyType);
  const generatedOutputs = normaliseGeneratedOutputs(input.generatedOutputs);
  const customerJourneyPack = readCustomerJourneyPackFromGeneratedOutputs(generatedOutputs);
  const missingFields: string[] = [];

  if (!hasText(visitId)) missingFields.push('visitId');
  if (!hasText(visitReference)) missingFields.push('visitReference');
  if (!hasText(acceptedScenarioId)) missingFields.push('acceptedScenarioId');
  if (!hasText(selectedSystemLabel)) missingFields.push('selectedSystemLabel');
  if (!hasText(dhwStrategy)) missingFields.push('dhwStrategy');
  if (!hasText(topologyType)) missingFields.push('topologyType');
  if (customerJourneyPack == null) missingFields.push('customerJourneyPack');

  if (missingFields.length > 0 || customerJourneyPack == null || topologyType == null || selectedSystemLabel == null) {
    return {
      ok: false,
      missingFields,
    };
  }

  const consistencyIssues = detectContentInconsistencies({
    selectedSystemLabel,
    topologyType,
    customerJourneyPack,
  });
  if (consistencyIssues.length > 0) {
    return {
      ok: false,
      missingFields: consistencyIssues,
    };
  }
  const resolvedVisitId = visitId as string;
  const resolvedVisitReference = visitReference as string;
  const resolvedAcceptedScenarioId = acceptedScenarioId as string;
  const resolvedDhwStrategy = dhwStrategy as string;
  const resolvedSelectedSystemLabel = selectedSystemLabel as string;
  const resolvedTopologyType = topologyType as string;

  return {
    ok: true,
    source: {
      visitId: resolvedVisitId,
      visitReference: resolvedVisitReference,
      acceptedScenarioId: resolvedAcceptedScenarioId,
      selectedSystemLabel: resolvedSelectedSystemLabel,
      dhwStrategy: resolvedDhwStrategy,
      topologyType: resolvedTopologyType,
      customerJourneyPack,
      recommendationReasons: customerJourneyPack.staticPdf.recommendationReasons,
      generatedOutputs,
    },
  };
}

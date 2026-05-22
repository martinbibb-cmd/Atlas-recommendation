import { describe, expect, it } from 'vitest';
import {
  buildCustomerJourneyPackGeneratedOutput,
  buildPortalJourneyPrintModel,
} from '../buildPortalJourneyPrintModel';
import { resolveCustomerDocumentSourceV1 } from '../CustomerDocumentSourceV1';

function buildGeneratedOutputsFromModel(model: ReturnType<typeof buildPortalJourneyPrintModel>) {
  return {
    portal: { generated: false },
    pdf: { generated: false },
    simulatorReview: { generated: false },
    handoff: { generated: false },
    customerJourneyPack: buildCustomerJourneyPackGeneratedOutput({
      customerJourneyPack: {
        schema: 'atlas.customer-journey-pack',
        version: '1.0',
        staticPdf: model,
        portalDeepDive: {
          recommendationSummary: model.cover.summary,
          recommendationReasons: model.recommendationReasons,
          liveExperienceExplanations: [],
          librarySupportedExplainers: [],
          nextSteps: model.nextSteps,
          sections: model.sections,
        },
      },
      generatedAt: '2026-05-22T00:00:00.000Z',
    }),
  };
}

describe('resolveCustomerDocumentSourceV1', () => {
  it('returns explicit missing fields when source cannot be built', () => {
    const result = resolveCustomerDocumentSourceV1({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missingFields).toContain('visitId');
    expect(result.missingFields).toContain('visitReference');
    expect(result.missingFields).toContain('customerJourneyPack');
  });

  it('blocks combi source when pack content is unvented/stored', () => {
    const openVentedModel = buildPortalJourneyPrintModel({
      journeyType: 'open_vented',
      selectedSectionIds: [],
      recommendationSummary: 'Sealed system with unvented cylinder is recommended.',
      customerFacts: ['2 bathrooms'],
    });
    const result = resolveCustomerDocumentSourceV1({
      visitId: 'visit-1',
      visitReference: 'ATLAS-0001',
      acceptedScenario: {
        scenarioId: 'combi',
        system: { type: 'combi', summary: 'Combi boiler' },
      } as never,
      customerSummary: {
        recommendedSystemLabel: 'Combi boiler',
      } as never,
      generatedOutputs: buildGeneratedOutputsFromModel(openVentedModel),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missingFields.some((entry) => entry.includes('Combi recommendation conflicts'))).toBe(true);
  });

  it('blocks system/unvented source when cover says combi', () => {
    const conflictingModel = buildPortalJourneyPrintModel({
      journeyType: 'open_vented',
      selectedSectionIds: [],
      recommendationSummary: 'Combi boiler is recommended for this home.',
      customerFacts: ['2 bathrooms'],
    });
    const result = resolveCustomerDocumentSourceV1({
      visitId: 'visit-2',
      visitReference: 'ATLAS-0002',
      acceptedScenario: {
        scenarioId: 'system_unvented',
        system: { type: 'system', summary: 'System boiler with unvented cylinder' },
      } as never,
      customerSummary: {
        recommendedSystemLabel: 'System boiler with unvented cylinder',
      } as never,
      generatedOutputs: buildGeneratedOutputsFromModel(conflictingModel),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missingFields.some((entry) => entry.includes('Stored/system recommendation conflicts'))).toBe(true);
  });

  it('builds source when visit data and pack are consistent', () => {
    const openVentedModel = buildPortalJourneyPrintModel({
      journeyType: 'open_vented',
      selectedSectionIds: [],
      recommendationSummary: 'Sealed system with unvented cylinder is recommended.',
      customerFacts: ['2 bathrooms'],
    });
    const result = resolveCustomerDocumentSourceV1({
      visitId: 'visit-3',
      visitReference: 'ATLAS-0003',
      acceptedScenario: {
        scenarioId: 'system_unvented',
        system: { type: 'system', summary: 'System boiler with unvented cylinder' },
      } as never,
      customerSummary: {
        recommendedSystemLabel: 'System boiler with unvented cylinder',
      } as never,
      generatedOutputs: buildGeneratedOutputsFromModel(openVentedModel),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source.visitId).toBe('visit-3');
    expect(result.source.acceptedScenarioId).toBe('system_unvented');
    expect(result.source.topologyType).toBe('sealed_system_unvented');
  });
});

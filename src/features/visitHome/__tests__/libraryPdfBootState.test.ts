import { describe, it, expect, vi } from 'vitest';
import type { ResolveCustomerDocumentSourceResultV1 } from '../../../library/portal/pdf/CustomerDocumentSourceV1';
import type { PortalJourneyPrintModelV1 } from '../../../library/portal/pdf/buildPortalJourneyPrintModel';
import { runLibraryPdfBootState } from '../libraryPdfBootState';

function buildPrintModel(fallbackOnly: boolean): PortalJourneyPrintModelV1 {
  return {
    contentSource: { fallbackOnly },
    sections: [],
  } as unknown as PortalJourneyPrintModelV1;
}

function buildSourceResult(fallbackOnly: boolean): ResolveCustomerDocumentSourceResultV1 {
  const printModel = buildPrintModel(fallbackOnly);
  return {
    ok: true,
    source: {
      visitId: 'known',
      visitReference: 'VIS-001',
      acceptedScenarioId: 'system_unvented',
      selectedSystemLabel: 'System boiler',
      dhwStrategy: 'stored_hot_water',
      topologyType: 'sealed_system_unvented',
      customerJourneyPack: {
        staticPdf: printModel,
      },
      recommendationReasons: [],
      heatPumpViabilityState: null,
      generatedOutputs: {} as never,
    },
  };
}

describe('runLibraryPdfBootState', () => {
  it('hydrates a known visit before ready state', async () => {
    const transitions: string[] = [];
    const result = await runLibraryPdfBootState({
      visitId: 'known',
      explicitVisitId: true,
      onTransition: (state) => transitions.push(state.status),
      hydrateVisitById: async () => ({ visitId: 'known' }),
      enrichGeneratedOutputs: () => ({}) as never,
      resolveDocumentSource: () => buildSourceResult(false),
      isFallbackOnlyPrintModel: (model) => model.contentSource?.fallbackOnly === true,
    });

    expect(transitions).toEqual(['loading_visit', 'rebuilding_customer_pack']);
    expect(result.status).toBe('ready');
  });

  it('does not call resolver before hydration completes', async () => {
    let releaseHydration: (() => void) | null = null;
    const hydrationGate = new Promise<void>((resolve) => {
      releaseHydration = resolve;
    });
    const resolveDocumentSource = vi.fn(() => buildSourceResult(false));

    const pending = runLibraryPdfBootState({
      visitId: 'known',
      explicitVisitId: true,
      hydrateVisitById: async () => {
        await hydrationGate;
        return { visitId: 'known' };
      },
      enrichGeneratedOutputs: () => ({}) as never,
      resolveDocumentSource,
      isFallbackOnlyPrintModel: (model) => model.contentSource?.fallbackOnly === true,
    });

    expect(resolveDocumentSource).not.toHaveBeenCalled();
    releaseHydration?.();
    await pending;
    expect(resolveDocumentSource).toHaveBeenCalledTimes(1);
  });

  it('returns blocking error when visitId is missing', async () => {
    const result = await runLibraryPdfBootState({
      visitId: null,
      explicitVisitId: false,
      hydrateVisitById: async () => ({ visitId: 'known' }),
      enrichGeneratedOutputs: () => ({}) as never,
      resolveDocumentSource: () => buildSourceResult(false),
      isFallbackOnlyPrintModel: (model) => model.contentSource?.fallbackOnly === true,
    });

    expect(result.status).toBe('blocked');
  });

  it('returns blocking error when visit is unknown', async () => {
    const result = await runLibraryPdfBootState({
      visitId: 'unknown',
      explicitVisitId: true,
      hydrateVisitById: async () => null,
      enrichGeneratedOutputs: () => ({}) as never,
      resolveDocumentSource: () => buildSourceResult(false),
      isFallbackOnlyPrintModel: (model) => model.contentSource?.fallbackOnly === true,
    });

    expect(result.status).toBe('visit_not_found');
  });

  it('blocks fallback PDF generation when explicit visitId is supplied', async () => {
    const result = await runLibraryPdfBootState({
      visitId: 'known',
      explicitVisitId: true,
      hydrateVisitById: async () => ({ visitId: 'known' }),
      enrichGeneratedOutputs: () => ({}) as never,
      resolveDocumentSource: () => buildSourceResult(true),
      isFallbackOnlyPrintModel: (model) => model.contentSource?.fallbackOnly === true,
    });

    expect(result.status).toBe('blocked');
  });
});

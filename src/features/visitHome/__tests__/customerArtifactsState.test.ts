import { describe, expect, it } from 'vitest';
import {
  buildVisitHomeCustomerArtifactsState,
  resolvePackagedPortalEngineInput,
} from '../customerArtifactsState';
import {
  buildCanonicalVisitPackage,
  buildVisitPackagePdfEnvelope,
  parseCanonicalVisitPackageFromPdfEnvelope,
  renderVisitPackagePdfDocument,
} from '../../visitPackage';
import {
  buildCustomerJourneyPack,
  buildCustomerJourneyPackGeneratedOutput,
} from '../../../library/portal/pdf/buildPortalJourneyPrintModel';

function makePackage(options?: { readonly includeCustomerJourneyPack?: boolean }) {
  const includeCustomerJourneyPack = options?.includeCustomerJourneyPack ?? true;
  const customerJourneyPack = buildCustomerJourneyPack({
    selectedSectionIds: [],
    recommendationSummary: 'System boiler with cylinder: Best fit for this home',
    customerFacts: ['3-person household', '2 bathrooms'],
    journeyType: 'open_vented',
  });

  return buildCanonicalVisitPackage({
    packageData: {
      visitIdentity: {
        visitId: 'visit-home-001',
        visitReference: 'REF-VISIT-HOME-001',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
      workspaceBrandReference: {
        workspaceId: 'workspace-1',
        brandId: 'atlas-default',
      },
      customerPropertyDetails: {
        propertyFacts: ['2 bathrooms'],
        usageFacts: ['3-person household'],
      },
      surveyDraft: {
        postcode: 'SW1A 1AA',
        occupancyCount: 3,
        bathroomCount: 2,
      } as never,
      engineInputSnapshot: {
        postcode: 'SW1A 1AA',
        occupancyCount: 3,
        bathroomCount: 2,
      } as never,
      proposalTruth: {
        selectedScenarioId: 'system_unvented_cylinder',
      },
      generatedOutputStatus: {
        lifecycleState: 'recommendation_ready',
        generatedOutputs: {
          portal: { generated: false },
          pdf: { generated: false },
          customerJourneyPack: includeCustomerJourneyPack
            ? buildCustomerJourneyPackGeneratedOutput({
                customerJourneyPack,
                generatedAt: '2026-05-20T10:02:00.000Z',
              })
            : undefined,
          simulatorReview: { generated: false },
          handoff: { generated: false },
        },
      },
      importExportMetadata: {
        exportedAt: '2026-05-20T10:02:00.000Z',
        source: {
          target: 'local_only',
          surface: 'visit_home_export',
        },
      },
    },
  });
}

describe('buildVisitHomeCustomerArtifactsState', () => {
  it('treats customer PDF readiness as canonical package exportability', () => {
    const state = buildVisitHomeCustomerArtifactsState({
      canExportVisitPackage: true,
      unavailableReasons: ['should not be used'],
    });

    expect(state.customerPdfReady).toBe(true);
    expect(state.customerPdfBlockReasons).toEqual([]);
  });

  it('preserves block reasons when canonical package export is unavailable', () => {
    const state = buildVisitHomeCustomerArtifactsState({
      canExportVisitPackage: false,
      unavailableReasons: ['Visit survey data is missing.'],
    });

    expect(state.customerPdfReady).toBe(false);
    expect(state.customerPdfBlockReasons).toEqual(['Visit survey data is missing.']);
  });

  it('leaves packaged portal payload undefined when no source package is available', () => {
    const state = buildVisitHomeCustomerArtifactsState({
      canExportVisitPackage: true,
    });

    expect(state.canOpenPortalFromPackage).toBe(false);
    expect(state.portalLaunchPayload).toBeUndefined();
  });

  it('unlocks the packaged portal when an imported PDF contains a customer journey pack', () => {
    const pdf = renderVisitPackagePdfDocument(buildVisitPackagePdfEnvelope({
      packagePayload: makePackage(),
    }));
    const parsed = parseCanonicalVisitPackageFromPdfEnvelope(pdf);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const state = buildVisitHomeCustomerArtifactsState({
      canExportVisitPackage: true,
      sourcePackage: parsed.pkg,
    });

    expect(state.canOpenPortalFromPackage).toBe(true);
    expect(state.portalLaunchPayload?.hasCustomerJourneyPack).toBe(true);
  });

  it('keeps the packaged portal locked when no customer journey pack is available', () => {
    const state = buildVisitHomeCustomerArtifactsState({
      canExportVisitPackage: true,
      sourcePackage: makePackage({ includeCustomerJourneyPack: false }),
    });

    expect(state.canOpenPortalFromPackage).toBe(false);
    expect(state.portalLaunchPayload?.hasCustomerJourneyPack).toBe(false);
  });
});

describe('resolvePackagedPortalEngineInput', () => {
  it('falls back to the packaged engine input when live state is missing', () => {
    const sourcePackage = makePackage();

    expect(resolvePackagedPortalEngineInput({
      sourcePackage,
    })).toEqual(sourcePackage.engineInputSnapshot);
  });
});

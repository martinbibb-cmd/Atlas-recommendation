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
    recommendationViabilityState: 'viable',
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
                snapshotId: 'snapshot-visit-home-001',
              })
            : undefined,
          simulatorReview: { generated: false },
          handoff: { generated: false },
        },
      },
      recommendationAuthority: {
        snapshotId: 'snapshot-visit-home-001',
        createdAt: '2026-05-20T10:00:00.000Z',
        sourceVisitRevision: '2026-05-20T10:00:00.000Z',
        checksum: 'fnv1a32-visit-home-001',
      },
      importExportMetadata: {
        exportedAt: '2026-05-20T10:02:00.000Z',
        source: {
          target: 'local_only',
          surface: 'visit_home_export',
        },
        recommendationSnapshot: {
          snapshotId: 'snapshot-visit-home-001',
          createdAt: '2026-05-20T10:00:00.000Z',
          sourceVisitRevision: '2026-05-20T10:00:00.000Z',
          checksum: 'fnv1a32-visit-home-001',
        },
      },
    },
  });
}

describe('buildVisitHomeCustomerArtifactsState', () => {
  it('does not mark customer PDF ready until customer journey pack is ready', () => {
    const state = buildVisitHomeCustomerArtifactsState({
      canExportVisitPackage: true,
      unavailableReasons: ['should not be used'],
    });

    expect(state.customerPdfReady).toBe(false);
    expect(state.customerPdfBlockReasons.some((reason) => /journey pack is not ready/i.test(reason))).toBe(true);
    expect(state.customerOutputReadiness.customerJourneyPackStatus).toBe('needs-review');
    expect(state.customerOutputReadiness.customerPdfStatus).toBe('needs-review');
  });

  it('preserves block reasons when canonical package export is unavailable', () => {
    const state = buildVisitHomeCustomerArtifactsState({
      canExportVisitPackage: false,
      unavailableReasons: ['Visit survey data is missing.'],
    });

    expect(state.customerPdfReady).toBe(false);
    expect(state.customerPdfBlockReasons).toEqual(['Visit survey data is missing.']);
    expect(state.customerOutputReadiness.customerJourneyPackStatus).toBe('blocked');
    expect(state.customerOutputReadiness.customerPdfStatus).toBe('blocked');
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

  it('keeps the packaged portal locked when customer journey pack is fallback-only', () => {
    const fallbackPack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Regular boiler recommendation',
      customerFacts: ['2 bathrooms'],
      journeyType: 'open_vented',
      recommendationViabilityState: 'viable',
    });
    const fallbackOnlyPack = {
      ...fallbackPack,
      staticPdf: {
        ...fallbackPack.staticPdf,
        contentSource: {
          ...fallbackPack.staticPdf.contentSource,
          fallbackOnly: true,
        },
      },
    };
    const sourcePackage = buildCanonicalVisitPackage({
      packageData: {
        ...makePackage(),
        generatedOutputStatus: {
          ...makePackage().generatedOutputStatus,
          generatedOutputs: {
            ...makePackage().generatedOutputStatus?.generatedOutputs,
            customerJourneyPack: buildCustomerJourneyPackGeneratedOutput({
              customerJourneyPack: fallbackOnlyPack,
              generatedAt: '2026-05-20T10:02:00.000Z',
              snapshotId: 'snapshot-visit-home-001',
            }),
          },
        },
      },
    });

    const state = buildVisitHomeCustomerArtifactsState({
      canExportVisitPackage: true,
      sourcePackage,
    });

    expect(state.customerPdfReady).toBe(false);
    expect(state.portalLaunchPayload?.hasCustomerJourneyPack).toBe(true);
    expect(state.canOpenPortalFromPackage).toBe(false);
    expect(state.customerPdfBlockReasons.some((reason) => /journey validation checks/i.test(reason))).toBe(
      true,
    );
  });

  it('blocks customer PDF when packaged pdf artifact snapshot is stale', () => {
    const sourcePackage = buildCanonicalVisitPackage({
      packageData: {
        ...makePackage(),
        recommendationAuthority: {
          snapshotId: 'snapshot-active',
          createdAt: '2026-05-20T10:00:00.000Z',
          sourceVisitRevision: '2026-05-20T10:00:00.000Z',
          checksum: 'fnv1a32-active',
        },
        importExportMetadata: {
          ...makePackage().importExportMetadata,
          recommendationSnapshot: {
            snapshotId: 'snapshot-active',
            createdAt: '2026-05-20T10:00:00.000Z',
            sourceVisitRevision: '2026-05-20T10:00:00.000Z',
            checksum: 'fnv1a32-active',
          },
        },
        generatedOutputStatus: {
          ...makePackage().generatedOutputStatus,
          generatedOutputs: {
            ...makePackage().generatedOutputStatus?.generatedOutputs,
            pdf: {
              generated: true,
              snapshotId: 'snapshot-stale',
            },
          },
        },
      },
    });
    const state = buildVisitHomeCustomerArtifactsState({
      canExportVisitPackage: true,
      sourcePackage,
    });
    expect(state.customerPdfReady).toBe(false);
    expect(state.customerPdfBlockReasons.some((reason) => /stale/i.test(reason))).toBe(true);
  });

  it('blocks customer PDF when packaged recommendation viability is blocked', () => {
    const blockedPack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Heat pump route',
      customerFacts: ['2 bathrooms'],
      journeyType: 'heat_pump',
      recommendationViabilityState: 'blocked',
    });
    const sourcePackage = buildCanonicalVisitPackage({
      packageData: {
        ...makePackage(),
        generatedOutputStatus: {
          ...makePackage().generatedOutputStatus,
          generatedOutputs: {
            ...makePackage().generatedOutputStatus?.generatedOutputs,
            customerJourneyPack: buildCustomerJourneyPackGeneratedOutput({
              customerJourneyPack: blockedPack,
              generatedAt: '2026-05-20T10:02:00.000Z',
              snapshotId: 'snapshot-visit-home-001',
            }),
          },
        },
      },
    });
    const state = buildVisitHomeCustomerArtifactsState({
      canExportVisitPackage: true,
      sourcePackage,
    });
    expect(state.customerPdfReady).toBe(false);
    expect(state.customerPdfBlockReasons.some((reason) => /blocked/i.test(reason))).toBe(true);
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

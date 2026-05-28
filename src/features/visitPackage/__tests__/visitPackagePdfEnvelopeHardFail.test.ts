import { describe, expect, it, vi } from 'vitest';
import {
  buildCanonicalVisitPackage,
  buildVisitPackagePdfEnvelope,
  renderVisitPackagePdfDocument,
} from '..';
import {
  CUSTOMER_JOURNEY_PACK_SCHEMA,
  CUSTOMER_JOURNEY_PACK_VERSION,
} from '../../../library/portal/pdf/buildPortalJourneyPrintModel';
import type { CustomerJourneyPackV1 } from '../../../library/portal/pdf/buildPortalJourneyPrintModel';

// ─── Module mock ──────────────────────────────────────────────────────────────
//
// We need to intercept buildCustomerJourneyPack inside the transport module to
// simulate the zero-scene edge case.  By default the vi.fn() delegates to the
// real implementation so all non-targeted tests remain green.

vi.mock('../../../library/portal/pdf/buildPortalJourneyPrintModel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../library/portal/pdf/buildPortalJourneyPrintModel')>();
  return {
    ...actual,
    buildCustomerJourneyPack: vi.fn().mockImplementation(
      (...args: Parameters<typeof actual.buildCustomerJourneyPack>) =>
        actual.buildCustomerJourneyPack(...args),
    ),
  };
});

// Re-import as namespace AFTER the vi.mock declaration so Vitest hoisting picks
// it up correctly.
import * as buildPortalJourneyPrintModelModule from '../../../library/portal/pdf/buildPortalJourneyPrintModel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePackageWithRecommendationContextAndNoJourney() {
  return buildCanonicalVisitPackage({
    packageData: {
      visitIdentity: {
        visitId: 'visit-hard-fail-001',
        visitReference: 'REF-HF-001',
        updatedAt: '2026-05-28T07:00:00.000Z',
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
      engineInputSnapshot: {} as never,
      proposalTruth: {
        selectedScenarioId: 'system_unvented_cylinder',
        customerSummary: {
          recommendedSystemLabel: 'System boiler with cylinder',
          headline: 'Best fit for this home',
        } as never,
        visitEnvelope: {
          identity: { visitId: 'visit-hard-fail-001' },
        } as never,
      },
      generatedOutputStatus: {
        lifecycleState: 'recommendation_ready',
        generatedOutputs: {
          portal: { generated: false },
          pdf: { generated: false },
          customerJourneyPack: undefined,
          simulatorReview: { generated: false },
          handoff: { generated: false },
        },
      },
      importExportMetadata: {
        exportedAt: '2026-05-28T07:01:00.000Z',
        source: { target: 'local_only', surface: 'visit_home_export' },
      },
    },
  });
}

function buildZeroScenePackMock(): CustomerJourneyPackV1 {
  return {
    schema: CUSTOMER_JOURNEY_PACK_SCHEMA,
    version: CUSTOMER_JOURNEY_PACK_VERSION,
    staticPdf: {
      cover: {
        title: 'System boiler with cylinder',
        summary: 'Best fit for this home',
        customerFacts: [],
      },
      sections: [],
      recommendationReasons: [],
      nextSteps: [],
      qrDestinations: [],
      pageEstimate: { usedPages: 1, maxPages: 7 },
      contentSource: {
        audienceProjectionPresent: false,
        selectedConceptCount: 0,
        selectedStorySceneCount: 0,
        visualAssetIds: [],
        fallbackSectionsUsed: false,
        fallbackOnly: true,
        sceneDiagnostics: [],
        visualCoverageAudit: { routes: [] },
        storySceneValidation: {
          sceneCount: 0,
          warningCount: 0,
          errorCount: 0,
          blockingErrorCount: 0,
          rejectedSceneCount: 0,
          rejectedSceneSectionIds: [],
          offendingPhrases: [],
          warningCodes: [],
          errorCodes: [],
          compositionWarningCount: 0,
          compositionErrorCount: 0,
        },
      },
    },
    portalDeepDive: {
      recommendationSummary: 'Best fit for this home',
      recommendationReasons: [],
      liveExperienceExplanations: [],
      librarySupportedExplainers: [],
      nextSteps: [],
      sections: [],
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('customer PDF hard fail — zero story scenes with recommendation context', () => {
  it('throws when recommendation context exists but buildCustomerJourneyPack produces 0 story scenes', () => {
    vi.mocked(buildPortalJourneyPrintModelModule.buildCustomerJourneyPack)
      .mockReturnValueOnce(buildZeroScenePackMock());

    const pkg = makePackageWithRecommendationContextAndNoJourney();
    expect(() =>
      renderVisitPackagePdfDocument(buildVisitPackagePdfEnvelope({ packagePayload: pkg })),
    ).toThrow('0 story scenes');
  });

  it('error message directs engineer to regenerate outputs', () => {
    vi.mocked(buildPortalJourneyPrintModelModule.buildCustomerJourneyPack)
      .mockReturnValueOnce(buildZeroScenePackMock());

    const pkg = makePackageWithRecommendationContextAndNoJourney();
    expect(() =>
      renderVisitPackagePdfDocument(buildVisitPackagePdfEnvelope({ packagePayload: pkg })),
    ).toThrow('Regenerate recommendation outputs');
  });

  it('does not throw when recommendation context is absent and there is no packaged journey (uses fallback copy)', () => {
    // No proposalTruth → hasRecommendationContext === false → allowed to fall through to fallback
    const pkg = buildCanonicalVisitPackage({
      packageData: {
        visitIdentity: {
          visitId: 'visit-no-ctx-001',
          visitReference: 'REF-NC-001',
          updatedAt: '2026-05-28T07:00:00.000Z',
        },
        workspaceBrandReference: { workspaceId: 'workspace-1', brandId: 'atlas-default' },
        customerPropertyDetails: { propertyFacts: [], usageFacts: [] },
        surveyDraft: {} as never,
        engineInputSnapshot: {} as never,
        proposalTruth: undefined,
        generatedOutputStatus: {
          lifecycleState: 'new',
          generatedOutputs: {
            portal: { generated: false },
            pdf: { generated: false },
            customerJourneyPack: undefined,
            simulatorReview: { generated: false },
            handoff: { generated: false },
          },
        },
        importExportMetadata: {
          exportedAt: '2026-05-28T07:01:00.000Z',
          source: { target: 'local_only', surface: 'visit_home_export' },
        },
      },
    });

    expect(() =>
      renderVisitPackagePdfDocument(buildVisitPackagePdfEnvelope({ packagePayload: pkg })),
    ).not.toThrow();
  });

  it('does not throw when recommendation context exists and scenes are produced normally', () => {
    // Real buildCustomerJourneyPack with a valid scenario should produce scenes > 0
    const pkg = makePackageWithRecommendationContextAndNoJourney();
    expect(() =>
      renderVisitPackagePdfDocument(buildVisitPackagePdfEnvelope({ packagePayload: pkg })),
    ).not.toThrow();
  });
});

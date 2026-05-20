import { describe, expect, it } from 'vitest';
import {
  buildCanonicalVisitPackage,
  buildVisitPackagePdfEnvelope,
  extractVisitPackagePdfEnvelope,
  parseCanonicalVisitPackageFromPdfEnvelope,
  renderVisitPackagePdfDocument,
  VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER,
  VISIT_PACKAGE_PDF_PAYLOAD_END_MARKER,
} from '..';
import type { CanonicalVisitPackageV1 } from '../CanonicalVisitPackageV1';
import {
  buildCustomerJourneyPack,
  buildCustomerJourneyPackGeneratedOutput,
} from '../../../library/portal/pdf/buildPortalJourneyPrintModel';

function makePackage() {
  const customerJourneyPack = buildCustomerJourneyPack({
    selectedSectionIds: [],
    recommendationSummary: 'System boiler with cylinder: Best fit for this home',
    customerFacts: ['3-person household', '2 bathrooms'],
    journeyType: 'open_vented',
  });
  return buildCanonicalVisitPackage({
    packageData: {
      visitIdentity: {
        visitId: 'visit-001',
        visitReference: 'REF-001',
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
        customerSummary: {
          recommendedSystemLabel: 'System boiler with cylinder',
          headline: 'Best fit for this home',
        } as never,
        visitEnvelope: {
          identity: {
            visitId: 'visit-001',
          },
        } as never,
      },
      generatedOutputStatus: {
        lifecycleState: 'recommendation_ready',
        generatedOutputs: {
          portal: { generated: false },
          pdf: { generated: false },
          customerJourneyPack: buildCustomerJourneyPackGeneratedOutput({
            customerJourneyPack,
            generatedAt: '2026-05-20T10:02:00.000Z',
          }),
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

describe('visit package PDF envelope', () => {
  it('wraps canonical payload without changing package content', () => {
    const pkg = makePackage();
    const envelope = buildVisitPackagePdfEnvelope({ packagePayload: pkg });
    expect(envelope.canonicalVisitPackage).toEqual(pkg);
  });

  it('includes recommendation summary only for proposal-ready payloads', () => {
    const ready = buildVisitPackagePdfEnvelope({ packagePayload: makePackage() });
    expect(ready.visibleContent.recommendationSummary).toContain('System boiler with cylinder');

    const pkgWithoutProposal: CanonicalVisitPackageV1 = {
      ...makePackage(),
      proposalTruth: undefined,
    };
    const notReady = buildVisitPackagePdfEnvelope({ packagePayload: pkgWithoutProposal });
    expect(notReady.visibleContent.recommendationSummary).toBeUndefined();
  });

  it('renders PDF document with embedded envelope and parses back canonical package', () => {
    const envelope = buildVisitPackagePdfEnvelope({ packagePayload: makePackage() });
    const pdf = renderVisitPackagePdfDocument(envelope);
    expect(pdf).toContain(VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER);
    expect(pdf).toContain(VISIT_PACKAGE_PDF_PAYLOAD_END_MARKER);

    const extracted = extractVisitPackagePdfEnvelope(pdf);
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;
    expect(extracted.envelope.canonicalVisitPackage).toEqual(envelope.canonicalVisitPackage);

    const parsed = parseCanonicalVisitPackageFromPdfEnvelope(pdf);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.integrity.status).toBe('verified');
  });

  it('preserves packaged customer journey availability through PDF import parsing', () => {
    const pkg = makePackage();
    const pdf = renderVisitPackagePdfDocument(buildVisitPackagePdfEnvelope({ packagePayload: pkg }));
    const parsed = parseCanonicalVisitPackageFromPdfEnvelope(pdf);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.pkg.generatedOutputStatus?.generatedOutputs?.customerJourneyPack?.generated).toBe(true);
    expect(parsed.pkg.generatedOutputStatus?.generatedOutputs?.customerJourneyPack?.status).toBe('packaged');
    expect(parsed.pkg.packageIntegrity?.hash).toBe(pkg.packageIntegrity?.hash);
  });

  it('warns when embedded package payload was modified after export', () => {
    const envelope = buildVisitPackagePdfEnvelope({ packagePayload: makePackage() });
    const tamperedEnvelope = {
      ...envelope,
      canonicalVisitPackage: {
        ...envelope.canonicalVisitPackage,
        visitIdentity: {
          ...envelope.canonicalVisitPackage.visitIdentity,
          visitReference: 'REF-TAMPERED-001',
        },
      },
    };
    const pdf = renderVisitPackagePdfDocument(tamperedEnvelope);
    const parsed = parseCanonicalVisitPackageFromPdfEnvelope(pdf);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.integrity.status).toBe('modified');
  });

  it('returns parse errors when PDF does not include payload markers', () => {
    const parsed = parseCanonicalVisitPackageFromPdfEnvelope('%PDF-1.4\n1 0 obj\n<<>>\nendobj');
    expect(parsed.ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  VISIT_PACKAGE_PDF_NO_MARKER_ERROR,
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

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

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
    if (parsed.ok) return;
    expect(parsed.errors).toContain(VISIT_PACKAGE_PDF_NO_MARKER_ERROR);
  });

  it('rejects printable supporting PDFs because they are not Atlas visit packages', () => {
    const printableSupportingPdf = [
      '%PDF-1.4',
      '1 0 obj',
      '<<>>',
      'stream',
      'Library supporting PDF — review workspace',
      'Heating System Recommendation',
      'Print / Save as PDF',
      'endstream',
      'endobj',
      '%%EOF',
    ].join('\n');

    const parsed = parseCanonicalVisitPackageFromPdfEnvelope(printableSupportingPdf);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors[0]).toContain('not an importable visit package');
    expect(parsed.errors[0]).toContain('.atlasvisit.pdf');
  });
});

describe('visible PDF content matches packaged CustomerJourneyPackV1 (payload alignment)', () => {
  it('PDF title reflects the packaged recommendation system label', () => {
    const pkg = makePackage();
    const envelope = buildVisitPackagePdfEnvelope({ packagePayload: pkg });
    // Envelope title should contain the system label, not a generic wrapper message
    expect(envelope.title).toContain('System boiler with cylinder');
    expect(envelope.title).not.toContain('wrapper');
  });

  it('PDF visible recommendation summary matches packaged CustomerJourneyPackV1 recommendation', () => {
    const pkg = makePackage();
    const envelope = buildVisitPackagePdfEnvelope({ packagePayload: pkg });
    const pdf = renderVisitPackagePdfDocument(envelope);

    // The visible PDF content must contain the recommendation summary from the pack
    const packCoverTitle = pkg.generatedOutputStatus?.generatedOutputs?.customerJourneyPack
      ?.payload?.staticPdf?.cover?.title as string | undefined;

    expect(packCoverTitle).toBeDefined();
    if (packCoverTitle) {
      // The rendered PDF pages should contain the pack cover title text
      // (ASCII-safe comparison — non-ASCII chars are replaced with '?')
      const asciiTitle = packCoverTitle.replace(/[^\x20-\x7E]/g, '?');
      expect(pdf).toContain(asciiTitle);
    }

    // The visible recommendation summary in the envelope must match what is in
    // the packaged CustomerJourneyPackV1 (same recommendation label source)
    const packRecommendationLabel =
      pkg.proposalTruth?.customerSummary?.recommendedSystemLabel;
    if (hasText(packRecommendationLabel)) {
      expect(envelope.visibleContent.recommendationSummary).toContain(packRecommendationLabel);
    }
  });

  it('keeps packageEmbedded visible journey content free of wrapper-only import copy', () => {
    const pkg = makePackage();
    const envelope = buildVisitPackagePdfEnvelope({ packagePayload: pkg });
    const pdf = renderVisitPackagePdfDocument(envelope);
    expect(pdf).not.toContain('This document contains an embedded Atlas package for digital import.');
    expect(pdf).toContain('Why this recommendation fits your home');
    expect(pdf).toContain('What happens next');
  });

  it('embedded payload recommendation matches envelope visible summary after round-trip', () => {
    const pkg = makePackage();
    const envelope = buildVisitPackagePdfEnvelope({ packagePayload: pkg });
    const pdf = renderVisitPackagePdfDocument(envelope);

    const parsed = parseCanonicalVisitPackageFromPdfEnvelope(pdf);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // Embedded payload must carry the same recommendation label as the visible envelope summary
    const embeddedLabel = parsed.pkg.proposalTruth?.customerSummary?.recommendedSystemLabel;
    const visibleSummary = envelope.visibleContent.recommendationSummary;

    if (hasText(embeddedLabel) && hasText(visibleSummary)) {
      expect(visibleSummary).toContain(embeddedLabel);
    }
  });

  it('PDF is a valid multi-page PDF-1.4 document when CustomerJourneyPackV1 is present', () => {
    const pkg = makePackage();
    const pdf = renderVisitPackagePdfDocument(buildVisitPackagePdfEnvelope({ packagePayload: pkg }));

    // Must start with PDF header
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    // Must end with %%EOF
    expect(pdf.endsWith('%%EOF')).toBe(true);
    // Must have more than one page object (cover + sections + next steps)
    const pageMatches = pdf.match(/\/Type \/Page[^s]/g);
    expect(pageMatches).not.toBeNull();
    expect((pageMatches ?? []).length).toBeGreaterThan(1);
    // Catalog must reference Pages
    expect(pdf).toContain('/Type /Catalog');
    expect(pdf).toContain('/Type /Pages');
    // Both fonts must be declared
    expect(pdf).toContain('/BaseFont /Helvetica ');
    expect(pdf).toContain('/BaseFont /Helvetica-Bold ');
  });
});

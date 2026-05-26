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
    recommendationReasons: [
      {
        id: 'household-demand',
        category: 'household_demand',
        homeFact: 'Your home has 3 people and 2 bathrooms.',
        whyItMatters: 'Hot water demand can overlap during busy periods.',
        atlasRecommendationOutcome: 'A system boiler with unvented cylinder supports simultaneous use.',
        practicalEffect: 'Showers and taps stay consistent at peak times.',
      },
    ],
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

function extractVisiblePageStreams(pdf: string): string[] {
  const streams = [...pdf.matchAll(/stream\n([\s\S]*?)\nendstream/g)]
    .map((match) => match[1])
    .filter((stream) => stream.includes('\nBT\n') || stream.includes('\nBT\r\n'));
  return streams;
}

function extractYCoordinates(stream: string): number[] {
  return [...stream.matchAll(/50 ([0-9]+(?:\.[0-9]+)?) Td/g)]
    .map((match) => Number.parseFloat(match[1]));
}

interface PdfTextDrawCommand {
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

function extractTextDrawCommands(stream: string): PdfTextDrawCommand[] {
  return [...stream.matchAll(/([0-9]+(?:\.[0-9]+)?) ([0-9]+(?:\.[0-9]+)?) Td\n\(((?:\\.|[^\\)])*)\) Tj/g)]
    .map((match) => ({
      x: Number.parseFloat(match[1]),
      y: Number.parseFloat(match[2]),
      text: match[3].replace(/\\([()\\])/g, '$1'),
    }));
}

function countTextDrawCommands(pdf: string): number {
  return (pdf.match(/ Td\r?\n\(/g) ?? []).length;
}

const LONG_TEXT_REPEAT_COUNT = 80;
// Chosen to guarantee wrapped detail spans multiple lines/pages in this fixture.

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
    expect(pdf).not.toContain('Library supporting PDF — review');
    expect(pdf).toContain('Why this fits your home');
    expect(pdf).toContain('3-person household');
    expect(pdf).toContain('Why it matters:');
    expect(pdf).toContain('What happens next');
    expect(pdf).not.toContain('What stays familiar');
    expect(pdf).not.toContain('Living with the system');
    expect(pdf).not.toContain('Reassurance');
    expect(pdf).toContain('Recommendation summary');
    expect(pdf).toContain('Practical outcomes');
  });

  it('rebuilds customer journey content from canonical package when packaged journey is absent', () => {
    const pkg = makePackage();
    const packageWithoutJourney = buildCanonicalVisitPackage({
      packageData: {
        visitIdentity: pkg.visitIdentity,
        workspaceBrandReference: pkg.workspaceBrandReference,
        customerPropertyDetails: pkg.customerPropertyDetails,
        surveyDraft: pkg.surveyDraft,
        engineInputSnapshot: pkg.engineInputSnapshot,
        proposalTruth: pkg.proposalTruth,
        generatedOutputStatus: {
          ...pkg.generatedOutputStatus,
          generatedOutputs: {
            ...pkg.generatedOutputStatus?.generatedOutputs,
            customerJourneyPack: undefined,
          },
        },
        importExportMetadata: pkg.importExportMetadata,
      },
    });
    const pdf = renderVisitPackagePdfDocument(buildVisitPackagePdfEnvelope({ packagePayload: packageWithoutJourney }));
    expect(pdf).toContain('Why this fits your home');
    expect(pdf).toContain('3-person household');
    expect(pdf).toContain('Atlas recommendation:');
    expect(pdf).toContain(VISIT_PACKAGE_PDF_PAYLOAD_BEGIN_MARKER);
  });

  it('uses fallback document copy only when recommendation and packaged journey are both missing', () => {
    const pkg = makePackage();
    const packageWithoutJourneyOrRecommendation = buildCanonicalVisitPackage({
      packageData: {
        visitIdentity: pkg.visitIdentity,
        workspaceBrandReference: pkg.workspaceBrandReference,
        customerPropertyDetails: pkg.customerPropertyDetails,
        surveyDraft: pkg.surveyDraft,
        engineInputSnapshot: pkg.engineInputSnapshot,
        proposalTruth: undefined,
        generatedOutputStatus: {
          ...pkg.generatedOutputStatus,
          generatedOutputs: {
            ...pkg.generatedOutputStatus?.generatedOutputs,
            customerJourneyPack: undefined,
          },
        },
        importExportMetadata: pkg.importExportMetadata,
      },
    });
    const pdf = renderVisitPackagePdfDocument(buildVisitPackagePdfEnvelope({
      packagePayload: packageWithoutJourneyOrRecommendation,
    }));
    expect(pdf).toContain('Journey recommendation details are missing or incomplete in this export package.');
    expect(pdf).not.toContain('Why this recommendation fits your home');
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

  it('layout keeps text Y positions positive and strictly descending within each page stream', () => {
    const pdf = renderVisitPackagePdfDocument(buildVisitPackagePdfEnvelope({ packagePayload: makePackage() }));
    const pageStreams = extractVisiblePageStreams(pdf);
    expect(pageStreams.length).toBeGreaterThan(0);

    for (const stream of pageStreams) {
      const yCoords = extractYCoordinates(stream);
      for (const y of yCoords) {
        expect(y).toBeGreaterThanOrEqual(55);
      }
      for (let i = 1; i < yCoords.length; i += 1) {
        expect(yCoords[i]).toBeLessThan(yCoords[i - 1]);
      }
    }
  });

  it('renders demographics in a two-column row layout in PDF text commands', () => {
    const pdf = renderVisitPackagePdfDocument(buildVisitPackagePdfEnvelope({ packagePayload: makePackage() }));
    const commands = extractVisiblePageStreams(pdf).flatMap((stream) => extractTextDrawCommands(stream));
    const occupants = commands.find((command) => command.text.startsWith('Occupants:'));
    const bathrooms = commands.find((command) => command.text.startsWith('Bathrooms:'));
    const peakHeatLoss = commands.find((command) => command.text.startsWith('Peak heat loss (kW):'));
    const hotWaterDemand = commands.find((command) => command.text.startsWith('Hot water demand:'));

    expect(occupants).toBeDefined();
    expect(bathrooms).toBeDefined();
    expect(peakHeatLoss).toBeDefined();
    expect(hotWaterDemand).toBeDefined();

    expect(occupants?.x).toBe(50);
    expect(peakHeatLoss?.x).toBe(50);
    expect(bathrooms?.x).toBeGreaterThan(50);
    expect(hotWaterDemand?.x).toBeGreaterThan(50);

    expect(occupants?.y).toBe(bathrooms?.y);
    expect(peakHeatLoss?.y).toBe(hotWaterDemand?.y);
  });

  it('hydrates demographics from canonical metrics when customer facts use alternate phrasing', () => {
    const customerJourneyPack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'System boiler with cylinder: Best fit for this home',
      customerFacts: ['5 people in the home', '2 bathrooms'],
      journeyType: 'open_vented',
      recommendationReasons: [
        {
          id: 'household-demand',
          category: 'household_demand',
          homeFact: '5 people in the home',
          whyItMatters: 'Peak routines overlap in this property.',
          atlasRecommendationOutcome: 'Atlas routes storage to household demand.',
          practicalEffect: 'Hot water holds up across morning peaks.',
        },
      ],
    });

    const basePackage = makePackage();
    const pkg = buildCanonicalVisitPackage({
      packageData: {
        visitIdentity: basePackage.visitIdentity,
        workspaceBrandReference: basePackage.workspaceBrandReference,
        customerPropertyDetails: basePackage.customerPropertyDetails,
        surveyDraft: {
          postcode: 'SW1A 1AA',
          occupancyCount: 5,
          bathroomCount: 2,
        } as never,
        engineInputSnapshot: {
          postcode: 'SW1A 1AA',
          occupancyCount: 5,
          bathroomCount: 2,
          heatLossWatts: 14300,
          dailyHotWaterLitres: 280,
        } as never,
        proposalTruth: basePackage.proposalTruth,
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
        importExportMetadata: basePackage.importExportMetadata,
      },
    });

    const pdf = renderVisitPackagePdfDocument(buildVisitPackagePdfEnvelope({ packagePayload: pkg }));
    const commands = extractVisiblePageStreams(pdf).flatMap((stream) => extractTextDrawCommands(stream));
    const occupants = commands.find((command) => command.text.startsWith('Occupants:'));
    const peakHeatLoss = commands.find((command) => command.text.startsWith('Peak heat loss (kW):'));
    const hotWaterDemand = commands.find((command) => command.text.startsWith('Hot water demand:'));

    expect(occupants?.text).toContain('5');
    expect(occupants?.text).not.toContain('Not recorded');
    expect(peakHeatLoss?.text).toContain('14.3 kW');
    expect(peakHeatLoss?.text).not.toContain('Not recorded');
    expect(hotWaterDemand?.text).toContain('280 L/day');
  });

  it('wrapped text keeps page coordinates non-negative for long reason detail payloads', () => {
    const longDetail = 'Detailed explanation for customer handover clarity '.repeat(LONG_TEXT_REPEAT_COUNT);
    const longJourneyPack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'System boiler with cylinder: Best fit for this home',
      customerFacts: ['3-person household', '2 bathrooms'],
      journeyType: 'open_vented',
      recommendationReasons: [
        {
          id: 'household-demand',
          category: 'household_demand',
          homeFact: 'Your home has 3 people and 2 bathrooms.',
          whyItMatters: 'Hot water demand can overlap during busy periods.',
          atlasRecommendationOutcome: 'A system boiler with unvented cylinder supports simultaneous use.',
          practicalEffect: 'Showers and taps stay consistent at peak times.',
          detail: longDetail,
        },
      ],
    });

    const basePackage = makePackage();
    const packageWithLongText = buildCanonicalVisitPackage({
      packageData: {
        visitIdentity: basePackage.visitIdentity,
        workspaceBrandReference: basePackage.workspaceBrandReference,
        customerPropertyDetails: basePackage.customerPropertyDetails,
        surveyDraft: basePackage.surveyDraft,
        engineInputSnapshot: basePackage.engineInputSnapshot,
        proposalTruth: basePackage.proposalTruth,
        generatedOutputStatus: {
          ...basePackage.generatedOutputStatus,
          generatedOutputs: {
            ...basePackage.generatedOutputStatus?.generatedOutputs,
            customerJourneyPack: buildCustomerJourneyPackGeneratedOutput({
              customerJourneyPack: longJourneyPack,
              generatedAt: '2026-05-20T10:03:00.000Z',
            }),
          },
        },
        importExportMetadata: basePackage.importExportMetadata,
      },
    });

    const longPdf = renderVisitPackagePdfDocument(
      buildVisitPackagePdfEnvelope({ packagePayload: packageWithLongText }),
    );
    const pageStreams = extractVisiblePageStreams(longPdf);
    expect(pageStreams.length).toBeGreaterThan(0);
    expect(countTextDrawCommands(longPdf)).toBeGreaterThan(0);

    for (const stream of pageStreams) {
      const yCoords = extractYCoordinates(stream);
      for (const y of yCoords) {
        expect(y).toBeGreaterThanOrEqual(55);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { buildPortalJourneyPrintModel } from '../buildPortalJourneyPrintModel';
import { buildCustomerDocumentModel } from '../CustomerDocumentRenderer';

describe('CustomerDocumentRenderer', () => {
  const model = buildPortalJourneyPrintModel({
    journeyType: 'open_vented',
    selectedSectionIds: ['CON_A01', 'CON_C02', 'CON_C01'],
    recommendationSummary: 'Sealed system with unvented cylinder — the right fit for this home.',
    customerFacts: ['4-person household', '2 bathrooms', 'Regular boiler, open-vented circuit'],
  });

  it('keeps visible customer content identical between printable and packageEmbedded modes', () => {
    const printable = buildCustomerDocumentModel({ model, mode: 'printable' });
    const embedded = buildCustomerDocumentModel({ model, mode: 'packageEmbedded' });

    expect(printable.cover).toEqual(embedded.cover);
    expect(printable.recommendationReasons).toEqual(embedded.recommendationReasons);
    expect(printable.sections).toEqual(embedded.sections);
    expect(printable.systemProtection).toEqual(embedded.systemProtection);
    expect(printable.nextSteps).toEqual(embedded.nextSteps);
    expect(printable.qrDestinations).toEqual(embedded.qrDestinations);
    expect(printable.packageEmbedded).toBe(false);
    expect(embedded.packageEmbedded).toBe(true);
  });

  it('preserves structured recommendation reasons from the current print model', () => {
    const documentModel = buildCustomerDocumentModel({ model, mode: 'printable' });

    expect(documentModel.recommendationReasons.length).toBeGreaterThan(0);
    expect(documentModel.recommendationReasons[0]).toMatchObject({
      id: expect.any(String),
      category: expect.any(String),
      homeFact: expect.any(String),
      whyItMatters: expect.any(String),
      atlasRecommendationOutcome: expect.any(String),
      practicalEffect: expect.any(String),
    });
  });

  it('renders packageEmbedded mode when recommendation reasons are missing', () => {
    const legacyLikeModel = {
      ...model,
      recommendationReasons: undefined,
    } as unknown as Parameters<typeof buildCustomerDocumentModel>[0]['model'];

    const build = () => buildCustomerDocumentModel({ model: legacyLikeModel, mode: 'packageEmbedded' });

    expect(build).not.toThrow();
    expect(build().recommendationReasons).toEqual([]);
    expect(build().packageEmbedded).toBe(true);
  });

  it('renders printable mode with older model fields and missing arrays', () => {
    const oldModel = {
      cover: {
        title: 'Legacy recommendation',
      },
      recommendationSummary: 'Legacy summary fallback',
      customerFacts: ['Legacy home fact'],
      deepDiveDestinations: [{ heading: 'Legacy deep dive', note: 'More detail' }],
      recommendationReasons: undefined,
      sections: undefined,
      nextSteps: undefined,
      qrDestinations: undefined,
      systemProtection: undefined,
    } as unknown as Parameters<typeof buildCustomerDocumentModel>[0]['model'];

    const build = () => buildCustomerDocumentModel({ model: oldModel, mode: 'printable' });

    expect(build).not.toThrow();
    expect(build().cover.summary).toBe('Legacy summary fallback');
    expect(build().cover.customerFacts).toEqual(['Legacy home fact']);
    expect(build().sections).toEqual([]);
    expect(build().nextSteps).toEqual([]);
    expect(build().qrDestinations).toEqual([{ heading: 'Legacy deep dive', note: 'More detail' }]);
  });
});

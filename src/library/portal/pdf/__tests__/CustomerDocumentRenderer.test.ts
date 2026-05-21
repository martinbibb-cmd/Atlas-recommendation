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
});

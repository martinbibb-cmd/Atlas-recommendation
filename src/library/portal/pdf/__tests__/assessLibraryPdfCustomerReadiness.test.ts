import { describe, expect, it } from 'vitest';
import { buildPortalJourneyPrintModel } from '../buildPortalJourneyPrintModel';
import { buildPdfComparisonAudit } from '../../../pdfQa/buildPdfComparisonAudit';
import type { PdfComparisonScenarioV1 } from '../../../pdfQa/PdfComparisonScenarioV1';
import { assessLibraryPdfCustomerReadiness } from '../assessLibraryPdfCustomerReadiness';

function makePrintModel() {
  return buildPortalJourneyPrintModel({
    selectedSectionIds: ['CON_A01', 'CON_C02', 'CON_C01'],
    recommendationSummary: 'Sealed system with unvented cylinder recommended.',
    customerFacts: ['4-person household', '2 bathrooms'],
  });
}

function makeScenario(overrides: Partial<PdfComparisonScenarioV1> = {}): PdfComparisonScenarioV1 {
  return {
    scenarioLabel: 'clean canonical',
    mode: 'canonical_library_pdf',
    recommendationSummary: 'Sealed system with unvented cylinder recommended.',
    sections: [
      {
        sectionId: 'cover',
        heading: 'Your new heating system',
        bodyText: 'What changes in your home. What you may notice: pressure gauge near boiler.',
      },
      {
        sectionId: 'what_stays_familiar',
        heading: 'What stays familiar',
        bodyText: 'What stays familiar: your radiator routine is familiar.',
      },
      {
        sectionId: 'system_protection',
        heading: 'Protecting the existing heating system',
        bodyText: 'Standard protection and commissioning checks are carried out as part of every installation.',
      },
    ],
    surveyCondition: 'present',
    ...overrides,
  };
}

const SAFE_PROJECTION = {
  safeForCustomer: true,
  blockingReasons: [],
  warnings: [],
  leakageTerms: [],
  missingRequiredContent: [],
} as const;

describe('assessLibraryPdfCustomerReadiness', () => {
  it('clean canonical PDF is ready', () => {
    const result = assessLibraryPdfCustomerReadiness({
      printModel: makePrintModel(),
      projectionSafety: SAFE_PROJECTION,
      pdfComparisonAudit: buildPdfComparisonAudit(makeScenario()),
      surveyCondition: { bleedWaterColour: 'clear' },
    });

    expect(result.readyForCustomer).toBe(true);
    expect(result.blockingReasons).toHaveLength(0);
  });

  it('guessed capacity is blocked', () => {
    const result = assessLibraryPdfCustomerReadiness({
      printModel: makePrintModel(),
      projectionSafety: SAFE_PROJECTION,
      pdfComparisonAudit: buildPdfComparisonAudit(makeScenario({
        sections: [
          {
            sectionId: 'cover',
            heading: 'Your new heating system',
            bodyText: 'An estimated 100–150 L tank size is assumed.',
          },
        ],
        surveyCondition: null,
      })),
    });

    expect(result.readyForCustomer).toBe(false);
    expect(result.blockingReasons.join(' ')).toMatch(/guessed cws\/vented tank capacity/i);
  });

  it('legacy heading is blocked', () => {
    const result = assessLibraryPdfCustomerReadiness({
      printModel: makePrintModel(),
      projectionSafety: SAFE_PROJECTION,
      pdfComparisonAudit: buildPdfComparisonAudit(makeScenario({
        mode: 'legacy_framework_print',
        sections: [
          {
            sectionId: 'main',
            heading: 'Heating System Recommendation',
            bodyText: 'Legacy heading content.',
          },
        ],
        surveyCondition: null,
      })),
    });

    expect(result.readyForCustomer).toBe(false);
    expect(result.blockingReasons.join(' ')).toMatch(/legacy report headings/i);
  });

  it('missing survey condition is warning only', () => {
    const result = assessLibraryPdfCustomerReadiness({
      printModel: makePrintModel(),
      projectionSafety: SAFE_PROJECTION,
      pdfComparisonAudit: buildPdfComparisonAudit(makeScenario({ surveyCondition: null })),
    });

    expect(result.readyForCustomer).toBe(true);
    expect(result.blockingReasons).toHaveLength(0);
    expect(result.warnings.join(' ')).toMatch(/survey condition is unavailable/i);
  });
});

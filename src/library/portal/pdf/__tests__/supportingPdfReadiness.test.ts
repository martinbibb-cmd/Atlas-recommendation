import { describe, expect, it } from 'vitest';
import { buildPortalJourneyPrintModel } from '../buildPortalJourneyPrintModel';
import { assessSupportingPdfReadiness } from '../supportingPdfReadiness';

function buildBaseModel() {
  return buildPortalJourneyPrintModel({
    selectedSectionIds: ['CON_A01', 'CON_C02', 'CON_C01'],
    recommendationSummary: 'Sealed system with unvented cylinder — the right fit for this home.',
    customerFacts: ['4-person household', '2 bathrooms', 'Regular boiler, open-vented circuit'],
    brandProfile: { name: 'Atlas Heating' },
  });
}

function makeReadinessInput() {
  const model = buildBaseModel();
  return {
    model,
    expectedRecommendationSummary: model.cover.summary,
    maxCustomerPages: model.pageEstimate.maxPages,
    requiredDiagramSectionIds: ['what_changes', 'pressure_vs_storage', 'unvented_safety'] as const,
    printSafeLayoutPass: true,
    accessibilityBasicsPass: true,
    insightFallbackAvailable: true,
  };
}

describe('assessSupportingPdfReadiness', () => {
  it('blocks readiness when a required diagram is missing', () => {
    const input = makeReadinessInput();
    const modelWithMissingDiagram = {
      ...input.model,
      sections: input.model.sections.map((section) =>
        section.sectionId === 'pressure_vs_storage'
          ? { ...section, diagramId: undefined }
          : section),
    };

    const result = assessSupportingPdfReadiness({
      ...input,
      model: modelWithMissingDiagram,
    });

    expect(result.ready).toBe(false);
    expect(result.blockingReasons.join(' ')).toMatch(/required diagrams are missing/i);
  });

  it('blocks readiness when raw engine/debug text is present', () => {
    const input = makeReadinessInput();
    const modelWithRawDebugText = {
      ...input.model,
      cover: {
        ...input.model.cover,
        summary: 'System debug trace output.',
      },
    };

    const result = assessSupportingPdfReadiness({
      ...input,
      model: modelWithRawDebugText,
      expectedRecommendationSummary: 'System debug trace output.',
    });

    expect(result.ready).toBe(false);
    expect(result.blockingReasons.join(' ')).toMatch(/raw engine\/debug text/i);
  });

  it('warns at the page-count limit and blocks with warning on overflow', () => {
    const input = makeReadinessInput();

    const atLimit = assessSupportingPdfReadiness({
      ...input,
      model: {
        ...input.model,
        pageEstimate: {
          usedPages: input.maxCustomerPages,
          maxPages: input.maxCustomerPages,
        },
      },
    });
    expect(atLimit.ready).toBe(true);
    expect(atLimit.warnings.join(' ')).toMatch(/at the limit/i);

    const overflow = assessSupportingPdfReadiness({
      ...input,
      model: {
        ...input.model,
        pageEstimate: {
          usedPages: input.maxCustomerPages + 1,
          maxPages: input.maxCustomerPages,
        },
      },
    });
    expect(overflow.ready).toBe(false);
    expect(overflow.warnings.join(' ')).toMatch(/overflow/i);
    expect(overflow.blockingReasons.join(' ')).toMatch(/exceeds allowed limit/i);
  });

  it('blocks readiness when recommendation identity mismatches', () => {
    const input = makeReadinessInput();
    const result = assessSupportingPdfReadiness({
      ...input,
      expectedRecommendationSummary: 'Different recommendation.',
    });

    expect(result.ready).toBe(false);
    expect(result.blockingReasons.join(' ')).toMatch(/recommendation identity/i);
  });
});

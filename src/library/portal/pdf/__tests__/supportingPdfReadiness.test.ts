import { describe, expect, it } from 'vitest';
import { buildPortalJourneyPrintModel } from '../buildPortalJourneyPrintModel';
import { assessSupportingPdfReadiness } from '../supportingPdfReadiness';

function buildBaseModel() {
  return buildPortalJourneyPrintModel({
    journeyType: 'open_vented',
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
    requiredDiagramSectionIds: ['practical_outcomes', 'pressure_vs_storage', 'unvented_safety'] as const,
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

  it('blocks readiness when rendered scene copy contains internal design wording', () => {
    const input = makeReadinessInput();
    const modelWithInternalSceneCopy = {
      ...input.model,
      sections: input.model.sections.map((section) =>
        section.sectionId === 'pressure_vs_storage' && section.storyScene != null
          ? {
              ...section,
              storyScene: {
                ...section.storyScene,
                whyItMatters: 'Spacing dense technical copy lowers cognitive load and improves comprehension.',
              },
            }
          : section),
    };

    const result = assessSupportingPdfReadiness({
      ...input,
      model: modelWithInternalSceneCopy,
    });

    expect(result.ready).toBe(false);
    expect(result.blockingReasons.join(' ')).toMatch(/internal design\/pipeline wording/i);
  });

  it('blocks readiness when scene visuals are unresolved for PDF rendering', () => {
    const input = makeReadinessInput();
    const result = assessSupportingPdfReadiness({
      ...input,
      model: {
        ...input.model,
        contentSource: {
          ...input.model.contentSource!,
          sceneDiagnostics: input.model.contentSource!.sceneDiagnostics.map((diag) =>
            diag.sectionId === 'pressure_vs_storage'
              ? { ...diag, rendererType: 'none', blockingReasons: ['Visual unresolved'] }
              : diag),
        },
      },
    });
    expect(result.ready).toBe(false);
    expect(result.blockingReasons.join(' ')).toMatch(/scene visuals are unresolved/i);
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

  it('blocks readiness when combi recommendation includes stored-hot-water outcomes', () => {
    const input = makeReadinessInput();
    const combiMismatchModel = {
      ...input.model,
      cover: {
        ...input.model.cover,
        summary: 'Combi boiler — best fit for this home.',
      },
      sections: input.model.sections.map((section) =>
        section.sectionId === 'practical_outcomes'
          ? { ...section, summary: 'Stored hot water in the cylinder covers peak demand.' }
          : section),
    };

    const result = assessSupportingPdfReadiness({
      ...input,
      model: combiMismatchModel,
      expectedRecommendationSummary: 'Combi boiler — best fit for this home.',
      reviewRecommendationId: 'combi',
      exportRecommendationId: 'system_unvented',
      snapshotChecksum: 'fnv1a32-deadbeef',
    });

    expect(result.ready).toBe(false);
    expect(result.blockingReasons.join(' ')).toMatch(/combi recommendation cannot render stored-hot-water practical outcomes/i);
    expect(result.blockingReasons.join(' ')).toMatch(/review recommendation id=combi/i);
  });

  it('blocks readiness when a required diagram renderer ID is available but missing', () => {
    const input = makeReadinessInput();
    const result = assessSupportingPdfReadiness({
      ...input,
      requiredDiagramRendererIds: ['pressure_vs_storage'],
      availableDiagramRendererIds: ['pressure_vs_storage', 'warm_vs_hot_radiators'],
      model: {
        ...input.model,
        sections: input.model.sections.map((section) =>
          section.sectionId === 'pressure_vs_storage'
            ? { ...section, diagramRendererId: undefined }
            : section),
      },
    });

    expect(result.ready).toBe(false);
    expect(result.blockingReasons.join(' ')).toMatch(/required diagram is missing/i);
  });

  it('warns without blocking when required diagram renderer ID is not available', () => {
    const input = makeReadinessInput();
    const result = assessSupportingPdfReadiness({
      ...input,
      requiredDiagramRendererIds: ['heat_pump_defrost'],
      availableDiagramRendererIds: ['pressure_vs_storage', 'warm_vs_hot_radiators'],
    });

    expect(result.ready).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/not currently available/i);
  });
});

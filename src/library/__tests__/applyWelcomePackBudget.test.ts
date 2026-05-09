import { describe, expect, it } from 'vitest';
import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import type { EducationalAssetSelectionV1 } from '../routing/EducationalRoutingRuleV1';
import type { EducationalConceptTaxonomyV1 } from '../taxonomy/EducationalConceptTaxonomyV1';
import { welcomePackArchetypes } from '../packComposer/archetypes/welcomePackArchetypes';
import { applyWelcomePackBudget } from '../packComposer/budget/applyWelcomePackBudget';

const archetype = welcomePackArchetypes.find((item) => item.archetypeId === 'heat_pump_install')!;

const concepts: EducationalConceptTaxonomyV1[] = [
  {
    conceptId: 'safety_concept',
    category: 'safety',
    title: 'Safety concept',
    plainEnglishDefinition: 'Safety guidance',
    appliesToSystemTypes: ['all'],
    requiredPriorConceptIds: [],
    relatedConceptIds: [],
    commonMisunderstandings: [],
    dangerousOversimplifications: [],
    confidenceLevel: 'standards_based',
    preferredAssetTypes: ['checklist'],
    defaultAudience: 'all',
    defaultDepth: 'plain',
    printPriority: 'must_print',
    welcomePackPriority: 'must_have',
  },
  {
    conceptId: 'core_concept',
    category: 'whole_system',
    title: 'Core concept',
    plainEnglishDefinition: 'Core pack content',
    appliesToSystemTypes: ['all'],
    requiredPriorConceptIds: [],
    relatedConceptIds: [],
    commonMisunderstandings: [],
    dangerousOversimplifications: [],
    confidenceLevel: 'best_practice',
    preferredAssetTypes: ['diagram'],
    defaultAudience: 'all',
    defaultDepth: 'plain',
    printPriority: 'should_print',
    welcomePackPriority: 'must_have',
  },
  {
    conceptId: 'high_load_concept',
    category: 'heat_pump',
    title: 'High load concept',
    plainEnglishDefinition: 'Deeper technical detail',
    appliesToSystemTypes: ['ashp'],
    requiredPriorConceptIds: [],
    relatedConceptIds: [],
    commonMisunderstandings: [],
    dangerousOversimplifications: [],
    confidenceLevel: 'manufacturer_guidance',
    preferredAssetTypes: ['explainer'],
    defaultAudience: 'all',
    defaultDepth: 'technical',
    printPriority: 'digital_ok',
    welcomePackPriority: 'appendix_only',
  },
];

const assets: EducationalAssetV1[] = [
  {
    id: 'SafetyChecklist',
    conceptIds: ['safety_concept'],
    title: 'Safety checklist',
    assetType: 'checklist',
    audience: 'all',
    depth: 'plain',
    cognitiveLoad: 'low',
    textDensity: 'low',
    motionIntensity: 'none',
    hasStaticFallback: true,
    hasPrintEquivalent: true,
    supportsReducedMotion: true,
    analogyFamilies: ['none'],
    accessibilityProfiles: ['print_first'],
    translationRisk: 'low',
    requiredEngineFacts: [],
    triggerTags: [],
  },
  {
    id: 'CoreDiagram',
    conceptIds: ['core_concept'],
    title: 'Core diagram',
    assetType: 'diagram',
    audience: 'all',
    depth: 'plain',
    cognitiveLoad: 'low',
    textDensity: 'low',
    motionIntensity: 'none',
    hasStaticFallback: true,
    hasPrintEquivalent: true,
    supportsReducedMotion: true,
    analogyFamilies: ['none'],
    accessibilityProfiles: ['print_first'],
    translationRisk: 'low',
    requiredEngineFacts: [],
    triggerTags: [],
  },
  {
    id: 'DeepDiveExplainer',
    conceptIds: ['high_load_concept'],
    title: 'Deep dive',
    assetType: 'explainer',
    audience: 'all',
    depth: 'technical',
    cognitiveLoad: 'high',
    textDensity: 'high',
    motionIntensity: 'low',
    hasStaticFallback: true,
    hasPrintEquivalent: false,
    supportsReducedMotion: true,
    analogyFamilies: ['none'],
    accessibilityProfiles: ['plain_language'],
    translationRisk: 'medium',
    requiredEngineFacts: [],
    triggerTags: [],
  },
];

function buildRoutingSelection(): EducationalAssetSelectionV1 {
  return {
    selected: [
      {
        assetId: 'SafetyChecklist',
        ruleId: 'test',
        reason: 'Safety is required.',
        sectionTarget: 'next_steps',
        priority: 100,
        printWeight: 10,
        cognitiveLoadImpact: 'low',
      },
      {
        assetId: 'CoreDiagram',
        ruleId: 'test',
        reason: 'Core explanation is relevant.',
        sectionTarget: 'why_this_fits',
        priority: 90,
        printWeight: 8,
        cognitiveLoadImpact: 'low',
      },
      {
        assetId: 'DeepDiveExplainer',
        ruleId: 'test',
        reason: 'Extra technical detail is available.',
        sectionTarget: 'relevant_explainers',
        priority: 80,
        printWeight: 2,
        cognitiveLoadImpact: 'high',
      },
    ],
    omitted: [],
    warnings: [],
  };
}

describe('applyWelcomePackBudget', () => {
  it('keeps must-print safety concepts in the printed pack', () => {
    const result = applyWelcomePackBudget({
      routingSelection: buildRoutingSelection(),
      archetype: { ...archetype, maxPrintPages: 1, maxCoreConcepts: 1 },
      assets,
      concepts,
      accessibilityPreferences: {
        prefersPrint: true,
      },
    });

    expect(result.selectedWithinBudget.map((item) => item.assetId)).toContain('SafetyChecklist');
    expect(result.omittedWithReason.some((item) => item.assetId === 'SafetyChecklist')).toBe(false);
  });

  it('moves high cognitive-load content to the appendix or QR and keeps reasons', () => {
    const appendixArchetype = {
      ...archetype,
      recommendedConceptIds: [...archetype.recommendedConceptIds, 'high_load_concept'],
    };
    const appendixResult = applyWelcomePackBudget({
      routingSelection: buildRoutingSelection(),
      archetype: appendixArchetype,
      assets,
      concepts,
      accessibilityPreferences: {
        includeTechnicalAppendix: true,
      },
    });
    const qrResult = applyWelcomePackBudget({
      routingSelection: buildRoutingSelection(),
      archetype: appendixArchetype,
      assets,
      concepts,
      accessibilityPreferences: {
        includeTechnicalAppendix: false,
      },
    });

    expect(appendixResult.movedToAppendix.map((item) => item.assetId)).toContain('DeepDiveExplainer');
    expect(qrResult.deferredToQr.map((item) => item.assetId)).toContain('DeepDiveExplainer');
    expect(appendixResult.movedToAppendix.every((item) => item.reason.length > 0)).toBe(true);
    expect(qrResult.deferredToQr.every((item) => item.reason.length > 0)).toBe(true);
  });

  it('enforces the page budget and records omission or deferral reasons', () => {
    const result = applyWelcomePackBudget({
      routingSelection: buildRoutingSelection(),
      archetype: { ...archetype, maxPrintPages: 2, maxCoreConcepts: 2 },
      assets,
      concepts,
      accessibilityPreferences: {
        prefersPrint: true,
      },
    });

    expect(result.pageBudgetUsed).toBeLessThanOrEqual(result.appliedBudget.maxPages);
    expect([...result.deferredToQr, ...result.movedToAppendix].every((item) => item.reason.length > 0)).toBe(true);
    expect(result.omittedWithReason.every((item) => item.reason.length > 0)).toBe(true);
  });
});

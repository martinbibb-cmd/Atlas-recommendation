import { describe, expect, it } from 'vitest';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { WelcomePackPlanV1 } from '../packComposer/WelcomePackComposerV1';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';
import { buildPrintableWelcomePackViewModel } from '../packRenderer/buildPrintableWelcomePackViewModel';
import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import { getContentForConcepts } from '../content/contentLookup';

const customerSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system',
  recommendedSystemLabel: 'System boiler with hot-water cylinder',
  headline: 'System boiler is the right fit for this home.',
  plainEnglishDecision: 'The selected system fits the property and demand context.',
  whyThisWins: ['Hydraulic and hot-water context supports this topology.'],
  whatThisAvoids: ['Avoids unstable operation from mismatched setup.'],
  includedNow: ['System boiler', 'Cylinder', 'Controls'],
  requiredChecks: ['Final commissioning checks'],
  optionalUpgrades: ['Future tariff optimisation'],
  futureReady: ['Time-of-use optimisation path'],
  confidenceNotes: ['Decision grounded in surveyed evidence and constraints.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative: 'System option selected due to fit and constraints.',
};

function makeAsset(id: string, conceptIds: string[]): EducationalAssetV1 {
  return {
    id,
    conceptIds,
    title: id,
    assetType: 'explainer',
    audience: 'all',
    depth: 'plain',
    cognitiveLoad: 'low',
    textDensity: 'low',
    motionIntensity: 'none',
    hasStaticFallback: true,
    hasPrintEquivalent: true,
    supportsReducedMotion: true,
    analogyFamilies: ['none'],
    accessibilityProfiles: ['plain_language'],
    translationRisk: 'low',
    requiredEngineFacts: [],
    triggerTags: [],
  };
}

const assets: EducationalAssetV1[] = [
  makeAsset('CompensationExplainer', ['CON-01']),
  makeAsset('PressureExplainer', ['HYD-02']),
  makeAsset('CylinderSafetyExplainer', ['SAF-01']),
  makeAsset('CyclingAppendixExplainer', ['SIZ-02']),
];

const plan: WelcomePackPlanV1 = {
  packId: 'welcome-pack:system',
  recommendedScenarioId: 'system',
  archetypeId: 'boiler_refresh',
  sections: [
    { id: 'calm_summary', includedAssetIds: ['CompensationExplainer'], notes: [] },
    { id: 'why_this_fits', includedAssetIds: [], notes: [] },
    { id: 'living_with_the_system', includedAssetIds: ['PressureExplainer'], notes: [] },
    { id: 'relevant_explainers', includedAssetIds: [], notes: [] },
    { id: 'optional_technical_appendix', includedAssetIds: ['CyclingAppendixExplainer'], notes: [] },
    { id: 'next_steps', includedAssetIds: ['CylinderSafetyExplainer'], notes: [] },
  ],
  selectedAssetIds: [
    'CompensationExplainer',
    'PressureExplainer',
    'CylinderSafetyExplainer',
    'CyclingAppendixExplainer',
  ],
  selectedAssetReasons: {
    CompensationExplainer: ['MVP content smoke test'],
    PressureExplainer: ['MVP content smoke test'],
    CylinderSafetyExplainer: ['MVP content smoke test'],
    CyclingAppendixExplainer: ['MVP content smoke test'],
  },
  selectedConceptIds: ['CON-01', 'HYD-02', 'SAF-01', 'SIZ-02'],
  deferredConceptIds: [],
  omittedAssetIdsWithReason: [],
  printPageBudget: 6,
  pageBudgetUsed: 4,
  cognitiveLoadBudget: 'medium',
  qrDestinations: [],
};

describe('buildPrintableWelcomePackViewModel content integration', () => {
  it('uses educational print content when provided', () => {
    const vm = buildPrintableWelcomePackViewModel(
      plan,
      customerSummary,
      educationalConceptTaxonomy,
      assets,
      { educationalContent: getContentForConcepts(plan.selectedConceptIds) },
    );

    const calmSummary = vm.sections.find((section) => section.sectionId === 'calm_summary');
    expect(calmSummary?.placeholderText).toContain('Compensation controls and lukewarm radiators');
    expect(calmSummary?.placeholderText).toContain('Lukewarm radiators can be normal with compensation');
  });

  it('keeps content pending placeholders for sections with missing content', () => {
    const vm = buildPrintableWelcomePackViewModel(
      {
        ...plan,
        sections: plan.sections.map((section) => (
          section.id === 'why_this_fits'
            ? { ...section, includedAssetIds: ['UnknownConceptAsset'] }
            : section
        )),
        selectedAssetIds: [...plan.selectedAssetIds, 'UnknownConceptAsset'],
      },
      customerSummary,
      educationalConceptTaxonomy,
      [...assets, makeAsset('UnknownConceptAsset', ['unknown-concept'])],
      { educationalContent: getContentForConcepts(plan.selectedConceptIds) },
    );

    const whyThisFits = vm.sections.find((section) => section.sectionId === 'why_this_fits');
    expect(whyThisFits?.placeholderText).toBe('Content pending: why-this-fits explanation copy will be authored.');
  });

  it('routes safety notices into safety_and_compliance', () => {
    const vm = buildPrintableWelcomePackViewModel(
      plan,
      customerSummary,
      educationalConceptTaxonomy,
      assets,
      { educationalContent: getContentForConcepts(plan.selectedConceptIds) },
    );

    const safety = vm.sections.find((section) => section.sectionId === 'safety_and_compliance');
    expect(safety?.placeholderText).toContain('Never leave the filling loop open after top-up.');
    expect(safety?.placeholderText).toContain('Do not block, cap, or reroute safety discharge pipework.');
  });

  it('keeps technical appendix summaries out of core sections and out of appendix unless enabled', () => {
    const vmWithoutAppendix = buildPrintableWelcomePackViewModel(
      plan,
      customerSummary,
      educationalConceptTaxonomy,
      assets,
      {
        educationalContent: getContentForConcepts(plan.selectedConceptIds),
        includeTechnicalAppendix: false,
      },
    );

    const calmSummary = vmWithoutAppendix.sections.find((section) => section.sectionId === 'calm_summary');
    const appendix = vmWithoutAppendix.sections.find((section) => section.sectionId === 'optional_technical_appendix');
    expect(calmSummary?.placeholderText).not.toContain('part-load losses');
    expect(appendix?.placeholderText).toBe('Content pending: optional technical appendix detail will be authored.');

    const vmWithAppendix = buildPrintableWelcomePackViewModel(
      plan,
      customerSummary,
      educationalConceptTaxonomy,
      assets,
      {
        educationalContent: getContentForConcepts(plan.selectedConceptIds),
        includeTechnicalAppendix: true,
      },
    );

    const appendixWithContent = vmWithAppendix.sections.find((section) => section.sectionId === 'optional_technical_appendix');
    expect(appendixWithContent?.placeholderText).toContain('Short cycling increases start losses');
  });

  it('does not change recommendedScenarioId when educational content is supplied', () => {
    const vm = buildPrintableWelcomePackViewModel(
      plan,
      customerSummary,
      educationalConceptTaxonomy,
      assets,
      { educationalContent: getContentForConcepts(plan.selectedConceptIds) },
    );

    expect(vm.recommendedScenarioId).toBe(plan.recommendedScenarioId);
  });
});

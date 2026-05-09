import { describe, expect, it } from 'vitest';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { WelcomePackPlanV1 } from '../packComposer/WelcomePackComposerV1';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';
import { buildPrintableWelcomePackViewModel } from '../packRenderer/buildPrintableWelcomePackViewModel';

const customerSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'ashp',
  recommendedSystemLabel: 'Air source heat pump with cylinder',
  headline: 'Heat pump is the right fit for this property.',
  plainEnglishDecision: 'A heat pump suits the property and hot-water setup.',
  whyThisWins: ['Low-temperature operation fits the surveyed fabric.'],
  whatThisAvoids: ['Avoids another boiler replacement cycle.'],
  includedNow: ['Heat pump', 'Cylinder', 'Weather compensation controls'],
  requiredChecks: ['Check radiator emitter output'],
  optionalUpgrades: ['Future zoning controls'],
  futureReady: ['Tariff-ready charging later'],
  confidenceNotes: ['Recommendation is based on surveyed demand and constraints.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative: 'Heat pump is recommended due to property fit and future-ready value.',
};

const plan: WelcomePackPlanV1 = {
  packId: 'welcome-pack:ashp',
  recommendedScenarioId: 'ashp',
  archetypeId: 'heat_pump_install',
  sections: [
    { id: 'calm_summary', includedAssetIds: ['SystemWorkExplainerCards'], notes: [] },
    { id: 'why_this_fits', includedAssetIds: ['ControlsVisual'], notes: [] },
    { id: 'living_with_the_system', includedAssetIds: [], notes: [] },
    { id: 'relevant_explainers', includedAssetIds: [], notes: [] },
    { id: 'next_steps', includedAssetIds: ['HpCylinderDiagram'], notes: [] },
  ],
  selectedAssetIds: ['SystemWorkExplainerCards', 'ControlsVisual', 'HpCylinderDiagram'],
  selectedAssetReasons: {
    SystemWorkExplainerCards: ['Selected for core scope clarity.'],
    ControlsVisual: ['Selected for controls guidance.'],
    HpCylinderDiagram: ['Selected for cylinder safety concept.'],
  },
  selectedConceptIds: [
    'system_work_explainer',
    'scope_clarity',
    'control_strategy',
    'weather_compensation',
    'hp_cylinder_temperature',
    'legionella_pasteurisation',
  ],
  deferredConceptIds: ['flow_restriction', 'pipework_constraint'],
  omittedAssetIdsWithReason: [
    {
      assetId: 'FlowRestrictionAnimation',
      reason: 'Deferred to QR deep dive to protect print budget and cognitive load.',
    },
    {
      assetId: 'BoilerCyclingAnimation',
      reason: 'No routing rule selected this asset for the current context.',
    },
  ],
  printPageBudget: 4,
  pageBudgetUsed: 3,
  cognitiveLoadBudget: 'medium',
  qrDestinations: ['atlas://educational-library/FlowRestrictionAnimation'],
};

describe('buildPrintableWelcomePackViewModel', () => {
  it('only includes concepts and assets already selected by the plan', () => {
    const vm = buildPrintableWelcomePackViewModel(
      plan,
      customerSummary,
      educationalConceptTaxonomy,
      educationalAssetRegistry,
    );

    const sectionAssetIds = vm.sections.flatMap((section) => section.assetIds);
    const sectionConceptIds = vm.sections.flatMap((section) => section.conceptIds);

    expect(sectionAssetIds.every((assetId) => plan.selectedAssetIds.includes(assetId))).toBe(true);
    expect(sectionConceptIds.every((conceptId) => plan.selectedConceptIds.includes(conceptId))).toBe(true);
  });

  it('groups must-print safety concepts into safety_and_compliance', () => {
    const vm = buildPrintableWelcomePackViewModel(
      plan,
      customerSummary,
      educationalConceptTaxonomy,
      educationalAssetRegistry,
    );

    const safetySection = vm.sections.find((section) => section.sectionId === 'safety_and_compliance');
    expect(safetySection).toBeDefined();
    expect(safetySection?.assetIds).toContain('HpCylinderDiagram');
    expect(safetySection?.conceptIds).toContain('legionella_pasteurisation');

    const nextSteps = vm.sections.find((section) => section.sectionId === 'next_steps');
    expect(nextSteps?.assetIds).not.toContain('HpCylinderDiagram');
  });

  it('keeps deferred QR concepts in the QR/deeper-detail model section', () => {
    const vm = buildPrintableWelcomePackViewModel(
      plan,
      customerSummary,
      educationalConceptTaxonomy,
      educationalAssetRegistry,
    );

    expect(vm.qrDestinations).toHaveLength(1);
    expect(vm.qrDestinations[0].assetId).toBe('FlowRestrictionAnimation');
    expect(vm.qrDestinations[0].conceptIds).toEqual(expect.arrayContaining(['flow_restriction', 'pipework_constraint']));
  });

  it('preserves omitted reasons and keeps recommendedScenarioId unchanged', () => {
    const vm = buildPrintableWelcomePackViewModel(
      plan,
      customerSummary,
      educationalConceptTaxonomy,
      educationalAssetRegistry,
    );

    const omitted = vm.omittedSummary.omittedAssets.find((item) => item.assetId === 'BoilerCyclingAnimation');
    const deferred = vm.omittedSummary.omittedAssets.find((item) => item.assetId === 'FlowRestrictionAnimation');

    expect(omitted?.reason).toBe('No routing rule selected this asset for the current context.');
    expect(deferred?.reason).toContain('Deferred to QR deep dive');
    expect(deferred?.deferredToQr).toBe(true);
    expect(vm.recommendedScenarioId).toBe(plan.recommendedScenarioId);
  });
});

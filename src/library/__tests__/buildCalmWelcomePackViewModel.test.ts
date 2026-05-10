import { describe, expect, it } from 'vitest';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { EducationalContentV1 } from '../content/EducationalContentV1';
import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import type { WelcomePackPlanV1 } from '../packComposer/WelcomePackComposerV1';
import { buildCalmWelcomePackViewModel } from '../packRenderer/buildCalmWelcomePackViewModel';
import type { EducationalConceptTaxonomyV1 } from '../taxonomy/EducationalConceptTaxonomyV1';

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

const taxonomy: EducationalConceptTaxonomyV1[] = [
  {
    conceptId: 'CON-01',
    category: 'controls',
    title: 'Compensation',
    plainEnglishDefinition: 'Controls support stable comfort.',
    appliesToSystemTypes: ['all'],
    requiredPriorConceptIds: [],
    relatedConceptIds: [],
    commonMisunderstandings: [],
    dangerousOversimplifications: [],
    confidenceLevel: 'best_practice',
    preferredAssetTypes: ['explainer'],
    defaultAudience: 'all',
    defaultDepth: 'plain',
    printPriority: 'should_print',
    welcomePackPriority: 'should_have',
  },
  {
    conceptId: 'SAF-01',
    category: 'safety',
    title: 'Cylinder safety',
    plainEnglishDefinition: 'Keep safety discharge clear.',
    appliesToSystemTypes: ['all'],
    requiredPriorConceptIds: [],
    relatedConceptIds: [],
    commonMisunderstandings: [],
    dangerousOversimplifications: [],
    confidenceLevel: 'standards_based',
    preferredAssetTypes: ['explainer'],
    defaultAudience: 'all',
    defaultDepth: 'plain',
    printPriority: 'must_print',
    welcomePackPriority: 'must_have',
  },
];

function createMockAsset(
  id: string,
  conceptIds: string[],
  cognitiveLoad: EducationalAssetV1['cognitiveLoad'] = 'low',
): EducationalAssetV1 {
  return {
    id,
    conceptIds,
    title: id,
    assetType: 'explainer',
    audience: 'all',
    depth: 'plain',
    cognitiveLoad,
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
  createMockAsset('EligibleAsset', ['CON-01']),
  createMockAsset('IneligibleAsset', ['CON-01']),
  createMockAsset('MissingContentAsset', ['MISSING-01']),
  createMockAsset('SafetyAsset', ['SAF-01']),
  createMockAsset('MediumLoadAsset', ['CON-01'], 'medium'),
];

const educationalContent: EducationalContentV1[] = [
  {
    contentId: 'content-con-01',
    conceptId: 'CON-01',
    title: 'Compensation controls',
    plainEnglishSummary: 'Compensation adjusts output to weather.',
    customerExplanation: 'Compensation maintains comfort with steady flow temperatures.',
    analogyOptions: [],
    commonMisunderstanding: 'Radiators should always feel very hot.',
    dangerousOversimplification: 'Hotter flow always means better comfort.',
    printSummary: 'Compensation supports steady comfort with lower flow temperatures.',
    readingLevel: 'simple',
    accessibilityNotes: [],
    requiredEvidenceFacts: [],
    confidenceLevel: 'best_practice',
    qrDeepDiveTitle: 'Compensation deep detail',
  },
  {
    contentId: 'content-saf-01',
    conceptId: 'SAF-01',
    title: 'Cylinder safety',
    plainEnglishSummary: 'Safety discharge routes must stay clear.',
    customerExplanation: 'Do not block discharge pipework.',
    analogyOptions: [],
    commonMisunderstanding: 'Safety outlets can be capped.',
    dangerousOversimplification: 'Small leaks can be ignored.',
    printSummary: 'Keep the safety discharge route clear and unobstructed.',
    safetyNotice: 'Do not block, cap, or reroute safety discharge pipework.',
    readingLevel: 'simple',
    accessibilityNotes: [],
    requiredEvidenceFacts: [],
    confidenceLevel: 'standards_based',
  },
];

const plan: WelcomePackPlanV1 = {
  packId: 'welcome-pack:ashp',
  recommendedScenarioId: 'ashp',
  archetypeId: 'heat_pump_install',
  sections: [
    { id: 'calm_summary', includedAssetIds: ['EligibleAsset'], notes: [] },
    { id: 'why_this_fits', includedAssetIds: ['IneligibleAsset', 'MediumLoadAsset'], notes: [] },
    { id: 'living_with_the_system', includedAssetIds: ['MissingContentAsset'], notes: [] },
    { id: 'relevant_explainers', includedAssetIds: [], notes: [] },
    { id: 'next_steps', includedAssetIds: ['SafetyAsset'], notes: [] },
  ],
  selectedAssetIds: ['EligibleAsset', 'IneligibleAsset', 'MissingContentAsset', 'SafetyAsset', 'MediumLoadAsset'],
  selectedAssetReasons: {
    EligibleAsset: ['Selected by routing.'],
    IneligibleAsset: ['Selected by routing.'],
    MissingContentAsset: ['Selected by routing.'],
    SafetyAsset: ['Selected by routing.'],
    MediumLoadAsset: ['Selected by routing.'],
  },
  selectedConceptIds: ['CON-01', 'SAF-01', 'MISSING-01'],
  deferredConceptIds: ['CON-01'],
  omittedAssetIdsWithReason: [
    { assetId: 'IneligibleAsset', reason: 'Deferred to QR detail for deeper explanation.' },
  ],
  printPageBudget: 6,
  pageBudgetUsed: 5,
  cognitiveLoadBudget: 'medium',
  qrDestinations: ['atlas://educational-library/IneligibleAsset'],
  eligibilityFindings: [
    {
      assetId: 'EligibleAsset',
      conceptIds: ['CON-01'],
      eligible: true,
      mode: 'customer_pack',
      reasons: [],
      severity: 'info',
    },
    {
      assetId: 'IneligibleAsset',
      conceptIds: ['CON-01'],
      eligible: false,
      mode: 'customer_pack',
      reasons: ['Audit does not include customer_pack in approvedFor.'],
      severity: 'error',
    },
    {
      assetId: 'MissingContentAsset',
      conceptIds: ['MISSING-01'],
      eligible: true,
      mode: 'customer_pack',
      reasons: [],
      severity: 'info',
    },
    {
      assetId: 'SafetyAsset',
      conceptIds: ['SAF-01'],
      eligible: true,
      mode: 'customer_pack',
      reasons: [],
      severity: 'info',
    },
    {
      assetId: 'MediumLoadAsset',
      conceptIds: ['CON-01'],
      eligible: true,
      mode: 'customer_pack',
      reasons: [],
      severity: 'info',
    },
  ],
};

describe('buildCalmWelcomePackViewModel', () => {
  it('filters out ineligible assets for customer-pack output', () => {
    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'warn',
    });

    const assetIds = vm.customerFacingSections.flatMap((section) => section.cards.map((card) => card.assetId).filter(Boolean));
    expect(assetIds).not.toContain('IneligibleAsset');
    expect(vm.readiness.safeForCustomer).toBe(false);
    expect(vm.readiness.blockingReasons.some((reason) => /eligibility filtering/i.test(reason))).toBe(true);
  });

  it('omits missing content without emitting content-pending text', () => {
    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
    });

    const rawOutput = JSON.stringify(vm);
    expect(rawOutput.toLowerCase()).not.toContain('content pending');

    const missingContentLog = vm.internalOmissionLog.find((item) => item.assetId === 'MissingContentAsset');
    expect(missingContentLog?.reason).toMatch(/no educational content entry/i);
  });

  it('adds blocking reasons when a calm pack cannot be safely built', () => {
    const vm = buildCalmWelcomePackViewModel({
      plan: {
        ...plan,
        eligibilityFindings: undefined,
      },
      customerSummary,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'off',
    });

    expect(vm.readiness.safeForCustomer).toBe(false);
    expect(vm.readiness.blockingReasons.length).toBeGreaterThan(0);
  });

  it('adds a blocking reason when eligibilityMode is not filter even with valid findings', () => {
    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'off',
    });

    expect(vm.readiness.blockingReasons.some((reason) => /eligibility filtering/i.test(reason))).toBe(true);
  });

  it('keeps recommendedScenarioId unchanged', () => {
    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
    });

    expect(vm.recommendedScenarioId).toBe(plan.recommendedScenarioId);
  });

  it('does not leak dev, QA, or audit text into customer output', () => {
    const vm = buildCalmWelcomePackViewModel({
      plan,
      customerSummary,
      taxonomy,
      assets,
      educationalContent,
      eligibilityMode: 'filter',
    });

    const output = JSON.stringify({
      title: vm.title,
      sections: vm.customerFacingSections,
      qrDestinations: vm.qrDestinations,
    }).toLowerCase();

    expect(output).not.toContain('dev');
    expect(output).not.toContain('qa');
    expect(output).not.toContain('audit');
    expect(output).not.toContain('diagnostic');
  });
});

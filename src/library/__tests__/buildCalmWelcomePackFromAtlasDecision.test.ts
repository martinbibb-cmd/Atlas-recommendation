import { describe, expect, it } from 'vitest';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { BrandProfileV1 } from '../../features/branding/brandProfile';
import { buildWelcomePackPlan } from '../packComposer/buildWelcomePackPlan';
import { buildCalmWelcomePackFromAtlasDecision } from '../packRenderer/buildCalmWelcomePackFromAtlasDecision';

const customerSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'System boiler with stored hot water',
  headline: 'Stored hot water is the right fit for this home.',
  plainEnglishDecision: 'This home benefits from stored hot water and steady heating output.',
  whyThisWins: ['Stored hot water supports concurrent outlet demand.', 'Controls improve comfort.'],
  whatThisAvoids: ['On-demand short-draw efficiency loss.'],
  includedNow: ['System controls upgrade', 'Stored hot water cylinder'],
  requiredChecks: ['Check radiator emitter output'],
  optionalUpgrades: ['Future zoning controls'],
  futureReady: ['Heat-source-ready hydraulic layout'],
  confidenceNotes: ['Recommendation is based on surveyed demand and constraints.'],
  hardConstraints: ['On-demand hot water option fails simultaneous demand.'],
  performancePenalties: ['Short draw patterns reduce on-demand efficiency.'],
  fitNarrative: 'Atlas selected stored hot water due to demand profile and performance risk.',
};

const atlasDecision: AtlasDecisionV1 = {
  recommendedScenarioId: 'system_unvented',
  headline: customerSummary.headline,
  summary: customerSummary.fitNarrative,
  keyReasons: [...customerSummary.whyThisWins],
  avoidedRisks: [...customerSummary.whatThisAvoids],
  dayToDayOutcomes: ['Stable hot water availability', 'Comfort-led control behaviour'],
  requiredWorks: ['Controls commissioning'],
  compatibilityWarnings: ['Emitter checks required'],
  includedItems: ['Stored hot water cylinder', 'System controls upgrade'],
  quoteScope: [],
  futureUpgradePaths: ['Future low-temperature tuning'],
  supportingFacts: [],
  lifecycle: {
    currentSystem: {
      type: 'system',
      ageYears: 0,
      condition: 'unknown',
    },
    expectedLifespan: {
      typicalRangeYears: [10, 15],
      adjustedRangeYears: [10, 15],
    },
    influencingFactors: {
      waterQuality: 'unknown',
      scaleRisk: 'low',
      usageIntensity: 'medium',
      maintenanceLevel: 'unknown',
    },
    riskIndicators: [],
    summary: 'Lifecycle data is not fully available yet.',
  },
};

const scenarios: ScenarioResult[] = [
  {
    scenarioId: 'system_unvented',
    system: {
      type: 'system',
      summary: 'System boiler with stored hot water',
    },
    performance: {
      hotWater: 'very_good',
      heating: 'very_good',
      efficiency: 'good',
      reliability: 'very_good',
    },
    keyBenefits: ['Stored hot water supports concurrent demand'],
    keyConstraints: ['Requires cylinder and controls commissioning'],
    dayToDayOutcomes: ['Consistent stored hot water'],
    requiredWorks: ['Install or validate stored cylinder'],
    upgradePaths: ['Future low-temperature operation'],
    physicsFlags: {
      combiFlowRisk: true,
    },
  },
];

const brandProfile: BrandProfileV1 = {
  version: '1.0',
  brandId: 'installer-demo',
  companyName: 'Demo Heating Co',
  logoUrl: 'https://example.com/demo-logo.svg',
  theme: {
    primaryColor: '#16A34A',
  },
  contact: {
    phone: '0800 123 4567',
  },
  outputSettings: {
    showPricing: true,
    showCarbon: true,
    showInstallerContact: true,
    tone: 'friendly',
  },
};

describe('buildCalmWelcomePackFromAtlasDecision', () => {
  it('builds from real-ish decision, summary, and scenarios', () => {
    const result = buildCalmWelcomePackFromAtlasDecision({
      customerSummary,
      atlasDecision,
      scenarios,
      userConcernTags: ['controls'],
      propertyConstraintTags: ['hydraulic'],
    });

    expect(result.plan.packId).toContain('welcome-pack:');
    expect(result.plan.archetypeId.length).toBeGreaterThan(0);
    expect(result.readiness).toEqual(result.brandedViewModel.readiness);
  });

  it('uses eligibility filter mode for plan composition', () => {
    const fromBuilder = buildCalmWelcomePackFromAtlasDecision({
      customerSummary,
      atlasDecision,
      scenarios,
    });
    const directFilterPlan = buildWelcomePackPlan({
      customerSummary,
      atlasDecision,
      scenarios,
      eligibilityMode: 'filter',
    });
    const offPlan = buildWelcomePackPlan({
      customerSummary,
      atlasDecision,
      scenarios,
      eligibilityMode: 'off',
    });

    expect(fromBuilder.plan.selectedAssetIds).toEqual(directFilterPlan.selectedAssetIds);
    expect(fromBuilder.plan.eligibilityFindings).toBeDefined();
    expect(offPlan.eligibilityFindings).toBeUndefined();
  });

  it('returns customer-safe view models without diagnostics', () => {
    const result = buildCalmWelcomePackFromAtlasDecision({
      customerSummary,
      atlasDecision,
      scenarios,
      brandProfile,
    });

    expect(result.calmViewModel.internalOmissionLog).toEqual([]);
    expect(result.brandedViewModel.internalOmissionLog).toEqual([]);
  });

  it('keeps branded output blocked when pack is unsafe', () => {
    const result = buildCalmWelcomePackFromAtlasDecision({
      customerSummary: {
        ...customerSummary,
        recommendedScenarioId: 'combi',
      },
      atlasDecision,
      scenarios,
      brandProfile,
    });

    expect(result.readiness.safeForCustomer).toBe(false);
    expect(result.brandedViewModel.readiness.safeForCustomer).toBe(false);
    expect(result.readiness.blockingReasons.length).toBeGreaterThan(0);
  });

  it('applies brand decoration without changing recommendation content', () => {
    const result = buildCalmWelcomePackFromAtlasDecision({
      customerSummary,
      atlasDecision,
      scenarios,
      brandProfile,
      visitReference: 'VIS-123',
    });

    expect(result.brandedViewModel.customerFacingSections).toEqual(result.calmViewModel.customerFacingSections);
    expect(result.brandedViewModel.readiness).toEqual(result.calmViewModel.readiness);
    expect(result.brandedViewModel.recommendedScenarioId).toBe(result.calmViewModel.recommendedScenarioId);
    expect(result.brandedViewModel.brandName).toBe('Demo Heating Co');
    expect(result.brandedViewModel.visitReference).toBe('VIS-123');
  });

  it('keeps recommendedScenarioId stable', () => {
    const result = buildCalmWelcomePackFromAtlasDecision({
      customerSummary,
      atlasDecision,
      scenarios,
    });

    expect(result.plan.recommendedScenarioId).toBe(atlasDecision.recommendedScenarioId);
    expect(result.calmViewModel.recommendedScenarioId).toBe(atlasDecision.recommendedScenarioId);
    expect(result.brandedViewModel.recommendedScenarioId).toBe(atlasDecision.recommendedScenarioId);
  });
});

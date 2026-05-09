import { describe, expect, it } from 'vitest';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import { buildWelcomePackPlan } from '../packComposer/buildWelcomePackPlan';

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

describe('buildWelcomePackPlan', () => {
  it('composer never changes recommendedScenarioId', () => {
    const plan = buildWelcomePackPlan({
      customerSummary,
      atlasDecision,
      scenarios,
    });
    expect(plan.recommendedScenarioId).toBe(atlasDecision.recommendedScenarioId);
  });

  it('composer respects page budget', () => {
    const plan = buildWelcomePackPlan({
      customerSummary,
      atlasDecision,
      scenarios,
      accessibilityPreferences: {
        includeTechnicalAppendix: true,
      },
      userConcernTags: ['cycling', 'flow', 'controls', 'emitters', 'comparison'],
      propertyConstraintTags: ['hydraulic'],
    });
    expect(plan.printPageBudget).toBe(4);
    expect(plan.selectedAssetIds.length).toBeLessThanOrEqual(plan.printPageBudget);
  });

  it('composer omits irrelevant assets', () => {
    const plan = buildWelcomePackPlan({
      customerSummary,
      atlasDecision,
      scenarios,
      userConcernTags: ['controls'],
      propertyConstraintTags: [],
    });

    expect(
      plan.omittedAssetIdsWithReason.some((omitted) => omitted.assetId === 'BoilerCyclingAnimation'),
    ).toBe(true);
  });

  it('composer explains why each included asset is present', () => {
    const plan = buildWelcomePackPlan({
      customerSummary,
      atlasDecision,
      scenarios,
      userConcernTags: ['controls'],
      propertyConstraintTags: ['comfort'],
    });

    for (const assetId of plan.selectedAssetIds) {
      expect(plan.selectedAssetReasons[assetId]).toBeDefined();
      expect(plan.selectedAssetReasons[assetId].length).toBeGreaterThan(0);
    }
  });
});

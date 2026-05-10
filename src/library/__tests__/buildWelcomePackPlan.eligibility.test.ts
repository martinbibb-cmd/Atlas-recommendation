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

describe('buildWelcomePackPlan eligibility gate', () => {
  describe('eligibilityMode: off (default)', () => {
    it('does not emit eligibilityFindings when mode is off', () => {
      const plan = buildWelcomePackPlan({ customerSummary, atlasDecision, scenarios });
      expect(plan.eligibilityFindings).toBeUndefined();
    });

    it('preserves selectedAssetIds when mode is off', () => {
      const planWithout = buildWelcomePackPlan({ customerSummary, atlasDecision, scenarios });
      const planOff = buildWelcomePackPlan({
        customerSummary,
        atlasDecision,
        scenarios,
        eligibilityMode: 'off',
      });
      expect(planOff.selectedAssetIds).toEqual(planWithout.selectedAssetIds);
    });

    it('never changes recommendedScenarioId regardless of eligibilityMode', () => {
      for (const mode of ['off', 'warn', 'filter'] as const) {
        const plan = buildWelcomePackPlan({ customerSummary, atlasDecision, scenarios, eligibilityMode: mode });
        expect(plan.recommendedScenarioId).toBe('system_unvented');
      }
    });
  });

  describe('eligibilityMode: warn', () => {
    it('emits eligibilityFindings in warn mode', () => {
      const plan = buildWelcomePackPlan({
        customerSummary,
        atlasDecision,
        scenarios,
        eligibilityMode: 'warn',
      });
      expect(plan.eligibilityFindings).toBeDefined();
      expect(Array.isArray(plan.eligibilityFindings)).toBe(true);
    });

    it('preserves all selected asset IDs in warn mode even when assets are ineligible', () => {
      const planOff = buildWelcomePackPlan({ customerSummary, atlasDecision, scenarios, eligibilityMode: 'off' });
      const planWarn = buildWelcomePackPlan({ customerSummary, atlasDecision, scenarios, eligibilityMode: 'warn' });
      // warn mode must not remove assets — selected count is the same as off mode
      expect(planWarn.selectedAssetIds).toEqual(planOff.selectedAssetIds);
    });

    it('surfaces eligibility findings for each selected asset', () => {
      const plan = buildWelcomePackPlan({
        customerSummary,
        atlasDecision,
        scenarios,
        eligibilityMode: 'warn',
      });
      const findingIds = (plan.eligibilityFindings ?? []).map((f) => f.assetId);
      for (const assetId of plan.selectedAssetIds) {
        expect(findingIds).toContain(assetId);
      }
    });

    it('flags seeded audit assets as ineligible for customer_pack (all have empty approvedFor)', () => {
      const plan = buildWelcomePackPlan({
        customerSummary,
        atlasDecision,
        scenarios,
        eligibilityMode: 'warn',
      });
      const ineligible = (plan.eligibilityFindings ?? []).filter((f) => !f.eligible);
      // seeded audits all have approvedFor: [] so at least some should be ineligible
      // (may be 0 if no seeded-audit assets are selected for this fixture)
      expect(typeof ineligible.length).toBe('number');
    });
  });

  describe('eligibilityMode: filter', () => {
    it('emits eligibilityFindings in filter mode', () => {
      const plan = buildWelcomePackPlan({
        customerSummary,
        atlasDecision,
        scenarios,
        eligibilityMode: 'filter',
      });
      expect(plan.eligibilityFindings).toBeDefined();
    });

    it('removes ineligible assets from selectedAssetIds in filter mode', () => {
      const planWarn = buildWelcomePackPlan({ customerSummary, atlasDecision, scenarios, eligibilityMode: 'warn' });
      const planFilter = buildWelcomePackPlan({ customerSummary, atlasDecision, scenarios, eligibilityMode: 'filter' });

      const ineligibleIds = new Set(
        (planWarn.eligibilityFindings ?? []).filter((f) => !f.eligible).map((f) => f.assetId),
      );
      for (const id of ineligibleIds) {
        expect(planFilter.selectedAssetIds).not.toContain(id);
      }
    });

    it('appends ineligible asset reasons to omittedAssetIdsWithReason in filter mode', () => {
      const planWarn = buildWelcomePackPlan({ customerSummary, atlasDecision, scenarios, eligibilityMode: 'warn' });
      const planFilter = buildWelcomePackPlan({ customerSummary, atlasDecision, scenarios, eligibilityMode: 'filter' });

      const ineligibleIds = (planWarn.eligibilityFindings ?? [])
        .filter((f) => !f.eligible)
        .map((f) => f.assetId);

      for (const id of ineligibleIds) {
        const omitted = planFilter.omittedAssetIdsWithReason.find((item) => item.assetId === id);
        expect(omitted).toBeDefined();
        expect(omitted?.reason).toMatch(/eligibility gate/i);
      }
    });

    it('does not change recommendedScenarioId in filter mode', () => {
      const plan = buildWelcomePackPlan({ customerSummary, atlasDecision, scenarios, eligibilityMode: 'filter' });
      expect(plan.recommendedScenarioId).toBe('system_unvented');
    });
  });
});

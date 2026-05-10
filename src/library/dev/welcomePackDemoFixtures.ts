import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { WelcomePackAccessibilityPreferencesV1 } from '../packComposer/WelcomePackComposerV1';

export type WelcomePackDemoFixtureId =
  | 'heat_pump_install'
  | 'combi_replacement'
  | 'water_supply_constraint';

export interface WelcomePackDemoFixture {
  id: WelcomePackDemoFixtureId;
  label: string;
  customerSummary: CustomerSummaryV1;
  atlasDecision: AtlasDecisionV1;
  scenarios: ScenarioResult[];
  userConcernTags: string[];
  propertyConstraintTags: string[];
  accessibilityPreferences: WelcomePackAccessibilityPreferencesV1;
}

function buildAtlasDecision(summary: CustomerSummaryV1, overrides: Partial<AtlasDecisionV1> = {}): AtlasDecisionV1 {
  return {
    recommendedScenarioId: summary.recommendedScenarioId,
    headline: summary.headline,
    summary: summary.fitNarrative,
    keyReasons: [...summary.whyThisWins],
    avoidedRisks: [...summary.whatThisAvoids],
    dayToDayOutcomes: ['Day-to-day guidance is available.'],
    requiredWorks: ['Installation scope is defined.'],
    compatibilityWarnings: [...summary.requiredChecks],
    includedItems: [...summary.includedNow],
    quoteScope: [],
    futureUpgradePaths: [...summary.futureReady],
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
    ...overrides,
  };
}

const heatPumpInstallSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'ashp',
  recommendedSystemLabel: 'Air source heat pump with stored hot water',
  headline: 'Heat pump installation is the right fit for this home.',
  plainEnglishDecision: 'A heat pump with stored hot water best fits this property context.',
  whyThisWins: [
    'Low-temperature operation aligns with the surveyed fabric and emitters.',
    'Stored hot water supports stable daily usage.',
  ],
  whatThisAvoids: ['Avoids another boiler replacement cycle.'],
  includedNow: ['Heat pump', 'Stored hot-water cylinder', 'Compensation controls'],
  requiredChecks: ['Check radiator emitter output'],
  optionalUpgrades: ['Future zoning controls'],
  futureReady: ['Future tariff optimisation path'],
  confidenceNotes: ['Recommendation is based on surveyed demand and constraints.'],
  hardConstraints: [],
  performancePenalties: ['If flow temperature is set too high, efficiency falls.'],
  fitNarrative: 'A heat pump with stored hot water is recommended due to property fit and long-term performance.',
};

const combiReplacementSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'combi',
  recommendedSystemLabel: 'Combi boiler',
  headline: 'Combi replacement is the right fit for this home.',
  plainEnglishDecision: 'A combi replacement keeps scope focused while meeting daily demand.',
  whyThisWins: ['Simple replacement scope with familiar operation.'],
  whatThisAvoids: ['Avoids unnecessary stored hot-water changes.'],
  includedNow: ['Combi boiler', 'Controls setup'],
  requiredChecks: [],
  optionalUpgrades: ['System balancing'],
  futureReady: [],
  confidenceNotes: ['Recommendation is based on surveyed demand and constraints.'],
  hardConstraints: [],
  performancePenalties: ['Short cycling risk can be reduced with controls tuning.'],
  fitNarrative: 'Combi replacement is recommended due to scope fit and customer priorities.',
};

const waterSupplyConstraintSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'System boiler with stored hot water',
  headline: 'Stored hot water is the right fit for this home.',
  plainEnglishDecision: 'Stored hot water better fits this home than on-demand hot water due to supply constraints.',
  whyThisWins: ['Stored hot water supports concurrent demand under constrained water supply.'],
  whatThisAvoids: ['Avoids flow-limited on-demand hot water performance.'],
  includedNow: ['System boiler', 'Stored hot-water cylinder'],
  requiredChecks: ['Check primary pipework and available flow'],
  optionalUpgrades: [],
  futureReady: ['Future controls optimisation'],
  confidenceNotes: ['Recommendation is based on surveyed demand and constraints.'],
  hardConstraints: ['On-demand hot water option fails simultaneous demand.'],
  performancePenalties: ['Flow restriction limits comfort.'],
  fitNarrative: 'Stored hot water is recommended because water supply constraints are material in this home.',
};

export const welcomePackDemoFixtures: Record<WelcomePackDemoFixtureId, WelcomePackDemoFixture> = {
  heat_pump_install: {
    id: 'heat_pump_install',
    label: 'Heat pump install',
    customerSummary: heatPumpInstallSummary,
    atlasDecision: buildAtlasDecision(heatPumpInstallSummary, {
      compatibilityWarnings: ['Emitter checks required'],
      dayToDayOutcomes: ['Steady comfort at lower flow temperatures'],
      requiredWorks: ['Install heat pump and stored hot-water cylinder'],
      lifecycle: {
        currentSystem: {
          type: 'system',
          ageYears: 16,
          condition: 'worn',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [8, 13],
        },
        influencingFactors: {
          waterQuality: 'hard',
          scaleRisk: 'high',
          usageIntensity: 'medium',
          maintenanceLevel: 'unknown',
        },
        riskIndicators: ['Age exceeds typical range'],
        summary: 'Existing system is worn and near expected end of life.',
      },
    }),
    scenarios: [
      {
        scenarioId: 'ashp',
        system: {
          type: 'ashp',
          summary: 'Air source heat pump with stored hot water',
        },
        performance: {
          hotWater: 'good',
          heating: 'very_good',
          efficiency: 'very_good',
          reliability: 'good',
        },
        keyBenefits: ['Low-temperature comfort'],
        keyConstraints: ['Emitter checks required'],
        dayToDayOutcomes: ['Steady comfort at lower flow temperatures'],
        requiredWorks: ['Install heat pump and stored hot-water cylinder'],
        upgradePaths: ['Future tariff optimisation'],
        physicsFlags: {
          highTempRequired: true,
        },
      },
    ],
    userConcernTags: ['heat_pump', 'radiator', 'controls'],
    propertyConstraintTags: ['emitters', 'insulation'],
    accessibilityPreferences: {
      prefersPrint: true,
      includeTechnicalAppendix: false,
      profiles: [],
    },
  },
  combi_replacement: {
    id: 'combi_replacement',
    label: 'Combi replacement',
    customerSummary: combiReplacementSummary,
    atlasDecision: buildAtlasDecision(combiReplacementSummary, {
      performancePenalties: [...combiReplacementSummary.performancePenalties],
      dayToDayOutcomes: ['Familiar on-demand hot water behaviour'],
      requiredWorks: ['Replace combi boiler and commission controls'],
      lifecycle: {
        currentSystem: {
          type: 'combi',
          ageYears: 12,
          condition: 'average',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [9, 13],
        },
        influencingFactors: {
          waterQuality: 'unknown',
          scaleRisk: 'medium',
          usageIntensity: 'medium',
          maintenanceLevel: 'good',
        },
        riskIndicators: ['Frequent cycling reported'],
        summary: 'Existing combi is aged but serviceable with replacement now recommended.',
      },
    }),
    scenarios: [
      {
        scenarioId: 'combi',
        system: {
          type: 'combi',
          summary: 'Combi boiler',
        },
        performance: {
          hotWater: 'good',
          heating: 'good',
          efficiency: 'good',
          reliability: 'good',
        },
        keyBenefits: ['Simple replacement scope'],
        keyConstraints: ['Short cycling risk if controls are poorly set'],
        dayToDayOutcomes: ['Familiar on-demand hot water'],
        requiredWorks: ['Replace boiler'],
        upgradePaths: [],
        physicsFlags: {},
      },
    ],
    userConcernTags: ['comparison', 'controls', 'cycling'],
    propertyConstraintTags: [],
    accessibilityPreferences: {
      prefersPrint: false,
      includeTechnicalAppendix: false,
      profiles: ['adhd'],
    },
  },
  water_supply_constraint: {
    id: 'water_supply_constraint',
    label: 'Water supply constraint',
    customerSummary: waterSupplyConstraintSummary,
    atlasDecision: buildAtlasDecision(waterSupplyConstraintSummary, {
      compatibilityWarnings: ['Hydraulic checks required'],
      hardConstraints: [...waterSupplyConstraintSummary.hardConstraints],
      performancePenalties: [...waterSupplyConstraintSummary.performancePenalties],
      dayToDayOutcomes: ['Stored hot water with stable delivery'],
      requiredWorks: ['Check primary pipework and storage setup'],
      lifecycle: {
        currentSystem: {
          type: 'combi',
          ageYears: 14,
          condition: 'worn',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [8, 12],
        },
        influencingFactors: {
          waterQuality: 'unknown',
          scaleRisk: 'medium',
          usageIntensity: 'high',
          maintenanceLevel: 'poor',
        },
        riskIndicators: ['Pressure and flow constraints observed'],
        summary: 'Current setup is worn and constrained by site water supply.',
      },
    }),
    scenarios: [
      {
        scenarioId: 'system_unvented',
        system: {
          type: 'system',
          summary: 'System boiler with stored hot water',
        },
        performance: {
          hotWater: 'very_good',
          heating: 'good',
          efficiency: 'good',
          reliability: 'good',
        },
        keyBenefits: ['Stored hot water supports concurrent demand'],
        keyConstraints: ['Hydraulic checks required'],
        dayToDayOutcomes: ['Stored hot water with stable delivery'],
        requiredWorks: ['Check primary pipework'],
        upgradePaths: ['Future controls optimisation'],
        physicsFlags: {
          hydraulicLimit: true,
          pressureConstraint: true,
        },
      },
    ],
    userConcernTags: ['pressure', 'flow'],
    propertyConstraintTags: ['pressure', 'flow', 'hydraulic'],
    accessibilityPreferences: {
      prefersPrint: true,
      includeTechnicalAppendix: false,
      profiles: [],
    },
  },
};

export const welcomePackDemoFixtureList = Object.values(welcomePackDemoFixtures);

export function getWelcomePackDemoFixture(fixtureId: WelcomePackDemoFixtureId): WelcomePackDemoFixture {
  return welcomePackDemoFixtures[fixtureId];
}

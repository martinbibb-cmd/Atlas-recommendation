import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { WelcomePackAccessibilityPreferencesV1 } from '../packComposer/WelcomePackComposerV1';

export type WelcomePackDemoFixtureId =
  | 'heat_pump_install'
  | 'combi_replacement'
  | 'water_supply_constraint'
  | 'combi_to_stored_hot_water'
  | 'regular_or_system_boiler_upgrade'
  | 'heat_pump_ready_boiler_install'
  | 'cylinder_upgrade'
  | 'controls_upgrade'
  | 'low_temperature_radiator_upgrade'
  | 'smart_cylinder_tariff_ready'
  | 'open_vented_to_sealed_unvented'
  | 'regular_to_regular_unvented'
  | 'heat_pump_reality'
  | 'water_constraint_reality';

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

// ─── Existing summaries ───────────────────────────────────────────────────────

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

// ─── New summaries ────────────────────────────────────────────────────────────

const combiToStoredHotWaterSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'System boiler with stored hot water',
  headline: 'Moving to stored hot water is the right fit for this home.',
  plainEnglishDecision:
    'Switching from on-demand hot water to a stored system removes the simultaneous-use risk and improves shower performance.',
  whyThisWins: [
    'Stored hot water eliminates simultaneous-use flow conflict.',
    'Consistent shower performance regardless of concurrent demand.',
  ],
  whatThisAvoids: ['Avoids the flow-rate shortfall that affects on-demand delivery in busy households.'],
  includedNow: ['System boiler', 'Stored hot-water cylinder', 'Zone controls'],
  requiredChecks: ['Confirm cylinder location and primary pipework sizing'],
  optionalUpgrades: ['Future solar diverter connection'],
  futureReady: ['Solar thermal or PV diverter connection'],
  confidenceNotes: ['Recommendation is based on surveyed simultaneous demand.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'Stored hot water is recommended to resolve simultaneous demand conflicts affecting shower performance.',
};

const regularOrSystemBoilerUpgradeSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system',
  recommendedSystemLabel: 'Condensing system boiler upgrade',
  headline: 'A system boiler upgrade is the right fit for this home.',
  plainEnglishDecision:
    'Replacing the existing boiler with a modern condensing unit improves efficiency without changing the distribution strategy.',
  whyThisWins: [
    'Higher modulation range reduces short cycling and improves part-load efficiency.',
    'Condensing operation reduces fuel use under typical load conditions.',
  ],
  whatThisAvoids: ['Avoids unnecessary disruption to the existing distribution layout.'],
  includedNow: ['Condensing system boiler', 'System controls commissioning'],
  requiredChecks: ['Verify primary circuit pressure and expansion vessel condition'],
  optionalUpgrades: ['Weather compensation controls'],
  futureReady: ['Future controls upgrade'],
  confidenceNotes: ['Recommendation is based on surveyed boiler condition and sizing.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'A condensing system boiler replacement restores reliable performance and improves efficiency through better modulation.',
};

const heatPumpReadyBoilerInstallSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'combi',
  recommendedSystemLabel: 'Combi boiler — heat-pump-ready specification',
  headline: 'A heat-pump-ready combi install is the right choice for this home.',
  plainEnglishDecision:
    'Installing a combi now to a low-flow-temperature specification means the home is better prepared for a future heat pump transition.',
  whyThisWins: [
    'Low flow-temperature operation improves condensing efficiency today.',
    'Radiator readiness assessment is completed as part of the install.',
  ],
  whatThisAvoids: ['Avoids locking in a high-flow-temperature setup that would hinder future upgrade.'],
  includedNow: ['Combi boiler', 'Weather compensation controls', 'Radiator readiness survey'],
  requiredChecks: ['Confirm emitter output at reduced flow temperature'],
  optionalUpgrades: ['Hydraulic separation for future heat-pump retrofit'],
  futureReady: ['Heat pump transition path', 'Low-temperature distribution upgrade'],
  confidenceNotes: ['Recommendation is based on surveyed fabric and future upgrade intent.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'A heat-pump-ready combi install bridges current need and future low-temperature transition without committing to full upgrade today.',
};

const cylinderUpgradeSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'System boiler with improved hot-water storage',
  headline: 'An upgraded hot-water store is the right fit for this home.',
  plainEnglishDecision:
    'Replacing the existing storage vessel improves recovery time, reduces thermal losses, and brings the installation into current safety compliance.',
  whyThisWins: [
    'Faster recovery time reduces periods of insufficient hot water.',
    'Reduced standing losses improve year-round efficiency.',
  ],
  whatThisAvoids: ['Avoids slow recovery and risk of inadequate reheat temperature.'],
  includedNow: ['Replacement storage vessel', 'Thermostatic control commissioning'],
  requiredChecks: ['Confirm vessel sizing relative to peak demand', 'Check expansion vessel condition'],
  optionalUpgrades: ['Smart scheduling controls'],
  futureReady: ['Future solar diverter or smart-tariff scheduling'],
  confidenceNotes: ['Recommendation is based on surveyed recovery time and demand profile.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'An upgraded hot-water store addresses recovery time deficits and brings thermal performance and safety into line with current standards.',
};

const controlsUpgradeSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'combi',
  recommendedSystemLabel: 'Combi boiler with upgraded controls',
  headline: 'A controls upgrade is the right next step for this home.',
  plainEnglishDecision:
    'Adding weather compensation and zone controls to the existing boiler improves comfort and efficiency without replacing the heat source.',
  whyThisWins: [
    'Weather compensation modulates the boiler to outdoor temperature, improving condensing efficiency.',
    'Zoning lets the customer match heat delivery to occupancy patterns.',
  ],
  whatThisAvoids: ['Avoids unnecessary boiler replacement where the existing unit has capacity remaining.'],
  includedNow: ['Weather compensation controller', 'Zone valve and programmer upgrade'],
  requiredChecks: ['Confirm boiler supports weather compensation input'],
  optionalUpgrades: ['Smart thermostat integration'],
  futureReady: ['Full zone control expansion'],
  confidenceNotes: ['Recommendation is based on existing boiler condition and control capability.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'A controls upgrade delivers measurable efficiency improvement through weather compensation and improved zone management.',
};

const lowTemperatureRadiatorUpgradeSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'System boiler with emitter upgrade',
  headline: 'Radiator upgrades are needed to unlock lower flow temperatures.',
  plainEnglishDecision:
    'Upgrading undersized emitters allows the boiler to operate at a lower flow temperature, improving efficiency and preparing the home for future heat-source options.',
  whyThisWins: [
    'Larger emitter surface area delivers the same heat output at lower flow temperature.',
    'Lower flow temperature improves condensing efficiency and reduces comfort overshoot.',
  ],
  whatThisAvoids: ['Avoids continued high-flow-temperature operation that limits efficiency gains.'],
  includedNow: ['Emitter upgrade in key rooms', 'Flow temperature reset and recommissioning'],
  requiredChecks: ['Room-by-room heat loss survey to confirm replacement sizing'],
  optionalUpgrades: ['Future heat pump suitability assessment'],
  futureReady: ['Heat pump-ready emitter specification'],
  confidenceNotes: ['Recommendation is based on surveyed emitter output at current flow temperature.'],
  hardConstraints: [],
  performancePenalties: ['Comfort shortfall in upgraded rooms until recommissioning is complete.'],
  fitNarrative:
    'Emitter upgrades are recommended to enable lower flow-temperature operation, improving efficiency and long-term flexibility.',
};

const smartCylinderTariffReadySummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'System boiler with smart-tariff-ready storage',
  headline: 'A smart-tariff-ready storage system is the right fit for this home.',
  plainEnglishDecision:
    'Configuring the hot-water storage with smart scheduling enables the home to benefit from time-of-use electricity tariffs, shifting demand to off-peak periods.',
  whyThisWins: [
    'Thermal stratification allows selective top-up charging at lower-cost periods.',
    'Time-of-use scheduling reduces running cost without compromising availability.',
  ],
  whatThisAvoids: ['Avoids heating the full store during expensive peak rate periods.'],
  includedNow: ['Smart controller with tariff scheduling', 'Thermal store zone commissioning'],
  requiredChecks: ['Confirm smart meter and tariff eligibility'],
  optionalUpgrades: ['PV diverter integration'],
  futureReady: ['Battery storage or PV-diverter scheduling upgrade'],
  confidenceNotes: ['Recommendation is based on surveyed demand profile and tariff availability.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'A smart-tariff-ready storage configuration shifts heat demand to off-peak periods, reducing running cost through stratified thermal scheduling.',
};

// ─── Golden journey summaries ─────────────────────────────────────────────────

const openVentedToSealedUnventedSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'system_unvented',
  recommendedSystemLabel: 'Sealed system boiler with unvented cylinder',
  headline: 'Upgrading from tank-fed hot water to a sealed system is the right fit for this home.',
  plainEnglishDecision:
    'Converting from a tank-fed open-vented system to a sealed system with an unvented cylinder removes the header tank, improves mains-pressure delivery, and eliminates the storage-capacity misconception.',
  whyThisWins: [
    'Mains-pressure delivery replaces low-head tank-fed supply.',
    'Sealed system eliminates the loft header tank and associated frost risk.',
    'Unvented cylinder stores pre-heated water at mains pressure for consistent performance.',
  ],
  whatThisAvoids: [
    'Avoids continued low-pressure shower performance from the existing tank-fed supply.',
    'Avoids the misconception that stored capacity is limited by boiler output rate.',
  ],
  includedNow: ['Sealed system boiler', 'Unvented hot-water cylinder', 'Expansion vessel and pressure relief'],
  requiredChecks: [
    'Confirm mains flow rate and static pressure meet unvented requirements',
    'Check primary pipework sizing for sealed-system compatibility',
  ],
  optionalUpgrades: ['Solar thermal or PV diverter connection'],
  futureReady: ['Future solar diverter or smart-tariff scheduling'],
  confidenceNotes: ['Recommendation is based on surveyed mains pressure and tank-fed system condition.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'Converting to a sealed system with an unvented cylinder is recommended to deliver mains-pressure hot water and remove the header-tank limitations of the existing open-vented setup.',
};

const regularToRegularUnventedSummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'regular_unvented',
  recommendedSystemLabel: 'Regular boiler with unvented cylinder',
  headline: 'Keeping the regular boiler and upgrading to an unvented cylinder is the right fit for this home.',
  plainEnglishDecision:
    'The existing regular boiler architecture is preserved. Replacing the vented cylinder with an unvented unit delivers mains-pressure hot water without disrupting the proven heating distribution.',
  whyThisWins: [
    'Regular boiler architecture is retained — familiar controls and distribution strategy.',
    'Unvented cylinder upgrades hot-water delivery to mains pressure with minimal disruption.',
    'Separate heating and hot-water circuits remain independently controllable.',
  ],
  whatThisAvoids: [
    'Avoids unnecessary disruption to a well-functioning heating distribution layout.',
    'Avoids the higher cost and complexity of a full system conversion.',
  ],
  includedNow: ['Unvented hot-water cylinder', 'Pressure and temperature relief commissioning'],
  requiredChecks: [
    'Confirm mains flow rate and static pressure meet unvented requirements',
    'Check cylinder location and primary connections',
  ],
  optionalUpgrades: ['Smart scheduling controls'],
  futureReady: ['Future solar diverter or smart-tariff scheduling'],
  confidenceNotes: ['Recommendation is based on surveyed boiler condition and available mains pressure.'],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative:
    'Retaining the regular boiler and upgrading only the cylinder is recommended to achieve mains-pressure hot-water delivery at low disruption and cost.',
};

const heatPumpRealitySummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'ashp',
  recommendedSystemLabel: 'Air source heat pump with stored hot water',
  headline: 'A heat pump is the right fit — and this pack explains what to expect day to day.',
  plainEnglishDecision:
    'A heat pump with stored hot water is recommended for this property. This pack focuses on setting accurate expectations: radiators will be warm rather than hot, the system runs steadily rather than cycling, and the compensation controller manages day-to-day comfort automatically.',
  whyThisWins: [
    'Low-temperature operation aligns with the surveyed fabric and emitter output.',
    'Steady running delivers consistent comfort without the temperature spikes of high-temperature cycling.',
    'Stored hot water provides reliable daily availability independent of heat-pump output rate.',
  ],
  whatThisAvoids: [
    'Avoids repeated boiler replacement and the associated future disruption.',
    'Avoids the comfort inconsistency of high-temperature short-cycling.',
  ],
  includedNow: ['Air source heat pump', 'Stored hot-water cylinder', 'Weather compensation controls'],
  requiredChecks: ['Confirm emitter output at reduced flow temperature', 'Verify outdoor unit siting'],
  optionalUpgrades: ['Future smart-tariff scheduling for cylinder charging'],
  futureReady: ['Smart-tariff optimisation path'],
  confidenceNotes: ['Recommendation is based on surveyed fabric, emitter condition, and mains supply.'],
  hardConstraints: [],
  performancePenalties: ['If flow temperature is set above the compensation curve, efficiency falls.'],
  fitNarrative:
    'A heat pump with stored hot water is recommended. This pack explains warm-not-hot emitters, steady running, and compensation controls to set accurate customer expectations.',
};

const waterConstraintRealitySummary: CustomerSummaryV1 = {
  recommendedScenarioId: 'combi',
  recommendedSystemLabel: 'Combi boiler — mains supply is the constraint, not the boiler',
  headline: 'The boiler is not the limiting factor — this pack explains what is.',
  plainEnglishDecision:
    'The mains water supply limits simultaneous hot-water flow, not the boiler output. This pack explains where the real boundary sits, what it means for day-to-day use, and why a larger or different boiler would not resolve the underlying constraint.',
  whyThisWins: [
    'Accurate diagnosis prevents unnecessary replacement of a correctly performing boiler.',
    'Understanding the supply boundary helps set realistic expectations for simultaneous use.',
  ],
  whatThisAvoids: [
    'Avoids unnecessary boiler upgrade where the real constraint is the mains supply.',
    'Avoids customer disappointment after replacing equipment that was not the limiting factor.',
  ],
  includedNow: ['Combi boiler service and commissioning check'],
  requiredChecks: ['Measure static and dynamic mains pressure at the incoming supply'],
  optionalUpgrades: ['Cold-water accumulator if mains flow is below threshold'],
  futureReady: [],
  confidenceNotes: ['Recommendation is based on measured mains pressure and flow rate.'],
  hardConstraints: ['Mains supply limits simultaneous-use flow — this is a site boundary, not a boiler deficiency.'],
  performancePenalties: ['Simultaneous draw from multiple outlets will be limited by available mains flow.'],
  fitNarrative:
    'The combi is not the limiting factor. This pack explains the mains supply boundary calmly and accurately, preventing unnecessary equipment replacement.',
};

// ─── Fixture registry ─────────────────────────────────────────────────────────

export const welcomePackDemoFixtures: Record<WelcomePackDemoFixtureId, WelcomePackDemoFixture> = {  heat_pump_install: {
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
    userConcernTags: ['heat_pump', 'radiator'],
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
    userConcernTags: ['comparison', 'cycling'],
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

  combi_to_stored_hot_water: {
    id: 'combi_to_stored_hot_water',
    label: 'Combi to stored hot water',
    customerSummary: combiToStoredHotWaterSummary,
    atlasDecision: buildAtlasDecision(combiToStoredHotWaterSummary, {
      dayToDayOutcomes: ['Consistent hot water for all outlets simultaneously'],
      requiredWorks: ['Install system boiler and storage vessel', 'Commission zone controls'],
      lifecycle: {
        currentSystem: {
          type: 'combi',
          ageYears: 11,
          condition: 'average',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [9, 13],
        },
        influencingFactors: {
          waterQuality: 'unknown',
          scaleRisk: 'medium',
          usageIntensity: 'high',
          maintenanceLevel: 'unknown',
        },
        riskIndicators: ['Simultaneous demand exceeds on-demand capacity'],
        summary: 'Existing combi cannot serve simultaneous hot-water demand reliably.',
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
          heating: 'very_good',
          efficiency: 'good',
          reliability: 'very_good',
        },
        keyBenefits: ['Eliminates simultaneous demand conflict', 'Consistent shower pressure'],
        keyConstraints: ['Requires space for storage vessel'],
        dayToDayOutcomes: ['Consistent hot water for all outlets simultaneously'],
        requiredWorks: ['Install system boiler and storage vessel'],
        upgradePaths: ['Solar diverter connection', 'Smart tariff scheduling'],
        physicsFlags: {
          combiFlowRisk: true,
        },
      },
    ],
    // 'stored' is included alongside the domain tags to trigger the combi_to_stored_hot_water archetype
    userConcernTags: ['simultaneous_use', 'hot_water_storage', 'shower_performance', 'stored'],
    propertyConstraintTags: [],
    accessibilityPreferences: {
      prefersPrint: false,
      includeTechnicalAppendix: false,
      profiles: [],
    },
  },

  regular_or_system_boiler_upgrade: {
    id: 'regular_or_system_boiler_upgrade',
    label: 'Regular or system boiler upgrade',
    customerSummary: regularOrSystemBoilerUpgradeSummary,
    atlasDecision: buildAtlasDecision(regularOrSystemBoilerUpgradeSummary, {
      dayToDayOutcomes: ['Quieter, more efficient heating at familiar temperatures'],
      requiredWorks: ['Replace boiler and recommission primary circuit'],
      lifecycle: {
        currentSystem: {
          type: 'system',
          ageYears: 13,
          condition: 'worn',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [8, 12],
        },
        influencingFactors: {
          waterQuality: 'unknown',
          scaleRisk: 'medium',
          usageIntensity: 'medium',
          maintenanceLevel: 'average',
        },
        riskIndicators: ['Boiler at upper end of expected lifespan'],
        summary: 'Existing system boiler is aging and replacement is recommended.',
      },
    }),
    scenarios: [
      {
        // scenarioId 'system' matches regular_or_system_boiler_upgrade.appliesToScenarioTypes
        scenarioId: 'system',
        system: {
          type: 'system',
          summary: 'Condensing system boiler upgrade',
        },
        performance: {
          hotWater: 'very_good',
          heating: 'very_good',
          efficiency: 'very_good',
          reliability: 'very_good',
        },
        keyBenefits: ['Better modulation range reduces short cycling', 'Improved seasonal efficiency'],
        keyConstraints: ['Primary circuit check recommended'],
        dayToDayOutcomes: ['Quieter, more efficient heating'],
        requiredWorks: ['Replace boiler and recommission'],
        upgradePaths: ['Weather compensation controls'],
        physicsFlags: {},
      },
    ],
    userConcernTags: ['boiler_sizing', 'modulation', 'condensing_efficiency'],
    propertyConstraintTags: [],
    accessibilityPreferences: {
      prefersPrint: false,
      includeTechnicalAppendix: true,
      profiles: [],
    },
  },

  heat_pump_ready_boiler_install: {
    id: 'heat_pump_ready_boiler_install',
    label: 'Heat-pump-ready boiler install',
    customerSummary: heatPumpReadyBoilerInstallSummary,
    atlasDecision: buildAtlasDecision(heatPumpReadyBoilerInstallSummary, {
      dayToDayOutcomes: ['Efficient heating at lower flow temperature', 'Future-ready controls in place'],
      requiredWorks: ['Install combi boiler to low-temperature specification', 'Commission weather compensation'],
      futureUpgradePaths: ['Heat pump transition path', 'Low-temperature distribution upgrade'],
      lifecycle: {
        currentSystem: {
          type: 'combi',
          ageYears: 10,
          condition: 'average',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [10, 15],
        },
        influencingFactors: {
          waterQuality: 'unknown',
          scaleRisk: 'low',
          usageIntensity: 'medium',
          maintenanceLevel: 'good',
        },
        riskIndicators: [],
        summary: 'Existing combi is at end of expected lifespan; replacement planned with future-ready spec.',
      },
    }),
    scenarios: [
      {
        scenarioId: 'combi',
        system: {
          type: 'combi',
          summary: 'Combi boiler — heat-pump-ready specification',
        },
        performance: {
          hotWater: 'good',
          heating: 'good',
          efficiency: 'very_good',
          reliability: 'good',
        },
        keyBenefits: ['Low flow-temperature operation today', 'Prepared for future heat pump'],
        keyConstraints: ['Emitter output survey required'],
        dayToDayOutcomes: ['Efficient heating at lower flow temperature'],
        requiredWorks: ['Install combi and commission weather compensation'],
        upgradePaths: ['Heat pump transition', 'Low-temperature distribution upgrade'],
        physicsFlags: {},
      },
    ],
    // 'heat_pump_ready' triggers the heat_pump_ready_boiler_install archetype detection
    userConcernTags: ['future_heat_pump', 'low_flow_temperature', 'radiator_readiness', 'heat_pump_ready'],
    propertyConstraintTags: [],
    accessibilityPreferences: {
      prefersPrint: false,
      includeTechnicalAppendix: true,
      profiles: [],
    },
  },

  cylinder_upgrade: {
    id: 'cylinder_upgrade',
    label: 'Cylinder upgrade',
    customerSummary: cylinderUpgradeSummary,
    atlasDecision: buildAtlasDecision(cylinderUpgradeSummary, {
      dayToDayOutcomes: ['Faster hot-water recovery', 'Reduced standing heat loss'],
      requiredWorks: ['Replace storage vessel and recommission thermostatic controls'],
      lifecycle: {
        currentSystem: {
          type: 'system',
          ageYears: 18,
          condition: 'worn',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [6, 10],
        },
        influencingFactors: {
          waterQuality: 'hard',
          scaleRisk: 'high',
          usageIntensity: 'high',
          maintenanceLevel: 'poor',
        },
        riskIndicators: ['Storage vessel age exceeds expected range', 'Scale build-up likely'],
        summary: 'Existing storage vessel is worn and no longer meeting recovery requirements.',
      },
    }),
    scenarios: [
      {
        scenarioId: 'system_unvented',
        system: {
          type: 'system',
          summary: 'System boiler with improved hot-water storage',
        },
        performance: {
          hotWater: 'very_good',
          heating: 'very_good',
          efficiency: 'good',
          reliability: 'very_good',
        },
        keyBenefits: ['Faster recovery time', 'Lower standing losses'],
        keyConstraints: ['Confirm sizing for peak demand'],
        dayToDayOutcomes: ['Faster hot-water recovery', 'Reduced standing heat loss'],
        requiredWorks: ['Replace storage vessel'],
        upgradePaths: ['Smart scheduling controls', 'Solar diverter'],
        physicsFlags: {},
      },
    ],
    // 'cylinder_sizing' triggers the cylinder_upgrade archetype detection
    userConcernTags: ['stored_hot_water', 'recovery_time', 'safety_compliance', 'cylinder_sizing'],
    propertyConstraintTags: [],
    accessibilityPreferences: {
      prefersPrint: true,
      includeTechnicalAppendix: false,
      profiles: ['dyslexia'],
    },
  },

  controls_upgrade: {
    id: 'controls_upgrade',
    label: 'Controls upgrade',
    customerSummary: controlsUpgradeSummary,
    atlasDecision: buildAtlasDecision(controlsUpgradeSummary, {
      dayToDayOutcomes: ['Comfort-led modulation', 'Zone-by-zone control of heat delivery'],
      requiredWorks: ['Install weather compensation controller', 'Commission zone controls'],
      lifecycle: {
        currentSystem: {
          type: 'combi',
          ageYears: 5,
          condition: 'good',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [10, 15],
        },
        influencingFactors: {
          waterQuality: 'unknown',
          scaleRisk: 'low',
          usageIntensity: 'medium',
          maintenanceLevel: 'good',
        },
        riskIndicators: [],
        summary: 'Existing boiler is in good condition; controls upgrade is the priority.',
      },
    }),
    scenarios: [
      {
        scenarioId: 'combi',
        system: {
          type: 'combi',
          summary: 'Combi boiler with upgraded controls',
        },
        performance: {
          hotWater: 'good',
          heating: 'very_good',
          efficiency: 'very_good',
          reliability: 'good',
        },
        keyBenefits: ['Weather compensation improves condensing depth', 'Zone control matches demand'],
        keyConstraints: ['Boiler must support weather compensation input'],
        dayToDayOutcomes: ['Comfort-led modulation', 'Zone control of heat delivery'],
        requiredWorks: ['Install and commission weather compensation controller'],
        upgradePaths: ['Smart thermostat integration', 'Full zone expansion'],
        physicsFlags: {},
      },
    ],
    // 'weather_compensation' triggers the controls_upgrade archetype detection
    userConcernTags: ['modulation', 'zoning', 'weather_compensation'],
    propertyConstraintTags: [],
    accessibilityPreferences: {
      prefersPrint: false,
      includeTechnicalAppendix: false,
      profiles: [],
    },
  },

  low_temperature_radiator_upgrade: {
    id: 'low_temperature_radiator_upgrade',
    label: 'Low-temperature radiator upgrade',
    customerSummary: lowTemperatureRadiatorUpgradeSummary,
    atlasDecision: buildAtlasDecision(lowTemperatureRadiatorUpgradeSummary, {
      dayToDayOutcomes: ['Comfortable heat delivery at lower flow temperature', 'Improved condensing depth'],
      requiredWorks: ['Complete room-by-room heat loss survey', 'Replace undersized emitters'],
      lifecycle: {
        currentSystem: {
          type: 'system',
          ageYears: 8,
          condition: 'good',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [10, 15],
        },
        influencingFactors: {
          waterQuality: 'unknown',
          scaleRisk: 'low',
          usageIntensity: 'medium',
          maintenanceLevel: 'good',
        },
        riskIndicators: [],
        summary: 'Boiler is in good condition; emitter upgrade is the priority.',
      },
    }),
    scenarios: [
      {
        scenarioId: 'system_unvented',
        system: {
          type: 'system',
          summary: 'System boiler with emitter upgrade',
        },
        performance: {
          hotWater: 'very_good',
          heating: 'very_good',
          efficiency: 'very_good',
          reliability: 'very_good',
        },
        keyBenefits: ['Lower flow temperature operation', 'Comfort maintained after emitter upgrade'],
        keyConstraints: ['Room-by-room survey required before sizing'],
        dayToDayOutcomes: ['Comfortable heat delivery at lower flow temperature'],
        requiredWorks: ['Replace undersized radiators', 'Reset flow temperature after commissioning'],
        upgradePaths: ['Future heat pump suitability assessment'],
        physicsFlags: {},
      },
    ],
    // 'flow_temperature' triggers the low_temperature_radiator_upgrade archetype (system type is not ashp)
    userConcernTags: ['emitter_adequacy', 'flow_temperature', 'comfort'],
    propertyConstraintTags: [],
    accessibilityPreferences: {
      prefersPrint: false,
      includeTechnicalAppendix: true,
      profiles: [],
    },
  },

  smart_cylinder_tariff_ready: {
    id: 'smart_cylinder_tariff_ready',
    label: 'Smart cylinder tariff-ready',
    customerSummary: smartCylinderTariffReadySummary,
    atlasDecision: buildAtlasDecision(smartCylinderTariffReadySummary, {
      dayToDayOutcomes: ['Hot water charged during off-peak periods', 'Tariff-aware scheduling'],
      requiredWorks: ['Install smart controller and commission tariff scheduling'],
      lifecycle: {
        currentSystem: {
          type: 'system',
          ageYears: 4,
          condition: 'good',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [10, 15],
        },
        influencingFactors: {
          waterQuality: 'unknown',
          scaleRisk: 'low',
          usageIntensity: 'medium',
          maintenanceLevel: 'good',
        },
        riskIndicators: [],
        summary: 'Existing system is in good condition; smart scheduling is the focus.',
      },
    }),
    scenarios: [
      {
        scenarioId: 'system_unvented',
        system: {
          type: 'system',
          summary: 'System boiler with smart-tariff-ready storage',
        },
        performance: {
          hotWater: 'very_good',
          heating: 'very_good',
          efficiency: 'excellent',
          reliability: 'very_good',
        },
        keyBenefits: ['Off-peak charging reduces running cost', 'Stratified storage preserves hot-water quality'],
        keyConstraints: ['Smart meter and eligible tariff required'],
        dayToDayOutcomes: ['Hot water charged during off-peak periods'],
        requiredWorks: ['Install smart controller and schedule commissioning'],
        upgradePaths: ['PV diverter integration', 'Battery storage scheduling'],
        physicsFlags: {},
      },
    ],
    // 'smart_tariff' triggers the smart_cylinder_tariff_ready archetype detection
    userConcernTags: ['stratification', 'smart_tariff', 'thermal_storage'],
    propertyConstraintTags: [],
    accessibilityPreferences: {
      prefersPrint: false,
      includeTechnicalAppendix: false,
      profiles: [],
    },
  },

  // ─── Golden journey fixtures ───────────────────────────────────────────────

  open_vented_to_sealed_unvented: {
    id: 'open_vented_to_sealed_unvented',
    label: 'Tank-fed to sealed + unvented upgrade',
    customerSummary: openVentedToSealedUnventedSummary,
    atlasDecision: buildAtlasDecision(openVentedToSealedUnventedSummary, {
      dayToDayOutcomes: ['Mains-pressure hot water from every outlet', 'No loft header tank to maintain'],
      requiredWorks: ['Install sealed system boiler and unvented cylinder', 'Commission expansion vessel and pressure relief'],
      lifecycle: {
        currentSystem: {
          type: 'system',
          ageYears: 20,
          condition: 'worn',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [6, 10],
        },
        influencingFactors: {
          waterQuality: 'hard',
          scaleRisk: 'high',
          usageIntensity: 'medium',
          maintenanceLevel: 'poor',
        },
        riskIndicators: ['Open-vented system well past expected lifespan', 'Header tank condition unknown'],
        summary: 'Existing open-vented system is aged and no longer suitable; full conversion is recommended.',
      },
    }),
    scenarios: [
      {
        scenarioId: 'system_unvented',
        system: {
          type: 'system',
          summary: 'Sealed system boiler with unvented cylinder',
        },
        performance: {
          hotWater: 'very_good',
          heating: 'very_good',
          efficiency: 'very_good',
          reliability: 'very_good',
        },
        keyBenefits: ['Mains-pressure hot water delivery', 'Sealed system eliminates header-tank losses'],
        keyConstraints: ['Mains pressure survey required before sizing'],
        dayToDayOutcomes: ['Mains-pressure hot water from every outlet'],
        requiredWorks: ['Install sealed system boiler and unvented cylinder'],
        upgradePaths: ['Solar diverter connection', 'Smart-tariff scheduling'],
        physicsFlags: {},
      },
    ],
    // 'sealed_system_conversion' and 'open_vented' trigger open_vented_to_sealed_unvented archetype
    userConcernTags: ['open_vented', 'sealed_system_conversion', 'unvented_safety_reassurance', 'pressure_vs_storage'],
    propertyConstraintTags: [],
    accessibilityPreferences: {
      prefersPrint: true,
      includeTechnicalAppendix: false,
      profiles: [],
    },
  },

  regular_to_regular_unvented: {
    id: 'regular_to_regular_unvented',
    label: 'Regular boiler + unvented cylinder upgrade',
    customerSummary: regularToRegularUnventedSummary,
    atlasDecision: buildAtlasDecision(regularToRegularUnventedSummary, {
      dayToDayOutcomes: ['Mains-pressure hot water from upgraded cylinder', 'Heating distribution unchanged'],
      requiredWorks: ['Install unvented cylinder and commission pressure relief', 'Decommission existing vented cylinder'],
      lifecycle: {
        currentSystem: {
          type: 'regular',
          ageYears: 9,
          condition: 'good',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [10, 15],
        },
        influencingFactors: {
          waterQuality: 'unknown',
          scaleRisk: 'medium',
          usageIntensity: 'medium',
          maintenanceLevel: 'good',
        },
        riskIndicators: [],
        summary: 'Regular boiler is in good condition; cylinder upgrade only is appropriate.',
      },
    }),
    scenarios: [
      {
        scenarioId: 'regular_unvented',
        system: {
          type: 'regular',
          summary: 'Regular boiler with unvented cylinder',
        },
        performance: {
          hotWater: 'very_good',
          heating: 'very_good',
          efficiency: 'very_good',
          reliability: 'very_good',
        },
        keyBenefits: ['Mains-pressure hot water with minimal disruption', 'Boiler architecture preserved'],
        keyConstraints: ['Mains pressure must meet unvented requirements'],
        dayToDayOutcomes: ['Mains-pressure hot water from upgraded cylinder'],
        requiredWorks: ['Install unvented cylinder'],
        upgradePaths: ['Smart scheduling controls', 'Solar diverter connection'],
        physicsFlags: {},
      },
    ],
    // 'preserved_system_strength' triggers regular_to_regular_unvented archetype
    userConcernTags: ['preserved_system_strength', 'premium_hot_water_performance', 'regular_retained'],
    propertyConstraintTags: [],
    accessibilityPreferences: {
      prefersPrint: false,
      includeTechnicalAppendix: false,
      profiles: [],
    },
  },

  heat_pump_reality: {
    id: 'heat_pump_reality',
    label: 'Heat pump reality — trust and expectation journey',
    customerSummary: heatPumpRealitySummary,
    atlasDecision: buildAtlasDecision(heatPumpRealitySummary, {
      compatibilityWarnings: ['Emitter checks required at reduced flow temperature'],
      dayToDayOutcomes: ['Steady warmth at lower flow temperature', 'Compensation controller manages comfort automatically'],
      requiredWorks: ['Install heat pump and stored hot-water cylinder', 'Commission compensation controls'],
      lifecycle: {
        currentSystem: {
          type: 'system',
          ageYears: 18,
          condition: 'worn',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [6, 10],
        },
        influencingFactors: {
          waterQuality: 'hard',
          scaleRisk: 'high',
          usageIntensity: 'medium',
          maintenanceLevel: 'unknown',
        },
        riskIndicators: ['System age exceeds expected range'],
        summary: 'Existing system is worn; heat pump replacement is recommended.',
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
        keyBenefits: ['Steady low-temperature comfort', 'Stored hot water ensures daily availability'],
        keyConstraints: ['Emitter checks required'],
        dayToDayOutcomes: ['Steady warmth at lower flow temperature'],
        requiredWorks: ['Install heat pump and cylinder'],
        upgradePaths: ['Future smart-tariff cylinder scheduling'],
        physicsFlags: {
          highTempRequired: false,
        },
      },
    ],
    // 'hot_radiator_expectation' triggers heat_pump_reality archetype (beats heat_pump_install)
    userConcernTags: ['hot_radiator_expectation', 'heat_pump_trust', 'heat_pump_expectation_management'],
    propertyConstraintTags: [],
    accessibilityPreferences: {
      prefersPrint: true,
      includeTechnicalAppendix: false,
      profiles: [],
    },
  },

  water_constraint_reality: {
    id: 'water_constraint_reality',
    label: 'Water mains constraint — expectation management journey',
    customerSummary: waterConstraintRealitySummary,
    atlasDecision: buildAtlasDecision(waterConstraintRealitySummary, {
      hardConstraints: [...waterConstraintRealitySummary.hardConstraints],
      performancePenalties: [...waterConstraintRealitySummary.performancePenalties],
      dayToDayOutcomes: ['On-demand hot water within the boundary of available mains flow'],
      requiredWorks: ['Measure and document mains static and dynamic pressure'],
      lifecycle: {
        currentSystem: {
          type: 'combi',
          ageYears: 7,
          condition: 'good',
        },
        expectedLifespan: {
          typicalRangeYears: [10, 15],
          adjustedRangeYears: [10, 15],
        },
        influencingFactors: {
          waterQuality: 'unknown',
          scaleRisk: 'low',
          usageIntensity: 'high',
          maintenanceLevel: 'good',
        },
        riskIndicators: ['Mains supply below simultaneous-use threshold'],
        summary: 'Combi is in good condition; supply constraint is a site issue, not a boiler deficiency.',
      },
    }),
    scenarios: [
      {
        scenarioId: 'combi',
        system: {
          type: 'combi',
          summary: 'Combi boiler — mains supply is the constraint',
        },
        performance: {
          hotWater: 'good',
          heating: 'good',
          efficiency: 'good',
          reliability: 'good',
        },
        keyBenefits: ['Accurate diagnosis prevents unnecessary replacement'],
        keyConstraints: ['Mains supply limits simultaneous-use flow'],
        dayToDayOutcomes: ['On-demand hot water within available mains flow'],
        requiredWorks: ['Document mains pressure and flow measurements'],
        upgradePaths: ['Cold-water accumulator if mains flow is below threshold'],
        physicsFlags: {
          pressureConstraint: true,
        },
      },
    ],
    // 'why_not_combi' + 'water_main_limit_not_boiler_limit' trigger water_constraint_reality archetype
    userConcernTags: ['water_main_limit_not_boiler_limit', 'why_not_combi', 'pressure_vs_storage'],
    propertyConstraintTags: ['pressure', 'flow'],
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

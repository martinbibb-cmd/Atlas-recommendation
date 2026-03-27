/**
 * insightDerivations.ts
 *
 * Pure, stateless functions that translate survey inputs into the structured
 * insight signals used by InsightLayerPage.
 *
 * These are engine-interpretation-surface functions — they sit between survey
 * capture and recommendation output.  No physics simulation is run here; all
 * outputs are derived directly from surveyed values.
 */

import type { SystemBuilderState } from '../systemBuilder/systemBuilderTypes';
import type { HomeState } from '../usage/usageTypes';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';

// ─── System condition ─────────────────────────────────────────────────────────

/**
 * Derived three-band system cleanliness rating based on condition signals
 * captured in System Builder.
 *
 * Logic:
 *   sludge bleed OR many cold spots  → poor  (unless recently cleaned)
 *   dark bleed OR some cold spots    → moderate
 *   clear bleed AND all even         → clean
 *   unknown / unset                  → moderate (safe default)
 *
 * Modifiers:
 *   - magnetic filter fitted  reduces severity by one band
 *   - recently cleaned        reduces severity by one band
 */
export type SystemConditionGrade = 'clean' | 'moderate' | 'poor';

export function deriveSystemConditionGrade(
  system: SystemBuilderState,
): SystemConditionGrade {
  const { bleedWaterColour, radiatorPerformance, circulationIssues, magneticFilter, cleaningHistory } = system;

  // Base severity from primary signals
  let grade: SystemConditionGrade;

  const hasSludgeBleed = bleedWaterColour === 'sludge';
  const hasDarkBleed   = bleedWaterColour === 'dark';
  const hasManyCold    = radiatorPerformance === 'many_cold';
  const hasSomeCold    = radiatorPerformance === 'some_cold_spots';
  const hasPoorFlow    = circulationIssues === 'frequent_noise_or_poor_flow';

  if (hasSludgeBleed || hasManyCold || (hasDarkBleed && hasPoorFlow)) {
    grade = 'poor';
  } else if (hasDarkBleed || hasSomeCold || hasPoorFlow) {
    grade = 'moderate';
  } else if (
    bleedWaterColour === 'clear' &&
    (radiatorPerformance === 'all_even' || radiatorPerformance === null) &&
    (circulationIssues === 'none' || circulationIssues === null)
  ) {
    grade = 'clean';
  } else if (bleedWaterColour === 'slightly_discoloured') {
    grade = 'moderate';
  } else {
    // unknown / unset — default moderate (cautious)
    grade = 'moderate';
  }

  // Modifiers: each reduces severity by one band
  const filterMitigates    = magneticFilter === 'fitted';
  const recentlyCleanedMitigates = cleaningHistory === 'recently_cleaned';
  const mitigationCount    = (filterMitigates ? 1 : 0) + (recentlyCleanedMitigates ? 1 : 0);

  if (mitigationCount >= 2) {
    // Two mitigations: poor → clean, moderate → clean
    if (grade === 'poor' || grade === 'moderate') grade = 'clean';
  } else if (mitigationCount === 1) {
    if (grade === 'poor') grade = 'moderate';
    else if (grade === 'moderate') grade = 'clean';
  }

  return grade;
}

// ─── Heat load ────────────────────────────────────────────────────────────────

export type HeatLoadConfidence = 'measured' | 'estimated' | 'default';

export interface HeatLoadInsight {
  peakHeatLossKw: number;
  confidence: HeatLoadConfidence;
  /** True when emitters are radiators — HP retrofit may require upgrade. */
  emitterCompatibilitySignal: 'compatible' | 'upgrade_may_be_needed' | 'unknown';
}

export function deriveHeatLoadInsight(
  input: FullSurveyModelV1,
  system: SystemBuilderState,
): HeatLoadInsight {
  const peakHeatLossKw = (input.heatLossWatts ?? 8000) / 1000;

  // If the user ran the heat loss calculator we treat it as measured.
  // Otherwise it is the default.
  const confidence: HeatLoadConfidence =
    input.heatLossWatts != null && input.heatLossWatts !== 8000
      ? 'estimated'
      : 'default';

  const emitters = system.emitters;
  const emitterCompatibilitySignal =
    emitters === 'underfloor'
      ? 'compatible'
      : emitters === 'radiators_standard' || emitters === 'radiators_designer'
      ? 'upgrade_may_be_needed'
      : emitters === 'mixed'
      ? 'upgrade_may_be_needed'
      : 'unknown';

  return { peakHeatLossKw, confidence, emitterCompatibilitySignal };
}

// ─── Present system ───────────────────────────────────────────────────────────

export type EfficiencyBaseline = 'A_band' | 'B_band' | 'C_or_below' | 'unknown';
export type ConditionBand = 'good' | 'fair' | 'poor' | 'unknown';

export interface PresentSystemInsight {
  heatSource: string | null;
  dhwType: string | null;
  controlClass: string | null;
  efficiencyBaseline: EfficiencyBaseline;
  condition: ConditionBand;
}

export function derivePresentSystemInsight(system: SystemBuilderState): PresentSystemInsight {
  const efficiencyBaseline: EfficiencyBaseline =
    system.sedbukBand === 'A'
      ? 'A_band'
      : system.sedbukBand === 'B'
      ? 'B_band'
      : system.sedbukBand != null && system.sedbukBand !== 'unknown'
      ? 'C_or_below'
      : 'unknown';

  // Incorporate condition-signal grade first; fall back to age/service heuristic
  const conditionGrade = deriveSystemConditionGrade(system);
  const hasConditionSignals =
    system.bleedWaterColour != null ||
    system.radiatorPerformance != null ||
    system.circulationIssues != null;

  let condition: ConditionBand;

  if (hasConditionSignals) {
    condition =
      conditionGrade === 'clean'    ? 'good'  :
      conditionGrade === 'moderate' ? 'fair'  : 'poor';
  } else {
    // Legacy age/service heuristic when no condition signals are present
    condition = 'unknown';
    const age = system.boilerAgeYears;
    const service = system.serviceHistory;

    if (age != null) {
      if (age < 5 && service === 'regular') condition = 'good';
      else if (age < 10 && service !== 'irregular') condition = 'good';
      else if (age < 15) condition = service === 'regular' ? 'fair' : 'poor';
      else condition = 'poor';
    } else if (service === 'regular') {
      condition = 'fair';
    } else if (service === 'irregular') {
      condition = 'poor';
    }
  }

  return {
    heatSource: system.heatSource,
    dhwType: system.dhwType,
    controlClass: system.controlFamily,
    efficiencyBaseline,
    condition,
  };
}

// ─── Demands ──────────────────────────────────────────────────────────────────

export type ConcurrencyLevel = 'low' | 'medium' | 'high';
export type VolumeDemandBand = 'low' | 'medium' | 'high';
export type TimingPattern = 'standard' | 'morning_peak' | 'all_day' | 'variable';

export interface DemandsInsight {
  occupancyCount: number;
  concurrencyLevel: ConcurrencyLevel;
  volumeDemandBand: VolumeDemandBand;
  timingPattern: TimingPattern;
}

export function deriveDemandsInsight(home: HomeState): DemandsInsight {
  const { composition, daytimeOccupancy, bathUse, bathroomCount } = home;

  const occupancyCount =
    (composition.adultCount ?? 0) +
    (composition.youngAdultCount18to25AtHome ?? 0) +
    (composition.childCount11to17 ?? 0) +
    (composition.childCount5to10 ?? 0) +
    (composition.childCount0to4 ?? 0);

  const concurrencyLevel: ConcurrencyLevel =
    (bathroomCount != null && bathroomCount >= 2) || occupancyCount >= 4
      ? 'high'
      : occupancyCount >= 3
      ? 'medium'
      : 'low';

  const volumeDemandBand: VolumeDemandBand =
    occupancyCount >= 5
      ? 'high'
      : occupancyCount >= 3
      ? 'medium'
      : 'low';

  const timingPattern: TimingPattern =
    daytimeOccupancy === 'usually_home'
      ? 'all_day'
      : daytimeOccupancy === 'irregular'
      ? 'variable'
      : bathUse === 'frequent'
      ? 'morning_peak'
      : 'standard';

  return { occupancyCount, concurrencyLevel, volumeDemandBand, timingPattern };
}

// ─── Potential ────────────────────────────────────────────────────────────────

export interface PotentialInsight {
  /** Regular non-condensing boiler can be replaced with condensing. */
  condensingOpportunity: boolean;
  /** Radiators operating at high flow temp — potential for lower-temp emitters. */
  emitterUpgradeHeadroom: boolean;
  /** Old or no controls — significant efficiency gain available. */
  controlUpgradeHeadroom: boolean;
  /** Poor insulation level — fabric improvement would reduce heat loss. */
  insulationOpportunity: boolean;
}

export function derivePotentialInsight(
  system: SystemBuilderState,
  input: FullSurveyModelV1,
): PotentialInsight {
  const condensingOpportunity =
    system.sedbukBand != null &&
    system.sedbukBand !== 'unknown' &&
    system.sedbukBand !== 'A' &&
    system.sedbukBand !== 'B';

  const emitterUpgradeHeadroom =
    system.emitters === 'radiators_standard' || system.emitters === 'radiators_designer';

  const controlUpgradeHeadroom =
    system.thermostatStyle === 'basic' ||
    system.programmerType === 'electromechanical' ||
    system.programmerType === 'none' ||
    system.controlFamily === null;

  const fabricInsulationLevel = input.building?.fabric?.insulationLevel;
  const insulationOpportunity =
    fabricInsulationLevel === 'poor' ||
    fabricInsulationLevel == null;

  return {
    condensingOpportunity,
    emitterUpgradeHeadroom,
    controlUpgradeHeadroom,
    insulationOpportunity,
  };
}

// ─── Limitations ─────────────────────────────────────────────────────────────

export interface LimitationsInsight {
  /** Mains pressure appears low — combi or unvented cylinder viability affected. */
  mainsPressureLow: boolean;
  /** Pipework is buried — higher labour/risk for replacement. */
  pipeworkAccessDifficult: boolean;
  /** Regular boiler with open-vented circuit — sealing conversion risk. */
  sealingConversionRisk: boolean;
  /** Old open-vented system — flush/chemical clean complexity. */
  systemCleanComplexity: boolean;
}

export function deriveLimitationsInsight(
  system: SystemBuilderState,
  input: FullSurveyModelV1,
): LimitationsInsight {
  const dynamicPressure = input.dynamicMainsPressureBar ?? input.dynamicMainsPressure ?? null;
  const mainsPressureLow = dynamicPressure != null && dynamicPressure < 1.5;

  const pipeworkAccessDifficult = system.pipeworkAccess === 'buried';

  const sealingConversionRisk =
    system.heatSource === 'regular' &&
    system.heatingSystemType === 'open_vented';

  const systemCleanComplexity =
    system.heatSource === 'regular' &&
    (system.heatingSystemType === 'open_vented' || system.heatingSystemType === 'unknown');

  return {
    mainsPressureLow,
    pipeworkAccessDifficult,
    sealingConversionRisk,
    systemCleanComplexity,
  };
}

// ─── Quick wins ───────────────────────────────────────────────────────────────

export interface QuickWin {
  id: string;
  title: string;
  reason: string;
}

export function deriveQuickWins(
  system: SystemBuilderState,
  input: FullSurveyModelV1,
): QuickWin[] {
  const wins: QuickWin[] = [];
  const conditionGrade = deriveSystemConditionGrade(system);

  // Servicing
  if (system.serviceHistory === 'irregular' || system.serviceHistory === 'unknown') {
    wins.push({
      id: 'service',
      title: 'Annual boiler service',
      reason: 'No regular service history recorded — a service restores efficiency and catches deterioration early.',
    });
  }

  // Magnetic filter — conditional on not already fitted
  const filterFitted = system.magneticFilter === 'fitted';
  if (!filterFitted) {
    wins.push({
      id: 'magnetic_filter',
      title: 'Magnetic system filter',
      reason: 'No magnetic filter detected — fitting one protects the heat exchanger from magnetite and slows sludge accumulation.',
    });
  }

  // System cleaning — only when condition signals justify it
  const hasConditionSignals =
    system.bleedWaterColour != null ||
    system.radiatorPerformance != null ||
    system.circulationIssues != null;

  if (conditionGrade === 'poor' && hasConditionSignals) {
    wins.push({
      id: 'flush',
      title: 'System clean and flush',
      reason: 'System appears dirty — bleed water colour and/or cold spots suggest significant sludge. Cleaning and a magnetic filter are likely to improve performance before any replacement.',
    });
  } else if (conditionGrade === 'moderate' && hasConditionSignals) {
    wins.push({
      id: 'flush',
      title: 'Chemical system clean',
      reason: 'System shows signs of partial fouling — a chemical clean and magnetic filter may improve heat distribution and reduce cycling.',
    });
  } else if (!hasConditionSignals && system.heatSource === 'regular' && system.boilerAgeYears !== null && system.boilerAgeYears > 10) {
    // Soft hint only when no condition signals captured and system is old
    wins.push({
      id: 'flush',
      title: 'Consider a system health check',
      reason: 'Older system with no condition data captured — a visual check or bleed test is worthwhile before any upgrade.',
    });
  }

  // Controls upgrade
  if (
    system.thermostatStyle === 'basic' ||
    system.programmerType === 'electromechanical' ||
    system.programmerType === 'none'
  ) {
    wins.push({
      id: 'controls',
      title: 'Controls upgrade',
      reason: 'Controls upgrade could improve comfort and condensing opportunity — a programmable or smart thermostat can reduce heating energy use by 10–15%.',
    });
  }

  // Loft insulation
  const roofInsulation = input.building?.fabric?.roofInsulation;
  if (roofInsulation === 'poor' || roofInsulation == null) {
    wins.push({
      id: 'loft_insulation',
      title: 'Loft insulation',
      reason: 'Loft insulation likely gives faster gains than changing the boiler — upgrading to 270 mm mineral wool is the most cost-effective heat-loss reduction.',
    });
  }

  // Cavity wall insulation
  const wallType = input.building?.fabric?.wallType;
  if (wallType === 'cavity_unfilled') {
    wins.push({
      id: 'cavity_insulation',
      title: 'Cavity wall insulation',
      reason: 'Unfilled cavity walls detected — injecting insulation can reduce heat loss through walls by up to 35%.',
    });
  }

  return wins;
}

// ─── System recommendations ───────────────────────────────────────────────────

export type RecommendationTier = 'top' | 'alternative' | 'fallback';

export interface SystemRecommendation {
  id: string;
  name: string;
  tier: RecommendationTier;
  whyItFits: string[];
  tradeOffs: string[];
  constraints: string[];
}

export function deriveSystemRecommendations(
  system: SystemBuilderState,
  home: HomeState,
  input: FullSurveyModelV1,
): SystemRecommendation[] {
  const occupancy = deriveDemandsInsight(home).occupancyCount;
  const bathroomCount = home.bathroomCount ?? 1;
  const dynamicPressure = input.dynamicMainsPressureBar ?? input.dynamicMainsPressure ?? 2.0;
  const emitters = system.emitters;
  const recommendations: SystemRecommendation[] = [];

  // ── High-demand household: stored DHW is the physics-fit ────────────────────
  const highDemand = occupancy >= 4 || bathroomCount >= 2;
  const suitableForCombi =
    occupancy <= 2 &&
    bathroomCount < 2 &&
    dynamicPressure >= 1.5;

  // ── Combi ────────────────────────────────────────────────────────────────────
  if (suitableForCombi) {
    recommendations.push({
      id: 'combi_upgrade',
      name: 'Modern combi boiler',
      tier: 'top',
      whyItFits: [
        `This is the strongest overall fit because demand is low — ${occupancy} person household with ${bathroomCount} bathroom.`,
        `Mains pressure supports on-demand flow at ${dynamicPressure.toFixed(1)} bar — no simultaneous-draw risk at this occupancy.`,
        'Removing the cylinder frees space and eliminates standing heat losses.',
      ],
      tradeOffs: [
        'Cannot supply multiple outlets simultaneously — acceptable at this occupancy level.',
        'Flow rate is bounded by mains supply pressure.',
      ],
      constraints: [],
    });
  }

  // ── System boiler + unvented cylinder ────────────────────────────────────────
  if (highDemand || !suitableForCombi) {
    recommendations.push({
      id: 'system_unvented',
      name: 'System boiler with unvented cylinder',
      tier: suitableForCombi ? 'alternative' : 'top',
      whyItFits: [
        highDemand
          ? `This would improve simultaneous hot-water delivery — ${occupancy} people across ${bathroomCount} bathrooms requires stored volume to avoid shortfalls.`
          : 'Stored volume supports variable demand patterns where on-demand supply is borderline.',
        'Mains-pressure hot water delivered to all outlets simultaneously — resolves any concurrent-draw risk.',
        'A condensing system boiler with separate cylinder maximises seasonal efficiency.',
      ],
      tradeOffs: [
        'Requires cylinder space — typically 180–210 L for this household size.',
        'Hot water is finite — recovery time applies after large back-to-back draws.',
      ],
      constraints:
        dynamicPressure < 1.5
          ? ['Low mains pressure may affect unvented cylinder performance — static pressure check required before specifying.']
          : [],
    });
  }

  // ── Heat pump pathway (future-readiness signal) ──────────────────────────────
  const hpSuitable =
    emitters === 'underfloor' ||
    emitters === 'mixed' ||
    (emitters === 'radiators_standard' || emitters === 'radiators_designer');

  if (hpSuitable) {
    const requiresEmitterUpgrade =
      emitters === 'radiators_standard' || emitters === 'radiators_designer';
    recommendations.push({
      id: 'heat_pump',
      name: 'Air source heat pump',
      tier: 'alternative',
      whyItFits: [
        'This is possible and represents the low-carbon pathway — it eliminates gas combustion and qualifies for heat pump incentives.',
        emitters === 'underfloor'
          ? 'Underfloor heating is already an ideal low-flow-temperature emitter — no emitter change needed.'
          : 'Low-flow-temperature operation is achievable but requires emitter sizing to confirm coverage.',
      ],
      tradeOffs: [
        'Higher installation cost than a like-for-like boiler replacement.',
        requiresEmitterUpgrade ? 'Existing radiators may need upsizing to deliver adequate output at lower flow temperatures.' : '',
        'Requires adequate external space for the outdoor unit.',
      ].filter(Boolean),
      constraints: requiresEmitterUpgrade
        ? ['Emitter heat output modelling required before final sizing — a heat loss survey per room is needed.']
        : [],
    });
  }

  // Rank: top first, then alternatives, then fallbacks
  return recommendations.sort((a, b) => {
    const order: Record<RecommendationTier, number> = { top: 0, alternative: 1, fallback: 2 };
    return order[a.tier] - order[b.tier];
  });
}

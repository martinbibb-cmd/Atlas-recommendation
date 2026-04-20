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
import type { NormalisedPriorities } from '../priorities/prioritiesNormalizer';

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

/**
 * Resolve the confidence label for a heat-loss reading.
 *
 * Priority order:
 *   1. Use the persisted survey confidence when it is a known/non-unknown value.
 *   2. Infer 'estimated' when the effective watts is not the fallback default.
 *   3. Fall back to 'default' (no measurement made).
 */
function resolveHeatLossConfidence(
  surveyConfidence: string | null | undefined,
  effectiveHeatLossW: number,
): HeatLoadConfidence {
  if (surveyConfidence != null && surveyConfidence !== 'unknown') {
    return surveyConfidence as HeatLoadConfidence;
  }
  return effectiveHeatLossW !== 8000 ? 'estimated' : 'default';
}

export function deriveHeatLoadInsight(
  input: FullSurveyModelV1,
  system: SystemBuilderState,
): HeatLoadInsight {
  // Prefer the calculator-derived value persisted in fullSurvey.heatLoss over
  // the root heatLossWatts field.  This ensures that models loaded from saved
  // drafts show the correct value even when the root field still holds the
  // pre-draw default.
  const surveyHeatLossW = input.fullSurvey?.heatLoss?.estimatedPeakHeatLossW;
  const effectiveHeatLossW = surveyHeatLossW ?? input.heatLossWatts ?? 8000;
  const peakHeatLossKw = effectiveHeatLossW / 1000;

  const confidence = resolveHeatLossConfidence(
    input.fullSurvey?.heatLoss?.heatLossConfidence,
    effectiveHeatLossW,
  );

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
  priorities?: NormalisedPriorities,
): SystemRecommendation[] {
  const occupancy = deriveDemandsInsight(home).occupancyCount;
  // Prefer the usage-step bathroom count; fall back to the engine input value
  // (which is synced from the survey and more likely to be correct than a
  // hard-coded 1 when the usage step hasn't captured the field explicitly).
  const bathroomCount = home.bathroomCount ?? input.bathroomCount ?? 1;
  const dynamicPressure = input.dynamicMainsPressureBar ?? input.dynamicMainsPressure ?? 2.0;
  const peakConcurrentOutlets = input.peakConcurrentOutlets ?? 0;
  const emitters = system.emitters;
  const recommendations: SystemRecommendation[] = [];

  /**
   * Occupancy-based cylinder volume guide — matches QuoteCollectionStep defaults.
   * Rule of thumb: ~50 L per occupant, minimum 120 L.
   * ≤2 → 120 L,  3 → 150 L,  4 → 180 L,  5+ → 210 L
   */
  function defaultCylinderVolume(count: number): number {
    if (count <= 2) return 120;
    if (count <= 3) return 150;
    if (count <= 4) return 180;
    return 210;
  }
  const cylinderVolumeL = defaultCylinderVolume(occupancy);

  // ── High-demand household: stored DHW is the physics-fit ────────────────────
  // peakConcurrentOutlets >= 2 is a hard simultaneous-demand gate (same as
  // bathroomCount >= 2) — mirrors the CombiDhwModule rule so the insight layer
  // and the engine-level verdict are consistent.
  const highDemand = occupancy >= 4 || bathroomCount >= 2 || peakConcurrentOutlets >= 2;
  const suitableForCombi =
    occupancy <= 2 &&
    bathroomCount < 2 &&
    peakConcurrentOutlets < 2 &&
    dynamicPressure >= 1.5;

  // ── Combi ────────────────────────────────────────────────────────────────────
  if (suitableForCombi) {
    const combiWhyItFits: string[] = [
      `This is the strongest overall fit because demand is low — ${occupancy} person household with ${bathroomCount} bathroom.`,
      `Mains pressure supports on-demand flow at ${dynamicPressure.toFixed(1)} bar — no simultaneous-draw risk at this occupancy.`,
      'Removing the cylinder frees space and eliminates standing heat losses.',
    ];

    // Priority-shaped additions
    if (priorities?.reliability) {
      combiWhyItFits.push('Fewer components than a stored system — lower service complexity and simpler annual maintenance.');
    }
    if (priorities?.lowDisruption) {
      combiWhyItFits.push('Like-for-like combi swap is the least disruptive changeover — no new cylinder space or pipework routing required.');
    }
    if (priorities?.runningEfficiency) {
      combiWhyItFits.push('No cylinder standing losses — all heat produced goes directly to the demand point.');
    }

    const combiTradeOffs: string[] = [
      'Cannot supply multiple outlets simultaneously — acceptable at this occupancy level.',
      'Flow rate is bounded by mains supply pressure.',
    ];

    // Eco/future priority: note that gas combi is the highest-carbon pathway
    if (priorities?.eco || priorities?.futureCompatibility) {
      combiTradeOffs.push('Gas combi is the highest-carbon option — the heat pump pathway offers significantly lower carbon emissions.');
    }

    recommendations.push({
      id: 'combi_upgrade',
      name: 'Modern combi boiler',
      tier: 'top',
      whyItFits: combiWhyItFits,
      tradeOffs: combiTradeOffs,
      constraints: [],
    });
  }

  // ── System boiler + unvented cylinder ────────────────────────────────────────
  if (highDemand || !suitableForCombi) {
    const systemWhyItFits: string[] = [
      highDemand
        ? `This would improve simultaneous hot-water delivery — ${occupancy} people across ${bathroomCount} bathrooms requires stored volume to avoid shortfalls.`
        : 'Stored volume supports variable demand patterns where on-demand supply is borderline.',
      'Mains-pressure hot water delivered to all outlets simultaneously — resolves any concurrent-draw risk.',
      'A condensing system boiler with separate cylinder maximises seasonal efficiency.',
    ];

    if (priorities?.reliability) {
      systemWhyItFits.push('Separate cylinder means the boiler and hot water store can be serviced independently — reliable architecture with lower single-point failure risk.');
    }
    if (priorities?.longevity) {
      systemWhyItFits.push('Unvented cylinders typically last 20–25 years — separating the boiler and cylinder means each component can be replaced independently at end of life.');
    }
    if (priorities?.runningEfficiency) {
      systemWhyItFits.push('System boiler with well-insulated cylinder minimises standing losses — more efficient than open-vented stored hot water.');
    }

    const systemTradeOffs: string[] = [
      `Requires cylinder space — a ${cylinderVolumeL}L cylinder is typical for ${occupancy} occupant${occupancy === 1 ? '' : 's'}.`,
      'Hot water is finite — recovery time applies after large back-to-back draws.',
    ];

    if (priorities?.lowDisruption) {
      systemTradeOffs.push('Cylinder installation requires access and space — plan for some installation disruption if a cylinder is not already present.');
    }

    recommendations.push({
      id: 'system_unvented',
      name: 'System boiler with unvented cylinder',
      tier: suitableForCombi ? 'alternative' : 'top',
      whyItFits: systemWhyItFits,
      tradeOffs: systemTradeOffs,
      constraints:
        dynamicPressure < 1.5
          ? ['Low mains pressure will be assessed — the system ensures adequate supply to the unvented cylinder.']
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

    // Eco or future-readiness priorities promote the heat pump tier
    const hpTier: RecommendationTier =
      (priorities?.eco || priorities?.futureCompatibility) && !requiresEmitterUpgrade
        ? 'top'
        : 'alternative';

    const hpWhyItFits: string[] = [
      'This is possible and represents the low-carbon pathway — it eliminates gas combustion and qualifies for heat pump incentives.',
      emitters === 'underfloor'
        ? 'Underfloor heating is already an ideal low-flow-temperature emitter — no emitter change needed.'
        : 'Low-flow-temperature operation is achievable but requires emitter sizing to confirm coverage.',
    ];

    if (priorities?.eco) {
      hpWhyItFits.push('Switching to a heat pump eliminates on-site gas combustion — the most effective single step to reduce this home\'s carbon footprint.');
    }
    if (priorities?.futureCompatibility) {
      hpWhyItFits.push('Heat pumps are the long-term direction of travel for home heating policy — this pathway is compatible with evolving grid and regulatory standards.');
    }
    if (priorities?.reliability) {
      hpWhyItFits.push('Fewer mechanical components than gas — heat pumps typically have fewer wear points and long service intervals once established.');
    }
    if (priorities?.runningEfficiency) {
      hpWhyItFits.push('Heat pumps deliver 2.5–4 units of heat per unit of electricity consumed — significantly more efficient per unit of energy input than gas combustion.');
    }

    const hpTradeOffs: string[] = [
      'Higher installation cost than a like-for-like boiler replacement.',
    ];
    if (requiresEmitterUpgrade) {
      hpTradeOffs.push('Emitter sizing is designed to deliver adequate output — some radiators may be reconfigured for lower flow temperatures.');
    }
    hpTradeOffs.push('Requires adequate external space for the outdoor unit.');

    if (priorities?.lowDisruption) {
      hpTradeOffs.push('Heat pump installation is typically more involved than a boiler swap — outdoor unit siting, pipework, and possibly emitter changes all need planning.');
    }

    recommendations.push({
      id: 'heat_pump',
      name: 'Air source heat pump',
      tier: hpTier,
      whyItFits: hpWhyItFits,
      tradeOffs: hpTradeOffs,
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

// ─── Cylinder insight ─────────────────────────────────────────────────────────

/**
 * Adequacy assessment for the existing cylinder against occupancy demand.
 * 'adequate'    → volume meets occupancy-based rule of thumb
 * 'marginal'    → slightly undersized — may work but borderline
 * 'undersized'  → clearly undersized for occupancy
 * 'unknown'     → volume not captured
 */
export type CylinderAdequacy = 'adequate' | 'marginal' | 'undersized' | 'unknown';

/**
 * Replacement urgency derived from age band and condition.
 * 'now'       → replacement likely needed in current job
 * 'soon'      → should be planned within 2–3 years
 * 'monitor'   → serviceable but age warrants monitoring
 * 'not_needed' → relatively new and good condition
 * 'unknown'   → insufficient data
 */
export type CylinderReplacementUrgency = 'now' | 'soon' | 'monitor' | 'not_needed' | 'unknown';

export interface CylinderInsight {
  /** Whether the current system has a cylinder. */
  hasCylinder: boolean;
  /** Volume adequacy relative to occupancy demand. */
  volumeAdequacy: CylinderAdequacy;
  /** Age-and-condition-derived replacement urgency. */
  replacementUrgency: CylinderReplacementUrgency;
  /** Whether the cylinder has an immersion backup. */
  hasImmersion: boolean | null;
  /** Plain-English summary for the insight page. */
  summary: string;
  /** Advice items derived from cylinder characteristics. */
  advice: string[];
}

/**
 * Derive cylinder insight from SystemBuilderState and occupancy.
 *
 * All logic is deterministic — no Math.random(), no arbitrary scoring.
 */
export function deriveCylinderInsight(
  system: SystemBuilderState,
  occupancyCount: number,
): CylinderInsight {
  const hasCylinder =
    system.heatSource === 'regular' || system.heatSource === 'system';

  if (!hasCylinder) {
    return {
      hasCylinder: false,
      volumeAdequacy: 'unknown',
      replacementUrgency: 'unknown',
      hasImmersion: null,
      summary: '',
      advice: [],
    };
  }

  // ── Volume adequacy ────────────────────────────────────────────────────────
  const volumeL = system.cylinderVolumeL;
  // Occupancy-based minimum volume rule of thumb: 45 L per person, min 120 L
  const minAdequateL = Math.max(120, occupancyCount * 45);
  const minMarginalL = Math.max(100, occupancyCount * 38);

  let volumeAdequacy: CylinderAdequacy;
  if (volumeL == null) {
    volumeAdequacy = 'unknown';
  } else if (volumeL >= minAdequateL) {
    volumeAdequacy = 'adequate';
  } else if (volumeL >= minMarginalL) {
    volumeAdequacy = 'marginal';
  } else {
    volumeAdequacy = 'undersized';
  }

  // ── Replacement urgency ────────────────────────────────────────────────────
  const ageBand = system.cylinderAgeBand;
  const condition = system.cylinderCondition;

  let replacementUrgency: CylinderReplacementUrgency;

  if (ageBand == null && condition == null) {
    replacementUrgency = 'unknown';
  } else if (condition === 'poor' || ageBand === 'over_15') {
    replacementUrgency = 'now';
  } else if (
    ageBand === '10_to_15' ||
    (ageBand === '5_to_10' && condition === 'average') ||
    condition === 'average'
  ) {
    replacementUrgency = 'soon';
  } else if (ageBand === '5_to_10' && (condition === 'good' || condition == null)) {
    replacementUrgency = 'monitor';
  } else if (ageBand === 'under_5') {
    replacementUrgency = 'not_needed';
  } else {
    replacementUrgency = 'monitor';
  }

  // ── Summary string ─────────────────────────────────────────────────────────
  const ageLabel: Record<string, string> = {
    under_5:  'under 5 years old',
    '5_to_10': '5–10 years old',
    '10_to_15': '10–15 years old',
    over_15:  'over 15 years old',
    unknown:  'age unknown',
  };
  const agePart = ageBand ? ageLabel[ageBand] ?? '' : 'age not recorded';
  const volPart = volumeL ? `${volumeL} L` : 'volume not recorded';
  // Determine supply mode from dhwType (authoritative pressure semantics)
  // open_vented → tank-fed supply (gravity); unvented / thermal_store → mains-fed supply
  const isOpenVented = system.dhwType === 'open_vented';
  const supplyLabel = isOpenVented ? 'Tank-fed' : 'Mains-fed';
  const summary = `${supplyLabel} hot-water cylinder — ${volPart}, ${agePart}.`;

  // ── Advice ─────────────────────────────────────────────────────────────────
  const advice: string[] = [];

  if (volumeAdequacy === 'undersized') {
    advice.push(
      `Cylinder volume (${volumeL} L) is likely undersized for ${occupancyCount} occupants — a minimum of ${minAdequateL} L is recommended to avoid shortfalls at peak demand.`,
    );
  } else if (volumeAdequacy === 'marginal') {
    advice.push(
      `Cylinder volume (${volumeL} L) is borderline for ${occupancyCount} occupants — quotes for a larger cylinder should be considered.`,
    );
  }

  if (replacementUrgency === 'now') {
    advice.push(
      'Cylinder condition or age suggests replacement should be included in any upgrade work — carrying over a failing or very old cylinder to a new system reduces reliability and negates efficiency gains.',
    );
  } else if (replacementUrgency === 'soon') {
    advice.push(
      'Cylinder is approaching the end of its typical service life — factor replacement planning into discussions even if not replacing now.',
    );
  }

  if (system.cylinderInsulationType === 'copper_bare') {
    advice.push(
      'Uninsulated copper cylinder has high standing heat losses — adding a factory-foam replacement or fitting an insulation jacket will reduce energy waste.',
    );
  }

  if (system.cylinderHasImmersion === false) {
    advice.push(
      'No immersion heater fitted — if the boiler fails, there is no backup heat source for the hot water. Including an immersion heater in any replacement cylinder is worth considering.',
    );
  }

  return {
    hasCylinder,
    volumeAdequacy,
    replacementUrgency,
    hasImmersion: system.cylinderHasImmersion,
    summary,
    advice,
  };
}

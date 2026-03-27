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

  let condition: ConditionBand = 'unknown';
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
  home: HomeState,
  input: FullSurveyModelV1,
): QuickWin[] {
  const wins: QuickWin[] = [];

  // Servicing
  if (system.serviceHistory === 'irregular' || system.serviceHistory === 'unknown') {
    wins.push({
      id: 'service',
      title: 'Annual boiler service',
      reason: 'No regular service history recorded — servicing restores efficiency and extends appliance life.',
    });
  }

  // Magnetic filter
  if (!input.hasMagneticFilter) {
    wins.push({
      id: 'magnetic_filter',
      title: 'Magnetic system filter',
      reason: 'No magnetic filter detected — fitting one protects the heat exchanger from magnetite and reduces sludge buildup.',
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
      reason: 'Basic or missing controls — a programmable or smart thermostat can cut heating energy use by 10–15%.',
    });
  }

  // System flush
  const openVented =
    system.heatSource === 'regular' &&
    (system.heatingSystemType === 'open_vented' || system.heatingSystemType === 'unknown');
  if (openVented || (system.boilerAgeYears != null && system.boilerAgeYears > 10)) {
    wins.push({
      id: 'flush',
      title: 'Power flush / chemical clean',
      reason: 'Older system or open-vented circuit — a system flush removes sludge and restores heat distribution.',
    });
  }

  // Loft insulation
  const roofInsulation = input.building?.fabric?.roofInsulation;
  if (roofInsulation === 'poor' || roofInsulation == null) {
    wins.push({
      id: 'loft_insulation',
      title: 'Loft insulation',
      reason: 'Poor or unknown roof insulation — upgrading to 270 mm mineral wool is the most cost-effective heat-loss reduction.',
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
        `Low concurrent demand (${occupancy} person household, ${bathroomCount} bathroom)`,
        `Mains pressure supports on-demand flow (${dynamicPressure.toFixed(1)} bar)`,
        'Removes need for cylinder — saves space',
      ],
      tradeOffs: [
        'Cannot supply multiple outlets simultaneously',
        'Flow rate limited by mains supply pressure',
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
          ? `Household size (${occupancy} people, ${bathroomCount} bathrooms) needs stored DHW volume`
          : 'Stored volume supports variable demand patterns',
        'Mains-pressure hot water delivered to all outlets simultaneously',
        'Condensing system boiler maximises efficiency',
      ],
      tradeOffs: [
        'Requires cylinder space',
        'Hot water volume is finite — recovery time applies after large draws',
      ],
      constraints:
        dynamicPressure < 1.5
          ? ['Low mains pressure may affect unvented cylinder performance — check static pressure']
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
        'Low-carbon heating pathway',
        emitters === 'underfloor'
          ? 'Underfloor heating is an ideal low-flow-temperature emitter'
          : 'Potential for low-flow-temperature operation with upgraded emitters',
      ],
      tradeOffs: [
        'Higher installation cost',
        requiresEmitterUpgrade ? 'Radiator upgrades likely required for low-temperature operation' : '',
        'Needs adequate external space for the unit',
      ].filter(Boolean),
      constraints: requiresEmitterUpgrade
        ? ['Emitter heat output modelling required before final sizing']
        : [],
    });
  }

  // Rank: top first, then alternatives, then fallbacks
  return recommendations.sort((a, b) => {
    const order: Record<RecommendationTier, number> = { top: 0, alternative: 1, fallback: 2 };
    return order[a.tier] - order[b.tier];
  });
}

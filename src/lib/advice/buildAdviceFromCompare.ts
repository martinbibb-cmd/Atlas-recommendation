/**
 * buildAdviceFromCompare.ts
 *
 * PR6 — Canonical advice builder from compare/simulator truth.
 *
 * Converts the simulator's current-vs-proposed proof into objective-based
 * recommendations.  This is the single normalization layer that sits between
 * compare truth and the DecisionSynthesisPage rendering layer.
 *
 * Design rules:
 *  - Advice derives from compare truth, not a parallel recommendation engine.
 *  - compareWins are derived by comparing current vs proposed system states.
 *  - performanceSummary replaces efficiencyScore — uses PerformanceSummary shape.
 *  - confidencePct maps engine confidence level to a percentage.
 *  - No Math.random() — all outputs are deterministic from the same input.
 *  - Carbon wording is always "at point of use" — never implies full lifecycle.
 */

import type { EngineOutputV1, OptionCardV1 } from '../../contracts/EngineOutputV1';
import type { CompareSeed } from '../simulator/buildCompareSeedFromSurvey';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { toEngineInput } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { SimulatorSystemChoice } from '../../explainers/lego/simulator/useSystemDiagramPlayback';
import {
  computeCurrentEfficiencyPct,
  DEFAULT_NOMINAL_EFFICIENCY_PCT,
} from '../../engine/utils/efficiency';
import {
  buildUnifiedConfidence,
  type UnifiedConfidence,
} from '../confidence/buildUnifiedConfidence';
import type { AtlasFloorplanInputs, EmitterCoverageClassification } from '../floorplan/adaptFloorplanToAtlasInputs';
import { buildHeatingOperatingState, FLOOR_PLAN_EMITTER_EXPLANATION_TAGS } from '../heating/buildHeatingOperatingState';

// Re-export for consumers that want the unified type without an extra import.
export type { UnifiedConfidence };

// ─── SimulatorSystemState ──────────────────────────────────────────────────────

/**
 * Minimal description of a system side used for compare-based advice.
 *
 * Derived from CompareSeed left/right entries and applied to both current
 * and proposed system states.  Carries the physics parameters needed to
 * compute compareWins, performanceSummary, and cycling/condensing assessments.
 */
export interface SimulatorSystemState {
  /** System family (combi, unvented, open_vented, heat_pump). */
  systemChoice: SimulatorSystemChoice;
  /** Whether weather compensation is active. */
  weatherCompensation: boolean;
  /** Whether load compensation is active. */
  loadCompensation: boolean;
  /**
   * Emitter surface area multiplier.
   * 1.0 = standard radiators; > 1.0 = oversized.
   */
  emitterCapacityFactor: number;
  /** Physical condition of the heating system. */
  systemCondition: 'clean' | 'scaling' | 'heavy_scale' | 'sludge' | 'poor' | string;
  /** Boiler rated output (kW), if known. */
  boilerOutputKw?: number;
  /** Building heat loss (kW), if known. */
  heatLossKw?: number;
}

// ─── PerformanceSummary ───────────────────────────────────────────────────────

/**
 * Physics-grounded performance breakdown that replaces the old "efficiency score".
 *
 * Each field is independently explainable and directly traceable to the
 * underlying physics — no single composite number is exposed to the UI.
 */
export interface PerformanceSummary {
  /**
   * How close the system operates to its optimal physics.
   * Derived from system condition, emitter sizing, and control quality.
   *   optimal — low cycling, condensing margin maintained, controls active
   *   average — some degradation or sub-optimal controls
   *   poor    — heavy scale/sludge, no condensing margin, or poor controls
   */
  efficiencyBand: 'optimal' | 'average' | 'poor';
  /**
   * Energy conversion ratio: how many kWh of usable heat per 1 kWh input.
   * Boiler: ~0.85–0.94; Heat pump: 2.5–4 (COP).
   */
  energyConversion: {
    inputKwh: number;
    outputKwh: number;
    /** Human-readable ratio string, e.g. "1 kWh → 0.90 kWh heat". */
    label: string;
  };
  /** Cost per usable kWh of delivered heat (pence), e.g. 7.8p for gas @ 90% eff. */
  costPerKwhHeat: number;
  /** CO₂ per usable kWh of delivered heat (kgCO₂/kWh), at point of use. */
  carbonPerKwhHeat: number;
  /**
   * Benefit from local generation (solar PV / battery / smart immersion).
   *   high     — heat pump: solar PV and battery strongly reduce electric cost
   *   moderate — stored cylinder: smart immersion / solar thermal viable
   *   limited  — gas combi: solar does not directly offset gas consumption
   */
  localGenerationImpact: 'high' | 'moderate' | 'limited';
  /**
   * Potential to shift energy usage in time or store energy to reduce running cost.
   * This captures whether the system can take advantage of time-of-use tariffs,
   * off-peak electricity, or thermal/electrical storage.
   *   high     — heat pump: can shift runtime, pre-heat structure or cylinder on off-peak tariff
   *   moderate — stored cylinder (gas): smart immersion / solar thermal timing viable
   *   limited  — combi boiler: runs on demand only, gas price cannot be shifted in time
   */
  optimisationPotential: 'high' | 'moderate' | 'limited';
}

// ─── AdviceCard ───────────────────────────────────────────────────────────────

/**
 * A single objective-based advice card derived from compare truth.
 *
 * Each card answers: "For this specific objective, what is the best path
 * and why — backed by what the simulator compare proved?"
 */
export interface AdviceCard {
  /** Stable identifier for this objective. */
  id: string;
  /** Emoji icon for the card header. */
  icon: string;
  /** Short objective title. */
  title: string;
  /** Human-readable label for the recommended path (e.g. "Unvented cylinder system"). */
  recommendedPathLabel: string;
  /** Array of plain-English reasons why this path wins for this objective. */
  why: string[];
  /**
   * The main trade-off when optimising for this objective.
   * null when there is no meaningful downside to surface.
   */
  keyTradeOff: string | null;
  /**
   * Confidence percentage (0–100).
   * Derived from engine confidence level: high=85, medium=65, low=40.
   * null when confidence data is unavailable.
   */
  confidencePct: number | null;
  /**
   * Physics-grounded performance breakdown for the recommended path.
   * Replaces the old "efficiency score" — see PerformanceSummary for shape.
   * null when insufficient data is available.
   */
  performanceSummary: PerformanceSummary | null;
  /**
   * Short labels that tie this card back to compare truth.
   *
   * Examples: "lower cycling risk", "better simultaneous hot-water delivery",
   * "stronger condensing margin", "keeps future heat-pump path open".
   *
   * Only populated when compare truth supports the claim.
   */
  compareWins: string[];
}

// ─── InstallationRecipe ───────────────────────────────────────────────────────

export interface InstallationRecipe {
  heatSource: string;
  hotWaterArrangement: string;
  controls: string[];
  emitters: string[];
  primaryPipework: string[];
  protectionAndAncillaries: string[];
}

// ─── RecommendationScope ──────────────────────────────────────────────────────

export interface ScopeItem {
  label: string;
  description?: string;
  type: 'required' | 'upgrade' | 'optional' | 'future';
  /** When true the item renders as a selectable checkbox in Best Advice. */
  selectable?: boolean;
}

export interface ScopeCard {
  title: 'Essential' | 'Best Advice' | 'Enhanced' | 'Future Potential';
  items: ScopeItem[];
}

/**
 * Scope-based recommendation model.
 *
 * Replaces the Now / Next / Later phased plan with four clear decision scopes:
 *  - essential:      Mandatory works for the recommended system.
 *  - bestAdvice:     High-impact upgrades to do at the same time (checkbox UI).
 *  - enhanced:       Optional lifestyle / value upgrades.
 *  - futurePotential: Conditional future pathway (ASHP only when not recommended now).
 *
 * Cards are only present when they have items.  Essential is always present.
 */
export interface RecommendationScope {
  essential: ScopeCard;
  bestAdvice?: ScopeCard;
  enhanced?: ScopeCard;
  futurePotential?: ScopeCard;
}

// ─── ConfidenceSummary ────────────────────────────────────────────────────────

export interface ConfidenceSummary {
  level: 'high' | 'medium' | 'low' | null;
  pct: number | null;
  reasons: string[];
  /**
   * Full unified confidence breakdown — dataPct, physicsPct, decisionPct, and lists.
   * Always set when produced by buildAdviceFromCompare (buildUnifiedConfidence always
   * returns a value).  Typed as nullable for backward compatibility with any external
   * consumers that may construct a ConfidenceSummary manually.
   */
  unified: UnifiedConfidence | null;
}

// ─── FloorplanInsights ────────────────────────────────────────────────────────

/**
 * Surface-level summary of floor-plan derived information that has influenced
 * this advice result.  Present only when a reliable floor plan was provided.
 */
export interface FloorplanInsights {
  /** Aggregated whole-home heat loss (kW) derived from floor-plan room geometry. */
  refinedHeatLossKw: number;
  /** Rooms where emitter sizing may need review (suggested output ≥ threshold). */
  emitterReviewRooms: string[];
  /** Siting warning messages for poorly-placed heat sources or cylinders. */
  sitingWarnings: string[];
  /** Pipe length planning estimate (m). */
  pipeLengthEstimateM: number;
  /** Whether this floor plan was used to refine heat-loss estimates. */
  heatLossRefined: boolean;
  /**
   * Whole-system emitter coverage classification derived from room-level
   * installed emitter output data.
   * null when no rooms carry actual emitter output data.
   */
  coverageClassification: EmitterCoverageClassification | null;
  /** Rooms where installed emitter output is insufficient to meet room heat demand. */
  undersizedRooms: string[];
  /** Rooms where installed emitter output far exceeds room heat demand (ratio > 1.8). */
  oversizedRooms: string[];
  /**
   * True when the floor-plan emitter coverage data meaningfully changed the
   * operating temperature assumption (i.e. actual installed emitter data was
   * available and the implied oversizing factor differs from the default 1.0).
   */
  operatingTempInfluenced: boolean;
  /**
   * Explanation tags from buildHeatingOperatingState when it was informed by
   * the floor-plan emitter adequacy signal.  Surfaces the physics story
   * (e.g. 'oversized emitters improving margin', 'emitter-limited').
   */
  emitterExplanationTags: string[];
}

// ─── AdviceFromCompareResult ──────────────────────────────────────────────────

export interface AdviceFromCompareResult {
  /** Primary all-round recommendation card. */
  bestOverall: AdviceCard;
  /** Six objective-specific advice cards. */
  byObjective: {
    lowestRunningCost: AdviceCard;
    lowestInstallationCost: AdviceCard;
    greatestLongevity: AdviceCard;
    lowestCarbonPointOfUse: AdviceCard;
    greatestComfortAndDelivery: AdviceCard;
    measuredForwardThinkingPlan: AdviceCard;
  };
  /** Concise installation requirements for the recommended path. */
  installationRecipe: InstallationRecipe;
  /** Scope-based recommendation model (Essential / Best Advice / Enhanced / Future Potential). */
  recommendationScope: RecommendationScope;
  /** Confidence summary for the overall recommendation. */
  confidenceSummary: ConfidenceSummary;
  /**
   * Floor-plan derived insights that influenced this advice result.
   * Present only when a reliable DerivedFloorplanOutput was supplied via
   * AdviceFromCompareInput.floorplanInputs.
   */
  floorplanInsights: FloorplanInsights | null;
}

// ─── Input type ───────────────────────────────────────────────────────────────

export interface AdviceFromCompareInput {
  surveyData: FullSurveyModelV1;
  engineOutput: EngineOutputV1;
  compareSeed: CompareSeed;
  /** Optional — derived from compareSeed when not provided. */
  currentSystemState?: SimulatorSystemState;
  /** Optional — derived from compareSeed when not provided. */
  proposedSystemState?: SimulatorSystemState;
  /**
   * Optional floor-plan derived inputs from adaptFloorplanToAtlasInputs().
   * When present and isReliable, the floor plan refines heat-loss estimates,
   * emitter adequacy hints, siting constraint warnings, and confidence.
   * When absent, all estimates fall back to survey-only presets.
   */
  floorplanInputs?: AtlasFloorplanInputs;
}

// ─── Internal constants ───────────────────────────────────────────────────────

/** Maps EngineOutputV1 option IDs to human-readable labels. */
const OPTION_LABEL: Record<string, string> = {
  combi:           'Combi boiler',
  stored_vented:   'Open-vented cylinder system',
  stored_unvented: 'Unvented cylinder system',
  ashp:            'Air source heat pump',
  regular_vented:  'Regular boiler with open-vented cylinder',
  system_unvented: 'System boiler with unvented cylinder',
};

/**
 * Maps SimulatorSystemChoice values to human-readable labels.
 * Used when option cards are not available to resolve a label.
 */
const SYSTEM_CHOICE_LABEL: Record<string, string> = {
  combi:       'Combi boiler',
  unvented:    'Unvented cylinder system',
  open_vented: 'Open-vented cylinder system',
  heat_pump:   'Air source heat pump',
};

/**
 * Efficiency decay (percentage points) per system condition.
 * Used with computeCurrentEfficiencyPct to produce the performanceSummary efficiencyBand.
 */
const CONDITION_DECAY_PCT: Record<string, number> = {
  clean:       0,
  scaling:     5,
  heavy_scale: 10,
  sludge:      8,
  poor:        12,
};

// ─── Derive SimulatorSystemState from CompareSeed ─────────────────────────────

function stateFromCompareSeed(
  side: CompareSeed['left'] | CompareSeed['right'],
): SimulatorSystemState {
  const inputs = side.systemInputs ?? {};
  return {
    systemChoice: side.systemChoice,
    weatherCompensation: inputs.weatherCompensation ?? false,
    loadCompensation: inputs.loadCompensation ?? false,
    emitterCapacityFactor: inputs.emitterCapacityFactor ?? 1.0,
    systemCondition: (inputs.systemCondition as string | undefined) ?? 'clean',
    boilerOutputKw: inputs.boilerOutputKw,
    heatLossKw: inputs.heatLossKw,
  };
}

// ─── Performance summary ──────────────────────────────────────────────────────

/** UK-assumed tariff and emissions constants used for cost/carbon calculations. */
const PERF_GAS_PENCE_PER_KWH   = 7;    // p/kWh input
const PERF_ELEC_PENCE_PER_KWH  = 28;   // p/kWh input
const PERF_GAS_KG_CO2_PER_KWH  = 0.21; // kgCO₂/kWh gas at point of use
const PERF_GRID_KG_CO2_PER_KWH = 0.233; // UK grid intensity (kgCO₂/kWh electricity, BEIS 2025 estimate)
const PERF_TYPICAL_HP_COP      = 3.0;  // typical UK ASHP SCOP

/**
 * Derive a physics-grounded PerformanceSummary for a given system state.
 *
 * For heat pumps: uses typical UK SCOP (3.0) and electricity tariff.
 * For boilers: uses engine SEDBUK data or DEFAULT_NOMINAL_EFFICIENCY_PCT,
 *   adjusted for condition decay and controls uplift.
 */
function derivePerformanceSummary(
  state: SimulatorSystemState,
  primaryOption: OptionCardV1 | null,
): PerformanceSummary | null {
  if (state.systemChoice === 'heat_pump') {
    const cop = PERF_TYPICAL_HP_COP;
    const costPerKwhHeat    = parseFloat((PERF_ELEC_PENCE_PER_KWH / cop).toFixed(1));
    const carbonPerKwhHeat  = parseFloat((PERF_GRID_KG_CO2_PER_KWH / cop).toFixed(3));
    return {
      efficiencyBand: 'optimal',
      energyConversion: {
        inputKwh: 1,
        outputKwh: cop,
        label: `1 kWh → ${cop} kWh heat`,
      },
      costPerKwhHeat,
      carbonPerKwhHeat,
      localGenerationImpact: 'high',
      optimisationPotential: 'high',
    };
  }

  // Boiler-based: resolve SEDBUK nominal from engine bullets when available.
  const sedbukMatch = primaryOption?.engineering?.bullets
    ?.reduce<RegExpMatchArray | null>(
      (found, b) => found ?? b.match(/(\d{2,3})%/),
      null,
    );

  const nominalPct = sedbukMatch
    ? Math.min(99, Math.max(50, parseInt(sedbukMatch[1], 10)))
    : DEFAULT_NOMINAL_EFFICIENCY_PCT;

  const decayPct = CONDITION_DECAY_PCT[state.systemCondition] ?? 0;
  const controlsUplift = (state.weatherCompensation ? 3 : 0) + (state.loadCompensation ? 2 : 0);
  const effectivePct = computeCurrentEfficiencyPct(nominalPct + controlsUplift, decayPct);
  const efficiency = effectivePct / 100;

  // Efficiency band: derive from condition + controls + emitter factor.
  const poorConditions: string[] = ['heavy_scale', 'sludge', 'poor'];
  let efficiencyBand: PerformanceSummary['efficiencyBand'];
  if (poorConditions.includes(state.systemCondition)) {
    efficiencyBand = 'poor';
  } else if (
    state.systemCondition === 'clean' &&
    (state.weatherCompensation || state.loadCompensation) &&
    state.emitterCapacityFactor >= 1.0
  ) {
    efficiencyBand = 'optimal';
  } else {
    efficiencyBand = 'average';
  }

  // Stored cylinders (unvented / open-vented) can benefit from solar immersion.
  const hasStoredCylinder =
    state.systemChoice === 'unvented' || state.systemChoice === 'open_vented';

  const costPerKwhHeat   = parseFloat((PERF_GAS_PENCE_PER_KWH / efficiency).toFixed(1));
  const carbonPerKwhHeat = parseFloat((PERF_GAS_KG_CO2_PER_KWH / efficiency).toFixed(3));

  return {
    efficiencyBand,
    energyConversion: {
      inputKwh: 1,
      outputKwh: Math.round(efficiency * 100) / 100,
      label: `1 kWh → ${efficiency.toFixed(2)} kWh heat`,
    },
    costPerKwhHeat,
    carbonPerKwhHeat,
    localGenerationImpact: hasStoredCylinder ? 'moderate' : 'limited',
    optimisationPotential: hasStoredCylinder ? 'moderate' : 'limited',
  };
}

// ─── compareWins derivation ───────────────────────────────────────────────────

/**
 * Derive compare wins for the proposed system vs the current system.
 *
 * Each win is a short, honest label backed by the system comparison.
 * Only includes a win when the proposed system genuinely delivers it.
 */
function deriveCompareWins(
  current: SimulatorSystemState,
  proposed: SimulatorSystemState,
  primaryOption: OptionCardV1 | null,
): string[] {
  const wins: string[] = [];

  const currentIsCombi = current.systemChoice === 'combi';
  const proposedIsStored =
    proposed.systemChoice === 'unvented' ||
    proposed.systemChoice === 'open_vented';
  const proposedIsHeatPump = proposed.systemChoice === 'heat_pump';
  const proposedHasCylinder = proposedIsStored || proposedIsHeatPump;

  // ── Simultaneous hot water ────────────────────────────────────────────────
  if (currentIsCombi && proposedHasCylinder) {
    wins.push('better simultaneous hot-water delivery');
  }

  // ── DHW efficiency mode ───────────────────────────────────────────────────
  // Combi switches to DHW-only mode during draw-offs, losing CH efficiency.
  if (currentIsCombi && proposedHasCylinder) {
    wins.push('reduced-efficiency DHW mode avoided');
  }

  // ── Cycling risk ──────────────────────────────────────────────────────────
  // Proposed has better emitter headroom or modulation → lower cycling.
  const emitterImprovement =
    proposed.emitterCapacityFactor > current.emitterCapacityFactor + 0.1;
  const controlsImprovement =
    (!current.weatherCompensation && proposed.weatherCompensation) ||
    (!current.loadCompensation && proposed.loadCompensation);

  if (emitterImprovement || (controlsImprovement && !currentIsCombi)) {
    wins.push('lower cycling risk');
  }

  // ── Condensing margin ─────────────────────────────────────────────────────
  // Proposed has weather or load comp that current lacks → stronger condensing.
  if (controlsImprovement && !proposedIsHeatPump) {
    wins.push('stronger condensing margin');
  }

  // ── Running cost ──────────────────────────────────────────────────────────
  // Heat pump COP >> boiler; or proposed has materially better efficiency.
  if (proposedIsHeatPump && !currentIsCombi) {
    wins.push('lower likely running cost');
  } else if (proposedIsHeatPump && currentIsCombi) {
    wins.push('lower likely running cost');
  } else if (
    !proposedIsHeatPump &&
    (emitterImprovement || controlsImprovement) &&
    primaryOption?.status === 'viable'
  ) {
    wins.push('lower likely running cost');
  }

  // ── Future heat-pump path ─────────────────────────────────────────────────
  // A cylinder-equipped proposed system preserves HP upgrade route.
  if (proposedHasCylinder && !proposedIsHeatPump) {
    wins.push('keeps future heat-pump path open');
  }

  // ── Mixergy / active stratification ──────────────────────────────────────
  // If the engine option list includes a Mixergy-type stored option.
  const hasMixergy = primaryOption?.dhw?.bullets?.some(
    b => /mixergy|stratif/i.test(b),
  );
  if (hasMixergy) {
    wins.push('reduced cycling penalties via active stratification');
  }

  // ── Clean system ──────────────────────────────────────────────────────────
  const proposedCondition = proposed.systemCondition;
  const currentCondition = current.systemCondition;
  const conditionRank: Record<string, number> = {
    clean: 0,
    scaling: 1,
    sludge: 2,
    heavy_scale: 3,
    poor: 4,
  };
  const proposedRank = conditionRank[proposedCondition] ?? 0;
  const currentRank = conditionRank[currentCondition] ?? 0;
  if (proposedRank < currentRank) {
    wins.push('cleaner system starting point');
  }

  return wins;
}

// ─── Option helpers ───────────────────────────────────────────────────────────

function pickBest(options: OptionCardV1[], priority: string[]): OptionCardV1 | null {
  for (const id of priority) {
    const opt = options.find(o => o.id === id && o.status !== 'rejected');
    if (opt) return opt;
  }
  return options.find(o => o.status === 'viable') ?? options[0] ?? null;
}

function labelOfOption(opt: OptionCardV1 | null): string {
  if (!opt) return 'Boiler system';
  return OPTION_LABEL[opt.id] ?? opt.label;
}

function firstWhy(opt: OptionCardV1 | null, fallback: string): string[] {
  if (!opt) return [fallback];
  return opt.why?.slice(0, 2) ?? [fallback];
}

function tradeOffNote(opt: OptionCardV1 | null): string | null {
  if (!opt) return null;
  const downgrade = opt.sensitivities?.find(s => s.effect === 'downgrade');
  if (downgrade) return downgrade.note;
  if (opt.engineering?.status === 'caution') return opt.engineering.headline;
  if (opt.dhw?.status === 'caution') return opt.dhw.headline;
  if (opt.heat?.status === 'caution') return opt.heat.headline;
  return null;
}

// ─── Objective card builders ──────────────────────────────────────────────────

function buildRunningCostCard(
  options: OptionCardV1[],
  proposed: SimulatorSystemState,
  current: SimulatorSystemState,
  confidencePct: number | null,
): AdviceCard {
  const priority = ['ashp', 'system_unvented', 'stored_unvented', 'combi', 'stored_vented', 'regular_vented'];
  const opt = pickBest(options, priority);
  const isAshp = opt?.id === 'ashp';

  const wins = deriveCompareWins(current, proposed, opt).filter(w =>
    /running cost|efficiency|DHW mode/i.test(w),
  );

  return {
    id: 'lowest_running_cost',
    icon: '💷',
    title: 'Lowest running cost',
    recommendedPathLabel: labelOfOption(opt),
    why: isAshp
      ? ['Heat pump delivers 3–4 units of heat per unit of electricity at suitable flow temperatures.']
      : ['Best condensing efficiency reduces fuel consumption at part-load and design-point.',
         ...firstWhy(opt, 'Improved controls reduce average operating temperature.')].slice(0, 2),
    keyTradeOff: isAshp
      ? 'Higher installation cost; requires lower flow temperatures and sufficient emitter area.'
      : tradeOffNote(opt),
    confidencePct,
    performanceSummary: derivePerformanceSummary(proposed, opt),
    compareWins: wins.length > 0 ? wins : ['lower likely running cost'],
  };
}

function buildInstallCostCard(
  options: OptionCardV1[],
  proposed: SimulatorSystemState,
  current: SimulatorSystemState,
  confidencePct: number | null,
): AdviceCard {
  const priority = ['combi', 'regular_vented', 'stored_vented', 'stored_unvented', 'system_unvented', 'ashp'];
  const opt = pickBest(options, priority);
  const isCombi = opt?.id === 'combi';

  return {
    id: 'lowest_installation_cost',
    icon: '🔧',
    title: 'Lowest installation cost',
    recommendedPathLabel: labelOfOption(opt),
    why: isCombi
      ? ['No cylinder, no additional zone valves or buffer vessel. Minimal pipework change.']
      : ['Reuses existing cylinder position and most current pipework.'],
    keyTradeOff: isCombi
      ? 'Limited simultaneous hot-water flow; CH lockout during large draw-offs.'
      : tradeOffNote(opt),
    confidencePct,
    performanceSummary: derivePerformanceSummary(proposed, opt),
    compareWins: isCombi ? [] : deriveCompareWins(current, proposed, opt).slice(0, 2),
  };
}

function buildLongevityCard(
  options: OptionCardV1[],
  proposed: SimulatorSystemState,
  current: SimulatorSystemState,
  confidencePct: number | null,
): AdviceCard {
  const priority = ['stored_unvented', 'system_unvented', 'ashp', 'stored_vented', 'regular_vented', 'combi'];
  const opt = pickBest(options, priority);
  const isStored = opt && [
    'stored_unvented', 'stored_vented', 'system_unvented', 'regular_vented',
  ].includes(opt.id);

  const wins = deriveCompareWins(current, proposed, opt).filter(w =>
    /cycling|condensing|clean/i.test(w),
  );

  return {
    id: 'greatest_longevity',
    icon: '⏳',
    title: 'Greatest longevity',
    recommendedPathLabel: labelOfOption(opt),
    why: isStored
      ? ['Decoupled zones reduce cycling frequency.',
         'Proper water treatment eliminates scale and sludge degradation.']
      : ['Low cycling rate and slow thermal transitions reduce component wear.'],
    keyTradeOff: tradeOffNote(opt) ??
      'Higher upfront cost for cylinder and zone-valve controls.',
    confidencePct,
    performanceSummary: derivePerformanceSummary(proposed, opt),
    compareWins: wins.length > 0 ? wins : ['lower cycling risk'],
  };
}

function buildCarbonCard(
  options: OptionCardV1[],
  proposed: SimulatorSystemState,
  current: SimulatorSystemState,
  confidencePct: number | null,
): AdviceCard {
  const priority = ['ashp', 'system_unvented', 'stored_unvented', 'stored_vented', 'regular_vented', 'combi'];
  const opt = pickBest(options, priority);
  const isAshp = opt?.id === 'ashp';

  return {
    id: 'lowest_carbon_point_of_use',
    icon: '🌿',
    title: 'Lowest carbon at point of use',
    recommendedPathLabel: labelOfOption(opt),
    why: isAshp
      ? ['No on-site combustion. At point of use, zero direct carbon emissions.']
      : ['Highest seasonal condensing efficiency minimises gas consumption and direct carbon output.'],
    keyTradeOff: isAshp
      ? 'Carbon benefit depends on grid mix at point of use — not included in this calculation.'
      : 'Gas combustion still produces CO₂ at point of use; carbon benefit is efficiency-only.',
    confidencePct,
    performanceSummary: derivePerformanceSummary(proposed, opt),
    compareWins: isAshp
      ? ['zero on-site combustion at point of use']
      : deriveCompareWins(current, proposed, opt).filter(w => /condensing|efficiency/i.test(w)),
  };
}

function buildComfortCard(
  options: OptionCardV1[],
  proposed: SimulatorSystemState,
  current: SimulatorSystemState,
  confidencePct: number | null,
): AdviceCard {
  const priority = ['stored_unvented', 'system_unvented', 'ashp', 'stored_vented', 'regular_vented', 'combi'];
  const opt = pickBest(options, priority);
  const isUnvented = opt?.id === 'stored_unvented' || opt?.id === 'system_unvented';

  const wins = deriveCompareWins(current, proposed, opt).filter(w =>
    /hot-water|delivery|DHW/i.test(w),
  );

  return {
    id: 'greatest_comfort_and_delivery',
    icon: '🚿',
    title: 'Greatest comfort and delivery',
    recommendedPathLabel: labelOfOption(opt),
    why: isUnvented
      ? ['Mains-pressure hot water throughout.',
         'No CH lockout during draw-off. Fast reheat recovery.']
      : ['Dedicated cylinder decouples hot water from space heating — no simultaneous-use compromise.'],
    keyTradeOff: isUnvented
      ? 'Requires adequate mains pressure and a visible discharge pipe (G3 safety requirement).'
      : tradeOffNote(opt),
    confidencePct,
    performanceSummary: derivePerformanceSummary(proposed, opt),
    compareWins: wins.length > 0 ? wins : ['better simultaneous hot-water delivery'],
  };
}

function buildFutureReadyCard(
  options: OptionCardV1[],
  proposed: SimulatorSystemState,
  current: SimulatorSystemState,
  confidencePct: number | null,
  plans: EngineOutputV1['plans'],
): AdviceCard {
  const priority = ['stored_unvented', 'system_unvented', 'stored_vented', 'ashp', 'regular_vented', 'combi'];
  const opt = pickBest(options, priority);

  const topPathway = plans?.pathways
    ?.slice()
    .sort((a, b) => a.rank - b.rank)[0];

  const wins = deriveCompareWins(current, proposed, opt).filter(w =>
    /heat-pump|future|path/i.test(w),
  );

  return {
    id: 'measured_forward_thinking_plan',
    icon: '🌳',
    title: 'Measured forward-thinking plan',
    recommendedPathLabel: topPathway?.title ?? labelOfOption(opt),
    why: topPathway
      ? [topPathway.rationale]
      : ['Install a system that does not foreclose the heat pump upgrade path.',
         'Size the cylinder space now; upgrade controls and emitters in stages.'],
    keyTradeOff: 'May not be the lowest upfront cost — it prioritises flexibility over short-term saving.',
    confidencePct,
    performanceSummary: derivePerformanceSummary(proposed, opt),
    compareWins: wins.length > 0 ? wins : ['keeps future heat-pump path open'],
  };
}

// ─── Installation recipe ──────────────────────────────────────────────────────

function buildInstallationRecipe(
  primaryOption: OptionCardV1 | null,
  proposed: SimulatorSystemState,
): InstallationRecipe {
  const mustHave = primaryOption?.typedRequirements?.mustHave ?? primaryOption?.requirements ?? [];
  const likelyUpgrades = primaryOption?.typedRequirements?.likelyUpgrades ?? [];
  const niceToHave = primaryOption?.typedRequirements?.niceToHave ?? [];

  const heatSource = primaryOption
    ? OPTION_LABEL[primaryOption.id] ?? primaryOption.label
    : SYSTEM_CHOICE_LABEL[proposed.systemChoice] ?? 'To be determined';

  const dhwBullets = primaryOption?.dhw?.bullets ?? [];
  const hotWaterArrangement = dhwBullets[0] ?? (
    proposed.systemChoice === 'combi'
      ? 'On-demand hot water via plate heat exchanger — no cylinder'
      : 'Dedicated hot water cylinder (size from occupancy and bathroom count)'
  );

  const controls = [
    ...mustHave.filter(r => /control|compensat|thermostat|programmer|zone/i.test(r)),
    ...niceToHave.filter(r => /control|compensat|thermostat|programmer|zone/i.test(r)),
    ...likelyUpgrades.filter(r => /control|compensat|thermostat|programmer|zone/i.test(r)),
  ].slice(0, 4);
  if (controls.length === 0) controls.push('Room thermostat and TRVs as a minimum');

  const heatBullets = primaryOption?.heat?.bullets ?? [];
  const emitters = heatBullets.length > 0
    ? heatBullets.slice(0, 2)
    : ['Check radiator output matches heat loss at target flow temperature'];

  const primaryPipework: string[] = [];
  const primaryFromReqs = mustHave.find(r => /primary|pipe|22\s?mm|28\s?mm/i.test(r));
  const primaryFromEng = primaryOption?.engineering?.bullets?.find(b => /primary|pipe/i.test(b));
  if (primaryFromReqs) primaryPipework.push(primaryFromReqs);
  else if (primaryFromEng) primaryPipework.push(primaryFromEng);

  // PRV discharge — prefer external visible route per installer best practice.
  if (
    proposed.systemChoice === 'unvented' ||
    proposed.systemChoice === 'heat_pump'
  ) {
    primaryPipework.push('External visible PRV discharge route preferred over internal drain');
  }

  const protectionAndAncillaries = [
    ...mustHave.filter(r => /filter|inhibitor|flush|treatment|chemical|TDS|silicate/i.test(r)),
    ...likelyUpgrades.filter(r => /filter|inhibitor|flush|treatment|chemical/i.test(r)),
  ].slice(0, 3);
  if (protectionAndAncillaries.length === 0) {
    protectionAndAncillaries.push('Magnetic filter on primary return');
    protectionAndAncillaries.push('System flush before installation');
  }

  return {
    heatSource,
    hotWaterArrangement,
    controls,
    emitters,
    primaryPipework,
    protectionAndAncillaries,
  };
}

// ─── Recommendation scope ─────────────────────────────────────────────────────

/** Pattern matching items that belong in Enhanced (solar, battery, EV) not Best Advice. */
const ENHANCED_UPGRADE_PATTERN = /solar|battery|EV\b|ev\s+charg|divert|smart\s+immer|photovoltaic/i;

function buildRecommendationScope(
  primaryOption: OptionCardV1 | null,
  proposed: SimulatorSystemState,
  current: SimulatorSystemState,
  plans: EngineOutputV1['plans'],
): RecommendationScope {
  const mustHave = primaryOption?.typedRequirements?.mustHave ?? primaryOption?.requirements ?? [];
  const likelyUpgrades = primaryOption?.typedRequirements?.likelyUpgrades ?? [];
  const niceToHave = primaryOption?.typedRequirements?.niceToHave ?? [];

  const systemLabel = primaryOption
    ? OPTION_LABEL[primaryOption.id] ?? primaryOption.label
    : SYSTEM_CHOICE_LABEL[proposed.systemChoice] ?? 'recommended system';

  const isAshpRecommended =
    primaryOption?.id === 'ashp' || proposed.systemChoice === 'heat_pump';
  const hasStoredCylinder =
    proposed.systemChoice === 'unvented' || proposed.systemChoice === 'open_vented';

  // If the engine provided pathway plans, use the first pathway to seed Essential,
  // second for Best Advice, and third for Future Potential.
  if (plans?.pathways && plans.pathways.length > 0) {
    const sorted = [...plans.pathways].sort((a, b) => a.rank - b.rank);
    const [p0, p1, p2] = sorted;

    const essentialItems: ScopeItem[] = p0
      ? [
          { label: p0.rationale, type: 'required' as const },
          ...p0.prerequisites.map((pr): ScopeItem => ({ label: pr.description, type: 'required' })),
        ].filter(i => i.label).slice(0, 5)
      : [{ label: `Install ${systemLabel}`, type: 'required' }];

    const bestAdviceItems: ScopeItem[] = p1
      ? [
          { label: p1.rationale, type: 'upgrade' as const, selectable: true },
          ...p1.prerequisites.map((pr): ScopeItem => ({ label: pr.description, type: 'upgrade', selectable: true })),
        ].filter(i => i.label).slice(0, 5)
      : [];

    const futurePotentialItems: ScopeItem[] = p2
      ? [
          { label: p2.rationale, type: 'future' as const },
          ...p2.prerequisites.map((pr): ScopeItem => ({ label: pr.description, type: 'future' })),
        ].filter(i => i.label).slice(0, 5)
      : [];

    return {
      essential: { title: 'Essential', items: essentialItems },
      bestAdvice: bestAdviceItems.length > 0 ? { title: 'Best Advice', items: bestAdviceItems } : undefined,
      futurePotential: futurePotentialItems.length > 0 ? { title: 'Future Potential', items: futurePotentialItems } : undefined,
    };
  }

  // Essential — mandatory works for the recommended system.
  const essentialItems: ScopeItem[] = [
    { label: `Install ${systemLabel}`, type: 'required' as const },
    ...mustHave.slice(0, 4).map((m): ScopeItem => ({ label: m, type: 'required' })),
  ].slice(0, 5);

  // Best Advice — high-impact upgrades to do during install.
  const bestAdviceItems: ScopeItem[] = likelyUpgrades
    .filter(u => !ENHANCED_UPGRADE_PATTERN.test(u))
    .slice(0, 3)
    .map((u): ScopeItem => ({ label: u, type: 'upgrade', selectable: true }));

  // Ensure smart controls are surfaced if not already present.
  if (!bestAdviceItems.some(i => /control|thermostat|weather|compensat/i.test(i.label))) {
    bestAdviceItems.push({ label: 'Smart controls and weather compensation', type: 'upgrade', selectable: true });
  }

  // Suggest Mixergy for stored-cylinder systems (boiler + cylinder upgrade path).
  if (hasStoredCylinder && !isAshpRecommended) {
    if (!bestAdviceItems.some(i => /mixergy/i.test(i.label))) {
      bestAdviceItems.push({
        label: 'Mixergy cylinder — stored hot water with top-down heating and active stratification',
        type: 'upgrade',
        selectable: true,
      });
    }
  }

  // Enhanced — optional lifestyle / investment upgrades.
  const enhancedFromNiceToHave: ScopeItem[] = niceToHave
    .filter(n => ENHANCED_UPGRADE_PATTERN.test(n))
    .slice(0, 2)
    .map((n): ScopeItem => ({ label: n, type: 'optional' }));

  const enhancedItems: ScopeItem[] = [...enhancedFromNiceToHave];
  if (!enhancedItems.some(i => /solar\s+pv|photovoltaic/i.test(i.label))) {
    enhancedItems.push({ label: 'Solar PV system', type: 'optional' });
  }
  if (!enhancedItems.some(i => /battery/i.test(i.label))) {
    enhancedItems.push({ label: 'Battery storage', type: 'optional' });
  }
  if (!enhancedItems.some(i => /divert|smart\s+immer/i.test(i.label))) {
    enhancedItems.push({ label: 'Solar diverter / smart immersion', type: 'optional' });
  }

  // Future Potential — ASHP pathway only when not currently recommended.
  const futurePotentialItems: ScopeItem[] = [];

  if (!isAshpRecommended) {
    futurePotentialItems.push(
      { label: 'A heat pump system could be installed in future, but would require:', type: 'future' },
      { label: 'Upgraded primary pipework (28 mm minimum)', type: 'future' },
      { label: 'Emitter review for low-temperature operation', type: 'future' },
      { label: 'Flow temperature reduction to 55 °C or below', type: 'future' },
    );

    // Note the staged approach when proposing boiler + cylinder before ASHP.
    const currentIsBoiler = current.systemChoice !== 'heat_pump';
    if (hasStoredCylinder && currentIsBoiler) {
      futurePotentialItems.push({ label: 'Smart tariff compatibility for staged electrification', type: 'future' });
    }
  }

  return {
    essential: { title: 'Essential', items: essentialItems },
    bestAdvice: bestAdviceItems.length > 0 ? { title: 'Best Advice', items: bestAdviceItems.slice(0, 5) } : undefined,
    enhanced: enhancedItems.length > 0 ? { title: 'Enhanced', items: enhancedItems.slice(0, 5) } : undefined,
    futurePotential: futurePotentialItems.length > 0 ? { title: 'Future Potential', items: futurePotentialItems.slice(0, 5) } : undefined,
  };
}

// ─── Confidence summary ───────────────────────────────────────────────────────

function buildConfidenceSummary(
  output: EngineOutputV1,
  surveyData?: FullSurveyModelV1,
): ConfidenceSummary {
  // Build the canonical unified confidence using measured/physics/decision model.
  const engineInput = surveyData ? toEngineInput(surveyData) : undefined;
  const unified = buildUnifiedConfidence(output, engineInput);

  // Surface the legacy reasons list from the verdict for backward compatibility.
  const reasons = output.verdict?.confidence?.reasons ?? [];

  return {
    level:   unified.level,
    pct:     unified.overallPct,
    reasons,
    unified,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build the full AdviceFromCompareResult from compare/simulator truth.
 *
 * All outputs are deterministic — same input always produces same output.
 * No Math.random() or arbitrary smoothing.
 *
 * @param input - Survey data, engine output, compare seed, and optional system states.
 * @returns Full advice result including bestOverall, byObjective, installationRecipe,
 *          recommendationScope, confidenceSummary, and floorplanInsights when a reliable
 *          floor plan was supplied.
 */
export function buildAdviceFromCompare(
  input: AdviceFromCompareInput,
): AdviceFromCompareResult {
  const { engineOutput, compareSeed, surveyData, floorplanInputs } = input;
  const options = engineOutput.options ?? [];

  // Derive system states from compare seed when not explicitly provided.
  const current: SimulatorSystemState =
    input.currentSystemState ?? stateFromCompareSeed(compareSeed.left);
  const proposed: SimulatorSystemState =
    input.proposedSystemState ?? stateFromCompareSeed(compareSeed.right);

  // Primary recommendation option.
  const primaryOption = options.find(o => o.status === 'viable') ?? options[0] ?? null;

  // Confidence — use unified model driven by measured data, physics, and decision separation.
  const confidenceSummary = buildConfidenceSummary(engineOutput, surveyData);
  const confidencePct = confidenceSummary.pct;

  // ── Floor-plan insights ──────────────────────────────────────────────────
  // When a reliable floor plan is present, derive insights and boost confidence.
  const fp = floorplanInputs?.isReliable === true ? floorplanInputs : null;

  // When floor-plan emitter adequacy is available, run the heating operating
  // state model to capture the floor-plan-sourced explanation tags.
  const fpAdequacy = fp?.wholeSystemEmitterAdequacy;
  const fpOperatingState = fpAdequacy?.hasActualData
    ? buildHeatingOperatingState({
        flowTempC: 70,
        floorplanEmitterAdequacy: fpAdequacy,
        heatLossWatts: surveyData.heatLossWatts,
      })
    : null;

  // Explanation tags that were added specifically because of floor-plan data.
  const emitterExplanationTags =
    fpOperatingState?.explanationTags.filter((t) => FLOOR_PLAN_EMITTER_EXPLANATION_TAGS.has(t)) ?? [];

  const floorplanInsights: FloorplanInsights | null = fp
    ? {
        refinedHeatLossKw: fp.refinedHeatLossKw,
        emitterReviewRooms: fp.emitterAdequacyHints
          .filter((h) => h.status === 'review_recommended' || h.status === 'undersized' || h.status === 'oversized')
          .map((h) => h.roomName),
        sitingWarnings: fp.sitingConstraintHints.flatMap((h) => h.warningMessages),
        pipeLengthEstimateM: fp.pipeLengthEstimateHints.totalEstimateM,
        heatLossRefined: fp.refinedHeatLossKw > 0,
        coverageClassification: fpAdequacy?.hasActualData
          ? fpAdequacy.coverageClassification
          : null,
        undersizedRooms: fpAdequacy?.undersizedRooms ?? [],
        oversizedRooms: fpAdequacy?.oversizedRooms ?? [],
        operatingTempInfluenced:
          fpAdequacy?.hasActualData === true &&
          fpAdequacy.impliedOversizingFactor !== null &&
          fpAdequacy.impliedOversizingFactor !== 1.0,
        emitterExplanationTags,
      }
    : null;

  // ── Compare wins (add floor-plan signals when available) ─────────────────
  const overallWins = deriveCompareWins(current, proposed, primaryOption);
  if (fp && fp.sitingConstraintHints.some((h) => h.hasWarning)) {
    overallWins.push('siting constraints detected from floor plan — see placement notes');
  }
  if (fp && fp.emitterAdequacyHints.some((h) => h.status === 'review_recommended' || h.status === 'undersized' || h.status === 'oversized')) {
    overallWins.push('emitter adequacy informed by room layout — see installation notes');
  }

  const bestOverall: AdviceCard = {
    id: 'best_overall',
    icon: '🎯',
    title: 'Best all-round fit',
    recommendedPathLabel: engineOutput.recommendation.primary,
    why: [
      engineOutput.verdict?.primaryReason ??
        engineOutput.verdict?.reasons[0] ??
        primaryOption?.why[0] ??
        'Best match for this home\'s constraints and demand profile.',
    ],
    keyTradeOff: tradeOffNote(primaryOption),
    confidencePct,
    performanceSummary: derivePerformanceSummary(proposed, primaryOption),
    compareWins: overallWins,
  };

  // ── Installation recipe — append siting/emitter notes from floor plan ────
  const baseRecipe = buildInstallationRecipe(primaryOption, proposed);
  const recipe: InstallationRecipe = fp
    ? applyFloorplanToRecipe(baseRecipe, fp)
    : baseRecipe;

  // ── Recommendation scope — add siting/emitter actions when floor plan reveals issues ─
  const baseScope = buildRecommendationScope(primaryOption, proposed, current, engineOutput.plans);
  const recommendationScope: RecommendationScope = fp
    ? applyFloorplanToRecommendationScope(baseScope, fp)
    : baseScope;

  return {
    bestOverall,
    byObjective: {
      lowestRunningCost: buildRunningCostCard(options, proposed, current, confidencePct),
      lowestInstallationCost: buildInstallCostCard(options, proposed, current, confidencePct),
      greatestLongevity: buildLongevityCard(options, proposed, current, confidencePct),
      lowestCarbonPointOfUse: buildCarbonCard(options, proposed, current, confidencePct),
      greatestComfortAndDelivery: buildComfortCard(options, proposed, current, confidencePct),
      measuredForwardThinkingPlan: buildFutureReadyCard(
        options, proposed, current, confidencePct, engineOutput.plans,
      ),
    },
    installationRecipe: recipe,
    recommendationScope,
    confidenceSummary,
    floorplanInsights,
  };
}

// ─── Floor-plan recipe / plan helpers ────────────────────────────────────────

/** Maximum number of room names to include in a single floor-plan message. */
const MAX_ROOMS_IN_MESSAGE = 3;

/**
 * Merge floor-plan emitter and siting notes into the installation recipe.
 * Only adds notes that aren't already present; caps list length to avoid bloat.
 */
function applyFloorplanToRecipe(
  base: InstallationRecipe,
  fp: AtlasFloorplanInputs,
): InstallationRecipe {
  const emitters = [...base.emitters];
  const undersizedRooms = fp.emitterAdequacyHints
    .filter((h) => h.status === 'undersized')
    .map((h) => h.roomName);
  const oversizedRooms = fp.emitterAdequacyHints
    .filter((h) => h.status === 'oversized')
    .map((h) => h.roomName);
  const reviewRooms = fp.emitterAdequacyHints
    .filter((h) => h.status === 'review_recommended')
    .map((h) => h.roomName);
  if (undersizedRooms.length > 0) {
    emitters.push(
      `Undersized emitters in: ${undersizedRooms.slice(0, MAX_ROOMS_IN_MESSAGE).join(', ')} — upgrade required (floor plan derived)`,
    );
  }
  if (oversizedRooms.length > 0) {
    emitters.push(
      `Oversized emitters in: ${oversizedRooms.slice(0, MAX_ROOMS_IN_MESSAGE).join(', ')} — review for efficiency (floor plan derived)`,
    );
  }
  if (reviewRooms.length > 0) {
    emitters.push(
      `Review emitter sizing in: ${reviewRooms.slice(0, MAX_ROOMS_IN_MESSAGE).join(', ')} (floor plan derived)`,
    );
  }

  const primaryPipework = [...base.primaryPipework];
  if (fp.pipeLengthEstimateHints.totalEstimateM > 0) {
    primaryPipework.push(fp.pipeLengthEstimateHints.label);
  }

  const protectionAndAncillaries = [...base.protectionAndAncillaries];
  const sitingWarnings = fp.sitingConstraintHints.flatMap((h) => h.warningMessages);
  if (sitingWarnings.length > 0) {
    // Surface at most 2 siting notes in the recipe.
    sitingWarnings.slice(0, 2).forEach((msg) => {
      protectionAndAncillaries.push(`Siting: ${msg}`);
    });
  }

  return {
    ...base,
    emitters: emitters.slice(0, 5),
    primaryPipework: primaryPipework.slice(0, 5),
    protectionAndAncillaries: protectionAndAncillaries.slice(0, 5),
  };
}

/**
 * Add floor-plan derived siting and emitter actions into the recommendation scope.
 * Siting issues go into Essential (must resolve before installation);
 * emitter review notes go into Best Advice (do during install round).
 */
function applyFloorplanToRecommendationScope(
  base: RecommendationScope,
  fp: AtlasFloorplanInputs,
): RecommendationScope {
  const essentialItems = [...base.essential.items];
  const bestAdviceItems = [...(base.bestAdvice?.items ?? [])];

  const sitingWarnings = fp.sitingConstraintHints
    .filter((h) => h.hasWarning)
    .flatMap((h) => h.warningMessages);

  sitingWarnings.slice(0, 2).forEach((msg) => {
    essentialItems.push({ label: `Resolve siting issue: ${msg}`, type: 'required' });
  });

  const undersizedRooms = fp.emitterAdequacyHints
    .filter((h) => h.status === 'undersized')
    .map((h) => h.roomName);
  if (undersizedRooms.length > 0) {
    essentialItems.push({
      label: `Upgrade undersized emitters in: ${undersizedRooms.slice(0, MAX_ROOMS_IN_MESSAGE).join(', ')}`,
      type: 'required',
    });
  }

  const reviewRooms = fp.emitterAdequacyHints
    .filter((h) => h.status === 'review_recommended')
    .map((h) => h.roomName);
  if (reviewRooms.length > 0) {
    bestAdviceItems.push({
      label: `Confirm emitter capacity in: ${reviewRooms.slice(0, MAX_ROOMS_IN_MESSAGE).join(', ')}`,
      type: 'upgrade',
    });
  }

  const oversizedRooms = fp.emitterAdequacyHints
    .filter((h) => h.status === 'oversized')
    .map((h) => h.roomName);
  if (oversizedRooms.length > 0) {
    bestAdviceItems.push({
      label: `Review oversized emitters in: ${oversizedRooms.slice(0, MAX_ROOMS_IN_MESSAGE).join(', ')}`,
      type: 'upgrade',
    });
  }

  return {
    ...base,
    essential: {
      ...base.essential,
      items: essentialItems.slice(0, 7),
    },
    bestAdvice: bestAdviceItems.length > 0
      ? { title: 'Best Advice', items: bestAdviceItems.slice(0, 7) }
      : base.bestAdvice,
  };
}

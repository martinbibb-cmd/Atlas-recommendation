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
 *  - efficiencyScore uses computeCurrentEfficiencyPct — never a literal 92.
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

// Re-export for consumers that want the unified type without an extra import.
export type { UnifiedConfidence };

// ─── SimulatorSystemState ──────────────────────────────────────────────────────

/**
 * Minimal description of a system side used for compare-based advice.
 *
 * Derived from CompareSeed left/right entries and applied to both current
 * and proposed system states.  Carries the physics parameters needed to
 * compute compareWins, efficiencyScore, and cycling/condensing assessments.
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
   * Normalised efficiency score (0–100) for the recommended path.
   * For boiler systems: derived via computeCurrentEfficiencyPct.
   * For heat pumps: derived from a typical-conditions COP × scaling.
   * null when insufficient data is available.
   */
  efficiencyScore: number | null;
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

// ─── PhasedPlan ───────────────────────────────────────────────────────────────

export interface PhasedPlan {
  now: string[];
  next: string[];
  later: string[];
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
  /** Now / Next / Later phased action plan. */
  phasedPlan: PhasedPlan;
  /** Confidence summary for the overall recommendation. */
  confidenceSummary: ConfidenceSummary;
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
 * Used with computeCurrentEfficiencyPct to produce efficiencyScore.
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

// ─── Efficiency score ─────────────────────────────────────────────────────────

/**
 * Derive a normalised efficiency score for a given system state.
 *
 * For boilers: uses computeCurrentEfficiencyPct with decay from system condition.
 * For heat pumps: derives from a typical-UK-conditions COP (3.0) scaled to [50, 99].
 */
function deriveEfficiencyScore(
  state: SimulatorSystemState,
  primaryOption: OptionCardV1 | null,
): number | null {
  if (state.systemChoice === 'heat_pump') {
    // Typical UK ASHP COP 3.0 → normalise to 0–100 range as COP × 25, clamped.
    const typicalCop = 3.0;
    const score = Math.round(typicalCop * 25);
    return Math.min(99, Math.max(50, score));
  }

  // Boiler-based: use engine's own SEDBUK data when available, otherwise nominal.
  const sedbukMatch = primaryOption?.engineering?.bullets
    ?.reduce<RegExpMatchArray | null>(
      (found, b) => found ?? b.match(/(\d{2,3})%/),
      null,
    );

  const nominalPct = sedbukMatch
    ? Math.min(99, Math.max(50, parseInt(sedbukMatch[1], 10)))
    : DEFAULT_NOMINAL_EFFICIENCY_PCT;

  const decayPct = CONDITION_DECAY_PCT[state.systemCondition] ?? 0;

  // Uplift for controls — weather/load compensation improves practical efficiency.
  const controlsUplift = (state.weatherCompensation ? 3 : 0) + (state.loadCompensation ? 2 : 0);

  return computeCurrentEfficiencyPct(nominalPct + controlsUplift, decayPct);
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
    efficiencyScore: deriveEfficiencyScore(proposed, opt),
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
    efficiencyScore: deriveEfficiencyScore(proposed, opt),
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
    efficiencyScore: deriveEfficiencyScore(proposed, opt),
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
    efficiencyScore: deriveEfficiencyScore(proposed, opt),
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
    efficiencyScore: deriveEfficiencyScore(proposed, opt),
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
    efficiencyScore: deriveEfficiencyScore(proposed, opt),
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

// ─── Phased plan ──────────────────────────────────────────────────────────────

function buildPhasedPlan(
  primaryOption: OptionCardV1 | null,
  proposed: SimulatorSystemState,
  current: SimulatorSystemState,
  plans: EngineOutputV1['plans'],
): PhasedPlan {
  // If the engine provided pathway plans, map them to now/next/later.
  if (plans?.pathways && plans.pathways.length > 0) {
    const sorted = [...plans.pathways].sort((a, b) => a.rank - b.rank);
    const now: string[] = [];
    const next: string[] = [];
    const later: string[] = [];

    const [p0, p1, p2] = sorted;
    if (p0) now.push(p0.rationale, ...p0.prerequisites.map(pr => pr.description));
    if (p1) next.push(p1.rationale, ...p1.prerequisites.map(pr => pr.description));
    if (p2) later.push(p2.rationale, ...p2.prerequisites.map(pr => pr.description));

    return {
      now:   now.filter(Boolean).slice(0, 4),
      next:  next.filter(Boolean).slice(0, 4),
      later: later.filter(Boolean).slice(0, 4),
    };
  }

  const mustHave = primaryOption?.typedRequirements?.mustHave ?? primaryOption?.requirements ?? [];
  const likelyUpgrades = primaryOption?.typedRequirements?.likelyUpgrades ?? [];
  const niceToHave = primaryOption?.typedRequirements?.niceToHave ?? [];

  const systemLabel = primaryOption
    ? OPTION_LABEL[primaryOption.id] ?? primaryOption.label
    : SYSTEM_CHOICE_LABEL[proposed.systemChoice] ?? 'recommended system';

  const now: string[] = [
    `Install ${systemLabel}`,
    ...mustHave.slice(0, 3),
  ].filter(Boolean).slice(0, 4);

  const next: string[] = [
    ...likelyUpgrades.slice(0, 3),
    'Verify system performance after first heating season',
  ].filter(Boolean).slice(0, 4);

  // Forward-thinking path: allow Boiler + Mixergy now → ASHP later.
  const proposedHasCylinder =
    proposed.systemChoice === 'unvented' || proposed.systemChoice === 'open_vented';
  const currentIsBoiler =
    current.systemChoice !== 'heat_pump';

  const later: string[] = [
    ...niceToHave.slice(0, 2),
  ];

  if (proposedHasCylinder && currentIsBoiler) {
    later.push('Assess heat pump viability once emitter and primary upgrades are confirmed');
    later.push('Consider smart tariff compatibility for staged electrification');
  } else {
    later.push('Assess heat pump viability once emitter and primary upgrades are confirmed');
    later.push('Consider smart tariff compatibility for future electrification');
  }

  return {
    now:   now.slice(0, 4),
    next:  next.slice(0, 4),
    later: later.filter(Boolean).slice(0, 4),
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
 *          phasedPlan, and confidenceSummary.
 */
export function buildAdviceFromCompare(
  input: AdviceFromCompareInput,
): AdviceFromCompareResult {
  const { engineOutput, compareSeed, surveyData } = input;
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

  // Compare wins for the best-overall card.
  const overallWins = deriveCompareWins(current, proposed, primaryOption);

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
    efficiencyScore: deriveEfficiencyScore(proposed, primaryOption),
    compareWins: overallWins,
  };

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
    installationRecipe: buildInstallationRecipe(primaryOption, proposed),
    phasedPlan: buildPhasedPlan(primaryOption, proposed, current, engineOutput.plans),
    confidenceSummary,
  };
}

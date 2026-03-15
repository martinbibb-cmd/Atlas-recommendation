/**
 * buildAdviceCards
 *
 * Derives the DecisionSynthesisPage content from EngineOutputV1.
 *
 * Rules:
 *  - All copy is derived from engine truth — no hardcoded scenarios.
 *  - Carbon wording is always "at point of use" — never implies grid-carbon
 *    optimisation unless that data has been added.
 *  - "Greatest performance" means comfort/delivery/recovery, not "High performance"
 *    (see docs/atlas-terminology.md §8).
 */

import type {
  EngineOutputV1,
  OptionCardV1,
} from '../../contracts/EngineOutputV1';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ObjectiveCard {
  /** Stable identifier for this objective. */
  id: string;
  /** Emoji icon for the card header. */
  icon: string;
  /** Short objective title. */
  title: string;
  /** Recommended system path for this objective. */
  systemPath: string;
  /** One-line rationale. */
  why: string;
  /** Up to 4 key inclusions / installation requirements. */
  keyInclusions: string[];
  /** The main thing you give up when optimising for this objective. */
  tradeOff: string | null;
}

export interface InstallationRecipe {
  heatSource: string;
  dhwArrangement: string;
  controls: string[];
  emitterAction: string[];
  primaryAction: string | null;
  protection: string[];
}

export interface PhasedStep {
  phase: 'now' | 'next' | 'later';
  label: string;
  actions: string[];
}

export interface TradeOffWarning {
  id: string;
  text: string;
}

export interface AdviceResult {
  /** One clear all-round recommendation. */
  bestAllRound: {
    systemPath: string;
    why: string;
    confidence: 'high' | 'medium' | 'low' | null;
  };
  /** Six objective-specific cards. */
  objectiveCards: ObjectiveCard[];
  /** Installation requirements for the recommended path. */
  installationRecipe: InstallationRecipe;
  /** Now / Next / Later phased actions. */
  phasedPlan: PhasedStep[];
  /** Plain-English trade-off warnings. */
  tradeOffWarnings: TradeOffWarning[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const OPTION_LABEL: Record<string, string> = {
  combi:           'Combi boiler',
  stored_vented:   'Open-vented cylinder system',
  stored_unvented: 'Unvented cylinder system',
  ashp:            'Air source heat pump',
  regular_vented:  'Regular boiler with open-vented cylinder',
  system_unvented: 'System boiler with unvented cylinder',
};

/** Pick the first non-rejected option from the priority list, or fall back to
 *  the first viable option, or the first option overall. */
function pickBest(
  options: OptionCardV1[],
  priority: string[],
): OptionCardV1 | null {
  for (const id of priority) {
    const opt = options.find(o => o.id === id && o.status !== 'rejected');
    if (opt) return opt;
  }
  return options.find(o => o.status === 'viable') ?? options[0] ?? null;
}

function labelOf(opt: OptionCardV1 | null): string {
  if (!opt) return 'Boiler system';
  return OPTION_LABEL[opt.id] ?? opt.label;
}

/** Extract up to N items from typed requirements, de-duplicating. */
function topRequirements(opt: OptionCardV1 | null, max = 4): string[] {
  if (!opt) return [];
  const items = [
    ...(opt.typedRequirements?.mustHave ?? opt.requirements ?? []),
    ...(opt.typedRequirements?.likelyUpgrades ?? []),
  ];
  return [...new Set(items)].slice(0, max);
}

/** Pull the best downgrade sensitivity note or a caution plane headline. */
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

function buildRunningCostCard(options: OptionCardV1[]): ObjectiveCard {
  // ASHP has the lowest energy cost when viable (COP advantage).
  // Otherwise best condensing stored/system, then combi.
  const priority = ['ashp', 'system_unvented', 'stored_unvented', 'combi', 'stored_vented', 'regular_vented'];
  const opt = pickBest(options, priority);
  const isAshp = opt?.id === 'ashp';
  return {
    id: 'running_cost',
    icon: '💷',
    title: 'Lowest running cost',
    systemPath: labelOf(opt),
    why: isAshp
      ? 'Heat pump delivers 3–4 units of heat per unit of electricity at suitable flow temperatures.'
      : 'Best condensing efficiency reduces fuel consumption at part-load and design-point.',
    keyInclusions: topRequirements(opt),
    tradeOff: isAshp
      ? 'Higher installation cost; requires lower flow temperatures and sufficient emitter area.'
      : tradeOffNote(opt),
  };
}

function buildInstallCostCard(options: OptionCardV1[]): ObjectiveCard {
  // Combi is the simplest/cheapest install — no cylinder, no buffer.
  // If combi rejected, regular_vented next, then stored options, then ashp.
  const priority = ['combi', 'regular_vented', 'stored_vented', 'stored_unvented', 'system_unvented', 'ashp'];
  const opt = pickBest(options, priority);
  const isCombi = opt?.id === 'combi';
  return {
    id: 'install_cost',
    icon: '🔧',
    title: 'Lowest installation cost',
    systemPath: labelOf(opt),
    why: isCombi
      ? 'No cylinder, no additional zone valves or buffer vessel. Minimal pipework change.'
      : 'Reuses existing cylinder position and most current pipework.',
    keyInclusions: topRequirements(opt),
    tradeOff: isCombi
      ? 'Limited simultaneous hot-water flow; CH lockout during large draw-offs.'
      : tradeOffNote(opt),
  };
}

function buildLongevityCard(options: OptionCardV1[]): ObjectiveCard {
  // Stored systems cycle less and avoid DHW strain on the main heat exchanger.
  // ASHP with a cylinder also excels here — slow cycling, low thermal stress.
  const priority = ['stored_unvented', 'system_unvented', 'ashp', 'stored_vented', 'regular_vented', 'combi'];
  const opt = pickBest(options, priority);
  const isStored = opt && ['stored_unvented', 'stored_vented', 'system_unvented', 'regular_vented'].includes(opt.id);
  return {
    id: 'longevity',
    icon: '⏳',
    title: 'Greatest longevity',
    systemPath: labelOf(opt),
    why: isStored
      ? 'Decoupled zones reduce cycling frequency. Proper water treatment eliminates scale and sludge degradation.'
      : 'Low cycling rate and slow thermal transitions reduce component wear.',
    keyInclusions: [
      ...(topRequirements(opt, 2)),
      'Magnetic filter on primary circuit',
      'System flush and inhibitor charge',
    ].slice(0, 4),
    tradeOff: tradeOffNote(opt) ??
      'Higher upfront cost for cylinder and zone-valve controls.',
  };
}

function buildCarbonCard(options: OptionCardV1[]): ObjectiveCard {
  // ASHP = zero combustion at point of use.
  // If not viable, best condensing boiler.
  const priority = ['ashp', 'system_unvented', 'stored_unvented', 'stored_vented', 'regular_vented', 'combi'];
  const opt = pickBest(options, priority);
  const isAshp = opt?.id === 'ashp';
  return {
    id: 'carbon',
    icon: '🌿',
    title: 'Lowest carbon at point of use',
    systemPath: labelOf(opt),
    why: isAshp
      ? 'No on-site combustion. At point of use, zero direct carbon emissions.'
      : 'Highest seasonal condensing efficiency minimises gas consumption and direct carbon output.',
    keyInclusions: topRequirements(opt),
    tradeOff: isAshp
      ? 'Carbon benefit depends on grid mix at point of use — not included in this calculation.'
      : 'Gas combustion still produces CO₂ at point of use; carbon benefit is efficiency-only.',
  };
}

function buildPerformanceCard(options: OptionCardV1[]): ObjectiveCard {
  // Best comfort = mains-pressure stored hot water, no CH lockout, fast recovery.
  const priority = ['stored_unvented', 'system_unvented', 'ashp', 'stored_vented', 'regular_vented', 'combi'];
  const opt = pickBest(options, priority);
  const isUnvented = opt?.id === 'stored_unvented' || opt?.id === 'system_unvented';
  return {
    id: 'performance',
    icon: '🚿',
    title: 'Greatest comfort and delivery',
    systemPath: labelOf(opt),
    why: isUnvented
      ? 'Mains-pressure hot water throughout. No CH lockout during draw-off. Fast reheat recovery.'
      : 'Dedicated cylinder decouples hot water from space heating — no simultaneous-use compromise.',
    keyInclusions: topRequirements(opt),
    tradeOff: isUnvented
      ? 'Requires adequate mains pressure and discharge pipe (G3 safety).'
      : tradeOffNote(opt),
  };
}

function buildFutureReadyCard(
  options: OptionCardV1[],
  plans: EngineOutputV1['plans'],
): ObjectiveCard {
  // Future-ready = preserves heat pump optionality.
  // Best path: stored_unvented or system_unvented (cylinder already sized/sited),
  // with quality controls and emitter headroom.
  // If plans.pathways exist, use the top-ranked pathway title.
  const priority = ['stored_unvented', 'system_unvented', 'stored_vented', 'ashp', 'regular_vented', 'combi'];
  const opt = pickBest(options, priority);

  const topPathway = plans?.pathways
    ?.slice()
    .sort((a, b) => a.rank - b.rank)[0];

  return {
    id: 'future_ready',
    icon: '🌳',
    title: 'Measured forward-thinking plan',
    systemPath: topPathway?.title ?? labelOf(opt),
    why: topPathway?.rationale ??
      'Install a system that does not foreclose the heat pump upgrade path. ' +
      'Size the cylinder space now; upgrade controls and emitters in stages.',
    keyInclusions: [
      ...(topRequirements(opt, 2)),
      'Weather-compensation or load-compensation controls',
      'Cylinder space sized for heat pump volume (150–200 L minimum)',
    ].slice(0, 4),
    tradeOff: 'May not be the lowest upfront cost — it prioritises flexibility over short-term saving.',
  };
}

// ─── Installation recipe ──────────────────────────────────────────────────────

function buildInstallationRecipe(
  primary: OptionCardV1 | null,
): InstallationRecipe {
  const mustHave = primary?.typedRequirements?.mustHave ?? primary?.requirements ?? [];
  const likelyUpgrades = primary?.typedRequirements?.likelyUpgrades ?? [];
  const niceToHave = primary?.typedRequirements?.niceToHave ?? [];

  // Derive each recipe section from engine-provided requirements where possible.
  const heatSource = primary ? OPTION_LABEL[primary.id] ?? primary.label : 'To be determined';

  const dhwBullets = primary?.dhw?.bullets ?? [];
  const dhwArrangement = dhwBullets[0] ?? (
    primary?.id === 'combi'
      ? 'On-demand hot water via plate heat exchanger — no cylinder'
      : 'Dedicated hot water cylinder (size from occupancy and bathroom count)'
  );

  // Controls from must-haves/nice-to-haves that mention "control" or "compensation"
  const controls = [
    ...mustHave.filter(r => /control|compensat|thermostat|programmer|zone/i.test(r)),
    ...niceToHave.filter(r => /control|compensat|thermostat|programmer|zone/i.test(r)),
    ...likelyUpgrades.filter(r => /control|compensat|thermostat|programmer|zone/i.test(r)),
  ].slice(0, 4);
  if (controls.length === 0) controls.push('Room thermostat and TRVs as a minimum');

  // Emitter action from heat plane bullets
  const heatBullets = primary?.heat?.bullets ?? [];
  const emitterAction = heatBullets.length > 0
    ? heatBullets.slice(0, 2)
    : ['Check radiator output matches heat loss at target flow temperature'];

  // Primary sizing from engineering plane or requirements
  const engBullets = primary?.engineering?.bullets ?? [];
  const primaryAction = mustHave.find(r => /primary|pipe|22\s?mm|28\s?mm/i.test(r))
    ?? engBullets.find(b => /primary|pipe/i.test(b))
    ?? null;

  // Protection and treatment
  const protection = [
    ...mustHave.filter(r => /filter|inhibitor|flush|treatment|chemical|TDS|silicate/i.test(r)),
    ...likelyUpgrades.filter(r => /filter|inhibitor|flush|treatment|chemical/i.test(r)),
  ].slice(0, 3);
  if (protection.length === 0) {
    protection.push('Magnetic filter on primary return');
    protection.push('System flush before installation');
  }

  return {
    heatSource,
    dhwArrangement,
    controls,
    emitterAction,
    primaryAction,
    protection,
  };
}

// ─── Phased plan ──────────────────────────────────────────────────────────────

function buildPhasedPlan(
  primary: OptionCardV1 | null,
  plans: EngineOutputV1['plans'],
): PhasedStep[] {
  // If the engine provided pathway plans, map them to now/next/later phases.
  if (plans?.pathways && plans.pathways.length > 0) {
    const sorted = [...plans.pathways].sort((a, b) => a.rank - b.rank);
    const phases: Array<'now' | 'next' | 'later'> = ['now', 'next', 'later'];
    return sorted.slice(0, 3).map((p, i) => ({
      phase: phases[i],
      label: p.title,
      actions: [
        p.rationale,
        ...(p.prerequisites.map(pr => pr.description)),
      ].filter(Boolean).slice(0, 4),
    }));
  }

  // Derive from options when no engine pathways are available.
  const mustHave = primary?.typedRequirements?.mustHave ?? primary?.requirements ?? [];
  const likelyUpgrades = primary?.typedRequirements?.likelyUpgrades ?? [];
  const niceToHave = primary?.typedRequirements?.niceToHave ?? [];

  const nowActions = [
    primary ? `Install ${OPTION_LABEL[primary.id] ?? primary.label}` : 'Install recommended heat source',
    ...mustHave.slice(0, 3),
  ].filter(Boolean).slice(0, 4);

  const nextActions = [
    ...likelyUpgrades.slice(0, 3),
    'Verify system performance after first heating season',
  ].filter(Boolean).slice(0, 4);

  const laterActions = [
    ...niceToHave.slice(0, 2),
    'Assess heat pump viability once emitter and primary upgrades are confirmed',
    'Consider smart tariff compatibility for future electrification',
  ].filter(Boolean).slice(0, 4);

  return [
    { phase: 'now',   label: 'Immediate installation',    actions: nowActions },
    { phase: 'next',  label: 'First improvement round',   actions: nextActions },
    { phase: 'later', label: 'Future upgrade path',       actions: laterActions },
  ];
}

// ─── Trade-off warnings ───────────────────────────────────────────────────────

function buildTradeOffWarnings(
  options: OptionCardV1[],
  primary: OptionCardV1 | null,
): TradeOffWarning[] {
  const warnings: TradeOffWarning[] = [];

  const combiOpt = options.find(o => o.id === 'combi');
  const ashpOpt  = options.find(o => o.id === 'ashp');

  // Combi is cheapest to install but costs more to run vs stored with good condensing
  if (combiOpt && combiOpt.status !== 'rejected' && primary?.id !== 'combi') {
    warnings.push({
      id: 'combi_cheaper_upfront',
      text: 'A combi boiler is cheaper to install, but gives less hot-water capacity and higher cycling losses over time.',
    });
  }

  // ASHP: best long-term running cost, but highest disruption
  if (ashpOpt && ashpOpt.status === 'viable' && primary?.id !== 'ashp') {
    warnings.push({
      id: 'ashp_future_cost',
      text: 'A heat pump offers the lowest long-term running cost, but requires emitter upgrades and higher upfront investment.',
    });
  }

  // If ASHP is caution, note the barrier
  if (ashpOpt?.status === 'caution') {
    const barrier = ashpOpt.heat?.headline ?? ashpOpt.engineering?.headline;
    if (barrier) {
      warnings.push({
        id: 'ashp_barrier',
        text: `Heat pump is possible with upgrades: ${barrier}`,
      });
    }
  }

  // Best performance but more disruption
  if (primary?.id === 'stored_unvented' || primary?.id === 'system_unvented') {
    warnings.push({
      id: 'unvented_disruption',
      text: 'Unvented cylinder gives the best hot-water delivery, but needs adequate mains pressure and a qualified G3 installer.',
    });
  }

  return warnings;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Derives the full DecisionSynthesisPage content from EngineOutputV1.
 *
 * All outputs are deterministic — same input always produces same output.
 * No Math.random() or arbitrary smoothing.
 */
export function buildAdviceCards(output: EngineOutputV1): AdviceResult {
  const options = output.options ?? [];

  // Primary recommendation
  const primaryOption = options.find(o => o.status === 'viable') ?? options[0] ?? null;
  const confidence = output.verdict?.confidence?.level
    ?? output.meta?.confidence?.level
    ?? null;

  const bestAllRound = {
    systemPath: output.recommendation.primary,
    why: output.verdict?.primaryReason
      ?? output.verdict?.reasons[0]
      ?? primaryOption?.why[0]
      ?? 'Best match for this home\'s constraints and demand profile.',
    confidence,
  };

  const objectiveCards: ObjectiveCard[] = [
    buildRunningCostCard(options),
    buildInstallCostCard(options),
    buildLongevityCard(options),
    buildCarbonCard(options),
    buildPerformanceCard(options),
    buildFutureReadyCard(options, output.plans),
  ];

  const installationRecipe = buildInstallationRecipe(primaryOption);
  const phasedPlan = buildPhasedPlan(primaryOption, output.plans);
  const tradeOffWarnings = buildTradeOffWarnings(options, primaryOption);

  return {
    bestAllRound,
    objectiveCards,
    installationRecipe,
    phasedPlan,
    tradeOffWarnings,
  };
}

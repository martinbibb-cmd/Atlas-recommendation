/**
 * buildInsightPackFromEngine.ts
 *
 * Derives an InsightPack from EngineOutputV1 and a list of QuoteInputs.
 *
 * RULES (non-negotiable):
 *   - All ratings emerge from physics — never invented.
 *   - No Math.random() or arbitrary smoothing.
 *   - Limitations map directly to engine red flags and limiter severities.
 *   - Uses DEFAULT_NOMINAL_EFFICIENCY_PCT (never the literal 92).
 *   - Terminology follows docs/atlas-terminology.md.
 */

import type { EngineOutputV1, OptionCardV1, LimiterV1, RedFlagItem } from '../../contracts/EngineOutputV1';
import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import { DEFAULT_NOMINAL_EFFICIENCY_PCT } from '../../engine/utils/efficiency';
import {
  computeRecoveryTimeMins,
  computeUsableVolumeMixedL,
  computeDailyDemandL,
  USABLE_FRACTION_STANDARD,
  USABLE_FRACTION_MIXERGY,
  DEFAULT_BOILER_STORE_TEMP_C,
  DEFAULT_HP_STORE_TEMP_C,
  DEFAULT_COLD_WATER_TEMP_C,
  DEFAULT_TAP_TARGET_TEMP_C,
} from '../../engine/modules/CylinderSizingModule';
import type {
  QuoteInput,
  InsightPack,
  QuoteInsight,
  SystemRating,
  RatingBand,
  RatingExplanation,
  SystemLimitation,
  DailyUseStatement,
  Improvement,
  BestAdvice,
  SavingsPlan,
  HomeProfileTile,
  ReasonChainStep,
  NextSteps,
  CurrentSystemSummary,
  YouWeGetTripleData,
  YouWeGetRow,
} from './insightPack.types';

// ─── Survey context ───────────────────────────────────────────────────────────

/**
 * Subset of the canonical survey / engine input needed by the Insight Pack builder.
 * Passed as an optional third argument so the pack can compare against the real
 * current system and ground advice in actual survey values.
 */
export interface InsightPackSurveyContext {
  /** Current (pre-replacement) system — from EngineInputV2_3.currentSystem.boiler. */
  currentBoiler?: {
    type?: 'combi' | 'system' | 'regular' | 'back_boiler' | 'unknown';
    ageYears?: number;
    condensing?: 'yes' | 'no' | 'unknown';
  };
  /** Occupant count — from EngineInputV2_3.occupancyCount. */
  occupancyCount?: number;
  /** Bathroom count — from EngineInputV2_3.bathroomCount. */
  bathroomCount?: number;
  /** Peak concurrent hot-water outlets — from EngineInputV2_3.peakConcurrentOutlets. */
  peakConcurrentOutlets?: number;
  /** Dynamic mains flow rate (L/min) — from EngineInputV2_3.mainsDynamicFlowLpm. */
  mainsDynamicFlowLpm?: number;
  /** Peak heat loss (Watts) — from EngineInputV2_3.heatLossWatts. */
  heatLossWatts?: number;
  /** Survey signal: high-frequency daily hot-water draw. */
  highDrawFrequency?: boolean;
  /** Survey signal: on-site solar PV present. */
  solarPVPresent?: boolean;
  /** Survey signal: plant-room/cupboard space constraints. */
  spaceRestricted?: boolean;
  /** Survey signal: existing cylinder confirmed undersized. */
  cylinderUndersizedConfirmed?: boolean;
  /** Survey signal: measured/customer-reported depletion complaints. */
  measuredDepletionComplaints?: boolean;
  /** Survey signal: time-of-use electricity tariff available. */
  timeOfUseElectricity?: boolean;
  /** Survey signal: customer intent for future heat-pump migration. */
  futureHeatPumpIntent?: boolean;
  /**
   * System condition signals — from survey SystemBuilderState.
   * Used to ground powerflush / filter recommendations in actual site evidence.
   */
  systemCondition?: {
    /** Whether sludge was observed in bleed water. */
    sludgeBleedObserved?: boolean;
    /** Whether cold radiators were reported. */
    coldRadiatorsPresent?: boolean;
    /** Whether a magnetic filter is already fitted. */
    magneticFilterFitted?: boolean;
  };
}

// ─── Current system label ─────────────────────────────────────────────────────

/**
 * Builds a human-readable label for the existing installed system from the
 * canonical survey context.  Returns undefined when no current system was recorded.
 */
function buildCurrentSystemSummary(ctx?: InsightPackSurveyContext): CurrentSystemSummary | undefined {
  const boiler = ctx?.currentBoiler;
  if (!boiler?.type || boiler.type === 'unknown') return undefined;

  const typeLabels: Record<string, string> = {
    combi:       'combination boiler',
    system:      'system boiler',
    regular:     'regular (heat-only) boiler',
    back_boiler: 'back boiler',
  };
  const typeLabel = typeLabels[boiler.type] ?? boiler.type;
  const age = boiler.ageYears ? ` (${boiler.ageYears} years old)` : '';
  const condensing = boiler.condensing === 'no' ? ' — non-condensing' :
                     boiler.condensing === 'yes' ? ' — condensing' : '';

  return {
    label: `Existing ${typeLabel}${age}${condensing}`,
    systemType: boiler.type,
  };
}

// ─── Rating helpers ───────────────────────────────────────────────────────────

function makeRating(
  rating: RatingBand,
  reason: string,
  physics: string,
): RatingExplanation {
  return { rating, reason, physics };
}

const RATING_BAND_ORDER: RatingBand[] = [
  'Excellent',
  'Very Good',
  'Good',
  'Needs Right Setup',
  'Less Suited',
];

function minRatingBand(a: RatingBand, b: RatingBand): RatingBand {
  const aIndex = RATING_BAND_ORDER.indexOf(a);
  const bIndex = RATING_BAND_ORDER.indexOf(b);
  if (aIndex < 0 || bIndex < 0) {
    throw new Error(`Invalid rating band: ${a} / ${b}`);
  }
  return RATING_BAND_ORDER[Math.max(aIndex, bIndex)];
}

function deriveSupplyConstraintBand(ctx?: InsightPackSurveyContext): RatingBand {
  if (!ctx) return 'Excellent';
  if ((ctx.bathroomCount ?? 0) >= 2 || (ctx.peakConcurrentOutlets ?? 0) >= 2) {
    return 'Needs Right Setup';
  }
  if ((ctx.mainsDynamicFlowLpm ?? Number.POSITIVE_INFINITY) < 10) {
    return 'Good';
  }
  if (ctx.occupancyCount === 3) {
    return 'Good';
  }
  return 'Excellent';
}

// ─── Hot Water Performance rating ─────────────────────────────────────────────

/**
 * Derives hot-water performance rating from DHW module outputs.
 *
 * Rating map (from engine flags, not guesswork):
 *   Excellent        → stored (system/regular/mixergy) with adequate volume for occupancy
 *   Very Good        → combi, 1 bathroom, ≤ 2 occupants, adequate mains flow
 *   Good             → combi, 1 bathroom, 3 occupants (borderline simultaneous risk)
 *   Needs Right Setup → combi, 2+ bathrooms or fail-severity DHW flags, or stored but undersized
 *   Less Suited       → combi with hard fail flags (pressure, flow, large household)
 */
function rateHotWaterPerformance(
  quote: QuoteInput,
  output: EngineOutputV1,
  ctx?: InsightPackSurveyContext,
): RatingExplanation {
  const hasStoredCylinder = quote.systemType === 'system' ||
    quote.systemType === 'regular' ||
    (quote.systemType === 'ashp' && quote.cylinder != null);

  const isMixergy = quote.cylinder?.type === 'mixergy';

  // Find the matching option card from the engine (closest system type match)
  const optionCard = findOptionCard(quote, output);

  // Check for hard fail flags on the DHW plane
  const dhwHardFail = optionCard?.dhw.status === 'na';
  const dhwCaution = optionCard?.dhw.status === 'caution';

  // Check red flags specific to hot water
  const hwRedFlags = (output.redFlags ?? []).filter(
    f => f.severity === 'fail' && (f.id.includes('combi') || f.id.includes('dhw') || f.id.includes('pressure')),
  );

  if (hasStoredCylinder) {
    let storedBand: RatingBand = 'Excellent';
    let storedReason =
      'Stored hot water handles simultaneous demand — multiple taps and showers can run together.';
    let storedPhysics =
      'Cylinder volume decouples delivery from instantaneous heat-source output; no flow-starvation risk under simultaneous draw.';

    if (isMixergy) {
      storedReason =
        'Mixergy cylinder mirrors demand and maintains strong hot-water delivery while reducing unnecessary reheat cycling.';
      storedPhysics =
        'Mixergy top-down draw preserves usable hot water and mirrors draw profiles; cycling penalties are lower than a standard combi under repeat short demands.';
    }
    if (dhwHardFail) {
      storedBand = 'Needs Right Setup';
      storedReason = 'Stored hot water system — performance depends on cylinder sizing and incoming supply.';
      storedPhysics = 'DHW plane flagged caution or worse by engine: volume or supply constraint identified.';
    }

    const supplyConstraintBand = deriveSupplyConstraintBand(ctx);
    const finalHotWaterBand = minRatingBand(storedBand, supplyConstraintBand);
    if (finalHotWaterBand !== storedBand) {
      storedReason =
        'Stored hot water capability is strong, but incoming supply limits mean setup details matter for peak simultaneous use.';
      storedPhysics =
        'Final hot-water band is capped by supply constraints (mains flow / concurrency) to avoid over-stating expected performance.';
    }
    return makeRating(finalHotWaterBand, storedReason, storedPhysics);
  }

  // Combi path
  // Guard: ASHP without a cylinder has reached this path — combi copy does not apply.
  // ASHP systems are always stored-cylinder systems; on-demand supply is not part of
  // the ASHP system family.  Return an appropriate ASHP-specific message instead of
  // combi-template copy.
  if (quote.systemType === 'ashp') {
    return makeRating(
      'Needs Right Setup',
      'Heat pump system requires a hot-water cylinder — on-demand supply is not applicable for heat pump installations.',
      'ASHP heats stored water slowly via a cylinder; on-demand (combi-style) hot water is not part of the heat pump system family. Specify a cylinder volume to complete the design.',
    );
  }

  // Combi path
  if (hwRedFlags.length > 0) {
    return makeRating(
      'Less Suited',
      'On-demand hot water faces hard constraints in this home — pressure or flow limits will affect delivery.',
      hwRedFlags.map(f => f.title).join(' · '),
    );
  }
  if (dhwHardFail) {
    return makeRating(
      'Less Suited',
      'On-demand hot water rejected by the engine for this home configuration.',
      'DHW plane status: not applicable — simultaneous demand or supply constraint exceeded.',
    );
  }
  if (dhwCaution) {
    return makeRating(
      'Needs Right Setup',
      'On-demand hot water works for single-outlet use — two taps at once will reduce flow.',
      'Combi throughput limited to one full-flow outlet; concurrent draws share available flow, reducing delivery per outlet.',
    );
  }
  if ((ctx?.bathroomCount ?? 0) >= 2 || (ctx?.peakConcurrentOutlets ?? 0) >= 2) {
    return makeRating(
      'Less Suited',
      'On-demand hot water is not suitable for simultaneous multi-outlet demand in this home.',
      'Hard simultaneous-demand gate triggered by 2+ bathrooms or 2+ peak concurrent outlets.',
    );
  }
  if ((ctx?.occupancyCount ?? 0) === 3) {
    return makeRating(
      'Good',
      'On-demand hot water can work, but demand is borderline for this occupancy level.',
      'Three-occupant profile is a warning threshold for simultaneous-demand risk on a combi.',
    );
  }
  return makeRating(
    'Very Good',
    'On-demand hot water works well for 1 bathroom and up to 2 people.',
    'Mains flow and pressure within combi operating envelope; single-bathroom occupancy reduces simultaneous-demand risk.',
  );
}

// ─── Heating Performance rating ───────────────────────────────────────────────

function rateHeatingPerformance(
  quote: QuoteInput,
  output: EngineOutputV1,
): RatingExplanation {
  const optionCard = findOptionCard(quote, output);
  const heatHardFail = optionCard?.heat.status === 'na';
  const heatCaution = optionCard?.heat.status === 'caution';

  if (quote.systemType === 'ashp') {
    // ASHP-specific fail flags (emitter sizing, flow temperature, infrastructure)
    const ashpFails = (output.redFlags ?? []).filter(
      f => f.severity === 'fail' &&
        (f.id.includes('ashp') || f.id.includes('heat_pump') ||
         f.id === 'flow-temp-too-high-for-ashp' || f.id === 'radiator-output-insufficient'),
    );
    // Check for high-flow-temperature limiter specific to ASHP
    const flowTempLimiter = (output.limiters?.limiters ?? []).find(
      l => l.id === 'flow-temp-too-high-for-ashp',
    );
    if (ashpFails.length > 0 || (flowTempLimiter && flowTempLimiter.severity === 'fail')) {
      return makeRating(
        'Needs Right Setup',
        'Heat pump heating performance depends on emitter sizing and flow temperature — review required before install.',
        'ASHP COP degrades sharply at high flow temperatures; existing radiators may require upsizing to allow operation below 50°C.',
      );
    }
    if (flowTempLimiter) {
      return makeRating(
        'Good',
        'Heat pump can heat this home — emitter sizing review recommended to maximise efficiency.',
        'Flow temperature above ideal HP range identified. Radiator upsizing or operating hours adjustment can mitigate.',
      );
    }
    // Hard hydraulic blocker: 22mm primary pipework restricts ASHP flow
    // fail severity = hard constraint that prevents installation without upgrade
    // warn severity = caution — system may still work but at elevated velocity / noise
    const pipeLimiter = (output.limiters?.limiters ?? []).find(
      l => l.id === 'primary-pipe-constraint',
    );
    if (pipeLimiter && pipeLimiter.severity === 'fail') {
      return makeRating(
        'Needs Right Setup',
        'Pipework upgrade required before heat pump installation — current pipe size restricts the flow rate needed by the heat pump.',
        `Hydraulic hard constraint: ${pipeLimiter.impact.summary}. Upgrading the primary circuit to 28mm bore is a prerequisite for heat pump viability. Label: Requires system changes to be viable.`,
      );
    }
    if (pipeLimiter && pipeLimiter.severity === 'warn') {
      // warn-severity pipe constraint: system may work but with flow-velocity caution
      return makeRating(
        'Good',
        'Heat pump heating is feasible — primary pipework is borderline for required flow rates.',
        `Pipe-size caution: ${pipeLimiter.impact.summary}. Monitor for elevated flow velocity and noise; upgrading to 28mm removes this risk.`,
      );
    }

    // No heating constraints: ASHP is well-matched to this home
    return makeRating(
      'Excellent',
      'Heat pump is well-matched to this home — delivers steady, low-temperature heating with minimal operating constraints.',
      'No flow-temperature, emitter, or pipework constraints flagged. ASHP COP 2.5–3.5 at design-day flow temperatures; long, steady heating cycles maximise seasonal efficiency.',
    );
  }

  if (heatHardFail) {
    return makeRating(
      'Less Suited',
      'Heating delivery flagged as constrained for this home.',
      optionCard?.heat.headline ?? 'Heat plane status: not applicable.',
    );
  }
  if (heatCaution) {
    return makeRating(
      'Good',
      'Heating output is adequate — some operating limits present.',
      optionCard?.heat.headline ?? 'Heat plane status: caution.',
    );
  }
  return makeRating(
    'Excellent',
    'Boiler delivers responsive heating suited to this home.',
    'Heat source capacity meets design-day demand; no primary pipework or radiator constraints flagged.',
  );
}

// ─── Efficiency rating ────────────────────────────────────────────────────────

/**
 * Derives efficiency rating.
 *
 * Uses condensing runtime / cycling flags from the engine.
 * Never uses the literal 92 — references DEFAULT_NOMINAL_EFFICIENCY_PCT.
 */
function rateEfficiency(
  quote: QuoteInput,
  output: EngineOutputV1,
): RatingExplanation {
  // Cycling and short-draw flags reduce efficiency band
  const cyclingLimiter = (output.limiters?.limiters ?? []).find(
    l => l.id === 'cycling-loss-penalty',
  );

  if (quote.systemType === 'ashp') {
    const flowTempLimiter = (output.limiters?.limiters ?? []).find(
      l => l.id === 'flow-temp-too-high-for-ashp',
    );
    if (flowTempLimiter && flowTempLimiter.severity === 'fail') {
      return makeRating(
        'Good',
        'Heat pump is more efficient than a gas boiler, though high flow temperatures reduce the efficiency advantage.',
        `Flow temperatures currently constrain COP below optimal range. Radiator upsizing can restore full efficiency gains. Nominal SEDBUK baseline for comparison: ${DEFAULT_NOMINAL_EFFICIENCY_PCT}%.`,
      );
    }
    if (flowTempLimiter && flowTempLimiter.severity === 'warn') {
      // warn-severity: system is workable but operating below optimal COP
      // At 50 °C flow, SPF ≈ 2.5 — still better than gas but not the 3.5 headline figure.
      return makeRating(
        'Very Good',
        'High efficiency possible — current system configuration would operate at reduced performance until emitters are upgraded.',
        `Flow temperature constraint identified (${flowTempLimiter.observed.value} ${flowTempLimiter.observed.unit}). At elevated flow temperatures SPF is approximately 2.5 — better than a gas boiler (${DEFAULT_NOMINAL_EFFICIENCY_PCT}% seasonal) but below the 3.0–3.5 achievable with upgraded emitters and lower design flow temperature.`,
      );
    }
    return makeRating(
      'Excellent',
      'Heat pump delivers 2.5–3.5× more useful heat per unit of energy than a gas boiler — the highest-efficiency option available.',
      `Seasonal Performance Factor (SPF) driven by flow temperature and outdoor temperature regime. Lower flow temperature = higher COP. Gas boiler SEDBUK baseline: ${DEFAULT_NOMINAL_EFFICIENCY_PCT}%; ASHP SPF target 2.5–3.5.`,
    );
  }

  if (quote.systemType === 'combi') {
    const shortDrawFlag = (output.redFlags ?? []).find(f => f.id === 'combi-short-draw-collapse');
    if (shortDrawFlag) {
      return makeRating(
        'Needs Right Setup',
        'Short hot-water draws collapse efficiency — frequent brief taps can drop it below 30%.',
        `Short draws (<15 s) end before the heat exchanger reaches steady-state condensing mode. Efficiency drops to ~28% on these draws. Nominal SEDBUK baseline: ${DEFAULT_NOMINAL_EFFICIENCY_PCT}%.`,
      );
    }
    if (cyclingLimiter) {
      return makeRating(
        'Good',
        'Efficiency is good on long heating runs — short cycling reduces seasonal average.',
        `Cycling loss penalty identified: ${cyclingLimiter.impact.summary}. Nominal SEDBUK: ${DEFAULT_NOMINAL_EFFICIENCY_PCT}%.`,
      );
    }
    return makeRating(
      'Very Good',
      'Condensing boiler operates efficiently across most of the heating season.',
      `Nominal SEDBUK efficiency: ${DEFAULT_NOMINAL_EFFICIENCY_PCT}%. Condensing window maintained when return temperature stays below 55°C.`,
    );
  }

  // System / regular boiler
  if (cyclingLimiter) {
    return makeRating(
      'Good',
      'System boiler is efficient — stored cylinder reduces short-cycle risk versus combi.',
      `Cylinder buffers demand, allowing longer boiler runs in condensing range. Nominal SEDBUK: ${DEFAULT_NOMINAL_EFFICIENCY_PCT}%.`,
    );
  }
  return makeRating(
    'Excellent',
    'System boiler with stored cylinder — longer heat cycles keep efficiency high.',
    `Cylinder thermal mass extends boiler run time, maximising time in condensing regime. Nominal SEDBUK baseline: ${DEFAULT_NOMINAL_EFFICIENCY_PCT}%.`,
  );
}

// ─── Reliability rating ───────────────────────────────────────────────────────

function rateReliability(
  quote: QuoteInput,
  output: EngineOutputV1,
): RatingExplanation {
  const failFlags = (output.redFlags ?? []).filter(f => f.severity === 'fail');
  const warnFlags = (output.redFlags ?? []).filter(f => f.severity === 'warn');

  const hasFilter = quote.includedUpgrades.some(u =>
    u.toLowerCase().includes('filter'),
  );
  const hasFlush = quote.includedUpgrades.some(u =>
    u.toLowerCase().includes('flush'),
  );

  if (failFlags.length > 0) {
    return makeRating(
      'Needs Right Setup',
      'Reliability concerns flagged — installation requires specific conditions to perform consistently.',
      failFlags.map(f => f.title).join(' · '),
    );
  }

  if (!hasFilter && warnFlags.length > 0) {
    return makeRating(
      'Good',
      'Good reliability — a magnetic filter would further protect long-term performance.',
      'Magnetite sludge accumulates without magnetic filtration; 7% annual efficiency loss and up to 47% radiator output reduction over time (HHIC data).',
    );
  }

  if (hasFlush && hasFilter) {
    // Combi boilers have more wear-prone components (diverter valve, plate heat exchanger,
    // flow sensor) than stored-system boilers. Reliability ceiling for combi is Very Good.
    if (quote.systemType === 'combi') {
      return makeRating(
        'Very Good',
        'Powerflush + magnetic filter included — good protection, though on-demand boilers have more wear-prone internal components than stored systems.',
        'Combination boilers contain diverter valve, plate heat exchanger, and flow sensor — additional failure points vs system boiler. Flush + filter mitigates sludge risk but cannot address internal component wear.',
      );
    }
    return makeRating(
      'Excellent',
      'Powerflush + magnetic filter included — optimised for long-term reliability.',
      'Power flush clears existing magnetite sludge (restores up to 47% radiator output); filter prevents re-accumulation.',
    );
  }

  // Combi: Very Good is the max when no flush/filter or warn flags present
  if (quote.systemType === 'combi') {
    return makeRating(
      'Very Good',
      'No significant reliability concerns — on-demand boiler suited to this home.',
      'No fail-severity flags; combination boiler within normal operating parameters. Reliability capped at Very Good: diverter valve and plate heat exchanger add failure modes absent in stored systems.',
    );
  }

  return makeRating(
    'Very Good',
    'No significant reliability concerns in this home.',
    'No fail-severity flags from the engine; system configuration is within normal operating parameters.',
  );
}

// ─── Overall Suitability rating ───────────────────────────────────────────────

function rateSuitability(
  quote: QuoteInput,
  output: EngineOutputV1,
  hwRating: RatingExplanation,
  heatRating: RatingExplanation,
  effRating: RatingExplanation,
  reliabilityRating: RatingExplanation,
): RatingExplanation {
  const BAND_ORDER: RatingBand[] = [
    'Excellent', 'Very Good', 'Good', 'Needs Right Setup', 'Less Suited',
  ];

  // Worst band across all dimensions drives suitability (physics constraint is a hard gate)
  const allBands: RatingBand[] = [
    hwRating.rating,
    heatRating.rating,
    effRating.rating,
    reliabilityRating.rating,
  ];
  const worstIndex = Math.max(...allBands.map(b => BAND_ORDER.indexOf(b)));
  const worstBand = BAND_ORDER[worstIndex];

  // Check whether the engine's primary recommendation aligns with this system type
  const primaryRec = output.recommendation?.primary ?? '';
  const recAlignsWithQuote = checkRecommendationAlignment(quote, primaryRec, output);

  if (recAlignsWithQuote && worstBand === 'Excellent') {
    return makeRating(
      'Excellent',
      'Best match for this home — engine recommendation aligns with this system type.',
      `Engine primary recommendation: "${primaryRec}". All performance dimensions: Excellent.`,
    );
  }

  if (recAlignsWithQuote && worstBand === 'Very Good') {
    return makeRating(
      'Very Good',
      'Strong match for this home — minor limitations only.',
      `Engine primary recommendation aligns. Worst dimension: Very Good.`,
    );
  }

  if (worstBand === 'Less Suited') {
    return makeRating(
      'Less Suited',
      'Physics constraints make this a poor match for the home as surveyed.',
      `Worst dimension: ${worstBand}. ${hwRating.physics}`,
    );
  }

  if (worstBand === 'Needs Right Setup') {
    return makeRating(
      'Needs Right Setup',
      "This option can work well, but the installation needs to be matched to your home's water supply and usage pattern.",
      `Key constraint: ${allBands.includes('Needs Right Setup') ? allBands.filter(b => b === 'Needs Right Setup').length : 0} dimension(s) need right setup.`,
    );
  }

  return makeRating(
    worstBand,
    'Good overall fit for this home based on available survey data.',
    `Derived from physics output — worst dimension: ${worstBand}.`,
  );
}

// ─── Option card lookup ───────────────────────────────────────────────────────

function findOptionCard(quote: QuoteInput, output: EngineOutputV1): OptionCardV1 | undefined {
  const options = output.options ?? [];
  const typeMap: Record<QuoteInput['systemType'], OptionCardV1['id'][]> = {
    combi: ['combi'],
    system: ['system_unvented', 'stored_unvented'],
    regular: ['stored_vented', 'regular_vented'],
    ashp: ['ashp'],
  };
  const ids = typeMap[quote.systemType] ?? [];
  return options.find(o => ids.includes(o.id));
}

function checkRecommendationAlignment(quote: QuoteInput, primaryRec: string, output?: EngineOutputV1): boolean {
  // Primary check: engine's recommendation text explicitly mentions this system type
  const lower = primaryRec.toLowerCase();
  switch (quote.systemType) {
    case 'combi':
      if (lower.includes('combi') || lower.includes('on-demand') || lower.includes('on demand')) return true;
      break;
    case 'system':
    case 'regular':
      if (lower.includes('system') || lower.includes('stored') || lower.includes('cylinder')) return true;
      break;
    case 'ashp':
      if (lower.includes('heat pump') || lower.includes('ashp')) return true;
      break;
  }

  // Fallback: if the option card for this type is 'viable', the engine has
  // assessed it as a suitable option regardless of how the summary text was phrased.
  // This ensures "Multiple suitable options" or similarly generic text doesn't
  // cause a well-matched ASHP to rank below a system boiler.
  if (output) {
    const optionCard = findOptionCard(quote, output);
    if (optionCard?.status === 'viable') return true;
  }

  return false;
}

// ─── System type ranking (for daily-use comparison statements) ────────────────

/** Hot-water performance rank: higher = better simultaneous delivery. */
const HW_PERFORMANCE_RANK: Record<QuoteInput['systemType'], number> = {
  combi:   1,
  regular: 2,
  system:  3,
  ashp:    3,
};

// ─── Cylinder sizing rationale ────────────────────────────────────────────────

/**
 * Builds a physics-grounded cylinder sizing rationale statement for stored
 * hot-water systems (system, regular, ashp).
 *
 * Uses the same constants and helper functions as CylinderSizingModule so
 * that the customer-facing sizing explanation is always consistent with the
 * engine's own sizing recommendation.
 *
 * Explains:
 *   - Why this cylinder volume was chosen (occupancy + bathroom demand)
 *   - Usable litres at tap temperature (accounts for mixing losses)
 *   - Expected recovery time at the boiler/heat-pump output
 *   - Whether back-to-back simultaneous draws are supported
 */
function buildCylinderSizingStatement(
  quote: QuoteInput,
  ctx?: InsightPackSurveyContext,
): DailyUseStatement | null {
  const cylinderVol = quote.cylinder?.volumeL;
  if (cylinderVol == null) return null;

  const occupants    = ctx?.occupancyCount ?? 2;
  const bathrooms    = ctx?.bathroomCount  ?? 1;
  const heatSourceKw = quote.heatSourceKw;

  // Store and cold-water temperatures — use CylinderSizingModule defaults
  const isHp       = quote.systemType === 'ashp';
  const storeTempC = isHp ? DEFAULT_HP_STORE_TEMP_C : DEFAULT_BOILER_STORE_TEMP_C;
  const coldTempC  = DEFAULT_COLD_WATER_TEMP_C;
  const tapTempC   = DEFAULT_TAP_TARGET_TEMP_C;

  // Daily demand — uses CylinderSizingModule.computeDailyDemandL for consistency
  const dailyDemandL = computeDailyDemandL(occupants, bathrooms);

  // Usable mixed volume at tap temperature (using CylinderSizingModule physics)
  const isMixergy = quote.cylinder?.type === 'mixergy';
  const usableFraction = isMixergy ? USABLE_FRACTION_MIXERGY : USABLE_FRACTION_STANDARD;
  const usableL = Math.round(
    computeUsableVolumeMixedL(cylinderVol, usableFraction, storeTempC, tapTempC, coldTempC),
  );

  // Recovery time — only when heat source power is known
  let recoveryNote = '';
  if (heatSourceKw != null && heatSourceKw > 0) {
    const deltaTc        = storeTempC - coldTempC;
    const recoveryMins   = computeRecoveryTimeMins(cylinderVol, deltaTc, heatSourceKw);
    const recoveryRound  = Math.round(recoveryMins);
    recoveryNote = `; recovery to full at ${heatSourceKw} kW: approx ${recoveryRound} min`;
  }

  // Back-to-back shower check
  const backToBackOk = usableL >= dailyDemandL;
  const backToBackNote = backToBackOk
    ? 'back-to-back simultaneous draws supported'
    : 'consecutive peak draws may deplete stored volume';

  const statement =
    `${cylinderVol}L cylinder sized for ${occupants} occupant${occupants === 1 ? '' : 's'} and ` +
    `${bathrooms} bathroom${bathrooms === 1 ? '' : 's'}: ` +
    `estimated daily demand ${dailyDemandL}L → ${usableL}L usable at tap temperature` +
    `${recoveryNote}. ` +
    `${isMixergy ? 'Mixergy top-down draw: ' : 'Stored cylinder: '}${backToBackNote}.`;

  return { statement, scenario: 'recovery' };
}

// ─── Daily use statements ─────────────────────────────────────────────────────

function buildDailyUseStatements(
  quote: QuoteInput,
  output: EngineOutputV1,
  ctx?: InsightPackSurveyContext,
): DailyUseStatement[] {
  const statements: DailyUseStatement[] = [];

  // engine realWorldBehaviours are generated for the recommended system class, not
  // per-quote. Only use them when the quote's system type aligns with the
  // recommended option — otherwise all quotes would show identical statements.
  const behaviours = output.realWorldBehaviours ?? [];
  const hasStored = quote.systemType !== 'combi';

  for (const card of behaviours) {
    // Determine if this behaviour card is relevant for the current system type.
    // Cards about simultaneous demand / stored recovery apply to stored systems;
    // cards about on-demand single-outlet apply to combi.
    const cardIsStoredContext = card.scenario_id === 'two_showers' || card.scenario_id === 'morning_peak' || card.scenario_id === 'recovery';
    const cardIsCombiContext  = card.scenario_id === 'shower_and_tap' || card.scenario_id === 'pressure';

    if (hasStored && cardIsCombiContext) continue;    // skip combi-specific cards for stored systems
    if (!hasStored && cardIsStoredContext) continue;  // skip stored-specific cards for combi

    const isBadOutcome = card.recommended_option_outcome === 'poor' || card.recommended_option_outcome === 'limited';
    const isGoodOutcome = card.recommended_option_outcome === 'strong' || card.recommended_option_outcome === 'acceptable';
    const scenarioMap: Record<string, DailyUseStatement['scenario']> = {
      shower_and_tap: 'simultaneous_draw',
      two_showers: 'simultaneous_draw',
      morning_peak: 'simultaneous_draw',
      pressure: 'pressure',
      recovery: 'recovery',
    };
    const scenario: DailyUseStatement['scenario'] = scenarioMap[card.scenario_id] ?? 'general';

    if (isGoodOutcome || isBadOutcome) {
      statements.push({ statement: card.summary, scenario });
    }
  }

  // Use derived fallback when engine behaviours don't cover this system type
  if (statements.length === 0) {
    statements.push(...deriveFallbackDailyUse(quote, output, ctx));
  }

  return statements;
}

function deriveFallbackDailyUse(
  quote: QuoteInput,
  output: EngineOutputV1,
  ctx?: InsightPackSurveyContext,
): DailyUseStatement[] {
  const statements: DailyUseStatement[] = [];
  const optionCard = findOptionCard(quote, output);
  const systemType = quote.systemType;

  // Build occupancy context strings from survey data where available
  const occupants = ctx?.occupancyCount;
  const bathrooms = ctx?.bathroomCount ?? ctx?.peakConcurrentOutlets;
  const occupancyDesc = occupants ? `${occupants} occupant${occupants === 1 ? '' : 's'}` : null;
  const bathroomDesc = bathrooms != null ? `${bathrooms} bathroom${bathrooms === 1 ? '' : 's'}` : null;
  const homeDesc = [occupancyDesc, bathroomDesc].filter(Boolean).join(', ');

  // Check for upgrades included in this specific quote — they affect daily experience
  const upgrades = new Set(quote.includedUpgrades.map(u => u.toLowerCase()));
  const hasPowerflush = upgrades.has('powerflush') || upgrades.has('flush');
  const hasMixergy = quote.cylinder?.type === 'mixergy';
  const cylinderVol = quote.cylinder?.volumeL;

  if (systemType === 'ashp') {
    // ── Air Source Heat Pump ────────────────────────────────────────────────
    const simultaneousLine = homeDesc
      ? `With ${homeDesc} in this home, multiple taps and showers can run simultaneously — stored cylinder buffers demand from the heat pump.`
      : 'Multiple taps and showers can run simultaneously — stored cylinder decouples delivery from heat pump output.';
    statements.push({ statement: simultaneousLine, scenario: 'simultaneous_draw' });

    // Cylinder draw strategy
    if (hasMixergy) {
      statements.push({
        statement: 'Mixergy cylinder draws from the top — full-temperature water available immediately even at partial charge, so overnight heat cycles can be shorter.',
        scenario: 'recovery',
      });
    } else if (cylinderVol != null) {
      statements.push({
        statement: `${cylinderVol}L cylinder stores hot water pre-heated by the heat pump — no waiting for recovery mid-day.`,
        scenario: 'recovery',
      });
    }

    // Physics-based cylinder sizing rationale
    const sizingStatement = buildCylinderSizingStatement(quote, ctx);
    if (sizingStatement) statements.push(sizingStatement);

    // Heating efficiency characteristic
    statements.push({
      statement: 'Heat pump runs steady, low-temperature heating cycles — leaving it on at a consistent setpoint is more efficient than large on/off swings.',
      scenario: 'efficiency',
    });

    // Off-peak tariff advantage
    statements.push({
      statement: 'Pre-heating the cylinder overnight on a cheaper electricity tariff (e.g. Octopus Go) significantly reduces running costs.',
      scenario: 'efficiency',
    });

  } else if (systemType === 'system') {
    // ── System boiler with unvented cylinder ───────────────────────────────
    const simultaneousLine = homeDesc
      ? `With ${homeDesc} in this home, multiple taps and showers can run at mains pressure simultaneously — the cylinder buffers demand so the boiler isn't interrupted.`
      : 'Multiple taps and showers can run at mains pressure simultaneously — stored cylinder handles concurrent demand.';
    statements.push({ statement: simultaneousLine, scenario: 'simultaneous_draw' });

    if (hasMixergy) {
      statements.push({
        statement: 'Mixergy draws hot water from the top — a full-temperature shower is available even when the cylinder is partially charged, reducing unnecessary reheat cycles.',
        scenario: 'recovery',
      });
    } else if (cylinderVol != null) {
      statements.push({
        statement: `${cylinderVol}L unvented cylinder — recovery to full temperature takes around 40–60 minutes at typical boiler output after a large back-to-back draw.`,
        scenario: 'recovery',
      });
    } else {
      statements.push({
        statement: 'Hot water is finite — recovery applies after a large simultaneous draw, but for normal use the cylinder stores more than enough.',
        scenario: 'recovery',
      });
    }

    // Physics-based cylinder sizing rationale (occupancy + recovery + back-to-back capacity)
    const sizingStatement = buildCylinderSizingStatement(quote, ctx);
    if (sizingStatement) statements.push(sizingStatement);

    if (hasPowerflush) {
      statements.push({
        statement: 'Powerflush included — radiators will heat evenly across the home once the circuit is cleaned, improving comfort on cold days.',
        scenario: 'general',
      });
    }

  } else if (systemType === 'regular') {
    // ── Regular boiler with vented (tank-fed) cylinder ──────────────────────
    const simultaneousLine = homeDesc
      ? `With ${homeDesc} in this home, multiple taps can run simultaneously from the stored cylinder — pressure is gentler than mains supply but adequate for normal household use.`
      : 'Multiple taps can run simultaneously from the stored cylinder — pressure is tank-fed, not mains pressure.';
    statements.push({ statement: simultaneousLine, scenario: 'simultaneous_draw' });

    statements.push({
      statement: 'Hot water pressure depends on the height of the cold water tank above the taps — typically lower than mains pressure but consistent.',
      scenario: 'pressure',
    });

    if (cylinderVol != null) {
      statements.push({
        statement: `${cylinderVol}L vented cylinder provides tank-fed hot water — recovery time applies after a large draw.`,
        scenario: 'recovery',
      });
    }

    // Physics-based cylinder sizing rationale
    const sizingStatement = buildCylinderSizingStatement(quote, ctx);
    if (sizingStatement) statements.push(sizingStatement);
  } else {
    // ── Combination boiler (on-demand) ─────────────────────────────────────
    const dhwBullets = optionCard?.dhw.bullets ?? [];
    if (dhwBullets.length > 0) {
      statements.push({ statement: dhwBullets[0], scenario: 'simultaneous_draw' });
    } else {
      const flowLine = ctx?.mainsDynamicFlowLpm
        ? `On-demand hot water at your surveyed mains flow of ${ctx.mainsDynamicFlowLpm} L/min — one outlet at a time for full-pressure delivery.`
        : 'One outlet at a time for full-pressure hot water — the boiler heats water instantly on demand.';
      statements.push({ statement: flowLine, scenario: 'simultaneous_draw' });
    }

    statements.push({
      statement: 'No cylinder means no stored volume to run down — hot water is available indefinitely as long as the boiler is running.',
      scenario: 'general',
    });

    statements.push({
      statement: 'Brief pause on first draw while the heat exchanger ramps up — typically under 10 seconds.',
      scenario: 'recovery',
    });
  }

  return statements;
}

// ─── Limitations ─────────────────────────────────────────────────────────────

/**
 * Maps engine red flags and limiter outputs to SystemLimitation items.
 * Only populates from real engine data — never invents limitations.
 */
function buildLimitations(
  quote: QuoteInput,
  output: EngineOutputV1,
): SystemLimitation[] {
  const limitations: SystemLimitation[] = [];

  // Red flags → limitations
  for (const flag of output.redFlags ?? []) {
    const limitation = redFlagToLimitation(flag, quote);
    if (limitation) limitations.push(limitation);
  }

  // Limiters → limitations (when relevant to this system type)
  for (const limiter of output.limiters?.limiters ?? []) {
    const limitation = limiterToLimitation(limiter, quote);
    if (limitation) limitations.push(limitation);
  }

  // Option-card DHW / heat plane cautions
  const optionCard = findOptionCard(quote, output);
  if (optionCard?.dhw.status === 'caution') {
    limitations.push({
      severity: 'medium',
      category: 'hot_water',
      message: optionCard.dhw.headline,
      physicsReason: (optionCard.dhw.bullets ?? []).join(' · ') || 'DHW plane caution from engine.',
    });
  }
  if (optionCard?.heat.status === 'caution') {
    limitations.push({
      severity: 'medium',
      category: 'heating',
      message: optionCard.heat.headline,
      physicsReason: (optionCard.heat.bullets ?? []).join(' · ') || 'Heat plane caution from engine.',
    });
  }

  return limitations;
}

function redFlagToLimitation(
  flag: RedFlagItem,
  quote: QuoteInput,
): SystemLimitation | null {
  // Filter flags that aren't relevant to this system type
  const isCombi = quote.systemType === 'combi';
  const isAshp = quote.systemType === 'ashp';
  const flagText = `${flag.id} ${flag.title} ${flag.detail}`.toLowerCase();
  const flagIsCombiSpecific =
    flag.id.startsWith('combi-') ||
    flagText.includes('combi');
  const flagIsStoredSpecific =
    flag.id.startsWith('stored-') ||
    flag.id.startsWith('vented-') ||
    flag.id.startsWith('unvented-') ||
    flagText.includes('stored');
  const flagIsAshpSpecific =
    flag.id.startsWith('ashp-') ||
    flag.id.startsWith('heat_pump-') ||
    flag.id.includes('heat_pump') ||
    flagText.includes('ashp') ||
    flagText.includes('heat pump');

  if (!isCombi && flagIsCombiSpecific) return null;
  if (isCombi && flagIsStoredSpecific) return null;
  // ASHP-specific flags must only appear against ASHP quotes
  if (!isAshp && flagIsAshpSpecific) return null;

  // Hydraulic / fluid-dynamics flags represent property-level supply constraints.
  // They are universal (true for all options) but only materially limit delivery
  // for on-demand (combi) systems — stored cylinders buffer these constraints.
  // Do not emit them as per-quote limitations for stored or ASHP options.
  const flagIsPropertyLevelHydraulic =
    flag.id.startsWith('hydraulic-') ||
    flag.id.includes('fluid') ||
    flagText.includes('hydraulic') ||
    flagText.includes('velocity penalty');
  if (flagIsPropertyLevelHydraulic && !isCombi) return null;

  const severityMap: Record<RedFlagItem['severity'], SystemLimitation['severity']> = {
    info: 'low',
    warn: 'medium',
    fail: 'high',
  };

  const categoryMap = (id: string): SystemLimitation['category'] => {
    if (id.includes('pressure')) return 'pressure';
    if (id.includes('dhw') || id.includes('combi') || id.includes('hot_water')) return 'hot_water';
    if (id.includes('heat') || id.includes('rad') || id.includes('cycling')) return 'heating';
    if (id.includes('efficiency') || id.includes('condensing') || id.includes('scale')) return 'efficiency';
    return 'hot_water';
  };

  return {
    severity: severityMap[flag.severity],
    category: categoryMap(flag.id),
    message: flag.title,
    physicsReason: flag.detail,
  };
}

function limiterToLimitation(
  limiter: LimiterV1,
  quote: QuoteInput,
): SystemLimitation | null {
  const isCombi = quote.systemType === 'combi';
  const isAshp = quote.systemType === 'ashp';
  const isOpenVented = quote.systemType === 'regular';

  // combi-concurrency-constraint is only relevant to combi
  if (limiter.id === 'combi-concurrency-constraint' && !isCombi) return null;

  // primary-pipe-constraint is heat-pump-only — 22mm primaries only matter for ASHP
  // flow rates, not for boiler circuits which operate at different flow requirements.
  if (limiter.id === 'primary-pipe-constraint' && !isAshp) return null;

  // flow-temp-too-high-for-ashp is heat-pump-only — not a constraint for boiler systems.
  if (limiter.id === 'flow-temp-too-high-for-ashp' && !isAshp) return null;

  // mains-flow-constraint is primarily a combi DHW concern.
  // Stored systems buffer mains flow via the cylinder — only surface for combi.
  if (limiter.id === 'mains-flow-constraint' && !isCombi) return null;

  // open_vented_head_limit is only relevant to open-vented (regular) systems.
  if (limiter.id === 'open-vented-head-limit' && !isOpenVented) return null;

  const severityMap: Record<LimiterV1['severity'], SystemLimitation['severity']> = {
    info: 'low',
    warn: 'medium',
    fail: 'high',
  };

  const categoryMap = (id: string): SystemLimitation['category'] => {
    if (id.includes('mains') || id.includes('pressure')) return 'pressure';
    if (id.includes('cycling') || id.includes('efficiency') || id.includes('condensing')) return 'efficiency';
    if (id.includes('radiator') || id.includes('flow-temp')) return 'heating';
    return 'hot_water';
  };

  return {
    severity: severityMap[limiter.severity],
    category: categoryMap(limiter.id),
    message: limiter.impact.summary,
    physicsReason: limiter.impact.detail ?? `${limiter.observed.label}: ${limiter.observed.value} ${limiter.observed.unit} (limit: ${limiter.limit.value} ${limiter.limit.unit})`,
  };
}

// ─── Improvements ─────────────────────────────────────────────────────────────

/**
 * Builds a context-aware explanation for why a power flush is recommended,
 * grounded in the surveyed system age, condition signals, and engine sludge flags.
 */
function buildPowerflushExplanation(
  output: EngineOutputV1,
  ctx?: InsightPackSurveyContext,
): string {
  const parts: string[] = [];

  // Explain the core benefit
  parts.push('Clears magnetite sludge from the primary circuit, restoring up to 47% of lost radiator heat output (HHIC data).');

  // Ground in canonical survey evidence — prioritise observed signals
  const systemAge = ctx?.currentBoiler?.ageYears;
  const sludgeObserved = ctx?.systemCondition?.sludgeBleedObserved;
  const coldRads = ctx?.systemCondition?.coldRadiatorsPresent;

  if (sludgeObserved) {
    parts.push('Sludge observed in bleed water during survey — magnetite accumulation confirmed in this circuit.');
  } else if (coldRads) {
    parts.push('Cold radiators reported during survey — a common sign of restricted flow caused by magnetite build-up.');
  } else if (systemAge != null && systemAge >= 10) {
    parts.push(`System is approximately ${systemAge} years old — circuits of this age typically carry significant magnetite accumulation even without visible signs.`);
  } else if (systemAge != null && systemAge >= 5) {
    parts.push(`System is approximately ${systemAge} years old — a flush before fitting new components protects the investment and removes accumulated deposits.`);
  }

  // Engine-level sludge / cycling flags
  // Use exact known IDs to avoid false positives from substring matching.
  const SLUDGE_FLAG_IDS = new Set([
    'sludge-risk', 'sludge-detected', 'circuit-flush-required', 'powerflush-required',
    'cycling-penalty', 'magnetite-risk',
  ]);
  const sludgeFlagPresent = (output.redFlags ?? []).some(f => SLUDGE_FLAG_IDS.has(f.id));
  const cyclingLimiter = (output.limiters?.limiters ?? []).find(l => l.id === 'cycling-loss-penalty');

  if (cyclingLimiter && cyclingLimiter.severity === 'fail') {
    const lossPct = cyclingLimiter.observed?.value != null
      ? `${cyclingLimiter.observed.value}%`
      : 'high';
    parts.push(`Engine identified a high cycling-loss penalty (${lossPct}) — this directly indicates a sludge-restricted circuit.`);
  } else if (cyclingLimiter) {
    parts.push('Engine identified a cycling-loss penalty — consistent with partial sludge restriction in the primary circuit.');
  } else if (sludgeFlagPresent && !sludgeObserved && !coldRads) {
    parts.push('Engine flagged elevated sludge risk for this system based on age and service history.');
  }

  return parts.join(' ');
}

function countMixergySignals(ctx?: InsightPackSurveyContext): number {
  if (!ctx) return 0;
  const signals = [
    (ctx.occupancyCount ?? 0) >= 3,
    ctx.highDrawFrequency === true || (ctx.peakConcurrentOutlets ?? 0) >= 2,
    ctx.solarPVPresent === true,
    ctx.spaceRestricted === true,
    ctx.cylinderUndersizedConfirmed === true,
    ctx.measuredDepletionComplaints === true,
    ctx.timeOfUseElectricity === true,
    ctx.futureHeatPumpIntent === true,
  ];
  return signals.filter(Boolean).length;
}

function buildImprovements(
  quote: QuoteInput,
  output: EngineOutputV1,
  ctx?: InsightPackSurveyContext,
): Improvement[] {
  const improvements: Improvement[] = [];
  const upgrades = new Set(quote.includedUpgrades.map(u => u.toLowerCase()));

  if (!upgrades.has('powerflush') && !upgrades.has('flush')) {
    improvements.push({
      title: 'Power Flush',
      impact: 'performance',
      explanation: buildPowerflushExplanation(output, ctx),
    });
  }

  if (!upgrades.has('filter') && !upgrades.has('magnetic filter')) {
    const filterExplanation = ctx?.systemCondition?.magneticFilterFitted
      ? 'Existing filter noted — replacement on installation ensures the new system starts with clean protection. Captures magnetite particles before they re-coat heat exchanger surfaces, preventing the 7% annual efficiency penalty from unfiltered sludge.'
      : 'Captures magnetite particles before they re-coat heat exchanger surfaces. Prevents the 7% annual efficiency penalty from unfiltered sludge. No magnetic filter was recorded in the survey — fitting one at installation is the standard recommendation.';
    improvements.push({
      title: 'Magnetic Filter',
      impact: 'longevity',
      explanation: filterExplanation,
    });
  }

  if (!upgrades.has('controls') && !upgrades.has('weather compensation') && quote.systemType !== 'ashp') {
    improvements.push({
      title: 'Modern Heating Controls',
      impact: 'efficiency',
      explanation: 'Modern controls will be configured for efficient operation, keeping flow temperatures lower for longer periods so the boiler can spend more time in condensing mode.',
    });
  }

  if (quote.systemType === 'combi' && quote.cylinder == null) {
    const simultaneousFail = (output.redFlags ?? []).some(f => f.id === 'combi-simultaneous-demand' && f.severity === 'fail');
    if (simultaneousFail) {
      improvements.push({
        title: 'Upgrade to System Boiler + Cylinder',
        impact: 'performance',
        explanation: 'Simultaneous demand flagged for this home. A stored cylinder removes the single-outlet throughput limit and eliminates flow-starvation risk.',
      });
    }
  }

  // ── ASHP-specific constraint-derived improvements ──────────────────────────
  // Improvements must be derived from identified struggles/limitations.
  // Rule: improvements = limitations.map(limitation => limitation.resolution)
  if (quote.systemType === 'ashp') {
    const pipeLimiter = (output.limiters?.limiters ?? []).find(
      l => l.id === 'primary-pipe-constraint',
    );
    if (pipeLimiter) {
      improvements.push({
        title: 'Upgrade primary pipework to 28mm',
        impact: 'performance',
        explanation:
          `Primary pipe constraint identified: ${pipeLimiter.impact.summary}. ` +
          `Upgrading to 28mm bore primary circuit enables the required ASHP flow rate and is the ` +
          `prerequisite for heat pump installation. Without this upgrade the heat pump cannot deliver ` +
          `rated output and risks elevated flow velocity and noise.`,
      });
    }

    const flowTempLimiter = (output.limiters?.limiters ?? []).find(
      l => l.id === 'flow-temp-too-high-for-ashp',
    );
    if (flowTempLimiter && flowTempLimiter.severity === 'fail') {
      improvements.push({
        title: 'Increase emitter surface area and lower design flow temperature',
        impact: 'efficiency',
        explanation:
          `Current design flow temperature (${flowTempLimiter.observed.value} ${flowTempLimiter.observed.unit}) ` +
          `exceeds the heat pump's efficient operating range. Adding or upsizing radiators reduces the ` +
          `required flow temperature to ≤ 45 °C, restoring heat pump SPF to the 3.0–4.0 target range. ` +
          `Each 5 °C reduction in flow temperature improves COP by approximately 0.35.`,
      });
    }

    const radLimiter = (output.redFlags ?? []).find(
      f => f.id === 'radiator-output-insufficient' && f.severity === 'fail',
    );
    if (radLimiter) {
      improvements.push({
        title: 'Review and upsize radiators',
        impact: 'performance',
        explanation:
          `Radiator output assessed as insufficient for heat pump operation: ${radLimiter.detail}. ` +
          `Upsizing to double-panel convectors or adding additional emitters is required to allow ` +
          `heat pump operation at its efficient flow-temperature range.`,
      });
    }
  }

  // ── Cylinder update advice ───────────────────────────────────────────────────

  // When the quote includes a standard cylinder, advise upgrading to Mixergy
  // for better hot-water efficiency and reduced reheat cycling.
  const mixergySignals = countMixergySignals(ctx);
  if (
    (quote.systemType === 'system' || quote.systemType === 'regular' || quote.systemType === 'ashp') &&
    quote.cylinder?.type === 'standard' &&
    mixergySignals >= 2
  ) {
    improvements.push({
      title: 'Upgrade Cylinder to Mixergy',
      impact: 'efficiency',
      explanation:
        'Mixergy can be beneficial for this home because multiple demand signals were identified. ' +
        'It mirrors demand, keeps usable hot water available at the top of the store, and reduces reheat cycling compared with standard cylinders.',
    });
  }

  // When the existing cylinder is being reused (not replaced by this quote),
  // advise the customer to check cylinder condition before deciding.
  if (
    (quote.systemType === 'system' || quote.systemType === 'regular') &&
    quote.cylinderReplaced === false
  ) {
    improvements.push({
      title: 'Check Existing Cylinder Before Reuse',
      impact: 'longevity',
      explanation:
        'This quote reuses the existing cylinder rather than replacing it. ' +
        'Ask the installer to inspect the cylinder for corrosion, sediment build-up, and immersion heater condition before proceeding. ' +
        'A cylinder in poor condition can reduce system performance and negate the benefits of fitting a new boiler.',
    });
  }

  return improvements;
}

// ─── Best Advice ─────────────────────────────────────────────────────────────

function buildBestAdvice(
  quotes: QuoteInsight[],
  output: EngineOutputV1,
  currentSystem?: CurrentSystemSummary,
  decision?: AtlasDecisionV1,
  scenarios?: ScenarioResult[],
): BestAdvice {
  // ── Decision-bound path (preferred) ────────────────────────────────────────
  // When AtlasDecisionV1 is provided, the recommendation is bound directly to
  // the engine's authoritative output — no independent re-derivation allowed.
  // The Advice Pack is a pure renderer of the decision, never a decision-maker.
  if (decision && scenarios) {
    const recommendedScenario = scenarios.find(
      s => s.scenarioId === decision.recommendedScenarioId,
    );
    if (!recommendedScenario) {
      throw new Error(
        `AdvicePack: recommended scenario missing — ` +
        `scenarioId "${decision.recommendedScenarioId}" not found in scenarios array.`,
      );
    }

    // Mismatch guard: run the legacy heuristic selection and compare to the
    // decision. If they disagree, the shadow engine has diverged — surface this
    // immediately rather than silently producing conflicting outputs.
    if (quotes.length > 0) {
      const primaryRec = output.recommendation?.primary ?? '';
      const SUITABILITY_ORDER: RatingBand[] = ['Excellent', 'Very Good', 'Good', 'Needs Right Setup', 'Less Suited'];
      const legacyScored = quotes.map(qi => {
        const textAligns = checkRecommendationAlignment(qi.quote, primaryRec, output);
        const optionCard = findOptionCard(qi.quote, output);
        const viableAligns = optionCard?.status === 'viable';
        return { qi, textAligns, aligns: textAligns || viableAligns, suitabilityScore: SUITABILITY_ORDER.indexOf(qi.rating.suitability.rating) };
      });
      const legacyBest = legacyScored.sort((a, b) => {
        if (a.textAligns && !b.textAligns) return -1;
        if (!a.textAligns && b.textAligns) return 1;
        if (a.aligns && !b.aligns) return -1;
        if (!a.aligns && b.aligns) return 1;
        return a.suitabilityScore - b.suitabilityScore;
      })[0];

      if (legacyBest && legacyBest.qi.quote.systemType !== recommendedScenario.system.type) {
        // Log a warning rather than throwing — a divergence between the legacy heuristic
        // and the engine decision is a data quality signal, not a fatal error.
        // The engine decision (AtlasDecisionV1) is authoritative; the legacy heuristic
        // is a sanity check only.  Throwing here would crash the customer portal.
        console.warn(
          `[Atlas] Decision mismatch: the heuristic quote selection diverged from the engine decision. ` +
          `AtlasDecisionV1 recommends "${recommendedScenario.system.type}" ` +
          `(scenarioId: "${decision.recommendedScenarioId}") but the heuristic ` +
          `selected "${legacyBest.qi.quote.systemType}" from engine text: "${output.recommendation?.primary ?? ''}". ` +
          `Using AtlasDecisionV1 as authoritative. ` +
          `Investigate: ensure EngineOutputV1 and AtlasDecisionV1 are derived from the same engine inputs.`,
        );
      }
    }

    // Find the quote whose system type matches the decision's recommended system.
    const best = quotes.find(qi => qi.quote.systemType === recommendedScenario.system.type);

    const recommendation = best
      ? `${best.quote.label} — ${systemLabel(best.quote.systemType)}`
      : decision.headline;

    // Bind reasoning to engine truth — use decision.keyReasons, not re-derived heuristics.
    const because: string[] = [];
    if (currentSystem) {
      because.push(`Recommended as the best replacement for your ${currentSystem.label}.`);
    }
    because.push(...decision.keyReasons.slice(0, 3));

    // Bind avoids to engine truth — use decision.avoidedRisks.
    const avoids = decision.avoidedRisks.slice(0, 3);

    return {
      recommendation,
      because: because.length > 0 ? because : ["Best physics fit based on this home's survey data."],
      avoids: avoids.length > 0 ? avoids : ['No significant avoided risks identified from current survey data.'],
      recommendedQuoteId: best?.quote.id,
    };
  }

  // ── Legacy path: heuristic-based selection ─────────────────────────────────
  // Used when no AtlasDecisionV1 is provided. Callers should pass a decision
  // whenever possible to eliminate this shadow-engine path.
  const primaryRec = output.recommendation?.primary ?? '';
  const verdict = output.verdict;

  // Find the quote whose system type best aligns with the engine recommendation
  const scoredQuotes = quotes.map(qi => {
    // textAligns: the engine's recommendation text explicitly calls out this type
    const textAligns = checkRecommendationAlignment(qi.quote, primaryRec);
    // viableAligns: option card is 'viable' — engine assessed this as a suitable option
    const optionCard = findOptionCard(qi.quote, output);
    const viableAligns = optionCard?.status === 'viable';
    const aligns = textAligns || viableAligns;
    const suitabilityOrder: RatingBand[] = ['Excellent', 'Very Good', 'Good', 'Needs Right Setup', 'Less Suited'];
    const suitabilityScore = suitabilityOrder.indexOf(qi.rating.suitability.rating);
    return { qi, textAligns, aligns, suitabilityScore };
  });

  const best = scoredQuotes.sort((a, b) => {
    // Prefer explicit text alignment over option-card viability
    if (a.textAligns && !b.textAligns) return -1;
    if (!a.textAligns && b.textAligns) return 1;
    // Both text-aligned or neither: prefer option-card viable
    if (a.aligns && !b.aligns) return -1;
    if (!a.aligns && b.aligns) return 1;
    // Same alignment tier: better suitability wins
    return a.suitabilityScore - b.suitabilityScore;
  })[0];

  const recommendation = best
    ? `${best.qi.quote.label} — ${systemLabel(best.qi.quote.systemType)}`
    : verdict?.title ?? primaryRec;

  const because: string[] = [];

  // Reference the current system when known — grounds advice in survey reality
  if (currentSystem) {
    because.push(`Recommended as the best replacement for your ${currentSystem.label}.`);
  }

  if (verdict?.primaryReason) {
    // Prefer the engine's own primary reason — most specific to this home
    because.push(verdict.primaryReason);
  } else if (verdict?.reasons?.length) {
    because.push(...verdict.reasons.slice(0, 3));
  } else {
    if (best) {
      because.push(`${systemLabel(best.qi.quote.systemType)} best matches the demand profile of this home.`);
    }
    // Use context-summary bullets from the engine for grounding (not limitations)
    const contextBullets = (output.contextSummary?.bullets ?? []).slice(0, 2);
    for (const bullet of contextBullets) {
      if (!because.includes(bullet)) because.push(bullet);
    }
  }

  // Avoids: frame as comparison against alternatives, not a restatement of limitations
  const avoids: string[] = [];
  const alternatives = quotes.filter(q => q.quote.id !== best?.qi.quote.id);
  for (const alt of alternatives.slice(0, 2)) {
    const highLims = alt.limitations.filter(l => l.severity === 'high');
    if (highLims.length > 0) {
      // Make the comparison explicit: name the alternative option
      avoids.push(`Unlike ${alt.quote.label} (${systemLabel(alt.quote.systemType)}): ${highLims[0].message}`);
    }
  }

  // Fallback avoids when no alternative high-severity flags exist
  if (avoids.length === 0 && best?.qi.quote.systemType !== 'combi') {
    // Only add these when the engine evidence supports them (combi-related red flags present)
    const combiFlags = (output.redFlags ?? []).filter(
      f => f.id.startsWith('combi-') && (f.severity === 'fail' || f.severity === 'warn'),
    );
    if (combiFlags.length > 0) {
      avoids.push('Flow starvation risk under simultaneous hot-water demand (identified for on-demand combi)');
    }
    const shortDrawFlag = (output.redFlags ?? []).find(f => f.id === 'combi-short-draw-collapse');
    if (shortDrawFlag) {
      avoids.push('Short-draw efficiency collapse on brief hot-water draws (identified for on-demand combi)');
    }
  }

  // Add a single synthesis line: "Chosen because it handles X without Y"
  // This is the "Why THIS over the others?" answer the user needs.
  if (best) {
    const sysType = best.qi.quote.systemType;
    const hasCylinder = best.qi.quote.cylinder != null;
    const isMixergy = best.qi.quote.cylinder?.type === 'mixergy';
    const alternatives = quotes.filter(q => q.quote.id !== best.qi.quote.id);
    const hasWorseAlternative = alternatives.some(q =>
      q.limitations.some(l => l.severity === 'high'),
    );

    let synthesisLine = '';
    if (sysType === 'system' || sysType === 'regular') {
      synthesisLine = hasCylinder
        ? `Chosen because it handles simultaneous demand without pipework restrictions${isMixergy ? ', with Mixergy stratification delivering usable hot water even when the cylinder is partially charged' : ' and provides fast recovery from stored volume'}.`
        : `Chosen because stored hot water decouples delivery from instantaneous boiler output, eliminating flow-starvation risk.`;
    } else if (sysType === 'ashp') {
      synthesisLine = 'Chosen for the highest-efficiency pathway — requires system upgrades before installation can proceed.';
    } else if (sysType === 'combi') {
      synthesisLine = hasWorseAlternative
        ? 'Chosen because on-demand hot water best matches this home\'s supply profile and eliminates cylinder standby losses.'
        : 'Chosen as the best-matched option for this home based on demand profile and supply constraints.';
    }

    if (synthesisLine && !because.includes(synthesisLine)) {
      because.push(synthesisLine);
    }
  }

  return {
    recommendation,
    because: because.length > 0 ? because : ["Best physics fit based on this home's survey data."],
    avoids: avoids.length > 0 ? avoids : ['No significant avoided risks identified from current survey data.'],
    recommendedQuoteId: best?.qi.quote.id,
  };
}

function systemLabel(systemType: QuoteInput['systemType']): string {
  switch (systemType) {
    case 'combi': return 'Combination boiler (on-demand hot water)';
    case 'system': return 'System boiler with unvented cylinder';
    case 'regular': return 'Regular boiler with tank-fed hot water';
    case 'ashp': return 'Air source heat pump';
  }
}

// ─── Savings Plan ─────────────────────────────────────────────────────────────

function buildSavingsPlan(bestQuote: QuoteInsight | undefined, output: EngineOutputV1): SavingsPlan {
  const systemType = bestQuote?.quote.systemType;

  // ── System-specific behaviour advice ─────────────────────────────────────
  const behaviour: string[] = [];

  if (systemType === 'ashp') {
    behaviour.push('Run the heat pump on a continuous, steady setpoint rather than large on/off swings — heat pumps are most efficient on long, low-output cycles.');
    behaviour.push('Pre-heat the home before cold snaps rather than responding with short high-output bursts — ramp up gradually 1–2 hours before expected cold weather.');
    behaviour.push('Schedule cylinder heating overnight during off-peak tariff windows (e.g. Octopus Go) to minimise running costs.');
  } else if (systemType === 'system' || systemType === 'regular') {
    behaviour.push('Allow the cylinder to fully recover between large draws — avoid scheduling back-to-back high-demand periods without a recovery window.');
    behaviour.push('Use a steady heating schedule rather than sharp on/off cycles for smoother comfort and efficiency.');
    if (bestQuote?.quote.cylinder?.type === 'mixergy') {
      behaviour.push('Mixergy draws from the top — even a partially charged cylinder can serve a full shower. Shorten reheat schedules to save energy without sacrificing comfort.');
    }
  } else {
    // Combi boiler
    behaviour.push('Avoid very short hot-water draws under 15 seconds — allow the heat exchanger to reach steady-state condensing temperature for maximum efficiency.');
    behaviour.push('Use a steady heating schedule rather than sharp on/off cycles for smoother comfort and efficiency.');
  }

  // ── System-specific settings advice ──────────────────────────────────────
  const settings: string[] = [];

  if (systemType === 'ashp') {
    settings.push('Set the heat pump to its lowest flow temperature that keeps rooms comfortable — each 5 °C reduction in flow temperature improves COP by approximately 0.35.');
    settings.push('Run heat pump continuously at lower output on cold days rather than burst-cycling at high output.');
  } else {
    settings.push('Set flow temperature to the minimum that keeps rooms comfortable (typically around 55–60 °C for older radiators).');
    settings.push('Modern controls will be configured for efficient operation to maintain lower flow temperatures on milder days and extend condensing runtime.');
  }

  const futureUpgrades: string[] = [];

  // Surface future energy opportunities from the engine when available
  const feo = output.futureEnergyOpportunities;
  if (feo?.solarPv?.status === 'suitable_now') {
    futureUpgrades.push('Solar PV — engine assessed as likely suitable for this property. Discuss with a specialist.');
  }
  if (feo?.evCharging?.status === 'suitable_now') {
    futureUpgrades.push('EV charging — supply capacity assessed as adequate. Combine with solar PV for maximum benefit.');
  }

  if (systemType === 'combi' || systemType === 'regular') {
    futureUpgrades.push('Consider a Mixergy cylinder in future — stratified storage reduces reheat cycles and improves solar PV compatibility.');
  }
  if (systemType !== 'ashp') {
    futureUpgrades.push('Air source heat pump pathway — review emitter sizing and insulation before committing.');
  }

  return { behaviour, settings, futureUpgrades };
}

// ─── Home Profile ─────────────────────────────────────────────────────────────

// Context-bullet matching patterns — used to map plain-text bullets to tiles.
const DHW_BULLET_PATTERN = /bath|shower|hot water|dhw/i;
const PRESSURE_BULLET_PATTERN = /pressure|flow|mains/i;
const HEAT_LOSS_BULLET_PATTERN = /heat loss|insulation|fabric|wall|kw/i;
const BOILER_BULLET_PATTERN = /boiler|current system|existing/i;
const LAYOUT_BULLET_PATTERN = /bed|floor|storey|layout|room/i;

/**
 * Derives WhatWeKnowGrid tiles from engine evidence and context summary.
 * Each tile must map to a real survey field or engine output — nothing invented.
 */
function buildHomeProfile(output: EngineOutputV1): HomeProfileTile[] {
  const tiles: HomeProfileTile[] = [];

  // Hot water demand — from DHW evidence or context
  const dhwEvidence = (output.evidence ?? []).find(
    e => e.id.includes('dhw') || e.id.includes('hot_water') || e.id.includes('cylinder'),
  );
  if (dhwEvidence) {
    tiles.push({
      icon: '🚿',
      title: 'Hot water demand',
      finding: dhwEvidence.value,
    });
  } else {
    const ctxBullets = output.contextSummary?.bullets ?? [];
    const dhwBullet = ctxBullets.find(b => DHW_BULLET_PATTERN.test(b));
    tiles.push({
      icon: '🚿',
      title: 'Hot water demand',
      finding: dhwBullet ?? 'Assessed from household size and bathroom count.',
    });
  }

  // Water pressure / flow — from services evidence
  const pressureEvidence = (output.evidence ?? []).find(
    e => e.id.includes('pressure') || e.id.includes('flow') || e.id.includes('mains'),
  );
  if (pressureEvidence) {
    tiles.push({
      icon: '💧',
      title: 'Water pressure and flow',
      finding: pressureEvidence.value,
    });
  } else {
    const pressBullet = (output.contextSummary?.bullets ?? []).find(
      b => PRESSURE_BULLET_PATTERN.test(b),
    );
    tiles.push({
      icon: '💧',
      title: 'Water pressure and flow',
      finding: pressBullet ?? 'Not directly measured — assessed from supply type and context.',
    });
  }

  // Heat loss / insulation
  const heatLossEvidence = (output.evidence ?? []).find(
    e => e.id.includes('heat_loss') || e.id.includes('heatloss') || e.id.includes('insulation'),
  );
  if (heatLossEvidence) {
    tiles.push({
      icon: '🏠',
      title: 'Heat loss and insulation',
      finding: heatLossEvidence.value,
    });
  } else {
    const heatBullet = (output.contextSummary?.bullets ?? []).find(
      b => HEAT_LOSS_BULLET_PATTERN.test(b),
    );
    tiles.push({
      icon: '🏠',
      title: 'Heat loss and insulation',
      finding: heatBullet ?? 'Estimated from property type and floor area.',
    });
  }

  // Current boiler / system
  const boilerEvidence = (output.evidence ?? []).find(
    e => e.id.includes('boiler') || e.id.includes('current_system'),
  );
  if (boilerEvidence) {
    tiles.push({
      icon: '🔧',
      title: 'Current boiler',
      finding: boilerEvidence.value,
    });
  } else {
    const boilerBullet = (output.contextSummary?.bullets ?? []).find(
      b => BOILER_BULLET_PATTERN.test(b),
    );
    if (boilerBullet) {
      tiles.push({
        icon: '🔧',
        title: 'Current boiler',
        finding: boilerBullet,
      });
    }
  }

  // Home size / layout
  const layoutEvidence = (output.evidence ?? []).find(
    e => e.id.includes('floor') || e.id.includes('bedroom') || e.id.includes('size'),
  );
  if (layoutEvidence) {
    tiles.push({
      icon: '📐',
      title: 'Home size and layout',
      finding: layoutEvidence.value,
    });
  } else {
    const layoutBullet = (output.contextSummary?.bullets ?? []).find(
      b => LAYOUT_BULLET_PATTERN.test(b),
    );
    if (layoutBullet) {
      tiles.push({
        icon: '📐',
        title: 'Home size and layout',
        finding: layoutBullet,
      });
    }
  }

  // Future plans — from future energy opportunities
  const feo = output.futureEnergyOpportunities;
  if (feo) {
    const signals: string[] = [];
    if (feo.solarPv?.status === 'suitable_now') signals.push('Solar PV likely viable');
    else if (feo.solarPv?.status === 'check_required') signals.push('Solar PV needs checks');
    if (feo.evCharging?.status === 'suitable_now') signals.push('EV charging assessed as viable');
    if (signals.length > 0) {
      tiles.push({
        icon: '🌱',
        title: 'Future energy plans',
        finding: signals.join(' · '),
      });
    }
  }

  // Ensure at least one tile is always present
  if (tiles.length === 0) {
    tiles.push({
      icon: '📋',
      title: 'Survey data',
      finding: 'Home assessed using available survey inputs.',
    });
  }

  return tiles;
}

// ─── Reason Chain ─────────────────────────────────────────────────────────────

/**
 * Builds the "Why Atlas suggested this" reasoning ladder.
 * Order: home facts → constraints identified → conclusion.
 * Derived from engine verdict, contextSummary, and recommendation — never invented.
 */
function buildReasonChain(
  output: EngineOutputV1,
  bestAdvice: BestAdvice,
): ReasonChainStep[] {
  const steps: ReasonChainStep[] = [];

  // Step 1–2: Home facts from context summary or evidence
  const contextBullets = output.contextSummary?.bullets ?? [];
  for (const bullet of contextBullets.slice(0, 2)) {
    steps.push({ label: bullet });
  }

  // Step 3: Constraint(s) from verdict reasons or limiters
  const verdictReasons = output.verdict?.reasons ?? [];
  for (const reason of verdictReasons.slice(0, 2)) {
    steps.push({ label: reason });
  }

  // Fallback from limiters when verdict reasons are absent
  if (verdictReasons.length === 0) {
    const topLimiters = (output.limiters?.limiters ?? [])
      .filter(l => l.severity === 'fail' || l.severity === 'warn')
      .slice(0, 2);
    for (const limiter of topLimiters) {
      steps.push({ label: limiter.impact.summary, detail: limiter.impact.detail });
    }
  }

  // Final step: the conclusion / recommendation
  const conclusion = bestAdvice.because[0] ?? output.recommendation?.primary ?? 'Best fit based on this home.';
  steps.push({ label: conclusion });

  // Guarantee at least 2 steps
  if (steps.length < 2) {
    steps.unshift({
      label: output.recommendation?.primary ?? 'Home assessed by Atlas engine.',
    });
  }

  return steps;
}

// ─── Next Steps ───────────────────────────────────────────────────────────────

function buildNextSteps(
  bestAdvice: BestAdvice,
  quotes: QuoteInsight[],
  decision?: AtlasDecisionV1,
): NextSteps {
  const best = quotes.find(qi => qi.quote.id === bestAdvice.recommendedQuoteId) ?? quotes[0];

  const included = best
    ? [
        systemLabel(best.quote.systemType),
        ...(best.quote.cylinder
          ? [`${best.quote.cylinder.volumeL}L ${best.quote.cylinder.type === 'mixergy' ? 'Mixergy cylinder (stratified)' : 'hot-water cylinder'}`]
          : []),
        ...best.quote.includedUpgrades,
      ]
    : [];

  // Optional: only add-ons not already included in the quote
  const includedUpgradesLower = new Set(best?.quote.includedUpgrades.map(u => u.toLowerCase()) ?? []);
  const optional = best
    ? best.improvements
        .filter(imp => (imp.impact === 'efficiency' || imp.impact === 'longevity') &&
          !includedUpgradesLower.has(imp.title.toLowerCase()))
        .map(imp => imp.title)
        .slice(0, 3)
    : [];

  // Further improvements — title only; full detail is already in the Improvements panel
  const furtherImprovements = best
    ? best.improvements
        .filter(imp => imp.impact === 'performance' &&
          !includedUpgradesLower.has(imp.title.toLowerCase()))
        .map(imp => imp.title)
        .slice(0, 2)
    : [];

  // When no quote is matched, derive included works from the engine decision's
  // requiredWorks (engine-sourced) rather than falling back to hardcoded strings.
  // Limit to 4 items to match the maximum displayed in the NextStepsCard.
  const includedFallback = decision?.requiredWorks?.length
    ? decision.requiredWorks.slice(0, 4)
    : ['Replacement heat source', 'Commissioning and handover'];

  return {
    chosenOptionLabel: best?.quote.label ?? bestAdvice.recommendation,
    included: included.length > 0 ? included : includedFallback,
    optional,
    furtherImprovements,
  };
}

// ─── You / We / Get builder ────────────────────────────────────────────────────

/**
 * buildYouWeGet
 *
 * Derives the "You told us / We're doing / So you get" narrative rows from
 * the survey context and best-advice recommendation.
 *
 * Each row maps a survey observation → Atlas action → customer outcome.
 * Only rows backed by real survey data are emitted — no invented copy.
 * Returns undefined when insufficient context is available.
 *
 * Rules:
 *   - No engineering jargon (ΔT, L/min, 22mm, hydraulic, etc.).
 *   - All strings follow docs/atlas-terminology.md.
 *   - Minimum 1 row to emit a non-undefined result.
 */
function buildYouWeGet(
  bestAdvice: BestAdvice,
  ctx?: InsightPackSurveyContext,
): YouWeGetTripleData | undefined {
  const rows: YouWeGetRow[] = [];

  // ── Row: current boiler age ──────────────────────────────────────────────────
  const boilerAge = ctx?.currentBoiler?.ageYears;
  if (boilerAge != null && boilerAge >= 10) {
    rows.push({
      youToldUs: `Your current boiler is ${boilerAge} year${boilerAge === 1 ? '' : 's'} old.`,
      wereDoing: 'Replacing it with a high-efficiency condensing boiler.',
      soYouGet:  'Lower energy bills and a more reliable heating system from day one.',
    });
  }

  // ── Row: household size ──────────────────────────────────────────────────────
  const occupancy = ctx?.occupancyCount;
  if (occupancy != null && occupancy >= 3) {
    rows.push({
      youToldUs: `${occupancy} people live in your home.`,
      wereDoing: "Sizing the system to match your household's peak demand.",
      soYouGet:  'Enough hot water and heating for the whole household, even during busy mornings.',
    });
  }

  // ── Row: multi-bathroom / simultaneous demand ────────────────────────────────
  const bathrooms = ctx?.bathroomCount;
  if (bathrooms != null && bathrooms >= 2) {
    rows.push({
      youToldUs: `You have ${bathrooms} bathrooms.`,
      wereDoing: 'Recommending stored hot water to handle multiple outlets at once.',
      soYouGet:  'Stored hot water helps your home cope better when multiple outlets are used together.',
    });
  }

  // ── Row: system condition — sludge / cold radiators ─────────────────────────
  const sludge = ctx?.systemCondition?.sludgeBleedObserved;
  const coldRads = ctx?.systemCondition?.coldRadiatorsPresent;
  if (sludge || coldRads) {
    rows.push({
      youToldUs: sludge
        ? 'Sludge was found in your heating system.'
        : 'Some radiators were not heating correctly.',
      wereDoing: 'Including a system clean (power-flush) and a magnetic filter.',
      soYouGet:  'A clean, balanced system that heats every room efficiently and protects the new boiler.',
    });
  }

  // ── Row: recommendation outcome ──────────────────────────────────────────────
  // Always add a row linking the recommendation to its primary outcome.
  if (bestAdvice.because.length > 0) {
    rows.push({
      youToldUs: 'Your home survey is complete.',
      wereDoing: bestAdvice.recommendation,
      soYouGet:  bestAdvice.because[0],
    });
  }

  if (rows.length === 0) return undefined;
  return { rows };
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build an InsightPack from engine output, a list of contractor quotes, and
 * an optional survey context snapshot from the canonical engine input.
 *
 * @param engineOutput   The full EngineOutputV1 from the Atlas engine.
 * @param quotes         Contractor quotes to compare.
 * @param surveyContext  Optional — subset of EngineInputV2_3 used to ground
 *                       advice in actual survey data (current system, occupancy,
 *                       bathrooms, mains flow, heat loss).
 * @param decision       Optional — AtlasDecisionV1 from buildDecisionFromScenarios.
 *                       When provided, bestAdvice is bound directly to the decision
 *                       and its keyReasons / avoidedRisks, eliminating shadow-engine
 *                       re-derivation. A mismatch guard throws if the legacy heuristic
 *                       would have produced a different system recommendation.
 * @param scenarios      Required when decision is provided — the ScenarioResult[] used
 *                       to build the decision. Used to resolve recommendedScenarioId.
 * @returns              A fully populated InsightPack — all fields guaranteed.
 */
export function buildInsightPackFromEngine(
  engineOutput: EngineOutputV1,
  quotes: QuoteInput[],
  surveyContext?: InsightPackSurveyContext,
  decision?: AtlasDecisionV1,
  scenarios?: ScenarioResult[],
): InsightPack {
  const currentSystem = buildCurrentSystemSummary(surveyContext);

  const quoteInsights: QuoteInsight[] = quotes.map(quote => {
    const hwRating = rateHotWaterPerformance(quote, engineOutput, surveyContext);
    const heatRating = rateHeatingPerformance(quote, engineOutput);
    const effRating = rateEfficiency(quote, engineOutput);
    const reliabilityRating = rateReliability(quote, engineOutput);
    const suitabilityRating = rateSuitability(
      quote, engineOutput, hwRating, heatRating, effRating, reliabilityRating,
    );

    const rating: SystemRating = {
      hotWaterPerformance: hwRating,
      heatingPerformance: heatRating,
      efficiency: effRating,
      reliability: reliabilityRating,
      suitability: suitabilityRating,
    };

    return {
      quote,
      dailyUse: buildDailyUseStatements(quote, engineOutput, surveyContext),
      limitations: buildLimitations(quote, engineOutput),
      rating,
      improvements: buildImprovements(quote, engineOutput, surveyContext),
    };
  });

  // ── Post-process: add ranking comparison statements to dailyUse ─────────────
  // When multiple system types are present, each quote gets a comparative statement
  // that explains how it differs from alternatives — grounded in physics, not scores.
  if (quoteInsights.length > 1) {
    const distinctTypes = new Set(quoteInsights.map(qi => qi.quote.systemType));
    if (distinctTypes.size > 1) {
      for (const qi of quoteInsights) {
        const rank = HW_PERFORMANCE_RANK[qi.quote.systemType];
        const betterOptions = quoteInsights.filter(
          other => other.quote.id !== qi.quote.id &&
            HW_PERFORMANCE_RANK[other.quote.systemType] > rank,
        );
        const worseOptions = quoteInsights.filter(
          other => other.quote.id !== qi.quote.id &&
            HW_PERFORMANCE_RANK[other.quote.systemType] < rank,
        );

        if (betterOptions.length > 0) {
          const betterLabels = betterOptions
            .map(o => `${o.quote.label} (${systemLabel(o.quote.systemType)})`)
            .join(', ');
          qi.dailyUse.push({
            statement: `Ranked below ${betterLabels} for simultaneous hot-water delivery — a stored cylinder handles multiple outlets simultaneously without any throughput limit.`,
            scenario: 'general',
          });
        }
        if (worseOptions.length > 0) {
          const worseLabels = worseOptions
            .map(o => `${o.quote.label} (${systemLabel(o.quote.systemType)})`)
            .join(', ');
          qi.dailyUse.push({
            statement: `Handles simultaneous hot-water demand better than ${worseLabels} — stored volume decouples delivery from the heat source output rate.`,
            scenario: 'general',
          });
        }

        // ASHP vs gas boiler: add energy cost comparison when both are present
        if (qi.quote.systemType === 'ashp') {
          const boilerOptions = quoteInsights.filter(
            o => o.quote.id !== qi.quote.id &&
              (o.quote.systemType === 'combi' || o.quote.systemType === 'system' || o.quote.systemType === 'regular'),
          );
          if (boilerOptions.length > 0) {
            qi.dailyUse.push({
              statement: 'Compared to the gas boiler options: heat pump uses roughly 1 unit of electricity to deliver 2.5–3.5 units of heat — significantly lower carbon and operating cost at typical UK tariffs.',
              scenario: 'efficiency',
            });
          }
        }

        // Gas boiler vs ASHP: note the difference in heating approach
        const isBoiler = qi.quote.systemType === 'combi' || qi.quote.systemType === 'system' || qi.quote.systemType === 'regular';
        const ashpOption = quoteInsights.find(o => o.quote.systemType === 'ashp');
        if (isBoiler && ashpOption) {
          qi.dailyUse.push({
            statement: `Compared to ${ashpOption.quote.label} (heat pump): gas boiler responds faster to demand and reaches full output within seconds — suited to short, sharp heating bursts. The heat pump is more efficient overall but best used on longer, steadier cycles.`,
            scenario: 'efficiency',
          });
        }
      }
    }
  }

  const bestAdvice = buildBestAdvice(quoteInsights, engineOutput, currentSystem, decision, scenarios);
  const bestQuote = quoteInsights.find(qi => qi.quote.id === bestAdvice.recommendedQuoteId);
  const savingsPlan = buildSavingsPlan(bestQuote, engineOutput);
  const homeProfile = buildHomeProfile(engineOutput);
  const reasonChain = buildReasonChain(engineOutput, bestAdvice);
  const nextSteps = buildNextSteps(bestAdvice, quoteInsights, decision);
  const youWeGet = buildYouWeGet(bestAdvice, surveyContext);

  return {
    quotes: quoteInsights,
    bestAdvice,
    savingsPlan,
    homeProfile,
    reasonChain,
    nextSteps,
    currentSystem,
    youWeGet,
  };
}

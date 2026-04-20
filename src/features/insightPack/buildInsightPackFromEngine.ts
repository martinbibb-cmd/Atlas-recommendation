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
import { DEFAULT_NOMINAL_EFFICIENCY_PCT } from '../../engine/utils/efficiency';
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
    if (isMixergy) {
      return makeRating(
        'Excellent',
        'Mixergy cylinder provides on-demand hot water from top of store — simultaneous demand handled well with reduced recovery cycling.',
        'Mixergy top-down draw strategy maximises usable volume per heat cycle; demand mirroring reduces peak cycling penalty compared to standard combi.',
      );
    }
    if (dhwHardFail) {
      return makeRating(
        'Needs Right Setup',
        'Stored hot water system — performance depends on cylinder sizing and mains supply.',
        'DHW plane flagged caution or worse by engine: volume or supply constraint identified.',
      );
    }
    return makeRating(
      'Excellent',
      'Stored hot water handles simultaneous demand — multiple taps and showers can run together.',
      'Cylinder volume decouples delivery from instantaneous heat-source output; no flow-starvation risk under simultaneous draw.',
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
    const ashpFails = (output.redFlags ?? []).filter(f => f.id.includes('ashp') && f.severity === 'fail');
    if (ashpFails.length > 0) {
      return makeRating(
        'Needs Right Setup',
        'Heat pump heating performance depends on emitter sizing and flow temperature.',
        'ASHP COP degrades at high flow temperatures; existing radiators may require upsizing for full efficiency.',
      );
    }
    return makeRating(
      'Very Good',
      'Heat pump delivers steady low-temperature heating — efficient on long heating runs.',
      'ASHP COP 2.5–3.5 at space-heating flow temperatures (35–50°C); favours longer, slower heating cycles.',
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
    return makeRating(
      'Very Good',
      'Heat pump achieves 2.5–3.5× more heat per unit of electricity than a gas boiler.',
      'Seasonal Performance Factor driven by flow temperature and outdoor temperature regime; lower flow temperature = higher COP.',
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
  const recAlignsWithQuote = checkRecommendationAlignment(quote, primaryRec);

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
      'Can work well — but specific conditions must be met for consistent performance.',
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

function checkRecommendationAlignment(quote: QuoteInput, primaryRec: string): boolean {
  const lower = primaryRec.toLowerCase();
  switch (quote.systemType) {
    case 'combi':
      return lower.includes('combi') || lower.includes('on-demand');
    case 'system':
    case 'regular':
      return lower.includes('system') || lower.includes('stored') || lower.includes('cylinder');
    case 'ashp':
      return lower.includes('heat pump') || lower.includes('ashp');
    default:
      return false;
  }
}

// ─── System type ranking (for daily-use comparison statements) ────────────────

/** Hot-water performance rank: higher = better simultaneous delivery. */
const HW_PERFORMANCE_RANK: Record<QuoteInput['systemType'], number> = {
  combi:   1,
  regular: 2,
  system:  3,
  ashp:    3,
};

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
  const isAshp = quote.systemType === 'ashp';

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
    statements.push(...deriveFallbackDailyUse(quote, output, ctx, isAshp));
  }

  return statements;
}

function deriveFallbackDailyUse(
  quote: QuoteInput,
  output: EngineOutputV1,
  ctx?: InsightPackSurveyContext,
  isAshp?: boolean,
): DailyUseStatement[] {
  const statements: DailyUseStatement[] = [];
  const optionCard = findOptionCard(quote, output);
  const hasStored = quote.systemType !== 'combi';

  // Build occupancy context strings from survey data where available
  const occupants = ctx?.occupancyCount;
  const bathrooms = ctx?.bathroomCount ?? ctx?.peakConcurrentOutlets;
  const occupancyDesc = occupants ? `${occupants} occupant${occupants === 1 ? '' : 's'}` : null;
  const bathroomDesc = bathrooms != null ? `${bathrooms} bathroom${bathrooms === 1 ? '' : 's'}` : null;
  const homeDesc = [occupancyDesc, bathroomDesc].filter(Boolean).join(', ');

  if (hasStored) {
    const simultaneousLine = homeDesc
      ? `With ${homeDesc} in this home, multiple taps and showers can run simultaneously without pressure drop.`
      : 'Multiple taps and showers can run simultaneously without pressure drop.';
    statements.push({ statement: simultaneousLine, scenario: 'simultaneous_draw' });

    if (isAshp) {
      statements.push({
        statement: 'Heat pump heats water efficiently overnight at lower electricity tariff rates — cylinder is pre-charged ready for the day.',
        scenario: 'efficiency',
      });
    }

    if (quote.cylinder?.type === 'mixergy') {
      statements.push({
        statement: 'Mixergy draws from the top — hot water available immediately without waiting for full reheat.',
        scenario: 'recovery',
      });
    } else if (quote.cylinder?.volumeL != null) {
      const volLine = homeDesc
        ? `${quote.cylinder.volumeL}L cylinder provides stored hot water matched to ${homeDesc} — no delay on first draw.`
        : `${quote.cylinder.volumeL}L cylinder provides stored hot water — no delay on first draw.`;
      statements.push({ statement: volLine, scenario: 'recovery' });
    }
  } else {
    // Combi
    const dhwBullets = optionCard?.dhw.bullets ?? [];
    if (dhwBullets.length > 0) {
      statements.push({ statement: dhwBullets[0], scenario: 'simultaneous_draw' });
    } else {
      const flowLine = ctx?.mainsDynamicFlowLpm
        ? `On-demand hot water at your surveyed mains flow of ${ctx.mainsDynamicFlowLpm} L/min — one outlet at a time for full-pressure delivery.`
        : '1 outlet at a time for full-pressure hot water delivery.';
      statements.push({ statement: flowLine, scenario: 'simultaneous_draw' });
    }
    statements.push({
      statement: 'Brief pause on first draw while heat exchanger ramps up (typically under 10 seconds).',
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
  const flagIsCombiSpecific = flag.id.startsWith('combi-');
  const flagIsStoredSpecific = flag.id.startsWith('stored-') || flag.id.startsWith('vented-') || flag.id.startsWith('unvented-');
  const flagIsAshpSpecific = flag.id.startsWith('ashp-') || flag.id.startsWith('heat_pump-') || flag.id.includes('heat_pump');

  if (!isCombi && flagIsCombiSpecific) return null;
  if (isCombi && flagIsStoredSpecific) return null;
  // ASHP-specific flags must only appear against ASHP quotes
  if (!isAshp && flagIsAshpSpecific) return null;

  // Hydraulic / fluid-dynamics flags represent property-level supply constraints.
  // They are universal (true for all options) but only materially limit delivery
  // for on-demand (combi) systems — stored cylinders buffer these constraints.
  // Do not emit them as per-quote limitations for stored or ASHP options.
  const flagIsHydraulicUniversal = flag.id.startsWith('hydraulic-') || flag.id.includes('fluid');
  if (flagIsHydraulicUniversal && !isCombi) return null;

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

  // combi-concurrency-constraint is only relevant to combi
  if (limiter.id === 'combi-concurrency-constraint' && !isCombi) return null;

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

function buildImprovements(quote: QuoteInput, output: EngineOutputV1): Improvement[] {
  const improvements: Improvement[] = [];
  const upgrades = new Set(quote.includedUpgrades.map(u => u.toLowerCase()));

  if (!upgrades.has('powerflush') && !upgrades.has('flush')) {
    const sludgeFlagPresent = (output.redFlags ?? []).some(f => f.id.includes('sludge') || f.id.includes('flush'));
    improvements.push({
      title: 'Power Flush',
      impact: 'performance',
      explanation: `Clears magnetite sludge from the primary circuit, restoring up to 47% of lost radiator heat output (HHIC data).${sludgeFlagPresent ? ' Engine flagged sludge risk for this system.' : ''}`,
    });
  }

  if (!upgrades.has('filter') && !upgrades.has('magnetic filter')) {
    improvements.push({
      title: 'Magnetic Filter',
      impact: 'longevity',
      explanation: 'Captures magnetite particles before they re-coat heat exchanger surfaces. Prevents the 7% annual efficiency penalty from unfiltered sludge.',
    });
  }

  if (!upgrades.has('controls') && !upgrades.has('weather compensation') && quote.systemType !== 'ashp') {
    improvements.push({
      title: 'Weather Compensation Controls',
      impact: 'efficiency',
      explanation: 'Automatically lowers flow temperature on mild days — keeps the boiler in its condensing window for more of the heating season.',
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

  return improvements;
}

// ─── Best Advice ─────────────────────────────────────────────────────────────

function buildBestAdvice(
  quotes: QuoteInsight[],
  output: EngineOutputV1,
  currentSystem?: CurrentSystemSummary,
): BestAdvice {
  const primaryRec = output.recommendation?.primary ?? '';
  const verdict = output.verdict;

  // Find the quote whose system type best aligns with the engine recommendation
  const scoredQuotes = quotes.map(qi => {
    const aligns = checkRecommendationAlignment(qi.quote, primaryRec);
    const suitabilityOrder: RatingBand[] = ['Excellent', 'Very Good', 'Good', 'Needs Right Setup', 'Less Suited'];
    const suitabilityScore = suitabilityOrder.indexOf(qi.rating.suitability.rating);
    return { qi, aligns, suitabilityScore };
  });

  const best = scoredQuotes.sort((a, b) => {
    if (a.aligns && !b.aligns) return -1;
    if (!a.aligns && b.aligns) return 1;
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

  const behaviour: string[] = [
    'Avoid very short hot-water draws under 15 seconds — allow the heat exchanger to reach steady temperature.',
    'Use a steady heating schedule rather than sharp on/off cycles to make the most of thermal mass.',
  ];

  const settings: string[] = [
    'Set flow temperature to the minimum that keeps rooms comfortable (55–60°C for older radiators; lower with weather compensation).',
  ];

  if (systemType !== 'ashp') {
    settings.push('Enable weather compensation if available — lowers flow temperature on mild days and extends condensing operation.');
  } else {
    settings.push('Run heat pump continuously at lower output on cold days rather than burst-cycling at high output.');
    behaviour.push('Pre-heat the home before cold snaps rather than responding with short high-output bursts.');
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

  return {
    chosenOptionLabel: best?.quote.label ?? bestAdvice.recommendation,
    included: included.length > 0 ? included : ['Replacement heat source', 'Commissioning and handover'],
    optional,
    furtherImprovements,
  };
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
 * @returns              A fully populated InsightPack — all fields guaranteed.
 */
export function buildInsightPackFromEngine(
  engineOutput: EngineOutputV1,
  quotes: QuoteInput[],
  surveyContext?: InsightPackSurveyContext,
): InsightPack {
  const currentSystem = buildCurrentSystemSummary(surveyContext);

  const quoteInsights: QuoteInsight[] = quotes.map(quote => {
    const hwRating = rateHotWaterPerformance(quote, engineOutput);
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
      improvements: buildImprovements(quote, engineOutput),
    };
  });

  // ── Post-process: add ranking comparison statements to dailyUse ─────────────
  // When multiple system types are present, each quote gets a statement that
  // shows how it ranks vs the alternatives on hot-water performance.
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
            statement: `Ranked below ${betterLabels} for simultaneous hot-water delivery — a stored cylinder handles multiple outlets simultaneously.`,
            scenario: 'general',
          });
        }
        if (worseOptions.length > 0) {
          const worseLabels = worseOptions
            .map(o => `${o.quote.label} (${systemLabel(o.quote.systemType)})`)
            .join(', ');
          qi.dailyUse.push({
            statement: `Handles simultaneous hot-water demand better than ${worseLabels} — stored volume decouples delivery from the heat source.`,
            scenario: 'general',
          });
        }
      }
    }
  }

  const bestAdvice = buildBestAdvice(quoteInsights, engineOutput, currentSystem);
  const bestQuote = quoteInsights.find(qi => qi.quote.id === bestAdvice.recommendedQuoteId);
  const savingsPlan = buildSavingsPlan(bestQuote, engineOutput);
  const homeProfile = buildHomeProfile(engineOutput);
  const reasonChain = buildReasonChain(engineOutput, bestAdvice);
  const nextSteps = buildNextSteps(bestAdvice, quoteInsights);

  return {
    quotes: quoteInsights,
    bestAdvice,
    savingsPlan,
    homeProfile,
    reasonChain,
    nextSteps,
    currentSystem,
  };
}

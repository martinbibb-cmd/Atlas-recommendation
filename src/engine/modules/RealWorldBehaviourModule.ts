import type { FullEngineResultCore, EngineInputV2_3 } from '../schema/EngineInputV2_3';
import type {
  RealWorldBehaviourCard,
  BehaviourOutcome,
  BehaviourLimitingFactor,
} from '../../contracts/EngineOutputV1';

// ─── Flow thresholds ──────────────────────────────────────────────────────────

/** Strong mains flow: comfortably meets simultaneous demand with headroom. */
const FLOW_STRONG_LPM = 20;

/** Adequate mains flow: meets unvented gate; simultaneous use is workable. */
const FLOW_ADEQUATE_LPM = 15;

/** Marginal mains flow: meets the minimum unvented gate but simultaneous demand is constrained. */
const FLOW_MARGINAL_LPM = 12;

/** Strong mains dynamic pressure for reliable hot-water performance under load. */
const PRESSURE_STRONG_BAR = 1.5;

/** Minimum acceptable pressure for comfortably running hot water at multiple points. */
const PRESSURE_ADEQUATE_BAR = 1.0;

// ─── System classification ────────────────────────────────────────────────────

/**
 * Broad system class used to drive scenario wording.
 *
 *   combi           — on-demand (no stored volume)
 *   stored_unvented — mains-pressure cylinder; flow and pressure govern performance
 *   stored_vented   — gravity-fed cylinder; head governs pressure/flow
 *   stored_mixergy  — Mixergy cylinder with active top-down stratification (unvented or vented variant)
 */
type SystemClass = 'combi' | 'stored_unvented' | 'stored_vented' | 'stored_mixergy';

function classifyRecommendedSystem(
  result: FullEngineResultCore,
  input: EngineInputV2_3,
): SystemClass {
  const { combiDhwV1, cwsSupplyV1, redFlags } = result;

  // Mixergy is a specific stored cylinder variant — checked first.
  // Stratification benefits apply only to Mixergy, not standard unvented or vented cylinders.
  if (input.dhwTankType === 'mixergy') {
    return 'stored_mixergy';
  }

  // Combi is viable when not hard-rejected and combi risk is not 'fail'.
  const combiViable =
    !redFlags.rejectCombi && (combiDhwV1?.verdict.combiRisk ?? 'pass') !== 'fail';

  // Unvented stored is viable when the mains gate is met.
  const unventedViable = cwsSupplyV1.meetsUnventedRequirement && !redFlags.rejectStored;

  // Prefer stored unvented when high demand makes a stored system clearly better.
  // High demand = 2+ bathrooms, or simultaneous-demand flag on combi.
  const isHighDemand =
    (input.bathroomCount ?? 1) >= 2 ||
    (combiDhwV1?.flags ?? []).some(f => f.id === 'combi-simultaneous-demand');

  if (isHighDemand && unventedViable) return 'stored_unvented';
  if (combiViable && !isHighDemand) return 'combi';
  if (unventedViable) return 'stored_unvented';

  // Vented: gravity-fed (loft tank source).
  if (
    input.coldWaterSource === 'loft_tank' ||
    input.cwsHeadMetres !== undefined
  ) {
    return 'stored_vented';
  }

  // Fall through: default to combi if nothing else is clearly indicated.
  return combiViable ? 'combi' : 'stored_unvented';
}

/**
 * Derive the alternative system class for comparison.
 * Returns the best alternative to the primary recommendation.
 */
function classifyAlternativeSystem(
  primary: SystemClass,
  result: FullEngineResultCore,
  input: EngineInputV2_3,
): SystemClass | null {
  const { combiDhwV1, cwsSupplyV1, redFlags } = result;
  const combiViable =
    !redFlags.rejectCombi && (combiDhwV1?.verdict.combiRisk ?? 'pass') !== 'fail';
  const unventedViable = cwsSupplyV1.meetsUnventedRequirement && !redFlags.rejectStored;

  switch (primary) {
    case 'combi':
      // Best alternative to combi is unvented stored (or mixergy if current tank).
      if (input.dhwTankType === 'mixergy') return 'stored_mixergy';
      if (unventedViable) return 'stored_unvented';
      return null;

    case 'stored_unvented':
    case 'stored_mixergy':
      // Alternative to stored is combi (if viable) or vented stored.
      if (combiViable) return 'combi';
      if (input.coldWaterSource === 'loft_tank') return 'stored_vented';
      return null;

    case 'stored_vented':
      if (combiViable) return 'combi';
      return null;
  }
}

// ─── Outcome helpers ──────────────────────────────────────────────────────────

/** Outcome for a combi boiler under simultaneous multi-outlet demand. */
function combiSimultaneousOutcome(
  result: FullEngineResultCore,
  outletCount: number,
): BehaviourOutcome {
  const { combiDhwV1, cwsSupplyV1 } = result;
  const combiRisk = combiDhwV1?.verdict.combiRisk ?? 'pass';
  const flowLpm = cwsSupplyV1.dynamic?.flowLpm;
  const hasMeasurements = cwsSupplyV1.hasMeasurements;

  if (combiRisk === 'fail') return 'poor';
  if (!hasMeasurements) return 'limited'; // can't assess without flow data

  const effectiveFlowPerOutlet = flowLpm != null ? flowLpm / outletCount : 0;

  if (combiRisk === 'warn') return outletCount > 1 ? 'limited' : 'acceptable';

  // Pass case — evaluate by per-outlet flow
  if (effectiveFlowPerOutlet >= FLOW_ADEQUATE_LPM) return 'strong';
  if (effectiveFlowPerOutlet >= FLOW_MARGINAL_LPM) return 'acceptable';
  return 'limited';
}

/** Outcome for a stored system (any variant) under sustained hot-water draw. */
function storedSustainedOutcome(
  result: FullEngineResultCore,
  _input: EngineInputV2_3,
): BehaviourOutcome {
  const { storedDhwV1 } = result;
  const constraintKind = storedDhwV1?.constraintKind;
  const volumeBand = storedDhwV1?.recommended.volumeBand;

  if (constraintKind === 'thermal-capacity-limited') return 'limited';
  if (constraintKind === 'recovery-limited') return 'limited';
  if (constraintKind === 'mains-limited') return 'limited';
  if (constraintKind === 'head-limited') return 'limited';

  if (volumeBand === 'large') return 'strong';
  if (volumeBand === 'medium') return 'acceptable';
  return 'limited';
}

/** Outcome for a stored system specifically under a high-draw bath scenario. */
function storedBathOutcome(
  result: FullEngineResultCore,
  input: EngineInputV2_3,
): BehaviourOutcome {
  const base = storedSustainedOutcome(result, input);
  // Mixergy's top-down stratification gives faster usable hot-water availability
  // for moderate draws — this is a Mixergy-only benefit.
  if (input.dhwTankType === 'mixergy' && base === 'acceptable') return 'strong';
  return base;
}

/** Whole-property outcome when the incoming main is the binding constraint. */
function mainsPropertyOutcome(result: FullEngineResultCore): {
  outcome: BehaviourOutcome;
  limitingFactor: BehaviourLimitingFactor;
  confidence: 'high' | 'medium' | 'low';
} {
  const { cwsSupplyV1, pressureAnalysis } = result;
  const flowLpm = cwsSupplyV1.dynamic?.flowLpm;
  const pressureBar = pressureAnalysis.dynamicBar;
  const hasMeasurements = cwsSupplyV1.hasMeasurements;

  if (!hasMeasurements) {
    return { outcome: 'limited', limitingFactor: 'mains', confidence: 'low' };
  }

  // Evaluate based on flow (primary) then pressure (secondary)
  if (flowLpm != null && flowLpm >= FLOW_STRONG_LPM && pressureBar >= PRESSURE_STRONG_BAR) {
    return { outcome: 'acceptable', limitingFactor: 'mains', confidence: 'high' };
  }
  if (flowLpm != null && flowLpm >= FLOW_ADEQUATE_LPM && pressureBar >= PRESSURE_ADEQUATE_BAR) {
    return { outcome: 'limited', limitingFactor: 'mains', confidence: 'high' };
  }
  return { outcome: 'poor', limitingFactor: 'mains', confidence: 'high' };
}

// ─── Scenario builders ────────────────────────────────────────────────────────

function buildShowerAndTapScenario(
  primary: SystemClass,
  alternative: SystemClass | null,
  result: FullEngineResultCore,
  input: EngineInputV2_3,
): RealWorldBehaviourCard {
  const { cwsSupplyV1 } = result;

  function outcomeForClass(cls: SystemClass): BehaviourOutcome {
    switch (cls) {
      case 'combi':
        return combiSimultaneousOutcome(result, 2);
      case 'stored_unvented':
      case 'stored_mixergy': {
        // Stored systems serve from pre-heated volume; mains refill is decoupled from draw.
        // Performance governed by mains flow quality for pressure, not instantaneous output.
        const flowLpm = cwsSupplyV1.dynamic?.flowLpm;
        if (!cwsSupplyV1.hasMeasurements) return 'acceptable'; // assumed ok, lower confidence
        if (flowLpm != null && flowLpm >= FLOW_ADEQUATE_LPM) return 'strong';
        if (flowLpm != null && flowLpm >= FLOW_MARGINAL_LPM) return 'acceptable';
        return 'limited';
      }
      case 'stored_vented': {
        const headM = input.cwsHeadMetres;
        if (headM == null) return 'acceptable'; // unknown, assume ok
        if (headM >= 0.5) return 'acceptable';
        return 'limited';
      }
    }
  }

  const recommendedOutcome = outcomeForClass(primary);
  const alternativeOutcome = alternative ? outcomeForClass(alternative) : undefined;
  const hasMeasurements = cwsSupplyV1.hasMeasurements;
  const confidence = hasMeasurements ? 'high' : 'low';

  const summaries: Record<BehaviourOutcome, string> = {
    strong: 'Both outlets perform well — minimal pressure drop expected.',
    acceptable: 'Slight pressure reduction expected, but both outlets usable.',
    limited: 'Noticeable pressure drop at one or both outlets — performance reduced.',
    poor: 'System unlikely to support both outlets simultaneously.',
  };

  let explanation: string;
  if (primary === 'combi') {
    explanation = 'Combi boilers split available mains flow across active outlets. Outcome depends on measured mains flow rate.';
  } else if (primary === 'stored_mixergy') {
    explanation = "Stored volume handles the hot-water draw; mains pressure governs delivered cold/mixed flow. Mixergy's top-down stratification maintains outlet temperature even under concurrent draws.";
  } else if (primary === 'stored_unvented') {
    explanation = 'Stored volume handles the hot-water draw; mains pressure governs delivered cold/mixed flow.';
  } else {
    explanation = 'Gravity-fed system: flow depends on available head height above the draw-off point.';
  }

  return {
    scenario_id: 'shower_and_tap',
    title: 'Morning shower + kitchen tap',
    summary: summaries[recommendedOutcome],
    recommended_option_outcome: recommendedOutcome,
    alternative_option_outcome: alternativeOutcome,
    limiting_factor: primary === 'combi' ? 'mains' : 'distribution',
    explanation,
    confidence,
  };
}

function buildTwoShowersScenario(
  primary: SystemClass,
  alternative: SystemClass | null,
  result: FullEngineResultCore,
  input: EngineInputV2_3,
): RealWorldBehaviourCard {
  function outcomeForClass(cls: SystemClass): BehaviourOutcome {
    switch (cls) {
      case 'combi':
        // Two showers simultaneously on a combi: combiRisk drives the outcome.
        return combiSimultaneousOutcome(result, 2);
      case 'stored_unvented': {
        const base = storedSustainedOutcome(result, input);
        // Two sequential showers from a stored system: outcome is about volume recovery.
        // If no constraint, volume band determines if back-to-back is comfortable.
        return base;
      }
      case 'stored_mixergy': {
        // Mixergy's stratification means the available hot-water layer at the top
        // is preserved for longer — slightly better back-to-back performance than
        // a conventional cylinder of equal nominal volume.
        const base = storedSustainedOutcome(result, input);
        if (base === 'limited') return 'limited';
        return base === 'poor' ? 'limited' : 'acceptable';
      }
      case 'stored_vented':
        return storedSustainedOutcome(result, input);
    }
  }

  const recommendedOutcome = outcomeForClass(primary);
  const alternativeOutcome = alternative ? outcomeForClass(alternative) : undefined;

  const summaries: Record<BehaviourOutcome, string> = {
    strong: 'Back-to-back showers work well — recovery is fast enough to avoid a cool second shower.',
    acceptable: 'Second shower may be slightly cooler or have less pressure, but generally workable.',
    limited: 'Performance remains more stable than a combi during simultaneous use, though incoming water supply may still limit peak demand.',
    poor: 'System will not comfortably support two close showers — significant compromise expected.',
  };

  let explanation: string;
  if (primary === 'combi') {
    explanation = 'Combi boilers can run concurrent showers only if mains flow is sufficient to supply both outlets. Each successive simultaneous outlet reduces available flow.';
  } else if (primary === 'stored_mixergy') {
    explanation = 'Stored cylinders serve back-to-back showers from pre-heated volume. Mixergy\'s top-down stratification preserves the hot layer at the top, improving consistency for the second shower compared to a conventional cylinder of the same nominal size.';
  } else {
    explanation = 'Stored cylinders serve back-to-back showers from pre-heated volume. Outcome depends on cylinder size relative to household demand.';
  }

  const limitingFactor: BehaviourLimitingFactor =
    primary === 'combi' ? 'hot_water_generation'
    : (result.storedDhwV1?.constraintKind === 'thermal-capacity-limited' ? 'stored_volume'
    : result.storedDhwV1?.constraintKind === 'mains-limited' ? 'mains'
    : 'stored_volume');

  return {
    scenario_id: 'two_showers',
    title: 'Two showers close together',
    summary: summaries[recommendedOutcome],
    recommended_option_outcome: recommendedOutcome,
    alternative_option_outcome: alternativeOutcome,
    limiting_factor: limitingFactor,
    explanation,
    confidence: result.cwsSupplyV1.hasMeasurements ? 'high' : 'medium',
  };
}

function buildBathFillingScenario(
  primary: SystemClass,
  alternative: SystemClass | null,
  result: FullEngineResultCore,
  input: EngineInputV2_3,
): RealWorldBehaviourCard {
  function outcomeForClass(cls: SystemClass): BehaviourOutcome {
    switch (cls) {
      case 'combi': {
        // Bath filling on a combi: sustained high draw.
        const { combiDhwV1, cwsSupplyV1 } = result;
        const flowLpm = cwsSupplyV1.dynamic?.flowLpm;
        if (combiDhwV1?.verdict.combiRisk === 'fail') return 'poor';
        if (combiDhwV1?.verdict.combiRisk === 'warn') return 'limited';
        if (!cwsSupplyV1.hasMeasurements) return 'acceptable'; // unknown, assume ok
        if (flowLpm != null && flowLpm >= FLOW_STRONG_LPM) return 'acceptable';
        return 'limited';
      }
      case 'stored_unvented':
        return storedSustainedOutcome(result, input);
      case 'stored_mixergy':
        return storedBathOutcome(result, input);
      case 'stored_vented': {
        const base = storedSustainedOutcome(result, input);
        // Gravity head limits fill rate for vented systems — typically slower than unvented.
        const headM = input.cwsHeadMetres;
        if (headM != null && headM < 0.5 && base !== 'poor') return 'limited';
        return base;
      }
    }
  }

  const recommendedOutcome = outcomeForClass(primary);
  const alternativeOutcome = alternative ? outcomeForClass(alternative) : undefined;

  const summaries: Record<BehaviourOutcome, string> = {
    strong: 'Bath fills at a comfortable rate — no significant wait expected.',
    acceptable: 'Bath fills well, though it may take slightly longer than a fully pressurised system.',
    limited: 'Bath filling is noticeably slower or may feel weak — mains or stored volume is a factor.',
    poor: 'Bath filling is significantly compromised — this system or property cannot support a comfortable bath.',
  };

  const explanation =
    primary === 'combi'
      ? 'Combi boilers heat bath water on demand — fill rate depends on mains flow and boiler DHW output capacity.'
      : primary === 'stored_mixergy'
      ? 'Stored cylinder provides the bath fill from pre-heated volume. Mixergy\'s top-down heating maintains a ready hot layer, reducing wait time compared to a mixed-mass conventional cylinder.'
      : 'Stored cylinder provides the bath fill from pre-heated volume. Fill rate is limited by available stored volume and mains flow (unvented) or gravity head (vented).';

  const limitingFactor: BehaviourLimitingFactor =
    primary === 'combi' ? 'hot_water_generation'
    : primary === 'stored_vented' ? 'distribution'
    : result.storedDhwV1?.constraintKind === 'thermal-capacity-limited' ? 'stored_volume'
    : result.storedDhwV1?.constraintKind === 'mains-limited' ? 'mains'
    : 'stored_volume';

  return {
    scenario_id: 'bath_filling',
    title: 'Bath filling',
    summary: summaries[recommendedOutcome],
    recommended_option_outcome: recommendedOutcome,
    alternative_option_outcome: alternativeOutcome,
    limiting_factor: limitingFactor,
    explanation,
    confidence: result.cwsSupplyV1.hasMeasurements ? 'high' : 'medium',
  };
}

function buildPeakHouseholdScenario(
  primary: SystemClass,
  alternative: SystemClass | null,
  result: FullEngineResultCore,
  _input: EngineInputV2_3,
): RealWorldBehaviourCard {
  function outcomeForClass(cls: SystemClass): BehaviourOutcome {
    const { cwsSupplyV1 } = result;
    const flowLpm = cwsSupplyV1.dynamic?.flowLpm;
    const hasMeasurements = cwsSupplyV1.hasMeasurements;

    if (!hasMeasurements) return 'limited';

    // Stored systems can pre-charge and absorb peak demand better than combi.
    if (cls === 'stored_unvented' || cls === 'stored_mixergy' || cls === 'stored_vented') {
      if (flowLpm != null && flowLpm >= FLOW_STRONG_LPM) return 'acceptable';
      if (flowLpm != null && flowLpm >= FLOW_ADEQUATE_LPM) return 'limited';
      return 'poor';
    }

    // Combi: every simultaneous draw competes directly for mains flow.
    if (flowLpm != null && flowLpm >= FLOW_STRONG_LPM) return 'limited';
    return 'poor';
  }

  const recommendedOutcome = outcomeForClass(primary);
  const alternativeOutcome = alternative ? outcomeForClass(alternative) : undefined;
  const hasMeasurements = result.cwsSupplyV1.hasMeasurements;

  const summaries: Record<BehaviourOutcome, string> = {
    strong: 'Peak household demand is handled comfortably.',
    acceptable: 'Peak demand is manageable — most outlets perform well with some reduction.',
    limited: 'Busy periods will feel noticeably constrained — flow or temperature reduces when demand peaks.',
    poor: 'This property\'s incoming main cannot comfortably support peak household hot-water demand.',
  };

  return {
    scenario_id: 'peak_household',
    title: 'Busy household peak hour',
    summary: summaries[recommendedOutcome],
    recommended_option_outcome: recommendedOutcome,
    alternative_option_outcome: alternativeOutcome,
    limiting_factor: 'mains',
    explanation: 'Peak performance is constrained by the incoming cold-water main, which all hot-water systems share. Stored systems can pre-charge and absorb short peaks; combi systems compete directly for mains flow at each draw.',
    confidence: hasMeasurements ? 'high' : 'low',
  };
}

function buildColdMainsPressureScenario(
  _primary: SystemClass,
  alternative: SystemClass | null,
  result: FullEngineResultCore,
  _input: EngineInputV2_3,
): RealWorldBehaviourCard {
  const { outcome, confidence } = mainsPropertyOutcome(result);
  const { cwsSupplyV1 } = result;

  // Alternative outcome is the same: the mains is a property-level constraint independent of system type.
  const alternativeOutcome = alternative != null ? outcome : undefined;

  const summaries: Record<BehaviourOutcome, string> = {
    strong: 'Cold mains pressure holds well under concurrent use.',
    acceptable: 'Some pressure reduction under concurrent use, but not likely to be noticeable in normal daily routines.',
    limited: 'Cold taps and mixing valves may feel noticeably weaker when hot water is running elsewhere in the house.',
    poor: 'Low mains pressure causes meaningful reduction throughout the house when multiple outlets are active.',
  };

  const explanation =
    !cwsSupplyV1.hasMeasurements
      ? 'Mains supply not measured — outcome is estimated. Testing flow and pressure would improve confidence.'
      : 'The incoming cold-water main is shared by all hot and cold outlets. When hot water runs elsewhere, available flow to cold taps and mixing valves reduces. This is a property-level constraint, not a system-level one.';

  return {
    scenario_id: 'cold_mains_concurrent',
    title: 'Cold tap while hot water is running elsewhere',
    summary: summaries[outcome],
    recommended_option_outcome: outcome,
    alternative_option_outcome: alternativeOutcome,
    limiting_factor: 'mains',
    explanation,
    confidence,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the modelled real-world behaviour section.
 *
 * Generates 5 scenario cards that translate physics model outputs into
 * customer-readable statements about daily hot-water experience.
 *
 * Stratification benefits (Mixergy) are applied only when `dhwTankType === 'mixergy'`.
 * Standard vented and unvented cylinders do not receive stratification benefits.
 */
export function buildRealWorldBehavioursV1(
  result: FullEngineResultCore,
  input: EngineInputV2_3,
): RealWorldBehaviourCard[] {
  const primary = classifyRecommendedSystem(result, input);
  const alternative = classifyAlternativeSystem(primary, result, input);

  return [
    buildShowerAndTapScenario(primary, alternative, result, input),
    buildTwoShowersScenario(primary, alternative, result, input),
    buildBathFillingScenario(primary, alternative, result, input),
    buildPeakHouseholdScenario(primary, alternative, result, input),
    buildColdMainsPressureScenario(primary, alternative, result, input),
  ];
}

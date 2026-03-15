/**
 * buildHeatingOperatingState.ts
 *
 * Canonical normalization layer that computes the heating operating state used
 * by the simulator and decision surfaces.
 *
 * This is the authoritative bridge from survey/simulator inputs to
 * heating-operating interpretation.  It replaces any logic that treats emitter
 * oversizing as the sole condensing gateway.
 *
 * Core physics rules:
 *  - Condensing is governed by return temperature, not "oversized emitters yes/no".
 *  - Lower return temperature → higher condensing likelihood.
 *  - Standard radiators with good modulation and compensation can still achieve
 *    meaningful condensing periods at typical UK mid-season loads.
 *  - Emitters are ONE contributor, not the only gateway.
 *  - Modulation floor and cycling risk must affect efficiency interpretation.
 *  - Controls and compensation influence achievable operating temperature.
 *
 * Floor-plan integration:
 *  - When floorplanEmitterAdequacy is provided, its impliedOversizingFactor is
 *    used to refine the emitter oversizing assumption when no explicit value is given.
 *  - Floor-plan-sourced explanation tags name the room-level physics constraints.
 */

import type { WholeSystemEmitterAdequacy } from '../floorplan/adaptFloorplanToAtlasInputs';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Return temperature (°C) above which condensing is lost. */
const CONDENSING_RETURN_THRESHOLD_C = 55;

/** Standard ΔT across emitters for a UK two-pipe heating circuit (°C). */
const DEFAULT_DELTA_T_C = 20;

/** Indoor set-point temperature used in the weather-compensation load-fraction formula (°C). */
const INDOOR_TEMP_C = 20;

/** UK average outdoor heating-season temperature (°C). */
const UK_AVERAGE_OUTDOOR_C = 7;

/** UK design outdoor temperature for sizing calculations (°C). */
const DESIGN_OUTDOOR_C = -3;

/**
 * UK average heating-season part-load fraction.
 *
 * Under a linear weather-compensation (WC) curve:
 *   fraction = (indoor − outdoor_avg) / (indoor − outdoor_design)
 *            = (20 − 7) / (20 − (−3)) ≈ 0.565
 *
 * This represents the fraction of rated output required on a typical UK
 * heating-season day (~7 °C outdoor) relative to the design-day requirement.
 */
const UK_TYPICAL_LOAD_FRACTION =
  (INDOOR_TEMP_C - UK_AVERAGE_OUTDOOR_C) / (INDOOR_TEMP_C - DESIGN_OUTDOOR_C);

/** Modulation floor (%) below which the boiler is considered to have good modulation headroom. */
const GOOD_MODULATION_FLOOR_PCT = 20;

/** Modulation floor (%) below which the boiler has limited but acceptable headroom. */
const LIMITED_MODULATION_FLOOR_PCT = 35;

/**
 * Return temperature (°C) above which condensing is structurally limited regardless
 * of compensation or controls.  At this full-load return temperature, the emitters
 * require such a high flow temperature that the boiler cannot condense even on mild days.
 */
const HIGH_RETURN_LIMIT_C = 65;

/**
 * Minimum meaningful reduction in required flow temperature (°C) below the design
 * value before surfacing a "lower flow temperature achievable" tag to the user.
 * Avoids showing the tag for trivially small reductions (e.g. 1–2 °C rounding).
 */
const MEANINGFUL_FLOW_REDUCTION_C = 3;

/** Ratio of boiler output to heat loss above which cycling risk becomes meaningful. */
const CYCLING_RISK_MODERATE_RATIO = 1.5;

/** Ratio above which cycling risk is high. */
const CYCLING_RISK_HIGH_RATIO = 2.0;

/** Primary heat-loss threshold for medium-load concern (W). */
const PRIMARY_MEDIUM_LOAD_W = 10_000;

/** Primary heat-loss threshold for high-load concern (W). */
const PRIMARY_HIGH_LOAD_W = 14_000;

/**
 * Set of explanation tags that originate exclusively from floor-plan-derived
 * emitter adequacy data (i.e. pushed by the floor-plan emitter tag block in
 * buildHeatingOperatingState).
 *
 * Exported so that consumers (buildAdviceFromCompare, ExplainersHubPage, etc.)
 * can filter for floor-plan-sourced physics context without duplicating the
 * string literals.
 */
export const FLOOR_PLAN_EMITTER_EXPLANATION_TAGS: ReadonlySet<string> = new Set([
  'oversized emitters improving margin',
  'undersized rooms driving higher operating temperature',
  'emitter-limited',
]);

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Overall likelihood of condensing operation, expressed as a spectrum.
 * Governed by estimated return temperature and operating conditions.
 */
export type CondensingLikelihood = 'high' | 'medium' | 'low' | 'unlikely';

/**
 * Risk of short cycling at part load.
 * High cycling risk reduces effective efficiency and increases wear.
 */
export type CyclingRisk = 'low' | 'medium' | 'high';

/**
 * Available modulation headroom: how far the boiler can turn down its output.
 * Good headroom (low minimum modulation %) enables lower return temperatures
 * and better condensing fractions even with standard emitters.
 */
export type ModulationHeadroom = 'good' | 'limited' | 'poor';

/**
 * Degree to which emitter adequacy constrains lower flow-temperature operation.
 * 'none' = emitters support low-temperature operation fully.
 * 'mild' = moderate constraint; condensing still achievable at typical loads.
 * 'strong' = emitters require high flow temperature; condensing limited.
 */
export type EmitterConstraint = 'none' | 'mild' | 'strong';

/**
 * Degree to which controls constrain lower flow-temperature operation.
 * 'none' = full compensation active (weather + load).
 * 'mild' = partial compensation.
 * 'strong' = no compensation; fixed high flow temperature.
 */
export type ControlConstraint = 'none' | 'mild' | 'strong';

/**
 * Degree to which circulation (primary pipe) constrains lower-temperature operation.
 * 'none' = adequate primary for the load.
 * 'mild' = marginal at medium loads.
 * 'strong' = primary may limit lower-temperature operation at higher loads.
 */
export type CirculationConstraint = 'none' | 'mild' | 'strong';

/**
 * Scenario mode that governs which inputs are treated as editable overrides vs.
 * survey-derived defaults.
 */
export type HeatingScenarioMode = 'current' | 'proposed' | 'future';

// ─── Input / Output contracts ─────────────────────────────────────────────────

/**
 * Input to buildHeatingOperatingState.
 *
 * All fields except flowTempC are optional.  When omitted, conservative
 * defaults are applied and flagged via explanationTags.
 */
export interface HeatingOperatingStateInput {
  /**
   * Design flow temperature (°C).
   * The temperature the boiler is set to supply at design-day conditions.
   */
  flowTempC: number;

  /**
   * ΔT across the emitters (°C).
   * Defaults to 20 °C (UK standard two-pipe circuit assumption).
   */
  deltaTc?: number;

  /**
   * Emitter oversizing factor relative to standard radiators sized at 70 °C mean
   * water temperature.
   *
   * 1.0  = standard radiators
   * 1.1–1.29 = moderate oversizing
   * 1.3–1.49 = well oversized
   * ≥ 1.5   = highly oversized (underfloor heating level)
   *
   * Defaults to 1.0 (standard radiators) when absent.
   */
  emitterOversizingFactor?: number;

  /**
   * True when the survey or prior engine assessment has confirmed that the
   * emitters support condensing operation at the current design flow temperature
   * (return < 55 °C at design load).
   */
  condensingModeAvailable?: boolean;

  /**
   * Boiler minimum modulation level (% of rated output).
   * A lower value means wider modulation range and better ability to match
   * small heat demands without cycling.
   * Defaults to 30 % (conservative assumption for older/generic boilers).
   */
  boilerMinModulationPct?: number;

  /**
   * Boiler rated output (W).
   * When provided alongside heatLossWatts, the oversizing ratio is used
   * to estimate cycling risk.
   */
  boilerOutputWatts?: number;

  /**
   * Building design heat loss (W).
   * Used to assess primary pipe adequacy and boiler oversizing ratio.
   */
  heatLossWatts?: number;

  /**
   * True when weather compensation is active (boiler modulates with outdoor temp).
   * Materially reduces required flow temperature on mild days.
   */
  hasWeatherCompensation?: boolean;

  /**
   * True when load compensation is active (boiler modulates with actual demand).
   * Reduces required flow temperature at typical (~50 %) part-load conditions.
   */
  hasLoadCompensation?: boolean;

  /**
   * Primary pipe diameter (mm).
   * Used as a proxy for primary circulation suitability.
   * Defaults to 22 mm when absent.
   */
  primaryPipeDiameter?: number;

  /**
   * Scenario mode.
   * 'current'  — survey data only; no improvements assumed.
   * 'proposed' — includes one or more confirmed improvement actions.
   * 'future'   — exploratory override; may include speculative assumptions.
   */
  scenarioMode?: HeatingScenarioMode;

  /**
   * Whole-system emitter adequacy derived from the floor plan.
   *
   * When provided and emitterOversizingFactor is absent, the impliedOversizingFactor
   * from this signal is used to refine the emitter oversizing assumption.
   * This lets room-level installed-emitter data feed directly into required flow
   * temperature and condensing likelihood without requiring a manual override.
   *
   * When both emitterOversizingFactor and floorplanEmitterAdequacy are given,
   * the explicit emitterOversizingFactor always takes precedence.
   */
  floorplanEmitterAdequacy?: WholeSystemEmitterAdequacy;
}

/**
 * Normalised heating operating state.
 *
 * This is the canonical output type from survey/simulator inputs to
 * heating-operating interpretation.  Consumers include:
 *   - Simulator Dashboard
 *   - Compare mode (both sides must use the same logic)
 *   - Advice / recommendation layers
 *   - Printable outputs
 */
export interface HeatingOperatingState {
  /**
   * Required flow temperature derived from emitter adequacy and compensation.
   * This is the temperature the boiler needs to supply to meet design-day demand.
   * null when insufficient data is available to derive a credible value.
   */
  requiredFlowTempC: number | null;

  /**
   * Estimated full-load return temperature (°C).
   * Derived from requiredFlowTempC and ΔT, or from a measured value when available.
   * null when requiredFlowTempC is null.
   */
  estimatedReturnTempC: number | null;

  /**
   * Overall condensing likelihood for this heating system.
   * Governed by return temperature and operating conditions.
   * Presented as a spectrum — not a binary flag.
   */
  condensingLikelihood: CondensingLikelihood;

  /**
   * Short cycling risk at part load.
   * High cycling risk reduces effective efficiency and increases wear.
   */
  cyclingRisk: CyclingRisk;

  /**
   * Available modulation headroom.
   * Reflects the boiler's ability to fire at low output rates on mild days.
   */
  modulationHeadroom: ModulationHeadroom;

  /**
   * Degree to which emitter adequacy constrains lower-temperature operation.
   * Emitters are ONE factor, not the sole gateway to condensing.
   */
  emitterConstraint: EmitterConstraint;

  /**
   * Degree to which controls constrain lower-temperature operation.
   */
  controlConstraint: ControlConstraint;

  /**
   * Degree to which circulation constrains lower-temperature operation.
   */
  circulationConstraint: CirculationConstraint;

  /**
   * Short, physically honest explanation tags for UI display.
   *
   * Examples:
   *   'condensing likely'
   *   'condensing possible with current setup'
   *   'condensing limited by high return temperature'
   *   'lower flow temperature achievable'
   *   'cycling-limited efficiency'
   *   'modulation-limited'
   *   'emitter-limited'
   *   'control-limited'
   *   'circulation-limited'
   *   'good low-load match'
   *   'lower flow temperature achievable, but modulation-limited'
   *   'oversized emitters improving margin'
   *   'undersized rooms driving higher operating temperature'
   */
  explanationTags: string[];

  /**
   * Floor-plan emitter adequacy signal that was used to inform this state.
   * Passed through for provenance: consumers can inspect which rooms are
   * undersized or oversized without re-running the aggregation.
   * undefined when no floor plan data was provided.
   */
  floorplanEmitterAdequacy?: WholeSystemEmitterAdequacy;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Derive the required flow temperature from the emitter adequacy and compensation.
 *
 * Emitter oversizing reduces required flow temperature because larger or more
 * numerous heat-transfer surfaces can transfer the same heat at a lower mean
 * water temperature.
 *
 * Compensation further reduces the effective operating temperature by modulating
 * the setpoint in proportion to demand.
 */
function deriveRequiredFlowTempC(
  designFlowTempC: number,
  oversizingFactor: number,
  hasWeatherCompensation: boolean,
  hasLoadCompensation: boolean,
): number {
  // Highly oversized emitters (UFH / very large radiators) can operate much
  // cooler — map to a significantly lower required flow temperature.
  let tempC = designFlowTempC;

  if (oversizingFactor >= 1.5) {
    // UFH / highly oversized: required flow temp very low.
    // Scale down to approximate low-temperature design.
    tempC = Math.min(designFlowTempC, 45);
  } else if (oversizingFactor >= 1.3) {
    // Well oversized — lower flow temp is achievable.
    tempC = Math.min(designFlowTempC, 60);
  } else if (oversizingFactor >= 1.1) {
    // Moderate oversizing — modest reduction.
    tempC = Math.min(designFlowTempC, 70);
  }
  // Standard emitters (< 1.1): required flow temp is the design value.

  // Weather compensation reduces the effective operating temperature on mild days.
  // Approximate: WC lowers average seasonal flow temp by ~10 °C.
  if (hasWeatherCompensation) {
    tempC = Math.max(tempC - 10, 30);
  }

  // Load compensation provides additional reduction at part load.
  // Approximate: LC lowers average seasonal flow temp by a further ~5 °C.
  if (hasLoadCompensation) {
    tempC = Math.max(tempC - 5, 30);
  }

  return Math.round(tempC);
}

/**
 * Classify condensing likelihood from the estimated full-load return temperature
 * and additional operating conditions.
 *
 * Return temperature is the governing physics condition.
 * A system may still achieve meaningful condensing with standard emitters under
 * favourable load/control/modulation conditions (i.e. at typical UK part load).
 */
function deriveCondensingLikelihood(
  fullLoadReturnC: number,
  typicalLoadReturnC: number,
  hasCompensation: boolean,
  goodModulation: boolean,
): CondensingLikelihood {
  // Full-load return well below threshold → condensing throughout the season.
  if (fullLoadReturnC < CONDENSING_RETURN_THRESHOLD_C - 5) {
    return 'high';
  }

  // Full-load return below threshold → condensing at design load.
  if (fullLoadReturnC < CONDENSING_RETURN_THRESHOLD_C) {
    return 'high';
  }

  // Full-load return far above the high-return limit — condensing is structurally
  // limited: the emitters need a high flow temperature regardless of season.
  // This must be checked before the typical-load return path because the
  // "typical-load return" calculation assumes weather-compensated modulation;
  // without active compensation a fixed-setpoint boiler keeps the return high
  // even at lower demand.
  if (fullLoadReturnC > HIGH_RETURN_LIMIT_C) {
    return 'unlikely';
  }

  // Full-load return is above the 55 °C threshold but ≤ 65 °C (borderline zone).
  // Examine typical-load return and controls.
  // At typical UK mid-season conditions (~44 % of design load), the flow and
  // return temperatures are lower; compensation + modulation reduce them further.
  if (typicalLoadReturnC < CONDENSING_RETURN_THRESHOLD_C) {
    if (hasCompensation && goodModulation) {
      // System is in condensing range for most of the UK heating season.
      return 'medium';
    }
    if (hasCompensation || goodModulation) {
      // Condensing achievable at typical loads, but less reliably.
      return 'medium';
    }
    // Borderline zone, no active controls or modulation advantage.
    return 'low';
  }

  // Typical-load return is still above 55 °C — condensing very limited.
  return 'low';
}

/**
 * Derive cycling risk from boiler oversizing ratio and modulation capability.
 *
 * When the boiler can fire at a very high multiple of the current demand and
 * cannot turn down to match it, short cycling occurs.
 */
function deriveCyclingRisk(
  boilerOutputWatts: number | undefined,
  heatLossWatts: number | undefined,
  boilerMinModulationPct: number,
): CyclingRisk {
  if (boilerOutputWatts == null || heatLossWatts == null || heatLossWatts <= 0) {
    // Insufficient data — assume low risk (conservative; flag via explanationTags).
    return 'low';
  }

  const oversizingRatio = boilerOutputWatts / heatLossWatts;

  // If the boiler has good modulation headroom, it can turn down to match lower
  // loads without cycling.  Risk is primarily governed by modulation floor.
  if (oversizingRatio >= CYCLING_RISK_HIGH_RATIO && boilerMinModulationPct > LIMITED_MODULATION_FLOOR_PCT) {
    return 'high';
  }

  if (oversizingRatio >= CYCLING_RISK_MODERATE_RATIO && boilerMinModulationPct > GOOD_MODULATION_FLOOR_PCT) {
    return 'medium';
  }

  if (oversizingRatio >= CYCLING_RISK_HIGH_RATIO && boilerMinModulationPct > GOOD_MODULATION_FLOOR_PCT) {
    return 'medium';
  }

  return 'low';
}

/**
 * Classify emitter constraint — the degree to which emitters limit
 * lower-temperature operation.
 *
 * Emitters are ONE factor, not the sole gateway.  Standard radiators with
 * compensation are 'mild', not 'strong'.
 */
function deriveEmitterConstraint(
  oversizingFactor: number,
  condensingModeAvailable: boolean,
  hasCompensation: boolean,
): EmitterConstraint {
  if (condensingModeAvailable || oversizingFactor >= 1.3) {
    // Emitters explicitly support condensing operation.
    return 'none';
  }

  if (oversizingFactor >= 1.1) {
    // Moderate oversizing — mild constraint.
    return 'mild';
  }

  // Standard emitters.
  if (hasCompensation) {
    // Compensation partially offsets the emitter limitation — mild constraint.
    return 'mild';
  }

  // Standard emitters, no compensation — strong constraint on flow temperature.
  return 'strong';
}

/**
 * Classify control constraint — the degree to which controls limit
 * lower-temperature operation.
 */
function deriveControlConstraint(
  hasWeatherCompensation: boolean,
  hasLoadCompensation: boolean,
): ControlConstraint {
  if (hasWeatherCompensation && hasLoadCompensation) {
    return 'none';
  }
  if (hasWeatherCompensation || hasLoadCompensation) {
    return 'mild';
  }
  return 'strong';
}

/**
 * Classify circulation constraint from primary pipe diameter and heat loss.
 */
function deriveCirculationConstraint(
  primaryPipeDiameter: number,
  heatLossWatts: number | undefined,
): CirculationConstraint {
  if (primaryPipeDiameter >= 28) {
    return 'none';
  }

  // 22 mm primary (or smaller)
  if (heatLossWatts == null) {
    return 'mild'; // unknown load — conservative
  }

  if (heatLossWatts >= PRIMARY_HIGH_LOAD_W) {
    return 'strong';
  }

  if (heatLossWatts >= PRIMARY_MEDIUM_LOAD_W) {
    return 'mild';
  }

  return 'none';
}

/**
 * Build short explanation tags based on the derived constraints and likelihood.
 *
 * These tags are intended for UI display and must use only physically honest phrases.
 * They must not imply that condensing only happens with oversized radiators.
 */
function buildExplanationTags(
  condensingLikelihood: CondensingLikelihood,
  cyclingRisk: CyclingRisk,
  modulationHeadroom: ModulationHeadroom,
  emitterConstraint: EmitterConstraint,
  controlConstraint: ControlConstraint,
  circulationConstraint: CirculationConstraint,
  requiredFlowTempC: number | null,
  designFlowTempC: number,
): string[] {
  const tags: string[] = [];

  // Condensing status tag — spectrum, not binary.
  switch (condensingLikelihood) {
    case 'high':
      tags.push('condensing likely');
      break;
    case 'medium':
      tags.push('condensing possible with current setup');
      break;
    case 'low':
      tags.push('condensing limited by high return temperature');
      break;
    case 'unlikely':
      tags.push('condensing unlikely at design load');
      break;
  }

  // Flow temperature tag — highlight when a lower setpoint is achievable.
  if (requiredFlowTempC != null && requiredFlowTempC < designFlowTempC - MEANINGFUL_FLOW_REDUCTION_C) {
    if (modulationHeadroom === 'poor' || modulationHeadroom === 'limited') {
      tags.push('lower flow temperature achievable, but modulation-limited');
    } else {
      tags.push('lower flow temperature achievable');
    }
  }

  // Cycling risk tag.
  if (cyclingRisk === 'high' || cyclingRisk === 'medium') {
    tags.push('cycling-limited efficiency');
  }

  // Modulation headroom tag.
  if (modulationHeadroom === 'good') {
    tags.push('good low-load match');
  } else if (modulationHeadroom === 'poor') {
    tags.push('modulation-limited');
  }

  // Constraint tags — only flag when the constraint is meaningful.
  if (emitterConstraint === 'strong') {
    tags.push('emitter-limited');
  }
  if (controlConstraint === 'strong') {
    tags.push('control-limited');
  }
  if (circulationConstraint === 'strong') {
    tags.push('circulation-limited');
  }

  return tags;
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Build the canonical heating operating state from survey/simulator inputs.
 *
 * This is the single normalization layer that turns heating system parameters
 * into the operating-state object used by all consuming layers:
 *   - Simulator Dashboard (required flow temp, return temp, condensing state)
 *   - Compare mode (both current and proposed sides)
 *   - Advice / recommendation layers
 *   - Printable outputs
 *
 * Design rules:
 *   - Emitter oversizing is ONE factor, not the sole condensing gateway.
 *   - Return temperature governs condensing likelihood.
 *   - Standard radiators with good modulation/compensation can condense.
 *   - All assumptions are visible via requiredFlowTempC and estimatedReturnTempC.
 *   - Condensing is expressed as a spectrum (condensingLikelihood), not a binary.
 */
export function buildHeatingOperatingState(
  input: HeatingOperatingStateInput,
): HeatingOperatingState {
  const deltaT = input.deltaTc ?? DEFAULT_DELTA_T_C;

  // ── Emitter oversizing factor ─────────────────────────────────────────────
  // Priority: explicit override > floor-plan implied > condensingModeAvailable default > standard.
  const fp = input.floorplanEmitterAdequacy;
  // impliedOversizingFactor is guaranteed non-null when hasActualData is true (interface contract).
  const fpImpliedFactor = fp?.hasActualData ? fp.impliedOversizingFactor : null;
  const oversizingFactor =
    input.emitterOversizingFactor
    ?? fpImpliedFactor
    ?? (input.condensingModeAvailable ? 1.3 : 1.0);

  const boilerMinModulationPct = input.boilerMinModulationPct ?? 30;
  const hasWeatherCompensation = input.hasWeatherCompensation ?? false;
  const hasLoadCompensation = input.hasLoadCompensation ?? false;
  const hasCompensation = hasWeatherCompensation || hasLoadCompensation;
  const primaryPipeDiameter = input.primaryPipeDiameter ?? 22;

  // ── Required flow temperature ─────────────────────────────────────────────
  const requiredFlowTempC = deriveRequiredFlowTempC(
    input.flowTempC,
    oversizingFactor,
    hasWeatherCompensation,
    hasLoadCompensation,
  );

  // ── Estimated return temperatures ─────────────────────────────────────────
  const fullLoadReturnC = requiredFlowTempC - deltaT;

  // Typical UK part-load return — at ~44 % of design load.
  const typicalFlowC = 20 + (requiredFlowTempC - 20) * UK_TYPICAL_LOAD_FRACTION;
  const typicalLoadReturnC = typicalFlowC - deltaT;

  // ── Modulation headroom ───────────────────────────────────────────────────
  let modulationHeadroom: ModulationHeadroom;
  if (boilerMinModulationPct <= GOOD_MODULATION_FLOOR_PCT) {
    modulationHeadroom = 'good';
  } else if (boilerMinModulationPct <= LIMITED_MODULATION_FLOOR_PCT) {
    modulationHeadroom = 'limited';
  } else {
    modulationHeadroom = 'poor';
  }

  const goodModulation = modulationHeadroom === 'good';

  // ── Condensing likelihood ─────────────────────────────────────────────────
  const condensingLikelihood = deriveCondensingLikelihood(
    fullLoadReturnC,
    typicalLoadReturnC,
    hasCompensation,
    goodModulation,
  );

  // ── Cycling risk ──────────────────────────────────────────────────────────
  const cyclingRisk = deriveCyclingRisk(
    input.boilerOutputWatts,
    input.heatLossWatts,
    boilerMinModulationPct,
  );

  // ── Constraint assessments ────────────────────────────────────────────────
  const emitterConstraint = deriveEmitterConstraint(
    oversizingFactor,
    input.condensingModeAvailable ?? false,
    hasCompensation,
  );

  const controlConstraint = deriveControlConstraint(
    hasWeatherCompensation,
    hasLoadCompensation,
  );

  const circulationConstraint = deriveCirculationConstraint(
    primaryPipeDiameter,
    input.heatLossWatts,
  );

  // ── Explanation tags ──────────────────────────────────────────────────────
  const explanationTags = buildExplanationTags(
    condensingLikelihood,
    cyclingRisk,
    modulationHeadroom,
    emitterConstraint,
    controlConstraint,
    circulationConstraint,
    requiredFlowTempC,
    input.flowTempC,
  );

  // ── Floor-plan emitter tags ───────────────────────────────────────────────
  // Augment explanation tags with floor-plan-sourced room-level context when
  // actual installed emitter data is available.
  if (fp?.hasActualData) {
    const { coverageClassification, undersizedRooms } = fp;
    if (coverageClassification === 'all_oversized') {
      // All rooms have emitters well above heat demand — lower flow temp headroom.
      explanationTags.push('oversized emitters improving margin');
    } else if (coverageClassification === 'majority_undersized') {
      // Most rooms cannot meet demand at reduced flow temperatures.
      explanationTags.push('undersized rooms driving higher operating temperature');
    } else if (coverageClassification === 'mixed' && undersizedRooms.length > 0) {
      // Some rooms are undersized; ensure the emitter-limited tag is present.
      if (!explanationTags.includes('emitter-limited')) {
        explanationTags.push('emitter-limited');
      }
    }
  }

  return {
    requiredFlowTempC,
    estimatedReturnTempC: parseFloat(fullLoadReturnC.toFixed(1)),
    condensingLikelihood,
    cyclingRisk,
    modulationHeadroom,
    emitterConstraint,
    controlConstraint,
    circulationConstraint,
    explanationTags,
    floorplanEmitterAdequacy: fp,
  };
}

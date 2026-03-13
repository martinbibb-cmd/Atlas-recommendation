import type {
  CondensingStateInput,
  CondensingStateResult,
  CondensingReturnTempSource,
  CondensingZone,
} from '../schema/EngineInputV2_3';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Return temperature (°C) above which a gas boiler cannot recover latent heat
 * from flue gases — condensing mode is lost.
 * Consistent with CONDENSING_RETURN_THRESHOLD_C used in LegacyInfrastructureModule
 * and SystemOptimizationModule.
 */
export const CONDENSING_RETURN_THRESHOLD_C = 55;

/**
 * Upper boundary of the borderline zone (°C).
 * Full-load return temperatures between 55 °C and this value indicate a system
 * that exits condensing mode on peak-demand days but operates in condensing range
 * for the majority of the UK heating season.
 */
const BORDERLINE_UPPER_C = 65;

/** Standard ΔT across emitters for a UK two-pipe heating circuit. */
const DEFAULT_DELTA_T_C = 20;

/**
 * Part-load fraction at UK average outdoor heating-season temperature (~7 °C).
 *
 * Under a linear weather-compensation (WC) curve:
 *   fraction = (setpoint − outdoor) / (setpoint − design)
 *            = (15 − 7) / (15 − (−3)) = 8/18 ≈ 0.44
 *
 * Used to estimate the flow and return temperature on a typical UK day and to
 * derive the fraction of heating-season hours spent in condensing range.
 */
const UK_TYPICAL_LOAD_FRACTION = (15 - 7) / (15 - -3);

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * CondensingStateModule  —  lab-only diagnostic
 *
 * Classifies a heat source into one of three efficiency zones based on whether
 * its operating return temperature is below the condensing threshold (55 °C for
 * natural gas):
 *
 *  condensing     (green)  full-load return < 55 °C — always in condensing range
 *  borderline     (amber)  full-load return 55–65 °C — exits condensing at peak demand
 *  non_condensing (red)    full-load return > 65 °C — outside condensing range by design
 *
 * The module also estimates the fraction of UK heating-season hours spent in
 * condensing range, assuming a linear weather-compensation control curve.
 *
 * Purpose
 *  • Help explain that a "condensing boiler" does not always condense.
 *  • Show what operating conditions would move the heat source into condensing range.
 *  • Make the lab diagnostic useful for surveyor education.
 *
 * Guardrail: this is a lab-only diagnostic signal.
 * It must not appear in customer-facing recommendation copy.
 */
export function runCondensingStateModule(
  input: CondensingStateInput,
): CondensingStateResult {
  const deltaT = input.deltaTc ?? DEFAULT_DELTA_T_C;
  const flowTempC = input.flowTempC;

  // ── Full-load return temperature ──────────────────────────────────────────
  // Use the measured/simulated value when provided (e.g. one-pipe cascade model),
  // otherwise derive from design flow temperature minus the system ΔT.
  let returnTempSource: CondensingReturnTempSource;
  const fullLoadReturnC =
    input.returnTempC != null
      ? (returnTempSource = 'onePipeCascade', input.returnTempC)
      : (returnTempSource = 'derived', flowTempC - deltaT);

  // ── Typical UK part-load return estimate ──────────────────────────────────
  // Under a weather-compensation curve the boiler modulates toward 20 °C as
  // outdoor temperature rises.  At UK average heating-season outdoor ~7 °C the
  // load fraction is ~0.44; at that load:
  //   typicalFlow = 20 + (designFlow − 20) × loadFraction
  const loadFraction = input.averageLoadFraction ?? UK_TYPICAL_LOAD_FRACTION;
  const typicalFlowC = 20 + (flowTempC - 20) * loadFraction;
  const typicalReturnC = typicalFlowC - deltaT;

  // ── Zone classification ───────────────────────────────────────────────────
  let zone: CondensingZone;
  if (fullLoadReturnC < CONDENSING_RETURN_THRESHOLD_C) {
    zone = 'condensing';
  } else if (fullLoadReturnC <= BORDERLINE_UPPER_C) {
    zone = 'borderline';
  } else {
    zone = 'non_condensing';
  }

  // ── Estimated condensing fraction (weather-compensated assumption) ─────────
  // Under a linear WC curve, the boiler is in condensing range when the flow
  // temperature is below (CONDENSING_RETURN_THRESHOLD_C + deltaT).
  // Condensing flow threshold = 55 + 20 = 75 °C.
  //
  // The load fraction at which flow drops to the condensing threshold:
  //   flow = 20 + (designFlow − 20) × fraction
  //   → fraction = (condensingFlowThreshold − 20) / (designFlow − 20)
  //
  // Fraction of hours below that load fraction (uniform distribution approx.) = fraction.
  const condensingFlowThresholdC = CONDENSING_RETURN_THRESHOLD_C + deltaT;
  let estimatedCondensingFractionPct: number;
  if (flowTempC <= condensingFlowThresholdC) {
    estimatedCondensingFractionPct = 100;
  } else {
    const thresholdFraction =
      (condensingFlowThresholdC - 20) / (flowTempC - 20);
    estimatedCondensingFractionPct = Math.round(
      Math.max(0, Math.min(100, thresholdFraction * 100)),
    );
  }

  // ── Driver signals ────────────────────────────────────────────────────────
  const returnSourceLabel =
    returnTempSource === 'onePipeCascade' ? 'measured/simulated (one-pipe cascade)' : 'estimated (flowTempC − ΔT)';
  const drivers: string[] = [
    `Flow temperature: ${flowTempC} °C`,
    `Full-load return: ${fullLoadReturnC.toFixed(1)} °C (${returnSourceLabel})`,
    `Typical operating return: ${typicalReturnC.toFixed(1)} °C (UK avg load ${Math.round(loadFraction * 100)} %)`,
    `Condensing threshold: ${CONDENSING_RETURN_THRESHOLD_C} °C`,
    `Return temp source: ${returnTempSource}`,
  ];

  // ── Diagnostic notes ──────────────────────────────────────────────────────
  const notes: string[] = [];

  if (zone === 'condensing') {
    notes.push(
      `✅ Condensing Range: Full-load return temperature ${fullLoadReturnC.toFixed(1)} °C is ` +
      `below the ${CONDENSING_RETURN_THRESHOLD_C} °C condensing threshold. ` +
      `The heat source operates in condensing mode at all loads — ` +
      `latent heat recovery is active throughout the heating season.`,
    );
    notes.push(
      `💡 Operating efficiency is maximised: the boiler recovers latent heat from flue gases ` +
      `(~11 % of fuel energy for natural gas), lifting seasonal efficiency above the ` +
      `nominal nameplate rating.`,
    );
  } else if (zone === 'borderline') {
    notes.push(
      `⚠️ Borderline Condensing: Full-load return ${fullLoadReturnC.toFixed(1)} °C ` +
      `exceeds the ${CONDENSING_RETURN_THRESHOLD_C} °C threshold, so the heat source ` +
      `exits condensing mode on peak-demand days. ` +
      `At typical UK operating conditions (estimated return ~${typicalReturnC.toFixed(1)} °C) ` +
      `condensing mode is active. ` +
      `Estimated condensing fraction: ~${estimatedCondensingFractionPct} % of heating-season hours.`,
    );
    notes.push(
      `💡 To move into full condensing operation: reduce flow temperature (weather-compensating ` +
      `controller or lower thermostat setting) or increase emitter surface area to allow lower ` +
      `design temperatures. Every 1 °C reduction in return temperature below the 55 °C threshold ` +
      `recovers a portion of the latent-heat efficiency gain.`,
    );
  } else {
    notes.push(
      `🚫 Outside Condensing Range: Full-load return ${fullLoadReturnC.toFixed(1)} °C is ` +
      `well above the ${CONDENSING_RETURN_THRESHOLD_C} °C condensing threshold. ` +
      `The heat source is not recovering latent heat from flue gases — ` +
      `the "condensing" design advantage is not being realised at design load. ` +
      `Estimated condensing fraction (with weather compensation): ~${estimatedCondensingFractionPct} % of hours.`,
    );
    notes.push(
      `🔴 High flow temperature is the primary barrier. A condensing boiler only condenses ` +
      `under the right operating conditions — it is not an inherent property of the appliance. ` +
      `Significant emitter upgrades or system redesign are required to restore latent heat ` +
      `recovery at design-day conditions.`,
    );
  }

  return {
    zone,
    flowTempC,
    fullLoadReturnC: parseFloat(fullLoadReturnC.toFixed(1)),
    typicalReturnC: parseFloat(typicalReturnC.toFixed(1)),
    condensingThresholdC: CONDENSING_RETURN_THRESHOLD_C,
    estimatedCondensingFractionPct,
    returnTempSource,
    drivers,
    notes,
  };
}

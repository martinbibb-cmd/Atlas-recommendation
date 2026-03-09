import type { EngineInputV2_3, CombiDhwV1Result, CombiDhwFlagItem, CombiDhwRampPhase } from '../schema/EngineInputV2_3';

/**
 * Terminology rule
 *
 * Do not describe combi hot water as "instantaneous".
 * Use "on-demand hot water".
 *
 * Reason:
 * Combi systems require ignition, ramp-up, and stabilisation.
 * The simulator models this behaviour and should not imply
 * zero response time.
 */

// ─── Combi DHW ramp phase boundaries (seconds from tap open) ─────────────────

const RAMP_IGNITION_PURGE_END_S = 2;
const RAMP_TEMPERATURE_RAMP_END_S = 6;
const RAMP_STABILISING_END_S = 10;

/**
 * Return the combi DHW ramp phase for a given elapsed draw time.
 *
 * Phase timing (seconds from tap open):
 *   ignition_purge    0 – 2 s   fan start, gas valve, combustion ignition
 *   temperature_ramp  2 – 6 s   heat exchanger temperature rising
 *   stabilising       6 – 10 s  flow temperature approaching steady-state
 *   steady           10 s +    nominal delivery temperature reached
 *
 * @param elapsedS  Elapsed time in seconds since the hot-water draw started (≥ 0).
 * @returns The current {@link CombiDhwRampPhase}.
 */
export function getCombiDhwRampPhase(elapsedS: number): CombiDhwRampPhase {
  if (elapsedS < RAMP_IGNITION_PURGE_END_S) return 'ignition_purge';
  if (elapsedS < RAMP_TEMPERATURE_RAMP_END_S) return 'temperature_ramp';
  if (elapsedS < RAMP_STABILISING_END_S) return 'stabilising';
  return 'steady';
}

const PRESSURE_LOCKOUT_BAR = 1.0;

/** Minimum L/min per hot-water outlet for a combi to deliver acceptable flow. */
const REQUIRED_LPM_PER_OUTLET = 9;

/** Occupancy threshold above which combi should be rejected in favour of stored DHW. */
const LARGE_HOUSEHOLD_FAIL_THRESHOLD = 4;

/** Occupancy signatures that imply continuous / family-style use (short-draw risk). */
const SHORT_DRAW_SIGNATURES = new Set(['steady_home', 'steady', 'shift_worker', 'shift']);

// ─── DHW capacity constants ───────────────────────────────────────────────────

/**
 * Nominal combi boiler peak DHW heat output (kW).
 * Represents a typical UK combi in DHW priority mode (e.g. Worcester Bosch 32i).
 * At Cp=4.19, ΔT=25°C (cold 15°C → 40°C): ~17 L/min deliverable.
 * 30 kW is the realistic order-of-magnitude for UK combi DHW heat transfer capacity.
 */
const NOMINAL_COMBI_DHW_KW = 30;

// ─── DHW flow physics ─────────────────────────────────────────────────────────

/** Cp / 60: kW per (L/min) per °C. From specific heat of water: 4.186 kJ/(kg·K) ÷ 60 s/min. */
const DHW_KW_PER_LPM_PER_K = 4.186 / 60; // ≈ 0.0697

/** UK default cold-water mains temperature (°C). */
const COMBI_COLD_WATER_TEMP_C = 10;

/** Default combi DHW outlet temperature (°C) — hot water leaving the heat exchanger. */
const COMBI_HOT_OUT_TEMP_C = 50;

/**
 * Compute DHW heat transfer rate from volumetric flow and temperature rise.
 *
 *   kW = DHW_KW_PER_LPM_PER_K × flowLpm × deltaTc
 *
 * @param flowLpm   Volumetric flow rate (L/min).
 * @param deltaTc   Temperature rise (°C). Clamped to ≥ 0.
 */
function dhwKwFromFlow(flowLpm: number, deltaTc: number): number {
  return DHW_KW_PER_LPM_PER_K * flowLpm * Math.max(0, deltaTc);
}

// ─── Probabilistic DHW overlap model ─────────────────────────────────────────

/** Average hot-water draw duration per event during a shower/bath peak (minutes). */
const MORNING_PEAK_DRAW_DURATION_MIN = 7;

/** Duration of the morning DHW peak window (minutes): 06:00–09:00 = 3 hours. */
const MORNING_PEAK_WINDOW_MIN = 180;

/**
 * Lambda multiplier for multi-bathroom configurations.
 * When ≥2 bathrooms are available, simultaneous draws do not require
 * physical queueing — any two users CAN draw at the same time.  Doubling
 * the Poisson rate approximates this "no-queue" availability effect.
 */
const MULTI_BATHROOM_LAMBDA_MULTIPLIER = 2;

/**
 * Estimate the probability that ≥2 hot water draws overlap during the morning
 * peak (06:00–09:00) given occupancy count and bathroom count.
 *
 * Model: during a 3-hour morning window, each person takes one shower/bath draw
 * with an average duration of 7 minutes (combi industry standard).  Assuming
 * uniform random start times within the 180-minute window, the probability
 * that any two draws overlap is derived from the Poisson overlap approximation:
 *
 *   P(overlap) = 1 − exp(−λ)
 *
 * where λ = n × (n − 1) / 2 × (drawDurationMin / windowMin) scales with the
 * number of person-pairs and the fractional draw duration within the window.
 *
 * Capped at 0.99 to avoid numerical certainty.
 *
 * @param occupancyCount  Number of people regularly resident.
 * @param bathroomCount   Number of bathrooms (≥2 means near-certain overlap; hard gate).
 * @returns Probability 0–1, or null when inputs are insufficient.
 */
export function estimateMorningOverlapProbability(
  occupancyCount: number | undefined,
  bathroomCount: number,
): number | null {
  if (occupancyCount == null || occupancyCount <= 0) return null;

  const n = occupancyCount;
  if (n <= 1) return 0;

  const pairs = (n * (n - 1)) / 2;
  const baseLambda = pairs * (MORNING_PEAK_DRAW_DURATION_MIN / MORNING_PEAK_WINDOW_MIN);

  // With ≥2 bathrooms draws CAN be simultaneous (no queue) → scale lambda up.
  const lambda = bathroomCount >= 2
    ? baseLambda * MULTI_BATHROOM_LAMBDA_MULTIPLIER
    : baseLambda;

  return parseFloat(Math.min(0.99, 1 - Math.exp(-lambda)).toFixed(2));
}

/**
 * CombiDhwModuleV1
 *
 * Deterministic combi / on-demand DHW eligibility gate based on three
 * physics-grounded rules:
 *   1. Pressure lockout   – mains dynamic pressure < 1.0 bar (hard fail)
 *   2. Simultaneous demand – peak concurrent outlets ≥ 2 OR bathrooms ≥ 2 (hard fail)
 *   3. Short-draw collapse – continuous-occupancy signature (warn)
 *
 * @param input               Engine survey input.
 * @param dhwCapacityDeratePct Scale-induced DHW capacity derate (0–0.20) from
 *                             SludgeVsScaleModule.  Applied as:
 *                             maxQtoDhwKwDerated = NOMINAL_COMBI_DHW_KW × (1 − derate).
 */
export function runCombiDhwModuleV1(input: EngineInputV2_3, dhwCapacityDeratePct = 0): CombiDhwV1Result {  const flags: CombiDhwFlagItem[] = [];
  const assumptions: string[] = [];

  // ── Rule 1: Pressure lockout ─────────────────────────────────────────────
  const dynamicBar = input.dynamicMainsPressureBar ?? input.dynamicMainsPressure;
  if (dynamicBar != null && dynamicBar < PRESSURE_LOCKOUT_BAR) {
    flags.push({
      id: 'combi-pressure-lockout',
      severity: 'fail',
      title: 'Combi safety cut-off risk',
      detail:
        `Dynamic mains pressure ${dynamicBar.toFixed(1)} bar is below the ` +
        `${PRESSURE_LOCKOUT_BAR.toFixed(1)} bar minimum required for safe combi operation. ` +
        `The unit will lock out during simultaneous draws, causing cold-water slugs.`,
    });
  }

  // ── Rule 2: Simultaneous demand ──────────────────────────────────────────
  const outlets = input.peakConcurrentOutlets ?? null;
  const simultaneousFail = (outlets !== null && outlets >= 2) || input.bathroomCount >= 2;

  if (simultaneousFail) {
    const demandSource = outlets !== null && outlets >= 2
      ? `${outlets} concurrent outlets`
      : `${input.bathroomCount} bathrooms`;
    flags.push({
      id: 'combi-simultaneous-demand',
      severity: 'fail',
      title: 'Hot water starvation likely',
      detail:
        `${demandSource} detected. A combi boiler cannot sustain adequate flow to ` +
        `two or more simultaneous DHW points – expect cold-water interruptions and ` +
        `temperature oscillation between users.`,
    });
  } else if (outlets === null) {
    assumptions.push(
      'peakConcurrentOutlets not provided – assumed ≤ 1 for simultaneous-demand check.',
    );
  }

  // ── Rule 3: Short-draw collapse ──────────────────────────────────────────
  const isShortDrawRisk = SHORT_DRAW_SIGNATURES.has(input.occupancySignature);
  if (isShortDrawRisk) {
    flags.push({
      id: 'combi-short-draw-collapse',
      severity: 'warn',
      title: 'Short draws <15 s can drop efficiency below ~30%',
      detail:
        `"${input.occupancySignature}" occupancy implies frequent hand-washing and brief ` +
        `DHW draws. Draws shorter than ~15 seconds end before the heat exchanger reaches ` +
        `steady-state condensing mode, collapsing effective efficiency to ~28 %.`,
    });
  } else {
    assumptions.push(
      `Occupancy signature "${input.occupancySignature}" does not imply continuous DHW use – ` +
      'short-draw collapse warning omitted.',
    );
  }

  // ── Rule 4: Three-person household caution ───────────────────────────────
  if (input.occupancyCount === 3 && !simultaneousFail) {
    flags.push({
      id: 'combi-three-person-caution',
      severity: 'warn',
      title: '3-person household: borderline combi demand',
      detail:
        'Three occupants create borderline simultaneous DHW demand. A combi may cope on 1 bathroom ' +
        'but expect reduced comfort margins during back-to-back morning showers. ' +
        'A stored system removes this risk entirely.',
    });
  }

  // ── Rule 5: Large household DHW intensity ───────────────────────────────
  if (
    input.occupancyCount != null &&
    input.occupancyCount >= LARGE_HOUSEHOLD_FAIL_THRESHOLD &&
    !simultaneousFail
  ) {
    flags.push({
      id: 'combi-large-household',
      severity: 'fail',
      title: `Large household (${input.occupancyCount} people): combi rejected`,
      detail:
        `${input.occupancyCount} occupants create sustained DHW demand beyond practical combi ` +
        `comfort margins, even with a single bathroom. Specify a stored cylinder (vented or ` +
        `unvented) to avoid repeated hot-water recovery delays at peak times.`,
    });
  }

  // ── Rule 6: Mains flow adequacy ─────────────────────────────────────────
  if (input.mainsDynamicFlowLpmKnown && input.mainsDynamicFlowLpm != null) {
    const peakOutlets = Math.max(1, outlets ?? 1);
    const requiredLpm = REQUIRED_LPM_PER_OUTLET * peakOutlets;
    if (input.mainsDynamicFlowLpm < requiredLpm && !simultaneousFail) {
      const sev: CombiDhwFlagItem['severity'] = peakOutlets >= 2 ? 'fail' : 'warn';
      flags.push({
        id: 'combi-flow-inadequate',
        severity: sev,
        title: 'Mains flow may be insufficient for combi delivery',
        detail:
          `Measured mains flow ${input.mainsDynamicFlowLpm} L/min is below the ` +
          `~${requiredLpm} L/min needed for ${peakOutlets} outlet(s) at ΔT 25°C. ` +
          `Expect reduced shower temperature or pressure, especially during peak demand.`,
      });
    }
  } else if (input.mainsDynamicFlowLpm == null) {
    assumptions.push(
      'Mains dynamic flow not provided – flow adequacy check skipped. ' +
      'Record a measured L/min reading to enable this gate.',
    );
  }

  // ── Probabilistic morning overlap estimate ───────────────────────────────
  const morningOverlapProbability = estimateMorningOverlapProbability(
    input.occupancyCount,
    input.bathroomCount,
  );

  if (morningOverlapProbability !== null) {
    const pctLabel = `${Math.round(morningOverlapProbability * 100)}%`;
    assumptions.push(
      `Probabilistic DHW overlap model: estimated ${pctLabel} chance that ≥2 simultaneous ` +
      `hot-water draws overlap during the morning peak (06:00–09:00) based on ` +
      `${input.occupancyCount} occupants and ${input.bathroomCount} bathroom(s). ` +
      `Derived from Poisson overlap approximation with 7-min draw duration in a 3-hour window.`,
    );
  } else {
    assumptions.push('Morning overlap probability: occupancyCount not provided — estimate omitted.');
  }

  // ── DHW capacity derate from scale ──────────────────────────────────────
  // Scale on the combi heat exchanger reduces max DHW output power.
  // maxQtoDhwKw × (1 − dhwCapacityDeratePct) = derated peak output.
  // Cap at 0.50 as a safety guard against extreme/invalid inputs; the expected
  // maximum from SludgeVsScaleModule is 0.20 (MAX_DHW_CAPACITY_DERATE).
  const clampedDhwDerate = Math.min(dhwCapacityDeratePct, 0.50); // 0.50 = safety guard (expected max: 0.20)
  const maxQtoDhwKw = NOMINAL_COMBI_DHW_KW;

  // ── Plate HEX fouling factor (from survey-derived condition inference) ────
  // When present, the fouling factor represents the OBSERVED condition of the
  // plate heat exchanger. It is applied on top of the statistical scale derate:
  //   effectiveKw = maxQtoDhwKw × (1 − scaleDerate) × foulingFactor
  //
  // Fouling factor range: 1.0 (clean) → 0.7 (severe fouling, 30% reduction).
  // Combined with a 20% scale derate (worst statistical case), the maximum
  // total reduction is: 0.80 × 0.70 = 0.56 (44% below nominal).
  //
  // This is physically justified: scale on HX fins (scale derate) and fouling
  // of the plate HEX surface (fouling factor) are distinct phenomena that can
  // co-exist and are measured from different signal sources.
  const plateHexFoulingFactor = input.plateHexFoulingFactor ?? 1.0;
  const plateHexConditionBand = input.plateHexConditionBand;

  const maxQtoDhwKwDerated = parseFloat(
    (maxQtoDhwKw * (1 - clampedDhwDerate) * plateHexFoulingFactor).toFixed(1)
  );

  if (clampedDhwDerate > 0) {
    // Compute deliverable L/min from derated output: Q/(Cp×ΔT)×60 at ΔT=25°C (15→40°C)
    const deliverableLpm = parseFloat(
      (maxQtoDhwKwDerated * 60 / (4.19 * 25)).toFixed(1)
    );
    assumptions.push(
      `DHW Capacity Derate: scale on combi HX reduces peak output from ${maxQtoDhwKw} kW to ` +
      `${maxQtoDhwKwDerated} kW (−${(clampedDhwDerate * 100).toFixed(1)}%). ` +
      `Deliverable flow @40°C: ~${deliverableLpm} L/min (nominal ~${parseFloat((maxQtoDhwKw * 60 / (4.19 * 25)).toFixed(1))} L/min).`
    );
  }

  // Document plate HEX fouling effect in assumptions when degraded
  if (plateHexFoulingFactor < 1.0) {
    const foulingReductionPct = ((1.0 - plateHexFoulingFactor) * 100).toFixed(0);
    const effectiveKw = maxQtoDhwKwDerated;
    const effectiveLpm = parseFloat((effectiveKw * 60 / (4.19 * 25)).toFixed(1));
    // Effective warm-up lag increases as fouling reduces heat transfer
    const warmUpLagMultiplier = parseFloat((1.0 / plateHexFoulingFactor).toFixed(2));
    assumptions.push(
      `Plate HEX Fouling (${plateHexConditionBand ?? 'degraded'}): fouling factor ${plateHexFoulingFactor.toFixed(2)} ` +
      `reduces effective combi DHW output by ${foulingReductionPct}% — effective output ${effectiveKw} kW ` +
      `(~${effectiveLpm} L/min @40°C). Warm-up response approximately ${warmUpLagMultiplier}× baseline.`
    );
  }

  // ── DHW flow physics: required kW from actual mains flow ──────────────────
  // kW = 0.0697 × flowLpm × ΔT — physics-based demand from real measurements.
  // Only computed when a confirmed measured flow reading is available to avoid
  // false shortfall flags from estimated values.
  const coldWaterTempC = input.coldWaterTempC ?? COMBI_COLD_WATER_TEMP_C;
  const combiHotOutTempC = input.combiHotOutTempC ?? COMBI_HOT_OUT_TEMP_C;
  const deltaTC = combiHotOutTempC - coldWaterTempC;

  let dhwRequiredKw: number | null = null;
  let deliveredFlowLpm: number | null = null;

  if (input.mainsDynamicFlowLpmKnown && input.mainsDynamicFlowLpm != null && deltaTC > 0) {
    dhwRequiredKw = parseFloat(dhwKwFromFlow(input.mainsDynamicFlowLpm, deltaTC).toFixed(2));

    if (dhwRequiredKw > maxQtoDhwKwDerated) {
      deliveredFlowLpm = parseFloat(
        (maxQtoDhwKwDerated / (DHW_KW_PER_LPM_PER_K * deltaTC)).toFixed(1)
      );
      flags.push({
        id: 'combi-dhw-shortfall',
        severity: 'fail',
        title: 'Combi DHW shortfall: demand exceeds capacity',
        detail:
          `Mains flow ${input.mainsDynamicFlowLpm} L/min at ΔT ${deltaTC}°C requires ` +
          `${dhwRequiredKw.toFixed(1)} kW, which exceeds the derated combi output of ` +
          `${maxQtoDhwKwDerated} kW. Only ~${deliveredFlowLpm} L/min can be sustained at ` +
          `${combiHotOutTempC}°C — expect reduced shower temperature or pressure.`,
      });
    } else {
      deliveredFlowLpm = input.mainsDynamicFlowLpm;
      assumptions.push(
        `DHW flow physics: ${input.mainsDynamicFlowLpm} L/min at ΔT ${deltaTC}°C requires ` +
        `${dhwRequiredKw.toFixed(1)} kW — within derated combi output of ${maxQtoDhwKwDerated} kW.`
      );
    }
  }

  // Re-evaluate combiRisk after shortfall flag may have been added
  let combiRisk: CombiDhwV1Result['verdict']['combiRisk'];
  if (flags.some(f => f.severity === 'fail')) {
    combiRisk = 'fail';
  } else if (flags.some(f => f.severity === 'warn')) {
    combiRisk = 'warn';
  } else {
    combiRisk = 'pass';
  }

  return {
    verdict: { combiRisk },
    morningOverlapProbability,
    flags,
    assumptions,
    maxQtoDhwKw,
    maxQtoDhwKwDerated,
    dhwCapacityDeratePct: clampedDhwDerate,
    dhwRequiredKw,
    deliveredFlowLpm,
    ...(plateHexConditionBand !== undefined && { plateHexConditionBand }),
    // Only include plateHexFoulingFactor in the result when survey evidence was explicitly provided.
    // input.plateHexFoulingFactor is the explicit survey-derived value; the local plateHexFoulingFactor
    // variable defaults to 1.0 for physics calculations even when no survey data is present.
    ...(input.plateHexFoulingFactor !== undefined && { plateHexFoulingFactor: input.plateHexFoulingFactor }),
  };
}

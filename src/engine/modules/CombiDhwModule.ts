import type { EngineInputV2_3, CombiDhwV1Result, CombiDhwFlagItem } from '../schema/EngineInputV2_3';

const PRESSURE_LOCKOUT_BAR = 1.0;

/** Minimum L/min per hot-water outlet for a combi to deliver acceptable flow. */
const REQUIRED_LPM_PER_OUTLET = 9;

/** Occupancy threshold above which combi DHW intensity is flagged as high. */
const HIGH_OCCUPANCY_THRESHOLD = 5;

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
export function runCombiDhwModuleV1(input: EngineInputV2_3, dhwCapacityDeratePct = 0): CombiDhwV1Result {
  const flags: CombiDhwFlagItem[] = [];
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
  const simultaneousFail = outlets !== null && outlets >= 2;
  const simultaneousWarn = !simultaneousFail && input.bathroomCount >= 2;

  if (simultaneousFail) {
    const demandSource = `${outlets} concurrent outlets`;
    flags.push({
      id: 'combi-simultaneous-demand',
      severity: 'fail',
      title: 'Hot water starvation likely',
      detail:
        `${demandSource} detected. A combi boiler cannot sustain adequate flow to ` +
        `two or more simultaneous DHW points – expect cold-water interruptions and ` +
        `temperature oscillation between users.`,
    });
  } else if (simultaneousWarn) {
    const demandSource = `${input.bathroomCount} bathrooms`;
    flags.push({
      id: 'combi-simultaneous-demand',
      severity: 'warn',
      title: 'Hot water starvation likely',
      detail:
        `${demandSource} detected. With multiple bathrooms and simultaneous use, a combi ` +
        `boiler may struggle to deliver adequate flow to two DHW points at once – consider ` +
        `whether simultaneous draws are likely before specifying combi.`,
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
  if (input.occupancyCount === 3 && !simultaneousFail && !simultaneousWarn) {
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
    input.occupancyCount >= HIGH_OCCUPANCY_THRESHOLD &&
    !simultaneousFail
  ) {
    flags.push({
      id: 'combi-large-household',
      severity: 'warn',
      title: `Large household (${input.occupancyCount} people): high sequential DHW demand`,
      detail:
        `${input.occupancyCount} occupants create very high sequential hot-water demand even ` +
        `with a single bathroom. During the morning peak, back-to-back shower draws are ` +
        `near-certain, and a combi cannot maintain adequate temperature across all draws ` +
        `without extended wait times. A stored cylinder removes this limitation.`,
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

  // ── Determine overall combiRisk verdict ──────────────────────────────────
  let combiRisk: CombiDhwV1Result['verdict']['combiRisk'];
  if (flags.some(f => f.severity === 'fail')) {
    combiRisk = 'fail';
  } else if (flags.some(f => f.severity === 'warn')) {
    combiRisk = 'warn';
  } else {
    combiRisk = 'pass';
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
  const maxQtoDhwKwDerated = parseFloat(
    (maxQtoDhwKw * (1 - clampedDhwDerate)).toFixed(1)
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

  return {
    verdict: { combiRisk },
    morningOverlapProbability,
    flags,
    assumptions,
    maxQtoDhwKw,
    maxQtoDhwKwDerated,
    dhwCapacityDeratePct: clampedDhwDerate,
  };
}

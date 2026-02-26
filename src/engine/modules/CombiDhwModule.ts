import type { EngineInputV2_3, CombiDhwV1Result, CombiDhwFlagItem } from '../schema/EngineInputV2_3';

const PRESSURE_LOCKOUT_BAR = 1.0;

/** Occupancy signatures that imply continuous / family-style use (short-draw risk). */
const SHORT_DRAW_SIGNATURES = new Set(['steady_home', 'steady', 'shift_worker', 'shift']);

// ─── Probabilistic DHW overlap model ─────────────────────────────────────────

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

  // With ≥2 bathrooms, draws CAN be simultaneous by design → near-certain conflict.
  if (bathroomCount >= 2) {
    // Hard simultaneous-demand gate: high probability (not 1.0 to stay probabilistic)
    const n = occupancyCount;
    const pairs = (n * (n - 1)) / 2;
    const lambda = pairs * (7 / 180);
    return parseFloat(Math.min(0.99, 1 - Math.exp(-lambda * 2)).toFixed(2));
  }

  // Single bathroom: simultaneous draws require queueing.
  // λ scales with number of pairs × fractional draw time.
  const n = occupancyCount;
  if (n <= 1) return 0;

  const pairs = (n * (n - 1)) / 2;
  const drawDurationMin = 7;  // combi DHW draw duration (minutes)
  const windowMin = 180;      // morning peak window (3 hours)
  const lambda = pairs * (drawDurationMin / windowMin);

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
 */
export function runCombiDhwModuleV1(input: EngineInputV2_3): CombiDhwV1Result {
  const flags: CombiDhwFlagItem[] = [];
  const assumptions: string[] = [];

  // ── Rule 1: Pressure lockout ─────────────────────────────────────────────
  if (input.dynamicMainsPressure != null && input.dynamicMainsPressure < PRESSURE_LOCKOUT_BAR) {
    flags.push({
      id: 'combi-pressure-lockout',
      severity: 'fail',
      title: 'Combi safety cut-off risk',
      detail:
        `Dynamic mains pressure ${input.dynamicMainsPressure.toFixed(1)} bar is below the ` +
        `${PRESSURE_LOCKOUT_BAR.toFixed(1)} bar minimum required for safe combi operation. ` +
        `The unit will lock out during simultaneous draws, causing cold-water slugs.`,
    });
  }

  // ── Rule 2: Simultaneous demand ──────────────────────────────────────────
  const outlets = input.peakConcurrentOutlets ?? null;
  const simultaneousFail =
    (outlets !== null && outlets >= 2) || input.bathroomCount >= 2;

  if (simultaneousFail) {
    const demandSource =
      outlets !== null && outlets >= 2
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

  return { verdict: { combiRisk }, morningOverlapProbability, flags, assumptions };
}

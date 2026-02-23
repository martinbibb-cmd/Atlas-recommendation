import type { EngineInputV2_3, CombiDhwV1Result, CombiDhwFlagItem } from '../schema/EngineInputV2_3';

const PRESSURE_LOCKOUT_BAR = 1.0;

/** Occupancy signatures that imply continuous / family-style use (short-draw risk). */
const SHORT_DRAW_SIGNATURES = new Set(['steady_home', 'steady', 'shift_worker', 'shift']);

/**
 * CombiDhwModuleV1
 *
 * Deterministic combi / instantaneous DHW eligibility gate based on three
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

  // ── Determine overall combiRisk verdict ──────────────────────────────────
  let combiRisk: CombiDhwV1Result['verdict']['combiRisk'];
  if (flags.some(f => f.severity === 'fail')) {
    combiRisk = 'fail';
  } else if (flags.some(f => f.severity === 'warn')) {
    combiRisk = 'warn';
  } else {
    combiRisk = 'pass';
  }

  return { verdict: { combiRisk }, flags, assumptions };
}

import type { EngineInputV2_3, HeatPumpRegimeModuleV1Result, HeatPumpRegimeFlagItem } from '../schema/EngineInputV2_3';

// ─── Bilinear COP constants ───────────────────────────────────────────────────

/**
 * Reference COP at EN14511 standard test conditions:
 *   outdoor = +7 °C, flow = 35 °C (optimal low-temperature design).
 * Anchored to the midpoint of the FULL_JOB_SPF range (3.8–4.4 → 4.1).
 */
const REF_COP = 4.1;

/**
 * COP gain per 1 °C increase in outdoor temperature above the reference.
 * Derived from EN14511 test data across the −10 °C to +15 °C outdoor range.
 */
const OUTDOOR_TEMP_SENSITIVITY = 0.10;

/**
 * COP loss per 1 °C increase in flow temperature above the reference (35 °C).
 * Matches the COP collapse observed when moving from 35 °C to 50 °C flow
 * (SPF 4.1 → 3.05, i.e. ~1.05 drop over 15 °C → ~0.07/°C).
 */
const FLOW_TEMP_SENSITIVITY = 0.07;

/** Reference outdoor temperature for EN14511 standard testing (°C). */
const REF_OUTDOOR_TEMP_C = 7;

/** Reference design flow temperature (°C) — optimal for ASHP. */
const REF_FLOW_TEMP_C = 35;

/** EN14511 standard outdoor test temperature (°C). */
const STANDARD_OUTDOOR_TEMP_C = 7;

/** UK cold-morning design outdoor temperature (°C). */
const COLD_MORNING_OUTDOOR_TEMP_C = -3;

/** Minimum credible ASHP COP (compressor still running). */
const MIN_COP = 1.5;

/** Maximum credible ASHP COP (thermal losses and real-world degradation). */
const MAX_COP = 5.0;

/**
 * Bilinear ASHP COP approximation.
 *
 * COP = REF_COP
 *       + OUTDOOR_TEMP_SENSITIVITY × (outdoorTempC − REF_OUTDOOR_TEMP_C)
 *       − FLOW_TEMP_SENSITIVITY    × (flowTempC    − REF_FLOW_TEMP_C)
 *
 * Calibrated anchor points:
 *   COP(+7°C, 35°C) ≈ 4.10  (full-job optimal)
 *   COP(+7°C, 50°C) ≈ 3.05  (fast-fit at EN14511 outdoor temp)
 *   COP(−3°C, 35°C) ≈ 3.10  (cold morning, low-temp system)
 *   COP(−3°C, 50°C) ≈ 2.05  (cold morning, high-temp system)
 *
 * Result is clamped to [1.5, 5.0] to exclude physically implausible values.
 */
export function computeAshpCop(outdoorTempC: number, flowTempC: number): number {
  const raw =
    REF_COP +
    OUTDOOR_TEMP_SENSITIVITY * (outdoorTempC - REF_OUTDOOR_TEMP_C) -
    FLOW_TEMP_SENSITIVITY    * (flowTempC    - REF_FLOW_TEMP_C);
  return parseFloat(Math.min(MAX_COP, Math.max(MIN_COP, raw)).toFixed(2));
}

/**
 * HeatPumpRegimeModuleV1
 *
 * Derives the design flow temperature band and expected SPF band for an ASHP
 * installation based on the installer / homeowner's emitter upgrade appetite.
 *
 * Physics:
 *   - 35°C flow  → high SPF (good). Requires full emitter upgrade (UFH or oversized rads).
 *   - 45°C flow  → moderate SPF (ok). Partial upgrade — some rads replaced / UFH in wet rooms.
 *   - 50°C flow  → poor SPF.  Minimal change — keep existing rads at near-conventional temps.
 *
 * Lower flow temps increase SPF; high flow temps collapse COP.
 */
export function runHeatPumpRegimeModuleV1(input: EngineInputV2_3): HeatPumpRegimeModuleV1Result {
  const appetite = input.retrofit?.emitterUpgradeAppetite ?? 'none';

  let designFlowTempBand: 35 | 45 | 50;
  let spfBand: 'good' | 'ok' | 'poor';

  switch (appetite) {
    case 'full_job':
      designFlowTempBand = 35;
      spfBand = 'good';
      break;
    case 'some':
      designFlowTempBand = 45;
      spfBand = 'ok';
      break;
    case 'none':
    default:
      designFlowTempBand = 50;
      spfBand = 'poor';
      break;
  }

  // ── Bilinear COP estimates ────────────────────────────────────────────────
  const designCopEstimate = computeAshpCop(STANDARD_OUTDOOR_TEMP_C, designFlowTempBand);
  const coldMorningCopEstimate = computeAshpCop(COLD_MORNING_OUTDOOR_TEMP_C, designFlowTempBand);

  const flags: HeatPumpRegimeFlagItem[] = [];
  const assumptions: string[] = [
    'Lower flow temps increase SPF; high flow temps collapse COP.',
    'SPF estimated at design conditions — actual performance varies with climate and occupancy.',
    `Bilinear COP model: REF_COP=${REF_COP} at +${REF_OUTDOOR_TEMP_C}°C outdoor / ${REF_FLOW_TEMP_C}°C flow. ` +
    `Sensitivity: +${OUTDOOR_TEMP_SENSITIVITY}/°C outdoor, −${FLOW_TEMP_SENSITIVITY}/°C flow.`,
  ];

  if (designFlowTempBand === 50) {
    flags.push({
      id: 'regime-flow-temp-elevated',
      severity: 'warn',
      title: 'Elevated flow temperature',
      detail:
        'Operating at 50°C flow significantly reduces heat pump efficiency. ' +
        'Consider upgrading emitters to unlock lower flow temps and higher SPF.',
    });
    flags.push({
      id: 'regime-cop-penalty',
      severity: 'warn',
      title: 'COP penalty at high flow temp',
      detail:
        'Every 1°C rise in flow temperature above 35°C costs approximately 2–3% COP. ' +
        'At 50°C vs 35°C, seasonal SPF can drop from ~3.5 to ~2.5.',
    });
    flags.push({
      id: 'regime-full-job-unlocks-low-temp',
      severity: 'info',
      title: 'Full job unlocks low-temp + higher SPF',
      detail:
        'Upgrading all emitters to low-temperature radiators or underfloor heating ' +
        'enables 35°C design flow, which is the optimal operating point for an ASHP.',
    });
  } else if (designFlowTempBand === 45) {
    flags.push({
      id: 'regime-cop-penalty',
      severity: 'info',
      title: 'Moderate COP at 45°C flow',
      detail:
        'Partial emitter upgrades allow 45°C flow. SPF will be moderate (~3.0–3.2). ' +
        'Full emitter upgrade would unlock 35°C and better SPF.',
    });
    flags.push({
      id: 'regime-full-job-unlocks-low-temp',
      severity: 'info',
      title: 'Full job unlocks low-temp + higher SPF',
      detail:
        'Upgrading all emitters to low-temperature radiators or underfloor heating ' +
        'enables 35°C design flow, which is the optimal operating point for an ASHP.',
    });
  }

  return { designFlowTempBand, spfBand, designCopEstimate, coldMorningCopEstimate, flags, assumptions };
}

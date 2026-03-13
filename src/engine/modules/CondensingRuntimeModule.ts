import type {
  CondensingRuntimeInput,
  CondensingRuntimeResult,
  CondensingRuntimeDriver,
  CondensingRuntimeDriverId,
  CondensingRuntimeDriverInfluence,
} from '../schema/EngineInputV2_3';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Heat-loss threshold (W) above which a 22 mm primary pipe is treated as a
 * medium-load concern for the primary-suitability proxy.
 * Conservative — primary lengths are unknown.
 */
const PRIMARY_MEDIUM_LOAD_W = 10_000;

/**
 * Heat-loss threshold (W) above which a 22 mm primary pipe is treated as a
 * higher-load concern for the primary-suitability proxy.
 */
const PRIMARY_HIGH_LOAD_W = 14_000;

// ─── Driver builders ─────────────────────────────────────────────────────────

function makeDriver(
  id: CondensingRuntimeDriverId,
  label: string,
  influence: CondensingRuntimeDriverInfluence,
  scoreContribution: number,
  detail: string,
): CondensingRuntimeDriver {
  return { id, label, influence, scoreContribution, detail };
}

// ─── Individual driver assessments ───────────────────────────────────────────

/**
 * Driver 1 — current_condensing_state
 *
 * Derives the baseline estimated condensing fraction and the driver summary
 * from the existing CondensingStateModule result.
 * Score contribution is 0 because the base score already reflects this.
 */
function assessCurrentCondensingState(
  input: CondensingRuntimeInput,
): CondensingRuntimeDriver {
  const { zone, estimatedCondensingFractionPct } = input.condensingState;
  if (zone === 'condensing') {
    return makeDriver(
      'current_condensing_state',
      'Current condensing state',
      'positive',
      0,
      `System operates in condensing range at design load (estimated ${estimatedCondensingFractionPct} % of heating season).`,
    );
  }
  if (zone === 'borderline') {
    return makeDriver(
      'current_condensing_state',
      'Current condensing state',
      'neutral',
      0,
      `Borderline condensing: exits condensing range at peak demand (estimated ${estimatedCondensingFractionPct} % of heating season).`,
    );
  }
  return makeDriver(
    'current_condensing_state',
    'Current condensing state',
    'negative',
    0,
    `Outside condensing range at design load (estimated ${estimatedCondensingFractionPct} % of heating season with weather compensation).`,
  );
}

/**
 * Driver 2 — design_flow_temperature
 *
 * Reports the flow temperature band.  Score contribution is 0 because the
 * physics base already incorporates it via CondensingStateModule.
 */
function assessDesignFlowTemperature(
  input: CondensingRuntimeInput,
): CondensingRuntimeDriver {
  const { flowTempC } = input;
  if (flowTempC <= 65) {
    return makeDriver(
      'design_flow_temperature',
      'Design flow temperature',
      'positive',
      0,
      `Flow temperature ${flowTempC} °C — supports a larger fraction of condensing hours.`,
    );
  }
  if (flowTempC <= 75) {
    return makeDriver(
      'design_flow_temperature',
      'Design flow temperature',
      'neutral',
      0,
      `Flow temperature ${flowTempC} °C — at the borderline condensing threshold.`,
    );
  }
  return makeDriver(
    'design_flow_temperature',
    'Design flow temperature',
    'negative',
    0,
    `Flow temperature ${flowTempC} °C — limits condensing hours to lower-demand periods.`,
  );
}

/**
 * Driver 3 — emitter_suitability
 *
 * When condensing mode is not achievable (emitters need too high a flow temp),
 * apply a moderate penalty.
 */
function assessEmitterSuitability(
  input: CondensingRuntimeInput,
): CondensingRuntimeDriver {
  if (input.condensingModeAvailable) {
    return makeDriver(
      'emitter_suitability',
      'Emitter suitability',
      'positive',
      5,
      'Emitters support condensing operation at the target flow temperature.',
    );
  }
  return makeDriver(
    'emitter_suitability',
    'Emitter suitability',
    'negative',
    -10,
    'Emitters require a higher flow temperature — condensing mode is limited.',
  );
}

/**
 * Driver 4 — control_type
 *
 * Uses installation policy as a proxy for control quality / weather
 * compensation. Full-job installs are assumed to include weather-compensating
 * or smart controls; high-temp retrofits run at fixed high temperatures.
 */
function assessControlType(
  input: CondensingRuntimeInput,
): CondensingRuntimeDriver {
  if (input.installationPolicy === 'full_job') {
    return makeDriver(
      'control_type',
      'Control type',
      'positive',
      5,
      'Full installation — weather-compensating or smart controls support lower operating temperatures.',
    );
  }
  return makeDriver(
    'control_type',
    'Control type',
    'negative',
    -8,
    'High-temperature retrofit — fixed high flow temperature limits condensing hours.',
  );
}

/**
 * Driver 5 — system_separation_arrangement
 *
 * S-plan (twin 2-port zone valves) provides independent heating and DHW
 * circuits, which reduces awkward mixed-path behaviour and supports steadier
 * boiler operation.  This is a modest-to-medium positive driver.
 *
 * Y-plan is the neutral baseline; unknown defaults to neutral.
 *
 * Important: this driver represents control/separation quality only.
 * It is NOT equivalent to increasing primary carrying capacity — that is
 * captured separately by primary_suitability_proxy (driver 7).
 */
function assessSystemSeparationArrangement(
  input: CondensingRuntimeInput,
): CondensingRuntimeDriver {
  if (input.systemPlanType === 's_plan') {
    return makeDriver(
      'system_separation_arrangement',
      'System separation arrangement',
      'positive',
      7,
      'S-plan: separated heating and hot water control supports steadier operation.',
    );
  }
  if (input.systemPlanType === 'y_plan') {
    return makeDriver(
      'system_separation_arrangement',
      'System separation arrangement',
      'neutral',
      0,
      'Y-plan: combined mid-position valve — workable at modest loads; less separation than S-plan.',
    );
  }
  // Unknown / not provided
  return makeDriver(
    'system_separation_arrangement',
    'System separation arrangement',
    'neutral',
    0,
    'System zone arrangement not recorded — assuming Y-plan baseline.',
  );
}

/**
 * Driver 6 — dhw_demand_stability
 *
 * Mixergy cylinders use top-down heating and active stratification to mirror
 * demand more closely, which reduces cycling penalties compared to a standard
 * combi or vented cylinder.  Absent a DHW tank (combi-style) imposes a small
 * penalty because DHW demand temporarily overrides heating demand.
 */
function assessDhwDemandStability(
  input: CondensingRuntimeInput,
): CondensingRuntimeDriver {
  if (input.dhwTankType === 'mixergy') {
    return makeDriver(
      'dhw_demand_stability',
      'DHW demand stability',
      'positive',
      5,
      'Mixergy cylinder: demand mirroring and reduced cycling penalty support steadier condensing operation.',
    );
  }
  if (input.dhwTankType === 'standard') {
    return makeDriver(
      'dhw_demand_stability',
      'DHW demand stability',
      'neutral',
      0,
      'Standard cylinder: DHW demand is predictable and does not significantly disrupt heating operation.',
    );
  }
  // No DHW tank (combi / undefined)
  return makeDriver(
    'dhw_demand_stability',
    'DHW demand stability',
    'neutral',
    -2,
    'On-demand DHW: instantaneous draws may briefly interrupt steady heating operation.',
  );
}

/**
 * Driver 7 — primary_suitability_proxy
 *
 * Inferred from primary pipe diameter and building heat loss.  Primary lengths
 * are unknown so this must remain conservative.
 *
 * 28 mm primary: better capacity headroom — slight positive.
 * 22 mm primary at higher load (≥ 14 kW): may limit lower-temperature
 *   operation — moderate negative, consistent with the wording
 *   "Primary performance may limit lower-temperature operation at higher loads".
 * 22 mm primary at medium load (≥ 10 kW): slight concern — small negative.
 * 22 mm primary at lower load (< 10 kW): no concern at this output band.
 *
 * Important: this driver is intentionally SEPARATE from
 * system_separation_arrangement (driver 5).  S-plan conversion and primary
 * upgrades are distinct real-world levers with different costs and benefits.
 */
function assessPrimarySuitabilityProxy(
  input: CondensingRuntimeInput,
): CondensingRuntimeDriver {
  const { primaryPipeDiameter, heatLossWatts } = input;

  if (primaryPipeDiameter >= 28) {
    return makeDriver(
      'primary_suitability_proxy',
      'Primary suitability',
      'positive',
      3,
      '28 mm primary provides better flow capacity and headroom for lower-temperature operation.',
    );
  }

  // 22 mm primary (or unknown smaller size)
  if (heatLossWatts >= PRIMARY_HIGH_LOAD_W) {
    return makeDriver(
      'primary_suitability_proxy',
      'Primary suitability',
      'negative',
      -8,
      `22 mm primary at ${(heatLossWatts / 1000).toFixed(1)} kW — primary performance may limit lower-temperature operation at higher loads.`,
    );
  }

  if (heatLossWatts >= PRIMARY_MEDIUM_LOAD_W) {
    return makeDriver(
      'primary_suitability_proxy',
      'Primary suitability',
      'negative',
      -3,
      `22 mm primary at ${(heatLossWatts / 1000).toFixed(1)} kW — slight primary concern; conservative assessment (primary lengths unknown).`,
    );
  }

  // Lower load band — 22 mm is adequate
  return makeDriver(
    'primary_suitability_proxy',
    'Primary suitability',
    'neutral',
    0,
    `22 mm primary at ${(heatLossWatts / 1000).toFixed(1)} kW — adequate at this output band.`,
  );
}

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * CondensingRuntimeModule  —  v1 estimated condensing runtime model
 *
 * Extends the CondensingStateModule physics base with seven separate driver
 * assessments to produce an estimated fraction of heating-season hours the
 * boiler is likely to spend in condensing range.
 *
 * v1 driver set
 *   1. current_condensing_state       — base from CondensingStateModule
 *   2. design_flow_temperature        — base from CondensingStateModule
 *   3. emitter_suitability            — emitter adequacy for condensing
 *   4. control_type                   — weather comp / control quality
 *   5. system_separation_arrangement  — S-plan vs Y-plan (modest–medium)
 *   6. dhw_demand_stability           — Mixergy demand-mirroring benefit
 *   7. primary_suitability_proxy      — primary pipe capacity at given load
 *
 * Architecture guardrail
 *   Drivers 5 and 7 are SEPARATE levers and must not be merged into a single
 *   "hydraulic improvement" contribution.  S-plan conversion (≈ £500–600) and
 *   primary upgrades (significantly more) are distinct real-world interventions.
 *
 * Guardrail: lab-only model output.
 * Must not appear in customer-facing recommendation copy.
 */
export function runCondensingRuntimeModule(
  input: CondensingRuntimeInput,
): CondensingRuntimeResult {
  // ── Base score: physics estimate from CondensingStateModule ───────────────
  const basePct = input.condensingState.estimatedCondensingFractionPct;

  // ── Assess each driver ────────────────────────────────────────────────────
  const d1 = assessCurrentCondensingState(input);
  const d2 = assessDesignFlowTemperature(input);
  const d3 = assessEmitterSuitability(input);
  const d4 = assessControlType(input);
  const d5 = assessSystemSeparationArrangement(input);
  const d6 = assessDhwDemandStability(input);
  const d7 = assessPrimarySuitabilityProxy(input);

  const drivers: CondensingRuntimeDriver[] = [d1, d2, d3, d4, d5, d6, d7];

  // ── Sum adjustments (drivers 3–7 only; 1 and 2 are informational) ─────────
  const totalAdjustment = d3.scoreContribution
    + d4.scoreContribution
    + d5.scoreContribution
    + d6.scoreContribution
    + d7.scoreContribution;

  const estimatedCondensingRuntimePct = Math.round(
    Math.max(0, Math.min(100, basePct + totalAdjustment)),
  );

  // ── Wording strings ───────────────────────────────────────────────────────
  const positiveWording: string[] = [];
  const negativeWording: string[] = [];

  if (d5.influence === 'positive') {
    positiveWording.push('Separated heating and hot water control supports steadier operation.');
  }
  if (d7.influence === 'negative') {
    negativeWording.push('Primary performance may limit lower-temperature operation at higher loads.');
  }
  if (d3.influence === 'negative') {
    negativeWording.push('Emitter suitability limits achievable condensing operation.');
  }
  if (d4.influence === 'negative') {
    negativeWording.push('Fixed high flow temperature (no weather compensation) reduces condensing hours.');
  }
  if (d3.influence === 'positive') {
    positiveWording.push('Emitters support condensing operation at the target flow temperature.');
  }
  if (d4.influence === 'positive') {
    positiveWording.push('Weather-compensating or smart controls support lower operating temperatures.');
  }
  if (d6.influence === 'positive') {
    positiveWording.push('Mixergy demand mirroring reduces cycling and supports steadier condensing operation.');
  }
  if (d7.influence === 'positive') {
    positiveWording.push('28 mm primary provides headroom for lower-temperature operation.');
  }

  // ── Diagnostic notes ──────────────────────────────────────────────────────
  const notes: string[] = [
    `Physics base (CondensingStateModule): ${basePct} % estimated condensing fraction.`,
    `Driver adjustments (emitter, control, separation, DHW, primary): ${totalAdjustment >= 0 ? '+' : ''}${totalAdjustment} pp.`,
    `Estimated condensing runtime: ${estimatedCondensingRuntimePct} %.`,
    `Driver 5 (system_separation_arrangement) and driver 7 (primary_suitability_proxy) are independent ` +
      `levers — S-plan conversion and primary upgrades have different costs and physics effects.`,
  ];

  return {
    estimatedCondensingRuntimePct,
    drivers,
    positiveWording,
    negativeWording,
    notes,
  };
}

/**
 * SystemConditionImpactModule
 *
 * Deterministic helpers for the "System Condition Impact" visualiser (Step 8 Results).
 *
 * Derives "As Found" vs "After Flush + Filter" metrics from existing engine outputs
 * (SludgeVsScaleResult, HydraulicResult, NormalizerOutput) with no Math.random().
 *
 * Physics model:
 *  - CH shortfall is caused by primary-circuit sludge restricting flow.
 *  - DHW stability loss is caused by scale reducing DHW HX capacity.
 *  - Efficiency decay is from the normalizer's 10-year model.
 *  - Velocity outside band uses a UK heating load distribution (Gaussian).
 */

import type { SludgeVsScaleResult } from '../schema/EngineInputV2_3';

// Recommended hydraulic velocity band for primary copper pipework (m/s)
const VELOCITY_LOWER_M_S = 0.8;
const VELOCITY_UPPER_M_S = 1.5;

// UK heating season load distribution parameters (dimensionless fraction of design load)
// Derived from a normal distribution N(μ=0.65, σ=0.20) fitted to annual degree-day data.
const LOAD_MEAN = 0.65;
const LOAD_SD = 0.20;

// Sigmoid approximation of the normal CDF (accurate within ±0.01 for |z| < 4)
function normalCDF(z: number): number {
  return 1 / (1 + Math.exp(-1.7 * z));
}

/**
 * computeVelocityOutsideBandPct
 *
 * Returns the estimated percentage of annual heating hours during which the
 * primary-circuit hydraulic velocity exceeds the recommended upper limit of
 * 1.5 m/s, based on a UK annual heating-load distribution.
 *
 * Physics:
 *   - Velocity scales linearly with flow, which scales linearly with heat demand.
 *   - UK heat demand follows approximately N(μ=0.65, σ=0.20) × design load.
 *   - Hours outside band = P(load > 1.5/velocityMs) × 100.
 *
 * @param velocityMs  Velocity at design (peak) conditions in m/s.
 * @returns           Percentage of heating hours outside the 0.8–1.5 m/s band (0–90).
 */
export function computeVelocityOutsideBandPct(velocityMs: number): number {
  if (velocityMs <= VELOCITY_UPPER_M_S) return 0;
  // Fraction of design load above which velocity exceeds the safe limit
  const loadThreshold = VELOCITY_UPPER_M_S / velocityMs;
  const z = (loadThreshold - LOAD_MEAN) / LOAD_SD;
  const pctAbove = (1 - normalCDF(z)) * 100;
  return Math.round(Math.min(90, Math.max(0, pctAbove)));
}

/**
 * computeDesignVelocityMs
 *
 * Recovers the design (no-sludge) velocity from the as-found velocity and
 * the sludge flow derate, using the relationship:
 *   asFoundFlow = designFlow / (1 − flowDeratePct)
 *   → designVelocity = asFoundVelocity × (1 − flowDeratePct)
 */
export function computeDesignVelocityMs(
  asFoundVelocityMs: number,
  flowDeratePct: number,
): number {
  return parseFloat((asFoundVelocityMs * (1 - flowDeratePct)).toFixed(2));
}

export interface ConditionMetrics {
  /** CH heating shortfall at peak morning demand (%) */
  chShortfallPct: number;
  /** DHW capacity reduction vs nominal (%) */
  dhwCapacityReductionPct: number;
  /** Boiler seasonal efficiency (%) */
  efficiencyPct: number;
  /** Primary circuit velocity at design conditions (m/s) */
  velocityMs: number;
  /** Percentage of heating hours outside the 0.8–1.5 m/s velocity band */
  velocityOutsideBandPct: number;
}

export interface ConditionImpactResult {
  /** "As Found" — current degraded condition */
  asFound: ConditionMetrics;
  /** "After Flush + Filter" — restored condition */
  restored: ConditionMetrics;
  /** Reduction in CH peak shortfall achieved by restoration (percentage points) */
  chShortfallReductionPct: number;
  /** Years of gradual accumulation (from systemAgeYears) */
  systemAgeYears: number;
  /** Scale thickness on DHW HX as estimated by SludgeVsScaleModule (mm) */
  estimatedScaleThicknessMm: number;
}

/**
 * computeConditionImpactMetrics
 *
 * Derives before/after performance metrics for the System Condition Impact panel.
 * All values are deterministic — no randomness.
 *
 * Efficiency values are passed directly rather than computed from the normalizer
 * because the caller (FullSurveyResults) already resolves nominal and current
 * efficiency via resolveNominalEfficiencyPct / computeCurrentEfficiencyPct.
 *
 * @param sludge        Output from SludgeVsScaleModule for the surveyed system.
 * @param velocityMs    Current (as-found) primary-circuit velocity in m/s.
 *                      Use hydraulic.velocityMs (legacy) or hydraulicV1.ashp.velocityMs.
 * @param nominalEffPct Boiler nominal (as-installed) efficiency (%).
 * @param currentEffPct Current (decayed) boiler efficiency (%).
 * @param systemAgeYears System age in years.
 */
export function computeConditionImpactMetrics(
  sludge: Pick<SludgeVsScaleResult, 'flowDeratePct' | 'dhwCapacityDeratePct' | 'estimatedScaleThicknessMm'>,
  velocityMs: number,
  nominalEffPct: number,
  currentEffPct: number,
  systemAgeYears: number,
): ConditionImpactResult {
  // ── "As Found" metrics ────────────────────────────────────────────────────
  // CH shortfall: proportional to flow derate (higher flow demand → unmet at peak)
  const asFoundChShortfall = parseFloat((sludge.flowDeratePct * 100).toFixed(1));
  // DHW capacity reduction: from DHW heat-exchanger scale
  const asFoundDhwReduction = parseFloat((sludge.dhwCapacityDeratePct * 100).toFixed(1));
  // Velocity: as-found (already elevated by sludge-driven flow demand)
  const asFoundVelocity = velocityMs;
  const asFoundVelocityOutsideBand = computeVelocityOutsideBandPct(asFoundVelocity);

  const asFound: ConditionMetrics = {
    chShortfallPct: asFoundChShortfall,
    dhwCapacityReductionPct: asFoundDhwReduction,
    efficiencyPct: parseFloat(currentEffPct.toFixed(1)),
    velocityMs: parseFloat(asFoundVelocity.toFixed(2)),
    velocityOutsideBandPct: asFoundVelocityOutsideBand,
  };

  // ── "After Flush + Filter" metrics ───────────────────────────────────────
  // Restoration eliminates sludge flow derate and DHW scale derate
  const restoredVelocity = computeDesignVelocityMs(asFoundVelocity, sludge.flowDeratePct);
  const restoredVelocityOutsideBand = computeVelocityOutsideBandPct(restoredVelocity);

  const restored: ConditionMetrics = {
    chShortfallPct: 0,
    dhwCapacityReductionPct: 0,
    efficiencyPct: parseFloat(nominalEffPct.toFixed(1)),
    velocityMs: restoredVelocity,
    velocityOutsideBandPct: restoredVelocityOutsideBand,
  };

  return {
    asFound,
    restored,
    chShortfallReductionPct: parseFloat((asFoundChShortfall).toFixed(1)),
    systemAgeYears,
    estimatedScaleThicknessMm: sludge.estimatedScaleThicknessMm,
  };
}

// ─── Constants re-exported for the visualiser ─────────────────────────────────
export { VELOCITY_LOWER_M_S, VELOCITY_UPPER_M_S };

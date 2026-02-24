/**
 * BoilerTailoffModule — derives a 96-point boiler efficiency series by applying
 * deterministic degradation factors (age, cycling/part-load) to a SEDBUK
 * seasonal efficiency baseline.
 *
 * Outputs an array of 96 efficiency values (0..1) aligned to the 15-minute
 * timeline used by TimelineBuilder.
 */

/** Default assumed boiler rated output in kW when unknown (typical UK combi). */
export const DEFAULT_BOILER_KW = 24;
/** Maximum combined cycling + oversize penalty applied to mean efficiency (12%). */
const MAX_COMBINED_PENALTY = 0.12;
/** Efficiency loss per unit of low-load fraction (1.5% per 10% of low-load time). */
const CYCLING_COEFFICIENT = 0.15;
/** Low-load threshold as a fraction of rated boiler output (20%). */
export const LOW_LOAD_THRESHOLD_RATIO = 0.2;
/** Per-point efficiency penalty for individual low-load time steps. */
const POINT_CYCLING_PENALTY = 0.03;

/** Piecewise age-degradation multiplier. */
export function ageFactor(ageYears: number): number {
  if (ageYears <= 5)  return 1.00;
  if (ageYears <= 10) return 0.98;
  if (ageYears <= 15) return 0.95;
  if (ageYears <= 20) return 0.92;
  return 0.88;
}

/**
 * Oversize penalty based on oversize ratio.
 * Returns a fractional penalty (0.0–0.09) to apply to mean efficiency.
 *
 * Ratio ≤ 1.3 → 0%   (well matched)
 * Ratio ≤ 1.8 → 3%   (mild oversize)
 * Ratio ≤ 2.5 → 6%   (oversized)
 * Ratio > 2.5 → 9%   (aggressive oversize)
 */
export function oversizePenalty(oversizeRatio: number | null | undefined): number {
  if (oversizeRatio == null) return 0;
  if (oversizeRatio <= 1.3) return 0.00;
  if (oversizeRatio <= 1.8) return 0.03;
  if (oversizeRatio <= 2.5) return 0.06;
  return 0.09;
}

/**
 * Cycling/part-load factor.
 * Fraction of timeline points where demand < lowLoadThresholdKw drives additional
 * efficiency loss: each percentage-point of "low-load" time reduces efficiency by
 * a fixed coefficient, capped at a maximum penalty.
 */
export function cyclingFactor(demandKw: number[], lowLoadThresholdKw: number): number {
  if (demandKw.length === 0) return 1.0;
  const lowLoadPoints = demandKw.filter(d => d < lowLoadThresholdKw && d > 0).length;
  const lowLoadFraction = lowLoadPoints / demandKw.length;
  const penalty = Math.min(MAX_COMBINED_PENALTY, lowLoadFraction * CYCLING_COEFFICIENT);
  return 1.0 - penalty;
}

export interface BoilerEfficiencySeriesArgs {
  /** SEDBUK seasonal efficiency baseline (0..1). Falls back to 0.85 when null. */
  seasonalEfficiency: number | null;
  /** Age of the boiler in years (used for ageFactor). */
  ageYears: number;
  /** 96-point demand array in kW (from TimelineBuilder). */
  demandHeatKw: number[];
  /**
   * Assumed boiler rated output in kW — used to derive low-load threshold.
   * Defaults to 24 kW when unknown (typical UK combi).
   */
  assumedBoilerKw?: number;
  /**
   * Oversize ratio (nominalKw / peakHeatLossKw) from BoilerSizingModule.
   * When provided, replaces the generic low-load cycling penalty with a
   * physically-grounded oversize penalty.
   */
  oversizeRatio?: number | null;
}

/**
 * Build a 96-point efficiency series for a boiler, incorporating SEDBUK baseline,
 * age factor, oversize penalty, and cycling factor.  Values are clamped to [0.55, 0.95].
 */
export function buildBoilerEfficiencySeriesV1(args: BoilerEfficiencySeriesArgs): number[] {
  const {
    seasonalEfficiency,
    ageYears,
    demandHeatKw,
    assumedBoilerKw = 24,
    oversizeRatio,
  } = args;

  const baseEta = seasonalEfficiency ?? 0.85;
  const af = ageFactor(ageYears);

  // Low-load threshold: LOW_LOAD_THRESHOLD_RATIO of assumed rated output
  const lowLoadThresholdKw = assumedBoilerKw * LOW_LOAD_THRESHOLD_RATIO;

  // Low-load cycling penalty: reuse cyclingFactor and derive the penalty from it
  const lowLoadPenalty = 1.0 - cyclingFactor(demandHeatKw, lowLoadThresholdKw);

  // Oversize-driven penalty (replaces vague cycling factor when ratio is available)
  const opPenalty = oversizePenalty(oversizeRatio);

  // Combined penalty capped at MAX_COMBINED_PENALTY
  const combinedPenalty = Math.min(MAX_COMBINED_PENALTY, opPenalty + lowLoadPenalty);

  const effectiveEta = baseEta * af * (1.0 - combinedPenalty);

  return demandHeatKw.map(demand => {
    // Add point-level variation: very low demand (< threshold) drags efficiency
    // slightly lower at that specific point, modelling cycling losses
    const pointPenalty = (demand > 0 && demand < lowLoadThresholdKw) ? POINT_CYCLING_PENALTY : 0;
    const eta = effectiveEta - pointPenalty;
    // Clamp to [0.55, 0.95]
    return Math.round(Math.min(0.95, Math.max(0.55, eta)) * 1000) / 1000;
  });
}

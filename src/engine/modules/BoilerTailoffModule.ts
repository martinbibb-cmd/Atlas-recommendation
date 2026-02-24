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
/** Maximum cycling penalty applied to mean efficiency (9%). */
const MAX_CYCLING_PENALTY = 0.09;
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
 * Cycling/part-load factor.
 * Fraction of timeline points where demand < lowLoadThresholdKw drives additional
 * efficiency loss: each percentage-point of "low-load" time reduces efficiency by
 * a fixed coefficient, capped at a maximum penalty.
 */
export function cyclingFactor(demandKw: number[], lowLoadThresholdKw: number): number {
  if (demandKw.length === 0) return 1.0;
  const lowLoadPoints = demandKw.filter(d => d < lowLoadThresholdKw && d > 0).length;
  const lowLoadFraction = lowLoadPoints / demandKw.length;
  const penalty = Math.min(MAX_CYCLING_PENALTY, lowLoadFraction * CYCLING_COEFFICIENT);
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
}

/**
 * Build a 96-point efficiency series for a boiler, incorporating SEDBUK baseline,
 * age factor, and cycling factor.  Values are clamped to [0.55, 0.95].
 */
export function buildBoilerEfficiencySeriesV1(args: BoilerEfficiencySeriesArgs): number[] {
  const {
    seasonalEfficiency,
    ageYears,
    demandHeatKw,
    assumedBoilerKw = 24,
  } = args;

  const baseEta = seasonalEfficiency ?? 0.85;
  const af = ageFactor(ageYears);

  // Low-load threshold: LOW_LOAD_THRESHOLD_RATIO of assumed rated output
  const lowLoadThresholdKw = assumedBoilerKw * LOW_LOAD_THRESHOLD_RATIO;
  const cf = cyclingFactor(demandHeatKw, lowLoadThresholdKw);

  const effectiveEta = baseEta * af * cf;

  return demandHeatKw.map(demand => {
    // Add point-level variation: very low demand (< threshold) drags efficiency
    // slightly lower at that specific point, modelling cycling losses
    const pointPenalty = (demand > 0 && demand < lowLoadThresholdKw) ? POINT_CYCLING_PENALTY : 0;
    const eta = effectiveEta - pointPenalty;
    // Clamp to [0.55, 0.95]
    return Math.round(Math.min(0.95, Math.max(0.55, eta)) * 1000) / 1000;
  });
}

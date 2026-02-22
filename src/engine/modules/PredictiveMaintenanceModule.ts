import type {
  PredictiveMaintenanceInput,
  PredictiveMaintenanceResult,
} from '../schema/EngineInputV2_3';

// Design life for a gas boiler (UK Gas Safe industry standard)
const BOILER_DESIGN_LIFE_YEARS = 15;

// Hard-water scale growth (mm/year) by category
const SCALE_GROWTH_MM_PER_YEAR: Record<string, number> = {
  soft: 0.02,
  moderate: 0.06,
  hard: 0.10,
  very_hard: 0.16,
};

// Limescale layer > 1.6mm causes significant heat-exchanger stress → kettling
const KETTLING_SCALE_THRESHOLD_MM = 1.6;

// Magnetite sludge risk: increases ~1 unit per year without a magnetic filter
const BASE_MAGNETITE_RATE_PER_YEAR = 1.2;
const FILTER_MAGNETITE_MULTIPLIER = 0.15; // 85% reduction with magnetic filter

export function runPredictiveMaintenanceModule(
  input: PredictiveMaintenanceInput
): PredictiveMaintenanceResult {
  const recommendations: string[] = [];
  const criticalAlerts: string[] = [];

  // ── Kettling risk (limescale buildup on heat exchanger) ───────────────────
  const scaleGrowthMmPerYear = SCALE_GROWTH_MM_PER_YEAR[input.waterHardnessCategory] ?? 0.06;
  // Scale inhibitor reduces growth by ~70%
  const effectiveGrowthMmPerYear = input.hasScaleInhibitor
    ? scaleGrowthMmPerYear * 0.30
    : scaleGrowthMmPerYear;
  const accumulatedScaleMm = effectiveGrowthMmPerYear * input.systemAgeYears;
  const rawKettlingScore = Math.min(10, (accumulatedScaleMm / KETTLING_SCALE_THRESHOLD_MM) * 10);
  const kettlingRiskScore = parseFloat(rawKettlingScore.toFixed(1));

  // ── Magnetite sludge risk ─────────────────────────────────────────────────
  const magnetiteRate = input.hasMagneticFilter
    ? BASE_MAGNETITE_RATE_PER_YEAR * FILTER_MAGNETITE_MULTIPLIER
    : BASE_MAGNETITE_RATE_PER_YEAR;
  const rawMagnetiteScore = Math.min(10, magnetiteRate * input.systemAgeYears);
  const magnetiteRiskScore = parseFloat(rawMagnetiteScore.toFixed(1));

  // ── Overall health score ──────────────────────────────────────────────────
  const ageDeduction = Math.min(40, (input.systemAgeYears / BOILER_DESIGN_LIFE_YEARS) * 40);
  const kettlingDeduction = kettlingRiskScore * 2;    // max 20 points
  const magnetiteDeduction = magnetiteRiskScore * 2;  // max 20 points
  const serviceBonus = input.annualServicedByEngineer ? 10 : 0;
  const overallHealthScore = Math.max(
    0,
    Math.round(100 - ageDeduction - kettlingDeduction - magnetiteDeduction + serviceBonus)
  );

  // ── Remaining life estimate ───────────────────────────────────────────────
  const remainingYears = Math.max(
    0,
    Math.round(BOILER_DESIGN_LIFE_YEARS - input.systemAgeYears - kettlingRiskScore * 0.5)
  );
  const estimatedRemainingLifeYears = remainingYears;

  // ── Alerts and recommendations ────────────────────────────────────────────
  if (kettlingRiskScore >= 7) {
    criticalAlerts.push(
      `🚨 High Kettling Risk (score ${kettlingRiskScore}/10): Estimated ${accumulatedScaleMm.toFixed(1)}mm ` +
      `limescale accumulation on heat exchanger. Audible kettling, overheating, and ` +
      `heat exchanger failure are imminent. Immediate descale service required.`
    );
  } else if (kettlingRiskScore >= 4) {
    recommendations.push(
      `⚠️ Moderate Kettling Risk (score ${kettlingRiskScore}/10): ${accumulatedScaleMm.toFixed(1)}mm ` +
      `estimated scale layer. Schedule a power-flush and inhibitor dosing ` +
      `at next annual service to prevent accelerated decay.`
    );
  }

  if (magnetiteRiskScore >= 7) {
    criticalAlerts.push(
      `🚨 Severe Magnetite Contamination (score ${magnetiteRiskScore}/10): Black sludge ` +
      `buildup is blocking heat exchanger passages and micro-bore circuits. ` +
      `Full power-flush with chemical cleaner required before any component replacement.`
    );
  } else if (magnetiteRiskScore >= 4) {
    recommendations.push(
      `⚠️ Magnetite Accumulation Detected (score ${magnetiteRiskScore}/10): ` +
      `${input.hasMagneticFilter ? 'Magnetic filter present but' : 'No magnetic filter –'} ` +
      `sludge is building up. Inspect and clean filter canister; consider upgrading to ` +
      `Fernox TF1 or Spirovent for larger systems.`
    );
  }

  if (!input.hasScaleInhibitor && input.waterHardnessCategory !== 'soft') {
    recommendations.push(
      `💧 No Scale Inhibitor: Hard water area without chemical protection. ` +
      `Install Fernox DS3 or equivalent dosing unit to reduce limescale growth by ~70%.`
    );
  }

  if (!input.hasMagneticFilter) {
    recommendations.push(
      `🧲 No Magnetic Filter: Magnetite sludge will accumulate unchecked. ` +
      `Install a Fernox TF1 Compact or equivalent inline filter on the boiler return.`
    );
  }

  if (!input.annualServicedByEngineer) {
    recommendations.push(
      `🔧 No Annual Service Record: Unserviced boilers lose 3–5% efficiency per year ` +
      `and are more likely to fail unexpectedly. Schedule a Gas Safe engineer service.`
    );
  }

  if (input.systemAgeYears >= BOILER_DESIGN_LIFE_YEARS) {
    criticalAlerts.push(
      `🔴 End of Design Life: Boiler is ${input.systemAgeYears} years old ` +
      `(design life ${BOILER_DESIGN_LIFE_YEARS} years). Reliability risk is high; ` +
      `replacement should be planned in the current heating season.`
    );
  }

  return {
    kettlingRiskScore,
    magnetiteRiskScore,
    overallHealthScore,
    estimatedRemainingLifeYears,
    recommendations,
    criticalAlerts,
  };
}

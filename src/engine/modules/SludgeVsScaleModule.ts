import type {
  SludgeVsScaleInput,
  SludgeVsScaleResult,
} from '../schema/EngineInputV2_3';

// ─── Constants ────────────────────────────────────────────────────────────────

// Primary circuit sludge tax range (% efficiency loss) when no magnetic filter is fitted
// on a legacy/non-two-pipe system.  Physics: magnetite settled in radiators reduces
// heat output by up to 47%; a 7–15% system-level efficiency loss is the conservative
// operating band cited by HHIC and Boiler Plus guidance.
const SLUDGE_TAX_MIN_PCT = 7;
const SLUDGE_TAX_MAX_PCT = 15;

// Scale growth on DHW heat exchanger / cylinder coil (mm per year) by water hardness.
// CaCO3/silicate deposits accumulate only in the open secondary circuit because fresh
// mains water is introduced with every draw.
const DHW_SCALE_GROWTH_MM_PER_YEAR: Record<string, number> = {
  soft: 0.01,
  moderate: 0.05,
  hard: 0.13,
  very_hard: 0.20,
};

// Threshold at which scale causes the 11% DHW fuel penalty (SEDBUK / CIBSE data)
const SCALE_PENALTY_THRESHOLD_MM = 1.6;
const SCALE_PENALTY_AT_THRESHOLD_PCT = 11; // % fuel increase for DHW only

// DHW recovery latency increase per mm of scale on secondary heat exchanger
// Empirical estimate: ~18 s/mm additional wait for hot water at 1.6mm scale
const DHW_LATENCY_SEC_PER_MM = 18;

// Non-two-pipe topologies where primary sludge is the dominant stressor
const LEGACY_TOPOLOGIES = new Set(['one_pipe', 'microbore']);

// ─── Standalone penalty helper ────────────────────────────────────────────────

/**
 * calculateSludgePenalty
 *
 * Standalone primary-circuit sludge efficiency penalty (% efficiency loss).
 *
 * Physics: magnetite particles settle in radiators when the system water is not
 * refreshed.  Without a magnetic filter to capture them, accumulation is linear
 * with system age.  At 0.5 % per year the penalty reaches the 15 % cap after
 * 30 years – conservative versus the Baxi/HHIC research upper bound of 47 %
 * radiator heat-output loss in severely neglected systems.
 *
 * @param hasMagneticFilter  True if an inline magnetic filter is fitted on the
 *                           primary return (e.g. Fernox TF1, Magnaclean).
 * @param systemAgeYears     Age of the heating system in years.
 * @returns                  Efficiency penalty as a percentage (0–15).
 */
export function calculateSludgePenalty(
  hasMagneticFilter: boolean,
  systemAgeYears: number,
): number {
  if (hasMagneticFilter) return 0;
  return parseFloat(Math.min(15, systemAgeYears * 0.5).toFixed(1));
}

// ─── Main Module ──────────────────────────────────────────────────────────────

/**
 * SludgeVsScaleModule
 *
 * Models the "Two-Water" distinction between:
 *  - Primary circuit (closed loop): magnetite sludge is the dominant stressor.
 *    Scale is not the primary issue because the water is not constantly refreshed.
 *  - DHW circuit (open / secondary): CaCO3 and silicate scale accumulate with
 *    every fresh-water draw and degrade heat-exchanger efficiency over time.
 */
export function runSludgeVsScaleModule(input: SludgeVsScaleInput): SludgeVsScaleResult {
  const notes: string[] = [];

  // ── Primary circuit: Magnetite sludge tax ────────────────────────────────
  // Apply only for non-two-pipe (legacy) topologies without a magnetic filter.
  // Two-pipe systems share the same closed-circuit sludge risk but the module
  // focuses on the elevated risk of legacy plumbing where radiator bypass/loop
  // geometry accelerates sludge deposition.
  const isLegacyTopology = LEGACY_TOPOLOGIES.has(input.pipingTopology);
  const sludgeTaxApplies = isLegacyTopology && !input.hasMagneticFilter;

  // Scale sludge tax linearly from min to max over 15 years without a filter.
  const sludgeTaxPct = sludgeTaxApplies
    ? parseFloat(
        Math.min(
          SLUDGE_TAX_MAX_PCT,
          SLUDGE_TAX_MIN_PCT + ((SLUDGE_TAX_MAX_PCT - SLUDGE_TAX_MIN_PCT) * Math.min(input.systemAgeYears, 15)) / 15
        ).toFixed(1)
      )
    : 0;

  if (sludgeTaxApplies) {
    notes.push(
      `🔩 Primary Sludge Tax (${sludgeTaxPct}% efficiency loss): ` +
      `${input.pipingTopology} topology without a magnetic filter. ` +
      `Magnetite particles settle in radiators and reduce heat output by up to 47%. ` +
      `Fit a magnetic filter (e.g. Fernox TF1) and power-flush to restore performance.`
    );
  } else if (isLegacyTopology && input.hasMagneticFilter) {
    notes.push(
      `🧲 Magnetic Filter Active: Magnetite sludge in the ${input.pipingTopology} ` +
      `primary circuit is being captured. No primary sludge tax applied.`
    );
  } else {
    notes.push(
      `✅ Primary Circuit: Two-pipe topology. Magnetite sludge risk is standard ` +
      `(not elevated). ${input.hasMagneticFilter ? 'Magnetic filter fitted.' : 'Consider fitting a magnetic filter as a precaution.'}`
    );
  }

  // ── DHW circuit: CaCO3 / silicate scale ─────────────────────────────────
  const scaleGrowthMmPerYear =
    DHW_SCALE_GROWTH_MM_PER_YEAR[input.waterHardnessCategory] ?? 0.05;
  const estimatedScaleThicknessMm = parseFloat(
    (scaleGrowthMmPerYear * input.systemAgeYears).toFixed(2)
  );

  // 11% penalty scales proportionally once the 1.6mm threshold is reached.
  const dhwScalePenaltyPct =
    estimatedScaleThicknessMm >= SCALE_PENALTY_THRESHOLD_MM
      ? parseFloat(
          Math.min(
            20, // practical ceiling – beyond this the heat exchanger is effectively dead
            SCALE_PENALTY_AT_THRESHOLD_PCT *
              (estimatedScaleThicknessMm / SCALE_PENALTY_THRESHOLD_MM)
          ).toFixed(1)
        )
      : parseFloat(
          (
            (estimatedScaleThicknessMm / SCALE_PENALTY_THRESHOLD_MM) *
            SCALE_PENALTY_AT_THRESHOLD_PCT
          ).toFixed(1)
        );

  const dhwRecoveryLatencyIncreaseSec = parseFloat(
    (estimatedScaleThicknessMm * DHW_LATENCY_SEC_PER_MM).toFixed(0)
  );

  if (estimatedScaleThicknessMm >= SCALE_PENALTY_THRESHOLD_MM) {
    notes.push(
      `🔥 DHW Scale Penalty (${dhwScalePenaltyPct}% fuel increase for hot water): ` +
      `Estimated ${estimatedScaleThicknessMm}mm CaCO3/silicate layer on secondary heat ` +
      `exchanger in a ${input.waterHardnessCategory.replace('_', ' ')} water area. ` +
      `A 1.6mm scale layer alone causes an 11% fuel increase for hot water only. ` +
      `DHW recovery is ~${dhwRecoveryLatencyIncreaseSec}s slower per draw.`
    );
  } else if (estimatedScaleThicknessMm > 0) {
    notes.push(
      `💧 DHW Scale Building: ${estimatedScaleThicknessMm}mm estimated scale on DHW ` +
      `circuit (${input.waterHardnessCategory.replace('_', ' ')} water). ` +
      `${dhwScalePenaltyPct > 0 ? `Current penalty: ${dhwScalePenaltyPct}%. ` : ''}` +
      `Scale inhibitor or softener treatment recommended before the 1.6mm threshold.`
    );
  } else {
    notes.push(`✅ DHW Circuit: Negligible scale accumulation detected.`);
  }

  // ── Cost attribution ──────────────────────────────────────────────────────
  const annualGasSpend = input.annualGasSpendGbp ?? 0;

  // Assume DHW accounts for ~30% of total gas spend (UK average)
  const dhwGasSpendGbp = annualGasSpend * 0.3;
  const dhwScaleCostGbp = parseFloat(
    ((dhwScalePenaltyPct / 100) * dhwGasSpendGbp).toFixed(2)
  );

  // Primary sludge tax applies across the whole heating circuit
  const heatingGasSpendGbp = annualGasSpend * 0.7;
  const primarySludgeCostGbp = parseFloat(
    ((sludgeTaxPct / 100) * heatingGasSpendGbp).toFixed(2)
  );

  if (annualGasSpend > 0 && (dhwScaleCostGbp > 0 || primarySludgeCostGbp > 0)) {
    notes.push(
      `💰 Water Quality Cost: Primary sludge £${primarySludgeCostGbp.toFixed(0)}/yr + ` +
      `DHW scale £${dhwScaleCostGbp.toFixed(0)}/yr = ` +
      `£${(primarySludgeCostGbp + dhwScaleCostGbp).toFixed(0)}/yr wasted.`
    );
  }

  return {
    primarySludgeTaxPct: sludgeTaxPct,
    dhwScalePenaltyPct,
    estimatedScaleThicknessMm,
    dhwRecoveryLatencyIncreaseSec,
    primarySludgeCostGbp,
    dhwScaleCostGbp,
    notes,
  };
}

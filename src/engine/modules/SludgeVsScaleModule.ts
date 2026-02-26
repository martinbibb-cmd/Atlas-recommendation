import type {
  SludgeVsScaleInput,
  SludgeVsScaleResult,
} from '../schema/EngineInputV2_3';

// ─── Constants ────────────────────────────────────────────────────────────────

// CH loop: maximum flow derate from magnetite sludge (dimensionless, 0–0.20).
// At 0.20, effectiveFlowRequired = designFlowLpm / 0.80 → +25% velocity → raises
// velocityPenalty and reduces effectiveCOP for ASHP; increases CH shortfall for boilers.
const MAX_FLOW_DERATE = 0.20;

// CH loop: maximum cycling fuel loss fraction (0–0.05) at low load.
// Derived as MAX_FLOW_DERATE × 0.25 → cyclingLossPct = flowDeratePct × 0.25.
const MAX_CYCLING_LOSS = 0.05;

// Scale growth on DHW heat exchanger / cylinder coil (mm per year) by water hardness.
// CaCO3/silicate deposits accumulate only in the open secondary circuit because fresh
// mains water is introduced with every draw.
const DHW_SCALE_GROWTH_MM_PER_YEAR: Record<string, number> = {
  soft: 0.01,
  moderate: 0.05,
  hard: 0.13,
  very_hard: 0.20,
};

// DHW capacity derate: scale thickness at which derate reaches its maximum.
// At 3.2 mm, the combi HX is effectively dead (MAX_DHW_CAPACITY_DERATE = 0.20).
const DHW_DERATE_MAX_THICKNESS_MM = 3.2;
const MAX_DHW_CAPACITY_DERATE = 0.20;

// Scale threshold at which a DHW capacity derate warning note is emitted (mm).
// Below this threshold, scale is building but notes use cautionary language.
const DHW_SCALE_WARNING_THRESHOLD_MM = 1.6;

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
 *    Sludge causes FLOW RESTRICTION (flowDeratePct) and CYCLING LOSS (cyclingLossPct),
 *    NOT a direct combustion η reduction.  Scale does not affect the sealed CH loop.
 *  - DHW circuit (open / secondary): CaCO3 and silicate scale accumulate with
 *    every fresh-water draw and REDUCE MAX DHW CAPACITY (dhwCapacityDeratePct),
 *    causing flow droop, shortfall during peak draw, and more spiky η traces.
 */
export function runSludgeVsScaleModule(input: SludgeVsScaleInput): SludgeVsScaleResult {
  const notes: string[] = [];

  // ── Primary circuit: Magnetite sludge → flow derate + cycling loss ───────
  // Route sludge into flow restriction and low-load cycling, NOT blanket η loss.
  // Two-pipe systems share closed-circuit sludge risk but this module focuses on
  // the elevated risk of legacy plumbing where radiator loop geometry accelerates
  // sludge deposition.
  const isLegacyTopology = LEGACY_TOPOLOGIES.has(input.pipingTopology);
  const sludgeTaxApplies = isLegacyTopology && !input.hasMagneticFilter;

  // flowDeratePct: 0 → MAX_FLOW_DERATE over 15 years without a filter.
  // effectiveFlowRequired = designFlowLpm / (1 − flowDeratePct)
  // → raises velocity → increases velocityPenalty → reduces effectiveCOP (ASHP)
  // → increases CH shortfall (boiler).
  const flowDeratePct = sludgeTaxApplies
    ? parseFloat(
        Math.min(MAX_FLOW_DERATE, (Math.min(input.systemAgeYears, 15) / 15) * MAX_FLOW_DERATE).toFixed(3)
      )
    : 0;

  // cyclingLossPct: proportional to flowDeratePct, max MAX_CYCLING_LOSS.
  // Applied by LifestyleSimulationModule when loadFrac < 0.25 (low-load cycling).
  const cyclingLossPct = parseFloat((flowDeratePct * 0.25).toFixed(3));

  if (sludgeTaxApplies) {
    notes.push(
      `🔩 CH Flow Derate (${(flowDeratePct * 100).toFixed(1)}%): ` +
      `${input.pipingTopology} topology without a magnetic filter. ` +
      `Magnetite sludge restricts primary circuit flow — required flow increases by ` +
      `${(flowDeratePct / (1 - flowDeratePct) * 100).toFixed(1)}%, raising velocity and ` +
      `velocity penalty. Cycling loss at low load: ${(cyclingLossPct * 100).toFixed(1)}%. ` +
      `Fit a magnetic filter (e.g. Fernox TF1) and power-flush to restore performance.`
    );
  } else if (isLegacyTopology && input.hasMagneticFilter) {
    notes.push(
      `🧲 Magnetic Filter Active: Magnetite sludge in the ${input.pipingTopology} ` +
      `primary circuit is being captured. No flow derate or cycling penalty applied.`
    );
  } else {
    notes.push(
      `✅ Primary Circuit: Two-pipe topology. Magnetite sludge risk is standard ` +
      `(not elevated). ${input.hasMagneticFilter ? 'Magnetic filter fitted.' : 'Consider fitting a magnetic filter as a precaution.'}`
    );
  }

  // ── DHW circuit: CaCO3 / silicate scale → capacity derate ───────────────
  // Scale reduces the max DHW output power of the combi HX. This:
  //  • Reduces deliverable L/min @40°C
  //  • Increases unmet demand during peak draw
  //  • Increases purge frequency organically
  // Scale does NOT affect the sealed CH loop.
  const scaleGrowthMmPerYear =
    DHW_SCALE_GROWTH_MM_PER_YEAR[input.waterHardnessCategory] ?? 0.05;
  const estimatedScaleThicknessMm = parseFloat(
    (scaleGrowthMmPerYear * input.systemAgeYears).toFixed(2)
  );

  // dhwCapacityDeratePct: 0 → MAX_DHW_CAPACITY_DERATE over DHW_DERATE_MAX_THICKNESS_MM.
  // Applied: maxQtoDhwKw *= (1 − dhwCapacityDeratePct)
  const dhwCapacityDeratePct = parseFloat(
    Math.min(
      MAX_DHW_CAPACITY_DERATE,
      (estimatedScaleThicknessMm / DHW_DERATE_MAX_THICKNESS_MM) * MAX_DHW_CAPACITY_DERATE
    ).toFixed(3)
  );

  const dhwRecoveryLatencyIncreaseSec = parseFloat(
    (estimatedScaleThicknessMm * DHW_LATENCY_SEC_PER_MM).toFixed(0)
  );

  if (estimatedScaleThicknessMm >= DHW_SCALE_WARNING_THRESHOLD_MM) {
    notes.push(
      `🔥 DHW Capacity Derate (${(dhwCapacityDeratePct * 100).toFixed(1)}%): ` +
      `Estimated ${estimatedScaleThicknessMm}mm CaCO3/silicate layer on DHW heat ` +
      `exchanger in a ${input.waterHardnessCategory.replace('_', ' ')} water area. ` +
      `Scale reduces max combi DHW output — expect flow droop and shortfall during peak draw. ` +
      `DHW recovery is ~${dhwRecoveryLatencyIncreaseSec}s slower per draw.`
    );
  } else if (estimatedScaleThicknessMm > 0) {
    notes.push(
      `💧 DHW Scale Building: ${estimatedScaleThicknessMm}mm estimated scale on DHW ` +
      `circuit (${input.waterHardnessCategory.replace('_', ' ')} water). ` +
      `${dhwCapacityDeratePct > 0 ? `Current capacity derate: ${(dhwCapacityDeratePct * 100).toFixed(1)}%. ` : ''}` +
      `Scale inhibitor or softener treatment recommended.`
    );
  } else {
    notes.push(`✅ DHW Circuit: Negligible scale accumulation detected.`);
  }

  // ── Cost attribution ──────────────────────────────────────────────────────
  const annualGasSpend = input.annualGasSpendGbp ?? 0;

  // DHW accounts for ~30% of total gas spend (UK average).
  // Scale capacity derate increases fuel needed to meet demand.
  const dhwGasSpendGbp = annualGasSpend * 0.3;
  const dhwScaleCostGbp = parseFloat(
    (dhwCapacityDeratePct * dhwGasSpendGbp).toFixed(2)
  );

  // Flow derate increases heating gas spend proportionally (higher velocity
  // means higher pump demand and reduced heat transfer efficiency).
  const heatingGasSpendGbp = annualGasSpend * 0.7;
  const primarySludgeCostGbp = parseFloat(
    (flowDeratePct * heatingGasSpendGbp).toFixed(2)
  );

  if (annualGasSpend > 0 && (dhwScaleCostGbp > 0 || primarySludgeCostGbp > 0)) {
    notes.push(
      `💰 Water Quality Cost: CH flow derate £${primarySludgeCostGbp.toFixed(0)}/yr + ` +
      `DHW scale capacity derate £${dhwScaleCostGbp.toFixed(0)}/yr = ` +
      `£${(primarySludgeCostGbp + dhwScaleCostGbp).toFixed(0)}/yr wasted.`
    );
  }

  return {
    flowDeratePct,
    cyclingLossPct,
    dhwCapacityDeratePct,
    estimatedScaleThicknessMm,
    dhwRecoveryLatencyIncreaseSec,
    primarySludgeCostGbp,
    dhwScaleCostGbp,
    notes,
  };
}

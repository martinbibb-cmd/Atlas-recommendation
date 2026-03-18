/**
 * performanceDashboardHelpers.ts
 *
 * Shared constants and helpers for the visual performance dashboard used in
 * both DecisionSynthesisPage (interactive) and PrintableRecommendationPage (print).
 *
 * All values are physics-grounded:
 *   - MIN_HEAT_PUMP_COP: any system with a conversion ratio above this can only
 *     be a heat pump (COP > 1 is impossible for combustion).
 *   - Cost thresholds: ~8.5p separates well-optimised gas from average; ~11.5p
 *     marks the crossover into poorly-performing setups.
 *   - Carbon thresholds: 0.12 kgCO₂/kWh is approximately HP grid-mix at SCOP 3;
 *     0.22 kgCO₂/kWh is a well-maintained gas boiler at ~95% efficiency.
 */

import type { PerformanceSummary } from '../../lib/advice/buildAdviceFromCompare';

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** COP above this value is only achievable by an electric heat pump, not combustion. */
export const MIN_HEAT_PUMP_COP = 1.5;

/** Maximum number of output blocks rendered in the energy-conversion visual. */
export const MAX_OUTPUT_BLOCKS = 4;

/** Running cost threshold (pence/kWh heat) below which cost is classified as "Lower". */
export const COST_LOW_THRESHOLD = 8.5;

/** Running cost threshold (pence/kWh heat) below which cost is classified as "Medium". */
export const COST_MEDIUM_THRESHOLD = 11.5;

/** Carbon threshold (kgCO₂/kWh heat) below which carbon is classified as "Lower". */
export const CARBON_LOW_THRESHOLD = 0.12;

/** Carbon threshold (kgCO₂/kWh heat) below which carbon is classified as "Medium". */
export const CARBON_MEDIUM_THRESHOLD = 0.22;

// ─── Labels ───────────────────────────────────────────────────────────────────

/** Honest, plain-English labels for the performance chip. Avoids "optimal" language. */
export const PERF_CHIP_LABEL: Record<PerformanceSummary['efficiencyBand'], string> = {
  optimal: 'Works best',
  average: 'Works well',
  poor:    'Needs the right setup',
};

export const COST_LEVEL_LABEL:   ['Lower', 'Medium', 'Higher'] = ['Lower', 'Medium', 'Higher'];
export const CARBON_LEVEL_LABEL: ['Lower', 'Medium', 'Higher'] = ['Lower', 'Medium', 'Higher'];

export const GEN_BAR_LEVEL: Record<PerformanceSummary['localGenerationImpact'], 1 | 2 | 3> = {
  high: 3, moderate: 2, limited: 1,
};

export const GEN_LEVEL_LABEL: Record<PerformanceSummary['localGenerationImpact'], string> = {
  high:     'Strong',
  moderate: 'Moderate',
  limited:  'Limited',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a 1–3 bar fill level for running cost (1 = Lower, 3 = Higher). */
export function costBarLevel(costP: number): 1 | 2 | 3 {
  return costP <= COST_LOW_THRESHOLD ? 1 : costP <= COST_MEDIUM_THRESHOLD ? 2 : 3;
}

/** Returns a 1–3 bar fill level for carbon intensity (1 = Lower, 3 = Higher). */
export function carbonBarLevel(kgCo2: number): 1 | 2 | 3 {
  return kgCo2 <= CARBON_LOW_THRESHOLD ? 1 : kgCo2 <= CARBON_MEDIUM_THRESHOLD ? 2 : 3;
}

/**
 * Infers the input fuel label from the energy conversion ratio.
 * A COP above MIN_HEAT_PUMP_COP is only achievable by an electric heat pump.
 */
export function fuelLabelFromCop(outputKwh: number): 'electric' | 'gas' {
  return outputKwh > MIN_HEAT_PUMP_COP ? 'electric' : 'gas';
}

/**
 * Returns the number of output blocks to render in the energy-conversion visual.
 * Clamped between 1 and MAX_OUTPUT_BLOCKS so very high COPs stay visually bounded.
 */
export function outputBlockCount(outputKwh: number): number {
  return Math.min(MAX_OUTPUT_BLOCKS, Math.max(1, Math.round(outputKwh)));
}

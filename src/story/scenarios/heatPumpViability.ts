/**
 * heatPumpViability.ts
 *
 * Scenario spec for the "Heat pump enquiry" (heat_pump_viability) story scenario.
 *
 * MVP outputs: hydraulics (pipe-sizing), efficiency_graph (COP estimate), inputs_summary.
 * No score — just "what it does" and "what would need to change to get the best from it".
 *
 * Escalation is intentionally disabled for V1 of this scenario.
 */

import type { StoryScenario } from '../scenarioRegistry';

// ── Inputs ────────────────────────────────────────────────────────────────────

/**
 * Heat pump viability scenario inputs.
 * Captured in the input panel; translated by applyScenarioToEngineInput.
 */
export interface HeatPumpViabilityInputs {
  /** Whether the surveyor knows the fabric heat loss figure. */
  heatLossKnown: boolean;
  /** Fabric heat loss in watts (used when heatLossKnown is true). */
  heatLossWatts: number;
  /** Radiator type distribution — affects the achievable flow temperature. */
  radiatorsType: 'mostly_doubles' | 'mixed' | 'mostly_singles';
  /** Whether the primary pipe diameter has been measured. */
  primaryPipeDiameterKnown: boolean;
  /**
   * Measured primary pipe internal bore (mm).
   * 22 mm is the default assumption when unknown.
   */
  primaryPipeDiameter: 15 | 22 | 28;
  /** Customer comfort preference — steady background heat vs. fast pick-up. */
  comfortPreference: 'steady_heat' | 'fast_response';
  /** Whether the property has usable outdoor space for an ASHP unit. */
  outdoorSpace: boolean;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Derive the indicative design flow temperature (°C) for a heat pump based on
 * the radiator distribution.
 *
 * Doubles → lower flow temp possible (larger surface area).
 * Singles → higher flow temp required (smaller surface area).
 *
 * These are indicative figures for advisor guidance; not a substitute for a
 * proper heat emitter survey.
 */
export function deriveHeatPumpFlowTempC(
  radiatorsType: HeatPumpViabilityInputs['radiatorsType'],
): number {
  switch (radiatorsType) {
    case 'mostly_doubles': return 45;
    case 'mixed':          return 50;
    case 'mostly_singles': return 55;
  }
}

/**
 * Estimate the seasonal COP for an ASHP at a given design flow temperature.
 *
 * Based on a simplified Carnot-derived approximation with empirical adjustment:
 *   COP ≈ 5.5 − 0.05 × T_flow
 *
 * Clamped to [2.0, 4.0] for domestic ranges.
 */
export function estimateHeatPumpCop(designFlowTempC: number): number {
  const raw = 5.5 - 0.05 * designFlowTempC;
  return Math.min(4.0, Math.max(2.0, raw));
}

/**
 * Derive a simple viability verdict based on key constraints.
 *
 * 'good'    → all major prerequisites are met.
 * 'possible' → viable but with identified caveats.
 * 'limited' → significant constraints — detailed assessment needed.
 */
export function deriveHeatPumpViabilityVerdict(
  inputs: HeatPumpViabilityInputs,
): 'good' | 'possible' | 'limited' {
  if (!inputs.outdoorSpace) return 'limited';
  if (inputs.radiatorsType === 'mostly_singles' && inputs.comfortPreference === 'fast_response') {
    return 'limited';
  }
  if (inputs.radiatorsType === 'mostly_singles' || inputs.primaryPipeDiameter === 15) {
    return 'possible';
  }
  return 'good';
}

// ── Scenario spec ─────────────────────────────────────────────────────────────

/**
 * Heat pump viability MVP scenario spec.
 *
 * Minimum inputs for V1:
 *   - heatLossKnown + heatLossWatts (if known)
 *   - radiatorsType
 *   - primaryPipeDiameterKnown + primaryPipeDiameter (if known)
 *   - comfortPreference
 *   - outdoorSpace
 *
 * One screen.  No escalation in V1.
 */
export const heatPumpViabilityScenario: StoryScenario<HeatPumpViabilityInputs> = {
  id: 'heat_pump_viability',
  title: 'Heat pump enquiry',
  description:
    'Assess whether an air source heat pump is viable and what would need to change to get the best from it.',
  advisorIntent:
    "Let's assess what an air source heat pump would need to perform well here.",
  fields: [
    'heatLossKnown',
    'heatLossWatts',
    'radiatorsType',
    'primaryPipeDiameterKnown',
    'primaryPipeDiameter',
    'comfortPreference',
    'outdoorSpace',
  ],
  defaults: {
    heatLossKnown: false,
    heatLossWatts: 8000,
    radiatorsType: 'mixed',
    primaryPipeDiameterKnown: false,
    primaryPipeDiameter: 22,
    comfortPreference: 'steady_heat',
    outdoorSpace: true,
  },
  compareDefaults: {
    systemA: 'ashp',
    systemB: 'combi',
  },
  outputFocus: [
    'hydraulics',
    'efficiency_graph',
    'inputs_summary',
  ],
  escalationAllowed: false,
};

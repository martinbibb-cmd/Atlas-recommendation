/**
 * dhwModel — physics helpers for the Lego DHW (domestic hot water) model.
 *
 * Equations:
 *   kW = 0.06977 × L/min × ΔT   (specific heat × density × unit conversion)
 *   L/min = kW / (0.06977 × ΔT)
 *
 * Also provides a "capacity chain" helper: computes the overall max flow
 * as the minimum of all stated component capacities, and identifies the
 * limiting component label.
 */

// ─── Basic thermal conversions ────────────────────────────────────────────────

/** Convert volumetric flow (L/min) and temperature rise (°C) to thermal power (kW). */
export function kwForFlow(flowLpm: number, deltaT_C: number): number {
  return 0.06977 * flowLpm * deltaT_C;
}

/** Convert thermal power (kW) and temperature rise (°C) to volumetric flow (L/min). */
export function flowForKw(kw: number, deltaT_C: number): number {
  return kw / (0.06977 * deltaT_C);
}

// ─── Combi thermal limit ──────────────────────────────────────────────────────

export interface CombiThermalLimitInput {
  dhwOutputKw: number;
  coldTempC: number;
  setpointC: number;
}

/**
 * Compute the maximum sustainable flow rate for a combi DHW heat exchanger.
 * This is the flow at which the heat exchanger is working at full rated output.
 *
 * Formula: maxFlowLpm = dhwOutputKw / (0.06977 × ΔT)
 * where ΔT = setpointC − coldTempC
 */
export function computeCombiThermalLimit({ dhwOutputKw, coldTempC, setpointC }: CombiThermalLimitInput): number {
  const deltaT = setpointC - coldTempC;
  if (deltaT <= 0) return 0;
  return flowForKw(dhwOutputKw, deltaT);
}

// ─── Pipe capacity lookup (diameter-based rough model) ───────────────────────

/**
 * Approximate maximum domestic flow capacity by nominal pipe diameter.
 *
 * Values are conservative service limits derived from BS 6700 / BS EN 806
 * guidance on maximum flow velocities (≤ 3 m/s) for domestic cold/hot
 * water services. These are NOT precise Darcy-Weisbach results.
 *
 * Diameter  Max velocity  Rough capacity
 *  10 mm       3 m/s      ~6  L/min
 *  12 mm       3 m/s      ~9  L/min
 *  15 mm       3 m/s      ~15 L/min
 *  22 mm       3 m/s      ~30 L/min
 *  28 mm       3 m/s      ~50 L/min
 */
const PIPE_CAPACITY_LPM: Record<number, number> = {
  10: 6,
  12: 9,
  15: 15,
  22: 30,
  28: 50,
};

/** Return rough max flow (L/min) for a given pipe diameter in mm.
 *  Returns undefined if the diameter is not in the lookup table. */
export function pipeDiameterCapacityLpm(diameterMm: number): number | undefined {
  return PIPE_CAPACITY_LPM[diameterMm];
}

// ─── Capacity chain ───────────────────────────────────────────────────────────

export interface CapacityComponent {
  label: string;
  maxFlowLpm: number | undefined;
}

export interface CapacityChainResult {
  maxFlowLpm: number | undefined;
  limitingComponent: string | undefined;
  perComponentCaps: Array<{ label: string; maxFlowLpm: number | undefined }>;
  notes: string[];
}

/**
 * Compute the overall max flow from a chain of components.
 * Each component may supply an optional capacity; the overall limit
 * is the minimum of all defined capacities.
 * Returns the limiting component label for UI highlighting.
 */
export function computeCapacityChain(components: CapacityComponent[]): CapacityChainResult {
  const notes: string[] = [];
  const defined = components.filter(c => c.maxFlowLpm !== undefined);

  if (defined.length === 0) {
    return {
      maxFlowLpm: undefined,
      limitingComponent: undefined,
      perComponentCaps: components.map(c => ({ label: c.label, maxFlowLpm: c.maxFlowLpm })),
      notes: ['No component capacities specified — cannot determine system limit.'],
    };
  }

  let minFlow = Infinity;
  let limitingLabel: string | undefined;

  for (const c of defined) {
    if (c.maxFlowLpm! < minFlow) {
      minFlow = c.maxFlowLpm!;
      limitingLabel = c.label;
    }
  }

  if (defined.length < components.length) {
    notes.push('Some components have no stated capacity and are not limiting.');
  }

  return {
    maxFlowLpm: minFlow,
    limitingComponent: limitingLabel,
    perComponentCaps: components.map(c => ({ label: c.label, maxFlowLpm: c.maxFlowLpm })),
    notes,
  };
}

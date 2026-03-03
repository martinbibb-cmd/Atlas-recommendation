/**
 * dhwMath — pure UI-side DHW physics helpers.
 *
 * Equations:
 *   kW = 0.06977 × L/min × ΔT_C     (specific heat of water × density, kW units)
 *   L/min = kW / (0.06977 × ΔT_C)
 *
 * These functions contain no state and no side-effects.
 */

/** Convert a volumetric flow (L/min) and temperature rise (°C) to thermal power (kW). */
export function kwForFlow(flowLpm: number, deltaT_C: number): number {
  return 0.06977 * flowLpm * deltaT_C;
}

/** Convert a thermal power (kW) and temperature rise (°C) to volumetric flow (L/min). */
export function flowForKw(kw: number, deltaT_C: number): number {
  return kw / (0.06977 * deltaT_C);
}

/** Clamp a number between min and max (inclusive). */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

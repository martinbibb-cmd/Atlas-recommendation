/**
 * DhwFlowPresets.ts
 *
 * Physics-grounded preset constants for combi DHW sizing.
 *
 * These presets drive the "DHW Flow & Season" panel on the combi switch
 * presentation page without requiring manual data entry:
 *
 *   Season → cold supply temperature (UK ground-water seasonal range)
 *   DHW mode → combi outlet target temperature
 *   Shower type → mixed outlet flow at the showerhead (L/min)
 *
 * All flow × ΔT arithmetic uses:
 *   kW = (Cp / 60) × flowLpm × ΔT  where Cp/60 ≈ 0.0697 kW/(L·min·K)
 */

// ─── Season → cold supply temperature (°C) ───────────────────────────────────

/**
 * UK cold-mains supply temperature by season.
 * Derived from ground-water temperature variation (BGS data).
 *   Winter: 5 °C  — worst case; this is what "kills" combi performance.
 *   Typical: 10 °C — UK annual mean.
 *   Summer: 15 °C  — best case.
 */
export const COLD_SUPPLY_TEMP_PRESETS = {
  winter:  5,
  typical: 10,
  summer:  15,
} as const;

export type SeasonPreset = keyof typeof COLD_SUPPLY_TEMP_PRESETS;

// ─── DHW mode → combi outlet target temperature (°C) ─────────────────────────

/**
 * Combi heat-exchanger outlet temperature modes.
 *   Normal (50 °C) — standard; comfortable with some mixing headroom.
 *   High   (55 °C) — more mixing headroom but raises ΔT requirement,
 *                    increasing kW demand for the same L/min of hot water.
 */
export const COMBI_HOT_OUT_PRESETS = {
  normal: 50,
  high:   55,
} as const;

export type DhwModePreset = keyof typeof COMBI_HOT_OUT_PRESETS;

// ─── Shower type → mixed outlet flow at the showerhead (L/min) ───────────────

/**
 * Mixed flow at the showerhead (what the user experiences).
 *   Mixer (10)      — standard UK thermostatic mixer shower.
 *   Mixer high (12) — high-flow mixer; one tap can max out a 30 kW combi.
 *   Rainfall (16)   — large-head rainfall; combi cannot sustain this.
 */
export const OUTLET_FLOW_PRESETS_LPM = {
  mixer:      10,
  mixer_high: 12,
  rainfall:   16,
} as const;

export type ShowerPreset = keyof typeof OUTLET_FLOW_PRESETS_LPM;

// ─── Physics helpers ──────────────────────────────────────────────────────────

/**
 * Cp / 60: kW per (L/min) per °C.
 * From specific heat of water: 4.186 kJ/(kg·K) ÷ 60 s/min.
 */
export const DHW_KW_PER_LPM_PER_K = 4.186 / 60; // ≈ 0.0697

/**
 * Nominal combi boiler peak DHW heat output (kW).
 * Represents a mid-range UK combi in full DHW priority mode.
 */
export const NOMINAL_COMBI_DHW_KW = 30;

/**
 * Compute the heat-limited maximum deliverable flow for a combi.
 *
 *   flowMax = combiKw / (DHW_KW_PER_LPM_PER_K × deltaT)
 *
 * @param combiKw  Peak DHW output power (kW).
 * @param deltaT   Temperature rise from cold supply to hot outlet (°C).
 * @returns Maximum sustainable L/min, or 0 when deltaT ≤ 0.
 */
export function computeHeatLimitLpm(combiKw: number, deltaT: number): number {
  if (deltaT <= 0) return 0;
  return combiKw / (DHW_KW_PER_LPM_PER_K * deltaT);
}

/**
 * Compute required heat power for a given flow and temperature rise.
 *
 *   kW = DHW_KW_PER_LPM_PER_K × flowLpm × deltaT
 *
 * @param flowLpm  Volumetric flow (L/min) — mixed outlet flow.
 * @param deltaT   Temperature rise (°C). Clamped to ≥ 0.
 * @returns Required kW.
 */
export function computeRequiredKw(flowLpm: number, deltaT: number): number {
  return DHW_KW_PER_LPM_PER_K * flowLpm * Math.max(0, deltaT);
}

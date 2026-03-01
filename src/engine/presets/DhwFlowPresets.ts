/**
 * DhwFlowPresets.ts
 *
 * Physics-grounded preset constants for combi DHW sizing.
 *
 * Presets drive the "DHW Flow & Season" panel on the combi switch
 * presentation page without requiring manual data entry:
 *
 *   Season → cold supply temperature (UK ground-water seasonal range)
 *   DHW mode → combi outlet target temperature
 *   Shower type → mixed outlet flow at the showerhead (L/min)
 *   Combi output kW → selectable boiler size (system type)
 *   Property type → approximate heat demand for context
 *   Shower duration → minutes per draw (daily usage model)
 *
 * All flow × ΔT arithmetic uses:
 *   kW = (Cp / 60) × flowLpm × ΔT  where Cp/60 ≈ 0.0697 kW/(L·min·K)
 */

// ─── Season → cold supply temperature (°C) ───────────────────────────────────

/**
 * UK cold-mains supply temperature by season (BGS ground-water data).
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
 *   High   (55 °C) — more mixing headroom, but raises ΔT requirement,
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

// ─── System type: combi output kW options ─────────────────────────────────────

/**
 * Selectable combi boiler DHW output sizes (kW).
 * Drives the heat-limit line on the concurrency graph dynamically —
 * picking a larger combi lifts the line, showing more headroom per outlet.
 *
 * Practical UK market range:
 *   24 kW — compact flat / 1-bed
 *   28 kW — standard 2-3 bed
 *   30 kW — mid-range (default)
 *   32 kW — higher-output / 3-4 bed
 *   36 kW — large house / high-demand
 */
export const COMBI_OUTPUT_KW_OPTIONS = [24, 28, 30, 32, 36] as const;
export type CombiOutputKw = typeof COMBI_OUTPUT_KW_OPTIONS[number];

// ─── Property type → approximate peak heat demand (W) ────────────────────────

/**
 * Property type to indicative peak heat loss (W).
 * Midpoints of realistic UK ranges at design outdoor temperature.
 * For customer modelling context only — not a calculated heat-loss value.
 *
 *   flat:         ~3 kW  (modern/insulated 1-2 bed flat)
 *   small_house:  ~5 kW  (2-3 bed semi / terraced)
 *   medium_house: ~8 kW  (3-4 bed detached / semi, typical)
 *   large_house: ~12 kW  (4-5 bed detached, older fabric)
 */
export const PROPERTY_HEAT_LOSS_PRESETS = {
  flat:         3000,
  small_house:  5000,
  medium_house: 8000,
  large_house:  12000,
} as const;

export type PropertyType = keyof typeof PROPERTY_HEAT_LOSS_PRESETS;

// ─── Shower duration presets (minutes per draw) ───────────────────────────────

/**
 * Shower duration presets for daily DHW usage modelling.
 *   quick:    5 min — rinse / time-poor household
 *   standard: 8 min — UK average shower duration (Water UK data)
 *   long:    12 min — leisure / high-consumption
 */
export const SHOWER_DURATION_PRESETS = {
  quick:    5,
  standard: 8,
  long:     12,
} as const;

export type ShowerDurationPreset = keyof typeof SHOWER_DURATION_PRESETS;

// ─── Physics helpers ──────────────────────────────────────────────────────────

/**
 * Cp / 60: kW per (L/min) per °C.
 * From specific heat of water: 4.186 kJ/(kg·K) ÷ 60 s/min.
 */
export const DHW_KW_PER_LPM_PER_K = 4.186 / 60; // ≈ 0.0697

/**
 * Nominal combi boiler peak DHW heat output (kW).
 * Used as the fallback when no specific combi size has been selected.
 */
export const NOMINAL_COMBI_DHW_KW: CombiOutputKw = 30;

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

/**
 * Estimate daily hot water consumption in litres.
 *
 *   litres = (showersPerDay × durationMin × flowLpm) + (bathsPerDay × 120)
 *
 * 120 L is the UK standard bath draw volume.
 *
 * @param showersPerDay  Number of showers per day.
 * @param durationMin    Average shower duration (minutes).
 * @param showerFlowLpm  Mixed outlet flow at the showerhead (L/min).
 * @param bathsPerDay    Number of baths per day.
 * @returns Estimated daily DHW volume (litres, rounded).
 */
export function computeDailyDhwLitres(
  showersPerDay: number,
  durationMin: number,
  showerFlowLpm: number,
  bathsPerDay: number,
): number {
  const showerVolume = showersPerDay * durationMin * showerFlowLpm;
  const bathVolume   = bathsPerDay * 120;
  return Math.round(showerVolume + bathVolume);
}

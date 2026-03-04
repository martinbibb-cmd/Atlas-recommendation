// src/explainers/lego/animation/thermal.ts

export type ThermalBand = {
  t: number // temperature °C (monotonic)
  hex: string
}

/**
 * A FLIR-ish palette without hard "traffic light" semantics.
 * Smoothly interpolated so it looks like a thermal image.
 *
 * Tuned for domestic DHW/CH ranges (0–85°C).
 */
export const THERMAL_BANDS: ThermalBand[] = [
  { t: 0,  hex: '#07162b' }, // deep navy
  { t: 10, hex: '#0b3b7a' }, // blue
  { t: 20, hex: '#0f7aa7' }, // cyan-blue
  { t: 30, hex: '#16b3a5' }, // teal
  { t: 40, hex: '#4cd66a' }, // green
  { t: 50, hex: '#d9e85b' }, // yellow-green
  { t: 60, hex: '#ffc14a' }, // amber
  { t: 70, hex: '#ff7b3a' }, // orange
  { t: 80, hex: '#ff3b2f' }, // hot red-orange (still thermal, not "error")
  { t: 90, hex: '#fff2e8' }, // near-white hot
]

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return { r, g, b }
}

function rgbToHex(r: number, g: number, b: number) {
  const to = (x: number) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpHex(aHex: string, bHex: string, t: number) {
  const a = hexToRgb(aHex)
  const b = hexToRgb(bHex)
  return rgbToHex(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t))
}

/**
 * Convert temperature °C to a smooth thermal colour.
 */
export function tempToThermalColor(tempC: number): string {
  const t = clamp(tempC, THERMAL_BANDS[0].t, THERMAL_BANDS[THERMAL_BANDS.length - 1].t)

  for (let i = 0; i < THERMAL_BANDS.length - 1; i++) {
    const a = THERMAL_BANDS[i]
    const b = THERMAL_BANDS[i + 1]
    if (t >= a.t && t <= b.t) {
      const u = (t - a.t) / (b.t - a.t || 1)
      return lerpHex(a.hex, b.hex, u)
    }
  }

  return THERMAL_BANDS[THERMAL_BANDS.length - 1].hex
}

/**
 * Specific heat capacity of water (J/kgK).
 * Used to convert between heat content and temperature rise.
 */
const WATER_SPECIFIC_HEAT_CAPACITY_J_PER_KG_K = 4180

/**
 * We store "heat content above cold baseline" on tokens as a proxy.
 * This helper maps that proxy to a temperature for rendering.
 *
 * hJPerKg is a proxy-like number. If you later want literal J/kg,
 * you can keep this function and just pass real J/kg.
 *
 * Approx: cp ≈ 4180 J/kgK => ΔT = h / cp
 */
export function heatToTempC(params: { coldInletC: number; hJPerKg: number }): number {
  const deltaT = params.hJPerKg / WATER_SPECIFIC_HEAT_CAPACITY_J_PER_KG_K
  return params.coldInletC + deltaT
}

/**
 * Inverse helper (useful later for initialising stores).
 */
export function tempToHeatJPerKg(params: { coldInletC: number; tempC: number }): number {
  const deltaT = params.tempC - params.coldInletC
  return deltaT * WATER_SPECIFIC_HEAT_CAPACITY_J_PER_KG_K
}

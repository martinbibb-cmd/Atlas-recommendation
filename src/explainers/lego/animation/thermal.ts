// src/explainers/lego/animation/thermal.ts

export type ThermalBand = {
  t: number // temperature °C (monotonic)
  hex: string
}

/**
 * DHW-friendly palette with six human-round anchor stops.
 * Stops are chosen so each 10 °C step maps to an easily-recognised colour,
 * matching the "cold=blue, warm=yellow, hot=red" mental model customers expect.
 *
 * Domain: 10–60 °C (clamped outside this range).
 * Interpolation: HSL (perceptually smoother than RGB for hue-spanning transitions).
 */
export const THERMAL_BANDS: ThermalBand[] = [
  { t: 10, hex: '#1a4fd6' }, // deep blue   (cold supply / inlet)
  { t: 20, hex: '#06b6d4' }, // cyan        (lukewarm)
  { t: 30, hex: '#22c55e' }, // green       (warm)
  { t: 40, hex: '#facc15' }, // yellow      (hot domestic use threshold)
  { t: 50, hex: '#f97316' }, // orange      (DHW setpoint region)
  { t: 60, hex: '#dc2626' }, // red         (full-heat / store peak)
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

// ── HSL conversion helpers ──────────────────────────────────────────────────

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

/**
 * Interpolate between two hex colours in HSL space.
 * HSL interpolation is perceptually smoother than RGB for hue-spanning gradients
 * (avoids the muddy mid-tones produced by linear RGB blending).
 */
function lerpHex(aHex: string, bHex: string, t: number) {
  const aRgb = hexToRgb(aHex)
  const bRgb = hexToRgb(bHex)
  const [ah, as_, al] = rgbToHsl(aRgb.r, aRgb.g, aRgb.b)
  const [bh, bs, bl] = rgbToHsl(bRgb.r, bRgb.g, bRgb.b)
  // Shortest hue path (handles wrap-around at 0/1 boundary)
  let dh = bh - ah
  if (dh > 0.5) dh -= 1
  if (dh < -0.5) dh += 1
  const h = ((ah + dh * t) % 1 + 1) % 1
  const s = lerp(as_, bs, t)
  const l = lerp(al, bl, t)
  const [r, g, b] = hslToRgb(h, s, l)
  return rgbToHex(r, g, b)
}

/**
 * Convert temperature °C to a smooth thermal colour using the DHW palette.
 * Temperatures outside [10, 60] °C are clamped to the palette endpoints.
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
 * Round a temperature to the nearest 5 °C for human-readable display
 * in tooltips, badges, and legend labels.
 */
export function roundTempC(tempC: number): number {
  return Math.round(tempC / 5) * 5
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

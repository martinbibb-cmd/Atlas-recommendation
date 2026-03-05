// src/explainers/lego/animation/thermal.ts

export type ThermalBand = {
  t: number // temperature °C (monotonic)
  hex: string
}

/**
 * DHW-friendly palette with seven human-round anchor stops.
 * Anchors are chosen to match the "cold=blue → green → yellow → orange=target → red=hot"
 * mental model customers expect for domestic hot-water temperatures.
 *
 * Domain: 5–65 °C (clamped outside this range).
 * Interpolation: HSL (perceptually smoother than RGB for hue-spanning transitions).
 *
 * Stop rationale:
 *   5 °C  – deep blue    : cold mains / inlet
 *  15 °C  – blue/cyan    : cool
 *  25 °C  – green        : warm (tepid)
 *  38 °C  – yellow       : warm shower threshold
 *  45 °C  – orange       : required target (DHW setpoint region) — kept visually distinct
 *  55 °C  – red          : hot / store peak
 *  65 °C  – deep red     : upper clamp (Legionella territory)
 */
export const THERMAL_BANDS: ThermalBand[] = [
  { t:  5, hex: '#1e3a8a' }, // deep blue   (cold mains)
  { t: 15, hex: '#0ea5e9' }, // cyan-blue   (cool)
  { t: 25, hex: '#22c55e' }, // green       (warm / tepid)
  { t: 38, hex: '#facc15' }, // yellow      (warm shower threshold)
  { t: 45, hex: '#f97316' }, // orange      (required target / DHW setpoint)
  { t: 55, hex: '#dc2626' }, // red         (hot / store peak)
  { t: 65, hex: '#7f1d1d' }, // deep red    (upper clamp)
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
 * Round a temperature to the nearest 1 °C for human-readable display
 * in tooltips, badges, and legend labels.
 */
export function roundTempC(tempC: number): number {
  return Math.round(tempC)
}

/**
 * Specific heat capacity of water in kJ/(kg·°C).
 * Conventional DHW-physics value; 1 L of water ≈ 1 kg.
 * Source: CIBSE Guide C (2001) Table 2.1 — water at ~40 °C (typical DHW range);
 * value is stable across the 10–60 °C domestic hot-water temperature band.
 * Used for the combi outlet-temperature formula:
 *   ΔT (°C) = (P_kW × 60) / (flow_L/min × CP_WATER_KJ_PER_KG_C)
 */
export const CP_WATER_KJ_PER_KG_C = 4.19

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

/**
 * Combi outlet temperature physics (lab-only).
 *
 * A fixed boiler output in kW heats a flowing stream at `flowLpm` L/min.
 * Because 1 L ≈ 1 kg and cp ≈ 4.19 kJ/(kg·°C):
 *
 *   ΔT (°C)        = (boilerKw × 60) / (flowLpm × CP_WATER_KJ_PER_KG_C)
 *   achievedOutTempC = coldInletC + ΔT
 *   requiredKw       = (flowLpm × CP_WATER_KJ_PER_KG_C × (targetTempC − coldInletC)) / 60
 *   meetsTarget      = achievedOutTempC >= targetTempC − 0.5  (0.5 °C tolerance)
 *   deficitC         = targetTempC − achievedOutTempC  (positive when failing)
 *
 * Higher flow through the same fixed-kW boiler reduces ΔT, so the outlet
 * temperature drops below target — the key combi trade-off this lab visualises.
 */
export function computeCombiOutletTemp(params: {
  boilerKw: number
  flowLpm: number
  coldInletC: number
  targetTempC: number
}): {
  achievedOutTempC: number
  meetsTarget: boolean
  deficitC: number
  requiredKw: number
} {
  const { boilerKw, flowLpm, coldInletC, targetTempC } = params
  const safeLpm = Math.max(flowLpm, 1e-6)
  const requiredKw = (safeLpm * CP_WATER_KJ_PER_KG_C * Math.max(targetTempC - coldInletC, 0)) / 60
  const meetsTarget = boilerKw >= requiredKw - 1e-6
  const achievedOutTempC = meetsTarget
    ? targetTempC
    : coldInletC + (boilerKw * 60) / (safeLpm * CP_WATER_KJ_PER_KG_C)
  const deficitC = targetTempC - achievedOutTempC
  return { achievedOutTempC, meetsTarget, deficitC, requiredKw }
}

/**
 * Result of thermostatic mixer valve (TMV) shower physics.
 */
export type TmvOutcome = {
  /** Hot-side flow through the boiler heat exchanger (L/min). */
  F_h: number
  /** Cold bypass flow (L/min) — bypasses the heat exchanger entirely. */
  F_c: number
  /** Achieved boiler hot-side outlet temperature (°C). */
  T_h: number
  /** Delivered mixed shower temperature (°C). */
  T_mix: number
  /**
   * True when the hot supply is too cool to reach the target temperature.
   * The thermostatic mixer valve opens fully to 100% hot (saturated);
   * the delivered temperature falls below the target.
   */
  saturated: boolean
  /** Degrees below target when saturated (0 when not saturated). */
  shortfallC: number
}

/**
 * Thermostatic Mixer Valve (TMV) shower physics (lab-only).
 *
 * The mains supply splits at a tee before the boiler:
 *   Branch 1 (cold supply):  cold → cold bypass → mixer
 *   Branch 2 (hot supply):   cold → boiler heat exchanger → hot → mixer
 *
 * The mixer blends hot and cold to reach a target shower temperature (T_t).
 * If the boiler cannot produce hot enough water at the available hot-side flow,
 * the mixer saturates (runs 100 % hot) and the delivered temperature is below T_t.
 *
 * Algorithm (per problem statement §PHYSICS):
 *   1. Estimate T_h if the full shower flow went through the HEX (worst case):
 *        T_h_guess = T_c + (boilerKw × 60) / (F_out × cp)
 *   2. Compute the hot fraction needed:
 *        f_h      = (T_t − T_c) / max(1e-6, T_h_guess − T_c)
 *        F_h      = clamp(f_h, 0, 1) × F_out
 *        F_c      = F_out − F_h
 *   3. Re-solve T_h with only F_h through the HEX:
 *        T_h = T_c + (boilerKw × 60) / (max(F_h, 1e-6) × cp)
 *   4. Feasibility check:
 *        If T_h < T_t → mixer saturated; F_h = F_out, F_c = 0, T_mix = T_h
 *        Else         → T_mix = T_t
 *
 * Key insight: the mixer reduces how much water needs heating (F_h < F_out),
 * so the boiler achieves a higher T_h for the same rated output.  This makes
 * a combi boiler more efficient at meeting the shower target for a given kW.
 */
export function computeTmvMixer(params: {
  boilerKw: number
  combiSetpointC: number
  coldInTempC: number
  /** Mixed outlet (shower delivered) flow rate (L/min). */
  showerDeliveredLpm: number
  /** Shower target temperature — °C. */
  targetTempC: number
}): TmvOutcome {
  const {
    boilerKw,
    combiSetpointC,
    coldInTempC: T_c,
    showerDeliveredLpm: F_out,
    targetTempC: T_t,
  } = params
  const safeF = Math.max(F_out, 1e-6)

  const hotAllFlow = computeCombiOutletTemp({
    boilerKw,
    flowLpm: safeF,
    coldInletC: T_c,
    targetTempC: combiSetpointC,
  })

  const T_h_avail = hotAllFlow.achievedOutTempC

  let F_h: number
  let F_c: number
  let T_h: number
  let T_mix: number
  let saturated: boolean

  if (T_h_avail <= T_c + 0.1) {
    // No meaningful heat available from boiler.
    F_h = F_out; F_c = 0
    T_h = T_c; T_mix = T_c; saturated = true
  } else {
    // Step 2: hot fraction required.
    const f_h_raw = (T_t - T_c) / Math.max(1e-6, T_h_avail - T_c)
    const f_h = clamp(f_h_raw, 0, 1)
    F_h = f_h * F_out
    F_c = F_out - F_h

    // Step 3: actual boiler hot-side temperature with only F_h through HEX.
    const hotBranch = computeCombiOutletTemp({
      boilerKw,
      flowLpm: Math.max(F_h, 1e-6),
      coldInletC: T_c,
      targetTempC: combiSetpointC,
    })
    T_h = hotBranch.achievedOutTempC

    // Step 4: feasibility — can the mixer reach the target?
    if (T_h < T_t) {
      // Mixer saturated: run full hot, delivered temp is T_h (below target).
      saturated = true
      F_h = F_out; F_c = 0
      T_mix = T_h
    } else {
      saturated = false
      T_mix = T_t
    }
  }

  const shortfallC = saturated ? Math.max(0, T_t - T_mix) : 0
  return { F_h, F_c, T_h, T_mix, saturated, shortfallC }
}

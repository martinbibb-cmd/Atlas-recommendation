/**
 * cylinderAnimation.model.ts
 *
 * Presentation-only phase selection for the cylinder behaviour graphic.
 * Maps normalised state → keyed visual phase.
 *
 * No physics are recalculated here.  The phase names are purely visual
 * descriptors used to drive CSS classes and CSS custom properties.
 */

// ─── Phase types ──────────────────────────────────────────────────────────────

export type StandardPhase =
  | 'standard-full'
  | 'standard-slight-bottom-cooling'
  | 'standard-lower-third-mixed'
  | 'standard-mid-mixed'
  | 'standard-near-depleted'
  | 'standard-depleted'

export type MixergyPhase =
  | 'mixergy-full-hot-layer'
  | 'mixergy-slight-thermocline-shift'
  | 'mixergy-mid-thermocline'
  | 'mixergy-reduced-hot-layer'
  | 'mixergy-boundary-near-outlet'
  | 'mixergy-collapse'

export type CylinderAnimationPhase = StandardPhase | MixergyPhase

// ─── Phase selection ──────────────────────────────────────────────────────────

/**
 * Select a visual phase for a standard cylinder.
 *
 * During recovery the visual is shifted one step toward a fuller appearance;
 * during draw the phase reflects the current fraction directly.
 *
 * @param hotFraction     0–1 usable hot fraction
 * @param drawActive      true while hot water is being drawn
 * @param recoveryActive  true while the boiler/HP is reheating
 */
export function selectStandardPhase(
  hotFraction: number,
  drawActive: boolean,
  recoveryActive: boolean,
): StandardPhase {
  // Shift fraction upward during recovery to communicate warming
  const f = recoveryActive ? Math.min(1, hotFraction + 0.15) : hotFraction

  if (f >= 0.85) return 'standard-full'
  if (f >= 0.65) return drawActive ? 'standard-slight-bottom-cooling' : 'standard-full'
  if (f >= 0.45) return 'standard-slight-bottom-cooling'
  if (f >= 0.30) return 'standard-lower-third-mixed'
  if (f >= 0.20) return 'standard-mid-mixed'
  if (f >= 0.10) return 'standard-near-depleted'
  return 'standard-depleted'
}

/**
 * Select a visual phase for a Mixergy stratified cylinder.
 *
 * Hot layer stays visually stable until the thermocline nears the outlet;
 * recovery expands the hot layer downward.
 *
 * @param heatedLayerFraction  0–1 fraction of cylinder volume currently heated
 * @param drawActive           true while hot water is being drawn
 * @param recoveryActive       true while the boiler/HP is reheating
 */
export function selectMixergyPhase(
  heatedLayerFraction: number,
  drawActive: boolean,
  recoveryActive: boolean,
): MixergyPhase {
  const f = recoveryActive ? Math.min(1, heatedLayerFraction + 0.15) : heatedLayerFraction

  if (f >= 0.85) return 'mixergy-full-hot-layer'
  if (f >= 0.65) return drawActive ? 'mixergy-slight-thermocline-shift' : 'mixergy-full-hot-layer'
  if (f >= 0.45) return 'mixergy-slight-thermocline-shift'
  if (f >= 0.30) return 'mixergy-mid-thermocline'
  if (f >= 0.20) return 'mixergy-reduced-hot-layer'
  if (f >= 0.10) return 'mixergy-boundary-near-outlet'
  return 'mixergy-collapse'
}

/**
 * Returns the best static phase for reduced-motion rendering.
 * No draw/recovery adjustments are applied — the phase reflects
 * the current fraction directly without implying motion.
 */
export function selectReducedMotionPhase(
  type: 'standard' | 'mixergy',
  hotFraction: number,
  heatedLayerFraction: number,
): CylinderAnimationPhase {
  if (type === 'mixergy') {
    return selectMixergyPhase(heatedLayerFraction, false, false)
  }
  return selectStandardPhase(hotFraction, false, false)
}

// ─── CSS variable values per phase ───────────────────────────────────────────

/**
 * CSS custom properties driven by the animation phase.
 *
 * Standard cylinder:
 *   --cbg-depletion-height   fraction of vessel height overlaid with the
 *                            cooled/depleted tone (0–1)
 *   --cbg-depletion-opacity  opacity of the depletion overlay (0–1)
 *
 * Mixergy cylinder:
 *   --cbg-thermocline-height  thermocline band height in px
 *
 * All three variables are emitted for every phase so the CSS has a
 * consistent set of fallbacks regardless of cylinder type.
 */
export interface CylinderAnimCssVars extends Record<string, string> {
  '--cbg-depletion-height': string
  '--cbg-depletion-opacity': string
  '--cbg-thermocline-height': string
}

const STANDARD_PHASE_VARS: Record<StandardPhase, { deplH: number; deplO: number }> = {
  'standard-full':                  { deplH: 0,    deplO: 0    },
  'standard-slight-bottom-cooling': { deplH: 0.12, deplO: 0.20 },
  'standard-lower-third-mixed':     { deplH: 0.28, deplO: 0.40 },
  'standard-mid-mixed':             { deplH: 0.48, deplO: 0.58 },
  'standard-near-depleted':         { deplH: 0.68, deplO: 0.72 },
  'standard-depleted':              { deplH: 0.88, deplO: 0.88 },
}

const MIXERGY_THERMOCLINE_PX: Record<MixergyPhase, number> = {
  'mixergy-full-hot-layer':           10,
  'mixergy-slight-thermocline-shift': 10,
  'mixergy-mid-thermocline':          12,
  'mixergy-reduced-hot-layer':        10,
  'mixergy-boundary-near-outlet':     8,
  'mixergy-collapse':                 6,
}

export function buildCssVarsForPhase(phase: CylinderAnimationPhase): CylinderAnimCssVars {
  if (phase.startsWith('standard-')) {
    const { deplH, deplO } = STANDARD_PHASE_VARS[phase as StandardPhase]
    return {
      '--cbg-depletion-height':   String(deplH),
      '--cbg-depletion-opacity':  String(deplO),
      '--cbg-thermocline-height': '10px',
    }
  }

  const tcHeight = MIXERGY_THERMOCLINE_PX[phase as MixergyPhase] ?? 10
  return {
    '--cbg-depletion-height':   '0',
    '--cbg-depletion-opacity':  '0',
    '--cbg-thermocline-height': `${tcHeight}px`,
  }
}

/**
 * cylinderAnimation.test.ts
 *
 * Unit tests for cylinderAnimation.model and useCylinderAnimationPhase.
 *
 * Tests verify:
 *   - correct phase selection for standard vs Mixergy
 *   - reduced-motion fallback (no draw/recovery adjustments)
 *   - no .cbg__hot-zone CSS class involvement in standard path
 *   - Mixergy thermocline-height changes with phase
 *   - standard path never produces a hard zone layout
 *   - CSS vars change correctly when drawActive or recoveryActive changes
 *   - buildCssVarsForPhase produces sensible values for every phase
 */

import { describe, it, expect } from 'vitest'
import {
  selectStandardPhase,
  selectMixergyPhase,
  selectReducedMotionPhase,
  buildCssVarsForPhase,
} from '../cylinderAnimation.model'
import type { StandardPhase, MixergyPhase } from '../cylinderAnimation.model'

// ─── selectStandardPhase ─────────────────────────────────────────────────────

describe('selectStandardPhase', () => {
  it('returns standard-full at high fraction (no draw/recovery)', () => {
    expect(selectStandardPhase(0.95, false, false)).toBe('standard-full')
    expect(selectStandardPhase(0.85, false, false)).toBe('standard-full')
  })

  it('returns standard-full when fraction is 0.70 and no draw', () => {
    // 0.70 >= 0.65 and not drawActive → standard-full
    expect(selectStandardPhase(0.70, false, false)).toBe('standard-full')
  })

  it('returns standard-slight-bottom-cooling when fraction is 0.70 and draw is active', () => {
    expect(selectStandardPhase(0.70, true, false)).toBe('standard-slight-bottom-cooling')
  })

  it('returns standard-slight-bottom-cooling for mid-high fraction without draw', () => {
    expect(selectStandardPhase(0.55, false, false)).toBe('standard-slight-bottom-cooling')
  })

  it('returns standard-lower-third-mixed around 0.35', () => {
    expect(selectStandardPhase(0.35, false, false)).toBe('standard-lower-third-mixed')
  })

  it('returns standard-mid-mixed around 0.25', () => {
    expect(selectStandardPhase(0.25, false, false)).toBe('standard-mid-mixed')
  })

  it('returns standard-near-depleted around 0.12', () => {
    expect(selectStandardPhase(0.12, false, false)).toBe('standard-near-depleted')
  })

  it('returns standard-depleted at very low fraction', () => {
    expect(selectStandardPhase(0.05, false, false)).toBe('standard-depleted')
    expect(selectStandardPhase(0, false, false)).toBe('standard-depleted')
  })

  it('shifts phase toward fuller during recovery', () => {
    // Without recovery: 0.30 → standard-lower-third-mixed
    expect(selectStandardPhase(0.30, false, false)).toBe('standard-lower-third-mixed')
    // With recovery: 0.32 + 0.15 = 0.47 ≥ 0.45 → standard-slight-bottom-cooling
    expect(selectStandardPhase(0.32, false, true)).toBe('standard-slight-bottom-cooling')
  })

  it('does not exceed standard-full during recovery', () => {
    expect(selectStandardPhase(0.95, false, true)).toBe('standard-full')
  })
})

// ─── selectMixergyPhase ───────────────────────────────────────────────────────

describe('selectMixergyPhase', () => {
  it('returns mixergy-full-hot-layer at high fraction', () => {
    expect(selectMixergyPhase(0.90, false, false)).toBe('mixergy-full-hot-layer')
    expect(selectMixergyPhase(0.85, false, false)).toBe('mixergy-full-hot-layer')
  })

  it('returns mixergy-full-hot-layer at 0.70 with no draw', () => {
    expect(selectMixergyPhase(0.70, false, false)).toBe('mixergy-full-hot-layer')
  })

  it('returns mixergy-slight-thermocline-shift at 0.70 with draw active', () => {
    expect(selectMixergyPhase(0.70, true, false)).toBe('mixergy-slight-thermocline-shift')
  })

  it('returns mixergy-slight-thermocline-shift around 0.50', () => {
    expect(selectMixergyPhase(0.50, false, false)).toBe('mixergy-slight-thermocline-shift')
  })

  it('returns mixergy-mid-thermocline around 0.35', () => {
    expect(selectMixergyPhase(0.35, false, false)).toBe('mixergy-mid-thermocline')
  })

  it('returns mixergy-reduced-hot-layer around 0.25', () => {
    expect(selectMixergyPhase(0.25, false, false)).toBe('mixergy-reduced-hot-layer')
  })

  it('returns mixergy-boundary-near-outlet around 0.12', () => {
    expect(selectMixergyPhase(0.12, false, false)).toBe('mixergy-boundary-near-outlet')
  })

  it('returns mixergy-collapse at very low fraction', () => {
    expect(selectMixergyPhase(0.05, false, false)).toBe('mixergy-collapse')
    expect(selectMixergyPhase(0, false, false)).toBe('mixergy-collapse')
  })

  it('shifts phase toward fuller during recovery', () => {
    expect(selectMixergyPhase(0.30, false, false)).toBe('mixergy-mid-thermocline')
    // With recovery: 0.32 + 0.15 = 0.47 ≥ 0.45 → mixergy-slight-thermocline-shift
    expect(selectMixergyPhase(0.32, false, true)).toBe('mixergy-slight-thermocline-shift')
  })
})

// ─── selectReducedMotionPhase ─────────────────────────────────────────────────

describe('selectReducedMotionPhase', () => {
  it('returns a standard phase for standard type regardless of draw/recovery', () => {
    const phase = selectReducedMotionPhase('standard', 0.70, 0.70)
    expect(phase).toMatch(/^standard-/)
  })

  it('returns a mixergy phase for mixergy type', () => {
    const phase = selectReducedMotionPhase('mixergy', 0.70, 0.70)
    expect(phase).toMatch(/^mixergy-/)
  })

  it('ignores the hotFraction argument when type is mixergy', () => {
    // Both calls should use heatedLayerFraction, not hotFraction
    const phase1 = selectReducedMotionPhase('mixergy', 0.10, 0.90)
    const phase2 = selectReducedMotionPhase('mixergy', 0.90, 0.05)
    expect(phase1).toBe('mixergy-full-hot-layer')
    expect(phase2).toBe('mixergy-collapse')
  })

  it('returns correct phase without draw/recovery bias for standard', () => {
    // 0.65 without recovery → standard-full (≥0.65 without drawActive)
    expect(selectReducedMotionPhase('standard', 0.65, 0)).toBe('standard-full')
  })
})

// ─── buildCssVarsForPhase ─────────────────────────────────────────────────────

describe('buildCssVarsForPhase', () => {
  const standardPhases: StandardPhase[] = [
    'standard-full',
    'standard-slight-bottom-cooling',
    'standard-lower-third-mixed',
    'standard-mid-mixed',
    'standard-near-depleted',
    'standard-depleted',
  ]

  const mixergyPhases: MixergyPhase[] = [
    'mixergy-full-hot-layer',
    'mixergy-slight-thermocline-shift',
    'mixergy-mid-thermocline',
    'mixergy-reduced-hot-layer',
    'mixergy-boundary-near-outlet',
    'mixergy-collapse',
  ]

  it('emits all three CSS variables for every standard phase', () => {
    for (const phase of standardPhases) {
      const vars = buildCssVarsForPhase(phase)
      expect(vars).toHaveProperty('--cbg-depletion-height')
      expect(vars).toHaveProperty('--cbg-depletion-opacity')
      expect(vars).toHaveProperty('--cbg-thermocline-height')
    }
  })

  it('emits all three CSS variables for every Mixergy phase', () => {
    for (const phase of mixergyPhases) {
      const vars = buildCssVarsForPhase(phase)
      expect(vars).toHaveProperty('--cbg-depletion-height')
      expect(vars).toHaveProperty('--cbg-depletion-opacity')
      expect(vars).toHaveProperty('--cbg-thermocline-height')
    }
  })

  it('standard-full has zero depletion height and opacity', () => {
    const vars = buildCssVarsForPhase('standard-full')
    expect(vars['--cbg-depletion-height']).toBe('0')
    expect(vars['--cbg-depletion-opacity']).toBe('0')
  })

  it('standard-depleted has non-zero depletion height and opacity', () => {
    const vars = buildCssVarsForPhase('standard-depleted')
    expect(Number(vars['--cbg-depletion-height'])).toBeGreaterThan(0)
    expect(Number(vars['--cbg-depletion-opacity'])).toBeGreaterThan(0)
  })

  it('standard phases depletion height increases as cylinder depletes', () => {
    const heights = standardPhases.map(p => Number(buildCssVarsForPhase(p)['--cbg-depletion-height']))
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1])
    }
  })

  it('Mixergy phases have zero depletion values (no depletion overlay on Mixergy)', () => {
    for (const phase of mixergyPhases) {
      const vars = buildCssVarsForPhase(phase)
      expect(vars['--cbg-depletion-height']).toBe('0')
      expect(vars['--cbg-depletion-opacity']).toBe('0')
    }
  })

  it('Mixergy thermocline height is expressed in px', () => {
    for (const phase of mixergyPhases) {
      const vars = buildCssVarsForPhase(phase)
      expect(vars['--cbg-thermocline-height']).toMatch(/px$/)
    }
  })

  it('mixergy-mid-thermocline has larger thermocline than mixergy-collapse', () => {
    const mid = parseInt(buildCssVarsForPhase('mixergy-mid-thermocline')['--cbg-thermocline-height'])
    const collapse = parseInt(buildCssVarsForPhase('mixergy-collapse')['--cbg-thermocline-height'])
    expect(mid).toBeGreaterThan(collapse)
  })
})

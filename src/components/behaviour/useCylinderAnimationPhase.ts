/**
 * useCylinderAnimationPhase.ts
 *
 * Presentation helper hook that maps cylinder state to an animation phase,
 * CSS class name, and CSS custom properties.
 *
 * Keeps animation logic out of render JSX and centralises reduced-motion
 * handling.
 */

import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { CylinderGraphicType } from './cylinderGraphic.model'
import { DEFAULT_HOT_FRACTION, DEFAULT_HEATED_FRACTION } from './cylinderGraphic.model'
import type { CylinderAnimationPhase } from './cylinderAnimation.model'
import {
  selectStandardPhase,
  selectMixergyPhase,
  selectReducedMotionPhase,
  buildCssVarsForPhase,
} from './cylinderAnimation.model'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CylinderAnimationInputs {
  type: CylinderGraphicType
  drawActive?: boolean
  recoveryActive?: boolean
  hotFraction?: number
  heatedLayerFraction?: number
  /**
   * Override reduced-motion detection.  Useful for tests and environments
   * where window.matchMedia is unavailable.
   */
  reducedMotion?: boolean
}

export interface CylinderAnimationResult {
  phase: CylinderAnimationPhase
  /** CSS class to add to the cbg wrapper, e.g. 'cbg--phase-standard-full'. */
  phaseClass: string
  /** CSS custom properties to apply as inline style on the cbg wrapper. */
  cssVars: CSSProperties
  /** True when transitions are enabled (prefers-reduced-motion is not set). */
  animated: boolean
}

// ─── Reduced-motion detection ─────────────────────────────────────────────────

function detectReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCylinderAnimationPhase(
  inputs: CylinderAnimationInputs,
): CylinderAnimationResult {
  const {
    type,
    drawActive = false,
    recoveryActive = false,
    hotFraction = DEFAULT_HOT_FRACTION,
    heatedLayerFraction = DEFAULT_HEATED_FRACTION,
    reducedMotion,
  } = inputs

  return useMemo((): CylinderAnimationResult => {
    const prefersReduced = reducedMotion ?? detectReducedMotion()
    const animated = !prefersReduced

    let phase: CylinderAnimationPhase
    if (prefersReduced) {
      phase = selectReducedMotionPhase(type, hotFraction, heatedLayerFraction)
    } else if (type === 'mixergy') {
      phase = selectMixergyPhase(heatedLayerFraction, drawActive, recoveryActive)
    } else {
      phase = selectStandardPhase(hotFraction, drawActive, recoveryActive)
    }

    const phaseClass = `cbg--phase-${phase}`
    const cssVars = buildCssVarsForPhase(phase) as CSSProperties

    return { phase, phaseClass, cssVars, animated }
  }, [type, drawActive, recoveryActive, hotFraction, heatedLayerFraction, reducedMotion])
}

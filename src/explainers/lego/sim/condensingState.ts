// src/explainers/lego/sim/condensingState.ts

import type { HeatSourceType } from '../animation/types'

/**
 * Three-state condensing classification for boiler-based heat sources.
 *
 * Driven by return-water temperature relative to the 55°C latent-heat
 * recovery threshold that the engine already uses in CombiStressModule.
 */
export type CondensingState = 'condensing' | 'borderline' | 'not_condensing'

/**
 * The critical physical threshold for latent-heat recovery.
 * Below this return temperature the boiler flue gases condense and the
 * latent heat in the water vapour is recovered — improving efficiency by
 * roughly 10–12 %.
 *
 * Matches CONDENSING_RETURN_TEMP_THRESHOLD in CombiStressModule.ts and
 * CONDENSING_RETURN_TEMP_THRESHOLD in simulation.ts.
 */
export const CONDENSING_RETURN_THRESHOLD_C = 55

/**
 * Lower bound of the borderline zone.
 * Return temperatures between 50 °C and 55 °C are considered borderline:
 * the boiler is operating close to the threshold and small changes in
 * flow-rate or load can push it either way.
 */
export const CONDENSING_BORDERLINE_LOW_C = 50

/**
 * Classify the current condensing state from the measured or modelled
 * return-water temperature.
 *
 * Mapping:
 *   returnTempC < 50   → condensing   (safely below threshold)
 *   50 ≤ returnTempC ≤ 55 → borderline  (near the threshold)
 *   returnTempC > 55   → not_condensing (above threshold, no latent gain)
 *
 * The 55 °C threshold remains the meaningful physical boundary.
 * The borderline zone gives the user early warning before efficiency is lost.
 */
export function deriveCondensingState(returnTempC: number): CondensingState {
  if (returnTempC < CONDENSING_BORDERLINE_LOW_C) return 'condensing'
  if (returnTempC <= CONDENSING_RETURN_THRESHOLD_C) return 'borderline'
  return 'not_condensing'
}

/**
 * Return true when the heat source type is a boiler (combi, system, or
 * regular).  Condensing-state classification is boiler-specific — heat
 * pumps use a completely different efficiency model (COP) and must not
 * receive a misleading condensing badge.
 */
export function isBoilerHeatSource(heatSourceType: HeatSourceType): boolean {
  return (
    heatSourceType === 'combi' ||
    heatSourceType === 'system_boiler' ||
    heatSourceType === 'regular_boiler'
  )
}

/**
 * Short badge label for the sim-time-bar indicator.
 */
export function condensingStateBadgeText(state: CondensingState): string {
  switch (state) {
    case 'condensing':     return '🟢 Condensing'
    case 'borderline':     return '🟡 Borderline'
    case 'not_condensing': return '🔴 Not condensing'
  }
}

/**
 * Plain-English explanatory line shown as the badge tooltip.
 * Kept concise so it can be read at a glance in the lab UI.
 */
export function condensingStateDescription(state: CondensingState): string {
  switch (state) {
    case 'condensing':
      return 'Condensing active — return temperature is low enough for latent heat recovery.'
    case 'borderline':
      return 'Borderline condensing — near the threshold; small changes in flow or return temperature may reduce efficiency.'
    case 'not_condensing':
      return 'Not condensing — return temperature is too high for latent heat recovery.'
  }
}

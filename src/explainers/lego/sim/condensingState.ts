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

// ─── Condensing quality ───────────────────────────────────────────────────────

/**
 * Richer operating-quality classification that separates design-load behaviour
 * from current-load behaviour.
 *
 * This goes beyond the binary condensing/not-condensing view by showing
 * whether the boiler condenses reliably across all operating conditions or
 * only at lighter loads.
 *
 * condensing_reliably      — return temp stays below the condensing threshold
 *                            even at full (cold-day) design load.
 * can_condense_at_low_load — at typical mid-season loads the return temp is
 *                            below the threshold, but at full design load it
 *                            rises above it.  Standard radiator systems with
 *                            load compensation often fall here.
 * high_flow_temp_required  — the current operating point is borderline; the
 *                            boiler needs a high flow temperature and spends
 *                            limited time condensing.
 * rarely_condensing        — both design and current operating loads keep the
 *                            return temperature above the threshold; latent
 *                            heat recovery is rarely achieved.
 */
export type CondensingQuality =
  | 'condensing_reliably'
  | 'can_condense_at_low_load'
  | 'high_flow_temp_required'
  | 'rarely_condensing'

/**
 * Derive the condensing quality from design-load and current-load return
 * temperatures.
 *
 * @param designLoadReturnTempC  Return temp at full cold-day design load (°C).
 * @param currentLoadReturnTempC Return temp at typical current operating
 *                               load (°C).  Equals designLoadReturnTempC when
 *                               load compensation is off.
 */
export function deriveCondensingQuality(
  designLoadReturnTempC: number,
  currentLoadReturnTempC: number,
): CondensingQuality {
  if (designLoadReturnTempC < CONDENSING_BORDERLINE_LOW_C) {
    // System condenses even at peak load → reliable.
    return 'condensing_reliably'
  }
  if (currentLoadReturnTempC < CONDENSING_BORDERLINE_LOW_C) {
    // Design load runs hot but at typical load the return falls into the
    // condensing range — this is the "standard radiators CAN condense" story.
    return 'can_condense_at_low_load'
  }
  if (currentLoadReturnTempC <= CONDENSING_RETURN_THRESHOLD_C) {
    // Current operating point is in the borderline zone.
    return 'high_flow_temp_required'
  }
  // Even at current load the return is above the threshold.
  return 'rarely_condensing'
}

/**
 * Short human-readable label for the condensing quality badge.
 */
export function condensingQualityLabel(quality: CondensingQuality): string {
  switch (quality) {
    case 'condensing_reliably':      return 'Condenses reliably'
    case 'can_condense_at_low_load': return 'Can condense at low load'
    case 'high_flow_temp_required':  return 'Needs high flow temp at this load'
    case 'rarely_condensing':        return 'Rarely condensing in current setup'
  }
}

/**
 * Explanatory sentence for the condensing quality state.
 */
export function condensingQualityDescription(quality: CondensingQuality): string {
  switch (quality) {
    case 'condensing_reliably':
      return 'Return temperature stays below the condensing threshold even at full cold-day design load — latent heat recovery is reliable across normal operating conditions.'
    case 'can_condense_at_low_load':
      return 'At typical mid-season loads (~50% of design load) the return temperature drops into the condensing range. On the coldest days the return temperature rises above the threshold — but this is normal for standard radiator systems with good controls.'
    case 'high_flow_temp_required':
      return 'This setup requires a high flow temperature to meet the design load. Condensing efficiency is limited at this operating point; oversized emitters or load compensation would improve it.'
    case 'rarely_condensing':
      return 'The return temperature stays above the condensing threshold under most operating conditions. Latent heat recovery is rarely achieved; lower flow temperature controls or improved emitters would help significantly.'
  }
}

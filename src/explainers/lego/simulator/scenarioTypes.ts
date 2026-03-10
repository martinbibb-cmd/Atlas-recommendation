/**
 * Scenario presets for the day-model simulator.
 *
 * Each preset bundles a coherent set of day-context defaults (cold inlet temp,
 * sunrise/sunset markers, occupancy profile) so users can switch between
 * meaningful day contexts without reconfiguring every input manually.
 *
 * Guardrails:
 *   - No cost model, no carbon model, no export logic.
 *   - All preset values remain fully editable after selection.
 *   - Model stays deterministic — no Math.random().
 *
 * PR19: Winter weekday / Winter weekend / Mild spring-autumn / Summer DHW-only.
 */

import type { OccupancyProfile } from './systemInputsTypes'

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Identifier for a day-context scenario preset.
 *
 * winter_weekday  — cold inlet, high heating demand, sharp morning/evening peaks.
 * winter_weekend  — cold inlet, high heating demand, steady all-day occupation.
 * mild_day        — moderate inlet, lower required flow temp, better condensing.
 * summer_dhw      — warm inlet, no meaningful space-heating, DHW-only context.
 */
export type ScenarioKey = 'winter_weekday' | 'winter_weekend' | 'mild_day' | 'summer_dhw'

/**
 * A complete day-context preset.
 *
 * Presets apply a bundled set of defaults to the simulator inputs; users can
 * still override any value after selecting a preset.
 */
export type ScenarioPreset = {
  /** Unique preset identifier. */
  key: ScenarioKey
  /** Short display label shown in the scenario selector. */
  label: string
  /** One-line description shown as a tooltip / help text. */
  description: string
  /** Sunrise hour for the 24-hour timeline strip (0–23). */
  sunriseHour: number
  /** Sunset hour for the 24-hour timeline strip (0–23). */
  sunsetHour: number
  /** Cold water inlet temperature in °C applied to system inputs. */
  coldInletTempC: number
  /** Occupancy profile applied to system inputs. */
  occupancyProfile: OccupancyProfile
  /** Short season-context label shown in the daily efficiency summary. */
  seasonContext: string
}

// ─── Preset definitions ────────────────────────────────────────────────────────

export const SCENARIO_PRESETS: Record<ScenarioKey, ScenarioPreset> = {
  winter_weekday: {
    key: 'winter_weekday',
    label: 'Winter weekday',
    description: 'Cold inlet, high heating demand, sharp morning and evening peaks.',
    sunriseHour: 8,
    sunsetHour: 16,
    coldInletTempC: 7,
    occupancyProfile: 'professional',
    seasonContext: 'Winter day',
  },
  winter_weekend: {
    key: 'winter_weekend',
    label: 'Winter weekend',
    description: 'Cold inlet, high heating demand, steady occupation throughout the day.',
    sunriseHour: 8,
    sunsetHour: 16,
    coldInletTempC: 7,
    occupancyProfile: 'steady_home',
    seasonContext: 'Winter day',
  },
  mild_day: {
    key: 'mild_day',
    label: 'Mild spring/autumn',
    description: 'Moderate inlet temperature, lower required flow temperature, better condensing tendency.',
    sunriseHour: 6,
    sunsetHour: 19,
    coldInletTempC: 12,
    occupancyProfile: 'professional',
    seasonContext: 'Mild day',
  },
  summer_dhw: {
    key: 'summer_dhw',
    label: 'Summer DHW-only',
    description: 'Warm inlet temperature, no meaningful space-heating demand. On-demand hot water efficiency most visible.',
    sunriseHour: 5,
    sunsetHour: 21,
    coldInletTempC: 18,
    occupancyProfile: 'professional',
    seasonContext: 'Summer day',
  },
}

/** Ordered list of all scenario presets, for rendering the selector. */
export const SCENARIO_PRESET_LIST: readonly ScenarioPreset[] = [
  SCENARIO_PRESETS.winter_weekday,
  SCENARIO_PRESETS.winter_weekend,
  SCENARIO_PRESETS.mild_day,
  SCENARIO_PRESETS.summer_dhw,
]

/** Default scenario applied on first load. */
export const DEFAULT_SCENARIO_KEY: ScenarioKey = 'winter_weekday'

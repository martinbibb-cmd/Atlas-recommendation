/**
 * Tests for scenario presets — scenarioTypes.ts + useDayTimeline.ts +
 * useDailyEfficiencySummary.ts integration.
 *
 * Validates:
 *   - All 4 scenario presets exist and have valid field values
 *   - SCENARIO_PRESET_LIST contains all 4 presets in a consistent order
 *   - DEFAULT_SCENARIO_KEY is a valid key
 *   - computeDayTimeline respects astroOverrides (scenario sunrise/sunset)
 *   - computeDayTimeline falls back to UK winter constants when no overrides
 *   - computeDailyEfficiencySummary carries seasonContext through to the state
 *   - seasonContext is absent when not passed
 */

import { describe, it, expect } from 'vitest'
import {
  SCENARIO_PRESETS,
  SCENARIO_PRESET_LIST,
  DEFAULT_SCENARIO_KEY,
} from '../simulator/scenarioTypes'
import type { ScenarioKey } from '../simulator/scenarioTypes'
import {
  computeDayTimeline,
  SUNRISE_HOUR,
  SUNSET_HOUR,
} from '../simulator/useDayTimeline'
import { computeDailyEfficiencySummary } from '../simulator/useDailyEfficiencySummary'
import type { SystemInputs } from '../simulator/systemInputsTypes'
import { DEFAULT_SYSTEM_INPUTS } from '../simulator/systemInputsTypes'
import type { EmitterPrimaryDisplayState } from '../simulator/useEmitterPrimaryModel'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_KEYS: ScenarioKey[] = ['winter_weekday', 'winter_weekend', 'mild_day', 'summer_dhw']

function baseEmitter(overrides: Partial<EmitterPrimaryDisplayState> = {}): EmitterPrimaryDisplayState {
  return {
    requiredFlowTempC: 70,
    estimatedReturnTempC: 58,
    currentLoadFlowTempC: 58,
    currentLoadReturnTempC: 46,
    emitterAdequate: true,
    primaryAdequate: true,
    heatDemandKw: 14,
    primaryCapacityKw: 25,
    estimatedCop: 3.2,
    ...overrides,
  }
}

function baseInputs(overrides: Partial<SystemInputs> = {}): SystemInputs {
  return { ...DEFAULT_SYSTEM_INPUTS, ...overrides }
}

// ─── Preset definitions ────────────────────────────────────────────────────────

describe('SCENARIO_PRESETS — all 4 presets present', () => {
  it('has all expected keys', () => {
    for (const key of ALL_KEYS) {
      expect(SCENARIO_PRESETS).toHaveProperty(key)
    }
  })
})

describe('SCENARIO_PRESETS — each preset has valid fields', () => {
  for (const key of ALL_KEYS) {
    const preset = SCENARIO_PRESETS[key]

    it(`${key}: sunriseHour is in [0, 23]`, () => {
      expect(preset.sunriseHour).toBeGreaterThanOrEqual(0)
      expect(preset.sunriseHour).toBeLessThanOrEqual(23)
    })

    it(`${key}: sunsetHour > sunriseHour`, () => {
      expect(preset.sunsetHour).toBeGreaterThan(preset.sunriseHour)
    })

    it(`${key}: coldInletTempC is in [5, 20]`, () => {
      expect(preset.coldInletTempC).toBeGreaterThanOrEqual(5)
      expect(preset.coldInletTempC).toBeLessThanOrEqual(20)
    })

    it(`${key}: occupancyProfile is a valid value`, () => {
      const validProfiles = ['professional', 'steady_home', 'family', 'shift']
      expect(validProfiles).toContain(preset.occupancyProfile)
    })

    it(`${key}: label is a non-empty string`, () => {
      expect(typeof preset.label).toBe('string')
      expect(preset.label.length).toBeGreaterThan(0)
    })

    it(`${key}: seasonContext is a non-empty string`, () => {
      expect(typeof preset.seasonContext).toBe('string')
      expect(preset.seasonContext.length).toBeGreaterThan(0)
    })
  }
})

describe('SCENARIO_PRESET_LIST', () => {
  it('contains exactly 4 presets', () => {
    expect(SCENARIO_PRESET_LIST).toHaveLength(4)
  })

  it('contains all 4 scenario keys', () => {
    const keys = SCENARIO_PRESET_LIST.map(p => p.key)
    for (const key of ALL_KEYS) {
      expect(keys).toContain(key)
    }
  })
})

describe('DEFAULT_SCENARIO_KEY', () => {
  it('is a valid scenario key', () => {
    expect(ALL_KEYS).toContain(DEFAULT_SCENARIO_KEY)
  })

  it('exists in SCENARIO_PRESETS', () => {
    expect(SCENARIO_PRESETS).toHaveProperty(DEFAULT_SCENARIO_KEY)
  })
})

// ─── Scenario cold inlet temperatures ─────────────────────────────────────────

describe('SCENARIO_PRESETS — cold inlet ordering', () => {
  it('summer_dhw has higher coldInletTempC than winter_weekday', () => {
    expect(SCENARIO_PRESETS.summer_dhw.coldInletTempC).toBeGreaterThan(
      SCENARIO_PRESETS.winter_weekday.coldInletTempC,
    )
  })

  it('mild_day coldInletTempC is between winter and summer', () => {
    const mild  = SCENARIO_PRESETS.mild_day.coldInletTempC
    const winter = SCENARIO_PRESETS.winter_weekday.coldInletTempC
    const summer = SCENARIO_PRESETS.summer_dhw.coldInletTempC
    expect(mild).toBeGreaterThan(winter)
    expect(mild).toBeLessThan(summer)
  })
})

// ─── computeDayTimeline with scenario overrides ────────────────────────────────

describe('computeDayTimeline — astroOverrides from scenario presets', () => {
  it('falls back to UK winter constants when no overrides given', () => {
    const state = computeDayTimeline(12)
    expect(state.sunriseHour).toBe(SUNRISE_HOUR)
    expect(state.sunsetHour).toBe(SUNSET_HOUR)
  })

  it('uses overridden sunriseHour and sunsetHour when provided', () => {
    const state = computeDayTimeline(12, { sunriseHour: 5, sunsetHour: 21 })
    expect(state.sunriseHour).toBe(5)
    expect(state.sunsetHour).toBe(21)
  })

  it('summer preset produces longer daylight band than winter preset', () => {
    const winterPreset = SCENARIO_PRESETS.winter_weekday
    const summerPreset = SCENARIO_PRESETS.summer_dhw
    const winterDaylight = winterPreset.sunsetHour - winterPreset.sunriseHour
    const summerDaylight = summerPreset.sunsetHour - summerPreset.sunriseHour
    expect(summerDaylight).toBeGreaterThan(winterDaylight)
  })

  it('isDaytime is correct for hour inside scenario daylight window', () => {
    const preset = SCENARIO_PRESETS.summer_dhw  // sunrise 5, sunset 21
    const state = computeDayTimeline(12, { sunriseHour: preset.sunriseHour, sunsetHour: preset.sunsetHour })
    expect(state.isDaytime).toBe(true)
  })

  it('isDaytime is false before scenario sunrise', () => {
    const preset = SCENARIO_PRESETS.summer_dhw  // sunrise 5
    const state = computeDayTimeline(3, { sunriseHour: preset.sunriseHour, sunsetHour: preset.sunsetHour })
    expect(state.isDaytime).toBe(false)
  })

  it('isDaytime is false after scenario sunset', () => {
    const preset = SCENARIO_PRESETS.winter_weekday  // sunset 16
    const state = computeDayTimeline(17, { sunriseHour: preset.sunriseHour, sunsetHour: preset.sunsetHour })
    expect(state.isDaytime).toBe(false)
  })

  it('simHour 20 is daytime under summer preset but not winter preset', () => {
    const summer = computeDayTimeline(20, {
      sunriseHour: SCENARIO_PRESETS.summer_dhw.sunriseHour,
      sunsetHour: SCENARIO_PRESETS.summer_dhw.sunsetHour,
    })
    const winter = computeDayTimeline(20, {
      sunriseHour: SCENARIO_PRESETS.winter_weekday.sunriseHour,
      sunsetHour: SCENARIO_PRESETS.winter_weekday.sunsetHour,
    })
    expect(summer.isDaytime).toBe(true)
    expect(winter.isDaytime).toBe(false)
  })
})

// ─── computeDailyEfficiencySummary — seasonContext passthrough ─────────────────

describe('computeDailyEfficiencySummary — seasonContext', () => {
  it('carries seasonContext through when provided', () => {
    const result = computeDailyEfficiencySummary(
      baseInputs(),
      'combi',
      baseEmitter(),
      'Winter day',
    )
    expect(result.seasonContext).toBe('Winter day')
  })

  it('seasonContext is absent when not provided', () => {
    const result = computeDailyEfficiencySummary(baseInputs(), 'combi', baseEmitter())
    expect(result.seasonContext).toBeUndefined()
  })

  it('seasonContext does not affect the numeric efficiency result', () => {
    const without = computeDailyEfficiencySummary(baseInputs(), 'combi', baseEmitter())
    const with_   = computeDailyEfficiencySummary(baseInputs(), 'combi', baseEmitter(), 'Winter day')
    expect(with_.dailyEfficiencyPct).toBe(without.dailyEfficiencyPct)
  })

  it('carries seasonContext for heat pump systems too', () => {
    const result = computeDailyEfficiencySummary(
      baseInputs(),
      'heat_pump',
      baseEmitter(),
      'Summer day',
    )
    expect(result.seasonContext).toBe('Summer day')
  })
})

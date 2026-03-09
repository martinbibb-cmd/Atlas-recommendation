// src/explainers/lego/__tests__/surveyAdapter.test.ts
//
// Tests for the survey-backed lab input adapter (sim/surveyAdapter.ts).
//
// Coverage:
//   - adaptSurveyInputs: field mapping, mode classification, fallback behaviour
//   - derivePlaybackMode: mode derivation from LabPlaybackInputs
//   - measured operating point promotion (only confirmed flow readings)
//   - dynamic pressure alias resolution (dynamicMainsPressureBar vs legacy)
//   - no mutation / stable derivation
//   - edge cases: empty input, partial input, all fields populated

import { describe, it, expect } from 'vitest'
import { adaptSurveyInputs, derivePlaybackMode } from '../sim/surveyAdapter'
import type { SurveyAdapterInput } from '../sim/surveyAdapter'

// ─── adaptSurveyInputs ────────────────────────────────────────────────────────

describe('adaptSurveyInputs', () => {
  // ── Fallback to demo when no inputs ──────────────────────────────────────

  it('returns demo mode and empty inputs when called with no fields', () => {
    const { inputs, mode } = adaptSurveyInputs({})
    expect(mode).toBe('demo')
    expect(inputs).toEqual({})
  })

  it('returns demo mode when only occupancySignature is provided (context-only)', () => {
    const { inputs, mode } = adaptSurveyInputs({ occupancySignature: 'single_adult' })
    expect(mode).toBe('demo')
    // occupancySignature is still mapped through
    expect(inputs.occupancySignature).toBe('single_adult')
    // but no physics fields present → demo
  })

  it('returns demo mode when all values are zero or undefined', () => {
    const survey: SurveyAdapterInput = {
      heatLossWatts: 0,
      buildingMass: undefined,
      dynamicMainsPressure: 0,
    }
    const { mode } = adaptSurveyInputs(survey)
    expect(mode).toBe('demo')
  })

  // ── survey_backed mode ────────────────────────────────────────────────────

  it('returns survey_backed when heatLossWatts is present', () => {
    const { mode } = adaptSurveyInputs({ heatLossWatts: 6000 })
    expect(mode).toBe('survey_backed')
  })

  it('returns survey_backed when buildingMass is present', () => {
    const { mode } = adaptSurveyInputs({ buildingMass: 'heavy' })
    expect(mode).toBe('survey_backed')
  })

  it('returns survey_backed when dynamicMainsPressureBar is present', () => {
    const { mode } = adaptSurveyInputs({ dynamicMainsPressureBar: 2.5 })
    expect(mode).toBe('survey_backed')
  })

  it('returns survey_backed when dynamicFlowLpm (confirmed) is present', () => {
    const { mode, inputs } = adaptSurveyInputs({
      mainsDynamicFlowLpm: 14,
      mainsDynamicFlowLpmKnown: true,
    })
    expect(mode).toBe('survey_backed')
    expect(inputs.dynamicFlowLpm).toBe(14)
  })

  it('returns survey_backed when currentHeatSourceType is present', () => {
    const { mode } = adaptSurveyInputs({ currentHeatSourceType: 'combi' })
    expect(mode).toBe('survey_backed')
  })

  it('returns survey_backed when dhwTankType is present', () => {
    const { mode } = adaptSurveyInputs({ dhwTankType: 'mixergy' })
    expect(mode).toBe('survey_backed')
  })

  it('returns survey_backed when tauHours is present', () => {
    const { mode } = adaptSurveyInputs({ tauHours: 8 })
    expect(mode).toBe('survey_backed')
  })

  // ── Measured operating point ──────────────────────────────────────────────

  it('promotes confirmed flow reading to dynamicFlowLpm', () => {
    const { inputs } = adaptSurveyInputs({
      mainsDynamicFlowLpm: 18,
      mainsDynamicFlowLpmKnown: true,
    })
    expect(inputs.dynamicFlowLpm).toBe(18)
  })

  it('discards unconfirmed flow reading (mainsDynamicFlowLpmKnown absent)', () => {
    const { inputs, mode } = adaptSurveyInputs({
      mainsDynamicFlowLpm: 18,
      // mainsDynamicFlowLpmKnown not set → estimate, not a confirmed measurement
    })
    expect(inputs.dynamicFlowLpm).toBeUndefined()
    // No physics field → demo (flow wasn't confirmed)
    expect(mode).toBe('demo')
  })

  it('discards unconfirmed flow reading (mainsDynamicFlowLpmKnown false)', () => {
    const { inputs } = adaptSurveyInputs({
      mainsDynamicFlowLpm: 18,
      mainsDynamicFlowLpmKnown: false,
    })
    expect(inputs.dynamicFlowLpm).toBeUndefined()
  })

  it('discards zero flow (no division-by-zero risk)', () => {
    const { inputs } = adaptSurveyInputs({
      mainsDynamicFlowLpm: 0,
      mainsDynamicFlowLpmKnown: true,
    })
    expect(inputs.dynamicFlowLpm).toBeUndefined()
  })

  // ── Dynamic pressure alias resolution ────────────────────────────────────

  it('prefers dynamicMainsPressureBar over legacy dynamicMainsPressure', () => {
    const { inputs } = adaptSurveyInputs({
      dynamicMainsPressureBar: 2.5,
      dynamicMainsPressure: 1.0,
    })
    expect(inputs.dynamicMainsPressureBar).toBe(2.5)
  })

  it('falls back to legacy dynamicMainsPressure when bar alias is absent', () => {
    const { inputs } = adaptSurveyInputs({ dynamicMainsPressure: 1.5 })
    expect(inputs.dynamicMainsPressureBar).toBe(1.5)
  })

  it('discards zero dynamic pressure', () => {
    const { inputs } = adaptSurveyInputs({ dynamicMainsPressure: 0 })
    expect(inputs.dynamicMainsPressureBar).toBeUndefined()
  })

  // ── Static pressure ───────────────────────────────────────────────────────

  it('maps staticMainsPressureBar when positive', () => {
    const { inputs } = adaptSurveyInputs({ staticMainsPressureBar: 3.0 })
    expect(inputs.staticMainsPressureBar).toBe(3.0)
  })

  it('discards zero static pressure', () => {
    const { inputs } = adaptSurveyInputs({ staticMainsPressureBar: 0 })
    expect(inputs.staticMainsPressureBar).toBeUndefined()
  })

  // ── Heat loss / building mass / tau ───────────────────────────────────────

  it('maps heatLossWatts when positive', () => {
    const { inputs } = adaptSurveyInputs({ heatLossWatts: 7500 })
    expect(inputs.heatLossWatts).toBe(7500)
  })

  it('discards zero heatLossWatts', () => {
    const { inputs } = adaptSurveyInputs({ heatLossWatts: 0 })
    expect(inputs.heatLossWatts).toBeUndefined()
  })

  it('maps buildingMass', () => {
    for (const mass of ['light', 'medium', 'heavy'] as const) {
      const { inputs } = adaptSurveyInputs({ buildingMass: mass })
      expect(inputs.buildingMass).toBe(mass)
    }
  })

  it('maps tauHours when positive', () => {
    const { inputs } = adaptSurveyInputs({ tauHours: 6 })
    expect(inputs.tauHours).toBe(6)
  })

  it('discards zero tauHours', () => {
    const { inputs } = adaptSurveyInputs({ tauHours: 0 })
    expect(inputs.tauHours).toBeUndefined()
  })

  // ── System context ────────────────────────────────────────────────────────

  it('maps currentHeatSourceType', () => {
    const { inputs } = adaptSurveyInputs({ currentHeatSourceType: 'system' })
    expect(inputs.currentHeatSourceType).toBe('system')
  })

  it('maps dhwTankType', () => {
    const { inputs } = adaptSurveyInputs({ dhwTankType: 'mixergy' })
    expect(inputs.dhwTankType).toBe('mixergy')
  })

  // ── Stable derivation / no mutation ──────────────────────────────────────

  it('does not mutate the source input object', () => {
    const survey: SurveyAdapterInput = {
      heatLossWatts: 5000,
      buildingMass: 'medium',
      mainsDynamicFlowLpm: 16,
      mainsDynamicFlowLpmKnown: true,
    }
    const original = { ...survey }
    adaptSurveyInputs(survey)
    expect(survey).toEqual(original)
  })

  it('produces identical results when called twice with the same input', () => {
    const survey: SurveyAdapterInput = {
      heatLossWatts: 5000,
      buildingMass: 'medium',
      dynamicMainsPressureBar: 2.0,
      mainsDynamicFlowLpm: 16,
      mainsDynamicFlowLpmKnown: true,
      currentHeatSourceType: 'combi',
    }
    const r1 = adaptSurveyInputs(survey)
    const r2 = adaptSurveyInputs(survey)
    expect(r1).toEqual(r2)
  })

  // ── Full population ───────────────────────────────────────────────────────

  it('maps all fields when fully populated', () => {
    const survey: SurveyAdapterInput = {
      heatLossWatts: 7000,
      buildingMass: 'heavy',
      tauHours: 9,
      dynamicMainsPressureBar: 2.5,
      staticMainsPressureBar: 3.5,
      mainsDynamicFlowLpm: 20,
      mainsDynamicFlowLpmKnown: true,
      currentHeatSourceType: 'system',
      dhwTankType: 'standard',
      occupancySignature: 'family',
    }
    const { inputs, mode } = adaptSurveyInputs(survey)
    expect(mode).toBe('survey_backed')
    expect(inputs.heatLossWatts).toBe(7000)
    expect(inputs.buildingMass).toBe('heavy')
    expect(inputs.tauHours).toBe(9)
    expect(inputs.dynamicMainsPressureBar).toBe(2.5)
    expect(inputs.staticMainsPressureBar).toBe(3.5)
    expect(inputs.dynamicFlowLpm).toBe(20)
    expect(inputs.currentHeatSourceType).toBe('system')
    expect(inputs.dhwTankType).toBe('standard')
    expect(inputs.occupancySignature).toBe('family')
  })
})

// ─── derivePlaybackMode ───────────────────────────────────────────────────────

describe('derivePlaybackMode', () => {
  it('returns demo when inputs is undefined', () => {
    expect(derivePlaybackMode(undefined)).toBe('demo')
  })

  it('returns demo when inputs has no physics fields', () => {
    expect(derivePlaybackMode({ occupancySignature: 'single_adult' })).toBe('demo')
  })

  it('returns demo for empty inputs object', () => {
    expect(derivePlaybackMode({})).toBe('demo')
  })

  it('returns survey_backed when heatLossWatts is set', () => {
    expect(derivePlaybackMode({ heatLossWatts: 5000 })).toBe('survey_backed')
  })

  it('returns survey_backed when dynamicFlowLpm is set', () => {
    expect(derivePlaybackMode({ dynamicFlowLpm: 14 })).toBe('survey_backed')
  })

  it('returns survey_backed when buildingMass is set', () => {
    expect(derivePlaybackMode({ buildingMass: 'light' })).toBe('survey_backed')
  })

  it('returns survey_backed when tauHours is set', () => {
    expect(derivePlaybackMode({ tauHours: 7 })).toBe('survey_backed')
  })

  it('returns survey_backed when dynamicMainsPressureBar is set', () => {
    expect(derivePlaybackMode({ dynamicMainsPressureBar: 1.8 })).toBe('survey_backed')
  })

  it('returns survey_backed when currentHeatSourceType is set', () => {
    expect(derivePlaybackMode({ currentHeatSourceType: 'ashp' })).toBe('survey_backed')
  })

  it('returns survey_backed when dhwTankType is set', () => {
    expect(derivePlaybackMode({ dhwTankType: 'mixergy' })).toBe('survey_backed')
  })
})

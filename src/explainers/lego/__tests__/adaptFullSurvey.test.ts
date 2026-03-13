// src/explainers/lego/__tests__/adaptFullSurvey.test.ts
//
// Tests for adaptFullSurveyToSimulatorInputs in sim/surveyAdapter.ts.
//
// Coverage:
//   - returns empty object when input is empty
//   - maps combi/system/regular heat source to heatSourceKind 'boiler'
//   - maps ashp heat source to heatSourceKind 'heat_pump'
//   - sets hasCylinder true when dhwTankType is present
//   - sets hasCylinder false when preferCombi is true and no dhwTankType
//   - does not set hasCylinder when neither dhwTankType nor preferCombi
//   - does not mutate the input object
//   - never throws

import { describe, it, expect } from 'vitest'
import { adaptFullSurveyToSimulatorInputs } from '../sim/surveyAdapter'

describe('adaptFullSurveyToSimulatorInputs', () => {
  it('returns empty object when input has no relevant fields', () => {
    const result = adaptFullSurveyToSimulatorInputs({})
    expect(result).toEqual({})
  })

  it('maps combi heat source to heatSourceKind boiler', () => {
    const { heatSourceKind } = adaptFullSurveyToSimulatorInputs({
      currentHeatSourceType: 'combi',
    })
    expect(heatSourceKind).toBe('boiler')
  })

  it('maps system heat source to heatSourceKind boiler', () => {
    const { heatSourceKind } = adaptFullSurveyToSimulatorInputs({
      currentHeatSourceType: 'system',
    })
    expect(heatSourceKind).toBe('boiler')
  })

  it('maps regular heat source to heatSourceKind boiler', () => {
    const { heatSourceKind } = adaptFullSurveyToSimulatorInputs({
      currentHeatSourceType: 'regular',
    })
    expect(heatSourceKind).toBe('boiler')
  })

  it('maps ashp heat source to heatSourceKind heat_pump', () => {
    const { heatSourceKind } = adaptFullSurveyToSimulatorInputs({
      currentHeatSourceType: 'ashp',
    })
    expect(heatSourceKind).toBe('heat_pump')
  })

  it('does not set heatSourceKind when currentHeatSourceType is absent', () => {
    const result = adaptFullSurveyToSimulatorInputs({})
    expect(result.heatSourceKind).toBeUndefined()
  })

  it('sets hasCylinder true when dhwTankType is present', () => {
    const { hasCylinder } = adaptFullSurveyToSimulatorInputs({
      dhwTankType: 'standard',
    })
    expect(hasCylinder).toBe(true)
  })

  it('sets hasCylinder true for mixergy dhwTankType', () => {
    const { hasCylinder } = adaptFullSurveyToSimulatorInputs({
      dhwTankType: 'mixergy',
    })
    expect(hasCylinder).toBe(true)
  })

  it('sets hasCylinder false when preferCombi is true and no dhwTankType', () => {
    const { hasCylinder } = adaptFullSurveyToSimulatorInputs({
      preferCombi: true,
    })
    expect(hasCylinder).toBe(false)
  })

  it('does not set hasCylinder when neither dhwTankType nor preferCombi is provided', () => {
    const result = adaptFullSurveyToSimulatorInputs({ currentHeatSourceType: 'regular' })
    expect(result.hasCylinder).toBeUndefined()
  })

  it('does not mutate the input object', () => {
    const input = { currentHeatSourceType: 'combi' as const }
    const frozen = Object.freeze({ ...input })
    expect(() => adaptFullSurveyToSimulatorInputs(frozen)).not.toThrow()
  })

  it('never throws on arbitrary partial input', () => {
    expect(() => adaptFullSurveyToSimulatorInputs({})).not.toThrow()
    expect(() =>
      adaptFullSurveyToSimulatorInputs({ postcode: 'SW1A 1AA' }),
    ).not.toThrow()
    expect(() =>
      adaptFullSurveyToSimulatorInputs({
        currentHeatSourceType: 'other',
        preferCombi: false,
      }),
    ).not.toThrow()
  })
})

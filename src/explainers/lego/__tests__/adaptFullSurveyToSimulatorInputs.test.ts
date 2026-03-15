// src/explainers/lego/__tests__/adaptFullSurveyToSimulatorInputs.test.ts
//
// Tests for adaptFullSurveyToSimulatorInputs — the full-survey → simulator
// input adapter that produces an initial SimulatorSystemChoice and a partial
// SystemInputs when the simulator is opened from a completed full survey.
//
// Coverage:
//   - systemChoice derivation from currentHeatSourceType
//   - mainsPressureBar mapping (bar alias + legacy field)
//   - mainsFlowLpm — confirmed readings only
//   - primaryPipeSize mapping from primaryPipeDiameter
//   - combiPowerKw mapping and clamp
//   - systemCondition derivation from heatingCondition / dhwCondition
//   - cylinderType derivation from dhwCondition fields
//   - fallback to safe defaults when no survey data is present
//   - no mutation of the source object

import { describe, it, expect } from 'vitest'
import { adaptFullSurveyToSimulatorInputs } from '../simulator/adaptFullSurveyToSimulatorInputs'
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1'

// ─── Minimal valid input factory ──────────────────────────────────────────────

function minimalSurvey(overrides: Partial<FullSurveyModelV1> = {}): FullSurveyModelV1 {
  return {
    postcode: 'SW1A 1AA',
    dynamicMainsPressure: 2.0,
    primaryPipeDiameter: 22,
    heatLossWatts: 7000,
    radiatorCount: 10,
    bathroomCount: 1,
    occupancyCount: 2,
    hasLoftConversion: false,
    returnWaterTemp: 45,
    occupancySignature: 'professional',
    buildingMass: 'medium',
    highOccupancy: false,
    preferCombi: false,
    ...overrides,
  }
}

// ─── systemChoice derivation ──────────────────────────────────────────────────

describe('adaptFullSurveyToSimulatorInputs — systemChoice', () => {
  it('defaults to combi when currentHeatSourceType is absent', () => {
    const { systemChoice } = adaptFullSurveyToSimulatorInputs(minimalSurvey())
    expect(systemChoice).toBe('combi')
  })

  it('maps combi heat source to combi choice', () => {
    const { systemChoice } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentHeatSourceType: 'combi' }),
    )
    expect(systemChoice).toBe('combi')
  })

  it('maps regular heat source to open_vented choice', () => {
    const { systemChoice } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentHeatSourceType: 'regular' }),
    )
    expect(systemChoice).toBe('open_vented')
  })

  it('maps ashp heat source to heat_pump choice', () => {
    const { systemChoice } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentHeatSourceType: 'ashp' }),
    )
    expect(systemChoice).toBe('heat_pump')
  })

  it('maps system heat source to unvented choice by default', () => {
    const { systemChoice } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentHeatSourceType: 'system' }),
    )
    expect(systemChoice).toBe('unvented')
  })

  it('maps system heat source to open_vented when cylinder is copper_vented', () => {
    const { systemChoice } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        currentHeatSourceType: 'system',
        fullSurvey: {
          dhwCondition: { cylinderMaterial: 'copper_vented' },
        },
      }),
    )
    expect(systemChoice).toBe('open_vented')
  })

  it('maps other heat source to combi (safe default)', () => {
    const { systemChoice } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentHeatSourceType: 'other' }),
    )
    expect(systemChoice).toBe('combi')
  })
})

// ─── mainsPressureBar ─────────────────────────────────────────────────────────

describe('adaptFullSurveyToSimulatorInputs — mainsPressureBar', () => {
  it('maps dynamicMainsPressureBar when present and positive', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ dynamicMainsPressureBar: 2.5, dynamicMainsPressure: 1.0 }),
    )
    expect(systemInputs.mainsPressureBar).toBe(2.5)
  })

  it('falls back to legacy dynamicMainsPressure when bar alias absent', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ dynamicMainsPressure: 1.8 }),
    )
    expect(systemInputs.mainsPressureBar).toBe(1.8)
  })

  it('does not populate mainsPressureBar when pressure is zero', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ dynamicMainsPressure: 0, dynamicMainsPressureBar: 0 }),
    )
    expect(systemInputs.mainsPressureBar).toBeUndefined()
  })

  it('clamps high pressure to 6.0 bar', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ dynamicMainsPressureBar: 8.0 }),
    )
    expect(systemInputs.mainsPressureBar).toBe(6.0)
  })

  it('clamps low pressure to 1.5 bar', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ dynamicMainsPressureBar: 0.5 }),
    )
    expect(systemInputs.mainsPressureBar).toBe(1.5)
  })
})

// ─── mainsFlowLpm ─────────────────────────────────────────────────────────────

describe('adaptFullSurveyToSimulatorInputs — mainsFlowLpm', () => {
  it('maps confirmed flow reading', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ mainsDynamicFlowLpm: 18, mainsDynamicFlowLpmKnown: true }),
    )
    expect(systemInputs.mainsFlowLpm).toBe(18)
  })

  it('discards unconfirmed flow reading (mainsDynamicFlowLpmKnown absent)', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ mainsDynamicFlowLpm: 18 }),
    )
    expect(systemInputs.mainsFlowLpm).toBeUndefined()
  })

  it('discards unconfirmed flow reading (mainsDynamicFlowLpmKnown false)', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ mainsDynamicFlowLpm: 18, mainsDynamicFlowLpmKnown: false }),
    )
    expect(systemInputs.mainsFlowLpm).toBeUndefined()
  })

  it('discards zero flow', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ mainsDynamicFlowLpm: 0, mainsDynamicFlowLpmKnown: true }),
    )
    expect(systemInputs.mainsFlowLpm).toBeUndefined()
  })

  it('clamps high flow to 50 L/min', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ mainsDynamicFlowLpm: 60, mainsDynamicFlowLpmKnown: true }),
    )
    expect(systemInputs.mainsFlowLpm).toBe(50)
  })
})

// ─── primaryPipeSize ──────────────────────────────────────────────────────────

describe('adaptFullSurveyToSimulatorInputs — primaryPipeSize', () => {
  it('maps 15mm pipe diameter', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ primaryPipeDiameter: 15 }),
    )
    expect(systemInputs.primaryPipeSize).toBe('15mm')
  })

  it('maps 22mm pipe diameter', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ primaryPipeDiameter: 22 }),
    )
    expect(systemInputs.primaryPipeSize).toBe('22mm')
  })

  it('maps 28mm pipe diameter', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ primaryPipeDiameter: 28 }),
    )
    expect(systemInputs.primaryPipeSize).toBe('28mm')
  })

  it('maps diameter > 28 to 28mm', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ primaryPipeDiameter: 35 }),
    )
    expect(systemInputs.primaryPipeSize).toBe('28mm')
  })

  it('maps diameter 14 (near 15mm threshold) to 15mm', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ primaryPipeDiameter: 14 }),
    )
    expect(systemInputs.primaryPipeSize).toBe('15mm')
  })

  it('does not populate primaryPipeSize when diameter is below minimum', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ primaryPipeDiameter: 10 }),
    )
    expect(systemInputs.primaryPipeSize).toBeUndefined()
  })
})

// ─── combiPowerKw ─────────────────────────────────────────────────────────────

describe('adaptFullSurveyToSimulatorInputs — combiPowerKw', () => {
  it('maps currentBoilerOutputKw when present', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentBoilerOutputKw: 30 }),
    )
    expect(systemInputs.combiPowerKw).toBe(30)
  })

  it('clamps to minimum 18 kW', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentBoilerOutputKw: 10 }),
    )
    expect(systemInputs.combiPowerKw).toBe(18)
  })

  it('clamps to maximum 42 kW', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentBoilerOutputKw: 60 }),
    )
    expect(systemInputs.combiPowerKw).toBe(42)
  })

  it('does not populate combiPowerKw when absent', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(minimalSurvey())
    expect(systemInputs.combiPowerKw).toBeUndefined()
  })

  it('does not populate combiPowerKw when zero', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentBoilerOutputKw: 0 }),
    )
    expect(systemInputs.combiPowerKw).toBeUndefined()
  })
})

// ─── systemCondition ─────────────────────────────────────────────────────────

describe('adaptFullSurveyToSimulatorInputs — systemCondition', () => {
  it('returns clean (absent) when no condition signals are present', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(minimalSurvey())
    expect(systemInputs.systemCondition).toBeUndefined()
  })

  it('returns sludged when bleedWaterColour is brown', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        fullSurvey: {
          heatingCondition: { bleedWaterColour: 'brown' },
        },
      }),
    )
    expect(systemInputs.systemCondition).toBe('sludged')
  })

  it('returns sludged when bleedWaterColour is black', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        fullSurvey: {
          heatingCondition: { bleedWaterColour: 'black' },
        },
      }),
    )
    expect(systemInputs.systemCondition).toBe('sludged')
  })

  it('returns sludged when magneticDebrisEvidence is true', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        fullSurvey: {
          heatingCondition: { magneticDebrisEvidence: true },
        },
      }),
    )
    expect(systemInputs.systemCondition).toBe('sludged')
  })

  it('returns sludged when radiatorsColdAtBottom is true', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        fullSurvey: {
          heatingCondition: { radiatorsColdAtBottom: true },
        },
      }),
    )
    expect(systemInputs.systemCondition).toBe('sludged')
  })

  it('returns scaled when kettlingOrScaleSymptoms is true', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        fullSurvey: {
          dhwCondition: { kettlingOrScaleSymptoms: true },
        },
      }),
    )
    expect(systemInputs.systemCondition).toBe('scaled')
  })

  it('sludge takes priority over scale when both signals present', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        fullSurvey: {
          heatingCondition: { magneticDebrisEvidence: true },
          dhwCondition: { kettlingOrScaleSymptoms: true },
        },
      }),
    )
    expect(systemInputs.systemCondition).toBe('sludged')
  })
})

// ─── cylinderType ─────────────────────────────────────────────────────────────

describe('adaptFullSurveyToSimulatorInputs — cylinderType', () => {
  it('maps mixergy cylinder type from dhwCondition.cylinderType', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        fullSurvey: {
          dhwCondition: { cylinderType: 'mixergy' },
        },
      }),
    )
    expect(systemInputs.cylinderType).toBe('mixergy')
  })

  it('maps unvented from cylinderMaterial stainless_unvented', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        fullSurvey: {
          dhwCondition: { cylinderMaterial: 'stainless_unvented' },
        },
      }),
    )
    expect(systemInputs.cylinderType).toBe('unvented')
  })

  it('maps open_vented from cylinderMaterial copper_vented', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        fullSurvey: {
          dhwCondition: { cylinderMaterial: 'copper_vented' },
        },
      }),
    )
    expect(systemInputs.cylinderType).toBe('open_vented')
  })

  it('infers open_vented from regular heat source when cylinder material absent', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentHeatSourceType: 'regular' }),
    )
    expect(systemInputs.cylinderType).toBe('open_vented')
  })

  it('infers unvented from system heat source when cylinder material absent', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentHeatSourceType: 'system' }),
    )
    expect(systemInputs.cylinderType).toBe('unvented')
  })

  it('leaves cylinderType absent for combi (no cylinder)', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentHeatSourceType: 'combi' }),
    )
    expect(systemInputs.cylinderType).toBeUndefined()
  })

  it('mixergy takes priority over heat-source-inferred type', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        currentHeatSourceType: 'system',
        fullSurvey: {
          dhwCondition: { cylinderType: 'mixergy' },
        },
      }),
    )
    expect(systemInputs.cylinderType).toBe('mixergy')
  })
})

// ─── No mutation ──────────────────────────────────────────────────────────────

describe('adaptFullSurveyToSimulatorInputs — immutability', () => {
  it('does not mutate the source survey object', () => {
    const survey = minimalSurvey({
      dynamicMainsPressureBar: 2.5,
      mainsDynamicFlowLpm: 18,
      mainsDynamicFlowLpmKnown: true,
      currentBoilerOutputKw: 28,
      currentHeatSourceType: 'system',
    })
    const original = JSON.parse(JSON.stringify(survey))
    adaptFullSurveyToSimulatorInputs(survey)
    expect(survey).toEqual(original)
  })

  it('produces identical results when called twice with the same input', () => {
    const survey = minimalSurvey({
      dynamicMainsPressureBar: 2.5,
      mainsDynamicFlowLpm: 18,
      mainsDynamicFlowLpmKnown: true,
      currentBoilerOutputKw: 28,
      currentHeatSourceType: 'system',
      fullSurvey: {
        heatingCondition: { magneticDebrisEvidence: true },
      },
    })
    const r1 = adaptFullSurveyToSimulatorInputs(survey)
    const r2 = adaptFullSurveyToSimulatorInputs(survey)
    expect(r1).toEqual(r2)
  })
})

// ─── Fully populated survey ───────────────────────────────────────────────────

describe('adaptFullSurveyToSimulatorInputs — full population', () => {
  it('maps all available fields from a complete combi survey', () => {
    const { systemChoice, systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        dynamicMainsPressureBar: 2.5,
        mainsDynamicFlowLpm: 16,
        mainsDynamicFlowLpmKnown: true,
        primaryPipeDiameter: 22,
        currentBoilerOutputKw: 28,
        currentHeatSourceType: 'combi',
        fullSurvey: {
          dhwCondition: { kettlingOrScaleSymptoms: true },
        },
      }),
    )
    expect(systemChoice).toBe('combi')
    expect(systemInputs.mainsPressureBar).toBe(2.5)
    expect(systemInputs.mainsFlowLpm).toBe(16)
    expect(systemInputs.primaryPipeSize).toBe('22mm')
    expect(systemInputs.combiPowerKw).toBe(28)
    expect(systemInputs.systemCondition).toBe('scaled')
    // No cylinder for combi
    expect(systemInputs.cylinderType).toBeUndefined()
  })

  it('maps all available fields from a complete system-boiler survey', () => {
    const { systemChoice, systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        dynamicMainsPressureBar: 3.0,
        mainsDynamicFlowLpm: 22,
        mainsDynamicFlowLpmKnown: true,
        primaryPipeDiameter: 28,
        currentBoilerOutputKw: 35,
        currentHeatSourceType: 'system',
        fullSurvey: {
          heatingCondition: { bleedWaterColour: 'brown' },
          dhwCondition: { cylinderMaterial: 'stainless_unvented' },
        },
      }),
    )
    expect(systemChoice).toBe('unvented')
    expect(systemInputs.mainsPressureBar).toBe(3.0)
    expect(systemInputs.mainsFlowLpm).toBe(22)
    expect(systemInputs.primaryPipeSize).toBe('28mm')
    expect(systemInputs.combiPowerKw).toBe(35)
    expect(systemInputs.systemCondition).toBe('sludged')
    expect(systemInputs.cylinderType).toBe('unvented')
  })
})

// ─── controlStrategy derivation ──────────────────────────────────────────────

describe('adaptFullSurveyToSimulatorInputs — controlStrategy', () => {
  it('maps combi heat source to combi control strategy', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentHeatSourceType: 'combi' }),
    )
    expect(systemInputs.controlStrategy).toBe('combi')
  })

  it('maps system heat source (unvented) to s_plan control strategy', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentHeatSourceType: 'system' }),
    )
    expect(systemInputs.controlStrategy).toBe('s_plan')
  })

  it('maps regular heat source to y_plan control strategy', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentHeatSourceType: 'regular' }),
    )
    expect(systemInputs.controlStrategy).toBe('y_plan')
  })

  it('maps system heat source with open_vented cylinder to y_plan', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        currentHeatSourceType: 'system',
        fullSurvey: { dhwCondition: { cylinderMaterial: 'copper_vented' } },
      }),
    )
    expect(systemInputs.controlStrategy).toBe('y_plan')
  })

  it('maps ashp heat source to heat_pump control strategy', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ currentHeatSourceType: 'ashp' }),
    )
    expect(systemInputs.controlStrategy).toBe('heat_pump')
  })

  it('defaults to combi control strategy when no heat source type is provided', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(minimalSurvey())
    expect(systemInputs.controlStrategy).toBe('combi')
  })

  it('always populates controlStrategy regardless of heat source type', () => {
    const heatSourceTypes = ['combi', 'system', 'regular', 'ashp', 'other'] as const
    heatSourceTypes.forEach(ht => {
      const { systemInputs } = adaptFullSurveyToSimulatorInputs(
        minimalSurvey({ currentHeatSourceType: ht as any }),
      )
      expect(systemInputs.controlStrategy).toBeDefined()
    })
  })
})

// ─── occupancyProfile derivation ─────────────────────────────────────────────

describe('adaptFullSurveyToSimulatorInputs — occupancyProfile', () => {
  it('maps professional occupancySignature to professional occupancy profile', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ occupancySignature: 'professional' }),
    )
    expect(systemInputs.occupancyProfile).toBe('professional')
  })

  it('maps steady_home occupancySignature to steady_home occupancy profile', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ occupancySignature: 'steady_home' }),
    )
    expect(systemInputs.occupancyProfile).toBe('steady_home')
  })

  it('maps shift_worker occupancySignature to shift occupancy profile', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({ occupancySignature: 'shift_worker' }),
    )
    expect(systemInputs.occupancyProfile).toBe('shift')
  })

  it('maps family_young_children demandPreset to family occupancy profile', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        occupancySignature: 'steady_home',
        demandPreset: 'family_young_children',
      }),
    )
    expect(systemInputs.occupancyProfile).toBe('family')
  })

  it('maps family_teenagers demandPreset to family occupancy profile', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        occupancySignature: 'steady_home',
        demandPreset: 'family_teenagers',
      }),
    )
    expect(systemInputs.occupancyProfile).toBe('family')
  })

  it('maps multigenerational demandPreset to family occupancy profile', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        occupancySignature: 'steady_home',
        demandPreset: 'multigenerational',
      }),
    )
    expect(systemInputs.occupancyProfile).toBe('family')
  })

  it('maps bath_heavy demandPreset to family occupancy profile', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        occupancySignature: 'steady_home',
        demandPreset: 'bath_heavy',
      }),
    )
    expect(systemInputs.occupancyProfile).toBe('family')
  })

  it('maps retired_couple demandPreset (steady_home signature) to steady_home profile', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        occupancySignature: 'steady_home',
        demandPreset: 'retired_couple',
      }),
    )
    expect(systemInputs.occupancyProfile).toBe('steady_home')
  })

  it('maps shift_worker demandPreset to shift profile regardless of signature', () => {
    const { systemInputs } = adaptFullSurveyToSimulatorInputs(
      minimalSurvey({
        occupancySignature: 'shift_worker',
        demandPreset: 'shift_worker',
      }),
    )
    expect(systemInputs.occupancyProfile).toBe('shift')
  })
})

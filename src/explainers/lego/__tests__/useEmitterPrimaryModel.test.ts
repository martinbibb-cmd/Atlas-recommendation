/**
 * Tests for useEmitterPrimaryModel — the display adapter that derives
 * EmitterPrimaryDisplayState from emitter and primary circuit inputs.
 *
 * Validates that:
 *   - Default inputs produce a 70°C flow temperature (radiators, 1.0× factor)
 *   - Oversized radiators (1.3 factor) reduce the required flow temperature
 *   - UFH (1.8 factor) reduces flow temperature below 50°C
 *   - emitterCapacityFactor slider scales flow temperature correctly
 *   - Weather compensation reduces flow temperature by 5°C
 *   - Flow temperature is clamped between 35°C and 80°C
 *   - Return temperature = flow temperature − 12°C
 *   - emitterAdequate is true when requiredFlowTempC ≤ 65°C
 *   - emitterAdequate is false when requiredFlowTempC > 65°C
 *   - primaryAdequate reflects pipe capacity vs BASE_HEAT_DEMAND_KW
 *   - estimatedCop is in [2.5, 4.5] range
 *   - estimatedCop is higher at lower flow temperatures
 *   - Acceptance criteria scenarios produce expected approximate values
 */

import { describe, it, expect } from 'vitest'
import {
  useEmitterPrimaryModel,
  PRIMARY_CAPACITY_KW,
  EMITTER_TYPE_FACTOR,
  BASE_HEAT_DEMAND_KW,
} from '../simulator/useEmitterPrimaryModel'
import type { EmitterPrimaryInputs } from '../simulator/useEmitterPrimaryModel'

// ─── Input factories ──────────────────────────────────────────────────────────

function defaultInputs(): EmitterPrimaryInputs {
  return {
    emitterCapacityFactor: 1.0,
    primaryPipeSize: '22mm',
    emitterType: 'radiators',
    weatherCompensation: false,
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

describe('useEmitterPrimaryModel — exported constants', () => {
  it('PRIMARY_CAPACITY_KW has correct values for all pipe sizes', () => {
    expect(PRIMARY_CAPACITY_KW['15mm']).toBe(12)
    expect(PRIMARY_CAPACITY_KW['22mm']).toBe(25)
    expect(PRIMARY_CAPACITY_KW['28mm']).toBe(45)
  })

  it('EMITTER_TYPE_FACTOR has correct multipliers', () => {
    expect(EMITTER_TYPE_FACTOR['radiators']).toBe(1.0)
    expect(EMITTER_TYPE_FACTOR['oversized_radiators']).toBe(1.3)
    expect(EMITTER_TYPE_FACTOR['ufh']).toBe(1.8)
  })

  it('BASE_HEAT_DEMAND_KW is defined and positive', () => {
    expect(BASE_HEAT_DEMAND_KW).toBeGreaterThan(0)
  })
})

// ─── Scenario 1: default radiators ───────────────────────────────────────────

describe('useEmitterPrimaryModel — Scenario 1: default radiators', () => {
  it('produces 70°C required flow temperature at default settings', () => {
    const result = useEmitterPrimaryModel(defaultInputs())
    expect(result.requiredFlowTempC).toBe(70)
  })

  it('produces return temperature of 58°C (flow − 12°C ΔT)', () => {
    const result = useEmitterPrimaryModel(defaultInputs())
    expect(result.estimatedReturnTempC).toBe(58)
  })

  it('emitterAdequate is false at 70°C (above 65°C threshold)', () => {
    const result = useEmitterPrimaryModel(defaultInputs())
    expect(result.emitterAdequate).toBe(false)
  })

  it('primaryAdequate is true for 22mm pipe (25 kW > 14 kW demand)', () => {
    const result = useEmitterPrimaryModel(defaultInputs())
    expect(result.primaryAdequate).toBe(true)
  })
})

// ─── Scenario 2: oversized radiators ─────────────────────────────────────────

describe('useEmitterPrimaryModel — Scenario 2: oversized emitters', () => {
  it('oversized_radiators (1.3 type factor) reduces flow temperature below 65°C', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      emitterType: 'oversized_radiators',
    })
    // 70 / 1.3 ≈ 53.8°C
    expect(result.requiredFlowTempC).toBeLessThan(65)
    expect(result.requiredFlowTempC).toBeCloseTo(53.8, 0)
  })

  it('emitterAdequate is true when oversized_radiators type is selected', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      emitterType: 'oversized_radiators',
    })
    expect(result.emitterAdequate).toBe(true)
  })

  it('emitterCapacityFactor 1.3 with radiators reduces flow temperature below 65°C', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      emitterCapacityFactor: 1.3,
    })
    // 70 / 1.3 ≈ 53.8°C
    expect(result.requiredFlowTempC).toBeLessThan(65)
    expect(result.emitterAdequate).toBe(true)
  })

  it('return temperature is in condensing range when oversized', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      emitterType: 'oversized_radiators',
    })
    // return = flow − 12 ≈ 53.8 − 12 = 41.8°C → below 55°C condensing threshold
    expect(result.estimatedReturnTempC).toBeLessThan(55)
  })
})

// ─── Scenario 3: heat pump + UFH ─────────────────────────────────────────────

describe('useEmitterPrimaryModel — Scenario 3: heat pump + UFH', () => {
  it('UFH (1.8 type factor) reduces flow temperature below 50°C', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      emitterType: 'ufh',
    })
    // 70 / 1.8 ≈ 38.9°C
    expect(result.requiredFlowTempC).toBeLessThan(50)
    expect(result.requiredFlowTempC).toBeCloseTo(38.9, 0)
  })

  it('estimatedCop is in [2.5, 4.5] range for UFH', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      emitterType: 'ufh',
    })
    expect(result.estimatedCop).toBeGreaterThanOrEqual(2.5)
    expect(result.estimatedCop).toBeLessThanOrEqual(4.5)
  })

  it('estimatedCop is higher for UFH than for standard radiators', () => {
    const ufhResult = useEmitterPrimaryModel({ ...defaultInputs(), emitterType: 'ufh' })
    const radResult = useEmitterPrimaryModel(defaultInputs())
    expect(ufhResult.estimatedCop).toBeGreaterThan(radResult.estimatedCop)
  })
})

// ─── Weather compensation ─────────────────────────────────────────────────────

describe('useEmitterPrimaryModel — weather compensation', () => {
  it('weather compensation reduces flow temperature by 5°C', () => {
    const without = useEmitterPrimaryModel({ ...defaultInputs(), weatherCompensation: false })
    const with_ = useEmitterPrimaryModel({ ...defaultInputs(), weatherCompensation: true })
    expect(with_.requiredFlowTempC).toBe(without.requiredFlowTempC - 5)
  })

  it('weather compensation reduces return temperature by 5°C', () => {
    const without = useEmitterPrimaryModel({ ...defaultInputs(), weatherCompensation: false })
    const with_ = useEmitterPrimaryModel({ ...defaultInputs(), weatherCompensation: true })
    expect(with_.estimatedReturnTempC).toBe(without.estimatedReturnTempC - 5)
  })
})

// ─── Flow temperature clamping ────────────────────────────────────────────────

describe('useEmitterPrimaryModel — flow temperature clamping', () => {
  it('flow temperature is clamped to minimum 35°C', () => {
    // Very high emitter capacity factor: 70 / (2.0 × 1.8) ≈ 19.4°C → clamped to 35°C
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      emitterCapacityFactor: 2.0,
      emitterType: 'ufh',
    })
    expect(result.requiredFlowTempC).toBeGreaterThanOrEqual(35)
  })

  it('flow temperature is clamped to maximum 80°C', () => {
    // Very low emitter capacity factor: 70 / (0.5 × 1.0) = 140°C → clamped to 80°C
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      emitterCapacityFactor: 0.5,
    })
    expect(result.requiredFlowTempC).toBeLessThanOrEqual(80)
  })
})

// ─── Return temperature ───────────────────────────────────────────────────────

describe('useEmitterPrimaryModel — return temperature', () => {
  it('return temperature is always flow temperature − 12°C', () => {
    const inputs: EmitterPrimaryInputs[] = [
      defaultInputs(),
      { ...defaultInputs(), emitterType: 'ufh' },
      { ...defaultInputs(), emitterCapacityFactor: 1.5 },
      { ...defaultInputs(), weatherCompensation: true },
    ]
    inputs.forEach(input => {
      const result = useEmitterPrimaryModel(input)
      expect(result.estimatedReturnTempC).toBe(result.requiredFlowTempC - 12)
    })
  })
})

// ─── Primary circuit adequacy ─────────────────────────────────────────────────

describe('useEmitterPrimaryModel — primary circuit adequacy', () => {
  it('15mm pipe is inadequate (12 kW < 14 kW demand)', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      primaryPipeSize: '15mm',
    })
    expect(result.primaryAdequate).toBe(false)
    expect(result.primaryCapacityKw).toBe(12)
    expect(result.heatDemandKw).toBe(BASE_HEAT_DEMAND_KW)
  })

  it('22mm pipe is adequate (25 kW ≥ 14 kW demand)', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      primaryPipeSize: '22mm',
    })
    expect(result.primaryAdequate).toBe(true)
    expect(result.primaryCapacityKw).toBe(25)
  })

  it('28mm pipe is adequate (45 kW ≥ 14 kW demand)', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      primaryPipeSize: '28mm',
    })
    expect(result.primaryAdequate).toBe(true)
    expect(result.primaryCapacityKw).toBe(45)
  })
})

// ─── COP ──────────────────────────────────────────────────────────────────────

describe('useEmitterPrimaryModel — estimatedCop', () => {
  it('estimatedCop is always in [2.5, 4.5] regardless of inputs', () => {
    const testCases: EmitterPrimaryInputs[] = [
      defaultInputs(),
      { ...defaultInputs(), emitterType: 'ufh' },
      { ...defaultInputs(), emitterCapacityFactor: 0.5 },
      { ...defaultInputs(), emitterCapacityFactor: 2.0, emitterType: 'ufh' },
    ]
    testCases.forEach(inputs => {
      const result = useEmitterPrimaryModel(inputs)
      expect(result.estimatedCop).toBeGreaterThanOrEqual(2.5)
      expect(result.estimatedCop).toBeLessThanOrEqual(4.5)
    })
  })

  it('lower flow temperature produces higher COP', () => {
    const lowFlow = useEmitterPrimaryModel({ ...defaultInputs(), emitterType: 'ufh' })
    const highFlow = useEmitterPrimaryModel(defaultInputs())
    expect(lowFlow.estimatedCop).toBeGreaterThan(highFlow.estimatedCop)
  })
})

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
 *   - Load compensation reduces currentLoadFlowTempC by LOAD_COMP_REDUCTION_C
 *   - Without load compensation, currentLoadFlowTempC equals requiredFlowTempC
 *   - currentLoadReturnTempC = currentLoadFlowTempC − 12°C
 *   - Flow temperature is clamped between 35°C and 80°C
 *   - Return temperature = flow temperature − 12°C (when no boilerOutputKw)
 *   - emitterAdequate is true when requiredFlowTempC ≤ 65°C
 *   - emitterAdequate is false when requiredFlowTempC > 65°C
 *   - primaryAdequate reflects pipe capacity vs BASE_HEAT_DEMAND_KW
 *   - estimatedCop is in [2.5, 4.5] range
 *   - estimatedCop is higher at lower flow temperatures
 *   - Acceptance criteria scenarios produce expected approximate values
 *   - boilerOutputKw raises return temperature when boiler is oversized
 *   - boilerOutputKw marks primary circuit inadequate when output > pipe capacity
 *   - heatLossKw changes the effective pipe-check demand
 */

import { describe, it, expect } from 'vitest'
import {
  useEmitterPrimaryModel,
  PRIMARY_CAPACITY_KW,
  EMITTER_TYPE_FACTOR,
  BASE_HEAT_DEMAND_KW,
  LOAD_COMP_REDUCTION_C,
} from '../simulator/useEmitterPrimaryModel'
import type { EmitterPrimaryInputs } from '../simulator/useEmitterPrimaryModel'

// ─── Input factories ──────────────────────────────────────────────────────────

function defaultInputs(): EmitterPrimaryInputs {
  return {
    emitterCapacityFactor: 1.0,
    primaryPipeSize: '22mm',
    emitterType: 'radiators',
    weatherCompensation: false,
    loadCompensation: false,
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

// ─── Load compensation ────────────────────────────────────────────────────────

describe('useEmitterPrimaryModel — load compensation', () => {
  it('without load compensation, currentLoadFlowTempC equals requiredFlowTempC', () => {
    const result = useEmitterPrimaryModel({ ...defaultInputs(), loadCompensation: false })
    expect(result.currentLoadFlowTempC).toBe(result.requiredFlowTempC)
  })

  it('with load compensation, currentLoadFlowTempC is lower than requiredFlowTempC', () => {
    const result = useEmitterPrimaryModel({ ...defaultInputs(), loadCompensation: true })
    expect(result.currentLoadFlowTempC).toBeLessThan(result.requiredFlowTempC)
  })

  it('load compensation reduces currentLoadFlowTempC by LOAD_COMP_REDUCTION_C', () => {
    const without = useEmitterPrimaryModel({ ...defaultInputs(), loadCompensation: false })
    const with_ = useEmitterPrimaryModel({ ...defaultInputs(), loadCompensation: true })
    expect(with_.currentLoadFlowTempC).toBe(without.currentLoadFlowTempC - LOAD_COMP_REDUCTION_C)
  })

  it('currentLoadReturnTempC = currentLoadFlowTempC − 12°C', () => {
    const result = useEmitterPrimaryModel({ ...defaultInputs(), loadCompensation: true })
    expect(result.currentLoadReturnTempC).toBe(result.currentLoadFlowTempC - 12)
  })

  it('currentLoadFlowTempC is clamped to minimum 35°C', () => {
    // Very high emitter capacity + load comp: ensure it doesn't go below 35°C
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      emitterType: 'ufh',
      emitterCapacityFactor: 2.0,
      loadCompensation: true,
    })
    expect(result.currentLoadFlowTempC).toBeGreaterThanOrEqual(35)
  })

  it('without load compensation, currentLoadReturnTempC equals estimatedReturnTempC', () => {
    const result = useEmitterPrimaryModel({ ...defaultInputs(), loadCompensation: false })
    expect(result.currentLoadReturnTempC).toBe(result.estimatedReturnTempC)
  })

  it('load compensation improves condensing potential at typical operating load', () => {
    // Standard radiators at 70°C flow: return = 58°C (above 55°C threshold)
    // With load compensation: currentLoadFlowTempC = 70 − 12 = 58°C, return = 46°C (below 50°C threshold)
    const result = useEmitterPrimaryModel({ ...defaultInputs(), loadCompensation: true })
    expect(result.estimatedReturnTempC).toBeGreaterThan(55) // design load: not condensing
    expect(result.currentLoadReturnTempC).toBeLessThan(50)  // current load: condensing
  })
})

// ─── Design load vs current load separation ───────────────────────────────────

describe('useEmitterPrimaryModel — design load vs current load', () => {
  it('requiredFlowTempC represents design load (unchanged by load compensation)', () => {
    const without = useEmitterPrimaryModel({ ...defaultInputs(), loadCompensation: false })
    const with_ = useEmitterPrimaryModel({ ...defaultInputs(), loadCompensation: true })
    expect(with_.requiredFlowTempC).toBe(without.requiredFlowTempC)
  })

  it('estimatedReturnTempC represents design load return (unchanged by load compensation)', () => {
    const without = useEmitterPrimaryModel({ ...defaultInputs(), loadCompensation: false })
    const with_ = useEmitterPrimaryModel({ ...defaultInputs(), loadCompensation: true })
    expect(with_.estimatedReturnTempC).toBe(without.estimatedReturnTempC)
  })

  it('currentLoadFlowTempC is distinct from requiredFlowTempC when load compensation is active', () => {
    const result = useEmitterPrimaryModel({ ...defaultInputs(), loadCompensation: true })
    expect(result.currentLoadFlowTempC).not.toBe(result.requiredFlowTempC)
  })
})

// ─── boilerOutputKw — return temperature effect ───────────────────────────────

describe('useEmitterPrimaryModel — boilerOutputKw scales return temperature', () => {
  it('omitting boilerOutputKw preserves the default 12°C ΔT', () => {
    const result = useEmitterPrimaryModel(defaultInputs())
    // Default: flowTemp = 70°C, return = 70 − 12 = 58°C
    expect(result.estimatedReturnTempC).toBe(result.requiredFlowTempC - 12)
  })

  it('boilerOutputKw matching heatLossKw produces the design 12°C ΔT', () => {
    // heat loss = boiler output → oversizing factor = 1.0 → ΔT = 12°C
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      heatLossKw: 14,
      boilerOutputKw: 14,
    })
    expect(result.estimatedReturnTempC).toBeCloseTo(result.requiredFlowTempC - 12, 1)
  })

  it('oversized boiler (output > heat loss) produces a higher return temperature', () => {
    // heatLoss = 14 kW, boilerOutput = 28 kW → ratio = 0.5 → ΔT ≈ 6°C → higher return
    const matched = useEmitterPrimaryModel({
      ...defaultInputs(),
      heatLossKw: 14,
      boilerOutputKw: 14,
    })
    const oversized = useEmitterPrimaryModel({
      ...defaultInputs(),
      heatLossKw: 14,
      boilerOutputKw: 28,
    })
    expect(oversized.estimatedReturnTempC).toBeGreaterThan(matched.estimatedReturnTempC)
  })

  it('return temperature increases as boilerOutputKw increases beyond heat loss', () => {
    // Monotonic: 18 kW < 24 kW < 36 kW boiler all with 14 kW heat loss
    const r18 = useEmitterPrimaryModel({ ...defaultInputs(), heatLossKw: 14, boilerOutputKw: 18 })
    const r24 = useEmitterPrimaryModel({ ...defaultInputs(), heatLossKw: 14, boilerOutputKw: 24 })
    const r36 = useEmitterPrimaryModel({ ...defaultInputs(), heatLossKw: 14, boilerOutputKw: 36 })
    expect(r24.estimatedReturnTempC).toBeGreaterThan(r18.estimatedReturnTempC)
    expect(r36.estimatedReturnTempC).toBeGreaterThan(r24.estimatedReturnTempC)
  })

  it('return temperature never exceeds the flow temperature (ΔT is always positive)', () => {
    // Very large boiler: ΔT clamped to DT_SYSTEM_MIN_C (3°C)
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      heatLossKw: 5,
      boilerOutputKw: 45,
    })
    expect(result.estimatedReturnTempC).toBeLessThan(result.requiredFlowTempC)
  })

  it('currentLoadReturnTempC also reflects the boiler-output-scaled ΔT', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      heatLossKw: 14,
      boilerOutputKw: 28,
      loadCompensation: false,
    })
    // Without load compensation, current return = design return
    expect(result.currentLoadReturnTempC).toBe(result.estimatedReturnTempC)
  })
})

// ─── boilerOutputKw — pipe sizing highlight ───────────────────────────────────

describe('useEmitterPrimaryModel — boilerOutputKw triggers primary circuit limit', () => {
  it('22mm pipe is inadequate when boilerOutputKw exceeds its 25 kW capacity', () => {
    // 22mm capacity = 25 kW; 30 kW boiler output exceeds it
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      primaryPipeSize: '22mm',
      heatLossKw: 14,
      boilerOutputKw: 30,
    })
    expect(result.primaryAdequate).toBe(false)
    expect(result.heatDemandKw).toBe(30)      // pipe-check demand = max(14, 30)
    expect(result.primaryCapacityKw).toBe(25)
  })

  it('22mm pipe is adequate when boilerOutputKw does not exceed its 25 kW capacity', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      primaryPipeSize: '22mm',
      heatLossKw: 14,
      boilerOutputKw: 24,
    })
    expect(result.primaryAdequate).toBe(true)
  })

  it('28mm pipe remains adequate even with 35 kW boiler (45 kW capacity)', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      primaryPipeSize: '28mm',
      heatLossKw: 14,
      boilerOutputKw: 35,
    })
    expect(result.primaryAdequate).toBe(true)
    expect(result.heatDemandKw).toBe(35)
  })

  it('15mm pipe is inadequate when heatLossKw exceeds its 12 kW capacity', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      primaryPipeSize: '15mm',
      heatLossKw: 18,
      boilerOutputKw: 18,
    })
    expect(result.primaryAdequate).toBe(false)
    expect(result.heatDemandKw).toBe(18)
  })

  it('pipe-check demand is the larger of heatLossKw and boilerOutputKw', () => {
    // heatLoss = 20 kW, boilerOutput = 15 kW → pipe-check = 20
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      primaryPipeSize: '22mm',
      heatLossKw: 20,
      boilerOutputKw: 15,
    })
    expect(result.heatDemandKw).toBe(20)
  })
})

// ─── heatLossKw — backward compatibility ─────────────────────────────────────

describe('useEmitterPrimaryModel — heatLossKw backward compatibility', () => {
  it('omitting heatLossKw falls back to BASE_HEAT_DEMAND_KW for pipe check', () => {
    const result = useEmitterPrimaryModel({ ...defaultInputs(), primaryPipeSize: '15mm' })
    // BASE_HEAT_DEMAND_KW = 14 > 12 kW (15mm capacity) → inadequate
    expect(result.primaryAdequate).toBe(false)
    expect(result.heatDemandKw).toBe(BASE_HEAT_DEMAND_KW)
  })

  it('heatLossKw below pipe capacity marks primaryAdequate true when boilerOutputKw also within capacity', () => {
    const result = useEmitterPrimaryModel({
      ...defaultInputs(),
      primaryPipeSize: '15mm',
      heatLossKw: 10,    // 10 < 12 kW (15mm capacity)
      boilerOutputKw: 10,
    })
    expect(result.primaryAdequate).toBe(true)
    expect(result.heatDemandKw).toBe(10)
  })
})

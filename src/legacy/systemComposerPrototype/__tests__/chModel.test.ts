/**
 * Tests for chModel.ts — the central-heating energy balance model.
 *
 * Validates the Layer A energy balance:
 *   Q = ṁ × cₚ × ΔT
 *   deliveredKw = min(sourceOutputKw, totalDemandKw)
 *   returnTempC = flowTempC − deliveredKw / (flowRateLps × 4.18)
 */

import { describe, it, expect } from 'vitest'
import {
  computeChHeatBalance,
  CP_WATER_KJ_PER_KG_K,
  DEFAULT_CH_DESIGN_DELTA_T_C,
} from '../animation/chModel'
import type { HeatingLoad } from '../animation/chModel'

// ─── Helpers ────────────────────────────────────────────────────────────────

function load(id: string, demandKw: number, active = true): HeatingLoad {
  return { id, demandKw, active }
}

// ─── Basic energy balance ────────────────────────────────────────────────────

describe('computeChHeatBalance — basic energy balance', () => {
  it('sums only active loads for totalDemandKw', () => {
    const result = computeChHeatBalance({
      sourceOutputKw: 20,
      loads: [load('z1', 4), load('z2', 6), load('z3', 3, false)],
      targetFlowTempC: 70,
    })
    // Only z1 + z2 are active → 10 kW
    expect(result.totalDemandKw).toBe(10)
  })

  it('returns zero totalDemandKw when no loads are active', () => {
    const result = computeChHeatBalance({
      sourceOutputKw: 15,
      loads: [load('z1', 5, false), load('z2', 8, false)],
      targetFlowTempC: 70,
    })
    expect(result.totalDemandKw).toBe(0)
    expect(result.deliveredKw).toBe(0)
  })

  it('delivers all demand when source can cover it', () => {
    const result = computeChHeatBalance({
      sourceOutputKw: 20,
      loads: [load('z1', 4), load('z2', 6)],  // total = 10 kW
      targetFlowTempC: 70,
    })
    expect(result.deliveredKw).toBe(10)
  })

  it('caps deliveredKw at sourceOutputKw when source is limiting', () => {
    const result = computeChHeatBalance({
      sourceOutputKw: 8,
      loads: [load('z1', 5), load('z2', 5)],  // demand = 10 kW, source = 8 kW
      targetFlowTempC: 70,
    })
    expect(result.deliveredKw).toBe(8)
    expect(result.totalDemandKw).toBe(10)
  })

  it('returns the target flow temperature unchanged as flowTempC', () => {
    const result = computeChHeatBalance({
      sourceOutputKw: 15,
      loads: [load('z1', 10)],
      targetFlowTempC: 75,
    })
    expect(result.flowTempC).toBe(75)
  })
})

// ─── Return temperature derivation ──────────────────────────────────────────

describe('computeChHeatBalance — return temperature derivation', () => {
  it('derives return temperature from Q = ṁ × cₚ × ΔT at explicit flow rate', () => {
    // 10 kW at 0.12 L/s and 4.18 kJ/(kg·K):
    //   ΔT = 10 / (0.12 × 4.18) = 10 / 0.5016 ≈ 19.94 °C
    //   returnTempC = 70 − 19.94 ≈ 50.06 °C
    const flowRateLps = 0.12
    const result = computeChHeatBalance({
      sourceOutputKw: 20,
      loads: [load('z1', 10)],
      targetFlowTempC: 70,
      flowRateLps,
    })
    const expectedDeltaT = 10 / (flowRateLps * CP_WATER_KJ_PER_KG_K)
    expect(result.returnTempC).toBeCloseTo(70 - expectedDeltaT, 2)
  })

  it('return temperature equals flow temperature when no load is active', () => {
    const result = computeChHeatBalance({
      sourceOutputKw: 20,
      loads: [],  // no loads → deliveredKw = 0 → ΔT = 0
      targetFlowTempC: 70,
      flowRateLps: 0.15,
    })
    expect(result.returnTempC).toBe(70)
  })

  it('return temperature is lower than flow temperature when heat is delivered', () => {
    const result = computeChHeatBalance({
      sourceOutputKw: 20,
      loads: [load('z1', 10)],
      targetFlowTempC: 70,
      flowRateLps: 0.12,
    })
    expect(result.returnTempC).toBeLessThan(result.flowTempC)
  })

  it('larger load → greater temperature drop (lower return temp)', () => {
    const baseParams = {
      sourceOutputKw: 30,
      targetFlowTempC: 70,
      flowRateLps: 0.15,
    }
    const low  = computeChHeatBalance({ ...baseParams, loads: [load('z1', 5)] })
    const high = computeChHeatBalance({ ...baseParams, loads: [load('z1', 15)] })
    expect(high.returnTempC).toBeLessThan(low.returnTempC)
  })

  it('source-limited delivery produces smaller temperature drop than full demand', () => {
    // Source = 5 kW, demand = 15 kW → delivered = 5 kW → smaller ΔT
    const result = computeChHeatBalance({
      sourceOutputKw: 5,
      loads: [load('z1', 15)],
      targetFlowTempC: 70,
      flowRateLps: 0.12,
    })
    const expectedDeltaT = 5 / (0.12 * CP_WATER_KJ_PER_KG_K)
    expect(result.returnTempC).toBeCloseTo(70 - expectedDeltaT, 2)
    // Compared to a full 15 kW delivery: return should be higher (less cooling)
    const fullResult = computeChHeatBalance({
      sourceOutputKw: 20,
      loads: [load('z1', 15)],
      targetFlowTempC: 70,
      flowRateLps: 0.12,
    })
    expect(result.returnTempC).toBeGreaterThan(fullResult.returnTempC)
  })
})

// ─── Default flow rate derivation ────────────────────────────────────────────

describe('computeChHeatBalance — default flow rate derivation', () => {
  it('derives flowRateLps from sourceOutputKw at design ΔT when not provided', () => {
    // sourceOutputKw = 15 kW, design ΔT = 20 °C
    // flowRateLps = 15 / (4.18 × 20) = 15 / 83.6 ≈ 0.1794 L/s
    const result = computeChHeatBalance({
      sourceOutputKw: 15,
      loads: [load('z1', 10)],
      targetFlowTempC: 70,
    })
    const expectedFlowRate = 15 / (CP_WATER_KJ_PER_KG_K * DEFAULT_CH_DESIGN_DELTA_T_C)
    expect(result.flowRateLps).toBeCloseTo(expectedFlowRate, 4)
  })

  it('return temperature is physically plausible at default flow rate (50 °C for 70/50 design)', () => {
    // At design point: source = demand = 15 kW, design ΔT = 20 °C → return ≈ 50 °C
    const sourceKw = 15
    const result = computeChHeatBalance({
      sourceOutputKw: sourceKw,
      loads: [load('z1', sourceKw)],  // demand matches source
      targetFlowTempC: 70,
      // no flowRateLps → uses design 20 °C ΔT
    })
    // At the design point the return temp should be ≈ 70 - 20 = 50 °C
    expect(result.returnTempC).toBeCloseTo(50, 1)
  })

  it('uses supplied flowRateLps when provided rather than the default', () => {
    const explicitRate = 0.25
    const result = computeChHeatBalance({
      sourceOutputKw: 15,
      loads: [load('z1', 10)],
      targetFlowTempC: 70,
      flowRateLps: explicitRate,
    })
    expect(result.flowRateLps).toBe(explicitRate)
  })

  it('flowRateLps is zero and ΔT is zero when sourceOutputKw is zero', () => {
    const result = computeChHeatBalance({
      sourceOutputKw: 0,
      loads: [load('z1', 10)],
      targetFlowTempC: 70,
    })
    expect(result.flowRateLps).toBe(0)
    expect(result.deliveredKw).toBe(0)
    expect(result.returnTempC).toBe(result.flowTempC)
  })
})

// ─── Multi-load scenarios ────────────────────────────────────────────────────

describe('computeChHeatBalance — multi-load scenarios', () => {
  it('aggregates multiple active loads correctly', () => {
    const result = computeChHeatBalance({
      sourceOutputKw: 30,
      loads: [
        load('z1', 5),
        load('z2', 7),
        load('z3', 3),
        load('z4', 2, false),  // inactive
      ],
      targetFlowTempC: 70,
    })
    expect(result.totalDemandKw).toBe(15)  // 5 + 7 + 3
    expect(result.deliveredKw).toBe(15)
  })

  it('handles a single emitter correctly', () => {
    const result = computeChHeatBalance({
      sourceOutputKw: 20,
      loads: [load('rad1', 8)],
      targetFlowTempC: 70,
      flowRateLps: 0.1,
    })
    expect(result.totalDemandKw).toBe(8)
    expect(result.deliveredKw).toBe(8)
  })
})

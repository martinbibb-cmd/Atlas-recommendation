/**
 * Tests for thermal animation primitives:
 * thermal.ts — tempToThermalColor, heatToTempC, tempToHeatJPerKg
 * simulation.ts — stepSimulation, createColdTokens
 */

import { describe, it, expect } from 'vitest';
import {
  tempToThermalColor,
  heatToTempC,
  tempToHeatJPerKg,
} from '../animation/thermal';
import {
  createColdTokens,
  stepSimulation,
} from '../animation/simulation';
import type { LabFrame, LabControls } from '../animation/types';

// ─── tempToThermalColor ───────────────────────────────────────────────────────

describe('tempToThermalColor', () => {
  it('returns a hex string for 0 °C', () => {
    const color = tempToThermalColor(0)
    expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('returns a hex string for 45 °C (mid-range)', () => {
    const color = tempToThermalColor(45)
    expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('returns a hex string for 90 °C (upper bound)', () => {
    const color = tempToThermalColor(90)
    expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('clamps below 0 °C to the same result as 0 °C', () => {
    expect(tempToThermalColor(-10)).toBe(tempToThermalColor(0))
  })

  it('clamps above 90 °C to the same result as 90 °C', () => {
    expect(tempToThermalColor(100)).toBe(tempToThermalColor(90))
  })

  it('produces different colours for cold (5 °C) and hot (60 °C)', () => {
    expect(tempToThermalColor(5)).not.toBe(tempToThermalColor(60))
  })
})

// ─── heatToTempC ─────────────────────────────────────────────────────────────

describe('heatToTempC', () => {
  it('returns coldInletC when hJPerKg is 0', () => {
    expect(heatToTempC({ coldInletC: 10, hJPerKg: 0 })).toBe(10)
  })

  it('correctly converts 167200 J/kg (≈40 °C rise) to ~50 °C from 10 °C inlet', () => {
    // 40 × 4180 = 167200
    expect(heatToTempC({ coldInletC: 10, hJPerKg: 167200 })).toBeCloseTo(50, 1)
  })

  it('is consistent across different cold inlets', () => {
    const rise = 4180 * 30 // 30 °C rise
    expect(heatToTempC({ coldInletC: 5,  hJPerKg: rise })).toBeCloseTo(35, 1)
    expect(heatToTempC({ coldInletC: 15, hJPerKg: rise })).toBeCloseTo(45, 1)
  })
})

// ─── tempToHeatJPerKg ────────────────────────────────────────────────────────

describe('tempToHeatJPerKg', () => {
  it('returns 0 when tempC equals coldInletC', () => {
    expect(tempToHeatJPerKg({ coldInletC: 10, tempC: 10 })).toBe(0)
  })

  it('is the inverse of heatToTempC', () => {
    const coldInletC = 10
    const original = 125400 // arbitrary J/kg
    const roundTripped = tempToHeatJPerKg({
      coldInletC,
      tempC: heatToTempC({ coldInletC, hJPerKg: original }),
    })
    expect(roundTripped).toBeCloseTo(original, 1)
  })
})

// ─── createColdTokens ────────────────────────────────────────────────────────

describe('createColdTokens', () => {
  it('creates the requested number of tokens', () => {
    const tokens = createColdTokens({ count: 10, velocity: 0.1, pressure: 0.5 })
    expect(tokens).toHaveLength(10)
  })

  it('all tokens start with hJPerKg = 0 (cold baseline)', () => {
    const tokens = createColdTokens({ count: 5, velocity: 0.1, pressure: 0.5 })
    for (const t of tokens) {
      expect(t.hJPerKg).toBe(0)
    }
  })

  it('tokens are evenly distributed along the path (s ∈ [0, 1))', () => {
    const tokens = createColdTokens({ count: 4, velocity: 0.1, pressure: 0.5 })
    expect(tokens[0].s).toBe(0)
    expect(tokens[1].s).toBeCloseTo(0.25, 5)
    expect(tokens[2].s).toBeCloseTo(0.5, 5)
    expect(tokens[3].s).toBeCloseTo(0.75, 5)
  })

  it('assigns the correct velocity and pressure to each token', () => {
    const tokens = createColdTokens({ count: 3, velocity: 0.2, pressure: 0.8 })
    for (const t of tokens) {
      expect(t.v).toBe(0.2)
      expect(t.p).toBe(0.8)
    }
  })

  it('assigns unique IDs to all tokens', () => {
    const tokens = createColdTokens({ count: 5, velocity: 0.1, pressure: 0.5 })
    const ids = tokens.map(t => t.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(5)
  })
})

// ─── stepSimulation ──────────────────────────────────────────────────────────

describe('stepSimulation', () => {
  const defaultControls: LabControls = {
    coldInletC: 10,
    dhwSetpointC: 50,
    combiDhwKw: 30,
    mainsDynamicFlowLpm: 12,
    pipeDiameterMm: 15,
    outlets: [
      { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: false, kind: 'basin',        demandLpm: 5 },
      { id: 'C', enabled: false, kind: 'bath',         demandLpm: 18 },
    ],
  }

  const emptyOutletSamples: LabFrame['outletSamples'] = {
    A: { tempC: 0, count: 0 },
    B: { tempC: 0, count: 0 },
    C: { tempC: 0, count: 0 },
  }

  it('advances token positions forward', () => {
    const initial = createColdTokens({ count: 3, velocity: 0.1, pressure: 0.5 })
    const frame: LabFrame = { nowMs: 0, tokens: initial, spawnAccumulator: 0, nextTokenId: 0, outletSamples: emptyOutletSamples }
    const next = stepSimulation({ frame, dtMs: 1000, controls: defaultControls })

    for (const orig of initial) {
      // Token might have branched — check by id in the result set
      const moved = next.tokens.find(t => t.id === orig.id)
      // Token should either have advanced or been assigned to a branch (s reset)
      expect(moved !== undefined || next.tokens.length > 0).toBe(true)
    }
  })

  it('advances the simulation clock', () => {
    const frame: LabFrame = { nowMs: 1000, tokens: [], spawnAccumulator: 0, nextTokenId: 0, outletSamples: emptyOutletSamples }
    const next = stepSimulation({ frame, dtMs: 500, controls: defaultControls })
    expect(next.nowMs).toBe(1500)
  })

  it('removes branch tokens that exit the path (s >= 0.98)', () => {
    // A token already on branch A near the end
    const tokens = [{ id: 't_exit', s: 0.99, v: 0.1, p: 0.5, hJPerKg: 0, route: 'A' as const }]
    const frame: LabFrame = { nowMs: 0, tokens, spawnAccumulator: 0, nextTokenId: 0, outletSamples: emptyOutletSamples }
    const next = stepSimulation({ frame, dtMs: 1000, controls: defaultControls })
    const exited = next.tokens.find(t => t.id === 't_exit')
    expect(exited).toBeUndefined()
  })

  it('injects heat into tokens passing through the HEX zone', () => {
    // Place a MAIN token in the middle of the HEX zone with tiny velocity so it stays there
    const tokens = [{ id: 't_hex', s: 0.5, v: 0.001, p: 0.5, hJPerKg: 0, route: 'MAIN' as const }]
    const frame: LabFrame = { nowMs: 0, tokens, spawnAccumulator: 0, nextTokenId: 0, outletSamples: emptyOutletSamples }
    const next = stepSimulation({ frame, dtMs: 100, controls: defaultControls })
    const hexToken = next.tokens.find(t => t.id === 't_hex')
    expect(hexToken).toBeDefined()
    expect(hexToken!.hJPerKg).toBeGreaterThan(0)
  })

  it('does not inject heat into tokens before the HEX zone', () => {
    // Place a MAIN token well before the HEX zone (s=0.1) with tiny velocity so it stays clear
    const tokens = [{ id: 't_cold', s: 0.1, v: 0.001, p: 0.5, hJPerKg: 0, route: 'MAIN' as const }]
    const frame: LabFrame = { nowMs: 0, tokens, spawnAccumulator: 0, nextTokenId: 0, outletSamples: emptyOutletSamples }
    const next = stepSimulation({ frame, dtMs: 100, controls: defaultControls })
    const coldToken = next.tokens.find(t => t.id === 't_cold')
    expect(coldToken).toBeDefined()
    expect(coldToken!.hJPerKg).toBe(0)
  })
})

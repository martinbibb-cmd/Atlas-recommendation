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
import type { LabFrame } from '../animation/types';

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
  it('advances token positions forward', () => {
    const initial = createColdTokens({ count: 3, velocity: 0.1, pressure: 0.5 })
    const frame: LabFrame = { nowMs: 0, tokens: initial }
    const next = stepSimulation({ frame, dtMs: 1000, controls: { coldInletC: 10 } })

    for (let i = 0; i < next.tokens.length; i++) {
      // s advances by v * dt = 0.1 * 1.0 = 0.1
      const expectedS = Math.min(1, initial[i].s + 0.1)
      expect(next.tokens[i].s).toBeCloseTo(expectedS, 5)
    }
  })

  it('advances the simulation clock', () => {
    const initial = createColdTokens({ count: 1, velocity: 0.1, pressure: 0.5 })
    const frame: LabFrame = { nowMs: 1000, tokens: initial }
    const next = stepSimulation({ frame, dtMs: 500, controls: { coldInletC: 10 } })
    expect(next.nowMs).toBe(1500)
  })

  it('clamps token s to 1 when it would exceed bounds', () => {
    const tokens = [{ id: 't_0', s: 0.95, v: 0.2, p: 0.5, hJPerKg: 0 }]
    const frame: LabFrame = { nowMs: 0, tokens }
    const next = stepSimulation({ frame, dtMs: 1000, controls: { coldInletC: 10 } })
    expect(next.tokens[0].s).toBe(1)
  })

  it('preserves hJPerKg (no heat injection in PR1)', () => {
    const tokens = [{ id: 't_0', s: 0.5, v: 0.1, p: 0.5, hJPerKg: 0 }]
    const frame: LabFrame = { nowMs: 0, tokens }
    const next = stepSimulation({ frame, dtMs: 500, controls: { coldInletC: 10 } })
    expect(next.tokens[0].hJPerKg).toBe(0)
  })
})

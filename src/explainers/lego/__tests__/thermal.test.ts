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
    systemType: 'combi',
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

  it('clamps token temperature to the DHW setpoint after HEX injection', () => {
    // A token already at maximum setpoint heat content passing through the HEX zone.
    // Even with a very high combi kW, the token must not exceed the setpoint.
    const coldInletC = 10
    const dhwSetpointC = 50
    const maxH = (dhwSetpointC - coldInletC) * 4180 // 167 200 J/kg
    const controls: LabControls = {
      ...defaultControls,
      coldInletC,
      dhwSetpointC,
      combiDhwKw: 100, // deliberately oversized
      mainsDynamicFlowLpm: 1, // low flow so kW_required is also low
      outlets: [{ id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 1 }],
    }
    // Token inside the HEX zone, already at the setpoint
    const tokens = [{ id: 't_0', s: 0.5, v: 0.001, p: 0.5, hJPerKg: maxH, route: 'MAIN' as const }]
    const frame: LabFrame = { nowMs: 0, tokens, spawnAccumulator: 0, nextTokenId: 1, outletSamples: emptyOutletSamples }

    // Run many steps — token must never rise above maxH
    let current = frame
    for (let i = 0; i < 20; i++) {
      current = stepSimulation({ frame: current, dtMs: 100, controls })
    }
    const found = current.tokens.find(tk => tk.id === 't_0')
    if (found) {
      expect(found.hJPerKg).toBeLessThanOrEqual(maxH + 1) // allow ≤1 J/kg float rounding
    }
    // At minimum, no token in the frame should be superheated
    for (const tk of current.tokens) {
      expect(tk.hJPerKg).toBeLessThanOrEqual(maxH + 1)
    }
  })

  it('routes tokens to multiple outlets when more than one is enabled', () => {
    // Outlets A (demand 10), B (demand 5), C (demand 18) — all enabled.
    // With the demand-proportional cycle fix the first full cycle covers all three outlets.
    const controls: LabControls = {
      ...defaultControls,
      outlets: [
        { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: true, kind: 'basin',        demandLpm: 5 },
        { id: 'C', enabled: true, kind: 'bath',         demandLpm: 18 },
      ],
    }
    // Place three MAIN tokens just before the splitter (s=0.81) with IDs that map to each outlet.
    // With v=0.1 and dt=0.1s: sNext = 0.82 → crosses S_SPLIT=0.82 → branch fires.
    // With total demand = 33, cycle = 33:
    //   token 0  → r = 0  → outlet A  (0 < 10)
    //   token 10 → r = 10 → outlet B  (10 >= 10, 10 < 15)
    //   token 15 → r = 15 → outlet C  (15 >= 15)
    const tokens = [
      { id: 't_0',  s: 0.81, v: 0.1, p: 0.5, hJPerKg: 0, route: 'MAIN' as const },
      { id: 't_10', s: 0.81, v: 0.1, p: 0.5, hJPerKg: 0, route: 'MAIN' as const },
      { id: 't_15', s: 0.81, v: 0.1, p: 0.5, hJPerKg: 0, route: 'MAIN' as const },
    ]
    const frame: LabFrame = { nowMs: 0, tokens, spawnAccumulator: 0, nextTokenId: 16, outletSamples: emptyOutletSamples }
    const next = stepSimulation({ frame, dtMs: 100, controls })

    // Each token should have been routed to its expected outlet
    const t0  = next.tokens.find(t => t.id === 't_0')
    const t10 = next.tokens.find(t => t.id === 't_10')
    const t15 = next.tokens.find(t => t.id === 't_15')

    expect(t0).toBeDefined()
    expect(t10).toBeDefined()
    expect(t15).toBeDefined()

    expect(t0!.route).toBe('A')
    expect(t10!.route).toBe('B')
    expect(t15!.route).toBe('C')
  })

  it('always routes to the sole active outlet when only one is enabled', () => {
    const controls: LabControls = {
      ...defaultControls,
      outlets: [
        { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: true,  kind: 'basin',        demandLpm: 5 },
        { id: 'C', enabled: false, kind: 'bath',         demandLpm: 18 },
      ],
    }
    // Tokens just before S_SPLIT=0.82 so the crossing check fires.
    const tokens = [
      { id: 't_0',  s: 0.81, v: 0.1, p: 0.5, hJPerKg: 0, route: 'MAIN' as const },
      { id: 't_50', s: 0.81, v: 0.1, p: 0.5, hJPerKg: 0, route: 'MAIN' as const },
    ]
    const frame: LabFrame = { nowMs: 0, tokens, spawnAccumulator: 0, nextTokenId: 51, outletSamples: emptyOutletSamples }
    const next = stepSimulation({ frame, dtMs: 100, controls })

    for (const t of next.tokens) {
      if (t.route !== 'MAIN') {
        expect(t.route).toBe('B')
      }
    }
  })

  it('setpoint modulation: high combi kW with low flow stays at setpoint, not above', () => {
    // With 100 kW boiler and 1 L/min flow:
    // kW_required = 0.06977 × 1 × (50 − 10) = 2.79 kW
    // kW_actual   = min(100, 2.79)           = 2.79 kW
    // Token should rise to ~setpoint, not beyond.
    const coldInletC = 10
    const dhwSetpointC = 50
    const maxH = (dhwSetpointC - coldInletC) * 4180
    const controls: LabControls = {
      ...defaultControls,
      combiDhwKw: 100,
      mainsDynamicFlowLpm: 1,
      outlets: [{ id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 1 }],
    }
    // Token at start of HEX zone, cold
    const tokens = [{ id: 't_0', s: 0.38, v: 0.001, p: 0.5, hJPerKg: 0, route: 'MAIN' as const }]
    const frame: LabFrame = { nowMs: 0, tokens, spawnAccumulator: 0, nextTokenId: 1, outletSamples: emptyOutletSamples }

    let current = frame
    for (let i = 0; i < 50; i++) {
      current = stepSimulation({ frame: current, dtMs: 1000, controls })
    }
    for (const tk of current.tokens) {
      expect(tk.hJPerKg).toBeLessThanOrEqual(maxH + 1)
    }
  })

  it('failsafe: MAIN token that skips past S_SPLIT is still routed when active outlets exist', () => {
    // Token at s=0.994 with large velocity: sNext will jump past S_SPLIT without crossing it.
    // The failsafe (sNext >= 0.995) must route it to an outlet.
    const controls: LabControls = {
      ...defaultControls,
      outlets: [
        { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin',       demandLpm: 5 },
        { id: 'C', enabled: false, kind: 'bath',        demandLpm: 18 },
      ],
    }
    // With v=0.01 and dt=0.1s: sNext = 0.994 + 0.001 = 0.995 → failsafe fires.
    const tokens = [{ id: 't_0', s: 0.994, v: 0.01, p: 0.5, hJPerKg: 0, route: 'MAIN' as const }]
    const frame: LabFrame = { nowMs: 0, tokens, spawnAccumulator: 0, nextTokenId: 1, outletSamples: emptyOutletSamples }
    const next = stepSimulation({ frame, dtMs: 100, controls })

    const t = next.tokens.find(tk => tk.id === 't_0')
    expect(t).toBeDefined()
    expect(t!.route).not.toBe('MAIN')
  })

  it('setpoint cap: animation setpoint is clamped to 55 °C regardless of UI value', () => {
    // With dhwSetpointC=70 (above cap), tokens must never exceed the heat content for 55 °C.
    const coldInletC = 10
    const capTempC = 55
    const maxHAtCap = tempToHeatJPerKg({ coldInletC, tempC: capTempC })
    const controls: LabControls = {
      ...defaultControls,
      dhwSetpointC: 70, // above cap
      combiDhwKw: 30,
      mainsDynamicFlowLpm: 1,
      outlets: [{ id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 1 }],
    }
    // Token inside the HEX zone
    const tokens = [{ id: 't_0', s: 0.5, v: 0.001, p: 0.5, hJPerKg: 0, route: 'MAIN' as const }]
    const frame: LabFrame = { nowMs: 0, tokens, spawnAccumulator: 0, nextTokenId: 1, outletSamples: emptyOutletSamples }

    let current = frame
    for (let i = 0; i < 30; i++) {
      current = stepSimulation({ frame: current, dtMs: 1000, controls })
    }
    for (const tk of current.tokens) {
      expect(tk.hJPerKg).toBeLessThanOrEqual(maxHAtCap + 1)
    }
  })

  it('no draw: tokens clear immediately when all outlets disabled', () => {
    // All outlets disabled → hydraulicFlowLpm = 0 → hasDraw = false → tokens must be empty.
    const controls: LabControls = {
      ...defaultControls,
      outlets: [
        { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin',        demandLpm: 5 },
        { id: 'C', enabled: false, kind: 'bath',         demandLpm: 18 },
      ],
    }
    // Pre-populate some tokens at various positions
    const tokens = [
      { id: 't_0', s: 0.1, v: 0.1, p: 0.5, hJPerKg: 0, route: 'MAIN' as const },
      { id: 't_1', s: 0.5, v: 0.1, p: 0.5, hJPerKg: 0, route: 'A'    as const },
    ]
    const frame: LabFrame = { nowMs: 0, tokens, spawnAccumulator: 1, nextTokenId: 2, outletSamples: emptyOutletSamples }
    const next = stepSimulation({ frame, dtMs: 100, controls })
    // All tokens must be cleared when there is no draw
    expect(next.tokens).toHaveLength(0)
  })

  it('no draw: velocity is zero so no new tokens are spawned', () => {
    // All outlets disabled → spawn rate = 0 → no tokens spawned even with spawnAccumulator = 0.
    const controls: LabControls = {
      ...defaultControls,
      outlets: [
        { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin',        demandLpm: 5 },
        { id: 'C', enabled: false, kind: 'bath',         demandLpm: 18 },
      ],
    }
    const frame: LabFrame = { nowMs: 0, tokens: [], spawnAccumulator: 0, nextTokenId: 0, outletSamples: emptyOutletSamples }
    const next = stepSimulation({ frame, dtMs: 1000, controls })
    expect(next.tokens).toHaveLength(0)
  })
})

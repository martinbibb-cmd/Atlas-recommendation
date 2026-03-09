/**
 * Tests for outletDisplayState.ts — per-outlet explicit state model.
 *
 * Validates that deriveOutletDisplayStates():
 *   - Correctly classifies cold-only outlets
 *   - Correctly classifies mixed outlets as hot/cold-running from temperature samples
 *   - Detects mains-flow constraints when multiple outlets share mains
 *   - Returns 'off' for closed outlets
 *   - Preserves cold source kind through to display state
 */

import { describe, it, expect } from 'vitest'
import { deriveOutletDisplayStates } from '../state/outletDisplayState'
import type { LabControls, LabFrame } from '../animation/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeControls(overrides: Partial<LabControls> = {}): LabControls {
  return {
    systemType: 'combi',
    coldInletC: 10,
    dhwSetpointC: 50,
    mainsDynamicFlowLpm: 20,
    pipeDiameterMm: 22,
    combiDhwKw: 30,
    outlets: [
      { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: false, kind: 'basin',        demandLpm: 5  },
    ],
    ...overrides,
  }
}

function makeFrame(samples: Record<string, { tempC: number; count: number }> = {}): LabFrame {
  return {
    nowMs:             0,
    particles:         [],
    spawnAccumulator:  0,
    nextTokenId:       0,
    outletSamples: {
      A: { tempC: 0, count: 0 },
      B: { tempC: 0, count: 0 },
      ...samples,
    },
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('deriveOutletDisplayStates — basic outlet classification', () => {
  it('returns "off" for a disabled outlet', () => {
    const controls = makeControls()
    const frame    = makeFrame()
    const states   = deriveOutletDisplayStates(controls, frame)
    const b = states.find(s => s.outletId === 'B')!
    expect(b.open).toBe(false)
    expect(b.service).toBe('off')
    expect(b.flowLpm).toBe(0)
  })

  it('returns "cold_only" for a cold_tap outlet regardless of temperature', () => {
    const controls = makeControls({
      outlets: [
        { id: 'A', enabled: true, kind: 'cold_tap', demandLpm: 6 },
      ],
    })
    const frame  = makeFrame({ A: { tempC: 50, count: 5 } })
    const states = deriveOutletDisplayStates(controls, frame)
    expect(states[0].service).toBe('cold_only')
  })

  it('returns "cold_only" when serviceClass is explicitly cold_only', () => {
    const controls = makeControls({
      outlets: [
        { id: 'A', enabled: true, kind: 'basin', demandLpm: 5, serviceClass: 'cold_only' },
      ],
    })
    const states = deriveOutletDisplayStates(controls, makeFrame())
    expect(states[0].service).toBe('cold_only')
  })

  it('returns "mixed_hot_running" when delivered temp is well above cold inlet', () => {
    const controls = makeControls()
    // deliveredTempC = 45 °C, coldInletC = 10 °C, delta = 35 > threshold (10)
    const frame  = makeFrame({ A: { tempC: 45, count: 3 } })
    const states = deriveOutletDisplayStates(controls, frame)
    const a = states.find(s => s.outletId === 'A')!
    expect(a.open).toBe(true)
    expect(a.service).toBe('mixed_hot_running')
    expect(a.deliveredTempC).toBeCloseTo(45)
  })

  it('returns "mixed_cold_running" when delivered temp is close to cold inlet', () => {
    const controls = makeControls()
    // deliveredTempC = 12 °C, coldInletC = 10 °C, delta = 2 < threshold (10)
    const frame  = makeFrame({ A: { tempC: 12, count: 3 } })
    const states = deriveOutletDisplayStates(controls, frame)
    const a = states.find(s => s.outletId === 'A')!
    expect(a.service).toBe('mixed_cold_running')
  })

  it('returns "hot_only" when serviceClass is hot_only', () => {
    const controls = makeControls({
      outlets: [
        { id: 'A', enabled: true, kind: 'basin', demandLpm: 5, serviceClass: 'hot_only' },
      ],
    })
    const states = deriveOutletDisplayStates(controls, makeFrame())
    expect(states[0].service).toBe('hot_only')
  })
})

describe('deriveOutletDisplayStates — constraint detection', () => {
  it('marks outlets as constrained when total hot demand exceeds mains capacity', () => {
    const controls = makeControls({
      mainsDynamicFlowLpm: 12,  // low mains supply
      outlets: [
        { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: true, kind: 'basin',        demandLpm: 5  },
      ],
    })
    // totalHotDemand = 15 > mainsFlowLpm = 12 → constrained
    const states = deriveOutletDisplayStates(controls, makeFrame())
    const a = states.find(s => s.outletId === 'A')!
    const b = states.find(s => s.outletId === 'B')!
    expect(a.isConstrained).toBe(true)
    expect(b.isConstrained).toBe(true)
    expect(a.constraintReason).toContain('12.0 L/min')
  })

  it('does not mark outlets as constrained when mains capacity is sufficient', () => {
    const controls = makeControls({
      mainsDynamicFlowLpm: 25,  // ample supply
      outlets: [
        { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: true, kind: 'basin',        demandLpm: 5  },
      ],
    })
    const states = deriveOutletDisplayStates(controls, makeFrame())
    expect(states[0].isConstrained).toBe(false)
    expect(states[1].isConstrained).toBe(false)
  })

  it('does not mark constrained when only one hot outlet is open', () => {
    // Single outlet — no sharing constraint even with low mains flow.
    const controls = makeControls({
      mainsDynamicFlowLpm: 5,  // very low
      outlets: [
        { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin',        demandLpm: 5  },
      ],
    })
    const states = deriveOutletDisplayStates(controls, makeFrame())
    // Only one open outlet — no sharing → not constrained by the two-outlet rule.
    const a = states.find(s => s.outletId === 'A')!
    expect(a.isConstrained).toBe(false)
  })

  it('does not count cold-only outlets toward hot-demand sharing constraint', () => {
    // Cold tap + hot outlet — cold tap does not consume from the hot service.
    const controls = makeControls({
      mainsDynamicFlowLpm: 8,
      outlets: [
        { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: true, kind: 'cold_tap',     demandLpm: 6  },
      ],
    })
    // Only outlet A is a hot outlet; cold tap B does not count toward sharing.
    const states = deriveOutletDisplayStates(controls, makeFrame())
    const a = states.find(s => s.outletId === 'A')!
    expect(a.isConstrained).toBe(false)
  })
})

describe('deriveOutletDisplayStates — cold source kind', () => {
  it('preserves coldSourceKind from outlet control', () => {
    const controls = makeControls({
      outlets: [
        { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10, coldSourceKind: 'cws' },
      ],
    })
    const states = deriveOutletDisplayStates(controls, makeFrame())
    expect(states[0].coldSource).toBe('cws')
  })

  it('preserves mains cold source kind', () => {
    const controls = makeControls({
      outlets: [
        { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10, coldSourceKind: 'mains' },
      ],
    })
    const states = deriveOutletDisplayStates(controls, makeFrame())
    expect(states[0].coldSource).toBe('mains')
  })
})

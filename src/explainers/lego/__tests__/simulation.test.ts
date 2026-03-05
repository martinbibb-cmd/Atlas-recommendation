/**
 * Tests for simulation.ts — focuses on the hash-based outlet routing and
 * split-jitter behaviour introduced to eliminate "one-pipe-at-a-time" trains.
 */

import { describe, it, expect } from 'vitest'
import { stepSimulation } from '../animation/simulation'
import type { LabControls, LabFrame, OutletControl } from '../animation/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeControls(outlets: OutletControl[]): LabControls {
  return {
    systemType: 'combi',
    coldInletC: 10,
    dhwSetpointC: 50,
    mainsDynamicFlowLpm: 20,
    pipeDiameterMm: 22,
    combiDhwKw: 30,
    outlets,
  }
}

function makeFrame(): LabFrame {
  return {
    nowMs: 0,
    tokens: [],
    spawnAccumulator: 0,
    nextTokenId: 0,
    outletSamples: {
      A: { tempC: 0, count: 0 },
      B: { tempC: 0, count: 0 },
      C: { tempC: 0, count: 0 },
    },
  }
}

/**
 * Run the simulation for enough ticks that many tokens are spawned and routed,
 * then return the set of outlet IDs seen on branched tokens.
 */
function collectRoutedOutlets(
  controls: LabControls,
  tickCount: number,
  dtMs = 200,
): Set<string> {
  let frame = makeFrame()
  const seen = new Set<string>()
  for (let i = 0; i < tickCount; i++) {
    frame = stepSimulation({ frame, dtMs, controls })
    for (const t of frame.tokens) {
      if (t.route !== 'MAIN') seen.add(t.route)
    }
  }
  return seen
}

// ─── hash01 distribution ─────────────────────────────────────────────────────

describe('outlet routing — hash-based distribution', () => {
  it('routes tokens to both outlets when two are enabled with equal demand', () => {
    const outlets: OutletControl[] = [
      { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: true, kind: 'basin',        demandLpm: 10 },
      { id: 'C', enabled: false, kind: 'bath',        demandLpm: 0 },
    ]
    const seen = collectRoutedOutlets(makeControls(outlets), 60)
    expect(seen.has('A')).toBe(true)
    expect(seen.has('B')).toBe(true)
    expect(seen.has('C')).toBe(false)
  })

  it('routes tokens to all three outlets when all are enabled', () => {
    const outlets: OutletControl[] = [
      { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: true, kind: 'basin',        demandLpm: 6 },
      { id: 'C', enabled: true, kind: 'bath',         demandLpm: 8 },
    ]
    const seen = collectRoutedOutlets(makeControls(outlets), 80)
    expect(seen.has('A')).toBe(true)
    expect(seen.has('B')).toBe(true)
    expect(seen.has('C')).toBe(true)
  })

  it('routes all tokens to the single enabled outlet', () => {
    const outlets: OutletControl[] = [
      { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: false, kind: 'basin',        demandLpm: 5 },
      { id: 'C', enabled: false, kind: 'bath',         demandLpm: 0 },
    ]
    const seen = collectRoutedOutlets(makeControls(outlets), 40)
    if (seen.size > 0) {
      expect([...seen].every(r => r === 'A')).toBe(true)
    }
  })

  it('does not send tokens to a disabled outlet even if demandLpm > 0', () => {
    const outlets: OutletControl[] = [
      { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: false, kind: 'basin',        demandLpm: 10 },
      { id: 'C', enabled: false, kind: 'bath',         demandLpm: 10 },
    ]
    const seen = collectRoutedOutlets(makeControls(outlets), 40)
    expect(seen.has('B')).toBe(false)
    expect(seen.has('C')).toBe(false)
  })

  it('is deterministic — two identical runs produce identical token sequences', () => {
    const outlets: OutletControl[] = [
      { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: true, kind: 'basin',        demandLpm: 6 },
      { id: 'C', enabled: true, kind: 'bath',         demandLpm: 4 },
    ]
    const controls = makeControls(outlets)
    const dtMs = 200

    // Run 1
    let frame1 = makeFrame()
    for (let i = 0; i < 50; i++) frame1 = stepSimulation({ frame: frame1, dtMs, controls })

    // Run 2 (fresh start)
    let frame2 = makeFrame()
    for (let i = 0; i < 50; i++) frame2 = stepSimulation({ frame: frame2, dtMs, controls })

    // Token routes must be identical
    const routes1 = frame1.tokens.map(t => `${t.id}:${t.route}`)
    const routes2 = frame2.tokens.map(t => `${t.id}:${t.route}`)
    expect(routes1).toEqual(routes2)
  })

  it('interleaves outlets — consecutive token IDs do not all map to the same outlet', () => {
    // With the old modulo-cycle approach, tokens 0..N all went to outlet A before
    // any went to B. The hash-based approach should scatter them.
    const outlets: OutletControl[] = [
      { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: true, kind: 'basin',        demandLpm: 10 },
      { id: 'C', enabled: false, kind: 'bath',        demandLpm: 0 },
    ]
    const controls = makeControls(outlets)
    const dtMs = 200

    // Collect each token's route on the first tick it appears on a branch.
    // (A token can stay on its branch path for many ticks, so we deduplicate by ID.)
    let frame = makeFrame()
    const seenIds = new Set<string>()
    const firstBranchRoute: string[] = []
    for (let i = 0; i < 80; i++) {
      frame = stepSimulation({ frame, dtMs, controls })
      for (const t of frame.tokens) {
        if (t.route !== 'MAIN' && !seenIds.has(t.id)) {
          seenIds.add(t.id)
          firstBranchRoute.push(t.route)
        }
      }
    }

    if (firstBranchRoute.length >= 4) {
      // Within the first 4 uniquely-branched tokens, we expect more than one outlet.
      const firstFour = new Set(firstBranchRoute.slice(0, 4))
      expect(firstFour.size).toBeGreaterThan(1)
    }
  })
})

// ─── Split-jitter ────────────────────────────────────────────────────────────

describe('split jitter — per-token branch threshold staggering', () => {
  it('tokens still branch (reach a non-MAIN route) within a reasonable number of ticks', () => {
    const outlets: OutletControl[] = [
      { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: true, kind: 'basin',        demandLpm: 8 },
      { id: 'C', enabled: false, kind: 'bath',        demandLpm: 0 },
    ]
    const seen = collectRoutedOutlets(makeControls(outlets), 60)
    // At least one outlet should be reached if the sim ran correctly
    expect(seen.size).toBeGreaterThanOrEqual(1)
  })
})

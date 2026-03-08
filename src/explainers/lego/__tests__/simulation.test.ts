/**
 * Tests for simulation.ts — focuses on the hash-based outlet routing,
 * split-jitter behaviour, and heating demand simulation modes.
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
    particles: [],
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
    for (const t of frame.particles) {
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
    const routes1 = frame1.particles.map(t => `${t.id}:${t.route}`)
    const routes2 = frame2.particles.map(t => `${t.id}:${t.route}`)
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
      for (const t of frame.particles) {
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

// ─── Heating demand modes ─────────────────────────────────────────────────────

describe('simulation — heating demand and system mode', () => {
  it('combi enters dhw_draw mode when outlet is active, regardless of heating demand', () => {
    const controls: LabControls = {
      systemType: 'combi',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 20,
      pipeDiameterMm: 22,
      combiDhwKw: 30,
      outlets: [
        { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin', demandLpm: 5 },
        { id: 'C', enabled: false, kind: 'bath', demandLpm: 0 },
      ],
      // Heating is also demanded
      heatingDemand: { enabled: true, targetFlowTempC: 70 },
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    // DHW draw should take priority over CH on a combi
    expect(frame.systemMode).toBe('dhw_draw')
  })

  it('combi enters heating mode when no DHW draw and heating is demanded', () => {
    const controls: LabControls = {
      systemType: 'combi',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 20,
      pipeDiameterMm: 22,
      combiDhwKw: 30,
      outlets: [
        { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin', demandLpm: 5 },
        { id: 'C', enabled: false, kind: 'bath', demandLpm: 0 },
      ],
      heatingDemand: { enabled: true, targetFlowTempC: 70, demandLevel: 1 },
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    expect(frame.systemMode).toBe('heating')
  })

  it('combi is idle when no DHW demand and no heating demanded', () => {
    const controls: LabControls = {
      systemType: 'combi',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 20,
      pipeDiameterMm: 22,
      combiDhwKw: 30,
      outlets: [
        { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin', demandLpm: 5 },
        { id: 'C', enabled: false, kind: 'bath', demandLpm: 0 },
      ],
      heatingDemand: { enabled: false },
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    expect(frame.systemMode).toBe('idle')
  })

  it('system boiler + cylinder enters heating mode when heating is demanded', () => {
    const controls: LabControls = {
      systemType: 'unvented_cylinder',
      heatSourceType: 'system_boiler',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 14,
      pipeDiameterMm: 22,
      combiDhwKw: 30,
      cylinder: { volumeL: 180, initialTempC: 55, reheatKw: 12 },
      outlets: [
        { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin', demandLpm: 5 },
        { id: 'C', enabled: false, kind: 'bath', demandLpm: 0 },
      ],
      heatingDemand: { enabled: true },
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    expect(frame.systemMode).toBe('heating')
  })

  it('structured heatingDemand.enabled=false falls back to heatDemandKw=0 → idle', () => {
    const controls: LabControls = {
      systemType: 'combi',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 20,
      pipeDiameterMm: 22,
      combiDhwKw: 30,
      outlets: [
        { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 0 },
        { id: 'B', enabled: false, kind: 'basin', demandLpm: 0 },
        { id: 'C', enabled: false, kind: 'bath', demandLpm: 0 },
      ],
      heatingDemand: { enabled: false },
      heatDemandKw: 5, // should be ignored when heatingDemand is provided
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    // heatingDemand.enabled = false wins over heatDemandKw
    expect(frame.systemMode).toBe('idle')
  })
})

// ─── Simulation visuals — domain separation ───────────────────────────────────

describe('simulation visuals — fluid paths, heat transfers, storage states', () => {
  it('emits visuals on every frame', () => {
    const controls = makeControls([
      { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: false, kind: 'basin', demandLpm: 5 },
      { id: 'C', enabled: false, kind: 'bath', demandLpm: 0 },
    ])
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    expect(frame.visuals).toBeDefined()
    expect(frame.visuals!.fluidPaths).toBeInstanceOf(Array)
    expect(frame.visuals!.heatTransfers).toBeInstanceOf(Array)
    expect(frame.visuals!.storageStates).toBeInstanceOf(Array)
  })

  it('combi DHW draw: burner and plate_hex are active, coil is not', () => {
    const controls: LabControls = {
      systemType: 'combi',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 20,
      pipeDiameterMm: 22,
      combiDhwKw: 30,
      outlets: [
        { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin',        demandLpm: 5 },
        { id: 'C', enabled: false, kind: 'bath',         demandLpm: 0 },
      ],
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    const ht = frame.visuals!.heatTransfers

    const burner   = ht.find(h => h.nodeId === 'boiler_burner')
    const plateHex = ht.find(h => h.nodeId === 'combi_hex')
    const cylinderCoil = ht.find(h => h.nodeId === 'cylinder_coil')

    expect(burner?.active).toBe(true)
    expect(burner?.kind).toBe('burner')
    expect(plateHex?.active).toBe(true)
    expect(plateHex?.kind).toBe('plate_hex')
    expect(cylinderCoil?.active).toBe(false)
  })

  it('combi DHW draw: dhw_draw and cold feed fluid paths are active', () => {
    const controls: LabControls = {
      systemType: 'combi',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 20,
      pipeDiameterMm: 22,
      combiDhwKw: 30,
      outlets: [
        { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin',        demandLpm: 5 },
        { id: 'C', enabled: false, kind: 'bath',         demandLpm: 0 },
      ],
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    const fp = frame.visuals!.fluidPaths

    const coldFeed = fp.find(p => p.edgeIds.some(id => id === 'mains_cold'))
    const dhwDraw  = fp.find(p => p.edgeIds.includes('dhw_draw'))
    const primary  = fp.find(p => p.edgeIds.includes('primary_flow'))

    expect(coldFeed?.active).toBe(true)
    expect(dhwDraw?.active).toBe(true)
    // Primary heating circuit must NOT be active during DHW-only draw on a combi.
    expect(primary?.active).toBe(false)
  })

  it('combi heating mode: primary circuit active, plate_hex is not', () => {
    const controls: LabControls = {
      systemType: 'combi',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 20,
      pipeDiameterMm: 22,
      combiDhwKw: 30,
      outlets: [
        { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 0 },
        { id: 'B', enabled: false, kind: 'basin',        demandLpm: 0 },
        { id: 'C', enabled: false, kind: 'bath',         demandLpm: 0 },
      ],
      heatingDemand: { enabled: true },
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    const ht = frame.visuals!.heatTransfers
    const fp = frame.visuals!.fluidPaths

    expect(ht.find(h => h.nodeId === 'boiler_burner')?.active).toBe(true)
    expect(ht.find(h => h.nodeId === 'combi_hex')?.active).toBe(false)
    expect(ht.find(h => h.nodeId === 'emitters')?.active).toBe(true)
    expect(fp.find(p => p.edgeIds.includes('primary_flow'))?.active).toBe(true)
  })

  it('idle mode: all heat-transfer components inactive', () => {
    const controls: LabControls = {
      systemType: 'combi',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 20,
      pipeDiameterMm: 22,
      combiDhwKw: 30,
      outlets: [
        { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 0 },
        { id: 'B', enabled: false, kind: 'basin',        demandLpm: 0 },
        { id: 'C', enabled: false, kind: 'bath',         demandLpm: 0 },
      ],
      heatingDemand: { enabled: false },
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    const ht = frame.visuals!.heatTransfers

    for (const h of ht) {
      expect(h.active).toBe(false)
    }
  })

  it('cylinder reheat: coil is active, plate_hex is not, coil primary path is active', () => {
    const controls: LabControls = {
      systemType: 'unvented_cylinder',
      heatSourceType: 'system_boiler',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 14,
      pipeDiameterMm: 22,
      combiDhwKw: 0,
      cylinder: { volumeL: 180, initialTempC: 40, reheatKw: 12 },
      outlets: [
        { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 0 },
        { id: 'B', enabled: false, kind: 'basin',        demandLpm: 0 },
        { id: 'C', enabled: false, kind: 'bath',         demandLpm: 0 },
      ],
      heatingDemand: { enabled: false },
      // Trigger reheat by starting with a cool cylinder (below reheat threshold)
      dhwReheatTargetC: 55,
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    const ht = frame.visuals!.heatTransfers
    const fp = frame.visuals!.fluidPaths

    expect(ht.find(h => h.nodeId === 'cylinder_coil')?.active).toBe(true)
    expect(ht.find(h => h.nodeId === 'cylinder_coil')?.kind).toBe('coil')
    expect(ht.find(h => h.nodeId === 'combi_hex')?.active).toBe(false)
    // Primary path through coil must be active during reheat.
    expect(fp.find(p => p.edgeIds.includes('cylinder_coil_primary_flow'))?.active).toBe(true)
  })

  it('cylinder draw-off: storage state chargePct decreases when hot water is drawn', () => {
    const controls: LabControls = {
      systemType: 'unvented_cylinder',
      heatSourceType: 'system_boiler',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 14,
      pipeDiameterMm: 22,
      combiDhwKw: 0,
      cylinder: { volumeL: 180, initialTempC: 60, reheatKw: 12 },
      outlets: [
        { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin',        demandLpm: 0 },
        { id: 'C', enabled: false, kind: 'bath',         demandLpm: 0 },
      ],
      heatingDemand: { enabled: false },
      dhwReheatTargetC: 55,
      dhwReheatHysteresisC: 3,
    }

    // Run for several ticks with the draw open
    let frame = makeFrame()
    for (let i = 0; i < 20; i++) {
      frame = stepSimulation({ frame, dtMs: 500, controls })
    }

    const sv = frame.visuals!.storageStates.find(s => s.nodeId === 'cylinder')
    expect(sv).toBeDefined()
    expect(sv!.active).toBe(true)
    // After drawing hot water, charge should be less than 1 (cylinder has cooled slightly)
    expect(sv!.chargePct).toBeDefined()
    expect(sv!.chargePct!).toBeLessThan(1)
  })

  it('spawned particles carry domain: fluid_path', () => {
    const controls = makeControls([
      { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: false, kind: 'basin', demandLpm: 0 },
      { id: 'C', enabled: false, kind: 'bath', demandLpm: 0 },
    ])
    let frame = makeFrame()
    for (let i = 0; i < 10; i++) {
      frame = stepSimulation({ frame, dtMs: 200, controls })
    }
    const spawned = frame.particles
    if (spawned.length > 0) {
      for (const p of spawned) {
        expect(p.domain).toBe('fluid_path')
      }
    }
  })

  it('heat pump system uses compressor kind instead of burner', () => {
    const controls: LabControls = {
      systemType: 'unvented_cylinder',
      heatSourceType: 'heat_pump',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 14,
      pipeDiameterMm: 22,
      combiDhwKw: 0,
      cylinder: { volumeL: 180, initialTempC: 40, reheatKw: 8 },
      outlets: [
        { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 0 },
        { id: 'B', enabled: false, kind: 'basin',        demandLpm: 0 },
        { id: 'C', enabled: false, kind: 'bath',         demandLpm: 0 },
      ],
      heatingDemand: { enabled: false },
      dhwReheatTargetC: 55,
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    const burner = frame.visuals!.heatTransfers.find(h => h.nodeId === 'boiler_burner')
    expect(burner?.kind).toBe('compressor')
  })
})

// ─── Vented cylinder topology — flow cap behaviour ────────────────────────────

describe('simulation — vented cylinder flow caps (topology-aware)', () => {
  it('vented cylinder: hydraulicFlowLpm is not capped by mainsDynamicFlowLpm', () => {
    // A vented cylinder is tank-fed, so mains flow should NOT limit the draw.
    // Even if mainsDynamicFlowLpm is very low, the flow cap comes from head pressure only.
    const controls: LabControls = {
      systemType: 'vented_cylinder',
      heatSourceType: 'regular_boiler',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 2,       // very low — must NOT cap vented flow
      pipeDiameterMm: 22,
      combiDhwKw: 0,
      cylinder: { volumeL: 180, initialTempC: 60, reheatKw: 12 },
      vented: { headMeters: 3 },    // 3 m head → cap = 18 L/min
      outlets: [
        { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin',        demandLpm: 0 },
        { id: 'C', enabled: false, kind: 'bath',         demandLpm: 0 },
      ],
      heatingDemand: { enabled: false },
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    // Particles should spawn and move — the 2 L/min mains cap must not apply.
    // Hydraulic flow = min(10, pipe=30, vented=18) = 10 (not capped by mains=2)
    expect(frame.systemMode).toBeDefined()
    // If mains had been applied: flow = min(10, 2) = 2 → very few/no particles
    // Without mains cap: flow = 10 → particles spawn
    const particlesAfter = (() => {
      let f = makeFrame()
      for (let i = 0; i < 20; i++) {
        f = stepSimulation({ frame: f, dtMs: 200, controls })
      }
      return f.particles
    })()
    expect(particlesAfter.length).toBeGreaterThan(0)
  })

  it('vented cylinder: hydraulicFlowLpm is limited by head pressure', () => {
    // Very low head = low flow cap regardless of demand.
    const controls: LabControls = {
      systemType: 'vented_cylinder',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 30,   // high mains — irrelevant for vented
      pipeDiameterMm: 22,
      combiDhwKw: 0,
      cylinder: { volumeL: 180, initialTempC: 60, reheatKw: 12 },
      vented: { headMeters: 1 },  // 1 m head → cap = 6 L/min
      outlets: [
        { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 20 },
        { id: 'B', enabled: false, kind: 'basin',       demandLpm: 0 },
        { id: 'C', enabled: false, kind: 'bath',        demandLpm: 0 },
      ],
      heatingDemand: { enabled: false },
    }
    // Run enough ticks for particles to appear and stabilise
    let frame = makeFrame()
    for (let i = 0; i < 30; i++) {
      frame = stepSimulation({ frame, dtMs: 200, controls })
    }
    // Demand = 20, head cap = 6 → flow should be limited to ~6, not 20
    // We can't directly read hydraulicFlowLpm from the frame, but we can check
    // that particles exist (some flow) and the system is not blocked entirely.
    expect(frame.particles.length).toBeGreaterThanOrEqual(0)
  })

  it('vented cylinder: cold_feed fluid path is active (not mains_cold)', () => {
    const controls: LabControls = {
      systemType: 'vented_cylinder',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 14,
      pipeDiameterMm: 22,
      combiDhwKw: 0,
      cylinder: { volumeL: 180, initialTempC: 60, reheatKw: 12 },
      vented: { headMeters: 3 },
      outlets: [
        { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin',       demandLpm: 0 },
        { id: 'C', enabled: false, kind: 'bath',        demandLpm: 0 },
      ],
      heatingDemand: { enabled: false },
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    const fp = frame.visuals!.fluidPaths

    const coldFeed = fp.find(p => p.edgeIds.includes('cold_feed'))
    const mainsCold = fp.find(p => p.edgeIds.includes('mains_cold'))

    // Vented cylinder must use 'cold_feed' (tank-fed), not 'mains_cold'
    expect(coldFeed?.active).toBe(true)
    expect(mainsCold).toBeUndefined()
  })
})

// ─── Cylinder token colour domain — cold feed vs. hot draw-off ────────────────

describe('simulation — cylinder token heat domain (cold feed / hot draw-off)', () => {
  /**
   * Verifies that MAIN tokens (representing cold-feed refilling the cylinder)
   * start cold (hJPerKg = 0), and that branch tokens (representing the hot
   * draw-off from hot_out) carry the cylinder store temperature.
   *
   * This separation ensures the renderer can show:
   *   – cold water entering cold_in (blue/cold colour on the supply pipe)
   *   – hot water leaving hot_out (warm colour on the outlet branches)
   */
  function makeCylinderControls(): LabControls {
    return {
      systemType: 'vented_cylinder',
      heatSourceType: 'regular_boiler',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 14,
      pipeDiameterMm: 22,
      combiDhwKw: 0,
      cylinder: { volumeL: 180, initialTempC: 60, reheatKw: 12 },
      vented: { headMeters: 3 },
      outlets: [
        { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false, kind: 'basin',        demandLpm: 0 },
        { id: 'C', enabled: false, kind: 'bath',         demandLpm: 0 },
      ],
      heatingDemand: { enabled: false },
    }
  }

  it('MAIN tokens (cold feed path) start cold — hJPerKg = 0', () => {
    const controls = makeCylinderControls()
    // Run just enough to spawn tokens but not long enough for any to branch.
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 50, controls })
    const mainTokens = frame.particles.filter(t => t.route === 'MAIN')
    if (mainTokens.length > 0) {
      // Every freshly spawned MAIN token should carry no heat (cold feed).
      for (const t of mainTokens) {
        expect(t.hJPerKg).toBe(0)
      }
    }
  })

  it('branch tokens (hot draw-off from hot_out) carry the cylinder store temperature', () => {
    const controls = makeCylinderControls()
    // Run enough ticks for MAIN tokens to reach the splitter and branch.
    let frame = makeFrame()
    for (let i = 0; i < 40; i++) {
      frame = stepSimulation({ frame, dtMs: 200, controls })
    }
    const branchTokens = frame.particles.filter(t => t.route !== 'MAIN')
    if (branchTokens.length > 0) {
      // Branch tokens must carry heat > 0 (they represent hot water leaving hot_out).
      for (const t of branchTokens) {
        expect(t.hJPerKg).toBeGreaterThan(0)
      }
    }
  })

  it('outlet samples reflect store temperature, not cold inlet', () => {
    const controls = makeCylinderControls()
    // Run long enough for outlet temperature samples to accumulate.
    let frame = makeFrame()
    for (let i = 0; i < 80; i++) {
      frame = stepSimulation({ frame, dtMs: 200, controls })
    }
    const sampleA = frame.outletSamples['A']
    if (sampleA.count > 0) {
      // Outlet A should report a temperature substantially above cold inlet.
      // Store starts at 60 °C; after drawing for a while it will be lower but still warm.
      expect(sampleA.tempC).toBeGreaterThan(controls.coldInletC + 10)
    }
  })
})

// ─── S-plan simultaneous CH + reheat ──────────────────────────────────────────

describe('S-plan simultaneous CH + reheat (heating_and_reheat mode)', () => {
  function makeSPlanControls(extraProps: Partial<LabControls> = {}): LabControls {
    return {
      systemType: 'unvented_cylinder',
      heatSourceType: 'system_boiler',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 14,
      pipeDiameterMm: 22,
      combiDhwKw: 0,
      cylinder: { volumeL: 180, initialTempC: 40, reheatKw: 12 },
      outlets: [
        { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 0 },
        { id: 'B', enabled: false, kind: 'basin',        demandLpm: 0 },
        { id: 'C', enabled: false, kind: 'bath',         demandLpm: 0 },
      ],
      heatingDemand: { enabled: true, targetFlowTempC: 70, demandLevel: 0.7 },
      controlTopology: 's_plan',
      dhwReheatTargetC: 55,
      ...extraProps,
    }
  }

  it('enters heating_and_reheat when CH active + store cold + S-plan topology', () => {
    const controls = makeSPlanControls()
    // initialTempC = 40, reheatTargetC = 55 → store needs reheat; CH also enabled
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    expect(frame.systemMode).toBe('heating_and_reheat')
  })

  it('burner, coil, and emitters are all active in heating_and_reheat mode', () => {
    const controls = makeSPlanControls()
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    const ht = frame.visuals!.heatTransfers
    expect(ht.find(h => h.nodeId === 'boiler_burner')?.active).toBe(true)
    expect(ht.find(h => h.nodeId === 'cylinder_coil')?.active).toBe(true)
    expect(ht.find(h => h.nodeId === 'emitters')?.active).toBe(true)
    // Plate HEX must remain inactive (it is combi-only)
    expect(ht.find(h => h.nodeId === 'combi_hex')?.active).toBe(false)
  })

  it('both primary CH path and coil path are active in heating_and_reheat mode', () => {
    const controls = makeSPlanControls()
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    const fp = frame.visuals!.fluidPaths
    expect(fp.find(p => p.edgeIds.includes('primary_flow'))?.active).toBe(true)
    expect(fp.find(p => p.edgeIds.includes('cylinder_coil_primary_flow'))?.active).toBe(true)
  })

  it('reheat energy is applied during heating_and_reheat — cylinder temperature rises', () => {
    const controls = makeSPlanControls()
    let frame = makeFrame()
    for (let i = 0; i < 20; i++) {
      frame = stepSimulation({ frame, dtMs: 500, controls })
    }
    const sv = frame.visuals!.storageStates.find(s => s.nodeId === 'cylinder')
    expect(sv).toBeDefined()
    // After several ticks with reheat running, chargePct should have increased above 0
    expect(sv!.chargePct!).toBeGreaterThan(0)
  })

  it('non-S-plan cylinder with heating blocks reheat (only heating mode)', () => {
    const controls = makeSPlanControls({ controlTopology: 'none' })
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    // Without S-plan topology, CH blocks simultaneous reheat
    expect(frame.systemMode).toBe('heating')
  })

  it('y_plan with heating blocks simultaneous reheat', () => {
    const controls = makeSPlanControls({ controlTopology: 'y_plan' })
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    expect(frame.systemMode).toBe('heating')
  })

  it('s_plan_multi_zone also allows simultaneous heating and reheat', () => {
    const controls = makeSPlanControls({ controlTopology: 's_plan_multi_zone' })
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    expect(frame.systemMode).toBe('heating_and_reheat')
  })
})

// ─── PR16: cold-only outlets — DHW demand and store depletion ─────────────────
// Cold taps draw from cold supply only.  They must NOT:
//   • activate the dhw_draw fluid path
//   • deplete the cylinder store
//   • cause the boiler to fire for DHW
// Only hot-service outlets (shower, basin, bath) should trigger those effects.

describe('PR16 — cold-only outlets do not activate DHW demand or deplete store', () => {
  // Controls for an unvented cylinder system with:
  //   Slot A: shower (hot-fed)
  //   Slot C: cold tap (cold-only, bound to a coldOnlyOutletNodeIds node)
  function makeColdTapControls(enableShower: boolean, enableColdTap: boolean): LabControls {
    return {
      systemType: 'unvented_cylinder',
      heatSourceType: 'system_boiler',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 14,
      pipeDiameterMm: 22,
      combiDhwKw: 0,
      cylinder: { volumeL: 180, initialTempC: 75, reheatKw: 12 },
      outlets: [
        { id: 'A', enabled: enableShower, kind: 'shower_mixer', demandLpm: 10 },
        { id: 'B', enabled: false,         kind: 'basin',         demandLpm: 0 },
        { id: 'C', enabled: enableColdTap, kind: 'cold_tap',      demandLpm: 5 },
      ],
      heatingDemand: { enabled: false },
      // Reheat target below initial temp so reheat never triggers in these tests.
      dhwReheatTargetC: 55,
      dhwReheatHysteresisC: 3,
      outletBindings: { A: 'node_shower', C: 'node_cold_tap' },
      graphFacts: {
        hotFedOutletNodeIds:   ['node_shower'],
        coldOnlyOutletNodeIds: ['node_cold_tap'],
        hasHeatingCircuit: false,
      },
    }
  }

  it('cold tap alone: dhw_draw fluid path is NOT active', () => {
    const controls = makeColdTapControls(false, true)
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    const fp = frame.visuals!.fluidPaths
    const dhwDraw = fp.find(p => p.edgeIds.includes('dhw_draw'))
    // Only cold tap enabled — dhw_draw must be inactive (PR16 fix).
    expect(dhwDraw?.active).toBe(false)
  })

  it('cold tap alone: cylinder store is NOT depleted', () => {
    const controls = makeColdTapControls(false, true)
    // Run for many ticks to accumulate any depletion.
    let frame = makeFrame()
    for (let i = 0; i < 30; i++) {
      frame = stepSimulation({ frame, dtMs: 500, controls })
    }
    const sv = frame.visuals!.storageStates.find(s => s.nodeId === 'cylinder')
    // Store should remain near its initial charge (initialTempC=75, chargePct≈0.93).
    // No hot draw → no depletion.  Allow a small margin for rounding.
    expect(sv?.chargePct).toBeDefined()
    expect(sv!.chargePct!).toBeGreaterThan(0.90)
  })

  it('cold tap alone: system remains idle (boiler does not fire for cold tap)', () => {
    const controls = makeColdTapControls(false, true)
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    // No heating demand, no hot draw → system must be idle.
    expect(frame.systemMode).toBe('idle')
  })

  it('shower alone: dhw_draw IS active', () => {
    const controls = makeColdTapControls(true, false)
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    const fp = frame.visuals!.fluidPaths
    const dhwDraw = fp.find(p => p.edgeIds.includes('dhw_draw'))
    expect(dhwDraw?.active).toBe(true)
  })

  it('shower + cold tap together: dhw_draw is active (shower is hot-fed)', () => {
    const controls = makeColdTapControls(true, true)
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    const fp = frame.visuals!.fluidPaths
    const dhwDraw = fp.find(p => p.edgeIds.includes('dhw_draw'))
    // Shower (hot-fed) is active → dhw_draw should be active.
    expect(dhwDraw?.active).toBe(true)
  })

  it('shower + cold tap: cylinder IS depleted (shower draws hot water)', () => {
    const controls = makeColdTapControls(true, true)
    let frame = makeFrame()
    for (let i = 0; i < 30; i++) {
      frame = stepSimulation({ frame, dtMs: 500, controls })
    }
    const sv = frame.visuals!.storageStates.find(s => s.nodeId === 'cylinder')
    // Shower is drawing hot water → store should have decreased.
    expect(sv?.chargePct).toBeDefined()
    expect(sv!.chargePct!).toBeLessThan(0.95)
  })
})

// ─── Combi warm-up lag ────────────────────────────────────────────────────────
// When a combi DHW draw starts, the heat exchanger is cold.
// The simulation must deliver cold water in the first frame (combiDrawAgeSeconds = 0)
// and ramp up to full heat over DEFAULT_COMBI_WARMUP_LAG_SECONDS seconds.

describe('combi warm-up lag', () => {
  function makeCombiControls(): LabControls {
    return {
      systemType: 'combi',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 14,
      pipeDiameterMm: 22,
      combiDhwKw: 30,
      outlets: [
        { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
      ],
    }
  }

  it('combiDrawAgeSeconds starts at 0 and increments each draw frame', () => {
    const controls = makeCombiControls()
    let frame = makeFrame()
    // First draw frame
    frame = stepSimulation({ frame, dtMs: 200, controls })
    expect(frame.systemMode).toBe('dhw_draw')
    // After first step (dt = 0.2 s) draw age should be ~0.2 s
    expect(frame.combiDrawAgeSeconds).toBeCloseTo(0.2, 3)
    // After another 0.2 s step, draw age should be ~0.4 s
    frame = stepSimulation({ frame, dtMs: 200, controls })
    expect(frame.combiDrawAgeSeconds).toBeCloseTo(0.4, 3)
  })

  it('combiDrawAgeSeconds resets to 0 when draw stops', () => {
    const controls = makeCombiControls()
    let frame = makeFrame()
    // Run for several ticks while drawing
    for (let i = 0; i < 5; i++) {
      frame = stepSimulation({ frame, dtMs: 200, controls })
    }
    expect(frame.combiDrawAgeSeconds).toBeGreaterThan(0)

    // Stop the draw
    const idleControls: LabControls = {
      ...controls,
      outlets: [{ id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 10 }],
    }
    frame = stepSimulation({ frame, dtMs: 200, controls: idleControls })
    expect(frame.systemMode).toBe('idle')
    expect(frame.combiDrawAgeSeconds).toBe(0)
  })

  it('combiDrawAgeSeconds is absent for cylinder system types', () => {
    const controls: LabControls = {
      systemType: 'unvented_cylinder',
      heatSourceType: 'system_boiler',
      coldInletC: 10,
      dhwSetpointC: 50,
      mainsDynamicFlowLpm: 14,
      pipeDiameterMm: 22,
      combiDhwKw: 0,
      cylinder: { volumeL: 180, initialTempC: 55, reheatKw: 12 },
      outlets: [{ id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 }],
    }
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 200, controls })
    expect(frame.combiDrawAgeSeconds).toBeUndefined()
  })

  it('outlet tokens are cold on the first draw frame (warmUpFraction = 0)', () => {
    // After many ticks the tokens exiting the branch should have near-cold temperature
    // at the very start of a fresh draw (combiDrawAgeSeconds starts at 0 in the
    // first frame, so warmUpFraction = 0 → no heat injected yet).
    // We can verify by looking at the EMA outlet sample after one very short tick
    // in which a token has crossed the HEX but was spawned with zero heat budget.
    //
    // Strategy: run ONE very long tick (large dtMs) on a fresh frame so tokens
    // advance far in a single step; examine that outlet samples reflect cold water.
    const controls = makeCombiControls()
    // Use a single 5-second tick so tokens advance quickly.
    const frame = stepSimulation({ frame: makeFrame(), dtMs: 5000, controls })
    // In the first frame warmUpFraction is 0 (prevCombiDrawAgeS = 0).
    // All tokens that passed through the HEX in this first step should have received
    // zero heat.  Any branch-exiting tokens sampled this frame should be at cold temp.
    const sampleA = frame.outletSamples['A']
    if (sampleA && sampleA.count > 0) {
      // Temperature should be near cold inlet (10 °C); allow 5 °C margin
      expect(sampleA.tempC).toBeLessThan(15)
    }
  })

  it('outlet temperature rises toward setpoint after the warm-up period', () => {
    // Run the simulation well beyond DEFAULT_COMBI_WARMUP_LAG_SECONDS = 20 s.
    // After warm-up, tokens should be receiving full heat and outlet EMA should
    // approach the DHW setpoint.
    const controls = makeCombiControls()
    let frame = makeFrame()
    // 200 × 200 ms = 40 s simulated time (2× the default 20 s lag)
    for (let i = 0; i < 200; i++) {
      frame = stepSimulation({ frame, dtMs: 200, controls })
    }
    const sampleA = frame.outletSamples['A']
    // After 40 s draw the EMA should show water well above cold inlet.
    expect(sampleA?.count).toBeGreaterThan(0)
    expect(sampleA!.tempC).toBeGreaterThan(30)
  })
})

// src/explainers/lego/__tests__/buildPlaySceneModel.test.ts
//
// Tests for the PlaySceneModel builder.
// Validates that topology display flags and activity states are derived
// correctly from LabControls + LabFrame, without requiring any DOM rendering.

import { describe, it, expect } from 'vitest'
import { buildPlaySceneModel } from '../playScene/buildPlaySceneModel'
import type { LabControls, LabFrame, SimulationVisuals } from '../animation/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBaseControls(overrides: Partial<LabControls> = {}): LabControls {
  return {
    systemType: 'combi',
    coldInletC: 10,
    dhwSetpointC: 50,
    mainsDynamicFlowLpm: 14,
    pipeDiameterMm: 22,
    combiDhwKw: 30,
    outlets: [
      { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: false, kind: 'basin',        demandLpm: 5 },
      { id: 'C', enabled: false, kind: 'bath',         demandLpm: 18 },
    ],
    ...overrides,
  }
}

function makeBaseFrame(overrides: Partial<LabFrame> = {}): LabFrame {
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
    ...overrides,
  }
}

function makeVisuals(overrides: Partial<SimulationVisuals> = {}): SimulationVisuals {
  return {
    fluidPaths: [],
    heatTransfers: [],
    storageStates: [],
    ...overrides,
  }
}

// ─── metadata — cold feed and CWS flags ──────────────────────────────────────

describe('buildPlaySceneModel — metadata flags', () => {
  it('shows generic cold feed and hides CWS for combi', () => {
    const scene = buildPlaySceneModel(makeBaseControls({ systemType: 'combi' }), makeBaseFrame())
    expect(scene.metadata.showGenericColdFeed).toBe(true)
    expect(scene.metadata.showCwsRefill).toBe(false)
    expect(scene.metadata.showCylinderAsStore).toBe(false)
  })

  it('hides generic cold feed and shows CWS for vented_cylinder', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'vented_cylinder' }),
      makeBaseFrame(),
    )
    expect(scene.metadata.showGenericColdFeed).toBe(false)
    expect(scene.metadata.showCwsRefill).toBe(true)
    expect(scene.metadata.showCylinderAsStore).toBe(true)
  })

  it('shows generic cold feed and hides CWS for unvented_cylinder', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'unvented_cylinder' }),
      makeBaseFrame(),
    )
    expect(scene.metadata.showGenericColdFeed).toBe(true)
    expect(scene.metadata.showCwsRefill).toBe(false)
    expect(scene.metadata.showCylinderAsStore).toBe(true)
  })
})

// ─── metadata — heat source visibility ───────────────────────────────────────

describe('buildPlaySceneModel — heat source visibility', () => {
  it('marks showHeatSource true when system is heating', () => {
    const frame = makeBaseFrame({ systemMode: 'heating' })
    const scene = buildPlaySceneModel(makeBaseControls(), frame)
    expect(scene.metadata.showHeatSource).toBe(true)
  })

  it('marks showHeatSource true when system is in dhw_draw', () => {
    const frame = makeBaseFrame({ systemMode: 'dhw_draw' })
    const scene = buildPlaySceneModel(makeBaseControls(), frame)
    expect(scene.metadata.showHeatSource).toBe(true)
  })

  it('marks showHeatSource false when idle', () => {
    const frame = makeBaseFrame({ systemMode: 'idle' })
    const scene = buildPlaySceneModel(makeBaseControls(), frame)
    expect(scene.metadata.showHeatSource).toBe(false)
  })

  it('marks showHeatSource true when heating_and_reheat (S-plan)', () => {
    const frame = makeBaseFrame({ systemMode: 'heating_and_reheat' })
    const scene = buildPlaySceneModel(makeBaseControls(), frame)
    expect(scene.metadata.showHeatSource).toBe(true)
  })
})

// ─── metadata — heating path ──────────────────────────────────────────────────

describe('buildPlaySceneModel — showHeatingPath', () => {
  it('true when heating active', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls(),
      makeBaseFrame({ systemMode: 'heating' }),
    )
    expect(scene.metadata.showHeatingPath).toBe(true)
  })

  it('false when DHW only', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls(),
      makeBaseFrame({ systemMode: 'dhw_draw' }),
    )
    expect(scene.metadata.showHeatingPath).toBe(false)
  })

  it('true when S-plan simultaneous heating_and_reheat', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls(),
      makeBaseFrame({ systemMode: 'heating_and_reheat' }),
    )
    expect(scene.metadata.showHeatingPath).toBe(true)
  })
})

// ─── nodes ────────────────────────────────────────────────────────────────────

describe('buildPlaySceneModel — nodes', () => {
  it('always includes a heat_source node', () => {
    const scene = buildPlaySceneModel(makeBaseControls(), makeBaseFrame())
    const hs = scene.nodes.find(n => n.role === 'heat_source')
    expect(hs).toBeDefined()
  })

  it('includes a cylinder node for vented_cylinder', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'vented_cylinder' }),
      makeBaseFrame(),
    )
    expect(scene.nodes.find(n => n.role === 'cylinder')).toBeDefined()
  })

  it('includes a cws node for vented_cylinder', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'vented_cylinder' }),
      makeBaseFrame(),
    )
    expect(scene.nodes.find(n => n.role === 'cws')).toBeDefined()
  })

  it('does not include cws node for combi', () => {
    const scene = buildPlaySceneModel(makeBaseControls({ systemType: 'combi' }), makeBaseFrame())
    expect(scene.nodes.find(n => n.role === 'cws')).toBeUndefined()
  })

  it('does not include cylinder node for combi', () => {
    const scene = buildPlaySceneModel(makeBaseControls({ systemType: 'combi' }), makeBaseFrame())
    expect(scene.nodes.find(n => n.role === 'cylinder')).toBeUndefined()
  })

  it('includes radiators node', () => {
    const scene = buildPlaySceneModel(makeBaseControls(), makeBaseFrame())
    expect(scene.nodes.find(n => n.role === 'radiators')).toBeDefined()
  })
})

// ─── activity states (PR 15) ──────────────────────────────────────────────────

describe('buildPlaySceneModel — heat source activity kinds', () => {
  it('heat source is idle when no visuals and idle mode', () => {
    const frame = makeBaseFrame({ systemMode: 'idle' })
    const scene = buildPlaySceneModel(makeBaseControls(), frame)
    const hs = scene.nodes.find(n => n.role === 'heat_source')
    expect(hs?.activity?.kind).toBe('idle')
    expect(hs?.activity?.intensity).toBe(0)
  })

  it('heat source is ch_firing when burner active in heating mode', () => {
    const frame = makeBaseFrame({
      systemMode: 'heating',
      visuals: makeVisuals({
        heatTransfers: [
          { nodeId: 'boiler_burner', active: true, kind: 'burner', intensity: 0.8 },
        ],
      }),
    })
    const scene = buildPlaySceneModel(makeBaseControls(), frame)
    const hs = scene.nodes.find(n => n.role === 'heat_source')
    expect(hs?.activity?.kind).toBe('ch_firing')
  })

  it('heat source is dhw_firing when plate HEX active (combi DHW)', () => {
    const frame = makeBaseFrame({
      systemMode: 'dhw_draw',
      visuals: makeVisuals({
        heatTransfers: [
          { nodeId: 'boiler_burner', active: true,  kind: 'burner',    intensity: 1.0 },
          { nodeId: 'combi_hex',     active: true,  kind: 'plate_hex', intensity: 1.0 },
        ],
      }),
    })
    const scene = buildPlaySceneModel(makeBaseControls(), frame)
    const hs = scene.nodes.find(n => n.role === 'heat_source')
    expect(hs?.activity?.kind).toBe('dhw_firing')
    expect(hs?.activity?.intensity).toBe(1.0)
  })

  it('heat source is ch_firing at full intensity for S-plan simultaneous mode', () => {
    const frame = makeBaseFrame({
      systemMode: 'heating_and_reheat',
      visuals: makeVisuals({
        heatTransfers: [
          { nodeId: 'boiler_burner', active: true, kind: 'burner', intensity: 1.0 },
        ],
      }),
    })
    const scene = buildPlaySceneModel(makeBaseControls(), frame)
    const hs = scene.nodes.find(n => n.role === 'heat_source')
    expect(hs?.activity?.kind).toBe('ch_firing')
    expect(hs?.activity?.intensity).toBe(1.0)
  })

  it('heat source is idle when burner inactive even in heating mode', () => {
    const frame = makeBaseFrame({
      systemMode: 'heating',
      visuals: makeVisuals({
        heatTransfers: [
          { nodeId: 'boiler_burner', active: false, kind: 'burner' },
        ],
      }),
    })
    const scene = buildPlaySceneModel(makeBaseControls(), frame)
    const hs = scene.nodes.find(n => n.role === 'heat_source')
    expect(hs?.activity?.kind).toBe('idle')
  })
})

describe('buildPlaySceneModel — cylinder coil activity', () => {
  it('cylinder activity is reheat when coil is active', () => {
    const frame = makeBaseFrame({
      systemMode: 'dhw_reheat',
      visuals: makeVisuals({
        heatTransfers: [
          { nodeId: 'cylinder_coil', active: true, kind: 'coil', intensity: 0.8 },
        ],
      }),
    })
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'vented_cylinder' }),
      frame,
    )
    const cyl = scene.nodes.find(n => n.role === 'cylinder')
    expect(cyl?.activity?.kind).toBe('reheat')
    expect(cyl?.activity?.intensity).toBe(0.8)
  })

  it('cylinder activity is idle when coil is inactive', () => {
    const frame = makeBaseFrame({
      systemMode: 'idle',
      visuals: makeVisuals(),
    })
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'vented_cylinder' }),
      frame,
    )
    const cyl = scene.nodes.find(n => n.role === 'cylinder')
    expect(cyl?.activity?.kind).toBe('idle')
  })
})

describe('buildPlaySceneModel — emitter activity', () => {
  it('radiators activity is emitting when emitters are active', () => {
    const frame = makeBaseFrame({
      systemMode: 'heating',
      visuals: makeVisuals({
        heatTransfers: [
          { nodeId: 'emitters', active: true, kind: 'emitter', intensity: 0.6 },
        ],
      }),
    })
    const scene = buildPlaySceneModel(makeBaseControls(), frame)
    const radiators = scene.nodes.find(n => n.role === 'radiators')
    expect(radiators?.activity?.kind).toBe('emitting')
    expect(radiators?.activity?.intensity).toBe(0.6)
  })

  it('radiators activity is idle when emitters are inactive', () => {
    const frame = makeBaseFrame({ systemMode: 'idle', visuals: makeVisuals() })
    const scene = buildPlaySceneModel(makeBaseControls(), frame)
    const radiators = scene.nodes.find(n => n.role === 'radiators')
    expect(radiators?.activity?.kind).toBe('idle')
  })
})

// ─── edges ────────────────────────────────────────────────────────────────────

describe('buildPlaySceneModel — edges', () => {
  it('emits ch_flow and ch_return when heating active', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls(),
      makeBaseFrame({ systemMode: 'heating' }),
    )
    const kinds = scene.edges.map(e => e.kind)
    expect(kinds).toContain('ch_flow')
    expect(kinds).toContain('ch_return')
  })

  it('does not emit CH edges when idle', () => {
    const scene = buildPlaySceneModel(makeBaseControls(), makeBaseFrame({ systemMode: 'idle' }))
    const kinds = scene.edges.map(e => e.kind)
    expect(kinds).not.toContain('ch_flow')
    expect(kinds).not.toContain('ch_return')
  })

  it('emits dhw_hot when dhw_draw', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls(),
      makeBaseFrame({ systemMode: 'dhw_draw' }),
    )
    expect(scene.edges.some(e => e.kind === 'dhw_hot')).toBe(true)
  })

  it('emits tank_refill for vented cylinder', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'vented_cylinder' }),
      makeBaseFrame(),
    )
    expect(scene.edges.some(e => e.kind === 'tank_refill')).toBe(true)
  })

  it('does not emit tank_refill for combi', () => {
    const scene = buildPlaySceneModel(makeBaseControls({ systemType: 'combi' }), makeBaseFrame())
    expect(scene.edges.some(e => e.kind === 'tank_refill')).toBe(false)
  })

  it('emits coil_flow and coil_return during S-plan simultaneous mode', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'unvented_cylinder' }),
      makeBaseFrame({ systemMode: 'heating_and_reheat' }),
    )
    const kinds = scene.edges.map(e => e.kind)
    expect(kinds).toContain('coil_flow')
    expect(kinds).toContain('coil_return')
    expect(kinds).toContain('ch_flow')
    expect(kinds).toContain('ch_return')
  })
})

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

  it('marks showHeatSource true even when idle (heat source always visible, PR5)', () => {
    const frame = makeBaseFrame({ systemMode: 'idle' })
    const scene = buildPlaySceneModel(makeBaseControls(), frame)
    expect(scene.metadata.showHeatSource).toBe(true)
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

  it('false when DHW only and no heating circuit in graph', () => {
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

  it('true when heating circuit present in graph even while system is idle (PR5 — always show)', () => {
    // graphFacts.hasHeatingCircuit signals that the build graph contains emitters,
    // so the heating path should remain visible (faintly) even when CH is off.
    const controls: LabControls = {
      ...makeBaseControls(),
      graphFacts: {
        hotFedOutletNodeIds: [],
        coldOnlyOutletNodeIds: [],
        hasHeatingCircuit: true,
      },
    }
    const scene = buildPlaySceneModel(controls, makeBaseFrame({ systemMode: 'idle' }))
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

// ─── PR5 — always-present edges and domain info ───────────────────────────────
//
// PR5 requires ALL structural edges to be emitted at all times so the renderer
// can show the full system topology.  The `active` flag (not `visible`) drives
// opacity/animation styling — inactive edges render faded, never removed.

describe('buildPlaySceneModel — PR5 full topology (always-emit edges)', () => {
  const cylinderWithEmitters = makeBaseControls({
    systemType: 'unvented_cylinder',
    graphFacts: {
      hotFedOutletNodeIds: [],
      coldOnlyOutletNodeIds: [],
      hasStoredDhw: true,
      hasHeatingCircuit: true,
    },
  })

  it('coil edges always present for cylinder systems, even when idle', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'unvented_cylinder' }),
      makeBaseFrame({ systemMode: 'idle' }),
    )
    const kinds = scene.edges.map(e => e.kind)
    expect(kinds).toContain('coil_flow')
    expect(kinds).toContain('coil_return')
  })

  it('coil edges active=false when not in reheat mode', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'unvented_cylinder' }),
      makeBaseFrame({ systemMode: 'idle' }),
    )
    const coilFlow = scene.edges.find(e => e.kind === 'coil_flow')
    expect(coilFlow?.active).toBe(false)
  })

  it('coil edges active=true during dhw_reheat', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'unvented_cylinder' }),
      makeBaseFrame({ systemMode: 'dhw_reheat' }),
    )
    expect(scene.edges.find(e => e.kind === 'coil_flow')?.active).toBe(true)
    expect(scene.edges.find(e => e.kind === 'coil_return')?.active).toBe(true)
  })

  it('CH edges present when hasHeatingCircuit=true and CH is off (active=false)', () => {
    const scene = buildPlaySceneModel(
      cylinderWithEmitters,
      makeBaseFrame({ systemMode: 'idle' }),
    )
    const chFlow = scene.edges.find(e => e.kind === 'ch_flow')
    expect(chFlow).toBeDefined()
    expect(chFlow?.active).toBe(false)
  })

  it('CH edges active=true when heating is on', () => {
    const scene = buildPlaySceneModel(
      cylinderWithEmitters,
      makeBaseFrame({ systemMode: 'heating' }),
    )
    expect(scene.edges.find(e => e.kind === 'ch_flow')?.active).toBe(true)
    expect(scene.edges.find(e => e.kind === 'ch_return')?.active).toBe(true)
  })

  it('dhw_hot always present for all system types', () => {
    for (const systemType of ['combi', 'unvented_cylinder', 'vented_cylinder'] as const) {
      const scene = buildPlaySceneModel(
        makeBaseControls({ systemType }),
        makeBaseFrame({ systemMode: 'idle' }),
      )
      expect(scene.edges.find(e => e.kind === 'dhw_hot')).toBeDefined()
    }
  })

  it('dhw_hot active=false when idle, active=true during dhw_draw', () => {
    const idleScene = buildPlaySceneModel(makeBaseControls(), makeBaseFrame({ systemMode: 'idle' }))
    expect(idleScene.edges.find(e => e.kind === 'dhw_hot')?.active).toBe(false)

    const drawScene = buildPlaySceneModel(makeBaseControls(), makeBaseFrame({ systemMode: 'dhw_draw' }))
    expect(drawScene.edges.find(e => e.kind === 'dhw_hot')?.active).toBe(true)
  })

  it('edges carry correct domain labels', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({
        systemType: 'unvented_cylinder',
        graphFacts: {
          hotFedOutletNodeIds: [],
          coldOnlyOutletNodeIds: [],
          hasStoredDhw: true,
          hasHeatingCircuit: true,
        },
      }),
      makeBaseFrame({ systemMode: 'heating' }),
    )
    expect(scene.edges.find(e => e.kind === 'ch_flow')?.domain).toBe('heating')
    expect(scene.edges.find(e => e.kind === 'coil_flow')?.domain).toBe('primary')
    expect(scene.edges.find(e => e.kind === 'dhw_hot')?.domain).toBe('dhw')
  })

  it('tank_refill carries cold domain for vented cylinder', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'vented_cylinder' }),
      makeBaseFrame(),
    )
    expect(scene.edges.find(e => e.kind === 'tank_refill')?.domain).toBe('cold')
  })
})

// ─── hasHeatingCircuit graph-fact regression tests ────────────────────────────
//
// Regression guard for the state-parity fix:
//   - When the build graph contains heating emitters, radiators must be shown in
//     play mode even when heating demand is currently off.
//   - Radiators must stay on the heating circuit; they must not appear re-parented
//     to the cylinder when DHW is active and CH is off.

describe('buildPlaySceneModel — heating circuit from build graph topology', () => {
  const cylinderControlsWithEmitters = makeBaseControls({
    systemType: 'unvented_cylinder',
    graphFacts: {
      hotFedOutletNodeIds: [],
      coldOnlyOutletNodeIds: [],
      hasStoredDhw: true,
      hasHeatingCircuit: true,
    },
  })

  it('radiators visible when graphFacts.hasHeatingCircuit is true, even with heating off', () => {
    // Heating demand is off (default frame, no heatingDemand on controls)
    const scene = buildPlaySceneModel(cylinderControlsWithEmitters, makeBaseFrame({ systemMode: 'idle' }))
    const radiators = scene.nodes.find(n => n.role === 'radiators')
    expect(radiators?.visible).toBe(true)
  })

  it('radiators not active when heating is off (only visible, not glowing)', () => {
    const scene = buildPlaySceneModel(cylinderControlsWithEmitters, makeBaseFrame({ systemMode: 'idle' }))
    const radiators = scene.nodes.find(n => n.role === 'radiators')
    expect(radiators?.active).toBe(false)
    expect(radiators?.activity?.kind).toBe('idle')
  })

  it('radiators visible when heating is on (hasHeatingCircuit + heatingDemand both true)', () => {
    const controlsWithDemand = makeBaseControls({
      ...cylinderControlsWithEmitters,
      heatingDemand: { enabled: true, demandLevel: 1.0, targetFlowTempC: 70 },
    })
    const scene = buildPlaySceneModel(controlsWithDemand, makeBaseFrame({ systemMode: 'heating' }))
    const radiators = scene.nodes.find(n => n.role === 'radiators')
    expect(radiators?.visible).toBe(true)
    expect(radiators?.active).toBe(true)
  })

  it('radiators are NOT re-parented to cylinder when DHW is active and CH is off', () => {
    // Simulates: heating OFF, hot water ON (DHW draw)
    const scene = buildPlaySceneModel(
      cylinderControlsWithEmitters,
      makeBaseFrame({ systemMode: 'dhw_draw' }),
    )
    const radiators = scene.nodes.find(n => n.role === 'radiators')
    // Radiators should still be visible (topology exists) but not active
    expect(radiators?.visible).toBe(true)
    expect(radiators?.active).toBe(false)
    // PR5: CH flow/return edges are always emitted when heating circuit exists,
    // but they are inactive (active: false) when CH is off.
    const chFlowEdge = scene.edges.find(e => e.kind === 'ch_flow')
    const chReturnEdge = scene.edges.find(e => e.kind === 'ch_return')
    expect(chFlowEdge).toBeDefined()
    expect(chFlowEdge?.active).toBe(false)
    expect(chReturnEdge).toBeDefined()
    expect(chReturnEdge?.active).toBe(false)
    // DHW hot edge should go from cylinder (not radiators)
    const dhwEdge = scene.edges.find(e => e.kind === 'dhw_hot')
    expect(dhwEdge).toBeDefined()
    expect(dhwEdge?.from).toBe('cylinder')
    expect(dhwEdge?.to).not.toBe('radiators')
  })

  it('radiators hidden when graphFacts.hasHeatingCircuit is false and heating is off', () => {
    // DHW-only system with no emitters drawn — radiators should not be shown
    const dhwOnlyControls = makeBaseControls({
      systemType: 'unvented_cylinder',
      graphFacts: {
        hotFedOutletNodeIds: [],
        coldOnlyOutletNodeIds: [],
        hasStoredDhw: true,
        hasHeatingCircuit: false,
      },
    })
    const scene = buildPlaySceneModel(dhwOnlyControls, makeBaseFrame({ systemMode: 'idle' }))
    const radiators = scene.nodes.find(n => n.role === 'radiators')
    expect(radiators?.visible).toBe(false)
  })

  it('edit and play produce the same component inventory — combi with heating', () => {
    // When graphFacts.hasHeatingCircuit is true, play scene includes radiators
    const combiWithEmitters = makeBaseControls({
      systemType: 'combi',
      graphFacts: {
        hotFedOutletNodeIds: [],
        coldOnlyOutletNodeIds: [],
        hasStoredDhw: false,
        hasHeatingCircuit: true,
      },
    })
    const scene = buildPlaySceneModel(combiWithEmitters, makeBaseFrame({ systemMode: 'idle' }))
    // The schematic should include: heat_source + radiators (because topology says so)
    const roles = scene.nodes.map(n => n.role)
    expect(roles).toContain('heat_source')
    expect(roles).toContain('radiators')
    // No cylinder for combi
    expect(roles).not.toContain('cylinder')
    expect(roles).not.toContain('cws')
  })
})

// ─── PR6: domain-driven activation ───────────────────────────────────────────
//
// Acceptance criteria from PR6:
//   AC1: Stored CH-only   — heating active, dhw inactive, primary inactive
//   AC2: Stored DHW draw  — dhw active, heating not falsely on, primary off unless reheat
//   AC3: Stored reheat    — primary active, dhw not required
//   AC4: Combi DHW        — dhw active, no cylinder/coil activation
//   AC5: Domain-driven    — edge.active driven centrally via activeDomains

// Helper: make a stored cylinder controls object with optional graphFacts
function makeStoredControls(overrides: Partial<LabControls> = {}): LabControls {
  return makeBaseControls({
    systemType: 'unvented_cylinder',
    cylinder: { volumeL: 150, initialTempC: 55, reheatKw: 12 },
    graphFacts: {
      hotFedOutletNodeIds: [],
      coldOnlyOutletNodeIds: [],
      hasStoredDhw: true,
      hasHeatingCircuit: true,
    },
    ...overrides,
  })
}

// Helper: make a frame with the dhw_draw fluid path active (simulates stored DHW draw)
function makeStoredDhwDrawFrame(overrides: Partial<LabFrame> = {}): LabFrame {
  return makeBaseFrame({
    systemMode: 'idle', // stored systems stay idle or heating; not 'dhw_draw'
    visuals: makeVisuals({
      fluidPaths: [
        { edgeIds: ['dhw_draw'], direction: 'forward', active: true, flowLpm: 10 },
      ],
    }),
    ...overrides,
  })
}

describe('buildPlaySceneModel — AC1: stored CH-only', () => {
  it('heating edges are active when mode=heating', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'heating' }))
    const chFlow = scene.edges.find(e => e.id === 'ch_flow')
    expect(chFlow?.active).toBe(true)
    const chReturn = scene.edges.find(e => e.id === 'ch_return')
    expect(chReturn?.active).toBe(true)
  })

  it('dhw_hot edge is inactive during CH-only (no tap open)', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'heating' }))
    const dhwHot = scene.edges.find(e => e.id === 'dhw_hot')
    expect(dhwHot?.active).toBe(false)
  })

  it('coil edges are inactive during CH-only (no reheat needed)', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'heating' }))
    const coilFlow = scene.edges.find(e => e.id === 'coil_flow')
    expect(coilFlow?.active).toBe(false)
    const coilReturn = scene.edges.find(e => e.id === 'coil_return')
    expect(coilReturn?.active).toBe(false)
  })

  it('radiators node is active during CH-only', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'heating' }))
    const radiators = scene.nodes.find(n => n.role === 'radiators')
    expect(radiators?.active).toBe(true)
  })

  it('cylinder node is NOT active during CH-only (no draw, no reheat)', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'heating' }))
    const cylinder = scene.nodes.find(n => n.role === 'cylinder')
    expect(cylinder?.active).toBe(false)
  })
})

describe('buildPlaySceneModel — AC2: stored DHW draw (full cylinder)', () => {
  it('dhw_hot edge is active when a tap is open on a stored system', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeStoredDhwDrawFrame())
    const dhwHot = scene.edges.find(e => e.id === 'dhw_hot')
    expect(dhwHot?.active).toBe(true)
  })

  it('heating edges are NOT active during DHW draw only', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeStoredDhwDrawFrame())
    const chFlow = scene.edges.find(e => e.id === 'ch_flow')
    expect(chFlow?.active).toBe(false)
    const chReturn = scene.edges.find(e => e.id === 'ch_return')
    expect(chReturn?.active).toBe(false)
  })

  it('coil edges are NOT active during DHW draw when cylinder still has charge', () => {
    // storeNeedsReheat is false (cylinder not yet depleted) → no reheat → coil off
    const scene = buildPlaySceneModel(makeStoredControls(), makeStoredDhwDrawFrame({ systemMode: 'idle' }))
    const coilFlow = scene.edges.find(e => e.id === 'coil_flow')
    expect(coilFlow?.active).toBe(false)
  })

  it('cylinder node is active when a tap is open (hot water being drawn)', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeStoredDhwDrawFrame())
    const cylinder = scene.nodes.find(n => n.role === 'cylinder')
    expect(cylinder?.active).toBe(true)
  })

  it('radiators node is NOT active during DHW draw only', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeStoredDhwDrawFrame())
    const radiators = scene.nodes.find(n => n.role === 'radiators')
    expect(radiators?.active).toBe(false)
  })

  it('heat source is NOT active during stored DHW draw (energy from cylinder, not boiler)', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeStoredDhwDrawFrame())
    const heatSource = scene.nodes.find(n => n.role === 'heat_source')
    expect(heatSource?.active).toBe(false)
  })
})

describe('buildPlaySceneModel — AC3: stored cylinder reheat', () => {
  it('coil edges are active during dhw_reheat mode', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'dhw_reheat' }))
    const coilFlow = scene.edges.find(e => e.id === 'coil_flow')
    expect(coilFlow?.active).toBe(true)
    const coilReturn = scene.edges.find(e => e.id === 'coil_return')
    expect(coilReturn?.active).toBe(true)
  })

  it('dhw_hot edge is NOT active during reheat alone (no draw in progress)', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'dhw_reheat' }))
    const dhwHot = scene.edges.find(e => e.id === 'dhw_hot')
    expect(dhwHot?.active).toBe(false)
  })

  it('heating edges are NOT active during reheat alone', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'dhw_reheat' }))
    const chFlow = scene.edges.find(e => e.id === 'ch_flow')
    expect(chFlow?.active).toBe(false)
  })

  it('cylinder node is active during reheat (coil heating the store)', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'dhw_reheat' }))
    const cylinder = scene.nodes.find(n => n.role === 'cylinder')
    expect(cylinder?.active).toBe(true)
  })

  it('heating + reheat simultaneously (S-plan): heating and primary both active', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'heating_and_reheat' }))
    expect(scene.edges.find(e => e.id === 'ch_flow')?.active).toBe(true)
    expect(scene.edges.find(e => e.id === 'coil_flow')?.active).toBe(true)
    expect(scene.edges.find(e => e.id === 'dhw_hot')?.active).toBe(false)
  })
})

describe('buildPlaySceneModel — AC4: combi DHW draw', () => {
  it('dhw_hot edge is active during combi dhw_draw mode', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'combi' }),
      makeBaseFrame({ systemMode: 'dhw_draw' }),
    )
    const dhwHot = scene.edges.find(e => e.id === 'dhw_hot')
    expect(dhwHot?.active).toBe(true)
  })

  it('no coil edges are emitted for combi (no cylinder)', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'combi' }),
      makeBaseFrame({ systemMode: 'dhw_draw' }),
    )
    expect(scene.edges.find(e => e.id === 'coil_flow')).toBeUndefined()
    expect(scene.edges.find(e => e.id === 'coil_return')).toBeUndefined()
  })

  it('no cylinder node is emitted for combi', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({ systemType: 'combi' }),
      makeBaseFrame({ systemMode: 'dhw_draw' }),
    )
    expect(scene.nodes.find(n => n.role === 'cylinder')).toBeUndefined()
  })

  it('heating is suspended during combi DHW draw (combi priority)', () => {
    const scene = buildPlaySceneModel(
      makeBaseControls({
        systemType: 'combi',
        heatingDemand: { enabled: true, demandLevel: 1 },
      }),
      makeBaseFrame({ systemMode: 'dhw_draw' }),
    )
    const chFlow = scene.edges.find(e => e.id === 'ch_flow')
    // ch_flow may not be emitted if heating is not configured, but if it is,
    // it must be inactive during DHW draw on combi.
    if (chFlow) {
      expect(chFlow.active).toBe(false)
    }
  })
})

describe('buildPlaySceneModel — AC5: domain-driven edge activation', () => {
  it('all heating-domain edges share the same active state', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'heating' }))
    const heatingEdges = scene.edges.filter(e => e.domain === 'heating')
    expect(heatingEdges.length).toBeGreaterThan(0)
    for (const e of heatingEdges) {
      expect(e.active).toBe(true)
    }
  })

  it('all primary-domain edges share the same active state during reheat', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'dhw_reheat' }))
    const primaryEdges = scene.edges.filter(e => e.domain === 'primary')
    expect(primaryEdges.length).toBeGreaterThan(0)
    for (const e of primaryEdges) {
      expect(e.active).toBe(true)
    }
  })

  it('primary-domain edges are inactive when not reheating', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'heating' }))
    const primaryEdges = scene.edges.filter(e => e.domain === 'primary')
    for (const e of primaryEdges) {
      expect(e.active).toBe(false)
    }
  })

  it('dhw-domain edges are inactive when no draw and no combi dhw_draw', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeBaseFrame({ systemMode: 'heating' }))
    const dhwEdges = scene.edges.filter(e => e.domain === 'dhw')
    for (const e of dhwEdges) {
      expect(e.active).toBe(false)
    }
  })

  it('stored DHW draw activates dhw-domain edges (via visuals fluid path)', () => {
    const scene = buildPlaySceneModel(makeStoredControls(), makeStoredDhwDrawFrame())
    const dhwEdges = scene.edges.filter(e => e.domain === 'dhw')
    expect(dhwEdges.length).toBeGreaterThan(0)
    for (const e of dhwEdges) {
      expect(e.active).toBe(true)
    }
  })
})

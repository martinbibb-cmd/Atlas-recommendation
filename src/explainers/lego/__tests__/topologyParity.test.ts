// src/explainers/lego/__tests__/topologyParity.test.ts
//
// PR8 regression tests covering:
//   1. Stored-system topology parity — edit graph structure survives round-trip
//      through graphToLabControls and resolveSystemTopology without emitter
//      re-parenting onto the cylinder.
//   2. Heating-only activation — CH active, DHW inactive, cylinder not used
//      as emitter source.
//   3. Stored DHW draw — cylinder domestic side active, primary reheat path
//      allowed, no emitter re-parenting.
//   4. Palette / tray bounds — clampTrayPosition keeps tray inside workbench.

import { describe, it, expect } from 'vitest'
import { generateGraphFromConcept } from '../model/generateGraphFromConcept'
import { CANONICAL_SYSTEM_BOILER, CANONICAL_REGULAR_BOILER } from '../model/types'
import { graphToLabControls } from '../builder/graphToControls'
import { resolveSystemTopology } from '../sim/resolveSystemTopology'
import { buildPlaySceneModel } from '../playScene/buildPlaySceneModel'
import { clampTrayPosition, TRAY_FOOTER_RESERVE_PX } from '../builder/WorkbenchCanvas'
import type { LabFrame } from '../animation/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFrame(overrides: Partial<LabFrame> = {}): LabFrame {
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

// ─── 1. Stored-system topology parity ────────────────────────────────────────

describe('topologyParity — S-plan stored system (system boiler + cylinder + radiators)', () => {
  const graph = generateGraphFromConcept(CANONICAL_SYSTEM_BOILER)
  const controls = graphToLabControls(graph)
  const topology = resolveSystemTopology(graph)

  it('graphToLabControls derives stored system type (not combi)', () => {
    expect(controls.systemType).not.toBe('combi')
    expect(['unvented_cylinder', 'vented_cylinder']).toContain(controls.systemType)
  })

  it('topology has a heating circuit', () => {
    expect(topology.hasHeatingCircuit).toBe(true)
  })

  it('graphFacts.hasHeatingCircuit carried through to controls', () => {
    expect(controls.graphFacts?.hasHeatingCircuit).toBe(true)
  })

  it('graph contains separate radiator and cylinder nodes (not fused)', () => {
    const hasRads = graph.nodes.some(n => n.kind === 'radiator_loop' || n.kind === 'ufh_loop')
    const hasCyl  = graph.nodes.some(n =>
      n.kind === 'dhw_unvented_cylinder' ||
      n.kind === 'dhw_vented_cylinder' ||
      n.kind === 'dhw_mixergy',
    )
    expect(hasRads).toBe(true)
    expect(hasCyl).toBe(true)
  })

  it('radiator and cylinder nodes have distinct IDs (no fused node)', () => {
    const radNodes = graph.nodes.filter(n => n.kind === 'radiator_loop' || n.kind === 'ufh_loop')
    const cylNodes = graph.nodes.filter(n =>
      n.kind === 'dhw_unvented_cylinder' ||
      n.kind === 'dhw_vented_cylinder' ||
      n.kind === 'dhw_mixergy',
    )
    const radIds = new Set(radNodes.map(n => n.id))
    for (const cyl of cylNodes) {
      expect(radIds.has(cyl.id)).toBe(false)
    }
  })

  it('CH zone edge connects zone_valve to radiator_loop, not to cylinder', () => {
    const radNode = graph.nodes.find(n => n.kind === 'radiator_loop')!
    // There must be an edge arriving at the radiator flow port
    const edgeToRads = graph.edges.find(e => e.to.nodeId === radNode.id && e.to.portId === 'flow_in')
    expect(edgeToRads).toBeDefined()
    // The source of that edge must not be the cylinder
    const cylIds = new Set(
      graph.nodes
        .filter(n =>
          n.kind === 'dhw_unvented_cylinder' ||
          n.kind === 'dhw_vented_cylinder' ||
          n.kind === 'dhw_mixergy',
        )
        .map(n => n.id),
    )
    expect(cylIds.has(edgeToRads!.from.nodeId)).toBe(false)
  })

  it('cylinder coil_flow edge comes from zone_valve, not from radiator_loop', () => {
    const cylNode = graph.nodes.find(n =>
      n.kind === 'dhw_unvented_cylinder' ||
      n.kind === 'dhw_vented_cylinder' ||
      n.kind === 'dhw_mixergy',
    )!
    const coilEdge = graph.edges.find(
      e => e.to.nodeId === cylNode.id && e.to.portId === 'coil_flow',
    )
    expect(coilEdge).toBeDefined()
    // Source must not be the radiator_loop node
    const radNode = graph.nodes.find(n => n.kind === 'radiator_loop')
    if (radNode) {
      expect(coilEdge!.from.nodeId).not.toBe(radNode.id)
    }
  })
})

// ─── 2. Heating-only activation ───────────────────────────────────────────────

describe('topologyParity — heating-only activation in play scene model', () => {
  const graph = generateGraphFromConcept(CANONICAL_SYSTEM_BOILER)
  const controls = graphToLabControls(graph)

  it('heating active → showHeatingPath true', () => {
    const scene = buildPlaySceneModel(controls, makeFrame({ systemMode: 'heating' }))
    expect(scene.metadata.showHeatingPath).toBe(true)
  })

  it('heating active → heat source node is visible', () => {
    const scene = buildPlaySceneModel(controls, makeFrame({ systemMode: 'heating' }))
    const hs = scene.nodes.find(n => n.role === 'heat_source')
    expect(hs?.visible).toBe(true)
  })

  it('heating active → radiators node is visible', () => {
    const scene = buildPlaySceneModel(controls, makeFrame({ systemMode: 'heating' }))
    const rads = scene.nodes.find(n => n.role === 'radiators')
    expect(rads?.visible).toBe(true)
  })

  it('heating active, DHW inactive → cylinder node is not active', () => {
    // Cylinder is passive (not directly emitting) during CH-only mode.
    const scene = buildPlaySceneModel(controls, makeFrame({ systemMode: 'heating' }))
    const cyl = scene.nodes.find(n => n.role === 'cylinder')
    // Cylinder may exist for stored systems but should not be marked as the
    // emitter source (active = false means no dhw draw / coil firing).
    if (cyl) {
      expect(cyl.active).toBe(false)
    }
  })

  it('heating-only → coil edges present but inactive (PR5: always show structure)', () => {
    // PR5: coil edges are always emitted for cylinder systems so the primary
    // circuit is always visible in the schematic.  During heating-only mode the
    // coil is not firing so the edges carry active=false (rendered faded).
    const scene = buildPlaySceneModel(controls, makeFrame({ systemMode: 'heating' }))
    const coilEdges = scene.edges.filter(e => e.kind === 'coil_flow' || e.kind === 'coil_return')
    expect(coilEdges.length).toBe(2)
    for (const edge of coilEdges) {
      expect(edge.active).toBe(false)
    }
  })

  it('CH edges go heat_source → radiators, not heat_source → cylinder', () => {
    const scene = buildPlaySceneModel(controls, makeFrame({ systemMode: 'heating' }))
    const chFlow = scene.edges.find(e => e.id === 'ch_flow')
    expect(chFlow).toBeDefined()
    expect(chFlow!.from).toBe('heat_source')
    expect(chFlow!.to).toBe('radiators')
  })
})

// ─── 3. Stored DHW draw ───────────────────────────────────────────────────────

describe('topologyParity — stored DHW draw', () => {
  const graph = generateGraphFromConcept(CANONICAL_SYSTEM_BOILER)
  const controls = graphToLabControls(graph)

  it('DHW draw → cylinder node is active', () => {
    const scene = buildPlaySceneModel(controls, makeFrame({ systemMode: 'dhw_draw' }))
    const cyl = scene.nodes.find(n => n.role === 'cylinder')
    expect(cyl?.active).toBe(true)
  })

  it('DHW draw → dhw_hot edge originates from cylinder, not heat_source', () => {
    const scene = buildPlaySceneModel(controls, makeFrame({ systemMode: 'dhw_draw' }))
    const dhwEdge = scene.edges.find(e => e.id === 'dhw_hot')
    expect(dhwEdge).toBeDefined()
    expect(dhwEdge!.from).toBe('cylinder')
  })

  it('cylinder reheat → coil edges present', () => {
    const scene = buildPlaySceneModel(controls, makeFrame({ systemMode: 'dhw_reheat' }))
    const coilFlow   = scene.edges.find(e => e.id === 'coil_flow')
    const coilReturn = scene.edges.find(e => e.id === 'coil_return')
    expect(coilFlow).toBeDefined()
    expect(coilReturn).toBeDefined()
  })

  it('cylinder reheat → coil edges go heat_source ↔ cylinder, not radiators', () => {
    const scene = buildPlaySceneModel(controls, makeFrame({ systemMode: 'dhw_reheat' }))
    const coilFlow = scene.edges.find(e => e.id === 'coil_flow')!
    expect(coilFlow.from).toBe('heat_source')
    expect(coilFlow.to).toBe('cylinder')
    // Radiator node must not appear as a coil endpoint
    const coilReturn = scene.edges.find(e => e.id === 'coil_return')!
    expect(coilReturn.from).toBe('cylinder')
    expect(coilReturn.to).toBe('heat_source')
  })

  it('stored DHW draw → CH emitter edges present but inactive (PR5: always show structure)', () => {
    // PR5: CH edges are always emitted when hasHeatingCircuit=true so the heating
    // branch remains visible in the schematic even when only DHW is active.
    // The edges carry active=false (rendered faded) to show structure without
    // implying flow.
    const scene = buildPlaySceneModel(controls, makeFrame({ systemMode: 'dhw_draw' }))
    const chEdges = scene.edges.filter(e => e.kind === 'ch_flow' || e.kind === 'ch_return')
    expect(chEdges.length).toBe(2)
    for (const edge of chEdges) {
      expect(edge.active).toBe(false)
    }
  })

  it('S-plan simultaneous mode → both ch_flow AND coil_flow edges present', () => {
    const scene = buildPlaySceneModel(controls, makeFrame({ systemMode: 'heating_and_reheat' }))
    expect(scene.edges.find(e => e.id === 'ch_flow')).toBeDefined()
    expect(scene.edges.find(e => e.id === 'coil_flow')).toBeDefined()
  })
})

// ─── 4. Y-plan (vented cylinder) topology parity ─────────────────────────────

describe('topologyParity — Y-plan (regular boiler + vented cylinder)', () => {
  const graph = generateGraphFromConcept(CANONICAL_REGULAR_BOILER)

  it('graph has heat_source_regular_boiler node', () => {
    expect(graph.nodes.some(n => n.kind === 'heat_source_regular_boiler')).toBe(true)
  })

  it('graph has three_port_valve for Y-plan', () => {
    expect(graph.nodes.some(n => n.kind === 'three_port_valve')).toBe(true)
  })

  it('graph has separate dhw_vented_cylinder and radiator_loop', () => {
    expect(graph.nodes.some(n => n.kind === 'dhw_vented_cylinder')).toBe(true)
    expect(graph.nodes.some(n => n.kind === 'radiator_loop')).toBe(true)
  })

  it('cylinder coil_flow port receives from three_port_valve out_b, not from radiator_loop', () => {
    const cylNode  = graph.nodes.find(n => n.kind === 'dhw_vented_cylinder')!
    const radNode  = graph.nodes.find(n => n.kind === 'radiator_loop')!
    const coilEdge = graph.edges.find(e => e.to.nodeId === cylNode.id && e.to.portId === 'coil_flow')
    expect(coilEdge).toBeDefined()
    expect(coilEdge!.from.nodeId).not.toBe(radNode.id)
  })
})

// ─── 5. Palette tray bounds (PR7) ────────────────────────────────────────────

describe('clampTrayPosition — palette tray must stay inside workbench', () => {
  const workbench = { width: 1200, height: 800 }
  const tray      = { width: 300, height: 400 }

  it('passes through an in-bounds position unchanged', () => {
    const result = clampTrayPosition({ x: 100, y: 150 }, workbench, tray)
    expect(result.x).toBe(100)
    expect(result.y).toBe(150)
  })

  it('clamps x to 0 when negative', () => {
    expect(clampTrayPosition({ x: -50, y: 100 }, workbench, tray).x).toBe(0)
  })

  it('clamps y to 0 when negative', () => {
    expect(clampTrayPosition({ x: 100, y: -10 }, workbench, tray).y).toBe(0)
  })

  it('clamps x so tray right edge stays 8 px inside workbench', () => {
    const maxX = workbench.width - tray.width - 8   // 892
    const result = clampTrayPosition({ x: maxX + 100, y: 0 }, workbench, tray)
    expect(result.x).toBe(maxX)
  })

  it('clamps y so tray bottom does not overlap footer controls', () => {
    const maxY = workbench.height - tray.height - TRAY_FOOTER_RESERVE_PX   // 352
    const result = clampTrayPosition({ x: 0, y: maxY + 100 }, workbench, tray)
    expect(result.y).toBe(maxY)
  })

  it('tray cannot be positioned over the footer button strip', () => {
    // A tray placed at maximum Y leaves footer-reserve pixels clear at the bottom.
    const result = clampTrayPosition({ x: 0, y: 99999 }, workbench, tray)
    const trayBottom = result.y + tray.height
    expect(trayBottom).toBeLessThanOrEqual(workbench.height - TRAY_FOOTER_RESERVE_PX)
  })

  it('TRAY_FOOTER_RESERVE_PX is at least the height of one control button row', () => {
    expect(TRAY_FOOTER_RESERVE_PX).toBeGreaterThanOrEqual(40)
  })

  it('works when tray is larger than workbench (clamps to 0)', () => {
    const bigTray = { width: 2000, height: 2000 }
    const result = clampTrayPosition({ x: 500, y: 500 }, workbench, bigTray)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })
})

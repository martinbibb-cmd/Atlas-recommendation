/**
 * Tests for snapRoles — role-based snap constraint logic.
 */

import { describe, it, expect } from 'vitest'
import { getSnapRole, isSnapAllowed } from '../builder/snapRoles'
import { findSnapCandidate, rolesCompatible } from '../builder/snapConnect'
import type { BuildGraph } from '../builder/types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeGraph(nodes: BuildGraph['nodes']): BuildGraph {
  return { nodes, edges: [] }
}

// ─── getSnapRole ──────────────────────────────────────────────────────────────

describe('getSnapRole', () => {
  it('maps heat sources correctly', () => {
    expect(getSnapRole('heat_source_combi')).toBe('heat_source')
    expect(getSnapRole('heat_source_system_boiler')).toBe('heat_source')
    expect(getSnapRole('heat_source_regular_boiler')).toBe('heat_source')
    expect(getSnapRole('heat_source_heat_pump')).toBe('heat_source')
  })

  it('maps pump to pump', () => {
    expect(getSnapRole('pump')).toBe('pump')
  })

  it('maps open vent and F&E to open_vent_feed', () => {
    expect(getSnapRole('open_vent')).toBe('open_vent_feed')
    expect(getSnapRole('feed_and_expansion')).toBe('open_vent_feed')
  })

  it('maps zone valves and diverters to control', () => {
    expect(getSnapRole('zone_valve')).toBe('control')
    expect(getSnapRole('three_port_valve')).toBe('control')
  })

  it('maps emitters to load', () => {
    expect(getSnapRole('radiator_loop')).toBe('load')
    expect(getSnapRole('ufh_loop')).toBe('load')
  })

  it('maps buffer and LLH to load', () => {
    expect(getSnapRole('buffer')).toBe('load')
    expect(getSnapRole('low_loss_header')).toBe('load')
  })

  it('maps cylinders to storage', () => {
    expect(getSnapRole('dhw_unvented_cylinder')).toBe('storage')
    expect(getSnapRole('dhw_mixergy')).toBe('storage')
    expect(getSnapRole('dhw_vented_cylinder')).toBe('storage')
  })

  it('maps return tee to return_common', () => {
    expect(getSnapRole('tee_ch_return')).toBe('return_common')
  })

  it('maps outlets to outlet', () => {
    expect(getSnapRole('tap_outlet')).toBe('outlet')
    expect(getSnapRole('shower_outlet')).toBe('outlet')
    expect(getSnapRole('cold_tap_outlet')).toBe('outlet')
  })
})

// ─── isSnapAllowed ────────────────────────────────────────────────────────────

describe('isSnapAllowed — pump', () => {
  it('allows pump on flow', () => {
    expect(isSnapAllowed('pump', 'flow', 'flow')).toBe(true)
  })

  it('allows pump port to unknown target (e.g. vent)', () => {
    expect(isSnapAllowed('pump', 'flow', 'unknown')).toBe(true)
  })

  it('blocks pump on return', () => {
    expect(isSnapAllowed('pump', 'flow', 'return')).toBe(false)
  })

  it('blocks pump on DHW hot', () => {
    expect(isSnapAllowed('pump', 'flow', 'hot')).toBe(false)
  })

  it('blocks pump on domestic cold', () => {
    expect(isSnapAllowed('pump', 'flow', 'cold')).toBe(false)
  })
})

describe('isSnapAllowed — open_vent_feed', () => {
  it('allows vent/feed on flow', () => {
    expect(isSnapAllowed('open_vent_feed', 'unknown', 'flow')).toBe(true)
  })

  it('allows vent/feed on unknown port', () => {
    expect(isSnapAllowed('open_vent_feed', 'unknown', 'unknown')).toBe(true)
  })

  it('blocks vent/feed on return', () => {
    expect(isSnapAllowed('open_vent_feed', 'unknown', 'return')).toBe(false)
  })

  it('blocks vent/feed on DHW hot', () => {
    expect(isSnapAllowed('open_vent_feed', 'unknown', 'hot')).toBe(false)
  })

  it('blocks vent/feed on domestic cold', () => {
    expect(isSnapAllowed('open_vent_feed', 'unknown', 'cold')).toBe(false)
  })
})

describe('isSnapAllowed — control', () => {
  it('allows control flow port on flow target', () => {
    expect(isSnapAllowed('control', 'flow', 'flow')).toBe(true)
  })

  it('blocks control flow port on return', () => {
    expect(isSnapAllowed('control', 'flow', 'return')).toBe(false)
  })

  it('blocks control flow port on DHW hot', () => {
    expect(isSnapAllowed('control', 'flow', 'hot')).toBe(false)
  })

  it('blocks control flow port on domestic cold', () => {
    expect(isSnapAllowed('control', 'flow', 'cold')).toBe(false)
  })
})

describe('isSnapAllowed — load', () => {
  it('allows load flow_in on flow', () => {
    expect(isSnapAllowed('load', 'flow', 'flow')).toBe(true)
  })

  it('allows load flow_in on return (flowish target)', () => {
    // flow_in of a load may sit against a flowish port (tee or similar)
    expect(isSnapAllowed('load', 'flow', 'return')).toBe(true)
  })

  it('allows load return_out on return', () => {
    expect(isSnapAllowed('load', 'return', 'return')).toBe(true)
  })

  it('allows load return_out on unknown', () => {
    expect(isSnapAllowed('load', 'return', 'unknown')).toBe(true)
  })

  it('blocks load return_out on flow', () => {
    expect(isSnapAllowed('load', 'return', 'flow')).toBe(false)
  })
})

describe('isSnapAllowed — return_common', () => {
  it('allows return_common on return', () => {
    expect(isSnapAllowed('return_common', 'return', 'return')).toBe(true)
  })

  it('allows return_common on unknown port', () => {
    expect(isSnapAllowed('return_common', 'return', 'unknown')).toBe(true)
  })

  it('blocks return_common on flow — return tee must not connect to flow pipe', () => {
    expect(isSnapAllowed('return_common', 'return', 'flow')).toBe(false)
  })

  it('blocks return_common on DHW hot', () => {
    expect(isSnapAllowed('return_common', 'return', 'hot')).toBe(false)
  })

  it('blocks return_common on domestic cold', () => {
    expect(isSnapAllowed('return_common', 'return', 'cold')).toBe(false)
  })
})

describe('isSnapAllowed — heat_source / storage / support / outlet', () => {
  it('heat_source has no additional restriction', () => {
    expect(isSnapAllowed('heat_source', 'flow', 'return')).toBe(true)
    expect(isSnapAllowed('heat_source', 'return', 'flow')).toBe(true)
    expect(isSnapAllowed('heat_source', 'hot', 'cold')).toBe(true)
  })

  it('storage has no additional restriction', () => {
    expect(isSnapAllowed('storage', 'flow', 'return')).toBe(true)
    expect(isSnapAllowed('storage', 'cold', 'cold')).toBe(true)
  })

  it('outlet has no additional restriction', () => {
    expect(isSnapAllowed('outlet', 'hot', 'hot')).toBe(true)
    expect(isSnapAllowed('outlet', 'cold', 'cold')).toBe(true)
  })
})

// ─── findSnapCandidate with role-based constraints ───────────────────────────

describe('findSnapCandidate with role-based snap rules', () => {
  it('pump does not snap to heat source return port', () => {
    // Place pump so its 'in' port would be close to combi's 'return_in'.
    // combi return_in: dx=R=170, dy=B-18=56 → abs (170, 56)
    // pump 'in': dx=L=0, dy=MID_Y=37 → place pump at x=170, y=56-37=19
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'pump', kind: 'pump', x: 170, y: 19, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'pump', maxDistPx: 36 })
    // If a candidate is found it must NOT be pump↔return
    if (cand) {
      const toNode = graph.nodes.find(n => n.id === cand.to.nodeId)!
      expect(toNode.kind).not.toBe('heat_source_combi')
    }
    // The snap to combi's return_in must be blocked
    const snapToReturn = cand &&
      cand.to.nodeId === 'combi' &&
      cand.to.portId === 'return_in'
    expect(snapToReturn).toBeFalsy()
  })

  it('pump snaps to heat source flow port', () => {
    // combi flow_out: dx=R=170, dy=T+18=18 → abs (170, 18)
    // pump 'in': dx=L=0, dy=MID_Y=37 → place pump at x=170, y=18-37+37=18 → x=170, y=-19
    // Actually: pump 'in' abs = (170 + 0, -19 + 37) = (170, 18) → dist = 0
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'pump', kind: 'pump', x: 170, y: -19, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'pump', maxDistPx: 36 })
    expect(cand).not.toBeNull()
    expect(cand!.to.nodeId).toBe('combi')
    expect(cand!.to.portId).toBe('flow_out')
  })

  it('zone_valve (control) does not snap to return port', () => {
    // Place zone_valve so its 'in' port (role='flow') is close to combi's return_in (role='return')
    // combi return_in: abs (170, 56)
    // zone_valve 'in': dx=L=0, dy=MID_Y=37 → place at x=170, y=56-37=19
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'valve', kind: 'zone_valve', x: 170, y: 19, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'valve', maxDistPx: 36 })
    const snapToReturn = cand &&
      cand.to.nodeId === 'combi' &&
      cand.to.portId === 'return_in'
    expect(snapToReturn).toBeFalsy()
  })

  it('open_vent does not snap to heat source return port', () => {
    // open_vent 'vent_in': dx=L=0, dy=MID_Y=37
    // combi return_in: abs (170, 56)
    // place open_vent so vent_in is at (170, 56) → x=170, y=56-37=19
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'ov', kind: 'open_vent', x: 170, y: 19, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'ov', maxDistPx: 36 })
    const snapToReturn = cand &&
      cand.to.nodeId === 'combi' &&
      cand.to.portId === 'return_in'
    expect(snapToReturn).toBeFalsy()
  })

  it('radiator (load) snaps to flow when no controls in graph', () => {
    // radiator flow_in: dx=L=0, dy=T+18=18 → abs (173, 18) for x=173, y=0
    // combi flow_out: abs (170, 18) → distance = 3 < 36
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'rad', kind: 'radiator_loop', x: 173, y: 0, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'rad', maxDistPx: 36 })
    expect(cand).not.toBeNull()
    expect(cand!.to.nodeId).toBe('combi')
  })

  it('radiator (load) flow_in does NOT snap to heat source flow port when a zone_valve exists in graph', () => {
    // Controls are present → load flow_in must not bypass them by snapping to heat_source.
    // Note: return_out → heat_source.return_in is still permitted (auto-common return).
    // combi flow_out: abs (170, 18); rad flow_in abs (173, 18) → dist=3 → BLOCKED
    // combi return_in: abs (170, 56); rad return_out abs (173, 56) → dist=3 → ALLOWED
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'valve', kind: 'zone_valve', x: 0, y: 0, r: 0 },   // control in graph
      { id: 'rad', kind: 'radiator_loop', x: 173, y: 0, r: 0 }, // near combi flow_out
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'rad', maxDistPx: 36 })
    // The flow_in→heat_source snap must be blocked when controls exist.
    const snapFlowToHeatSource = cand &&
      cand.to.nodeId === 'combi' &&
      cand.to.portId === 'flow_out'
    expect(snapFlowToHeatSource).toBeFalsy()
  })

  it('radiator (load) does NOT snap directly to pump when a zone_valve exists in graph', () => {
    // pump 'out' port close to rad flow_in; valve in graph should block this
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'pump', kind: 'pump', x: 200, y: 0, r: 0 },
      { id: 'valve', kind: 'zone_valve', x: 0, y: 100, r: 0 },  // control in graph
      { id: 'rad', kind: 'radiator_loop', x: 370, y: 0, r: 0 }, // near pump 'out'
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'rad', maxDistPx: 36 })
    // Must not snap to the pump when controls exist
    const snapToPump = cand && cand.to.nodeId === 'pump'
    expect(snapToPump).toBeFalsy()
  })

  it('radiator (load) CAN snap to zone_valve output when zone_valve is in graph', () => {
    // zone_valve 'out_a': side=right, x=0.5 → dy=0.5*74=37 → abs at x=0: (170, 37)
    // rad flow_in: dx=L=0, dy=T+18=18 → place rad at x=170, y=19 → abs (170, 37) dist=0
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'valve', kind: 'zone_valve', x: 0, y: 0, r: 0 },
      { id: 'rad', kind: 'radiator_loop', x: 170, y: 19, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'rad', maxDistPx: 36 })
    expect(cand).not.toBeNull()
    expect(cand!.to.nodeId).toBe('valve')
  })

  // ── Controls-after-pump graph-context constraints ─────────────────────────

  it('zone_valve (control) does NOT snap directly to heat source when pump is in graph', () => {
    // When a pump exists the control must come after the pump, not bypass it.
    // combi flow_out: abs (170, 18)
    // zone_valve 'in': dx=L=0, dy=MID_Y=37 → place at x=170, y=18-37=-19 → abs (170, 18)
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'pump',  kind: 'pump',              x: 0, y: 0, r: 0 },  // pump in graph
      { id: 'valve', kind: 'zone_valve',         x: 170, y: -19, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'valve', maxDistPx: 36 })
    const snapToHeatSource = cand && cand.to.nodeId === 'combi'
    expect(snapToHeatSource).toBeFalsy()
  })

  it('zone_valve (control) CAN snap to heat source when no pump in graph', () => {
    // Without a pump the direct heat_source → control connection is permitted.
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'valve', kind: 'zone_valve', x: 170, y: -19, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'valve', maxDistPx: 36 })
    expect(cand).not.toBeNull()
    expect(cand!.to.nodeId).toBe('combi')
  })

  it('three_port_valve (control) does NOT snap directly to heat source when pump is in graph', () => {
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi',  x: 0, y: 0, r: 0 },
      { id: 'pump',  kind: 'pump',               x: 0, y: 0, r: 0 },
      { id: 'valve', kind: 'three_port_valve',    x: 170, y: -19, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'valve', maxDistPx: 36 })
    const snapToHeatSource = cand && cand.to.nodeId === 'combi'
    expect(snapToHeatSource).toBeFalsy()
  })

  // ── Vent/feed-before-pump graph-context constraints ───────────────────────

  it('open_vent does NOT snap to pump when pump is already in graph', () => {
    // Vented systems: open vent must sit before the pump — never after.
    // When a pump exists, open_vent can only snap to a heat source.
    // pump 'out': dx=R=170, dy=MID_Y=37 → abs (170+170, 37) = (340, 37) if pump at x=170
    // open_vent 'vent_in': dx=L=0, dy=MID_Y=37 → place at x=340, y=0 → abs (340, 37) dist=0
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi',  x: 0, y: 0, r: 0 },
      { id: 'pump',  kind: 'pump',               x: 170, y: 0, r: 0 },
      { id: 'ov',    kind: 'open_vent',           x: 340, y: 0, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'ov', maxDistPx: 36 })
    const snapToPump = cand && cand.to.nodeId === 'pump'
    expect(snapToPump).toBeFalsy()
  })

  it('open_vent CAN snap to heat source when pump is in graph', () => {
    // Vent must be able to connect to the heat source regardless of pump presence.
    // combi flow_out: abs (170, 18)
    // open_vent 'vent_in': dx=L=0, dy=MID_Y=37 → place at x=170, y=18-37=-19 → abs (170, 18)
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi',  x: 0, y: 0, r: 0 },
      { id: 'pump',  kind: 'pump',               x: 0, y: 100, r: 0 },
      { id: 'ov',    kind: 'open_vent',           x: 170, y: -19, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'ov', maxDistPx: 36 })
    expect(cand).not.toBeNull()
    expect(cand!.to.nodeId).toBe('combi')
  })

  it('feed_and_expansion does NOT snap to pump when pump is already in graph', () => {
    // F&E cistern tap must also obey the before-pump rule.
    // pump 'out': abs (340, 37) if pump at x=170
    // feed_and_expansion 'feed_in': dx=R=170, dy=MID_Y=37 → place at x=170, y=0 → abs (340, 37)
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi',  x: 0, y: 0, r: 0 },
      { id: 'pump',  kind: 'pump',               x: 170, y: 0, r: 0 },
      { id: 'fe',    kind: 'feed_and_expansion',  x: 170, y: 0, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'fe', maxDistPx: 36 })
    const snapToPump = cand && cand.to.nodeId === 'pump'
    expect(snapToPump).toBeFalsy()
  })

  it('open_vent CAN snap anywhere on flow when no pump is in graph', () => {
    // Without a pump the vent can go anywhere it can connect (flow only).
    // pump not in graph → free placement on flow
    const graph = makeGraph([
      { id: 'combi', kind: 'heat_source_combi', x: 0, y: 0, r: 0 },
      { id: 'ov',    kind: 'open_vent',          x: 170, y: -19, r: 0 },
    ])
    const cand = findSnapCandidate({ graph, movingNodeId: 'ov', maxDistPx: 36 })
    expect(cand).not.toBeNull()
  })

  // Verifies that rolesCompatible still blocks hot↔cold (unchanged behaviour)
  it('still blocks hot ↔ cold regardless of snap roles', () => {
    expect(rolesCompatible('hot', 'cold')).toBe(false)
    expect(rolesCompatible('cold', 'hot')).toBe(false)
  })
})

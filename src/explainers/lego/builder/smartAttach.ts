import type { BuildGraph, BuildEdge, BuildNode, PartKind } from './types'
import { nextPosition } from './autoLayout'

// ─── ID helpers ──────────────────────────────────────────────────────────────

let _uidCounter = 0

function uid(prefix = 'n') {
  return `${prefix}_${Date.now().toString(16)}_${(++_uidCounter).toString(16)}`
}

// ─── Node / edge factories ────────────────────────────────────────────────────

function makeNode(kind: PartKind, x: number, y: number): BuildNode {
  return { id: uid('node'), kind, x, y, r: 0 }
}

function makeEdge(
  fromNodeId: string,
  fromPortId: string,
  toNodeId: string,
  toPortId: string,
): BuildEdge {
  return {
    id: uid('edge'),
    from: { nodeId: fromNodeId, portId: fromPortId },
    to: { nodeId: toNodeId, portId: toPortId },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function edgeExists(
  edges: BuildEdge[],
  fromNodeId: string,
  fromPortId: string,
  toNodeId: string,
  toPortId: string,
): boolean {
  return edges.some(
    e =>
      (e.from.nodeId === fromNodeId &&
        e.from.portId === fromPortId &&
        e.to.nodeId === toNodeId &&
        e.to.portId === toPortId) ||
      (e.from.nodeId === toNodeId &&
        e.from.portId === toPortId &&
        e.to.nodeId === fromNodeId &&
        e.to.portId === fromPortId),
  )
}

function tryAddEdge(
  edges: BuildEdge[],
  fromNodeId: string,
  fromPortId: string,
  toNodeId: string,
  toPortId: string,
): BuildEdge[] {
  if (edgeExists(edges, fromNodeId, fromPortId, toNodeId, toPortId)) return edges
  return [...edges, makeEdge(fromNodeId, fromPortId, toNodeId, toPortId)]
}

function nextOutletSlot(
  bindings: Partial<Record<'A' | 'B' | 'C', string>>,
): 'A' | 'B' | 'C' | null {
  if (!bindings.A) return 'A'
  if (!bindings.B) return 'B'
  if (!bindings.C) return 'C'
  return null
}

// ─── Kind sets ────────────────────────────────────────────────────────────────

const HEAT_SOURCE_PRIORITY: PartKind[] = [
  'heat_source_combi',
  'heat_source_system_boiler',
  'heat_source_regular_boiler',
  'heat_source_heat_pump',
]

const EMITTER_KINDS = new Set<PartKind>(['radiator_loop', 'ufh_loop'])

const CYLINDER_KINDS = new Set<PartKind>([
  'dhw_unvented_cylinder',
  'dhw_mixergy',
  'dhw_vented_cylinder',
])

const OUTLET_KINDS = new Set<PartKind>([
  'tap_outlet',
  'bath_outlet',
  'shower_outlet',
  'cold_tap_outlet',
])

// ─── Anchor ───────────────────────────────────────────────────────────────────

function findAnchor(nodes: BuildNode[]): BuildNode | null {
  for (const kind of HEAT_SOURCE_PRIORITY) {
    const node = nodes.find(n => n.kind === kind)
    if (node) return node
  }
  return null
}

/** Returns the CH-circuit flow-out and return-in port IDs for a heat source. */
function heatSourcePorts(_kind: PartKind): { flowOut: string; returnIn: string } {
  return { flowOut: 'flow_out', returnIn: 'return_in' }
}

// ─── smartAdd ────────────────────────────────────────────────────────────────

/**
 * "Click-in" auto-connect: adds a part to the graph and wires it to the most
 * compatible open ports using MVP heuristics (see PR G spec).
 *
 * Returns the mutated graph snapshot and the ID of the newly placed node so
 * the caller can select it immediately.
 */
export function smartAdd(
  graph: BuildGraph,
  kind: PartKind,
): { nextGraph: BuildGraph; placedNodeId: string } {
  let nodes = [...graph.nodes]
  let edges = [...graph.edges]
  let outletBindings = { ...(graph.outletBindings ?? {}) }

  const anchor = findAnchor(nodes)
  const existingPositions = nodes.map(n => ({ x: n.x, y: n.y }))

  // ── Placement ──────────────────────────────────────────────────────────────
  let hint = anchor ? { x: anchor.x + 380, y: anchor.y } : { x: 200, y: 300 }

  if (kind === 'open_vent' && anchor) {
    hint = { x: anchor.x, y: Math.max(60, anchor.y - 110) }
  } else if (kind === 'feed_and_expansion' && anchor) {
    hint = { x: anchor.x, y: Math.max(40, anchor.y - 200) }
  }

  const pos = nextPosition(existingPositions, hint)
  const newNode = makeNode(kind, pos.x, pos.y)
  nodes = [...nodes, newNode]

  // ── Outlet binding ─────────────────────────────────────────────────────────
  if (OUTLET_KINDS.has(kind)) {
    const slot = nextOutletSlot(outletBindings)
    if (slot) outletBindings = { ...outletBindings, [slot]: newNode.id }
  }

  // ── Emitters (rads / UFH) → anchor CH flow only ──────────────────────────
  if (EMITTER_KINDS.has(kind) && anchor) {
    const { flowOut } = heatSourcePorts(anchor.kind)
    edges = tryAddEdge(edges, anchor.id, flowOut, newNode.id, 'flow_in')
    // Return connection is intentionally left unwired so the user controls it.
  }

  // ── Cylinders ─────────────────────────────────────────────────────────────
  if (CYLINDER_KINDS.has(kind)) {
    // Vented cylinder: auto-add CWS if absent and connect it
    if (kind === 'dhw_vented_cylinder' && !nodes.find(n => n.kind === 'cws_cistern')) {
      const cwsPos = nextPosition(nodes.map(n => ({ x: n.x, y: n.y })), {
        x: newNode.x - 220,
        y: newNode.y + 100,
      })
      const cwsNode = makeNode('cws_cistern', cwsPos.x, cwsPos.y)
      nodes = [...nodes, cwsNode]
      edges = tryAddEdge(edges, cwsNode.id, 'cold_out', newNode.id, 'cold_in')
    }
  }

  // ── Outlets ───────────────────────────────────────────────────────────────
  if (OUTLET_KINDS.has(kind)) {
    // Prefer cylinder as DHW source, then combi (exclude the just-added node itself)
    const cylinder = nodes.find(n => CYLINDER_KINDS.has(n.kind) && n.id !== newNode.id)
    const combi = nodes.find(n => n.kind === 'heat_source_combi' && n.id !== newNode.id)
    // Cold rail: the point from which outlets draw their cold supply
    const coldRailNode = cylinder ?? combi
    // CWS cistern is the preferred cold source for vented stored systems
    const cwsNode = nodes.find(n => n.kind === 'cws_cistern' && n.id !== newNode.id)

    if (kind === 'cold_tap_outlet') {
      // Cold-only — never connect hot. Prefer CWS direct feed, then the shared cold rail.
      const coldSource = cwsNode ?? coldRailNode
      if (coldSource) {
        const coldPortId = cwsNode ? 'cold_out' : 'cold_in'
        edges = tryAddEdge(edges, coldSource.id, coldPortId, newNode.id, 'cold_in')
      }
    } else {
      // Hot + cold outlet
      const hotSource = cylinder ?? combi
      if (hotSource) {
        edges = tryAddEdge(edges, hotSource.id, 'hot_out', newNode.id, 'hot_in')
      }
      // Cold supply: prefer CWS cistern (vented stored systems), fall back to cylinder/combi cold_in as the shared cold rail junction
      const coldSource = cwsNode ?? coldRailNode
      if (coldSource) {
        const coldPortId = cwsNode ? 'cold_out' : 'cold_in'
        edges = tryAddEdge(edges, coldSource.id, coldPortId, newNode.id, 'cold_in')
      }
    }
  }

  // ── Regular-boiler safety tokens ──────────────────────────────────────────
  if (kind === 'open_vent' && anchor && anchor.kind === 'heat_source_regular_boiler') {
    edges = tryAddEdge(edges, anchor.id, 'flow_out', newNode.id, 'vent_in')
  }

  if (kind === 'feed_and_expansion') {
    const ovNode = nodes.find(n => n.kind === 'open_vent' && n.id !== newNode.id)
    if (ovNode) {
      edges = tryAddEdge(edges, ovNode.id, 'vent_out', newNode.id, 'feed_in')
    }
  }

  return {
    nextGraph: { nodes, edges, outletBindings },
    placedNodeId: newNode.id,
  }
}

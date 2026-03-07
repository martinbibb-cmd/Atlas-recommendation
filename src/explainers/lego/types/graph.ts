// src/explainers/lego/types/graph.ts
//
// Canonical shared graph types used by both Edit (builder) and Play (simulation)
// modes.  BuildGraph is the builder-internal form; LabGraph is the common form
// that is passed between modes.
//
// PR1: Edit mode is the single source of truth.  Play mode consumes a deep
// clone of editorGraph produced via buildGraphToLabGraph() and must never
// rebuild topology from a template or system-type flag at play entry.
//
// PR2: Every edge carries an explicit CircuitDomain and every port is typed
// as a PortRole so that illegal connections (radiators on dhw, hot_out on
// heating) can be detected at build time and warned in dev mode.

import type { BuildGraph } from '../builder/types'

// ─── Circuit domain ───────────────────────────────────────────────────────────

/**
 * The hydraulic/thermal domain an edge belongs to.
 *
 * primary  — boiler ↔ cylinder coil circuit (heating fluid only, no domestic)
 * heating  — boiler/heat-pump ↔ emitters (radiators, UFH)
 * dhw      — domestic hot-water draw-off from cylinder or combi
 * cold     — domestic cold-water supply (mains or CWS cistern)
 */
export type CircuitDomain = 'primary' | 'heating' | 'dhw' | 'cold'

// ─── Port role ────────────────────────────────────────────────────────────────

/**
 * Semantic role of a port on an edge in the LabGraph.
 *
 * Specific cylinder ports (coil_flow, coil_return, cold_in, hot_out) are
 * preferred wherever possible.  'in' and 'out' are transitional roles for
 * pumps, valves and manifold pass-through ports.
 */
export type PortRole =
  | 'flow'
  | 'return'
  | 'coil_flow'
  | 'coil_return'
  | 'cold_in'
  | 'hot_out'
  | 'in'
  | 'out'

// ─── Canonical shared types ───────────────────────────────────────────────────

export interface LabNode {
  id: string
  kind: string
  x: number
  y: number
  data?: Record<string, unknown>
}

export interface LabEdge {
  id: string
  fromNodeId: string
  fromPort: PortRole
  toNodeId: string
  toPort: PortRole
  domain: CircuitDomain
  data?: Record<string, unknown>
}

export interface LabGraph {
  nodes: LabNode[]
  edges: LabEdge[]
}

// ─── Port-ID → PortRole mapping ───────────────────────────────────────────────

/**
 * Map a builder-internal port ID string to a semantic PortRole.
 *
 * Builder port IDs are descriptive strings like 'ch_flow_out' or 'coil_return'.
 * PortRole is the canonical semantic vocabulary used in the shared LabGraph.
 */
function portIdToRole(portId: string): PortRole {
  // Exact cylinder coil ports — most specific, checked first
  if (portId === 'coil_flow')   return 'coil_flow'
  if (portId === 'coil_return') return 'coil_return'
  // Cold-water ports (source or sink — both carry the 'cold' semantic)
  if (portId === 'cold_in' || portId === 'cold_out') return 'cold_in'
  // Hot-water ports (cylinder outlet and fixture inlet — same domain)
  if (portId === 'hot_out' || portId === 'hot_in') return 'hot_out'
  // Any heating-circuit flow port (ch_flow_out, flow_in, flow_out, primary_flow, …)
  if (portId.includes('flow')) return 'flow'
  // Any heating-circuit return port (ch_return_in, return_out, primary_return, …)
  if (portId.includes('return')) return 'return'
  // Generic inputs (pump in, valve in, manifold in, vent_in, feed_in, …)
  if (portId === 'in' || portId.endsWith('_in')) return 'in'
  // Default — outputs (out, out1, out2, out_a, vent_out, …)
  return 'out'
}

// ─── Domain inference ─────────────────────────────────────────────────────────

/**
 * Infer the CircuitDomain from a pair of builder port IDs when no explicit
 * domain has been set on the BuildEdge.  Used as a migration fallback only.
 */
function inferDomain(fromPortId: string, toPortId: string): CircuitDomain {
  const ports = [fromPortId, toPortId]
  if (ports.some(p => p === 'coil_flow' || p === 'coil_return')) return 'primary'
  if (ports.some(p => p === 'hot_out'   || p === 'hot_in'))      return 'dhw'
  if (ports.some(p => p === 'cold_in'   || p === 'cold_out'))    return 'cold'
  return 'heating'
}

// ─── Semantic helpers ─────────────────────────────────────────────────────────

/**
 * Return the PortRoles that are physically meaningful for a given node kind.
 *
 * This drives dev-mode validation warnings and prepares for PR3 graph
 * blocking.  The list is intentionally permissive for transitional node kinds
 * (pumps, valves, tees) that carry fluid through without domain-specific ports.
 */
export function getAllowedPorts(kind: string): PortRole[] {
  switch (kind) {
    case 'heat_source_combi':
    case 'heat_source_system_boiler':
    case 'heat_source_regular_boiler':
    case 'heat_source_heat_pump':
      return ['flow', 'return', 'cold_in', 'hot_out']
    case 'radiator_loop':
    case 'ufh_loop':
      return ['flow', 'return']
    case 'dhw_vented_cylinder':
    case 'dhw_unvented_cylinder':
    case 'dhw_mixergy':
      return ['coil_flow', 'coil_return', 'cold_in', 'hot_out']
    case 'tap_outlet':
    case 'bath_outlet':
    case 'shower_outlet':
      return ['cold_in', 'hot_out']
    case 'cold_tap_outlet':
    case 'cws_cistern':
      return ['cold_in', 'out']
    default:
      // Pumps, valves, tees, manifolds, buffer — transitional components
      return ['flow', 'return', 'in', 'out']
  }
}

/**
 * Return true when the given PortRole is physically valid on the given domain.
 *
 * heating  — only flow/return (plus transitional in/out)
 * primary  — flow/return for the heating-fluid path + coil_flow/coil_return at the cylinder
 * dhw      — hot_out and cold_in (domestic draw-off)
 * cold     — cold_in for domestic cold supply; 'in'/'out' allowed for transitional
 *             distribution nodes (manifold_cold, tee_cold, etc.)
 */
export function isPortAllowedForDomain(port: PortRole, domain: CircuitDomain): boolean {
  switch (domain) {
    case 'heating':
      return port === 'flow' || port === 'return' || port === 'in' || port === 'out'
    case 'primary':
      return (
        port === 'flow' ||
        port === 'return' ||
        port === 'coil_flow' ||
        port === 'coil_return' ||
        port === 'in' ||
        port === 'out'
      )
    case 'dhw':
      return port === 'hot_out' || port === 'cold_in'
    case 'cold':
      // cold_in is the canonical cold-supply port; 'in'/'out' are allowed for
      // transitional distribution nodes (manifold_cold, tee_cold, pipe tees)
      return port === 'cold_in' || port === 'in' || port === 'out'
    default:
      return false
  }
}

/**
 * Return true when the proposed connection is semantically valid — i.e. the
 * fromPort and toPort are both allowed for their respective node kinds AND for
 * the stated domain.
 *
 * Examples that return false:
 *   radiators.flow on dhw domain         → invalid (emitters are heating only)
 *   cylinder.hot_out on heating domain   → invalid (hot_out is dhw only)
 *   cylinder.cold_in on primary domain   → invalid (cold_in is domestic only)
 */
export function isConnectionSemanticallyValid(args: {
  fromKind: string
  fromPort: PortRole
  toKind: string
  toPort: PortRole
  domain: CircuitDomain
}): boolean {
  const { fromKind, fromPort, toKind, toPort, domain } = args
  const fromAllowed = getAllowedPorts(fromKind)
  const toAllowed   = getAllowedPorts(toKind)
  if (!fromAllowed.includes(fromPort)) return false
  if (!toAllowed.includes(toPort))     return false
  if (!isPortAllowedForDomain(fromPort, domain)) return false
  if (!isPortAllowedForDomain(toPort,   domain)) return false
  return true
}

// ─── Dev-only warning ─────────────────────────────────────────────────────────

/**
 * Log a console.warn for every edge in the LabGraph that violates semantic
 * port/domain rules.  No-ops in production.
 *
 * Intended to be called after buildGraphToLabGraph() so that invalid
 * connections are surfaced in dev/lab mode without blocking editing.
 */
export function warnInvalidEdges(edges: LabEdge[], nodes: LabNode[]): void {
  if (process.env.NODE_ENV === 'production') return
  for (const edge of edges) {
    const fromNode = nodes.find(n => n.id === edge.fromNodeId)
    const toNode   = nodes.find(n => n.id === edge.toNodeId)
    if (!fromNode || !toNode) continue
    const valid = isConnectionSemanticallyValid({
      fromKind: fromNode.kind,
      fromPort: edge.fromPort,
      toKind:   toNode.kind,
      toPort:   edge.toPort,
      domain:   edge.domain,
    })
    if (!valid) {
      console.warn(
        `[Lab] Invalid connection: ${fromNode.kind}.${edge.fromPort}` +
        ` → ${toNode.kind}.${edge.toPort}` +
        ` cannot belong to ${edge.domain} domain`,
      )
    }
  }
}

// ─── Converter ────────────────────────────────────────────────────────────────

/**
 * Convert the builder-internal BuildGraph into the canonical LabGraph form.
 * Node and edge ids are preserved exactly — Play mode must never regenerate them.
 *
 * PR2: fromPort/toPort are now mapped to typed PortRoles; domain is taken
 * from the BuildEdge when present, otherwise inferred from the port IDs.
 * A dev-mode warning is emitted for any edge that violates semantic rules.
 */
export function buildGraphToLabGraph(graph: BuildGraph): LabGraph {
  const nodes: LabGraph['nodes'] = graph.nodes.map(n => ({
    id: n.id,
    kind: n.kind,
    x: n.x,
    y: n.y,
  }))

  const edges: LabGraph['edges'] = graph.edges.map(e => ({
    id: e.id,
    fromNodeId: e.from.nodeId,
    fromPort:   portIdToRole(e.from.portId),
    toNodeId:   e.to.nodeId,
    toPort:     portIdToRole(e.to.portId),
    domain:     e.domain ?? inferDomain(e.from.portId, e.to.portId),
  }))

  const labGraph: LabGraph = { nodes, edges }
  warnInvalidEdges(labGraph.edges, labGraph.nodes)
  return labGraph
}

// ─── Parity helper ────────────────────────────────────────────────────────────

/**
 * Compare two LabGraphs for structural identity (same node/edge counts and ids).
 * Used in dev/lab mode immediately after entering Play to confirm that Play
 * consumed the same graph that Edit produced.
 */
export function compareGraphShape(
  a: LabGraph,
  b: LabGraph,
): {
  nodeCountEqual: boolean
  edgeCountEqual: boolean
  sameNodeIds: boolean
  sameEdgeIds: boolean
} {
  return {
    nodeCountEqual: a.nodes.length === b.nodes.length,
    edgeCountEqual: a.edges.length === b.edges.length,
    sameNodeIds: a.nodes.every(n => b.nodes.some(m => m.id === n.id)),
    sameEdgeIds: a.edges.every(e => b.edges.some(f => f.id === e.id)),
  }
}

/**
 * validateLabGraph — semantic topology validation for a LabGraph.
 *
 * Runs before Play mode is entered.  Returns a structured GraphValidationResult
 * so that dev/lab mode can surface issues clearly instead of silently rendering
 * broken hydraulic topology.
 *
 * Rules implemented:
 *   A. Emitters (radiator_loop / ufh_loop) may only connect on the heating domain.
 *   B. Cylinder domestic ports (cold_in / hot_out) may not appear on primary or heating.
 *   C. Cylinder coil ports (coil_flow / coil_return) must belong to the primary domain.
 *   D. If emitters exist, at least one heating-domain edge must exist.
 *   E. Each emitter should have both a flow and a return heating connection.
 */

import type {
  LabGraph,
  PortRole,
  GraphValidationIssue,
  GraphValidationResult,
} from '../types/graph'

// ─── Node-kind sets ───────────────────────────────────────────────────────────

const EMITTER_KINDS = new Set(['radiator_loop', 'ufh_loop'])

const CYLINDER_KINDS = new Set([
  'dhw_vented_cylinder',
  'dhw_unvented_cylinder',
  'dhw_mixergy',
])

const CYLINDER_DOMESTIC_PORTS: PortRole[] = ['cold_in', 'hot_out']
const CYLINDER_COIL_PORTS: PortRole[]     = ['coil_flow', 'coil_return']

// ─── Main validator ───────────────────────────────────────────────────────────

export function validateLabGraph(graph: LabGraph): GraphValidationResult {
  const issues: GraphValidationIssue[] = []

  // ── Rule A — emitters must only connect on the heating domain ──────────────
  for (const node of graph.nodes) {
    if (!EMITTER_KINDS.has(node.kind)) continue

    const connected = graph.edges.filter(
      e => e.fromNodeId === node.id || e.toNodeId === node.id,
    )

    for (const edge of connected) {
      if (edge.domain !== 'heating') {
        issues.push({
          code: 'EMITTER_WRONG_DOMAIN',
          severity: 'error',
          message: 'Emitters may only connect to the heating circuit',
          edgeId: edge.id,
          nodeId: node.id,
        })
      }
    }
  }

  // ── Rules B & C — cylinder port / domain rules ────────────────────────────
  for (const node of graph.nodes) {
    if (!CYLINDER_KINDS.has(node.kind)) continue

    const connected = graph.edges.filter(
      e => e.fromNodeId === node.id || e.toNodeId === node.id,
    )

    for (const edge of connected) {
      const port: PortRole =
        edge.fromNodeId === node.id ? edge.fromPort : edge.toPort

      // Rule B — domestic ports must not be on primary or heating
      if (
        CYLINDER_DOMESTIC_PORTS.includes(port) &&
        (edge.domain === 'primary' || edge.domain === 'heating')
      ) {
        issues.push({
          code: 'CYLINDER_DOMESTIC_PORT_ON_HEATING',
          severity: 'error',
          message: `Cylinder domestic port ${port} cannot be used on ${edge.domain} domain`,
          edgeId: edge.id,
          nodeId: node.id,
        })
      }

      // Rule C — coil ports must belong to primary domain only
      if (CYLINDER_COIL_PORTS.includes(port) && edge.domain !== 'primary') {
        issues.push({
          code: 'CYLINDER_COIL_PORT_WRONG_DOMAIN',
          severity: 'error',
          message: `Cylinder coil port ${port} must belong to primary domain`,
          edgeId: edge.id,
          nodeId: node.id,
        })
      }
    }
  }

  // ── Rule D — if emitters exist, a heating circuit must exist ──────────────
  const hasEmitters = graph.nodes.some(n => EMITTER_KINDS.has(n.kind))
  if (hasEmitters) {
    const hasHeatingEdge = graph.edges.some(e => e.domain === 'heating')
    if (!hasHeatingEdge) {
      issues.push({
        code: 'EMITTERS_NO_HEATING_CIRCUIT',
        severity: 'error',
        message: 'Emitters present but no heating circuit found',
      })
    }
  }

  // ── Rule E — emitters should have both flow and return heating connections ─
  for (const node of graph.nodes) {
    if (!EMITTER_KINDS.has(node.kind)) continue

    const heatingEdges = graph.edges.filter(
      e =>
        (e.fromNodeId === node.id || e.toNodeId === node.id) &&
        e.domain === 'heating',
    )

    const hasFlow = heatingEdges.some(e => {
      const port: PortRole =
        e.fromNodeId === node.id ? e.fromPort : e.toPort
      return port === 'flow'
    })

    const hasReturn = heatingEdges.some(e => {
      const port: PortRole =
        e.fromNodeId === node.id ? e.fromPort : e.toPort
      return port === 'return'
    })

    if (!hasFlow || !hasReturn) {
      issues.push({
        code: 'EMITTER_MISSING_FLOW_OR_RETURN',
        severity: 'warning',
        message: 'Emitters should have both flow and return heating connections',
        nodeId: node.id,
      })
    }
  }

  const ok = !issues.some(i => i.severity === 'error')
  return { ok, issues }
}

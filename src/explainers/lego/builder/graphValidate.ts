import type { BuildGraph, PartKind, PortDef, PortRef } from './types'
import { portsForKind } from './ports'

export interface GraphWarning {
  id: string
  level: 'warn' | 'error'
  title: string
  message: string
  hint?: string
  edgeId?: string
  nodeId?: string
}

function refKey(ref: PortRef) {
  return `${ref.nodeId}:${ref.portId}`
}

function buildAdjacency(graph: BuildGraph) {
  const adj = new Map<string, string[]>()

  const push = (from: string, to: string) => {
    const current = adj.get(from) ?? []
    current.push(to)
    adj.set(from, current)
  }

  for (const edge of graph.edges) {
    const from = refKey(edge.from)
    const to = refKey(edge.to)
    push(from, to)
    push(to, from)
  }

  return adj
}

function hasPath(adj: Map<string, string[]>, start: string, goal: string) {
  const seen = new Set<string>()
  const queue = [start]
  seen.add(start)

  while (queue.length) {
    const key = queue.shift()!
    if (key === goal) return true

    for (const next of adj.get(key) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }

  return false
}

function anyPortConnected(graph: BuildGraph, nodeId: string) {
  return graph.edges.some(edge => edge.from.nodeId === nodeId || edge.to.nodeId === nodeId)
}

function portRole(graph: BuildGraph, nodeId: string, portId: string): PortDef['role'] {
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node) return 'unknown'
  return portsForKind(node.kind).find(p => p.id === portId)?.role ?? 'unknown'
}

function roleCompatible(a: PortDef['role'], b: PortDef['role']) {
  if (a === 'unknown' || b === 'unknown') return true
  if (a === b) return true

  const flowish = new Set<PortDef['role']>(['flow', 'return', 'store'])
  if (flowish.has(a) && flowish.has(b)) return true

  if ((a === 'hot' && b === 'cold') || (a === 'cold' && b === 'hot')) return false

  return false
}

function findFirstNode(graph: BuildGraph, kinds: PartKind[]) {
  return graph.nodes.find(node => kinds.includes(node.kind))
}

export function validateGraph(graph: BuildGraph): GraphWarning[] {
  const warnings: GraphWarning[] = []

  for (const edge of graph.edges) {
    const fromRole = portRole(graph, edge.from.nodeId, edge.from.portId)
    const toRole = portRole(graph, edge.to.nodeId, edge.to.portId)

    if (!roleCompatible(fromRole, toRole)) {
      warnings.push({
        id: `role_${edge.id}`,
        level: 'warn',
        title: 'Incompatible connection roles',
        message: `Connection appears mismatched (${fromRole} ↔ ${toRole}).`,
        hint: 'Reconnect so hot links to hot/cold to cold, or use CH flow/return ports for heating loops.',
        edgeId: edge.id,
      })
    }
  }

  // "Port used multiple times" warnings are intentionally omitted here.
  // The graph normalisation pass (normalizeGraph) auto-inserts tee/manifold
  // nodes for branching ports, so raw multi-use is a builder artefact, not a
  // user-fixable system error.

  const adjacency = buildAdjacency(graph)

  const heatSources = graph.nodes.filter(
    n =>
      n.kind === 'heat_source_combi' ||
      n.kind === 'heat_source_system_boiler' ||
      n.kind === 'heat_source_regular_boiler' ||
      n.kind === 'heat_source_heat_pump',
  )

  for (const node of graph.nodes) {
    if (node.kind !== 'radiator_loop' && node.kind !== 'ufh_loop') continue

    const flowPort = `${node.id}:flow_in`
    const returnPort = `${node.id}:return_out`

    const flowConnected = (adjacency.get(flowPort) ?? []).length > 0
    const returnConnected = (adjacency.get(returnPort) ?? []).length > 0

    if (!flowConnected || !returnConnected) {
      warnings.push({
        id: `emitter_open_${node.id}`,
        level: 'warn',
        title: 'Emitter loop is not connected on both sides',
        message: 'Emitters must be connected on both the flow and return sides.',
        hint: 'Connect CH flow into flow_in and connect return_out back to the heat source return side.',
        nodeId: node.id,
      })
      continue
    }

    // Only run the heat-source reachability check when at least one heat
    // source is present; otherwise a partly-built graph would produce noise.
    if (heatSources.length === 0) continue

    const anyFlowReach = heatSources.some(hs => {
      const flowStarts = [`${hs.id}:ch_flow_out`, `${hs.id}:flow_out`]
      return flowStarts.some(start => hasPath(adjacency, start, flowPort))
    })

    const anyReturnReach = heatSources.some(hs => {
      const returnStarts = [`${hs.id}:ch_return_in`, `${hs.id}:return_in`]
      return returnStarts.some(start => hasPath(adjacency, start, returnPort))
    })

    if (!anyFlowReach || !anyReturnReach) {
      warnings.push({
        id: `emitter_path_${node.id}`,
        level: 'warn',
        title: 'Emitter not on CH circuit',
        message: 'Emitter is connected but not reachable from the heat source on both sides.',
        hint: 'Its flow_in should be on the flow side and return_out should route back to the heat source return.',
        nodeId: node.id,
      })
    }
  }

  const hasRegularBoiler = graph.nodes.some(node => node.kind === 'heat_source_regular_boiler')
  if (hasRegularBoiler) {
    const feNode = graph.nodes.find(node => node.kind === 'feed_and_expansion')
    const openVentNode = graph.nodes.find(node => node.kind === 'open_vent')

    if (!feNode) {
      warnings.push({
        id: 'reg_fe_missing',
        level: 'warn',
        title: 'F&E cistern missing',
        message: 'Regular boiler systems should include a Feed & Expansion cistern.',
        hint: 'Add a Feed & Expansion token and connect it to the heating circuit.',
      })
    } else if (!anyPortConnected(graph, feNode.id)) {
      warnings.push({
        id: `reg_fe_unwired_${feNode.id}`,
        level: 'warn',
        title: 'F&E cistern not connected',
        message: 'Feed & Expansion is present but not connected to the CH circuit.',
        hint: 'Connect the F&E token into the open-vented heating side.',
        nodeId: feNode.id,
      })
    }

    if (!openVentNode) {
      warnings.push({
        id: 'reg_ov_missing',
        level: 'warn',
        title: 'Open vent missing',
        message: 'Regular boiler systems should include an open vent safety path.',
        hint: 'Add Open Vent and connect it from CH flow rising to the F&E cistern.',
      })
    } else if (!anyPortConnected(graph, openVentNode.id)) {
      warnings.push({
        id: `reg_ov_unwired_${openVentNode.id}`,
        level: 'warn',
        title: 'Open vent not connected',
        message: 'Open vent is present but not connected to the CH circuit.',
        hint: 'Connect the open vent pipe from CH flow up towards the F&E cistern.',
        nodeId: openVentNode.id,
      })
    }
  }

  const ventedCylinderNode = graph.nodes.find(node => node.kind === 'dhw_vented_cylinder')
  if (ventedCylinderNode) {
    const cwsNode = findFirstNode(graph, ['cws_cistern'])
    if (!cwsNode) {
      warnings.push({
        id: `vented_cws_missing_${ventedCylinderNode.id}`,
        level: 'warn',
        title: 'CWS cistern missing',
        message: 'Vented cylinder setups should include a separate CWS cistern supply.',
        hint: 'Add a CWS cistern and connect cold_out to the cylinder cold_in.',
        nodeId: ventedCylinderNode.id,
      })
    } else {
      const cwsPort = `${cwsNode.id}:cold_out`
      const cylinderColdPort = `${ventedCylinderNode.id}:cold_in`
      const connected = hasPath(adjacency, cwsPort, cylinderColdPort)
      if (!connected) {
        warnings.push({
          id: `vented_cws_unwired_${ventedCylinderNode.id}`,
          level: 'warn',
          title: 'CWS not feeding vented cylinder',
          message: 'CWS exists but is not connected to vented cylinder cold_in.',
          hint: 'Pipe CWS cold_out into the cylinder cold_in connection.',
          nodeId: cwsNode.id,
        })
      }
    }
  }

  return warnings
}

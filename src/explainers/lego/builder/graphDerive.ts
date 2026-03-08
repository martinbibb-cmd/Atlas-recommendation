import type { BuildGraph, PortRef } from './types'
import { getPortDefs } from './portDefs'

export interface GraphFacts {
  hotFedOutletNodeIds: string[]
  coldOnlyOutletNodeIds: string[]
  hasStoredDhw: boolean
  /** True when the graph contains a combi boiler, which provides DHW internally. */
  hasCombiDhw: boolean
}

function refKey(ref: PortRef) {
  return `${ref.nodeId}:${ref.portId}`
}

function buildAdj(graph: BuildGraph) {
  const adj = new Map<string, string[]>()

  const push = (a: string, b: string) => {
    const list = adj.get(a) ?? []
    list.push(b)
    adj.set(a, list)
  }

  for (const edge of graph.edges) {
    const a = refKey(edge.from)
    const b = refKey(edge.to)
    push(a, b)
    push(b, a)
  }

  return adj
}

function bfs(startKeys: string[], adj: Map<string, string[]>) {
  const seen = new Set<string>()
  const queue: string[] = []

  for (const key of startKeys) {
    seen.add(key)
    queue.push(key)
  }

  while (queue.length) {
    const key = queue.shift()!
    for (const next of adj.get(key) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }

  return seen
}

export function deriveFacts(graph: BuildGraph): GraphFacts {
  const adj = buildAdj(graph)

  const hotStarts: string[] = []
  for (const node of graph.nodes) {
    const hasHotOut = getPortDefs(node.kind).some(port => port.id === 'hot_out')
    if (hasHotOut) hotStarts.push(`${node.id}:hot_out`)
  }
  const hotReach = bfs(hotStarts, adj)

  const coldSupplyKinds = new Set(['heat_source_combi', 'cws_cistern'])
  const coldStarts: string[] = []
  for (const node of graph.nodes) {
    for (const port of getPortDefs(node.kind)) {
      const isColdSupplyPort =
        port.role === 'cold' &&
        ((node.kind === 'cws_cistern' && port.id === 'cold_out') ||
          (coldSupplyKinds.has(node.kind) && port.id === 'cold_in') ||
          // manifold_cold:in with no upstream connection acts as a mains entry
          (node.kind === 'manifold_cold' && port.id === 'in'))
      if (isColdSupplyPort) {
        coldStarts.push(`${node.id}:${port.id}`)
      }
    }
  }
  const coldReach = bfs(coldStarts, adj)

  const outletKinds = new Set(['tap_outlet', 'bath_outlet', 'shower_outlet', 'cold_tap_outlet'])
  const cylinderKinds = new Set(['dhw_unvented_cylinder', 'dhw_mixergy', 'dhw_vented_cylinder'])
  const hotFedOutletNodeIds: string[] = []
  const coldOnlyOutletNodeIds: string[] = []
  const hasStoredDhw = graph.nodes.some(node => cylinderKinds.has(node.kind))
  const hasCombiDhw = graph.nodes.some(node => node.kind === 'heat_source_combi')

  for (const node of graph.nodes) {
    if (!outletKinds.has(node.kind)) continue

    const hotInKey = `${node.id}:hot_in`
    const coldInKey = `${node.id}:cold_in`

    const hotFed = hotReach.has(hotInKey)
    const coldFed = coldReach.has(coldInKey)

    if (hotFed) hotFedOutletNodeIds.push(node.id)
    else if (coldFed) coldOnlyOutletNodeIds.push(node.id)
  }

  return { hotFedOutletNodeIds, coldOnlyOutletNodeIds, hasStoredDhw, hasCombiDhw }
}

import type { BuildGraph, PortRef } from './types'
import { portsForKind } from './ports'

export interface GraphFacts {
  hotFedOutletNodeIds: string[]
  coldOnlyOutletNodeIds: string[]
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
    if (node.kind !== 'heat_source_boiler') continue
    const hasHotOut = portsForKind(node.kind).some(port => port.id === 'hot_out')
    if (hasHotOut) hotStarts.push(`${node.id}:hot_out`)
  }
  const hotReach = bfs(hotStarts, adj)

  const coldStarts: string[] = []
  for (const node of graph.nodes) {
    for (const port of portsForKind(node.kind)) {
      if (port.role === 'cold' && (port.id.includes('cold') || port.id === 'cold_in')) {
        coldStarts.push(`${node.id}:${port.id}`)
      }
    }
  }
  const coldReach = bfs(coldStarts, adj)

  const outletKinds = new Set(['tap_outlet', 'bath_outlet', 'shower_outlet'])
  const hotFedOutletNodeIds: string[] = []
  const coldOnlyOutletNodeIds: string[] = []

  for (const node of graph.nodes) {
    if (!outletKinds.has(node.kind)) continue

    const hotInKey = `${node.id}:hot_in`
    const coldInKey = `${node.id}:cold_in`

    const hotFed = hotReach.has(hotInKey)
    const coldFed = coldReach.has(coldInKey)

    if (hotFed) hotFedOutletNodeIds.push(node.id)
    else if (coldFed) coldOnlyOutletNodeIds.push(node.id)
  }

  return { hotFedOutletNodeIds, coldOnlyOutletNodeIds }
}

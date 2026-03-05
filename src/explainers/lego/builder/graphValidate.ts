import type { BuildGraph, PortDef } from './types'
import { portsForKind } from './ports'

export interface GraphWarning {
  id: string
  level: 'warn' | 'error'
  message: string
  edgeId?: string
  nodeId?: string
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

export function validateGraph(graph: BuildGraph): GraphWarning[] {
  const warnings: GraphWarning[] = []

  for (const edge of graph.edges) {
    const fromRole = portRole(graph, edge.from.nodeId, edge.from.portId)
    const toRole = portRole(graph, edge.to.nodeId, edge.to.portId)

    if (!roleCompatible(fromRole, toRole)) {
      warnings.push({
        id: `role_${edge.id}`,
        level: 'warn',
        message: `Odd connection: ${fromRole} → ${toRole}. (Check hot/cold or flow/return)`,
        edgeId: edge.id,
      })
    }
  }

  const portUse = new Map<string, number>()
  for (const edge of graph.edges) {
    const fromKey = `${edge.from.nodeId}:${edge.from.portId}`
    const toKey = `${edge.to.nodeId}:${edge.to.portId}`
    portUse.set(fromKey, (portUse.get(fromKey) ?? 0) + 1)
    portUse.set(toKey, (portUse.get(toKey) ?? 0) + 1)
  }

  for (const [key, count] of portUse.entries()) {
    if (count > 1) {
      warnings.push({
        id: `multi_${key}`,
        level: 'warn',
        message: `Port used ${count} times: ${key} (Tees not explicit yet).`,
      })
    }
  }

  return warnings
}

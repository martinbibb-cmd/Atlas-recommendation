import type { BuildEdge, BuildGraph, PartKind, PortRef } from './types'
import { portsForKind } from './ports'

const uid = (p = 'n') =>
  `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`

function edgeUsesPort(e: BuildEdge, ref: PortRef): boolean {
  return (
    (e.from.nodeId === ref.nodeId && e.from.portId === ref.portId) ||
    (e.to.nodeId === ref.nodeId && e.to.portId === ref.portId)
  )
}

function roleForPort(graph: BuildGraph, ref: PortRef): string {
  const node = graph.nodes.find(n => n.id === ref.nodeId)
  if (!node) return 'unknown'
  return portsForKind(node.kind).find(p => p.id === ref.portId)?.role ?? 'unknown'
}

function teeKindForRole(role: string): PartKind {
  if (role === 'hot') return 'tee_hot'
  if (role === 'cold') return 'tee_cold'
  if (role === 'return') return 'tee_ch_return'
  return 'tee_ch_flow'
}

function manifoldKindForRole(role: string): PartKind | null {
  if (role === 'hot') return 'manifold_hot'
  if (role === 'cold') return 'manifold_cold'
  return null
}

function manifoldOutPortCount(kind: PartKind): number {
  if (kind === 'manifold_hot') return 4
  if (kind === 'manifold_cold') return 5
  return 2
}

function portUseMap(graph: BuildGraph): Map<string, BuildEdge[]> {
  const m = new Map<string, BuildEdge[]>()
  for (const e of graph.edges) {
    const a = `${e.from.nodeId}:${e.from.portId}`
    const b = `${e.to.nodeId}:${e.to.portId}`
    m.set(a, [...(m.get(a) ?? []), e])
    m.set(b, [...(m.get(b) ?? []), e])
  }
  return m
}

/**
 * Normalizes a BuildGraph by inserting tee or manifold nodes wherever a single
 * port is directly connected to more than one other port.
 *
 * - 2 branches  → tee_hot / tee_cold / tee_ch_flow / tee_ch_return
 * - 3–5 branches of hot/cold role → manifold_hot / manifold_cold
 * - 3+ branches of flow/return role → tee (handles 2 branches; additional
 *   branches are left unmodified — a future pass can chain tees)
 *
 * The owner port gets exactly one connection to the tee/manifold trunk ('in').
 * All previously attached other-ends reconnect to the tee/manifold branch
 * ports ('out1', 'out2', …).
 *
 * Ports flagged `multi: true` (e.g., on-purpose bus ports) are skipped.
 */
export function normalizeGraph(graph: BuildGraph): BuildGraph {
  let next: BuildGraph = {
    ...graph,
    nodes: [...graph.nodes],
    edges: [...graph.edges],
  }

  // We iterate on a snapshot of the use-map so that insertions in one pass
  // don't confuse the iteration of subsequent ports.
  const use = portUseMap(next)

  for (const [key, edges] of use.entries()) {
    if (edges.length <= 1) continue

    const [nodeId, portId] = key.split(':')
    const ref: PortRef = { nodeId, portId }

    // Skip explicitly multi-enabled ports.
    const owner = next.nodes.find(n => n.id === nodeId)
    if (!owner) continue
    const portDef = portsForKind(owner.kind).find(p => p.id === portId)
    if (portDef?.multi) continue

    const role = roleForPort(next, ref)

    // Only normalise semantically meaningful branch roles.
    if (!['hot', 'cold', 'flow', 'return'].includes(role)) continue

    const branchCount = edges.length

    // Choose insert kind.
    let insertKind: PartKind
    let outPorts: string[]

    if (branchCount >= 3) {
      const manifold = manifoldKindForRole(role)
      if (manifold) {
        const maxOut = manifoldOutPortCount(manifold)
        insertKind = manifold
        outPorts = Array.from({ length: Math.min(branchCount, maxOut) }, (_, i) => `out${i + 1}`)
      } else {
        // flow / return with 3+ branches — use a tee for the first two,
        // leave the rest connected for a subsequent pass or manual fix.
        insertKind = teeKindForRole(role)
        outPorts = ['out1', 'out2']
      }
    } else {
      insertKind = teeKindForRole(role)
      outPorts = ['out1', 'out2']
    }

    const insertId = uid('insert')
    const insertNode = {
      id: insertId,
      kind: insertKind,
      x: owner.x + 120,
      y: owner.y + 40,
      r: 0,
    }

    // Remove all edges that touch this port (re-snapshotted for current next).
    const affected = next.edges.filter(e => edgeUsesPort(e, ref))
    next = {
      ...next,
      nodes: [...next.nodes, insertNode],
      edges: next.edges.filter(e => !edgeUsesPort(e, ref)),
    }

    // Connect owner port → insert trunk.
    next.edges = [
      ...next.edges,
      { id: uid('e'), from: ref, to: { nodeId: insertId, portId: 'in' } },
    ]

    // Reconnect each affected other-end → insert branch port.
    affected.forEach((e, idx) => {
      if (idx >= outPorts.length) return // skip if manifold has no spare output

      const other: PortRef =
        e.from.nodeId === nodeId && e.from.portId === portId ? e.to : e.from

      // Branch edges flow from insert output → downstream port,
      // preserving the physical direction: insert distributes to consumers.
      next.edges = [
        ...next.edges,
        {
          id: uid('e'),
          from: { nodeId: insertId, portId: outPorts[idx] },
          to: other,
        },
      ]
    })
  }

  return next
}

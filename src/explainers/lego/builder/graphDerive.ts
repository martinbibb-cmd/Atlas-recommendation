import type { BuildGraph, PortRef, OutletModel, ColdSourceKind, OutletServiceClass } from './types'
import { getPortDefs } from './portDefs'

export interface GraphFacts {
  hotFedOutletNodeIds: string[]
  coldOnlyOutletNodeIds: string[]
  hasStoredDhw: boolean
  /** True when the graph contains a combi boiler, which provides DHW internally. */
  hasCombiDhw: boolean
  /**
   * Per-outlet service model: service class (mixed/cold_only/hot_only) and the
   * cold-supply rail kind (mains or cws) for every outlet node in the graph.
   *
   * Populated by deriveFacts so that builder UI and Play mode can show which
   * cold rail each outlet is connected to and warn on pressure mismatches in
   * open-vented systems.
   */
  outletModels: Record<string, OutletModel>
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

  // ── Cold supply BFS — split by source kind ──────────────────────────────────
  //
  // CWS starts: gravity-fed cold from the Cold Water Storage cistern.
  //   Used by open-vented systems for both the vented cylinder and cold outlets
  //   that need to pressure-match the gravity-fed hot side.
  //
  // Mains starts: pressurised DCW from the mains.
  //   combi cold_in (DCW in), all ports on manifold_cold (which distributes
  //   mains cold — starting from all ports covers both direct connections to
  //   manifold:in and the typical manifold:outN → outlet:cold_in topology).

  const cwsColdStarts: string[] = []
  const mainsColdStarts: string[] = []

  for (const node of graph.nodes) {
    for (const port of getPortDefs(node.kind)) {
      if (node.kind === 'cws_cistern' && port.id === 'cold_out') {
        cwsColdStarts.push(`${node.id}:${port.id}`)
      } else if (node.kind === 'heat_source_combi' && port.id === 'cold_in') {
        // Combi cold_in is the mains DCW entry point.
        mainsColdStarts.push(`${node.id}:${port.id}`)
      } else if (node.kind === 'manifold_cold') {
        // manifold_cold distributes mains cold.  Start from both the inlet
        // (for edge cases where manifold:in is wired directly to an outlet) and
        // from every output port so the typical manifold:outN → outlet:cold_in
        // topology is correctly detected as mains-fed.
        mainsColdStarts.push(`${node.id}:${port.id}`)
      }
    }
  }

  const cwsColdReach = bfs(cwsColdStarts, adj)
  const mainsColdReach = bfs(mainsColdStarts, adj)

  const outletKinds = new Set(['tap_outlet', 'bath_outlet', 'shower_outlet', 'cold_tap_outlet'])
  const cylinderKinds = new Set(['dhw_unvented_cylinder', 'dhw_mixergy', 'dhw_vented_cylinder'])
  const hotFedOutletNodeIds: string[] = []
  const coldOnlyOutletNodeIds: string[] = []
  const hasStoredDhw = graph.nodes.some(node => cylinderKinds.has(node.kind))
  const hasCombiDhw = graph.nodes.some(node => node.kind === 'heat_source_combi')

  const outletModels: Record<string, OutletModel> = {}

  for (const node of graph.nodes) {
    if (!outletKinds.has(node.kind)) continue

    const hotInKey = `${node.id}:hot_in`
    const coldInKey = `${node.id}:cold_in`

    const hotFed = hotReach.has(hotInKey)
    const cwsColdFed = cwsColdReach.has(coldInKey)
    const mainsColdFed = mainsColdReach.has(coldInKey)
    const coldFed = cwsColdFed || mainsColdFed

    // Backward-compatible outlet lists
    if (hotFed) hotFedOutletNodeIds.push(node.id)
    else if (coldFed) coldOnlyOutletNodeIds.push(node.id)

    // Detailed outlet model: service class + cold source kind
    const serviceClass: OutletServiceClass =
      hotFed && coldFed ? 'mixed' :
      hotFed ? 'hot_only' :
      'cold_only'

    // Prefer CWS when both rails reach the outlet (open-vented with mains backup)
    const coldSourceKind: ColdSourceKind | undefined =
      cwsColdFed ? 'cws' :
      mainsColdFed ? 'mains' :
      undefined

    outletModels[node.id] = { serviceClass, coldSourceKind }
  }

  return { hotFedOutletNodeIds, coldOnlyOutletNodeIds, hasStoredDhw, hasCombiDhw, outletModels }
}

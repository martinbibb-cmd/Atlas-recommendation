// src/explainers/lego/types/graph.ts
//
// Canonical shared graph types used by both Edit (builder) and Play (simulation)
// modes.  BuildGraph is the builder-internal form; LabGraph is the common form
// that is passed between modes.
//
// PR1: Edit mode is the single source of truth.  Play mode consumes a deep
// clone of editorGraph produced via buildGraphToLabGraph() and must never
// rebuild topology from a template or system-type flag at play entry.

import type { BuildGraph } from '../builder/types'

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
  fromPort: string
  toNodeId: string
  toPort: string
  data?: Record<string, unknown>
}

export interface LabGraph {
  nodes: LabNode[]
  edges: LabEdge[]
}

// ─── Converter ────────────────────────────────────────────────────────────────

/**
 * Convert the builder-internal BuildGraph into the canonical LabGraph form.
 * Node and edge ids are preserved exactly — Play mode must never regenerate them.
 */
export function buildGraphToLabGraph(graph: BuildGraph): LabGraph {
  return {
    nodes: graph.nodes.map(n => ({
      id: n.id,
      kind: n.kind,
      x: n.x,
      y: n.y,
    })),
    edges: graph.edges.map(e => ({
      id: e.id,
      fromNodeId: e.from.nodeId,
      fromPort: e.from.portId,
      toNodeId: e.to.nodeId,
      toPort: e.to.portId,
    })),
  }
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

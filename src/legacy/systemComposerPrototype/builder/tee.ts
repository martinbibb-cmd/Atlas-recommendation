import type { BuildEdge, BuildGraph, PartKind, PortRef } from './types';

const uid = (p = 'n') =>
  `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

/** X/Y offset applied to tee placement relative to the target node. */
const TEE_PLACEMENT_OFFSET = 40;
/** Fallback canvas X position when target node is not found. */
const FALLBACK_CANVAS_X = 400;
/** Fallback canvas Y position when target node is not found. */
const FALLBACK_CANVAS_Y = 240;

function edgeUsesPort(e: BuildEdge, ref: PortRef): boolean {
  return (
    (e.from.nodeId === ref.nodeId && e.from.portId === ref.portId) ||
    (e.to.nodeId === ref.nodeId && e.to.portId === ref.portId)
  );
}

/** Selects the appropriate tee kind based on the fluid role. */
export function teeKindForRole(role: string | undefined): PartKind {
  if (role === 'hot') return 'tee_hot';
  if (role === 'cold') return 'tee_cold';
  if (role === 'return') return 'tee_ch_return';
  return 'tee_ch_flow';
}

/**
 * Inserts a tee node to handle the case where `target` port is already
 * occupied by an existing edge. The function:
 *   1. Removes the existing edge that uses target.
 *   2. Rewires: target → tee.in, existingOtherEnd → tee.out2, incoming → tee.out1.
 *   3. Returns the updated graph.
 */
export function insertTee(params: {
  graph: BuildGraph;
  target: PortRef;
  incoming: PortRef;
  role: 'hot' | 'cold' | 'flow' | 'return' | 'unknown';
}): BuildGraph {
  const { graph, target, incoming, role } = params;
  const teeKind = teeKindForRole(role);
  const teeId = uid('tee');

  const targetNode = graph.nodes.find(n => n.id === target.nodeId);
  const teeX = (targetNode?.x ?? FALLBACK_CANVAS_X) + TEE_PLACEMENT_OFFSET;
  const teeY = (targetNode?.y ?? FALLBACK_CANVAS_Y) + TEE_PLACEMENT_OFFSET;

  const teeNode = { id: teeId, kind: teeKind, x: teeX, y: teeY, r: 0 };

  const existing = graph.edges.find(e => edgeUsesPort(e, target));

  if (!existing) {
    return {
      ...graph,
      nodes: [...graph.nodes, teeNode],
      edges: [
        ...graph.edges,
        { id: uid('e'), from: target, to: { nodeId: teeId, portId: 'in' } },
        { id: uid('e'), from: incoming, to: { nodeId: teeId, portId: 'out1' } },
      ],
    };
  }

  const edges = graph.edges.filter(e => e.id !== existing.id);

  const otherEnd: PortRef =
    existing.from.nodeId === target.nodeId && existing.from.portId === target.portId
      ? existing.to
      : existing.from;

  const newEdges: BuildEdge[] = [
    { id: uid('e'), from: target, to: { nodeId: teeId, portId: 'in' } },
    { id: uid('e'), from: otherEnd, to: { nodeId: teeId, portId: 'out2' } },
    { id: uid('e'), from: incoming, to: { nodeId: teeId, portId: 'out1' } },
  ];

  return {
    ...graph,
    nodes: [...graph.nodes, teeNode],
    edges: [...edges, ...newEdges],
  };
}

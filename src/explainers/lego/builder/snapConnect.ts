import type { BuildGraph, BuildNode, PortDef, PortRef } from './types';
import { getPortDefs } from './portDefs';
import { getSnapRole, isSnapAllowed } from './snapRoles';

export interface SnapCandidate {
  from: PortRef;
  to: PortRef;
  dist: number;
}

/** Absolute canvas position of a port on a given node. */
export function portAbs(node: BuildNode, portId: string): { x: number; y: number; role: PortDef['role'] } {
  const p = getPortDefs(node.kind).find(x => x.id === portId);
  if (!p) return { x: node.x, y: node.y, role: 'unknown' };
  return { x: node.x + p.dx, y: node.y + p.dy, role: p.role ?? 'unknown' };
}

/** Returns true if two port roles are compatible for a direct connection. */
export function rolesCompatible(a: PortDef['role'], b: PortDef['role']): boolean {
  if (a === 'unknown' || b === 'unknown') return true;
  if (a === b) return true;
  const flowish = new Set<string>(['flow', 'return', 'store']);
  if (flowish.has(a as string) && flowish.has(b as string)) return true;
  if ((a === 'hot' && b === 'cold') || (a === 'cold' && b === 'hot')) return false;
  return false;
}

/**
 * Scans all ports on all non-moving nodes and returns the closest compatible
 * port pair within maxDistPx, or null if none found.
 */
export function findSnapCandidate(params: {
  graph: BuildGraph;
  movingNodeId: string;
  maxDistPx: number;
}): SnapCandidate | null {
  const { graph, movingNodeId, maxDistPx } = params;
  const moving = graph.nodes.find(n => n.id === movingNodeId);
  if (!moving) return null;

  const movingPorts = getPortDefs(moving.kind);
  let best: SnapCandidate | null = null;

  for (const mp of movingPorts) {
    const ma = portAbs(moving, mp.id);

    for (const other of graph.nodes) {
      if (other.id === movingNodeId) continue;
      const ops = getPortDefs(other.kind);

      for (const op of ops) {
        const ob = portAbs(other, op.id);
        const dx = ma.x - ob.x;
        const dy = ma.y - ob.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxDistPx) continue;
        if (!rolesCompatible(ma.role, ob.role)) continue;
        // Role-based snap constraint: component placement rules take precedence
        // over pure port-role compatibility (e.g. pump only on flow, not return).
        if (!isSnapAllowed(getSnapRole(moving.kind), ma.role, ob.role)) continue;

        // Graph-context constraint: loads must not bypass controls.
        // When the graph already contains one or more control valves (zone_valve,
        // three_port_valve), a load's flow_in port may NOT snap directly to a
        // heat source or pump.  This enforces the flow-side sequencing:
        //   heat_source → pump → [control] → load
        // If no controls are present (simple combi-only setup) the direct
        // heat_source → load connection is allowed.
        if (
          getSnapRole(moving.kind) === 'load' &&
          ma.role === 'flow' &&
          (getSnapRole(other.kind) === 'heat_source' || getSnapRole(other.kind) === 'pump') &&
          graph.nodes.some(n => n.id !== movingNodeId && getSnapRole(n.kind) === 'control')
        ) continue;

        const cand: SnapCandidate = {
          from: { nodeId: movingNodeId, portId: mp.id },
          to: { nodeId: other.id, portId: op.id },
          dist: d,
        };
        if (!best || cand.dist < best.dist) best = cand;
      }
    }
  }

  return best;
}

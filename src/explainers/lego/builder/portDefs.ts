/**
 * portDefs — shared registry-first port definition resolver.
 *
 * Single canonical entry point for converting a PartKind to its PortDef array.
 *
 * Resolution order:
 *  1. SCHEMATIC_REGISTRY — for all migrated component kinds (boilers, cylinders,
 *     valves, emitters, pumps, system-support).  Positions are derived from the
 *     normalised side/x layout in the registry, ensuring the rendered port
 *     circles, snap zones, hit-test areas and pipe endpoints all share the same
 *     geometry.
 *  2. portsForKind() fallback — for kinds not yet in the registry (tees,
 *     manifolds, outlets).  These fall back gracefully without error.
 *
 * All builder geometry code (WorkbenchCanvas, snapConnect, normalizeGraph,
 * graphDerive, graphValidate, BuilderShell) must import getPortDefs from here
 * rather than calling portsForKind directly, so that a single registry update
 * propagates everywhere without per-file edits.
 */

import type { PartKind, PortDef } from './types';
import { portsForKind } from './ports';
import { SCHEMATIC_REGISTRY, schematicPortToDxDy } from './schematicBlocks';

/**
 * Schematic semantic roles that map to a valid PortDef role directly.
 * Roles not in this set (e.g. 'vent', 'feed') are treated as 'unknown'
 * for snap-compatibility purposes — the component-level isSnapAllowed
 * constraint enforces the correct placement rules for those components.
 */
const VALID_PORT_ROLES = new Set<string>([
  'cold', 'hot', 'flow', 'return', 'store', 'outlet', 'unknown',
]);

/**
 * Derive port definitions for a component kind.
 *
 * For kinds registered in SCHEMATIC_REGISTRY the positions are computed from
 * the registry geometry (side + normalised x, component width/height), which
 * is the same geometry used by the schematic artwork renderer.
 *
 * For unregistered kinds the result falls back to the legacy portsForKind()
 * absolute-pixel table.
 */
export function getPortDefs(kind: PartKind): PortDef[] {
  const reg = SCHEMATIC_REGISTRY[kind];
  if (reg) {
    return reg.ports.map(p => {
      const { dx, dy } = schematicPortToDxDy(p, reg.width, reg.height);
      const semanticRole = p.semanticRole ?? 'unknown';
      return {
        id: p.id,
        dx,
        dy,
        role: (VALID_PORT_ROLES.has(semanticRole)
          ? semanticRole as PortDef['role']
          : 'unknown'),
        label: p.label,
        direction: p.direction,
      };
    });
  }
  return portsForKind(kind);
}

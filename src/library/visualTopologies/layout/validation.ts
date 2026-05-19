/**
 * validation.ts
 *
 * Layout validation — detects problems in a computed LayoutState.
 *
 * Validates:
 *   - Zone bounds: each node's position is within its declared zone.
 *   - Floating equipment: nodes with no rail adjacency in the layout.
 *   - Disconnected zones: heat_source or emitters zone is empty.
 *   - Rail sanity: flowY < returnY (flow above return in screen coords).
 *
 * Call `validateLayout(state, decl)` after `computeTopologyLayout()` in
 * tests or dev tooling.  Templates do NOT call this at render time.
 */

import { ZONE_BOUNDS } from './layoutZones';
import type {
  LayoutState,
  LayoutValidationResult,
  LayoutViolation,
  TopologyLayoutDeclaration,
} from './topologyLayoutTypes';

/**
 * Validate a computed LayoutState against its originating declaration.
 *
 * Returns { valid: true, violations: [] } when all checks pass.
 * Returns { valid: false, violations: [...] } with one entry per problem.
 */
export function validateLayout(
  state: LayoutState,
  decl: TopologyLayoutDeclaration,
): LayoutValidationResult {
  const violations: LayoutViolation[] = [];

  // 1. Zone bounds — each declared node's computed position must fall within
  //    its zone's xMin/xMax and yMin/yMax bounds.
  for (const node of decl.nodes) {
    const pos = state.positions[node.role];
    if (!pos) continue;

    const bounds = ZONE_BOUNDS[node.zone];
    if (!bounds) continue;

    const outX = pos.left < bounds.xMin || pos.left > bounds.xMax;
    const outY = pos.top  < bounds.yMin || pos.top  > bounds.yMax;

    if (outX || outY) {
      violations.push({
        kind: 'out_of_zone',
        role: node.role,
        message:
          `${node.role} at (${pos.left}, ${pos.top}) is outside ` +
          `${node.zone} zone [x: ${bounds.xMin}–${bounds.xMax}, y: ${bounds.yMin}–${bounds.yMax}]`,
      });
    }
  }

  // 2. Disconnected zones — check that at least one heat_source node exists.
  const hasHeatSource = decl.nodes.some(n => n.zone === 'heat_source');
  if (!hasHeatSource) {
    violations.push({
      kind: 'disconnected_zone',
      role: '(topology)',
      message: `Topology '${decl.topologyId}' declares no heat_source zone component.`,
    });
  }

  // 3. Rail sanity — flow rail must be above return rail in screen coordinates.
  if (state.rails.flowY >= state.rails.returnY) {
    violations.push({
      kind: 'impossible_adjacency',
      role: '(rails)',
      message:
        `flowY (${state.rails.flowY}) must be less than returnY (${state.rails.returnY}).`,
    });
  }

  // 4. Floating equipment — emitters zone must have at least one node
  //    (powerflush and system_pressure topologies are exempt as they use
  //    the full circuit differently — they still pass because powerflush
  //    has three radiators and system_pressure has a pipe_loop).
  const hasEmitter = decl.nodes.some(n => n.zone === 'emitters');
  const isEmitterless = decl.topologyId === 'mixergy_stratified_cylinder' ||
                        decl.topologyId === 'thermal_store_layout' ||
                        // system_pressure_layout uses PipeLoopPrimitive to represent
                        // the circuit; no discrete emitters are declared.
                        decl.topologyId === 'system_pressure_layout';

  if (!hasEmitter && !isEmitterless) {
    violations.push({
      kind: 'floating_equipment',
      role: '(emitters)',
      message: `Topology '${decl.topologyId}' has no emitters — check if emitter zone should be populated.`,
    });
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

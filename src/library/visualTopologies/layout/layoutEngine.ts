/**
 * layoutEngine.ts
 *
 * Zone layout engine — computes LayoutState from a TopologyLayoutDeclaration.
 *
 * Each topology template calls `computeTopologyLayout(declaration)` once
 * (at module level — it is pure, deterministic, and allocation-light).
 * The returned LayoutState is consumed by rendering; templates contain
 * NO literal x/y coordinates.
 *
 * Position rules (LeftRule / TopRule) are evaluated here against the
 * topology's specific flow/return rail heights.  See topologyLayoutTypes.ts
 * for the full rule vocabulary.
 */

import {
  DESKTOP_CANVAS,
  EMITTER_TOP_Y,
  EMITTER_SPUR_Y,
  HEADER_TANK_TOP,
  HEAT_SOURCE_DEFAULT_LEFT,
  RAIL_HEIGHTS,
} from './layoutZones';
import type {
  LayoutState,
  LeftRule,
  NodePosition,
  TopologyLayoutDeclaration,
  TopRule,
} from './topologyLayoutTypes';

// ─── Rule evaluators ──────────────────────────────────────────────────────────

function evalLeft(rule: LeftRule): number {
  switch (rule.kind) {
    case 'heat_source_default':
      return HEAT_SOURCE_DEFAULT_LEFT + (rule.offset ?? 0);
    case 'emitter':
      return rule.emitterLeft;
    case 'storage_anchor':
      return rule.storageLeft;
    case 'zone_anchor':
      return rule.x;
    case 'const':
      return rule.value;
  }
}

function evalTop(rule: TopRule, flowY: number, returnY: number): number {
  switch (rule.kind) {
    case 'flow_offset':
      return flowY + rule.offset;
    case 'return_offset':
      return returnY + rule.offset;
    case 'emitter_top':
      return EMITTER_TOP_Y;
    case 'header_tank_top':
      return HEADER_TANK_TOP;
    case 'const':
      return rule.value;
  }
}

// ─── Engine entry point ───────────────────────────────────────────────────────

/**
 * Compute a LayoutState from a topology layout declaration.
 *
 * Pure function — no side effects; safe to call at module scope.
 * Returns an immutable LayoutState consumed only by rendering code.
 */
export function computeTopologyLayout(decl: TopologyLayoutDeclaration): LayoutState {
  const { flowY, returnY } = RAIL_HEIGHTS[decl.flowRailMode];

  const positions: Record<string, NodePosition> = {};
  for (const node of decl.nodes) {
    positions[node.role] = {
      left: evalLeft(node.leftRule),
      top: evalTop(node.topRule, flowY, returnY),
    };
  }

  return {
    positions,
    rails: {
      flowY,
      returnY,
      emitterTopY: EMITTER_TOP_Y,
      emitterSpurY: EMITTER_SPUR_Y,
    },
    pipe: {
      flowRailStartX:      decl.pipe.flowRailStartX,
      flowRailEndX:        decl.pipe.flowRailEndX,
      heatSourceReturnX:   decl.pipe.heatSourceReturnX,
      heatSourceReturnY:   decl.pipe.heatSourceReturnY,
    },
    canvas: DESKTOP_CANVAS,
  };
}

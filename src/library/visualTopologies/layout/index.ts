/**
 * index.ts — public API for the topology layout engine.
 *
 * Import from here in templates and tests; never from individual sub-modules
 * to keep the API surface stable.
 */

export { computeTopologyLayout } from './layoutEngine';
export { getTopologyLayoutDeclaration } from './topologyDeclarations';
export {
  routeEmitterSpurs,
  routeFlowRail,
  routeReturnRail,
  routeVertical,
  RADIATOR_FLOW_SPUR_OFFSET,
  RADIATOR_RETURN_SPUR_OFFSET,
} from './routingEngine';
export { validateLayout } from './validation';
export { ZONE_BOUNDS, DESKTOP_CANVAS, RAIL_HEIGHTS, EMITTER_TOP_Y, EMITTER_SPUR_Y } from './layoutZones';
export type {
  LayoutState,
  LayoutValidationResult,
  LayoutViolation,
  NodePosition,
  PipeSegment,
  PipeRailGeometry,
  RailLayout,
  TopologyLayoutDeclaration,
} from './topologyLayoutTypes';

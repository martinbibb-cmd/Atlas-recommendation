/**
 * topologyLayoutTypes.ts
 *
 * Core types for the rule-driven topology layout engine.
 *
 * Three-layer separation (matches problem-statement §6):
 *   1. TopologyLayoutDeclaration  — topology graph / semantic description
 *   2. LayoutState                — computed layout (consumed by rendering)
 *   3. PipeSegment                — routing engine output (consumed by PipeLayer)
 *
 * Templates must ONLY reference LayoutState — no literal x/y numbers.
 */

import type { InstallationZone, RoutingRail } from '../../visualPrimitives/primitiveTokens';

// ─── Canvas ───────────────────────────────────────────────────────────────────

export interface CanvasDims {
  readonly width: number;
  readonly height: number;
}

// ─── Rail layout (computed) ───────────────────────────────────────────────────

export interface RailLayout {
  /** Primary CH flow horizontal rail y-coordinate. */
  readonly flowY: number;
  /** Primary CH return horizontal rail y-coordinate. */
  readonly returnY: number;
  /** Top of the emitter zone — radiator top-left y anchor. */
  readonly emitterTopY: number;
  /** y where radiator body ends and spurs tee off to/from rails. */
  readonly emitterSpurY: number;
}

// ─── Node position (computed) ─────────────────────────────────────────────────

export interface NodePosition {
  readonly left: number;
  readonly top: number;
}

// ─── Pipe rail geometry (computed) ────────────────────────────────────────────

/**
 * Key x-positions for the primary circuit rails.
 * These are derived from component positions and topology-specific routing rules,
 * not hardcoded in templates.
 */
export interface PipeRailGeometry {
  /** x where flow rail departs from the heat source connection. */
  readonly flowRailStartX: number;
  /** x where flow rail arrives at the storage / right-side terminus. */
  readonly flowRailEndX: number;
  /** x where the return vertical connects back to the heat source. */
  readonly heatSourceReturnX: number;
  /** y where the return vertical ends at the heat source (mid-body connection). */
  readonly heatSourceReturnY: number;
}

// ─── Full layout state (consumed by rendering) ────────────────────────────────

export interface LayoutState {
  readonly positions: Record<string, NodePosition>;
  readonly rails: RailLayout;
  readonly pipe: PipeRailGeometry;
  readonly canvas: CanvasDims;
}

// ─── Pipe segment (routing engine output) ────────────────────────────────────

export interface PipeSegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly rail: RoutingRail;
  /** 'main' = primary circuit ring; 'branch' = radiator drop / cylinder spur. */
  readonly strokeKind: 'main' | 'branch';
  readonly testId?: string;
}

// ─── Validation result ────────────────────────────────────────────────────────

export interface LayoutViolation {
  readonly kind:
    | 'out_of_zone'
    | 'floating_equipment'
    | 'impossible_adjacency'
    | 'disconnected_zone';
  readonly role: string;
  readonly message: string;
}

export interface LayoutValidationResult {
  readonly valid: boolean;
  readonly violations: readonly LayoutViolation[];
}

// ─── Declaration types (topology semantic layer) ──────────────────────────────

/**
 * How a node's left x-coordinate is derived.
 * All rules produce a deterministic number given the topology's rail layout.
 */
export type LeftRule =
  /** heat_source_default_left + optional pixel offset */
  | { readonly kind: 'heat_source_default'; readonly offset?: number }
  /** Specific emitter x position within the emitters zone */
  | { readonly kind: 'emitter'; readonly emitterLeft: number }
  /** Storage anchor x (cylinder / thermal store left edge) */
  | { readonly kind: 'storage_anchor'; readonly storageLeft: number }
  /** Service/protection component with known x */
  | { readonly kind: 'zone_anchor'; readonly x: number }
  /** Raw constant — only for KNOWN_OUT_OF_ZONE placements (powerflush boiler, etc.) */
  | { readonly kind: 'const'; readonly value: number };

/**
 * How a node's top y-coordinate is derived.
 * Expressed relative to flow/return rails or canonical zone anchors.
 */
export type TopRule =
  /** flowRailY + offset (positive = below rail) */
  | { readonly kind: 'flow_offset'; readonly offset: number }
  /** returnRailY + offset (negative = above return rail) */
  | { readonly kind: 'return_offset'; readonly offset: number }
  /** Canonical emitter top — fixed at EMITTER_TOP_Y */
  | { readonly kind: 'emitter_top' }
  /** Loft/header tank — fixed at HEADER_TANK_TOP */
  | { readonly kind: 'header_tank_top' }
  /** Raw constant — for components that don't follow rail-relative rules */
  | { readonly kind: 'const'; readonly value: number };

export type FlowRailMode = 'standard' | 'elevated_thermal' | 'elevated_mixergy';

export interface NodePlacementDecl {
  readonly role: string;
  readonly zone: InstallationZone;
  readonly leftRule: LeftRule;
  readonly topRule: TopRule;
}

/**
 * Pipe rail connection geometry declaration.
 * These x/y values drive where the horizontal and vertical pipe stubs connect.
 * Expressed semantically — templates use the computed values, not literals.
 */
export interface PipeRailDecl {
  /**
   * x where the horizontal flow rail starts (right side of heat source connection).
   * Derived: heatSource.left + BOILER_FLOW_CONNECT_OFFSET[variant].
   */
  readonly flowRailStartX: number;
  /**
   * x where the horizontal flow rail ends at the storage/right terminus.
   * Typically storage.left for cylinder topologies.
   */
  readonly flowRailEndX: number;
  /**
   * x of the heat source return vertical (both the flow-rail x and return-side x).
   * Typically same as flowRailStartX for single-column heat sources.
   */
  readonly heatSourceReturnX: number;
  /**
   * y where the return vertical terminates at the heat source.
   * Derived: heatSource.top + BOILER_SM_H / 2 (mid-body return connection).
   */
  readonly heatSourceReturnY: number;
}

export interface TopologyLayoutDeclaration {
  readonly topologyId: string;
  readonly flowRailMode: FlowRailMode;
  readonly nodes: readonly NodePlacementDecl[];
  readonly pipe: PipeRailDecl;
  /**
   * When true, the topology intentionally has no emitter-zone nodes.
   * Examples: thermal_store_layout (no discrete radiators in the diagram),
   * system_pressure_layout (uses PipeLoopPrimitive instead of emitters).
   * The validation engine skips the floating-equipment check for these.
   */
  readonly isEmitterless?: boolean;
}

// ─── Domestic cold-source model ───────────────────────────────────────────────

/**
 * The physical cold-supply rail from which a cold or mixed outlet draws its
 * cold water.
 *
 * mains — pressurised mains cold rail (DCW); used in combi and unvented systems.
 * cws   — gravity-fed cold rail from the Cold Water Storage cistern; used in
 *         open-vented systems so bath/shower/basin cold pressure matches the
 *         vented hot side.
 */
export type ColdSourceKind = 'mains' | 'cws'

/**
 * The service class of a domestic outlet — describes which supply types the
 * outlet draws from.
 *
 * mixed    — outlet uses both hot and cold supplies (bath, shower, basin mixer).
 * cold_only — outlet draws only cold water (cold tap, drinking-water tap).
 * hot_only  — outlet draws only hot water (rare; e.g. a direct hot-fill outlet).
 */
export type OutletServiceClass = 'cold_only' | 'mixed' | 'hot_only'

/**
 * Model for a single domestic outlet, capturing its service class and the
 * cold-supply rail it is connected to.
 *
 * coldSourceKind is undefined when no cold supply is connected (e.g. a
 * hot-only outlet or a disconnected outlet node).
 */
export interface OutletModel {
  serviceClass: OutletServiceClass
  coldSourceKind?: ColdSourceKind
}

export type PartKind =
  | 'heat_source_combi'
  | 'heat_source_system_boiler'
  | 'heat_source_regular_boiler'
  | 'heat_source_heat_pump'
  | 'dhw_unvented_cylinder'
  | 'dhw_mixergy'
  | 'dhw_vented_cylinder'
  | 'feed_and_expansion'
  | 'open_vent'
  | 'cws_cistern'
  | 'pump'
  | 'sealed_system_kit'
  | 'zone_valve'
  | 'three_port_valve'
  | 'buffer'
  | 'low_loss_header'
  | 'radiator_loop'
  | 'ufh_loop'
  | 'tap_outlet'
  | 'bath_outlet'
  | 'shower_outlet'
  | 'cold_tap_outlet'
  | 'tee_hot'
  | 'tee_cold'
  | 'tee_ch_flow'
  | 'tee_ch_return'
  | 'manifold_hot'
  | 'manifold_cold';

// ─── Re-exports from schematic block library ──────────────────────────────────

export type { CylinderModel, StorageKind, SupplyKind, HeatSourceKind, StructuralZone, StructuralPlacement } from './schematicBlocks';

export interface BuildNode {
  id: string;
  kind: PartKind;
  x: number;
  y: number;
  r: number;
  /**
   * Optional structural placement for this component instance.
   *
   * When set, it overrides the default zone derived by `defaultZoneForKind()`
   * for this specific node.  When omitted, callers should fall back to
   * `defaultZoneForKind(node.kind)` to determine where the component lives.
   */
  placement?: import('./schematicBlocks').StructuralPlacement;
}

export interface PortRef {
  nodeId: string;
  portId: string;
}

export interface EdgeMeta {
  roleFrom?: PortDef['role'];
  roleTo?: PortDef['role'];
}

export interface BuildEdge {
  id: string;
  from: PortRef;
  to: PortRef;
  /** Explicit circuit domain for this edge.  When omitted, buildGraphToLabGraph()
   *  infers the domain from the port IDs as a migration fallback. */
  domain?: import('../types/graph').CircuitDomain;
  meta?: EdgeMeta;
}

export interface PortDef {
  id: string;
  dx: number;
  dy: number;
  role?: 'cold' | 'hot' | 'flow' | 'return' | 'store' | 'outlet' | 'unknown';
  /** Human-readable label shown next to the port circle. */
  label?: string;
  /** Flow direction through this port — used to render arrows and guide snapping. */
  direction?: 'in' | 'out' | 'bidirectional';
  /** When true, this port can accept multiple direct connections without requiring a tee. */
  multi?: boolean;
}

export interface BuildGraph {
  nodes: BuildNode[];
  edges: BuildEdge[];
  /**
   * Maps outlet slot labels (e.g. 'A', 'B', 'C', 'D', …) to the graph node ID
   * of the outlet node assigned to that slot.  The slot labels are generated
   * sequentially by `nextOutletSlot()` in smartAttach.ts.
   *
   * Previously typed as `Partial<Record<OutletSlotId, string>>` with a hard
   * maximum of three slots (A / B / C).  Now a plain `Record<string, string>`
   * so that an arbitrary number of outlets can be bound.
   */
  outletBindings?: Record<string, string>;
}

/**
 * Outlet slot identifier — a single uppercase letter ('A', 'B', 'C', 'D', …).
 * Generated sequentially by `nextOutletSlot()` in smartAttach.ts.
 * Previously restricted to 'A' | 'B' | 'C'; now an open string type.
 */
export type OutletSlotId = string;

export interface PaletteItem {
  kind: PartKind;
  label: string;
  emoji: string;
  /** Which toolbox category this item belongs to. */
  category: PaletteCategory;
}

/**
 * Component palette categories.
 *
 * Maps directly to the toolbox sections in PalettePanel.
 * Every PaletteItem must declare a category.
 */
export type PaletteCategory =
  | 'heat_sources'
  | 'cylinders'
  | 'controls'
  | 'emitters'
  | 'system_support'
  | 'outlets';

/**
 * One collapsible section in the component palette.
 */
export interface PaletteSection {
  category: PaletteCategory;
  label: string;
  items: PaletteItem[];
}

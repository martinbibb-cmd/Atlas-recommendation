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
  | 'tee_ch_return';

export interface BuildNode {
  id: string;
  kind: PartKind;
  x: number;
  y: number;
  r: number;
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
  meta?: EdgeMeta;
}

export interface PortDef {
  id: string;
  dx: number;
  dy: number;
  role?: 'cold' | 'hot' | 'flow' | 'return' | 'store' | 'outlet' | 'unknown';
  /** When true, this port can accept multiple direct connections without requiring a tee. */
  multi?: boolean;
}

export interface BuildGraph {
  nodes: BuildNode[];
  edges: BuildEdge[];
  outletBindings?: Partial<Record<OutletSlotId, string>>;
}

export type OutletSlotId = 'A' | 'B' | 'C';

export interface PaletteItem {
  kind: PartKind;
  label: string;
  emoji: string;
}

export type PartKind =
  | 'heat_source_boiler'
  | 'heat_source_ashp'
  | 'dhw_unvented_cylinder'
  | 'dhw_mixergy'
  | 'dhw_vented_cylinder'
  | 'pump'
  | 'zone_valve'
  | 'three_port_valve'
  | 'buffer'
  | 'low_loss_header'
  | 'radiator_loop'
  | 'ufh_loop'
  | 'tap_outlet'
  | 'bath_outlet'
  | 'shower_outlet';

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

export interface BuildEdge {
  id: string;
  from: PortRef;
  to: PortRef;
}

export interface PortDef {
  id: string;
  dx: number;
  dy: number;
  role?: 'cold' | 'hot' | 'flow' | 'return' | 'store' | 'outlet' | 'unknown';
}

export interface BuildGraph {
  nodes: BuildNode[];
  edges: BuildEdge[];
}

export interface PaletteItem {
  kind: PartKind;
  label: string;
  emoji: string;
}

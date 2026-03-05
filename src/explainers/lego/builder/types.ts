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
  x: number;   // canvas px
  y: number;   // canvas px
  r: number;   // rotation degrees
}

export interface BuildEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  // future: port ids, pipe diameter, direction, etc.
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

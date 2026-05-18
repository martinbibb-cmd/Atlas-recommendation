import type { VisualTopologyId } from '../visualTopologies/visualTopologyRegistry';

export interface TopologyAnchorPoint {
  id: string;
  x: number;
  y: number;
}

const ANCHORS_BY_TOPOLOGY: Partial<Record<VisualTopologyId, readonly TopologyAnchorPoint[]>> = {
  abv_protected_heating_loop: [
    { id: 'abv', x: 556, y: 214 },
    { id: 'pump', x: 190, y: 272 },
    { id: 'flow_header', x: 430, y: 140 },
    { id: 'return_header', x: 430, y: 300 },
    { id: 'radiator_branch', x: 420, y: 114 },
  ],
  magnetic_filter_on_return: [
    { id: 'filter', x: 540, y: 266 },
    { id: 'boiler_return', x: 140, y: 300 },
    { id: 'boiler_body', x: 102, y: 190 },
    { id: 'return_pipe', x: 420, y: 300 },
    { id: 'radiator_branch', x: 392, y: 120 },
  ],
  system_pressure_layout: [
    { id: 'loop', x: 358, y: 210 },
    { id: 'expansion_vessel', x: 492, y: 244 },
    { id: 'gauge_low', x: 646, y: 94 },
    { id: 'gauge_normal', x: 646, y: 202 },
    { id: 'gauge_high', x: 646, y: 314 },
  ],
  mixergy_stratified_cylinder: [
    { id: 'cylinder_top', x: 506, y: 166 },
    { id: 'thermocline', x: 506, y: 222 },
    { id: 'cylinder_bottom', x: 506, y: 288 },
    { id: 'charge_input', x: 398, y: 190 },
    { id: 'hot_draw_off', x: 540, y: 178 },
  ],
  powerflush_service_layout: [
    { id: 'machine', x: 88, y: 212 },
    { id: 'dirty_path', x: 170, y: 174 },
    { id: 'clean_path', x: 170, y: 252 },
    { id: 'radiator_loop', x: 470, y: 120 },
    { id: 'filter', x: 580, y: 266 },
  ],
};

export function getTopologyOverlayAnchors(topologyId: VisualTopologyId): readonly TopologyAnchorPoint[] {
  return ANCHORS_BY_TOPOLOGY[topologyId] ?? [];
}

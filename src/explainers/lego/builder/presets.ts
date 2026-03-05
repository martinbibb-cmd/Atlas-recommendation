import type { LabControls } from '../animation/types';
import type { BuildGraph, BuildNode, PartKind } from './types';

export interface LabPreset {
  id: string;
  title: string;
  blurb: string;
  graph: BuildGraph;
  controlsPatch?: Partial<LabControls>;
}

const n = (id: string, kind: PartKind, x: number, y: number): BuildNode => ({ id, kind, x, y, r: 0 });
const e = (id: string, aNode: string, aPort: string, bNode: string, bPort: string) => ({
  id,
  from: { nodeId: aNode, portId: aPort },
  to: { nodeId: bNode, portId: bPort },
});

export const PRESETS: LabPreset[] = [
  {
    id: 'combi_dhw_only',
    title: 'Combi — DHW only (TMV shower)',
    blurb: 'Classic combi DHW plate HEX feeding a TMV shower + cold feed.',
    graph: {
      nodes: [n('hs', 'heat_source_combi', 220, 240), n('sh', 'shower_outlet', 640, 210)],
      edges: [e('p1', 'hs', 'hot_out', 'sh', 'hot_in'), e('p2', 'hs', 'cold_in', 'sh', 'cold_in')],
      outletBindings: { A: 'sh' },
    },
    controlsPatch: { dhwSetpointC: 55, coldInletC: 10, mainsDynamicFlowLpm: 13, combiDhwKw: 30 },
  },
  {
    id: 'combi_dhw_ch',
    title: 'Combi — DHW + CH',
    blurb: 'DHW to outlet + CH loop to radiators (primary flow/return).',
    graph: {
      nodes: [
        n('hs', 'heat_source_combi', 220, 240),
        n('rads', 'radiator_loop', 520, 340),
        n('sh', 'shower_outlet', 640, 210),
      ],
      edges: [
        e('d1', 'hs', 'hot_out', 'sh', 'hot_in'),
        e('d2', 'hs', 'cold_in', 'sh', 'cold_in'),
        e('c1', 'hs', 'ch_flow_out', 'rads', 'flow_in'),
        e('c2', 'rads', 'return_out', 'hs', 'ch_return_in'),
      ],
      outletBindings: { A: 'sh' },
    },
    controlsPatch: { dhwSetpointC: 55, coldInletC: 10, mainsDynamicFlowLpm: 13, combiDhwKw: 30 },
  },
  {
    id: 'system_boiler_unvented',
    title: 'System boiler + unvented cylinder',
    blurb: 'Sealed CH + cylinder coil for DHW store.',
    graph: {
      nodes: [
        n('hs', 'heat_source_system_boiler', 200, 260),
        n('cyl', 'dhw_unvented_cylinder', 520, 180),
        n('rads', 'radiator_loop', 520, 360),
        n('sh', 'shower_outlet', 780, 170),
      ],
      edges: [
        e('ch1', 'hs', 'ch_flow_out', 'rads', 'flow_in'),
        e('ch2', 'rads', 'return_out', 'hs', 'ch_return_in'),
        e('co1', 'hs', 'coil_flow', 'cyl', 'coil_flow'),
        e('co2', 'cyl', 'coil_return', 'hs', 'coil_return'),
        e('dh1', 'cyl', 'hot_out', 'sh', 'hot_in'),
        e('dh2', 'cyl', 'cold_in', 'sh', 'cold_in'),
      ],
      outletBindings: { A: 'sh' },
    },
    controlsPatch: { coldInletC: 10, mainsDynamicFlowLpm: 18 },
  },
  {
    id: 'regular_boiler_vented',
    title: 'Regular boiler + vented cylinder (open vent)',
    blurb: 'Open-vented CH representation with F&E + vent tokens.',
    graph: {
      nodes: [
        n('hs', 'heat_source_regular_boiler', 200, 280),
        n('fe', 'feed_and_expansion', 200, 140),
        n('ov', 'open_vent', 200, 200),
        n('cyl', 'dhw_vented_cylinder', 520, 180),
        n('rads', 'radiator_loop', 520, 380),
        n('bath', 'bath_outlet', 780, 170),
      ],
      edges: [
        e('ch1', 'hs', 'ch_flow_out', 'rads', 'flow_in'),
        e('ch2', 'rads', 'return_out', 'hs', 'ch_return_in'),
        e('co1', 'hs', 'coil_flow', 'cyl', 'coil_flow'),
        e('co2', 'cyl', 'coil_return', 'hs', 'coil_return'),
        e('dh1', 'cyl', 'hot_out', 'bath', 'hot_in'),
        e('dh2', 'cyl', 'cold_in', 'bath', 'cold_in'),
      ],
      outletBindings: { A: 'bath' },
    },
    controlsPatch: { coldInletC: 10, mainsDynamicFlowLpm: 15 },
  },
  {
    id: 'heat_pump_buffer_cyl',
    title: 'Heat pump + buffer/LLH + cylinder',
    blurb: 'Generic heat pump physics; typical buffer/LLH separation + DHW store.',
    graph: {
      nodes: [
        n('hp', 'heat_source_heat_pump', 160, 300),
        n('llh', 'low_loss_header', 380, 300),
        n('ufh', 'ufh_loop', 640, 380),
        n('cyl', 'dhw_unvented_cylinder', 640, 160),
        n('sh', 'shower_outlet', 880, 150),
      ],
      edges: [
        e('p1', 'hp', 'flow_out', 'llh', 'primary_flow'),
        e('p2', 'llh', 'primary_return', 'hp', 'return_in'),
        e('s1', 'llh', 'secondary_flow', 'ufh', 'flow_in'),
        e('s2', 'ufh', 'return_out', 'llh', 'secondary_return'),
        e('dh1', 'cyl', 'hot_out', 'sh', 'hot_in'),
        e('dh2', 'cyl', 'cold_in', 'sh', 'cold_in'),
      ],
      outletBindings: { A: 'sh' },
    },
    controlsPatch: { coldInletC: 10, mainsDynamicFlowLpm: 18 },
  },
];

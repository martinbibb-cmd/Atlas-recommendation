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
    id: 'combi_full_house',
    title: 'Combi — CH + 2 taps + mixer shower + cold tap + bath',
    blurb: 'Combi diverting DHW/CH. Includes cold-only tap branch before boiler heating.',
    graph: {
      nodes: [
        n('hs', 'heat_source_combi', 180, 300),
        n('rads', 'radiator_loop', 520, 420),
        n('sh', 'shower_outlet', 820, 220),
        n('bath', 'bath_outlet', 820, 320),
        n('tap1', 'tap_outlet', 820, 420),
        n('tap2', 'tap_outlet', 820, 500),
        n('coldtap', 'tap_outlet', 520, 220),
      ],
      edges: [
        e('ch1', 'hs', 'ch_flow_out', 'rads', 'flow_in'),
        e('ch2', 'rads', 'return_out', 'hs', 'ch_return_in'),
        e('dh1', 'hs', 'hot_out', 'sh', 'hot_in'),
        e('dh2', 'hs', 'hot_out', 'bath', 'hot_in'),
        e('dh3', 'hs', 'hot_out', 'tap1', 'hot_in'),
        e('dh4', 'hs', 'hot_out', 'tap2', 'hot_in'),
        e('c1', 'hs', 'cold_in', 'sh', 'cold_in'),
        e('c2', 'hs', 'cold_in', 'bath', 'cold_in'),
        e('c3', 'hs', 'cold_in', 'tap1', 'cold_in'),
        e('c4', 'hs', 'cold_in', 'tap2', 'cold_in'),
        e('c5', 'hs', 'cold_in', 'coldtap', 'cold_in'),
      ],
      outletBindings: { A: 'sh', B: 'bath', C: 'tap1' },
    },
    controlsPatch: {
      heatSourceType: 'combi',
      combiDhwKw: 30,
      dhwSetpointC: 55,
      coldInletC: 10,
      mainsDynamicFlowLpm: 14,
    },
  },
  {
    id: 'regular_vented_yplan_like',
    title: 'Regular — F&E + open vent + vented cylinder + 3-port + rads',
    blurb: 'Open-vented representation with 3-port control and stored DHW reheat behaviour.',
    graph: {
      nodes: [
        n('hs', 'heat_source_regular_boiler', 160, 340),
        n('fe', 'feed_and_expansion', 160, 160),
        n('ov', 'open_vent', 160, 240),
        n('v3', 'three_port_valve', 420, 340),
        n('rads', 'radiator_loop', 700, 460),
        n('cyl', 'dhw_vented_cylinder', 700, 180),
        n('sh', 'shower_outlet', 980, 160),
        n('bath', 'bath_outlet', 980, 260),
        n('tap1', 'tap_outlet', 980, 360),
        n('tap2', 'tap_outlet', 980, 440),
      ],
      edges: [
        e('b1', 'hs', 'ch_flow_out', 'v3', 'in'),
        e('b2', 'v3', 'out_a', 'rads', 'flow_in'),
        e('b3', 'rads', 'return_out', 'hs', 'ch_return_in'),
        e('b4', 'v3', 'out_b', 'cyl', 'coil_flow'),
        e('b5', 'cyl', 'coil_return', 'hs', 'coil_return'),
        e('d1', 'cyl', 'hot_out', 'sh', 'hot_in'),
        e('d2', 'cyl', 'hot_out', 'bath', 'hot_in'),
        e('d3', 'cyl', 'hot_out', 'tap1', 'hot_in'),
        e('d4', 'cyl', 'hot_out', 'tap2', 'hot_in'),
        e('c1', 'cyl', 'cold_in', 'sh', 'cold_in'),
        e('c2', 'cyl', 'cold_in', 'bath', 'cold_in'),
        e('c3', 'cyl', 'cold_in', 'tap1', 'cold_in'),
        e('c4', 'cyl', 'cold_in', 'tap2', 'cold_in'),
      ],
      outletBindings: { A: 'sh', B: 'bath', C: 'tap1' },
    },
    controlsPatch: {
      heatSourceType: 'regular_boiler',
      coldInletC: 10,
      mainsDynamicFlowLpm: 15,
      dhwReheatTargetC: 55,
      dhwReheatHysteresisC: 6,
    },
  },
  {
    id: 'system_unvented_splan',
    title: 'System — unvented + S-plan + rads',
    blurb: 'S-plan style branch with separate CH and cylinder zones and stored DHW.',
    graph: {
      nodes: [
        n('hs', 'heat_source_system_boiler', 160, 340),
        n('pump', 'pump', 360, 340),
        n('zch', 'zone_valve', 520, 420),
        n('zcyl', 'zone_valve', 520, 260),
        n('rads', 'radiator_loop', 780, 420),
        n('cyl', 'dhw_unvented_cylinder', 780, 180),
        n('sh', 'shower_outlet', 1040, 160),
        n('bath', 'bath_outlet', 1040, 260),
        n('tap1', 'tap_outlet', 1040, 360),
        n('tap2', 'tap_outlet', 1040, 440),
      ],
      edges: [
        e('p1', 'hs', 'ch_flow_out', 'pump', 'in'),
        e('p2', 'pump', 'out', 'zch', 'in'),
        e('p3', 'pump', 'out', 'zcyl', 'in'),
        e('ch1', 'zch', 'out_a', 'rads', 'flow_in'),
        e('ch2', 'rads', 'return_out', 'hs', 'ch_return_in'),
        e('cy1', 'zcyl', 'out_a', 'cyl', 'coil_flow'),
        e('cy2', 'cyl', 'coil_return', 'hs', 'coil_return'),
        e('d1', 'cyl', 'hot_out', 'sh', 'hot_in'),
        e('d2', 'cyl', 'hot_out', 'bath', 'hot_in'),
        e('d3', 'cyl', 'hot_out', 'tap1', 'hot_in'),
        e('d4', 'cyl', 'hot_out', 'tap2', 'hot_in'),
        e('c1', 'cyl', 'cold_in', 'sh', 'cold_in'),
        e('c2', 'cyl', 'cold_in', 'bath', 'cold_in'),
        e('c3', 'cyl', 'cold_in', 'tap1', 'cold_in'),
        e('c4', 'cyl', 'cold_in', 'tap2', 'cold_in'),
      ],
      outletBindings: { A: 'sh', B: 'bath', C: 'tap1' },
    },
    controlsPatch: {
      heatSourceType: 'system_boiler',
      coldInletC: 10,
      mainsDynamicFlowLpm: 18,
      dhwReheatTargetC: 55,
      dhwReheatHysteresisC: 6,
    },
  },
  {
    id: 'heat_pump_unvented',
    title: 'Heat pump — unvented DHW + emitters',
    blurb: 'Generic heat pump source with unvented DHW storage and mixed emitters.',
    graph: {
      nodes: [
        n('hp', 'heat_source_heat_pump', 140, 360),
        n('buf', 'buffer', 360, 360),
        n('rads', 'radiator_loop', 660, 360),
        n('ufh', 'ufh_loop', 660, 460),
        n('cyl', 'dhw_unvented_cylinder', 660, 160),
        n('sh', 'shower_outlet', 980, 160),
        n('bath', 'bath_outlet', 980, 260),
        n('tap1', 'tap_outlet', 980, 360),
        n('tap2', 'tap_outlet', 980, 440),
      ],
      edges: [
        e('h1', 'hp', 'flow_out', 'buf', 'primary_flow'),
        e('h2', 'buf', 'primary_return', 'hp', 'return_in'),
        e('s1', 'buf', 'secondary_flow', 'rads', 'flow_in'),
        e('s2', 'rads', 'return_out', 'buf', 'secondary_return'),
        e('s3', 'buf', 'secondary_flow', 'ufh', 'flow_in'),
        e('s4', 'ufh', 'return_out', 'buf', 'secondary_return'),
        e('d1', 'cyl', 'hot_out', 'sh', 'hot_in'),
        e('d2', 'cyl', 'hot_out', 'bath', 'hot_in'),
        e('d3', 'cyl', 'hot_out', 'tap1', 'hot_in'),
        e('d4', 'cyl', 'hot_out', 'tap2', 'hot_in'),
        e('c1', 'cyl', 'cold_in', 'sh', 'cold_in'),
        e('c2', 'cyl', 'cold_in', 'bath', 'cold_in'),
        e('c3', 'cyl', 'cold_in', 'tap1', 'cold_in'),
        e('c4', 'cyl', 'cold_in', 'tap2', 'cold_in'),
      ],
      outletBindings: { A: 'sh', B: 'bath', C: 'tap1' },
    },
    controlsPatch: {
      heatSourceType: 'heat_pump',
      coldInletC: 10,
      mainsDynamicFlowLpm: 18,
      dhwReheatTargetC: 55,
      dhwReheatHysteresisC: 6,
    },
  },
];

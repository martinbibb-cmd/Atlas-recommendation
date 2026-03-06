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
        n('hs',      'heat_source_combi',  180,  300),
        n('rads',    'radiator_loop',      520,  420),
        n('mh',      'manifold_hot',       620,  200),
        n('mc',      'manifold_cold',      620,  380),
        n('sh',      'shower_outlet',      840,  160),
        n('bath',    'bath_outlet',        840,  260),
        n('tap1',    'tap_outlet',         840,  360),
        n('tap2',    'tap_outlet',         840,  440),
        n('coldtap', 'cold_tap_outlet',    840,  520),
      ],
      edges: [
        // CH loop
        e('ch1', 'hs',  'ch_flow_out', 'rads', 'flow_in'),
        e('ch2', 'rads','return_out',  'hs',   'ch_return_in'),
        // Hot distribution via manifold
        e('hot_link',  'hs',  'hot_out', 'mh', 'in'),
        e('mh_sh',     'mh',  'out1',    'sh',      'hot_in'),
        e('mh_bath',   'mh',  'out2',    'bath',    'hot_in'),
        e('mh_tap1',   'mh',  'out3',    'tap1',    'hot_in'),
        e('mh_tap2',   'mh',  'out4',    'tap2',    'hot_in'),
        // Cold distribution via manifold (combi cold_in is the mains entry)
        e('cold_link', 'hs',  'cold_in', 'mc', 'in'),
        e('mc_sh',     'mc',  'out1',    'sh',      'cold_in'),
        e('mc_bath',   'mc',  'out2',    'bath',    'cold_in'),
        e('mc_tap1',   'mc',  'out3',    'tap1',    'cold_in'),
        e('mc_tap2',   'mc',  'out4',    'tap2',    'cold_in'),
        e('mc_ctap',   'mc',  'out5',    'coldtap', 'cold_in'),
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
        n('hs',   'heat_source_regular_boiler', 160, 340),
        n('fe',   'feed_and_expansion',         160, 160),
        n('ov',   'open_vent',                  160, 240),
        n('v3',   'three_port_valve',           420, 340),
        n('rads', 'radiator_loop',              700, 460),
        n('cyl',  'dhw_vented_cylinder',        700, 180),
        n('cws',  'cws_cistern',                480, 60),
        n('mh',   'manifold_hot',               880, 160),
        n('mc',   'manifold_cold',              880, 340),
        n('sh',   'shower_outlet',             1100, 120),
        n('bath', 'bath_outlet',               1100, 220),
        n('tap1', 'tap_outlet',                1100, 320),
        n('tap2', 'tap_outlet',                1100, 420),
      ],
      edges: [
        // CH loop via 3-port valve
        e('b1', 'hs',   'ch_flow_out',  'v3',  'in'),
        e('b2', 'v3',   'out_a',        'rads','flow_in'),
        e('b3', 'rads', 'return_out',   'hs',  'ch_return_in'),
        e('b4', 'v3',   'out_b',        'cyl', 'coil_flow'),
        e('b5', 'cyl',  'coil_return',  'hs',  'coil_return'),
        // F&E and open vent
        e('fe1', 'fe',  'feed_in',      'hs',  'ch_return_in'),
        e('ov1', 'ov',  'vent_in',      'hs',  'ch_flow_out'),
        // Hot distribution via manifold
        e('hot_link',  'cyl', 'hot_out', 'mh', 'in'),
        e('mh_sh',     'mh',  'out1',   'sh',   'hot_in'),
        e('mh_bath',   'mh',  'out2',   'bath', 'hot_in'),
        e('mh_tap1',   'mh',  'out3',   'tap1', 'hot_in'),
        e('mh_tap2',   'mh',  'out4',   'tap2', 'hot_in'),
        // Cold distribution — CWS feeds manifold; manifold feeds cylinder + outlets
        e('cws_mc',  'cws', 'cold_out', 'mc',  'in'),
        e('mc_cyl',  'mc',  'out1',     'cyl', 'cold_in'),
        e('mc_sh',   'mc',  'out2',     'sh',  'cold_in'),
        e('mc_bath', 'mc',  'out3',     'bath','cold_in'),
        e('mc_tap1', 'mc',  'out4',     'tap1','cold_in'),
        e('mc_tap2', 'mc',  'out5',     'tap2','cold_in'),
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
        n('hs',   'heat_source_system_boiler', 160, 340),
        n('pump', 'pump',                      340, 340),
        n('tee_f','tee_ch_flow',               480, 340),
        n('zch',  'zone_valve',                600, 420),
        n('zcyl', 'zone_valve',                600, 240),
        n('rads', 'radiator_loop',             820, 420),
        n('cyl',  'dhw_unvented_cylinder',     820, 180),
        n('mh',   'manifold_hot',             1020, 160),
        n('mc',   'manifold_cold',             600, 560),
        n('sh',   'shower_outlet',            1220, 120),
        n('bath', 'bath_outlet',              1220, 220),
        n('tap1', 'tap_outlet',               1220, 320),
        n('tap2', 'tap_outlet',               1220, 420),
      ],
      edges: [
        // Boiler → pump → tee → zone valves
        e('p1',  'hs',    'ch_flow_out', 'pump',  'in'),
        e('p2',  'pump',  'out',         'tee_f', 'in'),
        e('pf1', 'tee_f', 'out1',        'zch',   'in'),
        e('pf2', 'tee_f', 'out2',        'zcyl',  'in'),
        // CH zone
        e('ch1', 'zch',  'out_a',       'rads', 'flow_in'),
        e('ch2', 'rads', 'return_out',  'hs',   'ch_return_in'),
        // Cylinder coil zone
        e('cy1', 'zcyl', 'out_a',       'cyl',  'coil_flow'),
        e('cy2', 'cyl',  'coil_return', 'hs',   'coil_return'),
        // Hot distribution via manifold
        e('hot_link',  'cyl', 'hot_out', 'mh', 'in'),
        e('mh_sh',     'mh',  'out1',   'sh',   'hot_in'),
        e('mh_bath',   'mh',  'out2',   'bath', 'hot_in'),
        e('mh_tap1',   'mh',  'out3',   'tap1', 'hot_in'),
        e('mh_tap2',   'mh',  'out4',   'tap2', 'hot_in'),
        // Cold distribution via manifold (open in = mains pressure entry)
        e('mc_cyl',  'mc', 'out1', 'cyl',  'cold_in'),
        e('mc_sh',   'mc', 'out2', 'sh',   'cold_in'),
        e('mc_bath', 'mc', 'out3', 'bath', 'cold_in'),
        e('mc_tap1', 'mc', 'out4', 'tap1', 'cold_in'),
        e('mc_tap2', 'mc', 'out5', 'tap2', 'cold_in'),
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
        n('hp',    'heat_source_heat_pump',   140, 360),
        n('buf',   'buffer',                  340, 360),
        n('tee_sf','tee_ch_flow',             520, 340),
        n('tee_sr','tee_ch_return',           520, 420),
        n('rads',  'radiator_loop',           700, 300),
        n('ufh',   'ufh_loop',                700, 440),
        n('cyl',   'dhw_unvented_cylinder',   700, 140),
        n('mh',    'manifold_hot',            920, 120),
        n('mc',    'manifold_cold',           920, 340),
        n('sh',    'shower_outlet',          1120, 80),
        n('bath',  'bath_outlet',            1120, 180),
        n('tap1',  'tap_outlet',             1120, 280),
        n('tap2',  'tap_outlet',             1120, 380),
      ],
      edges: [
        // Heat pump → buffer primary loop
        e('h1', 'hp',  'flow_out',        'buf',   'primary_flow'),
        e('h2', 'buf', 'primary_return',  'hp',    'return_in'),
        // Buffer secondary → tee → emitters
        e('s0',  'buf',    'secondary_flow',   'tee_sf', 'in'),
        e('sf1', 'tee_sf', 'out1',             'rads',   'flow_in'),
        e('sf2', 'tee_sf', 'out2',             'ufh',    'flow_in'),
        e('sr1', 'rads',   'return_out',       'tee_sr', 'out1'),
        e('sr2', 'ufh',    'return_out',       'tee_sr', 'out2'),
        e('s5',  'tee_sr', 'in',               'buf',    'secondary_return'),
        // Hot distribution via manifold
        e('hot_link',  'cyl', 'hot_out', 'mh', 'in'),
        e('mh_sh',     'mh',  'out1',   'sh',   'hot_in'),
        e('mh_bath',   'mh',  'out2',   'bath', 'hot_in'),
        e('mh_tap1',   'mh',  'out3',   'tap1', 'hot_in'),
        e('mh_tap2',   'mh',  'out4',   'tap2', 'hot_in'),
        // Cold distribution via manifold (open in = mains pressure entry)
        e('mc_cyl',  'mc', 'out1', 'cyl',  'cold_in'),
        e('mc_sh',   'mc', 'out2', 'sh',   'cold_in'),
        e('mc_bath', 'mc', 'out3', 'bath', 'cold_in'),
        e('mc_tap1', 'mc', 'out4', 'tap1', 'cold_in'),
        e('mc_tap2', 'mc', 'out5', 'tap2', 'cold_in'),
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

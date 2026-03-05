import type { PartKind, PortDef } from './types';

export const TOKEN_W = 170;
export const TOKEN_H = 74;

const L = 0;
const R = TOKEN_W;
const T = 0;
const B = TOKEN_H;
const MID_Y = TOKEN_H / 2;

export function portsForKind(kind: PartKind): PortDef[] {
  switch (kind) {
    case 'heat_source_combi':
      return [
        { id: 'ch_flow_out', dx: R, dy: MID_Y, role: 'flow' },
        { id: 'ch_return_in', dx: L, dy: MID_Y, role: 'return' },
        { id: 'cold_in', dx: L, dy: B, role: 'cold' },
        { id: 'hot_out', dx: R, dy: B, role: 'hot' },
      ];

    case 'heat_source_system_boiler':
    case 'heat_source_regular_boiler':
      return [
        { id: 'ch_flow_out', dx: R, dy: MID_Y, role: 'flow' },
        { id: 'ch_return_in', dx: L, dy: MID_Y, role: 'return' },
        { id: 'coil_flow', dx: R, dy: B, role: 'flow' },
        { id: 'coil_return', dx: L, dy: B, role: 'return' },
      ];

    case 'heat_source_heat_pump':
      return [
        { id: 'flow_out', dx: R, dy: MID_Y, role: 'flow' },
        { id: 'return_in', dx: L, dy: MID_Y, role: 'return' },
      ];

    case 'feed_and_expansion':
      return [{ id: 'feed_in', dx: R, dy: MID_Y, role: 'unknown' }];

    case 'open_vent':
      return [
        { id: 'vent_in', dx: L, dy: MID_Y, role: 'unknown' },
        { id: 'vent_out', dx: R, dy: MID_Y, role: 'unknown' },
      ];

    case 'cws_cistern':
      return [{ id: 'cold_out', dx: R, dy: MID_Y, role: 'cold' }];

    case 'dhw_unvented_cylinder':
    case 'dhw_mixergy':
    case 'dhw_vented_cylinder':
      return [
        { id: 'cold_in', dx: L, dy: B, role: 'cold' },
        { id: 'hot_out', dx: R, dy: T, role: 'hot' },
        { id: 'coil_flow', dx: R, dy: MID_Y, role: 'flow' },
        { id: 'coil_return', dx: L, dy: MID_Y, role: 'return' },
      ];

    case 'pump':
      return [
        { id: 'in', dx: L, dy: MID_Y, role: 'flow' },
        { id: 'out', dx: R, dy: MID_Y, role: 'flow' },
      ];

    case 'zone_valve':
    case 'three_port_valve':
      return [
        { id: 'in', dx: L, dy: MID_Y, role: 'flow' },
        { id: 'out_a', dx: R, dy: T + 18, role: 'flow' },
        { id: 'out_b', dx: R, dy: B - 18, role: 'flow' },
      ];

    case 'buffer':
    case 'low_loss_header':
      return [
        { id: 'primary_flow', dx: L, dy: T + 18, role: 'flow' },
        { id: 'primary_return', dx: L, dy: B - 18, role: 'return' },
        { id: 'secondary_flow', dx: R, dy: T + 18, role: 'flow' },
        { id: 'secondary_return', dx: R, dy: B - 18, role: 'return' },
      ];

    case 'radiator_loop':
    case 'ufh_loop':
      return [
        { id: 'flow_in', dx: L, dy: MID_Y, role: 'flow' },
        { id: 'return_out', dx: R, dy: MID_Y, role: 'return' },
      ];

    case 'tap_outlet':
    case 'bath_outlet':
    case 'shower_outlet':
      return [
        { id: 'hot_in', dx: L, dy: T + 18, role: 'hot' },
        { id: 'cold_in', dx: L, dy: B - 18, role: 'cold' },
      ];

    case 'cold_tap_outlet':
      return [{ id: 'cold_in', dx: L, dy: MID_Y, role: 'cold' }];

    case 'tee_hot':
      return [
        { id: 'in', dx: L, dy: MID_Y, role: 'hot' },
        { id: 'out1', dx: R, dy: T + 18, role: 'hot' },
        { id: 'out2', dx: R, dy: B - 18, role: 'hot' },
      ];

    case 'tee_cold':
      return [
        { id: 'in', dx: L, dy: MID_Y, role: 'cold' },
        { id: 'out1', dx: R, dy: T + 18, role: 'cold' },
        { id: 'out2', dx: R, dy: B - 18, role: 'cold' },
      ];

    case 'tee_ch_flow':
      return [
        { id: 'in', dx: L, dy: MID_Y, role: 'flow' },
        { id: 'out1', dx: R, dy: T + 18, role: 'flow' },
        { id: 'out2', dx: R, dy: B - 18, role: 'flow' },
      ];

    case 'tee_ch_return':
      return [
        { id: 'in', dx: R, dy: MID_Y, role: 'return' },
        { id: 'out1', dx: L, dy: T + 18, role: 'return' },
        { id: 'out2', dx: L, dy: B - 18, role: 'return' },
      ];

    default:
      return [
        { id: 'in', dx: L, dy: MID_Y, role: 'unknown' },
        { id: 'out', dx: R, dy: MID_Y, role: 'unknown' },
      ];
  }
}

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
        { id: 'flow_out',     dx: R, dy: MID_Y, role: 'flow',   label: 'flow',    direction: 'out' },
        { id: 'return_in',    dx: L, dy: MID_Y, role: 'return', label: 'return',  direction: 'in'  },
        { id: 'cold_in',      dx: L, dy: B,     role: 'cold',   label: 'dcw in',  direction: 'in'  },
        { id: 'hot_out',      dx: R, dy: B,     role: 'hot',    label: 'dhw out', direction: 'out' },
      ];

    case 'heat_source_system_boiler':
    case 'heat_source_regular_boiler':
      return [
        { id: 'flow_out',   dx: R, dy: MID_Y, role: 'flow',   label: 'flow',   direction: 'out' },
        { id: 'return_in',  dx: L, dy: MID_Y, role: 'return', label: 'return', direction: 'in'  },
      ];

    case 'heat_source_heat_pump':
      return [
        { id: 'flow_out',   dx: R, dy: MID_Y, role: 'flow',   label: 'flow',   direction: 'out' },
        { id: 'return_in',  dx: L, dy: MID_Y, role: 'return', label: 'return', direction: 'in'  },
      ];

    case 'feed_and_expansion':
      return [{ id: 'feed_in', dx: R, dy: MID_Y, role: 'unknown', label: 'feed', direction: 'in' }];

    case 'open_vent':
      return [
        { id: 'vent_in',  dx: L, dy: MID_Y, role: 'unknown', label: 'vent in',  direction: 'in'  },
        { id: 'vent_out', dx: R, dy: MID_Y, role: 'unknown', label: 'vent out', direction: 'out' },
      ];

    case 'cws_cistern':
      return [{ id: 'cold_out', dx: R, dy: MID_Y, role: 'cold', label: 'cold', direction: 'out' }];

    case 'dhw_unvented_cylinder':
    case 'dhw_mixergy':
    case 'dhw_vented_cylinder':
      return [
        // Primary heating circuit — left side (coil)
        { id: 'coil_flow',    dx: L, dy: T + 18, role: 'flow',   label: 'flow',     direction: 'in'  },
        { id: 'coil_return',  dx: L, dy: B - 18, role: 'return', label: 'return',   direction: 'out' },
        // Domestic water circuit — right side
        { id: 'hot_out',      dx: R, dy: T,       role: 'hot',    label: 'hot out',  direction: 'out' },
        { id: 'cold_in',      dx: R, dy: B,       role: 'cold',   label: 'cold in',  direction: 'in'  },
      ];

    case 'pump':
      return [
        { id: 'in',  dx: L, dy: MID_Y, role: 'flow', label: 'in',  direction: 'in'  },
        { id: 'out', dx: R, dy: MID_Y, role: 'flow', label: 'out', direction: 'out' },
      ];

    case 'zone_valve':
    case 'three_port_valve':
      return [
        { id: 'in',    dx: L, dy: MID_Y,   role: 'flow', label: 'flow in', direction: 'in'  },
        { id: 'out_a', dx: R, dy: T + 18,  role: 'flow', label: 'hw out',  direction: 'out' },
        { id: 'out_b', dx: R, dy: B - 18,  role: 'flow', label: 'ch out',  direction: 'out' },
      ];

    case 'buffer':
    case 'low_loss_header':
      return [
        { id: 'primary_flow',     dx: L, dy: T + 18, role: 'flow',   label: 'src flow',   direction: 'in'  },
        { id: 'primary_return',   dx: L, dy: B - 18, role: 'return', label: 'src return', direction: 'out' },
        { id: 'secondary_flow',   dx: R, dy: T + 18, role: 'flow',   label: 'load flow',  direction: 'out' },
        { id: 'secondary_return', dx: R, dy: B - 18, role: 'return', label: 'load return', direction: 'in'  },
      ];

    case 'radiator_loop':
    case 'ufh_loop':
      return [
        { id: 'flow_in',    dx: L, dy: MID_Y, role: 'flow',   label: 'flow',   direction: 'in'  },
        { id: 'return_out', dx: R, dy: MID_Y, role: 'return', label: 'return', direction: 'out' },
      ];

    case 'tap_outlet':
    case 'bath_outlet':
    case 'shower_outlet':
      return [
        { id: 'hot_in',  dx: L, dy: T + 18, role: 'hot',  label: 'hot',  direction: 'in' },
        { id: 'cold_in', dx: L, dy: B - 18, role: 'cold', label: 'cold', direction: 'in' },
      ];

    case 'cold_tap_outlet':
      return [{ id: 'cold_in', dx: L, dy: MID_Y, role: 'cold', label: 'cold', direction: 'in' }];

    case 'tee_hot':
      return [
        { id: 'in',   dx: L, dy: MID_Y,   role: 'hot', label: 'in',   direction: 'in'  },
        { id: 'out1', dx: R, dy: T + 18,  role: 'hot', label: 'out1', direction: 'out' },
        { id: 'out2', dx: R, dy: B - 18,  role: 'hot', label: 'out2', direction: 'out' },
      ];

    case 'tee_cold':
      return [
        { id: 'in',   dx: L, dy: MID_Y,   role: 'cold', label: 'in',   direction: 'in'  },
        { id: 'out1', dx: R, dy: T + 18,  role: 'cold', label: 'out1', direction: 'out' },
        { id: 'out2', dx: R, dy: B - 18,  role: 'cold', label: 'out2', direction: 'out' },
      ];

    case 'tee_ch_flow':
      return [
        { id: 'in',   dx: L, dy: MID_Y,   role: 'flow', label: 'in',   direction: 'in'  },
        { id: 'out1', dx: R, dy: T + 18,  role: 'flow', label: 'out1', direction: 'out' },
        { id: 'out2', dx: R, dy: B - 18,  role: 'flow', label: 'out2', direction: 'out' },
      ];

    case 'tee_ch_return':
      return [
        { id: 'in',   dx: R, dy: MID_Y,   role: 'return', label: 'in',   direction: 'in'  },
        { id: 'out1', dx: L, dy: T + 18,  role: 'return', label: 'out1', direction: 'out' },
        { id: 'out2', dx: L, dy: B - 18,  role: 'return', label: 'out2', direction: 'out' },
      ];

    case 'manifold_hot':
      return [
        { id: 'in',   dx: L, dy: MID_Y, role: 'hot', label: 'in',   direction: 'in'  },
        { id: 'out1', dx: R, dy: 14,    role: 'hot', label: 'out1', direction: 'out' },
        { id: 'out2', dx: R, dy: 28,    role: 'hot', label: 'out2', direction: 'out' },
        { id: 'out3', dx: R, dy: 46,    role: 'hot', label: 'out3', direction: 'out' },
        { id: 'out4', dx: R, dy: 60,    role: 'hot', label: 'out4', direction: 'out' },
      ];

    case 'manifold_cold':
      return [
        { id: 'in',   dx: L, dy: MID_Y, role: 'cold', label: 'in',   direction: 'in'  },
        { id: 'out1', dx: R, dy: 8,     role: 'cold', label: 'out1', direction: 'out' },
        { id: 'out2', dx: R, dy: 21,    role: 'cold', label: 'out2', direction: 'out' },
        { id: 'out3', dx: R, dy: 34,    role: 'cold', label: 'out3', direction: 'out' },
        { id: 'out4', dx: R, dy: 52,    role: 'cold', label: 'out4', direction: 'out' },
        { id: 'out5', dx: R, dy: 65,    role: 'cold', label: 'out5', direction: 'out' },
      ];

    default:
      return [
        { id: 'in',  dx: L, dy: MID_Y, role: 'unknown', label: 'in',  direction: 'in'  },
        { id: 'out', dx: R, dy: MID_Y, role: 'unknown', label: 'out', direction: 'out' },
      ];
  }
}

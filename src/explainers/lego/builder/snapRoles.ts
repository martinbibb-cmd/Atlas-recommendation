import type { PartKind, PortDef } from './types'

// ─── Role taxonomy ────────────────────────────────────────────────────────────

/**
 * Component-level snap role.
 * Determines which port positions are valid connection targets for a component.
 */
export type SnapRole =
  | 'heat_source'    // boilers, heat pumps — primary origin of flow
  | 'pump'           // circulator pump — must live on primary flow only
  | 'open_vent_feed' // open-vent safety pipe + F&E cistern — pre-pump, primary flow only
  | 'control'        // zone valves / diverters — flow side, between pump and loads
  | 'load'           // emitters / buffer load side — after controls or pump
  | 'return_common'  // return-merging tee — return spine only
  | 'storage'        // DHW cylinders — connected to both CH and domestic circuits
  | 'support'        // sealed kit, CWS, tees, etc. — no snap constraint
  | 'outlet'         // domestic outlets — no primary-circuit constraint

/**
 * Topological stage along the primary circuit flow path.
 * Represents the ordered position a component occupies in the primary circuit.
 */
export type PrimaryStage =
  | 'source_out'    // immediately after heat source
  | 'pre_pump'      // before pump (open vent / F&E placement zone)
  | 'post_pump'     // after pump, before controls
  | 'post_control'  // after controls — load zone
  | 'return'        // return spine

// ─── Role assignments ─────────────────────────────────────────────────────────

const ROLE_MAP: Record<PartKind, SnapRole> = {
  // Heat sources
  heat_source_combi:          'heat_source',
  heat_source_system_boiler:  'heat_source',
  heat_source_regular_boiler: 'heat_source',
  heat_source_heat_pump:      'heat_source',

  // Pump
  pump:                       'pump',

  // Open vent / feed-and-expansion (regular/open-vented systems only)
  open_vent:                  'open_vent_feed',
  feed_and_expansion:         'open_vent_feed',

  // Controls
  zone_valve:                 'control',
  three_port_valve:           'control',

  // Primary-circuit loads
  radiator_loop:              'load',
  ufh_loop:                   'load',
  buffer:                     'load',
  low_loss_header:            'load',

  // Cylinder / storage (dual CH + domestic circuits)
  dhw_unvented_cylinder:      'storage',
  dhw_mixergy:                'storage',
  dhw_vented_cylinder:        'storage',

  // System support
  sealed_system_kit:          'support',
  cws_cistern:                'support',
  tee_hot:                    'support',
  tee_cold:                   'support',
  tee_ch_flow:                'support',
  tee_ch_return:              'return_common',
  manifold_hot:               'support',
  manifold_cold:              'support',

  // Outlets
  tap_outlet:                 'outlet',
  bath_outlet:                'outlet',
  shower_outlet:              'outlet',
  cold_tap_outlet:            'outlet',
}

/** Returns the snap role for a given component kind. */
export function getSnapRole(kind: PartKind): SnapRole {
  const role = ROLE_MAP[kind]
  if (role === undefined) {
    // Warn in non-production environments so new PartKinds don't silently bypass snap rules.
    if (import.meta.env.DEV) {
      console.warn(`[snapRoles] No SnapRole defined for PartKind "${kind}" — defaulting to "support"`)
    }
    return 'support'
  }
  return role
}

// ─── Snap constraint logic ────────────────────────────────────────────────────

/**
 * Returns true if a component with the given snap role is allowed to connect
 * one of its ports (movingPortRole) to a target port (targetPortRole).
 *
 * These rules encode the guided topology constraints:
 * - Pump:          only on primary flow — never on return, never on domestic
 * - Open vent / F&E: only on primary flow (before pump in the sketch order)
 * - Controls:      flow side only — not on return, not on domestic
 * - Loads:         flow (in) and return (out) OK; domestic only for storage
 * - All others:    no additional restriction beyond existing rolesCompatible()
 */
export function isSnapAllowed(
  movingSnapRole: SnapRole,
  movingPortRole: PortDef['role'],
  targetPortRole: PortDef['role'],
): boolean {
  const targetIsFlow =
    targetPortRole === 'flow' || targetPortRole === 'unknown'

  const targetIsFlowOrReturn =
    targetPortRole === 'flow' ||
    targetPortRole === 'return' ||
    targetPortRole === 'store' ||
    targetPortRole === 'unknown'

  switch (movingSnapRole) {
    case 'pump':
      // Pump lives only on primary flow — never on return, never on domestic circuits.
      return targetIsFlow

    case 'open_vent_feed':
      // Vent pipe and F&E cistern tap into the primary flow only.
      // The "before pump" ordering is a placement hint; the port-role constraint
      // is sufficient to prevent connecting to return or domestic pipes.
      return targetIsFlow

    case 'control':
      // Zone valves and diverters sit on the flow side of the primary circuit.
      // When the moving port is flow-typed, the target must also be flow.
      if (movingPortRole === 'flow') return targetIsFlow
      // Other port roles on control valves (edge case) fall through freely.
      return true

    case 'load':
      // Emitters have a flow_in and a return_out.
      // flow_in must connect to a flow port; return_out to a return port.
      if (movingPortRole === 'flow') return targetIsFlowOrReturn
      if (movingPortRole === 'return') return targetPortRole === 'return' || targetPortRole === 'unknown'
      return true

    case 'heat_source':
    case 'storage':
    case 'return_common':
    case 'support':
    case 'outlet':
    default:
      // No additional constraint beyond existing rolesCompatible() check.
      return true
  }
}

// src/explainers/lego/playScene/deriveActiveDomains.ts
//
// Central helper for deciding which circuit domains are active in Play mode.
//
// This is the single place that translates:
//   - system kind (combi vs stored)
//   - space-heating demand
//   - domestic hot-water draw
//   - cylinder reheat state
//
// into four boolean domain flags consumed by buildPlaySceneModel to set
// edge.active — keeping domain-first activation consistent and avoiding
// scattered conditional logic that conflates heating, DHW draw, and reheat.

/**
 * Which circuit domains are currently active.
 *
 * heating  — space-heating circuit (boiler → radiators/UFH → boiler).
 * primary  — primary circuit through cylinder coil (stored systems only;
 *            active only when the store actually needs reheat — NOT merely
 *            because a hot tap is open).
 * dhw      — domestic hot-water path (draw from cylinder or on-demand HEX).
 * cold     — cold-water supply feeding the system during any draw.
 */
export interface ActiveDomains {
  heating: boolean
  primary: boolean
  dhw: boolean
  cold: boolean
}

export interface DeriveDomainInput {
  /**
   * Whether the system produces DHW on demand ('combi') or stores it in a
   * cylinder ('stored').  Maps from SystemType:
   *   'combi'              → 'combi'
   *   'unvented_cylinder'  → 'stored'
   *   'vented_cylinder'    → 'stored'
   */
  systemKind: 'combi' | 'stored'
  /** True when the boiler is actively firing for space heating (CH circuit running). */
  heatingDemand: boolean
  /** True when a domestic hot-water tap is open (draw in progress). */
  dhwDraw: boolean
  /**
   * True when the cylinder store has fallen below the reheat threshold and
   * the primary coil circuit is recovering the store.
   * For stored systems this is driven by simulation hysteresis — a hot-tap
   * draw depletes the store, but reheat only starts once the store drops
   * below the threshold.  A draw alone does NOT activate the coil.
   */
  cylinderNeedsReheat: boolean
}

/**
 * Derive which circuit domains are active from the current system state.
 *
 * Combi rules:
 *   - DHW draw interrupts CH (simplified priority model: combi cannot
 *     simultaneously heat the home and produce DHW at full rate).
 *   - Primary coil is never active: combi systems have no cylinder coil.
 *   - Cold supply is live whenever a draw is in progress.
 *
 * Stored rules:
 *   - Heating and DHW draw are independent — opening a hot tap does NOT
 *     force the heating circuit on, and heating being on does NOT
 *     automatically activate the DHW path.
 *   - Primary coil is active ONLY when the cylinder store needs reheat;
 *     a domestic draw depletes the store over time, but reheat is governed
 *     by a hysteresis threshold — the coil does not fire on every tap event.
 *   - Cold supply is live whenever a draw is in progress.
 */
export function deriveActiveDomains({
  systemKind,
  heatingDemand,
  dhwDraw,
  cylinderNeedsReheat,
}: DeriveDomainInput): ActiveDomains {
  if (systemKind === 'combi') {
    return {
      // On a combi a hot-water draw interrupts (suspends) space heating.
      heating: heatingDemand && !dhwDraw,
      // Combi systems have no cylinder coil — primary is never active.
      primary: false,
      dhw: dhwDraw,
      cold: dhwDraw,
    }
  }

  // Stored system (unvented or vented cylinder):
  return {
    heating: heatingDemand,
    // Primary coil active only when the store needs recovery — not merely
    // because a tap is open.  A draw depletes the store; the simulation
    // hysteresis decides when reheat starts.
    primary: cylinderNeedsReheat,
    dhw: dhwDraw,
    cold: dhwDraw,
  }
}

/**
 * buildCombiStateTimeline.ts — PR6: Combi family writer for the internal state timeline.
 *
 * Translates a `CombiDhwPhaseResult` into a `SystemStateTimeline`.
 *
 * The combi phase sequence maps onto the shared timeline contract as follows:
 *
 *   slotIndex  CombiDhwPhaseState        SystemServiceMode
 *   ─────────  ────────────────────────  ──────────────────────
 *   0          (preamble, if CH active)  ch_active
 *   1+         dhw_request               dhw_request
 *   2+         ch_interrupted (if CH)    ch_interrupted
 *   n          ignition_active           ignition_active
 *   n+1        delivery_active (if SS)   delivery_active
 *   n+2        purge_active              purge_active
 *   n+3        return_to_ch_pending (CH) return_to_ch_pending
 *
 * Design rules (from PR6 spec):
 *   - purge tick always follows delivery
 *   - return_to_ch_pending appears only when CH was active
 *   - combi-only modes must never appear on hydronic runs (enforced by
 *     assertValidStateTimeline in SystemStateTimeline.ts)
 */

import type { CombiDhwPhaseResult, CombiDhwPhaseState } from '../modules/CombiDhwPhaseModel';
import type { TimelineApplianceFamily, SystemStateTick, SystemStateTimeline } from './SystemStateTimeline';
import type { StateTransitionReason, SystemServiceMode } from './SystemStateTimeline';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Timestamp (seconds) used for the ch_active preamble tick.
 *
 * The preamble tick represents the system state just before the DHW request
 * arrived.  Using −1 s clearly places it before the tap-open event at 0 s
 * and is visually unambiguous in any downstream timeline consumer.
 */
const PREAMBLE_TIMESTAMP_S = -1;

// ─── Mode mapping ─────────────────────────────────────────────────────────────

/**
 * Maps a `CombiDhwPhaseState` to the canonical `SystemServiceMode`.
 */
function combiPhaseToServiceMode(phase: CombiDhwPhaseState): SystemServiceMode {
  switch (phase) {
    case 'ch_active':           return 'ch_active';
    case 'dhw_request':         return 'dhw_request';
    case 'ch_interrupted':      return 'ch_interrupted';
    case 'ignition_active':     return 'ignition_active';
    case 'delivery_active':     return 'delivery_active';
    case 'purge_active':        return 'purge_active';
    case 'return_to_ch_pending': return 'return_to_ch_pending';
  }
}

/**
 * Returns the `StateTransitionReason` for entering a given combi phase.
 */
function combiPhaseTransitionReason(phase: CombiDhwPhaseState): StateTransitionReason {
  switch (phase) {
    case 'ch_active':           return 'ch_was_active';
    case 'dhw_request':         return 'dhw_demand_detected';
    case 'ch_interrupted':      return 'ch_was_active';
    case 'ignition_active':     return 'ignition_started';
    case 'delivery_active':     return 'steady_state_reached';
    case 'purge_active':        return 'purge_started';
    case 'return_to_ch_pending': return 'return_to_ch_initiated';
  }
}

/**
 * Derives `chAvailable` and `dhwAvailable` for a combi phase.
 *
 * CH is unavailable whenever the diverter valve is in DHW position:
 *   ch_interrupted, ignition_active, delivery_active, purge_active
 *
 * DHW is only available during delivery_active (steady-state delivery).
 */
function combiPhaseAvailability(phase: CombiDhwPhaseState): { chAvailable: boolean; dhwAvailable: boolean } {
  switch (phase) {
    case 'ch_active':
      return { chAvailable: true, dhwAvailable: false };
    case 'dhw_request':
      return { chAvailable: true, dhwAvailable: false };
    case 'ch_interrupted':
      return { chAvailable: false, dhwAvailable: false };
    case 'ignition_active':
      return { chAvailable: false, dhwAvailable: false };
    case 'delivery_active':
      return { chAvailable: false, dhwAvailable: true };
    case 'purge_active':
      return { chAvailable: false, dhwAvailable: false };
    case 'return_to_ch_pending':
      return { chAvailable: true, dhwAvailable: false };
  }
}

// ─── Public builder ───────────────────────────────────────────────────────────

/**
 * Build a `SystemStateTimeline` from a `CombiDhwPhaseResult`.
 *
 * The function:
 *   1. Optionally prepends a `ch_active` preamble tick at timestampS −1 when CH
 *      was interrupted by the DHW request.
 *   2. Maps each `CombiPhaseEvent` in `phaseResult.phaseTimeline` to a `SystemStateTick`.
 *
 * @param phaseResult  The result of `runCombiDhwPhaseModel`.
 * @param family       The combi appliance family (always `'combi'`).
 */
export function buildCombiStateTimeline(
  phaseResult: CombiDhwPhaseResult,
  family: TimelineApplianceFamily,
): SystemStateTimeline {
  const ticks: SystemStateTick[] = [];
  const chWasInterrupted = phaseResult.drawOffResult.chInterruptionOccurred;

  // ── Step 1: preamble tick ───────────────────────────────────────────────
  // If CH was active when the DHW request arrived, prepend a ch_active tick
  // at timestampS −1 to represent the pre-request state.
  if (chWasInterrupted) {
    ticks.push({
      slotIndex: 0,
      timestampS: PREAMBLE_TIMESTAMP_S,
      activeFamily: family,
      serviceMode: 'ch_active',
      chAvailable: true,
      dhwAvailable: false,
      storeStateSummary: undefined,
      heatingInterrupted: false,
      activeLimiterIds: [],
      transitionReason: 'ch_was_active',
    });
  }

  // ── Step 2: map phase events ────────────────────────────────────────────
  for (const event of phaseResult.phaseTimeline) {
    const slotIndex = ticks.length;
    const serviceMode = combiPhaseToServiceMode(event.phase);
    const { chAvailable, dhwAvailable } = combiPhaseAvailability(event.phase);

    // CH is interrupted for all phases between ch_interrupted and return_to_ch_pending
    // (inclusive of the diverter-switch moment through the purge overrun).
    const heatingInterrupted =
      chWasInterrupted &&
      (event.phase === 'ch_interrupted' ||
        event.phase === 'ignition_active' ||
        event.phase === 'delivery_active' ||
        event.phase === 'purge_active');

    ticks.push({
      slotIndex,
      timestampS: event.startS,
      activeFamily: family,
      serviceMode,
      chAvailable,
      dhwAvailable,
      storeStateSummary: undefined,
      heatingInterrupted,
      activeLimiterIds: [],
      transitionReason: combiPhaseTransitionReason(event.phase),
    });
  }

  return ticks;
}

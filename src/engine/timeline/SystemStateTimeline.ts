/**
 * SystemStateTimeline.ts — PR6: Canonical internal state timeline types.
 *
 * Defines the shared machine-readable timeline/state kernel that all system family
 * runners write into.  This is a machine-first, family-agnostic contract — no UI
 * semantics, no emojis, no recommendation logic.
 *
 * Sequencing:
 *   PR4 fixed stored-water phases.
 *   PR5 fixed combi phases.
 *   PR6 introduces one shared internal state model that all families write to.
 *
 * Design rules:
 *   1. Timeline must be family-agnostic in shape.
 *   2. Combi-only states must not appear on hydronic runs.
 *   3. Store-related states must not appear on combi runs.
 *   4. Recharge decision must be distinct from draw-off delivery.
 *   5. Timeline ordering must be deterministic (slotIndex strictly ascending).
 */

// ─── Appliance family ─────────────────────────────────────────────────────────

/**
 * The appliance family that produced a given tick.
 *
 * Mirrors `ApplianceModel['family']` from `SystemTopology.ts` without creating
 * a circular import.  All four runner families are represented.
 */
export type TimelineApplianceFamily =
  | 'combi'
  | 'system'
  | 'regular'
  | 'open_vented'
  | 'heat_pump';

// ─── Service mode ─────────────────────────────────────────────────────────────

/**
 * The service mode the system is in during a given tick.
 *
 * Combi-only modes (must not appear in hydronic timelines):
 *   ch_active            — space heating running before DHW request
 *   dhw_request          — tap/shower opened; DHW demand detected (instantaneous)
 *   ch_interrupted       — diverter valve switched from CH to DHW circuit
 *   ignition_active      — burner firing; HEX temperature rising toward steady state
 *   delivery_active      — steady-state DHW delivery direct from appliance
 *   purge_active         — fan overrun; combustion gases cleared after delivery
 *   return_to_ch_pending — diverter returning to CH position; CH can resume
 *
 * Store-only modes (must not appear in combi timelines):
 *   store_draw_active    — draw-off served from cylinder store (not from appliance)
 *   recharge_decision    — control logic evaluating whether recharge is required
 *   recharge_active      — cylinder being recharged by the appliance
 *   recharge_complete    — cylinder returned to target charge temperature
 *
 * Shared / neutral modes:
 *   standby              — system idle; no CH or DHW demand
 */
export type SystemServiceMode =
  // ── Combi-only ──────────────────────────────────────────────────────────
  | 'ch_active'
  | 'dhw_request'
  | 'ch_interrupted'
  | 'ignition_active'
  | 'delivery_active'
  | 'purge_active'
  | 'return_to_ch_pending'
  // ── Store-only ──────────────────────────────────────────────────────────
  | 'store_draw_active'
  | 'recharge_decision'
  | 'recharge_active'
  | 'recharge_complete'
  // ── Shared ──────────────────────────────────────────────────────────────
  | 'standby';

/**
 * Service mode values that are exclusive to combi systems.
 * Hydronic timelines must not contain any of these modes.
 */
export const COMBI_ONLY_MODES: ReadonlySet<SystemServiceMode> = new Set([
  'ch_active',
  'dhw_request',
  'ch_interrupted',
  'ignition_active',
  'delivery_active',
  'purge_active',
  'return_to_ch_pending',
]);

/**
 * Service mode values that are exclusive to stored (hydronic) systems.
 * Combi timelines must not contain any of these modes.
 */
export const STORE_ONLY_MODES: ReadonlySet<SystemServiceMode> = new Set([
  'store_draw_active',
  'recharge_decision',
  'recharge_active',
  'recharge_complete',
]);

// ─── Transition reason ────────────────────────────────────────────────────────

/**
 * Why the system transitioned into the current service mode.
 *
 * Used for debugging and downstream event derivation (PR7+).
 */
export type StateTransitionReason =
  // ── Combi transition reasons ─────────────────────────────────────────────
  | 'dhw_demand_detected'        // tap opened; DHW demand entered the system
  | 'ch_was_active'              // CH was running when DHW demand arrived
  | 'ignition_started'           // burner fired after diverter switch
  | 'steady_state_reached'       // HEX reached steady-state delivery temperature
  | 'draw_complete'              // tap closed; DHW draw ended
  | 'purge_started'              // post-delivery fan overrun started
  | 'purge_complete'             // fan overrun done; system can return to CH
  | 'return_to_ch_initiated'     // diverter valve returning to CH position
  // ── Stored transition reasons ────────────────────────────────────────────
  | 'store_draw_started'         // cylinder draw-off initiated
  | 'store_draw_complete'        // cylinder draw-off ended
  | 'thermostat_threshold_crossed'  // store mean fell below thermostat threshold
  | 'hysteresis_threshold_crossed'  // store mean fell below hysteresis lower bound
  | 'scheduled_window_active'    // time-programme window open; store below target
  | 'priority_reheat_triggered'  // severe depletion; immediate reheat required
  | 'recharge_started'           // reheat cycle started by appliance
  | 'recharge_complete'          // cylinder returned to target temperature
  | 'store_depleted';            // usable store volume exhausted during draw

// ─── Store state summary ─────────────────────────────────────────────────────

/**
 * Coarse summary of the stored cylinder state at a given tick.
 *
 * Only present for stored (hydronic) family ticks; always `undefined` for combi.
 *
 *   available — store has sufficient usable volume for at least one more draw.
 *   partial   — store has reduced usable volume; the next draw may be shortfalled.
 *   depleted  — store has no usable hot-water volume; recharge is required.
 */
export type StoreStateSummary = 'available' | 'partial' | 'depleted';

// ─── Tick ─────────────────────────────────────────────────────────────────────

/**
 * A single timestep in the internal state timeline.
 *
 * Ticks are ordered by `slotIndex` (strictly ascending, starting from 0).
 * `timestampS` is relative to the start of the modelled event (e.g. tap-open = 0 s).
 * A negative `timestampS` represents a state that was active before the event began
 * (e.g. a `ch_active` preamble tick recorded at −1 s before the DHW request).
 */
export interface SystemStateTick {
  /**
   * Ordinal position in the timeline.  Strictly ascending from 0.
   */
  readonly slotIndex: number;

  /**
   * Elapsed seconds from the start of the modelled event when this tick was entered.
   *
   * Relative to the DHW request (tap-open = 0 s) for both combi and stored events.
   * May be negative for pre-event preamble ticks (e.g. ch_active at −1 s).
   */
  readonly timestampS: number;

  /**
   * The appliance family that produced this tick.
   */
  readonly activeFamily: TimelineApplianceFamily;

  /**
   * The service mode the system is in during this tick.
   */
  readonly serviceMode: SystemServiceMode;

  /**
   * Whether central heating (CH) can run during this tick.
   *
   * False when the diverter valve has switched to DHW mode (combi).
   * True in all stored-family ticks (Y-plan CH interruption is captured
   * in `heatingInterrupted`, not here, because the cylinder still holds
   * stored heat even while the boiler is recharging).
   */
  readonly chAvailable: boolean;

  /**
   * Whether domestic hot water (DHW) is available during this tick.
   *
   * True during combi `delivery_active` and stored `store_draw_active` ticks.
   * False during ignition, purge, recharge phases.
   */
  readonly dhwAvailable: boolean;

  /**
   * Coarse store state summary.
   *
   * Present only for stored (hydronic) family ticks.
   * Always `undefined` for combi ticks.
   */
  readonly storeStateSummary?: StoreStateSummary;

  /**
   * Whether space heating was interrupted by a DHW demand event at this tick.
   *
   * True for combi ticks when `chInterruptionOccurred` was true and the diverter
   * is currently in DHW mode.
   * True for stored ticks when `chInterruptedByReheat` was true.
   */
  readonly heatingInterrupted: boolean;

  /**
   * IDs of any engine limiters that are active during this tick.
   *
   * Empty for PR6; populated by the limiter ledger in PR8+.
   */
  readonly activeLimiterIds: readonly string[];

  /**
   * Reason why the system transitioned into this service mode.
   *
   * Absent for the initial preamble tick.
   */
  readonly transitionReason?: StateTransitionReason;
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

/**
 * Ordered sequence of `SystemStateTick` records produced by a family runner.
 *
 * - Ticks are ordered by `slotIndex` (ascending from 0).
 * - All ticks in a timeline share the same `activeFamily`.
 * - Combi-only modes must not appear alongside store-only modes in the same timeline.
 */
export type SystemStateTimeline = readonly SystemStateTick[];

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Asserts that a `SystemStateTimeline` satisfies the family ownership rules.
 *
 * Rules enforced:
 *   1. Combi-only modes must not appear in hydronic (non-combi) timelines.
 *   2. Store-only modes must not appear in combi timelines.
 *   3. `storeStateSummary` must be absent on combi ticks.
 *   4. `slotIndex` values must be strictly ascending from 0.
 *   5. All ticks must share the same `activeFamily`.
 *
 * @throws {Error} If any rule is violated.
 */
export function assertValidStateTimeline(
  timeline: SystemStateTimeline,
  family: TimelineApplianceFamily,
): void {
  if (timeline.length === 0) return;

  const isCombi = family === 'combi';

  let lastSlotIndex = -1;

  for (const tick of timeline) {
    // Rule 4: slotIndex must be strictly ascending
    if (tick.slotIndex !== lastSlotIndex + 1) {
      throw new Error(
        `[SystemStateTimeline] slotIndex must be strictly ascending from 0; ` +
        `expected ${lastSlotIndex + 1}, got ${tick.slotIndex}`,
      );
    }
    lastSlotIndex = tick.slotIndex;

    // Rule 5: all ticks must share the declared family
    if (tick.activeFamily !== family) {
      throw new Error(
        `[SystemStateTimeline] tick at slotIndex ${tick.slotIndex} has activeFamily ` +
        `'${tick.activeFamily}' but timeline family is '${family}'`,
      );
    }

    if (isCombi) {
      // Rule 2: store-only modes must not appear in combi timelines
      if (STORE_ONLY_MODES.has(tick.serviceMode)) {
        throw new Error(
          `[SystemStateTimeline] combi timeline contains store-only mode ` +
          `'${tick.serviceMode}' at slotIndex ${tick.slotIndex}`,
        );
      }
      // Rule 3: storeStateSummary must be absent on combi ticks
      if (tick.storeStateSummary !== undefined) {
        throw new Error(
          `[SystemStateTimeline] combi tick at slotIndex ${tick.slotIndex} ` +
          `must not carry storeStateSummary (got '${tick.storeStateSummary}')`,
        );
      }
    } else {
      // Rule 1: combi-only modes must not appear in hydronic timelines
      if (COMBI_ONLY_MODES.has(tick.serviceMode)) {
        throw new Error(
          `[SystemStateTimeline] hydronic (${family}) timeline contains combi-only mode ` +
          `'${tick.serviceMode}' at slotIndex ${tick.slotIndex}`,
        );
      }
    }
  }
}

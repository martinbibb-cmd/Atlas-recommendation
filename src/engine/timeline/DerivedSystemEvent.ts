/**
 * DerivedSystemEvent.ts — PR7: Derived event types and summary structures.
 *
 * Defines the readable event types that are derived (projected) from
 * SystemStateTimeline ticks.  This module is a downstream view only —
 * it owns no business logic and invents no rules of its own.
 *
 * Sequencing:
 *   PR4 fixed stored-water physical phases.
 *   PR5 fixed combi physical phases.
 *   PR6 introduced the canonical internal state timeline.
 *   PR7 (this file) derives readable events and counters from that timeline.
 *
 * Design rules:
 *   1. Events must be derived only from timeline ticks.
 *   2. Combi-only events must not appear in hydronic summaries.
 *   3. Store/recharge events must not appear in combi summaries.
 *   4. Event generation must be deterministic.
 *   5. Counters are simple aggregations of emitted events.
 */

import type { SystemServiceMode, TimelineApplianceFamily } from './SystemStateTimeline';

// ─── Event types ──────────────────────────────────────────────────────────────

/**
 * Canonical event types derived from SystemStateTimeline ticks.
 *
 * Combi-only events (must not appear in hydronic summaries):
 *   ch_call_active             — CH was running before the DHW request arrived
 *   dhw_request                — tap opened; DHW demand detected by the system
 *   heating_interrupted_by_dhw — CH interrupted: diverter switched to DHW circuit
 *   combi_ignition_started     — burner fired; HEX temperature rising toward steady state
 *   dhw_delivery_started       — steady-state DHW delivery from the combi appliance
 *   dhw_delivery_completed     — DHW draw ended; delivery phase closed
 *   combi_purge_started        — fan overrun started after delivery
 *   return_to_ch               — diverter returning to CH position; CH can resume
 *
 * Store-only events (must not appear in combi summaries):
 *   store_draw_started         — draw-off from the cylinder begun
 *   store_depleted             — usable store volume exhausted during draw
 *   recharge_decision_made     — control logic evaluated whether recharge is needed
 *   recharge_started           — cylinder reheat cycle started by the appliance
 *   recharge_completed         — cylinder returned to target charge temperature
 *
 * Shared events (may appear for any family):
 *   reduced_dhw_service        — draw served from a partial store (shortfall risk)
 *   simultaneous_demand_constraint — system cannot serve CH and DHW simultaneously
 */
export type SystemEventType =
  // ── Combi-only ──────────────────────────────────────────────────────────
  | 'ch_call_active'
  | 'dhw_request'
  | 'heating_interrupted_by_dhw'
  | 'combi_ignition_started'
  | 'dhw_delivery_started'
  | 'dhw_delivery_completed'
  | 'combi_purge_started'
  | 'return_to_ch'
  // ── Store-only ──────────────────────────────────────────────────────────
  | 'store_draw_started'
  | 'store_depleted'
  | 'recharge_decision_made'
  | 'recharge_started'
  | 'recharge_completed'
  // ── Shared ──────────────────────────────────────────────────────────────
  | 'reduced_dhw_service'
  | 'simultaneous_demand_constraint';

/**
 * Event types that are exclusive to combi systems.
 * Hydronic event summaries must not contain any of these types.
 */
export const COMBI_ONLY_EVENT_TYPES: ReadonlySet<SystemEventType> = new Set([
  'ch_call_active',
  'dhw_request',
  'heating_interrupted_by_dhw',
  'combi_ignition_started',
  'dhw_delivery_started',
  'dhw_delivery_completed',
  'combi_purge_started',
  'return_to_ch',
]);

/**
 * Event types that are exclusive to stored (hydronic) systems.
 * Combi event summaries must not contain any of these types.
 */
export const STORE_ONLY_EVENT_TYPES: ReadonlySet<SystemEventType> = new Set([
  'store_draw_started',
  'store_depleted',
  'recharge_decision_made',
  'recharge_started',
  'recharge_completed',
]);

// ─── Derived event ────────────────────────────────────────────────────────────

/**
 * A single readable event derived from one or more adjacent SystemStateTimeline ticks.
 *
 * Events are ordered by `slotIndex` (ascending) within a `DerivedSystemEventSummary`.
 * Multiple events may share the same `slotIndex` when a single tick produces more
 * than one readable event (e.g. `delivery_active` produces both
 * `dhw_delivery_started` and optionally `dhw_delivery_completed`).
 */
export interface DerivedSystemEvent {
  /**
   * What happened — the semantic event type.
   */
  readonly eventType: SystemEventType;

  /**
   * The slotIndex of the source tick that produced this event.
   */
  readonly slotIndex: number;

  /**
   * Elapsed seconds from the start of the modelled event when this event occurred.
   * Sourced directly from the source tick's `timestampS`.
   */
  readonly timestampS: number;

  /**
   * The appliance family that was active when this event occurred.
   */
  readonly activeFamily: TimelineApplianceFamily;

  /**
   * Severity classification of the event.
   *
   *   info    — normal system operation; expected behaviour
   *   warning — suboptimal or degraded condition
   *   limit   — hard physics or topology constraint reached
   */
  readonly severity: 'info' | 'warning' | 'limit';

  /**
   * The service mode(s) on the source tick that this event was derived from.
   */
  readonly relatedModes: readonly SystemServiceMode[];

  /**
   * Duration in seconds, when derivable from adjacent ticks.
   *
   * Computed as `nextTick.timestampS − sourceTick.timestampS` when a successor
   * tick exists.  Absent for the last tick in the timeline or for point-in-time
   * events (e.g. `dhw_delivery_completed`).
   */
  readonly durationS?: number;
}

// ─── Event counters ───────────────────────────────────────────────────────────

/**
 * Per-run event counts for downstream UI rails and projections.
 *
 * Counters are simple aggregations over the emitted event list and must be
 * recalculated from the event list rather than accumulated independently.
 */
export interface SystemEventCounters {
  /**
   * Number of DHW requests in the run.
   * Combi: count of `dhw_request` events.
   * Hydronic: count of `store_draw_started` events.
   */
  readonly dhwRequests: number;

  /**
   * Number of space-heating interruptions caused by a DHW demand event.
   * Derived from `heating_interrupted_by_dhw` events.
   */
  readonly heatingInterruptions: number;

  /**
   * Number of cylinder recharge cycles started.
   * Derived from `recharge_started` events.
   */
  readonly rechargeCycles: number;

  /**
   * Number of combi purge cycles started.
   * Derived from `combi_purge_started` events.
   */
  readonly purgeCycles: number;

  /**
   * Number of reduced-service events (draw served from a partial store).
   * Derived from `reduced_dhw_service` events.
   */
  readonly reducedDhwEvents: number;

  /**
   * Number of simultaneous-demand constraint events.
   * Derived from `simultaneous_demand_constraint` events.
   */
  readonly simultaneousDemandConstraints: number;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

/**
 * Complete derived-event output produced from a single timeline run.
 *
 * - `events` is always present (may be empty for an empty or standby-only timeline).
 * - `counters` is always present (all fields are zero if no events were emitted).
 * - Both fields are deterministic: the same timeline always yields the same summary.
 */
export interface DerivedSystemEventSummary {
  /**
   * Ordered list of derived events, sorted by `slotIndex` ascending.
   * Multiple events may share a `slotIndex` when a single tick produces several
   * readable events (e.g. `delivery_active` → started + completed).
   */
  readonly events: readonly DerivedSystemEvent[];

  /**
   * Aggregated event counters for the run.
   */
  readonly counters: SystemEventCounters;
}

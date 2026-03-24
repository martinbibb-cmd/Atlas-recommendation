/**
 * buildDerivedEventsFromTimeline.ts — PR7: Timeline-to-event projection.
 *
 * Converts a `SystemStateTimeline` into a `DerivedSystemEventSummary`
 * containing readable events and aggregated counters.
 *
 * This function is a pure projection — it owns no business logic:
 *   - It never invents events that are not traceable to a source tick.
 *   - It never applies family-specific rules beyond the mode mappings
 *     already encoded in the timeline itself (combi-only modes cannot
 *     appear in hydronic timelines, so combi-only events can never be
 *     emitted from a hydronic run).
 *   - It is deterministic: the same timeline always yields the same summary.
 *
 * Mapping rules (one primary event per tick, with optional companions):
 *
 *   ch_active            → ch_call_active (info)
 *   dhw_request          → dhw_request (info)
 *   ch_interrupted       → heating_interrupted_by_dhw (warning)
 *                          + simultaneous_demand_constraint (limit)
 *   ignition_active      → combi_ignition_started (info)
 *   delivery_active      → dhw_delivery_started (info)
 *                          + dhw_delivery_completed (info) at next tick timestampS
 *   purge_active         → combi_purge_started (info)
 *   return_to_ch_pending → return_to_ch (info)
 *   store_draw_active    → store_draw_started (info)
 *                          + reduced_dhw_service (warning) if storeStateSummary === 'partial'
 *   recharge_decision    → recharge_decision_made (info)
 *                          + store_depleted (warning) if storeStateSummary === 'depleted'
 *   recharge_active      → recharge_started (info)
 *   recharge_complete    → recharge_completed (info)
 *   standby              → (no event emitted)
 *
 * Duration:
 *   For each primary event, `durationS` is set to
 *   `nextTick.timestampS − sourceTick.timestampS` when a successor tick exists.
 *   Point-in-time companion events (e.g. `dhw_delivery_completed`) carry no duration.
 */

import type { SystemStateTimeline, SystemStateTick, TimelineApplianceFamily } from './SystemStateTimeline';
import type {
  DerivedSystemEvent,
  DerivedSystemEventSummary,
  SystemEventCounters,
  SystemEventType,
} from './DerivedSystemEvent';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives `durationS` from adjacent ticks.
 *
 * Returns `undefined` for the last tick (no successor exists).
 */
function deriveDurationS(
  sourceTick: SystemStateTick,
  nextTick: SystemStateTick | undefined,
): number | undefined {
  if (nextTick === undefined) return undefined;
  return nextTick.timestampS - sourceTick.timestampS;
}

/**
 * Constructs a `DerivedSystemEvent` with all required fields.
 */
function makeEvent(
  eventType: SystemEventType,
  tick: SystemStateTick,
  family: TimelineApplianceFamily,
  severity: DerivedSystemEvent['severity'],
  durationS: number | undefined,
): DerivedSystemEvent {
  return {
    eventType,
    slotIndex: tick.slotIndex,
    timestampS: tick.timestampS,
    activeFamily: family,
    severity,
    relatedModes: [tick.serviceMode],
    ...(durationS !== undefined ? { durationS } : {}),
  };
}

// ─── Zero-value counters ──────────────────────────────────────────────────────

function zeroCounters(): SystemEventCounters {
  return {
    dhwRequests: 0,
    heatingInterruptions: 0,
    rechargeCycles: 0,
    purgeCycles: 0,
    reducedDhwEvents: 0,
    simultaneousDemandConstraints: 0,
  };
}

// ─── Counter aggregation ─────────────────────────────────────────────────────

function aggregateCounters(events: readonly DerivedSystemEvent[]): SystemEventCounters {
  let dhwRequests = 0;
  let heatingInterruptions = 0;
  let rechargeCycles = 0;
  let purgeCycles = 0;
  let reducedDhwEvents = 0;
  let simultaneousDemandConstraints = 0;

  for (const event of events) {
    switch (event.eventType) {
      case 'dhw_request':
      case 'store_draw_started':
        dhwRequests++;
        break;
      case 'heating_interrupted_by_dhw':
        heatingInterruptions++;
        break;
      case 'recharge_started':
        rechargeCycles++;
        break;
      case 'combi_purge_started':
        purgeCycles++;
        break;
      case 'reduced_dhw_service':
        reducedDhwEvents++;
        break;
      case 'simultaneous_demand_constraint':
        simultaneousDemandConstraints++;
        break;
      default:
        break;
    }
  }

  return {
    dhwRequests,
    heatingInterruptions,
    rechargeCycles,
    purgeCycles,
    reducedDhwEvents,
    simultaneousDemandConstraints,
  };
}

// ─── Public builder ───────────────────────────────────────────────────────────

/**
 * Build a `DerivedSystemEventSummary` from a `SystemStateTimeline`.
 *
 * This function is the single entry point for PR7 event derivation.
 * It accepts any valid `SystemStateTimeline` (combi or hydronic) and
 * returns an ordered event list plus aggregated counters.
 *
 * The function is a pure projection: given the same timeline, it always
 * returns the same summary.  It emits no events that are not traceable
 * to a source tick in the timeline.
 *
 * @param timeline  Ordered sequence of `SystemStateTick` records (may be empty).
 * @param family    The appliance family that produced the timeline.
 * @returns         `DerivedSystemEventSummary` with events and counters.
 */
export function buildDerivedEventsFromTimeline(
  timeline: SystemStateTimeline,
  family: TimelineApplianceFamily,
): DerivedSystemEventSummary {
  if (timeline.length === 0) {
    return { events: [], counters: zeroCounters() };
  }

  const events: DerivedSystemEvent[] = [];

  for (let i = 0; i < timeline.length; i++) {
    const tick = timeline[i]!;
    const nextTick = timeline[i + 1] as SystemStateTick | undefined;
    const durationS = deriveDurationS(tick, nextTick);

    switch (tick.serviceMode) {

      // ── Combi-only ────────────────────────────────────────────────────────

      case 'ch_active':
        events.push(makeEvent('ch_call_active', tick, family, 'info', durationS));
        break;

      case 'dhw_request':
        events.push(makeEvent('dhw_request', tick, family, 'info', durationS));
        break;

      case 'ch_interrupted':
        // Primary: heating was interrupted to serve DHW
        events.push(makeEvent('heating_interrupted_by_dhw', tick, family, 'warning', durationS));
        // Companion: the simultaneous-demand hard constraint was hit
        events.push(makeEvent('simultaneous_demand_constraint', tick, family, 'limit', durationS));
        break;

      case 'ignition_active':
        events.push(makeEvent('combi_ignition_started', tick, family, 'info', durationS));
        break;

      case 'delivery_active': {
        // Primary: DHW delivery started
        events.push(makeEvent('dhw_delivery_started', tick, family, 'info', durationS));
        // Companion: DHW delivery completed (at the moment delivery ends = next tick start)
        if (nextTick !== undefined) {
          events.push({
            eventType: 'dhw_delivery_completed',
            slotIndex: tick.slotIndex,
            timestampS: nextTick.timestampS,
            activeFamily: family,
            severity: 'info',
            relatedModes: [tick.serviceMode],
          });
        }
        break;
      }

      case 'purge_active':
        events.push(makeEvent('combi_purge_started', tick, family, 'info', durationS));
        break;

      case 'return_to_ch_pending':
        events.push(makeEvent('return_to_ch', tick, family, 'info', durationS));
        break;

      // ── Store-only ────────────────────────────────────────────────────────

      case 'store_draw_active':
        // Primary: draw started
        events.push(makeEvent('store_draw_started', tick, family, 'info', durationS));
        // Companion: draw started with a partial store → reduced service risk
        if (tick.storeStateSummary === 'partial') {
          events.push({
            eventType: 'reduced_dhw_service',
            slotIndex: tick.slotIndex,
            timestampS: tick.timestampS,
            activeFamily: family,
            severity: 'warning',
            relatedModes: [tick.serviceMode],
          });
        }
        break;

      case 'recharge_decision':
        // Primary: control logic evaluated whether recharge is needed
        events.push(makeEvent('recharge_decision_made', tick, family, 'info', durationS));
        // Companion: store is depleted after the draw
        if (tick.storeStateSummary === 'depleted') {
          events.push({
            eventType: 'store_depleted',
            slotIndex: tick.slotIndex,
            timestampS: tick.timestampS,
            activeFamily: family,
            severity: 'warning',
            relatedModes: [tick.serviceMode],
          });
        }
        break;

      case 'recharge_active':
        events.push(makeEvent('recharge_started', tick, family, 'info', durationS));
        break;

      case 'recharge_complete':
        events.push(makeEvent('recharge_completed', tick, family, 'info', durationS));
        break;

      // ── Shared ────────────────────────────────────────────────────────────

      case 'standby':
        // Standby is a neutral idle state; no readable event emitted.
        break;
    }
  }

  return {
    events,
    counters: aggregateCounters(events),
  };
}

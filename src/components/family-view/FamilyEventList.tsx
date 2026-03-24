/**
 * FamilyEventList.tsx — PR10: Family-specific event list from DerivedSystemEventSummary.
 *
 * Renders the events and counters from the selected family's DerivedSystemEventSummary.
 * All events are derived from the selected family's timeline — no cross-family
 * events can appear here.
 *
 * Family ownership:
 *   combi        → shows combi-only events (ignition, purge, CH interruption) +
 *                  counters (heatingInterruptions, purgeCycles)
 *   stored_water → shows store events (draw, recharge) +
 *                  counters (rechargeCycles, reducedDhwEvents)
 *   open_vented  → shows store events (draw, recharge) +
 *                  counters (rechargeCycles, reducedDhwEvents)
 *   heat_pump    → shows store events (draw, recharge) +
 *                  counters (rechargeCycles, reducedDhwEvents)
 *
 * Design rules:
 *   - No combi-specific panels are rendered for stored/HP runs.
 *   - No store/recharge panels are rendered for combi runs.
 *   - All event data comes from the DerivedSystemEventSummary; nothing is invented.
 */

import type { DerivedSystemEventSummary, DerivedSystemEvent } from '../../engine/timeline/DerivedSystemEvent';
import type { SelectableFamily } from './useSelectedFamilyData';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_CLASS: Record<DerivedSystemEvent['severity'], string> = {
  info:    'family-event-list__event--info',
  warning: 'family-event-list__event--warning',
  limit:   'family-event-list__event--limit',
};

/** Human-readable labels for event types shown in the list. */
const EVENT_TYPE_LABELS: Record<string, string> = {
  ch_call_active:                    'Space heating active',
  dhw_request:                       'Hot water requested',
  heating_interrupted_by_dhw:        'Heating interrupted by hot water use',
  combi_ignition_started:            'Ignition started',
  dhw_delivery_started:              'Hot water delivery started',
  dhw_delivery_completed:            'Hot water delivery completed',
  combi_purge_started:               'Purge cycle started',
  return_to_ch:                      'Returning to space heating',
  store_draw_started:                'Cylinder draw-off started',
  store_depleted:                    'Store depleted',
  recharge_decision_made:            'Recharge decision made',
  recharge_started:                  'Cylinder recharge started',
  recharge_completed:                'Cylinder recharge completed',
  reduced_dhw_service:               'Reduced hot water service',
  simultaneous_demand_constraint:    'Simultaneous demand constraint',
};

function formatDuration(durationS: number | undefined): string {
  if (durationS == null) return '';
  if (durationS < 60) return `${durationS.toFixed(0)} s`;
  return `${(durationS / 60).toFixed(1)} min`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface EventRowProps {
  event: DerivedSystemEvent;
}

function EventRow({ event }: EventRowProps) {
  const label = EVENT_TYPE_LABELS[event.eventType] ?? event.eventType;
  const severityClass = SEVERITY_CLASS[event.severity];
  const duration = formatDuration(event.durationS);

  return (
    <li
      className={`family-event-list__event ${severityClass}`}
      data-event-type={event.eventType}
      data-testid={`event-${event.eventType}`}
    >
      <span className="family-event-list__event-label">{label}</span>
      {duration && (
        <span className="family-event-list__event-duration" aria-label={`Duration: ${duration}`}>
          {duration}
        </span>
      )}
      <span
        className="family-event-list__event-severity"
        aria-label={`Severity: ${event.severity}`}
      >
        {event.severity}
      </span>
    </li>
  );
}

// ─── Counter sections ─────────────────────────────────────────────────────────

interface CounterBadgeProps {
  label: string;
  value: number;
  testId: string;
  warnWhenNonZero?: boolean;
}

function CounterBadge({ label, value, testId, warnWhenNonZero = false }: CounterBadgeProps) {
  const isWarn = warnWhenNonZero && value > 0;
  return (
    <div
      className={`family-event-list__counter${isWarn ? ' family-event-list__counter--warn' : ''}`}
      data-testid={testId}
      aria-label={`${label}: ${value}`}
    >
      <span className="family-event-list__counter-value">{value}</span>
      <span className="family-event-list__counter-label">{label}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FamilyEventListProps {
  events: DerivedSystemEventSummary;
  family: SelectableFamily;
}

/**
 * Renders events and counters for the selected family.
 *
 * Family-specific panels:
 *   combi        → purge cycles, heating interruptions (no recharge panels)
 *   stored/HP    → recharge cycles, reduced DHW events (no purge/ignition panels)
 */
export default function FamilyEventList({ events, family }: FamilyEventListProps) {
  const { counters, events: eventList } = events;
  const isCombi = family === 'combi';
  const isStored = family === 'stored_water' || family === 'open_vented' || family === 'heat_pump';

  return (
    <section
      className="family-event-list"
      aria-label="System events"
      data-testid="family-event-list"
      data-family={family}
    >
      <h3 className="family-event-list__heading">System events</h3>

      {/* ── Counters strip ─────────────────────────────────────────────── */}
      <div className="family-event-list__counters" data-testid="event-counters">
        <CounterBadge
          label="Hot water requests"
          value={counters.dhwRequests}
          testId="counter-dhw-requests"
        />
        {/* Combi-specific counters — hidden for stored/HP families */}
        {isCombi && (
          <>
            <CounterBadge
              label="Heating interruptions"
              value={counters.heatingInterruptions}
              testId="counter-heating-interruptions"
              warnWhenNonZero
            />
            <CounterBadge
              label="Purge cycles"
              value={counters.purgeCycles}
              testId="counter-purge-cycles"
            />
          </>
        )}
        {/* Stored/HP counters — hidden for combi family */}
        {isStored && (
          <>
            <CounterBadge
              label="Recharge cycles"
              value={counters.rechargeCycles}
              testId="counter-recharge-cycles"
            />
            <CounterBadge
              label="Reduced hot water events"
              value={counters.reducedDhwEvents}
              testId="counter-reduced-dhw"
              warnWhenNonZero
            />
          </>
        )}
        <CounterBadge
          label="Simultaneous demand events"
          value={counters.simultaneousDemandConstraints}
          testId="counter-simultaneous-demand"
          warnWhenNonZero
        />
      </div>

      {/* ── Event list ─────────────────────────────────────────────────── */}
      {eventList.length > 0 ? (
        <ul
          className="family-event-list__events"
          aria-label="Event timeline"
          data-testid="event-list"
        >
          {eventList.map((event, idx) => (
            <EventRow key={`${event.slotIndex}-${event.eventType}-${idx}`} event={event} />
          ))}
        </ul>
      ) : (
        <p className="family-event-list__no-events">No events recorded for this run.</p>
      )}
    </section>
  );
}

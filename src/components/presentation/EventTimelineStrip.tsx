/**
 * EventTimelineStrip.tsx — Presentation Layer v1.
 *
 * Horizontal visual strip showing what happens in the home during the
 * morning peak scenario.  Divided into two sections:
 *
 *   Section 1 – Demand (what the household asks for)
 *   Section 2 – System response (what the boiler/cylinder does)
 *
 * Problem events are highlighted in the 'current' mode (amber/red).
 * Improvements are highlighted in the 'proposed' mode (green).
 *
 * Visual distinction rules:
 *   interruption  — amber/warm border, bold label ("Heating paused")
 *   recharge      — blue border, blue label ("Cylinder recharging")
 *   improvement   — green border, green label
 *   neutral       — grey border, default label
 *
 * Kept to a maximum of 3 events per section to avoid clutter.
 * Supports onEventClick — clicking a problem event notifies the parent so it
 * can highlight the corresponding cause card ("wow" interaction).
 */

import type { KeyboardEvent } from 'react';
import type { DerivedSystemEventSummary } from '../../engine/timeline/DerivedSystemEvent';
import type { SelectableFamily } from '../family-view/useSelectedFamilyData';
import type { PresentationMode } from './presentationTypes';
import './EventTimelineStrip.css';

// ─── Event icon helpers ───────────────────────────────────────────────────────

interface StripEvent {
  icon: string;
  label: string;
  kind: 'neutral' | 'problem' | 'problem-interruption' | 'problem-recharge' | 'improvement';
  /**
   * Limiter ID that corresponds to this event.  When set, clicking the event
   * notifies the parent to highlight the matching cause card.
   */
  limiterId?: string;
}

/**
 * Builds the demand section: what the household is asking for.
 * Kept to the most essential signals — shower + simultaneous demand flag.
 */
function buildDemandEvents(
  events: DerivedSystemEventSummary,
): StripEvent[] {
  const strip: StripEvent[] = [];

  strip.push({ icon: '🚿', label: 'Shower', kind: 'neutral' });

  // Only add a second demand event when there is evidence of simultaneous use
  const hasSimultaneous =
    events.counters.simultaneousDemandConstraints > 0 ||
    events.counters.dhwRequests > 1;
  if (hasSimultaneous) {
    strip.push({
      icon: '🚰',
      label: 'Hot tap',
      kind: 'neutral',
      limiterId: 'simultaneous_demand_constraint',
    });
  }

  return strip;
}

/**
 * Builds the system response section: what the boiler or cylinder does.
 * This is where the problem/improvement story lives.
 */
function buildResponseEvents(
  events: DerivedSystemEventSummary,
  family: SelectableFamily,
  mode: PresentationMode,
): StripEvent[] {
  const strip: StripEvent[] = [];
  const isProposed = mode === 'proposed';

  // ── Heating continuity ─────────────────────────────────────────────────
  strip.push({
    icon: '🔥',
    label: 'Heating',
    kind: 'neutral',
  });

  // ── Combi-specific: interruption + purge ───────────────────────────────
  if (family === 'combi') {
    const hasInterruption = events.counters.heatingInterruptions > 0;
    if (hasInterruption) {
      strip.push({
        icon: isProposed ? '✅' : '⏸',
        label: isProposed ? 'Continuous' : 'Heating paused',
        kind: isProposed ? 'improvement' : 'problem-interruption',
        limiterId: 'combi_service_switching',
      });
    }
    // Purge cycle only shown in current mode — it disappears with proposed system
    // Cap at 3 total — omit purge if interruption is already shown
    if (!isProposed && events.counters.purgeCycles > 0 && strip.length < 3) {
      strip.push({
        icon: '💨',
        label: 'Cold burst',
        kind: 'problem',
        limiterId: 'combi_service_switching',
      });
    }
  }

  // ── Stored system: cylinder state ─────────────────────────────────────
  if (family === 'stored_water' || family === 'open_vented' || family === 'heat_pump') {
    const hasRecharge = events.counters.rechargeCycles > 0;
    if (isProposed) {
      strip.push({
        icon: '🟢',
        label: 'Reserve kept',
        kind: 'improvement',
      });
    } else if (hasRecharge) {
      strip.push({
        icon: '🔄',
        label: 'Recharging',
        kind: 'problem-recharge',
        limiterId: 'stored_volume_shortfall',
      });
    } else {
      strip.push({
        icon: '✅',
        label: 'Reserve full',
        kind: 'neutral',
      });
    }
  }

  // ── Reduced flow: only in current mode (cap at 3) ─────────────────────
  if (!isProposed && events.counters.reducedDhwEvents > 0 && strip.length < 3) {
    strip.push({
      icon: '📉',
      label: 'Flow drops',
      kind: 'problem',
      limiterId: 'reduced_dhw_service',
    });
  }

  return strip;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  events: DerivedSystemEventSummary;
  family: SelectableFamily;
  mode: PresentationMode;
  /**
   * Called when the user clicks a problem event that has a limiter ID.
   * The parent can use this to highlight the corresponding cause card.
   */
  onEventClick?: (limiterId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventTimelineStrip({ events, family, mode, onEventClick }: Props) {
  const demandEvents = buildDemandEvents(events);
  const responseEvents = buildResponseEvents(events, family, mode);
  const heading = mode === 'current' ? 'What happens now' : 'What changes';

  /** Builds click/keydown props for a single strip event. */
  function eventInteraction(evt: StripEvent) {
    const { limiterId } = evt;
    if (onEventClick == null || limiterId == null) return {};
    const handleClick = () => onEventClick(limiterId);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onEventClick(limiterId);
      }
    };
    return {
      tabIndex: 0 as const,
      'aria-label': `${evt.label} — tap to see why`,
      onClick: handleClick,
      onKeyDown: handleKeyDown,
    };
  }

  return (
    <section className="evt-strip" aria-label={heading}>
      <p className="evt-strip__heading">{heading}</p>
      <div className="evt-strip__layout">
        {/* Section 1: Demand */}
        <div className="evt-strip__section">
          <p className="evt-strip__section-label">Demand</p>
          <div className="evt-strip__track" role="list">
            {demandEvents.map((evt, idx) => {
              const isClickable = onEventClick != null && evt.limiterId != null;
              return (
                <div
                  key={idx}
                  className={[
                    'evt-strip__event',
                    `evt-strip__event--${evt.kind}`,
                    isClickable ? 'evt-strip__event--clickable' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="listitem"
                  {...eventInteraction(evt)}
                >
                  <span className="evt-strip__icon" aria-hidden="true">{evt.icon}</span>
                  <span className="evt-strip__label">{evt.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="evt-strip__section-divider" aria-hidden="true">→</div>

        {/* Section 2: System response */}
        <div className="evt-strip__section">
          <p className="evt-strip__section-label">System</p>
          <div className="evt-strip__track" role="list">
            {responseEvents.map((evt, idx) => {
              const isClickable = onEventClick != null && evt.limiterId != null;
              return (
                <div
                  key={idx}
                  className={[
                    'evt-strip__event',
                    `evt-strip__event--${evt.kind}`,
                    isClickable ? 'evt-strip__event--clickable' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="listitem"
                  {...eventInteraction(evt)}
                >
                  <span className="evt-strip__icon" aria-hidden="true">{evt.icon}</span>
                  <span className="evt-strip__label">{evt.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

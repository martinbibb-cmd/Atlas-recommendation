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
 * Kept to a maximum of 4 events per section to avoid clutter.
 */

import type { DerivedSystemEventSummary } from '../../engine/timeline/DerivedSystemEvent';
import type { SelectableFamily } from '../family-view/useSelectedFamilyData';
import type { PresentationMode } from './presentationTypes';
import './EventTimelineStrip.css';

// ─── Event icon helpers ───────────────────────────────────────────────────────

interface StripEvent {
  icon: string;
  label: string;
  kind: 'neutral' | 'problem' | 'problem-interruption' | 'problem-recharge' | 'improvement';
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
    strip.push({ icon: '🚰', label: 'Hot tap', kind: 'neutral' });
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
      });
    }
    // Purge cycle only shown in current mode — it disappears with proposed system
    if (!isProposed && events.counters.purgeCycles > 0) {
      strip.push({
        icon: '💨',
        label: 'Cold burst',
        kind: 'problem',
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
      });
    } else {
      strip.push({
        icon: '✅',
        label: 'Reserve full',
        kind: 'neutral',
      });
    }
  }

  // ── Reduced flow: only in current mode ────────────────────────────────
  if (!isProposed && events.counters.reducedDhwEvents > 0) {
    strip.push({
      icon: '📉',
      label: 'Flow drops',
      kind: 'problem',
    });
  }

  return strip;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  events: DerivedSystemEventSummary;
  family: SelectableFamily;
  mode: PresentationMode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventTimelineStrip({ events, family, mode }: Props) {
  const demandEvents = buildDemandEvents(events);
  const responseEvents = buildResponseEvents(events, family, mode);
  const heading = mode === 'current' ? 'What happens now' : 'What changes';

  return (
    <section className="evt-strip" aria-label={heading}>
      <p className="evt-strip__heading">{heading}</p>
      <div className="evt-strip__layout">
        {/* Section 1: Demand */}
        <div className="evt-strip__section">
          <p className="evt-strip__section-label">Demand</p>
          <div className="evt-strip__track" role="list">
            {demandEvents.map((evt, idx) => (
              <div
                key={idx}
                className={`evt-strip__event evt-strip__event--${evt.kind}`}
                role="listitem"
              >
                <span className="evt-strip__icon" aria-hidden="true">{evt.icon}</span>
                <span className="evt-strip__label">{evt.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="evt-strip__section-divider" aria-hidden="true">→</div>

        {/* Section 2: System response */}
        <div className="evt-strip__section">
          <p className="evt-strip__section-label">System</p>
          <div className="evt-strip__track" role="list">
            {responseEvents.map((evt, idx) => (
              <div
                key={idx}
                className={`evt-strip__event evt-strip__event--${evt.kind}`}
                role="listitem"
              >
                <span className="evt-strip__icon" aria-hidden="true">{evt.icon}</span>
                <span className="evt-strip__label">{evt.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

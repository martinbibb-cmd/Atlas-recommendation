/**
 * EventTimelineStrip.tsx — Presentation Layer v1.
 *
 * Horizontal visual strip showing what happens in the home during the
 * morning peak scenario.  Icons represent key system events; problem
 * events are highlighted in the 'current' mode, and improvements are
 * highlighted in the 'proposed' mode.
 *
 * Data source: DerivedSystemEventSummary (PR7 counters and events).
 * Visual: intentionally icon-based and non-charty.
 *
 * Layout: left-to-right scenario strip
 *   [ 🚿 Shower ] [ 🚰 Tap ] [ 🔥 Heating ] [ ⏸ Interrupted? ] [ 🔄 Recharging? ]
 *
 * Visual distinction:
 *   problem events     — amber/orange border + red label (current mode)
 *   improvement events — green border + green label (proposed mode)
 *   interruption       — amber/pulsing (distinct from recharge which is blue)
 *   recharge           — blue tint (stored system fills back up)
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
 * Derives the scenario strip events for the morning peak scenario
 * from the event summary and the selected family/mode.
 */
function buildStripEvents(
  events: DerivedSystemEventSummary,
  family: SelectableFamily,
  mode: PresentationMode,
): StripEvent[] {
  const strip: StripEvent[] = [];
  const isProposed = mode === 'proposed';

  // ── DHW demand ─────────────────────────────────────────────────────────
  strip.push({
    icon: '🚿',
    label: 'Shower',
    kind: 'neutral',
  });

  if (events.counters.dhwRequests > 0 || family === 'combi' || family === 'stored_water') {
    strip.push({
      icon: '🚰',
      label: 'Hot tap',
      kind: 'neutral',
    });
  }

  // ── Heating ────────────────────────────────────────────────────────────
  strip.push({
    icon: '🔥',
    label: 'Heating on',
    kind: 'neutral',
  });

  // ── Combi interruptions ────────────────────────────────────────────────
  if (family === 'combi') {
    const hasInterruption = events.counters.heatingInterruptions > 0;
    if (hasInterruption) {
      strip.push({
        icon: isProposed ? '✅' : '⏸',
        label: isProposed ? 'Heating continuous' : 'Heating paused',
        kind: isProposed ? 'improvement' : 'problem-interruption',
      });
    }
    if (events.counters.purgeCycles > 0) {
      strip.push({
        icon: isProposed ? '🟢' : '💨',
        label: isProposed ? 'Hot water ready' : 'Purge cycle',
        kind: isProposed ? 'improvement' : 'problem',
      });
    }
  }

  // ── Stored system ──────────────────────────────────────────────────────
  if (family === 'stored_water' || family === 'open_vented' || family === 'heat_pump') {
    const hasRecharge = events.counters.rechargeCycles > 0;
    strip.push({
      icon: isProposed ? '🟢' : (hasRecharge ? '🔄' : '✅'),
      label: isProposed
        ? 'Reserve maintained'
        : (hasRecharge ? 'Cylinder recharging' : 'Reserve full'),
      kind: isProposed ? 'improvement' : (hasRecharge ? 'problem-recharge' : 'neutral'),
    });
  }

  // ── Reduced DHW flag ───────────────────────────────────────────────────
  if (events.counters.reducedDhwEvents > 0) {
    strip.push({
      icon: isProposed ? '✅' : '📉',
      label: isProposed ? 'Full flow' : 'Flow reduced',
      kind: isProposed ? 'improvement' : 'problem',
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
  const stripEvents = buildStripEvents(events, family, mode);
  const heading = mode === 'current' ? 'What happens now' : 'What changes';

  return (
    <section className="evt-strip" aria-label={heading}>
      <p className="evt-strip__heading">{heading}</p>
      <div className="evt-strip__track" role="list">
        {stripEvents.map((evt, idx) => (
          <div key={idx} className={`evt-strip__event evt-strip__event--${evt.kind}`} role="listitem">
            <span className="evt-strip__icon" aria-hidden="true">{evt.icon}</span>
            <span className="evt-strip__label">{evt.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

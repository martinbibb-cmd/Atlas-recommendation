/**
 * BehaviourTimeline.tsx
 *
 * Layer 3 — day simulation with a playable timeline.
 *
 * A 24-hour horizontal track shows behaviour events as markers.
 * Pressing Play steps through the events in sequence, driving
 * a visual playhead and an "active event" highlight.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BehaviourEvent, BehaviourEventType } from './explorerTypes';

interface Props {
  events: BehaviourEvent[];
  /** Called with the current boiler load fraction as playback progresses */
  onLoadChange?: (fraction: number) => void;
}

// ── Event icons ───────────────────────────────────────────────────────────────

const EVENT_META: Record<BehaviourEventType, { icon: string; color: string; label: string }> = {
  heatingOn:      { icon: '♨',  color: '#ff7a00', label: 'Heating on'      },
  heatingOff:     { icon: '❄',  color: '#3fa7ff', label: 'Heating off'     },
  heatingRamp:    { icon: '↗',  color: '#f39c12', label: 'Heating ramp'    },
  shower:         { icon: '🚿', color: '#3fa7ff', label: 'Shower'          },
  bath:           { icon: '🛁', color: '#3fa7ff', label: 'Bath'            },
  tap:            { icon: '💧', color: '#3fa7ff', label: 'Tap'             },
  cylinderReheat: { icon: '🔥', color: '#f39c12', label: 'Cylinder reheat' },
  defrost:        { icon: '❄️', color: '#a0c4ff', label: 'Defrost cycle'   },
};

// ── Boiler load bar ───────────────────────────────────────────────────────────

function BoilerLoadBar({ fraction }: { fraction: number }) {
  const pct = Math.round(fraction * 100);
  const color = fraction > 0.8 ? '#ff7a00' : fraction > 0.4 ? '#f39c12' : fraction > 0 ? '#28c76f' : '#cbd5e0';

  return (
    <div className="btl__load-bar">
      <span className="btl__load-label">Boiler load</span>
      <div className="btl__load-track">
        <div
          className="btl__load-fill"
          style={{
            width: `${pct}%`,
            background: color,
            transition: 'width 0.6s ease, background 0.6s ease',
          }}
        />
      </div>
      <span className="btl__load-pct" style={{ color }}>{pct}%</span>
    </div>
  );
}

// ── Timeline track ────────────────────────────────────────────────────────────

function TimelineTrack({ events, activeIndex, playheadHour }: {
  events: BehaviourEvent[];
  activeIndex: number;
  playheadHour: number;
}) {
  const pct = (h: number) => `${(h / 24) * 100}%`;

  return (
    <div className="btl__track-wrap">
      {/* Axis labels */}
      <div className="btl__axis">
        {[0, 6, 12, 18, 24].map(h => (
          <span key={h} className="btl__axis-label" style={{ left: pct(h) }}>
            {h === 0 ? '00:00' : h === 24 ? '' : `${String(h).padStart(2,'0')}:00`}
          </span>
        ))}
      </div>

      {/* Track bar */}
      <div className="btl__track">
        {/* Night / day / evening zones */}
        <div className="btl__zone btl__zone--night" style={{ left: '0%',   width: '25%' }} />
        <div className="btl__zone btl__zone--day"   style={{ left: '25%',  width: '50%' }} />
        <div className="btl__zone btl__zone--night" style={{ left: '75%',  width: '25%' }} />

        {/* Event markers */}
        {events.map((ev, i) => {
          const meta = EVENT_META[ev.type];
          const isActive = i === activeIndex;
          return (
            <div
              key={ev.id}
              className={`btl__marker ${isActive ? 'btl__marker--active' : ''}`}
              style={{
                left: pct(ev.hourDecimal),
                borderColor: meta.color,
                background: isActive ? meta.color : 'white',
              }}
              title={`${ev.timeLabel} — ${ev.label}`}
              aria-label={ev.label}
            >
              <span style={{ fontSize: 10 }}>{meta.icon}</span>
            </div>
          );
        })}

        {/* Playhead */}
        <div
          className="btl__playhead"
          style={{ left: pct(playheadHour), transition: 'left 0.5s ease' }}
        />
      </div>
    </div>
  );
}

// ── Active event card ─────────────────────────────────────────────────────────

function ActiveEventCard({ event }: { event: BehaviourEvent | null }) {
  if (!event) {
    return (
      <div className="btl__event-card btl__event-card--empty">
        Press Play to simulate the day
      </div>
    );
  }
  const meta = EVENT_META[event.type];
  return (
    <div className="btl__event-card" style={{ borderLeftColor: meta.color }}>
      <span className="btl__event-icon">{meta.icon}</span>
      <div className="btl__event-body">
        <span className="btl__event-time">{event.timeLabel}</span>
        <span className="btl__event-label">{event.label}</span>
      </div>
      <span className="btl__event-type" style={{ color: meta.color }}>{meta.label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BehaviourTimeline({ events, onLoadChange }: Props) {
  const [playing, setPlaying]       = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playheadHour, setPlayheadHour] = useState(0);
  const [currentLoad, setCurrentLoad]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any running timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const advance = useCallback((index: number) => {
    if (index >= events.length) {
      setPlaying(false);
      setActiveIndex(-1);
      setPlayheadHour(24);
      return;
    }
    const ev = events[index];
    setActiveIndex(index);
    setPlayheadHour(ev.hourDecimal);
    setCurrentLoad(ev.boilerLoadFraction);
    onLoadChange?.(ev.boilerLoadFraction);

    const delay = index === 0 ? 1200 : 1400;
    timerRef.current = setTimeout(() => advance(index + 1), delay);
  }, [events, onLoadChange]);

  function handlePlay() {
    if (playing) {
      // Stop
      if (timerRef.current) clearTimeout(timerRef.current);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    setActiveIndex(-1);
    setPlayheadHour(0);
    setCurrentLoad(0);
    advance(0);
  }

  const activeEvent = activeIndex >= 0 ? events[activeIndex] : null;

  return (
    <div className="btl">
      {/* Header */}
      <div className="btl__header">
        <h3 className="btl__title">Behaviour Timeline</h3>
        <button
          className={`btl__play-btn ${playing ? 'btl__play-btn--stop' : ''}`}
          onClick={handlePlay}
          aria-label={playing ? 'Stop playback' : 'Play day playback'}
        >
          {playing ? '■ Stop' : '▶ Play day'}
        </button>
      </div>

      {/* Track */}
      <TimelineTrack
        events={events}
        activeIndex={activeIndex}
        playheadHour={playheadHour}
      />

      {/* Active event */}
      <ActiveEventCard event={activeEvent} />

      {/* Boiler load */}
      <BoilerLoadBar fraction={currentLoad} />
    </div>
  );
}

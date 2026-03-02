/**
 * DaySchedulePanel — smart thermostat-style single-day schedule editor.
 *
 * Provides three editing surfaces that feed into DayProfileV1:
 *   1. HeatingScheduleBands  — time bands with temperature setpoints
 *   2. HotWaterScheduleBands — time bands with ON/OFF flag
 *   3. DhwEventsTimeline     — tap a time to add a DHW draw event
 *
 * All changes call `onChange(profile)` which the parent passes directly to the engine.
 * No physics runs inside this component — it is purely an input editor.
 *
 * Custom instructions compliance:
 *   - No Math.random() — this component is a pure controlled form.
 *   - All graph data originates from EngineOutputV1 (via the parent).
 *   - Shower dropdown removed — demand is driven by profile choice + duration.
 */
import { useState, type CSSProperties } from 'react';
import type {
  DayProfileV1,
  HeatingBandV1,
  DhwHeatBandV1,
  DhwEventV1,
} from '../../contracts/EngineInputV2_3';

// ─── Default factory ──────────────────────────────────────────────────────────

// Standard UK thermostat-style heating schedule: two comfort bands + background setback.
export function defaultDayProfile(): DayProfileV1 {
  return {
    heatingBands: [
      { startMin: 5 * 60,      endMin: 8 * 60 + 30,  targetC: 21 },
      { startMin: 8 * 60 + 30, endMin: 11 * 60 + 30, targetC: 20 },
      { startMin: 17 * 60,     endMin: 22 * 60,       targetC: 21 },
    ],
    dhwHeatBands: [
      { startMin: 5 * 60, endMin: 9 * 60,  on: true },
      { startMin: 18 * 60, endMin: 22 * 60, on: true },
    ],
    dhwEvents: [],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const PROFILE_LABELS: Record<DhwEventV1['profile'], string> = {
  mixer10:    'Mixer 10 L/min',
  mixer12:    'Mixer high 12 L/min',
  rainfall16: 'Rainfall 16 L/min',
};

const KIND_LABELS: Record<DhwEventV1['kind'], string> = {
  shower: 'Shower',
  bath:   'Bath',
  taps:   'Taps',
};

const DURATION_OPTIONS = [5, 8, 10, 12, 15, 20];

// ── Temperature bounds for heating setpoint inputs ────────────────────────────
/** Minimum allowed heating setpoint (°C) — frost protection floor. */
const MIN_HEATING_TEMP_C = 14;
/** Maximum allowed heating setpoint (°C) — over-heat prevention ceiling. */
const MAX_HEATING_TEMP_C = 25;

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionStyle: CSSProperties = {
  marginBottom: '1.25rem',
};

const bandRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.35rem 0.5rem',
  borderRadius: '6px',
  background: '#f7fafc',
  marginBottom: '0.35rem',
  flexWrap: 'wrap',
};

const inputStyle: CSSProperties = {
  padding: '2px 6px',
  border: '1px solid #cbd5e0',
  borderRadius: '4px',
  fontSize: '0.82rem',
  width: '74px',
};

const btnSmallStyle: CSSProperties = {
  padding: '2px 8px',
  borderRadius: '4px',
  border: '1px solid #cbd5e0',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '0.78rem',
};

const addBtnStyle: CSSProperties = {
  padding: '4px 12px',
  borderRadius: '6px',
  border: '1px solid #3182ce',
  background: '#ebf8ff',
  color: '#2b6cb0',
  cursor: 'pointer',
  fontSize: '0.8rem',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeatingScheduleBands({
  bands,
  onChange,
}: {
  bands: HeatingBandV1[];
  onChange: (bands: HeatingBandV1[]) => void;
}) {
  const update = (idx: number, patch: Partial<HeatingBandV1>) => {
    onChange(bands.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const add = () => {
    const last = bands[bands.length - 1];
    const startMin = last ? last.endMin : 0;
    onChange([...bands, { startMin, endMin: Math.min(startMin + 60, 1440), targetC: 21 }]);
  };

  const remove = (idx: number) => onChange(bands.filter((_, i) => i !== idx));

  return (
    <div style={sectionStyle}>
      <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.88rem' }}>
        🌡️ Heating Schedule
      </div>
      {bands.map((band, i) => (
        <div key={i} style={bandRowStyle}>
          <label style={{ fontSize: '0.78rem', color: '#718096' }}>Start</label>
          <input
            type="time"
            style={inputStyle}
            value={minutesToHHMM(band.startMin)}
            onChange={(e) => update(i, { startMin: hhmmToMinutes(e.target.value) })}
          />
          <label style={{ fontSize: '0.78rem', color: '#718096' }}>End</label>
          <input
            type="time"
            style={inputStyle}
            value={minutesToHHMM(band.endMin)}
            onChange={(e) => update(i, { endMin: hhmmToMinutes(e.target.value) })}
          />
          <label style={{ fontSize: '0.78rem', color: '#718096' }}>Temp</label>
          <input
            type="number"
            min={MIN_HEATING_TEMP_C}
            max={MAX_HEATING_TEMP_C}
            style={{ ...inputStyle, width: '52px' }}
            value={band.targetC}
            onChange={(e) => update(i, { targetC: Number(e.target.value) })}
          />
          <span style={{ fontSize: '0.78rem', color: '#718096' }}>°C</span>
          <button style={btnSmallStyle} onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      <button style={addBtnStyle} onClick={add}>+ Add band</button>
    </div>
  );
}

function HotWaterScheduleBands({
  bands,
  onChange,
}: {
  bands: DhwHeatBandV1[];
  onChange: (bands: DhwHeatBandV1[]) => void;
}) {
  const update = (idx: number, patch: Partial<DhwHeatBandV1>) => {
    onChange(bands.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const add = () => {
    const last = bands[bands.length - 1];
    const startMin = last ? last.endMin : 0;
    onChange([...bands, { startMin, endMin: Math.min(startMin + 60, 1440), on: true }]);
  };

  const remove = (idx: number) => onChange(bands.filter((_, i) => i !== idx));

  return (
    <div style={sectionStyle}>
      <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.88rem' }}>
        🚿 Hot Water Schedule
      </div>
      {bands.map((band, i) => (
        <div key={i} style={bandRowStyle}>
          <label style={{ fontSize: '0.78rem', color: '#718096' }}>Start</label>
          <input
            type="time"
            style={inputStyle}
            value={minutesToHHMM(band.startMin)}
            onChange={(e) => update(i, { startMin: hhmmToMinutes(e.target.value) })}
          />
          <label style={{ fontSize: '0.78rem', color: '#718096' }}>End</label>
          <input
            type="time"
            style={inputStyle}
            value={minutesToHHMM(band.endMin)}
            onChange={(e) => update(i, { endMin: hhmmToMinutes(e.target.value) })}
          />
          <button
            style={{
              padding: '2px 10px',
              borderRadius: '10px',
              border: '1px solid',
              borderColor: band.on ? '#38a169' : '#e53e3e',
              background: band.on ? '#f0fff4' : '#fff5f5',
              color: band.on ? '#276749' : '#c53030',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
            onClick={() => update(i, { on: !band.on })}
          >
            {band.on ? 'ON' : 'OFF'}
          </button>
          <button style={btnSmallStyle} onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      <button style={addBtnStyle} onClick={add}>+ Add band</button>
    </div>
  );
}

function DhwEventsTimeline({
  events,
  onChange,
}: {
  events: DhwEventV1[];
  onChange: (events: DhwEventV1[]) => void;
}) {
  const [addMinute, setAddMinute] = useState<string>('07:00');
  const [addKind, setAddKind] = useState<DhwEventV1['kind']>('shower');
  const [addProfile, setAddProfile] = useState<DhwEventV1['profile']>('mixer10');
  const [addDuration, setAddDuration] = useState<number>(8);

  const addEvent = () => {
    onChange([
      ...events,
      {
        startMin: hhmmToMinutes(addMinute),
        durationMin: addDuration,
        kind: addKind,
        profile: addProfile,
      },
    ]);
  };

  const remove = (idx: number) => onChange(events.filter((_, i) => i !== idx));

  return (
    <div style={sectionStyle}>
      <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.88rem' }}>
        🛁 DHW Draw Events
      </div>

      {events.length === 0 && (
        <div style={{ fontSize: '0.8rem', color: '#a0aec0', marginBottom: '0.5rem' }}>
          No events — tap a time below to add.
        </div>
      )}

      {events.map((ev, i) => (
        <div key={i} style={{ ...bandRowStyle, background: '#e6fffa' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
            {minutesToHHMM(ev.startMin)}
          </span>
          <span style={{ fontSize: '0.78rem', color: '#2d3748' }}>
            {KIND_LABELS[ev.kind]} · {PROFILE_LABELS[ev.profile]} · {ev.durationMin} min
          </span>
          <button style={btnSmallStyle} onClick={() => remove(i)}>✕</button>
        </div>
      ))}

      {/* Add event form */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          flexWrap: 'wrap',
          padding: '0.5rem',
          borderRadius: '6px',
          border: '1px dashed #bee3f8',
          background: '#ebf8ff',
          marginTop: '0.5rem',
        }}
      >
        <input
          type="time"
          style={inputStyle}
          value={addMinute}
          onChange={(e) => setAddMinute(e.target.value)}
        />
        <select
          style={{ ...inputStyle, width: 'auto' }}
          value={addKind}
          onChange={(e) => setAddKind(e.target.value as DhwEventV1['kind'])}
        >
          {(Object.keys(KIND_LABELS) as DhwEventV1['kind'][]).map((k) => (
            <option key={k} value={k}>{KIND_LABELS[k]}</option>
          ))}
        </select>
        <select
          style={{ ...inputStyle, width: 'auto' }}
          value={addProfile}
          onChange={(e) => setAddProfile(e.target.value as DhwEventV1['profile'])}
        >
          {(Object.keys(PROFILE_LABELS) as DhwEventV1['profile'][]).map((p) => (
            <option key={p} value={p}>{PROFILE_LABELS[p]}</option>
          ))}
        </select>
        <select
          style={{ ...inputStyle, width: '72px' }}
          value={addDuration}
          onChange={(e) => setAddDuration(Number(e.target.value))}
        >
          {DURATION_OPTIONS.map((d) => (
            <option key={d} value={d}>{d} min</option>
          ))}
        </select>
        <button
          style={{
            ...addBtnStyle,
            background: '#3182ce',
            color: '#fff',
            border: 'none',
          }}
          onClick={addEvent}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface DaySchedulePanelProps {
  profile: DayProfileV1;
  onChange: (profile: DayProfileV1) => void;
}

/**
 * DaySchedulePanel
 *
 * Smart thermostat-style single-day schedule editor.  The parent owns `profile` state and
 * passes it straight to the engine; this component never touches chart state.
 */
export default function DaySchedulePanel({ profile, onChange }: DaySchedulePanelProps) {
  return (
    <div>
      <HeatingScheduleBands
        bands={profile.heatingBands}
        onChange={(heatingBands) => onChange({ ...profile, heatingBands })}
      />
      <HotWaterScheduleBands
        bands={profile.dhwHeatBands}
        onChange={(dhwHeatBands) => onChange({ ...profile, dhwHeatBands })}
      />
      <DhwEventsTimeline
        events={profile.dhwEvents}
        onChange={(dhwEvents) => onChange({ ...profile, dhwEvents })}
      />
    </div>
  );
}

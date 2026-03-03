import { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { buildDayModelFromEvents, buildDefaultDayModel, type DayEvent } from '../../engine/daypainter/BuildDayModel';
import { simulateSystemDay, type DaySystemType } from '../../engine/daypainter/SimulateSystemDay';

// ─── System type labels ───────────────────────────────────────────────────────

const SYSTEM_LABELS: Record<DaySystemType, string> = {
  combi:                'Combi',
  open_vented:          'Open Vented',
  mixergy_open_vented:  'Mixergy Open Vented',
  unvented:             'Unvented',
  mixergy_unvented:     'Mixergy Unvented',
  heat_pump:            'Heat Pump',
};

// ─── Draw event presets ───────────────────────────────────────────────────────

type DrawPresetKey = 'shower' | 'bath' | 'handwash' | 'dishwasher' | 'washing_machine';

interface DrawPreset {
  label: string;
  icon: string;
  defaultDuration: number;
  cold: boolean;
  toDayEvent: (startMin: number) => DayEvent;
}

const DRAW_PRESETS: Record<DrawPresetKey, DrawPreset> = {
  shower: {
    label: 'Shower', icon: '🚿', defaultDuration: 8, cold: false,
    toDayEvent: (startMin) => ({ type: 'shower', startMin, durationMin: 8, flowLpm: 10 }),
  },
  bath: {
    label: 'Bath', icon: '🛁', defaultDuration: 12, cold: false,
    toDayEvent: (startMin) => ({ type: 'bath', startMin, durationMin: 12, litres: 90 }),
  },
  handwash: {
    label: 'Handwash', icon: '🙌', defaultDuration: 2, cold: false,
    toDayEvent: (startMin) => ({ type: 'handwash', startMin, durationMin: 2, flowLpm: 2 }),
  },
  dishwasher: {
    label: 'Dishwasher', icon: '🍽️', defaultDuration: 10, cold: true,
    toDayEvent: (startMin) => ({ type: 'coldFillAppliance', startMin, durationMin: 10, flowLpm: 2, applianceType: 'dishwasher' }),
  },
  washing_machine: {
    label: 'Washing machine', icon: '👕', defaultDuration: 10, cold: true,
    toDayEvent: (startMin) => ({ type: 'coldFillAppliance', startMin, durationMin: 10, flowLpm: 2, applianceType: 'washing_machine' }),
  },
};

function eventDisplay(event: DayEvent): { icon: string; label: string; cold: boolean } {
  if (event.type === 'shower')    return { icon: '🚿', label: 'Shower',          cold: false };
  if (event.type === 'bath')      return { icon: '🛁', label: 'Bath',            cold: false };
  if (event.type === 'handwash')  return { icon: '🙌', label: 'Handwash',        cold: false };
  if (event.type === 'coldFillAppliance') {
    return event.applianceType === 'washing_machine'
      ? { icon: '👕', label: 'Washing machine', cold: true }
      : { icon: '🍽️', label: 'Dishwasher',       cold: true };
  }
  return { icon: '💧', label: 'Other draw', cold: false };
}

function minuteToHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  heatLossWatts: number;
  tauHours: number;
  currentSystem: DaySystemType;
  proposedSystem: DaySystemType;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DayPainterResults({ heatLossWatts, tauHours, currentSystem, proposedSystem }: Props) {
  const defaultEvents = useMemo(() => buildDefaultDayModel().events, []);

  // Draw event list (what the user has scheduled for the day)
  const [events, setEvents] = useState<DayEvent[]>(defaultEvents);

  // Add-event form state
  const [addType, setAddType]   = useState<DrawPresetKey>('shower');
  const [addHour, setAddHour]   = useState(7);
  const [addMin, setAddMin]     = useState(0);

  // System selector (user overrides the engine recommendation)
  const [userProposedSystem, setUserProposedSystem] = useState<DaySystemType>(proposedSystem);

  // Heat demand slider (separate from water draws)
  const [customHeatKw, setCustomHeatKw] = useState(
    Math.max(2, Math.min(20, Math.round(heatLossWatts / 500) * 0.5)),
  );
  const effectiveHeatLossWatts = customHeatKw * 1000;

  function addEvent() {
    const startMin = addHour * 60 + addMin;
    const newEvent = DRAW_PRESETS[addType].toDayEvent(startMin);
    setEvents(prev => [...prev, newEvent].sort((a, b) => a.startMin - b.startMin));
  }

  function removeEvent(idx: number) {
    setEvents(prev => prev.filter((_, i) => i !== idx));
  }

  // Rebuild model whenever the event list changes
  const dayModel = useMemo(() => buildDayModelFromEvents(events), [events]);

  const current = useMemo(
    () => simulateSystemDay({ dayModel, systemType: currentSystem, heatLossWatts: effectiveHeatLossWatts, tauHours }),
    [dayModel, currentSystem, effectiveHeatLossWatts, tauHours],
  );
  const proposed = useMemo(
    () => simulateSystemDay({ dayModel, systemType: userProposedSystem, heatLossWatts: effectiveHeatLossWatts, tauHours }),
    [dayModel, userProposedSystem, effectiveHeatLossWatts, tauHours],
  );

  // Chart data series
  const causesData = dayModel.dhwMixedLpmByStep.map((dhwLpm, i) => {
    const minute = i * 5;
    const coldDraw = events.reduce((sum, ev) => {
      if (ev.type !== 'coldFillAppliance') return sum;
      const end = ev.startMin + ev.durationMin;
      return minute >= ev.startMin && minute < end ? sum + (ev.flowLpm ?? 0) : sum;
    }, 0);
    return {
      t: minuteToHM(minute),
      'Hot draw (L/min)': dhwLpm,
      'Cold fill (L/min)': coldDraw,
    };
  });

  const demandData = current.map((row, i) => ({
    t: row.timeLabel,
    'CH demand': row.chDemandKw,
    'DHW demand': row.dhwTapDemandKw,
    [`${SYSTEM_LABELS[currentSystem]} output`]: row.plantOutputKw,
    [`${SYSTEM_LABELS[userProposedSystem]} output`]: proposed[i].plantOutputKw,
  }));

  const internalTempData = current.map((row, i) => ({
    t: row.timeLabel,
    [`${SYSTEM_LABELS[currentSystem]} (°C)`]: row.internalTempC,
    [`${SYSTEM_LABELS[userProposedSystem]} (°C)`]: proposed[i].internalTempC,
  }));

  const cylinderData = current.map((row, i) => ({
    t: row.timeLabel,
    [`${SYSTEM_LABELS[currentSystem]} cyl`]: row.cylinderTempC,
    [`${SYSTEM_LABELS[userProposedSystem]} cyl`]: proposed[i].cylinderTempC,
  }));

  const showCylinder = currentSystem !== 'combi' || userProposedSystem !== 'combi';

  const chipStyle = (active: boolean) => ({
    padding: '4px 12px',
    borderRadius: 16,
    border: `1.5px solid ${active ? '#3182ce' : '#e2e8f0'}`,
    background: active ? '#ebf8ff' : '#fff',
    color: active ? '#2c5282' : '#718096',
    fontSize: '0.78rem',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
  } as const);

  return (
    <div>
      {/* ── Proposed system selector ─────────────────────────────────────────── */}
      <div style={{
        background: '#f7fafc', border: '1px solid #e2e8f0',
        borderRadius: 8, padding: '0.875rem 1rem', marginBottom: '1rem',
      }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', color: '#2d3748' }}>
          ⚙️ System &amp; Demand Settings
        </h4>

        <div style={{ marginBottom: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.3rem' }}>
            Changing to (proposed system)
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {(Object.keys(SYSTEM_LABELS) as DaySystemType[]).map(sys => (
              <button key={sys} onClick={() => setUserProposedSystem(sys)} style={chipStyle(userProposedSystem === sys)}>
                {SYSTEM_LABELS[sys]}
              </button>
            ))}
          </div>
        </div>

        {/* Heat demand slider */}
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.2rem' }}>
            🔥 Heat demand: <strong>{customHeatKw} kW</strong>
          </div>
          <input
            type="range" min={2} max={20} step={0.5} value={customHeatKw}
            onChange={e => setCustomHeatKw(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#3182ce' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.63rem', color: '#718096' }}>
            <span>2 kW</span><span>20 kW</span>
          </div>
        </div>
      </div>

      {/* ── Water draw event list ────────────────────────────────────────────── */}
      <div style={{
        background: '#f7fafc', border: '1px solid #e2e8f0',
        borderRadius: 8, padding: '0.875rem 1rem', marginBottom: '1rem',
      }}>
        <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.88rem', color: '#2d3748' }}>
          💧 Water Draw Schedule
        </h4>

        {/* Scheduled events list */}
        {events.length === 0 ? (
          <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 0.6rem' }}>
            No draws scheduled — add events below.
          </p>
        ) : (
          <div style={{ marginBottom: '0.75rem' }}>
            {events.map((ev, i) => {
              const { icon, label, cold } = eventDisplay(ev);
              const end = ev.startMin + ev.durationMin;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '4px 8px', borderRadius: 6, marginBottom: 4,
                  background: cold ? '#f0fff4' : '#ebf8ff',
                  border: `1px solid ${cold ? '#9ae6b4' : '#90cdf4'}`,
                  fontSize: '0.78rem',
                }}>
                  <span>{icon}</span>
                  <span style={{ fontWeight: 600, minWidth: 120 }}>{label}</span>
                  <span style={{ color: '#718096' }}>
                    {minuteToHM(ev.startMin)} – {minuteToHM(end)}
                  </span>
                  <span style={{ color: '#718096', fontSize: '0.72rem' }}>
                    ({ev.durationMin} min{cold ? ' · cold fill' : ''})
                  </span>
                  <button
                    onClick={() => removeEvent(i)}
                    style={{
                      marginLeft: 'auto', border: 'none', background: 'transparent',
                      cursor: 'pointer', color: '#e53e3e', fontSize: '1rem', lineHeight: 1,
                      padding: '0 2px',
                    }}
                    aria-label={`Remove ${label} at ${minuteToHM(ev.startMin)}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add event form */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={addType}
            onChange={e => setAddType(e.target.value as DrawPresetKey)}
            style={{
              padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0',
              fontSize: '0.78rem', background: '#fff', cursor: 'pointer',
            }}
          >
            {(Object.entries(DRAW_PRESETS) as [DrawPresetKey, DrawPreset][]).map(([key, p]) => (
              <option key={key} value={key}>{p.icon} {p.label}</option>
            ))}
          </select>

          <span style={{ fontSize: '0.75rem', color: '#718096' }}>at</span>

          <select
            value={addHour}
            onChange={e => setAddHour(Number(e.target.value))}
            style={{
              padding: '4px 6px', borderRadius: 6, border: '1px solid #e2e8f0',
              fontSize: '0.78rem', background: '#fff', cursor: 'pointer',
            }}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
            ))}
          </select>

          <span style={{ fontSize: '0.75rem', color: '#718096' }}>:</span>

          <select
            value={addMin}
            onChange={e => setAddMin(Number(e.target.value))}
            style={{
              padding: '4px 6px', borderRadius: 6, border: '1px solid #e2e8f0',
              fontSize: '0.78rem', background: '#fff', cursor: 'pointer',
            }}
          >
            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
              <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
            ))}
          </select>

          <button
            onClick={addEvent}
            style={{
              padding: '4px 14px', borderRadius: 6,
              border: '1.5px solid #3182ce', background: '#ebf8ff',
              color: '#2b6cb0', fontSize: '0.78rem', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + Add
          </button>
        </div>
      </div>

      <p style={{ fontSize: '0.82rem', color: '#4a5568' }}>
        The same draw schedule runs against both systems. CH behaviour follows HLC + thermal inertia (τ).
      </p>

      {/* ── Causes: demand timeline ──────────────────────────────────────────── */}
      <h4 style={{ margin: '0.75rem 0 0.4rem' }}>Causes — Water draw timeline (L/min)</h4>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={causesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" interval={23} tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip contentStyle={{ fontSize: '0.75rem' }} />
            <Line dataKey="Hot draw (L/min)"  stroke="#2b6cb0" dot={false} strokeWidth={2} />
            <Line dataKey="Cold fill (L/min)" stroke="#48bb78" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Effects: demand vs plant output ─────────────────────────────────── */}
      <h4 style={{ margin: '0.75rem 0 0.4rem' }}>Effects — Demand vs plant output (kW)</h4>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={demandData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" interval={23} tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip contentStyle={{ fontSize: '0.75rem' }} />
            <Line dataKey="CH demand"  stroke="#805ad5" dot={false} strokeWidth={1.5} />
            <Line dataKey="DHW demand" stroke="#3182ce" dot={false} strokeWidth={1.5} />
            <Line dataKey={`${SYSTEM_LABELS[currentSystem]} output`}      stroke="#e53e3e" dot={false} strokeWidth={2} />
            <Line dataKey={`${SYSTEM_LABELS[userProposedSystem]} output`} stroke="#38a169" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Internal temperature ─────────────────────────────────────────────── */}
      <h4 style={{ margin: '0.75rem 0 0.4rem' }}>Internal temperature (°C)</h4>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={internalTempData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" interval={23} tick={{ fontSize: 9 }} />
            <YAxis domain={[12, 24]} tick={{ fontSize: 9 }} />
            <Tooltip contentStyle={{ fontSize: '0.75rem' }} />
            <Line dataKey={`${SYSTEM_LABELS[currentSystem]} (°C)`}      stroke="#c53030" dot={false} strokeWidth={2} />
            <Line dataKey={`${SYSTEM_LABELS[userProposedSystem]} (°C)`} stroke="#2f855a" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Cylinder temperature ─────────────────────────────────────────────── */}
      {showCylinder && (
        <>
          <h4 style={{ margin: '0.75rem 0 0.4rem' }}>Cylinder temperature (°C)</h4>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cylinderData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" interval={23} tick={{ fontSize: 9 }} />
                <YAxis domain={[35, 65]} tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: '0.75rem' }} />
                <Line dataKey={`${SYSTEM_LABELS[currentSystem]} cyl`}      stroke="#dd6b20" dot={false} strokeWidth={2} />
                <Line dataKey={`${SYSTEM_LABELS[userProposedSystem]} cyl`} stroke="#2c7a7b" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <p style={{ fontSize: '0.76rem', color: '#718096', marginTop: '0.5rem' }}>
        Loss channels: <strong>via flue</strong> and <strong>dumped to CH circuit</strong> are modelled separately.
        Combi pauses CH service during DHW draws.
      </p>
    </div>
  );
}

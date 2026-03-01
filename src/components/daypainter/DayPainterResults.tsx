import { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { buildDefaultDayModel } from '../../engine/daypainter/BuildDayModel';
import { simulateSystemDay, type DaySystemType } from '../../engine/daypainter/SimulateSystemDay';

interface Props {
  heatLossWatts: number;
  tauHours: number;
  currentSystem: DaySystemType;
  proposedSystem: DaySystemType;
}

const SYSTEM_LABELS: Record<DaySystemType, string> = {
  combi:   'Combi',
  stored:  'Stored',
  mixergy: 'Mixergy',
  ashp:    'ASHP',
};

/** Default peak shower flow rate from buildDefaultDayModel events (10 L/min shower). */
const DEFAULT_HOT_LPM = 10;

/**
 * Build a day model with DHW demand scaled to a user-specified peak flow rate.
 * The timeline shape (morning peak, evening peak) is preserved; only the amplitude scales.
 */
function buildScaledDayModel(hotLpm: number) {
  const base = buildDefaultDayModel();
  const scale = Math.max(0.1, hotLpm) / DEFAULT_HOT_LPM;
  return {
    ...base,
    dhwMixedLpmByStep: base.dhwMixedLpmByStep.map(v => parseFloat((v * scale).toFixed(2))),
  };
}

// ─── SliderField helper ───────────────────────────────────────────────────────

function SliderField({
  label,
  value,
  unit,
  min,
  max,
  step,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.2rem' }}>
        {label}: <strong>{value} {unit}</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#3182ce' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.63rem', color: '#a0aec0' }}>
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
      {hint && (
        <div style={{ fontSize: '0.65rem', color: '#718096', fontStyle: 'italic', marginTop: '0.15rem' }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DayPainterResults({ heatLossWatts, tauHours, currentSystem, proposedSystem }: Props) {
  const [customHotLpm, setCustomHotLpm] = useState(DEFAULT_HOT_LPM);
  const [customColdLpm, setCustomColdLpm] = useState(2);
  const [customHeatKw, setCustomHeatKw] = useState(
    Math.max(2, Math.min(20, Math.round(heatLossWatts / 500) * 0.5)),
  );
  const [userProposedSystem, setUserProposedSystem] = useState<DaySystemType>(proposedSystem);

  const dayModel = useMemo(() => buildScaledDayModel(customHotLpm), [customHotLpm]);
  const effectiveHeatLossWatts = customHeatKw * 1000;

  const current = useMemo(
    () => simulateSystemDay({ dayModel, systemType: currentSystem, heatLossWatts: effectiveHeatLossWatts, tauHours }),
    [dayModel, currentSystem, effectiveHeatLossWatts, tauHours],
  );
  const proposed = useMemo(
    () => simulateSystemDay({ dayModel, systemType: userProposedSystem, heatLossWatts: effectiveHeatLossWatts, tauHours }),
    [dayModel, userProposedSystem, effectiveHeatLossWatts, tauHours],
  );

  const demandData = current.map((row, i) => ({
    t: row.timeLabel,
    chDemandKw: row.chDemandKw,
    dhwTapDemandKw: row.dhwTapDemandKw,
    currentPlantKw: row.plantOutputKw,
    proposedPlantKw: proposed[i].plantOutputKw,
    currentChDeliveredKw: row.chDeliveredKw,
    proposedChDeliveredKw: proposed[i].chDeliveredKw,
  }));

  const internalTempData = current.map((row, i) => ({
    t: row.timeLabel,
    currentInternalC: row.internalTempC,
    proposedInternalC: proposed[i].internalTempC,
  }));

  const cylinderData = current.map((row, i) => ({
    t: row.timeLabel,
    currentCylinderC: row.cylinderTempC,
    proposedCylinderC: proposed[i].cylinderTempC,
  }));

  // Causes chart: hot demand + cold draw overlaid on the same timeline.
  // The default cold-fill appliance event runs from 13:00 for 10 minutes.
  const causesData = dayModel.dhwMixedLpmByStep.map((dhwLpm, i) => {
    const minute = i * 5;
    const isColdFill = minute >= 13 * 60 && minute < 13 * 60 + 10;
    return {
      t: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
      'Hot demand (L/min)': dhwLpm,
      'Cold draw (L/min)': isColdFill ? customColdLpm : 0,
    };
  });

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
      {/* ── Custom Demand & Target System ───────────────────────────────────── */}
      <div style={{
        background: '#f7fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '0.875rem 1rem',
        marginBottom: '1rem',
      }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', color: '#2d3748' }}>
          ⚙️ Custom Demand &amp; Target System
        </h4>

        {/* Target system selector */}
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

        {/* Demand sliders */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <SliderField
            label="🔥 Heat demand"
            value={customHeatKw}
            unit="kW"
            min={2}
            max={20}
            step={0.5}
            onChange={setCustomHeatKw}
          />
          <SliderField
            label="🚿 Hot demand"
            value={customHotLpm}
            unit="L/min"
            min={2}
            max={20}
            step={0.5}
            onChange={setCustomHotLpm}
          />
          <SliderField
            label="💧 Cold draw"
            value={customColdLpm}
            unit="L/min"
            min={0}
            max={10}
            step={0.5}
            hint="Appliance cold fills — informational"
            onChange={setCustomColdLpm}
          />
        </div>
      </div>

      <p style={{ fontSize: '0.82rem', color: '#4a5568' }}>
        Day painter uses the same usage timeline for both systems. Cooldown/heating follows HLC + thermal inertia (τ),
        so internal temperature responds to boiler switching and timing.
      </p>

      <h4 style={{ margin: '0.75rem 0 0.4rem' }}>Causes — Demand timeline (L/min)</h4>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={causesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" interval={23} />
            <YAxis />
            <Tooltip />
            <Line dataKey="Hot demand (L/min)" stroke="#2b6cb0" dot={false} />
            <Line dataKey="Cold draw (L/min)" stroke="#68d391" dot={false} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h4 style={{ margin: '0.75rem 0 0.4rem' }}>Effects — Demand vs output</h4>
      <div style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={demandData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" interval={23} />
            <YAxis />
            <Tooltip />
            <Line dataKey="chDemandKw" stroke="#805ad5" dot={false} name="CH demand" />
            <Line dataKey="dhwTapDemandKw" stroke="#3182ce" dot={false} name="DHW tap demand" />
            <Line dataKey="currentPlantKw" stroke="#e53e3e" dot={false} name="Current plant" />
            <Line dataKey="proposedPlantKw" stroke="#38a169" dot={false} name="Proposed plant" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h4 style={{ margin: '0.75rem 0 0.4rem' }}>Actual internal temperature (°C)</h4>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={internalTempData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" interval={23} />
            <YAxis domain={[12, 24]} />
            <Tooltip />
            <Line dataKey="currentInternalC" stroke="#c53030" dot={false} name="Current internal" />
            <Line dataKey="proposedInternalC" stroke="#2f855a" dot={false} name="Proposed internal" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {showCylinder && (
        <>
          <h4 style={{ margin: '0.75rem 0 0.4rem' }}>Cylinder state (°C)</h4>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cylinderData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" interval={23} />
                <YAxis domain={[35, 65]} />
                <Tooltip />
                <Line dataKey="currentCylinderC" stroke="#dd6b20" dot={false} name="Current cylinder" />
                <Line dataKey="proposedCylinderC" stroke="#2c7a7b" dot={false} name="Proposed cylinder" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <p style={{ fontSize: '0.76rem', color: '#718096', marginTop: '0.5rem' }}>
        Loss channels: <strong>via flue</strong> and <strong>dumped to CH circuit</strong> are modelled separately; combi DHW calls pause CH service.
      </p>
    </div>
  );
}

/**
 * DemandProfilePainter — Three-channel 24-hour demand editor + two-system comparison.
 *
 * Three independent, editable timelines on the same 24-hour clock:
 *  Row 1: Heat Intent  (Off / Setback / Comfort)
 *  Row 2: DHW demand   (intensity blocks in L/min steps)
 *  Row 3: Cold draw    (intensity blocks in L/min steps)
 *
 * Under the painter two synchronized graphs compare System A vs System B:
 *  Graph A — Demand vs Plant Output (kW): what the home needs vs what each system delivers
 *  Graph B — Efficiency / COP: boiler η(t) or HP COP(t) per system
 *
 * Physics rules (enforced here):
 *  - All curve data comes from applyScenarioOverrides() — zero invented physics.
 *  - computeCurrentEfficiencyPct() clamps boiler η to [50 %, 99 %]; purge makes η negative.
 *  - ASHP COP is derived from SpecEdgeModule spfMidpoint.
 *  - No shower dropdown; DHW demand driven by painter intensity rows.
 */

import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  type ScenarioProfileV1,
  type HeatIntentLevel,
  type ComparisonSystemType,
  defaultScenarioProfile,
  applyScenarioOverrides,
} from '../../engine/schema/ScenarioProfileV1';
import { runSpecEdgeModule } from '../../engine/modules/SpecEdgeModule';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';

// ─── Default engine input ─────────────────────────────────────────────────────

const DEFAULT_ENGINE_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 2,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: false,
};

// ─── System labels ────────────────────────────────────────────────────────────

const SYSTEM_LABELS: Record<ComparisonSystemType, string> = {
  combi:           'Combi',
  stored_vented:   'Stored — Vented',
  stored_unvented: 'Stored — Unvented',
  ashp:            'ASHP',
};

/** Default background colour for painter blocks with no intensity (zero / off). */
const PAINTER_ZERO_BG = '#f7fafc';

// ─── Heat Intent palette ──────────────────────────────────────────────────────

const HEAT_INTENT_LABELS: Record<HeatIntentLevel, string> = { 0: 'Off', 1: 'Setback', 2: 'Comfort' };
const HEAT_INTENT_COLOURS: Record<HeatIntentLevel, string> = {
  0: '#bee3f8', // cool blue — off
  1: '#fed7aa', // warm amber — setback
  2: '#9ae6b4', // green — comfort
};
const HEAT_INTENT_CYCLE: HeatIntentLevel[] = [0, 1, 2];
function nextHeatIntent(cur: HeatIntentLevel): HeatIntentLevel {
  const idx = HEAT_INTENT_CYCLE.indexOf(cur);
  return HEAT_INTENT_CYCLE[(idx + 1) % HEAT_INTENT_CYCLE.length];
}

// ─── DHW intensity palette ────────────────────────────────────────────────────

/** Discrete DHW intensity steps in L/min. */
const DHW_INTENSITY_STEPS = [0, 1.5, 3, 6, 9] as const;
type DhwIntensity = (typeof DHW_INTENSITY_STEPS)[number];
const DHW_INTENSITY_LABELS: Record<DhwIntensity, string> = { 0: 'Off', 1.5: 'Low', 3: 'Medium', 6: 'High', 9: 'Peak' };
const DHW_INTENSITY_COLOURS: Record<DhwIntensity, string> = {
  0:   PAINTER_ZERO_BG,
  1.5: '#bee3f8',
  3:   '#63b3ed',
  6:   '#3182ce',
  9:   '#2b6cb0',
};
function nextDhwIntensity(cur: number): DhwIntensity {
  const idx = DHW_INTENSITY_STEPS.findIndex(s => s >= cur);
  const next = (idx + 1) % DHW_INTENSITY_STEPS.length;
  return DHW_INTENSITY_STEPS[next];
}

// ─── Cold draw palette ────────────────────────────────────────────────────────

const COLD_INTENSITY_STEPS = [0, 1, 3, 6] as const;
type ColdIntensity = (typeof COLD_INTENSITY_STEPS)[number];
const COLD_INTENSITY_LABELS: Record<ColdIntensity, string> = { 0: 'Off', 1: 'Low', 3: 'Medium', 6: 'High' };
const COLD_INTENSITY_COLOURS: Record<ColdIntensity, string> = {
  0: PAINTER_ZERO_BG,
  1: '#c6f6d5',
  3: '#68d391',
  6: '#276749',
};
function nextColdIntensity(cur: number): ColdIntensity {
  const idx = COLD_INTENSITY_STEPS.findIndex(s => s >= cur);
  const next = (idx + 1) % COLD_INTENSITY_STEPS.length;
  return COLD_INTENSITY_STEPS[next];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Partial base engine input — merged with defaults. */
  baseInput?: Partial<EngineInputV2_3>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DemandProfilePainter({ baseInput = {} }: Props) {
  const engineInput: EngineInputV2_3 = { ...DEFAULT_ENGINE_INPUT, ...baseInput };

  // ── Measured profile (from engine input) ─────────────────────────────────
  // heatLossWatts, bathroomCount and occupancySignature are the only fields that drive the profile
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const measuredProfile = useMemo(() => defaultScenarioProfile(engineInput), [
    engineInput.heatLossWatts,
    engineInput.bathroomCount,
    engineInput.occupancySignature,
  ]);

  // ── Editable profile state ────────────────────────────────────────────────
  const [profile, setProfile] = useState<ScenarioProfileV1>(() => ({ ...measuredProfile }));

  // ── System selectors ──────────────────────────────────────────────────────
  const [systemA, setSystemA] = useState<ComparisonSystemType>('combi');
  const [systemB, setSystemB] = useState<ComparisonSystemType>('ashp');

  // ── SpecEdge for SPF (used by ASHP physics) ───────────────────────────────
  const specEdge = useMemo(
    () =>
      runSpecEdgeModule({
        installationPolicy: 'full_job',
        heatLossWatts: engineInput.heatLossWatts,
        unitModulationFloorKw: 3,
        waterHardnessCategory: 'hard',
        hasSoftener: false,
        hasMagneticFilter: false,
        annualGasSpendGbp: 1200,
      }),
    // heatLossWatts is the only field that affects SpecEdge output
    [engineInput.heatLossWatts],
  );

  // ── Physics output ────────────────────────────────────────────────────────
  const physics = useMemo(
    () => applyScenarioOverrides(engineInput, profile, systemA, systemB, specEdge.spfMidpoint),
    // heatLossWatts and bathroomCount are the only EngineInput fields consumed by applyScenarioOverrides
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engineInput.heatLossWatts, engineInput.bathroomCount, profile, systemA, systemB, specEdge.spfMidpoint],
  );

  // ── Interaction handlers ──────────────────────────────────────────────────

  const toggleHeatIntent = (h: number) => {
    setProfile(prev => {
      const next = [...prev.heatIntent] as HeatIntentLevel[];
      next[h] = nextHeatIntent(next[h]);
      return { ...prev, heatIntent: next, source: 'user_edit' };
    });
  };

  const toggleDhwLpm = (h: number) => {
    setProfile(prev => {
      const next = [...prev.dhwMixedLpm40];
      next[h] = nextDhwIntensity(next[h]);
      return { ...prev, dhwMixedLpm40: next, source: 'user_edit' };
    });
  };

  const toggleColdLpm = (h: number) => {
    setProfile(prev => {
      const next = [...prev.coldLpm];
      next[h] = nextColdIntensity(next[h]);
      return { ...prev, coldLpm: next, source: 'user_edit' };
    });
  };

  const resetRow = (row: 'heat' | 'dhw' | 'cold') => {
    setProfile(prev => ({
      ...prev,
      heatIntent:    row === 'heat' ? [...measuredProfile.heatIntent]    : prev.heatIntent,
      dhwMixedLpm40: row === 'dhw'  ? [...measuredProfile.dhwMixedLpm40] : prev.dhwMixedLpm40,
      coldLpm:       row === 'cold' ? [...measuredProfile.coldLpm]        : prev.coldLpm,
      source: 'measured',
    }));
  };

  const resetAll = () => setProfile({ ...measuredProfile });

  // ── Chart data ────────────────────────────────────────────────────────────

  const graphAData = physics.hourly.map(row => ({
    hour: `${String(row.hour).padStart(2, '0')}:00`,
    'CH Demand (kW)':          parseFloat(row.qChDemandKw.toFixed(2)),
    'DHW Demand (kW)':         parseFloat(row.qDhwDemandKw.toFixed(2)),
    [`${SYSTEM_LABELS[systemA]} CH (kW)`]:  parseFloat(row.systemA.qToChKw.toFixed(2)),
    [`${SYSTEM_LABELS[systemA]} DHW (kW)`]: parseFloat(row.systemA.qToDhwKw.toFixed(2)),
    [`${SYSTEM_LABELS[systemB]} CH (kW)`]:  parseFloat(row.systemB.qToChKw.toFixed(2)),
    [`${SYSTEM_LABELS[systemB]} DHW (kW)`]: parseFloat(row.systemB.qToDhwKw.toFixed(2)),
  }));

  const graphBData = physics.hourly.map(row => ({
    hour: `${String(row.hour).padStart(2, '0')}:00`,
    [`${SYSTEM_LABELS[systemA]} η/COP`]: parseFloat(row.systemA.etaOrCop.toFixed(3)),
    [`${SYSTEM_LABELS[systemB]} η/COP`]: parseFloat(row.systemB.etaOrCop.toFixed(3)),
  }));

  // Compute Graph B Y-axis min: allow negative for combi purge
  const allEtaCop = physics.hourly.flatMap(r => [r.systemA.etaOrCop, r.systemB.etaOrCop]);
  const etaMin = Math.min(0, ...allEtaCop);
  const etaMax = Math.max(1.0, ...allEtaCop);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <p style={{ fontSize: '0.8rem', color: '#4a5568', marginBottom: 8 }}>
        Paint your demand day — click blocks to cycle intensity. The graphs update instantly.{' '}
        <em>Edits change the scenario; click Reset to return to measured profile.</em>
      </p>

      {/* ── System selectors ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: '0.78rem', color: '#718096', fontWeight: 600 }}>Compare:</span>
        <div role="group" aria-label="Select System A">
          <span style={{ fontSize: '0.72rem', color: '#718096', marginRight: 4 }}>System A:</span>
          {(Object.keys(SYSTEM_LABELS) as ComparisonSystemType[]).map(sys => (
            <button
              key={sys}
              onClick={() => setSystemA(sys)}
              aria-pressed={systemA === sys}
              style={{
                padding: '3px 10px', borderRadius: 20, marginRight: 4,
                border: `1.5px solid ${systemA === sys ? '#e53e3e' : '#e2e8f0'}`,
                background: systemA === sys ? '#fff5f5' : '#f7fafc',
                color: systemA === sys ? '#c53030' : '#718096',
                fontSize: '0.74rem', fontWeight: systemA === sys ? 700 : 400, cursor: 'pointer',
              }}
            >
              {SYSTEM_LABELS[sys]}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Select System B">
          <span style={{ fontSize: '0.72rem', color: '#718096', marginRight: 4 }}>System B:</span>
          {(Object.keys(SYSTEM_LABELS) as ComparisonSystemType[]).map(sys => (
            <button
              key={sys}
              onClick={() => setSystemB(sys)}
              aria-pressed={systemB === sys}
              style={{
                padding: '3px 10px', borderRadius: 20, marginRight: 4,
                border: `1.5px solid ${systemB === sys ? '#2b6cb0' : '#e2e8f0'}`,
                background: systemB === sys ? '#ebf8ff' : '#f7fafc',
                color: systemB === sys ? '#2c5282' : '#718096',
                fontSize: '0.74rem', fontWeight: systemB === sys ? 700 : 400, cursor: 'pointer',
              }}
            >
              {SYSTEM_LABELS[sys]}
            </button>
          ))}
        </div>
        <button
          onClick={resetAll}
          style={{
            padding: '3px 12px', borderRadius: 20,
            border: '1.5px solid #e2e8f0', background: '#f7fafc',
            color: '#718096', fontSize: '0.74rem', cursor: 'pointer',
          }}
        >
          ↺ Reset all
        </button>
        {profile.source === 'user_edit' && (
          <span style={{ fontSize: '0.72rem', color: '#c05621', fontStyle: 'italic' }}>
            Scenario edited
          </span>
        )}
      </div>

      {/* ── Row 1: Heat Intent Painter ─────────────────────────────────────── */}
      <PainterRow
        label="🔥 Heat Intent"
        sublabel="Off → Setback → Comfort"
        hours={profile.heatIntent}
        getColour={h => HEAT_INTENT_COLOURS[profile.heatIntent[h]]}
        getLabel={h => HEAT_INTENT_LABELS[profile.heatIntent[h]]}
        onToggle={toggleHeatIntent}
        onReset={() => resetRow('heat')}
        legend={HEAT_INTENT_CYCLE.map(l => ({ label: HEAT_INTENT_LABELS[l], colour: HEAT_INTENT_COLOURS[l] }))}
      />

      {/* ── Row 2: DHW Demand Painter ──────────────────────────────────────── */}
      <PainterRow
        label="🚿 DHW Demand"
        sublabel="Off → Low → Medium → High → Peak (L/min mixed @ 40 °C)"
        hours={profile.dhwMixedLpm40}
        getColour={h => DHW_INTENSITY_COLOURS[profile.dhwMixedLpm40[h] as DhwIntensity] ?? '#f7fafc'}
        getLabel={h => DHW_INTENSITY_LABELS[profile.dhwMixedLpm40[h] as DhwIntensity] ?? `${profile.dhwMixedLpm40[h]} L/min`}
        onToggle={toggleDhwLpm}
        onReset={() => resetRow('dhw')}
        legend={DHW_INTENSITY_STEPS.map(s => ({ label: DHW_INTENSITY_LABELS[s], colour: DHW_INTENSITY_COLOURS[s] }))}
      />

      {/* ── Row 3: Cold Draw Painter ───────────────────────────────────────── */}
      <PainterRow
        label="💧 Cold Draw"
        sublabel="Off → Low → Medium → High (L/min)"
        hours={profile.coldLpm}
        getColour={h => COLD_INTENSITY_COLOURS[profile.coldLpm[h] as ColdIntensity] ?? '#f7fafc'}
        getLabel={h => COLD_INTENSITY_LABELS[profile.coldLpm[h] as ColdIntensity] ?? `${profile.coldLpm[h]} L/min`}
        onToggle={toggleColdLpm}
        onReset={() => resetRow('cold')}
        legend={COLD_INTENSITY_STEPS.map(s => ({ label: COLD_INTENSITY_LABELS[s], colour: COLD_INTENSITY_COLOURS[s] }))}
      />

      {/* ── Graph A: Demand vs Plant Output ───────────────────────────────── */}
      <div style={{ marginTop: 20, marginBottom: 4 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2d3748', marginBottom: 4 }}>
          📊 Graph A — Demand vs Plant Output (kW)
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={graphAData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
              <YAxis
                tick={{ fontSize: 9 }}
                label={{ value: 'kW', angle: -90, position: 'insideLeft', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{ fontSize: '0.72rem', borderRadius: 8 }}
                formatter={(value: number | undefined, name: string | undefined) => [
                  value !== undefined ? `${value.toFixed(2)} kW` : '',
                  name ?? '',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '0.68rem', paddingTop: 4 }} />
              {/* Demand channels — shared for both systems */}
              <Area type="monotone" dataKey="CH Demand (kW)" fill="#fed7aa" stroke="#ed8936" strokeWidth={1.5} fillOpacity={0.35} />
              <Area type="monotone" dataKey="DHW Demand (kW)" fill="#bee3f8" stroke="#3182ce" strokeWidth={1.5} fillOpacity={0.35} />
              {/* System A output */}
              <Line type="stepAfter" dataKey={`${SYSTEM_LABELS[systemA]} CH (kW)`} stroke="#c53030" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              <Line type="stepAfter" dataKey={`${SYSTEM_LABELS[systemA]} DHW (kW)`} stroke="#e53e3e" strokeWidth={2} dot={false} strokeDasharray="2 2" />
              {/* System B output */}
              <Line type="monotone" dataKey={`${SYSTEM_LABELS[systemB]} CH (kW)`} stroke="#2b6cb0" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={`${SYSTEM_LABELS[systemB]} DHW (kW)`} stroke="#63b3ed" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Graph B: Efficiency / COP ──────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2d3748', marginBottom: 4 }}>
          ⚡ Graph B — Efficiency / COP (behaviour, not score)
        </div>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={graphBData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
              <YAxis
                domain={[Math.min(-0.1, parseFloat((etaMin - 0.05).toFixed(2))), parseFloat((etaMax + 0.1).toFixed(2))]}
                tick={{ fontSize: 9 }}
                label={{ value: 'η / COP', angle: -90, position: 'insideLeft', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{ fontSize: '0.72rem', borderRadius: 8 }}
                formatter={(value: number | undefined, name: string | undefined) => [
                  value !== undefined ? value.toFixed(3) : '',
                  name ?? '',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '0.68rem', paddingTop: 4 }} />
              {/* Zero line — below 0 = net energy dump */}
              <ReferenceLine y={0} stroke="#fc8181" strokeDasharray="4 2" label={{ value: 'η=0', fontSize: 9, fill: '#e53e3e' }} />
              {/* System A */}
              <Line
                type="stepAfter"
                dataKey={`${SYSTEM_LABELS[systemA]} η/COP`}
                stroke="#c53030"
                strokeWidth={2}
                dot={false}
              />
              {/* System B */}
              <Line
                type="monotone"
                dataKey={`${SYSTEM_LABELS[systemB]} η/COP`}
                stroke="#2b6cb0"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── PainterRow helper component ──────────────────────────────────────────────

interface PainterRowProps {
  label: string;
  sublabel: string;
  /** The 24-element array whose length drives the grid. Values are not read by this component
   *  — all display logic is delegated to getColour/getLabel callbacks. */
  hours: readonly (HeatIntentLevel | number)[];
  getColour: (h: number) => string;
  getLabel: (h: number) => string;
  onToggle: (h: number) => void;
  onReset: () => void;
  legend: { label: string; colour: string }[];
}

function PainterRow({ label, sublabel, hours, getColour, getLabel, onToggle, onReset, legend }: PainterRowProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#2d3748' }}>{label}</span>
        <span style={{ fontSize: '0.68rem', color: '#a0aec0' }}>{sublabel}</span>
        <button
          onClick={onReset}
          style={{
            marginLeft: 'auto', padding: '2px 9px', borderRadius: 12,
            border: '1px solid #e2e8f0', background: '#f7fafc',
            color: '#718096', fontSize: '0.68rem', cursor: 'pointer',
          }}
        >
          ↺ Reset to measured
        </button>
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2 }}
        aria-label={`${label} 24-hour painter`}
      >
        {hours.map((_, h: number) => (
          <button
            key={h}
            onClick={() => onToggle(h)}
            title={`${String(h).padStart(2, '0')}:00 – ${getLabel(h)}`}
            aria-label={`Hour ${h}: ${getLabel(h)}`}
            style={{
              height: 28,
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              background: getColour(h),
              cursor: 'pointer',
              fontSize: '0.48rem',
              color: '#2d3748',
              padding: 0,
              lineHeight: '28px',
              fontWeight: 600,
            }}
          >
            {h}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 4 }}>
        {legend.map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.66rem', color: '#4a5568' }}>
            <span
              style={{
                width: 10, height: 10, borderRadius: 2,
                background: l.colour, border: '1px solid #a0aec0', display: 'inline-block',
              }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

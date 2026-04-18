/**
 * LifestyleInteractiveCompare – 2-System Day Painter Comparison
 *
 * A synchronized, side-by-side comparison of two heating systems using the same
 * 24-hour occupancy programme.  Derived from LifestyleInteractive ("Day Painter").
 *
 * Layout (top → bottom):
 *  1. System Picker (CompareSystemPicker) — select System A and System B
 *  2. 24-hour painter — shared occupancy programme drives both simulations identically
 *  3. Graph 1 — Demand (identical for A and B — fairness badge shown)
 *  4. Graph 2A — System A response (room temperature, hot-water reserve)
 *  5. Graph 2B — System B response (room temperature, hot-water reserve)
 *  6. Draw-off gauges for System A vs System B (cylinder minutes remaining at active outlets)
 *  7. Key metrics comparison table (SPF / flow temp / minutes below setpoint / cycling waste)
 *
 * Physics rules (enforced here):
 *  - ALL graph data comes from EngineOutputV1 / LifestyleSimulationModule.hourlyData.
 *  - No Math.random() or arbitrary smoothing.
 *  - Both systems share an identical demand timeline (Graph 1) — "same homework, different student".
 *  - computeCurrentEfficiencyPct() from efficiency.ts clamps boiler η to [50 %, 99 %].
 *  - Demand is driven by household size and bathroom count heuristics — no shower dropdown.
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
import { runLifestyleSimulationModule, CYLINDER_VOLUME_L } from '../../engine/modules/LifestyleSimulationModule';
import { runSpecEdgeModule } from '../../engine/modules/SpecEdgeModule';
import { runSludgeVsScaleModule } from '../../engine/modules/SludgeVsScaleModule';
import {
  type HourState,
  STATE_LABELS,
  STATE_COLOURS,
  defaultHours,
  nextState,
} from '../../engine/modules/LifestyleInteractiveHelpers';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { ComparisonSystemType } from '../../engine/schema/ScenarioProfileV1';
import CompareSystemPicker from '../compare/CompareSystemPicker';
import {
  NOMINAL_COMBI_DHW_KW,
} from '../../engine/presets/DhwFlowPresets';

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

// ─── Sludge inputs (shared — same condition for both systems) ─────────────────
const SLUDGE_INPUT_AS_FOUND = {
  pipingTopology: 'one_pipe' as const,
  hasMagneticFilter: false,
  waterHardnessCategory: 'hard' as const,
  systemAgeYears: 10,
};

/** Comfort setpoint (°C) for the below-setpoint minutes counter. */
const COMFORT_SETPOINT_C = 21;

/** Y-axis scale factor: 120 % of peak heat-loss to leave headroom. */
const DEMAND_Y_AXIS_SCALE_FACTOR = 1.2;

// ─── System label map ─────────────────────────────────────────────────────────

const SYSTEM_LABELS: Record<ComparisonSystemType, string> = {
  combi:               'Combi',
  stored_vented:       'Stored — Vented',
  stored_unvented:     'Stored — Unvented',
  mixergy:             'Mixergy',
  mixergy_open_vented: 'Mixergy (Tank-fed)',
  ashp:                'ASHP',
};

// ─── System colours ───────────────────────────────────────────────────────────
const SYSTEM_A_COLOUR = '#e53e3e';  // red
const SYSTEM_B_COLOUR = '#2b6cb0';  // blue

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Partial base engine input — merged with defaults. */
  baseInput?: Partial<EngineInputV2_3>;
}

// ─── Small reusable UI helpers ────────────────────────────────────────────────

function MetricBadge({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{
      background: bg,
      border: `1px solid ${color}40`,
      borderRadius: 6,
      padding: '4px 10px',
      fontSize: '0.78rem',
      color,
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <span style={{ color: '#718096', fontSize: '0.68rem' }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LifestyleInteractiveCompare({ baseInput = {} }: Props) {
  const engineInput: EngineInputV2_3 = { ...DEFAULT_ENGINE_INPUT, ...baseInput };

  // ── 24-hour painter state (shared between both systems) ────────────────────
  const [hours, setHours] = useState<HourState[]>(defaultHours);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTargetState, setDragTargetState] = useState<HourState>('home');

  // ── System selectors ───────────────────────────────────────────────────────
  const [systemA, setSystemA] = useState<ComparisonSystemType>('combi');
  const [systemB, setSystemB] = useState<ComparisonSystemType>('ashp');

  // ── Engine runs (shared physics inputs) ───────────────────────────────────
  const heatLossKw = engineInput.heatLossWatts / 1000;
  const sludge = useMemo(() => runSludgeVsScaleModule(SLUDGE_INPUT_AS_FOUND), []);
  const specEdge = useMemo(() => runSpecEdgeModule(engineInput), [
    engineInput.heatLossWatts,
    engineInput.returnWaterTemp,
    engineInput.hasLoftConversion,
  ]);

  const lifestyle = useMemo(() => runLifestyleSimulationModule(engineInput, {
    flowDeratePct: sludge.flowDeratePct,
    cyclingLossPct: sludge.cyclingLossPct,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    engineInput.heatLossWatts,
    engineInput.occupancySignature,
    engineInput.buildingMass,
    engineInput.occupancyCount,
    sludge.flowDeratePct,
    sludge.cyclingLossPct,
  ]);

  // ── Painter interaction handlers ───────────────────────────────────────────
  function handleHourClick(index: number, startDrag = false) {
    setHours(prev => {
      const next = [...prev];
      const newState = startDrag ? nextState(prev[index]) : dragTargetState;
      next[index] = newState;
      if (startDrag) setDragTargetState(newState);
      return next;
    });
  }

  function handleHourDrag(index: number) {
    if (!isDragging) return;
    setHours(prev => {
      const next = [...prev];
      next[index] = dragTargetState;
      return next;
    });
  }

  // ── Hour-count stats ───────────────────────────────────────────────────────
  const homeCount  = hours.filter(h => h === 'home').length;
  const dhwCount   = hours.filter(h => h === 'dhw_demand').length;
  const awayCount  = hours.filter(h => h === 'away').length;

  // ── Shared demand chart data (Graph 1) ────────────────────────────────────
  const demandChartData = lifestyle.hourlyData.map((row, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    'Heat (kW)': parseFloat(row.demandKw.toFixed(2)),
    'DHW (kW)':  parseFloat(row.dhwKw.toFixed(2)),
  }));

  // ── Helpers to build per-system response data ────────────────────────────
  function buildSystemResponseData(sys: ComparisonSystemType) {
    const showHp = sys === 'ashp';
    return lifestyle.hourlyData.map((row, h) => {
      const hour = `${String(h).padStart(2, '0')}:00`;
      const result: Record<string, string | number> = { hour };
      result['Room (°C)'] = parseFloat(
        (showHp ? row.ashpRoomTempC : row.boilerRoomTempC).toFixed(1),
      );
      result['Hot water reserve (%)'] = parseFloat(
        (row.cylinderVolumeL / CYLINDER_VOLUME_L * 100).toFixed(1),
      );
      return result;
    });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chartDataA = useMemo(() => buildSystemResponseData(systemA), [systemA, lifestyle]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chartDataB = useMemo(() => buildSystemResponseData(systemB), [systemB, lifestyle]);

  // ── Cylinder data for stored systems ──────────────────────────────────────
  const cylinderDataA = lifestyle.hourlyData.map((row, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    'Cylinder Temp (°C)': row.cylinderTempC,
    'Volume Available (L)': row.cylinderVolumeL,
  }));

  // ── Per-system performance metrics ────────────────────────────────────────
  const minutesBelowSetpoint = lifestyle.hourlyData
    .filter(r => r.boilerRoomTempC < COMFORT_SETPOINT_C).length * 60;
  const minutesBelowSetpointAshp = lifestyle.hourlyData
    .filter(r => r.ashpRoomTempC < COMFORT_SETPOINT_C).length * 60;
  const totalCyclingPenaltyKwh = parseFloat(
    lifestyle.hourlyData.reduce((s, r) => s + r.cyclingFuelPenaltyKw, 0).toFixed(2),
  );
  const dhwDrawKwhToday = parseFloat(
    lifestyle.hourlyData.reduce((s, r) => s + r.dhwKw, 0).toFixed(1),
  );

  function minutesBelowForSystem(sys: ComparisonSystemType): number {
    if (sys === 'ashp') return minutesBelowSetpointAshp;
    return minutesBelowSetpoint;
  }

  function cyclingWasteForSystem(sys: ComparisonSystemType): number {
    if (sys === 'ashp') return 0; // ASHP modulates — no short-cycling
    return totalCyclingPenaltyKwh;
  }

  function systemMetricLine(sys: ComparisonSystemType) {
    const min = minutesBelowForSystem(sys);
    const waste = cyclingWasteForSystem(sys);
    const hasCylinder = sys !== 'combi';
    const cylinderAtPeak = lifestyle.hourlyData[
      Math.min(hours.findIndex(h => h === 'dhw_demand'), 23) >= 0
        ? hours.findIndex(h => h === 'dhw_demand')
        : 7
    ].cylinderVolumeL;
    return { min, waste, hasCylinder, cylinderAtPeak };
  }

  const metricsA = systemMetricLine(systemA);
  const metricsB = systemMetricLine(systemB);

  // ── Combi simultaneous demand load (for combi systems) ────────────────────
  function combiLoadLabel(sys: ComparisonSystemType): string {
    if (sys !== 'combi') return '—';
    return `${NOMINAL_COMBI_DHW_KW} kW limit`;
  }

  // ─── System response chart renderer ────────────────────────────────────────
  function SystemResponseChart({
    label,
    colour,
    chartData,
    sys,
  }: {
    label: string;
    colour: string;
    chartData: Record<string, string | number>[];
    sys: ComparisonSystemType;
  }) {
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{
          fontSize: '0.75rem', fontWeight: 700, color: '#2d3748', marginBottom: 4,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            background: colour + '22',
            color: colour,
            border: `1.5px solid ${colour}`,
            borderRadius: 12,
            padding: '1px 10px',
            fontSize: '0.72rem',
            fontWeight: 700,
          }}>
            {label}
          </span>
          ⚙️ System Response — {SYSTEM_LABELS[sys]}
        </div>
        <div style={{ height: 185 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} ticks={['00:00','06:00','12:00','18:00','23:00']} />
              <YAxis
                yAxisId="temp"
                domain={[14, 23]}
                tick={{ fontSize: 9 }}
                label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 10 }}
              />
              <YAxis
                yAxisId="reserve"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 9 }}
                label={{ value: '%', angle: 90, position: 'insideRight', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{ fontSize: '0.78rem', borderRadius: 8 }}
                formatter={(value: number | undefined, name: string | undefined) => [
                  value !== undefined ? value.toFixed(1) : '',
                  name ?? '',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: 6 }} />
              <ReferenceLine
                yAxisId="temp"
                y={COMFORT_SETPOINT_C}
                stroke="#48bb78"
                strokeDasharray="4 3"
                label={{ value: '21°C', fontSize: 9, fill: '#276749' }}
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="Room (°C)"
                stroke={colour}
                strokeWidth={2.5}
                dot={false}
              />
              <Area
                yAxisId="reserve"
                type="monotone"
                dataKey="Hot water reserve (%)"
                fill="#bee3f8"
                stroke="#3182ce"
                strokeWidth={1.5}
                fillOpacity={0.3}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 4px' }}>

      {/* ── System Picker ──────────────────────────────────────────────────── */}
      <CompareSystemPicker
        systemA={systemA}
        systemB={systemB}
        onSystemAChange={setSystemA}
        onSystemBChange={setSystemB}
      />

      {/* ── Intro text ───────────────────────────────────────────────────────── */}
      <p style={{ fontSize: '0.8rem', color: '#4a5568', marginBottom: 10 }}>
        Paint the same 24-hour routine for both systems. Both simulations receive
        identical demand — only the system response differs.{' '}
        Click hour blocks to cycle:{' '}
        <strong style={{ color: '#276749' }}>At Home</strong> →{' '}
        <strong style={{ color: '#c53030' }}>High DHW</strong> →{' '}
        <strong style={{ color: '#2c5282' }}>Away</strong>.
      </p>

      {/* ── 24-hour painter (shared) ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2d3748', marginBottom: 6 }}>
          🎨 Shared Day Programme
          <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 400, color: '#718096' }}>
            (applied identically to both systems)
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(24, 1fr)',
            gap: 2,
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          onMouseLeave={() => setIsDragging(false)}
        >
          {hours.map((state, i) => (
            <div
              key={i}
              role="button"
              aria-label={`Hour ${i}: ${STATE_LABELS[state]} — click to change`}
              aria-pressed={state !== 'away'}
              style={{
                height: 36,
                backgroundColor: STATE_COLOURS[state],
                borderRadius: 4,
                cursor: 'pointer',
                position: 'relative',
                transition: 'background-color 0.15s',
              }}
              onMouseDown={() => { setIsDragging(true); handleHourClick(i, true); }}
              onMouseUp={() => setIsDragging(false)}
              onMouseEnter={() => handleHourDrag(i)}
              onTouchStart={e => { e.preventDefault(); setIsDragging(true); handleHourClick(i, true); }}
              onTouchEnd={() => setIsDragging(false)}
            >
              {i % 6 === 0 && (
                <span style={{
                  position: 'absolute',
                  bottom: 2,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '0.55rem',
                  color: '#4a5568',
                  pointerEvents: 'none',
                }}>
                  {String(i).padStart(2, '0')}
                </span>
              )}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: 4, flexWrap: 'wrap' }}>
          {(Object.keys(STATE_LABELS) as HourState[]).map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem' }}>
              <div style={{ width: 12, height: 12, backgroundColor: STATE_COLOURS[s], borderRadius: 2 }} />
              <span style={{ color: '#718096' }}>{STATE_LABELS[s]}</span>
            </div>
          ))}
          <span style={{ color: '#718096', fontSize: '0.7rem', marginLeft: 4 }}>
            · Home {homeCount}h · High DHW {dhwCount}h · Away {awayCount}h
          </span>
        </div>
      </div>

      {/* ── Fairness banner ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: '#f0fff4', border: '1px solid #9ae6b4',
        borderRadius: 6, padding: '3px 10px',
        fontSize: '0.72rem', color: '#276749', marginBottom: 14,
      }}>
        🟢 Demand timeline identical for both systems — same homework, different student
      </div>

      {/* ── Graph 1: Shared Services Demand ─────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2d3748', marginBottom: 4 }}>
          📊 Graph 1 — Services Demand (shared — what the home needs)
        </div>
        <div style={{ height: 180, marginBottom: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={demandChartData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} ticks={['00:00','06:00','12:00','18:00','23:00']} />
              <YAxis
                domain={[0, Math.ceil(heatLossKw * DEMAND_Y_AXIS_SCALE_FACTOR)]}
                tick={{ fontSize: 9 }}
                label={{ value: 'kW', angle: -90, position: 'insideLeft', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{ fontSize: '0.78rem', borderRadius: 8 }}
                formatter={(value: number | undefined, name: string | undefined) => [
                  value !== undefined ? `${value.toFixed(2)} kW` : '',
                  name ?? '',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: 6 }} />
              <Area type="monotone" dataKey="Heat (kW)" fill="#fed7aa" stroke="#ed8936" strokeWidth={2} fillOpacity={0.5} />
              <Area type="monotone" dataKey="DHW (kW)"  fill="#bee3f8" stroke="#3182ce" strokeWidth={2} fillOpacity={0.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Graph 2A / 2B: System Response (side by side or stacked) ─────────── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2d3748', marginBottom: 8 }}>
          ⚙️ System Response Comparison
          <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 400, color: '#718096' }}>
            (both charts share the same 24-hour X-axis)
          </span>
        </div>
        <SystemResponseChart
          label="System A"
          colour={SYSTEM_A_COLOUR}
          chartData={chartDataA}
          sys={systemA}
        />
        <SystemResponseChart
          label="System B"
          colour={SYSTEM_B_COLOUR}
          chartData={chartDataB}
          sys={systemB}
        />
      </div>

      {/* ── Cylinder chart (when at least one system is stored/ASHP) ─────────── */}
      {(systemA !== 'combi' || systemB !== 'combi') && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2d3748', marginBottom: 4 }}>
            🛢️ Stored Cylinder — Temperature &amp; Volume ({CYLINDER_VOLUME_L} L)
            <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 400, color: '#718096' }}>
              (shared cylinder model — both stored systems draw from the same 24 h simulation)
            </span>
          </div>
          <div style={{ height: 175 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cylinderDataA} margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} ticks={['00:00','06:00','12:00','18:00','23:00']} />
                <YAxis yAxisId="temp" domain={[38, 62]} tick={{ fontSize: 9 }}
                  label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <YAxis yAxisId="vol" orientation="right" domain={[0, CYLINDER_VOLUME_L]} tick={{ fontSize: 9 }}
                  label={{ value: 'L', angle: 90, position: 'insideRight', fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: '0.78rem', borderRadius: 8 }}
                  formatter={(value: number | undefined, name: string | undefined) => [
                    value !== undefined
                      ? name === 'Cylinder Temp (°C)' ? `${value.toFixed(1)} °C` : `${value.toFixed(1)} L`
                      : '',
                    name ?? '',
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: 6 }} />
                <ReferenceLine yAxisId="temp" y={40} stroke="#e53e3e" strokeDasharray="4 2"
                  label={{ value: '40°C min usable', fontSize: 8, fill: '#c53030', position: 'insideTopRight' }}
                />
                <Line yAxisId="temp" type="monotone" dataKey="Cylinder Temp (°C)"
                  stroke="#c05621" strokeWidth={2} dot={false} />
                <Area yAxisId="vol" type="monotone" dataKey="Volume Available (L)"
                  fill="#bee3f8" stroke="#3182ce" strokeWidth={1.5} fillOpacity={0.35} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Metrics comparison table ─────────────────────────────────────────── */}
      <div style={{
        border: '1px solid #e2e8f0', borderRadius: 8,
        padding: '10px 14px', background: '#f7fafc', marginBottom: 14,
      }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2d3748', marginBottom: 10 }}>
          📋 Head-to-Head Metrics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* System A column */}
          <div>
            <div style={{ fontSize: '0.72rem', color: SYSTEM_A_COLOUR, fontWeight: 700, marginBottom: 6 }}>
              System A — {SYSTEM_LABELS[systemA]}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <MetricBadge
                label="SPF (ASHP)"
                value={systemA === 'ashp' ? specEdge.spfMidpoint.toFixed(2) : 'N/A'}
                color={systemA === 'ashp' ? (specEdge.spfMidpoint >= 3.8 ? '#276749' : '#c05621') : '#718096'}
                bg={systemA === 'ashp' ? (specEdge.spfMidpoint >= 3.8 ? '#f0fff4' : '#fffaf0') : '#f7fafc'}
              />
              <MetricBadge
                label="Min below 21°C"
                value={`${metricsA.min} min`}
                color={metricsA.min > 0 ? '#c53030' : '#276749'}
                bg={metricsA.min > 0 ? '#fff5f5' : '#f0fff4'}
              />
              <MetricBadge
                label="Cycling waste"
                value={metricsA.waste > 0 ? `${metricsA.waste} kWh` : '0 kWh'}
                color={metricsA.waste > 0 ? '#c53030' : '#276749'}
                bg={metricsA.waste > 0 ? '#fff5f5' : '#f0fff4'}
              />
              <MetricBadge
                label="DHW today"
                value={`${dhwDrawKwhToday} kWh`}
                color="#2c5282"
                bg="#ebf8ff"
              />
              {systemA !== 'combi' && (
                <MetricBadge
                  label="Cylinder at peak"
                  value={`${metricsA.cylinderAtPeak.toFixed(0)} L`}
                  color={metricsA.cylinderAtPeak > 50 ? '#276749' : '#c05621'}
                  bg={metricsA.cylinderAtPeak > 50 ? '#f0fff4' : '#fffaf0'}
                />
              )}
              {systemA === 'combi' && (
                <MetricBadge
                  label="DHW capacity"
                  value={combiLoadLabel(systemA)}
                  color="#c05621"
                  bg="#fffaf0"
                />
              )}
            </div>
          </div>
          {/* System B column */}
          <div>
            <div style={{ fontSize: '0.72rem', color: SYSTEM_B_COLOUR, fontWeight: 700, marginBottom: 6 }}>
              System B — {SYSTEM_LABELS[systemB]}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <MetricBadge
                label="SPF (ASHP)"
                value={systemB === 'ashp' ? specEdge.spfMidpoint.toFixed(2) : 'N/A'}
                color={systemB === 'ashp' ? (specEdge.spfMidpoint >= 3.8 ? '#276749' : '#c05621') : '#718096'}
                bg={systemB === 'ashp' ? (specEdge.spfMidpoint >= 3.8 ? '#f0fff4' : '#fffaf0') : '#f7fafc'}
              />
              <MetricBadge
                label="Min below 21°C"
                value={`${metricsB.min} min`}
                color={metricsB.min > 0 ? '#c53030' : '#276749'}
                bg={metricsB.min > 0 ? '#fff5f5' : '#f0fff4'}
              />
              <MetricBadge
                label="Cycling waste"
                value={metricsB.waste > 0 ? `${metricsB.waste} kWh` : '0 kWh'}
                color={metricsB.waste > 0 ? '#c53030' : '#276749'}
                bg={metricsB.waste > 0 ? '#fff5f5' : '#f0fff4'}
              />
              <MetricBadge
                label="DHW today"
                value={`${dhwDrawKwhToday} kWh`}
                color="#2c5282"
                bg="#ebf8ff"
              />
              {systemB !== 'combi' && (
                <MetricBadge
                  label="Cylinder at peak"
                  value={`${metricsB.cylinderAtPeak.toFixed(0)} L`}
                  color={metricsB.cylinderAtPeak > 50 ? '#276749' : '#c05621'}
                  bg={metricsB.cylinderAtPeak > 50 ? '#f0fff4' : '#fffaf0'}
                />
              )}
              {systemB === 'combi' && (
                <MetricBadge
                  label="DHW capacity"
                  value={combiLoadLabel(systemB)}
                  color="#c05621"
                  bg="#fffaf0"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Comparison insight note ───────────────────────────────────────────── */}
      {lifestyle.notes.length > 0 && (
        <div style={{
          background: '#f7fafc', border: '1px solid #e2e8f0',
          borderRadius: 8, padding: '8px 12px',
          fontSize: '0.78rem', color: '#4a5568',
        }}>
          {lifestyle.notes[0]}
        </div>
      )}
    </div>
  );
}

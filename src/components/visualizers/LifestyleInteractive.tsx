/**
 * LifestyleInteractive – "Day Painter" Sales Closer
 *
 * A 24-hour interactive simulation where users paint their daily routine
 * (At Home / Away / High DHW Demand) and see in real-time how their selected
 * heating system performs.
 *
 * One system is shown at a time.  A pill switcher lets users compare:
 *   Combi | Stored–Vented | Stored–Unvented | ASHP
 *
 * Dual-chart layout:
 *  Graph 1 (Demand)         – kW demand from LifestyleSimulationModule (Heat + DHW load)
 *  Graph 2 (System Response) – Boiler stepped curve / HP horizon curve + hot-water reserve
 *
 * Demand is driven by household size and bathroom count heuristics — no shower
 * dropdown is exposed.  DHW draws always go to the hot-water system (scalar = 1.0).
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
import { runLifestyleSimulationModule } from '../../engine/modules/LifestyleSimulationModule';
import { runSpecEdgeModule } from '../../engine/modules/SpecEdgeModule';
import {
  type HourState,
  STATE_LABELS,
  STATE_COLOURS,
  STATE_CYCLE,
  defaultHours,
  nextState,
  mixergySoCByHour,
  boilerSteppedCurve,
  hpHorizonCurve,
} from '../../engine/modules/LifestyleInteractiveHelpers';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';

// ─── System switcher ──────────────────────────────────────────────────────────

type DayPainterSystem = 'combi' | 'stored_vented' | 'stored_unvented' | 'ashp';

const SYSTEM_LABELS: Record<DayPainterSystem, string> = {
  combi:           'Combi',
  stored_vented:   'Stored — Vented',
  stored_unvented: 'Stored — Unvented',
  ashp:            'ASHP',
};

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

// ─── Demand chart physics constants ──────────────────────────────────────────

/** Fraction of cylinder capacity drawn per "High DHW" hour (18 % × 5 kWh = 0.9 kWh). */
const DHW_DEMAND_DRAW_FRACTION = 0.18;
/** Fraction of cylinder capacity drawn during ordinary "At Home" hours (4 % × 5 kWh = 0.2 kWh). */
const HOME_DRAW_FRACTION = 0.04;
/** Y-axis upper bound for the demand chart: 120 % of peak heat-loss to leave headroom. */
const DEMAND_Y_AXIS_SCALE_FACTOR = 1.2;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** Partial base engine input – merged with defaults. */
  baseInput?: Partial<EngineInputV2_3>;
}

export default function LifestyleInteractive({ baseInput = {} }: Props) {
  const [hours, setHours] = useState<HourState[]>(defaultHours);
  const [isFullJob, setIsFullJob] = useState(true);
  const [selectedSystem, setSelectedSystem] = useState<DayPainterSystem>('combi');
  // DHW draws always go to the hot-water system — demand is driven by household
  // size and bathroom count heuristics (no user-facing supply-path selector).
  const dhwDrawScalar = 1.0;
  const [hasSoftener, setHasSoftener] = useState(false);

  const engineInput: EngineInputV2_3 = { ...DEFAULT_ENGINE_INPUT, ...baseInput };

  // ── Engine calls ────────────────────────────────────────────────────────────

  const specEdge = useMemo(
    () =>
      runSpecEdgeModule({
        installationPolicy: isFullJob ? 'full_job' : 'high_temp_retrofit',
        heatLossWatts: engineInput.heatLossWatts,
        unitModulationFloorKw: 3,
        waterHardnessCategory: 'hard',
        hasSoftener,
        hasMagneticFilter: false,
        annualGasSpendGbp: 1200,
      }),
    [isFullJob, hasSoftener, engineInput.heatLossWatts],
  );

  const lifestyle = useMemo(
    () => runLifestyleSimulationModule(engineInput),
    // occupancySignature and heatLossWatts are the only fields that affect this module
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engineInput.occupancySignature, engineInput.heatLossWatts],
  );

  // ── Derived curve data ──────────────────────────────────────────────────────

  const socByHour = useMemo(
    () => mixergySoCByHour(hours, 'gravity', dhwDrawScalar),
    [hours, dhwDrawScalar],
  );
  const boilerByHour = useMemo(
    () => boilerSteppedCurve(hours, false, 'gravity', dhwDrawScalar),
    [hours, dhwDrawScalar],
  );
  const hpByHour = useMemo(
    () => hpHorizonCurve(hours, specEdge.spfMidpoint, specEdge.designFlowTempC),
    [hours, specEdge],
  );

  // Derive which curve series to render for the selected system
  const showBoiler   = selectedSystem === 'combi' || selectedSystem === 'stored_vented' || selectedSystem === 'stored_unvented';
  const showHp       = selectedSystem === 'ashp';
  const showHwReserve = selectedSystem !== 'combi'; // stored systems & ASHP have a cylinder

  const chartData = Array.from({ length: 24 }, (_, h) => {
    const row: Record<string, string | number> = {
      hour: `${String(h).padStart(2, '0')}:00`,
    };
    if (showBoiler)    row['Boiler (°C)']             = boilerByHour[h];
    if (showHp)        row['HP Horizon (°C)']          = hpByHour[h];
    if (showHwReserve) row['Hot water reserve (%)']    = socByHour[h];
    return row;
  });

  // ── Interaction handlers ────────────────────────────────────────────────────

  const toggleHour = (h: number) => {
    setHours(prev => {
      const next = [...prev];
      next[h] = nextState(next[h]);
      return next;
    });
  };

  // ── Demand chart data (Graph 1: Technical Truth) ────────────────────────────
  // Source: lifestyle.hourlyData from LifestyleSimulationModule (deterministic,
  // physics-driven).  Shows the raw kW load regardless of which system is chosen.
  // DHW demand is approximated from the user's painted high-DHW hours scaled by
  // heatLossKw so the two series share a meaningful unit.
  const heatLossKw = engineInput.heatLossWatts / 1000;
  const demandChartData = lifestyle.hourlyData.map((row, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    'Heat (kW)':  parseFloat(row.demandKw.toFixed(2)),
    'DHW (kW)':   parseFloat(
      ((hours[h] === 'dhw_demand' ? DHW_DEMAND_DRAW_FRACTION : hours[h] === 'home' ? HOME_DRAW_FRACTION : 0) * heatLossKw).toFixed(2),
    ),
  }));

  const homeCount = hours.filter(s => s === 'home').length;
  const dhwCount  = hours.filter(s => s === 'dhw_demand').length;
  const awayCount = hours.filter(s => s === 'away').length;

  // Combi efficiency collapses when DHW demand hours are active
  const combiEfficiencyCollapsed = dhwCount > 0;

  // DHW draw today: approximate kWh drawn from the hot-water system.
  // dhw_demand hour: 18% SoC draw × 5 kWh cylinder = 0.9 kWh
  // home hour: 4% SoC draw × 5 kWh cylinder = 0.2 kWh
  const dhwDrawKwhToday = parseFloat(
    (dhwCount * 0.9 + homeCount * 0.2).toFixed(1),
  );

  return (
    <div>
      <p style={{ fontSize: '0.8rem', color: '#4a5568', marginBottom: 10 }}>
        Click hour blocks to cycle:{' '}
        <strong style={{ color: '#276749' }}>At Home</strong> →{' '}
        <strong style={{ color: '#c53030' }}>High DHW</strong> →{' '}
        <strong style={{ color: '#2c5282' }}>Away</strong>.
        Toggles update the curve in real-time.
      </p>

      {/* ── System pill switcher ──────────────────────────────────────────────── */}
      <div
        style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: 10 }}
        role="group"
        aria-label="Select heating system"
      >
        {(Object.keys(SYSTEM_LABELS) as DayPainterSystem[]).map(sys => (
          <button
            key={sys}
            onClick={() => setSelectedSystem(sys)}
            aria-pressed={selectedSystem === sys}
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              border: `1.5px solid ${selectedSystem === sys ? '#3182ce' : '#e2e8f0'}`,
              background: selectedSystem === sys ? '#ebf8ff' : '#f7fafc',
              color: selectedSystem === sys ? '#2b6cb0' : '#718096',
              fontSize: '0.78rem',
              fontWeight: selectedSystem === sys ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {SYSTEM_LABELS[sys]}
          </button>
        ))}
      </div>

      {/* ── 24-hour Day Painter ─────────────────────────────────────────────── */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2, marginBottom: 10 }}
        aria-label="24-hour day painter"
      >
        {hours.map((state, h) => (
          <button
            key={h}
            onClick={() => toggleHour(h)}
            title={`${String(h).padStart(2, '0')}:00 – ${STATE_LABELS[state]}`}
            aria-label={`Hour ${h}: ${STATE_LABELS[state]}`}
            aria-pressed={state !== 'away'}
            style={{
              height: 36,
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              background: STATE_COLOURS[state],
              cursor: 'pointer',
              fontSize: '0.55rem',
              color: state === 'away' ? '#a0aec0' : '#2d3748',
              padding: 0,
              lineHeight: '36px',
              fontWeight: state !== 'away' ? 700 : 400,
            }}
          >
            {h}
          </button>
        ))}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: 10 }}>
        {STATE_CYCLE.map(s => (
          <span
            key={s}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#4a5568' }}
          >
            <span
              style={{
                width: 12, height: 12, borderRadius: 3,
                background: STATE_COLOURS[s], border: '1px solid #a0aec0',
                display: 'inline-block',
              }}
            />
            {STATE_LABELS[s]}
          </span>
        ))}
      </div>

      {/* ── Toggles ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: 14 }}>
        <ToggleButton
          label={isFullJob ? '✅ Full Job (35°C)' : '⚠️ Fast Fit (50°C)'}
          active={isFullJob}
          onClick={() => setIsFullJob(p => !p)}
          activeColor="#276749"
          inactiveColor="#c05621"
          title="Toggle British Gas Full Job (new radiators, 35 °C) vs Octopus Fast Fit (existing radiators, 50 °C)"
        />
        <ToggleButton
          label="🧂 Softener"
          active={hasSoftener}
          onClick={() => setHasSoftener(p => !p)}
          activeColor="#3182ce"
          inactiveColor="#718096"
          title="Enable water softener – clears DHW scaling tax, boiler DHW recovery remains 100 % efficient over 10 years"
        />
      </div>

      {/* ── Stat badges ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: 14 }}>
        <StatBadge
          label="SPF"
          value={specEdge.spfMidpoint.toFixed(2)}
          color={specEdge.spfMidpoint >= 3.8 ? '#276749' : '#c05621'}
          bg={specEdge.spfMidpoint >= 3.8 ? '#f0fff4' : '#fffaf0'}
        />
        <StatBadge
          label="Flow Temp"
          value={`${specEdge.designFlowTempC}°C`}
          color={specEdge.designFlowTempC <= 40 ? '#276749' : '#c05621'}
          bg={specEdge.designFlowTempC <= 40 ? '#f0fff4' : '#fffaf0'}
        />
        <StatBadge label="At Home" value={`${homeCount}h`} color="#276749" bg="#f0fff4" />
        <StatBadge label="High DHW" value={`${dhwCount}h`} color="#c53030" bg="#fff5f5" />
        <StatBadge label="Away" value={`${awayCount}h`} color="#2c5282" bg="#ebf8ff" />
        <StatBadge
          label="DHW draw today"
          value={`${dhwDrawKwhToday} kWh`}
          color={dhwCount > 0 ? '#c53030' : '#276749'}
          bg={dhwCount > 0 ? '#fff5f5' : '#f0fff4'}
        />
        {combiEfficiencyCollapsed && (
          <StatBadge
            label="Combi Efficiency"
            value="<30% ⚠️"
            color="#c53030"
            bg="#fff5f5"
          />
        )}
        {hasSoftener && specEdge.dhwScalingTaxPct === 0 && (
          <StatBadge
            label="DHW Scale Tax"
            value="0% ✅"
            color="#276749"
            bg="#f0fff4"
          />
        )}
      </div>

      {/* ── Graph 1: Technical Truth — Services Demand ─────────────────────── */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2d3748', marginBottom: 4 }}>
          📊 Graph 1 — Services Demand (what the home needs)
        </div>
        {/* Fairness badge: both systems use the identical demand timeline */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#f0fff4', border: '1px solid #9ae6b4',
          borderRadius: 6, padding: '3px 10px',
          fontSize: '0.72rem', color: '#276749', marginBottom: 6,
        }}>
          🟢 Demand timeline identical for both systems
        </div>
        <div style={{ height: 180, marginBottom: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={demandChartData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
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
              <Area
                type="monotone"
                dataKey="Heat (kW)"
                fill="#fed7aa"
                stroke="#ed8936"
                strokeWidth={2}
                fillOpacity={0.5}
              />
              <Area
                type="monotone"
                dataKey="DHW (kW)"
                fill="#bee3f8"
                stroke="#3182ce"
                strokeWidth={2}
                fillOpacity={0.5}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Graph 2: System Response — Boiler Modulation & Efficiency ──────── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2d3748', marginBottom: 4 }}>
          ⚙️ Graph 2 — System Response ({SYSTEM_LABELS[selectedSystem]})
        </div>
        <div style={{ height: 200, marginBottom: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
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
              label={{ value: 'Reserve %', angle: 90, position: 'insideRight', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{ fontSize: '0.78rem', borderRadius: 8 }}
              formatter={(value: number | undefined, name: string | undefined) => [
                value !== undefined ? value.toFixed(1) : '',
                name ?? '',
              ]}
            />
            <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: 6 }} />
            {/* 21 °C comfort reference line */}
            <ReferenceLine
              yAxisId="temp"
              y={21}
              stroke="#48bb78"
              strokeDasharray="4 3"
              label={{ value: '21°C', fontSize: 9, fill: '#276749' }}
            />
            {/* Boiler "Stepped" Curve – 30 kW Sprinter */}
            {showBoiler && (
              <Line
                yAxisId="temp"
                type="stepAfter"
                dataKey="Boiler (°C)"
                stroke="#ed8936"
                strokeWidth={2.5}
                dot={false}
              />
            )}
            {/* HP "Horizon" Curve – SPF-driven flat or dipping line */}
            {showHp && (
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="HP Horizon (°C)"
                stroke="#48bb78"
                strokeWidth={2.5}
                dot={false}
                strokeDasharray={isFullJob ? undefined : '6 3'}
              />
            )}
            {/* Hot water reserve – stored cylinder area chart */}
            {showHwReserve && (
              <Area
                yAxisId="reserve"
                type="monotone"
                dataKey="Hot water reserve (%)"
                fill="#bee3f8"
                stroke="#3182ce"
                strokeWidth={1.5}
                fillOpacity={0.35}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recommendation note from LifestyleSimulationModule ─────────────── */}
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

// ─── Small helper components ──────────────────────────────────────────────────

function ToggleButton({
  label,
  active,
  onClick,
  activeColor,
  inactiveColor,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  activeColor: string;
  inactiveColor: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={{
        padding: '5px 12px',
        borderRadius: 20,
        border: `1.5px solid ${active ? activeColor : '#e2e8f0'}`,
        background: active ? `${activeColor}18` : '#f7fafc',
        color: active ? activeColor : inactiveColor,
        fontSize: '0.78rem',
        fontWeight: active ? 700 : 400,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function StatBadge({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div style={{
      background: bg,
      border: `1px solid ${color}40`,
      borderRadius: 6,
      padding: '4px 10px',
      fontSize: '0.78rem',
      color,
    }}>
      <span style={{ color: '#718096', fontSize: '0.7rem' }}>{label}: </span>
      <strong>{value}</strong>
    </div>
  );
}

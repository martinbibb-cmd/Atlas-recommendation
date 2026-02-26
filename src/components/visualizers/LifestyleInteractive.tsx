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
 * Condition Explorer (Step 8 panel):
 *  Toggle: As Found / After Flush+Filter
 *  Re-routes sludge physics into correct channels (not blanket η tax).
 *  Graph C – Comfort Stability: minutes below 21°C setpoint (dirty vs clean)
 *  Graph D – DHW Deliverability (combi only): requested vs delivered L/min @40°C
 *
 * Debug overlay: flowDeratePct, cyclingLossPct, dhwCapacityDeratePct, velocityMs, effectiveCOP
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
import { runSludgeVsScaleModule } from '../../engine/modules/SludgeVsScaleModule';
import { runHydraulicModuleV1 } from '../../engine/modules/HydraulicModule';
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

// ─── Condition Explorer sludge inputs ─────────────────────────────────────────
// "As Found" scenario: a typical 10-year-old one-pipe system in a hard water area.
// "After Flush+Filter" scenario: magnetic filter fitted → flowDeratePct = 0;
// scale on DHW HX is unchanged (flush does not remove limescale).
const SLUDGE_INPUT_AS_FOUND = {
  pipingTopology: 'one_pipe' as const,
  hasMagneticFilter: false,
  waterHardnessCategory: 'hard' as const,
  systemAgeYears: 10,
};
const SLUDGE_INPUT_AFTER_FLUSH = {
  ...SLUDGE_INPUT_AS_FOUND,
  hasMagneticFilter: true, // magnetic filter fitted + power flush
};

// Nominal combi DHW output (kW) and Cp×ΔT for deliverable L/min computation
const NOMINAL_COMBI_DHW_KW = 25;
/** Specific heat of water (kJ per litre per °C) */
const WATER_SPECIFIC_HEAT_KJ_PER_L_K = 4.19;
/** ΔT for combi DHW delivery: cold mains ~15°C → 40°C = 25 K */
const DHW_DELTA_T_C = 25;
const CP_DELTA_T = WATER_SPECIFIC_HEAT_KJ_PER_L_K * DHW_DELTA_T_C; // 104.75 kJ/(L·K)

/** Indoor comfort setpoint (°C) — used for Graph C below-setpoint calculations. */
const COMFORT_SETPOINT_C = 21;

// ─── Demand chart physics constants ──────────────────────────────────────────

/** Fraction of cylinder capacity drawn per "High DHW" hour (18 % × 5 kWh = 0.9 kWh). */
const DHW_DEMAND_DRAW_FRACTION = 0.18;
/** Fraction of cylinder capacity drawn during ordinary "At Home" hours (4 % × 5 kWh = 0.2 kWh). */
const HOME_DRAW_FRACTION = 0.04;
/** Y-axis upper bound for the demand chart: 120 % of peak heat-loss to leave headroom. */
const DEMAND_Y_AXIS_SCALE_FACTOR = 1.2;
/** Requested hot-water draw rate (L/min @40°C) during a High DHW hour. */
const DHW_REQUESTED_LPM = parseFloat((NOMINAL_COMBI_DHW_KW * 60 / CP_DELTA_T).toFixed(1)); // ~14.3 L/min
/** Requested hot-water draw rate (L/min @40°C) during an At Home hour (background use). */
const HOME_REQUESTED_LPM = parseFloat((DHW_REQUESTED_LPM * 0.25).toFixed(1)); // ~3.6 L/min

// ─── Component ────────────────────────────────────────────────────────────────

type ConditionScenario = 'as_found' | 'after_flush';

interface Props {
  /** Partial base engine input – merged with defaults. */
  baseInput?: Partial<EngineInputV2_3>;
}

export default function LifestyleInteractive({ baseInput = {} }: Props) {
  const [hours, setHours] = useState<HourState[]>(defaultHours);
  const [isFullJob, setIsFullJob] = useState(true);
  const [selectedSystem, setSelectedSystem] = useState<DayPainterSystem>('combi');
  const [conditionScenario, setConditionScenario] = useState<ConditionScenario>('as_found');
  // DHW draws always go to the hot-water system — demand is driven by household
  // size and bathroom count heuristics (no user-facing supply-path selector).
  const dhwDrawScalar = 1.0;
  const [hasSoftener, setHasSoftener] = useState(false);

  const engineInput: EngineInputV2_3 = { ...DEFAULT_ENGINE_INPUT, ...baseInput };

  // ── Condition Explorer: compute sludge physics for current scenario ─────────
  const sludgeInput = conditionScenario === 'as_found' ? SLUDGE_INPUT_AS_FOUND : SLUDGE_INPUT_AFTER_FLUSH;
  const sludge = useMemo(
    () => runSludgeVsScaleModule(sludgeInput),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conditionScenario],
  );

  // Wire sludge physics into HydraulicModule and LifestyleSimulationModule
  const hydraulicV1 = useMemo(
    () => runHydraulicModuleV1(engineInput, sludge.flowDeratePct),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engineInput.heatLossWatts, engineInput.primaryPipeDiameter, sludge.flowDeratePct],
  );

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
    () => runLifestyleSimulationModule(engineInput, sludge.cyclingLossPct),
    // occupancySignature, heatLossWatts and cyclingLossPct drive this module
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engineInput.occupancySignature, engineInput.heatLossWatts, sludge.cyclingLossPct],
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

  // ── Graph C: Comfort Stability ─────────────────────────────────────────────
  // Minutes below COMFORT_SETPOINT_C for boiler room trace.
  // Dirty system (As Found): cyclingLossPct affects fuelPenalty but not the room trace directly.
  // We compare the "As Found" vs "After Flush+Filter" by running the module both ways.
  const comfortChartData = lifestyle.hourlyData.map((row, h) => {
    const shortfall = Math.max(0, COMFORT_SETPOINT_C - row.boilerRoomTempC);
    const cyclingPenalty = row.cyclingFuelPenaltyKw;
    return {
      hour: `${String(h).padStart(2, '0')}:00`,
      'Room Temp (°C)': row.boilerRoomTempC,
      'Cycling Penalty (kW)': parseFloat(cyclingPenalty.toFixed(2)),
      'Comfort Shortfall (K)': parseFloat(shortfall.toFixed(2)),
    };
  });

  const minutesBelowSetpoint = lifestyle.hourlyData.filter(h => h.boilerRoomTempC < COMFORT_SETPOINT_C).length * 60;
  const totalCyclingPenaltyKwh = parseFloat(
    lifestyle.hourlyData.reduce((s, h) => s + h.cyclingFuelPenaltyKw, 0).toFixed(2)
  );

  // ── Graph D: DHW Deliverability (combi only) ──────────────────────────────
  // Requested L/min @40°C vs delivered L/min after scale capacity derate.
  const dhwDerateFraction = sludge.dhwCapacityDeratePct;
  const dhwDeliverabilityData = lifestyle.hourlyData.map((row, h) => {
    const isDhwHour = hours[h] === 'dhw_demand';
    const isHomeHour = hours[h] === 'home';
    const requestedLpm = isDhwHour ? DHW_REQUESTED_LPM : isHomeHour ? HOME_REQUESTED_LPM : 0;
    const deliveredLpm = parseFloat((requestedLpm * (1 - dhwDerateFraction)).toFixed(1));
    const shortfallLpm = parseFloat((requestedLpm - deliveredLpm).toFixed(1));
    return {
      hour: `${String(h).padStart(2, '0')}:00`,
      'Requested (L/min)': requestedLpm,
      'Delivered (L/min)': deliveredLpm,
      'Shortfall (L/min)': shortfallLpm,
    };
  });

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

      {/* ── Condition Explorer ──────────────────────────────────────────────── */}
      <div style={{
        border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px',
        marginBottom: 14, background: '#fffdf7',
      }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2d3748', marginBottom: 8 }}>
          🔍 System Condition Explorer
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 10 }} role="group" aria-label="Condition scenario">
          {(['as_found', 'after_flush'] as ConditionScenario[]).map(s => (
            <button
              key={s}
              onClick={() => setConditionScenario(s)}
              aria-pressed={conditionScenario === s}
              style={{
                padding: '4px 12px', borderRadius: 16,
                border: `1.5px solid ${conditionScenario === s ? '#c05621' : '#e2e8f0'}`,
                background: conditionScenario === s ? '#fffaf0' : '#f7fafc',
                color: conditionScenario === s ? '#c05621' : '#718096',
                fontSize: '0.75rem', fontWeight: conditionScenario === s ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {s === 'as_found' ? '🔴 As Found' : '🟢 After Flush + Filter'}
            </button>
          ))}
        </div>
        {/* Glass Box Debug Overlay */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '6px',
        }}>
          <DebugFactor
            label="Flow derate"
            value={`${(sludge.flowDeratePct * 100).toFixed(1)}%`}
            warn={sludge.flowDeratePct > 0}
          />
          <DebugFactor
            label="Cycling loss"
            value={`${(sludge.cyclingLossPct * 100).toFixed(1)}%`}
            warn={sludge.cyclingLossPct > 0}
          />
          <DebugFactor
            label="DHW capacity derate"
            value={`${(sludge.dhwCapacityDeratePct * 100).toFixed(1)}%`}
            warn={sludge.dhwCapacityDeratePct > 0}
          />
          <DebugFactor
            label="Velocity after derate"
            value={`${hydraulicV1.ashp.velocityMs.toFixed(2)} m/s`}
            warn={hydraulicV1.velocityPenalty > 0}
          />
          <DebugFactor
            label="Effective COP"
            value={hydraulicV1.effectiveCOP.toFixed(2)}
            warn={hydraulicV1.velocityPenalty > 0}
          />
          <DebugFactor
            label="Minutes below 21°C"
            value={`${minutesBelowSetpoint} min`}
            warn={minutesBelowSetpoint > 0}
          />
          {totalCyclingPenaltyKwh > 0 && (
            <DebugFactor
              label="Cycling fuel waste"
              value={`${totalCyclingPenaltyKwh} kWh`}
              warn
            />
          )}
        </div>
        {conditionScenario === 'after_flush' && (
          <div style={{
            marginTop: 8, fontSize: '0.72rem', color: '#276749',
            background: '#f0fff4', borderRadius: 4, padding: '4px 8px',
          }}>
            ✅ After flush + filter: flow derate and cycling loss cleared.
            Scale on DHW HX unchanged (flush does not remove limescale).
          </div>
        )}
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
            {/* comfort setpoint reference line */}
            <ReferenceLine
              yAxisId="temp"
              y={COMFORT_SETPOINT_C}
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

      {/* ── Graph C: Comfort Stability ──────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2d3748', marginBottom: 4 }}>
          🌡️ Graph C — Comfort Stability
          <span style={{
            marginLeft: 8, fontSize: '0.7rem', fontWeight: 400, color: '#718096',
          }}>
            (boiler room temp + cycling penalty — {conditionScenario === 'as_found' ? '🔴 As Found' : '🟢 After Flush'})
          </span>
        </div>
        {minutesBelowSetpoint > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#fff5f5', border: '1px solid #fed7d7',
            borderRadius: 6, padding: '3px 10px',
            fontSize: '0.72rem', color: '#c53030', marginBottom: 6,
          }}>
            ⏱️ {minutesBelowSetpoint} min below 21°C setpoint today
            {totalCyclingPenaltyKwh > 0 && ` · +${totalCyclingPenaltyKwh} kWh cycling waste`}
          </div>
        )}
        <div style={{ height: 160, marginBottom: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={comfortChartData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
              <YAxis
                yAxisId="temp"
                domain={[14, 26]}
                tick={{ fontSize: 9 }}
                label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 10 }}
              />
              <YAxis
                yAxisId="penalty"
                orientation="right"
                domain={[0, 0.5]}
                tick={{ fontSize: 9 }}
                label={{ value: 'kW', angle: 90, position: 'insideRight', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{ fontSize: '0.78rem', borderRadius: 8 }}
                formatter={(value: number | undefined, name: string | undefined) => [
                  value !== undefined ? value.toFixed(2) : '',
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
                dataKey="Room Temp (°C)"
                stroke="#ed8936"
                strokeWidth={2}
                dot={false}
              />
              {totalCyclingPenaltyKwh > 0 && (
                <Area
                  yAxisId="penalty"
                  type="stepAfter"
                  dataKey="Cycling Penalty (kW)"
                  fill="#fed7d7"
                  stroke="#e53e3e"
                  strokeWidth={1}
                  fillOpacity={0.4}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Graph D: DHW Deliverability (combi only) ────────────────────────── */}
      {selectedSystem === 'combi' && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2d3748', marginBottom: 4 }}>
            🚿 Graph D — DHW Deliverability @40°C (Combi)
            <span style={{
              marginLeft: 8, fontSize: '0.7rem', fontWeight: 400, color: '#718096',
            }}>
              ({conditionScenario === 'as_found' ? '🔴 As Found' : '🟢 After Flush'})
            </span>
          </div>
          {sludge.dhwCapacityDeratePct > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#fff5f5', border: '1px solid #fed7d7',
              borderRadius: 6, padding: '3px 10px',
              fontSize: '0.72rem', color: '#c53030', marginBottom: 6,
            }}>
              💧 Scale derate {(sludge.dhwCapacityDeratePct * 100).toFixed(1)}% —
              nominal {DHW_REQUESTED_LPM} L/min → delivered {parseFloat((DHW_REQUESTED_LPM * (1 - sludge.dhwCapacityDeratePct)).toFixed(1))} L/min
            </div>
          )}
          <div style={{ height: 160, marginBottom: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dhwDeliverabilityData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
                <YAxis
                  domain={[0, Math.ceil(DHW_REQUESTED_LPM * 1.2)]}
                  tick={{ fontSize: 9 }}
                  label={{ value: 'L/min', angle: -90, position: 'insideLeft', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{ fontSize: '0.78rem', borderRadius: 8 }}
                  formatter={(value: number | undefined, name: string | undefined) => [
                    value !== undefined ? `${value.toFixed(1)} L/min` : '',
                    name ?? '',
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: 6 }} />
                <Area
                  type="stepAfter"
                  dataKey="Requested (L/min)"
                  fill="#bee3f8"
                  stroke="#3182ce"
                  strokeWidth={1.5}
                  fillOpacity={0.3}
                />
                <Line
                  type="stepAfter"
                  dataKey="Delivered (L/min)"
                  stroke="#38a169"
                  strokeWidth={2}
                  dot={false}
                />
                {sludge.dhwCapacityDeratePct > 0 && (
                  <Area
                    type="stepAfter"
                    dataKey="Shortfall (L/min)"
                    fill="#fed7d7"
                    stroke="#e53e3e"
                    strokeWidth={1}
                    fillOpacity={0.5}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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

function DebugFactor({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{
      background: warn ? '#fff5f5' : '#f0fff4',
      border: `1px solid ${warn ? '#fed7d7' : '#9ae6b4'}`,
      borderRadius: 4,
      padding: '3px 8px',
      fontSize: '0.72rem',
      color: warn ? '#c53030' : '#276749',
    }}>
      <span style={{ color: '#718096' }}>{label}: </span>
      <strong>{value}</strong>
    </div>
  );
}

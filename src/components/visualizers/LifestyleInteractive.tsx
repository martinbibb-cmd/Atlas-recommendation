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

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { runHydraulicModuleV1 } from '../../engine/modules/HydraulicModule';
import {
  type HourState,
  STATE_LABELS,
  STATE_COLOURS,
  STATE_CYCLE,
  defaultHours,
  nextState,
  defaultWaterSlots,
  waterSlotsToHourlyFlows,
} from '../../engine/modules/LifestyleInteractiveHelpers';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import {
  COLD_SUPPLY_TEMP_PRESETS,
  COMBI_HOT_OUT_PRESETS,
  OUTLET_FLOW_PRESETS_LPM,
  NOMINAL_COMBI_DHW_KW,
  computeHeatLimitLpm,
  computeRequiredKw,
  type SeasonPreset,
  type DhwModePreset,
} from '../../engine/presets/DhwFlowPresets';

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

// Nominal combi DHW output is imported from DhwFlowPresets (NOMINAL_COMBI_DHW_KW = 30 kW).

/** Indoor comfort setpoint (°C) — used for Graph C below-setpoint calculations. */
const COMFORT_SETPOINT_C = 21;

/**
 * Cold-water draw rate (L/min) for a cold tap (e.g. kitchen drinking tap).
 * Represents a direct cold-mains draw with no DHW involvement.
 */
const COLD_TAP_LPM = 5;

/** Typical UK instantaneous sink draw rate (L/min mixed). */
const SINK_FLOW_LPM = 6;

/** Typical UK bath fill rate (L/min mixed). */
const BATH_FLOW_LPM = 12;

// ─── Outlet types for the weir gauge panel ────────────────────────────────────

/** Keys for the four draw-off outlets shown in the weir gauge panel. */
type OutletKey = 'shower' | 'sink' | 'bath' | 'cold_tap';

const OUTLET_LABELS: Record<OutletKey, string> = {
  shower: 'Shower',
  sink: 'Kitchen tap',
  bath: 'Bath',
  cold_tap: 'Cold tap',
};

const NARRATION_MESSAGES = {
  showerPriority: 'Shower running · Heating paused to prioritise hot water',
  sharedDemand: 'Shared demand reduces flow delivery',
  cylinderSupplyingTwo: 'Cylinder supplying two outlets · stored volume falling',
  ashpRecovering: 'Heat pump recovering gradually · flow temperature rising slowly',
  mainsLimiting: 'Incoming mains flow is now limiting simultaneous demand',
} as const;

const LIVE_METRIC_FLASH_THRESHOLD = 0.2;
const Z_INDEX_DRAWER = 40;
const Z_INDEX_ALERTS_TOP_SHEET = 41;
const Z_INDEX_TIMELINE_BOTTOM_SHEET = 42;
const Z_INDEX_OUTLET_POPOVER = 43;
const IPAD_MAX_VIEWPORT_HEIGHT_PX = 1024;
const COLLAPSED_RAIL_WIDTH_PX = 48;
const LEFT_RAIL_WIDTH_PX = 220;
const RIGHT_RAIL_WIDTH_PX = 250;

/** Default dynamic mains pressure (bar) used when no override is provided. */
const DEFAULT_MAINS_PRESSURE_BAR = 2.5;

/**
 * Nominal maximum gravity-fed flow rate (L/min) for a stored vented system.
 * Based on a UK head of ~1 m above the draw-off point.  The branch hydraulic model
 * (StoredDhwModule BRANCH_BASE_FLOW_LPM = 9.0 L/min at 1 m head, 15 mm pipe) gives
 * 9.0 L/min for a single 15 mm branch.  10 L/min is used here as a round upper bound
 * accounting for larger bore distribution (e.g. 22 mm main run feeding the branch).
 */
const VENTED_MAX_GRAVITY_FLOW_LPM = 10;

// ─── Demand chart physics constants ──────────────────────────────────────────

/** Y-axis upper bound for the demand chart: 120 % of peak heat-loss to leave headroom. */
const DEMAND_Y_AXIS_SCALE_FACTOR = 1.2;

/** Convert a snake_case or lowercase preset key to title case for display. */
function titleCase(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ─── Component ────────────────────────────────────────────────────────────────

type ConditionScenario = 'as_found' | 'after_flush';

interface Props {
  /** Partial base engine input – merged with defaults. */
  baseInput?: Partial<EngineInputV2_3>;
}

interface NarrationToastItem {
  id: number;
  message: string;
}

export default function LifestyleInteractive({ baseInput = {} }: Props) {
  const [hours, setHours] = useState<HourState[]>(defaultHours);
  const [activeDhwHours, setActiveDhwHours] = useState<number>(
    () => defaultHours().filter((state) => state === 'dhw_demand').length,
  );
  // waterSlots stays as a stable constant — the painter UI is replaced by the
  // weir gauge panel.  The value feeds anyWaterPainted / waterFlows for chart
  // pipes and is never mutated, so useMemo keeps the reference stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const waterSlots = useMemo(() => defaultWaterSlots(), []);
  const [isFullJob, setIsFullJob] = useState(true);
  const [selectedSystem, setSelectedSystem] = useState<DayPainterSystem>('combi');
  const [conditionScenario, setConditionScenario] = useState<ConditionScenario>('as_found');
  const [hasSoftener, setHasSoftener] = useState(false);

  // ── Weir gauge outlet toggles ──────────────────────────────────────────────
  const [activeOutlets, setActiveOutlets] = useState<Record<OutletKey, boolean>>({
    shower:   false,
    sink:     false,
    bath:     false,
    cold_tap: false,
  });

  const toggleOutlet = (key: OutletKey) => {
    setActiveOutlets(prev => {
      const isNowActive = !prev[key];
      setSelectedOutlet(isNowActive ? key : null);
      return { ...prev, [key]: isNowActive };
    });
  };

  // ── Compare mode ───────────────────────────────────────────────────────────
  /** When true, show two side-by-side draw-off gauge columns for comparison. */
  const [compareMode, setCompareMode] = useState(false);
  /** The second system shown in compare mode (System B). */
  const [systemB, setSystemB] = useState<DayPainterSystem>('stored_unvented');
  const [setupDrawerOpen, setSetupDrawerOpen] = useState(false);
  const [engineeringDrawerOpen, setEngineeringDrawerOpen] = useState(false);
  const [efficiencyDrawerOpen, setEfficiencyDrawerOpen] = useState(false);
  const [timelineSheetOpen, setTimelineSheetOpen] = useState(false);
  const [alertsSheetOpen, setAlertsSheetOpen] = useState(false);
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletKey | null>(null);
  const [narrationToasts, setNarrationToasts] = useState<NarrationToastItem[]>([]);

  // ── DHW concurrency presets — drive all flow & kW calculations ─────────────
  const [season, setSeason]       = useState<SeasonPreset>('typical');
  const [dhwMode, setDhwMode]     = useState<DhwModePreset>('normal');
  // Derived physics from presets
  const coldWaterTempC  = COLD_SUPPLY_TEMP_PRESETS[season];
  const combiHotOutTempC = COMBI_HOT_OUT_PRESETS[dhwMode];
  // Shower flow is fixed at the standard mixer preset — demand is driven by
  // household size and bathroom count heuristics, not a user-facing selector.
  const showerFlowLpm   = OUTLET_FLOW_PRESETS_LPM['mixer'];
  const dhwDeltaT       = combiHotOutTempC - coldWaterTempC;
  const heatLimitLpm    = computeHeatLimitLpm(NOMINAL_COMBI_DHW_KW, dhwDeltaT);

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
    // demandPreset, occupancyCount, and timingOverrides drive DHW peak timing and kW per person;
    // occupancySignature and heatLossWatts drive the heating demand profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      engineInput.occupancySignature,
      engineInput.heatLossWatts,
      engineInput.demandPreset,
      engineInput.occupancyCount,
      engineInput.demandTimingOverrides,
      sludge.cyclingLossPct,
    ],
  );

  // ── Derived curve data ──────────────────────────────────────────────────────

  // Derive which curve series to render for the selected system
  const showBoiler   = selectedSystem === 'combi' || selectedSystem === 'stored_vented' || selectedSystem === 'stored_unvented';
  const showHp       = selectedSystem === 'ashp';
  const showHwReserve = selectedSystem !== 'combi'; // stored systems & ASHP have a cylinder

  // Graph 2 data sourced entirely from engine results (lifestyle.hourlyData).
  // boilerRoomTempC and ashpRoomTempC come from the physics-based dynamic room trace.
  // Cylinder reserve % derived from engine cylinderVolumeL (110 L cylinder).
  const chartData = lifestyle.hourlyData.map((row, h) => {
    const entry: Record<string, string | number> = {
      hour: `${String(h).padStart(2, '0')}:00`,
    };
    if (showBoiler)    entry['Boiler Room (°C)']       = row.boilerRoomTempC;
    if (showHp)        entry['HP Room (°C)']            = row.ashpRoomTempC;
    if (showHwReserve) entry['Hot water reserve (%)']   = parseFloat((row.cylinderVolumeL / CYLINDER_VOLUME_L * 100).toFixed(1));
    return entry;
  });

  // ── Interaction handlers ────────────────────────────────────────────────────

  const toggleHour = (h: number) => {
    setHours(prev => {
      const next = [...prev];
      next[h] = nextState(next[h]);
      setActiveDhwHours(next.filter(state => state === 'dhw_demand').length);
      return next;
    });
  };

  // ── Demand chart data (Graph 1: Technical Truth) ────────────────────────────
  // Source: lifestyle.hourlyData from LifestyleSimulationModule (deterministic,
  // physics-driven).  Shows the raw kW load regardless of which system is chosen.
  // DHW demand: when the water painter has slots set, those drive the DHW kW series.
  // When no slots are painted, DHW = 0 (no phantom events from the hour painter).
  const heatLossKw = engineInput.heatLossWatts / 1000;
  const anyWaterPainted = waterSlots.some(s => s !== 'none');
  const anyWaterCold    = waterSlots.some(s => s === 'cold');

  // Unified water painter → per-hour L/min (hot DHW and cold DCW separately).
  // Using waterSlotsToHourlyFlows keeps DHW and DCW as independent channels so
  // Graph D can apply the heat limit only to the hot draw.
  const waterFlows = useMemo(
    () => waterSlotsToHourlyFlows(waterSlots, showerFlowLpm, COLD_TAP_LPM),
    [waterSlots, showerFlowLpm],
  );

  // kW series for Graph 1 — derived from hot L/min via ΔT (reactive to presets)
  const waterDhwByHour = waterFlows.hotLpmByHour.map(
    lpm => parseFloat(computeRequiredKw(lpm, dhwDeltaT).toFixed(2)),
  );

  const demandChartData = lifestyle.hourlyData.map((row, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    'Heat (kW)':  parseFloat(row.demandKw.toFixed(2)),
    // DHW series: Water Painter slots when painted; occupancy-derived profile otherwise.
    // This ensures DHW demand is always visible — zero only when the module itself
    // computes zero (overnight / away periods), never as an artefact of unpainted slots.
    'DHW (kW)':   anyWaterPainted ? waterDhwByHour[h] : parseFloat((row.dhwKw ?? 0).toFixed(2)),
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
  // DHW and DCW are treated as independent channels:
  //   Hot (DHW) demand → checked against combi heat limit AND scale derate.
  //   Cold (DCW) demand → cold mains only; no heat drawn; shown for mains context.
  //
  // Data source priority:
  //   1. Water Painter slots (anyWaterPainted) — per-5-min slot resolution from
  //      waterFlows.hotLpmByHour / coldLpmByHour.
  //   2. Hour-level painter heuristic (High DHW / At Home / Away) — fallback when
  //      no water slots are painted.
  //
  // This means Graph D and Graph 1 are always driven by the same underlying data.
  const dhwDerateFraction = sludge.dhwCapacityDeratePct;

  // Hot fraction of a mixed draw at the outlet (40 °C mixed target, UK standard).
  // hotFrac = (mixedTarget - coldC) / (hotC - coldC)
  // Transparent to users: shows why high ΔT (winter / 55 °C) raises the kW per L/min.
  const MIXED_TARGET_C = 40;
  const hotFraction = dhwDeltaT > 0
    ? parseFloat(Math.min(1, (MIXED_TARGET_C - coldWaterTempC) / dhwDeltaT).toFixed(2))
    : 1;

  const dhwDeliverabilityData = lifestyle.hourlyData.map((_row, h) => {
    let requestedHotLpm: number;
    let coldDrawLpm: number;

    if (anyWaterPainted) {
      // Water Painter is the authoritative source — both hot and cold tracks
      requestedHotLpm = waterFlows.hotLpmByHour[h];
      coldDrawLpm     = waterFlows.coldLpmByHour[h];
    } else {
      // Fallback: derive from hour-level painter state
      const isDhwHour  = hours[h] === 'dhw_demand';
      const isHomeHour = hours[h] === 'home';
      requestedHotLpm = isDhwHour
        ? showerFlowLpm
        : isHomeHour
          ? parseFloat((showerFlowLpm * 0.25).toFixed(1))
          : 0;
      coldDrawLpm = 0;
    }

    // Heat limit applies to the hot (DHW) draw only — cold mains bypasses the boiler
    const heatCapHotLpm = Math.min(requestedHotLpm, heatLimitLpm);
    const deliveredLpm  = parseFloat((heatCapHotLpm * (1 - dhwDerateFraction)).toFixed(1));
    const shortfallLpm  = parseFloat(Math.max(0, requestedHotLpm - deliveredLpm).toFixed(1));

    return {
      hour: `${String(h).padStart(2, '0')}:00`,
      'Requested (L/min)':  requestedHotLpm,
      'Cold draw (L/min)':  coldDrawLpm,
      'Delivered (L/min)':  deliveredLpm,
      'Shortfall (L/min)':  shortfallLpm,
    };
  });

  // Peak single-shower delivered flow (for scale-derate badge)
  const peakDeliveredLpm = parseFloat(
    (Math.min(showerFlowLpm, heatLimitLpm) * (1 - dhwDerateFraction)).toFixed(1),
  );

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

  // ── Graph S: Stored Cylinder — temperature and volume (engine results) ───────
  // Only shown for stored systems (stored_vented, stored_unvented, ashp).
  // Data comes entirely from lifestyle.hourlyData (cylinderTempC, cylinderVolumeL).
  const storedCylinderData = lifestyle.hourlyData.map((row, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    'Cylinder Temp (°C)': row.cylinderTempC,
    'Volume Available (L)': row.cylinderVolumeL,
  }));

  // ── Weir gauge panel derived values ─────────────────────────────────────────
  // Instantaneous snapshot of simultaneous draw-off demand vs available capacity.

  /** Max cold-mains flow rate (L/min) derived from mains pressure. */
  const maxMainsLpm = Math.min((engineInput.dynamicMainsPressure ?? DEFAULT_MAINS_PRESSURE_BAR) * 10, 30);

  /** Total cold-mains draw from all active outlets (L/min). */
  const totalActiveDrawLpm = (
    (activeOutlets.shower   ? showerFlowLpm : 0) +
    (activeOutlets.sink     ? SINK_FLOW_LPM  : 0) +
    (activeOutlets.bath     ? BATH_FLOW_LPM  : 0) +
    (activeOutlets.cold_tap ? COLD_TAP_LPM   : 0)
  );

  /** Remaining cold-mains headroom (%), after subtracting active draws. */
  const coldMainsRemainingPct = Math.max(0, (1 - totalActiveDrawLpm / maxMainsLpm) * 100);

  /** Hot-water kW demanded by each active hot outlet (physics: Cp × flow × ΔT). */
  const showerDhwKw   = computeRequiredKw(showerFlowLpm * hotFraction, dhwDeltaT);
  const sinkDhwKw     = computeRequiredKw(SINK_FLOW_LPM  * hotFraction, dhwDeltaT);
  const bathDhwKw     = computeRequiredKw(BATH_FLOW_LPM  * hotFraction, dhwDeltaT);

  /** Total instantaneous DHW demand kW from active hot outlets. */
  const totalDhwDrawKw = (
    (activeOutlets.shower ? showerDhwKw : 0) +
    (activeOutlets.sink   ? sinkDhwKw   : 0) +
    (activeOutlets.bath   ? bathDhwKw   : 0)
  );

  /** Combi system load % (clamped to 0–100). */
  const systemLoadPct = Math.min(100, totalDhwDrawKw / NOMINAL_COMBI_DHW_KW * 100);

  // Cylinder SoC at the first peak-demand hour from the day painter (or hour 7 as fallback).
  const peakDemandH   = hours.findIndex(s => s === 'dhw_demand');
  const cylinderRefH  = peakDemandH >= 0
    ? Math.min(peakDemandH, lifestyle.hourlyData.length - 1)
    : Math.min(7, lifestyle.hourlyData.length - 1);
  const cylinderSoCPct = lifestyle.hourlyData[cylinderRefH].cylinderVolumeL / CYLINDER_VOLUME_L * 100;

  // ── Stored system draw-off derived values ──────────────────────────────────
  // For stored (vented, unvented) and ASHP systems, simultaneous demand is
  // handled without the throughput constraint of a combi heat exchanger.
  // The constraint instead is cylinder volume (SoC depletion rate).

  /** Total hot-water draw from the cylinder when outlets are active (L/min). */
  const totalHotDrawLpm = (
    (activeOutlets.shower ? showerFlowLpm : 0) +
    (activeOutlets.sink   ? SINK_FLOW_LPM  : 0) +
    (activeOutlets.bath   ? BATH_FLOW_LPM  : 0)
  );
  const activeOutletKeys = (Object.keys(activeOutlets) as OutletKey[]).filter(key => activeOutlets[key]);
  const activeHotOutletCount = ['shower', 'sink', 'bath']
    .filter(key => activeOutlets[key as OutletKey])
    .length;
  const combiFlowShareFactor = totalHotDrawLpm > 0 ? Math.min(1, heatLimitLpm / totalHotDrawLpm) : 1;
  const flowMultiplier = selectedSystem === 'combi' ? combiFlowShareFactor : 1;
  const outletRequestedFlowLpm: Record<OutletKey, number> = {
    shower: showerFlowLpm,
    sink: SINK_FLOW_LPM,
    bath: BATH_FLOW_LPM,
    cold_tap: COLD_TAP_LPM,
  };
  const outletDeliveredFlowLpm: Record<OutletKey, number> = {
    shower: activeOutlets.shower ? parseFloat((showerFlowLpm * flowMultiplier).toFixed(1)) : 0,
    sink: activeOutlets.sink ? parseFloat((SINK_FLOW_LPM * flowMultiplier).toFixed(1)) : 0,
    bath: activeOutlets.bath ? parseFloat((BATH_FLOW_LPM * flowMultiplier).toFixed(1)) : 0,
    cold_tap: activeOutlets.cold_tap ? COLD_TAP_LPM : 0,
  };
  const outletHotTempC = selectedSystem === 'combi'
    ? parseFloat((combiHotOutTempC * combiFlowShareFactor + coldWaterTempC * (1 - combiFlowShareFactor)).toFixed(1))
    : combiHotOutTempC;

  /**
   * Available cylinder volume at the current reference hour (L).
   * Used to compute how long the cylinder can sustain the active simultaneous draw.
   */
  const currentCylinderVolumeL = lifestyle.hourlyData[cylinderRefH].cylinderVolumeL;

  /**
   * Estimated minutes before the cylinder is exhausted at the current draw rate.
   * Only meaningful when totalHotDrawLpm > 0 and cylinder is not already empty.
   * Null when no draw is active.
   */
  const cylinderMinutesRemaining: number | null = totalHotDrawLpm > 0
    ? parseFloat((currentCylinderVolumeL / totalHotDrawLpm).toFixed(0))
    : null;

  const previousActiveOutletsRef = useRef(activeOutlets);
  const narrationInitialisedRef = useRef(false);
  const narrationToastIdRef = useRef(0);

  useEffect(() => {
    if (!narrationInitialisedRef.current) {
      narrationInitialisedRef.current = true;
      previousActiveOutletsRef.current = activeOutlets;
      return;
    }
    const previouslyActive = previousActiveOutletsRef.current;
    const newlyActive = (Object.keys(activeOutlets) as OutletKey[]).find(
      key => activeOutlets[key] && !previouslyActive[key],
    );
    if (!newlyActive) {
      previousActiveOutletsRef.current = activeOutlets;
      return;
    }

    const narrationMessage = (() => {
      if (totalActiveDrawLpm > maxMainsLpm) return NARRATION_MESSAGES.mainsLimiting;
      if (newlyActive === 'shower' && selectedSystem === 'combi') return NARRATION_MESSAGES.showerPriority;
      if (selectedSystem === 'combi' && activeHotOutletCount >= 2) {
        return `${OUTLET_LABELS[newlyActive]} opened · ${NARRATION_MESSAGES.sharedDemand}`;
      }
      if (selectedSystem !== 'combi' && activeHotOutletCount >= 2) return NARRATION_MESSAGES.cylinderSupplyingTwo;
      if (selectedSystem === 'ashp' && activeHotOutletCount > 0) return NARRATION_MESSAGES.ashpRecovering;
      return `${OUTLET_LABELS[newlyActive]} opened`;
    })();

    narrationToastIdRef.current += 1;
    setNarrationToasts(prev => [{ id: narrationToastIdRef.current, message: narrationMessage }, ...prev].slice(0, 3));
    previousActiveOutletsRef.current = activeOutlets;
  }, [activeHotOutletCount, activeOutlets, maxMainsLpm, selectedSystem, totalActiveDrawLpm]);

  /**
   * Maximum hot-water supply rate for a given system type.
   *   combi        → on-demand (no stored limit)
   *   stored_vented → gravity-limited (VENTED_MAX_GRAVITY_FLOW_LPM)
   *   stored_unvented / ashp → mains-pressure cylinder (maxMainsLpm)
   */
  function storedMaxFlowLpmFor(system: DayPainterSystem): number {
    return system === 'stored_vented' ? VENTED_MAX_GRAVITY_FLOW_LPM : maxMainsLpm;
  }

  // ── Per-system draw-off gauge section renderer ─────────────────────────────
  /**
   * Renders the 6-pane weir gauge grid + system-specific banners for the given
   * system type.  Closes over all shared outlet state so it can be called for
   * both System A (selectedSystem) and System B (systemB) in compare mode.
   */
  function renderDrawOffGaugeSection(system: DayPainterSystem) {
    const isCombi = system === 'combi';
    const sysMaxFlowLpm = storedMaxFlowLpmFor(system);
    function sysOutletFlowPct(outletLpm: number): number {
      return Math.min(100, (outletLpm / sysMaxFlowLpm) * 100);
    }

    return (
      <>
        {/* Responsive wrapper — scroll horizontally on narrow viewports */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 2fr',
            gap: 8,
            alignItems: 'end',
            minWidth: 340, // min needed to keep all 6 panes legible on narrow screens
          }}>

            {/* ── Pane 1: Cold Main Supply ─── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <WeirGauge
                level={coldMainsRemainingPct}
                label="Cold Main"
                emoji="🔵"
                fillColor="#bee3f8"
                borderColor="#3182ce"
              />
              <div style={{ fontSize: '0.55rem', color: '#718096', textAlign: 'center', lineHeight: '1.3' }}>
                {(engineInput.dynamicMainsPressure ?? DEFAULT_MAINS_PRESSURE_BAR)} bar
                {' · '}{maxMainsLpm.toFixed(0)} L/min max
                {totalActiveDrawLpm > 0 && (
                  <span style={{ color: '#c53030', display: 'block' }}>
                    −{totalActiveDrawLpm.toFixed(0)} L/min drawn
                  </span>
                )}
              </div>
            </div>

            {/* ── Pane 2: Shower ── */}
            <WeirGauge
              level={activeOutlets.shower
                ? (isCombi
                    ? showerDhwKw / NOMINAL_COMBI_DHW_KW * 100
                    : sysOutletFlowPct(showerFlowLpm))
                : 0}
              label="Shower"
              emoji="🚿"
              fillColor={isCombi ? '#fc8181' : '#fbb6ce'}
              borderColor={isCombi ? '#e53e3e' : '#d53f8c'}
              active={activeOutlets.shower}
              onClick={() => toggleOutlet('shower')}
              sublabel={`${showerFlowLpm} L/min`}
            />

            {/* ── Pane 3: Sink ── */}
            <WeirGauge
              level={activeOutlets.sink
                ? (isCombi
                    ? sinkDhwKw / NOMINAL_COMBI_DHW_KW * 100
                    : sysOutletFlowPct(SINK_FLOW_LPM))
                : 0}
              label="Sink"
              emoji="🚰"
              fillColor={isCombi ? '#ed8936' : '#fbd38d'}
              borderColor={isCombi ? '#c05621' : '#d69e2e'}
              active={activeOutlets.sink}
              onClick={() => toggleOutlet('sink')}
              sublabel={`${SINK_FLOW_LPM} L/min`}
            />

            {/* ── Pane 4: Bath ── */}
            <WeirGauge
              level={activeOutlets.bath
                ? (isCombi
                    ? bathDhwKw / NOMINAL_COMBI_DHW_KW * 100
                    : sysOutletFlowPct(BATH_FLOW_LPM))
                : 0}
              label="Bath"
              emoji="🛁"
              fillColor={isCombi ? '#f6ad55' : '#fbd38d'}
              borderColor={isCombi ? '#dd6b20' : '#b7791f'}
              active={activeOutlets.bath}
              onClick={() => toggleOutlet('bath')}
              sublabel={`${BATH_FLOW_LPM} L/min`}
            />

            {/* ── Pane 5: Cold Tap (cold-mains only draw) ── */}
            <WeirGauge
              level={activeOutlets.cold_tap ? COLD_TAP_LPM / maxMainsLpm * 100 : 0}
              label="Cold Tap"
              emoji="🚱"
              fillColor="#90cdf4"
              borderColor="#2b6cb0"
              active={activeOutlets.cold_tap}
              onClick={() => toggleOutlet('cold_tap')}
              sublabel={`${COLD_TAP_LPM} L/min`}
            />

            {/* ── Pane 6: System status ── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {isCombi ? (
                <WeirGauge
                  level={systemLoadPct}
                  label="Combi Load"
                  emoji="🔥"
                  fillColor={systemLoadPct > 90 ? '#e53e3e' : systemLoadPct > 70 ? '#ed8936' : '#48bb78'}
                  borderColor={systemLoadPct > 90 ? '#c53030' : systemLoadPct > 70 ? '#c05621' : '#276749'}
                />
              ) : (
                <WeirGauge
                  level={cylinderSoCPct}
                  label="Cylinder"
                  emoji="🛢️"
                  fillColor="#bee3f8"
                  borderColor="#3182ce"
                />
              )}
              <div style={{ fontSize: '0.55rem', color: '#718096', textAlign: 'center', lineHeight: '1.3' }}>
                {isCombi
                  ? `${totalDhwDrawKw.toFixed(1)} kW of ${NOMINAL_COMBI_DHW_KW} kW`
                  : `${lifestyle.hourlyData[cylinderRefH].cylinderVolumeL.toFixed(0)} L of ${CYLINDER_VOLUME_L} L`
                }
              </div>
            </div>
          </div>
        </div>

        {/* ── System-specific draw-off behaviour banner ── */}
        {isCombi && systemLoadPct > 100 && (
          <div style={{
            marginTop: 8,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#fff5f5', border: '1px solid #fed7d7',
            borderRadius: 6, padding: '3px 10px',
            fontSize: '0.72rem', color: '#c53030',
          }}>
            ⚠️ Combined draw ({totalDhwDrawKw.toFixed(1)} kW) exceeds combi capacity
            ({NOMINAL_COMBI_DHW_KW} kW) — simultaneous demand
          </div>
        )}

        {!isCombi && totalHotDrawLpm > 0 && (
          <div style={{
            marginTop: 8,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#f0fff4', border: '1px solid #9ae6b4',
            borderRadius: 6, padding: '3px 10px',
            fontSize: '0.72rem', color: '#276749',
          }}>
            ✅ {system === 'stored_vented'
              ? `Tank-fed supply — gravity head (≤${VENTED_MAX_GRAVITY_FLOW_LPM} L/min) serves outlets independently`
              : system === 'ashp'
              ? `ASHP buffer cylinder — simultaneous demand handled; heat pump modulates to reheat`
              : `Mains-fed supply — stored cylinder serves all outlets simultaneously`}
            {cylinderMinutesRemaining !== null && ` · ~${cylinderMinutesRemaining} min cylinder reserve at ${totalHotDrawLpm.toFixed(0)} L/min draw`}
          </div>
        )}

        {!isCombi && totalHotDrawLpm === 0 && (
          <div style={{
            marginTop: 6,
            fontSize: '0.68rem', color: '#718096', fontStyle: 'italic',
          }}>
            {system === 'stored_vented'
              ? `🪣 Tank-fed (open vented) hot water — gravity head drives all outlets. Outlet gauges show % of ${VENTED_MAX_GRAVITY_FLOW_LPM} L/min gravity capacity.`
              : system === 'ashp'
              ? `🌿 ASHP with buffer cylinder — simultaneous demand handled without throughput penalty. Outlet gauges show % of ${maxMainsLpm.toFixed(0)} L/min mains supply.`
              : `💧 Stored unvented — mains pressure cylinder. Outlet gauges show % of ${maxMainsLpm.toFixed(0)} L/min mains supply.`}
          </div>
        )}
      </>
    );
  }

  const scenarioLabel = conditionScenario === 'as_found' ? 'As found' : 'After flush + filter';
  const currentHour = hours.findIndex(state => state === 'dhw_demand');
  const timelineAnchorHour = currentHour >= 0 ? currentHour : 7;
  const currentHourLabel = `${String(timelineAnchorHour).padStart(2, '0')}:00`;
  const heatSourceMode = activeHotOutletCount > 0
    ? selectedSystem === 'ashp'
      ? 'recovering'
      : 'DHW priority'
    : selectedSystem === 'ashp'
      ? 'idle'
      : 'heating active';
  const heatSourceEfficiencyLabel = selectedSystem === 'ashp'
    ? `COP ${hydraulicV1.effectiveCOP.toFixed(2)}`
    : combiEfficiencyCollapsed
      ? 'Condensing limited'
      : `SPF ${specEdge.spfMidpoint.toFixed(2)}`;
  const heatSourceOutputLabel = selectedSystem === 'ashp'
    ? `${hydraulicV1.effectiveCOP.toFixed(2)} COP`
    : `${totalDhwDrawKw.toFixed(1)} kW`;
  const sharedDemandActive = selectedSystem === 'combi' && activeHotOutletCount >= 2 && combiFlowShareFactor < 1;
  const selectedOutletFlowDelta = selectedOutlet && activeOutlets[selectedOutlet]
    ? parseFloat((outletDeliveredFlowLpm[selectedOutlet] - outletRequestedFlowLpm[selectedOutlet]).toFixed(1))
    : 0;
  const selectedOutletTempDelta = selectedOutlet && activeOutlets[selectedOutlet] && selectedOutlet !== 'cold_tap'
    ? parseFloat((outletHotTempC - combiHotOutTempC).toFixed(1))
    : 0;
  return (
    <div style={{
      height: `min(100vh, ${IPAD_MAX_VIEWPORT_HEIGHT_PX}px)`,
      display: 'grid',
      gridTemplateRows: 'auto 1fr auto',
      gap: 10,
      padding: 10,
      borderRadius: 16,
      border: '1px solid #dbe4f0',
      background: '#eef3f9',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 10,
        background: '#f8fbff',
        border: '1px solid #dbe4f0',
        borderRadius: 12,
        padding: '8px 10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ color: '#1e3a5f', letterSpacing: '0.02em' }}>Atlas</strong>
          <span style={{ color: '#475569', fontSize: '0.82rem' }}>Simulator</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <SystemNarrationToast messages={narrationToasts} />
        </div>
        <div style={{ color: '#475569', fontSize: '0.74rem', textAlign: 'right' }}>
          {scenarioLabel} · {currentHourLabel}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `${leftRailCollapsed ? `${COLLAPSED_RAIL_WIDTH_PX}px` : `${LEFT_RAIL_WIDTH_PX}px`} minmax(0, 1fr) ${rightRailCollapsed ? `${COLLAPSED_RAIL_WIDTH_PX}px` : `${RIGHT_RAIL_WIDTH_PX}px`}`,
        gap: 10,
        minHeight: 0,
      }}>
        <aside style={{
          borderRadius: 12,
          border: '1px solid #dbe4f0',
          background: '#ffffff',
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          minHeight: 0,
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setLeftRailCollapsed(v => !v)}
            aria-expanded={!leftRailCollapsed}
            aria-label={leftRailCollapsed ? 'Expand left status panel' : 'Collapse left status panel'}
            aria-pressed={!leftRailCollapsed}
            style={{
              border: 'none',
              borderBottom: leftRailCollapsed ? 'none' : '1px solid #e2e8f0',
              background: '#f8fbff',
              color: '#1e3a5f',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '10px 8px',
              cursor: 'pointer',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            {leftRailCollapsed ? 'Show status' : 'Hide status'}
          </button>
          {!leftRailCollapsed && (
            <div style={{ padding: 10, display: 'grid', gap: 10, overflowY: 'auto' }}>
              <div style={{ border: '1px solid #dbe4f0', borderRadius: 10, padding: 10, background: '#f8fbff' }}>
                <div style={{ color: '#64748b', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Heat source status</div>
                <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '0.94rem' }}>{SYSTEM_LABELS[selectedSystem]}</div>
                <div style={{ color: '#1d4ed8', fontSize: '0.78rem', marginTop: 2 }}>{heatSourceMode}</div>
                <div style={{ marginTop: 8, color: '#334155', fontSize: '0.76rem' }}>Output {heatSourceOutputLabel}</div>
                <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: '#dbeafe', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, systemLoadPct)}%`, height: '100%', background: '#0284c7' }} />
                </div>
              </div>
              <div style={{ border: '1px solid #dbe4f0', borderRadius: 10, padding: 10, background: '#ffffff' }}>
                <div style={{ color: '#64748b', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Live draw</div>
                <div style={{ color: '#0f172a', fontSize: '0.8rem', marginBottom: 4 }}>
                  Pipe share {totalActiveDrawLpm.toFixed(1)} / {maxMainsLpm.toFixed(1)} L/min
                </div>
                <div style={{ height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, totalActiveDrawLpm / maxMainsLpm * 100)}%`,
                    height: '100%',
                    background: sharedDemandActive ? '#f97316' : '#06b6d4',
                  }} />
                </div>
                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                  <LiveMetricChip label="Shower" value={outletDeliveredFlowLpm.shower} unit="L/min" peak={outletRequestedFlowLpm.shower} status={activeOutlets.shower ? 'normal' : 'inactive'} compact />
                  <LiveMetricChip label="Kitchen tap" value={outletDeliveredFlowLpm.sink} unit="L/min" peak={outletRequestedFlowLpm.sink} status={activeOutlets.sink ? 'normal' : 'inactive'} compact />
                </div>
              </div>
            </div>
          )}
        </aside>

        <div style={{
          position: 'relative',
          minHeight: 0,
          borderRadius: 14,
          border: '1px solid #2d3748',
          background: 'linear-gradient(180deg, #0f172a 0%, #111827 45%, #1f2937 100%)',
          overflow: 'hidden',
        }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.18, background: 'repeating-linear-gradient(90deg, #ffffff22, #ffffff22 1px, transparent 1px, transparent 40px)' }} />
        <div style={{ position: 'absolute', top: 12, left: 14 }}>
          <div style={{ color: '#e2e8f0', fontSize: '0.72rem' }}>Heat source status</div>
          <div style={{ color: '#fff', fontWeight: 700 }}>{SYSTEM_LABELS[selectedSystem]}</div>
          <div style={{ color: '#93c5fd', fontSize: '0.76rem' }}>{heatSourceMode}</div>
          <div style={{ marginTop: 6, width: 140, height: 30, borderRadius: 8, background: '#0b1220', border: '1px solid #334155', padding: 4 }}>
            <div style={{ height: 5, borderRadius: 999, background: '#1f2937', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, systemLoadPct)}%`, height: '100%', background: '#f97316' }} />
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '0.62rem', marginTop: 4 }}>Output {heatSourceOutputLabel}</div>
          </div>
        </div>

        <div style={{ position: 'absolute', top: 12, right: 14, textAlign: 'right' }}>
          <div style={{ color: '#e2e8f0', fontSize: '0.72rem' }}>Efficiency summary</div>
          <div style={{ color: '#fff', fontWeight: 700 }}>{heatSourceEfficiencyLabel}</div>
          <div style={{ color: '#86efac', fontSize: '0.72rem' }}>Return {engineInput.returnWaterTemp}°C · Flow {specEdge.designFlowTempC}°C</div>
          <div style={{ marginTop: 4, display: 'inline-flex', gap: 6 }}>
            <span style={{ padding: '2px 8px', borderRadius: 999, border: '1px solid #16a34a', color: '#bbf7d0', fontSize: '0.66rem' }}>
              {selectedSystem === 'ashp' ? 'Modulating' : combiEfficiencyCollapsed ? 'non-condensing window' : 'condensing window'}
            </span>
          </div>
        </div>

        <div style={{ position: 'absolute', top: 86, left: 14, color: '#cbd5e1', fontSize: '0.72rem' }}>
          Scenario {scenarioLabel} · Time {currentHourLabel}
        </div>

        <div style={{
          position: 'absolute',
          inset: '130px 60px 36px 60px',
          borderRadius: 10,
          border: '1px solid #334155',
          background: '#111827',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          padding: 12,
        }}>
          <div style={{ borderRadius: 8, border: '1px solid #334155', background: '#1f2937', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 8, left: 8, color: '#cbd5e1', fontSize: '0.68rem' }}>Bathroom</div>
            <div style={{ position: 'absolute', top: 44, left: 22 }}>
              <button onClick={() => toggleOutlet('shower')} style={{ border: 'none', background: 'transparent', color: activeOutlets.shower ? '#38bdf8' : '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>🚿</button>
            </div>
            <div style={{ position: 'absolute', bottom: 20, left: 22 }}>
              <button onClick={() => toggleOutlet('bath')} style={{ border: 'none', background: 'transparent', color: activeOutlets.bath ? '#fdba74' : '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>🛁</button>
            </div>
          </div>
          <div style={{ borderRadius: 8, border: '1px solid #334155', background: '#1f2937', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 8, left: 8, color: '#cbd5e1', fontSize: '0.68rem' }}>Kitchen / utility</div>
            <div style={{ position: 'absolute', top: 44, left: 22 }}>
              <button onClick={() => toggleOutlet('sink')} style={{ border: 'none', background: 'transparent', color: activeOutlets.sink ? '#fb7185' : '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>🚰</button>
            </div>
            <div style={{ position: 'absolute', bottom: 20, left: 22 }}>
              <button onClick={() => toggleOutlet('cold_tap')} style={{ border: 'none', background: 'transparent', color: activeOutlets.cold_tap ? '#7dd3fc' : '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>🚱</button>
            </div>
          </div>
          <div style={{ gridColumn: '1 / span 2', marginTop: 6 }}>
            <div style={{
              height: 7,
              borderRadius: 999,
              background: '#0b1220',
              border: '1px solid #334155',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min(100, totalActiveDrawLpm / maxMainsLpm * 100)}%`,
                height: '100%',
                background: sharedDemandActive ? '#f97316' : '#22d3ee',
                boxShadow: sharedDemandActive ? '0 0 10px #f97316' : '0 0 8px #22d3ee',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.66rem', marginTop: 4 }}>
              Pipe share {totalActiveDrawLpm.toFixed(1)} / {maxMainsLpm.toFixed(1)} L/min
            </div>
          </div>
        </div>

        {activeOutletKeys.map(key => (
          <div key={key} style={{
            position: 'absolute',
            top: key === 'shower' ? 182 : key === 'bath' ? 262 : key === 'sink' ? 182 : 262,
            left: key === 'shower' || key === 'bath' ? 96 : 296,
          }}>
            <LiveMetricChip
              label="Flow"
              value={outletDeliveredFlowLpm[key]}
              unit="L/min"
              peak={outletRequestedFlowLpm[key]}
              status={sharedDemandActive && key !== 'cold_tap' ? 'shared' : 'normal'}
              compact
            />
            {key !== 'cold_tap' && (
              <div style={{ marginTop: 6 }}>
                <LiveMetricChip
                  label="Temp"
                  value={outletHotTempC}
                  unit="°C"
                  peak={combiHotOutTempC}
                  status={sharedDemandActive ? 'warning' : 'normal'}
                  compact
                />
              </div>
            )}
          </div>
        ))}

        {sharedDemandActive && selectedOutlet !== null && (
          <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'grid', gap: 6 }}>
            <LiveMetricChip label="Δ flow" value={selectedOutletFlowDelta} unit="L/min" status="limiting" delta={`${selectedOutletFlowDelta} L/min`} compact />
            {selectedOutlet !== 'cold_tap' && (
              <LiveMetricChip label="Δ temp" value={selectedOutletTempDelta} unit="°C" status="warning" delta={`${selectedOutletTempDelta}°C`} compact />
            )}
          </div>
        )}
        </div>

        <aside style={{
          borderRadius: 12,
          border: '1px solid #dbe4f0',
          background: '#ffffff',
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          minHeight: 0,
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setRightRailCollapsed(v => !v)}
            aria-expanded={!rightRailCollapsed}
            aria-label={rightRailCollapsed ? 'Expand right menus panel' : 'Collapse right menus panel'}
            aria-pressed={!rightRailCollapsed}
            style={{
              border: 'none',
              borderBottom: rightRailCollapsed ? 'none' : '1px solid #e2e8f0',
              background: '#f8fbff',
              color: '#1e3a5f',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '10px 8px',
              cursor: 'pointer',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            {rightRailCollapsed ? 'Show menus' : 'Hide menus'}
          </button>
          {!rightRailCollapsed && (
            <div style={{ padding: 10, display: 'grid', gap: 10, overflowY: 'auto' }}>
              <div style={{ border: '1px solid #dbe4f0', borderRadius: 10, padding: 10, background: '#ffffff' }}>
                <div style={{ color: '#64748b', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Efficiency</div>
                <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '1rem' }}>{heatSourceEfficiencyLabel}</div>
                <div style={{ color: '#475569', fontSize: '0.76rem', marginTop: 4 }}>Return {engineInput.returnWaterTemp}°C · Flow {specEdge.designFlowTempC}°C</div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <ToggleButton label="System setup" active={setupDrawerOpen} onClick={() => setSetupDrawerOpen(open => !open)} activeColor="#2b6cb0" inactiveColor="#718096" />
                <ToggleButton label="Engineering" active={engineeringDrawerOpen} onClick={() => setEngineeringDrawerOpen(open => !open)} activeColor="#c53030" inactiveColor="#718096" />
                <ToggleButton label="Efficiency" active={efficiencyDrawerOpen} onClick={() => setEfficiencyDrawerOpen(open => !open)} activeColor="#276749" inactiveColor="#718096" />
                <ToggleButton label="Timeline" active={timelineSheetOpen} onClick={() => setTimelineSheetOpen(open => !open)} activeColor="#805ad5" inactiveColor="#718096" />
                <ToggleButton label="Alerts" active={alertsSheetOpen} onClick={() => setAlertsSheetOpen(open => !open)} activeColor="#c05621" inactiveColor="#718096" />
              </div>
              <div style={{ border: '1px solid #dbe4f0', borderRadius: 10, padding: 10, background: '#f8fbff', color: '#334155', fontSize: '0.76rem' }}>
                {selectedSystem === 'ashp'
                  ? 'Heat pump response recovers gradually after demand events.'
                  : 'Boiler response can pause space heating during peak hot-water events.'}
              </div>
            </div>
          )}
        </aside>
      </div>

      <section style={{
        background: '#ffffff',
        border: '1px solid #dbe4f0',
        borderRadius: 12,
        padding: '8px 10px',
        display: 'grid',
        gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: '0.78rem', color: '#475569' }}>
            Timeline · {activeDhwHours} DHW active hour(s)
          </div>
          <button
            onClick={() => setTimelineSheetOpen(true)}
            style={{ borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', padding: '4px 8px', fontSize: '0.72rem', cursor: 'pointer' }}
          >
            Expand timeline
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2 }}>
          {hours.map((state, h) => (
            <button
              key={h}
              onClick={() => toggleHour(h)}
              title={`${String(h).padStart(2, '0')}:00 – ${STATE_LABELS[state]}`}
              aria-label={`Hour ${h}: ${STATE_LABELS[state]}`}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                background: STATE_COLOURS[state],
                height: 18,
                padding: 0,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </section>

      <SystemSetupDrawer open={setupDrawerOpen} onClose={() => setSetupDrawerOpen(false)}>
        <h3 style={{ marginTop: 0 }}>System setup</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <div role="group" aria-label="View mode" style={{ display: 'flex', gap: 0, borderRadius: 20, overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
            {(['single', 'compare'] as const).map(mode => (
              <button key={mode} onClick={() => setCompareMode(mode === 'compare')} aria-pressed={compareMode === (mode === 'compare')} style={{ padding: '4px 14px', border: 'none', background: compareMode === (mode === 'compare') ? '#3182ce' : '#f7fafc', color: compareMode === (mode === 'compare') ? '#fff' : '#718096', fontSize: '0.75rem', fontWeight: compareMode === (mode === 'compare') ? 700 : 400, cursor: 'pointer' }}>
                {mode === 'single' ? 'Single' : 'Compare'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {(Object.keys(SYSTEM_LABELS) as DayPainterSystem[]).map(sys => (
              <button key={sys} onClick={() => setSelectedSystem(sys)} aria-pressed={selectedSystem === sys} style={{ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${selectedSystem === sys ? '#3182ce' : '#e2e8f0'}`, background: selectedSystem === sys ? '#ebf8ff' : '#f7fafc', color: selectedSystem === sys ? '#2b6cb0' : '#718096', fontSize: '0.78rem', fontWeight: selectedSystem === sys ? 700 : 400, cursor: 'pointer' }}>
                {SYSTEM_LABELS[sys]}
              </button>
            ))}
          </div>
          {compareMode && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {(Object.keys(SYSTEM_LABELS) as DayPainterSystem[]).map(sys => (
                <button key={sys} onClick={() => setSystemB(sys)} aria-pressed={systemB === sys} style={{ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${systemB === sys ? '#2b6cb0' : '#e2e8f0'}`, background: systemB === sys ? '#ebf8ff' : '#f7fafc', color: systemB === sys ? '#2b6cb0' : '#718096', fontSize: '0.78rem', fontWeight: systemB === sys ? 700 : 400, cursor: 'pointer' }}>
                  System B · {SYSTEM_LABELS[sys]}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <ToggleButton label={isFullJob ? '✅ Full Job (35°C)' : '⚠️ Fast Fit (50°C)'} active={isFullJob} onClick={() => setIsFullJob(p => !p)} activeColor="#276749" inactiveColor="#c05621" />
            <ToggleButton label="🧂 Softener" active={hasSoftener} onClick={() => setHasSoftener(p => !p)} activeColor="#3182ce" inactiveColor="#718096" />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(['as_found', 'after_flush'] as ConditionScenario[]).map(s => (
              <button key={s} onClick={() => setConditionScenario(s)} aria-pressed={conditionScenario === s} style={{ padding: '4px 12px', borderRadius: 16, border: `1.5px solid ${conditionScenario === s ? '#c05621' : '#e2e8f0'}`, background: conditionScenario === s ? '#fffaf0' : '#f7fafc', color: conditionScenario === s ? '#c05621' : '#718096', fontSize: '0.75rem', fontWeight: conditionScenario === s ? 700 : 400, cursor: 'pointer' }}>
                {s === 'as_found' ? 'As found' : 'After flush + filter'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {(Object.keys(COLD_SUPPLY_TEMP_PRESETS) as SeasonPreset[]).map(s => (
              <button key={s} onClick={() => setSeason(s)} aria-pressed={season === s} style={{ padding: '3px 10px', borderRadius: 14, border: `1.5px solid ${season === s ? '#3182ce' : '#e2e8f0'}`, background: season === s ? '#ebf8ff' : '#f7fafc', color: season === s ? '#2b6cb0' : '#718096', fontSize: '0.72rem', fontWeight: season === s ? 700 : 400, cursor: 'pointer' }}>
                {titleCase(s)} ({COLD_SUPPLY_TEMP_PRESETS[s]}°C)
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {(Object.keys(COMBI_HOT_OUT_PRESETS) as DhwModePreset[]).map(m => (
              <button key={m} onClick={() => setDhwMode(m)} aria-pressed={dhwMode === m} style={{ padding: '3px 10px', borderRadius: 14, border: `1.5px solid ${dhwMode === m ? '#805ad5' : '#e2e8f0'}`, background: dhwMode === m ? '#faf5ff' : '#f7fafc', color: dhwMode === m ? '#6b46c1' : '#718096', fontSize: '0.72rem', fontWeight: dhwMode === m ? 700 : 400, cursor: 'pointer' }}>
                {titleCase(m)} ({COMBI_HOT_OUT_PRESETS[m]}°C)
              </button>
            ))}
          </div>
        </div>
      </SystemSetupDrawer>

      <EfficiencyDrawer open={efficiencyDrawerOpen} onClose={() => setEfficiencyDrawerOpen(false)}>
        <h3 style={{ marginTop: 0 }}>Efficiency & outcomes</h3>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: 12 }}>
          <StatBadge label="SPF" value={specEdge.spfMidpoint.toFixed(2)} color={specEdge.spfMidpoint >= 3.8 ? '#276749' : '#c05621'} bg={specEdge.spfMidpoint >= 3.8 ? '#f0fff4' : '#fffaf0'} />
          <StatBadge label="Flow Temp" value={`${specEdge.designFlowTempC}°C`} color={specEdge.designFlowTempC <= 40 ? '#276749' : '#c05621'} bg={specEdge.designFlowTempC <= 40 ? '#f0fff4' : '#fffaf0'} />
          <StatBadge label="At Home" value={`${homeCount}h`} color="#276749" bg="#f0fff4" />
          <StatBadge label="High DHW" value={`${dhwCount}h`} color="#c53030" bg="#fff5f5" />
          <StatBadge label="Away" value={`${awayCount}h`} color="#2c5282" bg="#ebf8ff" />
          <StatBadge label="DHW draw today" value={`${dhwDrawKwhToday} kWh`} color={dhwCount > 0 ? '#c53030' : '#276749'} bg={dhwCount > 0 ? '#fff5f5' : '#f0fff4'} />
          {combiEfficiencyCollapsed && <StatBadge label="Combi Efficiency" value="<30% ⚠️" color="#c53030" bg="#fff5f5" />}
          {hasSoftener && specEdge.dhwScalingTaxPct === 0 && <StatBadge label="DHW Scale Tax" value="0% ✅" color="#276749" bg="#f0fff4" />}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <DebugFactor label="Return temp" value={`${engineInput.returnWaterTemp}°C`} />
          <DebugFactor label="Flow temp required" value={`${specEdge.designFlowTempC}°C`} warn={specEdge.designFlowTempC > 45} />
          <DebugFactor label="Effective COP" value={hydraulicV1.effectiveCOP.toFixed(2)} warn={hydraulicV1.velocityPenalty > 0} />
        </div>
      </EfficiencyDrawer>

      <EngineeringDrawer open={engineeringDrawerOpen} onClose={() => setEngineeringDrawerOpen(false)}>
        <h3 style={{ marginTop: 0 }}>Engineering detail & diagnostics</h3>
        <div style={{ marginBottom: 14 }}>
          {compareMode ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ border: '1.5px solid #fed7d7', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#c53030', marginBottom: 6 }}>{SYSTEM_LABELS[selectedSystem]}</div>
                {renderDrawOffGaugeSection(selectedSystem)}
              </div>
              <div style={{ border: '1.5px solid #bee3f8', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2b6cb0', marginBottom: 6 }}>{SYSTEM_LABELS[systemB]}</div>
                {renderDrawOffGaugeSection(systemB)}
              </div>
            </div>
          ) : (
            renderDrawOffGaugeSection(selectedSystem)
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '6px', marginBottom: 12 }}>
          <DebugFactor label="Flow derate" value={`${(sludge.flowDeratePct * 100).toFixed(1)}%`} warn={sludge.flowDeratePct > 0} />
          <DebugFactor label="Cycling loss" value={`${(sludge.cyclingLossPct * 100).toFixed(1)}%`} warn={sludge.cyclingLossPct > 0} />
          <DebugFactor label="DHW capacity derate" value={`${(sludge.dhwCapacityDeratePct * 100).toFixed(1)}%`} warn={sludge.dhwCapacityDeratePct > 0} />
          <DebugFactor label="Velocity after derate" value={`${hydraulicV1.ashp.velocityMs.toFixed(2)} m/s`} warn={hydraulicV1.velocityPenalty > 0} />
          <DebugFactor label="Minutes below 21°C" value={`${minutesBelowSetpoint} min`} warn={minutesBelowSetpoint > 0} />
          {totalCyclingPenaltyKwh > 0 && <DebugFactor label="Cycling fuel waste" value={`${totalCyclingPenaltyKwh} kWh`} warn />}
        </div>
        <div style={{ height: 160, marginBottom: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={comfortChartData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} ticks={['00:00', '06:00', '12:00', '18:00', '23:00']} />
              <YAxis yAxisId="temp" domain={[14, 26]} tick={{ fontSize: 9 }} label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 10 }} />
              <YAxis yAxisId="penalty" orientation="right" domain={[0, 0.5]} tick={{ fontSize: 9 }} label={{ value: 'kW', angle: 90, position: 'insideRight', fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: '0.78rem', borderRadius: 8 }} formatter={(value: number | undefined, name: string | undefined) => [value !== undefined ? value.toFixed(2) : '', name ?? '']} />
              <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: 6 }} />
              <ReferenceLine yAxisId="temp" y={COMFORT_SETPOINT_C} stroke="#48bb78" strokeDasharray="4 3" label={{ value: '21°C', fontSize: 9, fill: '#276749' }} />
              <Line yAxisId="temp" type="monotone" dataKey="Room Temp (°C)" stroke="#ed8936" strokeWidth={2} dot={false} />
              {totalCyclingPenaltyKwh > 0 && <Area yAxisId="penalty" type="stepAfter" dataKey="Cycling Penalty (kW)" fill="#fed7d7" stroke="#e53e3e" strokeWidth={1} fillOpacity={0.4} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {selectedSystem !== 'combi' && (
          <div style={{ height: 170, marginBottom: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={storedCylinderData} margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} ticks={['00:00', '06:00', '12:00', '18:00', '23:00']} />
                <YAxis yAxisId="temp" domain={[38, 62]} tick={{ fontSize: 9 }} label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <YAxis yAxisId="vol" orientation="right" domain={[0, CYLINDER_VOLUME_L]} tick={{ fontSize: 9 }} label={{ value: 'L', angle: 90, position: 'insideRight', fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: '0.78rem', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: 6 }} />
                <Line yAxisId="temp" type="monotone" dataKey="Cylinder Temp (°C)" stroke="#c05621" strokeWidth={2} dot={false} />
                <Area yAxisId="vol" type="monotone" dataKey="Volume Available (L)" fill="#bee3f8" stroke="#3182ce" strokeWidth={1.5} fillOpacity={0.35} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        {selectedSystem === 'combi' && (
          <div style={{ height: 160, marginBottom: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dhwDeliverabilityData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} ticks={['00:00', '06:00', '12:00', '18:00', '23:00']} />
                <YAxis domain={[0, Math.ceil(Math.max(showerFlowLpm, heatLimitLpm, anyWaterCold ? COLD_TAP_LPM : 0) * 1.2)]} tick={{ fontSize: 9 }} label={{ value: 'L/min', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: '0.78rem', borderRadius: 8 }} formatter={(value: number | undefined, name: string | undefined) => [value !== undefined ? `${value.toFixed(1)} L/min` : '', name ?? '']} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: 6 }} />
                <ReferenceLine y={heatLimitLpm} stroke="#e53e3e" strokeDasharray="5 3" label={{ value: `Heat limit ${heatLimitLpm.toFixed(1)} L/min`, fontSize: 9, fill: '#c53030', position: 'insideTopRight' }} />
                <Area type="stepAfter" dataKey="Requested (L/min)" fill="#bee3f8" stroke="#3182ce" strokeWidth={1.5} fillOpacity={0.3} />
                {anyWaterCold && <Area type="stepAfter" dataKey="Cold draw (L/min)" fill="#c6f6d5" stroke="#48bb78" strokeWidth={1} fillOpacity={0.25} strokeDasharray="3 2" />}
                <Line type="stepAfter" dataKey="Delivered (L/min)" stroke="#38a169" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        {lifestyle.notes.length > 0 && (
          <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', color: '#4a5568' }}>
            {lifestyle.notes[0]}
          </div>
        )}
      </EngineeringDrawer>

      <TimelineBottomSheet open={timelineSheetOpen} onClose={() => setTimelineSheetOpen(false)}>
        <div style={{ fontSize: '0.8rem', color: '#4a5568', marginBottom: 8 }}>
          Click hour blocks to cycle <strong style={{ color: '#276749' }}>At Home</strong> → <strong style={{ color: '#c53030' }}>High DHW</strong> → <strong style={{ color: '#2c5282' }}>Away</strong>.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2, marginBottom: 10 }} aria-label="24-hour day painter">
          {hours.map((state, h) => (
            <button key={h} onClick={() => toggleHour(h)} title={`${String(h).padStart(2, '0')}:00 – ${STATE_LABELS[state]}`} aria-label={`Hour ${h}: ${STATE_LABELS[state]}`} aria-pressed={state !== 'away'} style={{ height: 30, border: '1px solid #e2e8f0', borderRadius: 4, background: STATE_COLOURS[state], cursor: 'pointer', fontSize: '0.55rem', color: state === 'away' ? '#718096' : '#2d3748', padding: 0, lineHeight: '30px', fontWeight: state !== 'away' ? 700 : 400 }}>
              {h}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: 10 }}>
          {STATE_CYCLE.map(s => (
            <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#4a5568' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: STATE_COLOURS[s], border: '1px solid #a0aec0', display: 'inline-block' }} />
              {STATE_LABELS[s]}
            </span>
          ))}
        </div>
        <div style={{ height: 160, marginBottom: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={demandChartData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} ticks={['00:00', '06:00', '12:00', '18:00', '23:00']} />
              <YAxis domain={[0, Math.ceil(heatLossKw * DEMAND_Y_AXIS_SCALE_FACTOR)]} tick={{ fontSize: 9 }} label={{ value: 'kW', angle: -90, position: 'insideLeft', fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: '0.78rem', borderRadius: 8 }} formatter={(value: number | undefined, name: string | undefined) => [value !== undefined ? `${value.toFixed(2)} kW` : '', name ?? '']} />
              <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: 6 }} />
              <Area type="monotone" dataKey="Heat (kW)" fill="#fed7aa" stroke="#ed8936" strokeWidth={2} fillOpacity={0.5} />
              <Area type="monotone" dataKey="DHW (kW)" fill="#bee3f8" stroke="#3182ce" strokeWidth={2} fillOpacity={0.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} ticks={['00:00', '06:00', '12:00', '18:00', '23:00']} />
              <YAxis yAxisId="temp" domain={[14, 23]} tick={{ fontSize: 9 }} label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 10 }} />
              <YAxis yAxisId="reserve" orientation="right" domain={[0, 100]} tick={{ fontSize: 9 }} label={{ value: 'Reserve %', angle: 90, position: 'insideRight', fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: '0.78rem', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: 6 }} />
              <ReferenceLine yAxisId="temp" y={COMFORT_SETPOINT_C} stroke="#48bb78" strokeDasharray="4 3" label={{ value: '21°C', fontSize: 9, fill: '#276749' }} />
              {showBoiler && <Line yAxisId="temp" type="monotone" dataKey="Boiler Room (°C)" stroke="#ed8936" strokeWidth={2.5} dot={false} />}
              {showHp && <Line yAxisId="temp" type="monotone" dataKey="HP Room (°C)" stroke="#48bb78" strokeWidth={2.5} dot={false} />}
              {showHwReserve && <Area yAxisId="reserve" type="monotone" dataKey="Hot water reserve (%)" fill="#bee3f8" stroke="#3182ce" strokeWidth={1.5} fillOpacity={0.35} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </TimelineBottomSheet>

      <AlertsTopSheet open={alertsSheetOpen} onClose={() => setAlertsSheetOpen(false)}>
        <h3 style={{ marginTop: 0 }}>System limiters & alerts</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <DebugFactor label="Mains draw" value={`${totalActiveDrawLpm.toFixed(1)} / ${maxMainsLpm.toFixed(1)} L/min`} warn={totalActiveDrawLpm > maxMainsLpm} />
          <DebugFactor label="Combi load" value={`${systemLoadPct.toFixed(0)}%`} warn={systemLoadPct > 90} />
          <DebugFactor label="Cylinder reserve" value={`${cylinderSoCPct.toFixed(0)}%`} warn={cylinderSoCPct < 30} />
          <DebugFactor label="Peak delivered shower" value={`${peakDeliveredLpm} L/min`} warn={peakDeliveredLpm < showerFlowLpm} />
          <DebugFactor label="DHW scale derate" value={`${(sludge.dhwCapacityDeratePct * 100).toFixed(1)}%`} warn={sludge.dhwCapacityDeratePct > 0} />
        </div>
      </AlertsTopSheet>

      <OutletDetailPopover
        open={selectedOutlet !== null}
        onClose={() => setSelectedOutlet(null)}
        title={selectedOutlet ? `${OUTLET_LABELS[selectedOutlet]} detail` : 'Outlet detail'}
      >
        {selectedOutlet && (
          <div style={{ display: 'grid', gap: 8 }}>
            <LiveMetricChip label="Flow" value={outletDeliveredFlowLpm[selectedOutlet]} unit="L/min" peak={outletRequestedFlowLpm[selectedOutlet]} status={activeOutlets[selectedOutlet] ? 'normal' : 'inactive'} />
            {selectedOutlet !== 'cold_tap' && (
              <LiveMetricChip label="Temp" value={outletHotTempC} unit="°C" peak={combiHotOutTempC} status={sharedDemandActive ? 'shared' : 'normal'} />
            )}
            {selectedOutlet !== 'cold_tap' && activeHotOutletCount > 1 && (
              <>
                <LiveMetricChip label="Δ flow" value={selectedOutletFlowDelta} unit="L/min" status="limiting" delta={`${selectedOutletFlowDelta} L/min`} />
                <LiveMetricChip label="Δ temp" value={selectedOutletTempDelta} unit="°C" status="warning" delta={`${selectedOutletTempDelta}°C`} />
              </>
            )}
          </div>
        )}
      </OutletDetailPopover>
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

type LiveMetricStatus = 'normal' | 'shared' | 'warning' | 'limiting' | 'inactive';

function LiveMetricChip({
  label,
  value,
  unit,
  peak,
  status = 'normal',
  delta,
  compact,
}: {
  label: string;
  value: string | number;
  unit?: string;
  peak?: string | number;
  status?: LiveMetricStatus;
  delta?: string;
  compact?: boolean;
}) {
  const [flash, setFlash] = useState(false);
  const previousValueRef = useRef(value);

  useEffect(() => {
    const previous = previousValueRef.current;
    const next = value;
    const bothNumeric = typeof previous === 'number' && typeof next === 'number';
    const shouldFlash = bothNumeric
      ? Math.abs(next - previous) >= LIVE_METRIC_FLASH_THRESHOLD
      : previous !== next;

    if (shouldFlash) {
      previousValueRef.current = value;
      setFlash(true);
      const timeout = window.setTimeout(() => setFlash(false), 300);
      return () => window.clearTimeout(timeout);
    }
    previousValueRef.current = value;
    return undefined;
  }, [value]);

  const statusColor: Record<LiveMetricStatus, string> = {
    normal: '#38bdf8',
    shared: '#f59e0b',
    warning: '#fb7185',
    limiting: '#f97316',
    inactive: '#64748b',
  };

  return (
    <div style={{
      minWidth: compact ? 98 : 120,
      background: '#0b1220',
      borderRadius: 10,
      border: `1px solid ${statusColor[status]}66`,
      color: '#e2e8f0',
      padding: compact ? '6px 8px' : '8px 10px',
      boxShadow: flash ? `0 0 12px ${statusColor[status]}55` : 'none',
      transform: flash ? 'scale(1.02)' : 'scale(1)',
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
    }}>
      <div style={{ fontSize: compact ? '0.58rem' : '0.62rem', color: '#94a3b8' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <div style={{ fontSize: compact ? '1rem' : '1.2rem', fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
        {unit && <div style={{ fontSize: '0.64rem', color: '#cbd5e1' }}>{unit}</div>}
      </div>
      {(peak !== undefined || delta) && (
        <div style={{ marginTop: 3, fontSize: '0.58rem', color: '#94a3b8' }}>
          {peak !== undefined ? `Peak ${peak}` : ''}
          {delta ? `${peak !== undefined ? ' · ' : ''}${delta}` : ''}
        </div>
      )}
    </div>
  );
}

function SystemNarrationToast({ messages }: { messages: NarrationToastItem[] }) {
  if (messages.length === 0) {
    return (
      <div style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', padding: '8px 10px', fontSize: '0.75rem' }}>
        Waiting for live system events…
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {messages.map((item, index) => (
        <div key={item.id} style={{ borderRadius: 10, border: '1px solid #bae6fd', background: index === 0 ? '#e0f2fe' : '#f0f9ff', color: '#0c4a6e', padding: '8px 10px', fontSize: '0.76rem' }}>
          {item.message}
        </div>
      ))}
    </div>
  );
}

function DrawerFrame({
  open,
  onClose,
  side,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: Z_INDEX_DRAWER, pointerEvents: 'none' }}>
      <button
        aria-label={`Close ${title}`}
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
        tabIndex={0}
        style={{ position: 'absolute', inset: 0, border: 'none', background: '#0f172a88', pointerEvents: 'auto', cursor: 'pointer' }}
      />
      <aside style={{ position: 'absolute', top: 0, bottom: 0, ...(side === 'left' ? { left: 0 } : { right: 0 }), width: 'min(520px, 90vw)', background: '#ffffff', borderLeft: side === 'right' ? '1px solid #e2e8f0' : undefined, borderRight: side === 'left' ? '1px solid #e2e8f0' : undefined, boxShadow: '0 0 24px rgba(15,23,42,0.2)', padding: 14, overflowY: 'auto', pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong>{title}</strong>
          <button onClick={onClose} style={{ borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>Close</button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function BottomSheetFrame({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: Z_INDEX_TIMELINE_BOTTOM_SHEET, pointerEvents: 'none' }}>
      <button
        aria-label={`Close ${title}`}
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
        tabIndex={0}
        style={{ position: 'absolute', inset: 0, border: 'none', background: '#0f172a88', pointerEvents: 'auto', cursor: 'pointer' }}
      />
      <section style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '72vh', background: '#ffffff', borderTop: '1px solid #e2e8f0', boxShadow: '0 -8px 20px rgba(15,23,42,0.18)', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 14, overflowY: 'auto', pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong>{title}</strong>
          <button onClick={onClose} style={{ borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>Close</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function TopSheetFrame({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: Z_INDEX_ALERTS_TOP_SHEET, pointerEvents: 'none' }}>
      <button
        aria-label={`Close ${title}`}
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
        tabIndex={0}
        style={{ position: 'absolute', inset: 0, border: 'none', background: '#0f172a88', pointerEvents: 'auto', cursor: 'pointer' }}
      />
      <section style={{ position: 'absolute', left: 0, right: 0, top: 0, maxHeight: '55vh', background: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 8px 20px rgba(15,23,42,0.18)', padding: 14, overflowY: 'auto', pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong>{title}</strong>
          <button onClick={onClose} style={{ borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>Close</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function PopoverFrame({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: Z_INDEX_OUTLET_POPOVER, pointerEvents: 'none' }}>
      <button
        aria-label={`Close ${title}`}
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
        tabIndex={0}
        style={{ position: 'absolute', inset: 0, border: 'none', background: 'transparent', pointerEvents: 'auto' }}
      />
      <section style={{ position: 'absolute', right: 24, top: 120, width: 'min(320px, 90vw)', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 12px 28px rgba(15,23,42,0.22)', padding: 12, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong style={{ fontSize: '0.86rem' }}>{title}</strong>
          <button onClick={onClose} style={{ borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>Close</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function SystemSetupDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return <DrawerFrame open={open} onClose={onClose} side="left" title="System setup">{children}</DrawerFrame>;
}

function EngineeringDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return <DrawerFrame open={open} onClose={onClose} side="right" title="Engineering">{children}</DrawerFrame>;
}

function EfficiencyDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return <DrawerFrame open={open} onClose={onClose} side="right" title="Efficiency">{children}</DrawerFrame>;
}

function TimelineBottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return <BottomSheetFrame open={open} onClose={onClose} title="Timeline & playback">{children}</BottomSheetFrame>;
}

function AlertsTopSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return <TopSheetFrame open={open} onClose={onClose} title="System alerts">{children}</TopSheetFrame>;
}

function OutletDetailPopover({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return <PopoverFrame open={open} onClose={onClose} title={title}>{children}</PopoverFrame>;
}

// ─── WeirGauge ────────────────────────────────────────────────────────────────

/**
 * A vertical weir-gauge style water-level indicator.
 *
 * Shows a rectangular standpipe with a water fill that rises proportionally to
 * `level` (0–100 %).  Horizontal tick marks at 25 %, 50 %, and 75 % mimic the
 * notch/staff-gauge markings on a physical weir plate.
 *
 * When `onClick` is provided the gauge acts as a toggle button (role="button")
 * with visual opacity feedback for the inactive state.
 */
function WeirGauge({
  level,
  label,
  emoji,
  fillColor,
  borderColor,
  active,
  onClick,
  sublabel,
}: {
  level: number;
  label: string;
  emoji: string;
  fillColor: string;
  borderColor: string;
  active?: boolean;
  onClick?: () => void;
  sublabel?: string;
}) {
  const clamped = Math.min(100, Math.max(0, level));
  const isClickable = onClick !== undefined;
  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      aria-pressed={isClickable ? active : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        cursor: isClickable ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: '1rem', lineHeight: '1.2' }}>{emoji}</div>

      {/* ── Gauge body ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 90,
          border: `2px solid ${active === false ? '#cbd5e0' : borderColor}`,
          borderRadius: 4,
          background: '#f7fafc',
          overflow: 'hidden',
          opacity: active === false ? 0.45 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {/* Water fill — animates height */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${clamped}%`,
            background: fillColor,
            transition: 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />

        {/* Weir staff-gauge tick marks at 25 %, 50 %, 75 % */}
        {[25, 50, 75].map(mark => (
          <div
            key={mark}
            style={{
              position: 'absolute',
              bottom: `${mark}%`,
              left: 0,
              right: 0,
              height: 1,
              background: 'rgba(0,0,0,0.15)',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Weir notch at top — two side walls with a central gap */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 5,
            display: 'flex',
            pointerEvents: 'none',
          }}
        >
          <div style={{ flex: 2, borderBottom: `3px solid ${active === false ? '#cbd5e0' : borderColor}`, opacity: 0.6 }} />
          <div style={{ flex: 1 }} />
          <div style={{ flex: 2, borderBottom: `3px solid ${active === false ? '#cbd5e0' : borderColor}`, opacity: 0.6 }} />
        </div>

        {/* Level percentage label */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            transform: 'translateY(-50%)',
            textAlign: 'center',
            fontSize: '0.7rem',
            fontWeight: 700,
            color: clamped > 45 ? '#fff' : '#2d3748',
            pointerEvents: 'none',
          }}
        >
          {Math.round(clamped)}%
        </div>
      </div>

      {/* Outlet label */}
      <div
        style={{
          fontSize: '0.62rem',
          fontWeight: active === false ? 400 : 600,
          color: active === false ? '#a0aec0' : '#2d3748',
          textAlign: 'center',
          lineHeight: '1.2',
        }}
      >
        {label}
      </div>

      {/* Optional sub-label (flow rate, etc.) */}
      {sublabel !== undefined && (
        <div style={{ fontSize: '0.55rem', color: '#a0aec0', textAlign: 'center', lineHeight: '1.1' }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

/**
 * buildHouseSimulatorViewModel — presentation adapter for the House Simulator.
 *
 * Reshapes existing simulator playback state (produced by the canonical hooks
 * in src/explainers/lego/simulator/) into a customer-facing view model for
 * HouseSimulatorPage.
 *
 * Boundary rules:
 *   - NO new physics, scoring, or recommendation logic.
 *   - NO new simulation state.
 *   - Reads only from the existing hook outputs passed in as arguments.
 *   - Produces only presentation-layer types consumed by the House Simulator UI.
 */

import type { SystemDiagramDisplayState, SimulatorSystemChoice } from '../../explainers/lego/simulator/useSystemDiagramPlayback';
import type { DrawOffDisplayState } from '../../explainers/lego/simulator/useDrawOffPlayback';
import type { EfficiencyDisplayState } from '../../explainers/lego/simulator/useEfficiencyPlayback';
import type { LimiterDisplayState } from '../../explainers/lego/simulator/useLimiterPlayback';
import type { LiveMetricChipProps } from './LiveMetricChip';

// ─── Public view model types ──────────────────────────────────────────────────

/** Narration data for SystemNarrationToast. */
export type NarrationViewModel = {
  /** Emoji icon reflecting the current service mode. */
  icon: string;
  /** One-line phase description. */
  phase: string;
  /** First active limiter title, if any. */
  warningText?: string;
};

/** Left roof widget — heat source status. */
export type HeatSourceWidgetViewModel = {
  /** Human-readable system type label. */
  systemLabel: string;
  /** Short operating-state label. */
  statusText: string;
  /** True when the heat source is actively firing. */
  isActive: boolean;
};

/** Right roof widget — efficiency summary. */
export type EfficiencyWidgetViewModel = {
  /** Condensing / efficiency headline text from the playback hook. */
  headlineText: string;
  /** Tone driving badge colour: 'good' | 'warning' | 'poor' | 'idle'. */
  statusTone: string;
  /** Optional one-line description. */
  description: string;
};

/** An active outlet with its live metric chips. */
export type ActiveOutletChipViewModel = {
  /** Outlet slot identifier. */
  outletId: string;
  /** Human-readable outlet label. */
  label: string;
  /** Emoji icon for the outlet. */
  icon: string;
  /** Name of the room this outlet lives in (used to position within the canvas). */
  roomName: string;
  /** Whether the outlet is constrained. */
  constrained: boolean;
  /** Live metric chips for flow, temperature, etc. */
  metrics: LiveMetricChipProps[];
};

/** Complete view model consumed by HouseSimulatorPage. */
export type HouseSimulatorViewModel = {
  narration: NarrationViewModel;
  heatSourceWidget: HeatSourceWidgetViewModel;
  efficiencyWidget: EfficiencyWidgetViewModel;
  /** All currently open outlets with their live metric chips. */
  activeOutlets: ActiveOutletChipViewModel[];
  /** True when any physics limiter is active. */
  hasWarnings: boolean;
  /** Number of active limiters. */
  warningCount: number;
};

// ─── Private constants ────────────────────────────────────────────────────────

const SYSTEM_TYPE_LABEL: Record<SimulatorSystemChoice, string> = {
  combi:       'Combi boiler',
  unvented:    'Unvented cylinder',
  open_vented: 'Open-vented cylinder',
  heat_pump:   'Heat pump',
  mixergy:     'Mixergy cylinder',
};

const OUTLET_ICON: Record<string, string> = {
  shower:   '🚿',
  bath:     '🛁',
  kitchen:  '🚰',
  cold_tap: '🚰',
};

/** Maps outlet id to the room name it lives in within the house canvas. */
const OUTLET_ROOM: Record<string, string> = {
  shower:   'Bathroom',
  bath:     'Bathroom',
  kitchen:  'Kitchen',
  cold_tap: 'Kitchen',
};

// ─── Temperature threshold constants ─────────────────────────────────────────

/** Above this temperature the delivered water poses a scalding risk (°C). */
const SCALDING_THRESHOLD_C = 55

/** Comfortable hot water delivery temperature (°C) — thermostatically mixed. */
const COMFORTABLE_THRESHOLD_C = 42

/**
 * Lukewarm threshold (°C) — below comfortable hot, system is still warming up
 * or operating at partial load.
 */
const LUKEWARM_THRESHOLD_C = 30

// ─── Metric chip builders ─────────────────────────────────────────────────────

function flowChip(flowLpm: number, constrained: boolean): LiveMetricChipProps {
  return {
    label:  'Flow',
    value:  flowLpm.toFixed(1),
    unit:   'L/min',
    status: constrained ? 'warning' : 'good',
  };
}

function tempChip(tempC: number): LiveMetricChipProps {
  // 55 °C+ — scalding risk territory; 42 °C — comfortable hot water delivery;
  // 30 °C — lukewarm (system not yet at temperature); below 30 °C — cold.
  const status =
    tempC >= SCALDING_THRESHOLD_C    ? 'critical'
    : tempC >= COMFORTABLE_THRESHOLD_C ? 'good'
    : tempC >= LUKEWARM_THRESHOLD_C    ? 'warning'
    : 'idle';
  return {
    label:  'Temperature',
    value:  Math.round(tempC),
    unit:   '°C',
    status,
  };
}

// ─── Public adapter ───────────────────────────────────────────────────────────

export function buildHouseSimulatorViewModel(
  diagramState: SystemDiagramDisplayState,
  drawOffState:  DrawOffDisplayState,
  efficiencyState: EfficiencyDisplayState,
  limiterState:  LimiterDisplayState,
  systemChoice:  SimulatorSystemChoice,
): HouseSimulatorViewModel {
  const { systemMode, serviceSwitchingActive, hotDrawActive } = diagramState;
  const chActive  = (systemMode === 'heating' || systemMode === 'heating_and_reheat') && !serviceSwitchingActive;
  const dhwActive = systemMode === 'dhw_draw' || hotDrawActive;

  // ── Narration ──────────────────────────────────────────────────────────────
  const narrationIcon = chActive ? '🔥' : dhwActive ? '💧' : '💤';
  const narration: NarrationViewModel = {
    icon:        narrationIcon,
    phase:       diagramState.phaseLabel,
    warningText: limiterState.activeLimiters.length > 0
      ? limiterState.activeLimiters[0].title
      : undefined,
  };

  // ── Heat source widget ─────────────────────────────────────────────────────
  const heatSourceWidget: HeatSourceWidgetViewModel = {
    systemLabel: SYSTEM_TYPE_LABEL[systemChoice],
    statusText:  chActive            ? '🔥 Heating active'
               : dhwActive           ? '💧 Hot water active'
               : serviceSwitchingActive ? '↔ Service switching'
               : '⏸ Idle',
    isActive: chActive || dhwActive,
  };

  // ── Efficiency widget ──────────────────────────────────────────────────────
  const efficiencyWidget: EfficiencyWidgetViewModel = {
    headlineText: efficiencyState.headlineEfficiencyText,
    statusTone:   efficiencyState.statusTone,
    description:  efficiencyState.statusDescription,
  };

  // ── Active outlet chips ────────────────────────────────────────────────────
  const activeOutlets: ActiveOutletChipViewModel[] = drawOffState.outletStates
    .filter(o => o.open)
    .map(o => {
      const metrics: LiveMetricChipProps[] = [
        flowChip(o.flowLpm, o.isConstrained),
      ];
      if (o.deliveredTempC !== undefined) {
        metrics.push(tempChip(o.deliveredTempC));
      }
      return {
        outletId:    o.outletId,
        label:       o.label,
        icon:        OUTLET_ICON[o.outletId] ?? '💧',
        roomName:    OUTLET_ROOM[o.outletId] ?? 'Kitchen',
        constrained: o.isConstrained,
        metrics,
      };
    });

  // ── Warnings ───────────────────────────────────────────────────────────────
  const hasWarnings    = limiterState.activeLimiters.length > 0;
  const warningCount   = limiterState.activeLimiters.length;

  return {
    narration,
    heatSourceWidget,
    efficiencyWidget,
    activeOutlets,
    hasWarnings,
    warningCount,
  };
}

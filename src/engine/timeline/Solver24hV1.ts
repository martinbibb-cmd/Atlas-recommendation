/**
 * Solver24hV1 — deterministic 24-hour physics solver (RC 1-node building model).
 *
 * Produces 96-point (15-min) timeline series for a single heating system, covering:
 *   roomTempC[], heatDeliveredKw[], heatDemandKw[], efficiency[], inputPowerKw[], dhwState[]
 *
 * Building model: 1-node RC (resistor-capacitor)
 *   UA = peakHeatLossKw / ΔT_design   (kW/°C)
 *   C  = UA × tauHours                (kWh/°C)
 *   heatLossKw = UA × (Troom − Tout)
 *   dT = (heatNet × dtHours) / C
 *
 * References: CIBSE Guide A §5; BRE IP14/88; SAP 2012 Appendix S.
 */

import type { Timeline24hEvent } from '../../contracts/EngineOutputV1';
import { normaliseDeliveryMode, isHotWaterDrawEvent, type DeliveryMode } from '../modules/LifestyleInteractiveHelpers';

/** Number of 15-minute timesteps in 24 hours. */
export const SOLVER_STEPS = 96;

/** Timestep duration in hours. */
const DT_HOURS = 15 / 60;

/** Design temperature difference (°C): setpointHome − outdoorDesign = 21 − 5 = 16. */
export const DELTA_T_DESIGN = 16;

/** Default cylinder capacity for stored / ASHP systems (kWh, approx. 150 L at 60°C). */
const CYLINDER_CAPACITY_KWH = 5.0;
/** Minimum boiler efficiency floor during cycling (fraction). */
const CYCLING_EFFICIENCY_FLOOR = 0.60;
/** Efficiency penalty applied when boiler demand is below modulation floor (fraction). */
const CYCLING_EFFICIENCY_PENALTY = 0.07;
/** Recovery urgency multiplier — proportional kick to reach setpoint quickly. */
const RECOVERY_URGENCY_FACTOR = 4;

/**
 * COP banded lookup: [designFlowTempBand][outdoorCondition].
 * Outdoor conditions: cold (≤ 2°C), mild (2–7°C), warm (> 7°C).
 * Values from typical ASHP performance data (CIBSE TM65 / MCS MIS 3005).
 */
const COP_TABLE: Record<35 | 45 | 50, { cold: number; mild: number; warm: number }> = {
  35: { cold: 3.2, mild: 3.8, warm: 4.5 },
  45: { cold: 2.5, mild: 3.0, warm: 3.6 },
  50: { cold: 2.1, mild: 2.6, warm: 3.2 },
};

function getCop(flowTempBand: 35 | 45 | 50, outdoorTempC: number): number {
  const cond = outdoorTempC <= 2 ? 'cold' : outdoorTempC <= 7 ? 'mild' : 'warm';
  return COP_TABLE[flowTempBand][cond];
}

/** DHW heat draw per event kind × intensity (kW), duration-scaled by dtHours. */
const DHW_DRAW_KW: Record<string, Record<string, number>> = {
  shower: { low: 0.8, med: 1.5, high: 2.2 },
  bath:   { low: 1.2, med: 2.0, high: 3.0 },
  sink:   { low: 0.4, med: 0.6, high: 0.8 },
};

/** Derive DHW heat draw (kW) for a given event, or 0 for cold-fill appliances. */
function getDhwDrawKw(event: Timeline24hEvent): number {
  if (event.kind === 'dishwasher' || event.kind === 'washing_machine') return 0;
  return (DHW_DRAW_KW[event.kind]?.[event.intensity]) ?? 0;
}

// ── System type helpers ───────────────────────────────────────────────────────

/** Whether the system has a stored cylinder (affects DHW modelling). */
function isStoredSystem(systemId: string): boolean {
  return (
    systemId === 'stored_vented' ||
    systemId === 'stored_unvented' ||
    systemId === 'regular_vented' ||
    systemId === 'system_unvented' ||
    systemId === 'ashp'
  );
}

function isAshpSystem(systemId: string): boolean {
  return systemId === 'ashp';
}

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Building / site inputs shared across both systems in the comparison.
 * Derived from engine core and survey input.
 */
export interface SolverCoreInput {
  /** Peak building heat loss at design conditions (kW). */
  peakHeatLossKw: number;
  /**
   * Thermal time constant (hours) — how slowly the building cools when heating stops.
   * From FabricModelV1.driftTauHours; defaults to 35h (medium/moderate).
   */
  tauHours: number;
  /** Outdoor temperature (°C). Defaults to 5°C (UK design day). */
  outdoorTempC?: number;
  /** Occupied setpoint (°C). Defaults to 21°C. */
  setpointHomeC?: number;
  /** Unoccupied / away setpoint (°C). Defaults to 17°C. */
  setpointAwayC?: number;
}

/**
 * Per-system configuration driving dispatch logic.
 */
export interface SolverSystemConfig {
  /** System identifier (e.g. 'on_demand', 'ashp', 'stored_vented'). */
  systemId: string;
  /** Maximum heat output capability (kW). */
  maxKw: number;
  /**
   * Minimum modulation floor (kW) — below this, a boiler cycles on/off.
   * Defaults to 4 kW (typical UK modulating combi).
   */
  minKw?: number;
  /**
   * Base thermal efficiency (0–1) for boilers (SEDBUK seasonal or assumed).
   * Ignored for ASHP (COP is derived from flowTempBand + outdoor temp).
   * Defaults to 0.85.
   */
  baseEta?: number;
  /** ASHP design flow temperature band (°C). Defaults to 50°C (no upgrade assumed). */
  designFlowTempBand?: 35 | 45 | 50;
}

/**
 * Per-step output arrays (96 points at 15-min intervals).
 * All arrays are aligned: index 0 = 00:00, index 95 = 23:45.
 */
export interface SystemSolverResult {
  /** Room temperature (°C) at end of each 15-min step. */
  roomTempC: number[];
  /** Heat delivered to the building (space heat + DHW, kW). */
  heatDeliveredKw: number[];
  /** Space-heat demand required to track setpoint (kW). */
  heatDemandKw: number[];
  /**
   * Thermal efficiency (fraction) for boilers; COP for ASHP.
   * Always > 1 for ASHP; ≤ 1 for boilers.
   */
  efficiency: number[];
  /** Fuel or electrical input power (kW). */
  inputPowerKw: number[];
  /**
   * DHW cylinder state (0–100).
   * For stored/ASHP: socPct (usable energy as % of cylinder capacity).
   * For combi: 100 when event is served, < 100 when capacity-limited.
   */
  dhwState: number[];
}

// ── Core solver ───────────────────────────────────────────────────────────────

/**
 * Solve a single system's 24-hour timeline using the RC 1-node building model.
 *
 * @param coreInput    Shared building / site parameters.
 * @param system       System-specific dispatch configuration.
 * @param events       DHW event schedule (from TimelineBuilder or defaults).
 * @param deliveryMode DHW delivery mode — 'electric_cold_only' suppresses all DHW draws.
 * @returns            96-point series arrays.
 */
export function solveSystemTimeline(
  coreInput: SolverCoreInput,
  system: SolverSystemConfig,
  events: Timeline24hEvent[],
  deliveryMode?: string,
): SystemSolverResult {
  const canonicalMode: DeliveryMode = deliveryMode
    ? normaliseDeliveryMode(deliveryMode)
    : 'unknown';
  const {
    peakHeatLossKw,
    tauHours,
    outdoorTempC = 5,
    setpointHomeC = 21,
    setpointAwayC = 17,
  } = coreInput;

  const UA = peakHeatLossKw / DELTA_T_DESIGN; // kW/°C
  const C = UA * tauHours;                     // kWh/°C

  const { maxKw, minKw = 4, baseEta = 0.85 } = system;
  const flowTempBand = system.designFlowTempBand ?? 50;
  const isAshp = isAshpSystem(system.systemId);
  const hasStoredCylinder = isStoredSystem(system.systemId) || isAshp;

  // DHW cylinder state (kWh usable)
  let cylinderKwh = CYLINDER_CAPACITY_KWH;

  const roomTempC: number[] = [];
  const heatDeliveredKw: number[] = [];
  const heatDemandKw: number[] = [];
  const efficiency: number[] = [];
  const inputPowerKw: number[] = [];
  const dhwState: number[] = [];

  // Start at home setpoint
  let Troom = setpointHomeC;

  for (let i = 0; i < SOLVER_STEPS; i++) {
    const minuteOfDay = i * 15;
    const hour = minuteOfDay / 60;

    // ── Setpoint schedule: home 06:00–23:00, away otherwise ──────────────────
    const isHome = hour >= 6 && hour < 23;
    const setpoint = isHome ? setpointHomeC : setpointAwayC;

    // ── Building heat-loss and space-heat demand ──────────────────────────────
    const heatLossKw = UA * (Troom - outdoorTempC);
    // Recovery term: proportional kick when below setpoint
    const tempError = setpoint - Troom;
    const recoveryKw = Math.max(0, tempError) * UA * RECOVERY_URGENCY_FACTOR;
    const spaceHeatRequiredKw = Math.max(0, heatLossKw + recoveryKw);

    // ── DHW demand at this timestep ───────────────────────────────────────────
    // Electric showers heat cold mains directly — only shower events are suppressed.
    // Bath, sink, and tap events still draw from the stored cylinder.
    const dhwEvent = events.find(
      e =>
        minuteOfDay >= e.startMin &&
        minuteOfDay < e.endMin &&
        getDhwDrawKw(e) > 0 &&
        isHotWaterDrawEvent(canonicalMode, e.kind),
    );
    const dhwHeatKw = dhwEvent ? getDhwDrawKw(dhwEvent) : 0;
    const totalRequiredKw = spaceHeatRequiredKw + dhwHeatKw;

    // ── System dispatch ───────────────────────────────────────────────────────
    let delivered: number;
    let eta: number;

    if (isAshp) {
      const cop = getCop(flowTempBand, outdoorTempC);
      delivered = Math.min(totalRequiredKw, maxKw);
      eta = cop;
    } else {
      // Boiler
      if (totalRequiredKw <= 0) {
        delivered = 0;
        eta = baseEta;
      } else if (totalRequiredKw < minKw) {
        // Cycling: load below modulation floor — efficiency penalty
        delivered = Math.min(totalRequiredKw, maxKw);
        eta = Math.max(CYCLING_EFFICIENCY_FLOOR, baseEta - CYCLING_EFFICIENCY_PENALTY);
      } else {
        delivered = Math.min(totalRequiredKw, maxKw);
        eta = baseEta;
      }
    }

    // Input power (fuel or electricity)
    const inputKw = eta > 0 ? delivered / eta : 0;

    // ── Room temperature update (space heat only) ─────────────────────────────
    const spaceDelivered = Math.min(delivered, spaceHeatRequiredKw);
    const netHeatKw = spaceDelivered - heatLossKw;
    const dT = (netHeatKw * DT_HOURS) / C;
    Troom = Math.max(outdoorTempC, Troom + dT);

    // ── DHW cylinder / state tracking ─────────────────────────────────────────
    let dhwStateVal: number;

    if (!hasStoredCylinder) {
      // Combi: no cylinder — event served at 100% when capacity available
      if (dhwHeatKw > 0) {
        const served = delivered >= totalRequiredKw ? 100 : (delivered / totalRequiredKw) * 100;
        dhwStateVal = Math.max(0, Math.min(100, served));
      } else {
        dhwStateVal = 100; // standby
      }
    } else {
      // Stored / ASHP: cylinder energy model
      if (dhwHeatKw > 0) {
        const draw = dhwHeatKw * DT_HOURS;
        cylinderKwh = Math.max(0, cylinderKwh - draw);
      }
      // Reheat from any excess capacity above space heat
      const excessKw = Math.max(0, delivered - spaceDelivered);
      cylinderKwh = Math.min(CYLINDER_CAPACITY_KWH, cylinderKwh + excessKw * DT_HOURS);
      dhwStateVal = (cylinderKwh / CYLINDER_CAPACITY_KWH) * 100;
    }

    // ── Record results ────────────────────────────────────────────────────────
    roomTempC.push(parseFloat(Troom.toFixed(2)));
    heatDeliveredKw.push(parseFloat(delivered.toFixed(3)));
    heatDemandKw.push(parseFloat(spaceHeatRequiredKw.toFixed(3)));
    efficiency.push(parseFloat(eta.toFixed(3)));
    inputPowerKw.push(parseFloat(inputKw.toFixed(3)));
    dhwState.push(parseFloat(dhwStateVal.toFixed(1)));
  }

  return { roomTempC, heatDeliveredKw, heatDemandKw, efficiency, inputPowerKw, dhwState };
}

// ── High-level system config builders ────────────────────────────────────────

/**
 * Build a SolverSystemConfig from a system ID and engine context values.
 * Defaults match problem-statement: combi 24 kW, system/regular 18 kW, minKw 4 kW.
 */
export function buildSystemConfig(
  systemId: string,
  peakHeatLossKw: number,
  options: {
    nominalOutputKw?: number;
    baseEta?: number;
    designFlowTempBand?: 35 | 45 | 50;
    currentHeatSourceType?: string;
  } = {},
): SolverSystemConfig {
  const { nominalOutputKw, baseEta = 0.85, designFlowTempBand = 50, currentHeatSourceType } = options;

  // Resolve effective system type (handles 'current' alias)
  const effectiveId =
    systemId === 'current'
      ? currentHeatSourceType === 'ashp'
        ? 'ashp'
        : currentHeatSourceType === 'system' || currentHeatSourceType === 'regular'
          ? 'stored_vented'
          : 'on_demand'
      : systemId;

  if (isAshpSystem(effectiveId)) {
    return {
      systemId: effectiveId,
      maxKw: peakHeatLossKw * 1.1,
      designFlowTempBand,
    };
  }

  // Boiler default outputs by type
  const defaultMaxKw =
    effectiveId === 'on_demand' ? 24
    : effectiveId === 'regular_vented' || effectiveId === 'stored_vented' ? 18
    : 18;

  return {
    systemId: effectiveId,
    maxKw: nominalOutputKw ?? defaultMaxKw,
    minKw: 4,
    baseEta,
  };
}

// src/explainers/lego/simulator/useDailyEfficiencySummary.ts
//
// Pure function: derives DailyEfficiencySummaryState from system inputs and
// emitter physics.
//
// Architecture:
//   SimulatorDashboard
//     → computeDailyEfficiencySummary(systemInputs, systemChoice, emitterState)
//     → DailyEfficiencySummaryState
//     → DailyEfficiencySummaryPanel({ state })
//
// Discipline:
//   - Pure function, no simulation state, no Math.random()
//   - Uses DEFAULT_NOMINAL_EFFICIENCY_PCT from efficiency.ts — never the literal 92
//   - Uses computeCurrentEfficiencyPct to clamp the result to [50, 99]
//   - No tariff, cost, carbon, or export logic

import type { SystemInputs, OccupancyProfile } from './systemInputsTypes'
import type { SimulatorSystemChoice } from './useSystemDiagramPlayback'
import type { EmitterPrimaryDisplayState } from './useEmitterPrimaryModel'
import {
  DEFAULT_NOMINAL_EFFICIENCY_PCT,
  computeCurrentEfficiencyPct,
} from '../../../engine/utils/efficiency'

// ─── Internal constants ───────────────────────────────────────────────────────

/** Return temperature threshold below which condensing gain is possible. */
const CONDENSING_THRESHOLD_C = 55

/** Maximum condensing gain in percentage points. */
const MAX_CONDENSING_GAIN_PCT = 8

/** Scaling factor from ΔT below threshold to efficiency gain. */
const CONDENSING_GAIN_FACTOR = 0.6

// ─── Public types ─────────────────────────────────────────────────────────────

/** All display-relevant state the DailyEfficiencySummaryPanel needs. */
export type DailyEfficiencySummaryState = {
  /** 'boiler' or 'heat_pump' — determines which summary value to show. */
  systemKind: 'boiler' | 'heat_pump'
  /**
   * Estimated daily operating efficiency in percentage points (boiler only).
   * Absent for heat pump systems.
   */
  dailyEfficiencyPct?: number
  /**
   * Estimated daily average COP (heat pump only).
   * Absent for boiler systems.
   */
  dailyCop?: number
  /** Short human-readable label, e.g. "Estimated daily operating efficiency". */
  summaryLabel: string
  /** Formatted value string, e.g. "88%" or "3.7". */
  summaryValue: string
  /** One short explanation line describing what influenced the result. */
  explanationLine: string
  /**
   * Optional season-context label from the active scenario preset,
   * e.g. "Winter day" or "Summer day".  Shown as a small badge in the panel.
   * Absent when no scenario preset is active.
   */
  seasonContext?: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Fraction of running hours spent at design-load (peak) vs part-load.
 *
 * A higher peak fraction means the daily average return temperature is closer
 * to the design-load return temperature.  Lower values mean the system spends
 * more time at reduced load, benefiting condensing behaviour.
 */
function peakLoadFraction(profile: OccupancyProfile): number {
  switch (profile) {
    case 'professional': return 0.25  // long absence; short peaks
    case 'steady_home':  return 0.55  // home all day; moderate load
    case 'family':       return 0.45  // school runs; afternoon and evening peaks
    case 'shift':        return 0.30  // irregular; shorter active windows
  }
}

/**
 * Cycling penalty in percentage points.
 *
 * More frequent short demand events (many start/stop cycles) reduce seasonal
 * efficiency through increased on/off losses.
 */
function cyclingPenaltyPct(profile: OccupancyProfile, systemChoice: SimulatorSystemChoice): number {
  // Combi boilers suffer extra cycling losses on each DHW draw.
  const combiMultiplier = systemChoice === 'combi' ? 1.5 : 1.0
  const base = (() => {
    switch (profile) {
      case 'professional': return 1  // fewer starts
      case 'steady_home':  return 2
      case 'family':       return 3  // many short events
      case 'shift':        return 2
    }
  })()
  return base * combiMultiplier
}

/**
 * Condition penalty in percentage points for boiler efficiency.
 */
function conditionPenaltyPct(condition: SystemInputs['systemCondition']): number {
  switch (condition) {
    case 'sludged': return 5
    case 'scaled':  return 3
    case 'clean':   return 0
  }
}

/**
 * Daily average return temperature (°C), accounting for the blend of
 * peak and part-load operation throughout the day.
 *
 * When load compensation is disabled the boiler runs at a fixed setpoint —
 * the system does not benefit from lower return temperatures at part load.
 * In that case we use the design-load return temperature for all hours.
 *
 * When load compensation is active, the part-load fraction of the day benefits
 * from the lower currentLoadReturnTempC, weighted by the occupancy profile.
 */
function dailyAvgReturnTempC(
  emitter: EmitterPrimaryDisplayState,
  profile: OccupancyProfile,
  loadCompensation: boolean,
): number {
  const peakFrac = peakLoadFraction(profile)
  // Without load compensation: fixed setpoint → design-load return temp throughout.
  const partLoadReturnTemp = loadCompensation
    ? emitter.currentLoadReturnTempC
    : emitter.estimatedReturnTempC
  return (
    emitter.estimatedReturnTempC * peakFrac +
    partLoadReturnTemp * (1 - peakFrac)
  )
}

/**
 * Condensing gain in percentage points based on daily average return temp.
 */
function condensingGainPct(avgReturnTempC: number): number {
  if (avgReturnTempC >= CONDENSING_THRESHOLD_C) return 0
  return Math.min(
    MAX_CONDENSING_GAIN_PCT,
    (CONDENSING_THRESHOLD_C - avgReturnTempC) * CONDENSING_GAIN_FACTOR,
  )
}

// ─── Boiler summary ───────────────────────────────────────────────────────────

function computeBoilerSummary(
  systemInputs: SystemInputs,
  systemChoice: SimulatorSystemChoice,
  emitterState: EmitterPrimaryDisplayState,
): DailyEfficiencySummaryState {
  const avgReturn = dailyAvgReturnTempC(emitterState, systemInputs.occupancyProfile, systemInputs.loadCompensation)
  const gain = condensingGainPct(avgReturn)
  const conditionPenalty = conditionPenaltyPct(systemInputs.systemCondition)
  const cyclingPenalty = cyclingPenaltyPct(systemInputs.occupancyProfile, systemChoice)

  const dailyEfficiencyPct = computeCurrentEfficiencyPct(
    DEFAULT_NOMINAL_EFFICIENCY_PCT + gain - conditionPenalty - cyclingPenalty,
    0,
  )

  return {
    systemKind: 'boiler',
    dailyEfficiencyPct,
    summaryLabel: 'Estimated daily operating efficiency',
    summaryValue: `${Math.round(dailyEfficiencyPct)}%`,
    explanationLine: buildBoilerExplanation(
      systemInputs,
      systemChoice,
      emitterState,
      gain,
      avgReturn,
    ),
  }
}

function buildBoilerExplanation(
  systemInputs: SystemInputs,
  systemChoice: SimulatorSystemChoice,
  emitterState: EmitterPrimaryDisplayState,
  condensingGain: number,
  avgReturnTempC: number,
): string {
  // Priority-ordered: highest-impact factor first.
  if (systemInputs.systemCondition === 'sludged') {
    return 'Magnetite sludge reducing heat transfer across the system.'
  }
  if (systemInputs.systemCondition === 'scaled') {
    return 'Scale build-up restricting heat exchanger performance.'
  }
  if (
    systemInputs.occupancyProfile === 'family' &&
    systemChoice === 'combi'
  ) {
    return 'Frequent concurrent demand increased hot-water cycling losses.'
  }
  if (systemInputs.loadCompensation && condensingGain > 3) {
    return 'Lower return temperatures and steadier operation improved performance.'
  }
  if (condensingGain > 4) {
    return 'System spending significant time in the condensing range.'
  }
  if (!emitterState.emitterAdequate) {
    return 'Undersized emitters limiting condensing gains.'
  }
  if (avgReturnTempC >= CONDENSING_THRESHOLD_C) {
    return 'High return temperatures preventing condensing operation.'
  }
  if (systemInputs.occupancyProfile === 'professional') {
    return 'Absent during the day reduces standing and cycling losses.'
  }
  return 'Operating within expected parameters.'
}

// ─── Heat pump summary ────────────────────────────────────────────────────────

function computeHeatPumpSummary(
  systemInputs: SystemInputs,
  emitterState: EmitterPrimaryDisplayState,
): DailyEfficiencySummaryState {
  let dailyCop = emitterState.estimatedCop

  // Occupancy modifier.
  const occupancyMultiplier = (() => {
    switch (systemInputs.occupancyProfile) {
      case 'family':       return 0.94  // more frequent DHW draws
      case 'professional': return 1.03  // steadier, fewer short cycles
      case 'steady_home':  return 1.00
      case 'shift':        return 1.01
    }
  })()
  dailyCop *= occupancyMultiplier

  // Load compensation bonus: reduces required flow temperature.
  if (systemInputs.loadCompensation) dailyCop *= 1.05

  // Weather compensation bonus: outdoor-reset further reduces flow temperature.
  if (systemInputs.weatherCompensation) dailyCop += 0.1

  // System condition penalty.
  if (systemInputs.systemCondition === 'sludged') dailyCop *= 0.94
  else if (systemInputs.systemCondition === 'scaled') dailyCop *= 0.97

  // Clamp to a realistic range.
  dailyCop = Math.min(4.5, Math.max(1.5, dailyCop))

  return {
    systemKind: 'heat_pump',
    dailyCop,
    summaryLabel: 'Estimated daily COP',
    summaryValue: dailyCop.toFixed(1),
    explanationLine: buildHeatPumpExplanation(systemInputs, emitterState),
  }
}

function buildHeatPumpExplanation(
  systemInputs: SystemInputs,
  emitterState: EmitterPrimaryDisplayState,
): string {
  if (systemInputs.systemCondition === 'sludged') {
    return 'Magnetite sludge reducing heat transfer efficiency.'
  }
  if (systemInputs.systemCondition === 'scaled') {
    return 'Scale build-up restricting heat exchanger performance.'
  }
  if (systemInputs.loadCompensation || systemInputs.weatherCompensation) {
    return 'Lower flow temperatures and steadier operation improved COP.'
  }
  if (!emitterState.emitterAdequate) {
    return 'Undersized emitters requiring higher flow temperatures, reducing COP.'
  }
  if (systemInputs.occupancyProfile === 'family') {
    return 'Frequent concurrent demand reduced average hot-water efficiency.'
  }
  if (systemInputs.occupancyProfile === 'professional') {
    return 'Fewer short cycling events during the day improved daily COP.'
  }
  return 'Operating within expected parameters.'
}

// ─── Public function ──────────────────────────────────────────────────────────

/**
 * Compute DailyEfficiencySummaryState from system inputs and the emitter
 * physics model.
 *
 * Called as a pure function (no React state) so it can be unit-tested directly.
 *
 * @param systemInputs   Full system configuration including occupancy profile.
 * @param systemChoice   Current simulator system choice (combi / unvented / etc.).
 * @param emitterState   Emitter primary model output (flow/return temps, COP).
 * @param seasonContext  Optional season-context label from the active scenario
 *                       preset, e.g. "Winter day". Passed through to the state
 *                       for display in the panel.
 */
export function computeDailyEfficiencySummary(
  systemInputs: SystemInputs,
  systemChoice: SimulatorSystemChoice,
  emitterState: EmitterPrimaryDisplayState,
  seasonContext?: string,
): DailyEfficiencySummaryState {
  const isHeatPump = systemChoice === 'heat_pump'
  const base = isHeatPump
    ? computeHeatPumpSummary(systemInputs, emitterState)
    : computeBoilerSummary(systemInputs, systemChoice, emitterState)
  return seasonContext ? { ...base, seasonContext } : base
}

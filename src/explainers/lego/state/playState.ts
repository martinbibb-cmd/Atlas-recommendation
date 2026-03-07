// src/explainers/lego/state/playState.ts
//
// Play-mode state model for interactive DHW simulation.
// PlayState drives the simulation instead of hard-coded demo values —
// simulation input = savedGraphSnapshot + playState.

import type { OutletControl, OutletId, HeatingDemandState, SystemType, ControlTopologyKind } from '../animation/types'

export type { HeatingDemandState }

// ─── Outlet demand preset identifiers ────────────────────────────────────────

export type OutletDemandPreset =
  | 'off'
  | 'eco'
  | 'normal'
  | 'high'
  | 'rinse'
  | 'hot'
  | 'fill'
  | 'on'

// ─── Outlet kind ─────────────────────────────────────────────────────────────

export type PlayOutletKind =
  | 'shower'
  | 'basin'
  | 'bath'
  | 'tap'
  | 'cold_tap'
  | 'appliance'

// ─── Per-outlet demand state ──────────────────────────────────────────────────

export type OutletDemandState = {
  /** Outlet slot identifier ('A' | 'B' | 'C'). */
  outletId: OutletId
  /** Human-readable label shown in the control panel. */
  label: string
  kind: PlayOutletKind
  enabled: boolean
  /** Active preset shortcut, if any. 'off' means disabled. */
  preset?: OutletDemandPreset
  /** Current target flow rate (L/min). */
  targetFlowLpm: number
  /** Target delivery temperature (°C). Not set for cold-only outlets. */
  targetTempC?: number
}

// ─── Supply conditions ────────────────────────────────────────────────────────

/**
 * Presets for CWS (cold-water storage cistern) tank head pressure.
 * Used by vented cylinder systems where head pressure determines supply flow capacity.
 *
 * poor    — low head (≤ 1.5 m): shower may struggle
 * typical — normal domestic head (3 m)
 * good    — high head (5 m): good gravity supply
 */
export type CwsHeadPreset = 'poor' | 'typical' | 'good'

/** Metres of head for each CWS head preset. */
export const CWS_HEAD_METERS: Record<CwsHeadPreset, number> = {
  poor:    1.5,
  typical: 3.0,
  good:    5.0,
}

/**
 * User-configurable supply conditions for Play mode.
 *
 * These are kept separate from the outlet demand controls so the user can
 * reason about the supply side of the system independently from demand.
 *
 * mainsDynamicFlowLpm — only relevant for mains-fed systems (combi, unvented).
 * cwsHeadPreset       — only relevant for vented (tank-fed) cylinder systems.
 * combiDhwKw          — only relevant for combi systems; overrides the default 30 kW output.
 */
export type SupplyConditions = {
  /** Cold supply inlet temperature (°C). Applies to all system types. */
  inletTempC: number
  /**
   * Dynamic mains flow rate (L/min).
   * Only relevant for mains-fed systems (combi, unvented cylinder).
   * Ignored for vented cylinders (tank-fed supply).
   */
  mainsDynamicFlowLpm?: number
  /**
   * CWS tank head preset.
   * Only relevant for vented (tank-fed) cylinder systems.
   * Ignored for mains-fed systems.
   */
  cwsHeadPreset?: CwsHeadPreset
  /**
   * Combi boiler DHW output override (kW).
   * Only relevant for combi systems.  Typical range: 24–40 kW.
   * When absent the simulation uses its built-in default (30 kW).
   */
  combiDhwKw?: number
}

export type PlayState = {
  demands: OutletDemandState[]
  /** Central-heating demand state. */
  heating: HeatingDemandState
  /** Cold inlet temperature (°C) — fed from mains or CWS tank. */
  inletTempC: number
  /** DHW setpoint / hot supply target (°C). */
  hotSupplyTargetC: number
  /** Currently selected scenario preset ID, or null when manually edited. */
  selectedPresetId?: string | null
  /**
   * User-configurable supply conditions.
   * These drive the supply-side limits in the simulation.
   * Populated by createDefaultPlayState and editable in Play mode.
   */
  supplyConditions: SupplyConditions
}

// ─── Preset flow / temperature reference values ───────────────────────────────

/** Default DHW delivery temperature for all hot-water presets (°C). */
const DEFAULT_DHW_DELIVERY_TEMP_C = 40

/** Reference flow and temperature values for each outlet demand preset. */
export const PRESET_FLOWS: Record<OutletDemandPreset, { flowLpm: number; tempC?: number }> = {
  off:    { flowLpm: 0 },
  eco:    { flowLpm: 7,    tempC: DEFAULT_DHW_DELIVERY_TEMP_C },
  normal: { flowLpm: 10,   tempC: DEFAULT_DHW_DELIVERY_TEMP_C },
  high:   { flowLpm: 12,   tempC: DEFAULT_DHW_DELIVERY_TEMP_C },
  rinse:  { flowLpm: 2.5,  tempC: DEFAULT_DHW_DELIVERY_TEMP_C },
  hot:    { flowLpm: 5,    tempC: DEFAULT_DHW_DELIVERY_TEMP_C },
  fill:   { flowLpm: 16,   tempC: DEFAULT_DHW_DELIVERY_TEMP_C },
  on:     { flowLpm: 6 },              // cold tap — no target temp
}

// ─── Available presets per outlet kind ───────────────────────────────────────

/** Ordered preset options shown in the control panel for each outlet kind. */
export const PRESETS_FOR_KIND: Record<PlayOutletKind, OutletDemandPreset[]> = {
  shower:    ['off', 'eco', 'normal', 'high'],
  basin:     ['off', 'rinse', 'hot'],
  bath:      ['off', 'fill'],
  tap:       ['off', 'normal'],
  cold_tap:  ['off', 'on'],
  appliance: ['off', 'normal'],
}

// ─── Scenario presets ─────────────────────────────────────────────────────────

export type PlayScenario = {
  id: string
  label: string
  /** Partial patch applied to demands — slots not mentioned remain unchanged. */
  patch: Partial<Record<OutletId, OutletDemandPreset>>
  /** Optional heating demand override applied by this scenario. */
  heatingPatch?: Partial<HeatingDemandState>
}

export const PLAY_SCENARIOS: PlayScenario[] = [
  {
    id: 'all-off',
    label: 'All off',
    patch: { A: 'off', B: 'off', C: 'off' },
  },
  {
    id: 'shower-only',
    label: 'Shower only',
    patch: { A: 'normal', B: 'off', C: 'off' },
  },
  {
    id: 'basin-only',
    label: 'Basin only',
    patch: { A: 'off', B: 'hot', C: 'off' },
  },
  {
    id: 'bath-fill',
    label: 'Bath fill',
    patch: { A: 'off', B: 'off', C: 'fill' },
  },
  {
    id: 'shower-basin',
    label: 'Shower + basin',
    patch: { A: 'normal', B: 'hot', C: 'off' },
  },
  {
    id: 'two-hot',
    label: 'Two hot outlets',
    patch: { A: 'normal', B: 'off', C: 'fill' },
  },
  {
    id: 'heating-only',
    label: 'Heating only',
    patch: { A: 'off', B: 'off', C: 'off' },
    heatingPatch: { enabled: true, demandLevel: 1 },
  },
  {
    id: 'heating-and-shower',
    label: 'Heating + shower',
    patch: { A: 'normal', B: 'off', C: 'off' },
    heatingPatch: { enabled: true, demandLevel: 1 },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Apply a preset shortcut to an outlet's demand state.
 * Returns a new `OutletDemandState` with updated preset, flow, temp, and enabled flag.
 */
export function applyPresetToOutlet(
  outlet: OutletDemandState,
  preset: OutletDemandPreset,
): OutletDemandState {
  const ref = PRESET_FLOWS[preset]
  return {
    ...outlet,
    preset,
    enabled: preset !== 'off',
    targetFlowLpm: ref.flowLpm,
    targetTempC: ref.tempC,
  }
}

/**
 * Apply a scenario preset to the full PlayState.
 * Slots not mentioned in the scenario patch are left unchanged.
 * If the scenario has a heatingPatch, it is merged into the heating state.
 * Sets `selectedPresetId` to the scenario's id.
 */
export function applyScenario(playState: PlayState, scenarioId: string): PlayState {
  const scenario = PLAY_SCENARIOS.find(s => s.id === scenarioId)
  if (!scenario) return playState

  const nextDemands = playState.demands.map(outlet => {
    const presetId = scenario.patch[outlet.outletId]
    return presetId !== undefined ? applyPresetToOutlet(outlet, presetId) : outlet
  })

  const nextHeating: HeatingDemandState = scenario.heatingPatch
    ? { ...playState.heating, ...scenario.heatingPatch }
    : playState.heating

  return { ...playState, demands: nextDemands, heating: nextHeating, selectedPresetId: scenarioId }
}

/**
 * Map a single OutletDemandState to the OutletControl shape used by the simulation.
 * Play-mode kind ('shower') → simulation kind ('shower_mixer').
 */
export function outletDemandToControl(demand: OutletDemandState): OutletControl {
  const isShower = demand.kind === 'shower'
  const isColdTap = demand.kind === 'cold_tap'

  const simulationKind: OutletControl['kind'] = isShower
    ? 'shower_mixer'
    : isColdTap
      ? 'cold_tap'
      : demand.kind === 'bath'
        ? 'bath'
        : 'basin'

  return {
    id: demand.outletId,
    enabled: demand.enabled,
    kind: simulationKind,
    demandLpm: demand.targetFlowLpm,
    ...(isShower && demand.targetTempC !== undefined
      ? { tmvEnabled: true, tmvTargetTempC: demand.targetTempC }
      : {}),
  }
}

/**
 * Convert all OutletDemandState entries in a PlayState to OutletControl[].
 * Ensures exactly the three slots A, B, C are represented — missing slots are
 * filled with a disabled placeholder so the simulation never receives a
 * shorter-than-expected outlet array.
 */
export function playStateToOutletControls(demands: OutletDemandState[]): OutletControl[] {
  const slots: OutletId[] = ['A', 'B', 'C']
  return slots.map(slot => {
    const demand = demands.find(d => d.outletId === slot)
    if (demand) return outletDemandToControl(demand)
    // Disabled placeholder for unrepresented slots
    return { id: slot, enabled: false, kind: 'basin' as const, demandLpm: 0 }
  })
}

// ─── Operating mode ───────────────────────────────────────────────────────────

/**
 * High-level operating mode derived from play state.
 *
 * Maps to the simulation's SystemMode but expressed in terms more useful for
 * UI display:
 *   IDLE           — no heating or DHW demand
 *   CH_ONLY        — heating active, no DHW draw
 *   DHW_ONLY       — DHW outlets active, no heating
 *   CH_AND_DHW     — both active (cylinder/heat-pump systems)
 *   CYLINDER_REHEAT — store temperature below setpoint; reheat needed
 */
export type OperatingMode = 'IDLE' | 'CH_ONLY' | 'DHW_ONLY' | 'CH_AND_DHW' | 'CYLINDER_REHEAT'

/**
 * Derive the expected operating mode from the current play state and an
 * optional system type hint.
 *
 * For combi systems, DHW always takes priority — CH_AND_DHW is not possible.
 * For cylinder/heat-pump systems, heating and DHW can run simultaneously.
 *
 * Control topology determines simultaneous operation:
 *   S-plan    — both CH and cylinder reheat allowed at the same time.
 *   Y-plan    — 3-port valve decides routing; treated as CH_AND_DHW when both active.
 *   Combi     — DHW draw pauses CH (no simultaneous mode).
 *   hp_diverter — prioritises DHW (treated as DHW_ONLY when both active).
 */
export function determineOperatingMode(
  playState: PlayState,
  systemType: SystemType = 'combi',
  controlTopology: ControlTopologyKind = 'none',
): OperatingMode {
  const hasDhw = playState.demands.some(d => d.enabled && d.kind !== 'cold_tap')
  const hasHeating = playState.heating.enabled

  if (!hasDhw && !hasHeating) return 'IDLE'

  const isCombi = systemType === 'combi'

  if (hasDhw && !hasHeating) return 'DHW_ONLY'
  if (hasHeating && !hasDhw) return 'CH_ONLY'

  // Both heating and DHW are active
  if (isCombi) {
    // Combi: DHW priority — heating is interrupted during a draw
    return 'DHW_ONLY'
  }
  // Non-combi path: combi systems already returned above.
  if (controlTopology === 'hp_diverter') {
    // Heat-pump diverter: DHW takes priority over space heating
    return 'DHW_ONLY'
  }
  // S-plan and Y-plan both allow CH and DHW simultaneously at the UI level.
  // (S-plan also runs simultaneous reheat in the simulation; Y-plan valve position
  //  determines actual routing but we display CH_AND_DHW for both.)
  return 'CH_AND_DHW'
}

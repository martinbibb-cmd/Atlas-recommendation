// src/explainers/lego/state/playState.ts
//
// Play-mode state model for interactive DHW simulation.
// PlayState drives the simulation instead of hard-coded demo values —
// simulation input = savedGraphSnapshot + playState.

import type { OutletControl, OutletId } from '../animation/types'

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

// ─── Aggregate play state ─────────────────────────────────────────────────────

export type PlayState = {
  demands: OutletDemandState[]
  /** Cold inlet temperature (°C) — fed from mains. */
  inletTempC: number
  /** DHW setpoint / hot supply target (°C). */
  hotSupplyTargetC: number
  /** Currently selected scenario preset ID, or null when manually edited. */
  selectedPresetId?: string | null
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
 * Sets `selectedPresetId` to the scenario's id.
 */
export function applyScenario(playState: PlayState, scenarioId: string): PlayState {
  const scenario = PLAY_SCENARIOS.find(s => s.id === scenarioId)
  if (!scenario) return playState

  const nextDemands = playState.demands.map(outlet => {
    const presetId = scenario.patch[outlet.outletId]
    return presetId !== undefined ? applyPresetToOutlet(outlet, presetId) : outlet
  })

  return { ...playState, demands: nextDemands, selectedPresetId: scenarioId }
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

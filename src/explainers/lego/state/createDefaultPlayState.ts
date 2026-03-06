// src/explainers/lego/state/createDefaultPlayState.ts
//
// Derives a default PlayState from a saved BuildGraph so Play mode can
// start with sensible per-outlet defaults matching the drawn topology.
//
// Precedence:
//   1. Graph outletBindings resolve which node is bound to each slot (A/B/C).
//   2. The node kind determines the outlet kind and default flow rate.
//   3. Slots with no binding fall back to kind inferred from the slot position.

import type { BuildGraph, PartKind } from '../builder/types'
import type { OutletId } from '../animation/types'
import {
  type PlayState,
  type OutletDemandState,
  type PlayOutletKind,
  type OutletDemandPreset,
  PRESET_FLOWS,
} from './playState'

// ─── Node-kind → outlet kind ──────────────────────────────────────────────────

function outletKindFromNodeKind(nodeKind: PartKind | undefined): PlayOutletKind {
  switch (nodeKind) {
    case 'shower_outlet':   return 'shower'
    case 'bath_outlet':     return 'bath'
    case 'tap_outlet':      return 'basin'
    case 'cold_tap_outlet': return 'cold_tap'
    default:                return 'basin'
  }
}

// ─── Slot-position fallback ───────────────────────────────────────────────────

const SLOT_FALLBACK_KIND: Record<OutletId, PlayOutletKind> = {
  A: 'shower',
  B: 'basin',
  C: 'bath',
}

// ─── Defaults per outlet kind ─────────────────────────────────────────────────

type OutletDefaults = { preset: OutletDemandPreset; flowLpm: number; tempC?: number }

function defaultsForKind(kind: PlayOutletKind): OutletDefaults {
  switch (kind) {
    case 'shower':
      return { preset: 'normal', ...PRESET_FLOWS['normal'] }
    case 'basin':
      return { preset: 'hot', ...PRESET_FLOWS['hot'] }
    case 'bath':
      return { preset: 'fill', ...PRESET_FLOWS['fill'] }
    case 'tap':
      return { preset: 'normal', ...PRESET_FLOWS['normal'] }
    case 'cold_tap':
      return { preset: 'on', ...PRESET_FLOWS['on'] }
    case 'appliance':
      return { preset: 'normal', ...PRESET_FLOWS['normal'] }
  }
}

// ─── Label per outlet kind ────────────────────────────────────────────────────

function labelForKind(kind: PlayOutletKind, slot: OutletId): string {
  const kindLabels: Record<PlayOutletKind, string> = {
    shower:    'Shower',
    basin:     'Basin',
    bath:      'Bath',
    tap:       'Kitchen tap',
    cold_tap:  'Cold tap',
    appliance: 'Appliance',
  }
  return `${kindLabels[kind]} ${slot}`
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Default cold mains inlet temperature (°C). */
const DEFAULT_COLD_INLET_C = 10
/** Default DHW setpoint / hot supply target temperature (°C). */
const DEFAULT_HOT_SUPPLY_TARGET_C = 50

/**
 * Inspect a saved BuildGraph and produce a default PlayState with one
 * OutletDemandState per slot (A, B, C).
 *
 * - Bound outlet nodes drive the outlet kind and label.
 * - Unbound slots fall back to a sensible default per slot position.
 * - Only slot A starts enabled so the simulation does not begin with
 *   simultaneous demand across every outlet.
 */
export function createDefaultPlayState(graph: BuildGraph): PlayState {
  const bindings = graph.outletBindings ?? {}
  const slots: OutletId[] = ['A', 'B', 'C']

  const demands: OutletDemandState[] = slots.map((slot, index) => {
    const nodeId = bindings[slot]
    const node = nodeId ? graph.nodes.find(n => n.id === nodeId) : undefined

    const kind: PlayOutletKind = node
      ? outletKindFromNodeKind(node.kind)
      : SLOT_FALLBACK_KIND[slot]

    const defs = defaultsForKind(kind)

    return {
      outletId: slot,
      label: labelForKind(kind, slot),
      kind,
      // Only the first slot starts enabled; others default to off.
      enabled: index === 0,
      preset: index === 0 ? defs.preset : 'off',
      targetFlowLpm: index === 0 ? defs.flowLpm : 0,
      targetTempC: index === 0 ? defs.tempC : undefined,
    }
  })

  return {
    demands,
    inletTempC: DEFAULT_COLD_INLET_C,
    hotSupplyTargetC: DEFAULT_HOT_SUPPLY_TARGET_C,
    selectedPresetId: null,
  }
}

// src/explainers/lego/state/createDefaultPlayState.ts
//
// Derives a default PlayState from a saved BuildGraph so Play mode can
// start with sensible per-outlet defaults matching the drawn topology.
//
// Precedence:
//   1. Graph outletBindings resolve which node is bound to each slot.
//   2. The node kind determines the outlet kind and default flow rate.
//   3. Slots with no binding fall back to kind inferred from the slot position.

import type { BuildGraph, PartKind } from '../builder/types'
import {
  type PlayState,
  type OutletDemandState,
  type PlayOutletKind,
  type OutletDemandPreset,
  type SupplyConditions,
  PRESET_FLOWS,
} from './playState'
import { resolveSystemTopology } from '../sim/resolveSystemTopology'

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

// ─── Slot-position fallback (for unbound slots) ───────────────────────────────

/**
 * Return a sensible default outlet kind when a slot has no binding in the graph.
 * Uses the slot index to pick: 0→shower, 1→basin, 2→bath, higher→basin.
 */
function fallbackKindForIndex(index: number): PlayOutletKind {
  if (index === 0) return 'shower'
  if (index === 2) return 'bath'
  return 'basin'
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

function labelForKind(kind: PlayOutletKind, slot: string): string {
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
/** Default central-heating flow temperature to emitters (°C). */
const DEFAULT_CH_FLOW_TEMP_C = 70

/**
 * Inspect a saved BuildGraph and produce a default PlayState with one
 * OutletDemandState per outlet node present in the graph.
 *
 * - Bound outlet nodes drive the outlet kind and label.
 * - Unbound slot labels fall back to a sensible default for that position.
 * - Only the first slot starts enabled so the simulation does not begin with
 *   simultaneous demand across every outlet.
 * - If the graph has no outlet nodes (standalone presets), fall back to the
 *   legacy three-slot A/B/C defaults for backward compatibility.
 * - Supply conditions are initialised to topology-appropriate defaults:
 *   vented cylinders start with a 'typical' CWS head preset;
 *   mains-fed systems start with a typical mains flow rate.
 */
export function createDefaultPlayState(graph: BuildGraph): PlayState {
  const bindings = graph.outletBindings ?? {}

  // Determine the ordered list of slots: use the binding keys sorted
  // alphabetically so the Play UI always shows A, B, C, D, … in order.
  // If no bindings exist at all, fall back to the legacy A/B/C defaults.
  const boundSlots = Object.keys(bindings).sort()
  const slots: string[] = boundSlots.length > 0 ? boundSlots : ['A', 'B', 'C']

  const demands: OutletDemandState[] = slots.map((slot, index) => {
    const nodeId = bindings[slot]
    const node = nodeId ? graph.nodes.find(n => n.id === nodeId) : undefined

    const kind: PlayOutletKind = node
      ? outletKindFromNodeKind(node.kind)
      : fallbackKindForIndex(index)

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

  // Derive topology to set appropriate supply condition defaults.
  const topology = resolveSystemTopology(graph)
  const isVented = topology.dhwServiceType === 'vented_cylinder'

  const supplyConditions: SupplyConditions = isVented
    ? {
        inletTempC: DEFAULT_COLD_INLET_C,
        cwsHeadPreset: 'typical',
      }
    : {
        inletTempC: DEFAULT_COLD_INLET_C,
        mainsDynamicFlowLpm: 14,
      }

  return {
    demands,
    heating: {
      enabled: false,
      demandLevel: 1,
      targetFlowTempC: DEFAULT_CH_FLOW_TEMP_C,
    },
    inletTempC: DEFAULT_COLD_INLET_C,
    hotSupplyTargetC: DEFAULT_HOT_SUPPLY_TARGET_C,
    selectedPresetId: null,
    supplyConditions,
  }
}

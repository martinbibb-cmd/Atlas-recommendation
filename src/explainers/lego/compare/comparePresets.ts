// src/explainers/lego/compare/comparePresets.ts
//
// Starter compare scenarios for the compare mode UI.
//
// Each preset generates a CompareSession from concept model graphs so the
// comparison always reflects the canonical topology for each system type.
// No static graphs are stored — `generateGraphFromConcept` produces a fresh
// graph for each scenario at call time.

import type { CompareSession } from './types'
import { generateGraphFromConcept } from '../model/generateGraphFromConcept'
import {
  CANONICAL_COMBI,
  CANONICAL_REGULAR_BOILER,
  CANONICAL_SYSTEM_BOILER,
  CANONICAL_HEAT_PUMP,
} from '../model/types'
import { createDefaultPlayState } from '../state/createDefaultPlayState'

// ─── Scenario builders ────────────────────────────────────────────────────────

/**
 * "Current vented vs combi replacement"
 *
 * Shows:
 *   - on-demand hot water vs stored hot water
 *   - CH interruption in combi during a draw
 *   - mains-pressure vs tank-fed supply
 */
export function buildCurrentVsCombi(): CompareSession {
  const ventedGraph = generateGraphFromConcept(CANONICAL_REGULAR_BOILER)
  const combiGraph  = generateGraphFromConcept(CANONICAL_COMBI)

  // Base play-state on the vented (current) system — gives a CWS head preset.
  const sharedPlayState = createDefaultPlayState(ventedGraph)

  return {
    scenarioName: 'Current vented cylinder vs combi replacement',
    sharedPlayState,
    systems: [
      { id: 'current',      label: 'Current — vented cylinder',       graph: ventedGraph },
      { id: 'combi',        label: 'Option A — combi replacement',     graph: combiGraph  },
    ],
  }
}

/**
 * "Current vented vs unvented cylinder upgrade"
 *
 * Shows:
 *   - stored hot water in both cases
 *   - tank-fed head pressure vs mains-pressure performance
 *   - simultaneous demand comparison
 */
export function buildCurrentVsUnvented(): CompareSession {
  const ventedGraph   = generateGraphFromConcept(CANONICAL_REGULAR_BOILER)
  const unventedGraph = generateGraphFromConcept(CANONICAL_SYSTEM_BOILER)

  const sharedPlayState = createDefaultPlayState(ventedGraph)

  return {
    scenarioName: 'Current vented cylinder vs unvented cylinder upgrade',
    sharedPlayState,
    systems: [
      { id: 'current',   label: 'Current — vented cylinder',         graph: ventedGraph   },
      { id: 'unvented',  label: 'Option A — unvented cylinder',       graph: unventedGraph },
    ],
  }
}

/**
 * "Current vented vs heat pump"
 *
 * Shows:
 *   - low-and-slow heat pump heating vs conventional boiler
 *   - cylinder reheat and DHW recovery differences
 *   - tank-fed vs mains-fed DHW supply
 */
export function buildCurrentVsHeatPump(): CompareSession {
  const ventedGraph    = generateGraphFromConcept(CANONICAL_REGULAR_BOILER)
  const heatPumpGraph  = generateGraphFromConcept(CANONICAL_HEAT_PUMP)

  const sharedPlayState = createDefaultPlayState(ventedGraph)

  return {
    scenarioName: 'Current vented cylinder vs heat pump',
    sharedPlayState,
    systems: [
      { id: 'current',    label: 'Current — vented cylinder',  graph: ventedGraph   },
      { id: 'heat_pump',  label: 'Option A — heat pump',       graph: heatPumpGraph },
    ],
  }
}

/**
 * "Combi vs unvented cylinder vs heat pump" — the full comparison.
 *
 * This is the killer demo scenario that shows three distinct system types
 * side by side under identical demand conditions:
 *   - combi: no storage, CH interrupts on draw
 *   - unvented cylinder: stored, mains-fed, simultaneous-demand friendly
 *   - heat pump: low-temperature primary, cylinder DHW, UFH emitters
 */
export function buildCombiVsUnventedVsHeatPump(): CompareSession {
  const combiGraph     = generateGraphFromConcept(CANONICAL_COMBI)
  const unventedGraph  = generateGraphFromConcept(CANONICAL_SYSTEM_BOILER)
  const heatPumpGraph  = generateGraphFromConcept(CANONICAL_HEAT_PUMP)

  // Base play-state on the combi (mains-fed defaults).
  const sharedPlayState = createDefaultPlayState(combiGraph)

  return {
    scenarioName: 'Combi vs unvented cylinder vs heat pump',
    sharedPlayState,
    systems: [
      { id: 'combi',      label: 'Combi boiler',          graph: combiGraph    },
      { id: 'unvented',   label: 'Unvented cylinder',     graph: unventedGraph },
      { id: 'heat_pump',  label: 'Heat pump',             graph: heatPumpGraph },
    ],
  }
}

// ─── Preset registry ──────────────────────────────────────────────────────────

export type ComparePreset = {
  id: string
  label: string
  description: string
  build: () => CompareSession
}

/**
 * Registry of all built-in compare presets.
 * Used by `CompareModeShell` to populate the scenario picker.
 */
export const COMPARE_PRESETS: ComparePreset[] = [
  {
    id: 'current_vs_combi',
    label: 'Current vs combi',
    description: 'Compare a vented cylinder system with a combi replacement under the same demand.',
    build: buildCurrentVsCombi,
  },
  {
    id: 'current_vs_unvented',
    label: 'Current vs unvented cylinder',
    description: 'Compare a vented cylinder with an unvented (mains-fed) cylinder upgrade.',
    build: buildCurrentVsUnvented,
  },
  {
    id: 'current_vs_heat_pump',
    label: 'Current vs heat pump',
    description: 'Compare a vented cylinder system with a heat pump under the same demand.',
    build: buildCurrentVsHeatPump,
  },
  {
    id: 'combi_vs_unvented_vs_hp',
    label: 'Combi vs unvented vs heat pump',
    description: 'Three-way comparison of on-demand, stored mains-fed, and heat pump systems.',
    build: buildCombiVsUnventedVsHeatPump,
  },
]

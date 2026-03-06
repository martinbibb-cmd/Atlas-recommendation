// src/explainers/lego/__tests__/compareMode.test.ts
//
// Tests for the compare mode pipeline:
//   - CompareSession types
//   - runCompareSession produces one card per system
//   - summariseCompareResult produces correct labels
//   - Compare presets build valid sessions
//   - Shared play-state drives all systems equally

import { describe, it, expect } from 'vitest'
import { runCompareSession } from '../compare/runCompareSession'
import { summariseCompareResult } from '../compare/summariseCompareResult'
import {
  buildCurrentVsCombi,
  buildCurrentVsUnvented,
  buildCurrentVsHeatPump,
  buildCombiVsUnventedVsHeatPump,
  COMPARE_PRESETS,
} from '../compare/comparePresets'
import type { CompareSession, CompareSystemEntry } from '../compare/types'
import type { ResolvedSystemTopology } from '../sim/resolveSystemTopology'
import type { CapacitySummary } from '../animation/capacitySummary'
import { generateGraphFromConcept } from '../model/generateGraphFromConcept'
import {
  CANONICAL_COMBI,
  CANONICAL_REGULAR_BOILER,
  CANONICAL_SYSTEM_BOILER,
  CANONICAL_HEAT_PUMP,
} from '../model/types'
import { createDefaultPlayState } from '../state/createDefaultPlayState'
import { applyScenario } from '../state/playState'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTopology(
  dhwServiceType: ResolvedSystemTopology['dhwServiceType'],
  hasHeatingCircuit = true,
): ResolvedSystemTopology {
  return {
    dhwServiceType,
    dhwSupplyType:
      dhwServiceType === 'vented_cylinder' ? 'cws_tank'
      : dhwServiceType === 'none' ? 'none'
      : 'mains',
    hasPrimaryCoil: dhwServiceType !== 'combi' && dhwServiceType !== 'none',
    hasHeatingCircuit,
    controlTopology: 'none',
  }
}

function makeCapacitySummary(overrides: Partial<CapacitySummary> = {}): CapacitySummary {
  return {
    demandTotalLpm: 10,
    supplyCapLpm: 14,
    pipeCapLpm: Infinity,
    thermalCapLpm: Infinity,
    hydraulicFlowLpm: 10,
    limitingComponent: 'Demand',
    warnings: [],
    outletDeliveredLpm: { A: 10, B: 0, C: 0 },
    hexFlowLpm: 10,
    coldBypassLpm: 0,
    hotFedCount: 1,
    mode: 'dhw_draw',
    badges: [],
    ...overrides,
  }
}

// ─── runCompareSession ────────────────────────────────────────────────────────

describe('runCompareSession', () => {
  it('returns one card per system entry', () => {
    const session = buildCurrentVsCombi()
    const cards = runCompareSession(session)
    expect(cards).toHaveLength(session.systems.length)
    expect(cards).toHaveLength(2)
  })

  it('each card systemId matches its entry id', () => {
    const session = buildCurrentVsCombi()
    const cards = runCompareSession(session)
    cards.forEach((card, i) => {
      expect(card.systemId).toBe(session.systems[i].id)
    })
  })

  it('each card label matches its entry label', () => {
    const session = buildCurrentVsUnvented()
    const cards = runCompareSession(session)
    cards.forEach((card, i) => {
      expect(card.label).toBe(session.systems[i].label)
    })
  })

  it('three-way comparison returns three cards', () => {
    const session = buildCombiVsUnventedVsHeatPump()
    const cards = runCompareSession(session)
    expect(cards).toHaveLength(3)
  })

  it('all cards have non-empty topologyLabel', () => {
    const session = buildCombiVsUnventedVsHeatPump()
    const cards = runCompareSession(session)
    cards.forEach(card => {
      expect(card.topologyLabel.length).toBeGreaterThan(0)
    })
  })

  it('all cards have a non-empty headline', () => {
    const session = buildCombiVsUnventedVsHeatPump()
    const cards = runCompareSession(session)
    cards.forEach(card => {
      expect(card.headline.length).toBeGreaterThan(0)
    })
  })

  it('cards have a warnings array (may be empty)', () => {
    const session = buildCurrentVsCombi()
    const cards = runCompareSession(session)
    cards.forEach(card => {
      expect(Array.isArray(card.warnings)).toBe(true)
    })
  })
})

// ─── Shared play-state drives all systems ─────────────────────────────────────

describe('runCompareSession — shared play-state', () => {
  it('heating scenario applies to all systems', () => {
    let session = buildCurrentVsCombi()
    session = {
      ...session,
      sharedPlayState: applyScenario(session.sharedPlayState, 'heating-only'),
    }
    const cards = runCompareSession(session)
    // Both systems should reflect heating-only mode
    cards.forEach(card => {
      expect(card.operatingMode).toContain('Heating')
    })
  })

  it('shower-only scenario reflects DHW demand in all systems', () => {
    let session = buildCurrentVsCombi()
    session = {
      ...session,
      sharedPlayState: applyScenario(session.sharedPlayState, 'shower-only'),
    }
    const cards = runCompareSession(session)
    // All systems should show some kind of DHW-related result
    cards.forEach(card => {
      expect(
        card.operatingMode.includes('hot water') ||
        card.operatingMode.includes('Hot water') ||
        card.dhwSummary.includes('L/min')
      ).toBe(true)
    })
  })

  it('idle scenario results in idle operating mode for all systems', () => {
    let session = buildCurrentVsCombi()
    session = {
      ...session,
      sharedPlayState: applyScenario(session.sharedPlayState, 'all-off'),
    }
    const cards = runCompareSession(session)
    cards.forEach(card => {
      expect(card.operatingMode).toBe('Idle')
    })
  })
})

// ─── summariseCompareResult ───────────────────────────────────────────────────

describe('summariseCompareResult', () => {
  it('combi idle — reports idle operating mode', () => {
    const graph = generateGraphFromConcept(CANONICAL_COMBI)
    const entry: CompareSystemEntry = { id: 'combi', label: 'Combi', graph }
    const topology = makeTopology('combi')
    const playState = applyScenario(createDefaultPlayState(graph), 'all-off')
    const summary = makeCapacitySummary({ hydraulicFlowLpm: 0, demandTotalLpm: 0, limitingComponent: 'Demand' })

    const card = summariseCompareResult(entry, topology, summary, playState)
    expect(card.operatingMode).toBe('Idle')
  })

  it('combi with DHW draw — reports DHW-only mode', () => {
    const graph = generateGraphFromConcept(CANONICAL_COMBI)
    const entry: CompareSystemEntry = { id: 'combi', label: 'Combi', graph }
    const topology = makeTopology('combi')
    const playState = applyScenario(createDefaultPlayState(graph), 'shower-only')
    const summary = makeCapacitySummary({ hydraulicFlowLpm: 10, demandTotalLpm: 10 })

    const card = summariseCompareResult(entry, topology, summary, playState)
    expect(card.operatingMode).toBe('On-demand hot water')
  })

  it('combi — heating pauses during shower headline', () => {
    const graph = generateGraphFromConcept(CANONICAL_COMBI)
    const entry: CompareSystemEntry = { id: 'combi', label: 'Combi', graph }
    const topology = makeTopology('combi')
    const playState = applyScenario(createDefaultPlayState(graph), 'heating-and-shower')
    const summary = makeCapacitySummary({ hydraulicFlowLpm: 10, demandTotalLpm: 10 })

    const card = summariseCompareResult(entry, topology, summary, playState)
    expect(card.headline).toContain('pauses')
    expect(card.heatingSummary).toContain('paused')
  })

  it('vented cylinder — tank-fed supply bottleneck reported correctly', () => {
    const graph = generateGraphFromConcept(CANONICAL_REGULAR_BOILER)
    const entry: CompareSystemEntry = { id: 'vented', label: 'Vented', graph }
    const topology = makeTopology('vented_cylinder')
    const playState = applyScenario(createDefaultPlayState(graph), 'shower-only')
    const summary = makeCapacitySummary({
      hydraulicFlowLpm: 6,
      demandTotalLpm: 10,
      limitingComponent: 'Supply',
    })

    const card = summariseCompareResult(entry, topology, summary, playState)
    expect(card.bottleneck).toContain('tank-fed')
    expect(card.headline).toContain('tank-fed')
  })

  it('unvented cylinder — stored hot water headline', () => {
    const graph = generateGraphFromConcept(CANONICAL_SYSTEM_BOILER)
    const entry: CompareSystemEntry = { id: 'unvented', label: 'Unvented', graph }
    const topology = makeTopology('unvented_cylinder')
    const playState = applyScenario(createDefaultPlayState(graph), 'shower-only')
    const summary = makeCapacitySummary({ hydraulicFlowLpm: 10, demandTotalLpm: 10 })

    const card = summariseCompareResult(entry, topology, summary, playState)
    expect(card.headline).toContain('Stored')
  })

  it('heating-only system — no hot water service in dhwSummary', () => {
    const graph = generateGraphFromConcept(CANONICAL_COMBI)
    const entry: CompareSystemEntry = { id: 'heat_only', label: 'Heating only', graph }
    const topology = makeTopology('none')
    const playState = applyScenario(createDefaultPlayState(graph), 'heating-only')
    const summary = makeCapacitySummary({ hydraulicFlowLpm: 0, demandTotalLpm: 0, limitingComponent: 'Demand' })

    const card = summariseCompareResult(entry, topology, summary, playState)
    expect(card.dhwSummary).toContain('No hot water service')
  })

  it('no bottleneck field when supply is not the limiting factor', () => {
    const graph = generateGraphFromConcept(CANONICAL_COMBI)
    const entry: CompareSystemEntry = { id: 'combi', label: 'Combi', graph }
    const topology = makeTopology('combi')
    const playState = applyScenario(createDefaultPlayState(graph), 'shower-only')
    const summary = makeCapacitySummary({ limitingComponent: 'Demand', hydraulicFlowLpm: 10 })

    const card = summariseCompareResult(entry, topology, summary, playState)
    expect(card.bottleneck).toBeUndefined()
  })
})

// ─── Compare presets ──────────────────────────────────────────────────────────

describe('comparePresets', () => {
  it('COMPARE_PRESETS has 4 entries', () => {
    expect(COMPARE_PRESETS).toHaveLength(4)
  })

  it('each preset has a unique id', () => {
    const ids = COMPARE_PRESETS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('buildCurrentVsCombi returns 2 systems', () => {
    const session = buildCurrentVsCombi()
    expect(session.systems).toHaveLength(2)
  })

  it('buildCurrentVsUnvented returns 2 systems', () => {
    const session = buildCurrentVsUnvented()
    expect(session.systems).toHaveLength(2)
  })

  it('buildCurrentVsHeatPump returns 2 systems', () => {
    const session = buildCurrentVsHeatPump()
    expect(session.systems).toHaveLength(2)
  })

  it('buildCombiVsUnventedVsHeatPump returns 3 systems', () => {
    const session = buildCombiVsUnventedVsHeatPump()
    expect(session.systems).toHaveLength(3)
  })

  it('each preset build() returns a session with a non-empty scenarioName', () => {
    COMPARE_PRESETS.forEach(preset => {
      const session = preset.build()
      expect(session.scenarioName).toBeTruthy()
    })
  })

  it('all systems in every preset have distinct ids', () => {
    COMPARE_PRESETS.forEach(preset => {
      const session = preset.build()
      const ids = session.systems.map(s => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  it('each preset produces cards whose topology reflects different systems', () => {
    // The three-way preset should produce at least 2 distinct topologyLabel values
    const session = buildCombiVsUnventedVsHeatPump()
    const cards = runCompareSession(session)
    const topologies = new Set(cards.map(c => c.topologyLabel))
    expect(topologies.size).toBeGreaterThan(1)
  })

  it('shared play-state is a valid PlayState', () => {
    COMPARE_PRESETS.forEach(preset => {
      const session = preset.build()
      const { sharedPlayState } = session
      expect(sharedPlayState.demands).toHaveLength(3)
      expect(sharedPlayState.heating).toBeDefined()
      expect(sharedPlayState.supplyConditions).toBeDefined()
    })
  })
})

// ─── CompareSession type contract ─────────────────────────────────────────────

describe('CompareSession contract', () => {
  it('session with 0 systems returns empty cards array', () => {
    const graph = generateGraphFromConcept(CANONICAL_COMBI)
    const session: CompareSession = {
      sharedPlayState: createDefaultPlayState(graph),
      systems: [],
    }
    const cards = runCompareSession(session)
    expect(cards).toHaveLength(0)
  })

  it('session with 4 systems returns 4 cards', () => {
    const combi    = generateGraphFromConcept(CANONICAL_COMBI)
    const vented   = generateGraphFromConcept(CANONICAL_REGULAR_BOILER)
    const unvented = generateGraphFromConcept(CANONICAL_SYSTEM_BOILER)
    const hp       = generateGraphFromConcept(CANONICAL_HEAT_PUMP)

    const session: CompareSession = {
      sharedPlayState: createDefaultPlayState(combi),
      systems: [
        { id: 'a', label: 'Combi',    graph: combi    },
        { id: 'b', label: 'Vented',   graph: vented   },
        { id: 'c', label: 'Unvented', graph: unvented },
        { id: 'd', label: 'HP',       graph: hp       },
      ],
    }
    const cards = runCompareSession(session)
    expect(cards).toHaveLength(4)
  })
})

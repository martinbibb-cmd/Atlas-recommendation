// src/explainers/lego/__tests__/playState.test.ts
//
// Tests for playState helpers and createDefaultPlayState.

import { describe, it, expect } from 'vitest'
import {
  applyPresetToOutlet,
  applyScenario,
  outletDemandToControl,
  playStateToOutletControls,
  determineOperatingMode,
  PRESET_FLOWS,
  PLAY_SCENARIOS,
  type OutletDemandState,
  type PlayState,
} from '../state/playState'
import { createDefaultPlayState } from '../state/createDefaultPlayState'
import type { BuildGraph } from '../builder/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOutlet(
  overrides: Partial<OutletDemandState> = {},
): OutletDemandState {
  return {
    outletId: 'A',
    label: 'Shower A',
    kind: 'shower',
    enabled: true,
    preset: 'normal',
    targetFlowLpm: 10,
    targetTempC: 40,
    ...overrides,
  }
}

function makePlayState(overrides: Partial<PlayState> = {}): PlayState {
  return {
    demands: [
      makeOutlet({ outletId: 'A', kind: 'shower', enabled: true,  preset: 'normal', targetFlowLpm: 10 }),
      makeOutlet({ outletId: 'B', kind: 'basin',  enabled: false, preset: 'off',    targetFlowLpm: 0 }),
      makeOutlet({ outletId: 'C', kind: 'bath',   enabled: false, preset: 'off',    targetFlowLpm: 0 }),
    ],
    heating: { enabled: false, demandLevel: 1, targetFlowTempC: 70 },
    inletTempC: 10,
    hotSupplyTargetC: 50,
    selectedPresetId: null,
    ...overrides,
  }
}

function makeEmptyGraph(): BuildGraph {
  return { nodes: [], edges: [] }
}

function makeGraphWithBindings(): BuildGraph {
  return {
    nodes: [
      { id: 'shower_1', kind: 'shower_outlet', x: 0, y: 0, r: 0 },
      { id: 'basin_1',  kind: 'tap_outlet',    x: 0, y: 0, r: 0 },
      { id: 'bath_1',   kind: 'bath_outlet',   x: 0, y: 0, r: 0 },
    ],
    edges: [],
    outletBindings: { A: 'shower_1', B: 'basin_1', C: 'bath_1' },
  }
}

// ─── applyPresetToOutlet ──────────────────────────────────────────────────────

describe('applyPresetToOutlet', () => {
  it('sets enabled=false and flowLpm=0 for off', () => {
    const outlet = makeOutlet()
    const result = applyPresetToOutlet(outlet, 'off')
    expect(result.enabled).toBe(false)
    expect(result.targetFlowLpm).toBe(0)
    expect(result.preset).toBe('off')
  })

  it('sets eco flow and temp', () => {
    const outlet = makeOutlet()
    const result = applyPresetToOutlet(outlet, 'eco')
    expect(result.enabled).toBe(true)
    expect(result.targetFlowLpm).toBe(PRESET_FLOWS.eco.flowLpm)
    expect(result.targetTempC).toBe(PRESET_FLOWS.eco.tempC)
  })

  it('sets normal flow for shower', () => {
    const outlet = makeOutlet()
    const result = applyPresetToOutlet(outlet, 'normal')
    expect(result.targetFlowLpm).toBe(10)
    expect(result.enabled).toBe(true)
    expect(result.preset).toBe('normal')
  })

  it('sets high flow for shower', () => {
    const outlet = makeOutlet()
    const result = applyPresetToOutlet(outlet, 'high')
    expect(result.targetFlowLpm).toBe(12)
  })

  it('sets fill flow for bath', () => {
    const outlet = makeOutlet({ kind: 'bath' })
    const result = applyPresetToOutlet(outlet, 'fill')
    expect(result.targetFlowLpm).toBe(PRESET_FLOWS.fill.flowLpm)
    expect(result.enabled).toBe(true)
  })

  it('preserves outletId and label', () => {
    const outlet = makeOutlet({ outletId: 'C', label: 'Bath C' })
    const result = applyPresetToOutlet(outlet, 'fill')
    expect(result.outletId).toBe('C')
    expect(result.label).toBe('Bath C')
  })
})

// ─── applyScenario ────────────────────────────────────────────────────────────

describe('applyScenario', () => {
  it('applies shower-only preset correctly', () => {
    const state = makePlayState()
    const next = applyScenario(state, 'shower-only')
    const a = next.demands.find(d => d.outletId === 'A')!
    const b = next.demands.find(d => d.outletId === 'B')!
    const c = next.demands.find(d => d.outletId === 'C')!
    expect(a.enabled).toBe(true)
    expect(a.preset).toBe('normal')
    expect(b.enabled).toBe(false)
    expect(c.enabled).toBe(false)
    expect(next.selectedPresetId).toBe('shower-only')
  })

  it('applies bath-fill preset correctly', () => {
    const state = makePlayState()
    const next = applyScenario(state, 'bath-fill')
    const a = next.demands.find(d => d.outletId === 'A')!
    const c = next.demands.find(d => d.outletId === 'C')!
    expect(a.enabled).toBe(false)
    expect(c.enabled).toBe(true)
    expect(c.preset).toBe('fill')
    expect(c.targetFlowLpm).toBe(PRESET_FLOWS.fill.flowLpm)
  })

  it('applies all-off scenario', () => {
    const state = makePlayState()
    const next = applyScenario(state, 'all-off')
    for (const d of next.demands) {
      expect(d.enabled).toBe(false)
      expect(d.targetFlowLpm).toBe(0)
    }
  })

  it('applies shower+basin scenario', () => {
    const state = makePlayState()
    const next = applyScenario(state, 'shower-basin')
    const a = next.demands.find(d => d.outletId === 'A')!
    const b = next.demands.find(d => d.outletId === 'B')!
    expect(a.enabled).toBe(true)
    expect(b.enabled).toBe(true)
  })

  it('returns unchanged state for unknown scenario id', () => {
    const state = makePlayState()
    const next = applyScenario(state, 'non-existent-id')
    expect(next).toBe(state)
  })

  it('all PLAY_SCENARIOS apply without throwing', () => {
    const state = makePlayState()
    for (const scenario of PLAY_SCENARIOS) {
      expect(() => applyScenario(state, scenario.id)).not.toThrow()
    }
  })
})

// ─── outletDemandToControl ────────────────────────────────────────────────────

describe('outletDemandToControl', () => {
  it('maps shower kind to shower_mixer with TMV', () => {
    const demand = makeOutlet({ kind: 'shower', targetTempC: 40 })
    const ctrl = outletDemandToControl(demand)
    expect(ctrl.kind).toBe('shower_mixer')
    expect(ctrl.tmvEnabled).toBe(true)
    expect(ctrl.tmvTargetTempC).toBe(40)
  })

  it('maps basin kind correctly', () => {
    const demand = makeOutlet({ kind: 'basin', targetTempC: 40 })
    const ctrl = outletDemandToControl(demand)
    expect(ctrl.kind).toBe('basin')
    expect(ctrl.tmvEnabled).toBeUndefined()
  })

  it('maps bath kind correctly', () => {
    const demand = makeOutlet({ kind: 'bath', targetTempC: 40 })
    const ctrl = outletDemandToControl(demand)
    expect(ctrl.kind).toBe('bath')
  })

  it('maps cold_tap kind correctly', () => {
    const demand = makeOutlet({ kind: 'cold_tap', targetTempC: undefined })
    const ctrl = outletDemandToControl(demand)
    expect(ctrl.kind).toBe('cold_tap')
    expect(ctrl.tmvEnabled).toBeUndefined()
  })

  it('maps tap kind to basin as simulation kind', () => {
    const demand = makeOutlet({ kind: 'tap' })
    const ctrl = outletDemandToControl(demand)
    expect(ctrl.kind).toBe('basin')
  })

  it('preserves enabled and demandLpm', () => {
    const demand = makeOutlet({ enabled: false, targetFlowLpm: 7 })
    const ctrl = outletDemandToControl(demand)
    expect(ctrl.enabled).toBe(false)
    expect(ctrl.demandLpm).toBe(7)
  })
})

// ─── playStateToOutletControls ────────────────────────────────────────────────

describe('playStateToOutletControls', () => {
  it('returns exactly 3 controls for a 3-slot state', () => {
    const state = makePlayState()
    const controls = playStateToOutletControls(state.demands)
    expect(controls).toHaveLength(3)
    expect(controls.map(c => c.id)).toEqual(['A', 'B', 'C'])
  })

  it('returns only the supplied demands (no automatic back-fill)', () => {
    // Dynamic model: only outlet A → only 1 control returned.
    const controls = playStateToOutletControls([
      makeOutlet({ outletId: 'A' }),
    ])
    expect(controls).toHaveLength(1)
    expect(controls[0].id).toBe('A')
    // B and C are not in the list
    expect(controls.find(c => c.id === 'B')).toBeUndefined()
    expect(controls.find(c => c.id === 'C')).toBeUndefined()
  })

  it('preserves enabled state from demands', () => {
    const state = makePlayState()
    const controls = playStateToOutletControls(state.demands)
    expect(controls.find(c => c.id === 'A')?.enabled).toBe(true)
    expect(controls.find(c => c.id === 'B')?.enabled).toBe(false)
    expect(controls.find(c => c.id === 'C')?.enabled).toBe(false)
  })
})

// ─── createDefaultPlayState ───────────────────────────────────────────────────

describe('createDefaultPlayState', () => {
  it('returns 3 demands for an empty graph', () => {
    const state = createDefaultPlayState(makeEmptyGraph())
    expect(state.demands).toHaveLength(3)
  })

  it('falls back to slot-position defaults when no bindings exist', () => {
    const state = createDefaultPlayState(makeEmptyGraph())
    expect(state.demands[0].kind).toBe('shower')  // A
    expect(state.demands[1].kind).toBe('basin')   // B
    expect(state.demands[2].kind).toBe('bath')    // C
  })

  it('only enables slot A by default', () => {
    const state = createDefaultPlayState(makeEmptyGraph())
    expect(state.demands[0].enabled).toBe(true)
    expect(state.demands[1].enabled).toBe(false)
    expect(state.demands[2].enabled).toBe(false)
  })

  it('infers outlet kind from node kind when bindings exist', () => {
    const graph = makeGraphWithBindings()
    const state = createDefaultPlayState(graph)
    expect(state.demands.find(d => d.outletId === 'A')?.kind).toBe('shower')
    expect(state.demands.find(d => d.outletId === 'B')?.kind).toBe('basin')
    expect(state.demands.find(d => d.outletId === 'C')?.kind).toBe('bath')
  })

  it('infers cold_tap kind for cold_tap_outlet nodes', () => {
    const graph: BuildGraph = {
      nodes: [{ id: 'cold1', kind: 'cold_tap_outlet', x: 0, y: 0, r: 0 }],
      edges: [],
      outletBindings: { A: 'cold1' },
    }
    const state = createDefaultPlayState(graph)
    const slotA = state.demands.find(d => d.outletId === 'A')!
    expect(slotA.kind).toBe('cold_tap')
  })

  it('sets sensible flow defaults for each kind', () => {
    const state = createDefaultPlayState(makeEmptyGraph())
    const shower = state.demands[0]
    // Slot A (shower) should have non-zero flow since it starts enabled
    expect(shower.targetFlowLpm).toBeGreaterThan(0)
  })

  it('sets inletTempC=10 and hotSupplyTargetC=50', () => {
    const state = createDefaultPlayState(makeEmptyGraph())
    expect(state.inletTempC).toBe(10)
    expect(state.hotSupplyTargetC).toBe(50)
  })

  it('starts with selectedPresetId=null', () => {
    const state = createDefaultPlayState(makeEmptyGraph())
    expect(state.selectedPresetId).toBeNull()
  })

  it('initialises heating with enabled=false', () => {
    const state = createDefaultPlayState(makeEmptyGraph())
    expect(state.heating).toBeDefined()
    expect(state.heating.enabled).toBe(false)
  })

  it('initialises heating with a default flow temperature', () => {
    const state = createDefaultPlayState(makeEmptyGraph())
    expect(state.heating.targetFlowTempC).toBeDefined()
    expect(state.heating.targetFlowTempC).toBeGreaterThan(0)
  })
})

// ─── applyScenario with heatingPatch ─────────────────────────────────────────

describe('applyScenario — heating-related scenarios', () => {
  it('heating-only scenario enables heating and turns off all outlets', () => {
    const state = makePlayState()
    const next = applyScenario(state, 'heating-only')
    expect(next.heating.enabled).toBe(true)
    for (const d of next.demands) expect(d.enabled).toBe(false)
    expect(next.selectedPresetId).toBe('heating-only')
  })

  it('heating-and-shower scenario enables heating and outlet A', () => {
    const state = makePlayState()
    const next = applyScenario(state, 'heating-and-shower')
    expect(next.heating.enabled).toBe(true)
    expect(next.demands.find(d => d.outletId === 'A')?.enabled).toBe(true)
  })

  it('all-off scenario does not change heating state (no heatingPatch)', () => {
    const state = makePlayState({ heating: { enabled: true, demandLevel: 1 } })
    const next = applyScenario(state, 'all-off')
    expect(next.heating.enabled).toBe(true)
  })
})

// ─── determineOperatingMode ───────────────────────────────────────────────────

describe('determineOperatingMode', () => {
  it('returns IDLE when no heating and no DHW', () => {
    const state = makePlayState({
      demands: [
        makeOutlet({ outletId: 'A', kind: 'shower', enabled: false, targetFlowLpm: 0 }),
        makeOutlet({ outletId: 'B', kind: 'basin',  enabled: false, targetFlowLpm: 0 }),
        makeOutlet({ outletId: 'C', kind: 'bath',   enabled: false, targetFlowLpm: 0 }),
      ],
      heating: { enabled: false },
    })
    expect(determineOperatingMode(state)).toBe('IDLE')
  })

  it('returns DHW_ONLY when DHW active and no heating', () => {
    const state = makePlayState({
      heating: { enabled: false },
    })
    expect(determineOperatingMode(state)).toBe('DHW_ONLY')
  })

  it('returns CH_ONLY when heating active and no DHW', () => {
    const state = makePlayState({
      demands: [
        makeOutlet({ outletId: 'A', kind: 'shower', enabled: false, targetFlowLpm: 0 }),
        makeOutlet({ outletId: 'B', kind: 'basin',  enabled: false, targetFlowLpm: 0 }),
        makeOutlet({ outletId: 'C', kind: 'bath',   enabled: false, targetFlowLpm: 0 }),
      ],
      heating: { enabled: true, demandLevel: 1 },
    })
    expect(determineOperatingMode(state)).toBe('CH_ONLY')
  })

  it('combi: returns DHW_ONLY when both heating and DHW active (DHW priority)', () => {
    const state = makePlayState({
      heating: { enabled: true, demandLevel: 1 },
    })
    expect(determineOperatingMode(state, 'combi')).toBe('DHW_ONLY')
  })

  it('cylinder: returns CH_AND_DHW when both heating and DHW active', () => {
    const state = makePlayState({
      heating: { enabled: true, demandLevel: 1 },
    })
    expect(determineOperatingMode(state, 'unvented_cylinder')).toBe('CH_AND_DHW')
  })

  it('defaults to combi behaviour when systemType not provided', () => {
    const state = makePlayState({
      heating: { enabled: true, demandLevel: 1 },
    })
    expect(determineOperatingMode(state)).toBe('DHW_ONLY')
  })
})

// ─── PR10 — combiDhwKw in SupplyConditions ────────────────────────────────────

describe('SupplyConditions — combiDhwKw field', () => {
  it('createDefaultPlayState leaves combiDhwKw undefined by default', () => {
    const state = createDefaultPlayState(makeEmptyGraph())
    expect(state.supplyConditions.combiDhwKw).toBeUndefined()
  })

  it('combiDhwKw can be set in supplyConditions', () => {
    const state = createDefaultPlayState(makeEmptyGraph())
    const updated: typeof state = {
      ...state,
      supplyConditions: { ...state.supplyConditions, combiDhwKw: 32 },
    }
    expect(updated.supplyConditions.combiDhwKw).toBe(32)
  })

  it('SupplyConditions accepts all expected combi kW values', () => {
    const base = createDefaultPlayState(makeEmptyGraph()).supplyConditions
    const values = [24, 28, 32, 36, 40] as const
    for (const kw of values) {
      const sc = { ...base, combiDhwKw: kw }
      expect(sc.combiDhwKw).toBe(kw)
    }
  })

  it('SupplyConditions with combiDhwKw undefined is valid (uses simulation default)', () => {
    const sc: import('../state/playState').SupplyConditions = {
      inletTempC: 10,
      mainsDynamicFlowLpm: 14,
      // combiDhwKw intentionally absent → simulation uses its default (30 kW)
    }
    expect(sc.combiDhwKw).toBeUndefined()
  })
})

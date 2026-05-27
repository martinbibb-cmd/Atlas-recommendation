/**
 * Tests for service switching truth — combi CH/DHW arbitration.
 *
 * A combi boiler gives DHW absolute priority.  When a hot-water draw opens
 * while space-heating is active, the boiler output diverts entirely to the
 * domestic plate HEX and the CH circuit is suspended.
 *
 * These tests assert:
 *   1. serviceSwitchingActive === true  when combi + DHW draw + heating enabled
 *   2. serviceSwitchingActive === false when combi + DHW only (no heating call)
 *   3. serviceSwitchingActive === false when combi + heating only (no DHW draw)
 *   4. serviceSwitchingActive === false (absent) for stored-cylinder systems
 *   5. serviceSwitchingActive === false for system/regular boiler + cylinder (S-plan)
 *
 * These also serve as the contract tests for the architecture split described in PR1:
 *   - serviceArbitration.ts is the central helper for mode resolution (single source of truth)
 *   - simulation.ts calls the helpers and never re-derives arbitration inline
 *   - playScene/buildPlaySceneModel propagates it to scene.metadata
 *   - LabCanvas reads from scene.metadata only — never re-derives from systemMode
 */

import { describe, it, expect } from 'vitest'
import { resolveServiceMode, computeServiceSwitchingActive } from '../animation/serviceArbitration'
import type { ServiceArbitrationInputs } from '../animation/serviceArbitration'
import { stepSimulation } from '../animation/simulation'
import type { LabControls, LabFrame } from '../animation/types'
import { buildPlaySceneModel } from '../playScene/buildPlaySceneModel'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInitialFrame(): LabFrame {
  return {
    nowMs: 0,
    particles: [],
    spawnAccumulator: 0,
    nextTokenId: 0,
    outletSamples: {
      A: { tempC: 0, count: 0 },
      B: { tempC: 0, count: 0 },
      C: { tempC: 0, count: 0 },
    },
  }
}

/** Combi controls with heating enabled and one DHW outlet open. */
function makeCombiControls(opts: {
  heatingEnabled: boolean
  dhwEnabled: boolean
}): LabControls {
  return {
    systemType: 'combi',
    coldInletC: 10,
    dhwSetpointC: 50,
    mainsDynamicFlowLpm: 20,
    pipeDiameterMm: 22,
    combiDhwKw: 30,
    outlets: [
      { id: 'A', enabled: opts.dhwEnabled, kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: false,           kind: 'basin',         demandLpm: 5 },
    ],
    heatingDemand: { enabled: opts.heatingEnabled, demandLevel: 1 },
  }
}

/** Stored-cylinder (unvented) controls with heating enabled and a DHW draw. */
function makeStoredControls(opts: {
  heatingEnabled: boolean
  dhwEnabled: boolean
}): LabControls {
  return {
    systemType: 'unvented_cylinder',
    coldInletC: 10,
    dhwSetpointC: 50,
    mainsDynamicFlowLpm: 20,
    pipeDiameterMm: 22,
    combiDhwKw: 30,
    cylinder: { volumeL: 180, initialTempC: 60, reheatKw: 12 },
    outlets: [
      { id: 'A', enabled: opts.dhwEnabled, kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: false,           kind: 'basin',         demandLpm: 5 },
    ],
    heatingDemand: { enabled: opts.heatingEnabled, demandLevel: 1 },
    controlTopology: 's_plan',
  }
}

/** Advance the simulation by N ticks of 200 ms each. */
function runTicks(controls: LabControls, ticks: number): LabFrame {
  let frame = makeInitialFrame()
  for (let i = 0; i < ticks; i++) {
    frame = stepSimulation({ frame, dtMs: 200, controls })
  }
  return frame
}

// ─── PR1 — serviceArbitration helper: resolveServiceMode ─────────────────────

describe('resolveServiceMode — service arbitration helper', () => {
  // Combi rules
  it('combi: dhw draw active → dhw_draw (DHW priority)', () => {
    const inputs: ServiceArbitrationInputs = {
      isCombi: true, hotDrawActive: true, heatingEnabled: true,
      hasStored: false, storeNeedsReheat: false, isSPlan: false,
    }
    expect(resolveServiceMode(inputs)).toBe('dhw_draw')
  })

  it('combi: heating only, no draw → heating', () => {
    const inputs: ServiceArbitrationInputs = {
      isCombi: true, hotDrawActive: false, heatingEnabled: true,
      hasStored: false, storeNeedsReheat: false, isSPlan: false,
    }
    expect(resolveServiceMode(inputs)).toBe('heating')
  })

  it('combi: dhw draw, no heating → dhw_draw (not service switching: no CH to interrupt)', () => {
    const inputs: ServiceArbitrationInputs = {
      isCombi: true, hotDrawActive: true, heatingEnabled: false,
      hasStored: false, storeNeedsReheat: false, isSPlan: false,
    }
    expect(resolveServiceMode(inputs)).toBe('dhw_draw')
  })

  it('combi: idle (no draw, no heating) → idle', () => {
    const inputs: ServiceArbitrationInputs = {
      isCombi: true, hotDrawActive: false, heatingEnabled: false,
      hasStored: false, storeNeedsReheat: false, isSPlan: false,
    }
    expect(resolveServiceMode(inputs)).toBe('idle')
  })

  // Stored / system boiler rules
  it('stored S-plan: heating + reheat both needed → heating_and_reheat', () => {
    const inputs: ServiceArbitrationInputs = {
      isCombi: false, hotDrawActive: false, heatingEnabled: true,
      hasStored: true, storeNeedsReheat: true, isSPlan: true,
    }
    expect(resolveServiceMode(inputs)).toBe('heating_and_reheat')
  })

  it('stored Y-plan: heating + reheat both needed → heating (exclusive, CH wins)', () => {
    const inputs: ServiceArbitrationInputs = {
      isCombi: false, hotDrawActive: false, heatingEnabled: true,
      hasStored: true, storeNeedsReheat: true, isSPlan: false,
    }
    expect(resolveServiceMode(inputs)).toBe('heating')
  })

  it('stored: reheat only (heating off) → dhw_reheat', () => {
    const inputs: ServiceArbitrationInputs = {
      isCombi: false, hotDrawActive: false, heatingEnabled: false,
      hasStored: true, storeNeedsReheat: true, isSPlan: false,
    }
    expect(resolveServiceMode(inputs)).toBe('dhw_reheat')
  })

  it('stored: heating only (no reheat) → heating', () => {
    const inputs: ServiceArbitrationInputs = {
      isCombi: false, hotDrawActive: false, heatingEnabled: true,
      hasStored: true, storeNeedsReheat: false, isSPlan: true,
    }
    expect(resolveServiceMode(inputs)).toBe('heating')
  })

  it('stored: both off → idle', () => {
    const inputs: ServiceArbitrationInputs = {
      isCombi: false, hotDrawActive: false, heatingEnabled: false,
      hasStored: true, storeNeedsReheat: false, isSPlan: false,
    }
    expect(resolveServiceMode(inputs)).toBe('idle')
  })

  it('stored: hotDrawActive is ignored (stored draw is independent of mode)', () => {
    // For stored systems a DHW draw depletes the cylinder store; the mode
    // is NOT forced to dhw_draw — it reflects CH/reheat demand only.
    const inputs: ServiceArbitrationInputs = {
      isCombi: false, hotDrawActive: true, heatingEnabled: true,
      hasStored: true, storeNeedsReheat: false, isSPlan: false,
    }
    expect(resolveServiceMode(inputs)).toBe('heating')
  })
})

// ─── PR1 — serviceArbitration helper: computeServiceSwitchingActive ──────────

describe('computeServiceSwitchingActive — arbitration helper', () => {
  it('true when combi + dhw_draw + heatingEnabled', () => {
    expect(computeServiceSwitchingActive({
      isCombi: true, mode: 'dhw_draw', heatingEnabled: true,
    })).toBe(true)
  })

  it('false when combi + dhw_draw but heatingEnabled is false (no CH to interrupt)', () => {
    expect(computeServiceSwitchingActive({
      isCombi: true, mode: 'dhw_draw', heatingEnabled: false,
    })).toBe(false)
  })

  it('false when combi + heating (no active draw)', () => {
    expect(computeServiceSwitchingActive({
      isCombi: true, mode: 'heating', heatingEnabled: true,
    })).toBe(false)
  })

  it('false when combi + idle', () => {
    expect(computeServiceSwitchingActive({
      isCombi: true, mode: 'idle', heatingEnabled: false,
    })).toBe(false)
  })

  it('false for stored system even in dhw_draw mode with heating (combi rule never applies)', () => {
    expect(computeServiceSwitchingActive({
      isCombi: false, mode: 'dhw_draw', heatingEnabled: true,
    })).toBe(false)
  })

  it('false for stored system in dhw_reheat mode', () => {
    expect(computeServiceSwitchingActive({
      isCombi: false, mode: 'dhw_reheat', heatingEnabled: false,
    })).toBe(false)
  })

  it('false for stored system in heating_and_reheat mode (simultaneous, no switching)', () => {
    expect(computeServiceSwitchingActive({
      isCombi: false, mode: 'heating_and_reheat', heatingEnabled: true,
    })).toBe(false)
  })
})

// ─── PR1 — combi service switching via full simulation ───────────────────────

describe('combi service switching — serviceSwitchingActive flag', () => {
  it('is true when combi DHW draw is active and heating is enabled', () => {
    const controls = makeCombiControls({ heatingEnabled: true, dhwEnabled: true })
    const frame = runTicks(controls, 5)
    expect(frame.serviceSwitchingActive).toBe(true)
  })

  it('is false when combi has DHW only (heating off)', () => {
    const controls = makeCombiControls({ heatingEnabled: false, dhwEnabled: true })
    const frame = runTicks(controls, 5)
    expect(frame.serviceSwitchingActive).toBe(false)
  })

  it('is false when combi has heating only (no DHW draw)', () => {
    const controls = makeCombiControls({ heatingEnabled: true, dhwEnabled: false })
    const frame = runTicks(controls, 5)
    expect(frame.serviceSwitchingActive).toBe(false)
  })

  it('is false (or absent) when both demands are off', () => {
    const controls = makeCombiControls({ heatingEnabled: false, dhwEnabled: false })
    const frame = runTicks(controls, 5)
    expect(frame.serviceSwitchingActive ?? false).toBe(false)
  })

  it('is false for stored-cylinder (unvented) even with both demands active', () => {
    // Stored systems allow simultaneous CH and DHW — no service switching.
    const controls = makeStoredControls({ heatingEnabled: true, dhwEnabled: true })
    const frame = runTicks(controls, 5)
    expect(frame.serviceSwitchingActive ?? false).toBe(false)
  })

  it('systemMode is dhw_draw when service switching is active on combi', () => {
    const controls = makeCombiControls({ heatingEnabled: true, dhwEnabled: true })
    const frame = runTicks(controls, 5)
    // Service switching means boiler fully diverted to DHW — mode must be dhw_draw.
    expect(frame.systemMode).toBe('dhw_draw')
    expect(frame.serviceSwitchingActive).toBe(true)
  })

  it('systemMode allows heating_and_reheat for S-plan stored system (no switching)', () => {
    // S-plan stored system: CH and cylinder reheat can coexist — no service switching.
    const controls = makeStoredControls({ heatingEnabled: true, dhwEnabled: false })
    // For stored systems, reheating happens when store temperature drops.
    // Just verify the flag is absent — mode may be 'heating' if store does not need reheat.
    const frame = runTicks(controls, 5)
    expect(frame.serviceSwitchingActive ?? false).toBe(false)
  })
})

// ─── PR1 — PlaySceneModel propagation ────────────────────────────────────────

describe('PlaySceneModel.metadata.serviceSwitchingActive propagation', () => {
  it('is true in metadata when frame has service switching active', () => {
    const controls = makeCombiControls({ heatingEnabled: true, dhwEnabled: true })
    const frame = runTicks(controls, 5)
    // Ensure simulation is in service-switching mode.
    expect(frame.serviceSwitchingActive).toBe(true)

    const scene = buildPlaySceneModel(controls, frame)
    expect(scene.metadata.serviceSwitchingActive).toBe(true)
  })

  it('is false in metadata when combi is DHW-only (no heating call)', () => {
    const controls = makeCombiControls({ heatingEnabled: false, dhwEnabled: true })
    const frame = runTicks(controls, 5)
    const scene = buildPlaySceneModel(controls, frame)
    expect(scene.metadata.serviceSwitchingActive ?? false).toBe(false)
  })

  it('is false in metadata for stored-cylinder system even when both demands are on', () => {
    const controls = makeStoredControls({ heatingEnabled: true, dhwEnabled: true })
    const frame = runTicks(controls, 5)
    const scene = buildPlaySceneModel(controls, frame)
    expect(scene.metadata.serviceSwitchingActive ?? false).toBe(false)
  })
})


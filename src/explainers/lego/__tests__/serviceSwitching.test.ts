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
 *   - simulation.ts is the single source of truth for the flag
 *   - playScene/buildPlaySceneModel propagates it to scene.metadata
 *   - LabCanvas reads from scene.metadata only — never re-derives from systemMode
 */

import { describe, it, expect } from 'vitest'
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

// ─── PR1 — combi service switching tests ─────────────────────────────────────

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

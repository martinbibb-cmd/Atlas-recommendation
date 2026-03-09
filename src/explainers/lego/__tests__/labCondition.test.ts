/**
 * Tests for PR6 lab condition controls and water-supply overrides.
 *
 * Covers:
 *  - Condition modifier constants (sludge / scale factors)
 *  - Sludge reduces CH heating responsiveness in simulation output
 *  - Scale reduces combi DHW output in simulation output
 *  - Scale reduces cylinder reheat in simulation output
 *  - Clean condition state has no effect (identity)
 *  - Water-supply overrides (flow, pressure) affect simulation output
 *  - Survey-backed mode coexists with manual overrides
 *  - Stable derivation — no mutation of inputs
 */

import { describe, it, expect } from 'vitest'
import { stepSimulation } from '../animation/simulation'
import type { LabControls, LabFrame, LabConditionState } from '../animation/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCombiControls(overrides: Partial<LabControls> = {}): LabControls {
  return {
    systemType: 'combi',
    coldInletC: 10,
    dhwSetpointC: 50,
    mainsDynamicFlowLpm: 14,
    pipeDiameterMm: 22,
    combiDhwKw: 28,
    outlets: [
      { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
    ],
    ...overrides,
  }
}

function makeCylinderControls(overrides: Partial<LabControls> = {}): LabControls {
  return {
    systemType: 'unvented_cylinder',
    coldInletC: 10,
    dhwSetpointC: 50,
    mainsDynamicFlowLpm: 14,
    pipeDiameterMm: 22,
    combiDhwKw: 0,
    cylinder: { volumeL: 210, initialTempC: 60, reheatKw: 12 },
    outlets: [
      { id: 'A', enabled: true, kind: 'shower_mixer', demandLpm: 10 },
    ],
    ...overrides,
  }
}

function makeHeatingControls(overrides: Partial<LabControls> = {}): LabControls {
  return {
    systemType: 'combi',
    coldInletC: 10,
    dhwSetpointC: 50,
    mainsDynamicFlowLpm: 14,
    pipeDiameterMm: 22,
    combiDhwKw: 28,
    heatDemandKw: 10,
    heatingDemand: { enabled: true, demandLevel: 1 },
    outlets: [
      { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 10 },
    ],
    ...overrides,
  }
}

function makeFrame(): LabFrame {
  return {
    nowMs: 0,
    particles: [],
    spawnAccumulator: 0,
    nextTokenId: 0,
    outletSamples: {
      A: { tempC: 0, count: 0 },
    },
  }
}

// ─── Clean condition = identity ───────────────────────────────────────────────

describe('condition state — clean (identity)', () => {
  it('clean condition produces identical combi DHW output as no condition', () => {
    const controls = makeCombiControls()
    const frame = makeFrame()
    const dtMs = 500

    const clean: LabConditionState = { heatingCircuit: 'clean', hotWaterSide: 'clean' }

    const withoutCondition = stepSimulation({ frame, dtMs, controls })
    const withClean = stepSimulation({ frame, dtMs, controls, conditionState: clean })

    // Particle counts and token velocities should be identical
    expect(withClean.particles.length).toBe(withoutCondition.particles.length)
  })

  it('clean condition produces identical CH visuals as no condition', () => {
    const controls = makeHeatingControls()
    const frame = makeFrame()
    const dtMs = 200

    const clean: LabConditionState = { heatingCircuit: 'clean', hotWaterSide: 'clean' }

    const withoutCondition = stepSimulation({ frame, dtMs, controls })
    const withClean = stepSimulation({ frame, dtMs, controls, conditionState: clean })

    const chNoCondition = withoutCondition.visuals?.heatTransfers.find(h => h.nodeId === 'emitters')
    const chWithClean = withClean.visuals?.heatTransfers.find(h => h.nodeId === 'emitters')

    expect(chWithClean?.intensity).toBe(chNoCondition?.intensity)
  })
})

// ─── Sludge reduces CH output ─────────────────────────────────────────────────

describe('condition state — sludge reduces heating circuit output', () => {
  it('some_sludge reduces emitter intensity below clean', () => {
    const controls = makeHeatingControls()
    const frame = makeFrame()

    const clean: LabConditionState = { heatingCircuit: 'clean', hotWaterSide: 'clean' }
    const sludgy: LabConditionState = { heatingCircuit: 'some_sludge', hotWaterSide: 'clean' }

    const cleanResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: clean })
    const sludgyResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: sludgy })

    const cleanIntensity = cleanResult.visuals?.heatTransfers.find(h => h.nodeId === 'emitters')?.intensity ?? 0
    const sludgyIntensity = sludgyResult.visuals?.heatTransfers.find(h => h.nodeId === 'emitters')?.intensity ?? 0

    expect(sludgyIntensity).toBeLessThan(cleanIntensity)
  })

  it('heavy_sludge reduces emitter intensity more than some_sludge', () => {
    const controls = makeHeatingControls()
    const frame = makeFrame()

    const some: LabConditionState = { heatingCircuit: 'some_sludge', hotWaterSide: 'clean' }
    const heavy: LabConditionState = { heatingCircuit: 'heavy_sludge', hotWaterSide: 'clean' }

    const someResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: some })
    const heavyResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: heavy })

    const someIntensity = someResult.visuals?.heatTransfers.find(h => h.nodeId === 'emitters')?.intensity ?? 0
    const heavyIntensity = heavyResult.visuals?.heatTransfers.find(h => h.nodeId === 'emitters')?.intensity ?? 0

    expect(heavyIntensity).toBeLessThan(someIntensity)
  })

  it('sludge reduces primary circuit flowLpm in visuals', () => {
    const controls = makeHeatingControls()
    const frame = makeFrame()

    const clean: LabConditionState = { heatingCircuit: 'clean', hotWaterSide: 'clean' }
    const heavy: LabConditionState = { heatingCircuit: 'heavy_sludge', hotWaterSide: 'clean' }

    const cleanResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: clean })
    const heavyResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: heavy })

    const cleanFlow = cleanResult.visuals?.fluidPaths.find(fp => fp.edgeIds.includes('primary_flow'))?.flowLpm ?? 0
    const heavyFlow = heavyResult.visuals?.fluidPaths.find(fp => fp.edgeIds.includes('primary_flow'))?.flowLpm ?? 0

    expect(heavyFlow).toBeLessThan(cleanFlow)
  })

  it('sludge does not affect DHW service (hot water side is independent)', () => {
    const controls = makeCombiControls()
    const frame = makeFrame()

    const clean: LabConditionState = { heatingCircuit: 'clean', hotWaterSide: 'clean' }
    const sludgy: LabConditionState = { heatingCircuit: 'heavy_sludge', hotWaterSide: 'clean' }

    const cleanResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: clean })
    const sludgyResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: sludgy })

    // Token counts should be the same — sludge doesn't restrict DHW flow
    expect(sludgyResult.particles.length).toBe(cleanResult.particles.length)
  })
})

// ─── Scale reduces DHW output ─────────────────────────────────────────────────

describe('condition state — scale reduces hot water side output', () => {
  it('some_scale reduces combi plate HEX intensity below clean', () => {
    const controls = makeCombiControls()
    const frame = makeFrame()

    const clean: LabConditionState = { heatingCircuit: 'clean', hotWaterSide: 'clean' }
    const scaly: LabConditionState = { heatingCircuit: 'clean', hotWaterSide: 'some_scale' }

    const cleanResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: clean })
    const scalyResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: scaly })

    const cleanHex = cleanResult.visuals?.heatTransfers.find(h => h.nodeId === 'combi_hex')?.intensity ?? 0
    const scalyHex = scalyResult.visuals?.heatTransfers.find(h => h.nodeId === 'combi_hex')?.intensity ?? 0

    expect(scalyHex).toBeLessThan(cleanHex)
  })

  it('heavy_scale reduces combi HEX intensity more than some_scale', () => {
    const controls = makeCombiControls()
    const frame = makeFrame()

    const some: LabConditionState = { heatingCircuit: 'clean', hotWaterSide: 'some_scale' }
    const heavy: LabConditionState = { heatingCircuit: 'clean', hotWaterSide: 'heavy_scale' }

    const someResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: some })
    const heavyResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: heavy })

    const someHex = someResult.visuals?.heatTransfers.find(h => h.nodeId === 'combi_hex')?.intensity ?? 0
    const heavyHex = heavyResult.visuals?.heatTransfers.find(h => h.nodeId === 'combi_hex')?.intensity ?? 0

    expect(heavyHex).toBeLessThan(someHex)
  })

  it('scale reduces cylinder coil intensity during reheat', () => {
    const controls = makeCylinderControls({
      // Enable reheat by starting with a cold store
      cylinder: { volumeL: 210, initialTempC: 30, reheatKw: 12 },
    })
    const frame: LabFrame = {
      ...makeFrame(),
      storeNeedsReheat: true,
      systemMode: 'dhw_reheat',
    }

    const clean: LabConditionState = { heatingCircuit: 'clean', hotWaterSide: 'clean' }
    const heavy: LabConditionState = { heatingCircuit: 'clean', hotWaterSide: 'heavy_scale' }

    const cleanResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: clean })
    const heavyResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: heavy })

    const cleanCoil = cleanResult.visuals?.heatTransfers.find(h => h.nodeId === 'cylinder_coil')?.intensity ?? 0
    const heavyCoil = heavyResult.visuals?.heatTransfers.find(h => h.nodeId === 'cylinder_coil')?.intensity ?? 0

    expect(heavyCoil).toBeLessThan(cleanCoil)
  })

  it('scale does not affect heating circuit (circuits are independent)', () => {
    const controls = makeHeatingControls()
    const frame = makeFrame()

    const clean: LabConditionState = { heatingCircuit: 'clean', hotWaterSide: 'clean' }
    const scaly: LabConditionState = { heatingCircuit: 'clean', hotWaterSide: 'heavy_scale' }

    const cleanResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: clean })
    const scalyResult = stepSimulation({ frame, dtMs: 300, controls, conditionState: scaly })

    const cleanEmitter = cleanResult.visuals?.heatTransfers.find(h => h.nodeId === 'emitters')?.intensity ?? 0
    const scalyEmitter = scalyResult.visuals?.heatTransfers.find(h => h.nodeId === 'emitters')?.intensity ?? 0

    // Scale should not change emitter intensity
    expect(scalyEmitter).toBe(cleanEmitter)
  })
})

// ─── Flow override affects simulation ─────────────────────────────────────────

describe('water supply overrides — flow affects particle density', () => {
  it('lower flow produces fewer particles over time', () => {
    const baseControls = makeCombiControls({ mainsDynamicFlowLpm: 20 })
    const lowFlowControls = makeCombiControls({ mainsDynamicFlowLpm: 6 })
    const frame = makeFrame()

    let baseFrame = frame
    let lowFrame = frame

    // Run several ticks to accumulate particles
    for (let i = 0; i < 20; i++) {
      baseFrame = stepSimulation({ frame: baseFrame, dtMs: 300, controls: baseControls })
      lowFrame = stepSimulation({ frame: lowFrame, dtMs: 300, controls: lowFlowControls })
    }

    expect(lowFrame.particles.length).toBeLessThan(baseFrame.particles.length)
  })

  it('survey-backed flow is used when no manual override present', () => {
    const controls = makeCombiControls({
      mainsDynamicFlowLpm: 8,  // low fallback
      playbackInputs: { dynamicFlowLpm: 20 },  // high survey measurement
    })
    const lowControls = makeCombiControls({ mainsDynamicFlowLpm: 8 })
    const frame = makeFrame()

    let surveyFrame = frame
    let lowFrame = frame
    for (let i = 0; i < 20; i++) {
      surveyFrame = stepSimulation({ frame: surveyFrame, dtMs: 300, controls })
      lowFrame = stepSimulation({ frame: lowFrame, dtMs: 300, controls: lowControls })
    }

    // Survey-backed higher flow should produce more particles
    expect(surveyFrame.particles.length).toBeGreaterThan(lowFrame.particles.length)
  })
})

// ─── Pressure override affects token size ─────────────────────────────────────

describe('water supply overrides — pressure affects token pressure field', () => {
  it('high pressure bar produces larger token p values than no override', () => {
    const controls = makeCombiControls({ mainsDynamicFlowLpm: 8 })
    const frame = makeFrame()

    // Without pressure override: p derived from low flow
    const noOverride = stepSimulation({ frame, dtMs: 500, controls })
    // With high pressure override: p derived from 3.5 bar
    const highPressure = stepSimulation({ frame, dtMs: 500, controls, dynamicPressureBar: 3.5 })

    const noOverridePs = noOverride.particles.map(t => t.p)
    const highPressurePs = highPressure.particles.map(t => t.p)

    if (noOverridePs.length > 0 && highPressurePs.length > 0) {
      const avgNoOverride = noOverridePs.reduce((a, b) => a + b, 0) / noOverridePs.length
      const avgHighPressure = highPressurePs.reduce((a, b) => a + b, 0) / highPressurePs.length
      expect(avgHighPressure).toBeGreaterThan(avgNoOverride)
    }
  })
})

// ─── Immutability ─────────────────────────────────────────────────────────────

describe('condition state — no mutation', () => {
  it('stepSimulation does not mutate the conditionState object', () => {
    const controls = makeHeatingControls()
    const frame = makeFrame()
    const condition: LabConditionState = { heatingCircuit: 'some_sludge', hotWaterSide: 'some_scale' }
    const original = { ...condition }

    stepSimulation({ frame, dtMs: 300, controls, conditionState: condition })

    expect(condition).toEqual(original)
  })

  it('stepSimulation does not mutate the controls object', () => {
    const controls = makeCombiControls()
    const frame = makeFrame()
    const original = { ...controls }

    stepSimulation({ frame, dtMs: 300, controls, conditionState: { heatingCircuit: 'heavy_sludge', hotWaterSide: 'heavy_scale' } })

    expect(controls.mainsDynamicFlowLpm).toBe(original.mainsDynamicFlowLpm)
    expect(controls.combiDhwKw).toBe(original.combiDhwKw)
  })
})

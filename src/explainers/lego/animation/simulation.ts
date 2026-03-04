// src/explainers/lego/animation/simulation.ts

import type { LabControls, LabFrame, LabToken, OutletId, OutletControl } from './types'
import { pipeDiameterCapacityLpm } from '../model/dhwModel'
import { heatToTempC } from './thermal'
import {
  createCylinderStore,
  cylinderTempC,
  addReheatEnergy,
  removeDrawEnergy,
} from './storage'
import type { CylinderStore } from './storage'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

// Path positions (0..1)
const HEX_START = 0.38
const HEX_END = 0.62

/**
 * Tokens on MAIN reaching this threshold are assigned to an outlet branch.
 * This corresponds to the splitter node at the end of the trunk polyline.
 */
const S_SPLIT = 0.97

/** Prevent division-by-zero when a token barely moves in a tick. */
const MIN_MOVEMENT_EPSILON = 1e-6

/**
 * Convert flow to a token spawn rate.
 * We use a stable "tokens per litre" constant so visuals scale nicely.
 */
const TOKENS_PER_LITRE = 2.2

function tokensPerSecondFromLpm(flowLpm: number) {
  const litresPerSecond = flowLpm / 60
  return litresPerSecond * TOKENS_PER_LITRE
}

/**
 * Velocity proxy: higher flow + smaller pipe => faster tokens.
 * This is illustrative, not CFD. Keep it stable and intuitive.
 */
function velocityProxy(params: { flowLpm: number; diameterMm: number }) {
  // baseline tuned so tokens traverse in a few seconds on iPad
  const base = 0.08
  const diaFactor = params.diameterMm === 15 ? 1.35 : 0.9
  const flowFactor = clamp(params.flowLpm / 10, 0.4, 2.2)
  return base * diaFactor * flowFactor
}

/**
 * Pressure proxy (token size) for mains-fed (combi or unvented cylinder).
 */
function pressureProxy(params: { mainsFlowLpm: number }) {
  return clamp(params.mainsFlowLpm / 20, 0.35, 1.1)
}

/**
 * Pressure proxy for a vented (tank-fed) cylinder.
 * Vented head pressure feels "weaker" than mains supply.
 */
function ventedPressureProxy(params: { headMeters: number }) {
  return clamp((params.headMeters * 0.1) / 1.5, 0.25, 0.8)
}

/**
 * Optional vented supply flow cap: simple proxy (headMeters * 6 L/min per metre of head).
 * The factor 6 is an empirical demo proxy — roughly 0.1 bar per metre × ~60 L/min per bar.
 */
function ventedSupplyCapLpm(params: { mainsFlowLpm: number; headMeters: number }) {
  return Math.min(params.mainsFlowLpm, params.headMeters * 6)
}

/**
 * Ensure the cylinder store is initialised if the frame doesn't have one yet.
 */
function ensureCylinderStore(frame: LabFrame, controls: LabControls): CylinderStore {
  if (frame.cylinderStore) return frame.cylinderStore
  const cyl = controls.cylinder ?? { volumeL: 180, initialTempC: 55, reheatKw: 12 }
  return createCylinderStore({
    volumeL: cyl.volumeL,
    coldInletC: controls.coldInletC,
    initialTempC: cyl.initialTempC,
  })
}

/** Precision bucket for deterministic weighted outlet selection using token IDs. */
const OUTLET_SELECTION_PRECISION = 10000

/** EMA weight applied to the previous outlet temperature sample. */
const EMA_WEIGHT_PREVIOUS = 0.9
/** EMA weight applied to the incoming outlet temperature sample. */
const EMA_WEIGHT_CURRENT = 0.1

/** Extract the numeric part of a token ID (e.g. 't_42' → 42). */
function extractTokenNumId(tokenId: string): number {
  return parseInt(tokenId.replace('t_', ''), 10)
}

/**
 * Deterministic weighted outlet selection using token ID.
 *
 * Uses the sequential token ID (modulo a precision bucket) to pick an outlet
 * proportionally to each active outlet's demand — no Math.random needed.
 */
function pickOutletDeterministic(outlets: OutletControl[], tokenNumId: number): OutletId {
  const active = outlets.filter(o => o.enabled && o.demandLpm > 0)
  if (active.length === 0) return 'A'
  const total = active.reduce((s, o) => s + o.demandLpm, 0)
  // Scale tokenId into [0, total) using a precision bucket.
  const r = (tokenNumId % OUTLET_SELECTION_PRECISION) / OUTLET_SELECTION_PRECISION * total
  let acc = 0
  for (const o of active) {
    acc += o.demandLpm
    if (r < acc) return o.id
  }
  return active[active.length - 1].id
}

export function stepSimulation(params: {
  frame: LabFrame
  dtMs: number
  controls: LabControls
}): LabFrame {
  const { frame, dtMs, controls } = params
  const dt = dtMs / 1000

  const isCylinder = controls.systemType === 'unvented_cylinder' || controls.systemType === 'vented_cylinder'

  const activeOutlets = controls.outlets.filter(o => o.enabled && o.demandLpm > 0)
  const demandTotalLpm = activeOutlets.reduce((sum, o) => sum + o.demandLpm, 0)

  const pipeCap = pipeDiameterCapacityLpm(controls.pipeDiameterMm) ?? Infinity

  // For vented cylinders: apply a head-pressure-derived flow cap.
  const ventedCap = controls.systemType === 'vented_cylinder' && controls.vented
    ? ventedSupplyCapLpm({ mainsFlowLpm: controls.mainsDynamicFlowLpm, headMeters: controls.vented.headMeters })
    : Infinity

  // "What flow can physically pass through the system?"
  const hydraulicFlowLpm = Math.min(demandTotalLpm, controls.mainsDynamicFlowLpm, pipeCap, ventedCap)

  // ── Pressure proxy ────────────────────────────────────────────────────────
  let p: number
  if (controls.systemType === 'vented_cylinder' && controls.vented) {
    p = ventedPressureProxy({ headMeters: controls.vented.headMeters })
  } else {
    p = pressureProxy({ mainsFlowLpm: controls.mainsDynamicFlowLpm })
  }

  // ── Combi heat injection values (only used when systemType === 'combi') ───
  const mDot = hydraulicFlowLpm / 60 // kg/s
  const qDot = controls.combiDhwKw * 1000 // kW -> J/s
  const dhPerKgPerSecond = mDot > 0 ? qDot / mDot : 0

  // ── Cylinder store ────────────────────────────────────────────────────────
  let store = isCylinder ? ensureCylinderStore(frame, controls) : undefined

  if (isCylinder && store) {
    // Reheat adds energy every tick regardless of draw.
    const reheatKw = controls.cylinder?.reheatKw ?? 12
    store = addReheatEnergy({ store, reheatKw, dtS: dt })

    // Drawdown: remove energy proportional to delivered hot flow.
    if (demandTotalLpm > 0) {
      const storeTmp = cylinderTempC({ store, coldInletC: controls.coldInletC })
      store = removeDrawEnergy({
        store,
        coldInletC: controls.coldInletC,
        drawLpm: hydraulicFlowLpm,
        deliveredTempC: storeTmp,
        dtS: dt,
      })
    }
  }

  // ── Heat content for cylinder-spawned tokens ──────────────────────────────
  // Tokens from a cylinder carry the store temperature as their heat content.
  const cylinderHJPerKg = (isCylinder && store)
    ? store.energyJ / store.volumeL // J/kg above cold baseline
    : 0

  // Spawn tokens using a deterministic carry-over accumulator (no Math.random).
  const spawnRate = tokensPerSecondFromLpm(hydraulicFlowLpm)
  const rawAccumulator = frame.spawnAccumulator + spawnRate * dt
  const spawnCount = Math.floor(rawAccumulator)
  const spawnAccumulator = rawAccumulator - spawnCount // carry fractional part forward

  const v = velocityProxy({ flowLpm: hydraulicFlowLpm, diameterMm: controls.pipeDiameterMm })

  let tokens: LabToken[] = [...frame.tokens]
  let nextId = frame.nextTokenId

  // Add spawns at s = 0 on MAIN with deterministic sequential IDs.
  // Cylinder tokens start warm (heat from store); combi tokens start cold.
  for (let i = 0; i < spawnCount; i++) {
    tokens.push({
      id: `t_${nextId++}`,
      s: 0,
      v,
      p,
      hJPerKg: isCylinder ? cylinderHJPerKg : 0,
      route: 'MAIN',
    })
  }

  // EMA outlet samples — carry forward and update in this tick
  const outletSamples = { ...frame.outletSamples }

  // Step + heat injection (MAIN only for combi) + splitter assignment
  tokens = tokens.map(t => {
    const sPrev = t.s
    const sNext = clamp(t.s + t.v * dt, 0, 1)

    let h = t.hJPerKg

    if (t.route === 'MAIN') {
      if (!isCylinder) {
        // Combi: inject heat as the token passes through the HEX zone.
        const inHexNow = sPrev < HEX_END && sNext > HEX_START

        if (inHexNow) {
          const overlapStart = Math.max(sPrev, HEX_START)
          const overlapEnd = Math.min(sNext, HEX_END)
          const frac = clamp((overlapEnd - overlapStart) / Math.max(MIN_MOVEMENT_EPSILON, sNext - sPrev), 0, 1)
          h += dhPerKgPerSecond * dt * frac
        }
      }
      // Cylinder: no HEX zone — tokens already carry store heat from spawn.

      // At the splitter: assign token to an outlet branch and reset s
      if (sNext >= S_SPLIT) {
        const targetOutlet = pickOutletDeterministic(controls.outlets, extractTokenNumId(t.id))
        return { ...t, s: 0, v, p, hJPerKg: h, route: targetOutlet }
      }

      return { ...t, s: sNext, v, p, hJPerKg: h }
    }

    // Branch token — advance along its outlet path
    return { ...t, s: sNext, v, p, hJPerKg: h }
  })

  // Sample tokens exiting outlet branches → update EMA, then remove them
  tokens = tokens.filter(t => {
    if (t.route !== 'MAIN' && t.s >= 0.98) {
      const tempC = heatToTempC({ coldInletC: controls.coldInletC, hJPerKg: t.hJPerKg })
      const outletId = t.route as OutletId
      const prev = outletSamples[outletId]
      outletSamples[outletId] = {
        // Exponential moving average — smooths over several frames
        tempC: prev.count === 0 ? tempC : prev.tempC * EMA_WEIGHT_PREVIOUS + tempC * EMA_WEIGHT_CURRENT,
        count: prev.count + 1,
      }
      return false
    }
    // Drop stray MAIN tokens that somehow escape without branching
    if (t.route === 'MAIN' && t.s >= 0.999) return false
    return true
  })

  return {
    nowMs: frame.nowMs + dtMs,
    tokens,
    spawnAccumulator,
    nextTokenId: nextId,
    outletSamples,
    cylinderStore: store,
  }
}

/**
 * Helper to create an initial set of cold tokens, evenly distributed along the path.
 */
export function createColdTokens(params: {
  count: number
  velocity: number
  pressure: number
}): LabToken[] {
  const tokens: LabToken[] = []
  for (let i = 0; i < params.count; i++) {
    tokens.push({
      id: `t_${i}`,
      s: i / params.count, // evenly distributed along the path
      v: params.velocity,
      p: params.pressure,
      hJPerKg: 0,
      route: 'MAIN',
    })
  }
  return tokens
}

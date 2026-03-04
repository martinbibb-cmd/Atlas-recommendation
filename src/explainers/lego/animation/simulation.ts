// src/explainers/lego/animation/simulation.ts

import type { LabControls, LabFrame, LabToken } from './types'
import { pipeDiameterCapacityLpm } from '../model/dhwModel'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

// Path positions (0..1)
const HEX_START = 0.38
const HEX_END = 0.62

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
 * Pressure proxy (token size). If you later add pressure model,
 * this becomes derived. For now it tracks supply "strength".
 */
function pressureProxy(params: { mainsFlowLpm: number }) {
  return clamp(params.mainsFlowLpm / 20, 0.35, 1.1)
}

export function stepSimulation(params: {
  frame: LabFrame
  dtMs: number
  controls: LabControls
}): LabFrame {
  const { frame, dtMs, controls } = params
  const dt = dtMs / 1000

  const demandTotalLpm = controls.outlets * controls.demandPerOutletLpm

  const pipeCap = pipeDiameterCapacityLpm(controls.pipeDiameterMm) ?? Infinity

  // "What flow can physically pass through the system?"
  // This governs token count/speed (the hydraulic throughput).
  const hydraulicFlowLpm = Math.min(demandTotalLpm, controls.mainsDynamicFlowLpm, pipeCap)

  // Mass flow (kg/s) ~ L/s (water)
  const mDot = hydraulicFlowLpm / 60 // kg/s

  // Heat rate in J/s
  const qDot = controls.combiDhwKw * 1000 // kW -> J/s

  // Natural thermal droop: when demand flow > thermal capacity, mDot is larger,
  // so dhPerKgPerSecond (heat per kg of water) falls — tokens exit cooler.
  // No hard cutoff needed; the physics encode the droop automatically.
  const dhPerKgPerSecond = mDot > 0 ? qDot / mDot : 0

  // Spawn tokens using a deterministic carry-over accumulator (no Math.random).
  const spawnRate = tokensPerSecondFromLpm(hydraulicFlowLpm)
  const rawAccumulator = frame.spawnAccumulator + spawnRate * dt
  const spawnCount = Math.floor(rawAccumulator)
  const spawnAccumulator = rawAccumulator - spawnCount // carry fractional part forward

  const v = velocityProxy({ flowLpm: hydraulicFlowLpm, diameterMm: controls.pipeDiameterMm })
  const p = pressureProxy({ mainsFlowLpm: controls.mainsDynamicFlowLpm })

  let tokens: LabToken[] = [...frame.tokens]
  let nextId = frame.nextTokenId

  // Add spawns at s = 0 with deterministic sequential IDs
  for (let i = 0; i < spawnCount; i++) {
    tokens.push({
      id: `t_${nextId++}`,
      s: 0,
      v,
      p,
      hJPerKg: 0,
    })
  }

  // Step + heat injection through HEX zone
  tokens = tokens
    .map(t => {
      const sPrev = t.s
      const sNext = clamp(t.s + t.v * dt, 0, 1)

      let h = t.hJPerKg

      // If the token overlaps the HEX zone during this tick, add heat.
      const inHexNow = sPrev < HEX_END && sNext > HEX_START

      if (inHexNow) {
        // scale by fraction of tick spent in the HEX zone
        const overlapStart = Math.max(sPrev, HEX_START)
        const overlapEnd = Math.min(sNext, HEX_END)
        const frac = clamp((overlapEnd - overlapStart) / Math.max(MIN_MOVEMENT_EPSILON, sNext - sPrev), 0, 1)

        // Add heat content. This is the "passable heat" foundation.
        h += dhPerKgPerSecond * dt * frac
      }

      return { ...t, s: sNext, v, p, hJPerKg: h }
    })
    // Remove tokens that exit the path
    .filter(t => t.s < 0.999)

  return {
    nowMs: frame.nowMs + dtMs,
    tokens,
    spawnAccumulator,
    nextTokenId: nextId,
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
    })
  }
  return tokens
}

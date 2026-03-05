// src/explainers/lego/animation/simulation.ts

import type { LabControls, LabFrame, LabToken, OutletId, OutletControl } from './types'
import { pipeDiameterCapacityLpm } from '../model/dhwModel'
import { heatToTempC, tempToHeatJPerKg } from './thermal'
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
/** Exported so TokensLayer can derive per-token segment colour without storing temp on the token. */
export const HEX_END = 0.62

/**
 * Tokens on MAIN reaching this threshold are assigned to an outlet branch.
 * Uses a range-based crossing check: token is routed when it crosses from
 * below S_SPLIT to at or above S_SPLIT in a single tick.
 * Placed at 0.82 so the split happens clearly at the splitter node, well before
 * the end of the trunk, giving visually distinct branching.
 * A failsafe at sNext >= S_FAILSAFE ensures MAIN tokens are always routed when
 * active outlets exist, even if the tick step skips over S_SPLIT.
 */
const S_SPLIT = 0.82

/**
 * Maximum per-token jitter applied to the split threshold (±SPLIT_JITTER).
 * Each token gets a deterministic offset derived from its ID so the branch
 * assignments stagger slightly, breaking visible "clump" patterns.
 */
const SPLIT_JITTER = 0.015

/** Failsafe: MAIN tokens that reach or pass this position without crossing S_SPLIT
 * (possible with large tick steps) are force-routed to an outlet. */
const S_FAILSAFE = 0.995

/**
 * Animation setpoint bounds (°C).
 * Tokens are clamped to [MIN_ANIMATION_SETPOINT_C, MAX_ANIMATION_SETPOINT_C] so the thermal
 * palette always looks realistic for customers — never "superheated" at high values and
 * never unrealistically cold at low values.
 * 45 °C is the minimum usable domestic hot-water temperature (below this the animation
 * palette would show water that looks barely warm, which misrepresents combi DHW performance).
 */
const MIN_ANIMATION_SETPOINT_C = 45
const MAX_ANIMATION_SETPOINT_C = 55

/** Prevent division-by-zero when a token barely moves in a tick. */
const MIN_MOVEMENT_EPSILON = 1e-6

/**
 * Spawn-rate constant: tokens per second per sqrt(L/min).
 * sqrt compression keeps high flows from generating a firehose while still
 * making 6 vs 14 vs 24 L/min clearly distinguishable.
 * Increased from 0.12 to 2.0 so that density differences are immediately
 * visible at practical DHW flow rates (6–30 L/min).
 */
const K_SPAWN = 2.0

/**
 * Hard cap on total live tokens.  Prevents unbounded growth on slow devices
 * if the frame budget is tight.  4 000 is comfortably above what the eye can
 * resolve but low enough to stay well within typical GPU/CPU budgets.
 */
const MAX_TOKENS = 4000

/**
 * Convert flow to a token spawn rate using sqrt compression.
 * spawnPerSec ≈ K_SPAWN × √flowLpm
 * - 6 L/min  → ~4.9 tokens/s  (a few dots on screen)
 * - 14 L/min → ~7.5 tokens/s  (clearly denser stream)
 * - 25 L/min → ~10 tokens/s   (thick stream)
 * Zero flow → zero spawn (no phantom flow).
 */
function spawnPerSec(flowLpm: number): number {
  return K_SPAWN * Math.sqrt(Math.max(flowLpm, 0))
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

/**
 * Deterministic pseudo-random value in [0, 1) derived from an integer seed.
 *
 * A Knuth-multiplicative pre-mix (`(n+1) * 0x9e3779b9`) spreads sequential
 * small integers (0, 1, 2, …) across all 32 bits before the xorshift
 * finalizer runs.  Without this step the raw xorshift produces near-zero
 * outputs for small inputs, causing all early tokens to route to the first
 * outlet.  The +1 ensures n=0 (the first token) doesn't produce a degenerate
 * zero: Math.imul(0, k) = 0 for any k, giving the same degenerate output
 * as no hashing at all.
 *
 * Stable across runs (same seed → same output), no Math.random.
 */
function hash01(n: number): number {
  // Pre-mix: spread sequential small IDs across the full 32-bit range.
  let x = Math.imul(n + 1, 0x9e3779b9) >>> 0
  // Xorshift finalizer for additional avalanche.
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  return (x >>> 0) / 4294967296
}

/**
 * Deterministic weighted outlet selection using token ID.
 *
 * Uses hash01() to map each token ID to a pseudo-random position in
 * [0, totalDemand), then selects the outlet whose cumulative demand
 * bracket contains that position (weighted roulette).
 *
 * Compared to the old modulo-cycle approach this breaks the visible
 * "one-pipe-at-a-time" rotation pattern: token IDs that are close
 * together (101, 102, 103…) map to scattered positions rather than
 * marching through outlets in sequence.
 *
 * Properties:
 *  - still deterministic (no Math.random)
 *  - well-mixed across outlets within any short window
 *  - proportional to demandLpm weights
 */
function pickOutletDeterministic(outlets: OutletControl[], tokenNumId: number): OutletId {
  const active = outlets.filter(o => o.enabled && o.demandLpm > 0)
  if (active.length === 0) return 'A'
  if (active.length === 1) return active[0].id

  const total = active.reduce((s, o) => s + o.demandLpm, 0)
  const r = hash01(tokenNumId) * total

  let acc = 0
  for (const o of active) {
    acc += o.demandLpm
    if (r < acc) return o.id
  }
  return active[active.length - 1].id
}

/** EMA weight applied to the previous outlet temperature sample. */
const EMA_WEIGHT_PREVIOUS = 0.9
/** EMA weight applied to the incoming outlet temperature sample. */
const EMA_WEIGHT_CURRENT = 0.1

/** Extract the numeric part of a token ID (e.g. 't_42' → 42). */
function extractTokenNumId(tokenId: string): number {
  return parseInt(tokenId.replace('t_', ''), 10)
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

  // No draw → velocity must be zero so tokens stop immediately.
  const hasDraw = hydraulicFlowLpm > 0.01

  // ── Per-outlet actual LPM ─────────────────────────────────────────────────
  // Scale each outlet's demand proportionally by the hydraulic throttle factor.
  // Tokens branching to an outlet use this value for their individual velocity,
  // so visually faster branch = more flow to that branch.
  const outletScale = demandTotalLpm > 0 ? hydraulicFlowLpm / demandTotalLpm : 0
  const outletActualLpm: Record<OutletId, number> = { A: 0, B: 0, C: 0 }
  for (const o of activeOutlets) {
    outletActualLpm[o.id] = o.demandLpm * outletScale
  }

  // ── Pressure proxy ────────────────────────────────────────────────────────
  let p: number
  if (controls.systemType === 'vented_cylinder' && controls.vented) {
    p = ventedPressureProxy({ headMeters: controls.vented.headMeters })
  } else {
    p = pressureProxy({ mainsFlowLpm: controls.mainsDynamicFlowLpm })
  }

  // ── Combi heat injection values (only used when systemType === 'combi') ───
  // Setpoint modulation: compute the heat rate required to reach the setpoint for
  // the current flow, then cap at the boiler's rated output.
  // kW_required = 0.06977 × flowLpm × (setpointC − coldInletC)
  // kW_actual   = min(combiDhwKw, kW_required)
  // This prevents superheating at low flow and produces outlet-temp droop at high flow.
  // Clamp to [45, MAX_ANIMATION_SETPOINT_C] so the animation palette stays realistic:
  // above 55 °C looks superheated; below 45 °C looks unrealistically cold for domestic DHW.
  const setpointC = clamp(controls.dhwSetpointC, MIN_ANIMATION_SETPOINT_C, MAX_ANIMATION_SETPOINT_C)
  const mDot = hydraulicFlowLpm / 60 // kg/s
  const kWRequired = 0.06977 * hydraulicFlowLpm * (setpointC - controls.coldInletC)
  const kWActual = Math.min(controls.combiDhwKw, kWRequired)
  const qDot = kWActual * 1000 // kW -> J/s
  const dhPerKgPerSecond = mDot > 0 ? qDot / mDot : 0
  // Maximum heat content corresponding to the DHW setpoint (used to clamp tokens)
  const maxHSetpoint = tempToHeatJPerKg({ coldInletC: controls.coldInletC, tempC: setpointC })

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
  const rawAccumulator = frame.spawnAccumulator + spawnPerSec(hydraulicFlowLpm) * dt
  const spawnCount = Math.floor(rawAccumulator)
  const spawnAccumulator = rawAccumulator - spawnCount // carry fractional part forward

  const v = hasDraw
    ? velocityProxy({ flowLpm: hydraulicFlowLpm, diameterMm: controls.pipeDiameterMm })
    : 0

  let tokens: LabToken[] = [...frame.tokens]
  let nextId = frame.nextTokenId

  // Add spawns at s = 0 on MAIN with deterministic sequential IDs.
  // Cylinder tokens start warm (heat from store); combi tokens start cold.
  // Each token is pre-assigned to an outlet at spawn time (using the same
  // weighted-roulette logic that previously fired at the split point) so the
  // "draw junction" upstream of the boiler immediately reflects where each
  // packet of water is headed.  This also ensures per-outlet flow rates are
  // visible as proportional token densities on each branch.
  for (let i = 0; i < spawnCount; i++) {
    // Only spawn if we are below the hard token cap.
    if (tokens.length >= MAX_TOKENS) break

    const assignedOutlet = activeOutlets.length > 0
      ? pickOutletDeterministic(controls.outlets, nextId)
      : undefined

    tokens.push({
      id: `t_${nextId++}`,
      s: 0,
      v,
      p,
      hJPerKg: isCylinder ? cylinderHJPerKg : 0,
      route: 'MAIN',
      assignedOutlet,
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
          // Clamp token heat content so it never exceeds the DHW setpoint temperature.
          if (h > maxHSetpoint) h = maxHSetpoint
        }
      }
      // Cylinder: no HEX zone — tokens already carry store heat from spawn.

      // At the splitter: assign token to an outlet branch and reset s.
      // Use a robust threshold and a failsafe near the end so MAIN tokens never "escape".
      // A small per-token jitter (derived from the same hash) staggers the exact split
      // position so tokens don't all branch as a clump at the same s value.
      const tokenJitter = (hash01(extractTokenNumId(t.id) * 7919) - 0.5) * 2 * SPLIT_JITTER
      const splitAt = clamp(S_SPLIT + tokenJitter, 0.75, 0.95)
      const shouldBranch =
        (sPrev < splitAt && sNext >= splitAt) ||
        (sNext >= S_FAILSAFE && activeOutlets.length > 0) // failsafe

      if (shouldBranch) {
        // Use the outlet pre-assigned at spawn time (draw-junction semantics).
        // Fall back to deterministic hash-roulette for tokens created without
        // a pre-assignment (e.g. manually constructed tokens in tests).
        const targetOutlet = t.assignedOutlet
          ?? pickOutletDeterministic(controls.outlets, extractTokenNumId(t.id))
        // Per-outlet velocity: branch tokens move at a speed reflecting that outlet's
        // individual flow, making flow differences between branches visually distinct.
        const branchFlow = outletActualLpm[targetOutlet] ?? 0
        const branchV = hasDraw
          ? velocityProxy({ flowLpm: branchFlow, diameterMm: controls.pipeDiameterMm })
          : 0
        return { ...t, s: 0, v: branchV, p, hJPerKg: h, route: targetOutlet }
      }

      return { ...t, s: sNext, v, p, hJPerKg: h }
    }

    // Branch token — update velocity to reflect this outlet's current actual flow.
    // When the outlet has zero flow (disabled or throttled), fall back to the main
    // velocity so stale tokens can drain naturally to the exit.
    const branchFlow = outletActualLpm[t.route as OutletId] ?? 0
    const branchV = (hasDraw && branchFlow > 0.01)
      ? velocityProxy({ flowLpm: branchFlow, diameterMm: controls.pipeDiameterMm })
      : v
    return { ...t, s: sNext, v: branchV, p, hJPerKg: h }
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

  // No draw: clear all tokens so the animation stops cleanly.
  if (!hasDraw) {
    tokens = []
  }

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

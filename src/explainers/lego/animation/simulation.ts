// src/explainers/lego/animation/simulation.ts

import type { LabControls, LabFrame, FlowParticle, OutletId, OutletControl, SystemMode, SimulationVisuals } from './types'
import { pipeDiameterCapacityLpm } from '../model/dhwModel'
import { heatToTempC, tempToHeatJPerKg, computeTmvMixer, clampAnimationSetpointC } from './thermal'
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

function slotForOutletId(outletId: string): 'A' | 'B' | 'C' | null {
  if (outletId === 'A' || outletId === 'OutletA') return 'A'
  if (outletId === 'B' || outletId === 'OutletB') return 'B'
  if (outletId === 'C' || outletId === 'OutletC') return 'C'
  return null
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
 * Default heating demand power (kW) used when HeatingDemandState.enabled is true but
 * no explicit heatDemandKw is supplied.  Represents a modest whole-house heating load.
 */
const DEFAULT_HEATING_DEMAND_KW = 10

/**
 * Reference maximum temperature (°C) for the cylinder charge fraction.
 * chargePct = 0 at cold inlet, 1 at this temperature.
 * Must match the constant of the same name in LabCanvas.tsx.
 */
const CYLINDER_FILL_MAX_C = 80

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
  const heatSourceType = controls.heatSourceType ?? (controls.systemType === 'combi' ? 'combi' : 'system_boiler')
  const isCombi = heatSourceType === 'combi'
  const hasStored = controls.graphFacts?.hasStoredDhw ?? isCylinder

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

  // ── Resolve heating demand ────────────────────────────────────────────────
  // Structured HeatingDemandState takes precedence over legacy scalar heatDemandKw.
  const heatingDemandKw = controls.heatingDemand?.enabled
    ? (controls.heatingDemand.demandLevel ?? 1) * (controls.heatDemandKw ?? DEFAULT_HEATING_DEMAND_KW)
    : (controls.heatDemandKw ?? 0)
  const heatingEnabled = controls.heatingDemand?.enabled ?? (heatingDemandKw > 0.1)

  // ── Per-outlet actual LPM ─────────────────────────────────────────────────
  // Scale each outlet's demand proportionally by the hydraulic throttle factor.
  // Tokens branching to an outlet use this value for their individual velocity,
  // so visually faster branch = more flow to that branch.
  const outletScale = demandTotalLpm > 0 ? hydraulicFlowLpm / demandTotalLpm : 0
  const outletActualLpm: Record<OutletId, number> = { A: 0, B: 0, C: 0 }
  for (const o of activeOutlets) {
    outletActualLpm[o.id] = o.demandLpm * outletScale
  }

  // ── TMV per-outlet outcomes (combi only) ─────────────────────────────────
  // For each active shower_mixer outlet with tmvEnabled, compute the TMV mixer
  // physics.  This gives:
  //   F_h — hot-side flow through the boiler HEX (< F_out)
  //   F_c — cold supply bypass flow (bypasses HEX entirely)
  //   T_h — achieved boiler hot-side outlet temperature
  //
  // hexFlowLpm = total flow through the HEX = hydraulicFlowLpm − Σ(F_c for TMV outlets)
  // The hot-branch velocity for a TMV outlet is based on F_h, not F_out.
  type TmvToken = { F_h: number; F_c: number; T_h: number; saturated: boolean }
  const tmvOutletMap: Partial<Record<OutletId, TmvToken>> = {}
  const bindings = controls.outletBindings ?? {}
  const hotFedIds = new Set(controls.graphFacts?.hotFedOutletNodeIds ?? [])
  const coldOnlyIds = new Set(controls.graphFacts?.coldOnlyOutletNodeIds ?? [])
  let hexFlowLpm = 0

  for (const o of activeOutlets) {
    const slot = slotForOutletId(o.id)
    const nodeId = slot ? bindings[slot] : undefined

    if (nodeId && coldOnlyIds.has(nodeId)) {
      continue
    }
    if (nodeId && hotFedIds.has(nodeId)) {
      hexFlowLpm += outletActualLpm[o.id]
      continue
    }

    // fallback: treat unbound outlets as hot-fed (keeps old behaviour)
    hexFlowLpm += outletActualLpm[o.id]
  }

  if (isCombi && hasDraw) {
    for (const o of activeOutlets) {
      const slot = slotForOutletId(o.id)
      const nodeId = slot ? bindings[slot] : undefined
      const isColdOnly = !!(nodeId && coldOnlyIds.has(nodeId))
      if (isColdOnly) {
        outletActualLpm[o.id] = 0
        continue
      }

      if (o.kind === 'shower_mixer' && o.tmvEnabled) {
        const F_out = outletActualLpm[o.id]
        if (F_out > 0) {
          const outcome = computeTmvMixer({
            boilerKw: controls.combiDhwKw,
            combiSetpointC: controls.dhwSetpointC,
            coldInTempC: controls.coldInletC,
            showerDeliveredLpm: F_out,
            targetTempC: o.tmvTargetTempC ?? 40,
          })
          tmvOutletMap[o.id] = outcome
          hexFlowLpm = Math.max(0, hexFlowLpm - outcome.F_c)
          // Hot branch for this outlet carries F_h tokens, not the full F_out.
          outletActualLpm[o.id] = outcome.F_h
        }
      }
    }
  }

  // ── Pressure proxy ────────────────────────────────────────────────────────
  let p: number
  if (controls.systemType === 'vented_cylinder' && controls.vented) {
    p = ventedPressureProxy({ headMeters: controls.vented.headMeters })
  } else {
    p = pressureProxy({ mainsFlowLpm: controls.mainsDynamicFlowLpm })
  }

  const setpointC = clampAnimationSetpointC(controls.dhwSetpointC)
  const effectiveHexFlow = hexFlowLpm
  const mDot = effectiveHexFlow / 60
  const kWRequired = 0.06977 * effectiveHexFlow * (setpointC - controls.coldInletC)

  let store = hasStored ? ensureCylinderStore(frame, controls) : undefined
  const reheatTargetC = controls.dhwReheatTargetC ?? 55
  const reheatHysteresisC = controls.dhwReheatHysteresisC ?? 6
  const hotDrawActive = hexFlowLpm > 0.01

  let storeNeedsReheat = frame.storeNeedsReheat ?? false
  if (store) {
    const storeTopC = cylinderTempC({ store, coldInletC: controls.coldInletC })
    if (!storeNeedsReheat && storeTopC < reheatTargetC - reheatHysteresisC) storeNeedsReheat = true
    if (storeNeedsReheat && storeTopC >= reheatTargetC) storeNeedsReheat = false
  }

  // ── System mode resolution ────────────────────────────────────────────────
  // For a combi:
  //   - DHW draw takes priority (CH is interrupted/paused during active hot-water draw)
  //   - Heating runs only when there is no DHW demand
  // For system/regular boiler + cylinder:
  //   - CH and cylinder reheat can both be needed; mode priorities follow:
  //     1. heating (emitter circuit active)
  //     2. dhw_reheat (cylinder needs topping up)
  //     3. idle
  let mode: SystemMode = 'idle'
  if (isCombi) {
    // DHW priority: on a combi, hot-water draw interrupts CH
    if (hotDrawActive) mode = 'dhw_draw'
    else if (heatingEnabled) mode = 'heating'
  } else {
    if (heatingEnabled) mode = 'heating'
    else if (hasStored && storeNeedsReheat) mode = 'dhw_reheat'
  }

  const kWActual = isCombi && mode === 'dhw_draw' ? Math.min(controls.combiDhwKw, kWRequired) : 0
  const qDot = kWActual * 1000
  const dhPerKgPerSecond = mDot > 0 ? qDot / mDot : 0
  const maxHSetpoint = tempToHeatJPerKg({ coldInletC: controls.coldInletC, tempC: setpointC })

  if (store) {
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

    if (mode === 'dhw_reheat') {
      const reheatKw = controls.cylinder?.reheatKw ?? 12
      store = addReheatEnergy({ store, reheatKw, dtS: dt })
    }
  }

  // ── Heat content for cylinder-spawned tokens ──────────────────────────────
  // Tokens from a cylinder carry the store temperature as their heat content.
  const cylinderHJPerKg = (hasStored && store)
    ? store.energyJ / store.volumeL // J/kg above cold baseline
    : 0

  // Spawn tokens using a deterministic carry-over accumulator (no Math.random).
  const rawAccumulator = frame.spawnAccumulator + spawnPerSec(hydraulicFlowLpm) * dt
  const spawnCount = Math.floor(rawAccumulator)
  const spawnAccumulator = rawAccumulator - spawnCount // carry fractional part forward

  const v = hasDraw
    ? velocityProxy({ flowLpm: hydraulicFlowLpm, diameterMm: controls.pipeDiameterMm })
    : 0

  let particles: FlowParticle[] = [...frame.particles]
  let nextId = frame.nextTokenId

  // Add spawns at s = 0 on MAIN with deterministic sequential IDs.
  // Cylinder tokens start warm (heat from store); combi tokens start cold.
  // Each token is pre-assigned to an outlet at spawn time (using the same
  // weighted-roulette logic that previously fired at the split point) so the
  // "draw junction" upstream of the boiler immediately reflects where each
  // packet of water is headed.  This also ensures per-outlet flow rates are
  // visible as proportional token densities on each branch.
  //
  // TMV cold supply bypass: tokens assigned to a TMV shower_mixer outlet are
  // split at the pre-boiler tee — a deterministic hash (cold fraction = F_c/F_out)
  // decides whether each such token goes on the cold supply bypass (COLD_A) or the
  // hot branch (MAIN → HEX → outlet A).  Cold bypass tokens start cold and stay
  // cold; they follow the cold bypass polyline and bypass the HEX entirely.
  for (let i = 0; i < spawnCount; i++) {
    // Only spawn if we are below the hard particle cap.
    if (particles.length >= MAX_TOKENS) break

    const assignedOutlet = activeOutlets.length > 0
      ? pickOutletDeterministic(controls.outlets, nextId)
      : undefined

    // Determine route: check if this particle should take the cold supply bypass.
    let route: FlowParticle['route'] = 'MAIN'
    let tokenV = v
    if (assignedOutlet && tmvOutletMap[assignedOutlet]) {
      const tmv = tmvOutletMap[assignedOutlet]!
      const F_out = (tmv.F_h + tmv.F_c) || 1
      const coldFraction = tmv.F_c / F_out
      // Deterministic split: use a large prime multiplier so cold bypass particles
      // interleave with hot particles rather than appearing in blocks.
      // (Any large prime avoids patterns caused by sequential IDs.)
      const h01 = hash01(nextId * 3571)
      if (h01 < coldFraction) {
        route = 'COLD_A'
        tokenV = hasDraw
          ? velocityProxy({ flowLpm: Math.max(tmv.F_c, 0.1), diameterMm: controls.pipeDiameterMm })
          : 0
      }
    }

    particles.push({
      id: `t_${nextId++}`,
      s: 0,
      v: tokenV,
      p,
      hJPerKg: hasStored ? cylinderHJPerKg : 0,
      route,
      assignedOutlet,
      domain: 'fluid_path',
    })
  }

  // EMA outlet samples — carry forward and update in this tick
  const outletSamples = { ...frame.outletSamples }

  // Step + heat injection (MAIN only for combi) + splitter assignment
  particles = particles.map(t => {
    const sPrev = t.s
    const sNext = clamp(t.s + t.v * dt, 0, 1)

    let h = t.hJPerKg

    // ── Cold supply bypass tokens (COLD_A) ────────────────────────────────
    // These bypass the HEX entirely — no heat injection, just advance toward exit.
    if (t.route === 'COLD_A') {
      return { ...t, s: sNext, hJPerKg: 0 }
    }

    if (t.route === 'MAIN') {
      if (isCombi) {
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
        // For TMV outlets outletActualLpm[targetOutlet] is F_h (hot-side flow).
        const branchFlow = outletActualLpm[targetOutlet] ?? 0
        const branchV = hasDraw
          ? velocityProxy({ flowLpm: branchFlow, diameterMm: controls.pipeDiameterMm })
          : 0
        return { ...t, s: 0, v: branchV, p, hJPerKg: h, route: targetOutlet }
      }

      return { ...t, s: sNext, v, p, hJPerKg: h }
    }

    // Branch token (A / B / C) — update velocity to reflect this outlet's current actual flow.
    // When the outlet has zero flow (disabled or throttled), fall back to the main
    // velocity so stale tokens can drain naturally to the exit.
    const branchFlow = outletActualLpm[t.route as OutletId] ?? 0
    const branchV = (hasDraw && branchFlow > 0.01)
      ? velocityProxy({ flowLpm: branchFlow, diameterMm: controls.pipeDiameterMm })
      : v
    return { ...t, s: sNext, v: branchV, p, hJPerKg: h }
  })

  // Sample particles exiting outlet branches → update EMA, then remove them.
  // COLD_A particles map to outlet 'A' for the purpose of the EMA sample.
  particles = particles.filter(t => {
    const isBranch = t.route !== 'MAIN'
    const isColdBypass = t.route === 'COLD_A'

    if (isBranch && t.s >= 0.98) {
      const tempC = heatToTempC({ coldInletC: controls.coldInletC, hJPerKg: t.hJPerKg })
      // COLD_A tokens are counted as outlet A samples (cold supply portion of the mix).
      const outletId: OutletId = isColdBypass ? 'A' : (t.route as OutletId)
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

  // No draw: clear all particles so the animation stops cleanly.
  if (!hasDraw) {
    particles = []
  }

  // ── Compute simulation visuals ──────────────────────────────────────────────
  // Three domains are computed separately so the renderer can use each for the
  // correct visual purpose (no cross-domain confusion).

  // Named cold-supply edge ID: vented cylinders use a cold-feed header (tank-fed),
  // all other system types use the mains cold supply.
  const coldSupplyEdgeId = controls.systemType === 'vented_cylinder' ? 'cold_feed' : 'mains_cold'

  // 1. Fluid paths — water physically moving through pipes.
  //    Each entry identifies a named pipe segment and whether it is currently live.
  const visuals: SimulationVisuals = {
    fluidPaths: [
      // Cold mains/feed supply into the system — active whenever there is hydraulic flow.
      {
        edgeIds: [coldSupplyEdgeId],
        direction: 'forward',
        active: hasDraw,
        flowLpm: hasDraw ? hydraulicFlowLpm : 0,
      },
      // DHW draw-off — hot water leaving the system toward outlets.
      {
        edgeIds: ['dhw_draw'],
        direction: 'forward',
        active: hasDraw,
        flowLpm: hasDraw ? hydraulicFlowLpm : 0,
      },
      // Primary heating circuit — boiler → emitters → return.
      // Active whenever space-heating is running.
      {
        edgeIds: ['primary_flow', 'primary_return'],
        direction: 'forward',
        active: mode === 'heating',
        flowLpm: mode === 'heating' ? heatingDemandKw / 0.07 : 0, // rough proxy L/min
      },
      // Primary circuit through the cylinder coil — separate from DHW domestic draw.
      // Active only during cylinder reheat; domestic water NEVER travels this path.
      {
        edgeIds: ['cylinder_coil_primary_flow', 'cylinder_coil_primary_return'],
        direction: 'forward',
        active: mode === 'dhw_reheat',
        flowLpm: mode === 'dhw_reheat' ? (controls.cylinder?.reheatKw ?? 12) / 0.07 : 0,
      },
    ],

    // 2. Heat transfers — energy moving across components (not fluid).
    //    Each entry represents a component that is actively transferring heat.
    heatTransfers: [
      // Boiler burner — active during any mode that requires the burner to fire.
      {
        nodeId: 'boiler_burner',
        active: mode === 'dhw_draw' || mode === 'heating' || mode === 'dhw_reheat',
        intensity: mode !== 'idle' ? 1.0 : 0,
        kind: heatSourceType === 'heat_pump' ? 'compressor' : 'burner',
      },
      // Plate heat exchanger — active only during combi DHW draw.
      // Not present on cylinder systems (the coil serves this role).
      {
        nodeId: 'combi_hex',
        active: isCombi && mode === 'dhw_draw',
        intensity: isCombi && mode === 'dhw_draw' ? 1.0 : 0,
        kind: 'plate_hex',
      },
      // Cylinder coil — active during reheat.
      // Represents heat moving from the primary circuit into the stored water.
      // This is NOT domestic water — it is the primary circuit passing through the coil.
      {
        nodeId: 'cylinder_coil',
        active: hasStored && mode === 'dhw_reheat',
        intensity: hasStored && mode === 'dhw_reheat' ? 1.0 : 0,
        kind: 'coil',
      },
      // Emitters — active during heating mode (radiators / underfloor releasing heat into the room).
      {
        nodeId: 'emitters',
        active: mode === 'heating',
        intensity: mode === 'heating' ? clamp((controls.heatingDemand?.demandLevel ?? 1), 0, 1) : 0,
        kind: 'emitter',
      },
    ],

    // 3. Storage states — thermal condition of vessels.
    //    Only present for cylinder system types.
    storageStates: hasStored && store
      ? [
          {
            nodeId: 'cylinder',
            active: true,
            // Charge fraction: 0 at cold inlet, 1 at CYLINDER_FILL_MAX_C (same scale as renderer).
            chargePct: Math.max(0, Math.min(1,
              (cylinderTempC({ store, coldInletC: controls.coldInletC }) - controls.coldInletC) /
              (CYLINDER_FILL_MAX_C - controls.coldInletC)
            )),
            // hotTopPct reserved for future Mixergy stratification.
            hotTopPct: undefined,
          },
        ]
      : [],
  }

  return {
    nowMs: frame.nowMs + dtMs,
    particles,
    spawnAccumulator,
    nextTokenId: nextId,
    outletSamples,
    cylinderStore: store,
    systemMode: mode,
    storeNeedsReheat,
    visuals,
  }
}

/**
 * Helper to create an initial set of cold particles, evenly distributed along the path.
 */
export function createColdTokens(params: {
  count: number
  velocity: number
  pressure: number
}): FlowParticle[] {
  const particles: FlowParticle[] = []
  for (let i = 0; i < params.count; i++) {
    particles.push({
      id: `t_${i}`,
      s: i / params.count, // evenly distributed along the path
      v: params.velocity,
      p: params.pressure,
      hJPerKg: 0,
      route: 'MAIN',
    })
  }
  return particles
}

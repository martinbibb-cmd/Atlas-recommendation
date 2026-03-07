// src/explainers/lego/playScene/buildPlaySceneModel.ts
//
// Builds an explicit PlaySceneModel from simulation inputs and outputs.
//
// This is the central layer between:
//   - LabControls (static system configuration, derived from BuildGraph topology)
//   - LabFrame    (dynamic simulation state for the current render frame)
// and:
//   - The renderer (LabCanvas), which must not independently infer topology.
//
// Rules encoded here (not in the renderer):
//   - Vented cylinder: hide generic cold feed, show CWS refill, show cylinder as store.
//   - Combi: show generic cold feed, no CWS refill, no cylinder as store.
//   - Heat source must always be visible when CH or DHW is active.
//   - Activity kinds (ch_firing, dhw_firing, reheat, emitting) drive glow/pulse intensity.
//   - S-plan allows CH and DHW (coil reheat) simultaneously.

import type { LabControls, LabFrame } from '../animation/types'
import type {
  PlaySceneModel,
  PlaySceneNode,
  PlaySceneEdge,
  ActivityKind,
  PlaySceneActivity,
} from './types'
import { deriveActiveDomains } from './deriveActiveDomains'

// ─── Internal helpers ─────────────────────────────────────────────────────────

function makeActivity(kind: ActivityKind, intensity: number): PlaySceneActivity {
  return { kind, intensity }
}

function idleActivity(): PlaySceneActivity {
  return { kind: 'idle', intensity: 0 }
}

// ─── Heat source activity ─────────────────────────────────────────────────────

/**
 * Derive the activity state for the primary heat source.
 *
 * CH only         → ch_firing  (soft amber glow, intensity 0.6)
 * DHW draw        → dhw_firing (stronger orange-red glow, intensity 1.0)
 * Cylinder reheat → ch_firing  (primary circuit fires to heat coil, intensity 0.7)
 * CH + reheat     → ch_firing  (S-plan simultaneous; full intensity 1.0)
 * Idle            → idle       (no glow)
 */
function deriveHeatSourceActivity(frame: LabFrame): PlaySceneActivity {
  const mode = frame.systemMode ?? 'idle'
  const visuals = frame.visuals
  const burnerActive =
    visuals?.heatTransfers.find(h => h.nodeId === 'boiler_burner')?.active ?? false
  const plateHexActive =
    visuals?.heatTransfers.find(h => h.nodeId === 'combi_hex')?.active ?? false

  if (!burnerActive && !plateHexActive) return idleActivity()

  // Plate HEX active = combi DHW on-demand (high demand, stronger glow).
  if (plateHexActive) return makeActivity('dhw_firing', 1.0)

  // Burner active without plate HEX — depends on operating mode.
  switch (mode) {
    case 'dhw_draw':
      // Direct DHW (non-combi flow) — high demand.
      return makeActivity('dhw_firing', 0.9)
    case 'dhw_reheat':
      // Cylinder reheat — primary circuit fires to heat the coil.
      return makeActivity('ch_firing', 0.7)
    case 'heating_and_reheat':
      // S-plan simultaneous CH + coil reheat — both active.
      return makeActivity('ch_firing', 1.0)
    case 'heating':
    default:
      // CH only — moderate firing.
      return makeActivity('ch_firing', 0.6)
  }
}

// ─── Cylinder / coil activity ─────────────────────────────────────────────────

/**
 * Derive the activity state for the cylinder / thermal store.
 * Shows a reheat pulse when the primary coil is actively heating the store.
 */
function deriveCylinderActivity(frame: LabFrame): PlaySceneActivity {
  const visuals = frame.visuals
  const coilEntry = visuals?.heatTransfers.find(h => h.nodeId === 'cylinder_coil')
  if (!coilEntry?.active) return idleActivity()
  return makeActivity('reheat', coilEntry.intensity ?? 0.7)
}

// ─── Emitter activity ─────────────────────────────────────────────────────────

/**
 * Derive the activity state for the heating emitters (radiators / UFH).
 * Shows a heat-shimmer when emitters are actively releasing heat.
 */
function deriveEmitterActivity(frame: LabFrame): PlaySceneActivity {
  const visuals = frame.visuals
  const emitterEntry = visuals?.heatTransfers.find(h => h.nodeId === 'emitters')
  if (!emitterEntry?.active) return idleActivity()
  return makeActivity('emitting', emitterEntry.intensity ?? 0.6)
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build an explicit PlaySceneModel from LabControls + LabFrame.
 *
 * This function encodes all topology-specific display rules so the
 * renderer (LabCanvas) does not need to independently infer them.
 *
 * Call this once per render frame inside LabCanvas before drawing:
 *
 *   const scene = buildPlaySceneModel(controls, frame)
 *   // → use scene.metadata.showGenericColdFeed instead of controls.systemType checks
 *   // → use scene.nodes for activity-driven glow/pulse
 */
export function buildPlaySceneModel(
  controls: LabControls,
  frame: LabFrame,
): PlaySceneModel {
  const systemType = controls.systemType
  const isVented   = systemType === 'vented_cylinder'
  const isCylinder = isVented || systemType === 'unvented_cylinder'
  const isCombi    = systemType === 'combi'
  const mode       = frame.systemMode ?? 'idle'

  // ── Derive active domains ────────────────────────────────────────────────
  //
  // These four booleans are the single source of truth for which circuits
  // are live this frame.  All edge.active assignments below derive from them
  // via deriveActiveDomains() — avoiding scattered conditional logic that
  // could falsely activate the wrong branches.

  // Space-heating circuit running (boiler firing into the CH circuit).
  const isChActive = mode === 'heating' || mode === 'heating_and_reheat'

  // Cylinder coil reheating the store.  Driven by simulation hysteresis —
  // NOT by a tap opening.  A DHW draw depletes the store over time; the
  // threshold/hysteresis in simulation.ts decides when recovery begins.
  const cylinderNeedsReheat = mode === 'dhw_reheat' || mode === 'heating_and_reheat'

  // Domestic hot-water draw in progress.
  //
  // For combi systems the simulation sets mode = 'dhw_draw' when outlets
  // are open, so mode alone is sufficient.
  //
  // For stored (cylinder) systems the simulation does NOT set mode =
  // 'dhw_draw' — a domestic draw simply depletes the stored energy while
  // the mode tracks reheat state separately.  We therefore detect stored
  // DHW draw from the 'dhw_draw' fluid path emitted by simulation visuals.
  //
  // Falls back to mode === 'dhw_draw' when visuals are not yet populated
  // (e.g. on the very first render before a simulation frame has run).
  const dhwDraw =
    frame.visuals?.fluidPaths.find(p => p.edgeIds.includes('dhw_draw'))?.active
    ?? (mode === 'dhw_draw')

  const activeDomains = deriveActiveDomains({
    systemKind: isCombi ? 'combi' : 'stored',
    heatingDemand: isChActive,
    dhwDraw,
    cylinderNeedsReheat,
  })

  // Whether the CH circuit has any heating demand configured.
  // Radiators are also shown when the build graph contains emitter nodes so that
  // the system topology is always represented in the schematic, even when heating
  // is currently switched off.  The `active` flag (not `visible`) governs the
  // activity glow — emitters are active only when CH is running.
  const hasHeatingEmittersInGraph = controls.graphFacts?.hasHeatingCircuit === true
  const hasHeatingDemand =
    hasHeatingEmittersInGraph ||
    (controls.heatingDemand?.enabled === true) ||
    (controls.heatDemandKw !== undefined && controls.heatDemandKw > 0)

  // ── Metadata (topology display flags) ──────────────────────────────────────

  const metadata: PlaySceneModel['metadata'] = {
    // Vented cylinder uses tank-fed supply: hide generic mains cold feed to
    // prevent the duplicate side cold feed bug.
    showGenericColdFeed: !isVented,
    // CWS cistern and gravity-drop cold feed only for vented / tank-fed systems.
    showCwsRefill: isVented,
    // Heat source is always visible (PR5: never hide the boiler, even when idle).
    // The activity glow/animation in the renderer differentiates active vs idle.
    showHeatSource: true,
    // Show CH supply path and emitter block whenever heating is configured in the
    // graph or currently active.  This keeps the full topology visible at all times;
    // the renderer applies faint opacity when inactive (PR5 — no structure hidden).
    showHeatingPath: hasHeatingDemand || isChActive,
    // Cylinder systems render the DHW vessel as a thermal store (with fill level),
    // never as a simple pass-through pipe.
    showCylinderAsStore: isCylinder,
  }

  // ── Nodes ──────────────────────────────────────────────────────────────────

  // Heat source — always present and always visible (PR5: full topology always shown).
  // The activity kind / intensity drives the renderer glow/pulse independently of visibility.
  //
  // The heat source fires when:
  //   combi  — CH is running OR DHW draw is active (plate HEX fires on demand)
  //   stored — CH is running OR cylinder coil reheat is active
  // A stored DHW draw does NOT require the heat source: heat comes from stored energy.
  const heatSourceIsActive =
    activeDomains.heating ||
    activeDomains.primary ||
    (isCombi && activeDomains.dhw)

  const heatSourceNode: PlaySceneNode = {
    id: 'heat_source',
    role: 'heat_source',
    visible: true,
    active: heatSourceIsActive,
    x: 0,
    y: 0,
    activity: deriveHeatSourceActivity(frame),
  }

  // Cylinder / thermal store — present for cylinder system types only.
  // Active when hot water is being drawn from the store OR when the coil
  // is reheating the store.  A stored DHW draw uses energy from the cylinder
  // even though the boiler is not firing, so the cylinder must be shown active.
  const cylinderNode: PlaySceneNode | null = isCylinder
    ? {
        id: 'cylinder',
        role: 'cylinder',
        visible: true,
        active: activeDomains.dhw || activeDomains.primary,
        x: 0,
        y: 0,
        activity: deriveCylinderActivity(frame),
      }
    : null

  // CWS cistern — vented systems only; provides the tank-fed gravity cold supply.
  const cwsNode: PlaySceneNode | null = isVented
    ? {
        id: 'cws',
        role: 'cws',
        visible: true,
        active: false,
        x: 0,
        y: 0,
      }
    : null

  // Radiators / emitters — visible when heating demand is configured.
  const emitterAct = deriveEmitterActivity(frame)
  const radiatorsNode: PlaySceneNode = {
    id: 'radiators',
    role: 'radiators',
    visible: hasHeatingDemand,
    active: activeDomains.heating,
    x: 0,
    y: 0,
    activity: emitterAct,
  }

  // ── Edges ──────────────────────────────────────────────────────────────────
  //
  // PR5: ALL structural edges are emitted unconditionally so the renderer can
  // show the full system topology at all times.  The `active` flag (not
  // `visible`) drives opacity/animation styling — inactive edges are rendered
  // faded (not removed).

  const edges: PlaySceneEdge[] = []

  // CH flow / return — always present when a heating circuit is configured or
  // currently active.  Using `hasHeatingDemand || isChActive` ensures that:
  //   1. Structure is always shown when the graph has emitters (hasHeatingDemand),
  //      even while CH is off — inactive edges render faded (PR5).
  //   2. Edges also appear when heating is live (isChActive) even if graphFacts
  //      are not set, which covers presets that pre-date graphFacts propagation.
  // `active` reflects whether CH is currently running (domain-driven).
  if (hasHeatingDemand || activeDomains.heating) {
    edges.push({
      id: 'ch_flow',
      from: 'heat_source',
      to: 'radiators',
      kind: 'ch_flow',
      domain: 'heating',
      visible: true,
      active: activeDomains.heating,
      direction: 'forward',
    })
    edges.push({
      id: 'ch_return',
      from: 'radiators',
      to: 'heat_source',
      kind: 'ch_return',
      domain: 'heating',
      visible: true,
      active: activeDomains.heating,
      direction: 'forward',
    })
  }

  // DHW hot draw — always present for all system types (the hot-water path from
  // heat source / cylinder to the outlet manifold is always part of the topology).
  //
  // `active` is true when a domestic draw is in progress (activeDomains.dhw).
  //
  // KEY: For combi, mode === 'dhw_draw' implies the draw.
  //      For stored (cylinder) systems, the simulation does NOT use mode = 'dhw_draw'.
  //      A stored DHW draw is detected from the dhw_draw fluid path in visuals,
  //      which is active whenever hasDraw is true.  Using activeDomains.dhw
  //      (derived from that path) ensures this edge correctly shows flow during
  //      a stored tap draw, independent of cylinder reheat state.
  edges.push({
    id: 'dhw_hot',
    from: isCylinder ? 'cylinder' : 'heat_source',
    to: 'outlet_manifold',
    kind: 'dhw_hot',
    domain: 'dhw',
    visible: true,
    active: activeDomains.dhw,
    direction: 'forward',
  })

  // Tank refill edge — vented cylinder: gravity feed from CWS cistern into store.
  // Always present for vented systems; passive (no active pump).
  if (isVented) {
    edges.push({
      id: 'tank_refill',
      from: 'cws',
      to: 'cylinder',
      kind: 'tank_refill',
      domain: 'cold',
      visible: true,
      active: false, // passive gravity feed; no active pump
      direction: 'forward',
    })
  }

  // Primary coil — always present for cylinder systems (the coil is permanently
  // plumbed in; it does not come and go with demand).  S-plan allows this
  // simultaneously with CH (heating_and_reheat mode).
  //
  // `active` is true only when the cylinder store needs reheat (activeDomains.primary).
  // A domestic tap draw depletes the store over time, but the coil does NOT fire
  // on every draw — only when the hysteresis threshold has been crossed.
  if (isCylinder) {
    edges.push({
      id: 'coil_flow',
      from: 'heat_source',
      to: 'cylinder',
      kind: 'coil_flow',
      domain: 'primary',
      visible: true,
      active: activeDomains.primary,
      direction: 'forward',
    })
    edges.push({
      id: 'coil_return',
      from: 'cylinder',
      to: 'heat_source',
      kind: 'coil_return',
      domain: 'primary',
      visible: true,
      active: activeDomains.primary,
      direction: 'forward',
    })
  }

  // ── Assemble scene ─────────────────────────────────────────────────────────

  const nodes: PlaySceneNode[] = [
    heatSourceNode,
    ...(cylinderNode ? [cylinderNode] : []),
    ...(cwsNode ? [cwsNode] : []),
    radiatorsNode,
  ]

  return { nodes, edges, metadata }
}

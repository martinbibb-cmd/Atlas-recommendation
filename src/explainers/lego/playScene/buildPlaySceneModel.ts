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
  const mode       = frame.systemMode ?? 'idle'

  const isChActive  = mode === 'heating'  || mode === 'heating_and_reheat'
  const isDhwActive = mode === 'dhw_draw' || mode === 'dhw_reheat'
  const isActive    = isChActive || isDhwActive

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
  const heatSourceNode: PlaySceneNode = {
    id: 'heat_source',
    role: 'heat_source',
    visible: true,
    active: isActive,
    x: 0,
    y: 0,
    activity: deriveHeatSourceActivity(frame),
  }

  // Cylinder / thermal store — present for cylinder system types only.
  const cylinderNode: PlaySceneNode | null = isCylinder
    ? {
        id: 'cylinder',
        role: 'cylinder',
        visible: true,
        active: isDhwActive,
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
    active: isChActive,
    x: 0,
    y: 0,
    activity: emitterAct,
  }

  // ── Edges ──────────────────────────────────────────────────────────────────

  const edges: PlaySceneEdge[] = []

  // CH flow / return — visible when heating is active.
  if (isChActive) {
    edges.push({
      id: 'ch_flow',
      from: 'heat_source',
      to: 'radiators',
      kind: 'ch_flow',
      visible: true,
      active: true,
      direction: 'forward',
    })
    edges.push({
      id: 'ch_return',
      from: 'radiators',
      to: 'heat_source',
      kind: 'ch_return',
      visible: true,
      active: true,
      direction: 'forward',
    })
  }

  // DHW hot draw — visible when there is a domestic hot-water draw.
  if (mode === 'dhw_draw') {
    edges.push({
      id: 'dhw_hot',
      from: isCylinder ? 'cylinder' : 'heat_source',
      to: 'outlet_manifold',
      kind: 'dhw_hot',
      visible: true,
      active: true,
      direction: 'forward',
    })
  }

  // Tank refill edge — vented cylinder: gravity feed from CWS cistern into store.
  if (isVented) {
    edges.push({
      id: 'tank_refill',
      from: 'cws',
      to: 'cylinder',
      kind: 'tank_refill',
      visible: true,
      active: false, // passive gravity feed; no active pump
      direction: 'forward',
    })
  }

  // Primary coil — cylinder reheat path from heat source into the cylinder coil.
  // S-plan allows this simultaneously with CH (heating_and_reheat mode).
  if (isCylinder && (mode === 'dhw_reheat' || mode === 'heating_and_reheat')) {
    edges.push({
      id: 'coil_flow',
      from: 'heat_source',
      to: 'cylinder',
      kind: 'coil_flow',
      visible: true,
      active: true,
      direction: 'forward',
    })
    edges.push({
      id: 'coil_return',
      from: 'cylinder',
      to: 'heat_source',
      kind: 'coil_return',
      visible: true,
      active: true,
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

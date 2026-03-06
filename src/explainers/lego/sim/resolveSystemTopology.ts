// src/explainers/lego/sim/resolveSystemTopology.ts
//
// Runtime topology classifier for the Atlas simulation engine.
//
// `resolveSystemTopology` inspects a saved BuildGraph and returns a
// ResolvedSystemTopology that the simulator can use instead of making
// generic service assumptions (e.g. treating every system as mains-fed).
//
// This replaces the "mains cold inlet + direct DHW service path" default with
// a topology-derived model so that:
//   - vented cylinders use CWS/tank-fed replenishment and head-pressure limits
//   - unvented cylinders use mains-fed replenishment
//   - combis use on-demand mains-fed DHW (no storage)
//   - heating circuit presence and control topology are correctly resolved

import type { BuildGraph, PartKind } from '../builder/types'

// ─── Resolved topology type ───────────────────────────────────────────────────

/**
 * High-level topology resolved from a saved BuildGraph snapshot.
 *
 * Used by the runtime simulator to derive correct behaviour for each
 * DHW service type rather than applying generic mains-fed assumptions.
 *
 * Field notes
 * ───────────
 * dhwServiceType   — how DHW is produced / stored
 * dhwSupplyType    — what feeds the domestic cold-water inlet
 *   'mains'        — mains-pressure cold supply (combi, unvented)
 *   'cws_tank'     — cold-water storage cistern (vented cylinder)
 *   'stored'       — DHW comes from a stored volume (any cylinder draw-off)
 *   'none'         — heating-only system with no DHW service
 * hasPrimaryCoil   — true when a cylinder has a primary heating coil
 * hasHeatingCircuit — true when at least one heating emitter is present
 * controlTopology  — how primary heat distribution is controlled
 * cylinderNodeId   — graph node ID of the DHW cylinder (when present)
 * heatSourceNodeId — graph node ID of the primary heat source
 * outletSourceNodeId — the node that acts as the domestic hot-water source
 *                       (cylinder hot_out for stored; boiler hot_out for combi)
 */
export type ResolvedSystemTopology = {
  dhwServiceType: 'combi' | 'vented_cylinder' | 'unvented_cylinder' | 'mixergy' | 'none'
  dhwSupplyType: 'mains' | 'cws_tank' | 'stored' | 'none'
  hasPrimaryCoil: boolean
  hasHeatingCircuit: boolean
  controlTopology: 'none' | 'y_plan' | 's_plan' | 's_plan_multi_zone' | 'hp_diverter'
  cylinderNodeId?: string
  heatSourceNodeId?: string
  outletSourceNodeId?: string
}

// ─── Node-kind sets ───────────────────────────────────────────────────────────

const CYLINDER_KINDS = new Set<PartKind>([
  'dhw_vented_cylinder',
  'dhw_unvented_cylinder',
  'dhw_mixergy',
])

const HEAT_SOURCE_KINDS = new Set<PartKind>([
  'heat_source_combi',
  'heat_source_system_boiler',
  'heat_source_regular_boiler',
  'heat_source_heat_pump',
])

const HEATING_EMITTER_KINDS = new Set<PartKind>([
  'radiator_loop',
  'ufh_loop',
])

// ─── Topology classifier ──────────────────────────────────────────────────────

/**
 * Inspect a saved BuildGraph and return a ResolvedSystemTopology.
 *
 * The resolver does NOT require a fully-wired graph: it makes best-effort
 * inferences from the node kinds that are present, so partial graphs during
 * build mode still produce a useful classification.
 */
export function resolveSystemTopology(graph: BuildGraph): ResolvedSystemTopology {
  const nodes = graph.nodes

  // ── DHW service type ───────────────────────────────────────────────────────
  const ventedCylNode   = nodes.find(n => n.kind === 'dhw_vented_cylinder')
  const unventedCylNode = nodes.find(n => n.kind === 'dhw_unvented_cylinder')
  const mixergyNode     = nodes.find(n => n.kind === 'dhw_mixergy')
  const combiNode       = nodes.find(n => n.kind === 'heat_source_combi')

  let dhwServiceType: ResolvedSystemTopology['dhwServiceType'] = 'none'
  let cylinderNodeId: string | undefined
  let outletSourceNodeId: string | undefined

  if (combiNode) {
    dhwServiceType = 'combi'
    outletSourceNodeId = combiNode.id
  } else if (mixergyNode) {
    dhwServiceType = 'mixergy'
    cylinderNodeId = mixergyNode.id
    outletSourceNodeId = mixergyNode.id
  } else if (ventedCylNode) {
    dhwServiceType = 'vented_cylinder'
    cylinderNodeId = ventedCylNode.id
    outletSourceNodeId = ventedCylNode.id
  } else if (unventedCylNode) {
    dhwServiceType = 'unvented_cylinder'
    cylinderNodeId = unventedCylNode.id
    outletSourceNodeId = unventedCylNode.id
  }

  // ── DHW supply type ────────────────────────────────────────────────────────
  // Vented cylinder is fed from a CWS cistern (tank-fed, not mains-fed).
  // Unvented cylinder and Mixergy are mains-fed.
  // Combi is mains-fed (on-demand).
  let dhwSupplyType: ResolvedSystemTopology['dhwSupplyType'] = 'none'

  if (dhwServiceType === 'combi') {
    dhwSupplyType = 'mains'
  } else if (dhwServiceType === 'vented_cylinder') {
    // A vented cylinder is always tank-fed (CWS cistern), regardless of
    // whether an explicit cws_cistern node is present in the graph.
    dhwSupplyType = 'cws_tank'
  } else if (dhwServiceType === 'unvented_cylinder' || dhwServiceType === 'mixergy') {
    dhwSupplyType = 'mains'
  }

  // isStoredSystem is used for hasPrimaryCoil determination below.
  const isStoredSystem =
    dhwServiceType === 'vented_cylinder' ||
    dhwServiceType === 'unvented_cylinder' ||
    dhwServiceType === 'mixergy'

  // ── Primary heat source ────────────────────────────────────────────────────
  const heatSourceNode = nodes.find(n => HEAT_SOURCE_KINDS.has(n.kind))
  const heatSourceNodeId = heatSourceNode?.id

  // ── Primary coil ──────────────────────────────────────────────────────────
  // Any indirect cylinder (vented, unvented, mixergy) has a primary heating
  // coil — it is how the heat source warms the stored water.
  const hasPrimaryCoil = isStoredSystem

  // ── Heating circuit ────────────────────────────────────────────────────────
  const hasHeatingCircuit = nodes.some(n => HEATING_EMITTER_KINDS.has(n.kind))

  // ── Control topology ───────────────────────────────────────────────────────
  const hasThreePortValve = nodes.some(n => n.kind === 'three_port_valve')
  const zoneValveCount    = nodes.filter(n => n.kind === 'zone_valve').length
  const hasBuffer         = nodes.some(n => n.kind === 'buffer' || n.kind === 'low_loss_header')
  const hasHeatPump       = nodes.some(n => n.kind === 'heat_source_heat_pump')

  let controlTopology: ResolvedSystemTopology['controlTopology'] = 'none'

  if (hasHeatPump && hasBuffer) {
    controlTopology = 'hp_diverter'
  } else if (hasThreePortValve) {
    controlTopology = 'y_plan'
  } else if (zoneValveCount >= 3) {
    controlTopology = 's_plan_multi_zone'
  } else if (zoneValveCount >= 2) {
    controlTopology = 's_plan'
  }

  return {
    dhwServiceType,
    dhwSupplyType,
    hasPrimaryCoil,
    hasHeatingCircuit,
    controlTopology,
    cylinderNodeId,
    heatSourceNodeId,
    outletSourceNodeId,
  }
}

// ─── Topology-aware bottleneck label ─────────────────────────────────────────

/**
 * Return a human-readable label for the "supply" bottleneck that is appropriate
 * for the resolved topology.
 *
 * For vented cylinders the bottleneck is the tank-fed (CWS) head pressure, not
 * the mains supply. For all other system types it is the mains supply.
 */
export function supplyBottleneckLabel(topology: ResolvedSystemTopology): string {
  if (topology.dhwServiceType === 'vented_cylinder') {
    return 'tank-fed supply (head pressure)'
  }
  return 'mains supply'
}

/**
 * Return a human-readable description of where domestic hot water comes from,
 * suitable for a "Supply conditions" heading in Play mode.
 */
export function dhwSourceDescription(topology: ResolvedSystemTopology): string {
  switch (topology.dhwServiceType) {
    case 'combi':
      return 'On-demand hot water (mains-fed)'
    case 'vented_cylinder':
      return 'Stored hot water (tank-fed, vented cylinder)'
    case 'unvented_cylinder':
      return 'Stored hot water (mains-fed, unvented cylinder)'
    case 'mixergy':
      return 'Stored hot water (mains-fed, Mixergy cylinder)'
    case 'none':
      return 'Heating only — no DHW service'
  }
}

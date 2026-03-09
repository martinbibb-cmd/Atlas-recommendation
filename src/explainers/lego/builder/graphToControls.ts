// src/explainers/lego/builder/graphToControls.ts
//
// Derives a LabControls object from a BuildGraph and an optional controls patch.
// Called when the user transitions from Build mode to Play mode so the animation
// runs with parameters inferred from the drawn topology.

import type { BuildGraph, PartKind } from './types'
import type { LabControls, OutletControl, OutletKind, SystemType } from '../animation/types'
import { defaultOutlets } from '../animation/types'
import { deriveFacts } from './graphDerive'
import { resolveSystemTopology } from '../sim/resolveSystemTopology'
import { deriveSystemKindFromGraph } from './deriveSystemKind'
import { supplyOriginsForSystemType } from '../sim/supplyOrigins'

/**
 * Convert a `BuildGraph` (node-link topology) plus an optional `Partial<LabControls>`
 * override into a fully-populated `LabControls` ready for `computeCapacitySummary`
 * and `LabCanvas`.
 *
 * Precedence (highest last, so later values win):
 *   1. Hard-coded defaults (safe for any system)
 *   2. Topology inferences from the graph (system type, graphFacts, outletBindings)
 *   3. Caller-supplied `patch` (e.g. from a loaded preset)
 *
 * graphFacts and outletBindings are always sourced from the live graph so the
 * simulation reflects the drawn topology rather than stale preset data.
 */
/** Default combi boiler DHW output (kW). Used as the simulation base value and
 *  displayed in the Play sidebar when no override has been selected. */
export const DEFAULT_COMBI_DHW_KW = 30

// ─── Outlet-kind helpers ───────────────────────────────────────────────────────

const OUTLET_PART_KINDS = new Set<PartKind>([
  'tap_outlet', 'bath_outlet', 'shower_outlet', 'cold_tap_outlet',
])

/** Map a builder PartKind to the Play-mode OutletKind. */
function outletKindFromPartKind(partKind: PartKind): OutletKind {
  switch (partKind) {
    case 'shower_outlet':   return 'shower_mixer'
    case 'bath_outlet':     return 'bath'
    case 'tap_outlet':      return 'basin'
    case 'cold_tap_outlet': return 'cold_tap'
    default:                return 'basin'
  }
}

/** Default demand flow rate (L/min) for each outlet kind. */
function defaultDemandLpm(kind: OutletKind): number {
  switch (kind) {
    case 'shower_mixer': return 10
    case 'bath':         return 18
    case 'cold_tap':     return 6
    case 'basin':
    default:             return 5
  }
}

/** Slot labels are uppercase letters A, B, C, D, … */
const SLOT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Build an `OutletControl[]` from the outlet nodes present in the graph.
 *
 * Each outlet node in the build graph becomes one entry in the list.
 * Slot labels (A, B, C, …) are assigned in the order the nodes appear.
 * Service class and cold source kind are populated from `outletModels`.
 *
 * Falls back to `defaultOutlets()` when the graph contains no outlet nodes
 * (e.g. standalone demo presets that don't use the builder graph).
 */
function outletsFromGraph(
  graph: BuildGraph,
  outletModels: ReturnType<typeof deriveFacts>['outletModels'],
): { outlets: OutletControl[]; outletBindings: Record<string, string> } {
  const outletNodes = graph.nodes.filter(n => OUTLET_PART_KINDS.has(n.kind))

  if (outletNodes.length === 0) {
    return {
      outlets: defaultOutlets(),
      outletBindings: graph.outletBindings ?? {},
    }
  }

  // Use the existing graph outletBindings as the primary slot→node mapping when
  // available (preserving manually assigned slot positions from the builder UI).
  // Fill in any outlet nodes not yet bound by assigning them the next free letter.
  const existingBindings: Record<string, string> = { ...(graph.outletBindings ?? {}) }

  // Build a reverse lookup: nodeId → slotLabel from existing bindings.
  const nodeToSlot: Record<string, string> = {}
  for (const [slot, nodeId] of Object.entries(existingBindings)) {
    nodeToSlot[nodeId] = slot
  }

  // Assign slots to outlet nodes not yet in the existing bindings.
  const assignedBindings: Record<string, string> = { ...existingBindings }
  for (const node of outletNodes) {
    if (!nodeToSlot[node.id]) {
      // Find next free letter
      let assigned = false
      for (const letter of SLOT_LETTERS) {
        if (!assignedBindings[letter]) {
          assignedBindings[letter] = node.id
          nodeToSlot[node.id] = letter
          assigned = true
          break
        }
      }
      if (!assigned) break // more than 26 outlets — shouldn't happen
    }
  }

  // Build the outlet list ordered by slot letter so A, B, C, … are in order.
  const sortedEntries = Object.entries(assignedBindings).sort(([a], [b]) => a.localeCompare(b))

  const outlets: OutletControl[] = []
  for (const [slot, nodeId] of sortedEntries) {
    const node = graph.nodes.find(n => n.id === nodeId)
    if (!node || !OUTLET_PART_KINDS.has(node.kind)) continue

    const kind = outletKindFromPartKind(node.kind)
    const model = outletModels[nodeId]

    const outlet: OutletControl = {
      id: slot,
      // Only the first outlet starts enabled so the simulation does not begin
      // with simultaneous demand across all outlets.
      enabled: outlets.length === 0,
      kind,
      demandLpm: defaultDemandLpm(kind),
      builderNodeId: nodeId,
      ...(model ? { serviceClass: model.serviceClass, coldSourceKind: model.coldSourceKind } : {}),
      // Enable TMV by default for shower outlets.
      ...(kind === 'shower_mixer' ? { tmvEnabled: true, tmvTargetTempC: 40 } : {}),
    }
    outlets.push(outlet)
  }

  return { outlets, outletBindings: assignedBindings }
}

export function graphToLabControls(
  graph: BuildGraph,
  patch: Partial<LabControls> = {},
): LabControls {
  const facts = deriveFacts(graph)

  // ── Infer system type from topology ────────────────────────────────────────
  let inferredSystemType: SystemType = 'combi'
  if (facts.hasStoredDhw) {
    const hasVented = graph.nodes.some(n => n.kind === 'dhw_vented_cylinder')
    inferredSystemType = hasVented ? 'vented_cylinder' : 'unvented_cylinder'
  }

  const resolvedSystemType: SystemType = patch.systemType ?? inferredSystemType

  // ── Cylinder defaults (used when stored-DHW topology is detected) ──────────
  const needsCylinder =
    resolvedSystemType === 'unvented_cylinder' || resolvedSystemType === 'vented_cylinder'

  const cylinderDefaults = needsCylinder
    ? {
        volumeL: 180,
        initialTempC: 55,
        reheatKw: 12,
      }
    : undefined

  const ventedDefaults =
    resolvedSystemType === 'vented_cylinder' ? { headMeters: 3 } : undefined

  // ── Derive outlets from graph topology ─────────────────────────────────────
  // When the graph contains outlet nodes, build a dynamic outlet list with
  // service class and cold source kind populated from the topology analysis.
  // When the graph is empty (standalone presets), fall back to the static
  // three-slot defaults so legacy presets continue to work unchanged.
  const { outlets: derivedOutlets, outletBindings: derivedBindings } =
    outletsFromGraph(graph, facts.outletModels)

  // ── Base defaults ──────────────────────────────────────────────────────────
  const base: LabControls = {
    systemType: resolvedSystemType,
    coldInletC: 10,
    dhwSetpointC: 50,
    combiDhwKw: DEFAULT_COMBI_DHW_KW,
    mainsDynamicFlowLpm: 14,
    pipeDiameterMm: 15,
    outlets: derivedOutlets,
    ...(cylinderDefaults ? { cylinder: cylinderDefaults } : {}),
    ...(ventedDefaults ? { vented: ventedDefaults } : {}),
  }

  // ── Merge patch (overrides base, but graphFacts + outletBindings are pinned) ─
  const topology = resolveSystemTopology(graph)

  // systemKind is ALWAYS derived from the graph — never from the patch.
  // This is the single source of truth for Play mode system classification.
  const systemKind = deriveSystemKindFromGraph(graph)

  // Count zone valves directly from graph nodes for Play scene topology indicator.
  const zoneValveCount = graph.nodes.filter(n => n.kind === 'zone_valve').length

  return {
    ...base,
    ...patch,
    // Always derive these from the live graph so topology changes are respected.
    systemKind,
    graphFacts: {
      hotFedOutletNodeIds: facts.hotFedOutletNodeIds,
      coldOnlyOutletNodeIds: facts.coldOnlyOutletNodeIds,
      hasStoredDhw: facts.hasStoredDhw,
      // Carry the heating-circuit presence flag so the play renderer can show
      // emitters from the build graph even when heating demand is currently off.
      hasHeatingCircuit: topology.hasHeatingCircuit,
      // Mixergy cylinder — distinct from a standard unvented cylinder.
      // Drives the Play scene label ("Mixergy cylinder") and topology indicator.
      isMixergy: topology.dhwServiceType === 'mixergy',
      // Zone valve count — drives control-topology indicator in Play schematic.
      zoneValveCount,
      // Per-outlet service model: cold source kind (mains/cws) and service class.
      outletModels: facts.outletModels,
    },
    // outletBindings is derived from the graph; patch may not override it.
    outletBindings: derivedBindings,
    // Control topology drives S-plan simultaneous CH + reheat behaviour.
    // Patch may not override this — it must always reflect the drawn graph.
    controlTopology: topology.controlTopology,
    // Supply origins — authoritative mapping of which source nodes feed each
    // water service for this system type.  Used by the render layer to draw
    // cold and hot pipe paths from the correct origin.
    supplyOrigins: supplyOriginsForSystemType(resolvedSystemType, {
      isHeatPump: systemKind === 'heat_pump',
      hasHeatingCircuit: topology.hasHeatingCircuit,
    }),
  }
}

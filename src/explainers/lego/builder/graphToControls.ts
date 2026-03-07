// src/explainers/lego/builder/graphToControls.ts
//
// Derives a LabControls object from a BuildGraph and an optional controls patch.
// Called when the user transitions from Build mode to Play mode so the animation
// runs with parameters inferred from the drawn topology.

import type { BuildGraph } from './types'
import type { LabControls, SystemType } from '../animation/types'
import { defaultOutlets } from '../animation/types'
import { deriveFacts } from './graphDerive'
import { resolveSystemTopology } from '../sim/resolveSystemTopology'
import { deriveSystemKindFromGraph } from './deriveSystemKind'

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

  // ── Base defaults ──────────────────────────────────────────────────────────
  const base: LabControls = {
    systemType: resolvedSystemType,
    coldInletC: 10,
    dhwSetpointC: 50,
    combiDhwKw: DEFAULT_COMBI_DHW_KW,
    mainsDynamicFlowLpm: 14,
    pipeDiameterMm: 15,
    outlets: defaultOutlets(),
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
    },
    outletBindings: graph.outletBindings,
    // Control topology drives S-plan simultaneous CH + reheat behaviour.
    // Patch may not override this — it must always reflect the drawn graph.
    controlTopology: topology.controlTopology,
  }
}

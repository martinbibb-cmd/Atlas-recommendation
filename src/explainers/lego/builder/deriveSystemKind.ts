// src/explainers/lego/builder/deriveSystemKind.ts
//
// Single-source-of-truth helper for classifying a built graph into one of three
// high-level system kinds.
//
// DerivedSystemKind is a COARSER type than SystemType:
//   SystemType  → 'combi' | 'unvented_cylinder' | 'vented_cylinder'
//   DerivedSystemKind → 'combi' | 'stored' | 'heat_pump'
//
// Use DerivedSystemKind everywhere Play mode needs to branch on system behaviour
// (domain routing, UI control gating, scene model selection).
// Use SystemType only where fine-grained cylinder or vented/unvented detail matters
// (e.g. simulation hydraulics, CWS head pressure).

import type { BuildGraph } from './types'
import type { DerivedSystemKind } from '../animation/types'

/** Re-export so callers can import both the type and function from one place. */
export type { DerivedSystemKind }

const CYLINDER_KINDS = new Set([
  'dhw_unvented_cylinder',
  'dhw_mixergy',
  'dhw_vented_cylinder',
])

/**
 * Derive the high-level system kind from the built graph topology.
 *
 * Classification rules (checked in priority order):
 *   1. heat_pump  — graph contains a `heat_source_heat_pump` node.
 *   2. stored     — graph contains any DHW cylinder / thermal store node.
 *   3. combi      — all other graphs (including graph with `heat_source_combi`
 *                   and the empty graph default).
 *
 * This function is the SINGLE SOURCE OF TRUTH for system kind in Play mode.
 * It must NEVER be overridden by a controls patch — the graph topology always wins.
 * Call it directly from any Play-entry path instead of reading `controls.systemType`.
 */
export function deriveSystemKindFromGraph(graph: BuildGraph): DerivedSystemKind {
  // Heat pump takes precedence — even if a cylinder is present, the heat source
  // determines the broad operating model.
  if (graph.nodes.some(n => n.kind === 'heat_source_heat_pump')) {
    return 'heat_pump'
  }

  // Any DHW storage vessel → stored system (cylinder or Mixergy thermal store).
  if (graph.nodes.some(n => CYLINDER_KINDS.has(n.kind))) {
    return 'stored'
  }

  // Default — covers combi boiler graphs and the empty graph.
  return 'combi'
}

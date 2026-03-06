// src/explainers/lego/compare/runCompareSession.ts
//
// Runs a CompareSession by evaluating each system entry against the shared
// play-state and collecting a CompareResultCard for each system.
//
// Design rule: the shared play-state is identical for all systems.
// Each system resolves its own topology independently and then runs
// through the capacity summary pipeline.

import type { CompareSession, CompareResultCard } from './types'
import { resolveSystemTopology } from '../sim/resolveSystemTopology'
import { graphToLabControls } from '../builder/graphToControls'
import { computeCapacitySummary } from '../animation/capacitySummary'
import { playStateToOutletControls } from '../state/playState'
import { CWS_HEAD_METERS } from '../state/playState'
import type { LabControls } from '../animation/types'
import { summariseCompareResult } from './summariseCompareResult'

// ─── Play-state → LabControls bridge ─────────────────────────────────────────

/**
 * Translate the shared PlayState into a LabControls patch that respects the
 * resolved topology of each compared system.
 *
 * For vented cylinders the supply cap comes from `cwsHeadPreset → headMeters`.
 * For mains-fed systems the supply cap comes from `mainsDynamicFlowLpm`.
 * Both take the inlet temperature from `supplyConditions.inletTempC`.
 */
function playStateToControlsPatch(
  session: CompareSession,
  systemKind: 'vented' | 'mains',
): Partial<LabControls> {
  const { sharedPlayState } = session
  const { supplyConditions } = sharedPlayState
  const inletTempC = supplyConditions.inletTempC as LabControls['coldInletC']

  const outlets = playStateToOutletControls(sharedPlayState.demands)

  const base: Partial<LabControls> = {
    coldInletC:   inletTempC,
    outlets,
    heatingDemand: sharedPlayState.heating,
    mainsDynamicFlowLpm: supplyConditions.mainsDynamicFlowLpm ?? 14,
  }

  if (systemKind === 'vented') {
    const headPreset = supplyConditions.cwsHeadPreset ?? 'typical'
    return {
      ...base,
      vented: { headMeters: CWS_HEAD_METERS[headPreset] },
    }
  }

  return base
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a `CompareSession` and return one `CompareResultCard` per system entry.
 *
 * Each system is evaluated independently:
 *   1. Resolve its topology from its BuildGraph.
 *   2. Derive LabControls from the graph + shared play-state.
 *   3. Compute a CapacitySummary from those controls.
 *   4. Summarise the result into a CompareResultCard.
 *
 * The order of the returned cards matches the order of `session.systems`.
 */
export function runCompareSession(session: CompareSession): CompareResultCard[] {
  return session.systems.map(entry => {
    const topology = resolveSystemTopology(entry.graph)
    const systemKind = topology.dhwServiceType === 'vented_cylinder' ? 'vented' : 'mains'
    const patch = playStateToControlsPatch(session, systemKind)
    const controls = graphToLabControls(entry.graph, patch)
    const summary = computeCapacitySummary(controls)
    return summariseCompareResult(entry, topology, summary, session.sharedPlayState)
  })
}

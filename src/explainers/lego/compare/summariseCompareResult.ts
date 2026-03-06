// src/explainers/lego/compare/summariseCompareResult.ts
//
// Derives a compact CompareResultCard from a system entry, resolved topology,
// and capacity summary.  This is the output contract for compare mode —
// one card per compared system.

import type { CompareSystemEntry, CompareResultCard } from './types'
import type { ResolvedSystemTopology } from '../sim/resolveSystemTopology'
import { dhwSourceDescription, supplyBottleneckLabel } from '../sim/resolveSystemTopology'
import type { CapacitySummary } from '../animation/capacitySummary'
import type { PlayState } from '../state/playState'
import { determineOperatingMode } from '../state/playState'

// ─── Operating mode label ─────────────────────────────────────────────────────

function operatingModeLabel(
  playState: PlayState,
  topology: ResolvedSystemTopology,
): string {
  // 'none' (heating-only) falls through to 'combi' here only to drive the
  // determineOperatingMode helper — the actual DHW service type is unused for
  // operating mode labelling; the labels produced below handle 'none' explicitly.
  const systemType =
    topology.dhwServiceType === 'combi' || topology.dhwServiceType === 'none'
      ? 'combi'
      : 'unvented_cylinder'

  const mode = determineOperatingMode(playState, systemType)

  switch (mode) {
    case 'IDLE':
      return 'Idle'
    case 'CH_ONLY':
      return 'Heating only'
    case 'DHW_ONLY':
      return topology.dhwServiceType === 'combi'
        ? 'On-demand hot water'
        : 'Stored hot water draw'
    case 'CH_AND_DHW':
      return 'Heating + stored hot water'
    case 'CYLINDER_REHEAT':
      return 'Cylinder recharging'
  }
}

// ─── DHW summary ──────────────────────────────────────────────────────────────

function dhwSummaryLabel(
  topology: ResolvedSystemTopology,
  summary: CapacitySummary,
): string {
  const flow = summary.hydraulicFlowLpm
  const delivered = Math.round(flow * 10) / 10

  if (flow < 0.1) {
    if (topology.dhwServiceType === 'none') return 'No hot water service'
    return 'No hot water demand'
  }

  const tempPart = summary.achievedOutTempC !== undefined
    ? ` at ${Math.round(summary.achievedOutTempC)} °C`
    : ''

  if (summary.limitingComponent === 'Supply' || summary.limitingComponent === 'Thermal') {
    const constraint = topology.dhwServiceType === 'vented_cylinder'
      ? 'tank-fed supply'
      : topology.dhwServiceType === 'combi'
        ? 'combi thermal capacity'
        : 'mains-fed supply'
    return `${delivered} L/min delivered — limited by ${constraint}${tempPart}`
  }

  return `${delivered} L/min delivered${tempPart}`
}

// ─── Heating summary ─────────────────────────────────────────────────────────

function heatingSummaryLabel(
  playState: PlayState,
  topology: ResolvedSystemTopology,
  summary: CapacitySummary,
): string {
  const heatingEnabled = playState.heating.enabled
  if (!topology.hasHeatingCircuit) return 'No heating circuit'
  if (!heatingEnabled) return 'Heating off'

  const hasDhwDraw = summary.hydraulicFlowLpm > 0.1
  if (topology.dhwServiceType === 'combi' && hasDhwDraw) {
    return 'Heating paused — DHW priority'
  }

  const flowTemp = playState.heating.targetFlowTempC ?? 70
  return `Heating active at ${flowTemp} °C flow temp`
}

// ─── Headline ─────────────────────────────────────────────────────────────────

function headlineLabel(
  topology: ResolvedSystemTopology,
  summary: CapacitySummary,
  playState: PlayState,
): string {
  const hasDhwDraw = summary.hydraulicFlowLpm > 0.1
  const heatingEnabled = playState.heating.enabled

  if (!hasDhwDraw && !heatingEnabled) {
    return 'System idle — no demand'
  }

  if (topology.dhwServiceType === 'combi') {
    if (hasDhwDraw && heatingEnabled) return 'Heating pauses during hot water draw'
    if (hasDhwDraw) return 'On-demand hot water — no storage'
    return 'Heating only — combi system'
  }

  if (topology.dhwServiceType === 'vented_cylinder') {
    if (summary.limitingComponent === 'Supply') return 'Performance limited by tank-fed supply'
    if (hasDhwDraw && heatingEnabled) return 'Stored hot water serves demand alongside heating'
    if (hasDhwDraw) return 'Stored hot water serves demand'
    return 'Heating only — stored hot water available'
  }

  if (
    topology.dhwServiceType === 'unvented_cylinder' ||
    topology.dhwServiceType === 'mixergy'
  ) {
    if (summary.limitingComponent === 'Supply') return 'Performance limited by mains-fed supply'
    if (hasDhwDraw && heatingEnabled) return 'Stored hot water serves demand alongside heating'
    if (hasDhwDraw) return 'Stored hot water serves demand at mains pressure'
    return 'Heating only — stored hot water available'
  }

  return 'No hot water service — heating only'
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derive a compact `CompareResultCard` from a system entry and its simulation outputs.
 *
 * This is a pure function — it does not run the simulation itself.
 * The caller is responsible for running `computeCapacitySummary` with the
 * correct `LabControls` before calling this function.
 *
 * @param entry       - The system entry from the compare session.
 * @param topology    - The resolved topology for this system's graph.
 * @param summary     - The capacity summary produced by `computeCapacitySummary`.
 * @param playState   - The shared play-state that drove the simulation.
 */
export function summariseCompareResult(
  entry: CompareSystemEntry,
  topology: ResolvedSystemTopology,
  summary: CapacitySummary,
  playState: PlayState,
): CompareResultCard {
  // Only surface a bottleneck label when supply or thermal capacity is the
  // limiting factor — pipe bottlenecks are surfaced via warnings instead.
  const isSupplyOrThermalLimit =
    (summary.limitingComponent === 'Supply' || summary.limitingComponent === 'Thermal') &&
    summary.hydraulicFlowLpm > 0
  const bottleneck = isSupplyOrThermalLimit ? supplyBottleneckLabel(topology) : undefined

  return {
    systemId: entry.id,
    label:    entry.label,
    topologyLabel:   dhwSourceDescription(topology),
    operatingMode:   operatingModeLabel(playState, topology),
    dhwSummary:      dhwSummaryLabel(topology, summary),
    heatingSummary:  heatingSummaryLabel(playState, topology, summary),
    bottleneck,
    headline:  headlineLabel(topology, summary, playState),
    warnings:  summary.warnings,
  }
}

// src/explainers/lego/compare/types.ts
//
// Data model for compare mode — runs the same shared play-state against
// multiple saved or generated system topologies side by side.

import type { PlayState } from '../state/playState'
import type { BuildGraph } from '../builder/types'

// ─── Compare session ──────────────────────────────────────────────────────────

/**
 * A single system entry inside a compare session.
 *
 * `graph` is the BuildGraph that describes this system's topology.
 * Compare mode runs the shared play-state through each entry's graph
 * independently so the results are comparable under identical conditions.
 */
export type CompareSystemEntry = {
  /** Stable identifier for this slot within the session. */
  id: string
  /** Human-readable display label shown on the result card. */
  label: string
  /** The saved BuildGraph snapshot for this system topology. */
  graph: BuildGraph
}

/**
 * A compare session pairs one shared play-state with N system entries.
 *
 * Design rule: the play-state is shared and drives all systems equally —
 * there are no per-system supply or demand overrides.
 * Each system resolves its own topology and produces an independent result.
 */
export type CompareSession = {
  /** Optional human-readable name for this comparison scenario. */
  scenarioName?: string
  /**
   * One shared play-state that drives all compared systems.
   * All systems see the same demand, supply conditions, and inlet temperature.
   */
  sharedPlayState: PlayState
  /** The systems being compared — at least two entries for a meaningful comparison. */
  systems: CompareSystemEntry[]
}

// ─── Compare result card ──────────────────────────────────────────────────────

/**
 * Compact comparison result for a single system.
 *
 * This is the output contract for `summariseCompareResult()`.
 * It sits on top of the full simulation result and distils the most
 * decision-relevant information into a short, readable summary.
 *
 * Headlines are short statements of operating behaviour, e.g.:
 *   "Heating pauses during shower"
 *   "Stored hot water serves both outlets"
 *   "Performance limited by mains-fed supply"
 *   "Cylinder recharge required after extended draw"
 */
export type CompareResultCard = {
  /** Matches CompareSystemEntry.id. */
  systemId: string
  /** Display label for this system. */
  label: string
  /** Human-readable topology description, e.g. "On-demand hot water (mains-fed)". */
  topologyLabel: string
  /**
   * High-level operating mode in plain language.
   * Examples: "Idle", "Heating only", "On-demand hot water", "Heating + stored hot water"
   */
  operatingMode: string
  /**
   * One-line summary of domestic hot water behaviour.
   * Examples: "10 L/min delivered at 40 °C", "Supply limited by tank-fed head pressure"
   */
  dhwSummary: string
  /**
   * One-line summary of heating behaviour.
   * Examples: "Heating active at 70 °C flow temp", "Heating paused — DHW priority"
   */
  heatingSummary: string
  /**
   * The primary constraint limiting performance, if any.
   * Examples: "mains-fed supply", "tank-fed supply (head pressure)", "combi thermal capacity"
   */
  bottleneck?: string
  /**
   * Short verdict for this system under the shared play-state.
   * Used as the card headline in the comparison UI.
   */
  headline: string
  /**
   * Actionable warnings surfaced from the simulation.
   * Shown beneath the headline in the compare card.
   */
  warnings: string[]
}

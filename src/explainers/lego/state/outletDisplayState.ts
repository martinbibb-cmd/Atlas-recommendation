// src/explainers/lego/state/outletDisplayState.ts
//
// Explicit per-outlet display state for the Draw-off Panel.
//
// This layer sits between the simulation frame (LabFrame) and the render layer.
// It resolves each outlet's service classification, current flow, delivered
// temperature, and any concurrency constraint so the renderer can show:
//
//   Kitchen sink — mixed, 8.2 L/min, 46 °C
//   Cold tap     — mains cold, 10.5 °C
//   Ensuite      — mixed, 11.4 L/min, cooling under concurrent demand
//
// The render layer must use OutletDisplayState — NOT outlet.serviceClass or
// raw colours alone — to label taps as hot, cold, or mixed.

import type { LabFrame, LabControls, OutletControl } from '../animation/types'

// ─── Water service classification ────────────────────────────────────────────

/**
 * Classifies the current water service state of a single outlet.
 *
 * cold_only            — outlet draws cold supply only (cold tap, drinking tap).
 * hot_only             — outlet draws from the hot-water service only.
 * mixed_hot_running    — mixed outlet is open; hot service is delivering.
 * mixed_cold_running   — mixed outlet is open but only cold water is flowing
 *                        (e.g. hot service not yet reached temperature).
 * off                  — outlet is closed.
 */
export type OutletWaterService =
  | 'cold_only'
  | 'hot_only'
  | 'mixed_hot_running'
  | 'mixed_cold_running'
  | 'off'

// ─── Per-outlet display state ─────────────────────────────────────────────────

/**
 * Fully resolved display state for a single outlet.
 *
 * The renderer uses this — not raw colours or serviceClass alone — to label
 * each outlet as hot, cold, or mixed.
 */
export type OutletDisplayState = {
  /** Outlet slot identifier (e.g. 'A', 'B', 'C'). */
  outletId: string
  /** Human-readable label derived from outlet kind and slot. */
  label: string
  /** Whether this outlet is currently open (drawing water). */
  open: boolean
  /** Current water service classification. */
  service: OutletWaterService
  /** Delivered flow rate (L/min); 0 when closed. */
  flowLpm: number
  /** Delivered water temperature (°C); undefined when closed or no sample yet. */
  deliveredTempC?: number
  /**
   * True when this outlet is receiving less flow than it demanded because
   * of a supply or system capacity constraint.
   *
   * Causes may include:
   *   - mains dynamic flow shared across multiple outlets
   *   - combi kW insufficient to heat required flow rate
   *   - low tank-fed head pressure (vented systems)
   */
  isConstrained: boolean
  /**
   * Human-readable constraint description when isConstrained is true.
   * e.g. "Low mains flow: 6.0 L/min shared across 2 outlets"
   */
  constraintReason?: string
  /**
   * Which cold rail this outlet is connected to.
   * 'mains' — pressurised mains cold supply (combi, unvented).
   * 'cws'   — gravity-fed CWS cold rail (open-vented systems).
   * undefined — hot-only outlet or not yet resolved.
   */
  coldSource?: 'mains' | 'cws'
  /**
   * Which hot water service delivers to this outlet.
   * 'on_demand' — combi plate HEX: cold mains heated on demand, no stored volume.
   * 'stored'    — cylinder hot-out port: hot water drawn from a thermal store.
   * undefined   — cold-only outlet or source not yet resolved.
   */
  hotSource?: 'on_demand' | 'stored'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimum temperature (°C) above cold inlet that counts as "hot running". */
const HOT_RUNNING_THRESHOLD_DELTA_C = 10

/**
 * Map an outlet control kind to a readable label prefix.
 */
function outletKindLabel(kind: OutletControl['kind']): string {
  switch (kind) {
    case 'shower_mixer': return 'Shower'
    case 'basin':        return 'Basin'
    case 'bath':         return 'Bath'
    case 'cold_tap':     return 'Cold tap'
    default:             return 'Outlet'
  }
}

/**
 * Determine the water service state for an enabled mixed outlet based on
 * the delivered temperature relative to the cold inlet temperature.
 *
 * mixed_hot_running  — delivered temp is appreciably above cold inlet
 * mixed_cold_running — delivered temp is close to cold inlet (hot not yet arrived)
 */
function mixedServiceState(
  deliveredTempC: number,
  coldInletC: number,
): OutletWaterService {
  return deliveredTempC > coldInletC + HOT_RUNNING_THRESHOLD_DELTA_C
    ? 'mixed_hot_running'
    : 'mixed_cold_running'
}

/**
 * Determine whether an outlet is cold-only based on service class, kind, or
 * graph-fact lookups (backward compatibility with legacy LabControls).
 */
function resolveIsColdOnly(outlet: OutletControl, controls: LabControls): boolean {
  if (outlet.serviceClass === 'cold_only') return true
  if (outlet.serviceClass === 'mixed' || outlet.serviceClass === 'hot_only') return false
  if (outlet.kind === 'cold_tap') return true
  const nodeId = outlet.builderNodeId ?? controls.outletBindings?.[outlet.id]
  return !!(nodeId && controls.graphFacts?.coldOnlyOutletNodeIds.includes(nodeId))
}

// ─── Main derivation function ─────────────────────────────────────────────────

/**
 * Derive the display state for every outlet in `controls.outlets`.
 *
 * Reads:
 *   - `controls.outlets`          — static outlet configuration (kind, service class)
 *   - `controls.supplyOrigins`    — explicit supply-origin mapping (hot source identity)
 *   - `frame.outletSamples`       — EMA temperature samples per outlet
 *   - `frame.systemMode`          — current operating mode (for constraint detection)
 *   - `controls.coldInletC`       — cold supply temperature
 *   - `controls.mainsDynamicFlowLpm` — mains supply capacity (constraint check)
 *
 * Returns one `OutletDisplayState` per outlet, in slot order.
 */
export function deriveOutletDisplayStates(
  controls: LabControls,
  frame: LabFrame,
): OutletDisplayState[] {
  const coldInletC = controls.coldInletC

  // Resolve hot source identity from supply origins — must not be inferred ad hoc.
  // on_demand: combi plate HEX (mainsColdIn heated on demand, no stored volume).
  // stored:    cylinder hot_out port (drawn from a thermal store).
  const hotSource: OutletDisplayState['hotSource'] =
    controls.supplyOrigins?.onDemandHot ? 'on_demand'
    : controls.supplyOrigins?.dhwHotStore ? 'stored'
    : undefined

  // Count open hot outlets to detect potential sharing constraints.
  const openHotOutlets = controls.outlets.filter(
    o => o.enabled && !resolveIsColdOnly(o, controls),
  )
  const totalHotDemandLpm = openHotOutlets.reduce((sum, o) => sum + o.demandLpm, 0)
  const mainsFlowLpm = controls.mainsDynamicFlowLpm

  // Constraint check: total hot demand exceeds mains dynamic flow capacity.
  const mainsIsConstraining =
    openHotOutlets.length >= 2 &&
    mainsFlowLpm < totalHotDemandLpm

  return controls.outlets.map((outlet): OutletDisplayState => {
    const isColdOnly = resolveIsColdOnly(outlet, controls)
    const label = `${outletKindLabel(outlet.kind)} ${outlet.id}`
    const sample = frame.outletSamples[outlet.id]

    if (!outlet.enabled) {
      return {
        outletId: outlet.id,
        label,
        open: false,
        service: 'off',
        flowLpm: 0,
        isConstrained: false,
        coldSource: outlet.coldSourceKind,
      }
    }

    // Delivered temperature from EMA sample (may be 0 if no tokens yet).
    const deliveredTempC = sample && sample.count > 0 ? sample.tempC : undefined

    let service: OutletWaterService
    if (isColdOnly) {
      service = 'cold_only'
    } else if (outlet.serviceClass === 'hot_only') {
      service = 'hot_only'
    } else {
      // Mixed outlet — classify by delivered temperature.
      service = deliveredTempC !== undefined
        ? mixedServiceState(deliveredTempC, coldInletC)
        : 'mixed_hot_running'  // assume hot until sample proves otherwise
    }

    // Constraint detection for this outlet.
    let isConstrained = false
    let constraintReason: string | undefined

    if (!isColdOnly && mainsIsConstraining) {
      isConstrained = true
      constraintReason =
        `Low mains flow: ${mainsFlowLpm.toFixed(1)} L/min shared across ${openHotOutlets.length} outlets`
    }

    // Delivered flow — the outlet's demand when open (constraint not yet
    // modelled per-outlet here; the simulation handles actual delivered flow).
    const flowLpm = outlet.demandLpm

    return {
      outletId: outlet.id,
      label,
      open: true,
      service,
      flowLpm,
      deliveredTempC,
      isConstrained,
      constraintReason,
      coldSource: outlet.coldSourceKind,
      hotSource: isColdOnly ? undefined : hotSource,
    }
  })
}

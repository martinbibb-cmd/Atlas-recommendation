// src/explainers/lego/simulator/useStoredHotWaterPlayback.ts
//
// Display adapter hook that derives stored hot water state from
// SystemDiagramDisplayState, cylinder size, and cylinder type.
//
// Architecture mirrors useEfficiencyPlayback and useDrawOffPlayback:
//   SimulatorDashboard → useStoredHotWaterPlayback(diagramState, cylinderType, cylinderSizeLitres)
//                      → StoredHotWaterDisplayState | null
//
// Returns null for combi systems (no stored reserve).
//
// Mixergy advantage is explicit here:
//   - usableReserveFraction is scaled by MIXERGY_USABLE_RESERVE_FACTOR (1.2)
//   - deliveryTempC remains stable deeper into draw than a standard cylinder
//   - topTempC stays closer to setpoint because stratification preserves the hot zone
//
// All values are deterministic — derived entirely from cylinderFillPct
// and the cylinder inputs.  No Math.random() is used.

import type { SystemDiagramDisplayState } from './useSystemDiagramPlayback'
import type { CylinderType } from './systemInputsTypes'
import { MIXERGY_USABLE_RESERVE_FACTOR } from './systemInputsTypes'

// ─── Physics constants ────────────────────────────────────────────────────────

/**
 * Nominal cylinder setpoint (°C).
 * Used to model the top-section temperature for Mixergy stratification.
 */
const SETPOINT_C = 60

/**
 * Delivery temperature at minimum usable reserve (°C).
 * Below this the cylinder_depleted limiter would already have fired.
 */
const MIN_DELIVERY_C = 38

/**
 * Delivery temperature at full cylinder (°C).
 * Slightly below setpoint to account for blending at the draw-off point.
 */
const MAX_DELIVERY_C = 55

// ─── Public state type ────────────────────────────────────────────────────────

/**
 * All display-relevant state for stored hot water reserve.
 *
 * Sourced entirely from:
 *   - diagramState.cylinderFillPct  (fractional fill, 0–1)
 *   - cylinderSizeLitres            (nominal cylinder capacity)
 *   - cylinderType                  (unvented / open_vented / mixergy)
 *   - diagramState.systemMode       (to detect reheat)
 */
export type StoredHotWaterDisplayState = {
  /**
   * Effective hot water volume available for draw-off (litres).
   *
   * Mixergy: applies MIXERGY_USABLE_RESERVE_FACTOR (×1.2) so the effective
   * available volume is up to 20% greater at any given fill fraction.
   */
  availableHotWaterL: number

  /**
   * Estimated delivery temperature at the outlet (°C).
   *
   * For Mixergy this declines more slowly than for a standard cylinder of
   * the same nominal size, because stratification keeps the top section hot
   * even as the overall fill decreases.
   */
  deliveryTempC: number

  /**
   * Temperature of the top section of the cylinder (°C).
   *
   * For Mixergy: stays near SETPOINT_C until effective reserve is low.
   * For standard: falls roughly with fill.
   */
  topTempC: number

  /**
   * Temperature of the bottom section of the cylinder (°C).
   * Represents the cold-inlet blending zone.
   */
  bottomTempC: number

  /**
   * Effective usable reserve fraction (0–1).
   *
   * For Mixergy: min(cylinderFillPct × MIXERGY_USABLE_RESERVE_FACTOR, 1.0).
   * For standard: equals cylinderFillPct.
   */
  usableReserveFraction: number

  /**
   * True when the boiler or heat source is actively reheating the cylinder.
   * Derived from systemMode === 'dhw_reheat' | 'heating_and_reheat'.
   */
  isReheatActive: boolean

  /**
   * Nominal cylinder volume (litres).  Passed through for display context.
   */
  cylinderSizeLitres: number

  /**
   * Cylinder technology type.  Passed through to drive Mixergy-specific UI.
   */
  cylinderType: CylinderType
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Delivery temperature at the draw-off point (°C), derived from
 * usableReserveFraction.
 *
 * Mixergy keeps deliveryTempC stable longer because the MIXERGY_USABLE_RESERVE_FACTOR
 * already raises the effective fill fraction, meaning the interpolation stays
 * in the high-temp zone deeper into draw.
 */
function computeDeliveryTempC(usableReserveFraction: number): number {
  return Math.round(MIN_DELIVERY_C + usableReserveFraction * (MAX_DELIVERY_C - MIN_DELIVERY_C))
}

/**
 * Top-section temperature (°C).
 *
 * Mixergy: stratification holds the top section near SETPOINT_C until the
 * effective reserve drops below ~50%, then falls steeply.
 *
 * Standard: tracks deliveryTempC with a small fixed offset.
 */
function computeTopTempC(
  cylinderFillPct: number,
  usableReserveFraction: number,
  cylinderType: CylinderType,
): number {
  if (cylinderType === 'mixergy') {
    // Mixergy top stays near setpoint until effective reserve is low.
    // Slight penalty applied only in the last 20% of usable reserve.
    const penalty = Math.max(0, (0.2 - usableReserveFraction) * 30)
    return Math.round(Math.max(SETPOINT_C - penalty, MIN_DELIVERY_C))
  }
  // Standard cylinder: top is consistently warmer than delivery,
  // but declines roughly with raw fill.
  return Math.round(MIN_DELIVERY_C + cylinderFillPct * 17 + 5)
}

/**
 * Bottom-section temperature (°C).
 * Represents the cold-inlet zone.  Mixergy has a steeper gradient
 * (sharper hot/cold split), so the bottom stays colder.
 */
function computeBottomTempC(
  cylinderFillPct: number,
  cylinderType: CylinderType,
): number {
  const base = cylinderType === 'mixergy' ? 16 : 22
  return Math.round(base + cylinderFillPct * 14)
}

// ─── Public hook ──────────────────────────────────────────────────────────────

/**
 * Display adapter that derives stored hot water state from the authoritative
 * SystemDiagramDisplayState plus cylinder inputs.
 *
 * Returns null for combi systems (no thermal store present).
 *
 * Mixergy distinction:
 *   - usableReserveFraction is multiplied by MIXERGY_USABLE_RESERVE_FACTOR (1.2)
 *   - deliveryTempC declines more slowly through the draw because
 *     usableReserveFraction stays higher for longer
 *   - topTempC stays near setpoint until effective reserve is nearly exhausted
 *   - cylinder_depleted limiter fires later than for a standard cylinder
 *
 * @param diagramState        Live display state from useSystemDiagramPlayback.
 * @param cylinderType        'open_vented' | 'unvented' | 'mixergy'.
 * @param cylinderSizeLitres  Nominal cylinder capacity in litres.
 */
export function useStoredHotWaterPlayback(
  diagramState: SystemDiagramDisplayState,
  cylinderType: CylinderType,
  cylinderSizeLitres: number,
): StoredHotWaterDisplayState | null {
  const { systemType, cylinderFillPct, systemMode } = diagramState

  // Combi systems have no thermal store.
  if (systemType === 'combi') return null
  // cylinderFillPct is required for stored systems; guard defensively.
  if (cylinderFillPct === undefined) return null

  const usableReserveFactor =
    cylinderType === 'mixergy' ? MIXERGY_USABLE_RESERVE_FACTOR : 1.0

  // Effective usable fraction: Mixergy can exceed raw fill fraction.
  const usableReserveFraction = Math.min(cylinderFillPct * usableReserveFactor, 1.0)

  const availableHotWaterL = Math.round(usableReserveFraction * cylinderSizeLitres)

  const deliveryTempC = computeDeliveryTempC(usableReserveFraction)
  const topTempC = computeTopTempC(cylinderFillPct, usableReserveFraction, cylinderType)
  const bottomTempC = computeBottomTempC(cylinderFillPct, cylinderType)

  const isReheatActive =
    systemMode === 'dhw_reheat' || systemMode === 'heating_and_reheat'

  return {
    availableHotWaterL,
    deliveryTempC,
    topTempC,
    bottomTempC,
    usableReserveFraction,
    isReheatActive,
    cylinderSizeLitres,
    cylinderType,
  }
}

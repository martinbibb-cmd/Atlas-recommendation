// src/explainers/lego/sim/supplyOrigins.ts
//
// Explicit supply-origin mapping for each system type.
//
// This module is the authoritative source for answering: "where does the cold
// supply come from, and where does the hot water come from?" for each system
// template.  The render layer must bind cold/hot pipe paths to these named
// source nodes — not infer them from system type or schematic position.
//
// Source node vocabulary
// ──────────────────────
// mainsColdIn        — pressurised mains cold water entering the property.
//                      Used by combi and unvented cylinder systems.
// cwsTankCold        — gravity-fed cold supply from the CWS cistern in the roof.
//                      Used by open-vented cylinder systems.
// dhwHotStore        — stored hot water leaving the cylinder hot_out port.
//                      Present for stored-cylinder systems only.
// primaryHeatingLoop — primary circuit loop: heat source → cylinder coil or
//                      CH emitters → heat source.
// outsideHeatSource  — heat pump refrigerant unit sited outside the property.
//                      Only relevant for heat pump systems.

import type { SystemType } from '../animation/types'

// ─── Source node identifiers ─────────────────────────────────────────────────

/**
 * The named supply-origin nodes for a system.
 *
 * Each node is either present (string ID) or absent (undefined) depending on
 * the system type.  Renderers and topology checkers must use these — not
 * systemType booleans — to decide where to draw cold and hot supply paths.
 */
export type LabSupplyOrigins = {
  /**
   * Pressurised mains cold water entry point.
   * Present for combi and unvented cylinder systems.
   * Absent for open-vented systems (which use cwsTankCold instead).
   */
  mainsColdIn?: 'mains_cold_in'
  /**
   * CWS cistern gravity-fed cold supply.
   * Present for open-vented cylinder systems only.
   * Absent for mains-pressurised systems.
   */
  cwsTankCold?: 'cws_tank_cold'
  /**
   * Stored hot water output from the cylinder hot_out port.
   * Present for stored-cylinder systems (vented and unvented, Mixergy).
   * Absent for combi systems (which deliver hot water on demand from the
   * plate HEX, not from a store).
   */
  dhwHotStore?: 'dhw_hot_store'
  /**
   * Primary heating circuit loop (heat source → emitters/coil → return).
   * Present for all system types that have a heating circuit.
   * The loop is always the primary domain — never the domestic hot-water path.
   */
  primaryHeatingLoop?: 'primary_heating_loop'
  /**
   * Outside refrigerant unit for heat pump systems.
   * Only present when heatSourceType === 'heat_pump'.
   */
  outsideHeatSource?: 'outside_heat_source'
}

// ─── Factory function ─────────────────────────────────────────────────────────

/**
 * Return the supply origins for a given system type and heat source.
 *
 * Rules:
 *   combi            → mainsColdIn only (no store)
 *   unvented_cylinder → mainsColdIn + dhwHotStore + primaryHeatingLoop
 *   vented_cylinder   → cwsTankCold + dhwHotStore + primaryHeatingLoop
 *   heat_pump variant → outsideHeatSource replaces / supplements primaryHeatingLoop
 *
 * All system types with a heating circuit receive primaryHeatingLoop.
 */
export function supplyOriginsForSystemType(
  systemType: SystemType,
  opts: {
    /**
     * True when the heat source is a heat pump.
     * Adds outsideHeatSource to the origins.
     */
    isHeatPump?: boolean
    /**
     * True when a heating circuit is present in the built graph.
     * Controls whether primaryHeatingLoop is included.
     * Defaults to true when not provided (safe assumption).
     */
    hasHeatingCircuit?: boolean
  } = {},
): LabSupplyOrigins {
  const hasHeating = opts.hasHeatingCircuit !== false   // default true
  const isHeatPump = opts.isHeatPump === true

  const origins: LabSupplyOrigins = {}

  switch (systemType) {
    case 'combi':
      origins.mainsColdIn = 'mains_cold_in'
      break

    case 'unvented_cylinder':
      origins.mainsColdIn  = 'mains_cold_in'
      origins.dhwHotStore  = 'dhw_hot_store'
      break

    case 'vented_cylinder':
      origins.cwsTankCold = 'cws_tank_cold'
      origins.dhwHotStore = 'dhw_hot_store'
      break
  }

  if (hasHeating) {
    origins.primaryHeatingLoop = 'primary_heating_loop'
  }

  if (isHeatPump) {
    origins.outsideHeatSource = 'outside_heat_source'
  }

  return origins
}

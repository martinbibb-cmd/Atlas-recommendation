// src/explainers/lego/sim/createDefaultSupplyModel.ts
//
// Derives a default SupplyModel from a resolved system topology.
//
// Design rules:
//   - combi              → mains (on-demand, no storage)
//   - unvented cylinder  → mains (mains-fed replenishment)
//   - mixergy            → mains (mains-fed replenishment)
//   - vented cylinder    → cws_tank (gravity / CWS cistern fed)
//   - none (heat-only)   → mains (safe fallback for heating-only systems)
//
// There is no generic fallback to mains for all systems. Every topology
// that involves a vented cylinder must use the tank-fed supply model.

import type { ResolvedSystemTopology } from './resolveSystemTopology'
import type { SupplyModel } from './supplyModel'

/** Default cold mains inlet temperature (°C). */
const DEFAULT_COLD_INLET_C = 10

/** Default dynamic mains flow rate (L/min) for mains-fed systems. */
const DEFAULT_MAINS_FLOW_LPM = 14

/**
 * Derive a default `SupplyModel` from a resolved system topology.
 *
 * This is the canonical entry point for supply model initialisation.
 * It ensures that vented cylinder systems always start with a `cws_tank`
 * supply model and never incorrectly default to a mains supply.
 *
 * @param topology  The resolved topology from `resolveSystemTopology`.
 * @returns A `SupplyModel` appropriate for the topology.
 */
export function createDefaultSupplyModel(topology: ResolvedSystemTopology): SupplyModel {
  if (topology.dhwServiceType === 'vented_cylinder') {
    return {
      mode: 'cws_tank',
      inletTempC: DEFAULT_COLD_INLET_C,
      headQuality: 'typical',
    }
  }

  // Combi, unvented cylinder, Mixergy, and heating-only systems all default
  // to mains-fed supply. Heating-only systems do not use the DHW supply, but
  // a mains fallback is harmless and safe.
  return {
    mode: 'mains',
    inletTempC: DEFAULT_COLD_INLET_C,
    dynamicFlowLpm: DEFAULT_MAINS_FLOW_LPM,
  }
}

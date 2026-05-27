/**
 * systemBuilderToConceptModel.ts
 *
 * Maps a SystemBuilderState (the UI survey model) to a SystemConceptModel
 * (the composable four-layer architecture model used by the Lego builder).
 *
 * This is the bridge between the survey step and the architecture visualiser.
 * It converts the legacy heat-source taxonomy ('regular' / 'system' / 'combi' /
 * 'storage_combi') into the composable model that separates heat source from
 * DHW service and controls topology.
 */

import type { SystemBuilderState, HeatSource, DhwType, EmitterType, ControlFamily } from '../../../features/survey/systemBuilder/systemBuilderTypes';
import type { SystemConceptModel, HeatSourceKind, HotWaterServiceKind, ControlTopologyKind, EmitterKind } from '../model/types';

// ─── Heat source mapping ─────────────────────────────────────────────────────

function mapHeatSource(heatSource: HeatSource | null): HeatSourceKind {
  switch (heatSource) {
    case 'regular':       return 'regular_boiler';
    case 'system':        return 'system_boiler';
    case 'combi':         return 'system_boiler';   // combi is a system_boiler with integrated plate HEX
    case 'storage_combi': return 'system_boiler';   // storage combi is also system_boiler architecture
    default:              return 'system_boiler';   // safe fallback
  }
}

// ─── DHW type mapping ─────────────────────────────────────────────────────────

function mapDhwType(
  heatSource: HeatSource | null,
  dhwType: DhwType | null,
): HotWaterServiceKind {
  // Storage combi has an integrated store; regular combi uses on-demand plate HEX
  if (heatSource === 'storage_combi') return 'storage_combi';
  // Plain combi delivers DHW via integrated plate HEX
  if (heatSource === 'combi') return 'combi_plate_hex';

  switch (dhwType) {
    case 'open_vented':   return 'vented_cylinder';
    case 'unvented':      return 'unvented_cylinder';
    case 'thermal_store': return 'thermal_store';
    case 'plate_hex':     return 'combi_plate_hex';
    case 'small_store':   return 'unvented_cylinder';
    default:              return 'vented_cylinder';   // safe fallback
  }
}

// ─── Controls topology mapping ────────────────────────────────────────────────

function mapControlFamily(
  heatSource: HeatSource | null,
  controlFamily: ControlFamily | null,
): ControlTopologyKind {
  // Combi systems have no external zone-control topology
  // Storage combi still has an integrated store but no separate zone valve
  if (heatSource === 'combi' || heatSource === 'storage_combi') {
    return 'none';
  }

  switch (controlFamily) {
    case 'combi_integral': return 'none';
    case 'y_plan':         return 'y_plan';
    case 's_plan':         return 's_plan';
    case 's_plan_plus':    return 's_plan_multi_zone';
    case 'thermal_store':  return 's_plan';    // thermal store uses S-plan routing
    case 'unknown':        return 'y_plan';    // most common default
    default:               return 'y_plan';    // safe fallback
  }
}

// ─── Emitter mapping ──────────────────────────────────────────────────────────

function mapEmitters(emitters: EmitterType | null): EmitterKind[] {
  switch (emitters) {
    case 'radiators_standard':
    case 'radiators_designer': return ['radiators'];
    case 'underfloor':         return ['ufh'];
    case 'mixed':              return ['mixed'];
    default:                   return ['radiators'];  // most common default
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * systemBuilderToConceptModel
 *
 * Converts a survey SystemBuilderState into a SystemConceptModel for use
 * by the architecture visualiser and the Lego graph builder.
 *
 * @param state - The current SystemBuilderState from the survey.
 * @returns A SystemConceptModel representing the current system architecture.
 */
export function systemBuilderToConceptModel(state: SystemBuilderState): SystemConceptModel {
  const heatSource = mapHeatSource(state.heatSource);
  const hotWaterService = mapDhwType(state.heatSource, state.dhwType);
  const controls = mapControlFamily(state.heatSource, state.controlFamily);
  const emitters = mapEmitters(state.emitters);

  return {
    heatSource,
    hotWaterService,
    controls,
    emitters,
    traits: {
      integratedPump:      heatSource !== 'regular_boiler',
      integratedExpansion: heatSource !== 'regular_boiler',
      integratedPlateHex:  hotWaterService === 'combi_plate_hex' || hotWaterService === 'storage_combi',
    },
  };
}
